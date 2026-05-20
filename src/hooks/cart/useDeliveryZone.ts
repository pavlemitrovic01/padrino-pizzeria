import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CartItem } from "../../context/CartContext";
import { isDrinkCategory } from "../../lib/cartDrawerHelpers";
import { toSafeInt } from "../../lib/money";
import {
  DELIVERY_ZONES,
  type DeliveryZone,
  type DeliveryZoneKey,
} from "../../lib/config";

type UseDeliveryZoneReturn = {
  deliveryZoneKey: DeliveryZoneKey | "";
  isZoneOpen: boolean;
  setIsZoneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deliveryFeeOverride: boolean;
  setDeliveryFeeOverride: React.Dispatch<React.SetStateAction<boolean>>;
  selectZone: (key: DeliveryZoneKey) => void;
  zoneBtnRef: RefObject<HTMLButtonElement | null>;
  zonePanelRef: RefObject<HTMLDivElement | null>;
  totalItems: number;
  subtotalCents: number;
  selectedDeliveryZone: DeliveryZone | null;
  qualifiesForFreeDelivery: boolean;
  missingToFreeDeliveryCents: number;
  deliveryFeeCents: number;
  effectiveTotalCents: number;
};

export function useDeliveryZone(items: CartItem[]): UseDeliveryZoneReturn {
  const [deliveryZoneKey, setDeliveryZoneKey] = useState<DeliveryZoneKey | "">("");
  const [deliveryFeeOverride, setDeliveryFeeOverride] = useState(false);
  const [isZoneOpen, setIsZoneOpen] = useState(false);

  const zoneBtnRef = useRef<HTMLButtonElement | null>(null);
  const zonePanelRef = useRef<HTMLDivElement | null>(null);

  const totalItems = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity ?? 0), 0);
  }, [items]);

  const subtotalCents = useMemo(() => {
    let total = 0;

    for (const it of items) {
      const qty = it.quantity ?? 0;
      if (qty <= 0) continue;

      const drink = isDrinkCategory(it.category ?? "");
      const addons = drink ? [] : (it.addons ?? []);
      const addonsTotalCents = addons.reduce(
        (s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1),
        0
      );

      const baseCents = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
      const perItemCents = baseCents + addonsTotalCents;

      total += perItemCents * qty;
    }

    return total;
  }, [items]);

  const selectedDeliveryZone = useMemo(() => {
    if (!deliveryZoneKey) return null;
    return DELIVERY_ZONES.find((z) => z.key === deliveryZoneKey) ?? null;
  }, [deliveryZoneKey]);

  const qualifiesForFreeDelivery = useMemo(() => {
    if (!selectedDeliveryZone) return false;
    if (selectedDeliveryZone.feeCents <= 0) return true;
    if (selectedDeliveryZone.minCents <= 0) return true;
    return subtotalCents >= selectedDeliveryZone.minCents;
  }, [selectedDeliveryZone, subtotalCents]);

  const missingToFreeDeliveryCents = useMemo(() => {
    if (!selectedDeliveryZone) return 0;
    if (selectedDeliveryZone.feeCents <= 0) return 0;
    if (selectedDeliveryZone.minCents <= 0) return 0;
    return Math.max(selectedDeliveryZone.minCents - subtotalCents, 0);
  }, [selectedDeliveryZone, subtotalCents]);

  const deliveryFeeCents = useMemo(() => {
    if (!selectedDeliveryZone) return 0;
    if (selectedDeliveryZone.feeCents <= 0) return 0;
    if (qualifiesForFreeDelivery) return 0;
    return deliveryFeeOverride ? selectedDeliveryZone.feeCents : 0;
  }, [selectedDeliveryZone, qualifiesForFreeDelivery, deliveryFeeOverride]);

  const effectiveTotalCents = subtotalCents + deliveryFeeCents;

  const selectZone = (key: DeliveryZoneKey) => {
    setDeliveryZoneKey(key);
    setIsZoneOpen(false);
    zoneBtnRef.current?.focus();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeliveryFeeOverride(false);
  }, [deliveryZoneKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (qualifiesForFreeDelivery) setDeliveryFeeOverride(false);
  }, [qualifiesForFreeDelivery]);

  useEffect(() => {
    if (!isZoneOpen) return;

    const onPointerDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;

      const btn = zoneBtnRef.current;
      const panel = zonePanelRef.current;

      if (btn && btn.contains(t)) return;
      if (panel && panel.contains(t)) return;

      setIsZoneOpen(false);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      setIsZoneOpen(false);
      zoneBtnRef.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isZoneOpen]);

  return {
    deliveryZoneKey,
    isZoneOpen,
    setIsZoneOpen,
    deliveryFeeOverride,
    setDeliveryFeeOverride,
    selectZone,
    zoneBtnRef,
    zonePanelRef,
    totalItems,
    subtotalCents,
    selectedDeliveryZone,
    qualifiesForFreeDelivery,
    missingToFreeDeliveryCents,
    deliveryFeeCents,
    effectiveTotalCents,
  };
}
