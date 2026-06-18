import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = SUPABASE_URL.startsWith('https://') && SUPABASE_URL.includes('supabase');
const isValidKey = SUPABASE_ANON_KEY.length > 10 && !SUPABASE_ANON_KEY.startsWith('JOUW') && !SUPABASE_ANON_KEY.startsWith('eyJhbGciOiJIUzI1NiIsIn...');

export const isConfigured = isValidUrl && isValidKey;

// Only create the client when credentials are real — avoids crashes on placeholder values
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createClient('https://placeholder.supabase.co', 'placeholder-key-000000000000000000000');

// Unique ID for this browser tab — used to ignore our own realtime updates
export const CLIENT_ID = Math.random().toString(36).slice(2);
