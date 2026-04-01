"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, useGLTF } from "@react-three/drei";
import {
  ChromaticAberration,
  EffectComposer,
} from "@react-three/postprocessing";
import { Box3, Group, Vector2, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import {
  DraggableHologramWindow,
  HologramWindowStackProvider,
} from "./DraggableHologramWindow";
import { HologramCrosshair } from "./HologramCrosshair";
import ModelViewer, { type NdcPoint } from "./ModelViewer";

type Artist = {
  id: string;
  name: string;
  url: string | null;
};

type Event = {
  id: string;
  date: string | null;
  artist: string | null;
  venue: string | null;
  city: string | null;
  ticket_url: string | null;
  notes: string | null;
};

type HologramPageProps = {
  artists: Artist[];
  upcomingEvent: Event | null;
  pastEvents: Event[];
  bio: string;
  contactInfo: string;
  contentByKey: Record<string, string>;
};

function normalizedUrl(url: string | null) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function toNdc(value: number, size: number) {
  return (value / size) * 2 - 1;
}

function panelToNdc(panelRect: DOMRect, shellRect: DOMRect): NdcPoint[] {
  const left = panelRect.left - shellRect.left;
  const right = panelRect.right - shellRect.left;
  const top = panelRect.top - shellRect.top;
  const bottom = panelRect.bottom - shellRect.top;
  return [
    { x: toNdc(left, shellRect.width), y: -toNdc(top, shellRect.height) },
    { x: toNdc(right, shellRect.width), y: -toNdc(top, shellRect.height) },
    { x: toNdc(right, shellRect.width), y: -toNdc(bottom, shellRect.height) },
    { x: toNdc(left, shellRect.width), y: -toNdc(bottom, shellRect.height) },
  ];
}

const CAPCAD_HEAD_GLTF = "/capcad-head/Cap36-NoRoot-Small.gltf";

/** 1:1 NYC map asset (viewBox = pixel coordinates). */
const NYC_MAP_SRC = "/nyc-map-2.png";
const NYC_MAP_VIEW = 1024;
/** Marker in image pixel space (matches nyc-map.png). */
const LAST_KNOWN_MAP_DOT = { x: 337.5, y: 678.5 };
const LAST_KNOWN_VENUE_LABEL = "Anthology Film Archives";
const LAST_KNOWN_VENUE_URL = "https://www.anthologyfilmarchives.org/";
/** Font sizes in viewBox units so text reads ~13/11px at 440px map width. */
const MAP_FS = (px: number) => (px * NYC_MAP_VIEW) / 440;
/** Legacy radar was 220×220 UI; scale so HUD reads the same at ~220px CSS size. */
const RADAR_UI_SCALE = NYC_MAP_VIEW / 220;
/** Radar centered on map; geometry extends past viewBox so rings clip at frame. */
const RADAR = { cx: NYC_MAP_VIEW / 2, cy: NYC_MAP_VIEW / 2 };
const RADAR_OUTER_R = 172 * RADAR_UI_SCALE;
const RADAR_RING_COUNT = 15;
const RADAR_RING_FRAC = Array.from(
  { length: RADAR_RING_COUNT },
  (_, i) => (i + 1) / RADAR_RING_COUNT,
);
const RADAR_RING_STROKE_THIN = 0.32 * RADAR_UI_SCALE;
const RADAR_RING_STROKE_OUTER = 0.48 * RADAR_UI_SCALE;
const RADAR_DOT_R_CORE = 2.5 * RADAR_UI_SCALE;
const RADAR_DOT_R_RING = 6 * RADAR_UI_SCALE;
/** Coordinates sit just right of the pulse ring. */
const MAP_BESIDE_DOT_X = LAST_KNOWN_MAP_DOT.x + RADAR_DOT_R_RING + MAP_FS(5);
/** Map label / dot accent (must match `.map-blink-dot-*` in globals.css). */
const MAP_ACCENT = "#e41e1e";

const PORTRAIT_ROTATE_SPEED = 0.8;
const PORTRAIT_WORLD_UP = new Vector3(0, 0, 1);

/** RGB-style shift via chromatic aberration (no dot-screen dither). */
function PortraitPostFx() {
  return (
    <EffectComposer multisampling={0}>
      <ChromaticAberration offset={new Vector2(0.001, 0.001)} />
    </EffectComposer>
  );
}

function CaptainCadaverPortrait() {
  const turntableRef = useRef<Group>(null);
  const { scene } = useGLTF(CAPCAD_HEAD_GLTF);
  /**
   * Reparent glTF off Scene, stand upright for +Z camera, then axis-align bbox center to
   * local origin so world-Y spin runs through the head’s middle.
   */
  const modelRoot = useMemo(() => {
    const src = SkeletonUtils.clone(scene);
    const root = new Group();
    root.name = "CapPortraitRoot";
    while (src.children.length > 0) {
      root.add(src.children[0]);
    }
    root.rotation.set(-Math.PI / 2, 0, 0);
    root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root);
    if (!box.isEmpty()) {
      const center = new Vector3();
      const size = new Vector3();
      box.getCenter(center);
      box.getSize(size);
      root.position.sub(center);
      root.userData.portraitBounds = {
        size: { x: size.x, y: size.y, z: size.z },
        centerBeforeAlign: {
          x: center.x,
          y: center.y,
          z: center.z,
        },
      };
    }
    return root;
  }, [scene]);

  useFrame((_, delta) => {
    if (!turntableRef.current) return;
    turntableRef.current.rotateOnWorldAxis(
      PORTRAIT_WORLD_UP,
      delta * PORTRAIT_ROTATE_SPEED,
    );
  });

  return (
    <Bounds clip observe margin={1.2} fit={false}>
      <group ref={turntableRef}>
        <primitive object={modelRoot} />
      </group>
    </Bounds>
  );
}

useGLTF.preload(CAPCAD_HEAD_GLTF);

export default function HologramPage({
  artists,
  upcomingEvent,
  pastEvents,
  bio,
  contactInfo,
  contentByKey,
}: HologramPageProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const orbShellPxRef = useRef({ x: 0, y: 0 });
  const infoRef = useRef<HTMLDivElement>(null);
  const artistsRef = useRef<HTMLDivElement>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const pastRef = useRef<HTMLDivElement>(null);
  const [projectionTargetsNdc, setProjectionTargetsNdc] = useState<NdcPoint[]>(
    [],
  );
  const [sceneReady, setSceneReady] = useState(false);
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  /** True after splash opacity transition (see `.splash-screen` 350ms) so window spawn does not overlap the fade. */
  const [windowSpawnAllowed, setWindowSpawnAllowed] = useState(false);
  const [hoveredHoloWindowId, setHoveredHoloWindowId] = useState<string | null>(
    null,
  );

  const onHoverHoloWindowChange = useCallback((id: string | null) => {
    setHoveredHoloWindowId(id);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinDurationElapsed(true);
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const completionPhase = sceneReady && minDurationElapsed && !splashHidden;

  useEffect(() => {
    if (!completionPhase) return;

    const timer = window.setTimeout(() => {
      setSplashHidden(true);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [completionPhase]);

  useEffect(() => {
    if (!splashHidden) {
      setWindowSpawnAllowed(false);
      return;
    }
    const id = window.setTimeout(() => setWindowSpawnAllowed(true), 380);
    return () => window.clearTimeout(id);
  }, [splashHidden]);

  const updateProjectionTargets = useCallback(() => {
    const shellEl = shellRef.current;
    if (!shellEl) return;
    const shellRect = shellEl.getBoundingClientRect();
    if (shellRect.width === 0 || shellRect.height === 0) return;

    const panelEls = [
      infoRef.current,
      artistsRef.current,
      upcomingRef.current,
      locationRef.current,
      pastRef.current,
    ].filter(Boolean) as HTMLDivElement[];

    const targets = panelEls.flatMap((panelEl) =>
      panelToNdc(panelEl.getBoundingClientRect(), shellRect),
    );
    setProjectionTargetsNdc(targets);
  }, []);

  useEffect(() => {
    const shellEl = shellRef.current;
    if (!shellEl) return;

    const resizeObserver = new ResizeObserver(updateProjectionTargets);
    resizeObserver.observe(shellEl);
    [
      infoRef.current,
      artistsRef.current,
      upcomingRef.current,
      locationRef.current,
      pastRef.current,
    ].forEach((panel) => {
      if (panel) resizeObserver.observe(panel);
    });
    window.addEventListener("resize", updateProjectionTargets);
    window.addEventListener("scroll", updateProjectionTargets, true);
    updateProjectionTargets();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateProjectionTargets);
      window.removeEventListener("scroll", updateProjectionTargets, true);
    };
  }, [updateProjectionTargets]);

  const showSplash = !splashHidden;
  /** `null` until client mount so SSR + first paint match (avoid Date.now() hydration mismatch). */
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    const eventDate = upcomingEvent?.date;
    if (!eventDate) return null;
    const target = new Date(`${eventDate}T00:00:00`).getTime();
    if (Number.isNaN(target)) return null;
    if (nowMs === null) {
      return {
        isLive: false,
        days: "--",
        hours: "--",
        minutes: "--",
        seconds: "--",
      };
    }

    const diff = Math.max(0, target - nowMs);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return {
      isLive: diff === 0,
      days: String(days).padStart(2, "0"),
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    };
  }, [nowMs, upcomingEvent]);

  const subjectName = contentByKey.dossier_name || "UNKNOWN SUBJECT";
  const subjectAlias = contentByKey.dossier_alias || "GHOST PROTOCOL";
  const subjectHeight = contentByKey.dossier_height || "182 cm";
  const subjectWeight = contentByKey.dossier_weight || "79 kg";
  const subjectBloodType = contentByKey.dossier_blood_type || "AB-";
  const subjectStatus = contentByKey.dossier_status || "AT LARGE";
  const subjectOrigin = contentByKey.dossier_origin || "Sector Nine";
  const lastKnownCoordinates =
    contentByKey.last_known_coordinates || "40.7246, -73.9901";

  return (
    <>
      <svg
        width={0}
        height={0}
        className="pointer-events-none fixed top-0 left-0"
        style={{ width: 0, height: 0, overflow: "hidden" }}
        aria-hidden
      >
        <defs>
          <filter
            id="holo-screen-bloom"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="10"
              result="holoBloomBlur"
            />
            <feColorMatrix
              in="holoBloomBlur"
              type="matrix"
              values="1.55 0 0 0 0.04
                      0 1.48 0 0 0.03
                      0 0 1.62 0 0.045
                      0 0 0 1.25 0"
              result="holoBloomGlow"
            />
            <feMerge>
              <feMergeNode in="holoBloomGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div
        ref={shellRef}
        className="relative min-h-screen overflow-hidden holo-fullscreen-bloom"
        aria-busy={showSplash}
      >
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${showSplash ? "opacity-0" : "opacity-100"}`}
          aria-hidden={showSplash}
        >
          <ModelViewer
            projectionTargetsNdc={projectionTargetsNdc}
            onSceneReady={() => setSceneReady(true)}
            orbShellPxRef={orbShellPxRef}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 hologram-grid opacity-65" />

        <div
          className={`splash-screen ${showSplash ? "splash-screen-visible" : "splash-screen-hidden"}`}
          aria-hidden={!showSplash}
        >
          <div className="splash-screen-inner" role="status" aria-live="polite">
            <p className="font-cyber-display splash-screen-title">CAPCADAVER</p>
            <p className="splash-screen-subtitle">
              {completionPhase
                ? "Finalizing holographic interface..."
                : "Initializing projection matrix..."}
            </p>
            <div className="splash-progress-track">
              <div
                className={`splash-progress-bar ${completionPhase ? "splash-progress-bar-completing" : ""}`}
              />
            </div>
          </div>
        </div>

        <HologramWindowStackProvider>
          <main className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center gap-4 p-4 md:p-6">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
              <DraggableHologramWindow
                panelRef={infoRef}
                onPositionChange={updateProjectionTargets}
                className="hologram-window relative p-4"
                spawnShellRef={shellRef}
                orbShellPxRef={orbShellPxRef}
                splashHidden={splashHidden}
                windowSpawnAllowed={windowSpawnAllowed}
                spawnOrder={0}
                holoWindowId="dossier"
                dimmed={
                  hoveredHoloWindowId !== null &&
                  hoveredHoloWindowId !== "dossier"
                }
              >
                <div className="hologram-corner hologram-corner-tl" />
                <div className="hologram-corner hologram-corner-tr" />
                <div className="hologram-corner hologram-corner-bl" />
                <div className="hologram-corner hologram-corner-br" />
                <p className="font-cyber-display text-[11px] tracking-[0.28em] text-white/85">
                  SUBJECT DOSSIER
                </p>
                <div className="mt-3 flex flex-col md:flex-row gap-4">
                  <div className="border border-white/25 bg-white/5 p-2 mx-auto w-full max-w-[min(100%,360px)] aspect-square md:mx-0 md:w-[320px] md:h-[320px] md:max-w-none md:shrink-0">
                    <Canvas
                      className="h-full w-full"
                      dpr={[1, 1.5]}
                      frameloop="always"
                      camera={{ position: [0, 12, 0], fov: 10 }}
                    >
                      <color attach="background" args={["#000000"]} />
                      {/*
                    webgpu_postprocessing.html: Scene fog + lights.
                    Original uses Fog(0x000000, 1, 1000) at ~400-unit scale; near/far
                    tightened here so falloff reads in the small portrait frustum.
                  */}
                      <fog attach="fog" args={["#000000", 0, 14]} />
                      <ambientLight color="#cccccc" intensity={15} />
                      <Suspense fallback={null}>
                        <CaptainCadaverPortrait />
                      </Suspense>
                      <PortraitPostFx />
                    </Canvas>
                  </div>
                  <div className="text-sm text-white/90">
                    <p className="font-cyber-display text-xl text-white">
                      {subjectName}
                    </p>
                    <p className="mt-1 text-white/75">Alias: {subjectAlias}</p>
                    <div className="mt-3 space-y-1">
                      <p>
                        <span className="text-white/70">Height:</span>{" "}
                        {subjectHeight}
                      </p>
                      <p>
                        <span className="text-white/70">Weight:</span>{" "}
                        {subjectWeight}
                      </p>
                      <p>
                        <span className="text-white/70">Blood Type:</span>{" "}
                        {subjectBloodType}
                      </p>
                      <p>
                        <span className="text-white/70">Origin:</span>{" "}
                        {subjectOrigin}
                      </p>
                      <p>
                        <span className="text-white/70">Status:</span>{" "}
                        {subjectStatus}
                      </p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-white/80">
                      {bio || "No extended intelligence available."}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-xs">
                  <Link href="/admin" className="hologram-link">
                    ADMIN
                  </Link>
                  <Link href="/contact" className="hologram-link">
                    CONTACT HANDLER
                  </Link>
                </div>
              </DraggableHologramWindow>

              <DraggableHologramWindow
                panelRef={upcomingRef}
                onPositionChange={updateProjectionTargets}
                className="hologram-window relative p-4"
                spawnShellRef={shellRef}
                orbShellPxRef={orbShellPxRef}
                splashHidden={splashHidden}
                windowSpawnAllowed={windowSpawnAllowed}
                spawnOrder={1}
                holoWindowId="countdown"
                dimmed={
                  hoveredHoloWindowId !== null &&
                  hoveredHoloWindowId !== "countdown"
                }
              >
                <div className="hologram-corner hologram-corner-tl" />
                <div className="hologram-corner hologram-corner-tr" />
                <div className="hologram-corner hologram-corner-bl" />
                <div className="hologram-corner hologram-corner-br" />
                <h3 className="font-cyber-display mb-3 text-[11px] uppercase tracking-[0.22em] text-white/85">
                  Primary Operation Countdown
                </h3>
                {!upcomingEvent ? (
                  <p className="text-sm text-white/75">
                    No active operation scheduled.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="font-countdown text-5xl leading-none tracking-[0.12em] tabular-nums text-white md:text-6xl">
                      {countdown?.isLive
                        ? "LIVE NOW"
                        : `${countdown?.days ?? "00"}:${countdown?.hours ?? "00"}:${countdown?.minutes ?? "00"}:${countdown?.seconds ?? "00"}`}
                    </p>
                    <div className="border-t border-white/25 pt-3 text-sm text-white/90">
                      <p>
                        <span className="text-white/75">Date:</span>{" "}
                        {upcomingEvent.date ?? "TBD"}
                      </p>
                      <p>
                        <span className="text-white/75">Artist:</span>{" "}
                        {upcomingEvent.artist ?? "TBA"}
                      </p>
                      <p>
                        <span className="text-white/75">Venue:</span>{" "}
                        {upcomingEvent.venue ?? "Venue TBA"}
                      </p>
                      <p>
                        <span className="text-white/75">City:</span>{" "}
                        {upcomingEvent.city ?? "City TBA"}
                      </p>
                      {upcomingEvent.notes ? (
                        <p className="mt-2 text-white/80">
                          {upcomingEvent.notes}
                        </p>
                      ) : null}
                      {contactInfo ? (
                        <p className="mt-2 text-white/75">{contactInfo}</p>
                      ) : null}
                      <div className="mt-3">
                        {upcomingEvent.ticket_url ? (
                          <a
                            href={
                              normalizedUrl(upcomingEvent.ticket_url) ??
                              undefined
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hologram-link"
                          >
                            GET TICKETS
                          </a>
                        ) : (
                          <span className="text-white/70">
                            Ticket link coming soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </DraggableHologramWindow>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DraggableHologramWindow
                panelRef={artistsRef}
                onPositionChange={updateProjectionTargets}
                className="hologram-window relative p-4"
                spawnShellRef={shellRef}
                orbShellPxRef={orbShellPxRef}
                splashHidden={splashHidden}
                windowSpawnAllowed={windowSpawnAllowed}
                spawnOrder={2}
                holoWindowId="accomplices"
                dimmed={
                  hoveredHoloWindowId !== null &&
                  hoveredHoloWindowId !== "accomplices"
                }
              >
                <div className="hologram-corner hologram-corner-tl" />
                <div className="hologram-corner hologram-corner-tr" />
                <div className="hologram-corner hologram-corner-bl" />
                <div className="hologram-corner hologram-corner-br" />
                <h2 className="font-cyber-display text-[11px] uppercase tracking-[0.22em] text-white/85">
                  Known Accomplices
                </h2>
                {artists.length === 0 ? (
                  <p className="mt-3 text-sm text-white/70">
                    No accomplices logged.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-white/90">
                    {artists.map((artist) => (
                      <li
                        key={artist.id}
                        className="flex items-center gap-3 border border-white/20 bg-white/5 p-2"
                      >
                        <div className="flex h-10 w-10 items-center justify-center border border-white/25 text-xs text-white/85">
                          {artist.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {artist.url ? (
                            <a
                              href={normalizedUrl(artist.url) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hologram-link"
                            >
                              {artist.name}
                            </a>
                          ) : (
                            <p className="truncate">{artist.name}</p>
                          )}
                          <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                            Mugshot Reference
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </DraggableHologramWindow>

              <DraggableHologramWindow
                panelRef={locationRef}
                onPositionChange={updateProjectionTargets}
                className="hologram-window relative p-4"
                spawnShellRef={shellRef}
                orbShellPxRef={orbShellPxRef}
                splashHidden={splashHidden}
                windowSpawnAllowed={windowSpawnAllowed}
                spawnOrder={3}
                holoWindowId="location"
                dimmed={
                  hoveredHoloWindowId !== null &&
                  hoveredHoloWindowId !== "location"
                }
              >
                <div className="hologram-corner hologram-corner-tl" />
                <div className="hologram-corner hologram-corner-tr" />
                <div className="hologram-corner hologram-corner-bl" />
                <div className="hologram-corner hologram-corner-br" />
                <h3 className="font-cyber-display mb-3 text-[11px] uppercase tracking-[0.22em] text-white/85">
                  Last Known Location
                </h3>
                <div className="border border-white/25 bg-white/5">
                  <svg
                    viewBox={`0 0 ${NYC_MAP_VIEW} ${NYC_MAP_VIEW}`}
                    overflow="hidden"
                    className="aspect-square max-w-full"
                    role="img"
                    aria-label={`NYC map: ${LAST_KNOWN_VENUE_LABEL}, ${lastKnownCoordinates}`}
                  >
                    <image
                      href={NYC_MAP_SRC}
                      x={0}
                      y={0}
                      width={NYC_MAP_VIEW}
                      height={NYC_MAP_VIEW}
                      preserveAspectRatio="xMidYMid meet"
                    />
                    <g fill="none" strokeLinecap="round">
                      {RADAR_RING_FRAC.map((frac, i) => (
                        <circle
                          key={i}
                          cx={RADAR.cx}
                          cy={RADAR.cy}
                          r={RADAR_OUTER_R * frac}
                          stroke="rgba(255, 255, 255, 0.28)"
                          strokeWidth={
                            i === RADAR_RING_FRAC.length - 1
                              ? RADAR_RING_STROKE_OUTER
                              : RADAR_RING_STROKE_THIN
                          }
                        />
                      ))}
                    </g>
                    <text
                      x={MAP_BESIDE_DOT_X}
                      y={LAST_KNOWN_MAP_DOT.y}
                      textAnchor="start"
                      dominantBaseline="middle"
                      fill={MAP_ACCENT}
                      fontSize={MAP_FS(11)}
                      fontFamily="var(--font-b612-mono), ui-monospace, monospace"
                      letterSpacing="0.1em"
                    >
                      {lastKnownCoordinates}
                    </text>
                    <circle
                      cx={LAST_KNOWN_MAP_DOT.x}
                      cy={LAST_KNOWN_MAP_DOT.y}
                      r={RADAR_DOT_R_CORE}
                      className="map-blink-dot-core"
                    />
                    <circle
                      cx={LAST_KNOWN_MAP_DOT.x}
                      cy={LAST_KNOWN_MAP_DOT.y}
                      r={RADAR_DOT_R_RING}
                      className="map-blink-dot-ring"
                    />
                  </svg>
                </div>
                <p className="mt-2">
                  <a
                    href={LAST_KNOWN_VENUE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-cyber-display text-[11px] tracking-[0.12em] hologram-link hologram-link-venue"
                  >
                    {LAST_KNOWN_VENUE_LABEL}
                  </a>
                </p>
              </DraggableHologramWindow>
            </section>

            <section>
              <DraggableHologramWindow
                panelRef={pastRef}
                onPositionChange={updateProjectionTargets}
                className="hologram-window relative p-4"
                spawnShellRef={shellRef}
                orbShellPxRef={orbShellPxRef}
                splashHidden={splashHidden}
                windowSpawnAllowed={windowSpawnAllowed}
                spawnOrder={4}
                holoWindowId="archive"
                dimmed={
                  hoveredHoloWindowId !== null &&
                  hoveredHoloWindowId !== "archive"
                }
              >
                <div className="hologram-corner hologram-corner-tl" />
                <div className="hologram-corner hologram-corner-tr" />
                <div className="hologram-corner hologram-corner-bl" />
                <div className="hologram-corner hologram-corner-br" />
                <h3 className="font-cyber-display mb-3 text-[11px] uppercase tracking-[0.22em] text-white/80">
                  Archived Operations
                </h3>
                {pastEvents.length === 0 ? (
                  <p className="text-sm text-white/70">No past events.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-white/80">
                      <thead>
                        <tr className="border-b border-white/25">
                          <th className="py-2 pr-4 font-medium">Date</th>
                          <th className="py-2 pr-4 font-medium">Artist</th>
                          <th className="py-2 pr-4 font-medium">Venue</th>
                          <th className="py-2 font-medium">City</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastEvents.map((event) => (
                          <tr
                            key={event.id}
                            className="border-y border-white/20"
                          >
                            <td className="py-2 pr-4">{event.date ?? "TBD"}</td>
                            <td className="py-2 pr-4">
                              {event.artist ?? "TBA"}
                            </td>
                            <td className="py-2 pr-4">
                              {event.venue ?? "Venue TBA"}
                            </td>
                            <td className="py-2">{event.city ?? "City TBA"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DraggableHologramWindow>
            </section>
          </main>
          <HologramCrosshair
            active={splashHidden}
            onHoverWindowChange={onHoverHoloWindowChange}
          />
        </HologramWindowStackProvider>
      </div>
    </>
  );
}
