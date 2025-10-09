type Subscriber = (chatId: string | null) => void
let current: string | null = null
const subs: Set<Subscriber> = new Set()

export function selectChat(chatId: string | null) {
  current = chatId
  for (const s of subs) s(current)
}

export function subscribeSelectedChat(cb: Subscriber) {
  subs.add(cb)
  cb(current)
  return () => subs.delete(cb)
}
