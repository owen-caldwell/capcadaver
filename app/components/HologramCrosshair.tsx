"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DESKTOP_MQ = "(min-width: 768px)";

/** Length of each crosshair arm (px). */
const ARM_LEN = 9;
/** Gap between cursor center and where each arm starts (px). */
const ARM_GAP = 3;

type HologramCrosshairProps = {
  active: boolean;
  onHoverWindowChange: (windowId: string | null) => void;
};

function findHoloWindowIdFromPoint(x: number, y: number): string | null {
  const stack = document.elementsFromPoint(x, y);
  for (const node of stack) {
    if (node instanceof HTMLElement && node.dataset.holoWindow) {
      return node.dataset.holoWindow;
    }
  }
  return null;
}

const ARMS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const S45 = Math.SQRT1_2;

export function HologramCrosshair({
  active,
  onHoverWindowChange,
}: HologramCrosshairProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(DESKTOP_MQ).matches,
  );
  const onHoverRef = useRef(onHoverWindowChange);
  onHoverRef.current = onHoverWindowChange;

  const syncPointer = useCallback((clientX: number, clientY: number) => {
    setPos({ x: clientX, y: clientY });
    onHoverRef.current(findHoloWindowIdFromPoint(clientX, clientY));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isDesktop) onHoverRef.current(null);
  }, [isDesktop]);

  useEffect(() => {
    if (!active) {
      onHoverRef.current(null);
      setPos(null);
      return;
    }

    const onMove = (e: PointerEvent) => {
      if (!window.matchMedia(DESKTOP_MQ).matches) return;
      syncPointer(e.clientX, e.clientY);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, syncPointer]);

  useEffect(() => {
    if (!active || !isDesktop) {
      document.body.classList.remove("holo-crosshair-cursor");
      return;
    }
    document.body.classList.add("holo-crosshair-cursor");
    return () => document.body.classList.remove("holo-crosshair-cursor");
  }, [active, isDesktop]);

  if (!active || !isDesktop || pos === null) return null;

  const { x: mx, y: my } = pos;

  return (
    <svg
      className="pointer-events-none fixed top-0 left-0 z-[150]"
      width="100%"
      height="100%"
      aria-hidden
    >
      {ARMS.map(([dx, dy], i) => (
        <line
          key={i}
          x1={mx + dx * S45 * ARM_GAP}
          y1={my + dy * S45 * ARM_GAP}
          x2={mx + dx * S45 * (ARM_GAP + ARM_LEN)}
          y2={my + dy * S45 * (ARM_GAP + ARM_LEN)}
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
