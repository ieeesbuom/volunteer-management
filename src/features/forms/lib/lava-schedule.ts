const COLOMBO_OFFSET = "+05:30";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseCalendarDate(value: string) {
  const match = value.trim().match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidCalendarDate(year, month, day) ? { day, month, year } : null;
}

function toIso(ms: number) {
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function normalizeLavaScheduleInstant(
  value: string | null | undefined,
  endOfDay = false,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnly = parseCalendarDate(trimmed);
  if (dateOnly) {
    const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
    return toIso(
      Date.parse(
        `${dateOnly.year}-${pad2(dateOnly.month)}-${pad2(dateOnly.day)}${suffix}${COLOMBO_OFFSET}`,
      ),
    );
  }

  const localDateTime = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
  );
  if (localDateTime) {
    const second = localDateTime[6] ?? "00";
    return toIso(
      Date.parse(
        `${localDateTime[1]}-${localDateTime[2]}-${localDateTime[3]}T${localDateTime[4]}:${localDateTime[5]}:${second}${COLOMBO_OFFSET}`,
      ),
    );
  }

  return toIso(Date.parse(trimmed));
}

export function parseLavaScheduleMs(value: string, endOfDay = false): number | null {
  const iso = normalizeLavaScheduleInstant(value, endOfDay);
  if (!iso) {
    return null;
  }

  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}
