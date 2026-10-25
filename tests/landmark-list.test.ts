import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

for(const component of ['AirportMarker','BigBuddhaMarker']) {
  test(`${component} has an explicitly nonspatial list button and preserves map mode by default`,()=>{
    const source=readFileSync(`app/reference-preview/${component}.tsx`,'utf8');
    assert(source.includes("placement='map'"));
    assert(source.includes("placement?:'map'|'list'"));
    assert(source.includes("const isList=placement==='list'"));
    assert(source.includes('isList?listStyles.landmarkButton:styles.'));
    assert(source.includes("style={isList?undefined:{left:x/10+'%',top:y/7.5+'%'}}"));
    assert(source.includes('data-landmark-placement={placement}'));
    assert(source.includes('Без привязки к карте'));
    assert(source.includes('listStyles.landmarkLabel'));
    assert(source.includes('PopoverPrimitive.Trigger asChild'));
    assert(source.includes('type="button"'));
    assert(source.includes('PopoverPrimitive.Close'));
    assert(source.includes('PopoverPrimitive.Portal'));
  });

  test(`${component} preserves dialog outside-dismiss and keeps list popovers in their scroll container`,()=>{
    const source=readFileSync(`app/reference-preview/${component}.tsx`,'utf8');
    assert(source.includes('portalContainer?:HTMLElement|null'));
    assert(source.includes('PopoverPrimitive.Portal container={isList?portalContainer:undefined}'));
    assert(source.includes('collisionBoundary={isList?portalContainer:undefined}'));
    assert(source.includes("isList?listStyles.landmarkPopover:''"));
    assert(source.includes('onPointerDown={event=>{if(!isList)event.stopPropagation();}}'));
    assert(source.includes('onClick={event=>{if(!isList)event.stopPropagation();}}'));
    assert(!source.includes('event=>event.stopPropagation()'));
  });
}

test('List buttons have independent, nonspatial styling and accessible target sizes',()=>{
  const css=readFileSync('app/reference-preview/landmark-list.module.css','utf8');
  assert(css.includes('min-width:44px'));
  assert(css.includes('min-height:64px'));
  assert(css.includes('object-fit:contain'));
  assert(css.includes('.landmarkButton:focus-visible'));
  assert(css.includes('.landmarkButton[data-state="open"]'));
  assert(css.includes('prefers-reduced-motion:reduce'));
  assert(!/position\s*:|transform\s*:|\b(?:top|left|right|bottom)\s*:/.test(css));
});

test('Airport list mode keeps the existing close and focus restoration handlers',()=>{
  const source=readFileSync('app/reference-preview/AirportMarker.tsx','utf8');
  for(const handler of ['onEscapeKeyDown','onInteractOutside','onCloseAutoFocus','trigger.current?.focus']) assert(source.includes(handler));
  assert(source.includes('{phuketAirport.placeholder}'));
});

test('List popovers are scrollable within the space available inside their dialog boundary',()=>{
  const css=readFileSync('app/reference-preview/landmark-list.module.css','utf8');
  assert(css.includes('.landmarkPopover:global(.destination-popover)'));
  assert(css.includes('max-height:min(640px,var(--radix-popover-content-available-height))'));
  assert(css.includes('overflow-y:auto'));
});
