const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pokeStream',Object.freeze({
 desktop:true,
 language:{get:()=>ipcRenderer.invoke('pokestream:language:get'),set:value=>ipcRenderer.invoke('pokestream:language:set',value)},
 openData:()=>ipcRenderer.invoke('pokestream:open-data'),
 openLauncher:()=>ipcRenderer.invoke('pokestream:launcher:open'),
 launcher:{uninstall:options=>ipcRenderer.invoke('pokestream:launcher:uninstall',options),state:()=>ipcRenderer.invoke('pokestream:launcher:state'),action:action=>ipcRenderer.invoke('pokestream:launcher:action',action),
  subscribe:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('pokestream:launcher:state',listener);return()=>ipcRenderer.removeListener('pokestream:launcher:state',listener);}},
 updates:{check:()=>ipcRenderer.invoke('pokestream:updates:check'),download:()=>ipcRenderer.invoke('pokestream:updates:download'),install:()=>ipcRenderer.invoke('pokestream:updates:install')}
}));
