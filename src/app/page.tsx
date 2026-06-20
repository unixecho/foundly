import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Foundly</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Privacy-first lost item recovery. Tag your things. Get them back.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
        >
          Get started
        </Link>
      </div>
    </main>
  )
}
