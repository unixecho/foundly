import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg">Foundly</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard/items" className="text-gray-600 hover:text-black">Items</Link>
          <Link href="/dashboard/tags" className="text-gray-600 hover:text-black">Tags</Link>
          <Link href="/dashboard/cases" className="text-gray-600 hover:text-black">Cases</Link>
          <Link href="/dashboard/settings" className="text-gray-600 hover:text-black">Settings</Link>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
