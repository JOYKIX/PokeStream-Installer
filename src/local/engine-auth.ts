import "server-only";
import { timingSafeEqual } from "node:crypto";
export function engineAuthorized(request: Request) {
 const secret=process.env.POKESTREAM_ENGINE_TOKEN,id=process.env.POKESTREAM_ENGINE_ID;if(!secret||!id)return false;
 const actual=Buffer.from(request.headers.get("authorization")||""),expected=Buffer.from("Bearer "+id+"."+secret);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
