/* eslint-disable */
"use client"

import { useEffect, useState, useRef } from 'react'
import useMounted from '@/hooks/useMounted'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'
import { selectChat } from '@/lib/selectedChat'
import Link from 'next/link'
import { triggerQueueRefresh } from '@/lib/queueRefresh'

const ASTROLOGER_EMAIL =  'devmishra30799@gmail.com' 

export default function AstrologerInbox() {
  const [user, setUser] = useState<any>(null)
  const mounted = useMounted()
  const [chats, setChats] = useState<any[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({})
  const [selectedChat, setSelectedChat] = useState<any | null>(null)
  const [previewMessages, setPreviewMessages] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [messageInput, setMessageInput] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const [searchUserId, setSearchUserId] = useState('')
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

  if (error) {
    console.error('Error fetching chats:', error)
  } else {
    // Sort active chats by priority for queue positioning
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

    // Load latest message (content + timestamp) for each chat so we can order by latest activity
    const messageContentMap: Record<string, string> = {}
    const lastMessageAtMap: Record<string, string> = {}
    for (const chat of chatsWithPosition) {
      const { data: messages } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const m = messages?.[0]
      messageContentMap[chat.id] = m?.content || 'No messages yet.'
      // Use the message timestamp if available; otherwise fall back to chat.created_at
      lastMessageAtMap[chat.id] = m?.created_at || chat.created_at
    }

    // Sort chats by latest message time (most recent first) so astrologer sees active conversations with latest activity on top
    chatsWithPosition.sort((a: any, b: any) => {
      const ta = new Date(lastMessageAtMap[a.id]).getTime()
      const tb = new Date(lastMessageAtMap[b.id]).getTime()
      return tb - ta
    })

    setChats(chatsWithPosition)
    setLastMessages(messageContentMap)
  }
}

  useEffect(() => {
    if (!selectedChat) return

    const channel = supabase
      .channel(`astro-preview-${selectedChat.id}`)
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

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])


  const handleEndChat = async (chatId: string) => {
  // Optimistically mark selected chat as ended so UI disables send immediately
  setSelectedChat((prev: any) => (prev && prev.id === chatId ? { ...prev, status: 'ended' } : prev))

  // Try server endpoint first (preferred for authoritative metrics).
    try {
      const res = await fetch('/api/end-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        // If server route is missing env or failing, fall back to client update below.
        console.warn('end-chat server route failed, falling back to client update', json)
        throw new Error(json?.error || `Server returned ${res.status}`)
      }

      const json = await res.json()
      const authoritativeCount = typeof json.count === 'number' ? json.count : undefined
      await loadChats()
      triggerQueueRefresh(authoritativeCount)
      return
    } catch (e) {
      console.warn('Server end-chat failed, attempting client-side fallback:', e)
    }

    // Fallback: use client-side supabase update if server route is unavailable.
    try {
      const { error: updateErr } = await supabase
        .from('chats')
        .update({ status: 'ended' })
        .eq('id', chatId)

      if (updateErr) {
        console.error('Client-side end chat failed', updateErr)
        return
      }

      // Recompute active count client-side and update metrics table if possible
      const { count, error: countErr } = await supabase
        .from('chats')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')

      const activeCount = !countErr ? (count ?? 0) : undefined
      // Try to upsert metrics client-side (this may fail without service role but it's a best-effort)
      try {
        await supabase.from('queue_metrics').upsert({ metric_key: 'active_chats', count: activeCount ?? 0, updated_at: new Date() }, { onConflict: 'metric_key' })
      } catch (_) {
        /* ignore metric upsert errors on client */
      }

  await loadChats()
  triggerQueueRefresh(typeof activeCount === 'number' ? activeCount : undefined)
    } catch (e) {
      console.error('Fallback end-chat failed', e)
    }
  }

  const filteredChats = chats.filter((chat) => {
    const matchesTab = chat.status === tab
    const matchesUserId = searchUserId
      ? chat.user_id.toLowerCase().includes(searchUserId.toLowerCase())
      : true
    return matchesTab && matchesUserId
  })

  // When switching tabs, update right pane selection accordingly
  const handleTabChange = async (newTab: 'active' | 'ended') => {
    setTab(newTab)

    if (newTab === 'active') {
      const active = chats.filter(c => c.status === 'active')
      if (active.length > 0) {
        const chat = active[0]
        setSelectedChat(chat)
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, content, sender_id, created_at')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: true })
        setMessages(msgs || [])
        return
      }
      setSelectedChat(null)
      setMessages([])
      return
    }

    // ended tab cleared
    setSelectedChat(null)
    setMessages([])
  }

  if (!mounted || !user) {
    return <p className="text-white p-4">Verifying astrologer access...</p>
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 karmic-gradient">Astrologer Inbox</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white/5 hero-card rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Queue</div>
            <div className="text-sm text-gray-500">{filteredChats.length} items</div>
          </div>

          <div className="mb-3">
            <div className="flex gap-2 mb-2">
              <button onClick={() => setTab('active')} className={`karmic-btn ${tab==='active' ? '' : 'opacity-80'}`}>Active</button>
              <button onClick={() => setTab('ended')} className={`karmic-btn ${tab==='ended' ? '' : 'opacity-80'}`}>Ended</button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by User ID"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                className="flex-1 p-2 rounded bg-white/6 border border-gray-200/6"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[64vh] overflow-auto">
            {filteredChats.map((chat) => {
              const last = lastMessages[chat.id] || ''
              const selected = selectedChat?.id === chat.id
              const displayName = chat.profiles?.[0]?.full_name || chat.user_name || chat.user_id || 'U'
              const initials = (displayName || '').slice(0,2).toUpperCase()
              return (
                <button
                  key={chat.id}
                  onClick={async () => {
                    setSelectedChat(chat)
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
                      <div className="text-xs text-gray-400">{chat.queuePosition ? `#${chat.queuePosition}` : ''}</div>
                    </div>
                    <div className="text-sm text-gray-300 truncate mt-1">{last}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

  <div className="md:col-span-2 bg-white/2 hero-card rounded-lg p-4 no-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">Inbox</div>
              <div className="text-sm text-gray-500">Manage active chats and respond</div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" className="karmic-btn">Home</Link>
            </div>
          </div>

          {toast && (
            <div className="mb-3 bg-green-600 text-white px-4 py-2 rounded shadow-sm">{toast}</div>
          )}

          {selectedChat ? (
            <div className="flex flex-col h-[64vh]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{selectedChat.profiles?.[0]?.full_name || selectedChat.user_name || selectedChat.user_id}</div>
                  <div className="text-xs text-gray-500">Started: {new Date(selectedChat.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  {/* The right pane is interactive; left selection opens the chat in-place */}
                  {selectedChat.status === 'active' && (
                    <button onClick={() => handleEndChat(selectedChat.id)} className="karmic-btn karmic-btn--end">End Chat</button>
                  )}
                </div>
              </div>

              <div ref={listRef} className="flex-1 chat-scroll p-3 rounded-md bg-transparent mb-3 flex flex-col gap-3 no-border">
                {messages.length === 0 ? (
                  <div className="text-gray-400">No messages yet.</div>
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
            <div className="h-[64vh] flex items-center justify-center text-center text-gray-400">
              Select a chat on the left to preview messages and manage the session.
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
