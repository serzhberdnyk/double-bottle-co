'use client';
import {useI18n} from '@/lib/i18n/context';


import {useBottleDiscount} from '@/hooks/use-bottle-discount';
import {bottleAmount} from '@/lib/public/bottle-discount';
import {localizedPriceText} from './localized-price';
import type {priceLabel} from '@/lib/public/types';
import styles from './BottlePrice.module.css';

export function BottlePrice({price}:{price:ReturnType<typeof priceLabel>}) {
 const {t:tr,locale}=useI18n();

  const active=useBottleDiscount();
  if(!active||!price.rate)return <>{localizedPriceText(price,locale)}</>;
  return <span className={styles.prices} data-bottle-price>
    <del aria-label={tr("Цена без скидки: ")+localizedPriceText(price,locale)}>{localizedPriceText(price,locale)}</del>
    <span aria-label={tr("Со скидкой 3%: ")+localizedPriceText(price,locale,bottleAmount(price.rate.amountMinor))}>{localizedPriceText(price,locale,bottleAmount(price.rate.amountMinor))}</span>
    <small className={styles.badge}>−3%</small>
  </span>;
}
