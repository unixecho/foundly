import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import FinderForm from './FinderForm'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Found something? | Foundly',
    description: 'Help return this item to its owner.',
  }
}

export default async function FoundPage({
  params,
}: {
  params: Promise<{ serial: string }>
}) {
  const { serial } = await params
  const supabase = await createClient()

  const { data: tag } = await supabase
    .from('tags')
    .select(`
      id, serial, status,
      items ( name ),
      users ( first_name, last_name )
    `)
    .eq('serial', serial)
    .eq('status', 'active')
    .single()

  if (!tag) notFound()

  const user = (tag as any).users
  const ownerName = user
    ? `${user.first_name} ${user.last_name?.[0]?.toUpperCase() ?? ''}.`
    : 'someone'
  const itemName = (tag as any).items?.name ?? 'an item'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--paper)' }}>
      <div className="w-full max-w-owner card p-6">
        <div className="text-center mb-6">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
          <h1 style={{ font: "800 22px/1.2 'Plus Jakarta Sans'", letterSpacing: '-.02em', margin: '0 0 8px' }}>
            You found {itemName}
          </h1>
          <p style={{ font: "400 14px/1.55 'Plus Jakarta Sans'", color: 'var(--ink2)', margin: '0 0 8px' }}>
            This belongs to <strong>{ownerName}</strong>. Help return it by sharing your details below.
          </p>
          <p style={{ font: "400 12px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: 0 }}>
            All fields are optional. Your information goes directly to the owner.
          </p>
        </div>
        <FinderForm tagId={tag.id} />
      </div>
    </main>
  )
}
