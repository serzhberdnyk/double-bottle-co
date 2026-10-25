import type {Tour} from './types';

/** Narrow, reversible public DTO safeguards. Canonical catalog records are not rewritten.
 * Owner authorized publication with uncertain fields on request on 2026-10-12.
 * Applied before both public rendering and inquiry quote/expected-rate validation.
 */
export function safePublicTour(tour:Tour):Tour {
  if(tour.id==='p_56d23e3e8778541d9a9b5bd2'&&tour.slug==='phi-phi-overnight') {
    return {...tour,variants:tour.variants.map(v=>{
      if(v.id!=='v_bf7e501e6e205ac58a4c945e')return v;
      const conflicting=v.rates.some(r=>r.id.split('__').at(-1)==='rel_a4052de1479ca1bfe3febe64_v_bf7e501e6e205ac58a4c945e_1'&&r.audience==='child'&&r.amountMinor===360000);
      if(!conflicting)return v;
      const note='Детская цена — по запросу. Возраст и размещение ребёнка подтвердим перед оплатой.';
      return {...v,rates:v.rates.filter(r=>!(r.id.split('__').at(-1)==='rel_a4052de1479ca1bfe3febe64_v_bf7e501e6e205ac58a4c945e_1'&&r.audience==='child'&&r.amountMinor===360000)),conditions:[...new Set([...v.conditions.map(x=>/Детская цена\s*[-—–]\s*4\s*500\s*฿/.test(x)?note:x),note])]};
    })};
  }
  if(tour.id==='p_bb216414a1755c4f8b80c6b3'&&tour.slug==='jet-ski-south') {
    return {...tour,variants:tour.variants.map(v=>v.id==='v_65633dcd9f815af49c130cc4'&&v.description==='Другая модель гидроцикла; стоимость уточняется'
      ?{...v,description:'Yamaha 1800. Тариф указан за один гидроцикл выбранной загрузки; итоговую стоимость подтвердим до бронирования.'}:v)};
  }
  if(tour.id==='p_f60658ace81d54048d0d6a8a'&&tour.slug==='khao-sok') {
    const clearAge=(text:string)=>text.replace('Доступную дату, размещение и детский возраст нужно согласовать; в источниках возраст 4–9 / 4–10.','Доступную дату, размещение и возрастные условия детского тарифа подтвердим до бронирования.');
    return {...tour,variants:tour.variants.map(v=>({...v,priceOptions:v.priceOptions?.map(o=>({...o,conditions:o.conditions.map(clearAge)})),rates:v.rates.map(r=>({...r,conditions:clearAge(r.conditions)}))}))};
  }
  return tour;
}
