import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { isLocal } from "./runtime";
import type { Scene } from "@/lib/model";
import type { CustomTheme } from "@/themes/custom/schema";
import type { BuilderRecord } from "@/builder/schema";
export type LocalDevice = { id:string; name:string; owner_id:string; scene_id:string|null; snapshot:unknown; updated_at:string|null; last_seen_at:string|null; revision:number; selection_revision:number; secret_hash:string; created_at:string };
export type Asset = { id:string; owner_id:string; slot:number; name:string; object_path:string; width:number; height:number; ready:boolean; upload_size:number; upload_expires_at:string; created_at:string };
export type Tables = {
 scenes: Scene & {connect_devices?: LocalDevice[]};
 custom_themes: CustomTheme & {owner_id:string};
 builder_overlays: BuilderRecord & {owner_id:string;created_at:string};
 builder_assets: Asset;
 connect_devices: LocalDevice;
 theme_favorites: {id:string; owner_id:string; theme:string};
 theme_starters: {id:string;owner_id:string;theme:string};
};
export type Store = { schemaVersion:1; tables:{[K in keyof Tables]:Tables[K][]}; users:{id:string;name:string;avatar:string;color:string}[]; settings:{language?:string;activeUser?:string;epoch?:number}; };
export function dataDirectory() {
 if(!isLocal()) throw new Error("Local application required.");
 return process.env.POKESTREAM_DATA_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),".local","share"),"PokeStream","Studio");
}
const fresh = ():Store => ({schemaVersion:1,tables:{scenes:[],custom_themes:[],builder_overlays:[],builder_assets:[],connect_devices:[],theme_favorites:[],theme_starters:[]},users:[],settings:{}});
const globalDb = globalThis as typeof globalThis & {pokeStreamDatabase?: DatabaseSync};
function database() {
 if(!isLocal()) throw new Error("Local application required.");
 if(globalDb.pokeStreamDatabase)return globalDb.pokeStreamDatabase;
 const directory=dataDirectory();mkdirSync(directory,{recursive:true});
 const db=new DatabaseSync(path.join(directory,"pokestream.sqlite"));
 db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);");
 db.prepare("INSERT OR IGNORE INTO workspace(id,data) VALUES(1,?)").run(JSON.stringify(fresh()));
 return globalDb.pokeStreamDatabase=db;
}
function load(db:DatabaseSync):Store {
 const row=db.prepare("SELECT data FROM workspace WHERE id=1").get();
 const result=JSON.parse(String(row?.data)) as Store;
 if(result.schemaVersion!==1 || !result.tables)throw new Error("Unsupported workspace version.");
 return result;
}
export function readStore():Store { return load(database()); }
export function transact<T>(change:(state:Store)=>T):T {
 const db=database();db.exec("BEGIN IMMEDIATE");
 try { const state=load(db);const result=change(state);
 db.prepare("UPDATE workspace SET data=? WHERE id=1").run(JSON.stringify(state));db.exec("COMMIT");return result;
 }catch(error){db.exec("ROLLBACK");throw error;}
}
