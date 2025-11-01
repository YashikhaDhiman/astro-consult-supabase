/* eslint-disable */
"use client"

import { useEffect } from 'react'
import useMounted from '@/hooks/useMounted'
import { useParams, useRouter } from 'next/navigation'
import { selectChat } from '@/lib/selectedChat'

export default function ChatPage() {
  const { id: chatId } = useParams()
  const mounted = useMounted()
  const router = useRouter()

  useEffect(() => {
    if (!mounted || !chatId) return
    const idStr = Array.isArray(chatId) ? chatId[0] : chatId ?? null
    if (!idStr) return
    // Trigger the in-app selection so the right-pane opens the chat
    selectChat(idStr)
  }, [mounted, chatId])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-2">Opening chat…</h2>
      <p className="text-sm text-gray-400 mb-4">This deep link will open the chat in the app's right pane. If nothing appears, open your inbox.</p>
      <div className="flex gap-2">
        <button onClick={() => router.push('/mychats')} className="karmic-btn">My Chats</button>
        <button onClick={() => router.push('/')} className="karmic-btn karmic-btn--ghost">Home</button>
      </div>
    </div>
  )
}
