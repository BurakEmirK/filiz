import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Tarayıcının ses parçaları (Web Audio, <audio>, fetch) sahte nesnelerle taklit edilir;
// sınanan, src/ui/audio.ts'nin hangi yolla çaldığı ve bellekte kaç kayıt tuttuğudur.

let started = 0
let stopped = 0
let mediaPlays = 0
let decodeFails = false

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended'
  destination = {}
  async resume() {
    this.state = 'running'
  }
  async suspend() {
    this.state = 'suspended'
  }
  async decodeAudioData(_b: ArrayBuffer) {
    if (decodeFails) throw new Error('EncodingError')
    return { duration: 1 }
  }
  createBufferSource() {
    return { buffer: null, onended: null, connect() {}, start: () => void started++, stop: () => void stopped++ }
  }
}

class FakeAudio {
  src = ''
  play() {
    mediaPlays++
    return Promise.resolve()
  }
  pause() {}
}

async function freshAudio() {
  vi.resetModules()
  return import('../src/ui/audio')
}

const url = (i: number) => `https://upload.wikimedia.org/x/${i}.mp3`

beforeEach(() => {
  started = 0
  stopped = 0
  mediaPlays = 0
  decodeFails = false
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2, 3])))
})
afterEach(() => vi.unstubAllGlobals())

describe('İnsan kaydı çalma', () => {
  it('instant: önceden indirilmiş kayıt Web Audio ile anında çalar (medya oynatıcı kullanılmaz)', async () => {
    const a = await freshAudio()
    await a.preloadRecording(url(1))
    const o = await a.play({ text: 'ház', lang: 'hu', recording: url(1) })
    expect(o).toBe('recording')
    expect(started).toBe(1)
    expect(mediaPlays).toBe(0)
    expect(a.audioLog[0].detail).toBe('anında')
  })

  it('fallback: henüz indirilmemiş kayıt yine çalar (oynatıcı yolu)', async () => {
    const a = await freshAudio()
    const o = await a.play({ text: 'ház', lang: 'hu', recording: url(2) })
    expect(o).toBe('recording')
    expect(mediaPlays).toBe(1)
    expect(a.audioLog[0].detail).toBe('oynatıcı')
  })

  it('decode error: çözülemeyen kayıt oynatıcı yoluna düşer', async () => {
    decodeFails = true
    const a = await freshAudio()
    await a.preloadRecording(url(3))
    const o = await a.play({ text: 'ház', lang: 'hu', recording: url(3) })
    expect(o).toBe('recording')
    expect(started).toBe(0)
    expect(mediaPlays).toBe(1)
    expect(a.audioLog[0].detail).toBe('oynatıcı')
  })

  it('resume hangs: ses bağlamı açılmazsa (iOS kesinti durumu) oynatıcıya geçer ve bundan sonra oynatıcıyı kullanır', async () => {
    vi.useFakeTimers()
    try {
      const a = await freshAudio()
      await a.preloadRecording(url(4))
      // Bu bağlam hiç açılmıyor
      ;(FakeAudioContext.prototype as unknown as { resume: () => Promise<void> }).resume = () => new Promise<void>(() => {})
      const p = a.play({ text: 'ház', lang: 'hu', recording: url(4) })
      await vi.advanceTimersByTimeAsync(a.RESUME_TIMEOUT_MS + 10)
      expect(await p).toBe('recording')
      expect(mediaPlays).toBe(1)
      expect(stopped).toBe(1) // bağlam sonradan açılırsa kayıt ikinci kez çalmasın
      expect(a.audioLog[0].detail).toBe('oynatıcı')
      await a.play({ text: 'ház', lang: 'hu', recording: url(4) })
      expect(mediaPlays).toBe(2)
    } finally {
      FakeAudioContext.prototype.resume = async function (this: FakeAudioContext) {
        this.state = 'running'
      }
      vi.useRealTimers()
    }
  })

  it('cap: çok sayıda kelime ekrandayken bellekte en fazla MAX_DECODED kayıt tutulur', async () => {
    const a = await freshAudio()
    for (let i = 0; i < 50; i++) await a.preloadRecording(url(100 + i))
    expect(a.audioStats().decoded).toBe(a.MAX_DECODED)
    expect(a.MAX_DECODED).toBe(40)
  })
})
