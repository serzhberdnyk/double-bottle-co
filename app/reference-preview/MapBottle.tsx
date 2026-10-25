'use client';
import {useI18n} from '@/lib/i18n/context';

import {Dialog} from 'radix-ui';
import {Eye, Sparkles, X} from 'lucide-react';
import {useInquiryCopy} from '../components/inquiry-copy';
import styles from './MapBottle.module.css';
import {reactToMapPress} from './map-press';
import {activateBottleDiscount} from '@/hooks/use-bottle-discount';
const copy = {
  ru: {open:'Бутылка в море: открыть награду',title:'Удачная находка',intro:'Вы заметили послание в бутылке.',attention:'+2 к внимательности',discount:'+3% к скидке',close:'Закрыть награду',done:'Отлично!'},
  en: {open:'Bottle in the sea: open reward',title:'A lucky discovery',intro:'You spotted a message in a bottle.',attention:'+2 to perception',discount:'+3% to discount',close:'Close reward',done:'Wonderful!'},
};
/** One discovery remembers the same 3% estimate in this browser. */
export function MapBottle() {
 const {t:tr}=useI18n();
  const {language}=useInquiryCopy(),text=Object.fromEntries(Object.entries(copy.ru).map(([key,value])=>[key,tr(value)])) as typeof copy.ru;
  return <Dialog.Root>
    <Dialog.Trigger asChild>
      <button type="button" className={styles.trigger} data-map-bottle="true" aria-label={text.open} lang={language} onClickCapture={reactToMapPress} onClick={activateBottleDiscount}>
        <img src="/media/reference/doublebottle-map-bottle.webp" alt="" aria-hidden="true" width={36} height={54} draggable={false}/>
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay}/>
      <Dialog.Content className={styles.dialog} data-bottle-dialog lang={language}>
        <Dialog.Close type="button" className={styles.close} aria-label={text.close}><X size={20}/></Dialog.Close>
        <span className={styles.crest} aria-hidden="true">✦</span>
        <Dialog.Title className={styles.title}>{text.title}</Dialog.Title>
        <Dialog.Description className={styles.description}>{text.intro}</Dialog.Description>
        <div className={styles.treasure} aria-hidden="true"><img src="/media/reference/doublebottle-map-bottle.webp" alt="" width={54} height={81}/></div>
        <div className={styles.rewards} data-bottle-rewards>
          <p><Eye size={25} aria-hidden="true"/><span>{text.attention}</span></p>
          <p><Sparkles size={25} aria-hidden="true"/><span>{text.discount}</span></p>
        </div>
        <Dialog.Close type="button" className={styles.accept}>{text.done}</Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
