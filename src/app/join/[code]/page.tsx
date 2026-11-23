import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinInviteClient, { type InvitePreview } from "@/components/JoinInviteClient";

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalizedCode = decodeURIComponent(code).trim().toUpperCase();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${normalizedCode}`)}`);
  }

  const [{ data: preview }, { data: profile }] = await Promise.all([
    supabase.rpc("get_group_preview_by_code", { p_code: normalizedCode }),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <JoinInviteClient
      code={normalizedCode}
      userName={profile?.full_name ?? user.email?.split("@")[0] ?? "Member"}
      preview={(preview as InvitePreview | null) ?? null}
    />
  );
}
