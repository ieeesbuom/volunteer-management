"use client";

import { useEffect, useMemo, useState, startTransition, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Award,
  BookOpen,
  Sliders,
  AlertCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/features/access-control/types";
import {
  toggleTopBoardExclusion,
  listVolunteers,
  listDetailedReviews,
  getVolunteerActiveEventRole,
  listAllActiveEvents,
} from "../server/actions";
import type {
  PointLedgerEntry,
  GradeRequest,
  GradeAuditEntry,
} from "../types";


interface VolunteerOption {
  email?: string;
  id: string;
  name: string;
}

interface EventOption {
  eventId: string;
  eventTitle: string;
}

type DashboardRole = "Admin" | "Chairperson" | "Committee Lead" | "Member";

interface DetailedGradeReview {
  $id: string;
  gradeRequestId: string;
  reviewerId: string;
  reviewerName: string;
  volunteerName: string;
  eventId: string;
  eventTitle?: string;
  gradeValue: number;
  submittedAt: string;
  audit_metadata?: string;
}

export function VolunteerSelect({
  value,
  onChange,
  volunteers,
  loading,
  error,
  placeholder = "Select a volunteer...",
}: {
  value: string;
  onChange: (val: string) => void;
  volunteers: VolunteerOption[];
  loading: boolean;
  error: string | null;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedVolunteer = volunteers.find((v) => v.id === value);
  const filteredVolunteers = volunteers.filter((v) =>
    `${v.name} ${v.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative space-y-1" ref={containerRef}>
      <div
        className={`w-full px-3 py-2 border border-border rounded-md text-sm bg-surface flex justify-between items-center select-none ${
          loading || error ? "cursor-not-allowed opacity-75" : "cursor-pointer"
        }`}
        onClick={() => {
          if (!loading && !error) {
            setIsOpen(!isOpen);
          }
        }}
      >
        <span className={selectedVolunteer ? "text-text-primary" : "text-text-secondary"}>
          {loading ? "Loading volunteers..." : selectedVolunteer ? selectedVolunteer.name : placeholder}
        </span>
        <span className="text-xs text-text-secondary">▼</span>
      </div>
      {error ? (
        <p className="text-xs text-red-500">
          Failed to load volunteers. Refresh the page or try again after the volunteer list is available.
        </p>
      ) : null}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-surface border border-border shadow-lg max-h-60 overflow-y-auto flex flex-col p-1 gap-1">
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-1.5 text-sm border border-border rounded bg-surface-muted"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          {loading ? (
            <div className="px-2 py-1.5 text-sm text-text-secondary font-medium">Loading...</div>
          ) : filteredVolunteers.length > 0 ? (
            filteredVolunteers.map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  onChange(v.id);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`px-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${
                  v.id === value
                    ? "bg-primary-soft text-primary font-semibold"
                    : "hover:bg-surface-muted text-text-primary"
                }`}
              >
                <span className="block font-medium">{v.name}</span>
                {v.email ? (
                  <span className="block text-xs text-text-muted">{v.email}</span>
                ) : null}
              </div>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-text-secondary">No volunteers found</div>
          )}
        </div>
      )}
    </div>
  );
}

function isDashboardRole(role: string | null): role is DashboardRole {
  return role === "Admin" || role === "Chairperson" || role === "Committee Lead" || role === "Member";
}

export function ScoringDashboard({
  initialEvents = [],
  initialVolunteers = [],
  initialVolunteersEventId,
  user,
  userRole,
}: {
  initialEvents?: EventOption[];
  initialVolunteers?: VolunteerOption[];
  initialVolunteersEventId?: string;
  user: SessionUser;
  userRole?: DashboardRole;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qEventId = searchParams.get("eventId");
  const rawRole = searchParams.get("role");
  const qRole = isDashboardRole(rawRole) ? rawRole : null;
  const [activeTab, setActiveTab] = useState<string>("leaderboard");

  const [leaderboard, setLeaderboard] = useState<
    { userId: string; name: string; points: number }[]
  >([]);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);

  // Selection states for Admin
  const [allEvents, setAllEvents] = useState<EventOption[]>(initialEvents);
  const [adminSelEvent, setAdminSelEvent] = useState(initialEvents[0]?.eventId ?? "");
  const [adminSelRole, setAdminSelRole] = useState<DashboardRole>("Admin");

  useEffect(() => {
    if (user.isAdmin && allEvents.length === 0) {
      async function fetchEvents() {
        try {
          const events = await listAllActiveEvents();
          setAllEvents(events);
          if (events.length > 0) {
            setAdminSelEvent(events[0].eventId);
          }
        } catch {}
      }
      fetchEvents();
    }
  }, [allEvents.length, user.isAdmin]);
  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);

  const committeeLeadEventIds = useMemo(
    () =>
      user.eventRoles
        .filter(
          (assignment) =>
            assignment.active &&
            assignment.role === "Committee Lead",
        )
        .map((assignment) => assignment.eventId),
    [user.eventRoles],
  );
  const chairEventIds = useMemo(
    () =>
      user.eventRoles
        .filter((assignment) => assignment.active && assignment.role === "Chair")
        .map((assignment) => assignment.eventId),
    [user.eventRoles],
  );

  // Derived role
  const derivedRole =
    userRole ||
    qRole ||
    (user.isAdmin
      ? "Admin"
      : chairEventIds.length > 0
      ? "Chairperson"
      : committeeLeadEventIds.length > 0
      ? "Committee Lead"
      : "Member");

  const [prevRole, setPrevRole] = useState(derivedRole);
  if (derivedRole !== prevRole) {
    setPrevRole(derivedRole);
    setActiveTab("leaderboard");
  }

  // Dynamic tab list
  const tabs = (() => {
    switch (derivedRole) {
      case "Admin":
        return [
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "point-ledger", label: "Point Ledger", icon: Award },
          { id: "grade-requests", label: "Extra Scores", icon: BookOpen },
          { id: "grade-reviews", label: "Score Reviews", icon: BookOpen },
          { id: "admin-tools", label: "Admin Tools", icon: Sliders },
        ];
      case "Chairperson":
        return [
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "point-ledger", label: "Point Ledger", icon: Award },
          { id: "grade-requests", label: "Extra Scores", icon: BookOpen },
        ];
      case "Committee Lead":
        return [
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "point-ledger", label: "Point Ledger", icon: Award },
          { id: "grade-requests", label: "Extra Scores", icon: BookOpen },
        ];
      case "Member":
      default:
        return [
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "point-ledger", label: "Point Ledger", icon: Award },
        ];
    }
  })();

  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : "leaderboard";

  // Volunteers state for selectors
  const [volunteers, setVolunteers] = useState<VolunteerOption[]>(initialVolunteers);
  const [volunteersLoadedFor, setVolunteersLoadedFor] = useState<string | null>(
    initialVolunteersEventId ?? null,
  );
  const [volunteersLoading, setVolunteersLoading] = useState(false);
  const [volunteersError, setVolunteersError] = useState<string | null>(null);

  // Selected volunteer for admin point ledger
  const [selectedVolPointsId, setSelectedVolPointsId] = useState(user.authUser.id);

  // Detailed reviews for admin
  const [detailedReviews, setDetailedReviews] = useState<DetailedGradeReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Filters for Leaderboard
  const [filterTerm, setFilterTerm] = useState("2026");
  const [filterYear, setFilterYear] = useState("2026");
  const [filterMonth, setFilterMonth] = useState("");

  const [reqEventId, setReqEventId] = useState(qEventId || "");
  const [reqTargetUserId, setReqTargetUserId] = useState("");
  const [reqGradeValue, setReqGradeValue] = useState(5);
  const [gradingRole, setGradingRole] = useState("Committee Member");

  const [prevQEventId, setPrevQEventId] = useState(qEventId);
  if (qEventId !== prevQEventId) {
    setPrevQEventId(qEventId);
    setReqEventId(qEventId || "");
  }

  useEffect(() => {
    async function autoFetchRole() {
      const selectedEventId =
        reqEventId || (!qEventId && user.isAdmin ? allEvents[0]?.eventId : "");
      if (reqTargetUserId && selectedEventId) {
        try {
          const activeRole = await getVolunteerActiveEventRole(
            reqTargetUserId,
            selectedEventId,
          );
          if (activeRole) {
            setGradingRole(activeRole);
          }
        } catch {}
      }
    }
    autoFetchRole();
  }, [allEvents, qEventId, reqTargetUserId, reqEventId, user.isAdmin]);



  const [revRequestId, setRevRequestId] = useState("");
  const [revGradeValue, setRevGradeValue] = useState(5);

  const [overReviewId, setOverReviewId] = useState("");
  const [overGradeValue, setOverGradeValue] = useState(5);
  const [overReason, setOverReason] = useState("");

  const [exUserId, setExUserId] = useState("");
  const [exTerm, setExTerm] = useState("2026");
  const [exYear, setExYear] = useState(2026);
  const [exExcluded, setExExcluded] = useState(true);
  const [exReason, setExReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch volunteers list on mount
  useEffect(() => {
    const volunteerEventKey = qEventId || "";

    if (volunteersLoadedFor === volunteerEventKey) {
      return;
    }

    async function loadVolunteers() {
      setVolunteersLoading(true);
      setVolunteersError(null);
      try {
        const list = await listVolunteers(qEventId || undefined);
        setVolunteers(list);
        setVolunteersLoadedFor(volunteerEventKey);
      } catch (err) {
        setVolunteersError(err instanceof Error ? err.message : "Failed to fetch volunteers list.");
      } finally {
        setVolunteersLoading(false);
      }
    }
    loadVolunteers();
  }, [qEventId, volunteersLoadedFor]);

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filterTerm) q.set("term", filterTerm);
      if (filterYear) q.set("year", filterYear);
      if (filterMonth) q.set("month", filterMonth);

      const res = await fetch(`/api/scoring/leaderboard?${q.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch points for a user
  const fetchPointsForUser = async (targetUserId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scoring/volunteers/${targetUserId}/points`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLedger(data.points || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load point ledger.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch active grade requests
  const fetchGradeRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scoring/grade-requests`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGradeRequests(data.gradeRequests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grade requests.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed grade reviews for admin
  const fetchDetailedReviews = async () => {
    if (derivedRole !== "Admin") return;
    setReviewsLoading(true);
    setError(null);
    try {
      const reviews = await listDetailedReviews();
      setDetailedReviews(reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grade reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (currentTab === "leaderboard") {
        await fetchLeaderboard();
      } else if (currentTab === "point-ledger") {
        const targetId = derivedRole === "Admin" ? selectedVolPointsId || user.authUser.id : user.authUser.id;
        await fetchPointsForUser(targetId);
      } else if (currentTab === "grade-requests") {
        await fetchGradeRequests();
      } else if (currentTab === "grade-reviews") {
        await fetchDetailedReviews();
      }
    };
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, filterTerm, filterYear, filterMonth, selectedVolPointsId]);

  // Form submission helpers

  const handleDeleteRequest = async (requestId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/scoring/grade-requests/${requestId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess("Grade request deleted/rejected successfully.");
      await fetchGradeRequests();
      if (derivedRole === "Admin") {
        await fetchDetailedReviews();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete request.");
    }
  };

  const eventTitleById = useMemo(() => {
    const map = new Map<string, string>();

    for (const assignment of user.eventRoles) {
      if (assignment.eventTitle) {
        map.set(assignment.eventId, assignment.eventTitle);
      }
    }

    for (const event of allEvents) {
      map.set(event.eventId, event.eventTitle);
    }

    for (const entry of ledger) {
      if (entry.eventTitle) {
        map.set(entry.eventId, entry.eventTitle);
      }
    }

    for (const request of gradeRequests) {
      if (request.eventTitle) {
        map.set(request.eventId, request.eventTitle);
      }
    }

    for (const review of detailedReviews) {
      if (review.eventTitle) {
        map.set(review.eventId, review.eventTitle);
      }
    }

    return map;
  }, [allEvents, detailedReviews, gradeRequests, ledger, user.eventRoles]);

  const volunteerNameById = useMemo(() => {
    const map = new Map<string, string>();

    map.set(user.authUser.id, user.authUser.name || user.authUser.email);
    for (const volunteer of volunteers) {
      map.set(volunteer.id, volunteer.name);
    }
    for (const request of gradeRequests) {
      if (request.targetUserName) {
        map.set(request.targetUserId, request.targetUserName);
      }
      if (request.requestedByName) {
        map.set(request.requestedBy, request.requestedByName);
      }
    }

    return map;
  }, [gradeRequests, user.authUser.email, user.authUser.id, user.authUser.name, volunteers]);

  function eventLabel(eventId?: string) {
    if (!eventId) {
      return "Selected event";
    }

    return eventTitleById.get(eventId) ?? "Selected event";
  }

  function volunteerLabel(userId?: string) {
    if (!userId) {
      return "Volunteer";
    }

    return volunteerNameById.get(userId) ?? "Volunteer";
  }


  const hasSelected = !!qEventId && !!qRole;

  if (!hasSelected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary mb-4">
              <Trophy className="size-6" />
            </span>
            <CardTitle className="text-2xl font-bold">Select Event & View Mode</CardTitle>
            <CardDescription className="text-sm">
              Please select the event responsibility and role you want to view the scoring dashboard as.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {user.isAdmin ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (adminSelEvent) {
                    router.push(`/scoring?eventId=${encodeURIComponent(adminSelEvent)}&role=${encodeURIComponent(adminSelRole)}`);
                  }
                }}
                className="space-y-4"
              >
                <div className="bg-surface-muted p-4 rounded-lg border border-border/50 text-xs text-text-secondary space-y-1">
                  <span className="font-semibold text-text-primary uppercase block mb-1">Administrator Access</span>
                  You have full privileges. You can view scoring for any event and manage score approval.
                </div>

                {allEvents.length > 0 ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Choose Active Event
                    </label>
                    <select
                      value={adminSelEvent}
                      onChange={(e) => setAdminSelEvent(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    >
                      {allEvents.map((ev) => (
                        <option key={ev.eventId} value={ev.eventId}>
                          {ev.eventTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-surface-muted p-4 text-sm text-text-secondary">
                    No active events are available for scoring yet. Create or assign event
                    responsibilities before opening a scoring workspace.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Role / View Mode
                  </label>
                  <select
                    value={adminSelRole}
                    onChange={(e) => setAdminSelRole(e.target.value as DashboardRole)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Chairperson">Chairperson (Chair)</option>
                    <option value="Committee Lead">Committee Lead</option>
                    <option value="Member">Member (Volunteer)</option>
                  </select>
                </div>

                <Button disabled={!adminSelEvent} type="submit" className="w-full">
                  Access Dashboard
                </Button>
              </form>
            ) : user.eventRoles && user.eventRoles.filter((r) => r.active).length > 0 ? (
              <div className="space-y-3">
                <span className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                  Your Event Responsibilities
                </span>
                <div className="grid gap-3">
                  {user.eventRoles
                    .filter((r) => r.active)
                    .map((assignment) => {
                      const displayRole: DashboardRole =
                        assignment.role === "Chair"
                          ? "Chairperson"
                          : assignment.role === "Committee Lead"
                            ? "Committee Lead"
                            : "Member";
                      return (
                        <button
                          key={assignment.$id}
                          onClick={() => {
                            router.push(`/scoring?eventId=${encodeURIComponent(assignment.eventId)}&role=${encodeURIComponent(displayRole)}`);
                          }}
                          className="flex items-center justify-between p-4 border border-border hover:border-primary/50 hover:bg-primary-soft/5 rounded-lg text-left transition-all group animate-fade-in"
                        >
                          <div>
                            <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                              {assignment.eventTitle}
                            </span>
                            {assignment.committeeName ? (
                              <span className="text-xs text-text-muted block mt-0.5">
                                {assignment.committeeName}
                              </span>
                            ) : null}
                          </div>
                          <Badge tone={assignment.role === "Chair" ? "warning" : "neutral"}>
                            {assignment.role}
                          </Badge>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <p className="text-sm text-text-secondary">
                  No active event responsibilities are currently assigned to this account.
                </p>
                <div className="bg-surface-muted p-4 rounded-lg border border-border/50 text-xs text-text-secondary">
                  Please ask an administrator to assign a responsibility in Access Control.
                </div>
                <Link href="/dashboard" className="text-xs text-primary hover:underline block">
                  Back to Access Overview
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header with Role Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-surface p-4 rounded-lg border border-border gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-text-primary text-sm uppercase tracking-wider">Dashboard View Mode:</span>
          <Badge
            tone={
              derivedRole === "Admin"
                ? "primary"
                : derivedRole === "Chairperson" || derivedRole === "Committee Lead"
                  ? "warning"
                  : "neutral"
            }
          >
            {derivedRole}
          </Badge>
          {qEventId && (
            <Badge tone="neutral">
              Event: {eventLabel(qEventId)}
            </Badge>
          )}
          <Link
            href="/scoring"
            className="text-xs text-primary hover:underline ml-2 flex items-center gap-1 font-medium border-l border-border pl-3"
          >
            Switch Event/Role
          </Link>
        </div>
        <div className="text-xs text-text-secondary">
          Logged in as: <span className="font-semibold">{user.authUser.name}</span> ({user.authUser.email})
        </div>
      </div>

      {/* Tab bar header */}
      <div className="flex border-b border-border bg-surface px-4 py-2 rounded-t-lg gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => startTransition(() => setActiveTab(tab.id))}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-primary-soft text-primary border border-primary/20"
                  : "text-text-secondary hover:bg-surface-muted"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="size-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
          <AlertCircle className="size-4" />
          <span>{success}</span>
        </div>
      )}

      {/* Tab Panels */}
      {currentTab === "leaderboard" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <CardTitle>IEEE SB UoM Leaderboard</CardTitle>
                <CardDescription>
                  Volunteers ranked by aggregated points from point ledger.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm w-36 bg-surface"
                >
                  <option value="2025">2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026">2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027">2027</option>
                  <option value="2027/2028">2027/2028</option>
                  <option value="2028">2028</option>
                  <option value="2028/2029">2028/2029</option>
                </select>
                <input
                  type="number"
                  placeholder="Year"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm w-28 bg-surface"
                />
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm bg-surface"
                >
                  <option value="">Full Year</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
                <Button onClick={fetchLeaderboard} className="flex items-center gap-1">
                  <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-text-secondary">Loading leaderboard...</div>
            ) : leaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Rank</th>
                      <th className="px-4 py-2 font-semibold">Volunteer Name</th>
                      <th className="px-4 py-2 font-semibold text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaderboard.map((row, index) => (
                      <tr
                        key={row.userId}
                        className={row.userId === user.authUser.id ? "bg-primary-soft/10" : ""}
                      >
                        <td className="py-3 pr-4 font-semibold">
                          {index === 0 && "🥇 "}
                          {index === 1 && "🥈 "}
                          {index === 2 && "🥉 "}
                          {index > 2 && `${index + 1}`}
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {row.name} {row.userId === user.authUser.id && <Badge tone="primary">Self</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-text-primary text-base">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary">
                No ledger entries found matching these filters.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {currentTab === "point-ledger" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>{derivedRole === "Admin" ? "Point Ledger (Admin View)" : "My Point Ledger"}</CardTitle>
                <CardDescription>
                  {derivedRole === "Admin"
                    ? "Inspect any volunteer's accumulated points ledger."
                    : "Your total accumulated points on the volunteer management platform."}
                </CardDescription>
              </div>
              
              {derivedRole === "Admin" && (
                <div className="w-64 space-y-1">
                  <label className="block text-xs font-semibold uppercase text-text-secondary">
                    Inspect Volunteer
                  </label>
                  <VolunteerSelect
                    value={selectedVolPointsId}
                    onChange={(val) => setSelectedVolPointsId(val)}
                    volunteers={volunteers}
                    loading={volunteersLoading}
                    error={volunteersError}
                  />
                </div>
              )}

              <div className="text-right">
                <p className="text-xs uppercase text-text-secondary font-medium">Total Points</p>
                <p className="text-3xl font-extrabold text-primary">
                  {ledger.reduce((acc, r) => acc + r.points, 0)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-text-secondary">Loading ledger...</div>
            ) : ledger.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Event / Task</th>
                      <th className="px-4 py-2 font-semibold">Source</th>
                      <th className="px-4 py-2 font-semibold">Awarded Date</th>
                      <th className="px-4 py-2 font-semibold text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledger.map((entry) => (
                      <tr key={entry.$id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-text-primary">
                            {entry.eventTitle ?? eventLabel(entry.eventId)}
                          </p>
                          <p className="text-xs text-text-muted">IEEE term {entry.term}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              entry.source === "grade"
                                ? "success"
                                : entry.source === "role"
                                ? "primary"
                                : "warning"
                            }
                          >
                            {entry.source}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {new Date(entry.conclusionApprovalDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-text-primary">
                          +{entry.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary">
                {derivedRole === "Admin"
                  ? "This volunteer has not received any points yet."
                  : "You have not received any points yet. Attend approved events to receive role points and approved extra scores."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {currentTab === "grade-requests" && (
        <div className="space-y-6">
          {(derivedRole === "Admin" || derivedRole === "Chairperson" || derivedRole === "Committee Lead") && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Extra Score</CardTitle>
                <CardDescription>
                  Add the 0-10 extra score for an attended volunteer. Role points are awarded automatically after the conclusion report is approved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    setSuccess(null);
                    const selectedRequestEventId =
                      reqEventId || (!qEventId && user.isAdmin ? allEvents[0]?.eventId : "");
                    if (!selectedRequestEventId) {
                      setError("Select an event before submitting an extra score.");
                      return;
                    }
                    try {
                      const res = await fetch("/api/scoring/grade-requests", {
                        method: "POST",
                        body: JSON.stringify({
                          eventId: selectedRequestEventId,
                          targetUserId: reqTargetUserId,
                          gradeValue: Number(reqGradeValue),
                        }),
                      });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);
                      setSuccess("Extra score submitted successfully!");
                      fetchGradeRequests();
                      setReqEventId("");
                      setReqTargetUserId("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to submit request.");
                    }
                  }}
                  className="grid gap-4 md:grid-cols-3 items-end"
                >
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Event
                    </label>
                    {qEventId ? (
                      <input
                        type="text"
                        required
                        disabled
                        value={eventLabel(qEventId)}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-75"
                      />
                    ) : user.isAdmin && allEvents.length > 0 ? (
                      <select
                        required
                        value={reqEventId || allEvents[0]?.eventId || ""}
                        onChange={(e) => setReqEventId(e.target.value)}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      >
                        {allEvents.map((event) => (
                          <option key={event.eventId} value={event.eventId}>
                            {event.eventTitle}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-secondary">
                        Select an assigned event from the scoring workspace first.
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Volunteer
                    </label>
                    <VolunteerSelect
                      value={reqTargetUserId}
                      onChange={(val) => setReqTargetUserId(val)}
                      volunteers={volunteers.filter((v) => v.id !== user.authUser.id)}
                      loading={volunteersLoading}
                      error={volunteersError}
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                        Extra Score (0-10) - {gradingRole}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        required
                        value={reqGradeValue}
                        onChange={(e) => setReqGradeValue(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                      />
                      <span className="text-[10px] text-text-muted mt-1 block">
                        Committee Leads score members, Chairs score Committee Leads, and Admins score Chair/Vice Chair.
                      </span>
                    </div>
                    <Button
                      disabled={
                        volunteersLoading ||
                        !reqTargetUserId ||
                        !(qEventId || reqEventId || (user.isAdmin && allEvents[0]?.eventId))
                      }
                      type="submit"
                      className="shrink-0 flex items-center gap-1 mt-5"
                    >
                      <Plus className="size-4" /> Submit
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {derivedRole === "Admin"
                  ? "All Extra Score Requests"
                  : qEventId
                  ? `Extra Score Requests for ${eventLabel(qEventId)}`
                  : "Extra Score Requests for My Events"}
              </CardTitle>
              <CardDescription>
                {derivedRole === "Admin"
                  ? "Manage and inspect the status of all active volunteer extra-score workflows."
                  : "Review the extra-score requests connected to your event responsibility."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const visibleRequests = derivedRole === "Admin"
                  ? (qEventId ? gradeRequests.filter(req => req.eventId === qEventId) : gradeRequests)
                  : gradeRequests.filter((req) => {
                      if (qEventId) {
                        return req.eventId === qEventId;
                      }
                      return derivedRole === "Chairperson"
                        ? chairEventIds.includes(req.eventId)
                        : committeeLeadEventIds.includes(req.eventId);
                    });

                if (visibleRequests.length > 0) {
                  return (
                    <div className="space-y-4">
                      {visibleRequests.map((req) => {
                        const targetVolName = req.targetUserName ?? volunteerLabel(req.targetUserId);
                        const requestedByName =
                          req.requestedByName ?? volunteerLabel(req.requestedBy);
                        const canSubmitScoreForEvent = committeeLeadEventIds.includes(req.eventId);

                        return (
                          <div
                            key={req.$id}
                            className="p-4 border border-border rounded-lg bg-surface flex flex-col gap-4"
                          >
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-text-primary">
                                    {req.eventTitle ?? eventLabel(req.eventId)}
                                  </span>
                                  <Badge
                                    tone={
                                      req.status === "finalized"
                                        ? "success"
                                        : req.status === "reviewed"
                                        ? "primary"
                                        : "neutral"
                                    }
                                  >
                                    {req.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-text-secondary">
                                  Volunteer: <span className="font-semibold">{targetVolName}</span> | Requested by: {requestedByName}
                                </p>
                              </div>

                              {/* Approval actions for Admins and Chairs */}
                              {(derivedRole === "Admin" || derivedRole === "Chairperson") && req.status !== "finalized" && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="primary"
                                    onClick={async () => {
                                      setError(null);
                                      setSuccess(null);
                                      try {
                                        const res = await fetch("/api/scoring/grades", {
                                          method: "POST",
                                          body: JSON.stringify({ gradeRequestId: req.$id }),
                                        });
                                        const data = await res.json();
                                        if (data.error) throw new Error(data.error);
                                        setSuccess("Extra score approved and points awarded!");
                                        fetchGradeRequests();
                                      } catch (err) {
                                        setError(err instanceof Error ? err.message : "Failed to approve extra score.");
                                      }
                                    }}
                                  >
                                    Approve (Finalize)
                                  </Button>
                                  {derivedRole === "Admin" ? (
                                    <Button
                                      variant="secondary"
                                      onClick={() => handleDeleteRequest(req.$id)}
                                    >
                                      Reject (Delete)
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </div>

                            {/* Score input for Committee Leads */}
                            {derivedRole === "Committee Lead" && (
                              <div className="space-y-3 mt-2 pt-2 border-t border-border/50">
                                {req.targetUserId === user.authUser.id ? (
                                  <div className="p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md font-medium">
                                    You cannot grade yourself.
                                  </div>
                                ) : !canSubmitScoreForEvent && !user.isAdmin ? (
                                  <div className="p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md font-medium">
                                    You must be a Committee Lead for this event to submit a member extra score.
                                  </div>
                                ) : (
                                  <form
                                    onSubmit={async (e) => {
                                      e.preventDefault();
                                      setError(null);
                                      setSuccess(null);
                                      const formData = new FormData(e.currentTarget);
                                      const val = Number(formData.get("gradeValue"));
                                      try {
                                        const res = await fetch(`/api/scoring/grade-requests/${req.$id}`, {
                                          method: "PATCH",
                                          body: JSON.stringify({ gradeValue: val }),
                                        });
                                        const data = await res.json();
                                        if (data.error) throw new Error(data.error);
                                        setSuccess("Extra score submitted successfully!");
                                        fetchGradeRequests();
                                      } catch (err) {
                                        setError(err instanceof Error ? err.message : "Failed to submit extra score.");
                                      }
                                    }}
                                    className="flex items-center gap-3"
                                  >
                                    <div className="flex-1 max-w-[150px]">
                                      <label className="block text-[10px] font-semibold uppercase text-text-secondary mb-0.5">
                                        Extra Score (0-10)
                                      </label>
                                      <input
                                        type="number"
                                        name="gradeValue"
                                        min={0}
                                        max={10}
                                        defaultValue={5}
                                        required
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-surface"
                                      />
                                    </div>
                                    <Button type="submit" variant="secondary" className="mt-4">
                                      Submit Score
                                    </Button>
                                  </form>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                } else {
                  return <p className="text-center py-6 text-text-secondary">No grading requests found.</p>;
                }
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {currentTab === "grade-reviews" && derivedRole === "Admin" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit Extra Score Review</CardTitle>
              <CardDescription>
                Submit or update an admin extra-score review for an open request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  try {
                    const res = await fetch(`/api/scoring/grade-requests/${revRequestId}`, {
                      method: "PATCH",
                      body: JSON.stringify({ gradeValue: revGradeValue }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setSuccess("Extra score review submitted!");
                    fetchGradeRequests();
                    await fetchDetailedReviews();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to submit review.");
                  }
                }}
                className="grid gap-4 md:grid-cols-3 items-end"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Open Request
                  </label>
                  <select
                    required
                    value={revRequestId}
                    onChange={(e) => setRevRequestId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="">-- Choose Request --</option>
                    {gradeRequests
                      .filter((r) => r.status !== "finalized")
                      .map((r) => {
                        const targetName = r.targetUserName ?? volunteerLabel(r.targetUserId);
                        return (
                          <option key={r.$id} value={r.$id}>
                            {r.eventTitle ?? eventLabel(r.eventId)} - {targetName}
                          </option>
                        );
                      })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Extra Score (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    required
                    value={revGradeValue}
                    onChange={(e) => setRevGradeValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Submit Review
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Score Reviews Log</CardTitle>
              <CardDescription>
                Audit history of submitted extra-score contributions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="text-center py-6 text-text-secondary">Loading reviews...</div>
              ) : detailedReviews.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-left text-sm">
                    <thead className="text-text-secondary">
                      <tr>
                        <th className="py-2 pr-4 font-semibold">Event</th>
                        <th className="px-4 py-2 font-semibold">Volunteer Name</th>
                        <th className="px-4 py-2 font-semibold">Submitted By</th>
                        <th className="px-4 py-2 font-semibold text-center">Score</th>
                        <th className="px-4 py-2 font-semibold">Submitted At</th>
                        <th className="px-4 py-2 font-semibold">Audit Overrides</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedReviews.map((rev) => {
                        let auditHistory: string[] = [];
                        if (rev.audit_metadata) {
                          try {
                            const parsed = JSON.parse(rev.audit_metadata);
                            if (Array.isArray(parsed)) {
                              auditHistory = parsed.map(
                                (entry: GradeAuditEntry) =>
                                  `Changed from ${entry.originalValue} to ${entry.newValue} by ${entry.changedBy} on ${new Date(entry.changedAt).toLocaleDateString()} (Reason: ${entry.reason || "None"})`
                              );
                            }
                          } catch {}
                        }

                        return (
                          <tr key={rev.$id}>
                            <td className="py-3 pr-4 font-medium text-text-primary">
                              {rev.eventTitle ?? eventLabel(rev.eventId)}
                            </td>
                            <td className="px-4 py-3 text-text-primary">{rev.volunteerName}</td>
                            <td className="px-4 py-3 text-text-secondary">{rev.reviewerName}</td>
                            <td className="px-4 py-3 text-center font-bold text-text-primary">{rev.gradeValue} / 10</td>
                            <td className="px-4 py-3 text-text-secondary">
                              {new Date(rev.submittedAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-xs text-text-muted">
                              {auditHistory.length > 0 ? (
                                <ul className="list-disc pl-4 space-y-0.5">
                                  {auditHistory.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                "No overrides"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-6 text-text-secondary">No reviews found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentTab === "admin-tools" && derivedRole === "Admin" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Admin override panel */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Score Override</CardTitle>
              <CardDescription>
                Manually correct an extra score. Every correction is logged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  try {
                    const res = await fetch("/api/scoring/admin/override", {
                      method: "POST",
                      body: JSON.stringify({
                        gradeReviewId: overReviewId,
                        newGradeValue: Number(overGradeValue),
                        reason: overReason,
                      }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setSuccess("Extra score overridden and audit history recorded!");
                    setOverReviewId("");
                    setOverReason("");
                    await fetchDetailedReviews();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Override failed.");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Score Review
                  </label>
                  <select
                    required
                    value={overReviewId}
                    onChange={(e) => {
                      setOverReviewId(e.target.value);
                      const rev = detailedReviews.find((r) => r.$id === e.target.value);
                      if (rev) {
                        setOverGradeValue(rev.gradeValue);
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="">-- Choose Score to Override --</option>
                    {detailedReviews.map((rev) => (
                      <option key={rev.$id} value={rev.$id}>
                        {rev.eventTitle ?? eventLabel(rev.eventId)} - {rev.volunteerName} (Submitted by: {rev.reviewerName}, Score: {rev.gradeValue})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    New Extra Score (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    required
                    value={overGradeValue}
                    onChange={(e) => setOverGradeValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Reason for Override
                  </label>
                  <input
                    type="text"
                    value={overReason}
                    onChange={(e) => setOverReason(e.target.value)}
                    placeholder="Reason for this correction"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Override & Log Audit
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Top board config panel */}
          <Card>
            <CardHeader>
              <CardTitle>Top Board Exclusion</CardTitle>
              <CardDescription>
                Manually exclude a volunteer from the top board leaderboard for a given term.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSuccess(null);
                  try {
                    await toggleTopBoardExclusion({
                      userId: exUserId,
                      term: exTerm,
                      year: Number(exYear),
                      excluded: exExcluded,
                      reason: exReason,
                    });
                    setSuccess("Exclusion settings updated successfully!");
                    setExUserId("");
                    setExReason("");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to update exclusion.");
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Select Volunteer
                  </label>
                  <VolunteerSelect
                    value={exUserId}
                    onChange={(val) => setExUserId(val)}
                    volunteers={volunteers}
                    loading={volunteersLoading}
                    error={volunteersError}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Term
                    </label>
                    <select
                      value={exTerm}
                      onChange={(e) => setExTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    >
                      <option value="2025">2025</option>
                      <option value="2025/2026">2025/2026</option>
                      <option value="2026">2026</option>
                      <option value="2026/2027">2026/2027</option>
                      <option value="2027">2027</option>
                      <option value="2027/2028">2027/2028</option>
                      <option value="2028">2028</option>
                      <option value="2028/2029">2028/2029</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Year
                    </label>
                    <input
                      type="number"
                      required
                      value={exYear}
                      onChange={(e) => setExYear(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Top Board Status
                  </label>
                  <select
                    value={exExcluded ? "exclude" : "include"}
                    onChange={(e) => setExExcluded(e.target.value === "exclude")}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  >
                    <option value="exclude">Exclude from Top Board</option>
                    <option value="include">Include on Top Board</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={exReason}
                    onChange={(e) => setExReason(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Save Configuration
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
