import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { firstName, lastName } = await request.json().catch(() => ({}))

  const first = typeof firstName === 'string' ? firstName.trim() : ''
  const last = typeof lastName === 'string' ? lastName.trim() : ''

  if (first.length < 2) {
    return NextResponse.json({ error: 'First name must be at least 2 characters.' }, { status: 400 })
  }
  if (!last) {
    return NextResponse.json({ error: 'Please enter your last name.' }, { status: 400 })
  }
  if (first.length > 40 || last.length > 40) {
    return NextResponse.json({ error: 'Name is too long.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ first_name: first, last_name: last })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Could not update your name. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
