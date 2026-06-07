import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables!')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'ethio-invest-session',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'x-application-name': 'ethio-invest'
    }
  }
})

// Admin client uses same supabase instance but with separate admin-specific logic
export const adminSupabase = supabase

// Test connection on startup
supabase.auth.getSession().then(({ data, error }) => {
  if (error) console.error('Supabase session error:', error)
  else console.log('Supabase session:', data.session?.user?.email || 'no session')
})

export default supabase
