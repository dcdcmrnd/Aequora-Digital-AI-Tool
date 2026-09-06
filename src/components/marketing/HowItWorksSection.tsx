"use client";

import { useEffect, useId, useRef, useState } from "react";

import { isoSlab, roundedPolygonPath, type Point } from "./isoGeometry";

/**
 * Locked copy -- see the "How It Works" build prompt. Reproduce verbatim, do not edit here.
 */
const STEPS = [
  {
    number: "01",
    title: "Discover",
    body: "A quick call about your business and goals, then a fixed-price proposal within 24 hours.",
  },
  {
    number: "02",
    title: "Build",
    body: "We design and build your website. Your first draft is usually ready within 2 weeks.",
  },
  {
    number: "03",
    title: "Launch",
    body: "Once you approve the build, we launch your website live.",
  },
  {
    number: "04",
    title: "Grow",
    body: "We stay on for ongoing management, SEO, and improvements, so the site keeps earning its keep.",
  },
] as const;

const SLAB = { width: 150, depth: 90, height: 24 };
const TOP_RADIUS = 16;
const SIDE_RADIUS = 8;

// Desktop: 4 platforms across one panoramic plane, columns centered at 12.5/37.5/62.5/87.5%.
const DESKTOP_VIEWBOX = { minX: -20, minY: -20, w: 1200, h: 520 };
const DESKTOP_ORIGINS: Point[] = [0.125, 0.375, 0.625, 0.875].map((frac, i) => ({
  x: frac * 1160 - (SLAB.width - SLAB.depth) / 2,
  y: 300 - i * 70,
}));

// Tablet: two rows of two. Row two mirrors row one's columns (right, then left) so the
// connector snakes down one side and back rather than crossing the whole width diagonally.
const TABLET_VIEWBOX = { minX: -20, minY: -20, w: 680, h: 780 };
const TABLET_COL_LEFT = 0.2 * 640 - (SLAB.width - SLAB.depth) / 2;
const TABLET_COL_RIGHT = 0.8 * 640 - (SLAB.width - SLAB.depth) / 2;
const TABLET_ORIGINS: Point[] = [
  { x: TABLET_COL_LEFT, y: 260 },
  { x: TABLET_COL_RIGHT, y: 190 },
  { x: TABLET_COL_RIGHT, y: 520 },
  { x: TABLET_COL_LEFT, y: 450 },
];

const TEXT_OFFSETS_DESKTOP = [0, -24, -48, -72];

function gridPatternId(id: string) {
  return `iso-grid-${id}`;
}
function fadeMaskId(id: string) {
  return `iso-fade-${id}`;
}

function IsoBackgroundGrid({ uid, viewBox }: { uid: string; viewBox: { minX: number; minY: number; w: number; h: number } }) {
  return (
    <>
      <defs>
        <pattern id={gridPatternId(uid)} width="64" height="32" patternUnits="userSpaceOnUse">
          <path d="M0 16 L32 0 L64 16 L32 32 Z" fill="none" stroke="#E2E8F0" strokeWidth="1" />
        </pattern>
        <radialGradient id={fadeMaskId(uid)} cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={`${fadeMaskId(uid)}-mask`}>
          <rect x={viewBox.minX} y={viewBox.minY} width={viewBox.w} height={viewBox.h} fill={`url(#${fadeMaskId(uid)})`} />
        </mask>
      </defs>
      <rect
        x={viewBox.minX}
        y={viewBox.minY}
        width={viewBox.w}
        height={viewBox.h}
        fill={`url(#${gridPatternId(uid)})`}
        mask={`url(#${fadeMaskId(uid)}-mask)`}
        opacity={0.7}
      />
    </>
  );
}

function Platform({ origin, index, revealed }: { origin: Point; index: number; revealed: boolean }) {
  const slab = isoSlab(origin, SLAB.width, SLAB.depth, SLAB.height);
  const isAccent = index === 0;
  const topFill = isAccent ? "#2563EB" : "#F8FAFC";
  const topStroke = isAccent ? "#1D4ED8" : "#E2E8F0";
  const sideFill = isAccent ? "#1D4ED8" : "#E2E8F0";
  const edgeIdle = isAccent ? "#60A5FA" : "#CBD5E1";
  const numeralStroke = isAccent ? "#2563EB" : "#94A3B8";

  return (
    // Two independent transform layers so JS-driven entrance (inline style, always present
    // once mounted) and CSS-driven hover (Tailwind group-hover class) never fight over the
    // same `transform` property -- an inline style always wins over a class for one property.
    <g className="transition-transform duration-300 ease-out group-hover:-translate-y-1 motion-reduce:transition-none">
      <g
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
          transitionDelay: `${index * 100}ms`,
        }}
      >
        {/* soft grounding shadow */}
        <ellipse
          cx={slab.frontVertex.x - SLAB.width * 0.15}
          cy={slab.frontVertex.y + SLAB.height + 10}
          rx={SLAB.width * 0.42}
          ry={10}
          fill="#0F172A"
          opacity={0.08}
        />
        <path d={roundedPolygonPath(slab.side, SIDE_RADIUS)} fill={sideFill} />
        <path d={roundedPolygonPath(slab.top, TOP_RADIUS)} fill={topFill} stroke={topStroke} strokeWidth={1.5} />
        {/* accent edge highlight along the two front-facing edges, brightens on hover */}
        <path
          d={`M ${slab.top[0].x} ${slab.top[0].y} L ${slab.top[1].x} ${slab.top[1].y} L ${slab.top[2].x} ${slab.top[2].y}`}
          fill="none"
          stroke={edgeIdle}
          strokeWidth={2}
          strokeLinecap="round"
          className="transition-colors duration-300 group-hover:[stroke:#2563EB]"
        />
        <text
          x={slab.backVertex.x - 6}
          y={slab.backVertex.y + 22}
          fontSize={68}
          fontWeight={800}
          fill="none"
          stroke={numeralStroke}
          strokeWidth={2}
          fontFamily="Inter, sans-serif"
        >
          {STEPS[index].number}
        </text>
      </g>
    </g>
  );
}

function IsometricScene({
  origins,
  viewBox,
  revealed,
}: {
  origins: Point[];
  viewBox: { minX: number; minY: number; w: number; h: number };
  revealed: boolean[];
}) {
  const uid = useId();
  const connectorPoints = origins.map((o) => isoSlab(o, SLAB.width, SLAB.depth, SLAB.height).frontVertex);
  const connectorPath = connectorPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg
      aria-hidden="true"
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.w} ${viewBox.h}`}
      className="w-full h-auto"
      role="presentation"
    >
      <IsoBackgroundGrid uid={uid} viewBox={viewBox} />
      <path d={connectorPath} fill="none" stroke="#2563EB" strokeWidth={2} strokeDasharray="2 8" strokeLinecap="round" opacity={0.5} />
      {origins.map((origin, i) => (
        <g key={STEPS[i].number} className="group">
          <Platform origin={origin} index={i} revealed={revealed[i]} />
        </g>
      ))}
    </svg>
  );
}

function useStaggeredReveal(count: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(() => Array(count).fill(true));

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const node = containerRef.current;
    if (!node) return;

    setRevealed(Array(count).fill(false));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setRevealed(Array(count).fill(true));
          observer.disconnect();
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  return { containerRef, revealed };
}

export function HowItWorksSection() {
  const { containerRef, revealed } = useStaggeredReveal(STEPS.length);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="bg-slate-50 py-16 sm:py-20 lg:py-24" ref={containerRef}>
      <div className="mb-10 sm:mb-14">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <span aria-hidden="true" className="h-px w-6 bg-blue-600" />
          How It Works
        </div>
        {/* `.site-content h2` (globals.css) sets a fixed 30px/700 -- it out-specifies a bare
            utility class on the same element, so the sizes that actually need to win here (the
            responsive scale, the 800 weight) are marked `!important` via Tailwind's `!` prefix. */}
        <h2
          id={headingId}
          className="!text-3xl !font-extrabold tracking-tight text-slate-900 sm:!text-4xl lg:!text-5xl"
        >
          Four steps. <em className="font-semibold italic text-blue-600">No surprises.</em>
        </h2>
      </div>

      {/* Desktop: full panoramic isometric plane */}
      <div className="hidden lg:block">
        <IsometricScene origins={DESKTOP_ORIGINS} viewBox={DESKTOP_VIEWBOX} revealed={revealed} />
        <ol className="mt-6 grid !list-none grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <li
              key={step.number}
              className="max-w-[260px] border-l-2 border-slate-200 pl-4 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none"
              style={{
                opacity: revealed[i] ? 1 : 0,
                transform: revealed[i] ? `translateY(${TEXT_OFFSETS_DESKTOP[i]}px)` : `translateY(${TEXT_OFFSETS_DESKTOP[i] + 16}px)`,
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <h3 className="!mb-0 !text-lg !font-bold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Tablet: two staggered rows of two */}
      <div className="hidden md:block lg:hidden">
        <IsometricScene origins={TABLET_ORIGINS} viewBox={TABLET_VIEWBOX} revealed={revealed} />
        <ol className="mt-6 grid !list-none grid-cols-2 gap-x-8 gap-y-10">
          {STEPS.map((step, i) => (
            <li
              key={step.number}
              className="max-w-[260px] border-l-2 border-slate-200 pl-4 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none"
              style={{
                opacity: revealed[i] ? 1 : 0,
                transform: revealed[i] ? "translateY(0)" : "translateY(16px)",
                transitionDelay: `${i * 100}ms`,
                // Row two's SVG platforms sit right-then-left (a snaking connector, not a
                // diagonal crossing the whole width) -- reorder these two cells to match.
                order: i === 2 ? 2 : i === 3 ? 1 : 0,
              }}
            >
              <h3 className="!mb-0 !text-lg !font-bold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Mobile: single vertical column, slim connector, mini platform marker */}
      <ol className="relative !list-none space-y-8 md:hidden">
        <div aria-hidden="true" className="absolute bottom-2 left-[19px] top-2 w-px bg-slate-200" />
        {STEPS.map((step, i) => {
          const mini = isoSlab({ x: 6, y: 8 }, 26, 16, 6);
          const isAccent = i === 0;
          return (
            <li
              key={step.number}
              className="relative flex gap-4 pl-0 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none"
              style={{
                opacity: revealed[i] ? 1 : 0,
                transform: revealed[i] ? "translateY(0)" : "translateY(12px)",
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <div className="relative flex-none">
                <svg aria-hidden="true" viewBox="-6 -4 48 40" className="h-10 w-10">
                  <path
                    d={roundedPolygonPath(mini.side, 2)}
                    fill={isAccent ? "#1D4ED8" : "#E2E8F0"}
                  />
                  <path
                    d={roundedPolygonPath(mini.top, 4)}
                    fill={isAccent ? "#2563EB" : "#F8FAFC"}
                    stroke={isAccent ? "#1D4ED8" : "#CBD5E1"}
                    strokeWidth={1}
                  />
                </svg>
                <span
                  aria-hidden="true"
                  className={`absolute -left-1.5 -top-2 text-[11px] font-extrabold ${isAccent ? "text-blue-600" : "text-slate-400"}`}
                >
                  {step.number}
                </span>
              </div>
              <div className="border-l-2 border-slate-200 pb-1 pl-4">
                <span className="sr-only">Step {step.number}: </span>
                <h3 className="!mb-0 !text-lg !font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
