export const GENERAL_COMMITTEE_NAME = "General";
export const GENERAL_COMMITTEE_DESCRIPTION =
  "Default committee for event leadership (Chairs, Vice Chairs, and Leads).";

export function isGeneralCommittee(name: string) {
  return name === GENERAL_COMMITTEE_NAME;
}

export function sortCommitteesGeneralFirst<T extends { name: string }>(committees: T[]): T[] {
  return [...committees].sort((a, b) => {
    const aGeneral = isGeneralCommittee(a.name);
    const bGeneral = isGeneralCommittee(b.name);

    if (aGeneral === bGeneral) {
      return a.name.localeCompare(b.name);
    }

    return aGeneral ? -1 : 1;
  });
}
