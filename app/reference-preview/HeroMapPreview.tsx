'use client';
import {useI18n} from '@/lib/i18n/context';


import {useId} from 'react';
import {Popover} from 'radix-ui';
import {ArrowUpRight, X} from 'lucide-react';
import {useInquiryCopy} from '../components/inquiry-copy';
import styles from './HeroMapPreview.module.css';
import {reactToMapPress} from './map-press';

export function HeroMapPreview() {
 const {t:tr}=useI18n();

  const {language} = useInquiryCopy();
  const titleId = useId();
  const text = language === 'en'
    ? {label:'Map', open:'Map: coming soon', soon:'The map is coming soon', close:'Close'}
    : {label:tr("Карта"), open:tr("Карта: скоро появится"), soon:tr("Карта скоро появится"), close:tr("Закрыть")};

  return <Popover.Root>
    <Popover.Trigger asChild>
      <button type="button" className={styles.preview} aria-label={text.open} lang={language} data-hero-map-preview onClickCapture={reactToMapPress}>
        <img src="/media/reference/andaman-user-map.png" alt="" width={1280} height={1083} aria-hidden="true" />
        <span>{text.label}<ArrowUpRight size={13} aria-hidden="true" /></span>
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className={styles.notice} side="bottom" align="end" sideOffset={10}
        collisionPadding={12} aria-labelledby={titleId} lang={language}>
        <p id={titleId}>{text.soon}</p>
        <Popover.Close type="button" className={styles.close} aria-label={text.close}><X size={18} aria-hidden="true" /></Popover.Close>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
