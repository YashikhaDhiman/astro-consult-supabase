'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'
import Link from 'next/link'

const ASTROLOGER_EMAIL = 'devmishra30799@gmail.com'

export default function AstrologerInbox() {
  const [user, setUser] = useState<any>(null)
  const [chats, setChats] = useState<any[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({})
  const [searchUserId, setSearchUserId] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [tab, setTab] = useState<'active' | 'ended'>('active')
  const [toast, setToast] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchUserAndChats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || user.email !== ASTROLOGER_EMAIL) {
        router.push('/')
        return
      }

      setUser(user)
      await loadChats()
    }

    fetchUserAndChats()
  }, [router])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('realtime-inbox')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chats',
        },
        (payload) => {
          const newChat = payload.new
          setToast(`🆕 New chat joined the queue! Priority #${newChat.priority}`)
          loadChats()

          setTimeout(() => setToast(null), 4000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const loadChats = async () => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('created_at', { ascending: true }) // chronological order

  if (error) {
    console.error('Error fetching chats:', error)
  } else {
    // Sort active chats by priority
    const activeSorted = data
      .filter(chat => chat.status === 'active')
      .sort((a, b) => a.priority - b.priority)

    // Assign live queue position to active chats
    const chatsWithPosition = data.map(chat => {
      if (chat.status === 'active') {
        const index = activeSorted.findIndex(c => c.id === chat.id)
        return { ...chat, queuePosition: index + 1 }
      }
      return { ...chat, queuePosition: null }
    })

    setChats(chatsWithPosition)

    // Load latest message for each chat
    const messageMap: Record<string, string> = {}
    for (const chat of chatsWithPosition) {
      const { data: messages } = await supabase
        .from('messages')
        .select('content')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1)

      messageMap[chat.id] = messages?.[0]?.content || 'No messages yet.'
    }

    setLastMessages(messageMap)
  }
}


  const handleEndChat = async (chatId: string) => {
    const { error } = await supabase
      .from('chats')
      .update({ status: 'ended' })
      .eq('id', chatId)

    if (!error) {
      await loadChats()
    } else {
      console.error('Error ending chat:', error)
    }
  }

  const filteredChats = chats.filter((chat) => {
    const matchesTab = chat.status === tab
    const matchesUserId = searchUserId
      ? chat.user_id.toLowerCase().includes(searchUserId.toLowerCase())
      : true
    const matchesPriority = filterPriority
      ? String(chat.priority) === filterPriority
      : true
    return matchesTab && matchesUserId && matchesPriority
  })

  if (!user) {
    return <p className="text-white p-4">Verifying astrologer access...</p>
  }

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Astrologer Inbox 🔮</h1>

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

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by User ID"
          value={searchUserId}
          onChange={(e) => setSearchUserId(e.target.value)}
          className="p-2 rounded bg-gray-700 border border-gray-600 flex-1"
        />
        <input
          type="number"
          placeholder="Filter by Priority"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="p-2 rounded bg-gray-700 border border-gray-600 w-48"
        />
      </div>

      {/* Chat List */}
      {filteredChats.length === 0 ? (
        <p>No matching chats found.</p>
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
                {chat.status === 'active' && (<p className="text-lg font-semibold">Queue Position: #{chat.queuePosition ?? 'N/A'}</p>)}
                <p className="text-sm text-gray-400">User ID: {chat.user_id}</p>
                <p className="text-xs text-gray-500">
                  Started: {new Date(chat.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm italic text-gray-300 truncate max-w-md">
                  {lastMessages[chat.id]}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/chat/${chat.id}`}
                  className="bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-700"
                >
                  View Chat
                </Link>
                {chat.status === 'active' && (
                  <button
                    onClick={() => handleEndChat(chat.id)}
                    className="bg-red-600 px-4 py-2 rounded text-white hover:bg-red-700"
                  >
                    End Chat
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
