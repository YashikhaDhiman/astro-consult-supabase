import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return NextResponse.json({ error: 'Missing supabase env' }, { status: 500 })

  const sb = createClient(url, key)

  try {
    const body = await req.json()
    const user_id = body?.user_id
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // compute next priority
    const { data: rows, error: maxErr } = await sb
      .from('chats')
      .select('priority')
      .order('priority', { ascending: false })
      .limit(1)

    if (maxErr) return NextResponse.json({ error: maxErr.message }, { status: 500 })

    const maxPriority = (rows && rows[0] && typeof rows[0].priority === 'number') ? rows[0].priority : 0
    const newPriority = maxPriority + 1

    const { data: inserted, error: insertErr } = await sb
      .from('chats')
      .insert({ user_id, priority: newPriority, status: 'active' })
      .select('id')
      .single()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // recompute authoritative count and upsert metric
    const { count, error: countErr } = await sb
      .from('chats')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    const activeCount = !countErr ? (count ?? 0) : 0

    // upsert queue_metrics
    await sb.from('queue_metrics').upsert({ metric_key: 'active_chats', count: activeCount, updated_at: new Date() }, { onConflict: 'metric_key' })

    return NextResponse.json({ id: inserted.id, count: activeCount })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
