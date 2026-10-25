'use client';
import {useI18n} from '@/lib/i18n/context';


import {useId,useRef,useState} from 'react';
import {Popover} from 'radix-ui';
import {X} from 'lucide-react';
import {artAnchorPosition,type ArtAnchor,type MapPOIItem} from './supplementary-pois';
import styles from './MapPOI.module.css';
import {POIArtwork} from './POIArtwork';
import {useInquiryCopy} from '../components/inquiry-copy';
import {useMapPlacement} from './MapLayoutContext';
import {mapPlacementImageSize} from '@/lib/public/map-layout';
import {reactToMapPress} from './map-press';

export type MapPOIProps = {
  item:MapPOIItem;
  /** Pass Dialog.Content here when rendering the nonspatial directory buttons. */
  portalContainer?:HTMLElement|null;
} & (
  | {placement:'art';anchor:ArtAnchor;placementNotice?:string}
  | {placement:'list';anchor?:never;placementNotice?:never}
);

/**
 * Approved silhouette refinement: artwork lifts from its source-image base point.
 * The placement is schematic, without a ring, badge or separate anchor dot.
 * Art mode belongs in a positioned, unscaled layer matching the source image box;
 * resizing that box moves the anchor proportionally without shrinking the button.
 * List mode makes no spatial claim. No catalogue destination or map projection is
 * inferred by this component.
 */
export function MapPOI(props:MapPOIProps) {
 const {t:tr,href:localHref}=useI18n();

  const {language}=useInquiryCopy();
  const {item:originalItem,placement,portalContainer}=props;
  const saved=useMapPlacement(originalItem.id),item=saved?{...originalItem,image:saved.image,title:saved.title??originalItem.title,shortLabel:saved.title??originalItem.shortLabel,descriptions:saved.description!==undefined?[saved.description]:originalItem.descriptions,imageSize:mapPlacementImageSize(saved)}:originalItem;
  const isArt=placement==='art';
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const restoreFocus=useRef(true);
  const titleId=useId();
  const descriptionId=useId();

  return <Popover.Root open={open} onOpenChange={next=>{
    setOpen(next);
    if(next)restoreFocus.current=true;
  }}>
    <Popover.Trigger asChild>
      <button ref={trigger} type="button"
        onClickCapture={reactToMapPress}
        className={`${styles.trigger} ${isArt?styles.artTrigger:styles.listTrigger}`}
        style={props.placement==='art'?{...artAnchorPosition(saved?{x:saved.x/100*1280,y:saved.y/100*1083}:props.anchor),width:Math.max(56,item.imageSize),height:Math.max(64,item.imageSize+10),...(item.id==='diving'?{transform:'translate(-50%,-50%)'}:{})}:undefined}
        data-poi-id={item.id} data-poi-kind={item.kind} data-poi-placement={placement}
        lang={language} aria-label={`${tr(item.title)}: ${language==='en'?'open place card':tr("открыть карточку места")}${isArt?'':language==='en'?', from the place list':tr(", из списка мест")}`}
        aria-pressed={open}>
        <POIArtwork item={item} size={item.imageSize} className={styles.illustration}/>
        {isArt?<>
          <span className={styles.artLabel} aria-hidden="true">{tr(item.shortLabel)}</span>
        </>:<span className={styles.listLabel}>
          <span>{tr(item.title)}</span><small>{language==='en'?'Place information':tr("Информация о месте")}</small>
        </span>}
      </button>
    </Popover.Trigger>
    <Popover.Portal container={portalContainer}>
      <Popover.Content className={styles.card} data-poi-kind={item.kind}
        side={isArt?'right':'bottom'} align="start" sideOffset={12}
        collisionPadding={12} collisionBoundary={portalContainer}
        aria-labelledby={titleId} aria-describedby={descriptionId} lang={language}
        onEscapeKeyDown={()=>{restoreFocus.current=true;}}
        onInteractOutside={event=>{
          const target=event.detail.originalEvent.target;
          // Outside dismissal must not steal focus from another chosen control.
          restoreFocus.current=!(target instanceof Element &&
            target.closest('button,a[href],input,select,textarea,[tabindex],[contenteditable="true"]'));
        }}
        onCloseAutoFocus={event=>{
          event.preventDefault();
          if(restoreFocus.current&&trigger.current?.isConnected) {
            trigger.current.focus({preventScroll:true});
          }
        }}>
        <Popover.Close type="button" className={styles.close}
          aria-label={language==='en'?`Close ${tr(item.title)}`:tr("Закрыть карточку «{0}»").replace("{0}", String(tr(item.title)))}
          onClick={()=>{restoreFocus.current=true;}}><X size={18} aria-hidden="true"/></Popover.Close>
        <div className={styles.cardHeader}>
          <POIArtwork item={item} size={36} className={styles.cardArtwork}/>
          <div><h3 id={titleId}>{tr(item.title)}</h3><span>{tr(item.category)}</span></div>
        </div>
        <div className={styles.cardBody} id={descriptionId}>
          {props.placement==='art'&&props.placementNotice&&<p className={styles.caution}>{tr(props.placementNotice)}</p>}
          {item.descriptions.map((description,index)=><p key={index}>{tr(description)}</p>)}
          {saved?.photos?.length?<div className={styles.gallery}>{saved.photos.map((src,index)=><img key={src} src={src} alt={`${tr(item.title)} · ${index+1}`} loading="lazy"/>)}</div>:null}
          {item.notice&&<p className={styles.notice}>{tr(item.notice)}</p>}
          {item.caution&&<p className={styles.caution}>{tr(item.caution)}</p>}
        </div>
        {item.link&&<a className={styles.link} href={localHref(item.link.href)}>{tr(item.link.label)}</a>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
