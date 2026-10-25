'use client';
import {useI18n} from '@/lib/i18n/context';


import {Popover as PopoverPrimitive} from 'radix-ui';
import {X} from 'lucide-react';
import {project} from '@/lib/public/geo';
import {bigBuddha} from './reference-landmarks';
import styles from './reference.module.css';
import listStyles from './landmark-list.module.css';

/** Map mode uses IslandMap's geographic plane; list mode makes no spatial claim. */
export function BigBuddhaMarker({placement='map',portalContainer}:{placement?:'map'|'list';portalContainer?:HTMLElement|null}) {
 const {t:tr,href:localHref}=useI18n();

  const isList=placement==='list';
  const [x,y]=project(bigBuddha.lng,bigBuddha.lat);
  return <PopoverPrimitive.Root>
    <PopoverPrimitive.Trigger asChild>
      <button type="button" className={isList?listStyles.landmarkButton:styles.buddhaMarker} data-landmark={bigBuddha.id} data-landmark-placement={placement}
        style={isList?undefined:{left:x/10+'%',top:y/7.5+'%'}}
        aria-label={isList?tr("Биг Будда: открыть карточку места, без привязки к карте"):tr("Биг Будда: открыть карточку места")}
        onPointerDown={event=>{if(!isList)event.stopPropagation();}} onClick={event=>{if(!isList)event.stopPropagation();}}>
        <img src={bigBuddha.image} alt="" width={isList?36:66} height={isList?36:63}/>
        {isList?<span className={listStyles.landmarkLabel}><span>{tr(bigBuddha.name)}</span><small>{tr("Без привязки к карте")}</small></span>:<span>{tr(bigBuddha.name)}</span>}
      </button>
    </PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal container={isList?portalContainer:undefined}>
      <PopoverPrimitive.Content className={`destination-popover ${styles.landmarkCard} ${isList?listStyles.landmarkPopover:''}`} side={isList?'bottom':'right'} align="start" sideOffset={12} collisionPadding={12} collisionBoundary={isList?portalContainer:undefined} aria-label={tr("Биг Будда — сведения о месте")}>
        <PopoverPrimitive.Close className="popover-close" aria-label={tr("Закрыть Биг Будду")}><X size={18}/></PopoverPrimitive.Close>
        <img className={styles.buddhaCardImage} src={bigBuddha.image} alt={tr("Иллюстрация статуи Большого Будды")} width={144} height={137}/>
        <div className="popover-body"><span className="eyebrow">{tr("Место на Пхукете")}</span><h3>{tr(bigBuddha.name)}</h3><p>{tr(bigBuddha.description)}</p>
          <p className={styles.landmarkNotice}>{tr("Программы с подтверждённой остановкой здесь пока не привязаны в каталоге.")}</p>
          <p className={styles.landmarkCaution}>{tr("Возможность посещения и режим работы нужно уточнять отдельно.")}</p>
          <a className="text-link" href={localHref("/#selected")}>{tr("Посмотреть все экскурсии")}</a>
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
