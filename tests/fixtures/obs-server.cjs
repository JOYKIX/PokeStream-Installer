const {WebSocketServer}=require('next/dist/compiled/ws');
const {randomUUID,createHash}=require('node:crypto');
const clone=v=>structuredClone(v);
const sha=v=>createHash('sha256').update(v).digest('base64');
async function createOBSFixture({password='fixture-password',width=2560,height=1440}={}){
 const server=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(resolve=>server.once('listening',resolve));
 const scene={name:'Pokémon',uuid:randomUUID()},sourceUuid=randomUUID(),requests=[],sources=new Map(),inputs=new Map(),collection='Fixture collection';let nextId=50,failOnce=null;const hooks=new Map();
 const transform={positionX:260,positionY:170,rotation:12,scaleX:1.7,scaleY:1.4,sourceWidth:1280,sourceHeight:720,width:1800,height:900,alignment:5,boundsType:'OBS_BOUNDS_NONE',boundsAlignment:0,boundsWidth:0,boundsHeight:0,cropLeft:89,cropTop:22,cropRight:45,cropBottom:16};
 const original={sceneItemId:7,sceneItemIndex:0,sceneItemEnabled:true,sceneItemLocked:true,sourceName:'EcranHaut',sourceUuid,sceneItemTransform:clone(transform),inputKind:'window_capture',isGroup:false};
 sources.set(scene.uuid,{...scene,items:[original]});
 const findScene=data=>data.sceneUuid?sources.get(data.sceneUuid):[...sources.values()].find(s=>s.name===data.sceneName);
 const findItem=data=>{const s=findScene(data),item=s?.items.find(i=>i.sceneItemId===data.sceneItemId);if(!item)throw Error('Missing fixture item');return item;};
 async function command(type,data){
  if(hooks.has(type)){const callback=hooks.get(type);hooks.delete(type);await callback();}
  if(failOnce===type){failOnce=null;throw Error('Injected failure');}
  switch(type){
   case 'GetInputKindList':return {inputKinds:['browser_source','window_capture','dshow_input']};
   case 'GetSceneItemTransform':return {sceneItemTransform:clone(findItem(data).sceneItemTransform)};
   case 'CreateInput':{const target=findScene(data),input={uuid:randomUUID(),name:data.inputName,kind:data.inputKind,settings:data.inputSettings};inputs.set(input.uuid,input);const item={sceneItemId:nextId++,sceneItemIndex:target.items.length,sceneItemEnabled:true,sourceUuid:input.uuid,sourceName:input.name,sceneItemTransform:{sourceWidth:1920,sourceHeight:1080},isGroup:false};target.items.push(item);return {inputUuid:input.uuid,sceneItemId:item.sceneItemId};}
   case 'RemoveInput':{const input=data.inputUuid?inputs.get(data.inputUuid):[...inputs.values()].find(i=>i.name===data.inputName);if(!input)throw Error('Missing fixture input');inputs.delete(input.uuid);for(const s of sources.values())s.items=s.items.filter(i=>i.sourceUuid!==input.uuid);return {};}
   case 'GetSceneCollectionList':return {currentSceneCollectionName:collection,sceneCollections:[collection]};
   case 'GetVideoSettings':return {baseWidth:width,baseHeight:height,outputWidth:1920,outputHeight:1080};
   case 'GetSceneList':return {currentProgramSceneName:scene.name,currentProgramSceneUuid:scene.uuid,scenes:[...sources.values()].map(s=>({sceneName:s.name,sceneUuid:s.uuid}))};
   case 'GetSceneItemList':{const s=findScene(data);if(!s)throw Error('Missing fixture scene');return {sceneItems:clone(s.items)};}
   case 'CreateScene':{const value={uuid:randomUUID(),name:data.sceneName,items:[]};sources.set(value.uuid,value);return {sceneUuid:value.uuid};}
   case 'DuplicateSceneItem':{
    const item=clone(findItem(data));
    // Match OBS itself: destinationSceneName must be present for a cross-scene copy.
    const target=data.destinationSceneName?(data.destinationSceneUuid?sources.get(data.destinationSceneUuid):[...sources.values()].find(s=>s.name===data.destinationSceneName)):findScene(data);
    if(!target)throw Error('Missing fixture destination');item.sceneItemId=nextId++;item.sceneItemIndex=target.items.length;target.items.push(item);return {sceneItemId:item.sceneItemId};
   }
   case 'CreateSceneItem':{const target=findScene(data),input=data.sourceUuid?sources.get(data.sourceUuid):[...sources.values()].find(s=>s.name===data.sourceName);if(!target||!input)throw Error('Missing fixture container');const item={sceneItemId:nextId++,sceneItemIndex:target.items.length,sceneItemEnabled:data.sceneItemEnabled??true,sceneItemLocked:false,sourceName:input.name,sourceUuid:input.uuid,sceneItemTransform:{},isGroup:false};target.items.push(item);return {sceneItemId:item.sceneItemId};}
   case 'SetSceneItemTransform':{const item=findItem(data);Object.assign(item.sceneItemTransform,data.sceneItemTransform);return {};}
   case 'SetSceneItemEnabled':findItem(data).sceneItemEnabled=data.sceneItemEnabled;return {};
   case 'SetSceneItemLocked':findItem(data).sceneItemLocked=data.sceneItemLocked;return {};
   case 'SetSceneItemIndex':{const scene=findScene(data),item=findItem(data);scene.items=scene.items.toSorted((a,b)=>a.sceneItemIndex-b.sceneItemIndex).filter(i=>i!==item);scene.items.splice(data.sceneItemIndex,0,item);scene.items.forEach((i,n)=>i.sceneItemIndex=n);return {};}
   case 'RemoveSceneItem':{const s=findScene(data);s.items=s.items.filter(i=>i.sceneItemId!==data.sceneItemId);return {};}
   case 'RemoveScene':{const s=findScene(data);if(!s)throw Error('Missing fixture scene');sources.delete(s.uuid);for(const source of sources.values())source.items=source.items.filter(i=>i.sourceUuid!==s.uuid);return {};}
   default:throw Error('Unexpected fixture request: '+type);
  }
 }
 server.on('connection',socket=>{
  const salt='fixture-salt',challenge='fixture-challenge';socket.send(JSON.stringify({op:0,d:{rpcVersion:1,authentication:{salt,challenge}}}));
  socket.on('message',async raw=>{const packet=JSON.parse(raw.toString()),d=packet.d||{};if(packet.op===1){if(d.authentication!==sha(sha(password+salt)+challenge)){socket.close(4009,'Authentication failed');return;}socket.send(JSON.stringify({op:2,d:{negotiatedRpcVersion:1}}));return;}
   if(packet.op!==6)return;requests.push(clone(d));try{const responseData=await command(d.requestType,d.requestData||{});socket.send(JSON.stringify({op:7,d:{requestId:d.requestId,requestType:d.requestType,requestStatus:{result:true,code:100},responseData}}));}catch(e){socket.send(JSON.stringify({op:7,d:{requestId:d.requestId,requestType:d.requestType,requestStatus:{result:false,code:600,comment:e.message}}}));}
  });
 });
 return {port:server.address().port,scene,original,transform,requests,sources,inputs,password,intercept:(type,callback)=>hooks.set(type,callback),failNext:type=>{failOnce=type;},close:async()=>{for(const socket of server.clients)socket.terminate();await new Promise(resolve=>server.close(resolve));}};
}
module.exports={createOBSFixture};
