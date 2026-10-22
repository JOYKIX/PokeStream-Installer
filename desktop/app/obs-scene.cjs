const {randomUUID}=require('node:crypto');
const sceneRef=s=>({sceneName:s.name,...(s.uuid?{sceneUuid:s.uuid}:{})});
const external=e=>['game-screen','camera','chat'].includes(e.type);
/** Creates a separate OBS scene. Original scene items and input settings are never modified. */
function createSceneBuilder({call,context,getSettings,getCanvas,save,notify}){
 async function ownedRemove(job){
  if(job.collection!==getCanvas().collection)throw Error('obs_collection_mismatch');
  const all=await call('GetSceneList');for(const ref of job.scenes)if(!ref.failed&&!ref.uuid&&!ref.name.startsWith('PokeStream · '+job.id.slice(0,8))&&all.scenes.some(s=>s.sceneName===ref.name))throw Error('obs_cleanup_required');
  const existing=job.scenes.filter(ref=>!ref.failed).map(ref=>all.scenes.find(s=>ref.uuid?s.sceneUuid===ref.uuid:s.sceneName===ref.name)).filter(Boolean),seenInputs=new Set();
  const ids=new Set(existing.map(s=>s.sceneUuid));
  // Leave a recovered scene intact if someone added sources after the interruption.
  for(const scene of existing){const result=await call('GetSceneItemList',{sceneName:scene.sceneName,...(scene.sceneUuid?{sceneUuid:scene.sceneUuid}:{})});for(const item of result.sceneItems)seenInputs.add(item.sourceName);if(result.sceneItems.some(i=>!job.allowedSources.includes(i.sourceUuid)&&!job.allowedNames.includes(i.sourceName)&&!ids.has(i.sourceUuid)))throw Error('obs_cleanup_required');}
  // A nested scene may have been reused elsewhere since the interruption.
  for(const scene of all.scenes.filter(s=>!ids.has(s.sceneUuid))){const result=await call('GetSceneItemList',{sceneName:scene.sceneName,...(scene.sceneUuid?{sceneUuid:scene.sceneUuid}:{})});if(result.sceneItems.some(i=>ids.has(i.sourceUuid)||i.sourceUuid===job.input?.uuid||i.sourceName===job.input?.name))throw Error('obs_cleanup_required');}
  for(const scene of existing)await call('RemoveScene',{sceneName:scene.sceneName,...(scene.sceneUuid?{sceneUuid:scene.sceneUuid}:{})});
  if(job.input&&!job.input.failed&&(job.input.uuid||seenInputs.has(job.input.name)))try{await call('RemoveInput',{inputName:job.input.name,...(job.input.uuid?{inputUuid:job.input.uuid}:{})});}catch(e){if(e.code!==600)throw e;}
 }
 async function recover(){const settings=getSettings();let changed=false;for(const job of [...(settings.sceneJobs??[])]){if(job.collection!==getCanvas().collection)continue;try{await ownedRemove(job);settings.sceneJobs=settings.sceneJobs.filter(j=>j.id!==job.id);changed=true;}catch(e){job.error=e.message;}}if(changed)await save();notify();}
 async function create(value){
  const c=await context(value.overlayId),data=c.overlay,settings=getSettings(),{width,height,collection}=getCanvas();
  if(!c.enabled||!c.viewToken)throw Error('obs_overlay_disabled');
  if(typeof value.name!=='string'||!value.name.trim()||value.name.length>80||!Array.isArray(value.mappings)||value.mappings.length>60)throw Error('obs_invalid_layer');
  const layers=data.elements.filter(external).filter(e=>e.visible);
  if(value.mappings.length!==layers.length||new Set(value.mappings.map(m=>m.elementId)).size!==layers.length)throw Error('obs_invalid_layer');
  if(layers.some(e=>e.x<0||e.y<0||e.x+e.width>1920||e.y+e.height>1080))throw Error('obs_layer_outside_canvas');
  const all=await call('GetSceneList'),name=value.name.trim();if(all.scenes.some(s=>s.sceneName===name))throw Error('obs_scene_name_used');
  const kinds=await call('GetInputKindList');if(!kinds.inputKinds.includes('browser_source'))throw Error('obs_browser_unavailable');
  const selected=[];
  for(const layer of layers){const m=value.mappings.find(m=>m.elementId===layer.id),scene=all.scenes.find(s=>m?.scene?.uuid?s.sceneUuid===m.scene.uuid:s.sceneName===m?.scene?.name);if(!scene||!Number.isInteger(m.itemId))throw Error('obs_source_missing');const ref={name:scene.sceneName,uuid:scene.sceneUuid||''},list=await call('GetSceneItemList',sceneRef(ref)),item=list.sceneItems.find(i=>i.sceneItemId===m.itemId);if(!item||item.sourceName.startsWith('PokeStream · '))throw Error('obs_source_missing');selected.push({layer,ref,item});}
  const job={id:randomUUID(),collection,scenes:[],allowedSources:selected.map(s=>s.item.sourceUuid).filter(Boolean),allowedNames:selected.map(s=>s.item.sourceName),input:null},bindings=[];
  settings.sceneJobs??=[];if(settings.sceneJobs.length>=20)throw Error('obs_cleanup_required');settings.sceneJobs.push(job);await save();
  async function makeScene(name){const ref={name,uuid:''};job.scenes.push(ref);job.allowedNames.push(name);await save();let made;try{made=await call('CreateScene',{sceneName:name});}catch(error){if(error.code!==undefined){ref.failed=true;await save();}throw error;}ref.uuid=made.sceneUuid||'';if(ref.uuid)job.allowedSources.push(ref.uuid);await save();return ref;}
  try{
   const target=await makeScene(name),sx=width/1920,sy=height/1080;
   for(const {layer,ref,item} of selected.toSorted((a,b)=>a.layer.zIndex-b.layer.zIndex)){
    const container=await makeScene('PokeStream · '+job.id.slice(0,8)+' · '+layer.id.slice(0,8));
    const copy=await call('DuplicateSceneItem',{...sceneRef(ref),sceneItemId:item.sceneItemId,destinationSceneName:container.name,...(container.uuid?{destinationSceneUuid:container.uuid}:{})});
    const {sceneItemTransform:t}=await call('GetSceneItemTransform',{...sceneRef(container),sceneItemId:copy.sceneItemId});
    if(!t.sourceWidth||!t.sourceHeight)throw Error('obs_source_not_ready');
    // Normalize only the new copy. Keep crop, mirroring, filters and the original item intact.
    let cw=Math.max(1,(t.sourceWidth-t.cropLeft-t.cropRight)*Math.abs(t.scaleX)),ch=Math.max(1,(t.sourceHeight-t.cropTop-t.cropBottom)*Math.abs(t.scaleY));
    if(t.boundsType==='OBS_BOUNDS_STRETCH'&&t.boundsWidth>0&&t.boundsHeight>0){cw=t.boundsWidth;ch=t.boundsHeight;}
    const angle=(t.rotation||0)*Math.PI/180,cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle)),factor=Math.min(width/(cw*cos+ch*sin),height/(cw*sin+ch*cos)),bw=cw*factor,bh=ch*factor,boxW=Math.min(width,Math.ceil(bw*cos+bh*sin)),boxH=Math.min(height,Math.ceil(bw*sin+bh*cos)),left=Math.floor((width-boxW)/2),top=Math.floor((height-boxH)/2);
    await call('SetSceneItemTransform',{...sceneRef(container),sceneItemId:copy.sceneItemId,sceneItemTransform:{alignment:0,positionX:width/2,positionY:height/2,boundsType:'OBS_BOUNDS_STRETCH',boundsAlignment:0,boundsWidth:bw,boundsHeight:bh}});
    await call('SetSceneItemEnabled',{...sceneRef(container),sceneItemId:copy.sceneItemId,sceneItemEnabled:true});
    const added=await call('CreateSceneItem',{...sceneRef(target),sourceName:container.name,...(container.uuid?{sourceUuid:container.uuid}:{}),sceneItemEnabled:layer.visible});
    await call('SetSceneItemTransform',{...sceneRef(target),sceneItemId:added.sceneItemId,sceneItemTransform:{alignment:0,positionX:(layer.x+layer.width/2)*sx,positionY:(layer.y+layer.height/2)*sy,rotation:layer.rotation,boundsType:'OBS_BOUNDS_STRETCH',boundsAlignment:0,boundsWidth:layer.width*sx,boundsHeight:layer.height*sy,cropLeft:left,cropTop:top,cropRight:width-left-boxW,cropBottom:height-top-boxH}});
    await call('SetSceneItemLocked',{...sceneRef(target),sceneItemId:added.sceneItemId,sceneItemLocked:true});
    bindings.push({phase:'active',id:randomUUID(),ownerId:c.ownerId,overlayId:value.overlayId,elementId:layer.id,collection,scene:target,source:{uuid:item.sourceUuid||'',name:item.sourceName},generated:true,originalItemId:item.sceneItemId,originalScene:ref,container,copyItemId:copy.sceneItemId,itemId:added.sceneItemId,rotation:0,canvas:{width,height},lastBox:{id:layer.id,x:layer.x,y:layer.y,width:layer.width,height:layer.height,rotation:layer.rotation,visible:layer.visible,zIndex:layer.zIndex}});
   }
   const inputName='PokeStream · Overlay · '+job.id.slice(0,8);job.input={name:inputName,uuid:''};job.allowedNames.push(inputName);await save();
   const locale=['en','fr','es','de','ja','pt-BR','it','ko','zh-CN','zh-TW'].includes(value.locale)?value.locale:'en',browser=await call('CreateInput',{...sceneRef(target),inputName,inputKind:'browser_source',inputSettings:{url:'http://127.0.0.1:47653/builder/obs/'+c.viewToken+'?lang='+locale,width:1920,height:1080,shutdown:false,restart_when_active:false},sceneItemEnabled:true});
   job.input.uuid=browser.inputUuid||'';if(job.input.uuid)job.allowedSources.push(job.input.uuid);await save();
   await call('SetSceneItemTransform',{...sceneRef(target),sceneItemId:browser.sceneItemId,sceneItemTransform:{alignment:5,positionX:0,positionY:0,boundsType:'OBS_BOUNDS_STRETCH',boundsWidth:width,boundsHeight:height}});
   settings.bindings.push(...bindings);settings.sceneJobs=settings.sceneJobs.filter(j=>j.id!==job.id);await save();notify();return {sceneName:target.name,sceneUuid:target.uuid};
  }catch(error){settings.bindings=settings.bindings.filter(b=>!bindings.some(created=>created.id===b.id));if(!settings.sceneJobs.some(j=>j.id===job.id))settings.sceneJobs.push(job);try{await ownedRemove(job);settings.sceneJobs=settings.sceneJobs.filter(j=>j.id!==job.id);settings.bindings=settings.bindings.filter(b=>!bindings.some(created=>created.id===b.id));await save();}catch(cleanup){job.error=cleanup.message;await save().catch(()=>{});notify();}throw error;}
 }
 return {create,recover};
}
module.exports={createSceneBuilder};
