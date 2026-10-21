import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/local/session";
import { localRepository as adminClient } from "@/local/repository";
import { builderContext, builderColumns } from "@/builder/server";
import { BuilderEditor } from "@/builder/editor";
import "@/builder/builder.css";
export const metadata = { title: "Overlay Builder" };
export default async function BuilderEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getUser();
  if (!user) redirect("/login?next=/builder/" + id);
  const db = adminClient(),
    [record, context, assets] = await Promise.all([
      db
        .from("builder_overlays")
        .select(builderColumns)
        .eq("owner_id", user.id)
        .eq("id", id)
        .maybeSingle(),
      builderContext(user.id),
      db
        .from("builder_assets")
        .select("id,name,width,height")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
  if (record.error || assets.error) throw new Error("Builder unavailable");
  if (!record.data) notFound();
  return (
    <>
      <BuilderEditor
        initial={record.data}
        context={context}
        initialAssets={assets.data ?? []}
      />
    </>
  );
}
