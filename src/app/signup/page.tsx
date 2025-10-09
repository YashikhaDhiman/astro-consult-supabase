'use client';

import { useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { data: signData, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      setError(error.message);
    } else {
      // try to get the newly created user (some setups return user immediately)
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id ?? signData?.user?.id ?? null

      // If we have a uid, create/upsert a profile row (best-effort).
      if (uid) {
        try {
          await supabase.from('profiles').upsert({ id: uid, full_name: fullName, updated_at: new Date() }, { onConflict: 'id' })
        } catch (profileErr) {
          // non-blocking: log and continue
          console.warn('Failed to create profile at signup (profiles table may not exist):', profileErr)
        }

        // redirect to existing active chat if any
        const { data: existingChats } = await supabase
          .from('chats')
          .select('id')
          .eq('user_id', uid)
          .eq('status', 'active')

        if (existingChats && existingChats.length > 0) {
          const { selectChat } = await import('@/lib/selectedChat')
          selectChat(existingChats[0].id)
          return
        }
      }

      router.push('/queue')
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white px-4">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Sign Up</h2>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 rounded bg-gray-700 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Full name"
            className="w-full p-2 rounded bg-gray-700 text-white"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 rounded bg-gray-700 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full karmic-btn karmic-btn--large"
          >
            Sign Up
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-300">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
