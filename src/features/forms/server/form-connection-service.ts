import "server-only";

import { requireAuth } from "@/features/access-control/server/current-user";
import {
  canListFormConnectionsForEvent,
  canManageFormConnectionsForEvent,
} from "@/features/forms/server/permissions";
import {
  createAppwriteFormConnectionRepository,
  type FormConnectionRepository,
} from "@/features/forms/server/form-connection-repository";
import { createFormConnectionSchema } from "@/features/forms/validation";
import { isProviderApprovedFormUrl } from "@/lib/validation/safe-links";
import type { CreateFormConnectionInput } from "@/features/forms/types";
import type { SessionUser } from "@/features/access-control/types";

type FormConnectionServiceDeps = {
  now?: () => Date;
  repository: FormConnectionRepository;
};

export function createFormConnectionService({
  now = () => new Date(),
  repository,
}: FormConnectionServiceDeps) {
  return {
    async createFormConnection({
      input,
      user,
    }: {
      input: CreateFormConnectionInput;
      user: SessionUser;
    }) {
      const body = createFormConnectionSchema.parse(input);

      if (!(await canManageFormConnectionsForEvent(user, body.eventId))) {
        throw new Error("Event form connection permission is required.");
      }

      const timestamp = now().toISOString();

      return repository.create({
        ...body,
        createdAt: timestamp,
        createdBy: user.authUser.id,
        updatedAt: timestamp,
      });
    },

    async listFormConnections({
      eventId,
      user,
    }: {
      eventId?: string;
      user: SessionUser;
    }) {
      if (!(await canListFormConnectionsForEvent(user, eventId))) {
        throw new Error("Event form connection access is required.");
      }

      return repository.list({ eventId });
    },

    async updateFormConnection({
      id,
      input,
      user,
    }: {
      id: string;
      input: Partial<CreateFormConnectionInput>;
      user: SessionUser;
    }) {
      const existing = await repository.get(id);
      if (!existing) {
        throw new Error("Form connection not found.");
      }

      if (!(await canManageFormConnectionsForEvent(user, existing.eventId))) {
        throw new Error("Event form connection permission is required.");
      }

      const provider = input.provider ?? existing.provider;
      if (input.formUrl && !isProviderApprovedFormUrl(input.formUrl, provider)) {
        throw new Error(
          "Form URLs must be HTTPS URLs approved for the selected provider.",
        );
      }

      return repository.update(id, {
        ...input,
        updatedAt: now().toISOString(),
      });
    },

    async deleteFormConnection({
      id,
      user,
    }: {
      id: string;
      user: SessionUser;
    }) {
      const existing = await repository.get(id);
      if (!existing) {
        throw new Error("Form connection not found.");
      }

      if (!(await canManageFormConnectionsForEvent(user, existing.eventId))) {
        throw new Error("Event form connection permission is required.");
      }

      return repository.delete(id);
    },
  };
}

export function createAppwriteFormConnectionService() {
  return createFormConnectionService({
    repository: createAppwriteFormConnectionRepository(),
  });
}

export async function createFormConnectionForCurrentUser(
  input: CreateFormConnectionInput,
  user?: SessionUser,
) {
  const currentUser = user ?? (await requireAuth());

  return createAppwriteFormConnectionService().createFormConnection({
    input,
    user: currentUser,
  });
}

export async function listFormConnectionsForCurrentUser(eventId?: string) {
  const user = await requireAuth();

  return createAppwriteFormConnectionService().listFormConnections({
    eventId,
    user,
  });
}

export async function updateFormConnectionForCurrentUser(
  id: string,
  input: Partial<CreateFormConnectionInput>,
  user?: SessionUser,
) {
  const currentUser = user ?? (await requireAuth());

  return createAppwriteFormConnectionService().updateFormConnection({
    id,
    input,
    user: currentUser,
  });
}

export async function deleteFormConnectionForCurrentUser(
  id: string,
  user?: SessionUser,
) {
  const currentUser = user ?? (await requireAuth());

  return createAppwriteFormConnectionService().deleteFormConnection({
    id,
    user: currentUser,
  });
}
