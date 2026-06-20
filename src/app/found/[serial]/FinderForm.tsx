'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'form' | 'success'

export default function FinderForm({ tagId }: { tagId: string }) {
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareLocation, setShareLocation] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  const supabase = createClient()

  async function requestLocation() {
    setShareLocation(true)
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
      },
      () => {
        // User denied or error — continue without location
      }
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Look up the tag to get owner_id
    const { data: tag } = await supabase
      .from('tags')
      .select('owner_id')
      .eq('id', tagId)
      .single()

    if (!tag) {
      setError('Tag not found.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('recovery_cases').insert({
      tag_id: tagId,
      owner_id: tag.owner_id,
      finder_name: name || null,
      finder_email: email || null,
      finder_phone: phone || null,
      finder_message: message || null,
      finder_location_lat: lat,
      finder_location_lng: lng,
    })

    setLoading(false)

    if (insertError) {
      // A unique index violation means a case is already open for this tag
      if (insertError.code === '23505') {
        setError('A recovery case is already open for this item.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } else {
      setStep('success')
    }
  }

  if (step === 'success') {
    return (
      <div className="text-center py-4">
        <div className="text-3xl mb-3">✅</div>
        <h2 className="font-semibold text-lg">Thanks for helping!</h2>
        <p className="text-gray-500 text-sm mt-1">
          The owner has been notified. You&apos;re a good person.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Your name (optional)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <input
        type="email"
        placeholder="Your email (optional)"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <input
        type="tel"
        placeholder="Your phone (optional)"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        className="border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <textarea
        placeholder="Message to owner (optional)"
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={3}
        className="border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
      />

      {!shareLocation ? (
        <button
          type="button"
          onClick={requestLocation}
          className="text-sm text-blue-600 underline text-left"
        >
          📍 Share my current location
        </button>
      ) : (
        <p className="text-xs text-gray-400">
          {lat ? `📍 Location captured (${lat.toFixed(4)}, ${lng?.toFixed(4)})` : '📍 Location access requested…'}
        </p>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50 mt-1"
      >
        {loading ? 'Sending…' : 'Notify owner'}
      </button>
    </form>
  )
}
