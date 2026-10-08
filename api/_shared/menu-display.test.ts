import { describe, expect, it } from "vitest";
import { displayNameOfMenuRow, pizzaSizeOfName } from "./menu-display";

describe("pizzaSizeOfName", () => {
  it("reads the size of the prod pizza rows", () => {
    expect(pizzaSizeOfName("Diavolo 50 cm")).toBe("50");
    expect(pizzaSizeOfName("Diavolo 33 cm")).toBe("33");
    expect(pizzaSizeOfName("Anatoli pizza 33 cm")).toBe("33");
    expect(pizzaSizeOfName("Piroška 33 cm")).toBe("33");
  });

  it("ignores case and spacing", () => {
    expect(pizzaSizeOfName("  DIAVOLO   50CM ")).toBe("50");
    expect(pizzaSizeOfName("Bianco 33cm")).toBe("33");
  });

  it("returns null for rows without a pizza size", () => {
    expect(pizzaSizeOfName("Coca-Cola 0,33 l")).toBeNull();
    expect(pizzaSizeOfName("Kečap")).toBeNull();
    expect(pizzaSizeOfName("Ivice punjene sirom")).toBeNull();
    expect(pizzaSizeOfName("Papricciosa")).toBeNull();
    expect(pizzaSizeOfName("")).toBeNull();
  });

  it("does not take 150 cm or 500 cm for 50 cm", () => {
    expect(pizzaSizeOfName("Pizza 150 cm")).toBeNull();
    expect(pizzaSizeOfName("Pizza 500 cm")).toBeNull();
  });
});

describe("displayNameOfMenuRow", () => {
  it("drops the pizza size, as the cart does", () => {
    expect(displayNameOfMenuRow("Diavolo 50 cm")).toBe("Diavolo");
    expect(displayNameOfMenuRow("Anatoli pizza 33 cm")).toBe("Anatoli pizza");
    expect(displayNameOfMenuRow("Piroška 33 cm")).toBe("Piroška");
    expect(displayNameOfMenuRow("Ivice punjene sirom 50 cm")).toBe("Ivice punjene sirom");
  });

  it("keeps every other name whole, trimmed", () => {
    expect(displayNameOfMenuRow("Coca-Cola 0,33 l")).toBe("Coca-Cola 0,33 l");
    expect(displayNameOfMenuRow("Kečap")).toBe("Kečap");
    expect(displayNameOfMenuRow("Slatko Ljuti ")).toBe("Slatko Ljuti");
    expect(displayNameOfMenuRow("")).toBe("");
  });
});
