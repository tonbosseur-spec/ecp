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

// Key for local storage fallback when Supabase table isn't created yet
const LOCAL_SESSIONS_KEY = 'ecp_live_sessions_cache';

// Generate a readable unique room code like LIVE-7X9B2K
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LIVE-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get stored sessions (Supabase with LocalStorage fallback only on table error)
export async function fetchLiveSessions(): Promise<LiveSession[]> {
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (!error && data !== null) {
      return data as LiveSession[];
    }
  } catch (err) {
    console.warn('Live sessions table query fallback:', err);
  }

  // Fallback to local storage only if table query fails
  const local = localStorage.getItem(LOCAL_SESSIONS_KEY);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error(e);
    }
  }

  return [];
}

// Fetch single session by room code
export async function fetchLiveSessionByCode(roomCode: string): Promise<LiveSession | null> {
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    if (!error && data) {
      return data as LiveSession;
    }
  } catch (err) {
    console.warn('Error fetching room code:', err);
  }

  // Fallback local search
  const sessions = await fetchLiveSessions();
  return sessions.find(s => s.room_code === roomCode || s.id === roomCode) || null;
}

// Create new Live Session
export async function createLiveSession(sessionData: Omit<LiveSession, 'id' | 'created_at' | 'status'>): Promise<LiveSession> {
  const newSession: LiveSession = {
    ...sessionData,
    id: 'live-' + Date.now(),
    status: 'scheduled',
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .insert([newSession])
      .select()
      .single();

    if (!error && data) {
      return data as LiveSession;
    }
  } catch (err) {
    console.warn('Could not insert live session into Supabase, saving locally:', err);
  }

  // Save to local cache fallback
  const sessions = await fetchLiveSessions();
  sessions.unshift(newSession);
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  return newSession;
}

// Update Live Session
export async function updateLiveSession(id: string, updates: Partial<LiveSession>): Promise<LiveSession | null> {
  const updatedData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .update(updatedData)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      return data as LiveSession;
    }
  } catch (err) {
    console.warn('Could not update live session in Supabase:', err);
  }

  // Local fallback update
  const sessions = await fetchLiveSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx !== -1) {
    const merged = { ...sessions[idx], ...updatedData };
    sessions[idx] = merged;
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
    return merged;
  }
  return null;
}

// Delete Live Session
export async function deleteLiveSession(sessionId: string): Promise<boolean> {
  try {
    // Delete child records first to prevent foreign key constraint violations
    await supabase.from('live_participants').delete().eq('session_id', sessionId);
    await supabase.from('live_messages').delete().eq('session_id', sessionId);
    await supabase.from('live_presence').delete().eq('session_id', sessionId);

    const { error } = await supabase
      .from('live_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.warn('Error deleting live session from Supabase:', error);
    }
  } catch (err) {
    console.warn('Failed to delete live session from Supabase:', err);
  }

  // Update local storage cache directly
  const local = localStorage.getItem(LOCAL_SESSIONS_KEY);
  if (local) {
    try {
      const existing: LiveSession[] = JSON.parse(local);
      const filtered = existing.filter(s => s.id !== sessionId);
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  }

  return true;
}

// Update session status
export async function updateLiveSessionStatus(id: string, status: 'scheduled' | 'live' | 'ended'): Promise<void> {
  try {
    await supabase
      .from('live_sessions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {
    console.warn('Failed to update status in Supabase:', err);
  }

  const sessions = await fetchLiveSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx !== -1) {
    sessions[idx].status = status;
    sessions[idx].updated_at = new Date().toISOString();
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
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
