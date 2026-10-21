import { cleanupAssets } from "@/local/assets";
export async function cleanupBuilderAssets(owner:string,discard:string[]=[]){return cleanupAssets(owner,discard);}
export async function expireBuilderUploads(owner?:string){if(owner)await cleanupAssets(owner);}
export async function flushBuilderAssetDeletes(_owner?:string){return {deletedAssets:[] as string[],count:0};}
