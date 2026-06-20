import { redirect } from 'next/navigation'

/**
 * Legacy route — QR codes printed before the redesign pointed here.
 * Redirects to the new activation flow with the token as a query param.
 */
export default async function LegacyActivatePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/activate?code=${token}`)
}
