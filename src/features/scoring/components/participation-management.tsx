"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ParticipationRecord,
  ParticipationRoster,
  ParticipationStatus,
} from "@/features/scoring/types";

const STATUS_OPTIONS: Array<{
  label: string;
  value: ParticipationStatus | "unrecorded";
}> = [
  { label: "Not recorded", value: "unrecorded" },
  { label: "Attended", value: "attended" },
  { label: "Absent", value: "absent" },
  { label: "Excused", value: "excused" },
];

export function ParticipationManagement({
  initialRoster,
}: {
  initialRoster: ParticipationRoster;
}) {
  const [roster, setRoster] = useState(initialRoster);
  const [statuses, setStatuses] = useState<Record<string, ParticipationStatus | "unrecorded">>(
    () =>
      Object.fromEntries(
        initialRoster.records.map((entry) => [
          entry.userId,
          entry.participation?.status ?? "unrecorded",
        ]),
      ),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const saveableRecords = useMemo(
    () =>
      roster.records
        .map((entry) => ({
          status: statuses[entry.userId],
          userId: entry.userId,
        }))
        .filter(
          (entry): entry is { status: ParticipationStatus; userId: string } =>
            entry.status === "attended" ||
            entry.status === "absent" ||
            entry.status === "excused",
        ),
    [roster.records, statuses],
  );

  function updateLocalStatus(userId: string, status: ParticipationStatus | "unrecorded") {
    setStatuses((current) => ({ ...current, [userId]: status }));
  }

  async function save(records = saveableRecords) {
    if (!roster.canManage || records.length === 0) {
      return;
    }

    setPending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/events/${roster.eventId}/participation`, {
        body: JSON.stringify({ records }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        records?: ParticipationRecord[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save participation records.");
      }

      const updatedByUser = new Map(
        (payload.records ?? []).map((record) => [record.userId, record]),
      );

      setRoster((current) => ({
        ...current,
        records: current.records.map((entry) => ({
          ...entry,
          participation: updatedByUser.get(entry.userId) ?? entry.participation,
        })),
      }));
      setMessage(`${payload.records?.length ?? 0} participation record saved.`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save participation records.",
      );
    } finally {
      setPending(false);
    }
  }

  async function markAllAttended() {
    const nextStatuses = Object.fromEntries(
      roster.records.map((entry) => [entry.userId, "attended" as const]),
    );

    setStatuses(nextStatuses);
    await save(
      roster.records.map((entry) => ({
        status: "attended",
        userId: entry.userId,
      })),
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
              Participation
            </CardTitle>
            <CardDescription>
              Attendance records used by grading and points calculation.
            </CardDescription>
          </div>
          {roster.canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || roster.records.length === 0}
                onClick={markAllAttended}
                type="button"
              >
                Mark all attended
              </Button>
              <Button
                disabled={pending || saveableRecords.length === 0}
                onClick={() => save()}
                type="button"
                variant="primary"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                Save records
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {roster.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] divide-y divide-border text-left text-sm">
              <thead className="text-text-secondary">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Volunteer</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Committee</th>
                  <th className="px-4 py-2 font-semibold">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.records.map((entry) => {
                  const status = statuses[entry.userId] ?? "unrecorded";

                  return (
                    <tr key={entry.userId}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-text-primary">
                          <Link
                            href={`/volunteers/${entry.userId}`}
                            className="hover:underline hover:text-primary transition-colors cursor-pointer"
                          >
                            {entry.name}
                          </Link>
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {entry.uomEmail || entry.googleEmail || "Profile unavailable"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-primary">{entry.role}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {entry.committeeName || "Event-level"}
                      </td>
                      <td className="px-4 py-3">
                        {roster.canManage ? (
                          <select
                            className="h-10 w-full min-w-40 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                            disabled={pending}
                            onChange={(event) =>
                              updateLocalStatus(
                                entry.userId,
                                event.target.value as ParticipationStatus | "unrecorded",
                              )
                            }
                            value={status}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge status={status} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Add event role assignments before recording participation.
          </p>
        )}

        {message ? (
          <p className="rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ParticipationStatus | "unrecorded" }) {
  if (status === "attended") {
    return <Badge tone="success">Attended</Badge>;
  }

  if (status === "absent") {
    return <Badge tone="danger">Absent</Badge>;
  }

  if (status === "excused") {
    return <Badge tone="warning">Excused</Badge>;
  }

  return <Badge>Not recorded</Badge>;
}
