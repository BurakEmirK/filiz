import type { ReactNode } from 'react'

// Özgün, basit illüstrasyonlar. Her çizim YALNIZCA bağlı olduğu anlamı gösterir
// (ör. "pattern" için kalıp ve desen ayrı çizimlerdir). Sabit renk paleti; açık bir zemin üzerinde durur.

const P = {
  ink: '#3b342c', red: '#d5573b', green: '#5c9a5b', leaf: '#7fb069', blue: '#5b8fc7', sky: '#a9cbe8', cream: '#fbf3e4',
  wheat: '#d9a35b', brown: '#9a6a43', grey: '#a7a29a', paper: '#ffffff', yellow: '#f2c14e', pink: '#e9a2a0', teal: '#4f9d9a', dark: '#5a524a',
}
const S = { stroke: P.ink, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const person = (x: number, color: string, wave = false) => (
  <g>
    <circle cx={x} cy={44} r={10} fill={P.cream} {...S} />
    <path d={`M${x - 14} 96c0-18 6-30 14-30s14 12 14 30z`} fill={color} {...S} />
    {wave ? <path d={`M${x + 12} 72l12-18`} {...S} /> : null}
  </g>
)

const truck = (x = 18, y = 62) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="0" y="0" width="50" height="30" rx="4" fill={P.blue} {...S} />
    <path d="M50 10h16l10 12v8H50z" fill={P.sky} {...S} />
    <circle cx="14" cy="34" r="6" fill={P.dark} {...S} />
    <circle cx="62" cy="34" r="6" fill={P.dark} {...S} />
  </g>
)

const cloth = (fill = P.teal) => (
  <g>
    <path d="M22 40h76v52H22z" fill={fill} {...S} />
    <path d="M22 40c10-8 66-8 76 0" fill="none" {...S} />
    <path d="M30 52h60M30 64h60M30 76h60" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" />
  </g>
)

const ART: Record<string, ReactNode> = {
  apple: (<g><path d="M60 36c-12-8-34-4-34 22 0 22 16 38 26 38 4 0 6-2 8-2s4 2 8 2c10 0 26-16 26-38 0-26-22-30-34-22z" fill={P.red} {...S} /><path d="M60 36c0-8 2-14 6-18" {...S} /><path d="M66 24c8-6 16-4 18 0-6 6-14 6-18 0z" fill={P.leaf} {...S} /></g>),
  water: (<g><path d="M38 26h44l-6 70H44z" fill="#ffffff" {...S} /><path d="M41 52h38l-4 42H45z" fill={P.sky} /><path d="M38 26h44l-6 70H44z" fill="none" {...S} /><path d="M50 62c4 3 8 3 12 0" stroke="#ffffff" strokeWidth="2.5" fill="none" /></g>),
  bread: (<g><path d="M20 70c0-20 18-32 40-32s40 12 40 32v14H20z" fill={P.wheat} {...S} /><path d="M38 50l-6 12M56 46l-4 14M74 48l-4 12" {...S} /></g>),
  milk: (<g><path d="M48 18h24v12l8 12v54H40V42l8-12z" fill="#ffffff" {...S} /><path d="M40 58h40v22H40z" fill={P.sky} /><path d="M48 18h24v12l8 12v54H40V42l8-12z" fill="none" {...S} /><path d="M50 66c4 4 16 4 20 0" stroke={P.blue} strokeWidth="2.5" fill="none" /></g>),
  book: (<g><path d="M60 34c-10-6-26-8-38-6v58c12-2 28 0 38 6z" fill={P.blue} {...S} /><path d="M60 34c10-6 26-8 38-6v58c-12-2-28 0-38 6z" fill={P.sky} {...S} /><path d="M30 44h20M30 54h20M70 44h20M70 54h20" stroke="#ffffff" strokeWidth="2.5" /></g>),
  house: (<g><path d="M26 56l34-28 34 28" fill="none" {...S} /><path d="M32 52h56v42H32z" fill={P.cream} {...S} /><path d="M26 56l34-28 34 28z" fill={P.red} {...S} /><path d="M52 94V72h16v22" fill={P.brown} {...S} /><path d="M38 62h10v10H38zM72 62h10v10H72z" fill={P.sky} {...S} /></g>),
  cat: (<g><path d="M40 96c-4-20 2-38 20-38s24 18 20 38z" fill={P.grey} {...S} /><path d="M42 46l2-18 12 10h8l12-10 2 18c4 14-8 22-18 22s-22-8-18-22z" fill={P.grey} {...S} /><circle cx="53" cy="50" r="2.5" fill={P.ink} /><circle cx="67" cy="50" r="2.5" fill={P.ink} /><path d="M57 58c2 2 4 2 6 0M42 56h-8M42 60l-8 2M78 56h8M78 60l8 2" {...S} /><path d="M80 90c10 0 14-8 12-16" {...S} /></g>),
  dog: (<g><path d="M40 96c-4-18 4-32 20-32s24 14 20 32z" fill={P.wheat} {...S} /><path d="M42 40c0-10 8-16 18-16s18 6 18 16v14c0 10-8 16-18 16s-18-6-18-16z" fill={P.wheat} {...S} /><path d="M42 36c-10 0-12 18-6 22l6-4zM78 36c10 0 12 18 6 22l-6-4z" fill={P.brown} {...S} /><circle cx="53" cy="46" r="2.5" fill={P.ink} /><circle cx="67" cy="46" r="2.5" fill={P.ink} /><path d="M56 56h8l-4 4z" fill={P.ink} {...S} /></g>),
  hello: (<g>{person(40, P.blue, true)}{person(82, P.green, true)}<path d="M56 22h22a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6h-12l-6 6v-6h-4a6 6 0 0 1-6-6v-6a6 6 0 0 1 6-6z" fill="#ffffff" {...S} /><path d="M62 31h10" {...S} /></g>),
  thanks: (<g>{person(34, P.blue)}{person(86, P.green)}<rect x="50" y="64" width="20" height="16" rx="2" fill={P.yellow} {...S} /><path d="M60 64v16M50 72h20" {...S} /><path d="M86 34c-3-6-12-3-9 4l9 8 9-8c3-7-6-10-9-4z" fill={P.red} {...S} /></g>),
  reserve: (<g><rect x="22" y="26" width="56" height="50" rx="6" fill="#ffffff" {...S} /><path d="M22 40h56M34 20v12M66 20v12" {...S} /><path d="M38 56l6 6 12-12" stroke={P.green} strokeWidth="4" strokeLinecap="round" fill="none" /><path d="M72 84h34M78 84v14M100 84v14" {...S} /><path d="M70 84h38v-6H70z" fill={P.brown} {...S} /></g>),
  marriage: (<g><circle cx="48" cy="64" r="20" fill="none" stroke={P.wheat} strokeWidth="7" /><circle cx="72" cy="64" r="20" fill="none" stroke={P.yellow} strokeWidth="7" /><path d="M60 26l4 6-4 6-4-6z" fill={P.sky} {...S} /></g>),
  fabric: (<g><path d="M20 78h80v16H20z" fill={P.teal} {...S} /><path d="M24 62h72v16H24z" fill={P.pink} {...S} /><path d="M28 46h64v16H28z" fill={P.wheat} {...S} /><path d="M20 86h80M24 70h72M28 54h64" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" /></g>),
  cotton: (<g><path d="M60 98V66" stroke={P.brown} strokeWidth="4" strokeLinecap="round" /><path d="M40 70l20-6 20 6-8 8H48z" fill={P.brown} {...S} /><circle cx="48" cy="52" r="14" fill="#ffffff" {...S} /><circle cx="72" cy="52" r="14" fill="#ffffff" {...S} /><circle cx="60" cy="38" r="15" fill="#ffffff" {...S} /></g>),
  yarn: (<g><path d="M40 24h40v8H40zM40 88h40v8H40z" fill={P.brown} {...S} /><path d="M46 32h28v56H46z" fill={P.red} {...S} /><path d="M46 40h28M46 48h28M46 56h28M46 64h28M46 72h28M46 80h28" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" /><path d="M74 60c14 4 20 14 22 30" stroke={P.red} strokeWidth="3" fill="none" strokeLinecap="round" /></g>),
  cutting: (<g>{cloth(P.sky)}<path d="M22 66h76" stroke={P.ink} strokeWidth="2.5" strokeDasharray="6 5" /><g transform="translate(64 66) rotate(-10)"><circle cx="-26" cy="-8" r="7" fill="none" {...S} /><circle cx="-26" cy="8" r="7" fill="none" {...S} /><path d="M-20-4L14 2M-20 4L14-2" {...S} /></g></g>),
  seam: (<g><path d="M18 34h44v58H18z" fill={P.teal} {...S} /><path d="M58 34h44v58H58z" fill={P.pink} {...S} /><path d="M60 30v66" stroke={P.ink} strokeWidth="3" strokeDasharray="5 5" /></g>),
  stitch: (<g>{cloth(P.wheat)}<path d="M30 70h8M46 70h8M62 70h8M78 70h8" stroke={P.red} strokeWidth="4" strokeLinecap="round" /><path d="M86 70c6-10 10-24 12-40" {...S} /><path d="M94 24l6 6-3 2-6-6z" fill={P.grey} {...S} /></g>),
  'sewing-pattern': (<g><path d="M24 26h56l16 16v56H24z" fill="#fff6d8" {...S} /><path d="M40 40c8 4 24 4 32 0l6 16-8 4v28H42V60l-8-4z" fill="none" stroke={P.ink} strokeWidth="2.5" strokeDasharray="5 4" /><path d="M86 86l12 12M98 86L86 98" {...S} /></g>),
  motif: (<g><rect x="20" y="24" width="80" height="72" rx="6" fill={P.cream} {...S} />{[[38, 44], [70, 44], [54, 66], [38, 86], [86, 66], [70, 86]].map(([x, y], i) => (<g key={i}><circle cx={x} cy={y} r="4" fill={P.yellow} /><circle cx={x - 6} cy={y} r="4" fill={P.pink} /><circle cx={x + 6} cy={y} r="4" fill={P.pink} /><circle cx={x} cy={y - 6} r="4" fill={P.pink} /><circle cx={x} cy={y + 6} r="4" fill={P.pink} /></g>))}</g>),
  defect: (<g>{cloth(P.teal)}<path d="M56 62l6-4 4 6-4 6-6-2z" fill={P.cream} {...S} /><circle cx="60" cy="64" r="16" fill="none" stroke={P.red} strokeWidth="4" /><path d="M72 76l12 12" stroke={P.red} strokeWidth="4" strokeLinecap="round" /></g>),
  stain: (<g>{cloth('#e9eef3')}<path d="M50 56c6-8 18-6 20 2s10 8 6 16-16 6-20 4-14-2-12-10 0-8 6-12z" fill={P.brown} fillOpacity="0.7" /></g>),
  shrinkage: (<g><path d="M14 40l12-8h12c2 6 12 6 14 0h12l12 8-6 10-6-3v37H32V47l-6 3z" fill={P.sky} {...S} /><path d="M78 56l8-5h7c1 4 7 4 9 0h7l8 5-4 7-4-2v24H86V61l-4 2z" fill={P.sky} {...S} /><path d="M66 70h8M70 66l4 4-4 4" {...S} /></g>),
  quotation: (<g><path d="M30 18h48l14 14v72H30z" fill="#ffffff" {...S} /><path d="M40 40h30M40 54h40M40 66h40M40 78h40" stroke={P.grey} strokeWidth="2.5" strokeLinecap="round" /><path d="M58 92h24" stroke={P.ink} strokeWidth="3" strokeLinecap="round" /><circle cx="44" cy="92" r="6" fill={P.green} /></g>),
  price: (<g><path d="M30 46l26-26h36v36L66 82z" fill={P.yellow} {...S} /><circle cx="80" cy="34" r="5" fill="#ffffff" {...S} /><path d="M50 58c0-5 10-5 10 0s-10 5-10 10 10 5 10 0M55 50v26" stroke={P.ink} strokeWidth="2.5" fill="none" strokeLinecap="round" /></g>),
  'unit-price': (<g><path d="M16 74h88" {...S} /><path d="M16 68v12M104 68v12M60 70v8" {...S} /><path d="M30 34l18-18h30v26L58 60z" fill={P.yellow} {...S} /><circle cx="68" cy="26" r="4" fill="#ffffff" {...S} /><path d="M44 44h14" {...S} /><path d="M66 92h30" stroke={P.ink} strokeWidth="3" strokeLinecap="round" /><path d="M24 92h30" stroke={P.teal} strokeWidth="8" strokeLinecap="round" /></g>),
  order: (<g><rect x="30" y="20" width="60" height="80" rx="6" fill="#ffffff" {...S} /><rect x="46" y="14" width="28" height="12" rx="4" fill={P.grey} {...S} /><path d="M42 44h8M58 44h20M42 60h8M58 60h20M42 76h8M58 76h20" stroke={P.grey} strokeWidth="2.5" strokeLinecap="round" /><path d="M64 84l8 8 18-20" stroke={P.green} strokeWidth="5" strokeLinecap="round" fill="none" /></g>),
  moq: (<g><path d="M20 92h80" stroke={P.red} strokeWidth="3" strokeDasharray="6 4" /><rect x="26" y="70" width="68" height="16" rx="8" fill={P.teal} {...S} /><rect x="30" y="54" width="60" height="16" rx="8" fill={P.pink} {...S} /><rect x="34" y="38" width="52" height="16" rx="8" fill={P.wheat} {...S} /><path d="M100 92V30M94 38l6-8 6 8" {...S} /></g>),
  delivery: (<g><path d="M86 30h22v66H86z" fill={P.cream} {...S} /><circle cx="90" cy="64" r="2" fill={P.ink} />{truck(6, 58)}<rect x="68" y="72" width="14" height="14" fill={P.wheat} {...S} /></g>),
  'delivery-date': (<g><rect x="18" y="16" width="48" height="44" rx="6" fill="#ffffff" {...S} /><path d="M18 30h48M30 10v10M54 10v10" {...S} /><path d="M38 42h8v8h-8z" fill={P.red} {...S} />{truck(30, 66)}</g>),
  delay: (<g><circle cx="80" cy="38" r="22" fill="#ffffff" {...S} /><path d="M80 26v12l8 6" {...S} />{truck(8, 66)}<path d="M98 74v18" stroke={P.red} strokeWidth="5" strokeLinecap="round" /><circle cx="98" cy="100" r="3" fill={P.red} /></g>),
  shipment: (<g><path d="M14 50h92v40H14z" fill={P.teal} {...S} /><path d="M30 50v40M46 50v40M62 50v40M78 50v40M94 50v40" stroke={P.ink} strokeWidth="2" /><rect x="34" y="22" width="20" height="20" fill={P.wheat} {...S} /><rect x="58" y="26" width="16" height="16" fill={P.wheat} {...S} /><path d="M14 98h92" {...S} /></g>),
  sample: (<g><rect x="26" y="20" width="68" height="84" rx="6" fill="#ffffff" {...S} /><circle cx="60" cy="30" r="4" fill="none" {...S} /><rect x="36" y="40" width="48" height="40" fill={P.teal} {...S} /><path d="M36 50h48M36 60h48M36 70h48" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" /><path d="M36 90h30" stroke={P.grey} strokeWidth="3" strokeLinecap="round" /></g>),
}

export function hasIllustration(key: string) {
  return key in ART
}

export function Illustration({ name, alt, size }: { name: string; alt: string; size?: number }) {
  const art = ART[name]
  if (!art) {
    return (
      <div className="plate missing" style={size ? { width: size, height: size } : undefined} role="img" aria-label={`Görsel eksik: ${alt}`}>
        Görsel eksik
      </div>
    )
  }
  return (
    <div className="plate" style={size ? { width: size, height: size } : { aspectRatio: '1' }}>
      <svg viewBox="0 0 120 120" role="img" aria-label={alt}>
        {art}
      </svg>
    </div>
  )
}
