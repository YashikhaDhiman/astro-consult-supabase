/* eslint-disable */
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'
import Link from 'next/link'
import { selectChat } from '@/lib/selectedChat'

export default function MyChats() {
  const [user, setUser] = useState<any>(null)
  const [chats, setChats] = useState<any[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({})
  const [selectedChat, setSelectedChat] = useState<any | null>(null)
  const [showEndedPopup, setShowEndedPopup] = useState(false)
  const [endedPopupInfo, setEndedPopupInfo] = useState<{ by?: string } | null>(null)
  const [previewMessages, setPreviewMessages] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [messageInput, setMessageInput] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
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
  await loadChats()
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

  // Fetch all active chats to calculate position (keep priority assignment logic intact)
  const { data: allActiveChats } = await supabase
    .from('chats')
    .select('id')
    .eq('status', 'active')
    .order('priority', { ascending: true })

  // For display: compute queuePosition for active chats; ended chats get null
  const chatsWithPosition = (data || []).map((chat: any) => {
    if (chat.status === 'active') {
      const position = Array.isArray(allActiveChats) ? allActiveChats.findIndex((c: any) => c.id === chat.id) : -1
      return { ...chat, queuePosition: typeof position === 'number' && position !== -1 ? position + 1 : null }
    }
    return { ...chat, queuePosition: null }
  })

  // Sort ended chats newest-first while keeping active chronological order
  chatsWithPosition.sort((a: any, b: any) => {
    if (a.status === 'active' && b.status === 'active') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (a.status === 'ended' && b.status === 'ended') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return a.status === 'active' ? -1 : 1
  })

  setChats(chatsWithPosition)

  // Fetch last message preview for each chat (simple per-chat query)
  const messageMap: Record<string, string> = {}
  for (const chat of chatsWithPosition) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('content')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: false })
      .limit(1)

    messageMap[chat.id] = msgs?.[0]?.content || 'No messages yet.'
  }
  setLastMessages(messageMap)
}

  // (tab switching will be handled via setTab directly to preserve existing behaviour)

  // Subscribe to realtime messages for the selected chat and auto-scroll
  useEffect(() => {
    if (!selectedChat) return

    const channel = supabase
      .channel(`chat-preview-${selectedChat.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedChat])

  // Subscribe to chat row updates (status changes) so the UI updates immediately
  useEffect(() => {
    if (!selectedChat) return

    const channel = supabase
      .channel(`chat-row-${selectedChat.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${selectedChat.id}` },
        (payload) => {
              // update selectedChat in-place so UI (send box, header) reflects new status
              if (payload?.new) {
                const wasEnded = payload?.old?.status === 'ended'
                const nowEnded = payload?.new?.status === 'ended'

                setSelectedChat((prev: any) => ({ ...(prev || {}), ...payload.new }))

                // If the chat transitioned to ended, show a small popup to the customer
                if (nowEnded && !wasEnded) {
                  // try to read who ended it; fall back to generic copy
                  const by = payload?.new?.ended_by || 'the astrologer'
                  setEndedPopupInfo({ by })
                  setShowEndedPopup(true)
                  // auto-hide after a short period
                  setTimeout(() => setShowEndedPopup(false), 8000)
                }

                // refresh the chats list to update left-pane ordering/positions
                // (best-effort, won't block UI)
                loadChats().catch((err) => console.error('Failed to reload chats after chat update:', err))
              }
            }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedChat?.id])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])


  const filteredChats = chats.filter((chat) => chat.status === tab)

  if (!user) {
    return <p className="text-white p-4">Loading...</p>
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 karmic-gradient">My Chats</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left - conversation list */}
        <div className="md:col-span-1 bg-white/5 hero-card rounded-lg p-3">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Conversations</div>
              <div className="text-sm text-gray-500">{filteredChats.length} {filteredChats.length === 1 ? 'chat' : 'chats'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTab('active')} className={`karmic-btn ${tab==='active' ? '' : 'opacity-80'}`}>Active</button>
              <button onClick={() => setTab('ended')} className={`karmic-btn ${tab==='ended' ? '' : 'opacity-80'}`}>Ended</button>
            </div>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {filteredChats.map((chat) => {
              const last = lastMessages[chat.id] || ''
              const selected = selectedChat?.id === chat.id
              const displayName = chat.profiles?.[0]?.full_name || chat.user_name || chat.user_id || 'Conversation'
              const initials = (displayName || '').slice(0,2).toUpperCase()
              return (
                <button
                  key={chat.id}
                  onClick={async () => {
                    setSelectedChat(chat)
                    // fetch last messages for the full chat view
                    const { data: msgs } = await supabase
                      .from('messages')
                      .select('id, content, sender_id, created_at')
                      .eq('chat_id', chat.id)
                      .order('created_at', { ascending: true })
                    setMessages(msgs || [])
                  }}
                  className={`w-full text-left flex items-center gap-3 p-2 rounded ${selected ? 'ring-2 ring-violet-400/40 bg-white/6' : 'hover:bg-white/3'}`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-yellow-300 flex items-center justify-center text-white font-bold">{initials || 'U'}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{displayName}</div>
                      <div className="text-xs text-gray-400">{new Date(chat.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="text-sm text-gray-300 truncate mt-1">{last}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

  {/* Right - conversation preview / actions */}
  <div className="md:col-span-2 bg-white/2 hero-card rounded-lg p-4 no-border">
          {selectedChat ? (
            <div className="flex flex-col h-[66vh]">
              {/* popup: chat ended by astrologer */}
              {showEndedPopup && (
                <div className="fixed bottom-6 right-6 z-50 w-96 bg-white/6 backdrop-blur-md rounded-lg p-4 shadow-lg border border-white/6">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-semibold">Chat ended</div>
                      <div className="text-sm text-gray-200 mt-1">This chat was ended by {endedPopupInfo?.by || 'the astrologer'}. Thank you for sharing — feel free to reflect and come back anytime.</div>
                      <div className="mt-3 flex gap-2">
                        <button className="karmic-btn karmic-btn--large karmic-btn--disabled" disabled>Payment (coming soon)</button>
                        <button onClick={() => setShowEndedPopup(false)} className="karmic-btn">Dismiss</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">Conversation</div>
                  <div className="text-xs text-gray-500">Started: {new Date(selectedChat.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Right pane is the full view; left selection opens the chat in-place */}
                </div>
              </div>

              <div ref={listRef} className="flex-1 chat-scroll p-3 rounded-md bg-transparent mb-3 flex flex-col gap-3 no-border">
                {messages.length === 0 ? (
                  <div className="text-gray-400">No messages yet. Say hi!</div>
                ) : (
                  messages.map((m: any) => (
                    <div key={m.id} className={`${m.sender_id === user.id ? 'self-end text-right' : 'self-start text-left'}`}>
                      <div className={`chat-bubble ${m.sender_id === user.id ? 'chat-bubble--me' : 'chat-bubble--them'}`}>
                        {String(m.content || '').split('\n').map((line, i, arr) => (
                          <span key={i}>
                            {line}
                            {i < arr.length - 1 && <br />}
                          </span>
                        ))}
                      </div>
                      <div className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className={`flex-1 p-3 rounded-lg subtle-input text-white placeholder-gray-400 ${selectedChat?.status === 'ended' ? 'opacity-60 pointer-events-none' : ''}`}
                  placeholder="Write a message..."
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && messageInput.trim() && selectedChat?.status !== 'ended') {
                      // send message
                      await supabase.from('messages').insert({ chat_id: selectedChat.id, sender_id: user.id, content: messageInput.trim() })
                      setMessageInput('')
                    }
                  }}
                />
                <button disabled={selectedChat?.status === 'ended'} onClick={async () => {
                  if (!messageInput.trim() || selectedChat?.status === 'ended') return
                  await supabase.from('messages').insert({ chat_id: selectedChat.id, sender_id: user.id, content: messageInput.trim() })
                  setMessageInput('')
                }} className="karmic-btn karmic-btn--large">Send</button>
              </div>
            </div>
          ) : (
            <div className="h-[66vh] flex flex-col items-center justify-center text-center text-gray-400">
              <div className="mb-4">Select a conversation on the left to preview messages.</div>
              <div>If you want to start a new chat, click Join Queue from the header.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
