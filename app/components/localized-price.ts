import type {Locale} from '@/lib/i18n/core';
import {translateUi} from '@/lib/i18n/ui-copy';
import {priceLabel} from '@/lib/public/types';

/** Localize presentation only; quote amounts, rate IDs and selection remain unchanged. */
export function localizedPriceText(price:ReturnType<typeof priceLabel>,locale:Locale,amountMinor=price.rate?.amountMinor){
 if(!price.rate||amountMinor===undefined)return translateUi(price.text,locale);
 return (price.text.startsWith('от ')?translateUi('от ',locale):'')+new Intl.NumberFormat(locale==='ru'?'ru-RU':locale==='th'?'th-TH':'en-GB',{maximumFractionDigits:2}).format(amountMinor/100)+' '+(price.rate.currency==='THB'?'฿':price.rate.currency);
}
export function localizedPriceUnit(unit:string,locale:Locale){
 const starts=unit.match(/^с (\d{2}\.\d{2}\.\d{4}) · (.*)$/);
 return starts?translateUi('с ',locale)+starts[1]+' · '+translateUi(starts[2],locale):translateUi(unit,locale);
}
export function localizedInquiryNote(note:string,locale:Locale){
 return note.split('\n').map(line=>line.startsWith('Стоимость группы: ')?translateUi('Стоимость группы: ',locale)+line.slice('Стоимость группы: '.length):translateUi(line,locale)).join('\n');
}
