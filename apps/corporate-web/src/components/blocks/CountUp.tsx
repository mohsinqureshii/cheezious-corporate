'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Count-up animation for statistics.
 *
 * Three things this gets right that a naive implementation does not:
 *
 *   1. The final value is rendered on the server and is the initial state. If
 *      JavaScript never runs, or the element never enters the viewport, the
 *      correct number is still on screen — the animation is an enhancement, not
 *      the means of display.
 *   2. `prefers-reduced-motion` skips the animation entirely rather than merely
 *      shortening it.
 *   3. Formatting (commas, "+", "K") comes from the CMS string, so the animation
 *      interpolates the number but the final frame is exactly what the editor
 *      typed.
 */

export interface CountUpProps {
  /** Numeric target, parsed from the display string. */
  value: number;
  /** Exactly what the editor entered, e.g. "12,000+". Shown when idle and at the end. */
  display: string;
  durationMs?: number;
}

export function CountUp({ value, display, durationMs = 1400 }: CountUpProps) {
  // Starts at the final value: server-rendered output is always correct.
  const [rendered, setRendered] = useState(display);
  const ref = useRef<HTMLSpanElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || hasRun.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // IntersectionObserver is unavailable in some embedded browsers; leaving the
    // final value in place is the correct fallback.
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasRun.current) return;

        hasRun.current = true;
        observer.disconnect();

        const startedAt = performance.now();
        // Decimal places are preserved so "1.2" does not animate to "1".
        const decimals = (display.split('.')[1]?.replace(/[^0-9]/g, '') ?? '').length;

        const tick = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / durationMs);
          // Ease-out cubic: fast start, gentle settle.
          const eased = 1 - (1 - progress) ** 3;

          if (progress >= 1) {
            setRendered(display);
            return;
          }

          const current = value * eased;
          setRendered(
            current.toLocaleString('en-PK', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            }),
          );
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [value, display, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {rendered}
    </span>
  );
}
