"use client"

import { useEffect, useRef, useState } from 'react'
import supabase from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

function initialsFrom(s: string | null | undefined, fallback = '') {
  const str = (s || fallback || '').trim()
  if (!str) return ''
  const parts = str.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // editable fields
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [placeOfBirth, setPlaceOfBirth] = useState('')
  const [dob, setDob] = useState('')
  const [tob, setTob] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string | null>(null)

  // keep original values so Cancel can restore
  const original = useRef<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) {
        router.push('/login')
        return
      }
      setUser(data.user)

      // Try to load a saved profile row. If none exists, fall back to auth user metadata.
      try {
        const { data: profile } = await supabase.from('profiles').select('full_name, place_of_birth, dob, tob, avatar_url').eq('id', data.user.id).single()
        const meta = data.user.user_metadata || {}
        const metaName = meta.full_name || meta.name || ''

        const loaded = {
          full_name: profile?.full_name ?? metaName ?? '',
          place_of_birth: profile?.place_of_birth ?? '',
          dob: profile?.dob ?? '',
          tob: profile?.tob ?? '',
          avatar_url: profile?.avatar_url ?? null,
        }

        setFullName(loaded.full_name)
        setPlaceOfBirth(loaded.place_of_birth)
        setDob(loaded.dob)
        setTob(loaded.tob)
        setAvatarUrl(loaded.avatar_url)
        original.current = loaded
      } catch (e) {
        // profiles table might not exist yet; fall back to metadata
        const meta = data.user.user_metadata || {}
        const metaName = meta.full_name || meta.name || ''
        const loaded = { full_name: metaName, place_of_birth: '', dob: '', tob: '', avatar_url: null }
        setFullName(loaded.full_name)
        setPlaceOfBirth('')
        setDob('')
        setTob('')
        setAvatarUrl(null)
        original.current = loaded
      }

      setLoading(false)
    }

    load()
  }, [router])

  const handleEdit = () => {
    setErrors(null)
    setMessage(null)
    setEditing(true)
  }

  const handleCancel = () => {
    setErrors(null)
    setMessage(null)
    if (original.current) {
      setFullName(original.current.full_name || '')
      setPlaceOfBirth(original.current.place_of_birth || '')
      setDob(original.current.dob || '')
      setTob(original.current.tob || '')
      setAvatarUrl(original.current.avatar_url || null)
    }
    setEditing(false)
  }

  const validate = () => {
    const missing: string[] = []
    if (!fullName.trim()) missing.push('Full name')
    if (!placeOfBirth.trim()) missing.push('Place of birth')
    if (!dob) missing.push('Date of birth')
    if (!tob) missing.push('Time of birth')
    if (missing.length) {
      setErrors(`Please provide: ${missing.join(', ')}`)
      return false
    }
    setErrors(null)
    return true
  }

  const handleFile = async (file?: File) => {
    if (!file || !user) return null
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) {
        console.warn('Avatar upload error', uploadError)
        setMessage(`Avatar upload failed: ${uploadError.message}`)
        return null
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = (urlData as any)?.publicUrl || null
      return publicUrl
    } catch (err) {
      console.warn('Unexpected avatar upload error', err)
      setMessage('Failed to upload avatar')
      return null
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user) return
    setMessage(null)

    if (!validate()) return

    try {
      const payload: any = {
        id: user.id,
        full_name: fullName,
        place_of_birth: placeOfBirth,
        dob,
        tob,
        updated_at: new Date(),
      }
      if (avatarUrl) payload.avatar_url = avatarUrl

      const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
      if (error) {
        console.warn('Supabase upsert error:', error)
        setMessage(`Failed to save profile: ${error.message}`)
      } else {
        setMessage('Profile saved')
        original.current = { full_name: fullName, place_of_birth: placeOfBirth, dob, tob, avatar_url: avatarUrl }
        setEditing(false)
      }
    } catch (err) {
      console.warn('Unexpected error saving profile:', err)
      setMessage('Failed to save profile (unexpected error)')
    }
  }

  if (loading) return <div className="p-6">Loading
6</div>

  const initials = initialsFrom(fullName || user?.email || '')

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl karmic-gradient font-semibold mb-4">Your profile</h1>
      <div className="hero-card bg-white/3 p-6 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-20 h-20 object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium">{fullName || user?.email}</h2>
              {!editing && (
                <button onClick={handleEdit} className="karmic-btn karmic-btn--small">Edit</button>
              )}
            </div>
            <div className="text-sm text-gray-300">Update your profile details for better astrologer context.</div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block text-sm">Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-black/20"
              placeholder="Enter your full name"
              disabled={!editing}
            />
          </label>

          <label className="block text-sm">Place of birth
            <input
              value={placeOfBirth}
              onChange={(e) => setPlaceOfBirth(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-black/20"
              placeholder="City, Country"
              disabled={!editing}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Date of birth
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full mt-1 p-2 rounded bg-black/20" disabled={!editing} />
            </label>
            <label className="block text-sm">Time of birth
              <input type="time" value={tob} onChange={(e) => setTob(e.target.value)} className="w-full mt-1 p-2 rounded bg-black/20" disabled={!editing} />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">Profile picture
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setMessage('Uploading avatar...')
                  const publicUrl = await handleFile(file)
                  if (publicUrl) {
                    setAvatarUrl(publicUrl)
                    setMessage('Avatar uploaded')
                  }
                }}
                disabled={!editing}
                className="block mt-1"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {editing ? (
              <>
                <button type="button" onClick={handleCancel} className="karmic-btn karmic-btn--ghost">Cancel</button>
                <button type="submit" className="karmic-btn karmic-btn--large">Save profile</button>
              </>
            ) : null}
          </div>
        </form>

        {errors && <div className="mt-3 text-sm text-red-400">{errors}</div>}
        {message && <div className="mt-3 text-sm text-gray-300">{message}</div>}
      </div>
    </div>
  )
}
