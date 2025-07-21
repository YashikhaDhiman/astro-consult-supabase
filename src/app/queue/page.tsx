'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

export default function QueuePage() {
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkQueue = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (data) {
        setInQueue(true);
        router.push(`/chat/${data.id}`);
      }

      setLoading(false);
    };

    checkQueue();
  }, [router]);

  const handleJoin = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return alert('Login first.');

    // Check current queue length
    const { count } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (count && count >= 20) {
      return alert('Queue is full. Try again later.');
    }

    // Get max current priority and add 1
    const { data: allChats } = await supabase
      .from('chats')
      .select('priority')
      .eq('status', 'active')
      .order('priority', { ascending: false });

    const nextPriority = (allChats?.[0]?.priority || 0) + 1;

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: user.id,
        priority: nextPriority,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      alert('Failed to join queue.');
    } else {
      router.push(`/chat/${data.id}`);
    }
  };

  if (loading) return <div className="p-6">Checking your chat status...</div>;

  if (inQueue) return <div className="p-6">You're already in the queue!</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Join the Queue</h2>
      <button
        onClick={handleJoin}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Join Queue
      </button>
    </div>
  );
}
