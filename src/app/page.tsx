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

  // Run all queries in a single parallel round-trip (RLS automatically scopes rows to user's groups)
  const [profRes, gRes, mRes, cRes, bRes, pRes] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("groups").select("*").order("created_at", { ascending: false }),
    supabase.from("group_members").select("*"),
    supabase.from("components").select("*"),
    supabase.from("order_bundles").select("*"),
    supabase.from("contributions").select("*"),
  ]);

  const groups = (gRes.data ?? []) as Group[];
  const members = (mRes.data ?? []) as GroupMember[];
  const components = (cRes.data ?? []) as ComponentItem[];
  const bundles = (bRes.data ?? []) as OrderBundle[];
  const contributions = (pRes.data ?? []) as Contribution[];

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
        name: profRes.data?.full_name ?? user.email?.split("@")[0] ?? "User",
        avatarUrl: profRes.data?.avatar_url ?? null,
      }}
      initialGroups={cards}
    />
  );
}
