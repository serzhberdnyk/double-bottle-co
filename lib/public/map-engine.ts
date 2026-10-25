import {geometryPath, project} from './geo';
import type {Destination} from './types';

/** Canonical Mercator plane. Every visual layer uses this same 4:3 coordinate space. */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 750;
export const MIN_ZOOM = .75;
export const MAX_ZOOM = 2.7;
export type MapCameraMode = 'fixed'|'interactive';
export interface MapView { z:number; x:number; y:number }
export interface MapFit { scale:number; width:number; height:number; left:number; top:number }
export type Coordinate = [number,number];
export interface LandGeometry { type:string; coordinates:Coordinate[][]|Coordinate[][][] }
export interface LandFeature { type?:string; properties?:{id?:number|string;[key:string]:unknown}; geometry:LandGeometry }
export interface LandCollection { type:string; bbox?:number[]; features:LandFeature[] }
export interface IslandHitArea { id:string; path:string; destinationIds:string[]; visible:boolean }

/** Regional editorial frame, not a new projection or a claim of catalogue coverage.
 * Checked against canonical destinations and andaman.geojson: full Phuket (1),
 * both Racha Noi coastline pieces (92/93), Racha Yai and Phi Phi remain inside.
 * The east-side sea leaves room for destination labels. Distant destinations
 * (Cheow Lan, Similan and cities) remain in the beyond-map list.
 */
export const FIXED_REGION_BOUNDS = {west:98.22,south:7.42,east:98.95,north:8.34} as const;

export function fitMapPlane(width:number,height:number):MapFit {
  const safeWidth=Number.isFinite(width)?Math.max(0,width):0;
  const safeHeight=Number.isFinite(height)?Math.max(0,height):0;
  const scale=Math.min(safeWidth/MAP_WIDTH,safeHeight/MAP_HEIGHT);
  return {scale,width:MAP_WIDTH*scale,height:MAP_HEIGHT*scale,left:(safeWidth-MAP_WIDTH*scale)/2,top:(safeHeight-MAP_HEIGHT*scale)/2};
}

/** Fit one shared plane to a stable regional window. CSS zoom remains 1 so HTML
 * labels/landmarks keep their readable pixel sizes while their anchors, hit
 * areas and coastline use the exact same uniform geographic transform.
 * Landscape leaves header clearance and enlarges modestly; portrait uses the spare height.
 */
export function fitFixedMapPlane(width:number,height:number):MapFit {
  const base=fitMapPlane(width,height);
  if(base.scale===0)return base;
  const [left,top]=project(FIXED_REGION_BOUNDS.west,FIXED_REGION_BOUNDS.north);
  const [right,bottom]=project(FIXED_REGION_BOUNDS.east,FIXED_REGION_BOUNDS.south);
  const padding=Math.min(24,width*.08,height*.08);
  const landscape=width>=height;
  const topPadding=landscape?Math.min(84,height*.2):padding;
  const maxEnlargement=landscape?1.2:2.7;
  const scale=Math.min((width-padding*2)/(right-left),(height-topPadding-padding)/(bottom-top),base.scale*maxEnlargement);
  return {scale,width:MAP_WIDTH*scale,height:MAP_HEIGHT*scale,left:width/2-(left+right)/2*scale,top:(height+topPadding-padding)/2-(top+bottom)/2*scale};
}

export function isDestinationInFixedRegion(destination:Pick<Destination,'lat'|'lng'>):boolean {
  const {lat,lng}=destination;
  return Number.isFinite(lat)&&Number.isFinite(lng)&&lng>=FIXED_REGION_BOUNDS.west&&lng<=FIXED_REGION_BOUNDS.east&&lat>=FIXED_REGION_BOUNDS.south&&lat<=FIXED_REGION_BOUNDS.north;
}

/** Mirrors the CSS transform on the single shared plane, including its center origin. */
export function pointInViewport(point:Coordinate,fit:MapFit,view:MapView):Coordinate {
  return [fit.left+fit.width/2+((point[0]-MAP_WIDTH/2)*view.z+view.x)*fit.scale,
    fit.top+fit.height/2+((point[1]-MAP_HEIGHT/2)*view.z+view.y)*fit.scale];
}
export function clampMapView(view:MapView):MapView {
  const z=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Number.isFinite(view.z)?view.z:1));
  const boundX=MAP_WIDTH*Math.max(.35,(z-1)/2),boundY=MAP_HEIGHT*Math.max(.35,(z-1)/2);
  return {z,x:Math.max(-boundX,Math.min(boundX,Number.isFinite(view.x)?view.x:0)),y:Math.max(-boundY,Math.min(boundY,Number.isFinite(view.y)?view.y:0))};
}
export function isPointOnMap([x,y]:Coordinate):boolean {
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=MAP_WIDTH&&y>=0&&y<=MAP_HEIGHT;
}
export function isDestinationOnMap(destination:Pick<Destination,'lat'|'lng'>):boolean {
  const [x,y]=project(destination.lng,destination.lat);
  return Number.isFinite(x)&&Number.isFinite(y)&&x>0&&x<995&&y>30&&y<735;
}

/** Break at every missing/off-map stop: filtering points first would invent a direct leg. */
export function routeSchematicPath(stops:ReadonlyArray<{lng?:number;lat?:number}>):string {
  let connected=false;
  return stops.map(stop=>{
    if(!Number.isFinite(stop.lng)||!Number.isFinite(stop.lat)){connected=false;return '';}
    const point=project(stop.lng!,stop.lat!);
    if(!isPointOnMap(point)){connected=false;return '';}
    const command=connected?'L':'M';connected=true;
    return `${command}${point[0]},${point[1]}`;
  }).join('');
}

function onSegment(point:Coordinate,a:Coordinate,b:Coordinate):boolean {
  const cross=(point[1]-a[1])*(b[0]-a[0])-(point[0]-a[0])*(b[1]-a[1]);
  return Math.abs(cross)<1e-10&&point[0]>=Math.min(a[0],b[0])-1e-10&&point[0]<=Math.max(a[0],b[0])+1e-10&&point[1]>=Math.min(a[1],b[1])-1e-10&&point[1]<=Math.max(a[1],b[1])+1e-10;
}
export function pointInRing(point:Coordinate,ring:Coordinate[]):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(onSegment(point,a,b))return true;
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function polygons(geometry:LandGeometry):Coordinate[][][] {
  return geometry.type==='Polygon'?[geometry.coordinates as Coordinate[][]]:geometry.type==='MultiPolygon'?geometry.coordinates as Coordinate[][][]:[];
}
export function geometryContains(geometry:LandGeometry,point:Coordinate):boolean {
  return polygons(geometry).some(poly=>poly.length>0&&pointInRing(point,poly[0])&&!poly.slice(1).some(hole=>pointInRing(point,hole)));
}

/** A polygon meeting the GeoJSON crop edge is mainland/cropped land, not a verified island. */
export function isWholeIsland(geometry:LandGeometry,bbox?:number[]):boolean {
  if(!bbox||bbox.length!==4)return false;
  const [west,south,east,north]=bbox;
  const rings=polygons(geometry).map(poly=>poly[0]);
  return rings.length>0&&rings.every(ring=>ring.length>=4&&ring.every(([lng,lat])=>lng>west+1e-8&&lng<east-1e-8&&lat>south+1e-8&&lat<north-1e-8));
}

/** No proximity fallbacks: only actual polygon containment links an island to a destination. */
export function buildIslandHitAreas(geo:LandCollection,destinations:Destination[]):IslandHitArea[] {
  return geo.features.flatMap((feature,index)=>{
    if(!isWholeIsland(feature.geometry,geo.bbox))return [];
    const points=polygons(feature.geometry).flatMap(poly=>poly[0]).map(([lng,lat])=>project(lng,lat));
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const visible=Math.max(...xs)>=0&&Math.min(...xs)<=MAP_WIDTH&&Math.max(...ys)>=0&&Math.min(...ys)<=MAP_HEIGHT;
    return [{id:String(feature.properties?.id??index),path:geometryPath(feature.geometry),visible,
      destinationIds:destinations.filter(destination=>geometryContains(feature.geometry,[destination.lng,destination.lat])).map(destination=>destination.id)}];
  });
}

export function mergeMapDestinations(current:Destination[],baseline?:Destination[]):Destination[] {
  if(!baseline)return current;
  const currentById=new Map(current.map(destination=>[destination.id,destination]));
  const merged=baseline.map(destination=>currentById.get(destination.id)||{...destination,count:0});
  const baselineIds=new Set(baseline.map(destination=>destination.id));
  return [...merged,...current.filter(destination=>!baselineIds.has(destination.id))];
}

export function markerClickAction(openId:string|null,pinned:boolean,destinationId:string):'open'|'close' {
  return openId===destinationId&&pinned?'close':'open';
}
