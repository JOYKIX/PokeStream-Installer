import {spriteResponse} from "@/local/sprite-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{collection:string;path:string[]}>}){
 const {collection,path}=await params;
 return spriteResponse(request,collection,path);
}
