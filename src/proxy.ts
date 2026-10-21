import { NextRequest, NextResponse } from "next/server";

// Vercel hosts a download site only. Private/editor routes are local-only.
export function proxy(request:NextRequest){
 const p=request.nextUrl.pathname;
 if(process.env.POKESTREAM_LOCAL!=="1"){
  if(p==="/"||p==="/privacy"||p.startsWith("/_next/")||p.startsWith("/logo/")||/^\/(icon|favicon|apple-icon|robots|sitemap)/.test(p))return NextResponse.next();
  if(p.startsWith("/api/")||p.startsWith("/overlay/")||p.startsWith("/builder/obs/"))return new NextResponse(null,{status:410});
  return NextResponse.redirect(new URL("/",request.url));
 }
 const host=request.headers.get("host")||"";
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))return new NextResponse(null,{status:403});
 const origin=request.headers.get("origin");
 if(origin&&origin!=="http://"+host)return new NextResponse(null,{status:403});
 if(request.headers.get("sec-fetch-site")==="cross-site")return new NextResponse(null,{status:403});
 return NextResponse.next();
}
export const config={matcher:["/((?!_next/static|_next/image).*)"]};
