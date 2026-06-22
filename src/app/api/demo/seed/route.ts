import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DEMO_SERIAL = 'FN-DEMO'
const DEMO_ITEM_NAME = 'Demo Item (Travel Backpack)'

// ─────────────────────────────────────────────────────────────────────────────
// DEMO SEED ROUTE — only available when NEXT_PUBLIC_DEMO_MODE=true
// Uses service role to bypass RLS for tag insertion.
// Idempotent — safe to call multiple times.
//
// TO GO LIVE: Set NEXT_PUBLIC_DEMO_MODE=false. This route will reject all calls.
//             Provision real tags via your admin tool instead.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Demo mode is disabled' }, { status: 403 })
  }

  // Auth check via regular client (needs session cookies)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // All DB writes use service client to bypass RLS
  const service = createServiceClient()

  // Check if demo tag already exists for this user — fully seeded
  const { data: existingTag } = await service
    .from('tags')
    .select('id')
    .eq('serial', DEMO_SERIAL)
    .eq('owner_id', user.id)
    .single()

  if (existingTag) {
    return NextResponse.json({ ok: true, serial: DEMO_SERIAL, alreadyExists: true })
  }

  // Clean up any orphaned demo items from previous failed seeds
  await service
    .from('items')
    .delete()
    .eq('owner_id', user.id)
    .eq('name', DEMO_ITEM_NAME)

  // Create demo item
  const { data: item, error: itemErr } = await service
    .from('items')
    .insert({ owner_id: user.id, name: DEMO_ITEM_NAME })
    .select('id')
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: itemErr?.message ?? 'Failed to create item' }, { status: 500 })
  }

  // Create demo tag — skip activation_token, already "active" for demo
  const { error: tagErr } = await service
    .from('tags')
    .upsert({
      serial: DEMO_SERIAL,
      item_id: item.id,
      owner_id: user.id,
      status: 'active',
      activated_at: new Date().toISOString(),
    }, { onConflict: 'serial' })

  if (tagErr) {
    return NextResponse.json({ error: tagErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, serial: DEMO_SERIAL })
}
