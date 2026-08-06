"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROFILE_AVATAR_MAX_BYTES } from "@/features/access-control/lib/avatar-image";
import { formatUserFacingError } from "@/lib/utils";

type ProfileAvatarEditorProps = {
  hasCustomAvatar: boolean;
  initialAvatarUrl?: string;
  userName: string;
};

export function ProfileAvatarEditor({
  hasCustomAvatar,
  initialAvatarUrl,
  userName,
}: ProfileAvatarEditorProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [customAvatar, setCustomAvatar] = useState(hasCustomAvatar);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  async function uploadAvatar(file: File) {
    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      setStatus("error");
      setMessage("Profile photo must be 2 MB or smaller.");
      return;
    }

    setBusy("upload");
    setStatus("idle");
    setMessage("");

    try {
      const body = new FormData();
      body.set("avatar", file);

      const response = await fetch("/api/profile/avatar", {
        body,
        method: "POST",
      });
      const payload = (await response.json()) as {
        avatarUrl?: string;
        error?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(formatUserFacingError(payload.error, "Could not upload the photo."));
        return;
      }

      setAvatarUrl(payload.avatarUrl);
      setCustomAvatar(true);
      setStatus("success");
      setMessage("Profile photo updated.");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(formatUserFacingError(error, "Could not upload the photo."));
    } finally {
      setBusy(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function removeAvatar() {
    setBusy("remove");
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const payload = (await response.json()) as {
        avatarUrl?: string;
        error?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(formatUserFacingError(payload.error, "Could not remove the photo."));
        return;
      }

      setAvatarUrl(payload.avatarUrl);
      setCustomAvatar(false);
      setConfirmRemove(false);
      setStatus("success");
      setMessage(
        payload.avatarUrl
          ? "Custom photo removed. Your Google photo is shown again."
          : "Custom photo removed.",
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(formatUserFacingError(error, "Could not remove the photo."));
    } finally {
      setBusy(null);
    }
  }

  const initials = userName.trim()
    ? userName.trim().charAt(0).toUpperCase()
    : "?";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar URLs are same-origin proxy or Google CDN
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-20 shrink-0 rounded-full object-cover border border-border-subtle bg-primary-soft shadow-sm"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-primary-soft text-xl font-semibold text-primary shadow-sm">
            {initials}
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-text-strong">Profile photo</p>
          <p className="text-sm text-text-muted">
            JPEG, PNG, or WebP · max 2 MB. Images are cropped to a square.
          </p>
          {message ? (
            <p
              className={
                status === "error"
                  ? "text-sm text-danger"
                  : status === "success"
                    ? "text-sm text-success"
                    : "text-sm text-text-muted"
              }
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadAvatar(file);
            }
          }}
        />
        <Button
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="secondary"
        >
          {busy === "upload" ? (
            "Uploading…"
          ) : customAvatar ? (
            <>
              <Camera className="size-4" aria-hidden="true" />
              Replace photo
            </>
          ) : (
            <>
              <ImagePlus className="size-4" aria-hidden="true" />
              Upload photo
            </>
          )}
        </Button>
        {customAvatar ? (
          <Button
            disabled={busy !== null}
            onClick={() => setConfirmRemove(true)}
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </div>

      {confirmRemove ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(220_26%_14%/0.4)] px-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-overlay p-5 shadow-overlay">
            <h3 className="text-[15px] font-semibold text-text-strong">
              Remove profile photo?
            </h3>
            <p className="mt-2 text-sm text-text-body">
              Your custom photo will be deleted. If available, your Google account
              photo will be used again.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={busy === "remove"}
                onClick={() => setConfirmRemove(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={busy === "remove"}
                onClick={() => void removeAvatar()}
                type="button"
                variant="danger"
              >
                {busy === "remove" ? "Removing…" : "Remove photo"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
