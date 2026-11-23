export type GroupMode = "project" | "savings";
export type MemberRole = "leader" | "editor" | "viewer";
export type SplitMode = "equal" | "fixed" | "percent";
export type OrderStatus = "Not Ordered" | "Ordered";
export type DeliveryStatus = "Pending" | "In Transit" | "Delivered";
export type PaymentStatus = "Unpaid" | "Paid Online" | "Paid Cash" | "Paid Both";
export type PaymentMethod = "online" | "cash";
export type ContributionStatus = "approved" | "pending" | "rejected";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  mode: GroupMode;
  currency: string;
  target_amount: number;
  target_date: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  role: MemberRole;
  split_mode: SplitMode;
  split_value: number;
  created_at: string;
}

export interface OrderBundle {
  id: string;
  group_id: string;
  title: string;
  shop_name: string | null;
  items_subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  actual_total: number;
  order_status: OrderStatus;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  online_paid: number;
  cash_paid: number;
  fronted_by_member_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ComponentItem {
  id: string;
  group_id: string;
  bundle_id: string | null;
  category: string;
  name: string;
  spec_notes: string | null;
  unit_price: number;
  quantity: number;
  store_label: string | null;
  store_url: string | null;
  selected: boolean;
  order_status: OrderStatus;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  online_paid: number;
  cash_paid: number;
  fronted_by_member_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contribution {
  id: string;
  group_id: string;
  member_id: string;
  amount: number;
  method: PaymentMethod;
  status: ContributionStatus;
  paid_at: string;
  notes: string | null;
  receipt_url: string | null;
  recorded_by: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  invited_by: string;
  invited_by_name: string;
  display_name: string;
  invited_email: string;
  invited_user_id: string | null;
  role: "viewer" | "editor";
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface IncomingInvitation {
  id: string;
  group_id: string;
  group_name: string;
  group_description: string | null;
  invited_by_name: string;
  display_name: string;
  invited_email: string;
  role: "viewer" | "editor";
  created_at: string;
}

export interface MemberFinancialSummary {
  member: GroupMember;
  individualBill: number;
  onlinePaid: number;
  cashPaid: number;
  totalPaid: number;
  balanceDue: number;
  pendingAmount: number;
}

export interface GroupFinancialSummary {
  totalProjectCost: number;
  totalContributions: number;
  remainingToCollect: number;
  onlineFundsReceived: number;
  onlineExpenses: number;
  onlineAvailableBalance: number;
  cashFundsReceived: number;
  cashExpenses: number;
  cashAvailableBalance: number;
  totalAvailableFunds: number;
  unpaidItemsTotal: number;
  unpaidItemsCount: number;
  pendingContributionsCount: number;
  pendingContributionsTotal: number;
  memberSummaries: MemberFinancialSummary[];
  progressPercent: number;
}
