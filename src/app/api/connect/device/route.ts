import { timingSafeEqual } from "node:crypto";
import { convertFrame,deviceFrameSchema } from "@/lib/connect-frame";
import { readJson } from "@/lib/api";
import { touchDestination,ingestFrame,selectDestination } from "@/local/connect";
import { z } from "zod";
export const dynamic="force-dynamic";
function permitted(r:Request){const secret=process.env.POKESTREAM_ENGINE_TOKEN,id=process.env.POKESTREAM_ENGINE_ID;if(!secret||!id)return false;const a=Buffer.from(r.headers.get("authorization")||""),b=Buffer.from("Bearer "+id+"."+secret);return a.length===b.length&&timingSafeEqual(a,b);}
function reply(data:unknown){return Response.json(data,{status:typeof data==="object"&&data&&"error" in data?409:200,headers:{"Cache-Control":"no-store"}});}
export async function GET(r:Request){if(!permitted(r))return new Response(null,{status:401});return reply(touchDestination());}
export async function PATCH(r:Request){if(!permitted(r))return new Response(null,{status:401});const p=z.object({sceneId:z.uuid(),selectionRevision:z.number().int().nonnegative()}).safeParse(await readJson(r).catch(()=>null));return p.success?reply(selectDestination(p.data.sceneId,p.data.selectionRevision)):new Response(null,{status:400});}
export async function POST(r:Request){if(!permitted(r))return new Response(null,{status:401});const p=deviceFrameSchema.safeParse(await readJson(r).catch(()=>null));if(!p.success)return new Response(null,{status:400});const revision=Number(r.headers.get("x-connect-selection"));if(!Number.isSafeInteger(revision)||revision<0)return new Response(null,{status:400});const frame="team" in p.data?convertFrame(p.data):p.data;
 try{return reply(ingestFrame(frame,p.data.sceneId,revision));}catch{return new Response(null,{status:400});}}
