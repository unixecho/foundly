import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('users')
    .update({
      recovery_email: null,
      recovery_email_verified: false,
      recovery_email_token: null,
      recovery_email_token_exp: null,
    })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
