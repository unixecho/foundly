import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Rename an item (owner only). RLS scopes the update to the owner's own rows.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await request.json().catch(() => ({}))
  const trimmed = typeof name === 'string' ? name.trim() : ''

  if (trimmed.length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 })
  }
  if (trimmed.length > 60) {
    return NextResponse.json({ error: 'Name is too long.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('items')
    .update({ name: trimmed })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Could not rename this item. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, name: trimmed })
}
