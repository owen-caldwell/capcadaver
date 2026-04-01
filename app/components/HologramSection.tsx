"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ModelViewer, { type NdcPoint } from "./ModelViewer";

type HologramSectionProps = {
  bio: string;
  contactInfo: string;
};

function toNdc(value: number, size: number) {
  return (value / size) * 2 - 1;
}

export default function HologramSection({
  bio,
  contactInfo,
}: HologramSectionProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelCornersNdc, setPanelCornersNdc] = useState<NdcPoint[]>([
    { x: 0.1, y: 0.8 },
    { x: 0.8, y: 0.8 },
    { x: 0.8, y: -0.8 },
    { x: 0.1, y: -0.8 },
  ]);
  useEffect(() => {
    if (!shellRef.current || !panelRef.current) return;

    const updateCorners = () => {
      const shellRect = shellRef.current?.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (
        !shellRect ||
        !panelRect ||
        shellRect.width === 0 ||
        shellRect.height === 0
      )
        return;

      const left = panelRect.left - shellRect.left;
      const right = panelRect.right - shellRect.left;
      const top = panelRect.top - shellRect.top;
      const bottom = panelRect.bottom - shellRect.top;

      const ndcTopLeft = {
        x: toNdc(left, shellRect.width),
        y: -toNdc(top, shellRect.height),
      };
      const ndcTopRight = {
        x: toNdc(right, shellRect.width),
        y: -toNdc(top, shellRect.height),
      };
      const ndcBottomRight = {
        x: toNdc(right, shellRect.width),
        y: -toNdc(bottom, shellRect.height),
      };
      const ndcBottomLeft = {
        x: toNdc(left, shellRect.width),
        y: -toNdc(bottom, shellRect.height),
      };

      setPanelCornersNdc([
        ndcTopLeft,
        ndcTopRight,
        ndcBottomRight,
        ndcBottomLeft,
      ]);
    };

    const resizeObserver = new ResizeObserver(updateCorners);
    resizeObserver.observe(shellRef.current);
    resizeObserver.observe(panelRef.current);
    window.addEventListener("resize", updateCorners);
    updateCorners();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCorners);
    };
  }, []);

  return (
    <section
      ref={shellRef}
      className="hologram-shell relative w-full overflow-hidden rounded-xl border p-2"
    >
      <div className="absolute inset-0">
        <ModelViewer projectionTargetsNdc={panelCornersNdc} />
      </div>

      <div className="pointer-events-none absolute inset-0 hologram-grid" />

      <div
        ref={panelRef}
        className="hologram-window absolute right-3 top-1/2 w-[60%] -translate-y-1/2 rounded-lg p-3 md:right-5 md:p-4"
      >
        <div className="hologram-corner hologram-corner-tl" />
        <div className="hologram-corner hologram-corner-tr" />
        <div className="hologram-corner hologram-corner-bl" />
        <div className="hologram-corner hologram-corner-br" />

        <p className="font-cyber-display text-[10px] tracking-[0.25em] text-white/80">
          PROJECTION WINDOW
        </p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/90">
          {bio || "Bio coming soon."}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/80">
          {contactInfo || "Contact details coming soon."}
        </p>
        <div className="mt-3 flex gap-3 text-xs">
          <Link href="/admin" className="hologram-link pointer-events-auto">
            ADMIN
          </Link>
          <Link href="/contact" className="hologram-link pointer-events-auto">
            CONTACT
          </Link>
        </div>
      </div>
    </section>
  );
}
