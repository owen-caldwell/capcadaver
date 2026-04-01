"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
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

function DnaPointCloud() {
  const pointsRef = useRef<THREE.Points>(null);
  const [mobileLayout, setMobileLayout] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobileLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const [geometry] = useState(() => {
    const turns = 10;
    const pointsPerTurn = 65;
    const radius = 0.42;
    const verticalScale = 0.08;
    const pairCount = turns * pointsPerTurn;
    const vertices: number[] = [];

    for (let i = 0; i < pairCount; i += 1) {
      const t = (i / pointsPerTurn) * Math.PI * 2;
      const y = (i - pairCount / 2) * verticalScale;

      // Strand A
      vertices.push(Math.cos(t) * radius, y, Math.sin(t) * radius);
      // Strand B (phase-shifted by PI)
      vertices.push(
        Math.cos(t + Math.PI) * radius,
        y,
        Math.sin(t + Math.PI) * radius,
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  });

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.4;
    pointsRef.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.35) * 0.12;
  });

  return (
    <group rotation={[0, 0, mobileLayout ? Math.PI / 2 : 0]}>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="red"
          size={0.052}
          sizeAttenuation
          transparent
          opacity={1}
        />
      </points>
    </group>
  );
}

export default function HologramPage({
  artists,
  upcomingEvent,
  pastEvents,
  bio,
  contactInfo,
  contentByKey,
}: HologramPageProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const artistsRef = useRef<HTMLDivElement>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const pastRef = useRef<HTMLDivElement>(null);
  const [projectionTargetsNdc, setProjectionTargetsNdc] = useState<NdcPoint[]>(
    [],
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReducedMotion(media.matches);
    updateReducedMotion();
    media.addEventListener("change", updateReducedMotion);
    return () => media.removeEventListener("change", updateReducedMotion);
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
    const shellEl = shellRef.current;
    if (!shellEl) return;

    const updateTargets = () => {
      const shellRect = shellEl.getBoundingClientRect();
      if (shellRect.width === 0 || shellRect.height === 0) return;

      const panelEls = [
        infoRef.current,
        artistsRef.current,
        upcomingRef.current,
        locationRef.current,
        pastRef.current,
      ].filter(Boolean);
      const targets = panelEls.flatMap((panelEl) =>
        panelToNdc(panelEl!.getBoundingClientRect(), shellRect),
      );
      setProjectionTargetsNdc(targets);
    };

    const resizeObserver = new ResizeObserver(updateTargets);
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
    window.addEventListener("resize", updateTargets);
    updateTargets();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateTargets);
    };
  }, []);

  const emitterType = useMemo(
    () => (reducedMotion ? "orb" : "pyramid"),
    [reducedMotion],
  );
  const showSplash = !splashHidden;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
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
    contentByKey.last_known_coordinates || "40.7831, -73.9712";
  const lastKnownDistrict =
    contentByKey.last_known_location || "Manhattan, New York";

  return (
    <>
      <div
        ref={shellRef}
        className={`relative min-h-screen overflow-hidden ${!reducedMotion ? "holo-fullscreen-bloom" : ""}`}
        aria-busy={showSplash}
      >
        <div
          className={`pointer-events-auto absolute inset-0 transition-opacity duration-300 ${showSplash ? "opacity-0" : "opacity-100"}`}
          aria-hidden={showSplash}
        >
          <ModelViewer
            projectionTargetsNdc={projectionTargetsNdc}
            emitterType={emitterType}
            reducedMotion={reducedMotion}
            onSceneReady={() => setSceneReady(true)}
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

        <main className="pointer-events-none relative z-10 mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center gap-4 p-4 md:p-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
            <div ref={infoRef} className="hologram-window relative p-4">
              <div className="hologram-corner hologram-corner-tl" />
              <div className="hologram-corner hologram-corner-tr" />
              <div className="hologram-corner hologram-corner-bl" />
              <div className="hologram-corner hologram-corner-br" />
              <p className="font-cyber-display text-[11px] tracking-[0.28em] text-cyan-200/85">
                SUBJECT DOSSIER
              </p>
              <div className="mt-3 flex flex-col md:flex-row gap-4">
                <div className="border border-cyan-300/20 bg-cyan-900/10 p-2 w-full h-[200px] md:w-[200px] md:h-[300px]">
                  <Canvas
                    dpr={[1, 1.5]}
                    camera={{ position: [0, 0, 2.8], fov: 45 }}
                  >
                    <DnaPointCloud />
                  </Canvas>
                </div>
                <div className="text-sm text-cyan-50/90">
                  <p className="font-cyber-display text-xl text-cyan-100">
                    {subjectName}
                  </p>
                  <p className="mt-1 text-cyan-200/75">Alias: {subjectAlias}</p>
                  <div className="mt-3 space-y-1">
                    <p>
                      <span className="text-cyan-200/70">Height:</span>{" "}
                      {subjectHeight}
                    </p>
                    <p>
                      <span className="text-cyan-200/70">Weight:</span>{" "}
                      {subjectWeight}
                    </p>
                    <p>
                      <span className="text-cyan-200/70">Blood Type:</span>{" "}
                      {subjectBloodType}
                    </p>
                    <p>
                      <span className="text-cyan-200/70">Origin:</span>{" "}
                      {subjectOrigin}
                    </p>
                    <p>
                      <span className="text-cyan-200/70">Status:</span>{" "}
                      {subjectStatus}
                    </p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-cyan-100/80">
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
            </div>

            <div ref={upcomingRef} className="hologram-window relative p-4">
              <div className="hologram-corner hologram-corner-tl" />
              <div className="hologram-corner hologram-corner-tr" />
              <div className="hologram-corner hologram-corner-bl" />
              <div className="hologram-corner hologram-corner-br" />
              <h3 className="font-cyber-display mb-3 text-[11px] uppercase tracking-[0.22em] text-cyan-200/85">
                Primary Operation Countdown
              </h3>
              {!upcomingEvent ? (
                <p className="text-sm text-cyan-100/75">
                  No active operation scheduled.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="font-cyber-display text-5xl leading-none tracking-[0.08em] text-cyan-100 md:text-6xl">
                    {countdown?.isLive
                      ? "LIVE NOW"
                      : `${countdown?.days ?? "00"}:${countdown?.hours ?? "00"}:${countdown?.minutes ?? "00"}:${countdown?.seconds ?? "00"}`}
                  </p>
                  <div className="border-t border-cyan-300/20 pt-3 text-sm text-cyan-50/90">
                    <p>
                      <span className="text-cyan-200/75">Date:</span>{" "}
                      {upcomingEvent.date ?? "TBD"}
                    </p>
                    <p>
                      <span className="text-cyan-200/75">Artist:</span>{" "}
                      {upcomingEvent.artist ?? "TBA"}
                    </p>
                    <p>
                      <span className="text-cyan-200/75">Venue:</span>{" "}
                      {upcomingEvent.venue ?? "Venue TBA"}
                    </p>
                    <p>
                      <span className="text-cyan-200/75">City:</span>{" "}
                      {upcomingEvent.city ?? "City TBA"}
                    </p>
                    {upcomingEvent.notes ? (
                      <p className="mt-2 text-cyan-100/80">
                        {upcomingEvent.notes}
                      </p>
                    ) : null}
                    {contactInfo ? (
                      <p className="mt-2 text-cyan-100/75">{contactInfo}</p>
                    ) : null}
                    <div className="mt-3">
                      {upcomingEvent.ticket_url ? (
                        <a
                          href={
                            normalizedUrl(upcomingEvent.ticket_url) ?? undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hologram-link"
                        >
                          GET TICKETS
                        </a>
                      ) : (
                        <span className="text-cyan-100/70">
                          Ticket link coming soon
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div ref={artistsRef} className="hologram-window relative p-4">
              <div className="hologram-corner hologram-corner-tl" />
              <div className="hologram-corner hologram-corner-tr" />
              <div className="hologram-corner hologram-corner-bl" />
              <div className="hologram-corner hologram-corner-br" />
              <h2 className="font-cyber-display text-[11px] uppercase tracking-[0.22em] text-cyan-200/85">
                Known Accomplices
              </h2>
              {artists.length === 0 ? (
                <p className="mt-3 text-sm text-cyan-100/70">
                  No accomplices logged.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-cyan-50/90">
                  {artists.map((artist) => (
                    <li
                      key={artist.id}
                      className="flex items-center gap-3 border border-cyan-300/15 bg-cyan-950/20 p-2"
                    >
                      <div className="flex h-10 w-10 items-center justify-center border border-cyan-300/20 text-xs text-cyan-100/85">
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
                        <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-200/60">
                          Mugshot Reference
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div ref={locationRef} className="hologram-window relative p-4">
              <div className="hologram-corner hologram-corner-tl" />
              <div className="hologram-corner hologram-corner-tr" />
              <div className="hologram-corner hologram-corner-bl" />
              <div className="hologram-corner hologram-corner-br" />
              <h3 className="font-cyber-display mb-3 text-[11px] uppercase tracking-[0.22em] text-cyan-200/85">
                Last Known Location
              </h3>
              <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
                <div className="border border-cyan-300/20 bg-cyan-950/20 p-2">
                  <svg
                    viewBox="0 0 220 220"
                    className="h-[220px] w-full bg-[#020710]"
                    aria-label="Map of Manhattan with subject marker"
                  >
                    <rect x="0" y="0" width="220" height="220" fill="#020710" />
                    <g stroke="rgba(108, 233, 255, 0.18)" strokeWidth="1">
                      {Array.from({ length: 11 }).map((_, i) => (
                        <line
                          key={`v-${i}`}
                          x1={i * 22}
                          y1="0"
                          x2={i * 22}
                          y2="220"
                        />
                      ))}
                      {Array.from({ length: 11 }).map((_, i) => (
                        <line
                          key={`h-${i}`}
                          x1="0"
                          y1={i * 22}
                          x2="220"
                          y2={i * 22}
                        />
                      ))}
                    </g>
                    <path
                      d="M120 12 L136 42 L142 84 L140 126 L133 174 L118 208 L96 210 L84 182 L82 142 L88 94 L100 52 Z"
                      fill="rgba(87, 238, 255, 0.08)"
                      stroke="rgba(124, 241, 255, 0.7)"
                      strokeWidth="2"
                    />
                    <circle
                      cx="116"
                      cy="118"
                      r="5"
                      className="map-blink-dot-core"
                    />
                    <circle
                      cx="116"
                      cy="118"
                      r="12"
                      className="map-blink-dot-ring"
                    />
                  </svg>
                </div>
                <div className="text-sm text-cyan-50/90">
                  <p className="text-cyan-200/75">District</p>
                  <p className="font-cyber-display text-cyan-100">
                    {lastKnownDistrict}
                  </p>
                  <p className="mt-3 text-cyan-200/75">Coordinates</p>
                  <p className="font-cyber-display tracking-[0.08em] text-red-300">
                    {lastKnownCoordinates}
                  </p>
                  <p className="mt-3 text-xs text-cyan-100/75">
                    Marker pulse indicates latest confirmed sighting in the
                    Manhattan AO.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section ref={pastRef} className="hologram-window relative p-4">
            <div className="hologram-corner hologram-corner-tl" />
            <div className="hologram-corner hologram-corner-tr" />
            <div className="hologram-corner hologram-corner-bl" />
            <div className="hologram-corner hologram-corner-br" />
            <h3 className="font-cyber-display mb-3 text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
              Archived Operations
            </h3>
            {pastEvents.length === 0 ? (
              <p className="text-sm text-cyan-100/70">No past events.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-cyan-100/80">
                  <thead>
                    <tr className="border-b border-cyan-300/20">
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
                        className="border-y border-cyan-300/15"
                      >
                        <td className="py-2 pr-4">{event.date ?? "TBD"}</td>
                        <td className="py-2 pr-4">{event.artist ?? "TBA"}</td>
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
          </section>
        </main>
      </div>
    </>
  );
}
