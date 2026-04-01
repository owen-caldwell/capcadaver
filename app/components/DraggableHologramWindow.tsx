"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

const HologramWindowStackContext = createContext<{
  bump: () => number;
} | null>(null);

/** Wrap desktop hologram layout so panels can call bump() and paint above siblings (borders over lower windows). */
export function HologramWindowStackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const counter = useRef(24);
  const bump = useCallback(() => {
    counter.current += 1;
    return counter.current;
  }, []);
  return (
    <HologramWindowStackContext.Provider value={{ bump }}>
      {children}
    </HologramWindowStackContext.Provider>
  );
}

/** Matches Tailwind `md` — panels stay layout-fixed on small screens. */
const MOBILE_MQ = "(max-width: 767px)";

/** Jitter each window on load so they overlap like a messy desktop (desktop only). */
function randomDesktopOffset() {
  return {
    x: Math.round((Math.random() - 0.5) * 340),
    y: Math.round((Math.random() - 0.5) * 280),
  };
}

const SPAWN_DURATION_MS = 560;
const SPAWN_STAGGER_MS = 140;

/**
 * Clicking these should select, follow links, or interact — not start a panel drag.
 * Covers text copy, images, maps (svg), 3D (canvas), and form controls.
 */
function isPointerOnNonDraggableContent(target: EventTarget | null): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? (target.parentElement ?? null)
        : null;
  if (!el) return false;

  if (
    el.closest(
      [
        "a[href]",
        "button",
        "input",
        "textarea",
        "select",
        "option",
        "label",
        "img",
        "picture",
        "canvas",
        "video",
        "audio",
        "iframe",
        "svg",
        '[role="button"]',
        '[role="link"]',
        '[role="tab"]',
        "[contenteditable]",
        "table",
        "thead",
        "tbody",
        "tr",
        "td",
        "th",
        "summary",
        "details",
      ].join(","),
    )
  ) {
    return true;
  }

  if (
    el.closest(
      [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "span",
        "pre",
        "code",
        "blockquote",
        "figcaption",
        "time",
      ].join(","),
    )
  ) {
    return true;
  }

  return false;
}

type DraggableHologramWindowProps = {
  panelRef: RefObject<HTMLDivElement | null>;
  onPositionChange: () => void;
  className?: string;
  children: ReactNode;
  /** Shell bounds for orb-relative spawn (desktop, after splash). */
  spawnShellRef?: RefObject<HTMLElement | null>;
  orbShellPxRef?: RefObject<{ x: number; y: number }>;
  /** Splash overlay has started hiding (state flip). */
  splashHidden?: boolean;
  /** Splash CSS fade finished — window spawn may begin (see HologramPage delay). */
  windowSpawnAllowed?: boolean;
  /** 0-based order for sequential spawn from the orb. */
  spawnOrder?: number;
  /** Identifies the panel for crosshair hit-testing (`data-holo-window`). */
  holoWindowId?: string;
  /** When another panel is focused by the crosshair, this panel is de-emphasized. */
  dimmed?: boolean;
};

export function DraggableHologramWindow({
  panelRef,
  onPositionChange,
  className = "",
  children,
  spawnShellRef,
  orbShellPxRef,
  splashHidden = false,
  windowSpawnAllowed = false,
  spawnOrder = 0,
  holoWindowId,
  dimmed = false,
}: DraggableHologramWindowProps) {
  const stackCtx = useContext(HologramWindowStackContext);
  const [isMobile, setIsMobile] = useState(false);
  const desktopOffsetSeeded = useRef(false);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  /** Same baseline for all panels; later siblings win until pointer raises this via bump(). */
  const [stackZ, setStackZ] = useState(10);
  const spawnDeltaRef = useRef({ x: 0, y: 0 });
  const [spawnAnimToken, setSpawnAnimToken] = useState(0);
  const [spawnE, setSpawnE] = useState(1);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const assignRef = useCallback(
    (el: HTMLDivElement | null) => {
      const r = panelRef as React.MutableRefObject<HTMLDivElement | null>;
      r.current = el;
    },
    [panelRef],
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (!mobile && !desktopOffsetSeeded.current) {
        desktopOffsetSeeded.current = true;
        setOffset(randomDesktopOffset());
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useLayoutEffect(() => {
    onPositionChange();
  }, [offset, isMobile, onPositionChange]);

  const spawnFromOrb =
    windowSpawnAllowed && !isMobile && Boolean(spawnShellRef && orbShellPxRef);

  const holdPanelsDuringSplashFade =
    splashHidden &&
    !windowSpawnAllowed &&
    !isMobile &&
    Boolean(spawnShellRef && orbShellPxRef);

  useLayoutEffect(() => {
    if (!spawnFromOrb || !spawnShellRef || !orbShellPxRef) {
      setSpawnAnimToken(0);
      setSpawnE(1);
      return;
    }

    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const shell = spawnShellRef.current;
        const el = panelRef.current;
        if (!shell || !el) return;
        const s = shell.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - s.left;
        const cy = r.top + r.height / 2 - s.top;
        const o = orbShellPxRef.current;
        spawnDeltaRef.current = { x: o.x - cx, y: o.y - cy };
        setSpawnE(0);
        setSpawnAnimToken((t) => t + 1);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [
    spawnFromOrb,
    windowSpawnAllowed,
    isMobile,
    spawnShellRef,
    orbShellPxRef,
    panelRef,
  ]);

  useEffect(() => {
    if (!spawnFromOrb || spawnAnimToken === 0 || isMobile) return;

    let raf = 0;
    const startWall = performance.now();
    const order = spawnOrder;
    const ease = (u: number) => 1 - (1 - u) ** 3;

    const step = (now: number) => {
      const local = now - startWall - order * SPAWN_STAGGER_MS;
      if (local < 0) {
        setSpawnE(0);
        onPositionChange();
        raf = requestAnimationFrame(step);
        return;
      }
      const u = Math.min(1, local / SPAWN_DURATION_MS);
      const e = ease(u);
      setSpawnE(e);
      onPositionChange();
      if (u < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [spawnAnimToken, spawnFromOrb, spawnOrder, isMobile, onPositionChange]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (isPointerOnNonDraggableContent(e.target)) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: offset.x,
        origY: offset.y,
      };
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [offset.x, offset.y],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setOffset({
      x: d.origX + (e.clientX - d.startX),
      y: d.origY + (e.clientY - d.startY),
    });
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const bringToFront = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (stackCtx) setStackZ(stackCtx.bump());
    },
    [stackCtx],
  );

  const dimClass = dimmed ? "hologram-window-dimmed" : "";

  if (isMobile) {
    return (
      <div
        ref={assignRef}
        className={`${className} ${dimClass}`.trim()}
        {...(holoWindowId !== undefined
          ? { "data-holo-window": holoWindowId }
          : {})}
      >
        {children}
      </div>
    );
  }

  const waitingSpawnMeasure =
    windowSpawnAllowed && spawnFromOrb && spawnAnimToken === 0;
  const sx =
    spawnFromOrb && spawnAnimToken > 0
      ? (1 - spawnE) * spawnDeltaRef.current.x
      : 0;
  const sy =
    spawnFromOrb && spawnAnimToken > 0
      ? (1 - spawnE) * spawnDeltaRef.current.y
      : 0;
  const spawnOpacity =
    holdPanelsDuringSplashFade || waitingSpawnMeasure
      ? 0
      : spawnFromOrb && spawnAnimToken > 0
        ? 0.06 + 0.94 * spawnE
        : undefined;
  const spawning = spawnFromOrb && spawnAnimToken > 0 && spawnE < 1;
  const blockPointer =
    holdPanelsDuringSplashFade || waitingSpawnMeasure || spawning;

  return (
    <div
      ref={assignRef}
      className={`${className} ${dimClass} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`.trim()}
      {...(holoWindowId !== undefined
        ? { "data-holo-window": holoWindowId }
        : {})}
      title="Drag empty panel area to reposition"
      onPointerDownCapture={bringToFront}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        transform: `translate(${offset.x + sx}px, ${offset.y + sy}px)`,
        opacity: spawnOpacity,
        zIndex: isDragging ? stackZ + 50 : stackZ,
        touchAction: "none",
        pointerEvents: blockPointer ? "none" : undefined,
        willChange:
          holdPanelsDuringSplashFade || spawning
            ? "transform, opacity"
            : undefined,
      }}
    >
      {children}
    </div>
  );
}
