import { useEffect, useState } from 'react'

// Simple hook to detect client mount and avoid SSR/CSR markup mismatch
export default function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}
