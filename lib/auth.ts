
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { ConversationTurn } from './state';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let hasLoggedMissingSupabaseConfig = false;

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : null;

const getSupabaseClient = () => {
  if (supabase) {
    return supabase;
  }

  if (!hasLoggedMissingSupabaseConfig) {
    console.warn(
      'Supabase is disabled because VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.'
    );
    hasLoggedMissingSupabaseConfig = true;
  }

  return null;
};

// --- AUTH STORE ---
interface AuthState {
  session: any | null;
  user: { id: string; email: string; } | null;
  isSuperAdmin: boolean;
  loading: boolean;
  loadingData: boolean;
  signInWithId: (id: string) => Promise<void>;
  signOut: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  isSuperAdmin: false,
  loading: false,
  loadingData: false,
  signInWithId: async (id: string) => {
    // Basic validation: SI followed by 4 characters
    const isValid = /^SI.{4}$/.test(id);
    if (!isValid) {
      throw new Error('Invalid ID format. Must start with SI followed by 4 characters.');
    }

    set({
      user: { id, email: `${id}@eburon.ai` },
      session: { id },
      isSuperAdmin: id === 'SI0000', // Example: SI0000 is super admin
    });
  },
  signOut: () => set({ user: null, session: null, isSuperAdmin: false }),
}));

// --- DATABASE HELPERS ---
export const updateUserSettings = async (
  userId: string,
  newSettings: Partial<{ systemPrompt: string; voice1: string; voice2: string }>
) => {
  const client = getSupabaseClient();
  if (!client) return Promise.resolve();

  const { error } = await client
    .from('user_settings')
    .upsert({ user_id: userId, ...newSettings });
  if (error) console.error('Error saving settings:', error);
  return Promise.resolve();
};

export const fetchUserConversations = async (userId: string): Promise<ConversationTurn[]> => {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('translations')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }

  return data.map(item => ({
    timestamp: new Date(item.timestamp),
    role: item.role,
    text: item.text,
    isFinal: true
  }));
};

export const updateUserConversations = async (userId: string, turns: ConversationTurn[]) => {
  const lastTurn = turns[turns.length - 1];
  if (!lastTurn || !lastTurn.isFinal) return;

  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from('translations')
    .insert({
      user_id: userId,
      role: lastTurn.role,
      text: lastTurn.text,
      timestamp: lastTurn.timestamp.toISOString(),
    });

  if (error) {
    console.error('Error saving turn to Supabase:', error);
  }
};

export const clearUserConversations = async (userId: string) => {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from('translations')
    .delete()
    .eq('user_id', userId);
  if (error) console.error('Error clearing history:', error);
};
