/* eslint-disable */
"use client";

import { useEffect, useState } from 'react';
import useMounted from '@/hooks/useMounted';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

const ASTROLOGER_EMAIL = 'devmishra30799@gmail.com';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  // track hover vs manual (click) flip states separately so hover can return when mouse leaves
  const [hoverMap, setHoverMap] = useState<Record<string, boolean>>({});
  const [manualMap, setManualMap] = useState<Record<string, boolean>>({});
  const [isMobileView, setIsMobileView] = useState<boolean>(false)
  const mounted = useMounted();
  const [queueCount, setQueueCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };

  // run getUser; mount state is provided by useMounted()
  getUser();
  // (we'll allow click-to-flip only on mobile viewports)

  // detect mobile viewport (we'll allow click-to-flip only on mobile viewports)
  const setMobile = () => setIsMobileView(window.innerWidth <= 768)
  setMobile()
  const onResize = () => setMobile()
  window.addEventListener('resize', onResize)
  // cleanup on unmount
  return () => window.removeEventListener('resize', onResize)
  }, []);

  useEffect(() => {
    // Robust fetch that prefers exact count with head:true and falls back to fetching rows
    const fetchQueueCount = async () => {
      try {
        const { count, error } = await supabase
          .from('chats')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active');

        if (!error) {
          if (count === null || typeof count === 'undefined') {
            const { data: rows, error: rowsErr } = await supabase
              .from('chats')
              .select('id')
              .eq('status', 'active');

            if (!rowsErr) setQueueCount(rows?.length || 0);
            else console.error('Error fetching queue rows fallback:', rowsErr);
          } else {
            setQueueCount(count || 0);
          }
        } else {
          console.error('Error fetching queue count:', error);
        }
      } catch (err) {
        console.error('Unexpected error fetching queue count:', err);
      }
    };

    // Fetch once on mount
    fetchQueueCount();

    // If the user is the astrologer, subscribe to realtime updates so the count stays live
    const channel = supabase
      .channel('home-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => {
          fetchQueueCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAskClick = () => {
    if (user) {
      router.push('/queue');
    } else {
  router.push('/login?next=/queue');
    }
  };

  const isAstrologer = user?.email === ASTROLOGER_EMAIL;

  // flip state removed; cards now flip on hover/focus-within via CSS

  const cards = [
    {
      key: 'intro',
  title: 'Welcome',
      short: "A karmic journey — consultations are free and soul-led.",
  icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'><defs><linearGradient id='g1' x1='0' x2='1'><stop offset='0' stop-color='#fbd38d'/><stop offset='1' stop-color='#a78bfa'/></linearGradient></defs><path d='M12 2l1.9 4.3L18 9l-4 2.1L12 16 10 11.1 6 9l4.1-2.7L12 2z' fill='url(#g1)'/></svg>`,
  full: `Unlike most astrology platforms, this space is unique. This is not a business—this is a karmic journey. I believe that you and I are not meeting by coincidence; we are connecting because we are meant to. This is not a service, it's a soul-led connection. That’s why my consultations are completely free. No fixed price, no paywall—only sincere guidance.`,
    },
    {
      key: 'astro',
      title: 'Meet Your Astrologer',
      short: 'A soul-led guide; prefers to remain unnamed.',
      icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'><defs><linearGradient id='g4' x1='0' x2='1'><stop offset='0' stop-color='#fbd38d'/><stop offset='1' stop-color='#a78bfa'/></linearGradient></defs><circle cx='12' cy='8' r='3' fill='url(#g4)'/><path d='M4 20c0-4 4-7 8-7s8 3 8 7' stroke='url(#g4)' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
      full: `I didn’t choose astrology — astrology chose me. I come from a background in philosophy, and it was through deep introspection and spiritual study that I found myself drawn to the ancient sciences of astrology and metaphysics. I prefer to remain unnamed because this isn’t about me. What truly matters is our energetic connection.`,
    },
    {
      key: 'how',
  title: 'How It Works',
      short: 'Queue-based system; you will be notified when it’s your turn.',
  icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'><defs><linearGradient id='g2' x1='0' x2='1'><stop offset='0' stop-color='#fbd38d'/><stop offset='1' stop-color='#a78bfa'/></linearGradient></defs><path d='M3 6h18M6 12h12M9 18h6' stroke='url(#g2)' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  full: `When you submit your request, it goes into a queue. As I go through each ticket, I will select them based on queue order. You’ll be notified when your turn comes, and we can begin our session via a private chat window. I usually handle 15–20 tickets per day, so depending on your queue position, your turn may take time—but trust, it will come exactly when it's meant to.`,
    },
    {
      key: 'request',
  title: 'A Small Request',
      short: 'If helpful, please share this space with others by word of mouth.',
  icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'><defs><linearGradient id='g3' x1='0' x2='1'><stop offset='0' stop-color='#fbd38d'/><stop offset='1' stop-color='#a78bfa'/></linearGradient></defs><path d='M12 21s-6-4.35-9-7.2C-1 10 4 4 12 9c8-5 13 1 9 4.8C18 16.65 12 21 12 21z' fill='url(#g3)'/></svg>`,
  full: `If my guidance helps you or touches your soul, I humbly ask one thing: help me help others. Spread the word to your friends, family, or anyone who may be seeking a deeper understanding of their path. Let’s grow this movement organically, soul by soul.`,
    },
  ]

  return (
    <div className="p-6 text-white">
      <main className="max-w-5xl mx-auto animate-fadeUp">
        <h1 className="text-4xl font-extrabold mb-2 karmic-gradient">Your Karmic Connection</h1>
        <p className="text-gray-300 mb-6">A soul-led, free astrological space — not a business, but a karmic connection.</p>

        {/* Top CTA area: stable DOM to avoid hydration mismatch. */}
        {!isAstrologer && (
          <div className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <a
                  href="/queue"
                  className="mb-6 karmic-btn karmic-btn--large"
                  onClick={(e) => {
                    // If anonymous, stop full navigation and show auth prompt instead.
                    if (!user) {
                      e.preventDefault()
                      router.push('/login?next=/queue')
                    }
                  }}
                >
                  Ask the Stars?
                </a>
                <p className="text-gray-300 mt-2">Let׳s walk this path as fellow travelers on a karmic journey.</p>
              </div>

              {/* Logged-in controls rendered only after mount to avoid changing outer structure */}
              <div className="flex items-center gap-3">
                {/* intentionally empty on homepage; header already exposes My Chats */}
                <div style={{ width: 1 }} aria-hidden />
              </div>
            </div>
          </div>
        )}

        {!isAstrologer && (
          <div className="cards-grid mb-6">
            {cards.map((c) => {
              const manual = manualMap[c.key]
              const hover = hoverMap[c.key]
              // Manual has precedence; otherwise follow hover
              const isFlipped = manual === true ? true : manual === false ? false : !!hover
              return (
                <article
                  key={c.key}
                  className={`card ${isFlipped ? 'is-flipped' : ''}`}
                  tabIndex={0}
                  onClick={() => {
                    // Only treat click as manual toggle on mobile viewports. Desktop mouse clicks should not persist flips.
                    if (!isMobileView) return
                    setManualMap((s) => {
                      const isOn = !!s[c.key]
                      // toggle: if currently on, clear manualMap; else set this as the only manual flip
                      return isOn ? {} : { [c.key]: true }
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      // keyboard toggle should always work (accessibility)
                      setManualMap((s) => {
                        const isOn = !!s[c.key]
                        return isOn ? {} : { [c.key]: true }
                      })
                    }
                  }}
                  onMouseEnter={() => setHoverMap((s) => ({ ...s, [c.key]: true }))}
                  onMouseLeave={() => setHoverMap((s) => ({ ...s, [c.key]: false }))}
                >
                  <div className="card-inner">
                    <div className="card-face card-front hero-card">
                        <div className="card-button">
                          <div className="flex items-center mb-3">
                            <span className="card-icon" dangerouslySetInnerHTML={{ __html: c.icon }} />
                            <h3 className="text-xl font-semibold">{c.title}</h3>
                          </div>
                          <p className="text-gray-300">{c.short}</p>
                          <p className="mt-4 text-sm text-gray-400">Hover to read more</p>
                        </div>
                    </div>

                    <div className="card-face card-back hero-card">
                      <div className="card-back-header">
                        <div className="flex items-center gap-3">
                          <span className="card-icon" dangerouslySetInnerHTML={{ __html: c.icon }} />
                          <h3 className="text-xl font-semibold">{c.title}</h3>
                        </div>
                        {/* Tap-to-close hint for mobile viewports when card is manually flipped */}
                        {(isMobileView && manual) ? (
                          <div className="tap-hint">Tap to close</div>
                        ) : null}
                      </div>
                      <div className="card-back-body">
                        <p className="text-gray-200 whitespace-pre-wrap">{c.full}</p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

  {/* Forum placeholder moved to bottom */}

  {/* modal removed: anonymous users are routed to /login?next=/queue */}


        {user && isAstrologer && (
          <div className="mb-6">
            <p className="text-gray-200">Hello Astrologer — <strong className="text-white">{queueCount}</strong> active {queueCount === 1 ? 'chat' : 'chats'}</p>
            <button onClick={() => router.push('/astro')} className="karmic-btn mt-2">Go to Inbox</button>
          </div>
        )}

        {/* Forum placeholder moved to bottom of page */}
        <section className="mt-8 p-6 bg-gray-50 rounded-lg text-gray-800">
          <h2 className="text-lg font-semibold mb-2">Community Forum (coming soon)</h2>
          <p className="text-sm text-gray-600">A gentle place to share experiences, ask follow-up questions, and connect with other travelers. This space is under construction — stay tuned.</p>
        </section>

        </main>
    </div>
  )
}
