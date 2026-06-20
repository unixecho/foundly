import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('first_name, last_name, email, recovery_email, notify_email')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-owner mx-auto">
      <h1 style={{ font: "800 27px/1.18 'Plus Jakarta Sans'", letterSpacing: '-.025em', margin: '0 0 24px' }}>Settings</h1>

      {/* Profile */}
      <section className="card p-5 mb-4">
        <h2 style={{ font: "700 16px 'Plus Jakarta Sans'", margin: '0 0 16px' }}>Profile</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 14 }}>
          <dt style={{ color: 'var(--ink3)' }}>Name</dt>
          <dd style={{ margin: 0 }}>{profile?.first_name} {profile?.last_name}</dd>
          <dt style={{ color: 'var(--ink3)' }}>Email</dt>
          <dd style={{ margin: 0 }}>{profile?.email}</dd>
          <dt style={{ color: 'var(--ink3)' }}>Finders see</dt>
          <dd style={{ margin: 0 }}>
            {profile?.first_name} {profile?.last_name?.[0]?.toUpperCase()}.
          </dd>
        </dl>
        <p style={{ font: "400 12px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: '14px 0 0' }}>
          Edit coming soon — contact support to update your name.
        </p>
      </section>

      {/* Security */}
      <section className="card p-5 mb-4">
        <h2 style={{ font: "700 16px 'Plus Jakarta Sans'", margin: '0 0 4px' }}>Security</h2>
        <p style={{ font: "400 13px/1.5 'Plus Jakarta Sans'", color: 'var(--ink2)', margin: '0 0 16px' }}>
          Recovery email is used for account recovery only — never shown to finders.
        </p>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 14 }}>
          <dt style={{ color: 'var(--ink3)' }}>Recovery email</dt>
          <dd style={{ margin: 0 }}>{profile?.recovery_email ?? <em style={{ color: 'var(--ink3)' }}>Not set</em>}</dd>
        </dl>
        <p style={{ font: "400 12px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: '14px 0 0' }}>
          Recovery email editing coming soon.
        </p>
      </section>

      {/* Notifications */}
      <section className="card p-5 mb-4">
        <h2 style={{ font: "700 16px 'Plus Jakarta Sans'", margin: '0 0 4px' }}>Notifications</h2>
        <p style={{ font: "400 13px/1.5 'Plus Jakarta Sans'", color: 'var(--ink2)', margin: '0 0 12px' }}>
          Email notifications when a finder scans one of your tags.
        </p>
        <div className="flex items-center justify-between">
          <span style={{ font: "500 14px 'Plus Jakarta Sans'" }}>Email notifications</span>
          <span className={`chip ${profile?.notify_email ? 'chip-protected' : 'chip-archived'}`}>
            <span className="chip-dot" />
            {profile?.notify_email ? 'On' : 'Off'}
          </span>
        </div>
        <p style={{ font: "400 12px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: '14px 0 0' }}>
          Toggle coming soon.
        </p>
      </section>

      {/* What finders see */}
      <section className="card p-5 mb-4" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-soft2)' }}>
        <h2 style={{ font: "700 16px 'Plus Jakarta Sans'", margin: '0 0 8px', color: 'var(--accent-ink)' }}>What finders can see</h2>
        <ul style={{ font: "400 13px/1.8 'Plus Jakarta Sans'", color: 'var(--accent-ink)', margin: 0, paddingLeft: 18 }}>
          <li>Your first name and last initial only ("{profile?.first_name} {profile?.last_name?.[0]?.toUpperCase()}.")</li>
          <li>The nickname you gave the item</li>
          <li><strong>Nothing else</strong> — no email, phone, address, or location history</li>
        </ul>
      </section>

      {/* Danger zone */}
      <section className="card p-5" style={{ border: '1px solid var(--error-soft2)' }}>
        <h2 style={{ font: "700 16px 'Plus Jakarta Sans'", color: 'var(--error)', margin: '0 0 8px' }}>Delete account</h2>
        <p style={{ font: "400 13px/1.5 'Plus Jakarta Sans'", color: 'var(--ink2)', margin: '0 0 14px' }}>
          Permanently deletes your account, deactivates and retires all your tags. This cannot be undone.
        </p>
        <button
          disabled
          style={{ font: "600 14px 'Plus Jakarta Sans'", color: 'var(--error)', background: 'var(--error-soft)', border: '1px solid var(--error-soft2)', borderRadius: 10, padding: '10px 18px', cursor: 'not-allowed', opacity: 0.6 }}
        >
          Delete my account — coming soon
        </button>
      </section>
    </div>
  )
}
