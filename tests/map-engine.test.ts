import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geometryPath,project} from '../lib/public/geo';
import {buildIslandHitAreas,clampMapView,fitMapPlane,fitFixedMapPlane,FIXED_REGION_BOUNDS,geometryContains,isWholeIsland,isDestinationInFixedRegion,isDestinationOnMap,markerClickAction,mergeMapDestinations,pointInViewport,routeSchematicPath,type LandCollection,type LandGeometry,type Coordinate} from '../lib/public/map-engine';
import type {Destination} from '../lib/public/types';
import {bigBuddha} from '../app/reference-preview/reference-landmarks';
import {phuketAirport} from '../app/reference-preview/airport-landmark';

const geo=JSON.parse(readFileSync('public/map/andaman.geojson','utf8')) as LandCollection;
const destinations=(JSON.parse(readFileSync('private-import/initial-catalog.json','utf8')) as {destinations:Destination[]}).destinations;
const epsilon=(a:number,b:number)=>assert(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);

test('4:3 plane is uniformly fitted and centered in wide, portrait, and phone viewports',()=>{
  for(const [width,height] of [[1448,680],[1000,750],[768,560],[390,520],[320,550]]){
    const fit=fitMapPlane(width,height);
    epsilon(fit.width/fit.height,4/3);
    assert(fit.width<=width&&fit.height<=height);
    epsilon(fit.left*2+fit.width,width);epsilon(fit.top*2+fit.height,height);
    epsilon(fit.width/1000,fit.height/750);
    const centre=pointInViewport([500,375],fit,{z:1,x:0,y:0});
    epsilon(centre[0],width/2);epsilon(centre[1],height/2);
  }
  assert.deepEqual(fitMapPlane(0,550),{scale:0,width:0,height:0,left:0,top:275});
  assert.equal(fitMapPlane(Number.NaN,-1).scale,0);
});

test('fixed region includes every canonical local destination and keeps distant destinations honest',()=>{
  const local=['coral','racha-yai','phi-phi-don','phi-phi-leh','maiton','phang-nga-bay','james-bond','samet-nangshe'].sort();
  const remote=['cheow-lan','singapore','kuala-lumpur','bangkok','similan'].sort();
  for(const file of ['private-import/initial-catalog.json','private-import/reviewed-catalog-2026-10-04.json']){
    const canonical=(JSON.parse(readFileSync(file,'utf8')) as {destinations:Destination[]}).destinations;
    assert.deepEqual(canonical.filter(isDestinationInFixedRegion).map(item=>item.id).sort(),local);
    assert.deepEqual(canonical.filter(item=>!isDestinationInFixedRegion(item)).map(item=>item.id).sort(),remote);
    assert.deepEqual(canonical.filter(isDestinationOnMap).map(item=>item.id).sort(),local);
  }
  assert.equal(isDestinationInFixedRegion({lat:NaN,lng:98.4}),false);
  assert.equal(isDestinationInFixedRegion({lat:8,lng:Infinity}),false);
});

test('fixed viewport retains full Phuket, Racha Noi, bound tour island coastlines and local markers with padding',()=>{
  const features=geo.features.filter(feature=>isWholeIsland(feature.geometry,geo.bbox)&&(['1','92','93'].includes(String(feature.properties?.id))||destinations.filter(isDestinationInFixedRegion).some(destination=>geometryContains(feature.geometry,[destination.lng,destination.lat]))));
  assert(features.some(feature=>String(feature.properties?.id)==='1'));
  assert(features.some(feature=>String(feature.properties?.id)==='92'));
  assert(features.some(feature=>String(feature.properties?.id)==='93'));
  const coastlinePoints=features.flatMap(feature=>{
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates as Coordinate[][]]:feature.geometry.coordinates as Coordinate[][][];
    return polygons.flatMap(polygon=>polygon.flatMap(ring=>ring.map(([lng,lat])=>project(lng,lat))));
  });
  const markerPoints=destinations.filter(isDestinationInFixedRegion).map(destination=>project(destination.lng,destination.lat));
  const corners=[project(FIXED_REGION_BOUNDS.west,FIXED_REGION_BOUNDS.north),project(FIXED_REGION_BOUNDS.east,FIXED_REGION_BOUNDS.south)];
  for(const [width,height] of [[1448,680],[1200,737],[1200,680],[900,720],[768,560],[760,590],[390,590],[390,580],[320,580],[320,550],[280,480]]){
    const fit=fitFixedMapPlane(width,height);
    epsilon(fit.width/fit.height,4/3);
    epsilon(fit.width/1000,fit.height/750);
    const padding=Math.min(24,width*.08,height*.08);
    const topPadding=width>=height?Math.min(84,height*.2):padding;
    for(const point of [...coastlinePoints,...markerPoints,...corners]){
      const [x,y]=pointInViewport(point,fit,{z:1,x:0,y:0});
      assert(x>=padding-1e-8&&x<=width-padding+1e-8,`${width}×${height}: x=${x}`);
      assert(y>=topPadding-1e-8&&y<=height-padding+1e-8,`${width}×${height}: y=${y}`);
    }
    const base=fitMapPlane(width,height);
    if(width>=height)assert(fit.scale/base.scale<=1.2+1e-8);
    if(width>=900&&height>=680)assert(fit.scale/base.scale>1.1,'desktop framing remains modestly closer');
    if(width<=390)assert(fit.scale/base.scale>1.8,`phone geography should be visibly larger at ${width}px`);
  }
  assert.deepEqual(fitFixedMapPlane(0,550),fitMapPlane(0,550));
  assert.deepEqual(fitFixedMapPlane(NaN,-1),fitMapPlane(NaN,-1));
});

test('desktop hero framing keeps northern labels below the header while retaining Racha Noi',()=>{
  const jamesBond=destinations.find(destination=>destination.id==='james-bond')!;
  for(const [width,height] of [[1200,737],[1200,680],[900,720]]){
    const fit=fitFixedMapPlane(width,height);
    const [,pinY]=pointInViewport(project(jamesBond.lng,jamesBond.lat),fit,{z:1,x:0,y:0});
    // Existing label sits 31px above a 24px pin, with a single text line.
    assert(pinY-39>=84,`${width}×${height}: northern label needs header clearance`);
    const rachaNoi=geo.features.find(feature=>String(feature.properties?.id)==='93')!;
    const points=(rachaNoi.geometry.coordinates as Coordinate[][]).flat();
    for(const [lng,lat] of points){
      const [,y]=pointInViewport(project(lng,lat),fit,{z:1,x:0,y:0});
      assert(y<=height-24,'Racha Noi remains above the bottom reservation');
    }
  }
});

test('fixed coastline, hit areas, markers and child landmark anchors share the same undistorted plane',()=>{
  // Actual catalogue anchors plus the existing airport/Big Buddha overlay source coordinates.
  const anchors=[...destinations.filter(isDestinationInFixedRegion),bigBuddha,phuketAirport].map(destination=>project(destination.lng,destination.lat));
  for(const [width,height] of [[1200,680],[390,580],[320,580],[320,550]]){
    const fit=fitFixedMapPlane(width,height);
    for(const point of anchors){
      const [x,y]=pointInViewport(point,fit,{z:1,x:0,y:0});
      epsilon(x,fit.left+point[0]/1000*fit.width);
      epsilon(y,fit.top+point[1]/750*fit.height);
      const east=pointInViewport([point[0]+10,point[1]],fit,{z:1,x:0,y:0});
      const south=pointInViewport([point[0],point[1]+10],fit,{z:1,x:0,y:0});
      epsilon(east[0]-x,south[1]-y);
    }
  }
  const component=readFileSync('app/components/IslandMap.tsx','utf8');
  assert(component.includes('inside.map((destination,index)=>point(destination,index))}{children}'));
  assert(component.includes("const activeView=cameraInteractive?view:{z:1,x:0,y:0}"));
});

test('coastline, route, and HTML point coordinates stay identical through every shared transform',()=>{
  const coral=destinations.find(destination=>destination.id==='coral')!;
  const point=project(coral.lng,coral.lat);
  const coast=geometryPath({type:'Polygon',coordinates:[[[coral.lng,coral.lat],[coral.lng+.01,coral.lat],[coral.lng,coral.lat]]]});
  assert(coast.startsWith(`M${point[0].toFixed(2)},${point[1].toFixed(2)}`));
  assert(routeSchematicPath([coral]).startsWith(`M${point[0]},${point[1]}`));
  for(const [width,height] of [[1200,650],[390,520]])for(const z of [.75,1,2.7]){
    const fit=fitMapPlane(width,height),view={z,x:71,y:-29};
    const viewport=pointInViewport(point,fit,view);
    const markerPercent=[point[0]/1000,point[1]/750];
    const markerX=fit.left+fit.width/2+((markerPercent[0]*fit.width-fit.width/2)*z+view.x*fit.scale);
    const markerY=fit.top+fit.height/2+((markerPercent[1]*fit.height-fit.height/2)*z+view.y*fit.scale);
    epsilon(viewport[0],markerX);epsilon(viewport[1],markerY);
    const east=pointInViewport([point[0]+10,point[1]],fit,view),south=pointInViewport([point[0],point[1]+10],fit,view);
    epsilon(east[0]-viewport[0],south[1]-viewport[1]);
  }
});

test('routes start new segments at unknown coordinates and off-map stops, never bridge removed stops',()=>{
  const coral=destinations.find(destination=>destination.id==='coral')!;
  const racha=destinations.find(destination=>destination.id==='racha-yai')!;
  const maiton=destinations.find(destination=>destination.id==='maiton')!;
  const singapore=destinations.find(destination=>destination.id==='singapore')!;
  const path=routeSchematicPath([coral,racha,singapore,maiton,{},coral,{lng:NaN,lat:8},racha]);
  assert.equal((path.match(/M/g)||[]).length,4);
  assert.equal((path.match(/L/g)||[]).length,1);
  assert(!path.includes('NaN'));
  assert.equal(routeSchematicPath([singapore,{}]),'');
});

test('containment respects polygon holes, boundaries and multipolygons without nearest-island guesses',()=>{
  const geometry:LandGeometry={type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]]};
  assert.equal(geometryContains(geometry,[.5,.5]),true);
  assert.equal(geometryContains(geometry,[1.5,1.5]),false);
  assert.equal(geometryContains(geometry,[4,2]),true);
  assert.equal(geometryContains(geometry,[4.0001,2]),false);
  const multi:LandGeometry={type:'MultiPolygon',coordinates:[geometry.coordinates as [number,number][][],[[[10,10],[12,10],[12,12],[10,12],[10,10]]]]};
  assert.equal(geometryContains(multi,[11,11]),true);
  assert.equal(geometryContains(multi,[5,5]),false);
});

test('real island hit areas map only through canonical point-in-polygon containment',()=>{
  const hitAreas=buildIslandHitAreas(geo,destinations);
  const expected:Record<string,string>={coral:'180','racha-yai':'94','phi-phi-don':'43','phi-phi-leh':'193',maiton:'185','james-bond':'15',similan:'189'};
  for(const [destinationId,featureId] of Object.entries(expected)){
    const matches=hitAreas.filter(area=>area.destinationIds.includes(destinationId));
    assert.equal(matches.length,1);assert.equal(matches[0].id,featureId);
    const feature=geo.features.find(item=>String(item.properties?.id)===featureId)!;
    assert.equal(matches[0].path,geometryPath(feature.geometry));
  }
  assert(!hitAreas.some(area=>area.destinationIds.includes('phang-nga-bay')));
  assert(!hitAreas.some(area=>area.destinationIds.includes('samet-nangshe')));
  assert(!hitAreas.some(area=>area.destinationIds.includes('cheow-lan')));
  assert.equal(hitAreas.find(area=>area.id==='189')?.visible,false);
  assert.equal(isWholeIsland(geo.features[0].geometry,geo.bbox),false);
  assert.equal(isWholeIsland(geo.features[1].geometry,geo.bbox),true);
  // Phuket has no catalog destination binding. It remains honest, unnamed catalog context.
  assert.deepEqual(hitAreas.find(area=>area.id==='1')?.destinationIds,[]);
  assert.equal(isWholeIsland(geo.features[1].geometry),false);
});

test('baseline destination IDs survive filtering with explicit zero counts and no invented programs',()=>{
  const baseline=destinations.map(destination=>({...destination,count:10}));
  const coral={...baseline.find(destination=>destination.id==='coral')!,count:2};
  const filtered=mergeMapDestinations([coral],baseline);
  assert.equal(filtered.length,baseline.length);
  assert.equal(filtered.find(destination=>destination.id==='coral')?.count,2);
  assert(filtered.filter(destination=>destination.id!=='coral').every(destination=>destination.count===0));
  assert.equal(buildIslandHitAreas(geo,filtered).find(area=>area.id==='193')?.destinationIds[0],'phi-phi-leh');
  assert.deepEqual(mergeMapDestinations([coral]),[coral]);
  assert.equal(new Set(filtered.map(destination=>destination.id)).size,filtered.length);
  assert.equal(isDestinationOnMap(filtered.find(destination=>destination.id==='singapore')!),false);
});

test('repeated marker clicks pin a hover preview, close a pinned destination, and open another',()=>{
  assert.equal(markerClickAction(null,false,'coral'),'open');
  assert.equal(markerClickAction('coral',false,'coral'),'open');
  assert.equal(markerClickAction('coral',true,'coral'),'close');
  assert.equal(markerClickAction('coral',true,'maiton'),'open');
});

test('zoom and pan stay bounded and recover from non-finite input',()=>{
  assert.deepEqual(clampMapView({z:NaN,x:Infinity,y:NaN}),{z:1,x:0,y:0});
  assert.deepEqual(clampMapView({z:.1,x:10000,y:-10000}),{z:.75,x:350,y:-262.5});
  const maximum=clampMapView({z:99,x:10000,y:-10000});
  assert.equal(maximum.z,2.7);epsilon(maximum.x,850);epsilon(maximum.y,-637.5);
});

test('rendering preserves shared plane, keyboard/focus hooks, opt-in touch panning, reduced motion and OSM credit',()=>{
  const component=readFileSync('app/components/IslandMap.tsx','utf8');
  const css=readFileSync('app/components/IslandMap.module.css','utf8');
  const artwork=readFileSync('app/components/GeoArtwork.tsx','utf8');
  assert(!component.includes('preserveAspectRatio="none"'));
  assert(component.includes('preserveAspectRatio="xMidYMid meet"'));
  assert(component.includes("touchPan?'none':'pan-y pinch-zoom'"));
  assert(component.includes('onEscapeKeyDown'));assert(component.includes('returnFocus'));
  assert(component.includes("['Enter',' '].includes(event.key)"));
  assert(component.includes('Нет подтверждённой привязки экскурсий к этому острову.'));
  assert(component.includes('Схема последовательности остановок, не навигационный путь.'));
  assert(component.includes('https://www.openstreetmap.org/copyright'));
  assert(css.includes('prefers-reduced-motion:reduce'));
  assert(component.includes("variant!=='editorial'&&<text data-region=\"phuket\""));
  assert(artwork.includes('useId()'));assert(artwork.includes('decorative-not-elevation'));
  assert(!artwork.includes('andaman-user-map'));
});

test('fixed camera disables camera handlers and controls while standard defaults and destination interaction survive',()=>{
  const component=readFileSync('app/components/IslandMap.tsx','utf8');
  const css=readFileSync('app/components/IslandMap.module.css','utf8');
  assert(component.includes("cameraMode='interactive',showRoutes=true"));
  assert(component.includes("cameraInteractive?fitMapPlane(size.width,size.height):fitFixedMapPlane(size.width,size.height)"));
  for(const handler of ['onPointerDown={cameraInteractive?startDrag:undefined}','onPointerMove={cameraInteractive?moveDrag:undefined}','onPointerUp={cameraInteractive?stopDrag:undefined}','onPointerCancel={cameraInteractive?stopDrag:undefined}','onKeyDown={cameraInteractive?event=>'])assert(component.includes(handler),handler);
  assert(component.includes('tabIndex={cameraInteractive?0:undefined}'));
  assert(component.includes('cameraInteractive&&<div className={`map-controls'));
  assert(component.includes("touchAction:cameraInteractive&&touchPan?'none':'pan-y pinch-zoom'"));
  assert(component.includes('const activeRoute=showRoutes?(route||hoverVariant):null'));
  assert(component.includes('cameraInteractive?isDestinationOnMap:isDestinationInFixedRegion'));
  assert(component.includes('onEscapeKeyDown'));
  assert(component.includes("['Enter',' ','ArrowDown'].includes(event.key)"));
  assert(component.includes("['Enter',' '].includes(event.key)"));
  assert(component.includes('onClick={event=>{event.preventDefault();activateDestination'));
  assert(css.includes('.viewport.fixedViewport, .viewport.fixedViewport:active { cursor:default; touch-action:pan-y pinch-zoom; }'));
});
