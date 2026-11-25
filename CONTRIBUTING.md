# Contributing to VoluntIEEE

This project is built for the volunteers of the IEEE Student Branch, University of Moratuwa, and community contributions are what make open-source tools like this great. We welcome all contributions, from bug fixes and UI improvements to feature additions and documentation updates.

## How to Contribute

### 1. Find an Issue

- Look for issues labeled `good first issue`, `help wanted`, or `hacktoberfest`.
- **Important:** Before you start working, please comment on the issue asking to be assigned. This prevents multiple people from working on the same thing and wasting effort.
- If you have a new idea or found a bug, please open a **New Issue** first to discuss it before writing code.

### 2. Local Development Setup

1. **Fork** the repository to your own GitHub account.
2. **Clone your fork** locally (replace `<your-username>` with your GitHub username so that `origin` points to your fork):

   ```bash
   git clone https://github.com/<your-username>/voluntieee.git
   cd voluntieee
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. **Configure your environment.** This project uses [Supabase](https://supabase.com/) for features that require signing in, so you need a Supabase project and local credentials before starting the server:
   - Create a Supabase project of your own, or ask the maintainers for access to the shared development project. For a project of your own, open the Supabase SQL Editor and run [`scripts/supabase/schema.sql`](scripts/supabase/schema.sql) to create the app's tables and policies. This schema creates `profiles`, `system_settings`, and `ieee_terms`; do not create these tables manually. If using the shared project, ask the maintainers whether its schema is already set up.
   - Copy `.env.example` to `.env.local`:

     ```bash
     cp .env.example .env.local
     ```

   - For local development, remove `APP_URL` from `.env.local` or leave it blank so sign-in redirects use your local app URL.
   - Set the environment values as follows:
     - **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` come from **Supabase Dashboard → Project Settings → API**. Keep the service role key secret.
     - **Application:** Set `ADMIN_EMAIL` to the administrator email address. `INTERNAL_JOB_TOKEN` and `VERIFICATION_PEPPER` are optional; generate unique random secrets for them if enabling internal jobs or verification features that need a pepper. `APP_URL` is optional and should be unset locally.
     - **Google OAuth (optional):** Create an OAuth 2.0 Web client in Google Cloud Console, using the redirect URL shown in Supabase's Google provider settings. Configure its client ID and secret in **Supabase Dashboard → Authentication → Providers → Google** for Supabase sign-in. `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in `.env.local` are only needed by the optional Appwrite OAuth setup script.
     - **Email (optional):** Get `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` from your SMTP provider, and use its `SMTP_PORT` and `SMTP_SECURE` settings. Set `SMTP_FROM_EMAIL` to a sender address authorized by the provider and `SMTP_FROM_NAME` to the desired sender name. SMTP is needed for verification and notification emails; leave `NOTIFICATION_EMAILS_ENABLED=false` unless you want notification emails.
     - **Sentry (optional):** Get `NEXT_PUBLIC_SENTRY_DSN` from your Sentry project's client key/DSN settings. `SENTRY_AUTH_TOKEN` is a Sentry auth token used for source-map uploads during builds; `SENTRY_ORG` and `SENTRY_PROJECT` are the corresponding Sentry slugs. The example's slugs are project defaults and can be changed for your own Sentry project.
   - If you want to load the repository's seed data, run `npm run seed:supabase` only after the schema has been applied. The seed requires the `profiles`, `system_settings`, and `ieee_terms` tables to exist; use it only in a project where that bootstrap data is intended.
   - Never commit `.env.local` or any real credentials.

5. Run the server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) to see your local version running.

### 3. Make Your Changes

- **Create a new branch:** Always branch off of the branch your pull request will target (currently `dev`), not `main`, so your branch doesn't include commits that are missing from the target. Use a descriptive naming convention:
  - `feat/<feature-name>` (for new features)
  - `fix/<bug-name>` (for bug fixes)
  - `docs/<topic>` (for documentation changes)
  - `style/<ui-change>` (for UI/CSS fixes)

- **Code Guidelines:**
  - Write clean, readable code and use TypeScript properly (avoid `any` where possible).
  - Ensure your UI changes are responsive (test on mobile view) and support dark mode where applicable.

### 4. Commit Your Changes

We use Conventional Commits. Please write clear, concise commit messages:

- `feat: Add custom congratulatory messages`
- `fix: Resolve chevron padding issue on mobile`
- `docs: Update README with deployment instructions`

### 5. Submit a Pull Request (PR)

1. Push your branch to your forked repository:
2. Open a Pull Request from your fork to the `dev` branch of this original repository.
3. **PR Description:** Provide a clear description of what you changed. Link the PR to the original issue by including a keyword like `Closes #12` or `Fixes #34`. Note that GitHub only closes the issue automatically when the PR is merged into the repository's default branch. If `dev` is not the default branch, the keyword still links the issue, but a maintainer will need to close it manually after the merge.
4. **Screenshots:** If your PR includes UI changes, please include "Before" and "After" screenshots in your PR description.
