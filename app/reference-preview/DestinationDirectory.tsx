'use client';
import {useI18n} from '@/lib/i18n/context';


import {Dialog} from 'radix-ui';
import {useState} from 'react';
import {ArrowRight, List, X} from 'lucide-react';
import type {Destination} from '@/lib/public/types';
import {programWord} from '@/lib/public/types';
import {referenceDestinationHref} from './reference-catalog';
import {CustomMapPlaces} from './CustomMapContent';
import {MapPOI} from './MapPOI';
import {supplementaryPOIs} from './supplementary-pois';
import styles from './reference.module.css';

/** The artwork is uncalibrated. This directory never overlays approximate map anchors. */
export function DestinationDirectory({destinations}:{destinations:Destination[]}) {
 const {t:tr,href:localHref}=useI18n();

  const [portalContainer,setPortalContainer]=useState<HTMLDivElement|null>(null);
  return <Dialog.Root>
    <Dialog.Trigger asChild><button type="button" className={styles.directoryTrigger}><List size={16}/><span>{tr("Направления и места")}</span><ArrowRight size={15}/></button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.directoryOverlay}/>
      <Dialog.Content ref={setPortalContainer} className={styles.directoryDialog}>
        <Dialog.Close className={styles.directoryClose} aria-label={tr("Закрыть список направлений")}><X size={20}/></Dialog.Close>
        <Dialog.Title className={styles.directoryTitle}>{tr("Куда отправимся?")}</Dialog.Title>
        <Dialog.Description className={styles.directoryDescription}>{tr("Выберите направление, чтобы открыть его экскурсии.")}</Dialog.Description>
        <ul className={styles.directoryList}>
          {destinations.map(destination=><li key={destination.id}><a href={localHref(referenceDestinationHref(destination.id))} data-destination-id={destination.id}>
            <span>{destination.name}<small>{destination.count===undefined ? tr("Открыть программы") : destination.count ? `${destination.count} ${tr(programWord(destination.count))}` : tr("Пока нет программ")}</small></span><ArrowRight size={18}/>
          </a></li>)}
        </ul>
        <div className={styles.directoryLandmarks}><h3>{tr("Места на Пхукете")}</h3><p>{tr("Информационные карточки дополнительных мест.")}</p><div><>{supplementaryPOIs.map(item=><MapPOI key={item.id} item={item} placement="list" portalContainer={portalContainer}/>) }<CustomMapPlaces placement="list" portalContainer={portalContainer}/></></div></div>
        <a href={localHref("/#selected")} className={styles.directoryMapLink}>{tr("Все экскурсии")}<ArrowRight size={17}/></a>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
