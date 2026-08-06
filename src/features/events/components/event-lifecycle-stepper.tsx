import { Check } from "lucide-react";
import type { EventStatus } from "@/features/events/types";
import { cn } from "@/lib/utils";

type EventLifecycleStepperProps = {
  currentIndex: number;
  labels: Record<EventStatus, string>;
  statuses: readonly EventStatus[];
};

export function EventLifecycleStepper({
  currentIndex,
  labels,
  statuses,
}: EventLifecycleStepperProps) {
  return (
    <div className="w-full min-w-0">
      <ol className="flex w-full min-w-0 list-none items-start p-0 m-0">
        {statuses.map((status, index) => {
          const isLast = index === statuses.length - 1;
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const leftLineActive = index > 0 && index <= currentIndex;
          const rightLineActive = !isLast && index < currentIndex;

          return (
            <li
              key={status}
              className="flex min-w-0 flex-1 flex-col items-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex h-6 w-full items-center">
                <div
                  aria-hidden
                  className={cn(
                    "h-px min-w-0 flex-1 transition-colors",
                    index === 0 ? "bg-transparent" : leftLineActive ? "bg-text-strong/25" : "bg-border-subtle",
                  )}
                />
                <div
                  className={cn(
                    "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isComplete
                      ? "border-text-strong/20 bg-text-strong text-surface-raised"
                      : isCurrent
                        ? "border-primary bg-primary text-white"
                        : "border-border-default bg-surface-raised",
                  )}
                >
                  {isComplete ? (
                    <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
                  ) : isCurrent ? (
                    <span className="size-1.5 rounded-full bg-white" aria-hidden />
                  ) : null}
                </div>
                <div
                  aria-hidden
                  className={cn(
                    "h-px min-w-0 flex-1 transition-colors",
                    isLast ? "bg-transparent" : rightLineActive ? "bg-text-strong/25" : "bg-border-subtle",
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-2.5 w-full px-0.5 text-center text-[10px] font-medium leading-snug sm:text-[11px]",
                  isCurrent ? "text-primary" : isComplete ? "text-text-strong" : "text-text-muted",
                )}
              >
                {labels[status]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
