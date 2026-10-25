'use client';

import {useState} from 'react';
import styles from './image-guidance.module.css';

type Props = {id:string; src?:string|null; kind?:'photo'|'illustration'; compact?:boolean; mapIcon?:boolean};

/** Ratios mirror reference.module.css, globals.css and CompactTourDetail.module.css.
 * Pixel dimensions are preparation suggestions, never upload validation rules. */
export function ImageGuidance({id,src,kind='photo',compact=false,mapIcon=false}:Props) {
  return <section id={id} className={styles.guidance} aria-label="Размер и отображение изображения">
    <p><strong>{mapIcon?'Значок карты: рекомендуем PNG или WebP с прозрачным фоном.':'Обложка: рекомендуем исходник 1600 × 1200 px (4:3).'} </strong>
      {mapIcon?'Для квадратного значка подойдёт 264 × 264 px (1:1, запас 4× для рамки до 66 px в редакторе). Вытянутые значки можно оставить в исходных пропорциях.':'Это универсальный исходник, а не обязательный размер: одна обложка используется в нескольких разных рамках.'}</p>
    <p>{mapIcon?'Значок вписывается целиком (contain), без обрезки. Пустые поля внутри файла уменьшают видимый рисунок; оставляйте только небольшой прозрачный отступ. Масштаб на публичной карте зависит от выбранного значка.':kind==='illustration'?'Сейчас стандартная иллюстрация: вписывается целиком (contain), возможны поля. После загрузки собственного фото включается заполнение рамки (cover).':'Загруженное фото заполняет рамку (cover): края могут обрезаться, пропорции самого фото не искажаются. Держите лица, подписи и важные детали ближе к центру. Один размер файла не исключит обрезку во всех рамках.'}</p>
    {!mapIcon&&<p>Для точной подготовки: главная — 1240 × 1000 px (1,24:1), на телефоне — 1320 × 1000 px (1,32:1); каталог — 1650 × 1000 px (1,65:1), на телефоне — 1220 × 1000 px (1,22:1). Страница тура — {compact?'1680 × 1000 px (1,68:1), на телефоне — 1580 × 1000 px (1,58:1)':'1360 × 1000 px (1,36:1), на телефоне — 1500 × 1000 px (3:2)'}. Это пропорции рамок, не требования к разрешению. При загрузке большие файлы автоматически уменьшаются с сохранением пропорций.</p>}
    {src&&<ImageExamples key={src} src={src} kind={kind} compact={compact} mapIcon={mapIcon}/>}
  </section>;
}

function ImageExamples({src,kind,compact,mapIcon}:Required<Pick<Props,'kind'|'compact'|'mapIcon'>>&{src:string}) {
  const [dimensions,setDimensions]=useState('Определяем размер изображения…');
  const fit=mapIcon||kind==='illustration'?'contain':'cover';
  const slots=mapIcon?[]:[
    ['Главная · компьютер',1.24],['Главная · телефон',1.32],
    ['Каталог · компьютер',1.65],['Каталог · телефон',1.22],
    ['Страница тура · компьютер',kind==='illustration'?1.5:compact?1.68:1.36],
    ['Страница тура · телефон',kind==='illustration'?1.5:compact?1.58:1.5],
  ] as const;
  return <>
    <p role="status">{dimensions}</p>
    <figure className={styles.original}><img src={src} alt="Изображение целиком, без обрезки" onLoad={e=>{const {naturalWidth:w,naturalHeight:h}=e.currentTarget;setDimensions(`Текущее изображение: ${w} × ${h} px · пропорции ${(w/h).toFixed(2).replace('.',',')}:1.`);}} onError={()=>setDimensions('Не удалось определить размер: изображение недоступно.')}/><figcaption>Исходное изображение целиком</figcaption></figure>
    {!mapIcon&&<details><summary>Как обложка выглядит в разных рамках</summary><p>Предпросмотр по пропорциям текущего дизайна, без увеличения при наведении. На странице тура высота также может зависеть от ширины экрана. Режим: {fit==='cover'?'cover — заполнение с обрезкой':'contain — целиком с полями'}. Это просмотр, он не меняет изображение или черновик.</p><div className={styles.grid}>{slots.map(([title,ratio])=><figure key={title}><div className={styles.slot} style={{aspectRatio:ratio}}><img src={src} alt={title} style={{objectFit:fit}}/></div><figcaption>{title} · {String(ratio).replace('.',',')}:1</figcaption></figure>)}</div></details>}
  </>;
}
