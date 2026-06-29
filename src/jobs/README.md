# Background Job Patterns

This repo includes safe, importable job functions and token-protected HTTP
entrypoints that Sadeepa can wire to cron, Appwrite Functions, or another
trusted serverless runner.

- `sendUnreadNotificationDigestJob` scans unread in-app notifications and can
  send a digest through the notification email adapter.
- `sendEventReminderNotificationsJob` creates event reminder notifications for
  a supplied recipient list. The HTTP route resolves recipients from active
  verified event role assignments.

Production entrypoints:

- `POST /api/jobs/notifications/digest`
- `POST /api/jobs/events/reminders`

Both require `INTERNAL_JOB_TOKEN` in `x-internal-job-token` or as a bearer
token.

Both jobs default to `dryRun: true`. A trusted runner should pass
`dryRun: false` only after environment variables and notification email delivery
are configured. No secrets are required or committed here.
