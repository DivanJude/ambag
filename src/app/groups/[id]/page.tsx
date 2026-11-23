import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ComponentItem,
  Contribution,
  Group,
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

  const { data: groupData } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .single();

  if (!groupData) {
    notFound();
  }

  const [mRes, cRes, bRes, pRes, nRes, rRes, profRes] = await Promise.all([
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
  ]);

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
      initialGroup={groupData as Group}
      initialMembers={members}
      initialComponents={(cRes.data ?? []) as ComponentItem[]}
      initialBundles={(bRes.data ?? []) as OrderBundle[]}
      initialContributions={(pRes.data ?? []) as Contribution[]}
      initialNotifications={(nRes.data ?? []) as GroupNotification[]}
      initialLastReadAt={rRes.data?.last_read_at ?? null}
    />
  );
}
