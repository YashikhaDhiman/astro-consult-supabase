'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import JoinQueueButton from '@/components/JoinQueueButton';
import PreChatForm from '@/components/PreChatForm';

export default function QueuePage() {
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPrechat, setShowPrechat] = useState(false);
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkQueue = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user ?? null;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: chatData } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (chatData) {
        setInQueue(true);
        if (!chatData.meta) {
          setPendingChatId(chatData.id);
          setShowPrechat(true);
        } else {
          router.push(`/chat/${chatData.id}`);
        }
      }

      setLoading(false);
    };
    checkQueue();
  }, [router]);

  useEffect(() => {
    const fetchUserId = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user ?? null;
      setUserId(user?.id ?? null);
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    // fetch any existing pending chat for current user
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user ?? null;
      if (!user) return;
      const { data: chat } = await supabase.from('chats').select('id,status').eq('user_id', user.id).in('status', ['pending']).limit(1).maybeSingle();
      if (chat?.id) setPendingChatId(chat.id);
    };
    load();
  }, []);

  const handleCreatePending = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;
    if (!user) return alert('Please login first');
    const { data: inserted, error } = await supabase.from('chats').insert([{ user_id: user.id, status: 'pending', meta: {} }]).select('id').maybeSingle();
    if (error) return alert(error.message);
    if (inserted?.id) setPendingChatId(inserted.id);
  };

  const handlePrechatDone = () => {
    setShowPrechat(false);
    setJoined(true);
  };

  if (loading) return <div className="p-6">Checking your chat status...</div>;

  if (inQueue && !showPrechat) return <div className="p-6">You're already in the queue!</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Queue</h1>

      {!pendingChatId && (
        <div>
          <p className="mb-4">Before joining, we need a few quick details.</p>
          <button className="px-4 py-2 bg-green-600 rounded" onClick={handleCreatePending}>Start</button>
        </div>
      )}

      {pendingChatId && !joined && (
        <div className="mt-4">
          <PreChatForm chatId={pendingChatId} onDone={handlePrechatDone} />
        </div>
      )}

      {joined && userId && (
        <div className="mt-4">
          <JoinQueueButton userId={userId} onPrechat={(id: string) => setShowPrechat(true)} chatId={pendingChatId ?? undefined} />
        </div>
      )}
    </div>
  );
}
