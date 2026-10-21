import {z} from "zod";
import {getUser} from "@/local/session";
import {sameOrigin} from "@/lib/api";
import {engineStatus,engineCommand} from "@/local/engine";
const command=z.discriminatedUnion("action",[
 z.object({action:z.enum(["pause","resume","rescan","launch","choose-emulator","choose-save","clear-save"])}),
 z.object({action:z.literal("emulator"),value:z.number().int().nonnegative()}),
 z.object({action:z.literal("ports"),value:z.object({ryujinx:z.number().int().min(0).max(65535),citron:z.number().int().min(0).max(65535)})}),
 z.object({action:z.literal("deaths"),value:z.number().int().min(0).max(9999)})
]);
export async function GET(){if(!await getUser())return new Response(null,{status:401});return Response.json(await engineStatus(),{headers:{"Cache-Control":"no-store"}});}
export async function POST(r:Request){if(!sameOrigin(r)||!await getUser())return new Response(null,{status:403});const p=command.safeParse(await r.json().catch(()=>null));if(!p.success)return new Response(null,{status:400});return Response.json({id:await engineCommand(p.data)},{status:202});}
