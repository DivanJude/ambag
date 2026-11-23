import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ComponentItem,
  Contribution,
  Group,
  GroupMember,
  OrderBundle,
} from "@/lib/types";
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

  const [mRes, cRes, bRes, pRes] = await Promise.all([
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
  ]);

  const members = (mRes.data ?? []) as GroupMember[];
  const myMember = members.find((m) => m.user_id === user.id) ?? null;

  return (
    <GroupWorkspace
      currentUserId={user.id}
      myMember={myMember}
      initialGroup={groupData as Group}
      initialMembers={members}
      initialComponents={(cRes.data ?? []) as ComponentItem[]}
      initialBundles={(bRes.data ?? []) as OrderBundle[]}
      initialContributions={(pRes.data ?? []) as Contribution[]}
    />
  );
}
