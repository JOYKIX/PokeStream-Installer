const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("pokeStream",{desktop:true,openData:()=>ipcRenderer.invoke("pokestream:open-data"),updates:{check:()=>ipcRenderer.invoke("pokestream:updates:check"),download:()=>ipcRenderer.invoke("pokestream:updates:download"),install:()=>ipcRenderer.invoke("pokestream:updates:install")}});
