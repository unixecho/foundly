import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { tagId, itemId, activationToken } = await req.json()

  if (!tagId || !itemId || !activationToken) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Verify the requesting user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Verify the item belongs to this user
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('owner_id', user.id)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 })
  }

  // Use service role to activate (bypasses RLS on activation_token)
  const service = createServiceClient()

  const { data: tag, error } = await service
    .from('tags')
    .update({
      item_id: itemId,
      owner_id: user.id,
      status: 'active',
      activation_token: null,  // consume the token
      activated_at: new Date().toISOString(),
    })
    .eq('id', tagId)
    .eq('activation_token', activationToken)  // double-check token matches
    .eq('status', 'unactivated')
    .select('id')
    .single()

  if (error || !tag) {
    return NextResponse.json(
      { error: 'Activation failed. Token may have already been used.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ success: true, tagId: tag.id })
}
