'use client';
import {useI18n} from '@/lib/i18n/context';

import {BottlePrice} from './BottlePrice';
import {useEffect,useId,useMemo,useRef,useState,type CSSProperties,type PointerEvent,type ReactNode} from 'react';
import {Popover as PopoverPrimitive} from 'radix-ui';
import {Plus,Minus,LocateFixed,X,MapPin,Hand} from 'lucide-react';
import type {CatalogResponse,CatalogQuery,Variant,Destination,Tour} from '@/lib/public/types';
import {displayRates,todayInThailand} from '@/lib/public/pricing';
import {priceLabel,visitNames,programWord} from '@/lib/public/types';
import {TourImage} from './TourImage';
import {GeoArtwork} from './GeoArtwork';
import {project,geometryPath} from '@/lib/public/geo';
import {buildIslandHitAreas,clampMapView,fitMapPlane,fitFixedMapPlane,isDestinationInFixedRegion,isDestinationOnMap,markerClickAction,mergeMapDestinations,routeSchematicPath,MAX_ZOOM,MIN_ZOOM,type LandCollection,type MapView,type MapCameraMode} from '@/lib/public/map-engine';
import styles from './IslandMap.module.css';

export interface IslandMapProps {
  data:CatalogResponse;
  filters:CatalogQuery;
  selectedId:string|null;
  onSelect:(id:string|null)=>void;
  hoverVariant:Variant|null;
  variant?:'editorial'|'standard';
  className?:string;
  showCompass?:boolean;
  showBeyond?:boolean;
  /** Opt in to a non-draggable regional frame without changing catalogue defaults. */
  cameraMode?:MapCameraMode;
  /** Hide route schematics, including programme hover/focus previews. */
  showRoutes?:boolean;
  /** Stable, unfiltered public destinations retain their island bindings when filters return zero. */
  baselineDestinations?:Destination[];
  /** Geographic overlays share the same fit, pan and zoom as coastline and destination markers. */
  children?:ReactNode;
}

export function IslandMap({data,filters,selectedId,onSelect,hoverVariant,variant='standard',className='',showCompass=true,showBeyond=true,cameraMode='interactive',showRoutes=true,baselineDestinations,children}:IslandMapProps) {
 const {t:tr,href:localHref,locale}=useI18n();

  const [geo,setGeo]=useState<LandCollection|null>(null);
  const [mapError,setMapError]=useState(false);
  const [openId,setOpenId]=useState<string|null>(null);
  const [pinned,setPinned]=useState(false);
  const [related,setRelated]=useState<{id:string;key:string;items:Tour[];total:number;error?:string}|null>(null);
  const [view,setView]=useState<MapView>({z:1,x:0,y:0});
  const [size,setSize]=useState({width:0,height:0});
  const [route,setRoute]=useState<Variant|null>(null);
  const [hoveredId,setHoveredId]=useState<string|null>(null);
  const [touchPan,setTouchPan]=useState(false);
  const [unmapped,setUnmapped]=useState<{id:string;x:number;y:number}|null>(null);
  const contentRefs=useRef<Record<string,HTMLDivElement|null>>({});
  const markerRefs=useRef<Record<string,HTMLButtonElement|null>>({});
  const returnFocus=useRef<HTMLElement|SVGElement|null>(null);
  const suppressFocus=useRef<string|null>(null);
  const keyboardFocus=useRef(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const drag=useRef<{id:number;x:number;y:number;vx:number;vy:number}|null>(null);
  const container=useRef<HTMLDivElement>(null);
  const helpId=useId();
  const {category,days,transport,format,q}=filters;
  const filterKey=JSON.stringify([data.releaseId,category,days,transport,format,q]);
  const [previousFilterKey,setPreviousFilterKey]=useState(filterKey);
  const requestKey=useMemo(()=>{
    if(!openId)return null;
    const params=new URLSearchParams({destination:openId,release:data.releaseId,limit:'4',locale});
    for(const [key,value] of Object.entries({category,days,transport,format,q})){if(value)params.set(key,String(value));}
    return params.toString();
  },[openId,data.releaseId,category,days,transport,format,q,locale]);
  const activeRelated=related?.key===requestKey?related:null;
  const loading=!!openId&&!activeRelated;
  const popoverError=activeRelated?.error||'';
  const cameraInteractive=cameraMode==='interactive';
  const fit=useMemo(()=>cameraInteractive?fitMapPlane(size.width,size.height):fitFixedMapPlane(size.width,size.height),[size,cameraInteractive]);
  const activeView=cameraInteractive?view:{z:1,x:0,y:0};
  const destinations=useMemo(()=>mergeMapDestinations(data.destinations,baselineDestinations),[data.destinations,baselineDestinations]);
  const destinationsById=useMemo(()=>new Map(destinations.map(d=>[d.id,d])),[destinations]);
  const path=useMemo(()=>geo?.features.map(feature=>geometryPath(feature.geometry)).join('')||'',[geo]);
  const islandHitAreas=useMemo(()=>geo?buildIslandHitAreas(geo,destinations):[],[geo,destinations]);
  const destinationInFrame=cameraInteractive?isDestinationOnMap:isDestinationInFixedRegion;
  const inside=destinations.filter(destinationInFrame);
  const outside=destinations.filter(destination=>!destinationInFrame(destination));
  const activeRoute=showRoutes?(route||hoverVariant):null;
  const routePath=activeRoute?routeSchematicPath(activeRoute.stops):'';

  useEffect(()=>{
    const controller=new AbortController();
    fetch('/map/andaman.geojson',{signal:controller.signal}).then(response=>{
      if(!response.ok)throw Error('Map unavailable');return response.json() as Promise<LandCollection>;
    }).then(setGeo).catch(error=>{if(error.name!=='AbortError')setMapError(true);});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{
    const element=container.current;if(!element)return;
    const measure=()=>{const rect=element.getBoundingClientRect();setSize(previous=>previous.width===rect.width&&previous.height===rect.height?previous:{width:rect.width,height:rect.height});};
    measure();
    if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();}
    window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);
  },[]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  useEffect(()=>{
    if(!openId||!requestKey)return;
    const controller=new AbortController();
    fetch('/api/catalog?'+requestKey,{signal:controller.signal}).then(response=>{
      if(!response.ok)throw Error('Catalog unavailable');return response.json() as Promise<CatalogResponse>;
    }).then(result=>{if(!controller.signal.aborted)setRelated({id:openId,key:requestKey,items:result.items,total:result.total});}).catch(error=>{
      if(error.name!=='AbortError')setRelated({id:openId,key:requestKey,items:[],total:0,error:tr("Не удалось загрузить программы. Откройте список этого места.")});
    });
    return()=>controller.abort();
  },[openId,requestKey]);
  useEffect(()=>{
    if(pinned&&openId&&keyboardFocus.current){
      const content=contentRefs.current[openId];if(content){content.focus({preventScroll:true});keyboardFocus.current=false;}
    }
  },[pinned,openId]);

  // Invalidate interaction state before committing a new filter context; no stale popup flash.
  if(previousFilterKey!==filterKey){
    setPreviousFilterKey(filterKey);setOpenId(null);setPinned(false);setRoute(null);setUnmapped(null);setHoveredId(null);
  }

  function cancelClose(){if(timer.current){clearTimeout(timer.current);timer.current=null;}}
  function delayedClose(){
    cancelClose();setHoveredId(null);
    if(!pinned)timer.current=setTimeout(()=>{
      if(openId&&contentRefs.current[openId]?.contains(document.activeElement))return;
      setOpenId(null);setRoute(null);
    },350);
  }
  function close(restoreFocus=true){
    keyboardFocus.current=false;cancelClose();const id=openId;
    setOpenId(null);setPinned(false);setRoute(null);setUnmapped(null);setHoveredId(null);
    if(restoreFocus){
      suppressFocus.current=id;
      (returnFocus.current||(id?markerRefs.current[id]:null))?.focus({preventScroll:true});
      queueMicrotask(()=>{suppressFocus.current=null;});
    }
  }
  function activateDestination(id:string,target:HTMLElement|SVGElement,keyboard=false){
    cancelClose();setUnmapped(null);returnFocus.current=target;keyboardFocus.current=keyboard;
    if(markerClickAction(openId,pinned,id)==='close'&&!keyboard){close();return;}
    setOpenId(id);setPinned(true);setHoveredId(id);
    // A keyboard activation can follow an already-open hover preview.
    if(keyboard)queueMicrotask(()=>{contentRefs.current[id]?.focus({preventScroll:true});});
  }
  function previewDestination(id:string){
    cancelClose();setHoveredId(id);if(!pinned&&!unmapped){returnFocus.current=markerRefs.current[id]||null;setOpenId(id);}
  }
  function zoom(direction:number){setView(previous=>clampMapView({...previous,z:previous.z+direction*.25}));}
  function resetView(){setView({z:1,x:0,y:0});setTouchPan(false);}
  function startDrag(event:PointerEvent<HTMLDivElement>){
    if(!cameraInteractive||(event.pointerType==='touch'&&!touchPan)||event.button!==0||(event.target as Element).closest('button,a,[data-island-hit]'))return;
    close(false);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,vx:view.x,vy:view.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event:PointerEvent<HTMLDivElement>){
    const active=drag.current;if(!cameraInteractive||!active||active.id!==event.pointerId||fit.scale===0)return;
    setView(previous=>clampMapView({...previous,x:active.vx+(event.clientX-active.x)/fit.scale,y:active.vy+(event.clientY-active.y)/fit.scale}));
  }
  function stopDrag(event:PointerEvent<HTMLDivElement>){
    if(drag.current?.id!==event.pointerId)return;
    drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function point(destination:Destination,index:number,remote=false){
    const [px,py]=project(destination.lng,destination.lat);
    const list=activeRelated?.id===destination.id?activeRelated.items:[];
    const isLoading=loading||(openId===destination.id&&activeRelated?.id!==destination.id&&!popoverError);
    const count=activeRelated?.id===destination.id&&!loading&&!popoverError?activeRelated.total:destination.count||0;
    return <PopoverPrimitive.Root key={destination.id} open={openId===destination.id} onOpenChange={yes=>{if(!yes)close(false);}}>
      <PopoverPrimitive.Trigger asChild>
        <button ref={element=>{markerRefs.current[destination.id]=element;}} type="button" data-place={destination.id}
          className={`map-marker ${styles.marker} ${selectedId===destination.id?'selected ':''}${remote?'remote-marker':''}`}
          data-highlighted={hoveredId===destination.id||openId===destination.id}
          style={remote?undefined:{left:px/10+'%',top:py/7.5+'%','--marker-color':['#ee845e','#aaacd5','#e9bc59','#8bad78','#69c1d0'][index%5]} as CSSProperties}
          aria-label={`${destination.name}: ${destination.count||0} ${tr(programWord(destination.count||0))}`}
          onPointerDown={event=>event.stopPropagation()}
          onPointerEnter={event=>{if(event.pointerType==='mouse')previewDestination(destination.id);}}
          onPointerLeave={delayedClose}
          onFocus={()=>{if(suppressFocus.current!==destination.id)previewDestination(destination.id);}}
          onKeyDown={event=>{if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();activateDestination(destination.id,event.currentTarget,true);}}}
          onClick={event=>{event.preventDefault();activateDestination(destination.id,event.currentTarget);}}>
          <span className="marker-dot">{remote?<MapPin size={14}/>:destination.count||0}</span><span className="marker-name">{destination.name}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content ref={element=>{contentRefs.current[destination.id]=element;}} tabIndex={-1} aria-label={tr("Экскурсии: {0}").replace("{0}", String(destination.name))}
          side="bottom" align="start" sideOffset={10} collisionPadding={12} className="destination-popover" data-map-theme={variant}
          onOpenAutoFocus={event=>event.preventDefault()} onCloseAutoFocus={event=>event.preventDefault()}
          onEscapeKeyDown={event=>{event.preventDefault();close();}}
          onInteractOutside={event=>{const target=event.detail.originalEvent.target;if(target instanceof Element&&target.closest('[data-island-hit]')?.getAttribute('data-destination-id')===destination.id)event.preventDefault();}}
          onPointerEnter={cancelClose} onPointerLeave={delayedClose} onFocusCapture={cancelClose}>
          <button type="button" className="popover-close" aria-label={tr("Закрыть место")} onClick={()=>close()}><X size={18}/></button>
          {destination.image&&<TourImage className="popover-photo" src={destination.image} alt={destination.name} sizes="350px"/>}
          <div className="popover-body">
            <span className="eyebrow">{tr("Откройте это место")}</span><h3>{destination.name}</h3><p>{destination.description}</p>
            <span className="popover-count">{count} {tr(programWord(count))} {tr("по выбранным фильтрам")}</span>
            {isLoading?<p className="muted" role="status">{tr("Загружаем программы…")}</p>:popoverError?<p role="alert">{popoverError}</p>:list.length?list.slice(0,3).map(tour=>{
              const primary=tour.variants[0];if(!primary)return null;
              return <div className="popover-tour" key={tour.id}>
                <a href={localHref('/tour/'+tour.slug+'?variant='+primary.id)} onMouseEnter={()=>setRoute(primary)} onMouseLeave={()=>setRoute(null)} onFocus={()=>setRoute(primary)} onBlur={()=>setRoute(null)}><strong>{tour.title}</strong><small>{primary.duration} · <BottlePrice price={priceLabel(displayRates(primary),todayInThailand())}/> · {priceLabel(displayRates(primary),todayInThailand()).unit}</small></a>
                {tour.variants.map(tourVariant=><a key={tourVariant.id} className="popover-variant" href={localHref('/tour/'+tour.slug+'?variant='+tourVariant.id)}
                  onMouseEnter={()=>setRoute(tourVariant)} onMouseLeave={()=>setRoute(null)} onFocus={()=>setRoute(tourVariant)} onBlur={()=>setRoute(null)}>
                  {tour.variants.length>1?tourVariant.name+' · ':''}{tr(visitNames[tourVariant.stops.find(stop=>stop.destinationId===destination.id)?.visitType||'conditional'])}
                </a>)}
              </div>;
            }):<p>{tr("Нет программ по выбранным фильтрам. Попробуйте изменить фильтры или откройте все экскурсии через это место.")}</p>}
            <button type="button" className="popover-filter" onClick={()=>{onSelect(destination.id);close();}}>{tr("Показать в подборке")}</button>
            <a className="text-link" href={localHref('/?destination='+encodeURIComponent(destination.id)+'#selected')}>{tr("Все экскурсии через это место")}</a>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>;
  }

  return <div ref={container} className={`island-map island-map--${variant} ${className}`} data-camera-mode={cameraMode} role="region" aria-label={tr("Интерактивная карта направлений")} aria-busy={!geo&&!mapError}>
    <div className="map-sea"/>
    <p className="sr-only" id={helpId}>{cameraInteractive?tr("Стрелки перемещают карту, плюс и минус меняют масштаб, Home сбрасывает вид. Enter или пробел открывает экскурсии по острову. Для перемещения пальцем включите кнопку с ладонью; иначе карту можно прокручивать вместе со страницей."):tr("Карта с фиксированным видом. Enter или пробел открывает экскурсии по острову. Страницу можно прокручивать поверх карты.")}</p>
    {mapError?<div className="map-error"><h3>{tr("Карта временно недоступна")}</h3><p>{tr("Все программы можно найти в списке.")}</p><a href={localHref("/#selected")} className="primary-button">{tr("Открыть каталог")}</a></div>:
      <div className={`geo-viewport ${styles.viewport} ${!cameraInteractive?styles.fixedViewport:''}`} style={{touchAction:cameraInteractive&&touchPan?'none':'pan-y pinch-zoom'}} role="group" tabIndex={cameraInteractive?0:undefined} aria-label={tr("Карта островов")} aria-describedby={helpId}
        onPointerDown={cameraInteractive?startDrag:undefined} onPointerMove={cameraInteractive?moveDrag:undefined} onPointerUp={cameraInteractive?stopDrag:undefined} onPointerCancel={cameraInteractive?stopDrag:undefined} onLostPointerCapture={cameraInteractive?()=>{drag.current=null;}:undefined}
        onKeyDown={cameraInteractive?event=>{
          if(event.target!==event.currentTarget)return;
          const movement:{[key:string]:[number,number]}={ArrowLeft:[65,0],ArrowRight:[-65,0],ArrowUp:[0,65],ArrowDown:[0,-65]};
          if(movement[event.key]){event.preventDefault();const [x,y]=movement[event.key];setView(previous=>clampMapView({...previous,x:previous.x+x,y:previous.y+y}));}
          else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1);}
          else if(event.key==='-'){event.preventDefault();zoom(-1);}
          else if(event.key==='Home'){event.preventDefault();resetView();}
        }:undefined}>
        <div className="geo-plane" data-plane-width="1000" data-plane-height="750" style={{
          position:'absolute',inset:'auto',width:fit.width,height:fit.height,left:fit.left,top:fit.top,aspectRatio:'4 / 3',
          transformOrigin:'50% 50%',transform:`translate(${activeView.x*fit.scale}px,${activeView.y*fit.scale}px) scale(${activeView.z})`,visibility:fit.scale>0?'visible':'hidden'
        }}>
          <svg viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid meet" className="geography" aria-label={tr("Географические контуры островов")}>
            <GeoArtwork path={path} theme={variant}/>
            <g className="island-hit-areas">
              {islandHitAreas.filter(area=>area.visible).map(area=>{
                const destination=area.destinationIds.length===1?destinationsById.get(area.destinationIds[0]):undefined;
                const mapped=destination&&destinationInFrame(destination);
                return <path key={area.id} d={area.path} fillRule="evenodd" className={styles.hitArea} data-island-hit={area.id}
                  data-destination-id={mapped?destination.id:undefined}
                  data-highlighted={!!mapped&&(hoveredId===destination.id||openId===destination.id)} data-selected={!!mapped&&selectedId===destination.id}
                  role={mapped?'button':undefined} tabIndex={mapped?0:-1}
                  aria-label={mapped?tr("{0}: {1} {2}. Открыть экскурсии").replace("{0}", String(destination.name)).replace("{1}", String(destination.count||0)).replace("{2}", String(tr(programWord(destination.count||0)))):undefined}
                  aria-haspopup={mapped?'dialog':undefined} aria-expanded={mapped?openId===destination.id:undefined}
                  onPointerEnter={event=>{if(mapped&&event.pointerType==='mouse'){cancelClose();if(!pinned){setOpenId(null);setRoute(null);}setHoveredId(destination.id);}}}
                  onPointerLeave={()=>setHoveredId(null)}
                  onFocus={()=>{if(mapped)setHoveredId(destination.id);}} onBlur={()=>setHoveredId(null)}
                  onKeyDown={event=>{if(mapped&&['Enter',' '].includes(event.key)){event.preventDefault();activateDestination(destination.id,event.currentTarget,true);}}}
                  onClick={event=>{
                    event.stopPropagation();
                    if(mapped){activateDestination(destination.id,event.currentTarget);return;}
                    close(false);const rect=container.current?.getBoundingClientRect();returnFocus.current=event.currentTarget;
                    setUnmapped({id:area.id,x:event.clientX-(rect?.left||0),y:event.clientY-(rect?.top||0)});
                  }}>
                  <title>{mapped?tr("{0} · Открыть экскурсии").replace("{0}", String(destination.name)):tr("Остров на карте · Проверить экскурсии")}</title>
                </path>;
              })}
            </g>
            <g className="map-labels" pointerEvents="none" aria-hidden="true">
              {variant!=='editorial'&&<text data-region="phuket" x={project(98.29,8.04)[0]} y={project(98.29,8.04)[1]}>{tr("ПХУКЕТ")}</text>}
              <text x={project(98.75,8.46)[0]} y={project(98.75,8.46)[1]} className="mainland-label">{tr("ПХАНГ НГА")}</text>
              <text x={project(99.04,8.16)[0]} y={project(99.04,8.16)[1]} className="mainland-label">{tr("КРАБИ")}</text>
              <text x="260" y="628" className="sea-label">{tr("Андаманское море")}</text>
            </g>
            {routePath&&<path className="route-path" d={routePath} fill="none" stroke="#ffbd87" strokeWidth="2.8" strokeDasharray="5 5" pointerEvents="none" aria-hidden="true"/>}
          </svg>
          <div className="map-points">{inside.map((destination,index)=>point(destination,index))}{children}</div>
        </div>
      </div>}
    {!geo&&!mapError&&<div className={styles.status} role="status">{tr("Загружаем географическую карту…")}</div>}
    {cameraInteractive&&touchPan&&<div className={styles.status} role="status">{tr("Перемещайте карту пальцем. Выключите ладонь, чтобы прокручивать страницу.")}</div>}
    {showCompass&&<div className="compass" aria-hidden="true"><span>N</span><b>✧</b><small>{tr("Исследуйте")}<br/>{tr("больше")}</small></div>}
    {showBeyond&&outside.length>0&&<div className="beyond-map"><span>{tr("ЗА ПРЕДЕЛАМИ КАРТЫ")}</span>{outside.slice(0,5).map((destination,index)=>point(destination,index,true))}{outside.length>5&&<a href={localHref("/destinations")}>{tr("Ещё направления")}</a>}</div>}
    {cameraInteractive&&<div className={`map-controls ${styles.controls}`} aria-label={tr("Управление картой")}>
      <button type="button" aria-label={tr("Увеличить карту")} onClick={()=>zoom(1)} disabled={view.z>=MAX_ZOOM||mapError}><Plus size={18}/></button>
      <button type="button" aria-label={tr("Уменьшить карту")} onClick={()=>zoom(-1)} disabled={view.z<=MIN_ZOOM||mapError}><Minus size={18}/></button>
      <button type="button" aria-label={tr("Сбросить масштаб и положение карты")} onClick={resetView} disabled={mapError}><LocateFixed size={18}/></button>
      <button type="button" aria-label={tr("Перемещать карту касанием")} title={tr("Перемещать карту касанием")} aria-pressed={touchPan} onClick={()=>setTouchPan(value=>!value)} disabled={mapError}><Hand size={18}/></button>
    </div>}
    <div className="map-credit"><span>{routePath?tr("Схема последовательности остановок, не навигационный путь."):showRoutes?tr("Места и маршруты — по выбранным программам."):tr("Места — по опубликованным программам.")}</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
    <PopoverPrimitive.Root open={!!unmapped} onOpenChange={yes=>{if(!yes)close(false);}}>
      <PopoverPrimitive.Anchor asChild><span aria-hidden="true" style={{position:'absolute',left:unmapped?.x||0,top:unmapped?.y||0,width:1,height:1,pointerEvents:'none'}}/></PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal><PopoverPrimitive.Content className={`destination-popover ${styles.unmapped}`} data-map-theme={variant} side="bottom" collisionPadding={12} aria-label={tr("Остров на карте")}
        onCloseAutoFocus={event=>event.preventDefault()} onEscapeKeyDown={event=>{event.preventDefault();close();}}>
        <button type="button" className="popover-close" aria-label={tr("Закрыть место")} onClick={()=>close()}><X size={18}/></button>
        <h3>{tr("Остров на карте")}</h3><p>{tr("Нет подтверждённой привязки экскурсий к этому острову.")}</p><a className="text-link" href={localHref("/#selected")}>{tr("Посмотреть все экскурсии")}</a>
      </PopoverPrimitive.Content></PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  </div>;
}
