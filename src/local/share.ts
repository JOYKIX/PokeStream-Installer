import "server-only";
import { randomUUID } from "node:crypto";
import { sceneSchema } from "@/lib/model";
import { themeInputSchema } from "@/themes/custom/schema";
import { builderSchema } from "@/builder/schema";
import { readStore, transact, type Store, type Asset } from "./store";
import { assetBytes, saveAsset, removeAssetFiles } from "./assets";

export type CreationKind = "scene" | "theme" | "builder";
const types = ["scene", "theme", "builder"] as const;
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_BUNDLE = 48 * 1024 * 1024;

type Resource<T> = { sourceId: string; data: T };
type EmbeddedImage = { sourceId: string; name: string; width: number; height: number; png: string };
type Bundle = {
  format: "pokestream.creation";
  version: 1;
  exportedAt: string;
  kind: CreationKind;
  scene?: Resource<unknown>;
  theme?: Resource<unknown>;
  builder?: Resource<unknown>;
  dependencies: { scenes: Resource<unknown>[]; themes: Resource<unknown>[]; images: EmbeddedImage[] };
};

function requireResource(state: Store, kind: CreationKind, id: string, owner: string) {
  const table = kind === "scene" ? "scenes" : kind === "theme" ? "custom_themes" : "builder_overlays";
  const row = state.tables[table].find(r => r.id === id && r.owner_id === owner);
  if (!row) throw new Error("Création introuvable pour ce profil.");
  return row;
}

export function creationList(owner: string) {
  const store = readStore();
  return {
    scenes: store.tables.scenes.filter(r => r.owner_id === owner).map(r => ({ id:r.id, name:r.data.name })),
    themes: store.tables.custom_themes.filter(r => r.owner_id === owner).map(r => ({ id:r.id, name:r.name })),
    builders: store.tables.builder_overlays.filter(r => r.owner_id === owner).map(r => ({ id:r.id, name:r.data.name })),
    users: store.users.filter(u => u.id !== owner).map(u => ({ id:u.id, name:u.name, color:u.color })),
  };
}

export async function exportCreation(kind: CreationKind, id: string, owner: string): Promise<Bundle> {
  if (!types.includes(kind)) throw new Error("Type de création inconnu.");
  const state = readStore();
  requireResource(state, kind, id, owner);
  const scenes = new Map<string, Resource<unknown>>();
  const themes = new Map<string, Resource<unknown>>();
  const images = new Map<string, EmbeddedImage>();
  function includeTheme(themeId?: string | null) {
    if (!themeId || themes.has(themeId)) return;
    const theme = state.tables.custom_themes.find(t => t.id === themeId && t.owner_id === owner);
    if (!theme) throw new Error("Thème personnalisé associé introuvable.");
    themes.set(themeId, { sourceId: themeId, data: { name: theme.name, config: theme.config } });
  }
  function includeScene(sceneId?: string | null) {
    if (!sceneId || scenes.has(sceneId)) return;
    const scene = state.tables.scenes.find(s => s.id === sceneId && s.owner_id === owner);
    if (!scene) throw new Error("Aventure associée introuvable.");
    scenes.set(sceneId, { sourceId: sceneId, data: scene.data });
    includeTheme(scene.data.style.customThemeId);
  }
  const bundle:Bundle = { format:"pokestream.creation", version:1, exportedAt:new Date().toISOString(), kind,
    dependencies:{ scenes:[], themes:[], images:[] } };
  if (kind === "scene") { includeScene(id); bundle.scene = scenes.get(id); scenes.delete(id); }
  if (kind === "theme") { includeTheme(id); bundle.theme = themes.get(id); themes.delete(id); }
  if (kind === "builder") {
    const row = requireResource(state,kind,id,owner) as Store["tables"]["builder_overlays"][number];
    bundle.builder = {sourceId:id,data:row.data};
    includeScene(row.data.sceneId);
    includeTheme(row.data.theme.customId);
    for(const element of row.data.elements) {
      includeTheme(element.themeOverride?.customId);
      if(element.type !== "image" || !element.properties.assetId)continue;
      const imageId=element.properties.assetId;
      if(images.has(imageId)) continue;
      const asset=state.tables.builder_assets.find(a => a.id === imageId && a.owner_id === owner && a.ready);
      if(!asset)throw new Error("Image de composition manquante.");
      const bytes=await assetBytes(imageId);
      if(bytes.byteLength>MAX_IMAGE)throw new Error("Image trop volumineuse pour l'export.");
      images.set(imageId,{sourceId:imageId,name:asset.name,width:asset.width,height:asset.height,png:bytes.toString("base64")});
    }
  }
  bundle.dependencies = {scenes:[...scenes.values()],themes:[...themes.values()],images:[...images.values()]};
  if(Buffer.byteLength(JSON.stringify(bundle))>MAX_BUNDLE)throw new Error("Création trop volumineuse pour l'export.");
  return bundle;
}

export async function importCreation(input: unknown, owner: string) {
  if(!input || typeof input !== "object")throw new Error("Fichier invalide.");
  const raw=input as Partial<Bundle>;
  if(raw.format !== "pokestream.creation" || raw.version !== 1 || !types.includes(raw.kind as CreationKind))
    throw new Error("Format ou version de fichier non pris en charge.");
  if(!raw.dependencies || !Array.isArray(raw.dependencies.scenes) || !Array.isArray(raw.dependencies.themes) || !Array.isArray(raw.dependencies.images))
    throw new Error("Dépendances du fichier invalides.");
  const collection=(array:Resource<unknown>[]) => {
    if(array.length>50)throw new Error("Trop de dépendances.");
    const ids=new Set<string>();
    for(const r of array){if(!r || typeof r.sourceId !== "string" || !/^[0-9a-f-]{36}$/i.test(r.sourceId)||ids.has(r.sourceId))throw new Error("Identifiants invalides ou dupliqués.");ids.add(r.sourceId);}
    return array;
  };
  const sceneResources=collection([...(raw.scene?[raw.scene]:[]),...raw.dependencies.scenes]);
  const themeResources=collection([...(raw.theme?[raw.theme]:[]),...raw.dependencies.themes]);
  const builderResources=collection(raw.builder?[raw.builder]:[]);
  if((raw.kind === "scene" && (!raw.scene || raw.builder || raw.theme)) ||
     (raw.kind === "theme" && (!raw.theme || raw.builder || raw.scene)) ||
     (raw.kind === "builder" && (!raw.builder || raw.scene || raw.theme)))throw new Error("Contenu principal invalide.");
  const parsedScenes=sceneResources.map(r => ({ id:r.sourceId, data:sceneSchema.parse(r.data) }));
  const parsedThemes=themeResources.map(r => ({ id:r.sourceId, data:themeInputSchema.parse(r.data) }));
  const parsedBuilders=builderResources.map(r => ({ id:r.sourceId, data:builderSchema.parse(r.data) }));
  const imageResources=raw.dependencies.images;
  if(imageResources.length>60)throw new Error("Trop d'images.");
  const decoded=imageResources.map(img => {
    if(!img || typeof img.sourceId!=="string" || !/^[0-9a-f-]{36}$/i.test(img.sourceId) || typeof img.png!=="string" || img.png.length>MAX_IMAGE*1.4 || typeof img.name!=="string" || img.name.length>100 ||
       !Number.isInteger(img.width)||img.width<1||img.width>10000||!Number.isInteger(img.height)||img.height<1||img.height>10000)throw new Error("Métadonnées d'image invalides.");
    const bytes=Buffer.from(img.png,"base64");
    if(bytes.byteLength>MAX_IMAGE||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a" || bytes.toString("base64")!==img.png)throw new Error("Image PNG invalide.");
    return { ...img,bytes };
  });
  if(new Set(decoded.map(img=>img.sourceId)).size!==decoded.length)throw new Error("Images en double.");
  const now=new Date().toISOString();
  const state=readStore();
  if(!state.users.some(u=>u.id===owner))throw new Error("Profil local introuvable.");
  if(state.tables.custom_themes.filter(t=>t.owner_id===owner).length+parsedThemes.length>5)throw new Error("Limite de 5 thèmes atteinte pour ce profil.");
  if(state.tables.builder_overlays.filter(b=>b.owner_id===owner).length+parsedBuilders.length>15)throw new Error("Limite de 15 compositions atteinte pour ce profil.");
  if(state.tables.scenes.filter(s=>s.owner_id===owner).length+parsedScenes.length>20)throw new Error("Limite de 20 aventures atteinte pour ce profil.");
  const scenes=new Map(parsedScenes.map(s=>[s.id,randomUUID()]));
  const themes=new Map(parsedThemes.map(t=>[t.id,randomUUID()]));
  const assets=new Map(decoded.map(a=>[a.sourceId,randomUUID()]));
  for(const s of parsedScenes)if(s.data.style.customThemeId && !themes.has(s.data.style.customThemeId))throw new Error("Thème associé manquant.");
  for(const b of parsedBuilders){
    if(b.data.sceneId&&!scenes.has(b.data.sceneId))throw new Error("Aventure associée manquante.");
    for(const t of [b.data.theme,...b.data.elements.map(e=>e.themeOverride).filter(t=>t!==null)])
      if(t.customId&&!themes.has(t.customId))throw new Error("Thème associé manquant.");
    for(const e of b.data.elements)if(e.type==="image"&&e.properties.assetId&&!assets.has(e.properties.assetId))throw new Error("Image associée manquante.");
  }
  const saved:string[]=[];
  try {
    for(const a of decoded){const id=assets.get(a.sourceId)!;await saveAsset(id,a.bytes);saved.push(id);}
    const result=transact(s=>{
      if(!s.users.some(u=>u.id===owner))throw new Error("Profil local inexistant.");
      const existingThemes=s.tables.custom_themes.filter(t=>t.owner_id===owner);
      const existingBuilders=s.tables.builder_overlays.filter(b=>b.owner_id===owner);
      const existingScenes=s.tables.scenes.filter(a=>a.owner_id===owner);
      if(existingThemes.length+parsedThemes.length>5||existingBuilders.length+parsedBuilders.length>15||existingScenes.length+parsedScenes.length>20)throw new Error("Limite de créations atteinte.");
      for(const t of parsedThemes){const slot=Array.from({length:5},(_,i)=>i+1).find(n=>!s.tables.custom_themes.some(r=>r.owner_id===owner&&r.slot===n))!;
        s.tables.custom_themes.push({id:themes.get(t.id)!,owner_id:owner,slot,version:1,created_at:now,updated_at:now,...t.data});}
      for(const scene of parsedScenes){const data=structuredClone(scene.data);
        if(data.style.customThemeId)data.style.customThemeId=themes.get(data.style.customThemeId)!;
        s.tables.scenes.push({id:scenes.get(scene.id)!,owner_id:owner,view_token:randomUUID(),version:1,enabled:true,created_at:now,updated_at:now,data});}
      for(const a of decoded){const id=assets.get(a.sourceId)!;
        const item:Asset={id,owner_id:owner,slot:Date.now()+s.tables.builder_assets.length,name:a.name,object_path:id+".png",width:a.width,height:a.height,ready:true,upload_size:a.bytes.length,upload_expires_at:now,created_at:now};
        s.tables.builder_assets.push(item);}
      for(const b of parsedBuilders){const slot=Array.from({length:15},(_,i)=>i+1).find(n=>!s.tables.builder_overlays.some(r=>r.owner_id===owner&&r.slot===n))!;
        const data=structuredClone(b.data);data.sceneId=data.sceneId?scenes.get(data.sceneId)!:null;
        if(data.theme.customId)data.theme.customId=themes.get(data.theme.customId)!;
        data.elements=data.elements.map(e=>{const copy=structuredClone(e);copy.id=randomUUID();if(copy.themeOverride?.customId)copy.themeOverride.customId=themes.get(copy.themeOverride.customId)!;
          if(copy.type==="image"&&copy.properties.assetId)copy.properties.assetId=assets.get(copy.properties.assetId)!;return copy;});
        s.tables.builder_overlays.push({id:randomUUID(),owner_id:owner,slot,view_token:randomUUID(),enabled:true,version:1,created_at:now,updated_at:now,data});
      }
      return { kind:raw.kind, created:{scenes:parsedScenes.length,themes:parsedThemes.length,builders:parsedBuilders.length,images:decoded.length} };
    });
    return result;
  }catch(error){await removeAssetFiles(saved);throw error;}
}
