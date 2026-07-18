# 🏥 Clinic Management System

A comprehensive clinic management system built with Next.js, TypeScript, and Prisma. Manage appointments, billing, inventory, staff, and reports — all in one place.

## ✨ Features

- **Dashboard** — KPI cards, revenue charts, appointment status, low-stock alerts
- **Appointments** — Walk-in / Website / Phone booking with status tracking
- **Billing** — Auto-generated bill numbers, GST, discounts, multiple payment methods
- **Inventory** — Stock management with categories, suppliers, expiry tracking, low-stock alerts
- **Staff** — Doctor/Nurse/Receptionist management with profiles
- **Suppliers** — Vendor management with contact details
- **Consultation Fees** — Configurable fee types (General OPD, Follow Up, Emergency)
- **Reports** — Daily/weekly/monthly analytics with CSV export and print
- **Settings** — Clinic profile, theme colors, GST, currency configuration
- **Authentication** — Role-based login (Admin/Receptionist) with SHA-256 password hashing

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Prisma ORM (SQLite)
- **Charts:** Recharts
- **Animations:** Framer Motion
- **Icons:** Lucide React

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm / bun / yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sudaisalamboy/clinic-management-system.git

# Navigate to project directory
cd clinic-management-system

# Install dependencies
npm install
# or
bun install

# Set up the database
npx prisma db push

# Start the development server
npm run dev
# or
bun run dev
```

### Default Login

The system auto-creates a default admin account on first launch:

- **Email:** `admin@clinic.com`
- **Password:** `Cl!n1c@dm1n2026`

> ⚠️ **Change the password after first login via Settings.**

## 📁 Project Structure

```
src/
├── app/
│   ├── api/          # API routes (auth, staff, inventory, bills, etc.)
│   ├── globals.css   # Global styles + animations
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Main entry (auth router)
├── components/
│   ├── clinic/       # All clinic UI components
│   │   ├── app-shell.tsx
│   │   ├── dashboard-panel.tsx
│   │   ├── inventory-panel.tsx
│   │   ├── appointments-panel.tsx
│   │   ├── billing-panel.tsx
│   │   ├── staff-panel.tsx
│   │   ├── suppliers-panel.tsx
│   │   ├── reports-panel.tsx
│   │   ├── settings-panel.tsx
│   │   ├── empty-state.tsx
│   │   ├── skeletons.tsx
│   │   └── date-picker.tsx
│   └── ui/           # shadcn/ui components
├── lib/
│   ├── auth.ts       # Authentication (SHA-256 + sessions)
│   ├── db.ts         # Prisma client
│   └── settings.ts   # Settings helper
└── prisma/
    └── schema.prisma # Database schema
```

## 🔒 Security Features

- SHA-256 password hashing with random salt
- Rate limiting on login (5 attempts/minute)
- CORS protection (no origin reflection)
- Input validation (NoSQL injection prevention)
- HttpOnly session cookies
- No source code leaks in error messages
- All API routes require authentication

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Sudais Alam**

- GitHub: [@sudaisalamboy](https://github.com/sudaisalamboy)

---

Made with ❤️ by Sudais Alam
