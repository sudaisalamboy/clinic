# Clinic Panels — EmptyState, LoadingDots & Micro-interactions Upgrade

## Task Summary
Updated all clinic panel components to use the new shared `EmptyState` component,
replaced loading spinners with animated `LoadingDots` skeletons, and added
`hover-lift`/`row-hover` micro-interaction classes.

## Files Modified
1. `src/components/clinic/inventory-panel.tsx`
2. `src/components/clinic/suppliers-panel.tsx`
3. `src/components/clinic/consultation-fees-panel.tsx`
4. `src/components/clinic/billing-panel.tsx`
5. `src/components/clinic/appointments-panel.tsx`
6. `src/components/clinic/staff-panel.tsx`
7. `src/components/clinic/reports-panel.tsx`

## Files NOT Touched (per instructions)
- `empty-state.tsx`, `skeletons.tsx`, `dashboard-panel.tsx`, `app-shell.tsx`, `globals.css`
- All API routes
- `settings-panel.tsx` (not in task scope)

## Changes Applied

### Task 1 — EmptyState Replacement
| File | Old | New |
|------|-----|-----|
| inventory-panel.tsx | "No items found." | `<EmptyState variant="search" title="No items found" description="Try adjusting your search or add a new item" />` |
| suppliers-panel.tsx | "No suppliers yet." | `<EmptyState title="No suppliers yet" description="Add a supplier to get started" />` |
| consultation-fees-panel.tsx | "No consultation fees yet." | `<EmptyState title="No consultation fees" description="Add fee types like General OPD, Follow Up" />` |
| billing-panel.tsx | "No bills found." | `<EmptyState variant="search" title="No bills found" description="Generate a bill to get started" />` |
| appointments-panel.tsx | "No appointments found." | `<EmptyState variant="search" title="No appointments found" description="Book an appointment to get started" />` |
| staff-panel.tsx (list) | "No staff yet." | `<EmptyState title="No staff yet" description="Add doctors, nurses, or staff" />` |
| staff-panel.tsx (profile) | "No appointments yet." | `<EmptyState title="No appointments yet" description="This staff member has no appointments" />` |
| reports-panel.tsx | `<CardContent>No data</CardContent>` | `<EmptyState variant="search" title="No data available" description="Try a different date range" />` |

### Task 2 — LoadingDots Replacement
Replaced `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />` spinners:
- inventory-panel.tsx → `<LoadingDots text="Loading inventory" />`
- suppliers-panel.tsx → `<LoadingDots text="Loading suppliers" />`
- staff-panel.tsx → `<LoadingDots text="Loading staff" />` (main list only; left h-5 w-5 profile spinner intact)
- consultation-fees-panel.tsx → `<LoadingDots text="Loading fees" />`
- appointments-panel.tsx → `<LoadingDots text="Loading appointments" />`
- billing-panel.tsx → `<LoadingDots text="Loading bills" />`

`Loader2` import retained in all files because it's still used by button saving-spinners.

### Task 3 — Micro-interactions
- Added `className="hover-lift"` to clickable/hoverable Cards
  - Inventory: items card, categories card
  - Suppliers, Consultation Fees, Billing, Appointments: main panel cards
  - Staff: profile header, contact info, employment details, recent appointments, list card
  - Reports: header card, no-data card, 4 KPI cards, 2 chart cards, low stock & expiring items cards
- Added `className="row-hover"` to all table body rows (`<motion.tr>` and `<TableRow>`)
  - Excludes header rows
  - Includes form/view modal rows in billing-panel

## Verification
- `bun run lint` — EXIT CODE 0 (zero errors)
- Dev server compiled all changes successfully (per `/home/z/my-project/dev.log`)
