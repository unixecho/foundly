import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ count: openCases }, { count: totalItems }, { count: activeTags }] = await Promise.all([
    supabase
      .from('recovery_cases')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('tags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Open cases" value={openCases ?? 0} href="/dashboard/cases" urgent={!!openCases} />
        <StatCard label="Items" value={totalItems ?? 0} href="/dashboard/items" />
        <StatCard label="Active tags" value={activeTags ?? 0} href="/dashboard/tags" />
      </div>

      {(openCases ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 font-medium">
            You have {openCases} open recovery {openCases === 1 ? 'case' : 'cases'}.
          </p>
          <Link href="/dashboard/cases" className="text-amber-700 underline text-sm">
            View cases →
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  href,
  urgent,
}: {
  label: string
  value: number
  href: string
  urgent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-4 hover:shadow-sm transition ${urgent ? 'border-amber-300 bg-amber-50' : ''}`}
    >
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </Link>
  )
}
