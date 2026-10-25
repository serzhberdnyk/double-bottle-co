'use client';

import {useId, useRef, useState} from 'react';
import {ArrowLeft, Maximize2, Minus, Plus} from 'lucide-react';
import {useI18n} from '@/lib/i18n/context';
import {cheowLanMapCopy} from '@/lib/public/cheow-lan-map';
import {Header, Footer} from '../components/SiteChrome';
import styles from './cheow-lan.module.css';

/** The existing Phi Phi viewer's scroll/zoom pattern, without its place overlays.
 * This source art is deliberately not projected onto the geographic map engine. */
export function CheowLanMapPage() {
  const {locale, href} = useI18n();
  const text = cheowLanMapCopy[locale];
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const mapId = useId();
  function reset() {
    setZoom(1);
    viewport.current?.scrollTo({left:0, top:0, behavior:'instant'});
  }
  return <div className={styles.page}>
    <Header/>
    <main className={styles.main}>
      <a className={styles.back} href={href('/#andaman-map')}><ArrowLeft size={18} aria-hidden="true"/>{text.back}</a>
      <header className={styles.heading}>
        <span className={styles.eyebrow}>PHUKET &amp; BEYOND</span>
        <h1>{text.title}</h1>
      </header>
      <figure className={styles.figure}>
        <div className={styles.toolbar}>
          <div className={styles.zoomControls}>
            <button type="button" onClick={()=>setZoom(value=>Math.max(1,value-.5))} disabled={zoom===1} aria-label={text.zoomOut} aria-controls={mapId}><Minus size={20} aria-hidden="true"/></button>
            <span className={styles.zoom} role="status" aria-live="polite" aria-atomic="true"><span className="sr-only">{text.zoom}: </span>{Math.round(zoom*100)}%</span>
            <button type="button" onClick={()=>setZoom(value=>Math.min(3,value+.5))} disabled={zoom===3} aria-label={text.zoomIn} aria-controls={mapId}><Plus size={20} aria-hidden="true"/></button>
          </div>
          <button type="button" className={styles.reset} onClick={reset} aria-label={text.resetLabel} aria-controls={mapId}><Maximize2 size={17} aria-hidden="true"/>{text.reset}</button>
        </div>
        <div ref={viewport} id={mapId} className={styles.viewport} tabIndex={0} role="region" aria-label={text.map} aria-describedby={hintId} data-cheow-lan-map-viewport>
          <div className={styles.art} style={{width:`${zoom*100}%`,height:`${zoom*100}%`}}>
            <img src="/media/reference/cheow-lan-user-map.png" alt={text.alt} width={1692} height={930} draggable={false} fetchPriority="high" data-cheow-lan-map-image/>
          </div>
        </div>
        <figcaption className={styles.caption}><p id={hintId}>{text.hint}</p><small>{text.note}</small></figcaption>
      </figure>
    </main>
    <Footer/>
  </div>;
}
