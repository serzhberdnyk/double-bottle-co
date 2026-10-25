import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artAnchorPosition,SOURCE_ART_SIZE,supplementaryPOIs,phuketAirportPOI,bigBuddhaPOI} from '../app/reference-preview/supplementary-pois';
import {phuketAirport} from '../app/reference-preview/airport-landmark';
import {bigBuddha} from '../app/reference-preview/reference-landmarks';

const source=readFileSync('app/reference-preview/MapPOI.tsx','utf8');
const css=readFileSync('app/reference-preview/MapPOI.module.css','utf8');

test('Supplemental POIs reuse the approved assets and copy, without art anchors or catalogue associations',()=>{
  assert.deepEqual(supplementaryPOIs.map(item=>item.id),[phuketAirport.id,bigBuddha.id]);
  assert.equal(phuketAirportPOI.title,phuketAirport.name);
  assert.equal(phuketAirportPOI.image,'/media/reference/airport-plane-cutout.png');
  assert.deepEqual(phuketAirportPOI.descriptions,[phuketAirport.placeholder]);
  assert.equal(phuketAirportPOI.imageSize,48);
  assert.equal(bigBuddhaPOI.title,bigBuddha.name);
  assert.equal(bigBuddhaPOI.image,bigBuddha.image);
  assert.deepEqual(bigBuddhaPOI.descriptions,[bigBuddha.description]);
  assert.equal(bigBuddhaPOI.imageSize,40);
  const existingBuddhaCard=readFileSync('app/reference-preview/BigBuddhaMarker.tsx','utf8');
  for(const text of [bigBuddhaPOI.notice,bigBuddhaPOI.caution,bigBuddhaPOI.link.label])assert(existingBuddhaCard.includes(text));
  assert.equal(bigBuddhaPOI.link.href,'/#selected');
  for(const item of supplementaryPOIs) {
    for(const key of ['anchor','lat','lng','tourIds','confirmedTourIds'])assert(!(key in item));
  }
});

test('Source-pixel placement is proportional to the exact art box, without a geographic projection',()=>{
  assert.deepEqual(SOURCE_ART_SIZE,{width:1280,height:1083});
  assert.deepEqual(artAnchorPosition({x:0,y:0}),{left:'0%',top:'0%'});
  assert.deepEqual(artAnchorPosition({x:640,y:541.5}),{left:'50%',top:'50%'});
  assert.deepEqual(artAnchorPosition({x:1280,y:1083}),{left:'100%',top:'100%'});
  for(const anchor of [{x:-1,y:0},{x:0,y:-1},{x:1281,y:0},{x:0,y:1084},{x:NaN,y:0},{x:0,y:Infinity}]) {
    assert.throws(()=>artAnchorPosition(anchor),RangeError);
  }
  assert(!source.includes('project('));
  assert(source.includes("{placement:'art';anchor:ArtAnchor;placementNotice?:string}"));
  assert(source.includes("{placement:'list';anchor?:never;placementNotice?:never}"));
  assert(source.includes("style={props.placement==='art'?artAnchorPosition(props.anchor):undefined}"));
});

test('One native button and Radix popover supply the shared keyboard, dismissal and focus contract',()=>{
  for(const contract of ['Popover.Root','Popover.Trigger asChild','ref={trigger} type="button"','aria-label={`${item.title}',
    'aria-pressed={open}','Popover.Content','aria-labelledby={titleId}','aria-describedby={descriptionId}',
    'Popover.Close type="button"','onEscapeKeyDown','onInteractOutside','onCloseAutoFocus',
    'trigger.current.focus({preventScroll:true})','trigger.current?.isConnected'])assert(source.includes(contract),contract);
  // Native buttons and Radix own Enter/Space activation; custom key handlers risk double toggles.
  assert(!source.includes('onKeyDown='));
  assert(!source.includes('fetch('));
});

test('Dialog reuse retains the portal boundary and never stops pointer or click propagation',()=>{
  assert(source.includes('portalContainer?:HTMLElement|null'));
  assert(source.includes('Popover.Portal container={portalContainer}'));
  assert(source.includes('collisionBoundary={portalContainer}'));
  // Radix must observe bubbling pointer events inside the card for outside dismissal.
  assert(!source.includes('stopPropagation'));
  assert(!source.includes('onPointerDown='));
  assert(css.includes('var(--radix-popover-content-available-height'));
  assert(css.includes('var(--radix-popover-content-available-width'));
  assert(css.includes('overflow-y:auto'));
});

test('Optional placement uncertainty is part of the art card accessible description only',()=>{
  assert(source.includes("props.placement==='art'&&props.placementNotice"));
  assert(source.includes('aria-describedby={descriptionId}'));
  const description=source.slice(source.indexOf('<div className={styles.cardBody} id={descriptionId}>'),source.indexOf('{item.link&&'));
  assert(description.includes('{props.placementNotice}'));
  assert(source.includes("placement:'list';anchor?:never;placementNotice?:never"));
});

test('Silhouette artwork keeps a constant target and uses interaction-only motion from its base',()=>{
  for(const token of ['min-width:44px','min-height:44px','width:56px','height:64px','background:transparent',
    'object-fit:contain','pointer-events:none','touch-action:manipulation'])assert(css.includes(token),token);
  assert(source.includes('<POIArtwork item={item} size={item.imageSize} className={styles.illustration}/>'));
  assert(!source.includes('anchorDot'));assert(!css.includes('anchorDot'));assert(!css.includes('artTrigger::after'));
  assert(!css.includes('artTrigger::after'));assert(!css.includes('@keyframes'));
  assert(css.includes('transform:translate(-50%,calc(-100% + 10px))'));
  assert(css.includes('bottom:10px'));assert(css.includes('transform-origin:50% 100%'));
  assert(css.includes('translate(-50%,-3px) scale(1.12)'));
  assert(css.includes('scale(.96);transition-duration:.1s'));
  assert(css.includes('transform:translateX(-50%)!important'));
  assert(css.includes('text-decoration:underline'));
});

test('Compact art labels are hidden at rest and exposed on hover, keyboard focus and open state',()=>{
  assert(css.includes('opacity:0'));
  assert(css.includes('visibility:hidden'));
  for(const selector of ['.artTrigger:hover .artLabel','.artTrigger:focus-visible .artLabel','.artTrigger[data-state="open"] .artLabel',
    '.artTrigger:focus-visible','.artTrigger:active .illustration','.listTrigger:focus-visible','prefers-reduced-motion:reduce'])assert(css.includes(selector),selector);
  assert(source.includes('Информация о месте'));
});

test('Approved plane vector is reused without deleting the original supplied airport logo',()=>{
  const svg=readFileSync('public/media/reference/airport-plane.svg','utf8');
  const artwork=readFileSync('app/reference-preview/POIArtwork.tsx','utf8');
  const path=svg.match(/d="([^"]+)"/)![1];assert(artwork.includes(path));
  assert(artwork.includes("item.kind==='airport'"));assert(artwork.includes("item.image==='/media/reference/airport-plane.svg'"));assert(artwork.includes('aria-hidden="true"'));
  assert(readFileSync('public/media/reference/phuket-airport-user-logo.png').length>0);
});
