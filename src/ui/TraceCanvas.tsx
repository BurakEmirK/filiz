import { useEffect, useRef, useState } from 'react'

// Harf yazma alanı: soluk bir model harfin üzerine Apple Pencil veya parmakla yazılır.
// Kalem basıncı çizgi kalınlığına yansır. Bu bir el yazısı TANIMA değildir; sen model harfle karşılaştırırsın.

export function TraceCanvas({ guide, lang }: { guide: string; lang: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [strokes, setStrokes] = useState(0)
  const [pen, setPen] = useState(false)

  const paintGuide = () => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = c.clientHeight
    c.width = w * dpr
    c.height = h * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(120,110,100,0.25)'
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(0, h * 0.72)
    ctx.lineTo(w, h * 0.72)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(120,110,100,0.22)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `600 ${Math.round(h * 0.62)}px -apple-system, "Segoe UI", sans-serif`
    ctx.fillText(guide, w / 2, h * 0.72)
  }

  useEffect(() => {
    paintGuide()
    const onResize = () => paintGuide()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide])

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    ref.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
    if (e.pointerType === 'pen') setPen(true)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const ctx = ref.current!.getContext('2d')!
    const p = pos(e)
    const pressure = e.pointerType === 'pen' ? Math.max(0.15, e.pressure || 0.5) : 0.5
    ctx.strokeStyle = '#3b342c'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3 + pressure * 7
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }
  const up = () => {
    if (drawing.current) setStrokes((n) => n + 1)
    drawing.current = false
    last.current = null
  }

  return (
    <div className="stack">
      <div className="trace">
        <canvas
          ref={ref}
          lang={lang}
          role="img"
          aria-label={`${guide} harfini yazma alanı`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
      </div>
      <div className="spread">
        <span className="tiny muted">
          {pen ? 'Apple Pencil algılandı (basınç çizgi kalınlığına yansıyor).' : 'Parmakla veya Apple Pencil ile yaz.'} Yazı tanınmaz; model harfle kendin karşılaştır.
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => {
            paintGuide()
            setStrokes(0)
          }}
          disabled={strokes === 0}
        >
          Temizle
        </button>
      </div>
    </div>
  )
}
