import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactTourModel,safeCompactCondition,usesCompactTourLayout} from '../lib/public/compact-tour';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {product} from '../lib/server/catalog';
import {priceLabel} from '../lib/public/types';

test('Compact design opts in only the specifically approved canonical product',()=>{
  assert(usesCompactTourLayout({id:'p_7cbe8b01189d5eaca6d50242',slug:'phi-phi-paradise'}));
  assert(!usesCompactTourLayout({id:'other',slug:'phi-phi-paradise'}));
  assert(!usesCompactTourLayout({id:'p_7cbe8b01189d5eaca6d50242',slug:'other'}));
});

test('Compact facts, sequence and inclusion content come from the published variant, never raw pricing',async()=>{
  const db=testDatabase();const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
  const release=await stageImport(db,packet,'compact-test');await publishRelease(db,release.id,0,'compact-test');
  const result=await product(db,'phi-phi-paradise');assert(result);const {tour}=result,v=tour.variants[0],model=compactTourModel(tour,v);
  assert.equal(v.rates.length,0);assert.equal(priceLabel(v.rates).text,'По запросу');
  assert.equal(tour.image,'/media/maya-bay-project.webp');assert.deepEqual(model.itinerary,v.itinerary);assert.equal(model.itinerary.length,9);
  assert.deepEqual(model.includes,v.includes);assert.deepEqual(model.extras,v.extras);
  assert(model.schedule.some(line=>line.includes('понедельник, среда, пятница')&&line.includes('07:30')));
  assert(model.facts.includes('1 день'));assert(model.facts.includes('Катамаран'));assert(!model.facts.includes('По запросу'));
  assert(model.description.includes('Двухпалубный катамаран'));
  assert(!JSON.stringify(model).includes('2 200'));assert(!JSON.stringify(model).includes('2800'));
  assert(model.conditions.includes('Детский тариф и возрастную границу уточним при заявке.'));
  const changed={...v,conditions:['Рабочие дни: вторник. Начало программы: 09:00.']};
  assert.deepEqual(compactTourModel(tour,changed).schedule,changed.conditions);
  assert(!JSON.stringify(compactTourModel(tour,changed)).includes('07:30'));
});

test('Free text cannot introduce a numeric rate when public rates are absent',()=>{
  assert.equal(safeCompactCondition('Детский тариф - 2 200 ฿. Возраст уточняется.'),'Детский тариф и возрастную границу уточним при заявке.');
  assert.equal(safeCompactCondition('Стоимость 2800 THB'),'Стоимость и дополнительные расходы подтвердим на выбранную дату.');
  assert.equal(safeCompactCondition('Начало программы: 07:30; время трансфера согласуем отдельно.'),'Начало программы: 07:30; время трансфера согласуем отдельно.');
});

test('Compact routing preserves selected variant, release and the existing inquiry/favorites contract',()=>{
  const source=readFileSync('app/components/CatalogUI.tsx','utf8');
  const branch=source.slice(source.indexOf('if(usesCompactTourLayout(tour))'),source.indexOf('\n return <><Header/>',source.indexOf('export function TourPage')));
  assert(branch.includes('<CompactTourDetail tour={tour} variant={v}'));assert(branch.includes('<PriceDisplay variant={v}/>'));
  assert(branch.includes('<InquiryForm tour={tour} variant={v} releaseId={releaseId}'));
  assert(branch.includes('onCloseAutoFocus'));assert(branch.includes('compactRequestTrigger.current.focus({preventScroll:true})'));
  assert(source.includes('tour.variants.length>1'));assert(branch.includes('variantSelector={selectors}'));assert(source.includes('onChange={choose}'));
  assert(branch.includes('f.toggle(tour.id)'));assert(source.includes("new URLSearchParams(location.search)"));assert(source.includes("id=params.get('variant')"));
});

test('Compact header keeps icon-link accessible names and essential conditions are open',()=>{
  const css=readFileSync('app/components/CompactTourDetail.module.css','utf8');
  assert(!css.includes('.page :global(.icon-label span) { display: none; }'));
  assert(css.includes('.page :global(.icon-label span) { display:block; position:absolute; width:1px;'));
  const component=readFileSync('app/components/CompactTourDetail.tsx','utf8');
  assert(component.indexOf('model.includes.map')<component.indexOf('<details'));
  assert(component.indexOf('...model.extras,...model.conditions')<component.indexOf('<details'));
  assert(component.includes('src={tour.image}'));assert(!component.includes('gallery'));
  assert(css.includes('font: 400 20px/1.35'));assert(css.includes('.page { font-size: 19px; }'));
});

test('Compact requests return focus to the actual clicked CTA and preserve the boat caveat',()=>{
  const component=readFileSync('app/components/CompactTourDetail.tsx','utf8');
  assert(component.includes('onClick={event=>onRequest(event.currentTarget)}'));
  assert(component.includes('Конкретное судно и оснащение уточняются.'));
  const host=readFileSync('app/components/CatalogUI.tsx','utf8');
  assert(host.includes('onRequest={trigger=>{compactRequestTrigger.current=trigger;setOpen(true);}}'));
  assert(host.includes('compactRequestTrigger.current?.isConnected'));
});
