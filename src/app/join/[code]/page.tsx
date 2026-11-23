import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinInviteClient from "@/components/JoinInviteClient";

interface InvitePreview {
  id: string;
  name: string;
  mode: "project" | "savings";
  currency: string;
  unclaimed_seats: { id: string; display_name: string; role: string }[];
}

export default async function JoinByLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/join/${encodeURIComponent(code)}`);
  }

  // Auto-claim any email-matched invitations first
  await supabase.rpc("claim_invited_memberships");

  const [{ data: previewData }, { data: profile }] = await Promise.all([
    supabase.rpc("get_group_preview_by_code", { p_code: code }),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  const preview = (previewData as InvitePreview | null) ?? null;

  // If user is already a member of this group, redirect straight into it
  if (preview?.id) {
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", preview.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      redirect(`/groups/${preview.id}`);
    }
  }

  return (
    <JoinInviteClient
      code={code.toUpperCase()}
      userName={profile?.full_name ?? user.email?.split("@")[0] ?? "Member"}
      preview={preview}
    />
  );
}
