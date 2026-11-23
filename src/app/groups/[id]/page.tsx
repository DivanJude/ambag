import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ComponentItem,
  Contribution,
  Group,
  GroupInvitation,
  GroupMember,
  OrderBundle,
} from "@/lib/types";
import type { GroupNotification } from "@/lib/notify";
import GroupWorkspace from "@/components/GroupWorkspace";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Execute ALL queries in one single parallel round-trip (eliminates waterfall)
  const [gRes, mRes, cRes, bRes, pRes, nRes, rRes, profRes, invRes] = await Promise.all([
    supabase.from("groups").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("group_members")
      .select("*")
      .eq("group_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("components")
      .select("*")
      .eq("group_id", id)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("order_bundles")
      .select("*")
      .eq("group_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("contributions")
      .select("*")
      .eq("group_id", id)
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("group_notifications")
      .select("*")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("notification_reads")
      .select("last_read_at")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("group_invitations")
      .select("*")
      .eq("group_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (!gRes.data) {
    notFound();
  }

  const members = (mRes.data ?? []) as GroupMember[];
  const myMember = members.find((m) => m.user_id === user.id) ?? null;
  const actorName =
    myMember?.display_name ??
    profRes.data?.full_name ??
    user.email?.split("@")[0] ??
    "Member";

  return (
    <GroupWorkspace
      currentUserId={user.id}
      actorName={actorName}
      myMember={myMember}
      initialGroup={gRes.data as Group}
      initialMembers={members}
      initialComponents={(cRes.data ?? []) as ComponentItem[]}
      initialBundles={(bRes.data ?? []) as OrderBundle[]}
      initialContributions={(pRes.data ?? []) as Contribution[]}
      initialNotifications={(nRes.data ?? []) as GroupNotification[]}
      initialLastReadAt={rRes.data?.last_read_at ?? null}
      initialInvitations={(invRes.data ?? []) as GroupInvitation[]}
    />
  );
}
