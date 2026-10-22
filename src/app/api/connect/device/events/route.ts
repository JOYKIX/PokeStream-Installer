import { eventStream,registerEngineConnection } from "@/local/events";
import { engineAuthorized } from "@/local/engine-auth";
import { readDestination } from "@/local/connect";
export const dynamic="force-dynamic";
export async function GET(request:Request) {if(!engineAuthorized(request))return new Response(null,{status:401});const dispose=registerEngineConnection();return eventStream(request,readDestination,dispose);}
