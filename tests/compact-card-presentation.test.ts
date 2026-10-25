import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard,cardCases} from './card-presentation-fixture';

const css=readFileSync('app/reference-preview/reference.module.css','utf8');
const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
const presentation=css.slice(css.indexOf('/* Palm card rhythm'));

test('Every price state is immediately grouped with its title, before preserved metadata',()=>{
  for(const item of Object.values(cardCases)){
    const html=renderCard(item);
    assert.match(html,/<div class="cardSummary"><h3>[^<]+<\/h3><div class="price"><strong>/);
    assert(html.indexOf('class="cardSummary"')<html.indexOf('class="cardMeta"'));
    assert(html.includes('Острова и море'));
    assert(html.includes('1 день'));
    assert(html.includes('data-tour-link="'+item.id+'"'));
    assert(html.includes('/tour/'+item.slug+'?variant='+item.variants[0].id));
    assert(!html.includes('cardArrow'));
    assert(!html.includes('arrow-right'));
  }
});

test('Published price semantics are preserved: from, person, craft, request and future dates',()=>{
  assert.match(renderCard(cardCases.adult),/<strong>2\s600 ฿<\/strong><small>за взрослого/);
  assert.match(renderCard(cardCases.from),/<strong>от 2\s600 ฿/);
  assert.match(renderCard(cardCases.craft),/<strong>7\s900 ฿<\/strong><small>за гидроцикл \(1–2 человека\)/);
  assert.match(renderCard(cardCases.person),/<small>за человека/);
  assert.match(renderCard(cardCases.request),/<strong>По запросу<\/strong><small>Уточним на вашу дату/);
  assert(!renderCard(cardCases.request).includes('>По запросу</span>'));
  assert.match(renderCard(cardCases.future),/<small>с 15\.01\.2027 · за взрослого · трансфер оплачивается отдельно/);
});

test('All variants contribute rates, and display date restrictions still apply',()=>{
  const item=structuredClone(cardCases.adult);
  const second=structuredClone(item.variants[0]);
  second.rates[0].amountMinor=190000;
  second.rates[0].id='lower-rate';
  item.variants.push(second);
  assert.match(renderCard(item),/<strong>от 1\s900 ฿/);
  item.variants.forEach(variant=>{
    variant.rates[0].optionKey='future';
    variant.priceOptions=[{key:'future',label:'Future',serviceDateFrom:'2027-02-01',serviceDateUntil:null,conditions:[],supplements:[]}];
  });
  assert.match(renderCard(item),/<small>с 01\.02\.2027 · за взрослого/);
});

test('Availability and favorite behavior remain present and distinct from card navigation',()=>{
  const item=structuredClone(cardCases.adult);item.status='temporarily_unavailable';
  const html=renderCard(item,true,true);
  assert(html.includes('Доступность уточняется'));
  assert.match(html,/<\/a><button type="button" class="favorite"/);
  assert(html.includes('aria-pressed="true"'));
  assert(html.includes('disabled=""'));
  assert(home.includes('onClick={() => onFavorite(tour.id)}'));
});

test('Layout has no footer spacer or fixed card height; wrapping stays safe at every breakpoint',()=>{
  assert(!css.includes('.cardBottom'));
  assert(!css.includes('.cardArrow'));
  assert(presentation.includes('.cardLink {display:block;min-width:0;height:auto;'));
  assert(presentation.includes('align-items:start;gap:26px 18px'));
  assert(presentation.includes('.cardSummary {display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0}'));
  assert(presentation.includes('.cardContent {min-width:0;padding-top:12px;overflow-wrap:anywhere}'));
  assert(presentation.includes('.price {min-width:0;overflow-wrap:anywhere}'));
  assert(presentation.includes('.cardMeta>span>span {min-width:0;overflow-wrap:anywhere}'));
  assert(presentation.includes('min-height:0;margin-top:10px'));
  assert(presentation.includes('@media(max-width:1050px) {.cards {grid-template-columns:repeat(2,minmax(0,1fr))}'));
  assert(presentation.includes('.cards {grid-template-columns:1fr;gap:24px}'));
  assert(!/\.(?:cardLink|cardSummary|cardContent|price)[^{]*\{[^}]*(?:white-space:nowrap|text-overflow:ellipsis|line-clamp|margin-top:auto)/.test(presentation));
});
