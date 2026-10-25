import {z} from 'zod';
import type {Rate,Variant} from './types';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
export const newSellingRateSchema=z.object({optionKey:z.string().min(1).max(100).optional(),audience:z.enum(['adult','child']),amountMinor:z.number().int().positive().max(1000000000),currency:z.literal('THB'),unit:z.string().trim().min(1).max(200),validFrom:date,validUntil:date.nullable(),conditions:z.string().max(2000)}).strict().refine(r=>!r.validUntil||r.validUntil>=r.validFrom);
export type NewSellingRate=z.infer<typeof newSellingRateSchema>;
export function validateNewSellingRates(variant:Variant,rates:NewSellingRate[]=[]){
 const keys=new Set<string>();for(const r of rates){const key=(r.optionKey||'')+':'+r.audience;
 if(keys.has(key)||variant.rates.some(x=>(x.optionKey||'')===(r.optionKey||'')&&x.audience===r.audience))throw Error('DUPLICATE_PRICE');keys.add(key);
 if(variant.priceOptions?.length?!variant.priceOptions.some(o=>o.key===r.optionKey):!!r.optionKey)throw Error('INVALID_PRICE_OPTION');
 }
}
export function previewSellingRates(variant:Variant,edit:{rates:{id:string;amountMinor:number|null}[];newRates?:NewSellingRate[]}):Rate[]{
 return [...variant.rates.flatMap(r=>{const e=edit.rates.find(x=>x.id===r.id);return e?.amountMinor===null?[]:[{...r,amountMinor:e?.amountMinor??r.amountMinor}];}),...(edit.newRates||[]).map((r,i)=>({...r,id:'new:'+i,supplements:[]}))];
}
export function sellingMinorUnits(value:string):number|null{const s=value.trim().replace(',','.');if(!s)return null;if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(s))throw Error('Введите положительную цену с точностью до двух знаков.');const [whole,cents='']=s.split('.'),n=Number(whole)*100+Number(cents.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0||n>1000000000)throw Error('Проверьте сумму цены.');return n;}
