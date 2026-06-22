import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { count: openCases } = await supabase
    .from('recovery_cases')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .in('status', ['open', 'in_progress'])

  const badge = openCases && openCases > 0 ? openCases : null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" style={{ font: "700 17px var(--ff)", color: 'var(--ink)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Foundly
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { href: '/dashboard/items', label: 'Items' },
            { href: '/dashboard/tags', label: 'Tags' },
            { href: '/dashboard/cases', label: 'Cases', badge },
            { href: '/dashboard/settings', label: 'Settings' },
          ].map(({ href, label, badge }) => (
            <Link
              key={href}
              href={href}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, font: "500 13px var(--ff)", color: 'var(--ink2)', textDecoration: 'none' }}
            >
              {label}
              {badge && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#c08a2e', color: '#fff', font: "700 10px var(--ff)" }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
