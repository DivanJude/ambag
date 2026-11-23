import { describe, expect, it } from "vitest";
import { computeGroupFinancials } from "./finance";
import type { ComponentItem, Contribution, GroupMember, OrderBundle } from "./types";

const baseTime = "2026-11-23T00:00:00Z";

describe("computeGroupFinancials — BROwsers Thesis Sheet Reconciliation", () => {
  const members: GroupMember[] = [
    { id: "m-divan", group_id: "g1", user_id: "u1", display_name: "Divan", email: null, role: "leader", split_mode: "equal", split_value: 0, created_at: baseTime },
    { id: "m-leonard", group_id: "g1", user_id: null, display_name: "Leonard", email: null, role: "viewer", split_mode: "equal", split_value: 0, created_at: baseTime },
    { id: "m-michael", group_id: "g1", user_id: null, display_name: "Michael", email: null, role: "viewer", split_mode: "equal", split_value: 0, created_at: baseTime },
  ];

  const bundles: OrderBundle[] = [
    {
      id: "b-xin",
      group_id: "g1",
      title: "TOTAL xin260426 SHOP PURCHASE",
      shop_name: "xin260426",
      items_subtotal: 1432,
      shipping_fee: 16,
      discount_amount: 0,
      actual_total: 1448,
      order_status: "Ordered",
      delivery_status: "Delivered",
      payment_status: "Paid Online",
      online_paid: 1448,
      cash_paid: 0,
      fronted_by_member_id: null,
      notes: null,
      created_at: baseTime,
    },
    {
      id: "b-nindejin",
      group_id: "g1",
      title: "TOTAL nindejin SHOP PURCHASE",
      shop_name: "nindejin",
      items_subtotal: 403,
      shipping_fee: 113,
      discount_amount: 0,
      actual_total: 516,
      order_status: "Ordered",
      delivery_status: "Delivered",
      payment_status: "Paid Online",
      online_paid: 516,
      cash_paid: 0,
      fronted_by_member_id: null,
      notes: null,
      created_at: baseTime,
    },
  ];

  const mkComp = (
    id: string,
    unit_price: number,
    quantity: number,
    payment_status: ComponentItem["payment_status"],
    online_paid: number,
    cash_paid: number,
    bundle_id: string | null = null
  ): ComponentItem => ({
    id,
    group_id: "g1",
    bundle_id,
    category: "Hardware",
    name: id,
    spec_notes: null,
    unit_price,
    quantity,
    store_label: null,
    store_url: null,
    selected: true,
    order_status: "Ordered",
    delivery_status: "Delivered",
    payment_status,
    online_paid,
    cash_paid,
    fronted_by_member_id: null,
    notes: null,
    created_at: baseTime,
  });

  const components: ComponentItem[] = [
    mkComp("esp32", 349, 1, "Paid Online", 349, 0),
    mkComp("tmc2209", 178, 3, "Paid Cash", 0, 534),
    mkComp("mon1", 1849, 1, "Paid Online", 1849, 0),
    mkComp("raspi5", 11000, 1, "Paid Both", 2757, 8243),
    mkComp("nema17", 349, 3, "Paid Online", 1047, 0),
    mkComp("psu", 800, 1, "Paid Online", 800, 0),
    mkComp("bearings", 68.3333, 6, "Paid Online", 410, 0),
    mkComp("m25", 41, 2, "Paid Online", 82, 0),
    mkComp("raspi-psu", 1079, 1, "Paid Online", 1079, 0),
    mkComp("gb1", 342, 1, "Paid Online", 342, 0),
    // 10 Unpaid items
    mkComp("fuse", 103, 1, "Unpaid", 0, 0),
    mkComp("fuse-holder", 122, 1, "Unpaid", 0, 0),
    mkComp("wago", 1108, 1, "Unpaid", 0, 0),
    mkComp("inlet", 61, 1, "Unpaid", 0, 0),
    mkComp("relay", 269, 1, "Unpaid", 0, 0),
    mkComp("brio", 1770, 1, "Unpaid", 0, 0),
    mkComp("buck", 206, 1, "Unpaid", 0, 0),
    mkComp("gb23", 1361, 1, "Unpaid", 0, 0),
    mkComp("base-link", 547, 1, "Unpaid", 0, 0),
    mkComp("mon2", 1799, 1, "Unpaid", 0, 0),
    // Bundled component (must NOT be double-counted!)
    mkComp("bundled-pin", 93, 1, "Paid Online", 0, 0, "b-xin"),
  ];

  const mkPay = (
    id: string,
    member_id: string,
    amount: number,
    method: "online" | "cash",
    status: "approved" | "pending" = "approved"
  ): Contribution => ({
    id,
    group_id: "g1",
    member_id,
    amount,
    method,
    status,
    paid_at: "2026-10-01",
    notes: null,
    receipt_url: null,
    recorded_by: "u1",
    approved_by: status === "approved" ? "u1" : null,
    created_at: baseTime,
  });

  const contributions: Contribution[] = [
    mkPay("p1", "m-divan", 349, "online"),
    mkPay("p2", "m-leonard", 644, "online"),
    mkPay("p3", "m-michael", 1261, "online"),
    mkPay("p4", "m-divan", 534, "cash"),
    mkPay("p5", "m-michael", 3500, "cash"),
    mkPay("p6", "m-divan", 3700, "cash"),
    mkPay("p7", "m-divan", 1048, "online"),
    mkPay("p8", "m-leonard", 2700, "online"),
    mkPay("p9", "m-leonard", 1000, "cash"),
    mkPay("p10", "m-divan", 43, "cash"),
    mkPay("p11", "m-divan", 342, "online"),
    mkPay("p12", "m-michael", 2000, "online"),
    mkPay("p13", "m-leonard", 2500, "online"),
    mkPay("p14", "m-divan", 2136, "online"),
    // Pending proof must not count toward approved totals
    mkPay("p15", "m-michael", 500, "online", "pending"),
  ];

  it("reconciles exact BROwsers sheet figures without double-counting bundled items", () => {
    const res = computeGroupFinancials(
      { mode: "project", target_amount: 0 },
      members,
      components,
      bundles,
      contributions
    );

    expect(res.totalProjectCost).toBe(26802);
    expect(res.totalContributions).toBe(21757);
    expect(res.remainingToCollect).toBe(5045);
    expect(res.onlineFundsReceived).toBe(12980);
    expect(res.onlineExpenses).toBe(10679);
    expect(res.onlineAvailableBalance).toBe(2301);
    expect(res.cashFundsReceived).toBe(8777);
    expect(res.cashExpenses).toBe(8777);
    expect(res.cashAvailableBalance).toBe(0);
    expect(res.totalAvailableFunds).toBe(2301);
    expect(res.unpaidItemsTotal).toBe(7346);
    expect(res.unpaidItemsCount).toBe(10);
    expect(res.pendingContributionsCount).toBe(1);
    expect(res.pendingContributionsTotal).toBe(500);

    const divan = res.memberSummaries.find((m) => m.member.id === "m-divan")!;
    const leonard = res.memberSummaries.find((m) => m.member.id === "m-leonard")!;
    const michael = res.memberSummaries.find((m) => m.member.id === "m-michael")!;

    expect(divan.balanceDue).toBe(782);
    expect(leonard.balanceDue).toBe(2090);
    expect(michael.balanceDue).toBe(2173);
    expect(michael.pendingAmount).toBe(500);
  });

  it("handles Savings Goal mode using target_amount", () => {
    const res = computeGroupFinancials(
      { mode: "savings", target_amount: 15000 },
      members.slice(0, 1),
      [],
      [],
      [mkPay("s1", "m-divan", 6000, "online")]
    );
    expect(res.totalProjectCost).toBe(15000);
    expect(res.totalContributions).toBe(6000);
    expect(res.remainingToCollect).toBe(9000);
    expect(res.progressPercent).toBe(40);
  });
});
