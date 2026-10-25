'use client';
import {useI18n} from '@/lib/i18n/context';
const source = {
    title: 'Запросить дату', alternative: 'ИЛИ НАПИШИТЕ НАМ',
    alternativeHint: 'Удобнее в чате? Можно без формы.', close: 'Закрыть форму',
    
    date: 'Желаемая дата', adults: 'Взрослые', children: 'Дети',
    ages: 'Возраст детей, если едут с вами', agesPlaceholder: 'Например, 5 и 9 лет',
    name: 'Ваше имя', contact: 'Телефон, Telegram или email', contactPlaceholder: 'Как с вами связаться',
    note: 'Пожелания или район отеля', website: 'Сайт',
    consent: 'Согласен на обработку указанных данных для ответа на запрос.', privacy: 'Подробнее',
    sending: 'Сохраняем запрос…', openError: 'Не удалось открыть форму. Попробуйте ещё раз.',
    saved: 'Запрос сохранён',
    savedNote: 'Мы свяжемся с вами по указанному контакту, чтобы уточнить дату и стоимость. Бронирование ещё не подтверждено.',
    reference: 'Номер запроса:', back: 'Вернуться к программе',
    description: 'Укажите дату, гостей и контакт. Бронирование потребует подтверждения.',
  };

/** Keep visible inquiry copy aligned with the server-rendered page locale. */
export function useInquiryCopy() {
 const {locale,t}=useI18n();
 const copy = Object.fromEntries(Object.entries(source).map(([key,value])=>[key,t(value)])) as typeof source;
 return {language:locale,copy:{...copy,contactLabel:(service:string)=>t('Написать Double Bottle Co’ в {0} (откроется в новой вкладке)').replace('{0}',service)}};
}
