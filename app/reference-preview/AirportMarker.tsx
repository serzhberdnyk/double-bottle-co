'use client';
import {useI18n} from '@/lib/i18n/context';


import {useRef,useState} from 'react';
import {Popover as PopoverPrimitive} from 'radix-ui';
import {X} from 'lucide-react';
import {project} from '@/lib/public/geo';
import {phuketAirport} from './airport-landmark';
import styles from './reference.module.css';
import listStyles from './landmark-list.module.css';

/** Map mode uses IslandMap's geographic plane; list mode makes no spatial claim. */
export function AirportMarker({placement='map',portalContainer}:{placement?:'map'|'list';portalContainer?:HTMLElement|null}) {
 const {t:tr}=useI18n();

  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const restoreFocus=useRef(true);
  const isList=placement==='list';
  const [x,y]=project(phuketAirport.lng,phuketAirport.lat);
  return <PopoverPrimitive.Root open={open} onOpenChange={next=>{setOpen(next);if(next)restoreFocus.current=true;}}>
    <PopoverPrimitive.Trigger asChild>
      <button ref={trigger} type="button" className={isList?listStyles.landmarkButton:styles.airportMarker}
        data-landmark={phuketAirport.id} data-landmark-placement={placement}
        aria-label={isList?tr("Аэропорт Пхукета: открыть информацию, без привязки к карте"):tr("Аэропорт Пхукета: открыть информацию")} aria-pressed={open}
        title={tr("Аэропорт Пхукета")} style={isList?undefined:{left:x/10+'%',top:y/7.5+'%'}}
        onPointerDown={event=>{if(!isList)event.stopPropagation();}} onClick={event=>{if(!isList)event.stopPropagation();}}>
        <img src={phuketAirport.image} alt="" width={isList?36:24} height={isList?36:24}/>
        {isList&&<span className={listStyles.landmarkLabel}><span>{tr(phuketAirport.name)}</span><small>{tr("Без привязки к карте")}</small></span>}
      </button>
    </PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal container={isList?portalContainer:undefined}>
      <PopoverPrimitive.Content className={`destination-popover ${styles.airportPopover} ${isList?listStyles.landmarkPopover:''}`} side={isList?'bottom':'left'} align="start" sideOffset={12} collisionPadding={12} collisionBoundary={isList?portalContainer:undefined}
        aria-label={tr("Информация об аэропорте Пхукета")}
        onEscapeKeyDown={()=>{restoreFocus.current=true;}}
        onInteractOutside={event=>{
          const target=event.detail.originalEvent.target;
          // Respect a deliberate click on another control (including Big Buddha).
          restoreFocus.current=!(target instanceof Element && target.closest('button,a,input,select,textarea,[tabindex]'));
        }}
        onCloseAutoFocus={event=>{if(restoreFocus.current){event.preventDefault();trigger.current?.focus({preventScroll:true});}}}>
        <PopoverPrimitive.Close className="popover-close" aria-label={tr("Закрыть информацию об аэропорте")} onClick={()=>{restoreFocus.current=true;}}><X size={18}/></PopoverPrimitive.Close>
        <div className="popover-body"><h3>{tr(phuketAirport.name)}</h3><p>{tr(phuketAirport.placeholder)}</p></div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
