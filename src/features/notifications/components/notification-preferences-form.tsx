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
import { Badge } from "@/components/ui/badge";
import {
  NOTIFICATION_TYPES,
  type NotificationPreference,
  type NotificationType,
} from "@/features/notifications/types";

type NotificationPreferenceDraft = Pick<
  NotificationPreference,
  "emailEnabled" | "inAppEnabled" | "typePreferences"
>;

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
  
  const [isEditing, setIsEditing] = useState(false);
  const [hasSavedPreferences, setHasSavedPreferences] = useState(!!initialPreference);
  
  const [draft, setDraft] = useState<NotificationPreferenceDraft>({
    emailEnabled: initialPreference?.emailEnabled ?? defaultDraft.emailEnabled,
    inAppEnabled: initialPreference?.inAppEnabled ?? defaultDraft.inAppEnabled,
    typePreferences: initialPreference?.typePreferences ?? defaultDraft.typePreferences,
  });
  
  const [savedPreference, setSavedPreference] = useState<NotificationPreferenceDraft | null>(
    initialPreference
      ? {
          emailEnabled: initialPreference.emailEnabled,
          inAppEnabled: initialPreference.inAppEnabled,
          typePreferences: initialPreference.typePreferences,
        }
      : null
  );

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");
  const [isLoading, setIsLoading] = useState(!initialPreference);
  const [isSaving, setIsSaving] = useState(false);
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
            // If no preferences saved, default to editing mode
            setIsEditing(true);
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
          setHasSavedPreferences(true);
          setIsEditing(false);
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
      setHasSavedPreferences(true);
      setIsEditing(false);
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
  }

  const handleCancel = () => {
    if (savedPreference) {
      setDraft(savedPreference);
    }
    setIsEditing(false);
    setMessage("");
    setStatus("idle");
  };

  if (!isEditing && hasSavedPreferences) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChannelStatus
            enabled={draft.inAppEnabled}
            icon={MonitorCheck}
            label="In-app"
          />
          <ChannelStatus
            enabled={draft.emailEnabled}
            icon={Mail}
            label="Email"
          />
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-[520px] w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface-subtle text-text-secondary">
              <tr>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">In-app</th>
                <th className="px-3 py-2 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {rows.map((row) => (
                <tr key={row.type}>
                  <td className="px-3 py-2 font-medium capitalize text-text-primary">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {row.inAppEnabled ? (
                      <span className="text-success">✓ Enabled</span>
                    ) : (
                      <span className="text-text-muted">✗ Disabled</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {row.emailEnabled ? (
                      <span className="text-success">✓ Enabled</span>
                    ) : (
                      <span className="text-text-muted">✗ Disabled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-text-muted">
            <Bell className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />
            Current account only
          </span>
          <Button onClick={() => setIsEditing(true)} type="button" className="cursor-pointer">
            Edit Preferences
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelToggle
          checked={draft.inAppEnabled}
          icon={MonitorCheck}
          label="In-app"
          onChange={(checked) => setGlobal("inAppEnabled", checked)}
        />
        <ChannelToggle
          checked={draft.emailEnabled}
          icon={Mail}
          label="Email"
          onChange={(checked) => setGlobal("emailEnabled", checked)}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[520px] w-full divide-y divide-border text-left text-sm">
          <thead className="bg-surface-subtle text-text-secondary">
            <tr>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">In-app</th>
              <th className="px-3 py-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.type}>
                <td className="px-3 py-2 font-medium capitalize text-text-primary">
                  {row.label}
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${row.label} in-app notifications`}
                    checked={row.inAppEnabled}
                    className="size-4 rounded border-border cursor-pointer"
                    onChange={(event) =>
                      setTypePreference(row.type, "inAppEnabled", event.target.checked)
                    }
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${row.label} email notifications`}
                    checked={row.emailEnabled}
                    className="size-4 rounded border-border cursor-pointer"
                    onChange={(event) =>
                      setTypePreference(row.type, "emailEnabled", event.target.checked)
                    }
                    type="checkbox"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message ? (
          <p
            className={
              status === "error"
                ? "text-sm font-medium text-danger"
                : "text-sm font-medium text-success"
            }
          >
            {message}
          </p>
        ) : (
          <span className="text-sm text-text-muted">
            {isLoading ? (
              <Loader2 className="mr-1 inline size-4 animate-spin align-[-3px]" aria-hidden="true" />
            ) : (
              <Bell className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />
            )}
            {isLoading ? "Loading saved preferences" : "Current account only"}
          </span>
        )}
        <div className="flex items-center gap-3">
          <Button disabled={isSaving || isLoading} onClick={() => void savePreferences()} type="button" className="cursor-pointer">
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isSaving ? "Saving" : "Save Preferences"}
          </Button>
          {hasSavedPreferences && (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelStatus({
  enabled,
  icon: Icon,
  label,
}: {
  enabled: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-text-primary">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </span>
      <Badge tone={enabled ? "success" : "neutral"}>
        {enabled ? "Enabled" : "Disabled"}
      </Badge>
    </div>
  );
}

function ChannelToggle({
  checked,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  icon: LucideIcon;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm cursor-pointer">
      <span className="inline-flex items-center gap-2 font-medium text-text-primary">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </span>
      <input
        checked={checked}
        className="size-4 rounded border-border cursor-pointer"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

