/* eslint-disable */
"use client";

import { useEffect, useState } from 'react';
import useMounted from '@/hooks/useMounted';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { selectChat } from '@/lib/selectedChat';
import { triggerQueueRefresh } from '@/lib/queueRefresh';
import JoinQueueButton from '@/components/JoinQueueButton';

export default function QueuePage() {
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const mounted = useMounted();
  const router = useRouter();

  useEffect(() => {
    const checkQueue = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) setUserId(user.id)

      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

        if (data) {
          setInQueue(true);
          // Open the chat in the right-pane UI instead of navigating to a chat page
          selectChat(data.id);
          // make sure user sees the right-pane messenger layout
          router.push('/mychats')
        }

      setLoading(false);
    };

  checkQueue();
  }, [router]);

  // join logic handled by shared JoinQueueButton component

  // Until we've completed the client-side check, show the same conservative server-rendered UI.
  if (!mounted || loading) return <div className="p-6">Checking your chat status...</div>;

  if (inQueue) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="hero-card p-6 rounded-lg max-w-xl w-full text-center">
        <div className="flex items-center justify-center mb-3">
          <div className="karmic-badge">In Queue</div>
        </div>
        <div className="text-gray-300 mb-4">You already have an active chat. Continue your conversation in <a className="underline text-white" href="/mychats">My Chats</a>.</div>
        <button onClick={() => router.push('/mychats')} className="karmic-btn karmic-btn--large">Open My Chats</button>
      </div>
    </div>
  )

  return (
    <div className="p-6 flex items-center justify-center min-h-[70vh]">
      <div className="max-w-2xl w-full text-center">
        <h2 className="text-3xl font-extrabold mb-4 karmic-gradient">Ready to Ask the Stars?</h2>
        <p className="text-gray-300 mb-6">Step into a gentle space — join the queue and you’ll be notified when it’s your turn. Hold space, breathe, and trust the timing.</p>

        <div className="mx-auto w-full max-w-xs">
          <JoinQueueButton userId={userId || ''} />
        </div>

        <p className="text-sm text-gray-400 mt-6">Tip: Stay nearby after joining — the astrologer may begin your session when your turn arrives.</p>
      </div>
    </div>
  )
}
