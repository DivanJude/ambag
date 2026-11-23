import type {
  ComponentItem,
  Contribution,
  Group,
  GroupFinancialSummary,
  GroupMember,
  MemberFinancialSummary,
  OrderBundle,
} from "./types";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function formatCurrency(amount: number, currency = "PHP"): string {
  const symbol = currency === "PHP" ? "₱" : `${currency} `;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function getComponentTotal(item: Pick<ComponentItem, "unit_price" | "quantity">): number {
  return round2(Number(item.unit_price) * Number(item.quantity));
}

export function computeGroupFinancials(
  group: Pick<Group, "mode" | "target_amount">,
  members: GroupMember[],
  components: ComponentItem[],
  bundles: OrderBundle[],
  contributions: Contribution[]
): GroupFinancialSummary {
  // 1. Standalone selected components (exclude items already inside an Order Bundle to avoid double-counting)
  const standaloneSelected = components.filter((c) => c.selected && !c.bundle_id);

  const standaloneCost = standaloneSelected.reduce(
    (sum, c) => sum + getComponentTotal(c),
    0
  );
  const bundlesCost = bundles.reduce((sum, b) => sum + Number(b.actual_total), 0);

  const totalProjectCost =
    group.mode === "savings"
      ? round2(Number(group.target_amount) || 0)
      : round2(standaloneCost + bundlesCost);

  // 2. Expenses (Online vs Cash) + Unpaid totals
  let onlineExpenses = 0;
  let cashExpenses = 0;
  let unpaidItemsTotal = 0;
  let unpaidItemsCount = 0;

  if (group.mode === "project") {
    for (const c of standaloneSelected) {
      const total = getComponentTotal(c);
      const online = Number(c.online_paid) || 0;
      const cash = Number(c.cash_paid) || 0;
      onlineExpenses += online;
      cashExpenses += cash;
      const remaining = round2(total - online - cash);
      if (c.payment_status === "Unpaid" || remaining > 0.01) {
        unpaidItemsTotal += Math.max(remaining, 0);
        unpaidItemsCount += 1;
      }
    }

    for (const b of bundles) {
      const total = Number(b.actual_total) || 0;
      const online = Number(b.online_paid) || 0;
      const cash = Number(b.cash_paid) || 0;
      onlineExpenses += online;
      cashExpenses += cash;
      const remaining = round2(total - online - cash);
      if (b.payment_status === "Unpaid" || remaining > 0.01) {
        unpaidItemsTotal += Math.max(remaining, 0);
        unpaidItemsCount += 1;
      }
    }
  }

  onlineExpenses = round2(onlineExpenses);
  cashExpenses = round2(cashExpenses);
  unpaidItemsTotal = round2(unpaidItemsTotal);

  // 3. Approved & Pending Contributions
  const approved = contributions.filter((c) => c.status === "approved");
  const pending = contributions.filter((c) => c.status === "pending");

  const onlineFundsReceived = round2(
    approved
      .filter((c) => c.method === "online")
      .reduce((sum, c) => sum + Number(c.amount), 0)
  );
  const cashFundsReceived = round2(
    approved
      .filter((c) => c.method === "cash")
      .reduce((sum, c) => sum + Number(c.amount), 0)
  );
  const totalContributions = round2(onlineFundsReceived + cashFundsReceived);

  const onlineAvailableBalance = round2(onlineFundsReceived - onlineExpenses);
  const cashAvailableBalance = round2(cashFundsReceived - cashExpenses);
  const totalAvailableFunds = round2(onlineAvailableBalance + cashAvailableBalance);
  const remainingToCollect = round2(Math.max(totalProjectCost - totalContributions, 0));

  const pendingContributionsTotal = round2(
    pending.reduce((sum, c) => sum + Number(c.amount), 0)
  );

  // 4. Individual Member Splits & Balances
  const fixedTotal = members
    .filter((m) => m.split_mode === "fixed")
    .reduce((sum, m) => sum + Number(m.split_value), 0);
  const percentMembers = members.filter((m) => m.split_mode === "percent");
  const percentTotal = percentMembers.reduce(
    (sum, m) => sum + (totalProjectCost * Number(m.split_value)) / 100,
    0
  );
  const equalMembers = members.filter((m) => m.split_mode === "equal");
  const equalPool = Math.max(totalProjectCost - fixedTotal - percentTotal, 0);
  const equalShare = equalMembers.length > 0 ? round2(equalPool / equalMembers.length) : 0;

  const memberSummaries: MemberFinancialSummary[] = members.map((member) => {
    let individualBill = equalShare;
    if (member.split_mode === "fixed") {
      individualBill = round2(Number(member.split_value));
    } else if (member.split_mode === "percent") {
      individualBill = round2((totalProjectCost * Number(member.split_value)) / 100);
    }

    const memberApproved = approved.filter((c) => c.member_id === member.id);
    const memberPending = pending.filter((c) => c.member_id === member.id);

    const onlinePaid = round2(
      memberApproved
        .filter((c) => c.method === "online")
        .reduce((sum, c) => sum + Number(c.amount), 0)
    );
    const cashPaid = round2(
      memberApproved
        .filter((c) => c.method === "cash")
        .reduce((sum, c) => sum + Number(c.amount), 0)
    );
    const totalPaid = round2(onlinePaid + cashPaid);
    const balanceDue = round2(individualBill - totalPaid);
    const pendingAmount = round2(
      memberPending.reduce((sum, c) => sum + Number(c.amount), 0)
    );

    return {
      member,
      individualBill,
      onlinePaid,
      cashPaid,
      totalPaid,
      balanceDue,
      pendingAmount,
    };
  });

  const progressPercent =
    totalProjectCost > 0
      ? Math.min(100, Math.round((totalContributions / totalProjectCost) * 100))
      : 0;

  return {
    totalProjectCost,
    totalContributions,
    remainingToCollect,
    onlineFundsReceived,
    onlineExpenses,
    onlineAvailableBalance,
    cashFundsReceived,
    cashExpenses,
    cashAvailableBalance,
    totalAvailableFunds,
    unpaidItemsTotal,
    unpaidItemsCount,
    pendingContributionsCount: pending.length,
    pendingContributionsTotal,
    memberSummaries,
    progressPercent,
  };
}
