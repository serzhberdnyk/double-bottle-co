'use client';
import {useMapDocument} from './MapLayoutContext';
import {MapPOI} from './MapPOI';
import {useI18n} from '@/lib/i18n/context';
import {PublishedRouteOverlay,PublishedRouteLegend} from '../components/PublishedRouteMap';
import {mapRouteCopy} from '../components/map-route-copy';
import routeStyles from '../components/PublishedRouteMap.module.css';
import {isBuiltinMapObjectId,mapPlacementImageSize,type MapPlacement} from '@/lib/public/map-layout';
import type {MapPOIItem} from './supplementary-pois';
export function customMapItem(item:MapPlacement):MapPOIItem{return {id:item.id,kind:'landmark',title:item.title||'Место',shortLabel:item.title||'Место',category:'Место на карте',image:item.image,imageSize:mapPlacementImageSize(item),descriptions:item.description?[item.description]:[]};}
export function CustomMapPlaces({placement,portalContainer}:{placement:'art'|'list';portalContainer?:HTMLElement|null}){
 const {placements}=useMapDocument();return <>{placements.filter(p=>!isBuiltinMapObjectId(p.id)).map(p=>placement==='art'?<MapPOI key={p.id} item={customMapItem(p)} placement="art" anchor={{x:p.x*12.8,y:p.y*10.83}} placementNotice="Расположение на иллюстрации схематичное."/>:<MapPOI key={p.id} item={customMapItem(p)} placement="list" portalContainer={portalContainer}/>)}</>;
}
export function CustomMapRoutes(){const {routes}=useMapDocument();return <PublishedRouteOverlay routes={routes}/>;}
/** Outside the cropped artwork, route names and tour links stay usable on phones. */
export function CustomMapRouteList(){
 const {routes}=useMapDocument(),{locale}=useI18n();
 if(!routes.length)return null;
 const copy=mapRouteCopy[locale];
 return <details className={routeStyles.homeRoutes} data-public-map-route-list><summary>{copy.routes} ({routes.length})</summary><div><p className={routeStyles.notice}>{copy.schematic}</p><PublishedRouteLegend routes={routes} linkTours/></div></details>;
}
