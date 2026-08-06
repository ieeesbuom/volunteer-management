"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Loader2,
  Mail,
  MonitorCheck,
  Save,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTableHead, DataTableShell } from "@/components/ui/data-table";
import { Toggle } from "@/components/ui/toggle";
import {
  NOTIFICATION_TYPES,
  type NotificationPreference,
  type NotificationType,
} from "@/features/notifications/types";

type NotificationPreferenceDraft = Pick<
  NotificationPreference,
  "emailEnabled" | "inAppEnabled" | "typePreferences"
>;

function draftsEqual(a: NotificationPreferenceDraft, b: NotificationPreferenceDraft) {
  return (
    a.emailEnabled === b.emailEnabled &&
    a.inAppEnabled === b.inAppEnabled &&
    JSON.stringify(a.typePreferences) === JSON.stringify(b.typePreferences)
  );
}

export function NotificationPreferencesForm({
  initialPreference,
}: {
  initialPreference?: NotificationPreference;
}) {
  const defaultDraft: NotificationPreferenceDraft = {
    emailEnabled: false,
    inAppEnabled: true,
    typePreferences: {},
  };

  const [draft, setDraft] = useState<NotificationPreferenceDraft>({
    emailEnabled: initialPreference?.emailEnabled ?? defaultDraft.emailEnabled,
    inAppEnabled: initialPreference?.inAppEnabled ?? defaultDraft.inAppEnabled,
    typePreferences: initialPreference?.typePreferences ?? defaultDraft.typePreferences,
  });

  const [savedPreference, setSavedPreference] = useState<NotificationPreferenceDraft>(() =>
    initialPreference
      ? {
          emailEnabled: initialPreference.emailEnabled,
          inAppEnabled: initialPreference.inAppEnabled,
          typePreferences: initialPreference.typePreferences,
        }
      : defaultDraft,
  );

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");
  const [isLoading, setIsLoading] = useState(!initialPreference);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(
    () => !draftsEqual(draft, savedPreference),
    [draft, savedPreference],
  );

  const rows = useMemo(
    () =>
      NOTIFICATION_TYPES.map((type) => ({
        emailEnabled: draft.typePreferences[type]?.emailEnabled ?? draft.emailEnabled,
        inAppEnabled: draft.typePreferences[type]?.inAppEnabled ?? draft.inAppEnabled,
        label: type.replaceAll("_", " "),
        type,
      })),
    [draft],
  );

  const controlsDisabled = isLoading || isSaving;

  useEffect(() => {
    if (initialPreference) {
      return;
    }

    let cancelled = false;

    async function loadPreferences() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/notifications/preferences");
        const payload = (await response.json()) as {
          error?: string;
          preference?: NotificationPreference;
        };

        if (!response.ok || !payload.preference) {
          if (!cancelled) {
            setMessage(payload.error ?? "Could not load saved preferences.");
            setStatus("error");
          }
          return;
        }

        if (!cancelled) {
          const pref = {
            emailEnabled: payload.preference.emailEnabled,
            inAppEnabled: payload.preference.inAppEnabled,
            typePreferences: payload.preference.typePreferences,
          };
          setDraft(pref);
          setSavedPreference(pref);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [initialPreference]);

  async function savePreferences() {
    setIsSaving(true);
    setMessage("");
    setStatus("idle");

    try {
      const response = await fetch("/api/notifications/preferences", {
        body: JSON.stringify(draft),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json()) as {
        error?: string;
        preference?: NotificationPreference;
      };

      if (!response.ok || !payload.preference) {
        setMessage(payload.error ?? "Could not save preferences.");
        setStatus("error");
        return;
      }

      const pref = {
        emailEnabled: payload.preference.emailEnabled,
        inAppEnabled: payload.preference.inAppEnabled,
        typePreferences: payload.preference.typePreferences,
      };
      setDraft(pref);
      setSavedPreference(pref);
      setMessage("Notification preferences saved.");
      setStatus("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save preferences.");
      setStatus("error");
    } finally {
      setIsSaving(false);
    }
  }

  function setGlobal(field: "emailEnabled" | "inAppEnabled", checked: boolean) {
    setDraft((current) => ({
      ...current,
      [field]: checked,
    }));
    setStatus("idle");
  }

  function setTypePreference(
    type: NotificationType,
    field: "emailEnabled" | "inAppEnabled",
    checked: boolean,
  ) {
    setDraft((current) => ({
      ...current,
      typePreferences: {
        ...current.typePreferences,
        [type]: {
          ...current.typePreferences[type],
          [field]: checked,
        },
      },
    }));
    setStatus("idle");
  }

  function handleReset() {
    setDraft(savedPreference);
    setMessage("");
    setStatus("idle");
  }

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelToggleRow
          checked={draft.inAppEnabled}
          disabled={controlsDisabled}
          icon={MonitorCheck}
          label="In-app"
          onChange={(checked) => setGlobal("inAppEnabled", checked)}
        />
        <ChannelToggleRow
          checked={draft.emailEnabled}
          disabled={controlsDisabled}
          icon={Mail}
          label="Email"
          onChange={(checked) => setGlobal("emailEnabled", checked)}
        />
      </div>

      <DataTableShell minWidth={480}>
        <colgroup>
          <col />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
        </colgroup>
        <DataTableHead
          columns={[
            { label: "Notification type" },
            { label: "In-app", align: "right" },
            { label: "Email", align: "right" },
          ]}
        />
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.type}
              className="border-b border-border-subtle last:border-b-0 transition-colors hover:bg-bg-base/50"
            >
              <td className="px-4 py-3.5 text-[13px] font-medium capitalize text-text-strong">
                {row.label}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex justify-end">
                  <Toggle
                    aria-label={`${row.label} in-app notifications`}
                    checked={row.inAppEnabled}
                    disabled={controlsDisabled}
                    onCheckedChange={(checked) =>
                      setTypePreference(row.type, "inAppEnabled", checked)
                    }
                  />
                </div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex justify-end">
                  <Toggle
                    aria-label={`${row.label} email notifications`}
                    checked={row.emailEnabled}
                    disabled={controlsDisabled}
                    onCheckedChange={(checked) =>
                      setTypePreference(row.type, "emailEnabled", checked)
                    }
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTableShell>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message ? (
          <p
            className={
              status === "error"
                ? "text-[13px] font-medium text-danger"
                : "text-[13px] font-medium text-text-body"
            }
          >
            {message}
          </p>
        ) : (
          <span className="text-[13px] text-text-muted">
            {isLoading ? (
              <Loader2 className="mr-1 inline size-4 animate-spin align-[-3px]" aria-hidden="true" />
            ) : (
              <Bell className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />
            )}
            {isLoading ? "Loading saved preferences" : "Changes apply after you save"}
          </span>
        )}
        <div className="flex items-center gap-3">
          {isDirty ? (
            <button
              type="button"
              disabled={controlsDisabled}
              onClick={handleReset}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-border-subtle bg-surface-raised px-4 text-[13px] font-semibold text-text-body transition-colors hover:bg-bg-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
          ) : null}
          <Button
            disabled={controlsDisabled || !isDirty}
            onClick={() => void savePreferences()}
            type="button"
            className="cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isSaving ? "Saving" : "Save preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChannelToggleRow({
  checked,
  disabled,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-raised px-4 py-3">
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text-strong">
        <Icon className="size-4 text-text-muted" aria-hidden="true" />
        {label}
      </span>
      <Toggle
        aria-label={`${label} notifications`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
