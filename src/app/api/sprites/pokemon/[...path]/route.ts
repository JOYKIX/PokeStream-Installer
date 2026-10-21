import {spriteResponse} from "@/local/sprite-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
 return spriteResponse(request,"pokemon",(await params).path);
}
