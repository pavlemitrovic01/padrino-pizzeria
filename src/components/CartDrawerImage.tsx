import { useMemo, useState } from "react";
import { buildImageCandidates } from "../lib/cartDrawerHelpers";

function SmartCartImageInner(props: { image?: string | null; name: string; alt: string }) {
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(
    () => buildImageCandidates(props.image ?? null, props.name),
    [props.image, props.name]
  );

  const src = candidates[idx] ?? null;

  if (!src) {
    return (
      <div className="h-16 w-16 rounded-2xl bg-white/5 ring-1 ring-white/10" aria-hidden="true" />
    );
  }

  return (
    <img
      src={src}
      alt={props.alt}
      className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10"
      loading="lazy"
      onError={() => setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
    />
  );
}

export function SmartCartImage(props: { image?: string | null; name: string; alt: string }) {
  const resetKey = useMemo(() => `${props.image ?? ""}__${props.name ?? ""}`, [
    props.image,
    props.name,
  ]);
  return <SmartCartImageInner key={resetKey} {...props} />;
}

function SmartMiniAddonImageInner(props: { name: string; className?: string }) {
  const [idx, setIdx] = useState(0);

  const candidates = useMemo(() => {
    const fromName = buildImageCandidates(null, props.name);
    const uniq = new Set<string>(fromName);
    uniq.add("/menu/padrino.webp");
    uniq.add("/menu/padrino.png");
    return [...uniq];
  }, [props.name]);

  const src = candidates[idx] ?? null;
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={props.className ?? "h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"}
      loading="lazy"
      onError={() => setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
    />
  );
}

export function SmartMiniAddonImage(props: { name: string; className?: string }) {
  return <SmartMiniAddonImageInner key={props.name} {...props} />;
}
