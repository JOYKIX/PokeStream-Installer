import { eventStream } from "@/local/events";
import { builderPreview } from "@/local/live-data";
import { getUser } from "@/local/session";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {const user=await getUser();if(!user)return new Response(null,{status:401});const {id}=await context.params,selected=new URL(request.url).searchParams.get("scene");if(!z.uuid().safeParse(id).success||selected&&selected!=="none"&&!z.uuid().safeParse(selected).success)return new Response(null,{status:400});return eventStream(request,()=>builderPreview(user.id,id,selected));}
