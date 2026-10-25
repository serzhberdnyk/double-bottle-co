import test from 'node:test';
import assert from 'node:assert/strict';
import {beginMapDrag,mapDragDecision,moveMapDrag} from '../lib/public/map-drag';
const event={pointerId:1,pointerType:'mouse',button:0,buttons:1,isPrimary:true,clientX:350,clientY:250};
const pin={id:'yona-boarding' as const,x:30,y:30,image:'/media/reference/yona-user-icon.webp'};
test('Touch first selects an unselected pin; selected touch and primary mouse can drag',()=>{
 assert.equal(mapDragDecision({...event,pointerType:'touch'},false,null,pin.id),'select');
 assert.equal(mapDragDecision({...event,pointerType:'touch'},false,pin.id,pin.id),'drag');
 assert.equal(mapDragDecision(event,false,null,pin.id),'drag');
 assert.equal(mapDragDecision({...event,isPrimary:false,pointerType:'touch'},false,pin.id,pin.id),'ignore');
 assert.equal(mapDragDecision({...event,button:2},false,pin.id,pin.id),'ignore');
 assert.equal(mapDragDecision(event,true,pin.id,pin.id),'ignore');
});
test('Pointer jitter, another finger and released mouse do not move a pin',()=>{
 const box={left:0,top:0,width:1000,height:800},d=beginMapDrag(event,pin,box);
 assert.equal(moveMapDrag(d,{...event,clientX:352,clientY:252},box),null);
 assert.equal(moveMapDrag(d,{...event,pointerId:2,clientX:400},box),null);
 assert.equal(moveMapDrag(d,{...event,buttons:0,clientX:400},box),null);
});
test('Dragging preserves the initial finger offset and scales in map percentages at both sizes',()=>{
 for(const width of [320,960]){const box={left:15,top:50,width,height:width*.8},start={...event,pointerType:'touch',clientX:box.left+.3*width+10,clientY:box.top+.3*box.height-12},d=beginMapDrag(start,pin,box),end={...start,clientX:start.clientX+.1*width,clientY:start.clientY+.05*box.height},moved=moveMapDrag(d,end,box)!;assert.deepEqual(moved.point,{x:40,y:35});assert(moved.drag.started);}
 const box={left:0,top:0,width:1000,height:800},d=beginMapDrag(event,pin,box);assert.deepEqual(moveMapDrag(d,{...event,clientX:10000,clientY:-10000},box)!.point,{x:100,y:0});
});
