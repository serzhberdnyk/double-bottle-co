'use client';
import {useI18n} from '@/lib/i18n/context';

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Dialog} from 'radix-ui';
import {ZoomIn,ZoomOut,X,Maximize2} from 'lucide-react';
import {useInquiryCopy} from '../components/inquiry-copy';
import {artAnchorPosition} from './supplementary-pois';
import {referenceDestinationHref} from './reference-catalog';
import styles from './PhiPhiDetail.module.css';
import shortcut from './MapShortcutLabel.module.css';
import {MapBoat} from './MapBoat';
import {reactToMapPress} from './map-press';

const source='/media/reference/phi-phi-user-detail.png';
const copy={
 ru:{title:'Карта Пхи-Пхи',open:'Пхи-Пхи: увеличить карту',label:'Пхи-Пхи',expand:'Открыть крупно',close:'Закрыть карту Пхи-Пхи',in:'Увеличить',out:'Уменьшить',hint:'Прокрутите карту, чтобы увидеть острова целиком.',alt:'Присланная иллюстрированная карта островов Пхи-Пхи',tours:'Экскурсии на Пхи-Пхи',don:'Пхи-Пхи Дон',leh:'Пхи-Пхи Ле'},
 en:{title:'Phi Phi map',open:'Phi Phi: enlarge map',label:'Phi Phi',expand:'Open large map',close:'Close Phi Phi map',in:'Zoom in',out:'Zoom out',hint:'Scroll the map to explore all the islands.',alt:'Supplied illustrated map of the Phi Phi islands',tours:'Phi Phi excursions',don:'Phi Phi Don',leh:'Phi Phi Leh'},
};
function ParkEmblems() {
 const {t:tr}=useI18n();

 return <div className={styles.parkEmblems} data-phiphi-park-emblems>
  <img src="/media/reference/phi-phi-park-logo.webp" width={640} height={585} loading="lazy"
    alt={tr("Эмблема парка Хат Ноппарат Тхара — Му Ко Пхи-Пхи")}/>
  <img src="/media/reference/thailand-park-logo.webp" width={640} height={585} loading="lazy"
    alt={tr("Эмблема национальных парков Таиланда")}/>
 </div>;
}

/** A quiet, occasional decoration; no timers survive closing or reduced-motion. */
function PassingBoat({active}:{active:boolean}) {
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let showTimer:ReturnType<typeof setTimeout>|undefined,hideTimer:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{clearTimeout(showTimer);clearTimeout(hideTimer);setVisible(false);};
  const queue=(delay:number)=>{showTimer=setTimeout(()=>{setVisible(true);hideTimer=setTimeout(()=>{setVisible(false);queue(45000+Math.random()*25000);},8000);},delay);};
  const restart=()=>{clear();if(active&&!motion.matches&&document.visibilityState==='visible')queue(12000+Math.random()*8000);};
  restart();motion.addEventListener('change',restart);document.addEventListener('visibilitychange',restart);
  return()=>{clearTimeout(showTimer);clearTimeout(hideTimer);motion.removeEventListener('change',restart);document.removeEventListener('visibilitychange',restart);};
 },[active]);
 return visible?<img className={styles.passingBoat} data-phiphi-passing-boat src="/media/reference/phi-phi-longtail.webp" alt="" aria-hidden="true" width={640} height={266} draggable={false}/>:null;
}

/** Local source-art area; detail remains a separate, undistorted supplied image. */
export function PhiPhiDetail(){
 const {t:tr,href:localHref}=useI18n();

 const {language}=useInquiryCopy(),text=Object.fromEntries(Object.entries(copy.ru).map(([key,value])=>[key,tr(value)])) as typeof copy.ru;
 const [open,setOpen]=useState(false),[preview,setPreview]=useState(false),[zoom,setZoom]=useState(1);
 const trigger=useRef<HTMLButtonElement>(null),previewRef=useRef<HTMLElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),skipFocus=useRef(false);
 const cancel=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}};
 const hideSoon=()=>{cancel();timer.current=setTimeout(()=>setPreview(false),180);};
 useEffect(()=>()=>{if(timer.current!==null)clearTimeout(timer.current);},[]);
 useEffect(()=>{if(!preview)return;const dismiss=(e:KeyboardEvent)=>{if(e.key==='Escape')setPreview(false);};window.addEventListener('keydown',dismiss);return()=>window.removeEventListener('keydown',dismiss);},[preview]);
 const showPreview=()=>{cancel();if(!open&&matchMedia('(hover: hover) and (pointer: fine)').matches)setPreview(true);};
 const enlarge=()=>{cancel();setPreview(false);setZoom(1);setOpen(true);};
 return <>
  <button ref={trigger} type="button" className={styles.trigger} style={artAnchorPosition({x:628,y:510})}
   onClickCapture={reactToMapPress}
   data-phiphi-detail-trigger aria-label={text.open} aria-haspopup="dialog" aria-expanded={open||preview} lang={language}
   onPointerEnter={e=>{if(e.pointerType==='mouse')showPreview();}} onPointerLeave={hideSoon}
   onFocus={()=>{if(skipFocus.current){skipFocus.current=false;return;}showPreview();}}
   onBlur={e=>{if(!previewRef.current?.contains(e.relatedTarget as Node))hideSoon();}}
   onKeyDown={e=>{if(e.key==='Escape'){cancel();setPreview(false);}}} onClick={enlarge}>
   <span className={shortcut.label} data-map-press-art><ZoomIn size={17} aria-hidden="true"/>{text.label}</span>
  </button>
  {preview&&!open&&createPortal(<aside ref={previewRef} className={styles.preview} data-phiphi-preview lang={language}
    onPointerEnter={cancel} onPointerLeave={hideSoon} onFocus={cancel} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))hideSoon();}}>
    <div className={styles.previewHeader}><strong>{text.title}</strong><button type="button" aria-label={text.close} onClick={()=>setPreview(false)}><X size={19}/></button></div>
    <div className={styles.previewMap}><div className={styles.mapArt}><img data-phiphi-detail-image src={source} alt={text.alt} width={738} height={2048}/><MapBoat kind="pirate"/><ParkEmblems/></div></div>
    <button type="button" className={styles.expand} onClick={enlarge}><Maximize2 size={17}/>{text.expand}</button>
  </aside>,document.body)}
  <Dialog.Root open={open} onOpenChange={next=>{setOpen(next);if(!next)setPreview(false);}}>
   <Dialog.Portal>
    <Dialog.Overlay className={styles.overlay}/>
    <Dialog.Content className={styles.dialog} data-phiphi-dialog lang={language}
      onCloseAutoFocus={e=>{e.preventDefault();skipFocus.current=true;trigger.current?.focus({preventScroll:true});}}>
      <header className={styles.header}><Dialog.Title>{text.title}</Dialog.Title><Dialog.Close type="button" aria-label={text.close}><X size={22}/></Dialog.Close></header>
      <div className={styles.toolbar}>
        <button type="button" onClick={()=>setZoom(z=>Math.max(1,z-.5))} disabled={zoom===1} aria-label={text.out}><ZoomOut size={20}/></button>
        <span aria-live="polite">{Math.round(zoom*100)}%</span>
        <button type="button" onClick={()=>setZoom(z=>Math.min(2.5,z+.5))} disabled={zoom===2.5} aria-label={text.in}><ZoomIn size={20}/></button>
        <Dialog.Description>{text.hint}</Dialog.Description>
      </div>
      <div className={styles.mapViewport} data-phiphi-map-viewport tabIndex={0} aria-label={text.title}>
        <div className={styles.mapArt} style={{width:`${zoom*100}%`,maxWidth:560*zoom}}>
          <img data-phiphi-detail-image src={source} alt={text.alt} width={738} height={2048} draggable={false}/>
          <MapBoat kind="pirate"/>
          <PassingBoat active={open}/>
          <ParkEmblems/>
        </div>
      </div>
      <nav className={styles.links} aria-label={text.tours}>
        <a href={localHref(referenceDestinationHref('phi-phi-don'))}>{text.don} ↗</a><a href={localHref(referenceDestinationHref('phi-phi-leh'))}>{text.leh} ↗</a>
      </nav>
    </Dialog.Content>
   </Dialog.Portal>
  </Dialog.Root>
 </>;
}
