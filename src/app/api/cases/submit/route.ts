import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

// Public — no auth. Finders never have accounts.
// Uses service role to bypass RLS for both anon and authenticated callers.
//
// IDEMPOTENT: one active case per tag. The finder may contribute several times
// in one session (location, then contact, then a chat request). The first call
// creates the case AND notifies the owner once; later calls merge new details
// into the SAME case and never re-notify — the owner isn't spammed.
export async function POST(req: Request) {
  const body = await req.json()
  const { tagId, finderName, finderEmail, finderPhone, finderMessage, lat, lng, locationLabel } = body

  if (!tagId) return NextResponse.json({ error: 'Missing tagId' }, { status: 400 })

  const service = createServiceClient()

  const { data: tag } = await service
    .from('tags')
    .select('owner_id, status, items(name)')
    .eq('id', tagId)
    .single()

  if (!tag || tag.status !== 'active') {
    return NextResponse.json({ error: 'Tag not found or inactive' }, { status: 404 })
  }

  // Is there already an active case for this tag?
  const { data: existing } = await service
    .from('recovery_cases')
    .select('id')
    .eq('tag_id', tagId)
    .in('status', ['open', 'in_progress'])
    .maybeSingle()

  // ── EXISTING CASE — merge new details, log message, DO NOT re-notify ──────────
  if (existing) {
    const patch: Record<string, unknown> = {}
    if (finderName) patch.finder_name = finderName
    if (finderEmail) patch.finder_email = finderEmail
    if (finderPhone) patch.finder_phone = finderPhone
    if (lat != null) patch.finder_location_lat = lat
    if (lng != null) patch.finder_location_lng = lng
    if (locationLabel) patch.finder_location_label = locationLabel

    if (Object.keys(patch).length > 0) {
      await service.from('recovery_cases').update(patch).eq('id', existing.id)
    }

    if (finderMessage) {
      await service.from('case_events').insert({
        case_id: existing.id,
        actor: 'finder',
        event_type: 'finder_message',
        payload: { message: finderMessage },
      })
    }

    return NextResponse.json({ ok: true, caseId: existing.id })
  }

  // ── NEW CASE — create + notify owner once ────────────────────────────────────
  const { data: newCase, error } = await service
    .from('recovery_cases')
    .insert({
      tag_id: tagId,
      owner_id: tag.owner_id,
      finder_name: finderName || null,
      finder_email: finderEmail || null,
      finder_phone: finderPhone || null,
      finder_message: finderMessage || null,
      finder_location_lat: lat ?? null,
      finder_location_lng: lng ?? null,
      finder_location_label: locationLabel || null,
    })
    .select('id')
    .single()

  if (error) {
    // Race: a case was created between our check and insert — treat as existing.
    if (error.code === '23505') {
      const { data: raced } = await service
        .from('recovery_cases')
        .select('id')
        .eq('tag_id', tagId)
        .in('status', ['open', 'in_progress'])
        .single()
      if (finderMessage && raced) {
        await service.from('case_events').insert({
          case_id: raced.id, actor: 'finder', event_type: 'finder_message', payload: { message: finderMessage },
        })
      }
      return NextResponse.json({ ok: true, caseId: raced?.id ?? null })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const caseId = newCase.id

  // Log finder message as chat event so it appears in the thread
  if (finderMessage) {
    await service.from('case_events').insert({
      case_id: caseId,
      actor: 'finder',
      event_type: 'finder_message',
      payload: { message: finderMessage },
    })
  }

  // Notify owner via email (content-free — no finder details in the email)
  const { data: owner } = await service
    .from('users')
    .select('email, first_name, notify_email')
    .eq('id', tag.owner_id)
    .single()

  const itemName = (tag as any).items?.name ?? 'one of your items'

  if (owner?.notify_email) {
    const caseUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/cases/${caseId}`
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'Foundly <onboarding@resend.dev>',
      to: owner.email,
      subject: `Someone found ${itemName}`,
      html: `
        <div style="font-family:'Plus Jakarta Sans',Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f4f2">
          <div style="background:#fff;border-radius:18px;padding:32px;box-shadow:0 1px 2px rgba(28,29,34,.04)">
            <p style="font:700 17px sans-serif;color:#4b4f8c;margin:0 0 20px">Foundly</p>
            <p style="font:400 15px/1.6 sans-serif;color:#1c1d22;margin:0 0 6px">Hi ${owner.first_name ?? ''},</p>
            <p style="font:700 20px/1.3 sans-serif;color:#1c1d22;margin:0 0 16px">Someone found <em>${itemName}</em>.</p>
            <p style="font:400 15px/1.6 sans-serif;color:#5b5d66;margin:0 0 28px">
              A finder has submitted a recovery report. Open the case to see their details and respond.
            </p>
            <a href="${caseUrl}" style="display:inline-block;background:#4b4f8c;color:#fff;font:600 15px sans-serif;text-decoration:none;padding:14px 28px;border-radius:14px">
              View recovery case →
            </a>
            <p style="font:400 12px/1.5 sans-serif;color:#8e9099;margin:24px 0 0">
              No finder details are included in this email — they're only visible inside your secure dashboard.
            </p>
          </div>
        </div>
      `,
    })

    await service.from('case_events').insert({
      case_id: caseId,
      actor: 'system',
      event_type: 'owner_notified',
    })
  }

  return NextResponse.json({ ok: true, caseId })
}
