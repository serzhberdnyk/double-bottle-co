import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {phuketAirport} from '../app/reference-preview/airport-landmark';
import {bigBuddha} from '../app/reference-preview/reference-landmarks';
import {project} from '../lib/public/geo';
import {geometryContains,fitMapPlane,pointInViewport} from '../lib/public/map-engine';

test('Airport uses the current official CAAT reference point inside Phuket',()=>{
  assert(Math.abs(phuketAirport.lat-(8+6/60+45/3600))<1e-10);
  assert(Math.abs(phuketAirport.lng-(98+18/60+33/3600))<1e-9);
  const geo=JSON.parse(readFileSync('public/map/andaman.geojson','utf8'));
  const land=geo.features.filter((feature:{geometry:Parameters<typeof geometryContains>[0]})=>geometryContains(feature.geometry,[phuketAirport.lng,phuketAirport.lat]));
  assert.equal(land.length,1);assert.equal(land[0].properties.id,1);
});

test('Airport shares the geographic viewport transform and stays separate from Big Buddha',()=>{
  const airport=project(phuketAirport.lng,phuketAirport.lat),buddha=project(bigBuddha.lng,bigBuddha.lat);
  assert(airport[1]<buddha[1]);
  for(const [width,height] of [[1202,737],[840,720],[390,590]]){
    const fit=fitMapPlane(width,height);const a=pointInViewport(airport,fit,{z:1,x:0,y:0}),b=pointInViewport(buddha,fit,{z:1,x:0,y:0});
    assert(Math.hypot(a[0]-b[0],a[1]-b[1])>60);
    assert(a[0]>0&&a[0]<width&&a[1]>0&&a[1]<height);
  }
});

test('Supplied airport artwork is unchanged and popover contains only the approved placeholder',()=>{
  assert.equal(createHash('sha256').update(readFileSync('public/media/reference/phuket-airport-user-logo.png')).digest('hex'),'ac5b7fd3f5046d71c5ca33c11b2f02fea855c3f45dec4b1a0bc858b7a6020273');
  assert.equal(phuketAirport.placeholder,'Информация об аэропорте появится здесь.');
  const code=readFileSync('app/reference-preview/AirportMarker.tsx','utf8');
  assert(code.includes('PopoverPrimitive.Trigger asChild'));assert(code.includes('type="button"'));
  assert(code.includes('aria-pressed={open}'));assert(code.includes('onEscapeKeyDown'));
  assert(code.includes('onInteractOutside'));assert(code.includes('onCloseAutoFocus'));
  assert(code.includes('PopoverPrimitive.Close'));assert(code.includes('trigger.current?.focus'));
  assert(code.includes('event.stopPropagation()'));assert(!code.includes('fetch('));
  assert(code.includes('project(phuketAirport.lng,phuketAirport.lat)'));
  assert(readFileSync('app/reference-preview/DestinationDirectory.tsx','utf8').includes('<MapPOI key={item.id} item={item} placement="list" portalContainer={portalContainer}/>'));
  const css=readFileSync('app/reference-preview/reference.module.css','utf8');
  assert(css.includes('.airportMarker:focus-visible'));assert(css.includes('.airportMarker[data-state="open"]'));
  assert(css.includes('min-width:44px;min-height:44px'));assert(css.includes('prefers-reduced-motion:reduce) {.airportMarker'));
});
