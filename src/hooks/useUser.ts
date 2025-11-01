import { useCallback, useEffect, useState } from 'react'
import supabase from '@/lib/supabaseClient'
import useMounted from './useMounted'
import { subscribeQueueRefresh } from '@/lib/queueRefresh'

type UserType = { id: string; email?: string } | null

export default function useUser() {
  const mounted = useMounted()
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [queueCount, setQueueCount] = useState<number>(0)
  const [userEtaHours, setUserEtaHours] = useState<number | null>(null)
  const [userQueuePosition, setUserQueuePosition] = useState<number | null>(null)

  const computeUserEta = useCallback(async (userId: string) => {
    try {
      const { data: activeChats } = await supabase
        .from('chats')
        .select('id,priority,user_id')
        .eq('status', 'active')
        .order('priority', { ascending: true })

      const chats = (activeChats as Array<{ id: string; priority?: number; user_id?: string }>) || []

      if (chats.length === 0) return


      const idx = chats.findIndex((c) => c.user_id === userId)
      if (idx >= 0) {
        const position = idx + 1
        setUserQueuePosition(position)
        setUserEtaHours((24 / 15) * position)
        return
      }

  setUserQueuePosition(null)
  setUserEtaHours((24 / 15) * (chats.length + 1))
    } catch (err) {
      console.error('useUser.computeUserEta error', err)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.auth.getUser()
      const u = data?.user ?? null
      setUser(u)


      // Only use the precomputed metric. Do NOT fall back to querying `chats`.
      // If metric is missing, show 0 rather than exposing chats rows.
      try {
        const { data: metricRow, error: metricErr } = await supabase
          .from('queue_metrics')
          .select('count')
          .eq('metric_key', 'active_chats')
          .maybeSingle()

          if (!metricErr && metricRow && typeof metricRow.count === 'number') {
            console.debug('[useUser] metric read', metricRow.count)
            setQueueCount(metricRow.count)
          } else {
            console.debug('[useUser] metric missing or invalid, setting 0')
            setQueueCount(0)
          }
      } catch (e) {
        console.error('queue_metrics lookup failed', e)
        setQueueCount(0)
      }

  // user-specific count removed to reduce client queries; header shows global queueCount

      if (u) await computeUserEta(u.id)
    } catch (err) {
      console.error('useUser.refresh error', err)
    } finally {
      setLoading(false)
    }
  }, [computeUserEta])

  useEffect(() => {
    if (!mounted) return

    refresh()

    // respond to manual triggers from other components (e.g. JoinQueueButton)
    const unsubscribeRefresh = subscribeQueueRefresh((count?: number) => {
      if (typeof count === 'number') {
        console.debug('[useUser] received triggerQueueRefresh with count', count)
        setQueueCount(count)
        return
      }
      console.debug('[useUser] received triggerQueueRefresh without count, calling refresh')
      // call refresh but don't block
      void refresh()
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      // refresh will pick up new state
      refresh()
    })


      // Subscribe to changes on the precomputed metric instead of `chats` table
      type MetricRow = { metric_key?: string }
      const channel = supabase
        .channel('realtime-queue-metrics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_metrics' }, (payload) => {
          // Only interested in the active_chats metric row updates
          const n = payload?.new as MetricRow | undefined
          const o = payload?.old as MetricRow | undefined
          if (n?.metric_key === 'active_chats' || o?.metric_key === 'active_chats') {
            refresh()
          }
        })
        .subscribe()

    return () => {
      listener?.subscription?.unsubscribe()
      supabase.removeChannel(channel)
      unsubscribeRefresh()
    }
  }, [mounted, refresh])

  return {
    user,
    loading,
    mounted,
    queueCount,
    userEtaHours,
    userQueuePosition,
    refresh,
  }
}
