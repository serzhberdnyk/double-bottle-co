'use client';
import {localizedPriceUnit} from './localized-price';
import {useI18n} from '@/lib/i18n/context';

import {BottlePrice} from './BottlePrice';
import {useState} from 'react';
import {Dialog} from 'radix-ui';
import {X} from 'lucide-react';
import type {Tour} from '@/lib/public/types';
import {displayRates,todayInThailand} from '@/lib/public/pricing';
import {priceLabel,visitNames} from '@/lib/public/types';
export function Comparison({tours,open,onClose}:{tours:Tour[];open:boolean;onClose:()=>void}){
 const {t:tr,href:localHref,locale}=useI18n();
const [selected,setSelected]=useState<Record<string,string>>({});const variants=tours.map(t=>t.variants.find(v=>v.id===selected[t.id])||t.variants[0]);return <Dialog.Root open={open} onOpenChange={v=>{if(!v)onClose();}}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="comparison-modal"><Dialog.Title>{tr("Сравните впечатления")}</Dialog.Title><Dialog.Description>{tr("Маршрут, транспорт и условия относятся к выбранному варианту.")}</Dialog.Description><Dialog.Close className="modal-close" aria-label={tr("Закрыть сравнение")}><X size={22}/></Dialog.Close><div className="comparison-scroll"><table><thead><tr><th>{tr("Программа")}</th>{tours.map(t=><th key={t.id}><a href={localHref('/tour/'+t.slug)}>{t.title}</a><select aria-label={tr("Вариант: ")+t.title} value={selected[t.id]||t.variants[0].id} onChange={e=>setSelected(s=>({...s,[t.id]:e.target.value}))}>{t.variants.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></th>)}</tr></thead><tbody><tr><th>{tr("Длительность")}</th>{variants.map(v=><td key={v.id}>{v.duration}</td>)}</tr><tr><th>{tr("Транспорт")}</th>{variants.map(v=><td key={v.id}>{v.transport}</td>)}</tr><tr><th>{tr("Цена и единица")}</th>{variants.map(v=><td key={v.id}><BottlePrice price={priceLabel(displayRates(v),todayInThailand())}/><br/><small>{localizedPriceUnit(priceLabel(displayRates(v),todayInThailand()).unit,locale)}</small></td>)}</tr><tr><th>{tr("Места")}</th>{variants.map(v=><td key={v.id}>{v.stops.map(s=><p key={s.sequence}>{s.name}<br/><small>{tr(visitNames[s.visitType])}</small></p>)}</td>)}</tr><tr><th>{tr("Включено")}</th>{variants.map(v=><td key={v.id}>{v.includes.length?v.includes.join(' · '):tr("Уточняется")}</td>)}</tr><tr><th>{tr("Доплаты")}</th>{variants.map(v=><td key={v.id}>{v.extras.length?v.extras.join(' · '):tr("Уточняются")}</td>)}</tr></tbody></table></div></Dialog.Content></Dialog.Portal></Dialog.Root>;}
