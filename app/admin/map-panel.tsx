'use client';

import {useEffect,useRef,useState,useId,type PointerEvent,type KeyboardEvent,type MouseEvent,type CSSProperties} from 'react';
import {ImageGuidance} from './image-guidance';
import {busMapObject,mapPlacementDisplayImage,mapObjects,mapPointColors,canCloseMapRoute,mapRouteLinePoints,mapRoutePointLabel,parseMapDocument,mapDocumentSchema,mapPlacementImageSize,mapPlacementTitle,type MapDocument,type MapLayout,type MapObjectId,type MapPlacement,type MapRoute,type MapRoutePoint,type MapPointColor,type MapTourChoice} from '@/lib/public/map-layout';
import {useEditorImageUpload} from '@/hooks/use-editor-image-upload';
import {mapDragDecision,beginMapDrag,moveMapDrag,clampMapCoordinate as clamp,type MapDrag} from '@/lib/public/map-drag';
import fields from './catalog-panel.module.css';
import styles from './map-panel.module.css';

type State={catalogGeneration:number|null;tours:MapTourChoice[];revision:number;publishedRevision:number;published:MapLayout;draft:MapLayout|null;publishedDocument?:MapDocument;draftDocument?:MapDocument|null};
type Mode='landmarks'|'routes';
async function api(body?:unknown):Promise<State>{
 const response=await fetch('/api/admin/map',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);
 const data=await response.json() as State&{error?:string};
 if(!response.ok)throw Error(data.error||'Не удалось загрузить карту.');return data;
}
const routeClamp=(value:number)=>Math.min(100,Math.max(0,Math.round(value*100)/100));
const empty:MapDocument={version:2,placements:[],routes:[]};

export function MapEditorPanel(){
 const [data,setData]=useState<State|null>(null),[document,setDocument]=useState<MapDocument>(empty);
 const [selected,setSelected]=useState<MapObjectId|null>(null),[selectedRoute,setSelectedRoute]=useState<string|null>(null),[pointIndex,setPointIndex]=useState<number|null>(null);
 const [mode,setMode]=useState<Mode>('landmarks'),[drawing,setDrawing]=useState(false),[dirty,setDirty]=useState(false),[actionBusy,setBusy]=useState(false),[message,setMessage]=useState(''),[reloadConfirm,setReloadConfirm]=useState(false),[remove,setRemove]=useState<'landmark'|'route'|null>(null),[filename,setFilename]=useState('');
 const actionLock=useRef(false),loadSequence=useRef(0);
 const target=useRef<{id:string;kind:'icon'|'photo'}|null>(null);
 function markDirty(){loadSequence.current++;setReloadConfirm(false);setDirty(true);setRemove(null);}
 function change(id:string,patch:Partial<MapPlacement>){setDocument(current=>({...current,placements:current.placements.map(i=>i.id===id?{...i,...patch}:i)}));markDirty();}
 const imageUpload=useEditorImageUpload(path=>{
  const active=target.current;if(!active)return;
  if(active.kind==='icon')change(active.id,{image:path});
  else setDocument(current=>({...current,placements:current.placements.map(p=>p.id===active.id?{...p,photos:[...new Set([...(p.photos||[]),path])].slice(0,8)}:p)}));
  setDirty(true);
 });
 const busy=actionBusy||imageUpload.busy;
 const canvas=useRef<HTMLDivElement>(null),drag=useRef<MapDrag|null>(null),pointDrag=useRef<{pointerId:number;index:number;routeId:string}|null>(null),inputId=useId();
 const item=document.placements.find(i=>i.id===selected),original=mapObjects.find(i=>i.id===selected);
 const route=document.routes.find(r=>r.id===selectedRoute);
 const routeTour=data?.tours.find(tour=>tour.id===route?.tourId);
 const routePrograms=routeTour?.variants||[];
 const selectedPoint=route&&pointIndex!==null?route.points[pointIndex]:undefined;

 function changeRoute(id:string,patch:Partial<MapRoute>){
  const before=document.routes.find(route=>route.id===id);if(before?.closed&&patch.points&&!canCloseMapRoute(patch.points))setMessage('Маршрут разомкнут: для замыкания нужны минимум три разные точки.');
  setDocument(current=>({...current,routes:current.routes.map(route=>{if(route.id!==id)return route;const next={...route,...patch};return next.closed&&!canCloseMapRoute(next.points)?{...next,closed:false}:next;})}));markDirty();
 }
 function selectTarget(id:MapObjectId){if(id!==selected){imageUpload.reset();target.current=null;setFilename('');}setSelected(id);setRemove(null);}
 function accept(next:State){
  const nextDocument=parseMapDocument(next.draftDocument||next.draft||next.publishedDocument||next.published);
  setData(next);setDocument(structuredClone(nextDocument));setSelected(previous=>nextDocument.placements.some(p=>p.id===previous)?previous:null);setSelectedRoute(previous=>nextDocument.routes.some(r=>r.id===previous)?previous:null);
  setReloadConfirm(false);setPointIndex(null);setDrawing(false);setDirty(false);setRemove(null);setFilename('');imageUpload.reset();target.current=null;
 }
 useEffect(()=>{let active=true;const sequence=++loadSequence.current;api().then(next=>{if(active&&sequence===loadSequence.current)accept(next);}).catch(e=>{if(active&&sequence===loadSequence.current)setMessage(e.message);});return()=>{active=false;};},[]);
 async function refresh(){const sequence=++loadSequence.current;try{const next=await api();if(sequence===loadSequence.current)accept(next);}catch(error){if(sequence===loadSequence.current)throw error;}}
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function run(action:()=>Promise<void>){if(actionLock.current)return;actionLock.current=true;loadSequence.current++;setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:'Не удалось выполнить действие.');}finally{actionLock.current=false;setBusy(false);}}
 function start(event:PointerEvent<HTMLButtonElement>,id:MapObjectId){
  const decision=mapDragDecision(event,busy||drawing,selected,id);if(decision==='ignore')return;selectTarget(id);if(decision==='select')return;
  drag.current=beginMapDrag(event,document.placements.find(p=>p.id===id)!,canvas.current!.getBoundingClientRect());event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLButtonElement>){const current=drag.current;if(!current||busy)return;const next=moveMapDrag(current,event,canvas.current!.getBoundingClientRect());if(next){drag.current=next.drag;change(current.id,next.point);}}
 function finish(event:PointerEvent<HTMLButtonElement>){if(drag.current?.pointerId===event.pointerId)drag.current=null;}
 function key(event:KeyboardEvent<HTMLButtonElement>,id:MapObjectId){
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||busy)return;event.preventDefault();selectTarget(id);
  const current=document.placements.find(i=>i.id===id)!,step=event.shiftKey?1:.25;
  change(id,{x:clamp(current.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),'x'),y:clamp(current.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),'y')});
 }
 function addLandmark(){
  const id='poi-'+crypto.randomUUID();setDocument(current=>({...current,placements:[...current.placements,{id,x:36,y:40,image:'/media/reference/map-landmark-placeholder.svg',title:'Новое место',description:'',photos:[],sizePreset:'medium'}]}));
  selectTarget(id);setMode('landmarks');setDrawing(false);markDirty();setMessage('Новый значок добавлен на карту. Укажите название, изображение и положение.');
 }
 function addRoute(){
  const id='route-'+crypto.randomUUID();setDocument(current=>({...current,routes:[...current.routes,{id,title:'Новый маршрут',points:[],color:'sea',style:'dashed'}]}));
  setSelectedRoute(id);setPointIndex(null);setMode('routes');setDrawing(true);markDirty();setMessage('Нажмите на карту, чтобы добавить точки линии. Нужны минимум две точки.');
 }
 function canvasPoint(clientX:number,clientY:number){const box=canvas.current!.getBoundingClientRect();return {x:routeClamp((clientX-box.left)/box.width*100),y:routeClamp((clientY-box.top)/box.height*100)};}
 function addPoint(event:MouseEvent<HTMLDivElement>){
  if(busy||!drawing||!route||route.points.length>=100||event.target!==event.currentTarget)return;
  changeRoute(route.id,{points:[...route.points,canvasPoint(event.clientX,event.clientY)]});setPointIndex(route.points.length);
 }
 function pointChange(index:number,patch:Partial<MapRoutePoint>){if(!route)return;changeRoute(route.id,{points:route.points.map((p,i)=>i===index?{...p,...patch,x:routeClamp(patch.x??p.x),y:routeClamp(patch.y??p.y)}:p)});}
 function pointStart(event:PointerEvent<HTMLButtonElement>,index:number){
  if(busy||!route||event.button!==0||!event.isPrimary)return;event.stopPropagation();setPointIndex(index);setDrawing(false);pointDrag.current={pointerId:event.pointerId,index,routeId:route.id};event.currentTarget.setPointerCapture(event.pointerId);
 }
 function pointMove(event:PointerEvent<HTMLButtonElement>){const current=pointDrag.current;if(!current||busy||current.pointerId!==event.pointerId||current.routeId!==route?.id)return;pointChange(current.index,canvasPoint(event.clientX,event.clientY));}
 function pointFinish(event:PointerEvent<HTMLButtonElement>){if(pointDrag.current?.pointerId===event.pointerId)pointDrag.current=null;}
 function pointKey(event:KeyboardEvent<HTMLButtonElement>,index:number){
  if(busy||!route||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();setPointIndex(index);const point=route.points[index],step=event.shiftKey?1:.25;
  pointChange(index,{x:point.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),y:point.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)});
 }
 async function upload(file:File,kind:'icon'|'photo'){if(!selected)return;target.current={id:selected,kind};setFilename(file.name);await imageUpload.start(file);}
 function removeSelected(){
  if(remove==='landmark'&&item&&!original){setDocument(current=>({...current,placements:current.placements.filter(p=>p.id!==item.id)}));setSelected(null);}
  if(remove==='route'&&route){setDocument(current=>({...current,routes:current.routes.filter(r=>r.id!==route.id)}));setSelectedRoute(null);setPointIndex(null);setDrawing(false);}
  markDirty();
 }
 async function saveAndPublish(){
  if(!data)return;
  if(document.routes.some(r=>r.points.length<2))throw Error('Для каждого маршрута нужны минимум две точки. Добавьте точки или удалите незавершённую линию.');
  if(!mapDocumentSchema.safeParse(document).success)throw Error('Проверьте названия, изображения и точки: до 101 значка, 50 маршрутов, 100 точек на линию и 8 фотографий на значок.');
  accept(await api({action:'saveAndPublish',revision:data.revision,catalogGeneration:data.catalogGeneration,document}));setMessage('Карта сохранена и опубликована.');
 }

 return <section className={fields.editor} aria-label="Редактор карты">
  <div className={fields.heading}><h2>Карта</h2><button type="button" disabled={busy} onClick={()=>dirty?setReloadConfirm(true):run(refresh)}>Обновить карту</button></div>
  <p role="status" aria-live="polite" className={fields.message}>{message}</p>
  {reloadConfirm&&<div className={fields.confirm} role="group" aria-label="Обновление карты"><p>Обновить карту с сервера? Несохранённые изменения будут отменены.</p><button type="button" disabled={busy} onClick={()=>run(refresh)}>Обновить и отменить местные изменения</button><button type="button" disabled={busy} onClick={()=>setReloadConfirm(false)}>Продолжить редактирование</button></div>}
  {!data?<><p>{message?'Карта не загружена. Повторите загрузку, когда доступ восстановится.':'Загрузка карты…'}</p><button type="button" disabled={busy} onClick={()=>run(refresh)}>Повторить загрузку</button></>:<>
   <p className={styles.revisions}>Опубликованная версия: {data.publishedRevision}. Ревизия редактирования: {data.revision}. {dirty?'Есть неопубликованные изменения.':data.draftDocument||data.draft?'Есть ранее сохранённые изменения — их можно сразу опубликовать.':'Все изменения опубликованы.'}</p>
   <div className={styles.toolbar} aria-label="Инструменты карты">
    <button type="button" aria-pressed={mode==='landmarks'} disabled={busy} onClick={()=>{setMode('landmarks');setDrawing(false);setRemove(null);}}>Значки ({document.placements.length})</button>
    <button type="button" aria-pressed={mode==='routes'} disabled={busy} onClick={()=>{setMode('routes');setRemove(null);}}>Маршруты ({document.routes.length})</button>
    <button type="button" disabled={busy||document.placements.length>=101} onClick={addLandmark}>Добавить значок</button>
    <button type="button" disabled={busy||document.routes.length>=50} onClick={addRoute}>Добавить маршрут</button>
   </div>
   {mode==='landmarks'?<label>Значок<select value={selected||''} disabled={busy} onChange={event=>selectTarget(event.target.value)}><option value="" disabled>Выберите значок</option>{document.placements.map(p=><option value={p.id} key={p.id}>{mapPlacementTitle(p)}</option>)}</select></label>:<label>Маршрут<select value={selectedRoute||''} disabled={busy} onChange={event=>{setSelectedRoute(event.target.value);setPointIndex(null);setDrawing(false);setRemove(null);}}><option value="" disabled>Выберите маршрут</option>{document.routes.map(r=><option value={r.id} key={r.id}>{r.title}</option>)}</select></label>}
   <p>{mode==='landmarks'?'Выберите значок, затем перетащите его. На телефоне сначала коснитесь значка. Для точного положения используйте клавиши со стрелками (Shift — крупный шаг).':'Включите добавление точек и нажимайте на карту. Точки можно выбирать, перетаскивать и двигать стрелками (Shift — крупный шаг). Название и цвет меняются ниже. Линии — схема на исходной иллюстрации, не GPS-навигация.'}</p>
   <div className={styles.canvas} ref={canvas} onClick={addPoint} data-drawing={drawing} aria-label="Расположение значков и маршрутов карты">
    <img className={styles.map} src="/media/reference/andaman-user-map.png" alt="Карта Андаманского моря" draggable={false}/>
    <svg className={styles.routes} viewBox="0 0 1280 1083" aria-hidden="true">{document.routes.map(r=><polyline key={r.id} points={mapRouteLinePoints(r)} fill="none" stroke={r.color==='sea'?'#4bd4f1':'#c5e877'} strokeWidth={r.id===selectedRoute&&mode==='routes'?5:3} strokeDasharray={r.style==='dashed'?'10 8':undefined} vectorEffect="non-scaling-stroke"/>)}</svg>
    {document.placements.map(p=>{const size=mapPlacementImageSize(p);return <button type="button" key={p.id} className={styles.marker} data-selected={mode==='landmarks'&&selected===p.id} data-map-editor-object={p.id} disabled={busy||drawing} style={{left:p.x+'%',top:p.y+'%',transform:(p.id==='diving'||p.id===busMapObject.id)?'translate(-50%,-50%)':'translate(-50%,-100%)',width:p.id===busMapObject.id?size/1280*100+'%':Math.max(44,size),height:p.id===busMapObject.id?'auto':Math.max(44,size),aspectRatio:p.id===busMapObject.id?'2/1':undefined,minWidth:p.id===busMapObject.id?0:44,minHeight:p.id===busMapObject.id?0:44}} aria-label={mapPlacementTitle(p)+' — переместить на карте'} aria-pressed={mode==='landmarks'&&selected===p.id} onClick={event=>{event.stopPropagation();setMode('landmarks');selectTarget(p.id);}} onPointerDown={event=>start(event,p.id)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={event=>key(event,p.id)}><img src={mapPlacementDisplayImage(p)} alt="" width={size} height={size} style={p.id===busMapObject.id?{width:'100%',height:'100%',maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}:{width:size,height:size,maxWidth:size,maxHeight:size}} draggable={false}/></button>;})}
    {mode==='routes'&&route?.points.map((p,index)=><button type="button" key={index} className={styles.routePoint} style={{left:p.x+'%',top:p.y+'%','--point-color':mapPointColors[p.color||'cream']} as CSSProperties} title={mapRoutePointLabel(p,index)} data-selected={pointIndex===index} disabled={busy} aria-label={`${mapRoutePointLabel(p,index)} — маршрут ${route.title}; переместить стрелками`} aria-pressed={pointIndex===index} onClick={event=>{event.stopPropagation();setPointIndex(index);setDrawing(false);}} onPointerDown={event=>pointStart(event,index)} onPointerMove={pointMove} onPointerUp={pointFinish} onPointerCancel={pointFinish} onLostPointerCapture={pointFinish} onKeyDown={event=>pointKey(event,index)}>{index+1}</button>)}
   </div>
   {mode==='landmarks'&&item&&<fieldset disabled={busy}><legend>{original?'Изменить значок':'Новый значок'}: {mapPlacementTitle(item)}</legend>
    <label>Название<input maxLength={120} value={item.title??original?.title??''} onChange={event=>change(item.id,{title:event.target.value})}/></label>
    <label>Описание<textarea rows={4} maxLength={2000} value={item.description??''} placeholder={original?'Оставьте без изменений, чтобы сохранить исходное описание.':''} onChange={event=>change(item.id,{description:event.target.value})}/></label>
    <label>Размер: {mapPlacementImageSize(item)} px<input type="range" min={16} max={240} step={0.1} value={mapPlacementImageSize(item)} onChange={event=>change(item.id,{sizePx:Number(event.target.value)})}/></label><button type="button" onClick={()=>change(item.id,{sizePx:null,sizePreset:undefined})}>Сбросить размер</button>

    <ImageGuidance id={inputId+'-guidance'} src={item.image} mapIcon/>
    <div className={fields.filePicker} data-busy={busy}><label className={fields.fileChoose} htmlFor={inputId+'-icon'}>Выбрать изображение значка</label><input className={fields.fileInput} id={inputId+'-icon'} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-describedby={inputId+'-upload-status '+inputId+'-guidance'} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file,'icon');event.target.value='';}}/></div>
    {original&&<button type="button" onClick={()=>{imageUpload.reset();change(item.id,{image:original.image});setFilename('');}}>Вернуть исходное изображение</button>}
    <div className={styles.gallery} aria-label="Фотографии внутри карточки">{(item.photos||[]).map((photo,index)=><figure key={photo+'-'+index}><img src={photo} alt={`Фотография ${index+1} карточки ${mapPlacementTitle(item)}`}/><button type="button" onClick={()=>change(item.id,{photos:item.photos!.filter((_,i)=>i!==index)})}>Удалить фото {index+1}</button></figure>)}</div>
    <div className={fields.filePicker} data-busy={busy}><label className={fields.fileChoose} htmlFor={inputId+'-photo'}>Добавить фото внутрь карточки ({item.photos?.length||0}/8)</label><input className={fields.fileInput} id={inputId+'-photo'} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||(item.photos?.length||0)>=8} aria-describedby={inputId+'-upload-status'} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file,'photo');event.target.value='';}}/></div>
    {original&&<button type="button" onClick={()=>change(item.id,{title:undefined,description:undefined,sizePreset:undefined,sizePx:null})}>Вернуть исходные название, описание и размер</button>}
    {!original&&<button type="button" className={styles.danger} onClick={()=>setRemove('landmark')}>Удалить новый значок</button>}
   </fieldset>}
   {mode==='routes'&&route&&<fieldset disabled={busy}><legend>Изменить маршрут</legend>
    <label>Название маршрута<input maxLength={120} value={route.title} onChange={event=>changeRoute(route.id,{title:event.target.value})}/></label>
    <label>Экскурсия<select value={route.tourId||''} onChange={event=>changeRoute(route.id,{tourId:event.target.value||null,variantId:null})}><option value="">Без привязки к экскурсии</option>{route.tourId&&!routeTour&&<option value={route.tourId} disabled>Экскурсия отсутствует в текущем каталоге — уточните привязку</option>}{data.tours.map(tour=><option key={tour.id} value={tour.id}>{tour.title}{tour.hidden?' — архивная':tour.variants?.length&&tour.variants.every(program=>!program.visible)?' — все программы скрыты':''}</option>)}</select></label>
    {route.tourId&&<><label>Программа<select value={route.variantId||''} disabled={!routeTour} onChange={event=>changeRoute(route.id,{variantId:event.target.value||null})}><option value="">Уточните программу</option>{route.variantId&&!routePrograms.some(program=>program.id===route.variantId)&&<option value={route.variantId} disabled>Программа удалена или перенесена — уточните привязку</option>}{routePrograms.map(program=><option key={program.id} value={program.id}>{program.name}{!program.visible?' — скрыта':program.status==='temporarily_unavailable'?' — временно недоступна':' — опубликована'}</option>)}</select></label>{!route.variantId&&<p role="status">{routePrograms.length>1?'У экскурсии несколько программ. ':''}Уточните программу: прежняя привязка к экскурсии сохранена, но маршрут не показывается посетителям до выбора программы.</p>}</>}
    <p>В списке все экскурсии текущего каталога, включая скрытые и архивные. Черновики вне текущего каталога недоступны для привязки. Скрытые программы и архивные экскурсии не показываются посетителям.</p>
    <div className={styles.coordinates}><label>Цвет линии<select value={route.color} onChange={event=>changeRoute(route.id,{color:event.target.value as 'sea'|'land'})}><option value="sea">Голубой</option><option value="land">Зелёный</option></select></label><label>Линия<select value={route.style} onChange={event=>changeRoute(route.id,{style:event.target.value as 'solid'|'dashed'})}><option value="dashed">Пунктирная</option><option value="solid">Сплошная</option></select></label></div>
    <label className={styles.closedControl}><input type="checkbox" checked={!!route.closed} disabled={!canCloseMapRoute(route.points)} onChange={event=>changeRoute(route.id,{closed:event.target.checked})}/>Замкнуть маршрут</label>
    {!canCloseMapRoute(route.points)&&<p className={styles.revisions}>Для замыкания добавьте минимум три разные точки. При удалении до двух точек маршрут разомкнётся.</p>}
    <div className={styles.toolbar}><button type="button" aria-pressed={drawing} disabled={route.points.length>=100} onClick={()=>setDrawing(value=>!value)}>{drawing?'Закончить добавление точек':'Добавлять точки на карте'}</button><button type="button" disabled={!route.points.length} onClick={()=>{changeRoute(route.id,{points:route.points.slice(0,-1)});setPointIndex(null);}}>Убрать последнюю точку</button><button type="button" onClick={()=>{changeRoute(route.id,{points:[...route.points].reverse()});setPointIndex(null);}} disabled={route.points.length<2}>Развернуть порядок точек</button></div>
    <label>Точка ({route.points.length}/100)<select value={pointIndex??''} onChange={event=>setPointIndex(Number(event.target.value))}><option value="" disabled>Выберите точку</option>{route.points.map((point,index)=><option key={index} value={index}>{index+1}. {mapRoutePointLabel(point,index)}</option>)}</select></label>
    {selectedPoint&&pointIndex!==null&&<><div className={styles.pointFields}><label>Название точки<input maxLength={120} value={selectedPoint.label||''} placeholder={`Точка ${pointIndex+1}`} onChange={event=>pointChange(pointIndex,{label:event.target.value})}/></label><label>Цвет точки<select value={selectedPoint.color||'cream'} onChange={event=>pointChange(pointIndex,{color:event.target.value as MapPointColor})}><option value="cream">Кремовый</option><option value="sea">Голубой</option><option value="land">Зелёный</option><option value="gold">Жёлтый</option><option value="coral">Коралловый</option><option value="violet">Сиреневый</option></select></label></div><p className={styles.revisions}>Перетащите выбранную точку на карте или выделите её клавишей Tab и двигайте стрелками.</p><button type="button" onClick={()=>{changeRoute(route.id,{points:route.points.filter((_,index)=>index!==pointIndex)});setPointIndex(null);}}>Удалить выбранную точку</button></>}

    <p>Маршруты не связаны с GPS и не меняют программы экскурсий. Проверьте линию перед публикацией. Существующие линии на исходной картинке не стираются.</p>
    <button type="button" className={styles.danger} onClick={()=>setRemove('route')}>Удалить маршрут</button>
   </fieldset>}
   <p className={fields.fileName}>{filename}</p><p id={inputId+'-upload-status'} role="status" aria-live="polite">{imageUpload.status}</p>
   {imageUpload.busy&&<button type="button" onClick={imageUpload.cancel}>Отменить загрузку</button>}{imageUpload.retryable&&!busy&&<button type="button" onClick={imageUpload.retry}>Повторить загрузку</button>}
   {remove&&<div className={fields.confirm} role="group" aria-label="Подтверждение удаления"><p>Удалить {remove==='landmark'?'выбранный новый значок':'выбранный маршрут'} с карты? Опубликованная карта не изменится до публикации.</p><button type="button" disabled={busy} onClick={removeSelected}>Подтвердить удаление</button><button type="button" disabled={busy} onClick={()=>setRemove(null)}>Отмена</button></div>}
   <div className={styles.actions}><button type="button" className={fields.publish} disabled={busy} onClick={()=>run(saveAndPublish)}>{actionBusy?'Сохранение и публикация…':'Сохранить и опубликовать'}</button><button type="button" disabled={busy||!dirty} onClick={()=>{accept(data);setMessage('Несохранённые изменения отменены.');}}>Отменить изменения карты</button></div>

  </>}
 </section>;
}
