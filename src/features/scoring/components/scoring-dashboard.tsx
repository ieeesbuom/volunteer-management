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
  AlertTriangle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EventRole, EventRoleAssignment, SessionUser } from "@/features/access-control/types";
import {
  toggleTopBoardExclusion,
  listVolunteers,
  listDetailedReviews,
  listAllActiveEvents,
} from "../server/actions";
import { deriveTermFromDate } from "@/features/scoring/lib/helpers";
import { IEEE_TERMS } from "@/lib/config";
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
const AUDIT_PAGE_SIZE = 50;

const EVENT_ROLE_PRIORITY: Record<EventRole, number> = {
  Chair: 4,
  "Committee Lead": 3,
  "Vice Chair": 2,
  "Committee Member": 1,
};

function dashboardRoleFromAssignment(assignment?: EventRoleAssignment | null): DashboardRole {
  if (!assignment) {
    return "Member";
  }

  if (assignment.role === "Chair") {
    return "Chairperson";
  }

  if (assignment.role === "Committee Lead") {
    return "Committee Lead";
  }

  return "Member";
}

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

export function ScoringDashboard({
  initialEvents = [],
  initialVolunteers = [],
  initialVolunteersEventId,
  user,
  hallOfFame = [],
  volunteerOfTheMonth = null,
}: {
  initialEvents?: EventOption[];
  initialVolunteers?: VolunteerOption[];
  initialVolunteersEventId?: string;
  user: SessionUser;
  hallOfFame?: { userId: string; name: string; term: { label: string }; pointsEarned: number; rank: number }[];
  volunteerOfTheMonth?: { name: string; highlight: string; pointsEarned: number } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qEventId = searchParams.get("eventId");
  const [activeTab, setActiveTab] = useState<string>("leaderboard");

  const [leaderboard, setLeaderboard] = useState<
    { userId: string; name: string; points: number }[]
  >([]);
  
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(leaderboard.length / ITEMS_PER_PAGE));
  const paginatedLeaderboard = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return leaderboard.slice(start, start + ITEMS_PER_PAGE);
  }, [leaderboard, currentPage]);

  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);

  const [allEvents, setAllEvents] = useState<EventOption[]>(initialEvents);

  useEffect(() => {
    if (user.isAdmin && allEvents.length === 0) {
      async function fetchEvents() {
        try {
          const events = await listAllActiveEvents();
          setAllEvents(events);
        } catch {}
      }
      fetchEvents();
    }
  }, [allEvents.length, user.isAdmin]);
  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);


  const chairEventIds = useMemo(
    () =>
      user.eventRoles
        .filter((assignment) => assignment.active && assignment.role === "Chair")
        .map((assignment) => assignment.eventId),
    [user.eventRoles],
  );

  const activeEventAssignments = useMemo(
    () =>
      user.eventRoles
        .filter((assignment) => assignment.active)
        .sort((a, b) => {
          const priorityDelta = EVENT_ROLE_PRIORITY[b.role] - EVENT_ROLE_PRIORITY[a.role];
          if (priorityDelta !== 0) {
            return priorityDelta;
          }

          return a.eventTitle.localeCompare(b.eventTitle);
        }),
    [user.eventRoles],
  );

  const selectedEventAssignment = useMemo(() => {
    if (user.isAdmin) {
      return null;
    }

    const requestedAssignment = qEventId
      ? activeEventAssignments.find((assignment) => assignment.eventId === qEventId)
      : undefined;

    return requestedAssignment ?? activeEventAssignments[0] ?? null;
  }, [activeEventAssignments, qEventId, user.isAdmin]);

  const effectiveEventId = user.isAdmin
    ? qEventId ?? ""
    : selectedEventAssignment?.eventId ?? "";
  const derivedRole = user.isAdmin
    ? "Admin"
    : dashboardRoleFromAssignment(selectedEventAssignment);

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

  // Dedicated volunteers state when giving extra points for the selected request event
  const [requestVolunteers, setRequestVolunteers] = useState<VolunteerOption[]>([]);
  const [requestVolunteersLoadedFor, setRequestVolunteersLoadedFor] = useState<string | null>(null);
  const [requestVolunteersLoading, setRequestVolunteersLoading] = useState(false);
  const [requestVolunteersError, setRequestVolunteersError] = useState<string | null>(null);

  // Selected volunteer for admin point ledger
  const [selectedVolPointsId, setSelectedVolPointsId] = useState(user.authUser.id);

  // Detailed reviews for admin
  const [detailedReviews, setDetailedReviews] = useState<DetailedGradeReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPage, setAuditPage] = useState(0);

  // Filters for Leaderboard
  const [filterTerm, setFilterTerm] = useState(() => deriveTermFromDate(new Date().toISOString()));
  const [filterYear, setFilterYear] = useState(() => String(new Date().getUTCFullYear()));
  const [filterMonth, setFilterMonth] = useState("");

  const [reqEventId, setReqEventId] = useState("");
  const [reqTargetUserId, setReqTargetUserId] = useState("");
  const [reqGradeValue, setReqGradeValue] = useState(5);
  const selectedRequestEventId =
    reqEventId || effectiveEventId || (user.isAdmin ? allEvents[0]?.eventId ?? "" : "");

  const [overReviewId, setOverReviewId] = useState("");
  const [overGradeValue, setOverGradeValue] = useState(5);
  const [overReason, setOverReason] = useState("");

  const [exUserId, setExUserId] = useState("");
  const [exTerm, setExTerm] = useState(() => deriveTermFromDate(new Date().toISOString()));
  const [exYear, setExYear] = useState(() => new Date().getUTCFullYear());
  const [exExcluded, setExExcluded] = useState(true);
  const [exReason, setExReason] = useState("");

  const visibleTerms = useMemo(() => {
    const currentTerm = deriveTermFromDate(new Date().toISOString());
    const currentStartYear = parseInt(currentTerm.split("/")[0]);
    return IEEE_TERMS.filter((term) => {
      const termStartYear = parseInt(term.split("/")[0]);
      return termStartYear <= currentStartYear;
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requestToApprove, setRequestToApprove] = useState<GradeRequest | null>(null);
  const [requestToReject, setRequestToReject] = useState<GradeRequest | null>(null);

  const handleApproveRequest = async (req: GradeRequest) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/scoring/grades", {
        method: "POST",
        body: JSON.stringify({ gradeRequestId: req.$id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess("Extra score approved and points awarded!");
      await fetchGradeRequests();
      if (derivedRole === "Admin") {
        await fetchDetailedReviews();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve extra score.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch volunteers list on mount
  useEffect(() => {
    const volunteerEventKey = effectiveEventId || "";

    if (volunteersLoadedFor === volunteerEventKey) {
      return;
    }

    if (!user.isAdmin && !effectiveEventId) {
      return;
    }

    async function loadVolunteers() {
      setVolunteersLoading(true);
      setVolunteersError(null);
      try {
        const list = await listVolunteers(effectiveEventId || undefined);
        setVolunteers(list);
        setVolunteersLoadedFor(volunteerEventKey);
      } catch (err) {
        setVolunteersError(err instanceof Error ? err.message : "Failed to fetch volunteers list.");
      } finally {
        setVolunteersLoading(false);
      }
    }
    loadVolunteers();
  }, [effectiveEventId, user.isAdmin, volunteersLoadedFor]);

  // Fetch volunteers specifically for the selected extra score event
  useEffect(() => {
    const targetEventId = selectedRequestEventId;
    if (!targetEventId || requestVolunteersLoadedFor === targetEventId) {
      return;
    }

    let isMounted = true;
    async function loadRequestVolunteers() {
      setRequestVolunteersLoading(true);
      setRequestVolunteersError(null);
      try {
        const list = await listVolunteers(targetEventId);
        if (isMounted) {
          setRequestVolunteers(list);
          setRequestVolunteersLoadedFor(targetEventId);
          setReqTargetUserId((prev) => (prev && !list.some((v) => v.id === prev) ? "" : prev));
        }
      } catch (err) {
        if (isMounted) {
          setRequestVolunteersError(
            err instanceof Error ? err.message : "Failed to fetch volunteers for selected event.",
          );
        }
      } finally {
        if (isMounted) {
          setRequestVolunteersLoading(false);
        }
      }
    }
    loadRequestVolunteers();
    return () => {
      isMounted = false;
    };
  }, [selectedRequestEventId, requestVolunteersLoadedFor]);

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
      setCurrentPage(1);
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
        if (derivedRole === "Admin") {
          await fetchDetailedReviews();
        }
      } else if (currentTab === "admin-tools") {
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
    for (const volunteer of requestVolunteers) {
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
  }, [gradeRequests, requestVolunteers, user.authUser.email, user.authUser.id, user.authUser.name, volunteers]);

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

  const filteredAuditReviews = useMemo(() => {
    const normalizedSearch = auditSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return detailedReviews;
    }

    return detailedReviews.filter((review) =>
      [
        review.eventTitle ?? eventTitleById.get(review.eventId) ?? "Selected event",
        review.volunteerName,
        review.reviewerName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [auditSearch, detailedReviews, eventTitleById]);
  const auditPageCount = Math.max(1, Math.ceil(filteredAuditReviews.length / AUDIT_PAGE_SIZE));
  const safeAuditPage = Math.min(auditPage, auditPageCount - 1);
  const pagedAuditReviews = filteredAuditReviews.slice(
    safeAuditPage * AUDIT_PAGE_SIZE,
    safeAuditPage * AUDIT_PAGE_SIZE + AUDIT_PAGE_SIZE,
  );

  const showEventContextSwitcher = !user.isAdmin && activeEventAssignments.length > 1;

  function handleEventContextChange(eventId: string) {
    router.push(`/scoring?eventId=${encodeURIComponent(eventId)}`);
  }

  return (
    <div className="space-y-6">
      {showEventContextSwitcher ? (
        <div className="flex justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            Event
            <select
              value={effectiveEventId}
              onChange={(event) => handleEventContextChange(event.target.value)}
              className="min-w-64 rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)] cursor-pointer"
            >
              {activeEventAssignments.map((assignment) => (
                <option key={assignment.$id} value={assignment.eventId}>
                  {assignment.eventTitle} - {assignment.role}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {/* Tab bar header */}
      <div className="flex border-b border-border-subtle mb-6 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => startTransition(() => setActiveTab(tab.id))}
              className={cn(
                "flex items-center gap-2 h-10 px-4 text-[14px] font-medium relative transition-colors cursor-pointer whitespace-nowrap",
                isActive
                  ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                  : "text-text-muted hover:text-text-body"
              )}
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
        <div className="space-y-6">
          {/* Full Leaderboard (Now First) */}
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
                    className="px-3 py-1.5 border border-border-default rounded-md text-[13px] w-36 bg-surface cursor-pointer outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
                  >
                    {visibleTerms.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Year"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="px-3 py-1.5 border border-border-default rounded-md text-[13px] w-28 bg-surface outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
                  />
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="px-3 py-1.5 border border-border-default rounded-md text-[13px] bg-surface cursor-pointer outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
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
              ) : paginatedLeaderboard.length > 0 ? (
                <div className="space-y-4">
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
                        {paginatedLeaderboard.map((row) => (
                          <tr
                            key={row.userId}
                            className="hover:bg-surface-muted transition-colors"
                          >
                            <td className="py-3 pr-4 font-medium text-text-primary text-base">
                              #{row.points > 0 ? leaderboard.findIndex((r) => r.points === row.points) + 1 : "-"}
                            </td>
                            <td className="px-4 py-3 text-text-primary text-base font-medium">
                              <Link
                                href={`/volunteers/${row.userId}`}
                                className="hover:underline hover:text-primary transition-colors cursor-pointer"
                              >
                                {row.name}
                              </Link>{" "}
                              {row.userId === user.authUser.id && <Badge tone="primary">Self</Badge>}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-text-primary text-base">
                              {row.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                      <span className="text-text-secondary">
                        Showing Page <span className="font-medium text-text-primary">{currentPage}</span> of{" "}
                        <span className="font-medium text-text-primary">{totalPages}</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center py-6 text-text-secondary">
                  No ledger entries found matching these filters.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recognition Grid (Now Second) */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="size-4 text-primary" aria-hidden="true" />
                  Volunteer of the Month
                </CardTitle>
                <CardDescription>Current month based on approved conclusion dates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {volunteerOfTheMonth ? (
                  <div className="space-y-3">
                    <p className="text-xl font-semibold text-text-primary">
                      {volunteerOfTheMonth.name}
                    </p>
                    <p className="text-text-secondary">{volunteerOfTheMonth.highlight}</p>
                    <Badge tone="success">{volunteerOfTheMonth.pointsEarned} points earned</Badge>
                  </div>
                ) : (
                  <p className="text-text-secondary">
                    No eligible points have been awarded for the current month.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-4 text-primary" aria-hidden="true" />
                  Term Hall of Fame
                </CardTitle>
                <CardDescription>Current IEEE term ranking with Top Board exclusions</CardDescription>
              </CardHeader>
              <CardContent>
                {hallOfFame.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="min-w-[520px] divide-y divide-border text-left text-sm">
                      <thead className="bg-surface-muted text-text-secondary">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Rank</th>
                          <th className="px-4 py-3 font-semibold">Volunteer</th>
                          <th className="px-4 py-3 font-semibold">Term</th>
                          <th className="px-4 py-3 font-semibold">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-surface">
                        {hallOfFame.map((entry) => {
                          let rankClassName = "bg-surface-subtle text-text-secondary border-border-subtle";
                          if (entry.rank === 1) {
                            rankClassName = "bg-amber-100 text-amber-900 border-amber-300 shadow-sm";
                          } else if (entry.rank === 2) {
                            rankClassName = "bg-slate-100 text-slate-800 border-slate-300 shadow-sm";
                          } else if (entry.rank === 3) {
                            rankClassName = "bg-orange-100 text-orange-900 border-orange-300 shadow-sm";
                          }

                          return (
                            <tr key={entry.userId}>
                              <td className="px-4 py-3 font-medium text-text-primary">
                                <span className={cn("inline-flex items-center justify-center min-w-[28px] h-[28px] rounded-full border text-[13px] font-bold", rankClassName)}>
                                  #{entry.rank}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-text-primary font-medium">{entry.name}</td>
                              <td className="px-4 py-3 text-[13px] text-text-secondary">{entry.term?.label ?? 'Unknown'}</td>
                              <td className="px-4 py-3">
                                <Badge tone="primary" className="font-bold">{entry.pointsEarned}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    No eligible points have been awarded for the current IEEE term.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
          {(derivedRole === "Admin" || derivedRole === "Chairperson") && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Extra Score</CardTitle>
                <CardDescription>
                  Add the 0-10 extra score for a volunteer (one score per volunteer per event). Chairs submit scores for vice chairs and members; Admins submit scores for chairs and approve all submissions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    setSuccess(null);
                    if (!selectedRequestEventId || !reqTargetUserId) {
                      setError("Select an event and volunteer before submitting.");
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
                      setReqTargetUserId("");
                      setReqGradeValue(5);
                      fetchGradeRequests();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to create extra score request.");
                    }
                  }}
                  className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(12rem,16rem)_auto]"
                >
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Event
                    </label>
                    {!user.isAdmin && effectiveEventId ? (
                      <input
                        type="text"
                        required
                        disabled
                        value={eventLabel(effectiveEventId)}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-75"
                      />
                    ) : user.isAdmin && allEvents.length > 0 ? (
                      <select
                        required
                        value={selectedRequestEventId}
                        onChange={(e) => {
                          setReqEventId(e.target.value);
                          setReqTargetUserId("");
                        }}
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
                      volunteers={(!selectedRequestEventId ? [] : requestVolunteers).filter((v) => v.id !== user.authUser.id)}
                      loading={requestVolunteersLoading}
                      error={requestVolunteersError}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Extra Score (0-10)
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
                  </div>
                  <Button
                    disabled={
                      requestVolunteersLoading ||
                      !reqTargetUserId ||
                      !selectedRequestEventId
                    }
                    type="submit"
                    className="flex h-10 shrink-0 items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-4" /> Submit
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Submitted Extra Scores</h3>
              <p className="text-xs text-text-secondary">
                Review pending extra scores before approval.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-text-secondary">Filter by Event:</label>
              <select
                value={effectiveEventId}
                onChange={(e) => handleEventContextChange(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-md text-xs bg-surface"
              >
                <option value="">All Actionable Events</option>
                {user.isAdmin
                  ? allEvents.map((ev) => (
                      <option key={ev.eventId} value={ev.eventId}>
                        {ev.eventTitle}
                      </option>
                    ))
                  : activeEventAssignments.map((ev) => (
                      <option key={ev.eventId} value={ev.eventId}>
                        {ev.eventTitle}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              {(() => {
                const visibleRequests = user.isAdmin
                  ? effectiveEventId
                    ? gradeRequests.filter((req) => req.eventId === effectiveEventId)
                    : gradeRequests
                  : gradeRequests.filter((req) => {
                    if (effectiveEventId) {
                      return req.eventId === effectiveEventId;
                    }
                    return chairEventIds.includes(req.eventId);
                  });

                if (visibleRequests.length > 0) {
                  return (
                    <div className="space-y-4">
                      {visibleRequests.map((req) => {
                        const targetVolName = req.targetUserName ?? volunteerLabel(req.targetUserId);
                        const canSubmitScoreForEvent = chairEventIds.includes(req.eventId) || user.isAdmin;

                        return (
                          <div
                            key={req.$id}
                            className="p-4 border border-border rounded-lg bg-surface flex flex-col gap-3 shadow-xs"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="text-xs font-semibold uppercase text-primary tracking-wider">
                                  {req.eventTitle}
                                </span>
                                <p className="text-sm text-text-primary">
                                  Volunteer: <span className="font-semibold">{targetVolName}</span>
                                </p>
                                <p className="text-sm text-text-primary mt-0.5">
                                  Extra Score Given:{" "}
                                  <span className="font-semibold text-primary">
                                    {req.gradeValue !== undefined && req.gradeValue !== null
                                      ? `${req.gradeValue} / 10`
                                      : "Not graded yet"}
                                  </span>
                                </p>
                              </div>

                              {/* Approval actions for Admins only */}
                              {derivedRole === "Admin" && req.status !== "finalized" && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="primary"
                                    className="cursor-pointer"
                                    onClick={() => setRequestToApprove(req)}
                                  >
                                    Approve (Finalize)
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    className="cursor-pointer"
                                    onClick={() => setRequestToReject(req)}
                                  >
                                    Reject (Delete)
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Score update input for Chairs and Admins */}
                            {(derivedRole === "Chairperson" || derivedRole === "Admin") && req.status !== "finalized" && (
                              <div className="space-y-3 mt-2 pt-2 border-t border-border/50">
                                {req.targetUserId === user.authUser.id ? (
                                  <div className="p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md font-medium">
                                    You cannot grade yourself.
                                  </div>
                                ) : !canSubmitScoreForEvent ? (
                                  <div className="p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md font-medium">
                                    You must be the event chair or an admin to submit/update extra scores.
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
                                        setSuccess("Extra score updated successfully!");
                                        fetchGradeRequests();
                                      } catch (err) {
                                        setError(err instanceof Error ? err.message : "Failed to update extra score.");
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
                                        defaultValue={req.gradeValue !== undefined && req.gradeValue !== null ? req.gradeValue : ""}
                                        required
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-surface"
                                      />
                                    </div>
                                    <Button type="submit" variant="secondary" className="mt-4">
                                      Update Score
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
                  return <p className="text-center py-6 text-text-secondary">No extra score requests need review right now.</p>;
                }
              })()}
            </CardContent>
          </Card>

          {derivedRole === "Admin" ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>Extra Score Audit Log</CardTitle>
                    <CardDescription>
                      History of submitted extra scores and admin corrections for accountability.
                    </CardDescription>
                  </div>
                  <div className="w-full md:w-80">
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Search
                    </label>
                    <input
                      type="search"
                      value={auditSearch}
                      onChange={(event) => {
                        setAuditSearch(event.target.value);
                        setAuditPage(0);
                      }}
                      placeholder="Event or volunteer name"
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {reviewsLoading ? (
                  <div className="text-center py-6 text-text-secondary">Loading audit log...</div>
                ) : filteredAuditReviews.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border text-left text-sm">
                        <thead className="text-text-secondary">
                          <tr>
                            <th className="py-2 pr-4 font-semibold">Event</th>
                            <th className="px-4 py-2 font-semibold">Volunteer</th>
                            <th className="px-4 py-2 font-semibold">Submitted By</th>
                            <th className="px-4 py-2 font-semibold text-center">Score</th>
                            <th className="px-4 py-2 font-semibold">Submitted At</th>
                            <th className="px-4 py-2 font-semibold">Corrections</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pagedAuditReviews.map((rev) => {
                            let auditHistory: string[] = [];
                            if (rev.audit_metadata) {
                              try {
                                const parsed = JSON.parse(rev.audit_metadata);
                                if (Array.isArray(parsed)) {
                                  auditHistory = parsed.map(
                                    (entry: GradeAuditEntry) =>
                                      `Changed from ${entry.originalValue} to ${entry.newValue} by ${entry.changedBy} on ${new Date(entry.changedAt).toLocaleDateString()} (Reason: ${entry.reason || "None"})`,
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
                                <td className="px-4 py-3 text-center font-bold text-text-primary">
                                  {rev.gradeValue} / 10
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                  {new Date(rev.submittedAt).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-xs text-text-muted">
                                  {auditHistory.length > 0 ? (
                                    <ul className="list-disc space-y-0.5 pl-4">
                                      {auditHistory.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    "No corrections"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-text-secondary">
                        Showing {safeAuditPage * AUDIT_PAGE_SIZE + 1}-
                        {Math.min((safeAuditPage + 1) * AUDIT_PAGE_SIZE, filteredAuditReviews.length)} of{" "}
                        {filteredAuditReviews.length}
                      </p>
                      {filteredAuditReviews.length > AUDIT_PAGE_SIZE ? (
                        <div className="flex gap-2">
                          <Button
                            disabled={safeAuditPage === 0}
                            onClick={() => setAuditPage((page) => Math.max(0, page - 1))}
                            type="button"
                            variant="secondary"
                          >
                            Previous
                          </Button>
                          <Button
                            disabled={safeAuditPage >= auditPageCount - 1}
                            onClick={() => setAuditPage((page) => Math.min(auditPageCount - 1, page + 1))}
                            type="button"
                            variant="secondary"
                          >
                            Next
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-center py-6 text-text-secondary">
                    {auditSearch
                      ? "No extra score audit records match that search."
                      : "No extra score submissions have been recorded yet."}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
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
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface cursor-pointer"
                    >
                      {visibleTerms.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
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

      {requestToApprove ? (() => {
        const targetVolName = requestToApprove.targetUserName ?? volunteerLabel(requestToApprove.targetUserId);
        return (
          <ConfirmationDialog
            confirmLabel="Approve Request"
            description={`Are you sure you want to approve the extra score request${requestToApprove.pointsRequested !== undefined ? ` of ${requestToApprove.pointsRequested} points` : ""} for ${targetVolName}? This will finalize the points and award them to the volunteer.`}
            isBusy={loading}
            onCancel={() => setRequestToApprove(null)}
            onConfirm={async () => {
              await handleApproveRequest(requestToApprove);
              setRequestToApprove(null);
            }}
            title="Approve Extra Score?"
          />
        );
      })() : null}

      {requestToReject ? (() => {
        const targetVolName = requestToReject.targetUserName ?? volunteerLabel(requestToReject.targetUserId);
        return (
          <ConfirmationDialog
            confirmLabel="Reject & Delete"
            description={`Are you sure you want to reject and delete the extra score request for ${targetVolName}?`}
            isBusy={loading}
            onCancel={() => setRequestToReject(null)}
            onConfirm={async () => {
              await handleDeleteRequest(requestToReject.$id);
              setRequestToReject(null);
            }}
            title="Reject & Delete Request?"
          />
        );
      })() : null}
    </div>
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
