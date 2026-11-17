// Sektörler. Yeni sektör eklemek için buraya kayıt + ilgili dil paketine anlamlar/dersler eklenir.

export interface Subtopic {
  id: string
  nameTr: string
}

export interface Industry {
  id: string
  nameTr: string
  icon: string
  subtopics: Subtopic[]
  /** 'sample' = örnek içerik var; 'skeleton' = yalnızca yapı, içerik yok */
  status: 'sample' | 'skeleton'
}

export const INDUSTRIES: Industry[] = [
  {
    id: 'textile',
    nameTr: 'Tekstil',
    icon: 'spool',
    status: 'sample',
    subtopics: [
      { id: 'materials', nameTr: 'Kumaş, lif ve malzemeler' },
      { id: 'production', nameTr: 'Üretim, kesim ve dikiş' },
      { id: 'quality', nameTr: 'Kalite kontrol ve hatalar' },
      { id: 'pricing', nameTr: 'Fiyat, teklif ve sipariş' },
      { id: 'delivery', nameTr: 'Teslimat ve müşteri iletişimi' },
    ],
  },
  {
    id: 'finance',
    nameTr: 'Finans',
    icon: 'coins',
    status: 'skeleton',
    subtopics: [
      { id: 'banking', nameTr: 'Bankacılık' },
      { id: 'accounting', nameTr: 'Muhasebe' },
      { id: 'payments', nameTr: 'Ödemeler ve faturalar' },
    ],
  },
  {
    id: 'it',
    nameTr: 'Bilişim / BT',
    icon: 'chip',
    status: 'skeleton',
    subtopics: [
      { id: 'software', nameTr: 'Yazılım geliştirme' },
      { id: 'support', nameTr: 'Teknik destek' },
      { id: 'networks', nameTr: 'Ağlar ve güvenlik' },
    ],
  },
  {
    id: 'engineering',
    nameTr: 'Mühendislik',
    icon: 'gear',
    status: 'skeleton',
    subtopics: [
      { id: 'materials-eng', nameTr: 'Malzeme ve ölçüm' },
      { id: 'projects', nameTr: 'Proje yönetimi' },
      { id: 'safety', nameTr: 'İş güvenliği' },
    ],
  },
  {
    id: 'architecture',
    nameTr: 'Mimarlık',
    icon: 'building',
    status: 'skeleton',
    subtopics: [
      { id: 'design', nameTr: 'Tasarım ve çizim' },
      { id: 'construction', nameTr: 'Yapım ve şantiye' },
      { id: 'clients', nameTr: 'Müşteri ve izin süreçleri' },
    ],
  },
]

export function getIndustry(id: string): Industry {
  const found = INDUSTRIES.find((i) => i.id === id)
  if (!found) throw new Error(`Bilinmeyen sektör: ${id}`)
  return found
}
