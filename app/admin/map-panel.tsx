'use client';

import {useEffect,useRef,useState,useId,type PointerEvent,type KeyboardEvent,type MouseEvent} from 'react';
import {ImageGuidance} from './image-guidance';
import {busMapObject,mapPlacementDisplayImage,mapObjects,mapEditingBounds,parseMapDocument,mapDocumentSchema,mapPlacementImageSize,mapPlacementTitle,type MapDocument,type MapLayout,type MapObjectId,type MapPlacement,type MapRoute} from '@/lib/public/map-layout';
import {useEditorImageUpload} from '@/hooks/use-editor-image-upload';
import {mapDragDecision,beginMapDrag,moveMapDrag,clampMapCoordinate as clamp,type MapDrag} from '@/lib/public/map-drag';
import fields from './catalog-panel.module.css';
import styles from './map-panel.module.css';

type State={revision:number;publishedRevision:number;published:MapLayout;draft:MapLayout|null;publishedDocument?:MapDocument;draftDocument?:MapDocument|null};
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
 const [mode,setMode]=useState<Mode>('landmarks'),[drawing,setDrawing]=useState(false),[dirty,setDirty]=useState(false),[actionBusy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirm,setConfirm]=useState(false),[remove,setRemove]=useState<'landmark'|'route'|null>(null),[filename,setFilename]=useState(''),[coordinates,setCoordinates]=useState({x:'',y:''});
 const target=useRef<{id:string;kind:'icon'|'photo'}|null>(null);
 const imageUpload=useEditorImageUpload(path=>{
  const active=target.current;if(!active)return;
  if(active.kind==='icon')change(active.id,{image:path});
  else setDocument(current=>({...current,placements:current.placements.map(p=>p.id===active.id?{...p,photos:[...new Set([...(p.photos||[]),path])].slice(0,8)}:p)}));
  setDirty(true);setConfirm(false);
 });
 const busy=actionBusy||imageUpload.busy;
 const canvas=useRef<HTMLDivElement>(null),drag=useRef<MapDrag|null>(null),pointDrag=useRef<{pointerId:number;index:number;routeId:string}|null>(null),inputId=useId();
 const item=document.placements.find(i=>i.id===selected),original=mapObjects.find(i=>i.id===selected);
 const route=document.routes.find(r=>r.id===selectedRoute);
 const selectedPoint=route&&pointIndex!==null?route.points[pointIndex]:undefined;

 function markDirty(){setDirty(true);setConfirm(false);setRemove(null);}
 function change(id:string,patch:Partial<MapPlacement>){setDocument(current=>({...current,placements:current.placements.map(i=>i.id===id?{...i,...patch}:i)}));markDirty();}
 function changeRoute(id:string,patch:Partial<MapRoute>){setDocument(current=>({...current,routes:current.routes.map(r=>r.id===id?{...r,...patch}:r)}));markDirty();}
 function selectTarget(id:MapObjectId){if(id!==selected){imageUpload.reset();target.current=null;setFilename('');}setSelected(id);setRemove(null);}
 function accept(next:State){
  const nextDocument=parseMapDocument(next.draftDocument||next.draft||next.publishedDocument||next.published);
  setData(next);setDocument(structuredClone(nextDocument));setSelected(previous=>nextDocument.placements.some(p=>p.id===previous)?previous:null);setSelectedRoute(previous=>nextDocument.routes.some(r=>r.id===previous)?previous:null);
  setPointIndex(null);setDrawing(false);setDirty(false);setConfirm(false);setRemove(null);setFilename('');imageUpload.reset();target.current=null;
 }
 useEffect(()=>{let active=true;api().then(next=>{if(active)accept(next);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
 useEffect(()=>{if(item)setCoordinates({x:String(Math.round(item.x*100)/100),y:String(Math.round(item.y*100)/100)});},[item]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function coordinate(axis:'x'|'y',value:string){
  if(!selected)return;if(value.trim()===''||!Number.isFinite(Number(value))){setMessage('Укажите положение числом.');return;}
  const next=clamp(Number(value),axis);setCoordinates(current=>({...current,[axis]:String(next)}));if(item&&Math.abs(item[axis]-next)>=.0051)change(selected,{[axis]:next});
 }
 async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:'Не удалось выполнить действие.');}finally{setBusy(false);}}
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
  selectTarget(id);setMode('landmarks');setDrawing(false);markDirty();setMessage('Новый значок добавлен в черновик. Укажите название, изображение и положение.');
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
 function pointChange(index:number,patch:Partial<{x:number;y:number}>){if(!route)return;changeRoute(route.id,{points:route.points.map((p,i)=>i===index?{x:routeClamp(patch.x??p.x),y:routeClamp(patch.y??p.y)}:p)});}
 function pointStart(event:PointerEvent<HTMLButtonElement>,index:number){
  if(busy||!route||event.button!==0||!event.isPrimary)return;event.stopPropagation();setPointIndex(index);setDrawing(false);pointDrag.current={pointerId:event.pointerId,index,routeId:route.id};event.currentTarget.setPointerCapture(event.pointerId);
 }
 function pointMove(event:PointerEvent<HTMLButtonElement>){const current=pointDrag.current;if(!current||busy||current.pointerId!==event.pointerId)return;pointChange(current.index,canvasPoint(event.clientX,event.clientY));}
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
 async function save(){
  let pending=document;
  if(item&&mode==='landmarks'){
   if(!coordinates.x.trim()||!coordinates.y.trim()||!Number.isFinite(Number(coordinates.x))||!Number.isFinite(Number(coordinates.y)))throw Error('Укажите положение значка числом.');
   pending={...document,placements:document.placements.map(p=>p.id===item.id?{...p,x:clamp(Number(coordinates.x),'x'),y:clamp(Number(coordinates.y),'y')}:p)};
  }
  if(pending.routes.some(r=>r.points.length<2))throw Error('Для каждого маршрута нужны минимум две точки. Добавьте точки или удалите незавершённую линию.');
  if(!mapDocumentSchema.safeParse(pending).success)throw Error('Проверьте названия, изображения, координаты и ограничения: до 101 значка, 50 маршрутов, 100 точек на линию и 8 фотографий на значок.');
  accept(await api({action:'save',revision:data!.revision,document:pending}));setMessage('Черновик карты сохранён. На сайте пока остаётся опубликованная версия.');
 }

 return <section className={fields.editor} aria-label="Редактор карты">
  <div className={fields.heading}><h2>Карта</h2><button type="button" disabled={busy||dirty} onClick={()=>run(async()=>accept(await api()))}>Обновить карту</button></div>
  <p role="status" aria-live="polite" className={fields.message}>{message}</p>
  {!data?<><p>{message?'Карта не загружена. Повторите загрузку, когда доступ восстановится.':'Загрузка карты…'}</p><button type="button" disabled={busy} onClick={()=>run(async()=>accept(await api()))}>Повторить загрузку</button></>:<>
   <p className={styles.revisions}>Опубликованная версия: {data.publishedRevision}. Ревизия редактирования: {data.revision}. {dirty?'Есть несохранённые изменения.':data.draft?'Есть сохранённый черновик.':'Черновика нет.'}</p>
   <div className={styles.toolbar} aria-label="Инструменты карты">
    <button type="button" aria-pressed={mode==='landmarks'} disabled={busy} onClick={()=>{setMode('landmarks');setDrawing(false);setRemove(null);}}>Значки ({document.placements.length})</button>
    <button type="button" aria-pressed={mode==='routes'} disabled={busy} onClick={()=>{setMode('routes');setRemove(null);}}>Маршруты ({document.routes.length})</button>
    <button type="button" disabled={busy||document.placements.length>=101} onClick={addLandmark}>Добавить значок</button>
    <button type="button" disabled={busy||document.routes.length>=50} onClick={addRoute}>Добавить маршрут</button>
   </div>
   {mode==='landmarks'?<label>Значок<select value={selected||''} disabled={busy} onChange={event=>selectTarget(event.target.value)}><option value="" disabled>Выберите значок</option>{document.placements.map(p=><option value={p.id} key={p.id}>{mapPlacementTitle(p)}</option>)}</select></label>:<label>Маршрут<select value={selectedRoute||''} disabled={busy} onChange={event=>{setSelectedRoute(event.target.value);setPointIndex(null);setDrawing(false);setRemove(null);}}><option value="" disabled>Выберите маршрут</option>{document.routes.map(r=><option value={r.id} key={r.id}>{r.title}</option>)}</select></label>}
   <p>{mode==='landmarks'?'Выберите значок, затем перетащите его. На телефоне сначала коснитесь значка. Для точного положения используйте проценты или клавиши со стрелками (Shift — крупный шаг). Значки и маршруты можно размещать на всей карте, от 0 до 100%.':'Включите добавление точек и нажимайте на карту. Точки можно выбирать, перетаскивать, двигать стрелками или менять их проценты ниже. Линии — схема на исходной иллюстрации, не GPS-навигация.'}</p>
   <div className={styles.canvas} ref={canvas} onClick={addPoint} data-drawing={drawing} aria-label="Расположение значков и маршрутов карты">
    <img className={styles.map} src="/media/reference/andaman-user-map.png" alt="Карта Андаманского моря" draggable={false}/>
    <svg className={styles.routes} viewBox="0 0 1280 1083" aria-hidden="true">{document.routes.map(r=><polyline key={r.id} points={r.points.map(p=>`${p.x*12.8},${p.y*10.83}`).join(' ')} fill="none" stroke={r.color==='sea'?'#4bd4f1':'#c5e877'} strokeWidth={r.id===selectedRoute&&mode==='routes'?5:3} strokeDasharray={r.style==='dashed'?'10 8':undefined} vectorEffect="non-scaling-stroke"/>)}</svg>
    {document.placements.map(p=>{const size=mapPlacementImageSize(p);return <button type="button" key={p.id} className={styles.marker} data-selected={mode==='landmarks'&&selected===p.id} data-map-editor-object={p.id} disabled={busy||drawing} style={{left:p.x+'%',top:p.y+'%',transform:(p.id==='diving'||p.id===busMapObject.id)?'translate(-50%,-50%)':'translate(-50%,-100%)',width:p.id===busMapObject.id?size/1280*100+'%':Math.max(44,size),height:p.id===busMapObject.id?'auto':Math.max(44,size),aspectRatio:p.id===busMapObject.id?'2/1':undefined,minWidth:p.id===busMapObject.id?0:44,minHeight:p.id===busMapObject.id?0:44}} aria-label={mapPlacementTitle(p)+' — переместить на карте'} aria-pressed={mode==='landmarks'&&selected===p.id} onClick={event=>{event.stopPropagation();setMode('landmarks');selectTarget(p.id);}} onPointerDown={event=>start(event,p.id)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={event=>key(event,p.id)}><img src={mapPlacementDisplayImage(p)} alt="" width={size} height={size} style={p.id===busMapObject.id?{width:'100%',height:'100%',maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}:{width:size,height:size,maxWidth:size,maxHeight:size}} draggable={false}/></button>;})}
    {mode==='routes'&&route?.points.map((p,index)=><button type="button" key={index} className={styles.routePoint} style={{left:p.x+'%',top:p.y+'%'}} data-selected={pointIndex===index} disabled={busy} aria-label={`Точка ${index+1} маршрута ${route.title}`} aria-pressed={pointIndex===index} onClick={event=>{event.stopPropagation();setPointIndex(index);setDrawing(false);}} onPointerDown={event=>pointStart(event,index)} onPointerMove={pointMove} onPointerUp={pointFinish} onPointerCancel={pointFinish} onLostPointerCapture={pointFinish} onKeyDown={event=>pointKey(event,index)}>{index+1}</button>)}
   </div>
   {mode==='landmarks'&&item&&<fieldset disabled={busy}><legend>{original?'Изменить значок':'Новый значок'}: {mapPlacementTitle(item)}</legend>
    <label>Название<input maxLength={120} value={item.title??original?.title??''} onChange={event=>change(item.id,{title:event.target.value})}/></label>
    <label>Описание<textarea rows={4} maxLength={2000} value={item.description??''} placeholder={original?'Оставьте без изменений, чтобы сохранить исходное описание.':''} onChange={event=>change(item.id,{description:event.target.value})}/></label>
    <label>Размер: {mapPlacementImageSize(item)} px<input type="range" min={16} max={240} step={0.1} value={mapPlacementImageSize(item)} onChange={event=>change(item.id,{sizePx:Number(event.target.value)})}/></label><button type="button" onClick={()=>change(item.id,{sizePx:null,sizePreset:undefined})}>Сбросить размер</button>
    <div className={styles.coordinates}>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Слева':'Сверху'}, %<input aria-label={axis==='x'?'Положение слева в процентах':'Положение сверху в процентах'} type="number" min={mapEditingBounds[axis].min} max={mapEditingBounds[axis].max} step="0.01" value={coordinates[axis]} onChange={event=>{setCoordinates(current=>({...current,[axis]:event.target.value}));markDirty();}} onBlur={event=>coordinate(axis,event.target.value)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>)}</div>
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
    <div className={styles.coordinates}><label>Цвет<select value={route.color} onChange={event=>changeRoute(route.id,{color:event.target.value as 'sea'|'land'})}><option value="sea">Голубой</option><option value="land">Зелёный</option></select></label><label>Линия<select value={route.style} onChange={event=>changeRoute(route.id,{style:event.target.value as 'solid'|'dashed'})}><option value="dashed">Пунктирная</option><option value="solid">Сплошная</option></select></label></div>
    <div className={styles.toolbar}><button type="button" aria-pressed={drawing} disabled={route.points.length>=100} onClick={()=>setDrawing(value=>!value)}>{drawing?'Закончить добавление точек':'Добавлять точки на карте'}</button><button type="button" disabled={!route.points.length} onClick={()=>{changeRoute(route.id,{points:route.points.slice(0,-1)});setPointIndex(null);}}>Убрать последнюю точку</button><button type="button" onClick={()=>{changeRoute(route.id,{points:[...route.points].reverse()});setPointIndex(null);}} disabled={route.points.length<2}>Развернуть порядок точек</button></div>
    <label>Точка ({route.points.length}/100)<select value={pointIndex??''} onChange={event=>setPointIndex(Number(event.target.value))}><option value="" disabled>Выберите точку</option>{route.points.map((_,index)=><option key={index} value={index}>Точка {index+1}</option>)}</select></label>
    {selectedPoint&&pointIndex!==null&&<><div className={styles.coordinates}>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Слева':'Сверху'}, %<input type="number" min={0} max={100} step="0.01" value={selectedPoint[axis]} onChange={event=>{if(event.target.value.trim()&&Number.isFinite(Number(event.target.value)))pointChange(pointIndex,{[axis]:Number(event.target.value)});}}/></label>)}</div><button type="button" onClick={()=>{changeRoute(route.id,{points:route.points.filter((_,index)=>index!==pointIndex)});setPointIndex(null);}}>Удалить выбранную точку</button></>}
    <p>Маршруты не связаны с GPS и не меняют программы экскурсий. Проверьте линию перед публикацией. Существующие линии на исходной картинке не стираются.</p>
    <button type="button" className={styles.danger} onClick={()=>setRemove('route')}>Удалить маршрут</button>
   </fieldset>}
   <p className={fields.fileName}>{filename}</p><p id={inputId+'-upload-status'} role="status" aria-live="polite">{imageUpload.status}</p>
   {imageUpload.busy&&<button type="button" onClick={imageUpload.cancel}>Отменить загрузку</button>}{imageUpload.retryable&&!busy&&<button type="button" onClick={imageUpload.retry}>Повторить загрузку</button>}
   {remove&&<div className={fields.confirm} role="group" aria-label="Подтверждение удаления"><p>Удалить {remove==='landmark'?'выбранный новый значок':'выбранный маршрут'} из черновика? Опубликованная карта не изменится до публикации.</p><button type="button" disabled={busy} onClick={removeSelected}>Подтвердить удаление</button><button type="button" disabled={busy} onClick={()=>setRemove(null)}>Отмена</button></div>}
   <div className={styles.actions}><button type="button" disabled={busy||!dirty} onClick={()=>run(save)}>Сохранить черновик карты</button><button type="button" disabled={busy||!dirty} onClick={()=>{accept(data);setMessage('Несохранённые изменения отменены.');}}>Отменить изменения карты</button><button type="button" className={fields.publish} disabled={busy||dirty||!data.draft} onClick={()=>setConfirm(true)}>Опубликовать карту</button></div>
   {confirm&&<div className={fields.confirm}><p>Опубликовать сохранённый черновик карты на сайте? Значки и нарисованные линии станут доступны посетителям.</p><button type="button" disabled={busy} onClick={()=>run(async()=>{accept(await api({action:'publish',revision:data.revision}));setMessage('Карта опубликована.');})}>Подтвердить публикацию карты</button><button type="button" disabled={busy} onClick={()=>setConfirm(false)}>Отмена</button></div>}
  </>}
 </section>;
}
