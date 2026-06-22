import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RecoveryEmailSection from './RecoveryEmailSection'
import ProfileSection from './ProfileSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('first_name, last_name, email, recovery_email, recovery_email_verified, notify_email')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-owner mx-auto">
      <h1 style={{ font: "800 27px/1.18 var(--ff)", letterSpacing: '-.025em', margin: '0 0 24px' }}>Settings</h1>

      {/* Profile */}
      <ProfileSection
        firstName={profile?.first_name ?? ''}
        lastName={profile?.last_name ?? ''}
        email={profile?.email ?? ''}
      />

      {/* Recovery email */}
      <RecoveryEmailSection
        currentEmail={profile?.recovery_email ?? null}
        verified={profile?.recovery_email_verified ?? false}
      />

      {/* What finders see */}
      <section className="card p-5 mb-4" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-soft2)' }}>
        <h2 style={{ font: "700 16px var(--ff)", margin: '0 0 10px', color: 'var(--accent-ink)' }}>What finders can see</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['Your first name & last initial', `${profile?.first_name ?? ''} ${(profile?.last_name ?? '')[0]?.toUpperCase() ?? ''}.`],
            ['Your email or phone number', 'Never'],
            ['Your full name or address', 'Never'],
            ['Your location or other items', 'Never'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', font: "400 13px var(--ff)", color: 'var(--accent-ink)' }}>
              <span>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
        <p style={{ font: "400 12px/1.5 var(--ff)", color: 'var(--accent-ink)', opacity: 0.7, margin: '12px 0 0' }}>
          Finders never create an account — they simply reach you through an anonymous relay.
        </p>
      </section>

      {/* Notifications */}
      <section className="card p-5 mb-4">
        <h2 style={{ font: "700 16px var(--ff)", margin: '0 0 4px' }}>Notifications</h2>
        <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--ink2)', margin: '0 0 12px' }}>
          Email notifications when a finder scans one of your tags.
        </p>
        <div className="flex items-center justify-between">
          <span style={{ font: "500 14px var(--ff)" }}>Email notifications</span>
          <span className={`chip ${profile?.notify_email ? 'chip-protected' : 'chip-archived'}`}>
            <span className="chip-dot" />
            {profile?.notify_email ? 'On' : 'Off'}
          </span>
        </div>
        <p style={{ font: "400 12px var(--ff)", color: 'var(--ink3)', margin: '14px 0 0' }}>
          Toggle coming soon.
        </p>
      </section>

      {/* Danger zone */}
      <section className="card p-5" style={{ border: '1px solid var(--error-soft2)' }}>
        <h2 style={{ font: "700 16px var(--ff)", color: 'var(--error)', margin: '0 0 8px' }}>Delete account</h2>
        <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--ink2)', margin: '0 0 14px' }}>
          Permanently deletes your account, deactivates and retires all your tags. This cannot be undone.
        </p>
        <button
          disabled
          style={{ font: "600 14px var(--ff)", color: 'var(--error)', background: 'var(--error-soft)', border: '1px solid var(--error-soft2)', borderRadius: 10, padding: '10px 18px', cursor: 'not-allowed', opacity: 0.6 }}
        >
          Delete my account — coming soon
        </button>
      </section>
    </div>
  )
}
