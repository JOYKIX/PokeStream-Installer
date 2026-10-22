import {isLocal} from "@/local/runtime";
import {localRequestAllowed} from "@/local/request-origin";
import {eventStream} from "@/local/events";
import {spriteService} from "@/local/sprites/service";
export const dynamic="force-dynamic";
export async function GET(request:Request){if(!isLocal()||!localRequestAllowed(request))return new Response(null,{status:403});return eventStream(request,()=>spriteService().renderState(),undefined,["sprites"]);}
