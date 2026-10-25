'use client';
import {useMapDocument} from './MapLayoutContext';
import {MapPOI} from './MapPOI';
import {isBuiltinMapObjectId,mapPlacementImageSize,type MapPlacement} from '@/lib/public/map-layout';
import type {MapPOIItem} from './supplementary-pois';
export function customMapItem(item:MapPlacement):MapPOIItem{return {id:item.id,kind:'landmark',title:item.title||'Место',shortLabel:item.title||'Место',category:'Место на карте',image:item.image,imageSize:mapPlacementImageSize(item),descriptions:item.description?[item.description]:[]};}
export function CustomMapPlaces({placement,portalContainer}:{placement:'art'|'list';portalContainer?:HTMLElement|null}){
 const {placements}=useMapDocument();return <>{placements.filter(p=>!isBuiltinMapObjectId(p.id)).map(p=>placement==='art'?<MapPOI key={p.id} item={customMapItem(p)} placement="art" anchor={{x:p.x*12.8,y:p.y*10.83}} placementNotice="Расположение на иллюстрации схематичное."/>:<MapPOI key={p.id} item={customMapItem(p)} placement="list" portalContainer={portalContainer}/>)}</>;
}
export function CustomMapRoutes(){const {routes}=useMapDocument();return routes.length?<svg data-editor-map-routes viewBox="0 0 1280 1083" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}} aria-label="Схематичные маршруты, не GPS-навигация" role="img">{routes.map(route=><polyline key={route.id} data-route-id={route.id} points={route.points.map(p=>`${p.x*12.8},${p.y*10.83}`).join(' ')} fill="none" stroke={route.color==='sea'?'#4bd4f1':'#c5e877'} strokeWidth={3} strokeDasharray={route.style==='dashed'?'10 8':undefined} vectorEffect="non-scaling-stroke"><title>{route.title}</title></polyline>)}</svg>:null;}
