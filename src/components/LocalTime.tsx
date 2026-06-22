'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

// Renders a locale-formatted timestamp without causing a hydration mismatch.
// Server (and the first client render) output an empty string, so the markup
// matches; after mount we fill in the viewer's local time. `toLocaleString()`
// depends on the runtime's locale + timezone, which differ between server and
// browser — formatting only on the client is the reliable way to avoid the
// "server rendered text didn't match" error.
export default function LocalTime({
  iso,
  mode = 'datetime',
  className,
  style,
}: {
  iso: string
  mode?: 'datetime' | 'time' | 'date'
  className?: string
  style?: CSSProperties
}) {
  const [text, setText] = useState('')

  useEffect(() => {
    const d = new Date(iso)
    setText(
      mode === 'time'
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : mode === 'date'
          ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
          : d.toLocaleString()
    )
  }, [iso, mode])

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {text}
    </span>
  )
}
