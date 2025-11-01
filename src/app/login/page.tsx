'use client';

import { useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const ASTROLOGER_EMAIL = 'devmishra30799@gmail.com';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      // fetch the user AFTER login is successful
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        setError("Login succeeded, but failed to get user data.");
        return;
      }

      const loggedInEmail = userData.user.email;

      if (loggedInEmail === ASTROLOGER_EMAIL) {
        router.push('/astro');
      } else {
        // check if user already has an active chat
        const { data: existingChats } = await supabase
          .from('chats')
          .select('id')
          .eq('user_id', userData.user.id)
          .eq('status', 'active')

        if (existingChats && existingChats.length > 0) {
          const { selectChat } = await import('@/lib/selectedChat')
          selectChat(existingChats[0].id)
        } else {
          router.push('/queue')
        }
      }
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white px-4">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Login</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 rounded bg-gray-700 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            Login
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-300">
          Don’t have an account?{' '}
          <a href="/signup" className="text-blue-400 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
