'use client';

import {useI18n} from '@/lib/i18n/context';
import {useId} from 'react';

export type GeoArtworkTheme = 'standard'|'editorial';
export interface GeoArtworkProps { path:string; theme?:GeoArtworkTheme; idPrefix?:string }

/** Decorative relief only. Coastlines are the supplied geographic path, never generated terrain. */
export function GeoArtwork({path,theme='standard',idPrefix}:GeoArtworkProps) {
 const {href:localHref}=useI18n();

  const reactId=useId();
  const prefix=`${idPrefix||'geo'}-${reactId}`.replace(/[^a-zA-Z0-9_-]/g,'');
  const id=(name:string)=>`${prefix}-${name}`;
  const url=(name:string)=>`url(#${id(name)})`;
  const editorial=theme==='editorial';
  return <g className="geo-artwork" data-theme={theme}>
    <defs>
      <radialGradient id={id('water')} cx="45%" cy="60%" r="76%">
        <stop stopColor={editorial?'#399c9f':'#278e9a'}/><stop offset=".5" stopColor={editorial?'#207e83':'#146c7a'}/><stop offset="1" stopColor={editorial?'#124f5a':'#084954'}/>
      </radialGradient>
      <linearGradient id={id('land')} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor={editorial?'#bbc890':'#a4ad86'}/><stop offset=".24" stopColor={editorial?'#7b985a':'#728958'}/><stop offset=".54" stopColor={editorial?'#607d4a':'#5b744c'}/><stop offset=".82" stopColor={editorial?'#93a56a':'#8c9c6c'}/><stop offset="1" stopColor="#c6c59a"/>
      </linearGradient>
      <filter id={id('relief')} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".025 .043" numOctaves="3" seed="12" stitchTiles="stitch" result="grain"/>
        <feDiffuseLighting in="grain" surfaceScale={editorial?1.25:3.5} diffuseConstant="1.1" lightingColor="#fcf6d6" result="light"><feDistantLight azimuth="315" elevation="44"/></feDiffuseLighting>
        <feComposite in="light" in2="SourceAlpha" operator="in"/>
      </filter>
      <filter id={id('grain')} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".15" numOctaves="2" seed="7" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComposite in2="SourceAlpha" operator="in"/>
      </filter>
      <filter id={id('painted-shadow')} x="-8%" y="-8%" width="116%" height="118%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="2.5" dy="4" stdDeviation="2.3" floodColor="#083d3b" floodOpacity=".55"/>
      </filter>
      <filter id={id('soft-shallows')} x="-8%" y="-8%" width="116%" height="116%"><feGaussianBlur stdDeviation="2.1"/></filter>
      <filter id={id('painted-edge')} x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
        <feOffset in="SourceAlpha" dx="1.6" dy="2.5" result="moved"/>
        <feComposite in="SourceAlpha" in2="moved" operator="out" result="lit-edge"/>
        <feFlood floodColor="#f2edb6" floodOpacity=".8"/><feComposite in2="lit-edge" operator="in"/>
      </filter>
      <clipPath id={id('land-clip')}><path d={path} fillRule="evenodd" clipRule="evenodd"/></clipPath>
    </defs>
    {editorial ? <>
      <path d={path} fill="none" stroke="#36cad0" strokeWidth="15" opacity=".2" strokeLinejoin="round" strokeLinecap="round" filter={url('soft-shallows')}/>
      <path d={path} fill="none" stroke="#9de0bd" strokeWidth="6" opacity=".55" strokeLinejoin="round" strokeLinecap="round"/>
      <path d={path} fill="#476b40" fillRule="evenodd" filter={url('painted-shadow')}/>
      <path d={path} fill="#cabc7d" fillRule="evenodd" stroke="#e7d7a0" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round"/>
      <g clipPath={url('land-clip')} data-texture="decorative-not-elevation">
        <image href={localHref("/media/reference/illustrated-land.png")} x="-300" y="-400" width="1450" height="1300" preserveAspectRatio="xMidYMid slice"/>
        <path d={path} fill="none" stroke="#274c36" strokeWidth="4.5" opacity=".24" strokeLinejoin="round" strokeLinecap="round"/>
      </g>
      <path d={path} fill="#ffffff" fillRule="evenodd" filter={url('painted-edge')} opacity=".76"/>
      <path d={path} fill="none" stroke="#f2e2ad" strokeWidth=".75" opacity=".94" strokeLinejoin="round" strokeLinecap="round"/>
    </> : <>
    <path d={path} strokeLinejoin="round" strokeLinecap="round" fill="none" stroke={editorial?'#81d9c5':'#81d8cf'} strokeWidth="24" opacity=".12"/>
    <path d={path} strokeLinejoin="round" strokeLinecap="round" fill="none" stroke="#9fe6cf" strokeWidth="12" opacity=".2"/>
    <path d={path} strokeLinejoin="round" strokeLinecap="round" fill="none" stroke="#b4e8c8" strokeWidth="5.5" opacity=".43"/>
    <path d={path} strokeLinejoin="round" strokeLinecap="round" fill={url('land')} fillRule="evenodd" stroke="#e0deb2" strokeWidth="1.7"/>
    <g clipPath={url('land-clip')} data-texture="decorative-not-elevation">
      <path d={path} fill="#768e59" fillRule="evenodd" filter={url('relief')} opacity={editorial?.22:.3} style={{mixBlendMode:'soft-light'}}/>
      <path d={path} fill="#6b8053" fillRule="evenodd" filter={url('grain')} opacity=".17" style={{mixBlendMode:'multiply'}}/>
      <path d={path} strokeLinejoin="round" strokeLinecap="round" fill="none" stroke="#e9e4ba" strokeWidth="5" opacity=".17"/>
    </g>
    <path d={path} strokeLinejoin="round" strokeLinecap="round" fill="none" stroke="#f4e8bf" strokeWidth=".7" opacity=".72"/>
    </>}

  </g>;
}
