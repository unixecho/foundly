import { createClient } from '@/lib/supabase/server'
import type { RecoveryCaseWithTag } from '@/types/database'
import Link from 'next/link'

export default async function CasesPage() {
  const supabase = await createClient()

  const { data: cases } = await supabase
    .from('recovery_cases')
    .select(`
      *,
      tags (
        serial, status,
        items ( name, photo_url )
      )
    `)
    .order('opened_at', { ascending: false })

  const open = cases?.filter(c => c.status === 'open' || c.status === 'in_progress') ?? []
  const closed = cases?.filter(c => c.status === 'resolved' || c.status === 'archived') ?? []

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Recovery Cases</h1>

      {open.length === 0 && closed.length === 0 && (
        <p className="text-gray-500">No recovery cases yet. Cases are created when someone scans one of your tags.</p>
      )}

      {open.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase text-gray-400 mb-3">Active</h2>
          <div className="flex flex-col gap-3">
            {open.map(c => <CaseRow key={c.id} c={c as RecoveryCaseWithTag} />)}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-gray-400 mb-3">Resolved</h2>
          <div className="flex flex-col gap-3 opacity-60">
            {closed.map(c => <CaseRow key={c.id} c={c as RecoveryCaseWithTag} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function CaseRow({ c }: { c: RecoveryCaseWithTag }) {
  const itemName = c.tags?.items?.name ?? 'Unknown item'
  const chipClass: Record<string, string> = {
    open: 'chip chip-open',
    in_progress: 'chip chip-in-progress',
    resolved: 'chip chip-resolved',
    archived: 'chip chip-archived',
  }

  return (
    <Link
      href={`/dashboard/cases/${c.id}`}
      className="border rounded-lg p-4 flex items-center justify-between hover:shadow-sm transition"
    >
      <div>
        <p className="font-medium">{itemName}</p>
        <p className="text-sm text-gray-500">
          Tag: {c.tags?.serial} · {new Date(c.opened_at).toLocaleDateString()}
        </p>
      </div>
      <span className={chipClass[c.status] ?? 'chip'}>
        <span className="chip-dot" />
        {c.status.replace('_', ' ')}
      </span>
    </Link>
  )
}
