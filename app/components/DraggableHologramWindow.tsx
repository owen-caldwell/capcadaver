"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

const HologramWindowStackContext = createContext<{
  bump: () => number;
} | null>(null);

/** Kept for API compat — no longer drives z-stack since panels are static. */
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

const SPAWN_DURATION_MS = 560;
const SPAWN_STAGGER_MS = 140;
const SPAWN_START_SCALE = 0.07;

type HologramWindowProps = {
  panelRef: RefObject<HTMLDivElement | null>;
  onPositionChange: () => void;
  className?: string;
  children: ReactNode;
  spawnShellRef?: RefObject<HTMLElement | null>;
  orbShellPxRef?: RefObject<{ x: number; y: number }>;
  splashHidden?: boolean;
  windowSpawnAllowed?: boolean;
  spawnOrder?: number;
  holoWindowId?: string;
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
}: HologramWindowProps) {
  const spawnDeltaRef = useRef({ x: 0, y: 0 });
  const [spawnAnimToken, setSpawnAnimToken] = useState(0);
  const [spawnE, setSpawnE] = useState(1);

  const assignRef = useCallback(
    (el: HTMLDivElement | null) => {
      const r = panelRef as React.MutableRefObject<HTMLDivElement | null>;
      r.current = el;
    },
    [panelRef],
  );

  useLayoutEffect(() => {
    onPositionChange();
  }, [onPositionChange]);

  const spawnFromOrb =
    windowSpawnAllowed && Boolean(spawnShellRef && orbShellPxRef);

  const preOrbSpawnHidden = splashHidden && !windowSpawnAllowed;

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
  }, [spawnFromOrb, windowSpawnAllowed, spawnShellRef, orbShellPxRef, panelRef]);

  useEffect(() => {
    if (!spawnFromOrb || spawnAnimToken === 0) return;

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
  }, [spawnAnimToken, spawnFromOrb, spawnOrder, onPositionChange]);

  const dimClass = dimmed ? "hologram-window-dimmed" : "";

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
    preOrbSpawnHidden || waitingSpawnMeasure
      ? 0
      : spawnFromOrb && spawnAnimToken > 0
        ? spawnE
        : undefined;
  const spawning = spawnFromOrb && spawnAnimToken > 0 && spawnE < 1;
  const blockPointer = preOrbSpawnHidden || waitingSpawnMeasure || spawning;

  const spawnScale = waitingSpawnMeasure
    ? SPAWN_START_SCALE
    : spawnFromOrb && spawnAnimToken > 0
      ? SPAWN_START_SCALE + (1 - SPAWN_START_SCALE) * spawnE
      : 1;

  return (
    <div
      ref={assignRef}
      className={`flex-col ${className} ${dimClass}`.trim()}
      {...(holoWindowId !== undefined
        ? { "data-holo-window": holoWindowId }
        : {})}
      style={{
        transform: `translate(${sx}px, ${sy}px) scale(${spawnScale})`,
        transformOrigin: "center center",
        opacity: spawnOpacity,
        pointerEvents: blockPointer ? "none" : undefined,
        willChange:
          preOrbSpawnHidden || spawning ? "transform, opacity" : undefined,
      }}
    >
      {children}
    </div>
  );
}
