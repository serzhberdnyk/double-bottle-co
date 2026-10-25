export type VisitType = 'landing'|'snorkeling'|'boat_view'|'water_stop'|'passage'|'optional'|'conditional';
export type SaleStatus = 'on_request'|'temporarily_unavailable';
export interface Destination {id:string;slug:string;name:string;lat:number;lng:number;region:string;description:string;image:string|null;count?:number}
export interface Stop {destinationId:string;sequence:number;visitType:VisitType;required:boolean;note:string;name?:string;lat?:number;lng?:number}
export interface PriceOption {key:string;label:string;serviceDateFrom:string|null;serviceDateUntil:string|null;conditions:string[];supplements:string[]}
export interface Rate {ageRule?:{min:number;max:number;requiresConfirmation:boolean}|null;id:string;optionKey?:string;amountMinor:number;currency:string;unit:string;audience:string;validFrom:string;validUntil:string|null;conditions:string;supplements:string[]}
export interface Variant {image?:string|null;imageAlt?:string;visible?:boolean;id:string;revisionId:string;name:string;description:string;duration:string;days:number;transport:string;format:string;status:SaleStatus;stops:Stop[];itinerary:string[];includes:string[];extras:string[];conditions:string[];rates:Rate[];priceOptions?:PriceOption[];earliestDate:string|null}
export interface Tour {id:string;slug:string;title:string;description:string;descriptionEdited?:boolean;hidden?:boolean;category:string;image:string|null;imageAlt:string;status:SaleStatus;featuredRank:number;variants:Variant[]}
export interface Facets {categories:{id:string;name:string;count:number}[];durations:number[];transports:string[];formats:string[]}
export interface CatalogResponse {releaseId:string;generation:number;items:Tour[];total:number;page:number;pages:number;destinations:Destination[];facets:Facets;count:number}
export interface CatalogQuery {sort?:string;q?:string;category?:string;destination?:string;days?:string;transport?:string;format?:string;page?:number;limit?:number;featured?:boolean;release?:string;ids?:string[]}
export interface InquiryInput {productId:string;variantId:string;revisionId:string;releaseId:string;date:string;adults:number;children:number;childrenAges:string;contact:string;name:string;note:string;consent:boolean;website?:string;expectedRates:import('./pricing').RateSelection[];priceOptionKey?:string}
export const categoryNames:Record<string,string>={sea:'Острова и море',adventure:'Активный отдых',nature:'Природа и национальные парки',culture:'Культура и храмы',evening:'Шоу и вечерние программы',beyond:'Другие направления'};
export const visitNames:Record<VisitType,string>={landing:'Высадка',snorkeling:'Снорклинг рядом',boat_view:'Обзор с воды',water_stop:'Остановка на воде',passage:'Проход рядом',optional:'По желанию, за доплату',conditional:'Зависит от условий'};
export function validRates(rates:Rate[],date=new Date().toISOString().slice(0,10)){return rates.filter(r=>r.validFrom<=date&&(!r.validUntil||r.validUntil>=date));}
export function priceLabel(rates:Rate[],date=new Date().toISOString().slice(0,10)){
 const current=validRates(rates,date).filter(r=>r.audience!=='child');
 const future=rates.filter(r=>r.audience!=='child'&&r.validFrom>date&&(!r.validUntil||r.validUntil>=r.validFrom)).sort((a,b)=>a.validFrom.localeCompare(b.validFrom)||a.amountMinor-b.amountMinor);
 const upcoming=!current.length?future[0]?.validFrom:undefined;
 const candidates=current.length?current:future.filter(r=>r.validFrom===upcoming);
 const r=[...candidates].sort((a,b)=>a.amountMinor-b.amountMinor)[0];
 const multiple=new Set(candidates.map(r=>`${r.optionKey||''}:${r.amountMinor}:${r.unit}`)).size>1;
 const from=multiple?'от ':'';
 const starts=upcoming?'с '+upcoming.split('-').reverse().join('.')+' · ':'';
 return r?{text:from+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(r.amountMinor/100)+' '+(r.currency==='THB'?'฿':r.currency),unit:starts+r.unit,rate:r}:{text:'По запросу',unit:'Уточним на вашу дату',rate:null};
}
export function programWord(n:number){const a=Math.abs(n)%100,b=a%10;return a>=11&&a<=14?'программ':b===1?'программа':b>=2&&b<=4?'программы':'программ';}

/** Completed gallery caption; singular-ending counts avoid an awkward «все 21 программа». */
export function completedProgramLabel(n:number){
 if(n===0)return 'Нет программ';
 if(n===1)return '1 программа';
 if(n%10===1&&n%100!==11)return `Все программы · ${n}`;
 return `Все ${n} ${programWord(n)}`;
}
