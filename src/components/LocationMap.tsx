// Lightweight location map preview — no API key required.
// Uses the OpenStreetMap embed (an <iframe>) with a marker at the finder's
// coordinates, plus a "Open in maps" link. Renders on both the finder side
// (after capturing location) and the owner's case detail page.
export default function LocationMap({
  lat,
  lng,
  label,
  height = 180,
}: {
  lat: number
  lng: number
  label?: string | null
  height?: number
}) {
  // A small bounding box around the point so the marker sits centered + zoomed in.
  const d = 0.004
  const bbox = [lng - d, lat - d, lng + d, lat + d].join('%2C')
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface2)' }}>
      <iframe
        title="Location preview"
        src={src}
        width="100%"
        height={height}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ display: 'block', border: 0, width: '100%' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style={{ font: "400 12px 'JetBrains Mono'", color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
          </span>
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flexShrink: 0, font: "600 12px var(--ff)", color: 'var(--accent-ink)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Open in maps ↗
        </a>
      </div>
    </div>
  )
}
