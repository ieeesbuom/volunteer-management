export const REPORTS_ROUTE_TITLES: Record<string, string> = {
  "/reports": "Reports & exports",
  "/reports/recognition": "Recognition",
  "/reports/conclusions": "Conclusion reports",
  "/reports/volunteers": "Exports",
};

export function resolveReportsPageTitle(pathname: string) {
  if (pathname in REPORTS_ROUTE_TITLES) {
    return REPORTS_ROUTE_TITLES[pathname];
  }

  if (pathname.startsWith("/reports")) {
    return "Reports";
  }

  return "Reports";
}
