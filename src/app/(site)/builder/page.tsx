import { redirect } from "next/navigation";
import { getUser } from "@/local/session";
import { builderContext, listBuilders } from "@/builder/server";
import { BuilderLibrary } from "@/builder/library";
import "@/builder/builder.css";
export const metadata = { title: "Overlay Builder" };
export default async function BuilderPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/builder");
  const [context, initial] = await Promise.all([
    builderContext(user.id),
    listBuilders(user.id),
  ]);
  return (
    <>
      <BuilderLibrary
        initial={initial}
        active={context.active}
        themes={context.themes}
      />
    </>
  );
}
