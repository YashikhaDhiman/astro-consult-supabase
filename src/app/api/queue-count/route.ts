import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 })
  }

  const sb = createClient(url, key)

  try {
    const { data, error } = await sb
      .from('queue_metrics')
      .select('count')
      .eq('metric_key', 'active_chats')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const count = data?.count ?? 0
    return NextResponse.json({ count })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
