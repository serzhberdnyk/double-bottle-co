import {validRates, type Rate, type Variant, type PriceOption} from './types';

export interface RateSelection {id:string;amountMinor:number;currency:string}
export function rateSelection(rates:Rate[],date:string):RateSelection[]{return validRates(rates,date).map(({id,amountMinor,currency})=>({id,amountMinor,currency})).sort((a,b)=>a.id.localeCompare(b.id));}

/** Future seasons and on-request prices remain bookable; expired/disabled choices do not. */
export function availablePriceOptions(variant:Variant,date=todayInThailand()):PriceOption[]{
 if(variant.status==='temporarily_unavailable')return [];
 return (variant.priceOptions||[]).filter(option=>{
  const availability=option as PriceOption&{disabled?:boolean;status?:string};
  const earliest=[date,variant.earliestDate||'',option.serviceDateFrom||''].sort().at(-1)!;
  return !availability.disabled&&availability.status!=='temporarily_unavailable'&&(!option.serviceDateUntil||option.serviceDateUntil>=earliest);
 });
}

export function selectPriceOption(variant:Variant,key?:string):{option:PriceOption|null;variant:Variant}{
 const options=availablePriceOptions(variant);
 // A known retired choice can resolve to the sole remaining choice; unknown keys still fail closed.
 const option=key!==undefined?options.find(o=>o.key===key)||(options.length===1&&variant.priceOptions?.some(o=>o.key===key)?options[0]:null):options[0]||null;
 if((key!==undefined||variant.priceOptions?.length)&&!option)return {option:null,variant:{...variant,rates:[]}};
 return {option,variant:option?{...variant,rates:variant.rates.filter(r=>r.optionKey===option.key)}:variant};
}

/** Child age/height and craft/room occupancy must never be guessed from a headcount. */
export function publicQuote(rates:Rate[],date:string,adults:number,children:number,childrenAges='',option:PriceOption|null=null){
 const inSeason=(!option?.serviceDateFrom||date>=option.serviceDateFrom)&&(!option?.serviceDateUntil||date<=option.serviceDateUntil);
 const current=inSeason?validRates(rates,date):[];
 const adult=current.filter(r=>r.audience==='adult'),child=current.filter(r=>r.audience==='child');

 const optionKeys=new Set(current.map(r=>r.optionKey||''));
 const ageText=childrenAges.trim().replace(/(?:лет|года?|год|years?|yrs?|ปี)/gi,'').replace(/\s+(?:и|and|และ)\s+/gi,',');
 const ages=/^\s*\d{1,2}(?:\s*[,;]\s*\d{1,2})*\s*$/.test(ageText)?ageText.match(/\d+/g)!.map(Number):[];
 const ranges=child.length===1?[...`${child[0].unit} ${child[0].conditions}`.matchAll(/(\d{1,2})\s*[–—-]\s*(\d{1,2})\s*(?:лет|года?|год)/g)].map(m=>[Number(m[1]),Number(m[2])]):[];
 const rangeKeys=new Set(ranges.map(r=>r.join('-'))),range=ranges[0];
 const rule=child[0]?.ageRule;
 const sourceAgeKnown=rule?ages.length===children&&ages.every(n=>n>=rule.min&&n<=rule.max)&&!rule.requiresConfirmation:null;
 const ageKnown=!children||(child.length===1&&(sourceAgeKnown!==null?sourceAgeKnown:(child.length===1&&rangeKeys.size===1&&range&&ages.length===children&&ages.every(n=>n>=range[0]&&n<=range[1])&&!/рост|см|допуск|участие согласуется/i.test(child[0].unit+' '+child[0].conditions))));
 const calculable=Number.isInteger(adults)&&adults>=1&&adults<=50&&Number.isInteger(children)&&children>=0&&children<=30&&optionKeys.size<=1&&adult.length===1&&(!children||child.length===1)&&(!children||child[0].currency===adult[0].currency)&&!!ageKnown;
 const currency=calculable?adult[0].currency:null;
 const totalMinor=calculable?adult[0].amountMinor*adults+(children?child[0].amountMinor*children:0):null;
 return {status:calculable?'published':'on_request',currency,totalMinor,rates:current,supplementsIncluded:false,availabilityConfirmed:false};
}

export function publicRateNotes(variant:Variant,option:PriceOption|null=null){
 const unique=(xs:string[])=>[...new Set(xs.map(x=>x.trim()).filter(Boolean))];
 return {conditions:unique([...(option?.conditions||[]),...variant.rates.map(r=>r.conditions)]),supplements:unique([...(option?.supplements||[]),...variant.rates.flatMap(r=>r.supplements)])};
}
export function todayInThailand(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}

export function displayRates(variant:Variant,option:PriceOption|null=null):Rate[]{
 return variant.rates.flatMap(rate=>{
  const o=option||variant.priceOptions?.find(x=>x.key===rate.optionKey);
  const validFrom=o?.serviceDateFrom&&o.serviceDateFrom>rate.validFrom?o.serviceDateFrom:rate.validFrom;
  const validUntil=o?.serviceDateUntil&&(!rate.validUntil||o.serviceDateUntil<rate.validUntil)?o.serviceDateUntil:rate.validUntil;
  return validUntil&&validUntil<validFrom?[]:[{...rate,validFrom,validUntil}];
 });
}
