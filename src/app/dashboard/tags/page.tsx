import { createClient } from '@/lib/supabase/server'

export default async function TagsPage() {
  const supabase = await createClient()

  const { data: tags } = await supabase
    .from('tags')
    .select(`
      *,
      items ( name )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-owner mx-auto">
      <h1 style={{ font: "800 27px/1.18 var(--ff)", letterSpacing: '-.025em', margin: '0 0 24px' }}>Tags</h1>

      {(!tags || tags.length === 0) ? (
        <div className="card p-8 text-center">
          <p style={{ font: "700 16px var(--ff)", margin: '0 0 6px' }}>No tags yet</p>
          <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink2)', margin: 0 }}>
            Tags appear here once activated.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tags.map((tag) => {
            const itemName = (tag as any).items?.name
            return (
              <div key={tag.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p style={{ font: "600 13px 'JetBrains Mono'", margin: '0 0 3px', letterSpacing: '.04em' }}>{tag.serial}</p>
                  <p style={{ font: "400 13px var(--ff)", color: 'var(--ink3)', margin: 0 }}>
                    {itemName ?? 'Not linked to an item'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`chip ${tag.status === 'active' ? 'chip-protected' : tag.status === 'deactivated' ? 'chip-archived' : 'chip-open'}`}>
                    <span className="chip-dot" />
                    {tag.status === 'active' ? 'Active' : tag.status === 'deactivated' ? 'Deactivated' : 'Unactivated'}
                  </span>
                  {tag.status === 'active' && (
                    <DeactivateButton tagId={tag.id} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Inline client component for deactivate action
function DeactivateButton({ tagId }: { tagId: string }) {
  // TODO: wire up — needs 'use client' + server action or API route
  return (
    <button
      style={{ font: "500 12px var(--ff)", color: 'var(--ink3)', background: 'none', border: '1px solid var(--line2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
      disabled
      title="Coming soon"
    >
      Deactivate
    </button>
  )
}
