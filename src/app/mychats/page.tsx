'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'
import Link from 'next/link'

export default function MyChats() {
  const [user, setUser] = useState<any>(null)
  const [chats, setChats] = useState<any[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'active' | 'ended'>('active')
  const router = useRouter()

  useEffect(() => {
    const fetchUserAndChats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)
      await loadChats(user.id)
    }

    fetchUserAndChats()
  }, [router])

const loadChats = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    router.push('/login')
    return
  }

  setUser(user)

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching chats:', error)
    return
  }

  // Fetch all active chats to calculate position
  const { data: allActiveChats } = await supabase
    .from('chats')
    .select('id')
    .eq('status', 'active')
    .order('priority', { ascending: true })

  const chatsWithPosition = data.map((chat) => {
    if (chat.status === 'active') {
      const position = allActiveChats?.findIndex((c) => c.id === chat.id)
      return { ...chat, queuePosition: position !== -1 ? position + 1 : null }
    }
    return { ...chat, queuePosition: null }
  })

  setChats(chatsWithPosition)
}


  const filteredChats = chats.filter((chat) => chat.status === tab)

  if (!user) {
    return <p className="text-white p-4">Loading...</p>
  }

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">My Chats 💬</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 rounded ${
            tab === 'active' ? 'bg-blue-600' : 'bg-gray-700'
          }`}
        >
          Active Chats
        </button>
        <button
          onClick={() => setTab('ended')}
          className={`px-4 py-2 rounded ${
            tab === 'ended' ? 'bg-blue-600' : 'bg-gray-700'
          }`}
        >
          Ended Chats
        </button>
      </div>

      {filteredChats.length === 0 ? (
        <p>No {tab} chats found.</p>
      ) : (
        <ul className="space-y-3">
          {filteredChats.map((chat) => (
            <li
              key={chat.id}
              className={`p-4 rounded shadow flex justify-between items-center ${
                chat.status === 'ended' ? 'bg-gray-700' : 'bg-gray-800'
              }`}
            >
              <div>
                {chat.status === 'active' && (<p className="text-lg font-semibold">Queue Position: {chat.queuePosition ?? 'N/A'}</p>)}
                <p className="text-xs text-gray-400">
                  Started: {new Date(chat.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm italic text-gray-300 truncate max-w-md">
                  {lastMessages[chat.id]}
                </p>
              </div>
              <Link
                href={`/chat/${chat.id}`}
                className="bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-700"
              >
                Open Chat
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
