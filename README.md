# DSP (Delivery Service Platform)

A comprehensive delivery service management platform built with React, TypeScript, and Supabase.

## 🚀 Live Application

**Production URL**: https://dsp-omega.vercel.app/

## 📋 Overview

DSP is a role-based delivery management system that handles:
- Driver onboarding and management
- Route assignment and tracking
- Expense and payroll management
- Staff management (Admin, HR, Finance, Dispatcher)
- Real-time messaging and notifications
- Financial reporting and analytics

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Deployment**: Vercel
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router DOM

## 👥 User Roles

The system supports the following roles with different access levels:

- **Admin**: Full system access, user management, all dashboards, can message all roles
- **Route-Admin** (formerly Dispatcher): Route management, driver assignment, can message all except onboarding and inactive
- **Finance**: Expense review, payroll, financial reports, can message all except onboarding and inactive
- **HR**: Driver onboarding, training management, driver profiles, can message all except onboarding and inactive
- **Driver**: Route viewing, expense submission, profile management, can message admin/route-admin/finance/HR only
- **Onboarding**: Temporary role for applicants completing onboarding, can only message admin
- **Inactive**: Limited access (inbox only) for deactivated users, can only message admin

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Git

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd DSP

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### Environment Variables

Create a `.env.local` file with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**Important**: Do NOT include quotes around the values in `.env.local` or Vercel environment variables.

### Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

### Database Setup

1. Apply all migrations in `supabase/migrations/` in order
2. Key migrations to apply:
   - `20251109010000_add_admin_insert_drivers_policy.sql` - Admin driver creation
   - `20251109020000_backfill_missing_driver_records.sql` - Backfill existing drivers
3. Verify RLS policies are in place
4. Check that all Edge Functions are deployed

## 📁 Project Structure

```
DSP/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── admin/        # Admin-specific components
│   │   ├── dispatcher/   # Dispatcher components
│   │   ├── finance/      # Finance components
│   │   ├── hr/           # HR components
│   │   └── ui/           # shadcn/ui components
│   ├── pages/            # Page components (routes)
│   ├── hooks/             # Custom React hooks
│   ├── integrations/     # Supabase client setup
│   └── contexts/          # React contexts
├── supabase/
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge Functions
├── Docs/                 # Documentation
└── public/               # Static assets
```

## 🔐 Authentication & Authorization

### Login Routes

- `/login` - Main login (redirects based on role)
- `/dispatcher-login` - Dispatcher-specific login
- `/onboarding-login` - Onboarding applicant login

### Role-Based Redirects

After login, users are automatically redirected:
- **Admin** → `/admin` (selector) or `/admin/control-panel`
- **Dispatcher** → `/dispatcher`
- **Finance** → `/finance`
- **HR** → `/hr`
- **Driver** → `/dashboard`
- **Onboarding** → `/onboarding`
- **Inactive** → `/inbox`

## 📚 Key Features

### Admin Dashboard
- Staff management (create, edit, deactivate/reactivate)
- Driver management (view, edit all drivers)
- Onboarding application review (approve, reject, request resubmit)
- User role management
- System metrics and activity logs
- Reports export

### Staff Management
- Create staff accounts (Admin, HR, Finance, Dispatcher)
- Edit staff profiles
- Deactivate/reactivate staff (preserves work history)
- Filter by name, role, and status
- Search functionality

### Driver Management
- View all drivers with complete information
- Edit driver profiles (personal + driver-specific data)
- Activate/deactivate drivers
- Real-time updates

### Onboarding Workflow
1. Applicant creates account
2. Completes multi-step onboarding form
3. Submits application
4. Admin reviews and approves/rejects/requests resubmit
5. On approval: Driver record created, role assigned
6. Driver can log in to portal

### Finance Dashboard
- Expense review and approval
- Payroll management
- Financial reports
- Manual deductions

### HR Dashboard
- Driver onboarding forms
- Training management
- Driver table view

### Route Admin Dashboard (formerly Dispatcher)
- Route import and management
- Route assignment to drivers
- Dispatcher account management
- View all routes from all dispatchers
- Filter routes by date, status, dispatcher, driver
- Driver route viewing with filters

### Driver Portal
- View assigned routes
- Submit expenses
- View earnings
- Manage profile
- Vehicle management
- Inbox for messages

## 🗄️ Database Schema

Key tables:
- `auth.users` - Authentication (Supabase managed)
- `profiles` - Personal information for ALL users
- `drivers` - Driver-specific data (license, vehicle)
- `user_roles` - Role assignments
- `onboarding_sessions` - Onboarding form data
- `routes` - Delivery routes
- `expenses` - Driver expenses
- `notifications` - System messages

See `Docs/DATA_MODEL_REFERENCE.md` for complete schema documentation.

## 🚢 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy (automatic on push to main)

**Important**: Ensure `vercel.json` is present for SPA routing support.

See `Docs/DEPLOYMENT.md` for detailed deployment instructions.

## 📖 Documentation

- `Docs/CURRENT_FEATURES.md` - Complete feature list
- `Docs/DEPLOYMENT.md` - Deployment guide
- `Docs/DATA_MODEL_REFERENCE.md` - Database schema
- `Docs/TESTING_INSTRUCTIONS.md` - Testing procedures
- `Docs/FIXES_APPLIED.md` - Recent fixes and changes

## 🐛 Troubleshooting

### Login Issues
- Verify user has assigned role in `user_roles` table
- Check browser console for errors
- Verify RLS policies allow role queries

### Driver Not Showing
- Run backfill migration: `20251109020000_backfill_missing_driver_records.sql`
- Verify driver record exists in `drivers` table
- Check `user_id` matches between `user_roles` and `drivers`

### 404 on Refresh (Vercel)
- Ensure `vercel.json` exists with SPA rewrite rules
- Verify deployment includes `vercel.json`

## 🔄 Recent Updates (December 2025)

- **Messaging System**: Comprehensive role-based messaging rules enforced
- **Dispatcher Management**: Form split into two pages, added DSP parcel rate field
- **Route Management**: Enhanced filtering, driver route viewing, improved assignment flow
- **Route-Admin Role**: Renamed from "dispatcher" role, can manage all dispatchers and routes
- **Sender Names**: Fixed inbox to show first name + surname instead of UUIDs
- **Authorization**: Improved error handling for edge function authentication

## 📝 License

Private project - All rights reserved

## 🤝 Support

For issues or questions, check the documentation in `Docs/` or contact the development team.
