import type { AllowedMime } from '@/lib/constants';

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK..

function startsWith(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (haystack.length < needle.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (haystack[i] !== needle[i]) return false;
  }
  return true;
}

function hasEntry(zip: Uint8Array, name: string): boolean {
  // Bound the scan. A well-formed DOCX places [Content_Types].xml
  // in the first local file header (offset 0). 64 KiB is ample for
  // any DOCX; unbounded scans on attacker-crafted 30MB payloads are a CPU DoS.
  const SCAN_CAP = 64 * 1024;
  const limit = Math.min(zip.length, SCAN_CAP);
  const target = new TextEncoder().encode(name);
  outer: for (let i = 0; i + 30 + target.length <= limit; i++) {
    if (zip[i] !== 0x50 || zip[i + 1] !== 0x4b || zip[i + 2] !== 0x03 || zip[i + 3] !== 0x04)
      continue;
    const lenLo = zip[i + 26];
    const lenHi = zip[i + 27];
    if (lenLo === undefined || lenHi === undefined) continue;
    const nameLen = lenLo | (lenHi << 8);
    if (nameLen !== target.length) continue;
    const off = i + 30;
    for (let j = 0; j < target.length; j++) {
      if (zip[off + j] !== target[j]) continue outer;
    }
    return true;
  }
  return false;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export async function validateMagicBytes(
  bytes: Uint8Array,
  mime: AllowedMime
): Promise<boolean> {
  if (mime === 'application/pdf') return startsWith(bytes, PDF);
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return startsWith(bytes, ZIP) && hasEntry(bytes, '[Content_Types].xml');
  }
  if (mime === 'text/plain') return isValidUtf8(bytes);
  return false;
}
