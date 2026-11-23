"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, getComponentTotal } from "@/lib/finance";
import type {
  ComponentItem,
  DeliveryStatus,
  OrderBundle,
  OrderStatus,
  PaymentStatus,
} from "@/lib/types";
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
  currency: string;
  canEdit: boolean;
  components: ComponentItem[];
  bundles: OrderBundle[];
  onRefresh: () => void;
}

type FilterType = "all" | "selected" | "unpaid" | "to_deliver" | "bundled";

export default function ComponentsTab({
  groupId,
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
  const [cCategory, setCCategory] = useState("1. Computing & Control");
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
    return Array.from(map.entries());
  }, [filteredStandalone]);

  function openNewComponentModal() {
    setEditingComp(null);
    setCName("");
    setCCategory("1. Computing & Control");
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
    setCCategory(c.category);
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
      category: cCategory.trim() || "General",
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
    } else {
      await supabase.from("components").insert({ ...payload, selected: true });
    }
    setModalBusy(false);
    setShowCompModal(false);
    onRefresh();
  }

  async function toggleSelected(c: ComponentItem) {
    if (!canEdit) return;
    setBusyId(c.id);
    await supabase.from("components").update({ selected: !c.selected }).eq("id", c.id);
    setBusyId(null);
    onRefresh();
  }

  async function deleteComponent(id: string) {
    if (!canEdit) return;
    if (!confirm("Delete this component?")) return;
    setBusyId(id);
    await supabase.from("components").delete().eq("id", id);
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
      setCheckedForBundle([]);
    }

    setModalBusy(false);
    setShowBundleModal(false);
    onRefresh();
  }

  async function unbundleAll(bundleId: string) {
    if (!canEdit) return;
    if (!confirm("Unbundle these items and delete the order bundle wrapper?")) return;
    setBusyId(bundleId);
    await supabase.from("components").update({ bundle_id: null }).eq("bundle_id", bundleId);
    await supabase.from("order_bundles").delete().eq("id", bundleId);
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
              <strong>{checkedForBundle.length}</strong> items selected for shop checkout bundle
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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-emerald-400" />
              Order Bundles (Actual Cart Totals — No Double Counting)
            </h3>
          </div>

          <div className="space-y-2.5">
            {filteredBundles.map((bundle) => {
              const children = components.filter((c) => c.bundle_id === bundle.id);
              const isOpen = !!expandedBundles[bundle.id];
              const diff = Math.round((Number(bundle.actual_total) - Number(bundle.items_subtotal)) * 100) / 100;

              return (
                <div
                  key={bundle.id}
                  className="rounded-xl border border-emerald-500/25 bg-[#121216] overflow-hidden"
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
                          <span className="text-[11px] text-zinc-400">
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
                            onClick={() => unbundleAll(bundle.id)}
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

      {/* Standalone Components Grouped by Category */}
      {filter !== "bundled" && (
        <div className="space-y-5">
          {groupedByCategory.length === 0 ? (
            <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 text-center text-xs text-zinc-500">
              No components match this filter.
            </div>
          ) : (
            groupedByCategory.map(([category, items]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {category}
                </h3>
                <div className="rounded-xl border border-zinc-800/90 bg-[#121216] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        {canEdit && <th className="py-2.5 pl-3 pr-1 w-8">Bundle</th>}
                        <th className="py-2.5 px-3 w-10">Use</th>
                        <th className="py-2.5 px-3">Component</th>
                        <th className="py-2.5 px-3 text-right">Qty × Unit</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3">Delivery</th>
                        <th className="py-2.5 px-3">Payment</th>
                        {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {items.map((c) => {
                        const total = getComponentTotal(c);
                        const isChecked = checkedForBundle.includes(c.id);
                        return (
                          <tr
                            key={c.id}
                            className={`hover:bg-zinc-900/50 transition ${
                              !c.selected ? "opacity-50" : ""
                            }`}
                          >
                            {canEdit && (
                              <td className="py-3 pl-3 pr-1">
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
                                  className="accent-emerald-500 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="py-3 px-3">
                              <button
                                type="button"
                                disabled={!canEdit || busyId === c.id}
                                onClick={() => toggleSelected(c)}
                                className={`h-5 w-5 rounded-md border flex items-center justify-center transition ${
                                  c.selected
                                    ? "bg-emerald-500 border-emerald-500 text-zinc-950"
                                    : "border-zinc-700 bg-zinc-900 text-transparent"
                                } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-zinc-100">{c.name}</span>
                                {c.store_url && (
                                  <a
                                    href={c.store_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300"
                                    title={c.store_label ?? "Open store link"}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              {c.spec_notes && (
                                <p className="text-[11px] text-zinc-500 mt-0.5">{c.spec_notes}</p>
                              )}
                            </td>
                            <td className="num py-3 px-3 text-right text-zinc-400 whitespace-nowrap">
                              {c.quantity} × {formatCurrency(c.unit_price, currency)}
                            </td>
                            <td className="num py-3 px-3 text-right font-semibold text-zinc-100 whitespace-nowrap">
                              {formatCurrency(total, currency)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                                {c.delivery_status}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded border text-[11px] font-medium ${paymentBadge(
                                  c.payment_status
                                )}`}
                              >
                                {c.payment_status}
                              </span>
                            </td>
                            {canEdit && (
                              <td className="py-3 px-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => openEditComponentModal(c)}
                                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteComponent(c.id)}
                                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Component Modal */}
      {showCompModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#121216] p-6 space-y-4">
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
                  <label className="block text-xs text-zinc-300 mb-1">Component Name</label>
                  <input
                    required
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="e.g. ESP32 S3"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Category</label>
                  <input
                    required
                    value={cCategory}
                    onChange={(e) => setCCategory(e.target.value)}
                    placeholder="1. Computing & Control"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Specification / Purpose</label>
                <input
                  value={cSpec}
                  onChange={(e) => setCSpec(e.target.value)}
                  placeholder="Short description"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Unit Price (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={cUnitPrice}
                    onChange={(e) => setCUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cQty}
                    onChange={(e) => setCQty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Store Label</label>
                  <input
                    value={cStoreLabel}
                    onChange={(e) => setCStoreLabel(e.target.value)}
                    placeholder="Shopee / PACRES"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Store URL</label>
                  <input
                    value={cStoreUrl}
                    onChange={(e) => setCStoreUrl(e.target.value)}
                    placeholder="https://shopee.ph/..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Order</label>
                  <select
                    value={cOrderStatus}
                    onChange={(e) => setCOrderStatus(e.target.value as OrderStatus)}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="Not Ordered">Not Ordered</option>
                    <option value="Ordered">Ordered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Delivery</label>
                  <select
                    value={cDeliveryStatus}
                    onChange={(e) => setCDeliveryStatus(e.target.value as DeliveryStatus)}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Payment</label>
                  <select
                    value={cPaymentStatus}
                    onChange={(e) => setCPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid Online">Paid Online</option>
                    <option value="Paid Cash">Paid Cash</option>
                    <option value="Paid Both">Paid Both</option>
                  </select>
                </div>
              </div>

              {cPaymentStatus === "Paid Both" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Online Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cOnlinePaid}
                      onChange={(e) => setCOnlinePaid(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Cash Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cCashPaid}
                      onChange={(e) => setCCashPaid(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#121216] p-6 space-y-4">
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
                  <label className="block text-xs text-zinc-300 mb-1">Bundle Title</label>
                  <input
                    required
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                    placeholder="e.g. TOTAL xin260426 SHOP PURCHASE"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Shop Name</label>
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
                  <label className="block text-xs text-zinc-300 mb-1">Shipping (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bShipping}
                    onChange={(e) => setBShipping(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Voucher Off (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bDiscount}
                    onChange={(e) => setBDiscount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
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
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-emerald-500/50 text-sm font-semibold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Order</label>
                  <select
                    value={bOrderStatus}
                    onChange={(e) => setBOrderStatus(e.target.value as OrderStatus)}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="Not Ordered">Not Ordered</option>
                    <option value="Ordered">Ordered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Delivery</label>
                  <select
                    value={bDeliveryStatus}
                    onChange={(e) => setBDeliveryStatus(e.target.value as DeliveryStatus)}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Payment</label>
                  <select
                    value={bPaymentStatus}
                    onChange={(e) => setBPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid Online">Paid Online</option>
                    <option value="Paid Cash">Paid Cash</option>
                    <option value="Paid Both">Paid Both</option>
                  </select>
                </div>
              </div>

              {bPaymentStatus === "Paid Both" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Online Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bOnlinePaid}
                      onChange={(e) => setBOnlinePaid(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Cash Paid (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bCashPaid}
                      onChange={(e) => setBCashPaid(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Notes</label>
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
