import {priceLabel,type Rate,type Variant} from './types';
import {displayRates} from './pricing';
export function isPersonRate(rate:Rate){
 if(!['adult','person'].includes(rate.audience))return false;
 // Some sources use adult as a generic audience for whole-vehicle/group rates.
 return !/трансфер|аренд|групп|автомоб|минивэн|машин|транспорт|катер|лодк|гидроцикл|программ|комнат|transfer|rental|group|vehicle|car\b|van\b|boat|craft|room|เหมาคัน|เหมาลำ|ต่อกลุ่ม|ต่อคัน|ต่อลำ|เช่า/i.test(rate.unit);
}
/** Pair children only with the displayed adult's variant, option, currency and season. */
export function cardChildPrices(variants:Variant[],adult:ReturnType<typeof priceLabel>,today:string){
 const rate=adult.rate;
 if(!rate||!isPersonRate(rate))return {status:'not_applicable' as const,prices:[]};
 const variant=variants.find(v=>v.rates.some(r=>r.id===rate.id));
 const date=rate.validFrom>today?rate.validFrom:today;
 const children=variant?displayRates(variant).filter(r=>r.audience==='child'&&r.currency===rate.currency&&(r.optionKey||'')===(rate.optionKey||'')&&r.validFrom<=date&&(!r.validUntil||r.validUntil>=date)&&Number.isSafeInteger(r.amountMinor)&&r.amountMinor>=0):[];
 const unique=[...new Map(children.map(r=>[JSON.stringify([r.amountMinor,r.currency,r.unit,r.ageRule,r.conditions]),r])).values()];
 return {status:unique.length?'known' as const:'unknown' as const,prices:unique.map(r=>({price:priceLabel([{...r,audience:'adult'}],today),ageConfirmation:!!r.ageRule?.requiresConfirmation||(!r.ageRule&&!/\d+\s*[-–—]\s*\d+/.test(r.unit))}))};
}
