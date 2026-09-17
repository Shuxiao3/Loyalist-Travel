"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./HomeHero.module.css";

export type HeroSlide = {
  kind: "review" | "hotel" | "program" | "article";
  eyebrow: string;
  image?: string | null;
  meta: string[];
  title: string;
  text?: string | null;
  figure?: { value: string; label: string } | null;
  cta: string;
  href: string;
};

const INTERVAL_MS = 8000;
const HOLD_MS = 3000;
const SWIPE_PX = 40;

// The homepage hero. The panel on the right rotates through the slides
// with a crossfade; the photograph behind the navy follows the active
// slide. Auto-advance pauses under a mouse pointer and while a slide has
// keyboard focus; touch never pauses it. Under prefers-reduced-motion it
// still rotates, without the fade (see the stylesheet).
export function HomeHero({
  slides,
  children,
  stats,
}: {
  slides: HeroSlide[];
  children: React.ReactNode;
  stats: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const hovering = useRef(false);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [slides.length, paused, active]);

  const go = useCallback((i: number) => setActive(i), []);
  const photo = slides[active]?.image;

  // A swipe or arrow key moves one slide and holds the auto-advance for a
  // moment so the chosen slide can be read.
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = useCallback(
    (dir: 1 | -1) => {
      setActive((i) => (i + dir + slides.length) % slides.length);
      setPaused(true);
      if (hold.current) clearTimeout(hold.current);
      hold.current = setTimeout(() => {
        if (!hovering.current) setPaused(false);
      }, HOLD_MS);
    },
    [slides.length],
  );
  useEffect(
    () => () => {
      if (hold.current) clearTimeout(hold.current);
    },
    [],
  );

  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5)
      step(dx < 0 ? 1 : -1);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <header
      className={`hero ${styles.hero}`}
      style={
        photo
          ? ({ "--hero-photo": `url(${photo})` } as React.CSSProperties)
          : undefined
      }
    >
      <div className={`wrap ${styles.wrap}`}>
        <div className={styles.grid}>
          <div>{children}</div>

          {slides.length > 0 && (
            <div className={styles.column}>
              <section
                className={styles.panel}
                aria-roledescription="carousel"
                aria-label="Highlights"
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") {
                    hovering.current = true;
                    setPaused(true);
                  }
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") {
                    hovering.current = false;
                    setPaused(false);
                  }
                }}
                onFocus={(e) => {
                  if (e.target.matches(":focus-visible")) setPaused(true);
                }}
                onBlur={() => {
                  if (!hovering.current) setPaused(false);
                }}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                  swipe.current = null;
                }}
                onKeyDown={onKeyDown}
              >
                <div className={styles.stack}>
                  {slides.map((s, i) => (
                    <article
                      key={s.kind + s.href}
                      className={`${styles.slide} ${i === active ? styles.on : ""}`}
                      aria-hidden={i !== active}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${i + 1} of ${slides.length}: ${s.eyebrow}`}
                    >
                      <span className="eyebrow">{s.eyebrow}</span>
                      <div
                        className={styles.img}
                        role="img"
                        aria-label={s.title}
                        style={
                          s.image
                            ? {
                                backgroundImage: `url(${s.image}), var(--img-a)`,
                              }
                            : undefined
                        }
                      />
                      {s.meta.length > 0 && (
                        <div className={styles.meta}>
                          {s.meta.map((m, j) => (
                            <span key={m}>
                              {j > 0 && <span className="dot">· </span>}
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                      <h3 className={styles.title}>{s.title}</h3>
                      {s.text && <p className={styles.text}>{s.text}</p>}
                      <div className={styles.foot}>
                        {s.figure ? (
                          <div
                            className={
                              /^[\d.,]+%?$/.test(s.figure.value)
                                ? styles.figure
                                : styles.figureText
                            }
                          >
                            {s.figure.value}
                            <small>{s.figure.label}</small>
                          </div>
                        ) : (
                          <span />
                        )}
                        <Link
                          className={styles.read}
                          href={s.href}
                          tabIndex={i === active ? 0 : -1}
                        >
                          {s.cta}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              {slides.length > 1 && (
                <div
                  className={styles.dots}
                  role="tablist"
                  aria-label="Choose a highlight"
                >
                  {slides.map((s, i) => (
                    <button
                      key={s.kind + s.href}
                      type="button"
                      role="tab"
                      aria-selected={i === active}
                      aria-label={s.eyebrow}
                      className={`${styles.dot} ${i === active ? styles.dotOn : ""}`}
                      onClick={() => go(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {stats}
      </div>
    </header>
  );
}
