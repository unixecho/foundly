import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function VerifyRecoveryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  // Find user with this token
  const { data: user } = await supabase
    .from('users')
    .select('id, first_name, recovery_email, recovery_email_token_exp, recovery_email_verified')
    .eq('recovery_email_token', token)
    .single()

  // Token not found
  if (!user) {
    return <Result
      icon="x"
      title="Link not found"
      body="This verification link is invalid or has already been used."
      cta={{ label: 'Go to Foundly', href: '/' }}
    />
  }

  // Already verified
  if (user.recovery_email_verified) {
    return <Result
      icon="check"
      title="Already confirmed"
      body="This recovery email is already verified."
      cta={{ label: 'Go to settings', href: '/dashboard/settings' }}
    />
  }

  // Expired
  const expired = user.recovery_email_token_exp
    ? new Date(user.recovery_email_token_exp) < new Date()
    : false

  if (expired) {
    return <Result
      icon="clock"
      title="Link expired"
      body="This verification link has expired. Ask the account owner to send a new one from their settings."
      cta={{ label: 'Go to Foundly', href: '/' }}
    />
  }

  // Confirm it
  await supabase
    .from('users')
    .update({
      recovery_email_verified: true,
      recovery_email_token: null,
      recovery_email_token_exp: null,
    })
    .eq('id', user.id)

  return <Result
    icon="check"
    title="Recovery email confirmed"
    body={`This address is now set as the recovery email for ${user.first_name ? user.first_name + "'s" : 'a'} Foundly account. It will only ever be used to recover account access — never shown to finders.`}
    cta={{ label: 'Go to Foundly', href: '/' }}
  />
}

function Result({ icon, title, body, cta }: {
  icon: 'check' | 'x' | 'clock'
  title: string
  body: string
  cta: { label: string; href: string }
}) {
  const iconMap = {
    check: { path: <path d="M20 6 9 17l-5-5"/>, bg: '#e4f0e9', stroke: '#3a8a64' },
    x:     { path: <path d="m15 9-6 6M9 9l6 6"/>, bg: '#fdf2f2', stroke: '#c0392b' },
    clock: { path: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>, bg: '#f6ecd8', stroke: '#c08a2e' },
  }
  const ic = iconMap[icon]

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: '24px' }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ic.stroke} strokeWidth="2">
            {ic.path}
          </svg>
        </div>
        <h1 style={{ font: "800 24px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 12px' }}>{title}</h1>
        <p style={{ font: "400 15px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 28px' }}>{body}</p>
        <Link
          href={cta.href}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'var(--accent)', color: 'var(--on-accent)', font: "600 14px var(--ff)", textDecoration: 'none' }}
        >
          {cta.label}
        </Link>
      </div>
    </main>
  )
}
