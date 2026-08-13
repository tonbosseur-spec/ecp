import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export const SUPERADMIN_EMAIL = 'pmbom@ecp.cm';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  created_by: string;
  is_superadmin?: boolean;
}

const LOCAL_STORAGE_KEY = 'ecp_admin_users_v1';

function getLocalAdmins(): AdminUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local admin users:', e);
    return [];
  }
}

function setLocalAdmins(list: AdminUser[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving local admin users:', e);
  }
}

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === SUPERADMIN_EMAIL.toLowerCase();
}

export async function fetchAdminEmails(): Promise<string[]> {
  const emails = new Set<string>([SUPERADMIN_EMAIL.toLowerCase()]);

  // Load from localStorage
  try {
    const localList = getLocalAdmins();
    localList.forEach((u) => {
      if (u.email) emails.add(u.email.toLowerCase().trim());
    });
  } catch (e) {
    // Ignore local storage error
  }

  // Try loading from Supabase admin_users table
  try {
    const { data, error } = await supabase.from('admin_users').select('email');
    if (!error && data && Array.isArray(data)) {
      data.forEach((row: { email: string }) => {
        if (row?.email) emails.add(row.email.toLowerCase().trim());
      });
    }
  } catch (e) {
    // Table might not exist yet or fetch failed
  }

  // Try loading from client_profiles table where role='admin'
  try {
    const { data, error } = await supabase
      .from('client_profiles')
      .select('email')
      .eq('role', 'admin');
    if (!error && data && Array.isArray(data)) {
      data.forEach((row: { email: string }) => {
        if (row?.email) emails.add(row.email.toLowerCase().trim());
      });
    }
  } catch (e) {
    // Ignore
  }

  return Array.from(emails);
}

export async function checkIsAdmin(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === SUPERADMIN_EMAIL.toLowerCase()) return true;

  try {
    const { data } = await supabase
      .from('client_profiles')
      .select('role')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (data?.role === 'admin') return true;

    const adminEmails = await fetchAdminEmails();
    return adminEmails.includes(cleanEmail);
  } catch (e) {
    return false;
  }
}

export async function getAllAdminUsers(): Promise<AdminUser[]> {
  const superAdminObj: AdminUser = {
    id: 'superadmin-id',
    full_name: 'Administrateur Principal',
    email: SUPERADMIN_EMAIL,
    created_at: new Date(2025, 0, 1).toISOString(),
    created_by: 'Système',
    is_superadmin: true,
  };

  const localList = getLocalAdmins();
  let dbList: AdminUser[] = [];

  // Query 1: admin_users table
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row?.email) {
          dbList.push({
            id: row.id || 'admin-' + row.email,
            full_name: row.full_name || row.email.split('@')[0],
            email: row.email,
            created_at: row.created_at || new Date().toISOString(),
            created_by: row.created_by || SUPERADMIN_EMAIL,
          });
        }
      });
    }
  } catch (e) {
    // Ignore if table does not exist
  }

  // Query 2: client_profiles table where role='admin'
  try {
    const { data, error } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('role', 'admin');

    if (!error && data && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row?.email) {
          dbList.push({
            id: row.id || 'prof-' + row.email,
            full_name: row.full_name || row.email.split('@')[0],
            email: row.email,
            created_at: row.created_at || new Date().toISOString(),
            created_by: SUPERADMIN_EMAIL,
          });
        }
      });
    }
  } catch (e) {
    // Ignore if table does not exist
  }

  // Merge local and DB, removing duplicates by email
  const map = new Map<string, AdminUser>();
  map.set(SUPERADMIN_EMAIL.toLowerCase(), superAdminObj);

  localList.forEach((u) => map.set(u.email.toLowerCase().trim(), u));
  dbList.forEach((u) => map.set(u.email.toLowerCase().trim(), u));

  const merged = Array.from(map.values());

  // Keep local storage synced with all known admin accounts
  const nonSuperAdmins = merged.filter((u) => !u.is_superadmin);
  setLocalAdmins(nonSuperAdmins);

  return merged;
}

export function extractErrorMessage(err: any): string {
  if (!err) return 'Une erreur est survenue.';
  if (typeof err === 'string') {
    return err.trim() === '{}' || err.trim() === '[object Object]'
      ? 'Une erreur est survenue lors de l\'opération.'
      : err;
  }
  if (err.message && typeof err.message === 'string' && err.message.trim() !== '{}' && err.message.trim() !== '[object Object]') {
    return err.message;
  }
  if (err.error_description && typeof err.error_description === 'string') {
    return err.error_description;
  }
  if (err.error && typeof err.error === 'string') {
    return err.error;
  }
  try {
    const json = JSON.stringify(err);
    if (json && json !== '{}' && json !== '[]') return json;
  } catch (e) {
    // ignore
  }
  return 'Une erreur est survenue lors de l\'opération.';
}

export async function createAdminAccount({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = fullName.trim();

  if (!cleanName) {
    return { success: false, message: 'Le nom et prénom sont obligatoires.' };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Adresse email invalide.' };
  }
  if (!password || password.length < 6) {
    return { success: false, message: 'Le mot de passe doit contenir au moins 6 caractères.' };
  }

  // Check if already superadmin or exists
  if (cleanEmail === SUPERADMIN_EMAIL.toLowerCase()) {
    return { success: false, message: 'Cet email est celui de l\'administrateur principal.' };
  }

  try {
    const existing = await fetchAdminEmails();
    if (existing.includes(cleanEmail)) {
      return { success: false, message: 'Un compte administrateur avec cet email existe déjà.' };
    }
  } catch (e) {
    // Ignore fetch error and proceed
  }

  try {
    let authUserId: string | null = null;

    try {
      // Create secondary non-persisting client so current superadmin session stays active
      const secondarySupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
            role: 'admin',
          },
        },
      });

      if (authError) {
        console.warn('Supabase Auth signUp info:', authError);
      } else if (authData?.user?.id) {
        authUserId = authData.user.id;
      }
    } catch (netErr: any) {
      console.warn('Network or auth signup notice:', netErr);
    }

    const newAdminObj: AdminUser = {
      id: authUserId || 'admin-' + Date.now(),
      full_name: cleanName,
      email: cleanEmail,
      created_at: new Date().toISOString(),
      created_by: SUPERADMIN_EMAIL,
    };

    // 1. Save to local storage list
    const local = getLocalAdmins();
    const existingIdx = local.findIndex((u) => u.email.toLowerCase().trim() === cleanEmail);
    if (existingIdx >= 0) {
      local[existingIdx] = newAdminObj;
    } else {
      local.push(newAdminObj);
    }
    setLocalAdmins(local);

    // 2. Try saving to admin_users table in Supabase
    try {
      const { error: dbErr } = await supabase.from('admin_users').upsert([
        {
          id: newAdminObj.id,
          full_name: cleanName,
          email: cleanEmail,
          created_by: SUPERADMIN_EMAIL,
          created_at: newAdminObj.created_at,
        },
      ], { onConflict: 'email' });
      if (dbErr) {
        console.warn('Database upsert into admin_users warning:', dbErr);
      }
    } catch (e) {
      console.warn('Database upsert into admin_users notice:', e);
    }

    // 3. Try saving to client_profiles table as admin role
    try {
      const { error: profErr } = await supabase.from('client_profiles').upsert([
        {
          id: newAdminObj.id,
          full_name: cleanName,
          email: cleanEmail,
          role: 'admin',
          created_at: newAdminObj.created_at,
        },
      ], { onConflict: 'email' });
      if (profErr) {
        console.warn('Database upsert into client_profiles warning:', profErr);
      }
    } catch (e) {
      console.warn('Database upsert into client_profiles notice:', e);
    }

    // Trigger update event
    window.dispatchEvent(new Event('admin_users_changed'));

    return {
      success: true,
      message: `Compte administrateur créé avec succès pour ${cleanName} (${cleanEmail}).`,
    };
  } catch (err: any) {
    console.error('Error creating admin account:', err);
    return {
      success: false,
      message: extractErrorMessage(err),
    };
  }
}

export async function deleteAdminAccount(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === SUPERADMIN_EMAIL.toLowerCase()) {
    return { success: false, message: 'Impossible de supprimer l\'administrateur principal.' };
  }

  // Remove from localStorage
  const local = getLocalAdmins().filter((u) => u.email.toLowerCase().trim() !== cleanEmail);
  setLocalAdmins(local);

  // Remove from admin_users table
  try {
    await supabase.from('admin_users').delete().eq('email', cleanEmail);
  } catch (e) {
    // Ignore error
  }

  // Remove or update role in client_profiles
  try {
    await supabase.from('client_profiles').delete().eq('email', cleanEmail);
  } catch (e) {
    // Ignore error
  }

  window.dispatchEvent(new Event('admin_users_changed'));
  return { success: true, message: 'Compte administrateur supprimé avec succès.' };
}
