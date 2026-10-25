import {priceLabel, type Rate, type Variant, type PriceOption} from './types';
import {displayRates, publicQuote, todayInThailand} from './pricing';

export const BOTTLE_DISCOUNT_PERCENT = 3;
/** Round once per published unit, in the catalogue's integer minor units. */
export function bottleAmount(amountMinor:number) {
  return Math.round(amountMinor * (100 - BOTTLE_DISCOUNT_PERCENT) / 100);
}
export function bottlePriceText(price:ReturnType<typeof priceLabel>) {
  if(!price.rate)return price.text;
  const rate={...price.rate,amountMinor:bottleAmount(price.rate.amountMinor)};
  return (price.text.startsWith('от ')?'от ':'')+priceLabel([rate],rate.validFrom).text;
}
function amountText(rate:Rate,amountMinor=rate.amountMinor) {
  return priceLabel([{...rate,amountMinor,audience:'adult'}],rate.validFrom).text;
}
/** A request note, never a booking or a guess at missing rates/supplements. */
export function bottleInquiryText(variant:Variant,option:PriceOption|null,date:string,adults:number,children:number,ages:string) {
  const day=date||todayInThailand();
  const rates=displayRates(variant,option);
  const before=publicQuote(rates,day,adults,children,ages,option);
  const after=publicQuote(rates.map(r=>({...r,amountMinor:bottleAmount(r.amountMinor)})),day,adults,children,ages,option);
  const lines=['Скидка 3% за послание в бутылке.'];
  for(const rate of before.rates)lines.push(`${amountText(rate)} → ${amountText(rate,bottleAmount(rate.amountMinor))} · ${rate.unit}`);
  if(date&&before.totalMinor!==null&&after.totalMinor!==null&&before.currency) {
    const rate=before.rates.find(r=>r.currency===before.currency)!;
    lines.push(`Стоимость группы: ${amountText(rate,before.totalMinor)} → ${amountText(rate,after.totalMinor)}.`);
  } else lines.push('Итоговая стоимость группы — по запросу.');
  if(!date)lines.push('Тарифы на сегодня; дату поездки ещё нужно выбрать.');
  lines.push('Доплаты не включены. Наличие и итоговую стоимость подтвердим до бронирования.');
  return lines.join('\n');
}
