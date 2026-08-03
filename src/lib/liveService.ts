import { supabase } from './supabaseClient';

export interface LiveSession {
  id: string;
  title: string;
  course_id?: string;
  course_title?: string;
  trainer_id: string;
  trainer_name: string;
  scheduled_at: string; // ISO date string
  duration_minutes: number;
  description?: string;
  is_private: boolean;
  status: 'scheduled' | 'live' | 'ended';
  room_code: string;
  created_at: string;
  updated_at?: string;
  participant_count?: number;
  max_participants?: number;
}

export interface LiveParticipant {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  role: 'trainer' | 'participant';
  status: 'joined' | 'left' | 'waiting';
  is_muted: boolean;
  is_camera_off: boolean;
  hand_raised: boolean;
  joined_at: string;
  left_at?: string;
}

export interface LiveMessage {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
}

export interface LivePresenceRecord {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  joined_at: string;
  left_at?: string;
  duration_seconds: number;
}

// Key for local storage fallback cleanup
const LOCAL_SESSIONS_KEY = 'ecp_live_sessions_cache';
const DELETED_SESSIONS_KEY = 'ecp_deleted_live_sessions';

// Clear legacy local storage caches on module load so ghost sessions don't persist
try {
  localStorage.removeItem(LOCAL_SESSIONS_KEY);
  localStorage.removeItem(DELETED_SESSIONS_KEY);
} catch (e) {
  // ignore in non-browser environments
}

// Generate a readable unique room code like LIVE-7X9B2K
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LIVE-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get stored sessions directly from Supabase
export async function fetchLiveSessions(): Promise<LiveSession[]> {
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .neq('duration_minutes', -1)
      .order('scheduled_at', { ascending: true });

    if (!error && data !== null) {
      return data as LiveSession[];
    }
  } catch (err) {
    console.warn('Live sessions Supabase query error:', err);
  }

  return [];
}

// Fetch single session by room code directly from Supabase
export async function fetchLiveSessionByCode(roomCode: string): Promise<LiveSession | null> {
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .or(`room_code.eq.${roomCode},id.eq.${roomCode}`)
      .neq('duration_minutes', -1)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as LiveSession;
    }
  } catch (err) {
    console.warn('Error fetching room code:', err);
  }

  return null;
}

// Create new Live Session in Supabase
export async function createLiveSession(sessionData: Omit<LiveSession, 'id' | 'created_at' | 'status'>): Promise<LiveSession> {
  const newSession: LiveSession = {
    ...sessionData,
    id: 'live-' + Date.now(),
    status: 'scheduled',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('live_sessions')
    .insert([newSession])
    .select()
    .single();

  if (error) {
    console.error('Failed to create session in Supabase:', error);
    throw error;
  }

  return data as LiveSession;
}

// Update Live Session in Supabase
export async function updateLiveSession(id: string, updates: Partial<LiveSession>): Promise<LiveSession | null> {
  const updatedData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('live_sessions')
    .update(updatedData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Could not update live session in Supabase:', error);
    return null;
  }

  return data as LiveSession;
}

// Delete Live Session from Supabase
export async function deleteLiveSession(sessionId: string, roomCode?: string): Promise<boolean> {
  try {
    // Delete child records first to prevent foreign key constraint violations
    const targetFilter = roomCode
      ? `session_id.eq.${sessionId},session_id.eq.${roomCode}`
      : `session_id.eq.${sessionId}`;

    // await supabase.from('live_participants').delete().or(targetFilter);
    await supabase.from('live_messages').delete().or(targetFilter);
    await supabase.from('live_presence').delete().or(targetFilter);

    const sessionFilter = roomCode
      ? `id.eq.${sessionId},room_code.eq.${sessionId},room_code.eq.${roomCode}`
      : `id.eq.${sessionId},room_code.eq.${sessionId}`;

    const { data, error } = await supabase
      .from('live_sessions')
      .delete()
      .or(sessionFilter)
      .select();

    if (error) {
      console.warn('Error deleting live session from Supabase:', error);
    } else if (data && data.length === 0) {
      // If 0 rows were deleted (due to missing DELETE RLS policy), we do a soft delete.
      await supabase.from('live_sessions').update({
        duration_minutes: -1,
        title: '[SUPPRIMÉ]',
        room_code: `DEL-${Date.now().toString(36)}`,
        status: 'ended'
      }).or(sessionFilter);
    }
  } catch (err) {
    console.warn('Failed to delete live session from Supabase:', err);
  }

  return true;
}

// Update session status in Supabase
export async function updateLiveSessionStatus(id: string, status: 'scheduled' | 'live' | 'ended'): Promise<void> {
  try {
    await supabase
      .from('live_sessions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {
    console.warn('Failed to update status in Supabase:', err);
  }
}

// Record presence entry/exit
export async function recordPresenceEntry(sessionId: string, userId: string, userName: string): Promise<string> {
  const presenceId = `pres-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const record: Partial<LivePresenceRecord> = {
    id: presenceId,
    session_id: sessionId,
    user_id: userId,
    user_name: userName,
    joined_at: new Date().toISOString(),
    duration_seconds: 0,
  };

  try {
    await supabase.from('live_presence').insert([record]);
  } catch (err) {
    console.warn('Failed to record presence entry in Supabase:', err);
  }

  // Save locally in session storage for duration calculation at leave time
  sessionStorage.setItem(`live_presence_${sessionId}_${userId}`, JSON.stringify(record));
  return presenceId;
}

export async function recordPresenceExit(sessionId: string, userId: string): Promise<void> {
  const raw = sessionStorage.getItem(`live_presence_${sessionId}_${userId}`);
  if (!raw) return;

  try {
    const entry = JSON.parse(raw);
    const leftAt = new Date().toISOString();
    const durationSeconds = Math.round((new Date(leftAt).getTime() - new Date(entry.joined_at).getTime()) / 1000);

    await supabase
      .from('live_presence')
      .update({
        left_at: leftAt,
        duration_seconds: durationSeconds
      })
      .eq('session_id', sessionId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('Failed to update presence exit in Supabase:', err);
  } finally {
    sessionStorage.removeItem(`live_presence_${sessionId}_${userId}`);
  }
}

// Fetch chat messages for a live session
export async function fetchLiveMessages(sessionId: string): Promise<LiveMessage[]> {
  try {
    const { data, error } = await supabase
      .from('live_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      return data as LiveMessage[];
    }
  } catch (err) {
    console.warn('Failed to fetch live messages from Supabase:', err);
  }
  return [];
}

// Save chat message to Supabase
export async function sendLiveMessage(message: LiveMessage): Promise<LiveMessage> {
  try {
    const { data, error } = await supabase
      .from('live_messages')
      .insert([message])
      .select()
      .single();

    if (!error && data) {
      return data as LiveMessage;
    }
  } catch (err) {
    console.warn('Failed to insert live message in Supabase:', err);
  }
  return message;
}
