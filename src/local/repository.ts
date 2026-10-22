import "server-only";
import { randomUUID } from "node:crypto";
import { readStore, transact, type Tables, type Store } from "./store";
type Failure={message:string;code:string};
type Result<T>={data:T|null;error:Failure|null};
const clone=<T,>(value:T):T=>structuredClone(value);
// Match the selected columns instead of exposing storage-only fields to strict schemas.
function projectRow(row:Record<string,unknown>,columns:string):Record<string,unknown>{
 const result:Record<string,unknown>={};
 for(const field of (columns||"*").split(/,(?![^()]*\))/).map(value=>value.trim()).filter(Boolean)){
  if(field==="*"){Object.assign(result,row);continue;}
  const relation=/^(\w+)\((.*)\)$/.exec(field);
  if(relation){const value=row[relation[1]];result[relation[1]]=Array.isArray(value)?value.map(item=>projectRow(item,relation[2])):value&&typeof value==="object"?projectRow(value as Record<string,unknown>,relation[2]):null;}
  else if(Object.hasOwn(row,field))result[field]=row[field];
 }
 return result;
}
function cleanup(state:Store,table:keyof Tables,ids:Set<string>) {
 if(table==="scenes"){
  for(const d of state.tables.connect_devices)if(d.scene_id&&ids.has(d.scene_id)){d.scene_id=null;d.snapshot=null;d.selection_revision++;}
  for(const b of state.tables.builder_overlays)if(b.data.sceneId&&ids.has(b.data.sceneId))b.data.sceneId=null;
 }
 if(table==="custom_themes"){
  for(const s of state.tables.scenes)if(s.data.style.customThemeId&&ids.has(s.data.style.customThemeId)){
   s.data.style.theme="carbon";delete s.data.style.customThemeId;delete s.data.style.customTheme;s.version++;s.updated_at=new Date().toISOString();
  }
  for(const b of state.tables.builder_overlays){
   const refs=[b.data.theme,...b.data.elements.flatMap(e=>e.themeOverride?[e.themeOverride]:[])];
   for(const ref of refs)if(ref.customId&&ids.has(ref.customId)){ref.id="carbon";delete ref.customId;}
   b.version++;b.updated_at=new Date().toISOString();
  }
  state.tables.theme_favorites=state.tables.theme_favorites.filter(f=>!ids.has(f.theme.replace(/^custom-/,"")));
 }
}
class Query<K extends keyof Tables> implements PromiseLike<Result<Tables[K][]>> {
 private filters:((row:Tables[K])=>boolean)[]=[];
 private sorters:{key:string;asc:boolean}[]=[]; private cap=Infinity;private projection="";
 private operation:"read"|"insert"|"update"|"delete"|"upsert"="read"; private value:Partial<Tables[K]>={};
 private conflictColumns:string[]=["id"]; private ignoreDuplicates=false;
 constructor(private table:K){}
 select(columns="*"){this.projection=columns;return this;}
 eq(key:string,value:unknown){this.filters.push(row=>Reflect.get(row,key)===value);return this;}
 neq(key:string,value:unknown){this.filters.push(row=>Reflect.get(row,key)!==value);return this;}
 in(key:string,values:unknown[]){this.filters.push(row=>values.includes(Reflect.get(row,key)));return this;}
 order(key:string,options?:{ascending?:boolean}){this.sorters.push({key,asc:options?.ascending!==false});return this;}
 limit(n:number){this.cap=n;return this;}
 insert(value:Partial<Tables[K]>){this.operation="insert";this.value=value;return this;}
 upsert(value:Partial<Tables[K]>,options?:{onConflict?:string;ignoreDuplicates?:boolean}){
  this.operation="upsert";this.value=value;
  this.conflictColumns=options?.onConflict?.split(",").map(k=>k.trim()).filter(Boolean)??["id"];
  this.ignoreDuplicates=options?.ignoreDuplicates===true;return this;
 }
 update(value:Partial<Tables[K]>){this.operation="update";this.value=value;return this;}
 delete(){this.operation="delete";return this;}
 private execute():Result<Tables[K][]> {
  try {
   const run=(state:Store)=>{
    const rows=state.tables[this.table] as Tables[K][];
    let result=rows.filter(row=>this.filters.every(f=>f(row)));
    if(this.operation==="upsert") result=rows.filter(row=>this.conflictColumns.every(key=>Reflect.get(row,key)===Reflect.get(this.value,key)));
    if(this.operation==="insert" || this.operation==="upsert"&&!result.length){
     const now=new Date().toISOString();
     const row={id:randomUUID(),owner_id:"local",view_token:randomUUID(),version:1,enabled:true,created_at:now,updated_at:now,...this.value} as Tables[K];
     if(rows.some(r=>r.id===row.id || "slot" in row&&"slot" in r&&row.owner_id===r.owner_id&&row.slot===r.slot))throw Object.assign(new Error("duplicate"),{code:"23505"});
     rows.push(row);result=[row];
    }else if(this.operation==="update"||this.operation==="upsert"&&!this.ignoreDuplicates){
     for(const row of result){Object.assign(row,this.value);
      if(this.table==="scenes"){Reflect.set(row,"version",Number(Reflect.get(row,"version"))+1);Reflect.set(row,"updated_at",new Date().toISOString());}
     }
    }else if(this.operation==="delete"){
     const ids=new Set(result.map(r=>r.id));rows.splice(0,rows.length,...rows.filter(r=>!ids.has(r.id)));cleanup(state,this.table,ids);
    }
    for(const sorter of [...this.sorters].reverse())result.sort((a,b)=>String(Reflect.get(a,sorter.key)).localeCompare(String(Reflect.get(b,sorter.key)),undefined,{numeric:true})*(sorter.asc?1:-1));
    result=clone(result.slice(0,this.cap));
    if(this.table==="scenes"&&this.projection.includes("connect_devices"))for(const row of result)Reflect.set(row,"connect_devices",clone(state.tables.connect_devices.filter(d=>d.scene_id===row.id)));
    return result.map(row=>projectRow(row as Record<string,unknown>,this.projection) as Tables[K]);
   };
   return {data:this.operation==="read"?run(readStore()):transact(run),error:null};
  }catch(error){return {data:null,error:{message:error instanceof Error?error.message:"Storage unavailable",code:typeof error==="object"&&error&&"code" in error?String(error.code):"LOCAL_STORAGE"}};}
 }
 then<A=Result<Tables[K][]>,B=never>(resolve?:((value:Result<Tables[K][]>)=>A|PromiseLike<A>)|null,reject?:((reason:unknown)=>B|PromiseLike<B>)|null):Promise<A|B>{return Promise.resolve(this.execute()).then(resolve,reject);}
 async maybeSingle():Promise<Result<Tables[K]>> {const r=this.execute();return {data:r.data?.[0]??null,error:r.error};}
 async single():Promise<Result<Tables[K]>> {return this.maybeSingle();}
}
export function localRepository(){return {from:<K extends keyof Tables>(table:K)=>new Query(table)};}
export async function createLocalRepository(){return localRepository();}
