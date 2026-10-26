import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url),root=path.resolve('.');
// Compile the actual components, substituting CSS/context and unrelated image/chrome only.
function loader(locale='ru',document={version:2,placements:[],routes:[]}){
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const source=readFileSync(file,'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('exports','require',compiled)(exports,specifier=>{
   if(specifier.endsWith('.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
   if(specifier==='@/lib/i18n/context')return {useI18n:()=>({locale,t:value=>value,href:value=>locale==='ru'?value:'/'+locale+value})};
   if(specifier==='./MapLayoutContext')return {useMapDocument:()=>document};
   if(specifier==='./SiteChrome')return {Header:()=>null,Footer:()=>null};
   if(specifier==='./VariantTourImage')return {VariantTourImage:()=>createElement('div',{'data-fixture-image':true})};
   if(specifier==='./ApprovedBrochures')return {ApprovedBrochures:()=>null};
   if(specifier==='./MapPOI')return {MapPOI:({item})=>createElement('span',{'data-fixture-landmark':item.id},item.title)};
   if(specifier==='./YonaBoardingPOI')return {YonaBoardingPOI:()=>null};
   if(specifier==='./MapBoat')return {MapBoat:()=>null};
   if(specifier.startsWith('@/')||specifier.startsWith('.')){
    let resolved=specifier.startsWith('@/')?path.join(root,specifier.slice(2)):path.resolve(path.dirname(file),specifier);
    if(resolved.endsWith('.json'))return JSON.parse(readFileSync(resolved,'utf8'));
    if(!/\.(ts|tsx)$/.test(resolved))resolved+=existsSync(resolved+'.tsx')?'.tsx':'.ts';
    return load(resolved);
   }
   return require(specifier);
  });
  return exports;
 }
 return relative=>load(path.join(root,relative));
}
const routes=[
 {id:'route-one',title:'Ocean route',tourId:'tour-1',variantId:'v1',tour:{id:'tour-1',slug:'tour-one',title:'Tour one'},color:'sea',style:'dashed',points:[{x:20,y:30,label:'Boarding',color:'coral'},{x:52.25,y:64.5,label:'Lagoon',color:'violet'}]},
 {id:'route-other',title:'Other route',tourId:'tour-2',variantId:'v-other',color:'land',style:'solid',points:[{x:10,y:20},{x:30,y:40}]},
 {id:'unassigned',title:'Unassigned route',color:'land',style:'dashed',points:[{x:0,y:100},{x:100,y:0}]},
];
const render=(Component,props)=>renderToStaticMarkup(createElement(Component,props));

test('published overlay preserves exact line geometry, point order and individual colours',()=>{
 const {PublishedRouteOverlay}=loader()('app/components/PublishedRouteMap.tsx');
 const html=render(PublishedRouteOverlay,{routes:[routes[0]]});
 assert.match(html,/points="256,324.9 668.8000000000001,698.535"/);
 assert.match(html,/stroke-dasharray="10 8"/);
 assert.match(html,/background-color:#ff9d8a/);assert.match(html,/background-color:#cfb6ff/);
 assert.match(html,/left:52.25%;top:64.5%/);
 assert.match(html,/Ocean route: Boarding/);assert.match(html,/Ocean route: Lagoon/);
 assert.equal((html.match(/data-route-point=/g)||[]).length,2);
});

test('visible legend keeps point names, order and tour links in RU, EN and TH',()=>{
 for(const locale of ['ru','en','th']){
  const load=loader(locale),{PublishedRouteLegend}=load('app/components/PublishedRouteMap.tsx');
  const html=render(PublishedRouteLegend,{routes,linkTours:true});
  assert(html.indexOf('Boarding')<html.indexOf('Lagoon'));
  assert.match(html,/Ocean route/);assert.match(html,/Tour one/);
  assert(html.includes(`href="${locale==='ru'?'':'/'+locale}/tour/tour-one"`));
  assert(!html.includes('/tour/tour-2'));assert(!html.includes('/tour/undefined'));
  assert(html.includes(({ru:'Точка 1',en:'Point 1',th:'จุด 1'})[locale]));
  assert.equal((html.match(/<ol>/g)||[]).length,3);
 }
});

test('empty route map remains absent and old points use readable default colour and labels',()=>{
 const {PublishedTourRoutes,PublishedRouteOverlay,PublishedRouteLegend}=loader()('app/components/PublishedRouteMap.tsx');
 assert.equal(render(PublishedTourRoutes,{routes:[]}), '');
 assert.equal(render(PublishedRouteOverlay,{routes:[]}), '');
 assert.match(render(PublishedRouteOverlay,{routes:[routes[1]]}),/background-color:#fff2d3/);
 assert.match(render(PublishedRouteLegend,{routes:[routes[1]]}),/Точка 1/);
});

test('selected program displays existing place artwork and standalone point icons with its line and named colour markers',()=>{
 const load=loader(),{defaultMapDocument,resolveMapRoute,setMapRoutePointPlace}=load('lib/public/map-layout.ts');
 const route=structuredClone(routes[0]);route.points[0]=setMapRoutePointPlace(route.points[0],'big-buddha',defaultMapDocument.placements);route.points[1].icon='/media/reference/airport-plane-cutout.png';
 const resolved=resolveMapRoute(route,defaultMapDocument.placements),{CompactTourDetail}=load('app/components/CompactTourDetail.tsx');
 const html=render(CompactTourDetail,{...detailProps,mapRoutes:[resolved]});
 assert(html.includes('src="/media/reference/big-buddha-cutout.png"'));assert(html.includes('src="/media/reference/airport-plane-cutout.png"'));
 assert(html.includes('<polyline'));assert(html.includes('Boarding'));assert(html.includes('Lagoon'));assert(html.includes('background-color:#ff9d8a'));assert.equal((html.match(/data-route-point=/g)||[]).length,2);
 const other=render(CompactTourDetail,{...detailProps,variant:{...variant,id:'v2'},mapRoutes:[resolved]});
 assert(!other.includes('big-buddha-cutout.png'));assert(!other.includes('airport-plane-cutout.png'));assert(!other.includes('data-tour-route-map'));
});

test('editor-supplied labels are escaped as text, never interpreted as markup or a URL',()=>{
 const evil={...routes[0],title:'<script>route</script>',points:[{x:20,y:30,label:'<img src=x onerror=alert(1)>'},{x:21,y:31}]};
 const {PublishedTourRoutes}=loader()('app/components/PublishedRouteMap.tsx');
 const html=render(PublishedTourRoutes,{routes:[evil]});
 assert(!html.includes('<script>route'));
 assert(!html.includes('<img src=x'));
 assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('tour association is stable-ID based, accepts distinct routes and excludes unrelated and unassigned',()=>{
 const {routesForTour}=loader()('lib/public/map-route-display.ts');
 assert.deepEqual(routesForTour(routes,'tour-1'),[routes[0]]);
 assert.deepEqual(routesForTour(routes,'Ocean route'),[]);
 assert.deepEqual(routesForTour([...routes,{...routes[0],id:'second-for-one'}],'tour-1').map(route=>route.id),['route-one','second-for-one']);
 assert.deepEqual(routesForTour(routes,'missing'),[]);
});

const variant={id:'v1',revisionId:'rev',name:'Variant',description:'',duration:'1 day',days:1,transport:'',format:'',status:'on_request',stops:[],itinerary:['Original programme'],includes:[],extras:[],conditions:[],rates:[],earliestDate:null};
const tour={id:'tour-1',slug:'tour-one',title:'Tour one',description:'',category:'sea',image:null,imageAlt:'',status:'on_request',featuredRank:0,variants:[variant]};
const detailProps={tour,variant,price:createElement('span',null,'unchanged price'),inquiryDialog:null,onRequest:()=>{},onFavorite:()=>{},saved:false};

test('real tour detail displays only its attached routes while preserving programme and price',()=>{
 for(const locale of ['ru','en','th']){
  const {CompactTourDetail}=loader(locale)('app/components/CompactTourDetail.tsx');
  const html=render(CompactTourDetail,{...detailProps,mapRoutes:routes});
  assert(html.includes('data-tour-route-map'));assert(html.includes('Ocean route'));assert(html.includes('Boarding'));
  assert(!html.includes('Other route'));assert(!html.includes('Unassigned route'));
  assert(html.includes('Original programme'));assert(html.includes('unchanged price'));
  assert(!html.includes('GPS'));assert(!html.includes('Расположение на иллюстрации'));
  assert(html.includes(({ru:'Маршрут экскурсии на карте',en:'Tour route on the map',th:'เส้นทางทัวร์บนแผนที่'})[locale]));
 }
});

test('real tour detail without a linked route hides the map without a regional substitute',()=>{
 for(const locale of ['ru','en','th']){
  const load=loader(locale),{CompactTourDetail}=load('app/components/CompactTourDetail.tsx'),{mapRouteCopy}=load('app/components/map-route-copy.ts');
  const html=render(CompactTourDetail,{...detailProps,mapRoutes:routes.slice(1)});
  assert(!html.includes('data-tour-route-map'));assert(!html.includes('data-editor-map-routes'));
  assert(!html.includes(mapRouteCopy[locale].tourMap));assert(!html.includes('<details'));
  assert(!html.includes('andaman-user-map.png'));assert(!html.includes('Региональный ориентир'));
  assert(html.includes('Original programme'));assert(html.includes('unchanged price'));
 }
});

test('program pages omit destination-link tiles while retaining itinerary, prices and attached map geometry',()=>{
 const {CompactTourDetail}=loader()('app/components/CompactTourDetail.tsx');
 const stops=[{destinationId:'racha-yai',sequence:0,name:'Рача Яй',visitType:'landing',required:true,note:'',lat:7.6,lng:98.3},{destinationId:'coral',sequence:1,name:'Корал',visitType:'landing',required:true,note:'',lat:7.7,lng:98.4}];
 const selected={...variant,stops},programTour={...tour,id:'p_40cbe5f22267527c94bc5a8b',slug:'phi-phi-sunrise',variants:[selected]};
 const route={...routes[0],tourId:programTour.id},props={...detailProps,tour:programTour,variant:selected,mapRoutes:[route]},before=JSON.stringify(props);
 const html=render(CompactTourDetail,props);
 assert(!html.includes('stop-tags'));assert(!html.includes('?destination='));
 assert(html.includes('Original programme'));assert(html.includes('unchanged price'));
 assert(html.includes('data-tour-route-map'));assert(html.includes('<polyline'));assert(html.includes('Boarding'));assert(html.includes('href="/#selected"'));
 assert.equal(JSON.stringify(props),before);assert.equal(selected.stops.length,2);
 const ui=readFileSync('app/components/CatalogUI.tsx','utf8'),detail=ui.slice(ui.indexOf('export function TourPage'));
 assert(!detail.includes('stop-tags'));assert(detail.includes('v.itinerary.map'));assert(detail.includes('linkedRoutes.length>0&&<PublishedTourRoutes'));
 // The shared catalogue still lists actual TourCards and retains its destination filter.
 const catalog=ui.slice(ui.indexOf('export function CatalogExperience'),ui.indexOf('export function TourPage'));
 assert(catalog.includes('<TourCard'));assert(catalog.includes('filters.destination'));assert(catalog.includes('data.items.map'));
});

test('general map excludes custom routes even with route-bearing context, preserving custom landmarks',()=>{
 const placements=[{id:'custom-place',title:'Keep this place',image:'/media/reference/map-landmark-placeholder.svg',x:10,y:20}];
 const {SupplementalArtPOIs}=loader('en',{version:2,placements,routes})('app/reference-preview/SupplementalArtPOIs.tsx');
 const html=render(SupplementalArtPOIs,{});
 assert(html.includes('Keep this place'));assert(!html.includes('Ocean route'));assert(!html.includes('Boarding'));
 assert(!html.includes('data-editor-map-routes'));assert(!html.includes('data-route-point'));
 const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');assert(!home.includes('CustomMapRouteList'));
 const page=readFileSync('app/page.tsx','utf8');assert(page.includes('publishedMapLayout(database())'));assert(page.includes('routes:[]'));assert(!page.includes('publishedMapDocument'));
});

test('stable program IDs select only that variant; legacy tour-only links are never guessed',()=>{
 const {routesForProgram}=loader()('lib/public/map-route-display.ts');
 const legacy={...routes[0],id:'legacy',title:'Legacy route'};delete legacy.variantId;
 const vip={...routes[0],id:'vip-route',title:'VIP route',variantId:'v2'};
 const all=[...routes,legacy,vip],before=JSON.stringify(all);
 assert.deepEqual(routesForProgram(all,'tour-1','v1'),[routes[0]]);
 assert.deepEqual(routesForProgram(all,'tour-1','v2'),[vip]);
 assert.deepEqual(routesForProgram(all,'tour-1','Variant'),[]);
 assert.deepEqual(routesForProgram(all,'tour-2','v1'),[]);
 const {CompactTourDetail}=loader()('app/components/CompactTourDetail.tsx');
 const standard=render(CompactTourDetail,{...detailProps,mapRoutes:all});
 const selectedVIP=render(CompactTourDetail,{...detailProps,variant:{...variant,id:'v2',name:'VIP'},mapRoutes:all});
 assert(standard.includes('Ocean route'));assert(!standard.includes('VIP route'));assert(!standard.includes('Legacy route'));
 assert(selectedVIP.includes('VIP route'));assert(!selectedVIP.includes('Ocean route'));assert(!selectedVIP.includes('Legacy route'));
 const empty=render(CompactTourDetail,{...detailProps,variant:{...variant,id:'v3',name:'No route'},mapRoutes:all});
 assert(!empty.includes('<details'));assert(!empty.includes('<polyline'));assert(!empty.includes('andaman-user-map.png'));
 assert(!empty.includes('Ocean route'));assert(!empty.includes('VIP route'));assert(!empty.includes('Legacy route'));
 const back=render(CompactTourDetail,{...detailProps,mapRoutes:all});assert.equal(back,standard);
 assert.equal(JSON.stringify(all),before);
});

test('server detail and both display layouts carry published, ID-filtered map routes',()=>{
 const page=readFileSync('app/tour/[slug]/page.tsx','utf8');
 assert(page.includes('routesForTour((await publishedMapDocument(database())).routes,p.tour.id)'));
 assert(page.includes('<TourPage tour={p.tour} releaseId={p.releaseId} mapRoutes={mapRoutes}/>'));
 const ui=readFileSync('app/components/CatalogUI.tsx','utf8');
 assert(ui.includes('routesForProgram(mapRoutes,tour.id,v.id)'));
 assert(ui.includes('<CompactTourDetail tour={tour} variant={v} mapRoutes={linkedRoutes}'));
 assert(ui.includes('linkedRoutes.length>0&&<PublishedTourRoutes routes={linkedRoutes}/>'));
});

test('closed public route adds only the final line segment, never an extra stored or numbered point',()=>{
 const {PublishedRouteOverlay,PublishedRouteLegend}=loader()('app/components/PublishedRouteMap.tsx');
 const points=[{x:10,y:20,label:'Start',color:'gold'},{x:30,y:40,label:'Middle',color:'sea'},{x:50,y:60,label:'Finish',color:'coral'}];
 const open={...routes[0],points},closed={...open,closed:true},before=JSON.stringify(closed);
 const geometry=points.map(point=>`${point.x*12.8},${point.y*10.83}`).join(' ');
 const openHTML=render(PublishedRouteOverlay,{routes:[open]}),closedHTML=render(PublishedRouteOverlay,{routes:[closed]});
 assert(openHTML.includes(`points="${geometry}"`));
 assert(closedHTML.includes(`points="${geometry} 128,216.6"`));
 assert.equal((closedHTML.match(/data-route-point=/g)||[]).length,3);
 const legend=render(PublishedRouteLegend,{routes:[closed]});
 assert.equal((legend.match(/<li>/g)||[]).length,3);
 assert(legend.indexOf('Start')<legend.indexOf('Middle')&&legend.indexOf('Middle')<legend.indexOf('Finish'));
 assert.equal(closed.points.length,3);assert.equal(JSON.stringify(closed),before);
 assert.match(legend,/Замкнутый маршрут/);
 assert(!render(PublishedRouteLegend,{routes:[open]}).includes('Замкнутый маршрут'));
 assert(render(PublishedRouteOverlay,{routes:[{...closed,closed:false}]}).includes(`points="${geometry}"`));
});

test('reversed closed route retains each point label and colour and closes back to its new first point',()=>{
 const {PublishedRouteOverlay,PublishedRouteLegend}=loader()('app/components/PublishedRouteMap.tsx');
 const original={...routes[0],closed:true,points:[{x:10,y:20,label:'Start',color:'gold'},{x:30,y:40,label:'Middle',color:'sea'},{x:50,y:60,label:'Finish',color:'coral'}]};
 const before=JSON.stringify(original),reverse={...original,points:[...original.points].reverse()};
 const geometry=reverse.points.map(point=>`${point.x*12.8},${point.y*10.83}`).join(' ');
 const html=render(PublishedRouteOverlay,{routes:[reverse]}),legend=render(PublishedRouteLegend,{routes:[reverse]});
 assert(html.includes(`points="${geometry} 640,649.8"`));
 assert.equal((html.match(/data-route-point=/g)||[]).length,3);
 assert(legend.indexOf('Finish')<legend.indexOf('Middle')&&legend.indexOf('Middle')<legend.indexOf('Start'));
 assert.match(html,/background-color:#ff9d8a[^>]*title="Ocean route: Finish"/);
 assert.equal(JSON.stringify(original),before);
});

test('closed-route explanation is localized in all supported interface languages',()=>{
 const closed={...routes[0],closed:true,points:[...routes[0].points,{x:70,y:50,label:'Last'}]};
 for(const locale of ['ru','en','th']){
  const {PublishedRouteLegend}=loader(locale)('app/components/PublishedRouteMap.tsx');
  assert(render(PublishedRouteLegend,{routes:[closed]}).includes(({ru:'Замкнутый маршрут',en:'Closed-loop route',th:'เส้นทางแบบวงรอบ'})[locale]));
 }
});
