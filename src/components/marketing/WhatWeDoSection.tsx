"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ServiceVisual } from "./ServiceVisual";
import {
  FALLOFF,
  HERO_CENTERS,
  HERO_SCALE_DESKTOP,
  HERO_SCALE_MOBILE,
  IDLE_DESKTOP,
  IDLE_MOBILE,
  PLATEAU,
  clamp,
  lerp,
  prominence,
} from "./whatWeDoMotion";

interface ResolvedOffset {
  x: number;
  y: number;
  rotate: number;
}

/**
 * Locked copy -- see the "What We Do" build prompt. Reproduce verbatim, do not edit here.
 */
const SERVICES = [
  {
    number: "01",
    titleLines: ["Websites &", "Landing Pages"],
    description: "Sites built to convert, load fast, and rank.",
    visual: "web",
  },
  {
    number: "02",
    titleLines: ["Internal Tools &", "Custom Apps"],
    description: "Software that runs a part of your business.",
    visual: "software",
  },
  {
    number: "03",
    titleLines: ["Automation, Integrations", "& Practical AI"],
    description: "Workflows and AI features that remove manual work, with a human review layer.",
    visual: "automation",
  },
] as const;

const MOBILE_QUERY = "(max-width: 767px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function ServiceCardBody({ index }: { index: number }) {
  const service = SERVICES[index];
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 h-28 w-36 rotate-3 opacity-90">
        <ServiceVisual kind={service.visual} />
      </div>
      <span className="text-xs font-bold tracking-[0.2em] text-blue-600">{service.number}</span>
      {/* `.site-content h3` (globals.css) sets a fixed 24px/600/12px-margin that out-specifies a
          bare utility class on the same element -- see HowItWorksSection.tsx for the same fix. */}
      <h3 className="!mb-0 !text-xl !font-extrabold leading-tight text-slate-900 sm:!text-2xl">
        {service.titleLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h3>
      <p className="!mb-0 mt-3 max-w-[220px] text-sm leading-relaxed text-slate-600">{service.description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors group-hover:text-blue-600">
        Explore
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </div>
  );
}

/** Static, CSS-only fallback: what renders with JS off, and what reduced-motion users get. */
function StaticLayout() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {SERVICES.map((service, i) => (
        <button
          key={service.number}
          type="button"
          aria-label={`Explore ${service.titleLines.join(" ")}`}
          className="group w-full text-left sm:h-[280px]"
        >
          <ServiceCardBody index={i} />
        </button>
      ))}
    </div>
  );
}

/** Full scroll-driven pinned experience, mounted only once motion is confirmed safe. */
function InteractiveLayout() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headingRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const idlePxRef = useRef<ResolvedOffset[]>([]);
  const isMobileRef = useRef(false);

  useEffect(() => {
    const recomputeIdle = () => {
      const isMobile = window.matchMedia(MOBILE_QUERY).matches;
      isMobileRef.current = isMobile;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const preset = isMobile ? IDLE_MOBILE : IDLE_DESKTOP;
      idlePxRef.current = preset.map((p) => ({ x: p.xFrac * vw, y: p.yFrac * vh, rotate: p.rotate }));
    };

    const applyFrame = (progress: number) => {
      const heroScale = isMobileRef.current ? HERO_SCALE_MOBILE : HERO_SCALE_DESKTOP;
      const proms = HERO_CENTERS.map((center) => prominence(progress, center, PLATEAU, FALLOFF));
      const globalActivity = Math.max(...proms);

      SERVICES.forEach((_, i) => {
        const card = cardRefs.current[i];
        const idle = idlePxRef.current[i];
        if (!card || !idle) return;
        const p = proms[i];
        const secondary = globalActivity * (1 - p);

        const scale = lerp(1, heroScale, p) * lerp(1, 0.86, secondary);
        const tx = lerp(idle.x, 0, p) + idle.x * 0.18 * secondary;
        const ty = lerp(idle.y, 0, p) + idle.y * 0.18 * secondary;
        const tz = lerp(0, 90, p) - 32 * secondary;
        const rotate = lerp(idle.rotate, 0, p);
        const opacity = 1 - 0.42 * secondary;
        const blur = 1.4 * secondary;

        card.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, ${tz.toFixed(2)}px) scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(2)}deg)`;
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
        card.style.zIndex = String(Math.round(10 + p * 30));
      });

      if (headingRef.current) {
        headingRef.current.style.opacity = (1 - 0.45 * globalActivity).toFixed(3);
      }
      if (dotRef.current) {
        dotRef.current.style.left = `${(clamp(progress, 0, 1) * 100).toFixed(2)}%`;
      }
      labelRefs.current.forEach((label, i) => {
        if (!label) return;
        const active = proms[i] > 0.5;
        label.style.color = active ? "#0F172A" : "#94A3B8";
        label.style.fontWeight = active ? "800" : "600";
      });
    };

    recomputeIdle();

    let frame = 0;
    const tick = () => {
      frame = 0;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const total = wrapper.offsetHeight - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      applyFrame(clamp(raw, 0, 1));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onResize = () => {
      recomputeIdle();
      onScroll();
    };

    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative h-[400vh]">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <div
          ref={headingRef}
          className="pointer-events-none absolute inset-x-0 top-12 px-6 text-center transition-opacity duration-300 sm:top-16"
        >
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <span aria-hidden="true" className="h-px w-6 bg-blue-600" />
            What We Do
          </div>
          {/* `.site-content h2` (globals.css) out-specifies a bare utility class on the same
              element -- see HowItWorksSection.tsx for the same fix. */}
          <h2 className="!mb-0 !text-2xl !font-extrabold leading-tight tracking-tight text-slate-900 sm:!text-3xl lg:!text-4xl">
            Three layers. Built to work
            <br className="hidden sm:block" /> together.
          </h2>
        </div>

        <div className="relative h-full w-full" style={{ perspective: "1600px" }}>
          {SERVICES.map((service, i) => (
            <div
              key={service.number}
              className="group absolute left-1/2 top-1/2 -ml-[140px] -mt-[130px] h-[260px] w-[280px] will-change-transform sm:-ml-[150px] sm:w-[300px]"
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
            >
              {/* Idle drift lives on its own layer (CSS keyframe, not JS), out of sync per card
                  via animation-delay, so it never fights the scroll-driven transform above it or
                  the hover-lift transform below it. */}
              <div className="h-full w-full animate-aequora-float" style={{ animationDuration: `${8 + i}s`, animationDelay: `${i * -3}s` }}>
                <button type="button" aria-label={`Explore ${service.titleLines.join(" ")}`} className="h-full w-full text-left">
                  <div className="h-full transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
                    <ServiceCardBody index={i} />
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex items-center justify-center gap-3 sm:bottom-10">
          {SERVICES.map((service, i) => (
            <span key={service.number} className="contents">
              <span
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
                className="text-xs font-semibold tracking-widest text-slate-400"
              >
                {service.number}
              </span>
              {i < SERVICES.length - 1 && (
                <span className="relative h-px w-10 bg-slate-200 sm:w-14">
                  {i === 0 && (
                    <span
                      ref={dotRef}
                      className="absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-blue-600"
                      style={{ left: "0%" }}
                    />
                  )}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WhatWeDoSection() {
  const [enhanced, setEnhanced] = useState(false);

  useLayoutEffect(() => {
    const reduce = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    if (!reduce) setEnhanced(true);
  }, []);

  return (
    // Full-bleed breakout: the page's shared <main> caps content at max-w-5xl, but the floating
    // composition needs real viewport width to read as spatial. This only affects this section's
    // own box, not the shared wrapper other sections still rely on.
    <section
      aria-label="What We Do"
      // `overflow-x-hidden` would force `overflow-y: auto` here (CSS: an axis can't stay
      // `visible` once the other isn't), which breaks the sticky child's viewport-relative
      // pinning below. `overflow-x-clip` avoids that pairing rule while still guarding against
      // the ~1px scrollbar-width overflow the 100vw breakout can introduce.
      className="relative left-1/2 right-1/2 w-screen -mx-[50vw] overflow-x-clip bg-slate-50 py-16 sm:py-20 lg:py-24"
    >
      {enhanced ? (
        <InteractiveLayout />
      ) : (
        <>
          <div className="mb-10 px-6 text-center sm:mb-14">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <span aria-hidden="true" className="h-px w-6 bg-blue-600" />
              What We Do
            </div>
            <h2 className="!mb-0 !text-2xl !font-extrabold leading-tight tracking-tight text-slate-900 sm:!text-3xl lg:!text-4xl">
              Three layers. Built to work
              <br className="hidden sm:block" /> together.
            </h2>
          </div>
          <div className="mx-auto max-w-5xl px-6">
            <StaticLayout />
          </div>
        </>
      )}
    </section>
  );
}
