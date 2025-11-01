
/* eslint-disable */
"use client"

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import supabase from '@/lib/supabaseClient'
import Link from 'next/link'
import { triggerQueueRefresh } from '@/lib/queueRefresh'
import { selectChat } from '@/lib/selectedChat'

type Props = { userId?: string; isFull?: boolean; isInQueue?: boolean }

export default function JoinQueueButton({ userId: userIdProp, isFull = false, isInQueue = false }: Props) {
  const router = useRouter()
  const [isJoining, setIsJoining] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formValues, setFormValues] = useState({ fullName: '', placeOfBirth: '', dob: '', tob: '', question: '', context: '' })

  async function handleClientFallback(uid: string | null) {
    try {
      // compute next priority
      const { data: active } = await supabase
        .from('chats')
        .select('priority')
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .limit(1)

      const nextPriority = (active?.[0]?.priority || 0) + 1

      const insertPayload: any = { user_id: uid, priority: nextPriority, status: 'active' }

      const { data: inserted, error: insertErr } = await supabase
        .from('chats')
        .insert(insertPayload)
        .select()
        .single()

      if (insertErr) {
        console.error('client fallback insert failed', insertErr)
        return null
      }

      // best-effort authoritative count
      const { count } = await supabase
        .from('chats')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')

      triggerQueueRefresh(typeof count === 'number' ? count : undefined)

      return inserted?.id ?? null
    } catch (err) {
      console.error('join-queue fallback failed', err)
      return null
    }
  }

  // join flow used by modal submit: returns created chat id or null
  async function joinAndOpen(initialMessage?: string) {
    setIsJoining(true)
    try {
      // resolve user id if not provided
      let uid = userIdProp || null
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser()
        uid = userData?.user?.id ?? null
      }

      if (!uid) {
        console.error('JoinQueueButton: no user id available')
        return null
      }

      // try server endpoint first
      const res = await fetch('/api/join-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      })

      let json: any = null
      try {
        json = await res.json()
      } catch (parseErr) {
        console.warn('join-queue: failed to parse JSON response', parseErr)
      }

      let chatId: string | null = null

      if (!res.ok || json?.error || !json?.id) {
        console.warn('join-queue failed on server, performing client fallback', { status: res.status, body: json })
        chatId = await handleClientFallback(uid)
      } else {
        chatId = json.id
        const authoritativeCount = typeof json.count === 'number' ? json.count : undefined
        triggerQueueRefresh(authoritativeCount)
      }

      if (!chatId) return null

      // If user provided initial message via the form, insert it as the first message
      if (initialMessage && initialMessage.trim()) {
        try {
          await supabase.from('messages').insert({ chat_id: chatId, sender_id: uid, content: initialMessage.trim() })
        } catch (msgErr) {
          console.error('Failed to insert initial message', msgErr)
        }
      }

      selectChat(chatId)
      router.push('/mychats')
      return chatId
    } catch (e) {
      console.error('join-queue failed', e)
      return null
    } finally {
      setIsJoining(false)
    }
  }

  // Open the modal form when clicking the main button
  function openForm() {
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    // basic client-side validation
    if (!formValues.fullName.trim() || !formValues.placeOfBirth.trim() || !formValues.dob || !formValues.tob || !formValues.question.trim()) {
      // simple UX: keep modal open and do not submit
      console.warn('Please complete all required fields')
      return
    }

  // Build a readable, form-like message using a single template literal for clean newlines
  const preview = `${formValues.question.trim().slice(0, 120)} — ${formValues.fullName || 'Anonymous'}`

  const combined = `📋 ${preview}

────────────────────────────
📄 Full details

Question:
${formValues.question.trim()}

Details:
Full name: ${formValues.fullName || '—'}
Place of birth: ${formValues.placeOfBirth || '—'}
Date of birth: ${formValues.dob || '—'}
Time of birth: ${formValues.tob || '—'}

Additional context:
${formValues.context.trim() || 'No additional context.'}

🙏 Thank you — looking forward to your guidance.`
    await joinAndOpen(combined)
  setShowForm(false)
  setFormValues({ fullName: '', placeOfBirth: '', dob: '', tob: '', question: '', context: '' })
  }

  if (isInQueue) {
    return (
      <div className="mt-4 p-4 hero-card rounded-lg border-transparent text-sm">
        <div className="flex items-center gap-3">
          <div className="karmic-badge">In Queue</div>
          <div className="text-sm text-gray-300">You already have an active chat. Visit <Link href="/mychats" className="underline text-white">My Chats</Link> to continue.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <button
        onClick={openForm}
        disabled={isFull || isJoining}
        aria-busy={isJoining}
        title={isFull ? 'Queue is full — please try again later' : 'Join the queue'}
        className={`karmic-btn karmic-btn--large ${isFull || isJoining ? 'karmic-btn--disabled' : ''}`}
      >
        {isJoining ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.18)" strokeWidth="4"></circle>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="#fff" strokeWidth="4" strokeLinecap="round"></path>
            </svg>
            <span className="sr-only">Joining…</span>
            <span>Joining…</span>
          </span>
        ) : isFull ? (
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Queue Full</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Join Queue</span>
          </span>
        )}
      </button>

      {/* helper copy to match site tone and give users context */}
      <p className="text-xs text-gray-300 mt-2">You’ll be notified when it’s your turn — hold space and breathe.</p>

      {/* Modal form for onboarding questions */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <form onSubmit={handleFormSubmit} className="relative bg-gray-900 rounded-lg p-6 w-full max-w-lg mx-4 text-left shadow-lg">
            <h3 className="text-xl font-semibold mb-2">Quick intro (helps the astrologer)</h3>
            <p className="text-sm text-gray-300 mb-4">Tell us a little about why you're here — this message will be sent to the astrologer when you join the queue.</p>

            <label className="block text-sm text-gray-300 mb-2">Full name <span className="text-xs text-gray-400">(required)</span>
              <input value={formValues.fullName} onChange={(e) => setFormValues((s) => ({ ...s, fullName: e.target.value }))} required className="w-full mt-1 p-2 rounded bg-black/20" />
            </label>

            <label className="block text-sm text-gray-300 mb-2">Place of birth <span className="text-xs text-gray-400">(required)</span>
              <input value={formValues.placeOfBirth} onChange={(e) => setFormValues((s) => ({ ...s, placeOfBirth: e.target.value }))} required className="w-full mt-1 p-2 rounded bg-black/20" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-300 mb-2">Date of birth <span className="text-xs text-gray-400">(required)</span>
                <input type="date" value={formValues.dob} onChange={(e) => setFormValues((s) => ({ ...s, dob: e.target.value }))} required className="w-full mt-1 p-2 rounded bg-black/20" />
              </label>

              <label className="block text-sm text-gray-300 mb-2">Time of birth <span className="text-xs text-gray-400">(required)</span>
                <input type="time" value={formValues.tob} onChange={(e) => setFormValues((s) => ({ ...s, tob: e.target.value }))} required className="w-full mt-1 p-2 rounded bg-black/20" />
              </label>
            </div>

            <label className="block text-sm text-gray-300 mb-2">Main question <span className="text-xs text-gray-400">(required)</span>
              <textarea required value={formValues.question} onChange={(e) => setFormValues((s) => ({ ...s, question: e.target.value }))} rows={3} className="w-full mt-1 p-2 rounded bg-black/20" />
            </label>

            <label className="block text-sm text-gray-300 mb-4">Any extra context (optional)
              <textarea value={formValues.context} onChange={(e) => setFormValues((s) => ({ ...s, context: e.target.value }))} rows={2} className="w-full mt-1 p-2 rounded bg-black/20" />
            </label>

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={closeForm} className="karmic-btn karmic-btn--ghost">Cancel</button>
              <button type="submit" disabled={isJoining || !formValues.fullName.trim() || !formValues.placeOfBirth.trim() || !formValues.dob || !formValues.tob || !formValues.question.trim()} className="karmic-btn karmic-btn--large">
                {isJoining ? 'Joining…' : 'Join & Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
