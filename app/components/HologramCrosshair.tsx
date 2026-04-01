"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MOBILE_MQ = "(max-width: 767px)";
const DESKTOP_MQ = "(min-width: 768px)";

type HologramCrosshairProps = {
  /** When false, overlay and listeners are disabled (e.g. during splash). */
  active: boolean;
  onHoverWindowChange: (windowId: string | null) => void;
};

function findHoloWindowIdFromPoint(
  x: number,
  y: number,
): { id: string | null; el: HTMLElement | null } {
  const stack = document.elementsFromPoint(x, y);
  for (const node of stack) {
    if (node instanceof HTMLElement && node.dataset.holoWindow) {
      return { id: node.dataset.holoWindow, el: node };
    }
  }
  return { id: null, el: null };
}

type LineSeg = { x1: number; y1: number; x2: number; y2: number };

function horizontalOutsideWindow(
  my: number,
  vw: number,
  r: DOMRect,
): LineSeg[] {
  const crossesY = my >= r.top && my <= r.bottom;
  if (!crossesY) return [{ x1: 0, y1: my, x2: vw, y2: my }];
  const out: LineSeg[] = [];
  if (r.left > 0) out.push({ x1: 0, y1: my, x2: r.left, y2: my });
  if (r.right < vw) out.push({ x1: r.right, y1: my, x2: vw, y2: my });
  return out;
}

function verticalOutsideWindow(mx: number, vh: number, r: DOMRect): LineSeg[] {
  const crossesX = mx >= r.left && mx <= r.right;
  if (!crossesX) return [{ x1: mx, y1: 0, x2: mx, y2: vh }];
  const out: LineSeg[] = [];
  if (r.top > 0) out.push({ x1: mx, y1: 0, x2: mx, y2: r.top });
  if (r.bottom < vh) out.push({ x1: mx, y1: r.bottom, x2: mx, y2: vh });
  return out;
}

function segVisible(s: LineSeg): boolean {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 0.5;
}

/**
 * Full-viewport crosshair: center dot + horizontal/vertical lines to viewport edges.
 * Over a `[data-holo-window]` panel, lines stop at the panel edge (outside only); the
 * interior is left empty.
 */
export function HologramCrosshair({
  active,
  onHoverWindowChange,
}: HologramCrosshairProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 0, h: 0 },
  );
  const [clipRect, setClipRect] = useState<DOMRect | null>(null);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches,
  );
  const onHoverRef = useRef(onHoverWindowChange);
  onHoverRef.current = onHoverWindowChange;

  const syncPointer = useCallback((clientX: number, clientY: number) => {
    setPos({ x: clientX, y: clientY });
    const { id, el } = findHoloWindowIdFromPoint(clientX, clientY);
    onHoverRef.current(id);
    setClipRect(el ? el.getBoundingClientRect() : null);
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
      setClipRect(null);
      setPos(null);
      return;
    }

    const mq = window.matchMedia(MOBILE_MQ);
    const setV = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });

    const onMove = (e: PointerEvent) => {
      if (mq.matches) return;
      syncPointer(e.clientX, e.clientY);
    };

    setV();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", setV, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", setV);
    };
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
  const { w: vw, h: vh } = viewport;
  if (vw <= 0 || vh <= 0) return null;

  const hSegs = clipRect
    ? horizontalOutsideWindow(my, vw, clipRect)
    : [{ x1: 0, y1: my, x2: vw, y2: my }];
  const vSegs = clipRect
    ? verticalOutsideWindow(mx, vh, clipRect)
    : [{ x1: mx, y1: 0, x2: mx, y2: vh }];

  const stroke = "rgba(255, 255, 255, 0.88)";

  return (
    <svg
      className="pointer-events-none fixed top-0 left-0 z-[150]"
      width={vw || "100%"}
      height={vh || "100%"}
      aria-hidden
    >
      {hSegs.filter(segVisible).map((hLine, i) => (
        <line
          key={`h-${i}`}
          x1={hLine.x1}
          y1={hLine.y1}
          x2={hLine.x2}
          y2={hLine.y2}
          stroke={stroke}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {vSegs.filter(segVisible).map((vLine, i) => (
        <line
          key={`v-${i}`}
          x1={vLine.x1}
          y1={vLine.y1}
          x2={vLine.x2}
          y2={vLine.y2}
          stroke={stroke}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <circle cx={mx} cy={my} r={1.25} fill="rgba(255, 255, 255, 0.95)" />
    </svg>
  );
}
