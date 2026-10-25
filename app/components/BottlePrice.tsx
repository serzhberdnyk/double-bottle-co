'use client';
import {useI18n} from '@/lib/i18n/context';


import {useBottleDiscount} from '@/hooks/use-bottle-discount';
import {bottleAmount} from '@/lib/public/bottle-discount';
import {localizedPriceText} from './localized-price';
import type {priceLabel} from '@/lib/public/types';
import styles from './BottlePrice.module.css';

export function BottlePrice({price,layout='inline'}:{price:ReturnType<typeof priceLabel>;layout?:'inline'|'card'}) {
 const {t:tr,locale}=useI18n();

  const active=useBottleDiscount();
  if(!active||!price.rate)return <>{localizedPriceText(price,locale)}</>;
  // Card amounts always lead. The old amount/badge get their own wrapping slot,
  // so a discount cannot move the current price off its shared card baseline.
  if(layout==='card')return <span className={styles.cardPrices} data-bottle-price data-price-layout="card">
    <span className={styles.current} aria-label={tr("Со скидкой 3%: ")+localizedPriceText(price,locale,bottleAmount(price.rate.amountMinor))}>{localizedPriceText(price,locale,bottleAmount(price.rate.amountMinor))}</span>
    <span className={styles.savings}><del aria-label={tr("Цена без скидки: ")+localizedPriceText(price,locale)}>{localizedPriceText(price,locale)}</del><small className={styles.badge}>−3%</small></span>
  </span>;
  return <span className={styles.prices} data-bottle-price>
    <del aria-label={tr("Цена без скидки: ")+localizedPriceText(price,locale)}>{localizedPriceText(price,locale)}</del>
    <span aria-label={tr("Со скидкой 3%: ")+localizedPriceText(price,locale,bottleAmount(price.rate.amountMinor))}>{localizedPriceText(price,locale,bottleAmount(price.rate.amountMinor))}</span>
    <small className={styles.badge}>−3%</small>
  </span>;
}
