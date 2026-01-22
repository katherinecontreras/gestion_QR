import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { fetchUserProfile } from './profile.js'
import { AuthContext } from './AuthContext.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data?.session ?? null)
      setLoading(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null)
        return
      }
      try {
        const p = await fetchUserProfile(session.user.id)
        if (!mounted) return
        setProfile(p)
      } catch {
        if (!mounted) return
        setProfile(null)
      }
    }
    loadProfile()
    return () => {
      mounted = false
    }
  }, [session?.user?.id])

  const value = useMemo(() => {
    const user = session?.user ?? null
    const roleId = profile?.id_rol ?? null
    const roleName = profile?.roleName ?? null
    return {
      loading,
      session,
      user,
      profile,
      roleId,
      roleName,
      signInWithPassword: async ({ email, password }) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: async () => supabase.auth.signOut(),
    }
  }, [loading, session, profile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

