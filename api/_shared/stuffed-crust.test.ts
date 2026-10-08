import { describe, expect, it } from "vitest";
import { crustSizeForItem, stuffedCrustSizeOf } from "./stuffed-crust";

describe("stuffedCrustSizeOf", () => {
  it("reads the two prod crust rows", () => {
    expect(stuffedCrustSizeOf("Ivice punjene sirom")).toBe("33");
    expect(stuffedCrustSizeOf("Ivice punjene sirom 50 cm")).toBe("50");
  });

  it("ignores case, diacritics, spacing and word order", () => {
    expect(stuffedCrustSizeOf("  IVICE   PUNJENE sirom  50cm ")).toBe("50");
    expect(stuffedCrustSizeOf("Punjene ivice sa kulenom")).toBe("33");
    expect(stuffedCrustSizeOf("Punjena ivica")).toBe("33");
    expect(stuffedCrustSizeOf("Ivica punjena 50 cm")).toBe("50");
    expect(stuffedCrustSizeOf("Rub")).toBe("33");
  });

  it("returns null for anything that is not a stuffed crust", () => {
    expect(stuffedCrustSizeOf("Bbq")).toBeNull();
    expect(stuffedCrustSizeOf("Krofne")).toBeNull();
    expect(stuffedCrustSizeOf("Coca-Cola 0,33 l")).toBeNull();
    expect(stuffedCrustSizeOf("Kapričoza 50 cm")).toBeNull();
    expect(stuffedCrustSizeOf("Rub pizza")).toBeNull();
    expect(stuffedCrustSizeOf("")).toBeNull();
  });

  it("does not take 150 cm or 500 cm for 50 cm", () => {
    expect(stuffedCrustSizeOf("Ivice punjene 150 cm")).toBe("33");
    expect(stuffedCrustSizeOf("Ivice punjene 500 cm")).toBe("33");
  });
});

describe("crustSizeForItem", () => {
  it("fits the 50 cm crust only to a 50 cm row", () => {
    expect(crustSizeForItem("Kapričoza 50 cm")).toBe("50");
    expect(crustSizeForItem("Quattro formaggi 50cm")).toBe("50");
  });

  it("fits the 33 cm crust to 33 cm rows and to items with no size", () => {
    expect(crustSizeForItem("Kapričoza 33 cm")).toBe("33");
    expect(crustSizeForItem("Coca-Cola 0,33 l")).toBe("33");
    expect(crustSizeForItem("Papricciosa")).toBe("33");
    expect(crustSizeForItem("")).toBe("33");
  });
});
