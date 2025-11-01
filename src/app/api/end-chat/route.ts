import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return NextResponse.json({ error: 'Missing supabase env' }, { status: 500 })

  const sb = createClient(url, key)

  try {
    const body = await req.json()
    const chatId = body?.chatId
    if (!chatId) return NextResponse.json({ error: 'Missing chatId' }, { status: 400 })

    const { error: updateErr } = await sb
      .from('chats')
      .update({ status: 'ended' })
      .eq('id', chatId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const { count, error: countErr } = await sb
      .from('chats')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    const activeCount = !countErr ? (count ?? 0) : 0
    await sb.from('queue_metrics').upsert({ metric_key: 'active_chats', count: activeCount, updated_at: new Date() }, { onConflict: 'metric_key' })

    return NextResponse.json({ count: activeCount })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
