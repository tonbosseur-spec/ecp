import { supabase } from './supabaseClient';
import { saveToCache, loadFromCache } from './offlineSync';
import { 
  InteractiveCourseModule, 
  InteractiveCourseLesson, 
  InteractiveActivity, 
  InteractiveActivityProgress, 
  CourseProgressionSummary 
} from '../types';

/**
 * Fetch all progress records for a user in a given course.
 * Automatically uses localStorage cache for instant loading & offline resilience.
 */
export async function getUserCourseProgress(
  userId: string,
  courseId: string
): Promise<Map<string, InteractiveActivityProgress>> {
  const progressMap = new Map<string, InteractiveActivityProgress>();
  const cacheKey = `interactive_progress_${userId}_${courseId}`;

  // 1. Load from cache first
  const cachedData = loadFromCache(cacheKey);
  if (Array.isArray(cachedData)) {
    for (const item of cachedData) {
      if (item.activity_id) {
        progressMap.set(item.activity_id, item);
      }
    }
  }

  // 2. Fetch fresh data from Supabase if online
  if (navigator.onLine && userId) {
    try {
      const { data, error } = await supabase
        .from('interactive_activity_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (!error && Array.isArray(data)) {
        progressMap.clear();
        for (const item of data) {
          if (item.activity_id) {
            progressMap.set(item.activity_id, item);
          }
        }
        saveToCache(cacheKey, data);
      } else if (error) {
        console.warn('Notice: table interactive_activity_progress non synchronisée ou erreur:', error.message);
      }
    } catch (err) {
      console.warn('Erreur réseau lors de la récupération de la progression:', err);
    }
  }

  return progressMap;
}

/**
 * Record or update an activity's completion status for a user.
 * Idempotent upsert with local cache update and offline queue fallback.
 */
export async function recordActivityProgress(params: {
  userId: string;
  courseId: string;
  lessonId: string;
  activityId: string;
  completed: boolean;
}): Promise<{ success: boolean; data?: InteractiveActivityProgress; error?: string }> {
  const { userId, courseId, lessonId, activityId, completed } = params;

  if (!userId || !courseId || !lessonId || !activityId) {
    return { success: false, error: 'Paramètres manquants pour enregistrer la progression.' };
  }

  const nowIso = new Date().toISOString();
  const record: InteractiveActivityProgress = {
    user_id: userId,
    course_id: courseId,
    lesson_id: lessonId,
    activity_id: activityId,
    completed,
    completed_at: completed ? nowIso : null,
    updated_at: nowIso
  };

  // 1. Immediately update local cache
  const cacheKey = `interactive_progress_${userId}_${courseId}`;
  const cachedData: InteractiveActivityProgress[] = loadFromCache(cacheKey) || [];
  const existingIdx = cachedData.findIndex(p => p.activity_id === activityId);
  if (existingIdx >= 0) {
    cachedData[existingIdx] = { ...cachedData[existingIdx], ...record };
  } else {
    cachedData.push(record);
  }
  saveToCache(cacheKey, cachedData);

  // 2. Persist to Supabase
  try {
    const { data, error } = await supabase
      .from('interactive_activity_progress')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          lesson_id: lessonId,
          activity_id: activityId,
          completed,
          completed_at: completed ? nowIso : null,
          updated_at: nowIso
        },
        {
          onConflict: 'user_id,activity_id'
        }
      )
      .select()
      .single();

    if (error) {
      console.warn('Notice: enregistrement progression Supabase:', error.message);
      // We still consider it locally successful for fluid UX
      return { success: true, data: record };
    }

    return { success: true, data: data || record };
  } catch (err: any) {
    console.warn('Erreur réseau enregistrement progression:', err);
    // Offline resilience: keep in local cache
    return { success: true, data: record };
  }
}

/**
 * Calculate full course progression summary given modules structure and completed activities map.
 */
export function calculateCourseProgression(
  modules: InteractiveCourseModule[],
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): CourseProgressionSummary {
  let totalActivities = 0;
  let completedActivities = 0;
  let totalRequiredActivities = 0;
  let completedRequiredActivities = 0;
  const completedActivityIds = new Set<string>();

  let nextLessonId: string | null = null;
  let nextActivityId: string | null = null;

  const isActivityCompleted = (actId: string): boolean => {
    if (completedMap instanceof Set) {
      return completedMap.has(actId);
    }
    const val = completedMap.get(actId);
    if (typeof val === 'boolean') return val;
    return val?.completed === true;
  };

  // Traverse in chronological order (modules -> lessons -> activities)
  for (const module of modules) {
    const lessons = module.interactive_course_lessons || [];
    for (const lesson of lessons) {
      const activities = lesson.interactive_activities || [];
      for (const act of activities) {
        totalActivities++;
        const isReq = act.is_required !== false;
        if (isReq) totalRequiredActivities++;

        const isDone = isActivityCompleted(act.id);
        if (isDone) {
          completedActivities++;
          completedActivityIds.add(act.id);
          if (isReq) completedRequiredActivities++;
        } else if (!nextLessonId) {
          // First uncompleted activity found!
          nextLessonId = lesson.id;
          nextActivityId = act.id;
        }
      }
    }
  }

  const percentage = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;
  const requiredPercentage = totalRequiredActivities > 0 
    ? Math.round((completedRequiredActivities / totalRequiredActivities) * 100) 
    : percentage;

  // Course is completed if all required activities are done (or all activities if no required specified)
  const isCourseCompleted = totalActivities > 0 && (
    totalRequiredActivities > 0 
      ? completedRequiredActivities >= totalRequiredActivities 
      : completedActivities >= totalActivities
  );

  return {
    totalActivities,
    completedActivities,
    totalRequiredActivities,
    completedRequiredActivities,
    percentage,
    requiredPercentage,
    isCourseCompleted,
    nextLessonId,
    nextActivityId,
    completedActivityIds
  };
}

/**
 * Calculate progression summary for a single lesson.
 */
export function calculateLessonProgression(
  activities: InteractiveActivity[],
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): {
  total: number;
  completed: number;
  percentage: number;
  isCompleted: boolean;
} {
  let completed = 0;
  const total = activities.length;

  const isActivityCompleted = (actId: string): boolean => {
    if (completedMap instanceof Set) {
      return completedMap.has(actId);
    }
    const val = completedMap.get(actId);
    if (typeof val === 'boolean') return val;
    return val?.completed === true;
  };

  for (const act of activities) {
    if (isActivityCompleted(act.id)) {
      completed++;
    }
  }

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const requiredActivities = activities.filter(a => a.is_required !== false);
  let isCompleted = false;
  if (total > 0) {
    if (requiredActivities.length > 0) {
      isCompleted = requiredActivities.every(a => isActivityCompleted(a.id));
    } else {
      isCompleted = completed >= total;
    }
  }

  return {
    total,
    completed,
    percentage,
    isCompleted
  };
}
