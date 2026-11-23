# Ambag

**Group Hardware, Payment & Budget Tracker** — a mobile-first Progressive Web App (PWA) built with **Next.js 15**, **Tailwind CSS**, and **Supabase**.

## Features

- **Two Group Modes**
  - **Project & Payment Tracker**: Track hardware/project components by category, toggle `Selected` items, group multi-item shop checkouts into **Order Bundles**, and auto-reconcile Online vs. Cash wallets and per-member balances.
  - **Savings Goal Only**: Standalone budget tracker for saving up for a future purchase (solo or group) with target amount, optional target date, and suggested weekly savings pace.
- **Order Bundles (Solves Cart-Total Mismatches)**
  - Group multiple components from one shop checkout (e.g., Shopee/Lazada) into a single **Order Bundle** with the actual checkout total (accounting for shipping fees and vouchers) without losing the itemized list or double-counting items.
- **Per-Group Roles & Permissions (Enforced with Supabase RLS)**
  - **Leader**: Full control over components, bundles, payments, member seats, and promoting/demoting Editors.
  - **Editor**: Delegated member who can manage components, bundles, and approve/record payments.
  - **Viewer (Member)**: Read-only access + ability to **submit a Pending payment proof** (with receipt image upload) for Leader/Editor approval.
- **One-Click CSV Liquidation Export** & **BROwsers Thesis Sample Seed**.

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Run unit tests:
   ```bash
   npm test
   ```
