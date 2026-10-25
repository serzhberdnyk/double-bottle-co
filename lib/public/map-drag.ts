import {mapEditingBounds,type MapObjectId,type MapPlacement} from './map-layout';
type Pointer={pointerId:number;pointerType:string;button:number;buttons:number;isPrimary:boolean;clientX:number;clientY:number};
type Rect={left:number;top:number;width:number;height:number};
export type MapDrag={id:MapObjectId;pointerId:number;dx:number;dy:number;startX:number;startY:number;started:boolean};
export function clampMapCoordinate(n:number,axis:'x'|'y'){return Math.min(mapEditingBounds[axis].max,Math.max(mapEditingBounds[axis].min,Math.round(n*100)/100));}
export function mapDragDecision(e:Pointer,busy:boolean,selected:MapObjectId|null,id:MapObjectId){if(busy||e.button!==0||!e.isPrimary)return 'ignore';return e.pointerType==='touch'&&selected!==id?'select':'drag';}
export function beginMapDrag(e:Pointer,p:MapPlacement,b:Rect):MapDrag{return {id:p.id,pointerId:e.pointerId,dx:e.clientX-b.left-p.x/100*b.width,dy:e.clientY-b.top-p.y/100*b.height,startX:e.clientX,startY:e.clientY,started:false};}
export function moveMapDrag(d:MapDrag,e:Pointer,b:Rect){
 if(d.pointerId!==e.pointerId||(e.pointerType==='mouse'&&e.buttons!==1)||b.width<=0||b.height<=0)return null;
 if(!d.started&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<6)return null;
 return {drag:{...d,started:true},point:{x:clampMapCoordinate((e.clientX-b.left-d.dx)/b.width*100,'x'),y:clampMapCoordinate((e.clientY-b.top-d.dy)/b.height*100,'y')}};
}
