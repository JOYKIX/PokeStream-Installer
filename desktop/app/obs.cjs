const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const validId=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const sha=v=>createHash('sha256').update(v).digest('base64');
const sceneRef=s=>({sceneName:s.name,...(s.uuid?{sceneUuid:s.uuid}:{})});
const sourceRef=s=>({sourceName:s.name,...(s.uuid?{sourceUuid:s.uuid}:{})});
const geometry=e=>({id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,rotation:e.rotation,visible:e.visible});
function validGeometry(e){return validId(e?.id)&&['x','y','width','height','rotation'].every(k=>Number.isFinite(e[k]))&&e.width>=16&&e.width<=3840&&e.height>=16&&e.height<=2160&&Math.abs(e.x)<=3840&&Math.abs(e.y)<=2160&&Math.abs(e.rotation)<=180&&typeof e.visible==='boolean';}
function createOBS({directory,authorize,protect,unprotect,changed=()=>{}}){
 const file=path.join(directory,'connection.json');
 let settings={schema:1,port:4455,secret:'',enabled:false,bindings:[]},loaded=false,ws=null,epoch=0,retry=null,attempt=0,ready=null,collection='',canvas={width:1920,height:1080},status='disconnected',error='',mutating=false,flushing=false,rejectReady=null;
 const pending=new Map(),desired=new Map(),applied=new Map(),sessions=new Map(),closedSessions=new Set();let saveQueue=Promise.resolve();
 const notify=()=>{try{changed();}catch{}};
 async function load(){if(loaded)return;try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(saved.schema===1){settings={...settings,...saved,port:Number.isInteger(saved.port)&&saved.port>0&&saved.port<=65535?saved.port:4455,bindings:Array.isArray(saved.bindings)?saved.bindings.filter(b=>validId(b.ownerId)&&validId(b.overlayId)&&validId(b.elementId)&&validId(b.id)).slice(0,200):[]};}}catch(e){if(e.code!=='ENOENT')error='obs_settings_invalid';}loaded=true;}
 function save(){const data=JSON.stringify(settings,null,2);saveQueue=saveQueue.catch(()=>{}).then(async()=>{await fs.mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID();await fs.writeFile(temp,data,{mode:0o600});await fs.rename(temp,file);});return saveQueue;}
 async function context(id){if(id!==undefined&&!validId(id))throw Error('obs_invalid_layer');const c=await authorize(id);if(!validId(c?.ownerId))throw Error('obs_profile_required');if(id&&!c.overlay)throw Error('obs_overlay_missing');return c;}
 async function snapshot(overlayId){await load();const c=await context(overlayId);return {status,error,port:settings.port,hasPassword:!!settings.secret,collection,bindings:settings.bindings.filter(b=>b.ownerId===c.ownerId&&(!overlayId||b.overlayId===overlayId)).map(b=>({id:b.id,elementId:b.elementId,overlayId:b.overlayId,sceneName:b.scene.name,sourceName:b.source.name,collection:b.collection,error:b.error||'',active:status==='connected'&&b.collection===collection&&(!b.phase||b.phase==='active')}))};}
 function rejectPending(reason){for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(reason));}pending.clear();}
 function call(requestType,requestData={}){
  if(!ws||ws.readyState!==WebSocket.OPEN||status!=='connected')return Promise.reject(Error('obs_disconnected'));
  const requestId=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('obs_request_timeout'));},7000);pending.set(requestId,{resolve,reject,timer});try{ws.send(JSON.stringify({op:6,d:{requestType,requestId,requestData}}));}catch(e){pending.delete(requestId);clearTimeout(timer);reject(e);}});
 }
 async function refreshCollection(){const [scenes,video]=await Promise.all([call('GetSceneCollectionList'),call('GetVideoSettings')]);collection=scenes.currentSceneCollectionName;canvas={width:video.baseWidth,height:video.baseHeight};applied.clear();notify();}
 function scheduleReconnect(){if(!settings.enabled||retry)return;retry=setTimeout(()=>{retry=null;void connect().catch(()=>{});},Math.min(10000,500*2**Math.min(attempt++,5)));retry.unref?.();}
 function drop(){epoch++;clearTimeout(retry);retry=null;const old=ws;ws=null;ready=null;rejectReady?.(Error('obs_disconnected'));rejectReady=null;rejectPending('obs_disconnected');old?.close();desired.clear();applied.clear();}
 async function connect(options){
  await load();if(options){await context();if(options.port!==undefined&&(!Number.isInteger(options.port)||options.port<1||options.port>65535))throw Error('obs_invalid_port');settings.port=options.port??settings.port;if(options.password!==undefined){if(typeof options.password!=='string'||options.password.length>1024)throw Error('obs_invalid_password');settings.secret=options.password?protect(options.password):'';}settings.enabled=true;await save();}
  if(ready&&!options)return ready;drop();const generation=epoch;status='connecting';error='';notify();
  ready=new Promise((resolve,reject)=>{
   rejectReady=reject;let identified=false,settled=false;const socket=new WebSocket('ws://127.0.0.1:'+settings.port,'obswebsocket.json');ws=socket;
   const timeout=setTimeout(()=>{if(generation!==epoch)return;error='obs_connection_failed';socket.close();reject(Error(error));},8000);
   const fail=reason=>{if(generation!==epoch)return;clearTimeout(timeout);status='disconnected';error=reason;ready=null;rejectPending(reason);notify();if(!settled){settled=true;reject(Error(reason));}scheduleReconnect();};
   socket.addEventListener('message',event=>{if(generation!==epoch)return;try{
    if(typeof event.data!=='string'||event.data.length>2*1024*1024)throw Error('obs_invalid_response');
    const packet=JSON.parse(event.data),d=packet.d||{};
    if(packet.op===0){let authentication;try{if(d.authentication){const password=settings.secret?unprotect(settings.secret):'';authentication=sha(sha(password+d.authentication.salt)+d.authentication.challenge);}}catch{throw Error('obs_password_unavailable');}socket.send(JSON.stringify({op:1,d:{rpcVersion:1,eventSubscriptions:141,...(authentication?{authentication}:{})}}));}
    else if(packet.op===2){identified=true;status='connected';clearTimeout(timeout);attempt=0;void refreshCollection().then(()=>recoverBindings()).then(()=>{if(generation!==epoch)return;settled=true;rejectReady=null;resolve();notify();},e=>{error=e.message;socket.close();});}
    else if(packet.op===7){const p=pending.get(d.requestId);if(!p)return;pending.delete(d.requestId);clearTimeout(p.timer);if(d.requestStatus?.result)p.resolve(d.responseData||{});else p.reject(Object.assign(Error('obs_request_failed'),{code:d.requestStatus?.code,requestType:d.requestType}));}
    else if(packet.op===5){
     if(d.eventType==='CurrentSceneCollectionChanging'){collection='';desired.clear();applied.clear();notify();}
     if(d.eventType==='CurrentSceneCollectionChanged')void refreshCollection().catch(e=>{error=e.message;notify();});
     if(d.eventType==='SceneNameChanged'||d.eventType==='InputNameChanged'){for(const b of settings.bindings){if(b.collection!==collection)continue;if(d.eventType==='SceneNameChanged'){if(b.scene.uuid===d.eventData?.sceneUuid)b.scene.name=d.eventData.sceneName;if(b.container.uuid===d.eventData?.sceneUuid)b.container.name=d.eventData.sceneName;}else if(b.source.uuid===d.eventData?.inputUuid)b.source.name=d.eventData.inputName;}void save().catch(()=>{});}
     if(['SceneItemRemoved','SceneNameChanged','InputNameChanged','SceneListChanged'].includes(d.eventType))notify();
     if(d.eventType==='ExitStarted')socket.close();
    }
   }catch(e){error=e.message;socket.close();}});
   socket.addEventListener('close',event=>fail(event.code===4009?'obs_auth_failed':error||(!identified?'obs_connection_failed':'obs_disconnected')));
   socket.addEventListener('error',()=>{error=error||'obs_connection_failed';socket.close();});
  });return ready;
 }
 async function scenes(){await context();const result=await call('GetSceneList');return result.scenes.filter(s=>!s.sceneName.startsWith('PokeStream · ')).map(s=>({uuid:s.sceneUuid||'',name:s.sceneName}));}
 async function sources(scene){await context();if(!scene||typeof scene.name!=='string'||scene.name.length>200)throw Error('obs_invalid_scene');const result=await call('GetSceneItemList',sceneRef(scene));return result.sceneItems.filter(s=>!s.sourceName.startsWith('PokeStream · ')).map(s=>({id:s.sceneItemId,name:s.sourceName,uuid:s.sourceUuid||'',enabled:s.sceneItemEnabled,group:!!s.isGroup}));}
 async function bind(value){
  if(mutating)throw Error('obs_operation_busy');mutating=true;let created=null,copy=null,wrapper=null,original=null,oldEnabled=false,stored=null;
  try{
   const {overlayId,elementId,scene,itemId,box}=value,c=await context(overlayId),layer=c.overlay.elements.find(e=>e.id===elementId&&['game-screen','camera','chat'].includes(e.type));
   if(!layer||!validGeometry(box)||box.id!==elementId||!Number.isInteger(itemId))throw Error('obs_invalid_layer');
   if(settings.bindings.some(b=>b.ownerId===c.ownerId&&b.overlayId===overlayId&&b.elementId===elementId))throw Error('obs_already_linked');
   const all=await call('GetSceneList'),selectedScene=all.scenes.find(s=>scene.uuid?s.sceneUuid===scene.uuid:s.sceneName===scene.name);if(!selectedScene)throw Error('obs_scene_missing');
   const sceneInfo={uuid:selectedScene.sceneUuid||'',name:selectedScene.sceneName},ref=sceneRef(sceneInfo),items=await call('GetSceneItemList',ref);original=items.sceneItems.find(s=>s.sceneItemId===itemId);
   if(!original||original.sourceName.startsWith('PokeStream · '))throw Error('obs_source_missing');
   if(settings.bindings.some(b=>b.collection===collection&&(b.scene.uuid?b.scene.uuid===sceneInfo.uuid:b.scene.name===sceneInfo.name)&&b.originalItemId===itemId))throw Error('obs_source_already_linked');
   const sx=canvas.width/1920,sy=canvas.height/1080,left=Math.floor(box.x*sx),top=Math.floor(box.y*sy),right=Math.ceil((box.x+box.width)*sx),bottom=Math.ceil((box.y+box.height)*sy);
   if(left<0||top<0||right>canvas.width||bottom>canvas.height)throw Error('obs_layer_outside_canvas');
   oldEnabled=original.sceneItemEnabled;
   const name='PokeStream · '+overlayId.slice(0,8)+' · '+elementId.slice(0,8)+' · '+randomUUID().slice(0,8);
   const made=await call('CreateScene',{sceneName:name});created={uuid:made.sceneUuid||'',name};
   copy=await call('DuplicateSceneItem',{...ref,sceneItemId:itemId,destinationSceneName:name,...(created.uuid?{destinationSceneUuid:created.uuid}:{})});
   // The inner source is duplicated with its complete OBS transform. Never set its
   // crop, scale, size, input settings or filters: only its container will follow.
   await call('SetSceneItemEnabled',{...sceneRef(created),sceneItemId:copy.sceneItemId,sceneItemEnabled:true});
   wrapper=await call('CreateSceneItem',{...ref,...sourceRef(created),sceneItemEnabled:false});
   await call('SetSceneItemTransform',{...ref,sceneItemId:wrapper.sceneItemId,sceneItemTransform:{alignment:0,positionX:(box.x+box.width/2)*sx,positionY:(box.y+box.height/2)*sy,rotation:0,boundsType:'OBS_BOUNDS_STRETCH',boundsAlignment:0,boundsWidth:box.width*sx,boundsHeight:box.height*sy,cropLeft:left,cropTop:top,cropRight:canvas.width-right,cropBottom:canvas.height-bottom}});
   await call('SetSceneItemIndex',{...ref,sceneItemId:wrapper.sceneItemId,sceneItemIndex:original.sceneItemIndex+1});
   await call('SetSceneItemLocked',{...ref,sceneItemId:wrapper.sceneItemId,sceneItemLocked:true});
   stored={phase:'prepared',id:randomUUID(),ownerId:c.ownerId,overlayId,elementId,collection,scene:sceneInfo,source:{uuid:original.sourceUuid||'',name:original.sourceName},originalItemId:itemId,originalEnabled:oldEnabled,container:created,copyItemId:copy.sceneItemId,itemId:wrapper.sceneItemId,rotation:box.rotation,canvas:{...canvas},lastBox:geometry(box)};
   settings.bindings.push(stored);await save();
   await call('SetSceneItemEnabled',{...ref,sceneItemId:wrapper.sceneItemId,sceneItemEnabled:box.visible});
   await call('SetSceneItemEnabled',{...ref,sceneItemId:itemId,sceneItemEnabled:false});stored.phase='active';await save();
   applied.set(stored.id,JSON.stringify(geometry(box)));notify();return snapshot(overlayId);
  }catch(e){
   if(stored){stored.phase='rollback';stored.error=e.message;await save().catch(()=>{});try{await restoreBinding(stored);settings.bindings=settings.bindings.filter(b=>b!==stored);await save();}catch{notify();}}
   else if(created)await call('RemoveScene',sceneRef(created)).catch(()=>{});
   throw e;
  }finally{mutating=false;void flush();}
 }
 async function restoreBinding(b){
  const ref=sceneRef(b.scene),items=await call('GetSceneItemList',ref),original=items.sceneItems.find(i=>i.sceneItemId===b.originalItemId&&(b.source.uuid?i.sourceUuid===b.source.uuid:i.sourceName===b.source.name));
  if(!original)throw Error('obs_original_missing');
  if(items.sceneItems.some(i=>i.sceneItemId===b.itemId))await call('SetSceneItemEnabled',{...ref,sceneItemId:b.itemId,sceneItemEnabled:false});
  await call('SetSceneItemEnabled',{...ref,sceneItemId:b.originalItemId,sceneItemEnabled:b.originalEnabled});
  if(items.sceneItems.some(i=>i.sceneItemId===b.itemId))await call('RemoveSceneItem',{...ref,sceneItemId:b.itemId});
  const scenes=await call('GetSceneList'),container=scenes.scenes.find(s=>b.container.uuid?s.sceneUuid===b.container.uuid:s.sceneName===b.container.name);if(!container)return;
  const inside=await call('GetSceneItemList',sceneRef(b.container));if(inside.sceneItems.some(i=>i.sceneItemId!==b.copyItemId))return;
  for(const scene of scenes.scenes){if(scene.sceneName===b.container.name)continue;const list=await call('GetSceneItemList',{sceneName:scene.sceneName,...(scene.sceneUuid?{sceneUuid:scene.sceneUuid}:{})});if(list.sceneItems.some(i=>b.container.uuid?i.sourceUuid===b.container.uuid:i.sourceName===b.container.name))return;}
  await call('RemoveScene',sceneRef(b.container));
 }
 async function recoverBindings(){
  let updated=false;for(const b of [...settings.bindings])if(b.collection===collection&&b.phase&&b.phase!=='active'){
   try{await restoreBinding(b);settings.bindings=settings.bindings.filter(item=>item!==b);updated=true;}catch(e){b.error=e.message;}
  }if(updated)await save();notify();
 }
 async function unlink(value){
  if(mutating)throw Error('obs_operation_busy');mutating=true;
  try{const c=await context(value.overlayId),b=settings.bindings.find(b=>b.id===value.bindingId&&b.ownerId===c.ownerId&&b.overlayId===value.overlayId);if(!b)throw Error('obs_link_missing');if(b.collection!==collection)throw Error('obs_collection_mismatch');b.phase='unlinking';await save();
   await restoreBinding(b);settings.bindings=settings.bindings.filter(item=>item!==b);desired.delete(b.id);applied.delete(b.id);await save();notify();return snapshot(value.overlayId);
  }finally{mutating=false;void flush();}
 }
 async function flush(){
  if(flushing||mutating)return;flushing=true;
  try{while(desired.size&&status==='connected'){
   const [id,box]=desired.entries().next().value;desired.delete(id);const b=settings.bindings.find(b=>b.id===id);if(!b||b.collection!==collection||b.phase&&b.phase!=='active')continue;
   const signature=JSON.stringify(box);if(applied.get(id)===signature)continue;
   try{const owner=await context(b.overlayId);if(owner.ownerId!==b.ownerId)continue;const sx=canvas.width/1920,sy=canvas.height/1080;await call('SetSceneItemTransform',{...sceneRef(b.scene),sceneItemId:b.itemId,sceneItemTransform:{positionX:(box.x+box.width/2)*sx,positionY:(box.y+box.height/2)*sy,boundsWidth:box.width*sx,boundsHeight:box.height*sy,rotation:box.rotation-b.rotation}});
    if(b.lastBox?.visible!==box.visible)await call('SetSceneItemEnabled',{...sceneRef(b.scene),sceneItemId:b.itemId,sceneItemEnabled:box.visible});
    b.lastBox=box;applied.set(id,signature);if(b.error){delete b.error;notify();}
   }catch(e){b.error=e.message;notify();}
  }}finally{flushing=false;}
 }
 async function sync(value){const c=await context(value.overlayId);if(value.session){if(!validId(value.session)||!Number.isSafeInteger(value.sequence)||value.sequence<0)throw Error('obs_invalid_layer');if(closedSessions.has(value.session))return false;const previous=sessions.get(value.overlayId);if(previous?.session===value.session&&previous.sequence>=value.sequence)return false;sessions.set(value.overlayId,{session:value.session,sequence:value.sequence});}if(!Array.isArray(value.elements)||value.elements.length>60||value.elements.some(e=>!validGeometry(e)))throw Error('obs_invalid_layer');for(const b of settings.bindings.filter(b=>b.ownerId===c.ownerId&&b.overlayId===value.overlayId)){const box=value.elements.find(e=>e.id===b.elementId);if(box)desired.set(b.id,geometry(box));else if(b.lastBox)desired.set(b.id,{...b.lastBox,visible:false});}void flush();return true;}
 async function dispatch(action,value={}){await load();switch(action){case 'state':return snapshot(value.overlayId);case 'connect':await connect(value);return snapshot(value.overlayId);case 'disconnect':await context();settings.enabled=false;drop();status='disconnected';error='';await save();notify();return snapshot(value.overlayId);case 'scenes':return scenes();case 'sources':return sources(value.scene);case 'bind':return bind(value);case 'unlink':return unlink(value);case 'sync':return sync(value);case 'revert':{if(value.session){if(!validId(value.session))throw Error('obs_invalid_layer');closedSessions.add(value.session);if(closedSessions.size>512)closedSessions.delete(closedSessions.values().next().value);}const c=await context(value.overlayId),active=sessions.get(value.overlayId);if(value.session&&active&&active.session!==value.session)return false;sessions.delete(value.overlayId);return sync({overlayId:value.overlayId,elements:c.overlay.elements.filter(e=>['game-screen','camera','chat'].includes(e.type)).map(geometry)});}default:throw Error('obs_unknown_action');}}
 return {dispatch,start:async()=>{await load();if(settings.enabled)await connect();},close:()=>{settings.enabled=false;drop();}};
}
module.exports={createOBS};
