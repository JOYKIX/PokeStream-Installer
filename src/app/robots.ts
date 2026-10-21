import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots {
 const base=process.env.NEXT_PUBLIC_POKESTREAM_SITE_URL||"https://pokestream.vercel.app";
 return {rules:[{userAgent:"*",allow:["/","/privacy"],disallow:["/api/","/studio/","/builder/","/overlay/","/theme-creator/","/users/","/settings/","/connect/","/admin/","/login/","/profile/"]}],sitemap:`${base}/sitemap.xml`};
}
