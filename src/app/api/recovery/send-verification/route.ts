import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await req.json()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // Don't allow using the same email as primary
  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot use your primary email as recovery email' }, { status: 400 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h

  const { error: dbErr } = await supabase
    .from('users')
    .update({
      recovery_email: email,
      recovery_email_verified: false,
      recovery_email_token: token,
      recovery_email_token_exp: exp,
    })
    .eq('id', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-recovery/${token}`

  const { data: profile } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', user.id)
    .single()

  const { error: emailErr } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Foundly <onboarding@resend.dev>',
    to: email,
    subject: 'Confirm your Foundly recovery email',
    html: `
      <div style="font-family:'Plus Jakarta Sans',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:22px;font-weight:800;margin:0 0 8px">Confirm your recovery email</h2>
        <p style="color:#5b5d66;margin:0 0 24px;line-height:1.6">
          ${profile?.first_name ?? 'Someone'} added this address as their Foundly account recovery email.
          This address is only ever used to help recover their account — it's never shown to finders and never used as a contact channel.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:14px 24px;border-radius:12px;background:#4b4f8c;color:#fff;font-weight:700;font-size:15px;text-decoration:none">
          Confirm recovery email
        </a>
        <p style="color:#8e9099;font-size:12px;margin:24px 0 0;line-height:1.5">
          This link expires in 24 hours. If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    `,
  })

  if (emailErr) {
    console.error('Resend error:', emailErr)
    return NextResponse.json({ error: emailErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
