import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usesCompactTourLayout} from '../lib/public/compact-tour';
const source=readFileSync('app/components/PriceOptions.tsx','utf8');
const css=readFileSync('app/components/CompactTourDetail.module.css','utf8');
function handler(name:string){
 const match=source.match(new RegExp('on'+name+'=\\{event=>\\{([^}]+)\\}\\}'));
 assert(match,`Missing ${name} handler`);
 return new Function('event',match[1]);
}
test('Price selector marks pointer focus, restores keyboard focus, and resets after blur',()=>{
 const event={currentTarget:{dataset:{} as Record<string,string>}};
 handler('PointerDown')(event);assert.equal(event.currentTarget.dataset.pointerFocus,'true');
 handler('KeyDown')(event);assert.equal(event.currentTarget.dataset.pointerFocus,undefined);
 handler('PointerDown')(event);handler('Blur')(event);assert.equal(event.currentTarget.dataset.pointerFocus,undefined);
 handler('PointerDown')(event);assert.equal(event.currentTarget.dataset.pointerFocus,'true');
 assert(source.includes('onChange={event=>onChange(event.target.value)}'));
 assert(source.includes('aria-label="Тариф и условия"'));
});
test('Only the compact tariff pointer outline is suppressed, preserving keyboard outline and dark border',()=>{
 assert(css.includes('.variantSelector :global(.price-option-selector select[data-pointer-focus]:focus){outline:none}'));
 assert(css.includes('.page select:focus-visible'));
 assert(css.includes('outline:3px solid #ec6b3f;outline-offset:4px'));
 assert(css.includes('.price-option-selector select){color:var(--ink);border:2px solid var(--ink)'));
 for(const tour of [{id:'p_7cbe8b01189d5eaca6d50242',slug:'phi-phi-paradise'},{id:'p_40cbe5f22267527c94bc5a8b',slug:'phi-phi-sunrise'}])assert(usesCompactTourLayout(tour));
});
