'use client';
import {useI18n} from '@/lib/i18n/context';

import {MapPOI} from './MapPOI';
import {useInquiryCopy} from '../components/inquiry-copy';
import type {MapPOIItem} from './supplementary-pois';

/** Official boarding point, verified 2026-10-15. Never the vessel's current location. */
export const yonaBoarding = {
  latitude:7.9672648,longitude:98.3909335,
  source:'https://yonabeach.com/location/',
  mapUrl:'https://maps.app.goo.gl/UxRPnzCuRNVWhfhr7',
  // Local Phuket coast fit; approximate illustration position, separate from GPS.
  artAnchor:{x:410,y:332},
} as const;
const shared={id:'yona-boarding',kind:'landmark',image:'/media/reference/yona-user-icon.webp',imageSize:66} as const;
const items:Record<'ru'|'en',MapPOIItem>={
  ru:{...shared,title:'YONA · посадка',shortLabel:'YONA · посадка',category:'Royal Phuket Marina',descriptions:['Точка посадки на трансфер до YONA Beach Club — Royal Phuket Marina.','Значок обозначает место посадки, а не текущее положение плавучего клуба.'],caution:'Место отправления уточняйте у YONA перед поездкой.',link:{href:yonaBoarding.mapUrl,label:'Открыть точку посадки на карте'}},
  en:{...shared,title:'YONA · boarding',shortLabel:'YONA · boarding',category:'Royal Phuket Marina',descriptions:['Board the transfer to YONA Beach Club at Royal Phuket Marina.','This icon marks the boarding point, not the floating club’s current position.'],caution:'Confirm the departure point with YONA before travelling.',link:{href:yonaBoarding.mapUrl,label:'Open the boarding point on the map'}},
};
export function YonaBoardingPOI(){
 const {t:tr}=useI18n();
const {language}=useInquiryCopy();return <MapPOI item={items.ru} placement="art" anchor={yonaBoarding.artAnchor} placementNotice={language==='en'?'Position on the illustration is approximate.':tr("Расположение на иллюстрации схематичное.")}/>;}
