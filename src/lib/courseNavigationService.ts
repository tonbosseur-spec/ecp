import { 
  InteractiveCourseModule, 
  InteractiveCourseLesson, 
  InteractiveActivity, 
  InteractiveActivityProgress 
} from '../types';

export interface FlattenedActivityItem {
  module: {
    id: string;
    title: string;
    position: number;
  };
  lesson: {
    id: string;
    title: string;
    position: number;
  };
  activity: {
    id: string;
    title: string;
    position: number;
    activity_type: string;
    is_required: boolean;
    points?: number;
  };
  globalIndex: number;
}

/**
 * Utility helper to determine if an activity ID is marked as completed in the progress map or set.
 */
export function isActivityCompletedInMap(
  activityId: string,
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string> | undefined | null
): boolean {
  if (!completedMap || !activityId) return false;
  if (completedMap instanceof Set) {
    return completedMap.has(activityId);
  }
  const val = completedMap.get(activityId);
  if (typeof val === 'boolean') return val;
  return val?.completed === true;
}

/**
 * Sorts modules, lessons, and activities, and returns a flat chronological array.
 * Strictly ordered by:
 * 1. module.position (asc)
 * 2. lesson.position (asc)
 * 3. activity.position (asc)
 */
export function flattenCourseStructure(modules: InteractiveCourseModule[]): FlattenedActivityItem[] {
  if (!Array.isArray(modules) || modules.length === 0) {
    return [];
  }

  // 1. Sort modules by position
  const sortedModules = [...modules].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const flatItems: FlattenedActivityItem[] = [];

  let globalIndex = 0;

  for (const moduleItem of sortedModules) {
    const lessons = moduleItem.interactive_course_lessons || [];
    // 2. Sort lessons by position
    const sortedLessons = [...lessons].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    for (const lessonItem of sortedLessons) {
      const activities = lessonItem.interactive_activities || [];
      // 3. Sort activities by position
      const sortedActivities = [...activities].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      for (const actItem of sortedActivities) {
        flatItems.push({
          module: {
            id: moduleItem.id,
            title: moduleItem.title,
            position: moduleItem.position ?? 0
          },
          lesson: {
            id: lessonItem.id,
            title: lessonItem.title,
            position: lessonItem.position ?? 0
          },
          activity: {
            id: actItem.id,
            title: actItem.title,
            position: actItem.position ?? 0,
            activity_type: actItem.activity_type,
            is_required: actItem.is_required !== false,
            points: actItem.points
          },
          globalIndex: globalIndex++
        });
      }
    }
  }

  return flatItems;
}

/**
 * Get the next activity in the chronological order.
 * Crosses lesson and module boundaries automatically.
 */
export function getNextActivity(
  modules: InteractiveCourseModule[],
  currentActivityId: string
): FlattenedActivityItem | null {
  const flattened = flattenCourseStructure(modules);
  const currentIdx = flattened.findIndex(item => item.activity.id === currentActivityId);

  if (currentIdx === -1 || currentIdx >= flattened.length - 1) {
    return null;
  }

  return flattened[currentIdx + 1];
}

/**
 * Get the previous activity in the chronological order.
 * Crosses lesson and module boundaries automatically.
 */
export function getPreviousActivity(
  modules: InteractiveCourseModule[],
  currentActivityId: string
): FlattenedActivityItem | null {
  const flattened = flattenCourseStructure(modules);
  const currentIdx = flattened.findIndex(item => item.activity.id === currentActivityId);

  if (currentIdx <= 0) {
    return null;
  }

  return flattened[currentIdx - 1];
}

/**
 * Get the first incomplete required activity in the course.
 * If all required activities are completed, returns null.
 */
export function getFirstIncompleteActivity(
  modules: InteractiveCourseModule[],
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): FlattenedActivityItem | null {
  const flattened = flattenCourseStructure(modules);

  for (const item of flattened) {
    if (item.activity.is_required) {
      const isDone = isActivityCompletedInMap(item.activity.id, completedMap);
      if (!isDone) {
        return item;
      }
    }
  }

  return null; // All required activities are completed!
}

/**
 * Helper to check if a specific lesson has all its required activities completed.
 */
export function isLessonCompleted(
  lesson: InteractiveCourseLesson,
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): boolean {
  const activities = lesson.interactive_activities || [];
  if (!Array.isArray(activities) || activities.length === 0) return false;

  const required = activities.filter(a => a.is_required !== false);
  if (required.length === 0) {
    return activities.every(a => isActivityCompletedInMap(a.id, completedMap));
  }

  return required.every(a => isActivityCompletedInMap(a.id, completedMap));
}

/**
 * Helper to check if a specific module has all its required activities completed.
 */
export function isModuleCompleted(
  moduleItem: InteractiveCourseModule,
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): boolean {
  const lessons = moduleItem.interactive_course_lessons || [];
  if (lessons.length === 0) return true;

  return lessons.every(l => isLessonCompleted(l, completedMap));
}

/**
 * Helper to check if the entire course has all its required activities completed.
 */
export function isCourseCompleted(
  modules: InteractiveCourseModule[],
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): boolean {
  if (!Array.isArray(modules) || modules.length === 0) return false;
  return modules.every(m => isModuleCompleted(m, completedMap));
}

/**
 * Helper to check if a specific activity is unlocked (accessible) based on prior required activity completion.
 * An activity is unlocked if it is the first activity OR if all preceding required activities are completed.
 */
export function isActivityUnlocked(
  activityId: string,
  modules: InteractiveCourseModule[],
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): boolean {
  if (!Array.isArray(modules) || modules.length === 0 || !activityId) return true;

  const flattened = flattenCourseStructure(modules);
  const targetIdx = flattened.findIndex(item => item.activity.id === activityId);
  if (targetIdx <= 0) return true; // First activity or not found -> unlocked

  const firstIncomplete = getFirstIncompleteActivity(modules, completedMap);
  if (!firstIncomplete) return true; // All required activities completed!

  const firstIncompleteIdx = flattened.findIndex(item => item.activity.id === firstIncomplete.activity.id);
  if (firstIncompleteIdx === -1) return true;

  return targetIdx <= firstIncompleteIdx;
}

/**
 * Helper to check if a lesson is unlocked (accessible).
 * A lesson is unlocked if its first activity (or any activity) is unlocked.
 */
export function isLessonUnlocked(
  lessonId: string,
  modules: InteractiveCourseModule[],
  completedMap: Map<string, boolean | InteractiveActivityProgress> | Set<string>
): boolean {
  if (!Array.isArray(modules) || modules.length === 0 || !lessonId) return true;

  const flattened = flattenCourseStructure(modules);
  const lessonActivities = flattened.filter(item => item.lesson.id === lessonId);
  if (lessonActivities.length === 0) return true;

  return isActivityUnlocked(lessonActivities[0].activity.id, modules, completedMap);
}

