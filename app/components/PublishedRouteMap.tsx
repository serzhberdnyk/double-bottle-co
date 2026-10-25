'use client';

import {useI18n} from '@/lib/i18n/context';
import {mapPointColors,mapRouteLinePoints,type MapRoute} from '@/lib/public/map-layout';
import {mapRouteCopy} from './map-route-copy';
import styles from './PublishedRouteMap.module.css';

/** The same source-art plane is used in the editor, main map and tour page. */
export function PublishedRouteOverlay({routes}:{routes:MapRoute[]}) {
  const {locale}=useI18n();
  const copy=mapRouteCopy[locale];
  if(!routes.length)return null;
  return <div className={styles.overlay} data-editor-map-routes>
    <svg className={styles.lines} viewBox="0 0 1280 1083" role="img" aria-label={copy.schematic}>
      {routes.map(route=><polyline key={route.id} data-route-id={route.id} points={mapRouteLinePoints(route)} fill="none" stroke={route.color==='sea'?'#4bd4f1':'#c5e877'} strokeWidth={3} strokeDasharray={route.style==='dashed'?'10 8':undefined} vectorEffect="non-scaling-stroke"><title>{route.title}</title></polyline>)}
    </svg>
    {routes.flatMap(route=>route.points.map((point,index)=><span key={route.id+'-'+index} className={styles.point} data-route-point={route.id+'-'+index} style={{left:point.x+'%',top:point.y+'%',backgroundColor:mapPointColors[point.color||'cream']}} title={`${route.title}: ${point.label||copy.point+' '+(index+1)}`} aria-hidden="true">{index+1}</span>))}
  </div>;
}

/** Text and colour are both provided: colour alone never conveys a point name. */
export function PublishedRouteLegend({routes,linkTours=false}:{routes:MapRoute[];linkTours?:boolean}) {
  const {locale,href}=useI18n();
  const copy=mapRouteCopy[locale];
  return <div className={styles.legend} data-map-route-legend>
    {routes.map(route=><section key={route.id} className={styles.routeLegend} aria-label={route.title}>
      <h3><span className={styles.lineKey} style={{borderColor:route.color==='sea'?'#4bd4f1':'#c5e877',borderTopStyle:route.style==='dashed'?'dashed':'solid'}} aria-hidden="true"/>{route.title}</h3>
      {route.closed&&<p className={styles.notice}>{copy.closed}</p>}
      {linkTours&&route.tour&&<a className={styles.tourLink} href={href('/tour/'+encodeURIComponent(route.tour.slug))}>{copy.openTour}: {route.tour.title}</a>}
      <ol>{route.points.map((point,index)=><li key={index}><span className={styles.legendPoint} style={{backgroundColor:mapPointColors[point.color||'cream']}} aria-hidden="true">{index+1}</span><span>{point.label||copy.point+' '+(index+1)}</span></li>)}</ol>
    </section>)}
  </div>;
}

/** Only explicitly attached, published routes are supplied by the server. */
export function PublishedTourRoutes({routes}:{routes:MapRoute[]}) {
  const {locale}=useI18n();
  const copy=mapRouteCopy[locale];
  if(!routes.length)return null;
  return <div className={styles.tourRoutes} data-tour-route-map>
    <p className={styles.notice}>{copy.schematic}</p>
    <div className={styles.canvas}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/media/reference/andaman-user-map.png" alt={copy.tourMap} loading="lazy" decoding="async" width={1280} height={1083}/>
      <PublishedRouteOverlay routes={routes}/>
    </div>
    <PublishedRouteLegend routes={routes}/>
  </div>;
}
