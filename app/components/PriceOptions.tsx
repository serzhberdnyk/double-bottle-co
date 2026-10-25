'use client';
import {localizedPriceUnit,localizedPriceText} from './localized-price';
import {useI18n} from '@/lib/i18n/context';

import {BottlePrice} from './BottlePrice';
import {useBottleDiscount} from '@/hooks/use-bottle-discount';
import {bottleAmount} from '@/lib/public/bottle-discount';
import type {Variant,PriceOption} from '@/lib/public/types';
import {priceLabel} from '@/lib/public/types';
import {availablePriceOptions,displayRates,publicRateNotes,todayInThailand} from '@/lib/public/pricing';

export function PriceOptionSelector({variant,value,onChange}:{variant:Variant;value?:string;onChange:(key:string)=>void}){
 const {t:tr,locale}=useI18n();

 const discountActive=useBottleDiscount();
 const options=availablePriceOptions(variant);
 if(options.length<2)return null;
 return <label className="price-option-selector">{tr("Тариф и условия")}<select value={value||''} onChange={event=>onChange(event.target.value)}
  onPointerDown={event=>{event.currentTarget.dataset.pointerFocus='true';}}
  onKeyDown={event=>{delete event.currentTarget.dataset.pointerFocus;}}
  onBlur={event=>{delete event.currentTarget.dataset.pointerFocus;}}
  aria-label={tr("Тариф и условия")}>
  {!value&&<option value="" disabled>{tr("Выберите тариф")}</option>}
  {options.map(option=>{const p=priceLabel(displayRates({...variant,rates:variant.rates.filter(r=>r.optionKey===option.key)},option),todayInThailand());return <option key={option.key} value={option.key}>{option.label} · {discountActive&&p.rate?localizedPriceText(p,locale)+' → '+localizedPriceText(p,locale,bottleAmount(p.rate.amountMinor))+' (−3%)':localizedPriceText(p,locale)}{p.rate?' · '+localizedPriceUnit(p.unit,locale):''}</option>;})}
 </select></label>;
}
export function PublicPriceConditions({variant,option}:{variant:Variant;option:PriceOption|null}){
 const {t:tr}=useI18n();

 const notes=publicRateNotes(variant,option);
 const windows=[...new Set(displayRates(variant,option).map(r=>tr("с ")+r.validFrom.split('-').reverse().join('.')+(r.validUntil?tr(" по ")+r.validUntil.split('-').reverse().join('.'):tr(" · дата окончания не указана"))))];
 if(!notes.conditions.length&&!notes.supplements.length&&!windows.length)return null;
 return <details className="public-price-conditions" open><summary>{tr("Условия тарифа и доплаты")}</summary>{windows.map(window=><p key={window}>{tr("Тариф:")} {window}</p>)}
  {notes.conditions.length>0&&<ul>{notes.conditions.map((line,i)=><li key={i}>{line}</li>)}</ul>}
  {notes.supplements.length>0&&<><strong>{tr("Доплаты")}</strong><ul>{notes.supplements.map((line,i)=><li key={i}>{line}</li>)}</ul></>}
 </details>;
}
export function ChildPriceLines({variant,option,date,showConditions=true}:{variant:Variant;option:PriceOption|null;date?:string;showConditions?:boolean}){
 const {locale}=useI18n();
 const today=date||todayInThailand(),rates=displayRates(variant,option).filter(r=>r.audience==='child'&&(!r.validUntil||r.validUntil>=today));
 return <>{rates.map(r=>{const p=priceLabel([{...r,audience:'adult'}],today);return <p key={r.id} className="child-price"><BottlePrice price={p}/> · {localizedPriceUnit(p.unit,locale)}{showConditions&&<small>{r.conditions}</small>}</p>;})}</>;
}
