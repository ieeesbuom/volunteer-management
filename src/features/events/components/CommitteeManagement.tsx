"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { eventInputClasses } from "@/features/events/lib/event-ui";
import type { Committee, CommitteeMember } from "@/features/events/types";
import { cn } from "@/lib/utils";

type CommitteeWithMembers = Committee & {
  members: CommitteeMember[];
};

type CommitteeVolunteerOption = {
  googleEmail: string;
  name: string;
  uomEmail?: string;
  userId: string;
};

export function CommitteeManagement({
  canManage,
  eventId,
  initialCommittees,
  volunteerOptions,
  onCommitteesChange,
}: Readonly<{
  canManage: boolean;
  eventId: string;
  initialCommittees: CommitteeWithMembers[];
  volunteerOptions: CommitteeVolunteerOption[];
  onCommitteesChange?: (committees: CommitteeWithMembers[]) => void;
}>) {
  const [committees, setCommittees] = useState<CommitteeWithMembers[]>(initialCommittees);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingCommitteeId, setEditingCommitteeId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [committeeToDelete, setCommitteeToDelete] = useState<Committee | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{
    committeeId: string;
    memberId: string;
    volunteerName: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const volunteersByUserId = new Map(
    volunteerOptions.map((volunteer) => [volunteer.userId, volunteer]),
  );

  const refreshCommittees = useCallback(async () => {
    const response = await fetch(`/api/events/${eventId}/committees`);
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not load committees.");
      return;
    }

    const nextCommittees: CommitteeWithMembers[] = await Promise.all(
      (payload.committees as Committee[]).map(async (committee) => {
        const membersResponse = await fetch(
          `/api/events/${eventId}/committees/${committee.$id}/members`,
        );
        const membersPayload = await membersResponse.json();

        return {
          ...committee,
          members: membersResponse.ok ? (membersPayload.members ?? []) : [],
        };
      }),
    );

    setCommittees(nextCommittees);
    onCommitteesChange?.(nextCommittees);
  }, [eventId, onCommitteesChange]);

  const startEditingMembers = useCallback((committee: CommitteeWithMembers) => {
    setEditingCommitteeId(committee.$id);
    setSelectedUserIds(new Set(committee.members.map((m) => m.user_id)));
    setSearchQuery("");
  }, []);

  const sortedVolunteers = () => {
    const filtered = volunteerOptions.filter((v) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        (v.name || "").toLowerCase().includes(query) ||
        (v.googleEmail || "").toLowerCase().includes(query) ||
        (v.uomEmail || "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      const aSelected = selectedUserIds.has(a.userId);
      const bSelected = selectedUserIds.has(b.userId);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  };

  async function handleSaveMembers(committeeId: string) {
    const committee = committees.find((c) => c.$id === committeeId);
    if (!committee) return;

    setPendingAction(`save-members:${committeeId}`);
    setError("");

    const initialUserIds = new Set(committee.members.map((m) => m.user_id));
    const toAdd = Array.from(selectedUserIds).filter((userId) => !initialUserIds.has(userId));
    const toRemove = committee.members.filter((member) => !selectedUserIds.has(member.user_id));

    try {
      const addPromises = toAdd.map((userId) =>
        fetch(`/api/events/${eventId}/committees/${committeeId}/members`, {
          body: JSON.stringify({ user_id: userId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }).then(async (res) => {
          if (!res.ok) {
            const payload = await res.json();
            throw new Error(payload.error ?? "Failed to add member.");
          }
        })
      );

      const removePromises = toRemove.map((member) =>
        fetch(`/api/events/${eventId}/committees/${committeeId}/members/${member.$id}`, {
          method: "DELETE",
        }).then(async (res) => {
          if (!res.ok) {
            const payload = await res.json();
            throw new Error(payload.error ?? "Failed to remove member.");
          }
        })
      );

      await Promise.all([...addPromises, ...removePromises]);
      setEditingCommitteeId(null);
      await refreshCommittees();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update committee members.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateCommittee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-committee");
    setError("");

    try {
      const response = await fetch(`/api/events/${eventId}/committees`, {
        body: JSON.stringify({
          description: description || undefined,
          event_id: eventId,
          name,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not create committee.");
        return;
      }

      setName("");
      setDescription("");
      await refreshCommittees();
    } catch {
      setError("Could not create committee.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteCommittee(committeeId: string) {
    setPendingAction(committeeId);
    setError("");

    try {
      const response = await fetch(`/api/events/${eventId}/committees/${committeeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not delete committee.");
        return;
      }

      await refreshCommittees();
    } catch {
      setError("Could not delete committee.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveMember(committeeId: string, memberId: string) {
    setPendingAction(memberId);
    setError("");

    try {
      const response = await fetch(
        `/api/events/${eventId}/committees/${committeeId}/members/${memberId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not remove committee member.");
        return;
      }

      await refreshCommittees();
    } catch {
      setError("Could not remove committee member.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-primary" aria-hidden="true" />
          Committees
        </CardTitle>
        <CardDescription>
          Structural committees used when assigning Committee Lead and Committee Member roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {canManage ? (
          <form className="space-y-3 rounded-md border border-border p-4" onSubmit={handleCreateCommittee}>
            <h3 className="text-sm font-semibold text-text-primary">Create Committee</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium text-text-secondary" htmlFor="committee_name">
                Name
                <input
                  className={cn(eventInputClasses, "mt-1")}
                  id="committee_name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
              <label className="block text-sm font-medium text-text-secondary" htmlFor="committee_description">
                Description
                <input
                  className={cn(eventInputClasses, "mt-1")}
                  id="committee_description"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </label>
            </div>
            <Button disabled={pendingAction === "create-committee"} type="submit" variant="primary" className="cursor-pointer">
              <Plus className="size-4" aria-hidden="true" />
              {pendingAction === "create-committee" ? "Creating..." : "Create Committee"}
            </Button>
          </form>
        ) : null}

        {committees.length === 0 ? (
          <p className="text-sm text-text-secondary">No committees have been created for this event.</p>
        ) : (
          <div className="space-y-4">
            {committees.map((committee) => (
              <div className="rounded-md border border-border p-4" key={committee.$id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-text-primary">{committee.name}</h3>
                    {committee.description ? (
                      <p className="mt-1 text-sm text-text-secondary">{committee.description}</p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <Button
                      disabled={pendingAction === committee.$id}
                      onClick={() => setCommitteeToDelete(committee)}
                      type="button"
                      variant="ghost"
                      className="cursor-pointer"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-medium text-text-secondary">Members</h4>
                    {canManage && editingCommitteeId !== committee.$id ? (
                      <Button
                        onClick={() => startEditingMembers(committee)}
                        variant="secondary"
                        className="h-8 cursor-pointer px-2.5 text-xs"
                      >
                        <UserPlus className="size-3.5" aria-hidden="true" />
                        Manage Members
                      </Button>
                    ) : null}
                  </div>

                  {editingCommitteeId === committee.$id ? (
                    <div className="mt-2 rounded-lg border border-primary/20 bg-primary-soft/5 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-text-primary">Manage Committee Members</h4>
                        <span className="text-xs text-text-secondary font-medium">
                          Selected: {selectedUserIds.size} volunteers
                        </span>
                      </div>

                      <input
                        type="text"
                        placeholder="Search volunteers by name or email..."
                        className={cn(eventInputClasses, "w-full text-sm font-normal")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />

                      <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-surface divide-y divide-border">
                        {sortedVolunteers().length > 0 ? (
                          sortedVolunteers().map((volunteer) => {
                            const isSelected = selectedUserIds.has(volunteer.userId);
                            return (
                              <label
                                key={volunteer.userId}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 text-sm select-none cursor-pointer hover:bg-surface-subtle/50 transition-colors",
                                  isSelected && "bg-primary-soft/10"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-border text-primary focus:ring-primary cursor-pointer size-4"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedUserIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(volunteer.userId)) {
                                        next.delete(volunteer.userId);
                                      } else {
                                        next.add(volunteer.userId);
                                      }
                                      return next;
                                    });
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-text-primary truncate">{volunteer.name || "Volunteer"}</p>
                                  <p className="text-xs text-text-secondary truncate">{volunteer.uomEmail || volunteer.googleEmail}</p>
                                </div>
                              </label>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-sm text-text-muted">
                            No volunteers found matching &quot;{searchQuery}&quot;
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          disabled={pendingAction === `save-members:${committee.$id}`}
                          onClick={() => setEditingCommitteeId(null)}
                          type="button"
                          variant="secondary"
                          className="cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={pendingAction === `save-members:${committee.$id}`}
                          onClick={() => handleSaveMembers(committee.$id)}
                          type="button"
                          variant="primary"
                          className="cursor-pointer"
                        >
                          {pendingAction === `save-members:${committee.$id}` ? (
                            <>
                              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : committee.members.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {committee.members.map((member) => {
                        const volunteer = volunteersByUserId.get(member.user_id);

                        return (
                          <li className="flex items-center justify-between gap-3" key={member.$id}>
                            <span className="min-w-0">
                              <span className="block truncate text-text-primary">
                                {volunteer?.name || volunteer?.googleEmail || "Volunteer"}
                              </span>
                              <span className="block truncate text-xs text-text-muted">
                                {volunteer?.uomEmail || volunteer?.googleEmail || "Verified volunteer"}
                              </span>
                            </span>
                            {canManage ? (
                              <Button
                                disabled={pendingAction === member.$id}
                                onClick={() =>
                                  setMemberToRemove({
                                    committeeId: committee.$id,
                                    memberId: member.$id,
                                    volunteerName: volunteer?.name || volunteer?.googleEmail || "Volunteer",
                                  })
                                }
                                type="button"
                                variant="ghost"
                                className="cursor-pointer text-xs"
                              >
                                Remove
                              </Button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted">No members yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>

      {committeeToDelete ? (
        <ConfirmationDialog
          confirmLabel="Delete Committee"
          description={`Are you sure you want to delete the "${committeeToDelete.name}" committee? All its member associations will be permanently removed.`}
          isBusy={pendingAction === committeeToDelete.$id}
          onCancel={() => setCommitteeToDelete(null)}
          onConfirm={async () => {
            await handleDeleteCommittee(committeeToDelete.$id);
            setCommitteeToDelete(null);
          }}
          title="Delete Committee?"
        />
      ) : null}

      {memberToRemove ? (
        <ConfirmationDialog
          confirmLabel="Remove Member"
          description={`Are you sure you want to remove ${memberToRemove.volunteerName} from this committee?`}
          isBusy={pendingAction === memberToRemove.memberId}
          onCancel={() => setMemberToRemove(null)}
          onConfirm={async () => {
            await handleRemoveMember(memberToRemove.committeeId, memberToRemove.memberId);
            setMemberToRemove(null);
          }}
          title="Remove Committee Member?"
        />
      ) : null}
    </Card>
  );
}

function ConfirmationDialog({
  confirmLabel,
  description,
  isBusy,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  description: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-warning-soft text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-text-primary">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button disabled={isBusy} onClick={onCancel} type="button" variant="ghost" className="cursor-pointer">
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={onConfirm} type="button" variant="primary" className="cursor-pointer">
            {isBusy ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

