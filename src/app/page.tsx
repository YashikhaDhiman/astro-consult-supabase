'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import AuthPromptModal from '@/components/AuthPromptModal';

const ASTROLOGER_EMAIL = 'devmishra30799@gmail.com';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchQueueCount = async () => {
      const { count } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      setQueueCount(count || 0);
    };

    fetchQueueCount();
  }, []);

  const handleAskClick = () => {
    if (user) {
      router.push('/queue');
    } else {
      setShowPrompt(true);
    }
  };

  const isAstrologer = user?.email === ASTROLOGER_EMAIL;

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">Welcome to Astro Consult ✨</h1>

      {!user && (
        <p className="mb-6">
          Get insights from expert astrologers. Ask your question now!
        </p>
      )}

      {user && !isAstrologer && (
        <>
          <p className="mb-6">
            Hello, {user.email}! Get personalized astrological guidance now.
          </p>
          <button
            onClick={handleAskClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
          >
            Ask a Question
          </button>
        </>
      )}

      {user && isAstrologer && (
        <>
          <p className="mb-6">
            Hello Astrologer! You currently have <strong>{queueCount}</strong> active chat
            {queueCount === 1 ? '' : 's'} waiting in your <a className="underline" href="/astro">Inbox</a>.
          </p>
          <button
            onClick={() => router.push('/astro')}
            className="bg-purple-700 hover:bg-purple-800 text-white px-6 py-2 rounded"
          >
            Go to Inbox
          </button>
        </>
      )}

      {showPrompt && <AuthPromptModal onClose={() => setShowPrompt(false)} />}
    </div>
  );
}
