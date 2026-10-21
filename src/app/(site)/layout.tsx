import { SiteHeader } from "@/components/site-header";
import { getUser } from "@/local/session";
import { isLocal } from "@/local/runtime";
export default async function SiteLayout({children}:{children:React.ReactNode}){
 const local=isLocal(),user=local?await getUser():null;
 return <div className="site-layout"><SiteHeader local={local} userName={user?.name} avatar={user?.avatar} color={user?.color}/><div className="site-content">{children}</div></div>;
}
