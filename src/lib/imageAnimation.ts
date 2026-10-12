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
