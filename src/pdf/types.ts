export type VolunteerProfilePdfInput = {
  name: string;
  googleEmail: string;
  uomEmail?: string;
  sbRoles: string[];
  participations: Array<{
    eventTitle: string;
    role: string;
    committeeName?: string;
    assignedAt: string;
  }>;
  recommendations: Array<{
    fromName: string;
    eventTitle: string;
    note: string;
  }>;
  pointsLedger?: {
    total: number;
    entries: Array<{
      eventTitle: string;
      role: string;
      points: number;
      awardedAt: string;
    }>;
  };
};

export type PdfBuildResult = {
  buffer: Buffer;
  filename: string;
};
