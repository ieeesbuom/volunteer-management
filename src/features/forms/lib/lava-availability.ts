import type { FormAvailability, FormDefinition } from "@knurdz/lava-form-builder";

function formatDateTimeDisplay(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function getLavaFormAvailability(form: FormDefinition): FormAvailability {
  const now = new Date();
  const openAt = form.openAt ? new Date(form.openAt) : null;
  const closeAt = form.closeAt ? new Date(form.closeAt) : null;

  if (openAt && form.openAt && now < openAt) {
    return {
      description: `Opens ${formatDateTimeDisplay(form.openAt)}`,
      isAcceptingSubmissions: false,
      label: "Opens soon",
      state: "upcoming",
    };
  }

  if (form.status === "closed") {
    return {
      description: closeAt && form.closeAt ? `Closed on ${formatDateTimeDisplay(form.closeAt)}` : null,
      isAcceptingSubmissions: false,
      label: "Closed",
      state: "closed",
    };
  }

  if (form.status === "draft") {
    return {
      description: closeAt && form.closeAt ? `Closes ${formatDateTimeDisplay(form.closeAt)}` : null,
      isAcceptingSubmissions: false,
      label: "Coming soon",
      state: "upcoming",
    };
  }

  if (closeAt && now > closeAt) {
    return {
      description: form.closeAt ? `Closed on ${formatDateTimeDisplay(form.closeAt)}` : null,
      isAcceptingSubmissions: false,
      label: "Closed",
      state: "closed",
    };
  }

  return {
    description: closeAt && form.closeAt ? `Closes ${formatDateTimeDisplay(form.closeAt)}` : null,
    isAcceptingSubmissions: true,
    label: "Open now",
    state: "open",
  };
}
