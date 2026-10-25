'use client';

import {useI18n} from '@/lib/i18n/context';
import {cheowLanMapCopy, cheowLanMapPath} from '@/lib/public/cheow-lan-map';
import {busMapObject,mapPlacementImageSize,mapPlacementDisplayImage} from '@/lib/public/map-layout';
import {useMapPlacement} from './MapLayoutContext';
import styles from './CheowLanMapLink.module.css';
import shortcut from './MapShortcutLabel.module.css';

/** An editorial page shortcut, not a geographic marker or a transport offer. */
export function CheowLanMapLink() {
  const {locale, href} = useI18n();
  const placement=useMapPlacement(busMapObject.id)||busMapObject,size=mapPlacementImageSize(placement);
  const text = cheowLanMapCopy[locale];
  return <a className={styles.link} style={{left:placement.x+'%',top:placement.y+'%',width:(size/1280*100)+'%'}} href={href(cheowLanMapPath)} aria-label={text.open} data-cheow-lan-map-link>
    <span className={styles.icon} aria-hidden="true"><img className={styles.minibus} src={mapPlacementDisplayImage(placement)} alt="" draggable={false}/></span>
    <span className={`${shortcut.label} ${styles.label}`}>{text.title}<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" color="#153552" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="4.5" cy="18.5" r="2"/><path d="M7 18.5h3.2a3.3 3.3 0 0 0 0-6.6H7.8a3.3 3.3 0 0 1 0-6.6h8.7" strokeDasharray="2.5 3.4"/><circle cx="19" cy="5.3" r="2.6" fill="currentColor" stroke="none"/></svg></span>
  </a>;
}
