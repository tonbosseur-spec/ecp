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
const DELETED_SESSIONS_KEY = 'ecp_deleted_live_sessions';

function getDeletedSessionIds(): Set<string> {
  const local = localStorage.getItem(DELETED_SESSIONS_KEY);
  if (local) {
    try {
      const arr = JSON.parse(local);
      if (Array.isArray(arr)) return new Set(arr);
    } catch (e) {
      console.error(e);
    }
  }
  return new Set();
}

function markSessionAsDeleted(...ids: (string | undefined)[]) {
  const current = getDeletedSessionIds();
  ids.forEach(id => {
    if (id) current.add(id);
  });
  localStorage.setItem(DELETED_SESSIONS_KEY, JSON.stringify(Array.from(current)));
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

// Get stored sessions (Supabase with LocalStorage fallback only on table error)
export async function fetchLiveSessions(): Promise<LiveSession[]> {
  const deletedSet = getDeletedSessionIds();
  let sessions: LiveSession[] = [];

  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (!error && data !== null) {
      sessions = data as LiveSession[];
    }
  } catch (err) {
    console.warn('Live sessions table query fallback:', err);
  }

  if (sessions.length === 0) {
    // Fallback to local storage only if table query fails or returns empty
    const local = localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) sessions = parsed;
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Filter out any sessions marked as deleted
  return sessions.filter(s => !deletedSet.has(s.id) && !deletedSet.has(s.room_code));
}

// Fetch single session by room code
export async function fetchLiveSessionByCode(roomCode: string): Promise<LiveSession | null> {
  const deletedSet = getDeletedSessionIds();
  if (deletedSet.has(roomCode)) return null;

  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    if (!error && data) {
      if (deletedSet.has(data.id)) return null;
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
export async function deleteLiveSession(sessionId: string, roomCode?: string): Promise<boolean> {
  // Always mark deleted locally so it immediately disappears even if Supabase delete fails or has RLS restrictions
  markSessionAsDeleted(sessionId, roomCode);

  try {
    // Delete child records first to prevent foreign key constraint violations
    const targetFilter = roomCode
      ? `session_id.eq.${sessionId},session_id.eq.${roomCode}`
      : `session_id.eq.${sessionId}`;

    await supabase.from('live_participants').delete().or(targetFilter);
    await supabase.from('live_messages').delete().or(targetFilter);
    await supabase.from('live_presence').delete().or(targetFilter);

    const sessionFilter = roomCode
      ? `id.eq.${sessionId},room_code.eq.${sessionId},room_code.eq.${roomCode}`
      : `id.eq.${sessionId},room_code.eq.${sessionId}`;

    const { error } = await supabase
      .from('live_sessions')
      .delete()
      .or(sessionFilter);

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
      const filtered = existing.filter(s => s.id !== sessionId && s.room_code !== sessionId && s.room_code !== roomCode);
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
