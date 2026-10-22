import { eventStream } from "@/local/events";
import { overlayPayload } from "@/local/live-data";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{token:string}>}) { const {token}=await context.params;return eventStream(request,()=>overlayPayload(token)); }
