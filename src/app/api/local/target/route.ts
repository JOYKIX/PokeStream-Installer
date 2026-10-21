import { z } from "zod";
import { sameOrigin } from "@/lib/api";
import { getUser } from "@/local/session";
import { readDestination,selectDestination } from "@/local/connect";
export async function GET(){if(!await getUser())return new Response(null,{status:401});return Response.json(readDestination(),{headers:{"Cache-Control":"no-store"}});}
export async function PUT(r:Request){if(!sameOrigin(r)||!await getUser())return new Response(null,{status:403});const p=z.object({id:z.uuid().nullable()}).safeParse(await r.json().catch(()=>null));if(!p.success)return new Response(null,{status:400});const result=selectDestination(p.data.id);return Response.json(result,{status:"error" in result?409:200});}
