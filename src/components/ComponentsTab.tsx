"use client";

import { Fragment, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, getComponentTotal } from "@/lib/finance";
import { logGroupNotification } from "@/lib/notify";
import type {
  ComponentItem,
  DeliveryStatus,
  OrderBundle,
  OrderStatus,
  PaymentStatus,
} from "@/lib/types";
import SelectDropdown, { type DropdownOption } from "./SelectDropdown";
import {
  Plus,
  Package,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit3,
  Layers,
  Check,
  Loader2,
  X,
  Unlink,
} from "lucide-react";

interface ComponentsTabProps {
  groupId: string;
  currentUserId: string;
  actorName: string;
  currency: string;
  canEdit: boolean;
  components: ComponentItem[];
  bundles: OrderBundle[];
  onRefresh: () => void;
}

type FilterType = "all" | "selected" | "unpaid" | "to_deliver" | "bundled";

const NEW_CATEGORY_SENTINEL = "__new_category__";

function extractCategoryNumber(cat: string): number {
  const match = cat.trim().match(/^(\d+)\s*[.):-]/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function compareCategories(a: string, b: string): number {
  const numA = extractCategoryNumber(a);
  const numB = extractCategoryNumber(b);
  if (numA !== numB) return numA - numB;
  return a.localeCompare(b);
}

const ORDER_OPTIONS: DropdownOption[] = [
  { value: "Not Ordered", label: "Not Ordered", dotColor: "bg-zinc-500" },
  { value: "Ordered", label: "Ordered", dotColor: "bg-emerald-400" },
];

const DELIVERY_OPTIONS: DropdownOption[] = [
  { value: "Pending", label: "Pending", dotColor: "bg-zinc-500" },
  { value: "In Transit", label: "In Transit", dotColor: "bg-amber-400" },
  { value: "Delivered", label: "Delivered", dotColor: "bg-emerald-400" },
];

const PAYMENT_OPTIONS: DropdownOption[] = [
  { value: "Unpaid", label: "Unpaid", dotColor: "bg-rose-400" },
  { value: "Paid Online", label: "Paid Online", dotColor: "bg-sky-400" },
  { value: "Paid Cash", label: "Paid Cash", dotColor: "bg-emerald-400" },
  { value: "Paid Both", label: "Paid Both (Split)", dotColor: "bg-violet-400" },
];

export default function ComponentsTab({
  groupId,
  currentUserId,
  actorName,
  currency,
  canEdit,
  components,
  bundles,
  onRefresh,
}: ComponentsTabProps) {
  const supabase = createClient();

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [expandedBundles, setExpandedBundles] = useState<Record<string, boolean>>({});
  const [checkedForBundle, setCheckedForBundle] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add/Edit Component Modal
  const [editingComp, setEditingComp] = useState<ComponentItem | null>(null);
  const [showCompModal, setShowCompModal] = useState(false);
  const [cName, setCName] = useState("");
  const [cCategoryChoice, setCCategoryChoice] = useState("");
  const [cNewCategoryName, setCNewCategoryName] = useState("");
  const [cSpec, setCSpec] = useState("");
  const [cUnitPrice, setCUnitPrice] = useState("");
  const [cQty, setCQty] = useState("1");
  const [cStoreLabel, setCStoreLabel] = useState("");
  const [cStoreUrl, setCStoreUrl] = useState("");
  const [cOrderStatus, setCOrderStatus] = useState<OrderStatus>("Not Ordered");
  const [cDeliveryStatus, setCDeliveryStatus] = useState<DeliveryStatus>("Pending");
  const [cPaymentStatus, setCPaymentStatus] = useState<PaymentStatus>("Unpaid");
  const [cOnlinePaid, setCOnlinePaid] = useState("0");
  const [cCashPaid, setCCashPaid] = useState("0");

  // Create/Edit Bundle Modal
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<OrderBundle | null>(null);
  const [bTitle, setBTitle] = useState("");
  const [bShop, setBShop] = useState("");
  const [bShipping, setBShipping] = useState("0");
  const [bDiscount, setBDiscount] = useState("0");
  const [bActualTotal, setBActualTotal] = useState("");
  const [bOrderStatus, setBOrderStatus] = useState<OrderStatus>("Ordered");
  const [bDeliveryStatus, setBDeliveryStatus] = useState<DeliveryStatus>("Pending");
  const [bPaymentStatus, setBPaymentStatus] = useState<PaymentStatus>("Unpaid");
  const [bOnlinePaid, setBOnlinePaid] = useState("0");
  const [bCashPaid, setBCashPaid] = useState("0");
  const [bNotes, setBNotes] = useState("");

  const [modalBusy, setModalBusy] = useState(false);

  // Existing categories sorted numerically + next auto-increment number
  const { existingCategories, nextCategoryNumber } = useMemo(() => {
    const unique = Array.from(new Set(components.map((c) => c.category.trim()).filter(Boolean)));
    unique.sort(compareCategories);
    const maxNum = unique.reduce((max, cat) => {
      const n = extractCategoryNumber(cat);
      return n !== Number.MAX_SAFE_INTEGER && n > max ? n : max;
    }, 0);
    return {
      existingCategories: unique,
      nextCategoryNumber: maxNum > 0 ? maxNum + 1 : unique.length + 1,
    };
  }, [components]);

  const categoryOptions: DropdownOption[] = useMemo(() => {
    const opts: DropdownOption[] = existingCategories.map((cat) => ({
      value: cat,
      label: cat,
    }));
    opts.push({
      value: NEW_CATEGORY_SENTINEL,
      label: `+ New Category (#${nextCategoryNumber})`,
      dotColor: "bg-emerald-400",
    });
    return opts;
  }, [existingCategories, nextCategoryNumber]);

  const standaloneComponents = useMemo(
    () => components.filter((c) => !c.bundle_id),
    [components]
  );

  const filteredStandalone = useMemo(() => {
    return standaloneComponents.filter((c) => {
      if (filter === "bundled") return false;
      if (filter === "selected" && !c.selected) return false;
      if (filter === "unpaid" && (!c.selected || c.payment_status !== "Unpaid")) return false;
      if (filter === "to_deliver" && (!c.selected || c.delivery_status === "Delivered")) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          (c.spec_notes ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [standaloneComponents, filter, search]);

  const filteredBundles = useMemo(() => {
    return bundles.filter((b) => {
      if (filter === "unpaid" && b.payment_status !== "Unpaid") return false;
      if (filter === "to_deliver" && b.delivery_status === "Delivered") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const childMatch = components
          .filter((c) => c.bundle_id === b.id)
          .some((c) => c.name.toLowerCase().includes(q));
        return (
          b.title.toLowerCase().includes(q) ||
          (b.shop_name ?? "").toLowerCase().includes(q) ||
          childMatch
        );
      }
      return true;
    });
  }, [bundles, components, filter, search]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, ComponentItem[]>();
    for (const c of filteredStandalone) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => compareCategories(a, b));
  }, [filteredStandalone]);

  function openNewComponentModal() {
    setEditingComp(null);
    setCName("");
    setCCategoryChoice(existingCategories[0] ?? NEW_CATEGORY_SENTINEL);
    setCNewCategoryName("");
    setCSpec("");
    setCUnitPrice("");
    setCQty("1");
    setCStoreLabel("");
    setCStoreUrl("");
    setCOrderStatus("Not Ordered");
    setCDeliveryStatus("Pending");
    setCPaymentStatus("Unpaid");
    setCOnlinePaid("0");
    setCCashPaid("0");
    setShowCompModal(true);
  }

  function openEditComponentModal(c: ComponentItem) {
    setEditingComp(c);
    setCName(c.name);
    setCCategoryChoice(c.category);
    setCNewCategoryName("");
    setCSpec(c.spec_notes ?? "");
    setCUnitPrice(String(c.unit_price));
    setCQty(String(c.quantity));
    setCStoreLabel(c.store_label ?? "");
    setCStoreUrl(c.store_url ?? "");
    setCOrderStatus(c.order_status);
    setCDeliveryStatus(c.delivery_status);
    setCPaymentStatus(c.payment_status);
    setCOnlinePaid(String(c.online_paid));
    setCCashPaid(String(c.cash_paid));
    setShowCompModal(true);
  }

  async function handleSaveComponent(e: React.FormEvent) {
    e.preventDefault();
    setModalBusy(true);
    const unitPrice = Number(cUnitPrice) || 0;
    const qty = Math.max(1, parseInt(cQty, 10) || 1);
    const total = Math.round(unitPrice * qty * 100) / 100;

    let finalCategory = cCategoryChoice;
    if (cCategoryChoice === NEW_CATEGORY_SENTINEL) {
      const cleanName = cNewCategoryName.trim().replace(/^\d+\s*[.):-]\s*/, "");
      finalCategory = cleanName
        ? `${nextCategoryNumber}. ${cleanName}`
        : `${nextCategoryNumber}. General`;
    }

    let onlinePaid = Number(cOnlinePaid) || 0;
    let cashPaid = Number(cCashPaid) || 0;
    if (cPaymentStatus === "Paid Online" && onlinePaid === 0) onlinePaid = total;
    if (cPaymentStatus === "Paid Cash" && cashPaid === 0) cashPaid = total;
    if (cPaymentStatus === "Unpaid") {
      onlinePaid = 0;
      cashPaid = 0;
    }

    const payload = {
      group_id: groupId,
      name: cName.trim(),
      category: finalCategory,
      spec_notes: cSpec.trim() || null,
      unit_price: unitPrice,
      quantity: qty,
      store_label: cStoreLabel.trim() || null,
      store_url: cStoreUrl.trim() || null,
      order_status: cOrderStatus,
      delivery_status: cDeliveryStatus,
      payment_status: cPaymentStatus,
      online_paid: onlinePaid,
      cash_paid: cashPaid,
    };

    if (editingComp) {
      await supabase.from("components").update(payload).eq("id", editingComp.id);
      await logGroupNotification(supabase, {
        groupId,
        actorUserId: currentUserId,
        actorName,
        actionType: "component_updated",
        message: `${actorName} updated "${payload.name}" (${formatCurrency(total, currency)} • ${payload.payment_status})`,
      });
    } else {
      await supabase.from("components").insert({ ...payload, selected: true });
      await logGroupNotification(supabase, {
        groupId,
        actorUserId: currentUserId,
        actorName,
        actionType: "component_added",
        message: `${actorName} added "${payload.name}" to ${finalCategory} (${formatCurrency(total, currency)})`,
      });
    }
    setModalBusy(false);
    setShowCompModal(false);
    onRefresh();
  }

  async function toggleSelected(c: ComponentItem) {
    if (!canEdit) return;
    setBusyId(c.id);
    const nextVal = !c.selected;
    await supabase.from("components").update({ selected: nextVal }).eq("id", c.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "component_toggled",
      message: `${actorName} ${nextVal ? "included" : "excluded"} "${c.name}" in the active budget`,
    });
    setBusyId(null);
    onRefresh();
  }

  async function deleteComponent(c: ComponentItem) {
    if (!canEdit) return;
    if (!confirm(`Delete "${c.name}"?`)) return;
    setBusyId(c.id);
    await supabase.from("components").delete().eq("id", c.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "component_deleted",
      message: `${actorName} removed component "${c.name}"`,
    });
    setBusyId(null);
    onRefresh();
  }

  function openCreateBundleFromChecked() {
    const items = components.filter((c) => checkedForBundle.includes(c.id));
    const sub = items.reduce((s, c) => s + getComponentTotal(c), 0);
    setEditingBundle(null);
    setBTitle("");
    setBShop(items[0]?.store_label ?? "");
    setBShipping("0");
    setBDiscount("0");
    setBActualTotal(String(Math.round(sub * 100) / 100));
    setBOrderStatus("Ordered");
    setBDeliveryStatus("Pending");
    setBPaymentStatus("Unpaid");
    setBOnlinePaid("0");
    setBCashPaid("0");
    setBNotes("");
    setShowBundleModal(true);
  }

  function openEditBundle(b: OrderBundle) {
    setEditingBundle(b);
    setBTitle(b.title);
    setBShop(b.shop_name ?? "");
    setBShipping(String(b.shipping_fee));
    setBDiscount(String(b.discount_amount));
    setBActualTotal(String(b.actual_total));
    setBOrderStatus(b.order_status);
    setBDeliveryStatus(b.delivery_status);
    setBPaymentStatus(b.payment_status);
    setBOnlinePaid(String(b.online_paid));
    setBCashPaid(String(b.cash_paid));
    setBNotes(b.notes ?? "");
    setShowBundleModal(true);
  }

  async function handleSaveBundle(e: React.FormEvent) {
    e.preventDefault();
    setModalBusy(true);
    const actual = Number(bActualTotal) || 0;
    let onlinePaid = Number(bOnlinePaid) || 0;
    let cashPaid = Number(bCashPaid) || 0;
    if (bPaymentStatus === "Paid Online" && onlinePaid === 0) onlinePaid = actual;
    if (bPaymentStatus === "Paid Cash" && cashPaid === 0) cashPaid = actual;
    if (bPaymentStatus === "Unpaid") {
      onlinePaid = 0;
      cashPaid = 0;
    }

    if (editingBundle) {
      await supabase
        .from("order_bundles")
        .update({
          title: bTitle.trim(),
          shop_name: bShop.trim() || null,
          shipping_fee: Number(bShipping) || 0,
          discount_amount: Number(bDiscount) || 0,
          actual_total: actual,
          order_status: bOrderStatus,
          delivery_status: bDeliveryStatus,
          payment_status: bPaymentStatus,
          online_paid: onlinePaid,
          cash_paid: cashPaid,
          notes: bNotes.trim() || null,
        })
        .eq("id", editingBundle.id);

      await logGroupNotification(supabase, {
        groupId,
        actorUserId: currentUserId,
        actorName,
        actionType: "bundle_updated",
        message: `${actorName} updated Order Bundle "${bTitle.trim()}" (${formatCurrency(actual, currency)} • ${bPaymentStatus})`,
      });
    } else {
      const items = components.filter((c) => checkedForBundle.includes(c.id));
      const sub = items.reduce((s, c) => s + getComponentTotal(c), 0);

      const { data: created } = await supabase
        .from("order_bundles")
        .insert({
          group_id: groupId,
          title: bTitle.trim(),
          shop_name: bShop.trim() || null,
          items_subtotal: Math.round(sub * 100) / 100,
          shipping_fee: Number(bShipping) || 0,
          discount_amount: Number(bDiscount) || 0,
          actual_total: actual,
          order_status: bOrderStatus,
          delivery_status: bDeliveryStatus,
          payment_status: bPaymentStatus,
          online_paid: onlinePaid,
          cash_paid: cashPaid,
          notes: bNotes.trim() || null,
        })
        .select()
        .single();

      if (created && checkedForBundle.length > 0) {
        await supabase
          .from("components")
          .update({
            bundle_id: created.id,
            selected: true,
            online_paid: 0,
            cash_paid: 0,
          })
          .in("id", checkedForBundle);
      }

      await logGroupNotification(supabase, {
        groupId,
        actorUserId: currentUserId,
        actorName,
        actionType: "bundle_created",
        message: `${actorName} created Order Bundle "${bTitle.trim()}" with ${items.length} items (${formatCurrency(actual, currency)})`,
      });
      setCheckedForBundle([]);
    }

    setModalBusy(false);
    setShowBundleModal(false);
    onRefresh();
  }

  async function unbundleAll(b: OrderBundle) {
    if (!canEdit) return;
    if (!confirm(`Unbundle "${b.title}" and delete the bundle wrapper?`)) return;
    setBusyId(b.id);
    await supabase.from("components").update({ bundle_id: null }).eq("bundle_id", b.id);
    await supabase.from("order_bundles").delete().eq("id", b.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "bundle_deleted",
      message: `${actorName} unbundled "${b.title}"`,
    });
    setBusyId(null);
    onRefresh();
  }

  const paymentBadge = (status: PaymentStatus) => {
    switch (status) {
      case "Paid Online":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "Paid Cash":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "Paid Both":
        return "bg-violet-500/15 text-violet-300 border-violet-500/30";
      default:
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    }
  };

  const totalColCount = canEdit ? 8 : 6;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "All"],
              ["selected", "Selected"],
              ["bundled", `Order Bundles (${bundles.length})`],
              ["unpaid", "Unpaid"],
              ["to_deliver", "To Deliver"],
            ] as [FilterType, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filter === key
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components..."
            className="w-full sm:w-52 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          {canEdit && (
            <button
              onClick={openNewComponentModal}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Floating Bundle Action Bar */}
      {canEdit && checkedForBundle.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-xs text-emerald-200">
            <Layers className="h-4 w-4 text-emerald-400" />
            <span>
              <strong className="num">{checkedForBundle.length}</strong> items selected for shop checkout bundle
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCheckedForBundle([])}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-xs text-zinc-300 cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={openCreateBundleFromChecked}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              <Package className="h-3.5 w-3.5" /> Group into Order Bundle
            </button>
          </div>
        </div>
      )}

      {/* Order Bundles Section */}
      {filteredBundles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-emerald-400" />
            Order Bundles (Actual Cart Totals — No Double Counting)
          </h3>

          <div className="space-y-2.5">
            {filteredBundles.map((bundle) => {
              const children = components.filter((c) => c.bundle_id === bundle.id);
              const isOpen = !!expandedBundles[bundle.id];
              const diff =
                Math.round((Number(bundle.actual_total) - Number(bundle.items_subtotal)) * 100) /
                100;

              return (
                <div
                  key={bundle.id}
                  className="fintech-card rounded-xl border-emerald-500/25 overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() =>
                          setExpandedBundles((prev) => ({ ...prev, [bundle.id]: !isOpen }))
                        }
                        className="mt-0.5 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{bundle.title}</span>
                          {bundle.shop_name && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {bundle.shop_name}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-400 tnum">
                            {children.length} items inside
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Items subtotal:{" "}
                          <span className="num text-zinc-300">
                            {formatCurrency(bundle.items_subtotal, currency)}
                          </span>
                          {diff !== 0 && (
                            <span className="num ml-2 text-amber-300">
                              ({diff > 0 ? "+" : ""}
                              {formatCurrency(diff, currency)} shipping/vouchers delta)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${paymentBadge(
                          bundle.payment_status
                        )}`}
                      >
                        {bundle.payment_status}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                        {bundle.delivery_status}
                      </span>
                      <span className="num text-sm font-semibold text-emerald-300">
                        {formatCurrency(bundle.actual_total, currency)}
                      </span>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditBundle(bundle)}
                            title="Edit Order Bundle"
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => unbundleAll(bundle)}
                            disabled={busyId === bundle.id}
                            title="Unbundle items"
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-zinc-800/80 bg-zinc-950/60 px-4 py-3">
                      <p className="text-[11px] text-zinc-500 mb-2">
                        Itemized components covered by this checkout total (excluded from standalone sum):
                      </p>
                      <div className="divide-y divide-zinc-800/60">
                        {children.map((item) => (
                          <div
                            key={item.id}
                            className="py-2 flex items-center justify-between text-xs gap-2"
                          >
                            <div>
                              <span className="text-zinc-200">{item.name}</span>
                              {item.spec_notes && (
                                <span className="text-zinc-500 ml-2">({item.spec_notes})</span>
                              )}
                            </div>
                            <span className="num text-zinc-400 shrink-0">
                              {item.quantity} × {formatCurrency(item.unit_price, currency)} ={" "}
                              {formatCurrency(getComponentTotal(item), currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unified Fixed-Column Components Table (consistent alignment across all categories) */}
      {filter !== "bundled" && (
        <div>
          {groupedByCategory.length === 0 ? (
            <div className="fintech-card p-8 rounded-2xl text-center text-xs text-zinc-500">
              No components match this filter.
            </div>
          ) : (
            <div className="fintech-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-[860px] text-left text-xs">
                  <colgroup>
                    {canEdit && <col className="w-[62px]" />}
                    <col className="w-[54px]" />
                    <col className="w-auto" />
                    <col className="w-[148px]" />
                    <col className="w-[116px]" />
                    <col className="w-[104px]" />
                    <col className="w-[116px]" />
                    {canEdit && <col className="w-[82px]" />}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-zinc-800/90 bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-500">
                      {canEdit && <th className="py-3 pl-4 pr-2 font-medium text-center">Bundle</th>}
                      <th className="py-3 px-2 font-medium text-center">Use</th>
                      <th className="py-3 px-3 font-medium">Component</th>
                      <th className="py-3 px-3 font-medium text-right">Qty × Unit</th>
                      <th className="py-3 px-3 font-medium text-right">Total</th>
                      <th className="py-3 px-3 font-medium">Delivery</th>
                      <th className="py-3 px-3 font-medium">Payment</th>
                      {canEdit && <th className="py-3 pl-2 pr-4 font-medium text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {groupedByCategory.map(([category, items]) => {
                      const catSubtotal = items
                        .filter((i) => i.selected)
                        .reduce((s, i) => s + getComponentTotal(i), 0);

                      return (
                        <Fragment key={category}>
                          {/* Category Section Divider Row */}
                          <tr className="bg-zinc-900/75 border-y border-zinc-800/80">
                            <td colSpan={totalColCount} className="py-2.5 px-4">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
                                  {category}
                                  <span className="ml-2 text-zinc-500 font-normal normal-case tnum">
                                    ({items.length} item{items.length === 1 ? "" : "s"})
                                  </span>
                                </span>
                                <span className="num text-[11px] font-medium text-zinc-400">
                                  Subtotal: {formatCurrency(catSubtotal, currency)}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {items.map((c) => {
                            const total = getComponentTotal(c);
                            const isChecked = checkedForBundle.includes(c.id);
                            return (
                              <tr
                                key={c.id}
                                className={`hover:bg-zinc-900/45 transition ${
                                  !c.selected ? "opacity-45" : ""
                                }`}
                              >
                                {canEdit && (
                                  <td className="py-3 pl-4 pr-2 text-center align-middle">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCheckedForBundle((prev) => [...prev, c.id]);
                                        } else {
                                          setCheckedForBundle((prev) =>
                                            prev.filter((id) => id !== c.id)
                                          );
                                        }
                                      }}
                                      title="Select to group into Order Bundle"
                                      className="h-3.5 w-3.5 accent-emerald-500 cursor-pointer align-middle"
                                    />
                                  </td>
                                )}
                                <td className="py-3 px-2 text-center align-middle">
                                  <button
                                    type="button"
                                    disabled={!canEdit || busyId === c.id}
                                    onClick={() => toggleSelected(c)}
                                    className={`mx-auto h-5 w-5 rounded-md border flex items-center justify-center transition ${
                                      c.selected
                                        ? "bg-emerald-500 border-emerald-500 text-zinc-950"
                                        : "border-zinc-700 bg-zinc-900 text-transparent"
                                    } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                                <td className="py-3 px-3 align-middle">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-medium text-zinc-100 truncate">
                                      {c.name}
                                    </span>
                                    {c.store_url && (
                                      <a
                                        href={c.store_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-400 hover:text-emerald-300 shrink-0"
                                        title={c.store_label ?? "Open store link"}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  {c.spec_notes && (
                                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                                      {c.spec_notes}
                                    </p>
                                  )}
                                </td>
                                <td className="num py-3 px-3 text-right text-zinc-400 whitespace-nowrap align-middle">
                                  {c.quantity} × {formatCurrency(c.unit_price, currency)}
                                </td>
                                <td className="num py-3 px-3 text-right font-semibold text-zinc-100 whitespace-nowrap align-middle">
                                  {formatCurrency(total, currency)}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap align-middle">
                                  <span className="inline-block px-2 py-0.5 rounded bg-zinc-800/90 text-zinc-300 text-[11px]">
                                    {c.delivery_status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap align-middle">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${paymentBadge(
                                      c.payment_status
                                    )}`}
                                  >
                                    {c.payment_status}
                                  </span>
                                </td>
                                {canEdit && (
                                  <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap align-middle">
                                    <div className="inline-flex items-center gap-0.5">
                                      <button
                                        onClick={() => openEditComponentModal(c)}
                                        title="Edit component"
                                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                                      >
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => deleteComponent(c)}
                                        title="Delete component"
                                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Component Modal */}
      {showCompModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#111115] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingComp ? "Edit Component" : "Add Component"}
              </h2>
              <button onClick={() => setShowCompModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveComponent} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Component Name</label>
                  <input
                    required
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="e.g. ESP32 S3"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <SelectDropdown
                    value={cCategoryChoice}
                    onChange={setCCategoryChoice}
                    options={categoryOptions}
                    placeholder="Choose category..."
                  />
                </div>
              </div>

              {cCategoryChoice === NEW_CATEGORY_SENTINEL && (
                <div>
                  <label className="block text-xs font-medium text-emerald-300 mb-1">
                    New Category Name (auto-numbered)
                  </label>
                  <div className="flex items-center rounded-xl bg-zinc-900 border border-emerald-500/50 overflow-hidden">
                    <span className="num px-3 py-2 bg-emerald-500/15 text-emerald-300 text-sm font-semibold border-r border-emerald-500/30 select-none">
                      {nextCategoryNumber}.
                    </span>
                    <input
                      required
                      value={cNewCategoryName}
                      onChange={(e) => setCNewCategoryName(e.target.value)}
                      placeholder="e.g. Sensors & Safety"
                      className="flex-1 px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Specification / Purpose</label>
                <input
                  value={cSpec}
                  onChange={(e) => setCSpec(e.target.value)}
                  placeholder="Short description"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Unit Price (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={cUnitPrice}
                    onChange={(e) => setCUnitPrice(e.target.value)}
                    className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cQty}
                    onChange={(e) => setCQty(e.target.value)}
                    className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Store Label</label>
                  <input
                    value={cStoreLabel}
                    onChange={(e) => setCStoreLabel(e.target.value)}
                    placeholder="Shopee / PACRES"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Store URL</label>
                  <input
                    value={cStoreUrl}
                    onChange={(e) => setCStoreUrl(e.target.value)}
                    placeholder="https://shopee.ph/..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Order</label>
                  <SelectDropdown
                    size="sm"
                    value={cOrderStatus}
                    onChange={(v) => setCOrderStatus(v as OrderStatus)}
                    options={ORDER_OPTIONS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Delivery</label>
                  <SelectDropdown
                    size="sm"
                    value={cDeliveryStatus}
                    onChange={(v) => setCDeliveryStatus(v as DeliveryStatus)}
                    options={DELIVERY_OPTIONS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Payment</label>
                  <SelectDropdown
                    size="sm"
                    align="right"
                    value={cPaymentStatus}
                    onChange={(v) => setCPaymentStatus(v as PaymentStatus)}
                    options={PAYMENT_OPTIONS}
                  />
                </div>
              </div>

              {cPaymentStatus === "Paid Both" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Online Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cOnlinePaid}
                      onChange={(e) => setCOnlinePaid(e.target.value)}
                      className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Cash Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cCashPaid}
                      onChange={(e) => setCCashPaid(e.target.value)}
                      className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalBusy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                >
                  {modalBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Order Bundle Modal */}
      {showBundleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#111115] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {editingBundle ? "Edit Order Bundle" : "Create Order Bundle"}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Enter the real checkout cart total (including shipping/vouchers) so the budget matches what you actually paid.
                </p>
              </div>
              <button onClick={() => setShowBundleModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBundle} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Bundle Title</label>
                  <input
                    required
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                    placeholder="e.g. TOTAL xin260426 SHOP PURCHASE"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Shop Name</label>
                  <input
                    value={bShop}
                    onChange={(e) => setBShop(e.target.value)}
                    placeholder="e.g. xin260426 (Shopee)"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Shipping (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bShipping}
                    onChange={(e) => setBShipping(e.target.value)}
                    className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Voucher Off (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bDiscount}
                    onChange={(e) => setBDiscount(e.target.value)}
                    className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-emerald-300 font-semibold mb-1">
                    Actual Cart Total (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={bActualTotal}
                    onChange={(e) => setBActualTotal(e.target.value)}
                    className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-emerald-500/50 text-sm font-semibold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Order</label>
                  <SelectDropdown
                    size="sm"
                    value={bOrderStatus}
                    onChange={(v) => setBOrderStatus(v as OrderStatus)}
                    options={ORDER_OPTIONS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Delivery</label>
                  <SelectDropdown
                    size="sm"
                    value={bDeliveryStatus}
                    onChange={(v) => setBDeliveryStatus(v as DeliveryStatus)}
                    options={DELIVERY_OPTIONS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Payment</label>
                  <SelectDropdown
                    size="sm"
                    align="right"
                    value={bPaymentStatus}
                    onChange={(v) => setBPaymentStatus(v as PaymentStatus)}
                    options={PAYMENT_OPTIONS}
                  />
                </div>
              </div>

              {bPaymentStatus === "Paid Both" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Online Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bOnlinePaid}
                      onChange={(e) => setBOnlinePaid(e.target.value)}
                      className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Cash Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bCashPaid}
                      onChange={(e) => setBCashPaid(e.target.value)}
                      className="num w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
                <input
                  value={bNotes}
                  onChange={(e) => setBNotes(e.target.value)}
                  placeholder="Optional checkout reference or notes"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBundleModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalBusy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                >
                  {modalBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingBundle ? "Save Bundle" : "Create Bundle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
