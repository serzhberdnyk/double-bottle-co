'use client';
import {useMapDocument} from './MapLayoutContext';
import {MapPOI} from './MapPOI';
import {isBuiltinMapObjectId,mapPlacementImageSize,type MapPlacement} from '@/lib/public/map-layout';
import type {MapPOIItem} from './supplementary-pois';
export function customMapItem(item:MapPlacement):MapPOIItem{return {id:item.id,kind:'landmark',title:item.title||'Место',shortLabel:item.title||'Место',category:'Место на карте',image:item.image,imageSize:mapPlacementImageSize(item),descriptions:item.description?[item.description]:[]};}
export function CustomMapPlaces({placement,portalContainer}:{placement:'art'|'list';portalContainer?:HTMLElement|null}){
 const {placements}=useMapDocument();return <>{placements.filter(p=>!isBuiltinMapObjectId(p.id)).map(p=>placement==='art'?<MapPOI key={p.id} item={customMapItem(p)} placement="art" anchor={{x:p.x*12.8,y:p.y*10.83}} placementNotice="Расположение на иллюстрации схематичное."/>:<MapPOI key={p.id} item={customMapItem(p)} placement="list" portalContainer={portalContainer}/>)}</>;
}
