import type { SessionUser } from "../src/features/access-control/types";

export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    authUser: {
      email: "volunteer@uom.lk",
      id: "user-1",
      name: "Test Volunteer",
    },
    eventRoles: [],
    isAdmin: false,
    profile: {
      $id: "profile-1",
      authUserId: "user-1",
      googleEmail: "volunteer@gmail.com",
      name: "Test Volunteer",
      status: "ACTIVE",
      uomEmail: "volunteer@uom.lk",
      uomVerified: true,
    },
    sbRoles: [],
    ...overrides,
  };
}
