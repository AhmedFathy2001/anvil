// Pure byte sniffing for animated images, shared by the upload route and its tests.

/** Does this PNG carry an `acTL` chunk — is it an APNG? Scans chunk headers up to the first IDAT. */
export function isAnimatedPng(buf: Buffer): boolean {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return false;
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'acTL') return true;
    if (type === 'IDAT') return false;
    off += 12 + len;
  }
  return false;
}

// Chunks an APNG/PNG needs to display (colour, transparency, animation). Everything else — text
// (tEXt/zTXt/iTXt), EXIF (eXIf), timestamps (tIME), software tags — can carry personal data and is
// dropped. A whitelist, so a chunk type nobody has heard of is dropped too.
const KEEP_PNG_CHUNKS = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'acTL', 'fcTL', 'fdAT', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'pHYs']);

/**
 * Rewrites a PNG with only its display chunks, byte for byte otherwise (so an animation survives).
 * Returns null when the bytes are not a well-formed PNG, so the caller can refuse the upload instead
 * of storing something it could not clean.
 */
export function stripPngChunks(buf: Buffer): Buffer | null {
  if (buf.length < 20 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let off = 8;
  let sawEnd = false;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const end = off + 12 + len;
    if (end > buf.length) return null;
    const type = buf.toString('latin1', off + 4, off + 8);
    if (KEEP_PNG_CHUNKS.has(type)) parts.push(buf.subarray(off, end));
    off = end;
    if (type === 'IEND') {
      sawEnd = true;
      break;
    }
  }
  return sawEnd ? Buffer.concat(parts) : null;
}
