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
APP_URL=https://voluntieee.knurdz.org
```

Database schema migrations are located in `scripts/supabase/schema.sql`.

For Google login, configure Google OAuth in your Supabase Dashboard:
1. Go to **Authentication** → **Sign in / Providers** → **Google**.
2. Enter your Google Client ID and Secret.
3. In **URL Configuration**, set Site URL to `https://voluntieee.knurdz.org` (or `http://localhost:3000` for local dev) and ensure redirect URLs include `https://voluntieee.knurdz.org/api/auth/callback`.

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
- `npm run seed:supabase` - seed database from backup

## Production auth checklist

- Set `APP_URL=https://voluntieee.knurdz.org` in production environment variables.
- Add `https://voluntieee.knurdz.org` to Supabase **Site URL** and `https://voluntieee.knurdz.org/api/auth/callback` to **Redirect URLs**.
- Enable Google OAuth provider in Supabase Dashboard with your Google Client ID and Client Secret.
