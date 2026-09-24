export function isLeftoverGeneralCommittee(name: string) {
  return name === "General";
}

export function withoutLeftoverGeneralCommittees<T extends { name: string }>(
  committees: readonly T[],
): T[] {
  return committees.filter((committee) => !isLeftoverGeneralCommittee(committee.name));
}
