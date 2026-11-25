# VoluntIEEE

Single-repo Next.js project for VoluntIEEE (IEEE Student Branch University of Moratuwa
Volunteer Management System).

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase: PostgreSQL Database, Supabase Auth, Storage

## Product Scope

The product scope is VoluntIEEE (internal volunteer management for IEEE SB UoM):

- Google login for accounts via Supabase OAuth.
- `@uom.lk` email verification before a user can volunteer.
- One true Admin account that manages all other privileges.
- Student Branch roles: ExCom, SB Lead, SB Member.
- Event roles: Chair, Vice Chair, Committee Lead, Committee Member.
- No university index number validation.
- Chairs may attach a Google Form link or build a custom in-app form
  (registration, grants, t-shirt orders, OC progress, team registration, and more).
- SMTP-based UoM verification email sender.
- No public event discovery module.
- Lifetime volunteer points, with monthly/yearly best selections based on points
  earned during those periods.
- Structured conclusion reports, participation records, scoring, recognition,
  volunteer profile exports, notifications, and scheduler-ready background jobs.

## Setup

Use Node 22 or newer for local development.

Copy `.env.example` to `.env.local` and configure your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAIL=admin@example.com
APP_URL=http://localhost:3000
```

> **Note**: For local development, set `APP_URL=http://localhost:3000` and ensure `http://localhost:3000/api/auth/callback` is allowed in your Supabase Redirect URLs. In production environments, set `APP_URL=https://voluntieee.knurdz.org`.

### Database Initialization

Before starting the application on a new Supabase project, you must apply the database schema:
1. Open the **SQL Editor** in your Supabase Dashboard.
2. Copy and execute the contents of `scripts/supabase/schema.sql` to create all required tables (`profiles`, `profile_details`, `ieee_terms`, `system_settings`, `audit_logs`, etc.), indexes, and storage buckets.

### Google OAuth Setup

Configuring Google login requires setting up credentials in both Google Cloud Console and Supabase Dashboard:

1. In **Google Cloud Console** (**APIs & Services** → **Credentials** → **OAuth 2.0 Client IDs**), add the Supabase Auth callback URL as an **Authorized redirect URI**:
   ```txt
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   *(Note: Entering client credentials in Supabase alone is insufficient; Google will reject the login if this redirect URI is not registered in Google Cloud Console).*
2. In **Supabase Dashboard**, go to **Authentication** → **Sign in / Providers** → **Google**, enable Google, and enter your Google Client ID and Client Secret.
3. In **Authentication** → **URL Configuration**:
   - Set **Site URL** to `https://voluntieee.knurdz.org` (or `http://localhost:3000` for local dev).
   - Add both `http://localhost:3000/api/auth/callback` (for local development) and `https://voluntieee.knurdz.org/api/auth/callback` (for production) under **Redirect URLs**.

For UoM verification emails, configure SMTP in `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sender@example.com
SMTP_PASSWORD=your_smtp_password_or_app_password
SMTP_FROM_EMAIL=sender@example.com
SMTP_FROM_NAME=VoluntIEEE
```

For production background jobs and trusted notification creation, set
`INTERNAL_JOB_TOKEN` and pass it from your scheduler as either a bearer token or
`x-internal-job-token`. Workflow notification emails require
`NOTIFICATION_EMAILS_ENABLED=true` plus SMTP settings.

Optional Sentry monitoring (org `knurdz`, project `ieee-sb-vm`): set
`NEXT_PUBLIC_SENTRY_DSN` in production, and `SENTRY_AUTH_TOKEN` only on builds
that should upload source maps. Local and CI builds work without either value.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev` - local development
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript validation
- `npm run check` - lint and typecheck
- `npm run test` - unit tests
- `npm run seed:supabase` - seed initial administrative accounts, the active 2025/26 term, and default system settings into a fresh database (Warning: do not run on an existing database as it can overwrite settings or reactivate the 2025/26 term)

## Production auth checklist

- Set `APP_URL=https://voluntieee.knurdz.org` in production environment variables.
- Add `https://voluntieee.knurdz.org` to Supabase **Site URL** and `https://voluntieee.knurdz.org/api/auth/callback` to **Redirect URLs**.
- Enable Google OAuth provider in Supabase Dashboard with your Google Client ID and Client Secret.
