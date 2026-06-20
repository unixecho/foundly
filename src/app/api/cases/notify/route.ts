import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Supabase database webhook — fires when a new recovery_case is inserted.
 *
 * PRIVACY INVARIANT (from design HANDOFF.md):
 *   Notification emails are content-free re: recovery — no finder message,
 *   no location, no contact info. Single CTA into the authed app only.
 *   Detail lives behind authentication, not in the email.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SUPABASE_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json()
  const record = payload.record // new recovery_case row

  const service = createServiceClient()

  // Fetch owner — only what we need for the email
  const { data: owner } = await service
    .from('users')
    .select('email, first_name, notify_email')
    .eq('id', record.owner_id)
    .single()

  if (!owner || !owner.notify_email) {
    return NextResponse.json({ skipped: 'notifications disabled' })
  }

  // Fetch item name for the subject line (only the name — no finder data)
  const { data: tag } = await service
    .from('tags')
    .select('items(name)')
    .eq('id', record.tag_id)
    .single()

  const itemName = (tag as any)?.items?.name ?? 'one of your items'
  const caseUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/cases/${record.id}`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Foundly <noreply@foundly.app>',
      to: owner.email,
      subject: `Someone found ${itemName}`,
      html: buildContentFreeEmail({
        firstName: owner.first_name,
        itemName,
        caseUrl,
      }),
    }),
  })

  // Log the event
  await service.from('case_events').insert({
    case_id: record.id,
    actor: 'system',
    event_type: 'owner_notified',
  })

  return NextResponse.json({ success: true })
}

/**
 * Content-free email — no finder details, no location, no message.
 * The only action is to open the case in the authenticated app.
 */
function buildContentFreeEmail({
  firstName,
  itemName,
  caseUrl,
}: {
  firstName: string
  itemName: string
  caseUrl: string
}) {
  const name = firstName ? `Hi ${firstName},` : 'Hi,'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Someone found ${itemName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;color:#1c1d22">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(28,29,34,.04)">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 0;border-bottom:1px solid #ebe9e4">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
              <span style="font:700 17px 'Plus Jakarta Sans',Helvetica;color:#4b4f8c">Foundly</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px">
            <p style="font:400 15px/1.6 'Plus Jakarta Sans',Helvetica;color:#1c1d22;margin:0 0 8px">${name}</p>
            <p style="font:700 20px/1.3 'Plus Jakarta Sans',Helvetica;color:#1c1d22;margin:0 0 16px">
              Someone found <em>${itemName}</em>.
            </p>
            <p style="font:400 15px/1.6 'Plus Jakarta Sans',Helvetica;color:#5b5d66;margin:0 0 28px">
              A finder has submitted a recovery report. Open the case in Foundly to see their contact information and next steps.
            </p>
            <a href="${caseUrl}"
               style="display:inline-block;background:#4b4f8c;color:#ffffff;font:600 15px 'Plus Jakarta Sans',Helvetica;text-decoration:none;padding:14px 28px;border-radius:14px;box-shadow:0 6px 16px rgba(75,79,140,.3)">
              View recovery case →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #ebe9e4">
            <p style="font:400 12px/1.5 'Plus Jakarta Sans',Helvetica;color:#8e9099;margin:0">
              This notification was sent because your Foundly tag was scanned.
              You can manage notification settings in your
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" style="color:#4b4f8c;text-decoration:none">account settings</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
