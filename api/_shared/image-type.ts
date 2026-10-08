/**
 * B25: JPEG, PNG and WebP only, decided by the file's own bytes — never by the
 * declared content type or file name. The upload used to store whatever type
 * the request named, so "image/svg+xml" with a ".png" name became an SVG (with
 * script) in the public bucket. The stored content type is the one the bytes
 * prove.
 */
export function detectImageType(bytes: Uint8Array): { ext: "jpg" | "png" | "webp"; contentType: string } | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { ext: "png", contentType: "image/png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", contentType: "image/webp" };
  return null;
}
