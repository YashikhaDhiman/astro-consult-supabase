"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Link from "next/link"

export default function JoinQueueButton({
  userId,
  onPrechat,
  chatId,
}: {
  userId: string
  onPrechat: (chatId: string) => void
  chatId?: string
}) {
  const router = useRouter()
  const [isInQueue, setIsInQueue] = useState(false)
  const [isFull, setIsFull] = useState(false)
  const [existingChatId, setExistingChatId] = useState<string | null>(null)

  useEffect(() => {
    const checkQueueStatus = async () => {
      const { data: activeChats, error } = await supabase
        .from("chats")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")

      if (error) {
        console.error(error)
        return
      }

      if (activeChats && activeChats.length > 0) {
        setIsInQueue(true)
        setExistingChatId(activeChats[0].id)
      }

      const { count } = await supabase
        .from("chats")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      if (count && count >= 20) setIsFull(true)
    }

    if (userId) checkQueueStatus()
  }, [userId])

  const handleJoin = async () => {
    if (chatId) {
      // mark chat as queued/active
      const { error } = await supabase
        .from("chats")
        .update({ status: "queued" })
        .eq("id", chatId)

      if (error) return alert(error.message)

      window.location.href = `/chat/${chatId}`
      return
    }

    // Check if user already has an active chat
    const { data: existingChats } = await supabase
      .from("chats")
      .select("id, meta")
      .eq("user_id", userId)
      .eq("status", "active")

    if (existingChats && existingChats.length > 0) {
      const chat = existingChats[0]
      if (!chat.meta) {
        onPrechat(chat.id) // Trigger pre-chat form
        return
      }
      router.push(`/chat/${chat.id}`)
      return
    }

    // Fetch all active chats to assign the next priority number
    const { data: activeChats, error } = await supabase
      .from("chats")
      .select("priority")
      .eq("status", "active")

    if (error) {
      console.error("Error fetching active chats:", error)
      return
    }

    const newPriority =
      activeChats && activeChats.length > 0
        ? Math.max(...activeChats.map((c: any) => c.priority || 0)) + 1
        : 1

    const { error: insertError } = await supabase.from("chats").insert({
      user_id: userId,
      priority: newPriority,
      status: "active",
    })

    if (!insertError) {
      router.push("/chat")
    } else {
      console.error("Error joining queue", insertError)
    }
  }

  if (isInQueue) {
    return (
      <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded text-sm">
        You already have an active chat. Please visit{" "}
        <Link href="/mychats" className="underline text-blue-700">
          My Chats
        </Link>{" "}
        to continue the conversation.
      </div>
    )
  }

  return (
    <button
      onClick={handleJoin}
      disabled={isFull}
      className={`px-4 py-2 rounded mt-4 ${
        isFull
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {isFull ? "Queue Full" : "Join Queue"}
    </button>
  )
}
