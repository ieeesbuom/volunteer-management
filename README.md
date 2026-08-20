# Volunteer Management

Single-repo Next.js project for the IEEE Student Branch University of Moratuwa
Volunteer Management System.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Appwrite Cloud: Auth, TablesDB, Storage, Realtime, Functions, Sites

## Product Scope

The product scope is internal volunteer management for IEEE SB UoM:

- Google login for accounts.
- `@uom.lk` email verification before a user can volunteer.
- One true Admin account that manages all other privileges.
- Student Branch roles: ExCom, SB Lead, SB Member.
- Event roles: Chair, Vice Chair, Committee Lead, Committee Member.
- No university index number validation.
- Chairs may attach a Google Form link or build a custom in-app form
  (registration, grants, t-shirt orders, OC progress, team registration, and more).
  After pulling purpose/schema changes for custom forms, run `npm run setup:appwrite`.
- SMTP-based UoM verification email sender.
- No public event discovery module.
- Lifetime volunteer points, with monthly/yearly best selections based on points
  earned during those periods.
- Structured conclusion reports, participation records, scoring, recognition,
  volunteer profile exports, notifications, and scheduler-ready background jobs.

## Setup

Use Node 22 or newer for local development. The npm scripts set
`FORCE_NODE_FETCH=1` so the Appwrite server SDK works cleanly on Node 26.

Copy `.env.example` to `.env.local` and fill the Appwrite project values before
running the app. After pulling schema changes (including custom Lava forms and
new form purposes), run `npm run setup:appwrite`.

For Google login, create a Google OAuth Web Client and add this authorized
redirect URI in Google Cloud (this is Appwrite's callback, not the app URL):

```txt
https://YOUR_APPWRITE_REGION.cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/YOUR_APPWRITE_PROJECT_ID
```

Do **not** use `https://ieeevm.knurdz.org/api/auth/callback` as the Google
redirect URI. That path is the app's return URL after Appwrite completes OAuth.

Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`, then run:

```bash
npm run setup:appwrite:oauth
```

Production also needs:

- `APP_URL=https://ieeevm.knurdz.org` so OAuth redirects use the public hostname
  behind reverse proxies.
- Appwrite project Overview → add a **Web platform** with hostname
  `ieeevm.knurdz.org`, or set `APPWRITE_PRODUCTION_HOSTNAME=ieeevm.knurdz.org`
  and run `npm run appwrite:harden`.

For UoM verification emails, configure SMTP in `.env`. The app sends email
directly from the Next.js server; no KNURDZ email API is required.

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sender@example.com
SMTP_PASSWORD=your_smtp_password_or_app_password
SMTP_FROM_EMAIL=sender@example.com
SMTP_FROM_NAME=IEEE SB UoM Volunteer Management
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
- `npm run setup:appwrite` - create/reuse Appwrite tables (run after pull when schema changes, including Lava custom forms)
- `npm run setup:appwrite:oauth` - configure Appwrite Google OAuth provider
- `npm run appwrite:audit` - PII-safe Appwrite security audit (JSON)
- `npm run appwrite:harden` - apply auth/session/service hardening (CLI)
- `npm run appwrite:keys` / `appwrite:keys:sync-env` - rotate/sync API keys

## Production auth checklist

- Set `APP_URL=https://ieeevm.knurdz.org` in the production runtime env.
- Register `ieeevm.knurdz.org` as an Appwrite Web platform (`APPWRITE_PRODUCTION_HOSTNAME` + `npm run appwrite:harden`, or Appwrite Console).
- Confirm Google OAuth redirect URI points at Appwrite (`npm run setup:appwrite:oauth` prints the exact URL).
