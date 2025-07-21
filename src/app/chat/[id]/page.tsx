'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'

const ASTROLOGER_EMAIL = 'devmishra30799@gmail.com'

export default function ChatPage() {
  const { id: chatId } = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([])
  const [chat, setChat] = useState<any>(null)
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [isAstrologer, setIsAstrologer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chatEndedMessage, setChatEndedMessage] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)
      const isAstro = user.email === ASTROLOGER_EMAIL
      setIsAstrologer(isAstro)

      const { data: chatData, error } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single()

      if (error || !chatData) {
        console.error('Chat not found')
        router.push('/')
        return
      }

      if (!isAstro && chatData.user_id !== user.id) {
        router.push('/')
        return
      }

      setChat(chatData)

      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      setMessages(msgData || [])
      setLoading(false)
    }

    init()
  }, [chatId, router])

  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new
          setMessages((prev) => [...prev, newMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId])

  useEffect(() => {
    if (chatEndedMessage) {
      const timeout = setTimeout(() => {
        router.push(isAstrologer ? '/astro' : '/queue')
      }, 2000)

      return () => clearTimeout(timeout)
    }
  }, [chatEndedMessage, isAstrologer, router])

  const sendMessage = async () => {
    if (!newMessage.trim() || chat?.status === 'ended') return

    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: newMessage.trim(),
    })

    setNewMessage('')
  }

  const endChat = async () => {
    const { error } = await supabase
      .from('chats')
      .update({ status: 'ended' })
      .eq('id', chatId)

    if (!error) {
      setChatEndedMessage(true)
    } else {
      console.error('Failed to end chat:', error.message)
    }
  }

  if (loading || !chat) return <p className="p-4 text-white">Loading chat...</p>

  return (
    <div className="p-4 max-w-2xl mx-auto text-white">
      {isAstrologer && (
        <button
          onClick={() => router.push('/astro')}
          className="mb-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          ← Back to Inbox
        </button>
      )}
      <div className="mb-4">
        <h2 className="text-lg font-bold">
          Chat Session ({isAstrologer ? 'Astrologer' : 'Customer'})
        </h2>
        <p className="text-sm text-gray-300">
          Priority: {chat.priority} | Status: {chat.status}
        </p>
      </div>

      <div className="h-[400px] overflow-y-auto border border-gray-700 rounded p-3 bg-gray-800 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 ${
              msg.sender_id === user.id ? 'text-right' : 'text-left'
            }`}
          >
            <span
              className={`inline-block px-3 py-2 rounded ${
                msg.sender_id === user.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 text-white'
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
      </div>

      {chatEndedMessage ? (
        <div className="text-center text-green-400 mb-4 font-semibold">
          ✅ Chat ended. Redirecting...
        </div>
      ) : chat.status === 'ended' ? (
        <div className="text-center text-yellow-400 mb-4 font-semibold">
          ⚠️ This chat has been closed. You cannot send more messages.
        </div>
      ) : null}

      {chat.status !== 'ended' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 p-2 rounded bg-gray-700 text-white border border-gray-600"
            placeholder="Type your message..."
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
          >
            Send
          </button>
          {isAstrologer && (
            <button
              onClick={endChat}
              className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
            >
              End Chat
            </button>
          )}
        </div>
      )}

    </div>
  )
}
