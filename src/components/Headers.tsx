/* eslint-disable */
"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    let mounted = true

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUser(data?.user ?? null)
      if (data?.user?.id) {
        try {
          const { data: p } = await supabase.from('profiles').select('full_name').eq('id', data.user.id).single()
          if (!mounted) return
          setProfile(p)
        } catch (e) {
          if (!mounted) return
          setProfile(null)
        }
      }
    }

    loadUser()

    const { data: subData } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user?.id) {
        ;(async () => {
          try {
            const { data: p } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single()
            if (!mounted) return
            setProfile(p)
          } catch (e) {
            if (!mounted) return
            setProfile(null)
          }
        })()
      } else {
        setProfile(null)
      }
    })

    const subscription = (subData as any)?.subscription

    return () => {
      mounted = false
      subscription?.unsubscribe?.()
    }
  }, [])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      alert('Logout failed: ' + error.message)
      return
    }
    router.push('/')
    // Force reload to clear client state
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'User'

  return (
    <header className="bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="Karmic logo" className="w-10 h-10 rounded-full" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold karmic-gradient">Your Karmic Connection</span>
            <span className="text-xs text-gray-300">A soul-led, free astrological space</span>
          </div>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/mychats" className="text-sm text-gray-300 hover:underline">My Chats</Link>
              <Link href="/queue" className="text-sm text-gray-300 hover:underline">Queue</Link>

              <Link href="/profile" className="text-sm text-gray-200 hover:underline">Hi, {displayName}</Link>

              <button onClick={handleLogout} className="karmic-btn karmic-btn--small">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-300 hover:underline">Login</Link>
              <Link href="/signup" className="text-sm text-gray-300 hover:underline">Sign Up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
