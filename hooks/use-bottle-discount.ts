'use client';

import {useSyncExternalStore} from 'react';
import {bottleDiscountSnapshot,subscribeBottleDiscount} from '@/lib/public/bottle-discount-state';
export {activateBottleDiscount} from '@/lib/public/bottle-discount-state';

export function useBottleDiscount() {
  return useSyncExternalStore(subscribeBottleDiscount,bottleDiscountSnapshot,()=>false);
}
