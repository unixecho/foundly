'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      style={{
        border: '1px solid var(--line2)',
        borderRadius: 10,
        background: 'var(--surface)',
        padding: '6px 14px',
        font: "600 13px 'Plus Jakarta Sans'",
        color: 'var(--ink2)',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity .15s',
      }}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
