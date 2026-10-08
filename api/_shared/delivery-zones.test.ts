import { describe, expect, it } from "vitest";
import {
  deliveryFeeCents,
  findDeliveryZone,
  findDeliveryZoneByLabel,
  formatDeliveryFee,
  type DeliveryZone,
} from "./delivery-zones";

function zone(key: string): DeliveryZone {
  const z = findDeliveryZone(key);
  if (!z) throw new Error(`no zone ${key}`);
  return z;
}

describe("findDeliveryZone / findDeliveryZoneByLabel", () => {
  it("finds a zone by its key, and nothing for an unknown key", () => {
    expect(findDeliveryZone("becici")?.label).toBe("Bečići");
    expect(findDeliveryZone("petrovac")).toBeNull();
    expect(findDeliveryZone("")).toBeNull();
  });

  it("finds a zone by the label the cart writes, ignoring case and diacritics", () => {
    expect(findDeliveryZoneByLabel("Bečići")?.key).toBe("becici");
    expect(findDeliveryZoneByLabel("  BECICI ")?.key).toBe("becici");
    expect(findDeliveryZoneByLabel("Sveti Stefan")?.key).toBe("sveti-stefan");
    expect(findDeliveryZoneByLabel("Petrovac")).toBeNull();
    expect(findDeliveryZoneByLabel("")).toBeNull();
  });
});

describe("deliveryFeeCents", () => {
  it("Budva is always free", () => {
    expect(deliveryFeeCents(zone("budva"), 100)).toBe(0);
  });

  it("charges the zone fee below its minimum and nothing from the minimum up", () => {
    expect(deliveryFeeCents(zone("becici"), 1499)).toBe(300);
    expect(deliveryFeeCents(zone("becici"), 1500)).toBe(0);
    expect(deliveryFeeCents(zone("lastva"), 2999)).toBe(500);
    expect(deliveryFeeCents(zone("lastva"), 3000)).toBe(0);
  });
});

describe("formatDeliveryFee", () => {
  it("writes whole euros as the cart does, and keeps cents otherwise", () => {
    expect(formatDeliveryFee(0)).toBe("0€");
    expect(formatDeliveryFee(300)).toBe("3€");
    expect(formatDeliveryFee(150)).toBe("1,50€");
  });
});
