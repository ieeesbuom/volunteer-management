# Notifications

Browser users can only read and mark their own notifications through:

- `GET /api/notifications`
- `POST /api/notifications/mark-read`

`POST /api/notifications` is reserved for trusted server/job callers. It is
disabled unless `INTERNAL_JOB_TOKEN` is configured. Trusted callers must send the
token in `x-internal-job-token` or as a bearer token. Do not expose this token to
browser code.

Trusted Appwrite Functions or cron runners can call these job entrypoints with
the same token:

- `POST /api/jobs/notifications/digest` for unread notification email digests
- `POST /api/jobs/events/reminders` for upcoming event reminders

Both endpoints default to dry runs unless the JSON body includes
`{"dryRun": false}`.

Notification email delivery is adapter-backed and disabled unless
`NOTIFICATION_EMAILS_ENABLED=true` plus SMTP settings are configured. The default
disabled adapter records only safe delivery intent.
