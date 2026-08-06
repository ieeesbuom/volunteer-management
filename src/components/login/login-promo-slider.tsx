"use client";

import Image from "next/image";
import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import { cn } from "@/lib/utils";

type LoginPromoSlide = {
  src: string;
  alt: string;
  width: number;
  height: number;
  headline: string;
  description: string;
};

const SLIDE_INTERVAL_MS = 6000;
const FADE_MS = 1000;

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function buildSlides(appName: string): LoginPromoSlide[] {
  return [
    {
      src: "/images/login/slide-committees.png",
      alt: "Volunteers collaborating on event committees",
      width: 960,
      height: 615,
      headline: "Run events with clear committees",
      description: `Assign chairs, leads, and members in one place so every ${appName} event stays coordinated from planning to wrap-up.`,
    },
    {
      src: "/images/login/slide-analytics.png",
      alt: "Team reviewing volunteer points and performance data",
      width: 960,
      height: 601,
      headline: "Track recognition with confidence",
      description: "See points, grades, and leaderboard trends so volunteer effort is visible, fair, and easy to celebrate.",
    },
    {
      src: "/images/login/slide-guidelines.png",
      alt: "Guidelines showing verified versus incomplete volunteer profiles",
      width: 880,
      height: 608,
      headline: "Follow branch guidelines by default",
      description: "Verified @uom.lk profiles, role rules, and audit-friendly workflows keep Student Branch operations consistent.",
    },
  ];
}

type LoginPromoSliderProps = {
  appName: string;
  className?: string;
};

export function LoginPromoSlider({ appName, className }: LoginPromoSliderProps) {
  const slides = buildSlides(appName);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const fadeDuration = reduceMotion ? 0 : FADE_MS;

  useEffect(() => {
    buildSlides(appName).forEach((slide) => {
      const img = new window.Image();
      img.src = slide.src;
    });
  }, [appName]);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [reduceMotion, slides.length]);

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      <div
        className="relative mx-auto aspect-[960/615] w-full max-w-[520px] bg-surface-raised"
        aria-live="polite"
        aria-atomic="true"
      >
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={slide.src}
              className={cn(
                "absolute inset-0 flex items-center justify-center will-change-[opacity]",
                isActive ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none",
              )}
              style={{
                transitionProperty: "opacity",
                transitionDuration: `${fadeDuration}ms`,
                transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              aria-hidden={!isActive}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                width={slide.width}
                height={slide.height}
                className="h-full w-full object-contain"
                priority={index === 0}
                sizes="(max-width: 1024px) 100vw, 520px"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-center gap-2" role="tablist" aria-label="Promo slides">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              key={slide.src}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show slide ${index + 1}: ${slide.headline}`}
              onClick={() => goToSlide(index)}
              className={cn(
                "cursor-pointer rounded-full transition-[width,background-color] duration-500 ease-in-out",
                isActive ? "h-2 w-7 bg-text-strong" : "size-2 bg-border-default hover:bg-border-strong",
              )}
            />
          );
        })}
      </div>

      <div className="relative mt-8 min-h-[128px] w-full max-w-md text-center">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={slide.src}
              className={cn(
                "absolute inset-x-0 top-0 will-change-[opacity]",
                isActive ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none",
              )}
              style={{
                transitionProperty: "opacity",
                transitionDuration: `${fadeDuration}ms`,
                transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              aria-hidden={!isActive}
            >
              <h2 className="text-[22px] font-bold leading-snug text-text-strong lg:text-[24px]">{slide.headline}</h2>
              <p className="mt-3 text-[14px] leading-6 text-text-muted">{slide.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
