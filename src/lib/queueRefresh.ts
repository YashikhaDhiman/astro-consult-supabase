type Callback = (count?: number) => void

const subs = new Set<Callback>()

export function subscribeQueueRefresh(cb: Callback) {
  subs.add(cb)
  return () => subs.delete(cb)
}

export function triggerQueueRefresh(count?: number) {
  subs.forEach((cb) => {
    try {
      cb(count)
    } catch (e) {
      // swallow
      console.error('queueRefresh callback error', e)
    }
  })
}

const queueRefresh = { subscribeQueueRefresh, triggerQueueRefresh }

export default queueRefresh
