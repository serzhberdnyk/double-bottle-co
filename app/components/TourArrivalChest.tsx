'use client';

import {useEffect, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import styles from './TourArrivalChest.module.css';

const CHEST_SRC = '/media/reference/tour-arrival-chest.png';
const DURATION_MS = 1700;
type CoverBounds = {left: number; top: number; width: number; height: number};

/** A single decorative arrival, clipped to the cover without changing its layout. */
export function TourArrivalChest({coverRef}: {coverRef: RefObject<HTMLImageElement | null>}) {
  const [bounds, setBounds] = useState<CoverBounds | null>(null);

  useEffect(() => {
    const cover = coverRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!cover || motion.matches) return;

    let cancelled = false;
    let active = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const updateBounds = () => {
      if (!active) return;
      const {left, top, width, height} = cover.getBoundingClientRect();
      setBounds({left, top, width, height});
    };
    const observer = new ResizeObserver(updateBounds);
    const stop = () => {
      cancelled = true;
      active = false;
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('scroll', updateBounds, true);
      window.removeEventListener('resize', updateBounds);
      setBounds(null);
    };
    const onMotionChange = () => { if (motion.matches) stop(); };
    motion.addEventListener('change', onMotionChange);

    const chest = new Image();
    chest.src = CHEST_SRC;
    Promise.all([cover.decode(), chest.decode()]).then(() => {
      if (cancelled || motion.matches) return;
      const rect = cover.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      active = true;
      updateBounds();
      observer.observe(cover);
      window.addEventListener('scroll', updateBounds, {capture: true, passive: true});
      window.addEventListener('resize', updateBounds);
      timer = setTimeout(stop, DURATION_MS + 100);
    }).catch(() => { /* Optional artwork must never interrupt the tour. */ });

    return () => {
      stop();
      motion.removeEventListener('change', onMotionChange);
    };
  }, [coverRef]);

  if (!bounds) return null;
  return createPortal(
    <div className={styles.viewport} style={bounds} aria-hidden="true" data-tour-arrival="chest">
      {/* The user's supplied PNG is kept intact. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.chest} src={CHEST_SRC} alt="" draggable={false} />
    </div>,
    document.body,
  );
}
