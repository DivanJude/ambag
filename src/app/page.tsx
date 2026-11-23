import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeGroupFinancials } from "@/lib/finance";
import type {
  ComponentItem,
  Contribution,
  Group,
  GroupMember,
  OrderBundle,
} from "@/lib/types";
import GroupsDashboard, { type DashboardGroupCard } from "@/components/GroupsDashboard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: groupsData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("groups").select("*").order("created_at", { ascending: false }),
  ]);

  const groups = (groupsData ?? []) as Group[];
  const groupIds = groups.map((g) => g.id);

  let members: GroupMember[] = [];
  let components: ComponentItem[] = [];
  let bundles: OrderBundle[] = [];
  let contributions: Contribution[] = [];

  if (groupIds.length > 0) {
    const [mRes, cRes, bRes, pRes] = await Promise.all([
      supabase.from("group_members").select("*").in("group_id", groupIds),
      supabase.from("components").select("*").in("group_id", groupIds),
      supabase.from("order_bundles").select("*").in("group_id", groupIds),
      supabase.from("contributions").select("*").in("group_id", groupIds),
    ]);
    members = (mRes.data ?? []) as GroupMember[];
    components = (cRes.data ?? []) as ComponentItem[];
    bundles = (bRes.data ?? []) as OrderBundle[];
    contributions = (pRes.data ?? []) as Contribution[];
  }

  const cards: DashboardGroupCard[] = groups.map((group) => {
    const gMembers = members.filter((m) => m.group_id === group.id);
    const gComps = components.filter((c) => c.group_id === group.id);
    const gBundles = bundles.filter((b) => b.group_id === group.id);
    const gContribs = contributions.filter((p) => p.group_id === group.id);
    const financials = computeGroupFinancials(group, gMembers, gComps, gBundles, gContribs);
    const myMember = gMembers.find((m) => m.user_id === user.id) ?? null;
    const mySummary = myMember
      ? financials.memberSummaries.find((s) => s.member.id === myMember.id) ?? null
      : null;

    return {
      group,
      role: myMember?.role ?? "viewer",
      memberCount: gMembers.length,
      totalCost: financials.totalProjectCost,
      totalCollected: financials.totalContributions,
      progressPercent: financials.progressPercent,
      myBalanceDue: mySummary?.balanceDue ?? 0,
      pendingCount: financials.pendingContributionsCount,
      unpaidCount: financials.unpaidItemsCount,
    };
  });

  return (
    <GroupsDashboard
      user={{
        id: user.id,
        email: user.email ?? "",
        name: profile?.full_name ?? user.email?.split("@")[0] ?? "User",
      }}
      initialGroups={cards}
    />
  );
}
