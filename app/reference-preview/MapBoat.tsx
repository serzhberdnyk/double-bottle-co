'use client';
import {useI18n} from '@/lib/i18n/context';

import {useInquiryCopy} from '../components/inquiry-copy';
import {mapBoats, boatAnchorPosition} from './map-boats';
import {reactToMapPress} from './map-press';
import {useMapPlacement} from './MapLayoutContext';
import styles from './MapBoat.module.css';
import {MapPOI} from './MapPOI';
import {customMapItem} from './CustomMapContent';
import poi from './MapPOI.module.css';

/** These two new boats provide motion only; they do not imply a bookable programme. */
export function MapBoat({kind}:{kind:keyof typeof mapBoats}) {
  const {t:tr}=useI18n();
  const {language} = useInquiryCopy();
  const boat = mapBoats[kind], text = {title:tr(boat.ru.title),action:tr(boat.ru.action)},saved=useMapPlacement(kind),custom=saved&&saved.image!==boat.optimized?saved.image:null;
  if(saved&&(saved.title!==undefined||saved.description!==undefined||saved.sizePreset!==undefined||saved.sizePx!=null||saved.photos?.length))return <MapPOI item={customMapItem({...saved,title:saved.title??boat.ru.title})} placement="art" anchor={{x:saved.x*12.8,y:saved.y*10.83}}/>;
  if(kind==='diving')return <button type="button" className={`${poi.trigger} ${poi.artTrigger}`} style={{...(saved?{left:`${saved.x}%`,top:`${saved.y}%`}:boatAnchorPosition(kind)),width:72,height:56,transform:'translate(-50%,-50%)'}} data-map-boat={kind} aria-label={text.action} lang={language} onClick={reactToMapPress}>
    <picture style={{position:'absolute',left:'50%',top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
      <source srcSet={custom||boat.optimized} type="image/webp"/>
      <img className={poi.illustration} style={{position:'relative',left:0,bottom:'auto',width:64,height:'auto'}} src={custom||boat.source} width={boat.width} height={boat.height} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false}/>
    </picture>
    <span className={poi.artLabel} aria-hidden="true">{text.title}</span>
  </button>;
  return <button type="button" className={styles.trigger} style={saved?{left:`${saved.x}%`,top:`${saved.y}%`}:boatAnchorPosition(kind)}
    data-map-boat={kind} aria-label={text.action} lang={language} onClick={reactToMapPress}>
    <picture>
      <source srcSet={custom||boat.optimized} type="image/webp"/>
      <img className={styles.artwork} src={custom||boat.source} width={boat.width} height={boat.height}
        alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false}/>
    </picture>
    <span className={styles.label} aria-hidden="true">{text.title}</span>
  </button>;
}
