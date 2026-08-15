import { normalizeRepeats, resizeArrays, type Division, type Groove, type Sticking } from './model'
import { hasRepeats as anyRepeats, repeatFor } from './playback-order'
import { VOICES, VOICE_BY_ID, type VoiceId } from './voices'

/**
 * Wire format v4 — registry-driven.
 *
 * Header (byte-aligned):
 *   0       u8   format version (= 4)
 *   1..2    u16  tempo (little-endian)
 *   3       u8   swing (0..100)
 *   4       u8   timeSig: (num<<4) | den
 *   5       u8   measures (1..255)
 *   6       u8   bits 0..2 = divCode
 *                bit 3     = metronome
 *                bit 4     = countIn
 *                bit 5     = loop
 *                bit 6     = hasSticking
 *                bit 7     = hasRepeats
 *   7       u8   voice presence bitmap; bit i corresponds to VOICES[i]
 *
 * Voice cells (in registry order, only voices whose presence bit is set):
 *   bitsPerCell × stepCount, bit-packed MSB-first
 *
 * If hasSticking:
 *   2 × stepCount, bit-packed
 *
 * If hasRepeats:
 *   4 × measures, bit-packed, each holding (repeat - 1) so 1..16 fits
 *
 * Optional trailer (absent = empty title & author):
 *   u8 title_len, title_len UTF-8 bytes,
 *   u8 author_len, author_len UTF-8 bytes
 *
 * Whole buffer is base64url-encoded for the URL.
 *
 * Backward compat: v3 payloads still decode (read-only). Their `t4` field
 * maps to `t3` and `cy` maps to `ride` in the v4 model.
 */

const FORMAT_VERSION = 4
const DIV_CODES: Division[] = [4, 6, 8, 12, 16, 24, 32]
const STICK: Sticking[] = ['-', 'R', 'L', 'B']

class BitWriter {
  private bytes: number[] = []
  private cur = 0
  private cb = 0
  writeBits(val: number, n: number) {
    for (let i = n - 1; i >= 0; i--) {
      this.cur = (this.cur << 1) | ((val >> i) & 1)
      this.cb++
      if (this.cb === 8) {
        this.bytes.push(this.cur & 0xff)
        this.cur = 0
        this.cb = 0
      }
    }
  }
  align() {
    if (this.cb > 0) {
      this.cur <<= 8 - this.cb
      this.bytes.push(this.cur & 0xff)
      this.cur = 0
      this.cb = 0
    }
  }
  writeByte(b: number) {
    this.align()
    this.bytes.push(b & 0xff)
  }
  writeBytes(src: Uint8Array) {
    this.align()
    for (const b of src) this.bytes.push(b & 0xff)
  }
  toBytes(): Uint8Array {
    this.align()
    return new Uint8Array(this.bytes)
  }
}

class BitReader {
  private i = 0
  private bit = 0
  constructor(private bytes: Uint8Array) {}
  readBits(n: number): number {
    let v = 0
    for (let k = 0; k < n; k++) {
      if (this.i >= this.bytes.length) throw new Error('codec: eof')
      v = (v << 1) | ((this.bytes[this.i] >> (7 - this.bit)) & 1)
      this.bit++
      if (this.bit === 8) {
        this.i++
        this.bit = 0
      }
    }
    return v
  }
  align() {
    if (this.bit > 0) {
      this.i++
      this.bit = 0
    }
  }
  readByte(): number {
    this.align()
    if (this.i >= this.bytes.length) throw new Error('codec: eof')
    return this.bytes[this.i++]
  }
  readBytes(n: number): Uint8Array {
    this.align()
    if (this.i + n > this.bytes.length) throw new Error('codec: eof')
    const out = this.bytes.slice(this.i, this.i + n)
    this.i += n
    return out
  }
  remaining(): number {
    this.align()
    return this.bytes.length - this.i
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : ''
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function allZero(xs: ArrayLike<number> | undefined): boolean {
  if (!xs) return true
  for (let i = 0; i < xs.length; i++) if (xs[i] !== 0) return false
  return true
}
function allDash(xs: ArrayLike<Sticking>): boolean {
  for (let i = 0; i < xs.length; i++) if (xs[i] !== '-') return false
  return true
}

export function encode(g: Groove): string {
  const divCode = DIV_CODES.indexOf(g.division)
  if (divCode < 0) throw new Error(`codec: unsupported division ${g.division}`)
  if (VOICES.length > 8) throw new Error('codec: too many voices for 1-byte presence bitmap')
  const n = g.voices.hh?.length ?? g.division * g.measures
  const w = new BitWriter()

  let presence = 0
  const presentVoices: VoiceId[] = []
  VOICES.forEach((v, i) => {
    const arr = g.voices[v.id]
    if (arr && !allZero(arr)) {
      presence |= 1 << i
      presentVoices.push(v.id)
    }
  })
  const hasSticking = !allDash(g.sticking)
  const hasRepeats = anyRepeats(g)

  w.writeByte(FORMAT_VERSION)
  w.writeByte(g.tempo & 0xff)
  w.writeByte((g.tempo >> 8) & 0xff)
  w.writeByte(g.swing & 0xff)
  w.writeByte(((g.timeSig[0] & 0x0f) << 4) | (g.timeSig[1] & 0x0f))
  w.writeByte(g.measures & 0xff)
  w.writeByte(
    (divCode & 0x07) |
      ((g.metronome ? 1 : 0) << 3) |
      ((g.countIn ? 1 : 0) << 4) |
      ((g.loop ? 1 : 0) << 5) |
      ((hasSticking ? 1 : 0) << 6) |
      ((hasRepeats ? 1 : 0) << 7),
  )
  w.writeByte(presence & 0xff)

  for (const id of presentVoices) {
    const meta = VOICE_BY_ID[id]
    const arr = g.voices[id]!
    const mask = (1 << meta.bitsPerCell) - 1
    for (let i = 0; i < n; i++) w.writeBits((arr[i] ?? 0) & mask, meta.bitsPerCell)
  }
  if (hasSticking) {
    for (let i = 0; i < n; i++) {
      const idx = STICK.indexOf(g.sticking[i])
      w.writeBits((idx < 0 ? 0 : idx) & 0x03, 2)
    }
  }
  if (hasRepeats) {
    for (let m = 0; m < g.measures; m++) w.writeBits((repeatFor(g, m) - 1) & 0x0f, 4)
  }

  const title = (g.title || '').slice(0, 255)
  const author = (g.author || '').slice(0, 255)
  if (title || author) {
    const enc = new TextEncoder()
    const tb = enc.encode(title)
    const ab = enc.encode(author)
    w.writeByte(tb.length)
    w.writeBytes(tb)
    w.writeByte(ab.length)
    w.writeBytes(ab)
  }

  return toBase64Url(w.toBytes())
}

function decodeV4(r: BitReader): Groove | null {
  const tempo = r.readByte() | (r.readByte() << 8)
  const swing = r.readByte()
  const ts = r.readByte()
  const measures = r.readByte()
  const flags = r.readByte()
  const presence = r.readByte()

  const divCode = flags & 0x07
  const metronome = !!(flags & 0x08)
  const countIn = !!(flags & 0x10)
  const loop = !!(flags & 0x20)
  const hasSticking = !!(flags & 0x40)
  const hasRepeats = !!(flags & 0x80)

  const division = DIV_CODES[divCode]
  if (!division) return null
  const n = division * measures
  if (n <= 0 || n > 2048) return null

  const voices: Partial<Record<VoiceId, number[]>> = {}
  VOICES.forEach((v, i) => {
    if (!(presence & (1 << i))) return
    const cells = new Array(n).fill(0) as number[]
    for (let k = 0; k < n; k++) cells[k] = r.readBits(v.bitsPerCell)
    voices[v.id] = cells
  })

  const sticking: Sticking[] = new Array(n).fill('-')
  if (hasSticking) for (let i = 0; i < n; i++) sticking[i] = STICK[r.readBits(2)]

  const repeats = new Array(measures).fill(1) as number[]
  if (hasRepeats) for (let m = 0; m < measures; m++) repeats[m] = r.readBits(4) + 1

  let title = ''
  let author = ''
  if (r.remaining() > 0) {
    const tLen = r.readByte()
    const tb = r.readBytes(tLen)
    const aLen = r.readByte()
    const ab = r.readBytes(aLen)
    const dec = new TextDecoder()
    title = dec.decode(tb)
    author = dec.decode(ab)
  }

  return resizeArrays({
    v: 1,
    title,
    author,
    timeSig: [(ts >> 4) & 0x0f, ts & 0x0f],
    division,
    measures,
    tempo,
    swing,
    metronome,
    countIn,
    loop,
    voices,
    sticking,
    repeats: normalizeRepeats(repeats, measures),
  })
}

// v3 reader. Field layout differs from v4; legacy `t4` maps to `t3`,
// legacy `cy` maps to `ride`. Read-only — we never produce v3 again.
function decodeV3(r: BitReader): Groove | null {
  const tempo = r.readByte() | (r.readByte() << 8)
  const swing = r.readByte()
  const ts = r.readByte()
  const measures = r.readByte()
  const flags1 = r.readByte()
  const flags2 = r.readByte()

  const divCode = flags1 & 0x07
  const hasT1 = !!(flags1 & 0x08)
  const hasT4 = !!(flags1 & 0x10)
  const hasCy = !!(flags1 & 0x20)
  const metronome = !!(flags2 & 0x01)
  const countIn = !!(flags2 & 0x02)
  const loop = !!(flags2 & 0x04)
  const hhEmpty = !!(flags2 & 0x08)
  const snEmpty = !!(flags2 & 0x10)
  const kkEmpty = !!(flags2 & 0x20)
  const stEmpty = !!(flags2 & 0x40)

  const division = DIV_CODES[divCode]
  if (!division) return null
  const n = division * measures
  if (n <= 0 || n > 2048) return null

  const hh = new Array(n).fill(0) as number[]
  const sn = new Array(n).fill(0) as number[]
  const kk = new Array(n).fill(0) as number[]
  if (!hhEmpty) for (let i = 0; i < n; i++) hh[i] = r.readBits(3)
  if (!snEmpty) for (let i = 0; i < n; i++) sn[i] = r.readBits(2)
  if (!kkEmpty) for (let i = 0; i < n; i++) kk[i] = r.readBits(2)

  const voices: Partial<Record<VoiceId, number[]>> = { hh, sn, kk }
  if (hasT1) {
    const a = new Array(n) as number[]
    for (let i = 0; i < n; i++) a[i] = r.readBits(2)
    voices.t1 = a
  }
  if (hasT4) {
    const a = new Array(n) as number[]
    for (let i = 0; i < n; i++) a[i] = r.readBits(2)
    voices.t3 = a
  }
  if (hasCy) {
    const a = new Array(n) as number[]
    for (let i = 0; i < n; i++) a[i] = r.readBits(2)
    voices.ride = a
  }

  const sticking: Sticking[] = new Array(n).fill('-')
  if (!stEmpty) for (let i = 0; i < n; i++) sticking[i] = STICK[r.readBits(2)]

  let title = ''
  let author = ''
  if (r.remaining() > 0) {
    const tLen = r.readByte()
    const tb = r.readBytes(tLen)
    const aLen = r.readByte()
    const ab = r.readBytes(aLen)
    const dec = new TextDecoder()
    title = dec.decode(tb)
    author = dec.decode(ab)
  }

  return resizeArrays({
    v: 1,
    title,
    author,
    timeSig: [(ts >> 4) & 0x0f, ts & 0x0f],
    division,
    measures,
    tempo,
    swing,
    metronome,
    countIn,
    loop,
    voices,
    sticking,
  })
}

export function decode(payload: string): Groove | null {
  try {
    const bytes = fromBase64Url(payload)
    const r = new BitReader(bytes)
    const v = r.readByte()
    if (v === FORMAT_VERSION) return decodeV4(r)
    if (v === 3) return decodeV3(r)
    return null
  } catch {
    return null
  }
}
