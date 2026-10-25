'use client';
import {useI18n} from '@/lib/i18n/context';

import {useRef,useState,type ReactNode} from 'react';
import {TourArrivalChest} from './TourArrivalChest';
import {responsiveMedia} from '@/lib/public/media';
import {tourCover} from '@/lib/public/tour-cover';
import type {Tour} from '@/lib/public/types';

export function TourImage({src,alt='',tour,className='',eager=false,arrival=false,fallback,sizes='(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 30vw'}:
 {src:string|null;alt?:string;tour?:Pick<Tour,'id'|'slug'>;className?:string;eager?:boolean;arrival?:boolean;fallback?:ReactNode;sizes?:string}){
 const {t:tr}=useI18n();

 const cover=tour?tourCover(tour):null;
 const illustration=cover?.kind==='illustration';
 if(cover){src=cover.src;alt=cover.alt;}
 const [failed,setFailed]=useState<string|null>(null);
 const coverRef=useRef<HTMLImageElement>(null);
 if(!src||failed===src)return <>{fallback||<div className={'image-fallback '+className} role="img" aria-label={tr("Фотография пока недоступна")}><span>Double Bottle Co’</span></div>}</>;
 const meta=responsiveMedia[src];
 return <><img ref={coverRef} src={illustration?src+'?brand=doublebottle':src} alt={tr(alt)} className={className} data-media-kind={cover?.kind}
  style={illustration?{objectFit:'contain',backgroundColor:'#FFF1D3',transform:'none'}:undefined} width={meta?.width||1600}
  height={meta?.height||1067} srcSet={illustration?meta?.srcSet.replaceAll('.webp ','.webp?brand=doublebottle '):meta?.srcSet} sizes={meta?sizes:undefined}
  loading={eager?'eager':'lazy'} decoding="async" onError={()=>setFailed(src)}/>{arrival&&<TourArrivalChest key={tour?.id||src} coverRef={coverRef}/>}</>;
}
