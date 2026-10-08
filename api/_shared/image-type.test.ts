import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";

const bytes = (...v: number[]) => new Uint8Array(v);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("detectImageType (B25: menu uploads are JPEG, PNG or WebP by their bytes)", () => {
  it("recognizes JPEG, PNG and WebP", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ ext: "jpg", contentType: "image/jpeg" });
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toEqual({ ext: "png", contentType: "image/png" });
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 ")))).toEqual({ ext: "webp", contentType: "image/webp" });
  });

  it("refuses SVG, GIF, HTML and anything short or unknown — whatever the request claims", () => {
    expect(detectImageType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(detectImageType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(detectImageType(bytes(...ascii("<!doctype html>")))).toBeNull();
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});
