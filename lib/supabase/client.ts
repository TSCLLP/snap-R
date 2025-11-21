import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // During build, env vars might not be available - return a dummy client
  if (typeof window === 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
    // Check if we're in build mode (Next.js sets this)
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      // Return a dummy client during build
      return createSupabaseClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: { persistSession: false },
      });
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

