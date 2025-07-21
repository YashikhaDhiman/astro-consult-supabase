'use client'

import { useEffect, useState } from 'react'
import supabase from '@/lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const ASTROLOGER_EMAIL = 'devmishra30799@gmail.com'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [queueCount, setQueueCount] = useState<number>(0)
  const router = useRouter()

  const fetchQueueCount = async () => {
    const { count, error } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    if (!error) {
      setQueueCount(count || 0)
    } else {
      console.error('Error fetching queue count:', error)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data?.user || null)
      fetchQueueCount()
    }

    getUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      fetchQueueCount()
    })

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    fetchQueueCount()

    const channel = supabase
      .channel('realtime-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => {
          fetchQueueCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  const isAstrologer = user?.email === ASTROLOGER_EMAIL

  return (
    <header className="flex justify-between items-center p-4 bg-gray-900 text-white">
      <Link href="/">
        <h1 className="text-xl font-bold">Astro Consult ✨</h1>
      </Link>

      <nav className="flex gap-4 items-center">
        {/* Queue Count - blinking */}
        <span className="bg-blue-700 px-3 py-1 rounded text-white animate-pulse font-mono">
          Queue: {queueCount}
        </span>

        {user && !isAstrologer && (
          <Link href="/mychats" className="hover:underline">
            My Chats
          </Link>
        )}

        {user && isAstrologer && (
          <Link href="/astro" className="hover:underline">
            Inbox
          </Link>
        )}

        {user ? (
          <>
            <span className="text-sm">Hi, {user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:underline">
              Login
            </Link>
            <Link href="/signup" className="hover:underline">
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
