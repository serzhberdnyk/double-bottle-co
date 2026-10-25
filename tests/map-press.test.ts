import test from 'node:test';
import assert from 'node:assert/strict';
import {animateMapPress,reactToMapPress} from '../app/reference-preview/map-press';
import {mapBoats,boatAnchorPosition} from '../app/reference-preview/map-boats';

class MotionPreference extends EventTarget {
  matches=false;
  setReduced(value:boolean) {this.matches=value;this.dispatchEvent(new Event('change'));}
}
class PressAnimation extends EventTarget {
  cancelled=0;
  cancel() {this.cancelled++;this.dispatchEvent(new Event('cancel'));}
}
function fixture(t:{after:(fn:()=>void)=>void}) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
  const preference=new MotionPreference();
  Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>preference});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'matchMedia',descriptor);else Reflect.deleteProperty(globalThis,'matchMedia');});
  const calls:{frames:Keyframe[];options:KeyframeAnimationOptions;animation:PressAnimation}[]=[];
  const artwork={animate(frames:Keyframe[],options:KeyframeAnimationOptions){const animation=new PressAnimation();calls.push({frames,options,animation});return animation;}} as unknown as Element;
  return {preference,artwork,calls};
}

test('Press affects only rotation and scale of artwork, leaving map anchoring unchanged',t=>{
  const f=fixture(t);animateMapPress(f.artwork);
  assert.equal(f.calls.length,1);
  const {frames,options}=f.calls[0];
  assert.equal(options.duration,420);
  assert.deepEqual(frames.at(-1),{rotate:'0deg',scale:'1'});
  for(const frame of frames)assert(Object.keys(frame).every(key=>['rotate','scale','offset'].includes(key)));
  assert.equal(options.fill,undefined);
});

test('Repeated clicks restart one short reaction instead of stacking effects',t=>{
  const f=fixture(t);animateMapPress(f.artwork);animateMapPress(f.artwork);
  assert.equal(f.calls[0].animation.cancelled,1);
  assert.equal(f.calls[1].animation.cancelled,0);
  f.calls[1].animation.dispatchEvent(new Event('finish'));
  animateMapPress(f.artwork);
  assert.equal(f.calls[1].animation.cancelled,0);
});

test('Reduced-motion skips new effects and cancels one already running',t=>{
  const f=fixture(t);f.preference.setReduced(true);animateMapPress(f.artwork);
  assert.equal(f.calls.length,0);
  f.preference.setReduced(false);animateMapPress(f.artwork);f.preference.setReduced(true);
  assert.equal(f.calls[0].animation.cancelled,1);
  animateMapPress(f.artwork);assert.equal(f.calls.length,1);
});

test('Optional animation failures and missing artwork never cancel the existing action',t=>{
  fixture(t);
  assert.doesNotThrow(()=>animateMapPress(null));
  assert.doesNotThrow(()=>animateMapPress({} as Element));
  const artwork={animate(){throw new Error('Unsupported animation');}} as unknown as Element;
  let action=0;
  const event={currentTarget:{querySelector:()=>artwork}} as unknown as {currentTarget:HTMLElement};
  assert.doesNotThrow(()=>{reactToMapPress(event);action++;});
  assert.equal(action,1);
});

test('Both boats stay tied to their different original map dimensions and have RU/EN motion labels',()=>{
  assert.deepEqual(mapBoats.diving.map,{width:1280,height:1083});
  assert.deepEqual(mapBoats.pirate.map,{width:738,height:2048});
  for(const kind of ['diving','pirate'] as const){
    const boat=mapBoats[kind],position=boatAnchorPosition(kind);
    for(const dimension of ['x','y'] as const)assert(boat.anchor[dimension]>0);
    assert(Math.abs(parseFloat(position.left)/100*boat.map.width-boat.anchor.x)<.001);
    assert(Math.abs(parseFloat(position.top)/100*boat.map.height-boat.anchor.y)<.001);
    assert(boat.ru.action.length>boat.ru.title.length);assert(boat.en.action.length>boat.en.title.length);
    assert(boat.source.endsWith('.png'));
    for(const forbidden of ['href','tourId','price','program','contact'])assert(!(forbidden in boat));
  }
});
