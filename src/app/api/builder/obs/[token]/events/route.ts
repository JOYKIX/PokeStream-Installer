import { eventStream } from "@/local/events";
import { builderPayload } from "@/local/live-data";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{token:string}>}) { const {token}=await context.params;if(!z.uuid().safeParse(token).success)return new Response(null,{status:404});return eventStream(request,()=>builderPayload(token)); }
