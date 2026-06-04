import supabase from '../../lib/supabase'

export async function fetchAdminSupabaseStats() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return { configured: false, profileCount: null, depositCount: null }
  }

  try {
    const [profilesRes, depositsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('deposits').select('id', { count: 'exact', head: true }),
    ])

    return {
      configured: true,
      profileCount: profilesRes.count ?? null,
      depositCount: depositsRes.count ?? null,
      error: profilesRes.error?.message || depositsRes.error?.message || null,
    }
  } catch (err) {
    return {
      configured: true,
      profileCount: null,
      depositCount: null,
      error: String(err?.message || err),
    }
  }
}
