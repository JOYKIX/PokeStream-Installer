import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/local/session";
import { localRepository as adminClient } from "@/local/repository";
import { builderColumns, displayBuilder } from "@/builder/server";
import { BuilderOBSSettings } from "@/builder/obs-settings";
import "@/builder/builder.css";
export const metadata = { title: "OBS · Overlay Builder" };
export default async function BuilderOBSPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getUser();
  if (!user) redirect("/login?next=/builder/" + id + "/obs");
  const { data, error } = await adminClient()
    .from("builder_overlays")
    .select(builderColumns)
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const display = await displayBuilder(user.id, data.data);
  return (
    <>
      <BuilderOBSSettings
        initial={{ ...data, data: display.data }}
        scene={display.scene}
        themes={display.themes}
      />
    </>
  );
}
