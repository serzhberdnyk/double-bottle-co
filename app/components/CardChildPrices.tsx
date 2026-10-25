'use client';
import {useI18n} from '@/lib/i18n/context';
import {cardChildPrices} from '@/lib/public/card-child-prices';
import type {priceLabel,Variant} from '@/lib/public/types';
import {BottlePrice} from './BottlePrice';
import {localizedPriceUnit} from './localized-price';
import styles from './CardChildPrices.module.css';
export function CardChildPrices({variants,adult,today,compact=false}:{variants:Variant[];adult:ReturnType<typeof priceLabel>;today:string;compact?:boolean}){
 const {t,locale}=useI18n();
 const child=cardChildPrices(variants,adult,today);
 if(child.status==='not_applicable')return null;
 return <div className={compact?`${styles.children} ${styles.compact}`:styles.children} data-card-child-prices>{child.status==='unknown'?<p>{t('Детская цена уточняется')}</p>:child.prices.map(({price,ageConfirmation},i)=><p key={price.rate?.id||i}><span className={styles.amount}><BottlePrice price={price}/></span>{' '}<span>{localizedPriceUnit(price.unit,locale)}</span>{ageConfirmation&&<small>{t('Возрастные условия уточняются')}</small>}</p>)}</div>;
}
