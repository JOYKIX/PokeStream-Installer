import type {MetadataRoute} from "next";
export default function sitemap():MetadataRoute.Sitemap {
 const base=process.env.NEXT_PUBLIC_POKESTREAM_SITE_URL||"https://pokestream.vercel.app";
 return [{url:base,changeFrequency:"monthly",priority:1},{url:`${base}/privacy`,changeFrequency:"yearly",priority:.2}];
}
