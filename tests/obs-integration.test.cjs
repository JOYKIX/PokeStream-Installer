const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto');
const {createOBS}=require('../desktop/app/obs.cjs'),{createOBSFixture}=require('./fixtures/obs-server.cjs');
const waitFor=async predicate=>{const deadline=Date.now()+3000;while(!predicate()){if(Date.now()>deadline)throw Error('OBS update did not arrive');await new Promise(r=>setTimeout(r,10));}};
test('OBS linkage preserves original framing, follows layer geometry and restores the source',async()=>{
 const fixture=await createOBSFixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'pokestream-obs-')),ownerId=randomUUID(),overlayId=randomUUID(),elementId=randomUUID();
 const box={id:elementId,x:100,y:60,width:640,height:480,rotation:0,visible:true},overlay={elements:[{...box,type:'game-screen'}]};
 const options={directory,authorize:async()=>({ownerId,overlay}),protect:value=>Buffer.from('encrypted:'+value).toString('base64'),unprotect:value=>Buffer.from(value,'base64').toString().slice(10)};const obs=createOBS(options);
 try{
  await obs.dispatch('connect',{port:fixture.port,password:fixture.password});await obs.dispatch('mode',{overlayId,realtime:true});
  const scenes=await obs.dispatch('scenes');assert.equal(scenes[0].name,'Pokémon');
  const state=await obs.dispatch('bind',{overlayId,elementId,scene:fixture.scene,itemId:7,box});assert.equal(state.bindings.length,1);assert.equal(state.bindings[0].sourceName,'EcranHaut');assert.equal(state.hasPassword,true);assert.equal('secret' in state,false);
  assert.deepEqual(fixture.original.sceneItemTransform,fixture.transform);
  const container=[...fixture.sources.values()].find(s=>s.uuid!==fixture.scene.uuid);assert.equal(container.items.length,1);assert.deepEqual(container.items[0].sceneItemTransform,fixture.transform);
  const parent=fixture.sources.get(fixture.scene.uuid).items.find(i=>i.sourceUuid===container.uuid);assert.ok(parent);assert.equal(fixture.original.sceneItemEnabled,false);const initialCrop={cropLeft:parent.sceneItemTransform.cropLeft,cropTop:parent.sceneItemTransform.cropTop,cropRight:parent.sceneItemTransform.cropRight,cropBottom:parent.sceneItemTransform.cropBottom};
  for(let x=110;x<=300;x+=10)await obs.dispatch('sync',{overlayId,elements:[{...box,x,width:720,height:540}]});
  await waitFor(()=>Math.abs(parent.sceneItemTransform.positionX-((300+360)*2560/1920))<0.001);
  assert.equal(parent.sceneItemTransform.boundsWidth,960);assert.deepEqual({cropLeft:parent.sceneItemTransform.cropLeft,cropTop:parent.sceneItemTransform.cropTop,cropRight:parent.sceneItemTransform.cropRight,cropBottom:parent.sceneItemTransform.cropBottom},initialCrop);assert.deepEqual(fixture.original.sceneItemTransform,fixture.transform);assert.deepEqual(container.items[0].sceneItemTransform,fixture.transform);
  assert.ok(fixture.requests.filter(r=>r.requestType==='SetSceneItemTransform').every(r=>r.requestData.sceneItemId===parent.sceneItemId));
  const count=fixture.requests.length;await obs.dispatch('sync',{overlayId,elements:[{...box,x:300,width:720,height:540}]});await new Promise(r=>setTimeout(r,60));assert.equal(fixture.requests.length,count,'unchanged geometry must send no OBS request');
  await obs.dispatch('unlink',{overlayId,bindingId:state.bindings[0].id});assert.equal(fixture.sources.size,1);assert.equal(fixture.original.sceneItemEnabled,true);assert.deepEqual(fixture.original.sceneItemTransform,fixture.transform);
 }finally{obs.close();await fixture.close();await fs.rm(directory,{recursive:true,force:true});}
});
test('failed OBS linkage restores the original source and leaves no partial container',async()=>{
 const fixture=await createOBSFixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'pokestream-obs-')),ownerId=randomUUID(),overlayId=randomUUID(),elementId=randomUUID(),box={id:elementId,x:0,y:0,width:640,height:480,rotation:0,visible:true};const obs=createOBS({directory,authorize:async()=>({ownerId,overlay:{elements:[{...box,type:'camera'}]}}),protect:v=>v,unprotect:v=>v});
 try{await obs.dispatch('connect',{port:fixture.port,password:fixture.password});await obs.dispatch('mode',{overlayId,realtime:true});fixture.failNext('SetSceneItemLocked');await assert.rejects(obs.dispatch('bind',{overlayId,elementId,scene:fixture.scene,itemId:7,box}));assert.equal(fixture.sources.size,1);assert.equal(fixture.original.sceneItemEnabled,true);assert.deepEqual(fixture.original.sceneItemTransform,fixture.transform);assert.equal((await obs.dispatch('state',{overlayId})).bindings.length,0);}
 finally{obs.close();await fixture.close();await fs.rm(directory,{recursive:true,force:true});}
});


test('reconnect preserves bindings, stale editor messages are ignored and interrupted links recover',async()=>{
 const fixture=await createOBSFixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'pokestream-obs-')),ownerId=randomUUID(),overlayId=randomUUID(),elementId=randomUUID(),session=randomUUID(),box={id:elementId,x:100,y:60,width:640,height:480,rotation:0,visible:true};
 const options={directory,authorize:async()=>({ownerId,overlay:{elements:[{...box,type:'chat'}]}}),protect:v=>Buffer.from(v).toString('base64'),unprotect:v=>Buffer.from(v,'base64').toString()};let obs=createOBS(options);
 try{
  await obs.dispatch('connect',{port:fixture.port,password:fixture.password});await obs.dispatch('mode',{overlayId,realtime:true});const state=await obs.dispatch('bind',{overlayId,elementId,scene:fixture.scene,itemId:7,box});obs.close();
  obs=createOBS(options);await obs.start();assert.equal((await obs.dispatch('state',{overlayId})).bindings[0].id,state.bindings[0].id);
  const container=[...fixture.sources.values()].find(s=>s.uuid!==fixture.scene.uuid),parent=fixture.sources.get(fixture.scene.uuid).items.find(i=>i.sourceUuid===container.uuid);
  await obs.dispatch('sync',{overlayId,session,sequence:2,elements:[{...box,x:300}]});await waitFor(()=>Math.abs(parent.sceneItemTransform.positionX-(300+320)*2560/1920)<0.001);
  const count=fixture.requests.length;assert.equal(await obs.dispatch('sync',{overlayId,session,sequence:1,elements:[{...box,x:200}]}),false);assert.equal(fixture.requests.length,count);
  await obs.dispatch('revert',{overlayId,session});await waitFor(()=>Math.abs(parent.sceneItemTransform.positionX-(100+320)*2560/1920)<0.001);assert.equal(await obs.dispatch('sync',{overlayId,session,sequence:3,elements:[{...box,x:400}]}),false);
  obs.close();const file=path.join(directory,'connection.json'),saved=JSON.parse(await fs.readFile(file,'utf8'));saved.bindings[0].phase='prepared';await fs.writeFile(file,JSON.stringify(saved));
  obs=createOBS(options);await obs.start();assert.equal((await obs.dispatch('state',{overlayId})).bindings.length,0);assert.equal(fixture.sources.size,1);assert.equal(fixture.original.sceneItemEnabled,true);assert.deepEqual(fixture.original.sceneItemTransform,fixture.transform);
 }finally{obs.close();await fixture.close();await fs.rm(directory,{recursive:true,force:true});}
});

test('OBS geometry waits for saving by default; real-time mode is optional and persists',async()=>{
 const fixture=await createOBSFixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'pokestream-obs-')),ownerId=randomUUID(),overlayId=randomUUID(),elementId=randomUUID(),box={id:elementId,x:100,y:60,width:640,height:480,rotation:0,visible:true},overlay={elements:[{...box,type:'game-screen'}]};const obs=createOBS({directory,authorize:async()=>({ownerId,overlay}),protect:v=>v,unprotect:v=>v});
 try{await obs.dispatch('connect',{port:fixture.port,password:fixture.password});assert.equal((await obs.dispatch('state',{overlayId})).realtime,false);await obs.dispatch('bind',{overlayId,elementId,scene:fixture.scene,itemId:7,box});const parent=fixture.sources.get(fixture.scene.uuid).items.find(i=>i.sceneItemId!==7),before=fixture.requests.length;assert.equal(await obs.dispatch('sync',{overlayId,elements:[{...box,x:500}]}),false);assert.equal(fixture.requests.length,before);overlay.elements[0].x=300;await obs.dispatch('apply',{overlayId});await waitFor(()=>Math.abs(parent.sceneItemTransform.positionX-(300+320)*2560/1920)<.001);await obs.dispatch('mode',{overlayId,realtime:true});await obs.dispatch('sync',{overlayId,elements:[{...box,x:500}]});await waitFor(()=>Math.abs(parent.sceneItemTransform.positionX-(500+320)*2560/1920)<.001);await obs.dispatch('mode',{overlayId,realtime:false});await waitFor(()=>Math.abs(parent.sceneItemTransform.positionX-(300+320)*2560/1920)<.001);assert.equal((await obs.dispatch('state',{overlayId})).realtime,false);}
 finally{obs.close();await fixture.close();await fs.rm(directory,{recursive:true,force:true});}
});
for(const failure of [false,true])test(failure?'automatic scene creation rolls back new resources on failure':'automatic OBS composition creates overlay, captures and links without changing original scenes',async()=>{
 const fixture=await createOBSFixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'pokestream-obs-')),ownerId=randomUUID(),overlayId=randomUUID(),elementId=randomUUID(),viewToken=randomUUID(),layer={id:elementId,type:'camera',x:100,y:60,width:640,height:480,rotation:0,zIndex:0,visible:true},overlay={elements:[layer]};const obs=createOBS({directory,authorize:async()=>({ownerId,overlay,viewToken,enabled:true}),protect:v=>v,unprotect:v=>v});
 try{await obs.dispatch('connect',{port:fixture.port,password:fixture.password});if(failure)fixture.failNext('CreateInput');const request=()=>obs.dispatch('create-scene',{overlayId,name:'Generated scene',locale:'fr',mappings:[{elementId,scene:fixture.scene,itemId:7}]});if(failure){await assert.rejects(request());assert.equal(fixture.sources.size,1);assert.equal((await obs.dispatch('state',{overlayId})).bindings.length,0);}else{const result=await request();assert.equal(result.sceneName,'Generated scene');const target=fixture.sources.get(result.sceneUuid);assert.equal(target.items.length,2);assert.equal(fixture.inputs.size,1);const browser=[...fixture.inputs.values()][0];assert.ok(browser.settings.url.includes('/builder/obs/'+viewToken));assert.equal(browser.settings.width,1920);assert.equal(browser.settings.height,1080);const binding=(await obs.dispatch('state',{overlayId})).bindings[0];assert.equal(binding.active,true);const copy=[...fixture.sources.values()].find(s=>s.uuid!==fixture.scene.uuid&&s.uuid!==result.sceneUuid).items[0];for(const key of ['cropLeft','cropRight','cropTop','cropBottom','scaleX','scaleY'])assert.equal(copy.sceneItemTransform[key],fixture.transform[key]);await obs.dispatch('unlink',{overlayId,bindingId:binding.id});assert.equal(fixture.sources.size,2);}
 assert.deepEqual(fixture.original.sceneItemTransform,fixture.transform);assert.equal(fixture.original.sceneItemEnabled,true);assert.ok(!fixture.requests.some(r=>r.requestType==='SetCurrentProgramScene'));assert.ok(!fixture.requests.some(r=>r.requestType==='SetSceneItemTransform'&&r.requestData.sceneUuid===fixture.scene.uuid));}
 finally{obs.close();await fixture.close();await fs.rm(directory,{recursive:true,force:true});}
});

test('a scene created concurrently by the user is never removed during rollback',async()=>{
 const fixture=await createOBSFixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'pokestream-obs-')),ownerId=randomUUID(),overlayId=randomUUID(),viewToken=randomUUID(),userScene={uuid:randomUUID(),name:'Concurrent scene',items:[]};const obs=createOBS({directory,authorize:async()=>({ownerId,overlay:{elements:[]},viewToken,enabled:true}),protect:v=>v,unprotect:v=>v});
 try{await obs.dispatch('connect',{port:fixture.port,password:fixture.password});fixture.intercept('CreateScene',()=>{fixture.sources.set(userScene.uuid,userScene);throw Error('Scene already exists');});await assert.rejects(obs.dispatch('create-scene',{overlayId,name:userScene.name,mappings:[]}));assert.equal(fixture.sources.get(userScene.uuid),userScene);assert.equal(fixture.sources.size,2);assert.deepEqual(fixture.original.sceneItemTransform,fixture.transform);}
 finally{obs.close();await fixture.close();await fs.rm(directory,{recursive:true,force:true});}
});
