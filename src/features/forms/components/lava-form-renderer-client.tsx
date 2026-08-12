"use client";

import {
  FormRenderer,
  type FormAvailability,
  type FormWithFields,
  type SubmitFormState,
} from "@knurdz/lava-form-builder";
import { LavaFormSurface } from "@/features/forms/components/lava-form-surface";

export function LavaFormRendererClient({
  availability,
  bannerUrl,
  connectionId,
  eventId,
  form,
  submit,
}: {
  availability: FormAvailability;
  bannerUrl: string | null;
  connectionId: string;
  eventId: string;
  form: FormWithFields;
  submit: (prev: SubmitFormState, formData: FormData) => Promise<SubmitFormState>;
}) {
  return (
    <LavaFormSurface connectionId={connectionId} eventId={eventId}>
      <FormRenderer
        availability={availability}
        bannerUrl={bannerUrl}
        form={form}
        slug={form.slug}
        submit={submit}
      />
    </LavaFormSurface>
  );
}
