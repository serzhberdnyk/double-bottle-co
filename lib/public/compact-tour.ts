import {isApprovedReviewTour} from './approved-review-queue';
import type {Tour,Variant} from './types';

/** Deliberately opt in individually approved products; other detail pages keep their current design. */
export function usesCompactTourLayout(tour:Pick<Tour,'id'|'slug'>):boolean {
  return tour.id.startsWith('p_at_') || ['p_e340acb314a559f4b49a6e22','p_1cdc3b7fc1625ada979ad010','p_dd70e1051d36596481a18438'].includes(tour.id) || isApprovedReviewTour(tour) || (tour.id==='p_7cbe8b01189d5eaca6d50242'&&tour.slug==='phi-phi-paradise')
    || (tour.id==='p_40cbe5f22267527c94bc5a8b'&&tour.slug==='phi-phi-sunrise')
    || (tour.id==='p_3667f6d249165a538cd50188'&&tour.slug==='phi-phi-fishing')
    || (tour.id==='p_26d3b3eb87f65341b3af9fcc'&&tour.slug==='phi-phi-racha-party');
}

const known=(value:string)=>!!value.trim()&&!/^(?:по запросу|не указано|уточняется|[—-])$/i.test(value.trim());
const unique=(items:string[])=>[...new Set(items.map(value=>value.trim()).filter(Boolean))];
const moneyText=/(?:\d[\d\s\u00a0.,]*\s*(?:฿|THB|USD|EUR|₽|руб\.?|бат(?:ов)?|\$|€))|(?:(?:тариф|стоимость|цена)\s*[-:–]?\s*\d)/i;

/** Free-text conditions are never a substitute for published Rate records. */
export function safeCompactCondition(value:string):string {
  if(!moneyText.test(value))return value;
  return /детск|реб[её]н|возраст/i.test(value)
    ?'Детский тариф и возрастную границу уточним при заявке.'
    :'Стоимость и дополнительные расходы подтвердим на выбранную дату.';
}

export function compactTourModel(tour:Tour,variant:Variant) {
  const preserve=isApprovedReviewTour(tour)||(tour.id==='p_40cbe5f22267527c94bc5a8b'&&tour.slug==='phi-phi-sunrise') ? (value:string)=>value : safeCompactCondition;
  const schedule=variant.conditions.filter(line=>/^\s*(?:Рабочие дни|Начало программы)\s*:/i.test(line));
  const routeNotes=variant.conditions.filter(line=>/порядок остановок|погод[аы]|уровня воды/i.test(line));
  const conditions=variant.conditions.filter(line=>!schedule.includes(line)&&!routeNotes.includes(line));
  const nameFacts=variant.name.split('·').map(value=>value.trim()).filter(known);
  const facts=unique([variant.duration,variant.transport,...nameFacts,...(known(variant.format)?[variant.format]:[])].filter(known));
  const overview=variant.description.trim()||tour.description.trim();
  // Keep the factual complement from the same public product description, not an invented boat/gallery claim.
  const description=tour.descriptionEdited?tour.description.trim():variant.description.trim()&&tour.description!==variant.description
    ?tour.description.split(/(?<=[.!?])\s+/).slice(1).join(' ').trim():'';
  return {
    facts,overview,description,
    schedule:unique(schedule.map(preserve)),
    includes:unique(variant.includes.map(preserve)),
    extras:unique(variant.extras.map(preserve)),
    conditions:unique(conditions.map(preserve)),
    itinerary:[...variant.itinerary],
    routeNotes:unique(routeNotes),
    unavailable:tour.status==='temporarily_unavailable'||variant.status==='temporarily_unavailable',
  };
}
