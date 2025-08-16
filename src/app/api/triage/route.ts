import { NextResponse } from 'next/server';
import { processTriage } from '@/lib/triage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Server env SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { chatId, message } = body as { chatId?: string; message?: string };

  if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

  // Read existing meta from chats
  const { data: chat, error: fetchErr } = await supabaseAdmin.from('chats').select('meta').eq('id', chatId).maybeSingle();
  if (fetchErr) return NextResponse.json({ error: 'failed to load chat meta' }, { status: 500 });

  const currentMeta = (chat?.meta as any) || {};

  const userMsg = message || '';
  const result = await processTriage(currentMeta, userMsg);

  if (result.done) {
    // persist meta
    const { error: upErr } = await supabaseAdmin.from('chats').update({ meta: result.meta }).eq('id', chatId);
    if (upErr) return NextResponse.json({ error: 'failed to persist meta' }, { status: 500 });
    return NextResponse.json({ done: true, meta: result.meta });
  }

  return NextResponse.json({ done: false, followUpQuestion: result.followUpQuestion, meta: result.meta });
}
