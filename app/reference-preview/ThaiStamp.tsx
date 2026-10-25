'use client';

import {useEffect, useState} from 'react';
import styles from './ThaiStamp.module.css';

// Classified from the supplied images: postage stamps and transparent postal marks.
const postageStamps = [1,2,3,4,5,7,8,10,11,12,14,15,17,18,19,20];
const postmarks = [6,9,13,16];
type PostalPair = {stamp: number; postmark: number};
let documentPair: PostalPair | undefined;

function choose(ids: number[], storageKey: string) {
  let previous = -1;
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored !== null && /^\d+$/.test(stored)) previous = Number(stored);
  } catch { /* The decoration also works with browser storage disabled. */ }
  const candidates = ids.filter(id => id !== previous);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  try { sessionStorage.setItem(storageKey, String(selected)); } catch { /* Optional memory only. */ }
  return selected;
}

/** Choose both layers once per document; keep the composition still while viewing. */
function chooseDocumentPair() {
  if (!documentPair) documentPair = {
    stamp: choose(postageStamps, 'double-bottle-co:previous-postage-stamp'),
    postmark: choose(postmarks, 'double-bottle-co:previous-postmark'),
  };
  return documentPair;
}

export function ThaiStamp() {
  const [pair, setPair] = useState<PostalPair | null>(null);
  useEffect(() => { setPair(chooseDocumentPair()); }, []);
  if (pair === null) return null;
  return <div className={styles.stamp} data-thai-stamp={pair.stamp} aria-hidden="true">
    <div className={styles.layers}>
      <img className={styles.postage} src={`/media/thai-stamps/stamp-${String(pair.stamp).padStart(2, '0')}.webp`}
        alt="" width={240} height={240} draggable={false} decoding="async" />
      <img className={styles.postmark} data-thai-postmark={pair.postmark}
        src={`/media/thai-stamps/stamp-${String(pair.postmark).padStart(2, '0')}.webp`}
        alt="" width={240} height={240} draggable={false} decoding="async" />
    </div>
  </div>;
}
