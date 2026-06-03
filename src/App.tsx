import { FormEvent, MouseEvent as ReactMouseEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  CheckCircle2,
  ShieldCheck,
  Users,
  ArrowRight,
  Lock,
  BarChart3,
  LogOut,
  GraduationCap,
} from "lucide-react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const CATEGORIES = [
  "Housing Activities / Events",
  "Facilities & Campus",
  "School Policy / System",
  "Academics & Curriculum",
  "Clubs & Athletics",
  "Cafeteria / Food Services",
  "Other",
] as const;

const IMPACT_GROUPS = [
  "A specific grade level",
  "A specific group of students",
  "Most students",
  "A specific group of staff members/faculty",
  "The entire high school community",
  "The entire St. Paul community",
  "Other",
] as const;

const GRADE_LEVELS = ["Grade 9", "Grade 10", "Grade 11", "Grade 12", "Teacher/Staff"] as const;

const STATUS_LABELS = {
  pending: "Pending STUCO Review",
  approved: "Approved + Published",
  revision: "Revision Requested",
  public_consent_requested: "Student Approval Requested",
  public_consent_approved: "Approved for Public Opinion",
  private_only: "Kept Private",
  public: "Public Petition",
  threshold: "Threshold Reached",
  discussion: "Under STUCO Discussion",
  administration: "Sent to Administration",
  closed: "Closed",
} as const;

const SCHOOL_DOMAIN = "@stpaulhanoi.com";
const STUCO_ADMIN_EMAILS = ((import.meta.env.VITE_STUCO_ADMIN_EMAILS as string | undefined) || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// Keep these homepage lines unchanged unless explicitly requested.
const HOMEPAGE_BADGE_TEXT = "Student voice, organized clearly";
const HOMEPAGE_DESCRIPTION =
  "A more interactive version of the High School Community Suggestion Box. Students can submit ideas, start petitions, sign approved proposals, and track what STUCO is reviewing.";
const SUBMISSION_CONFIRMATION_MESSAGE =
  "Please review your submission before sending it. You will only be able to edit it if STUCO asks you to make a revision.";
const STUCO_CONTACT = {
  email: "spash.stuco@stpaulhanoi.com",
  president: "Ji Sung Lee",
  presidentEmail: "jisung.lee@stpaulhanoi.com",
  vicePresident: "Layla Jewell Wickham",
  vicePresidentEmail: "laylajewell.wickham@stpaulhanoi.com",
  commissionedBy: "Created by High School Student Council 2026-27 Administration",
};

const PETITION_DURATION_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Role = "student" | "stuco_admin";
type Page = "home" | "login" | "not-authorized" | "submit" | "petitions" | "detail" | "my" | "admin" | "admin-submission-detail" | "admin-petition-detail" | "submission-detail";
type SubmissionType = "Private Suggestion" | "Petition Request";
type PetitionStatus = "public" | "threshold" | "discussion" | "administration" | "closed";
type SubmissionStatus =
  | "pending"
  | "approved"
  | "revision"
  | "public_consent_requested"
  | "public_consent_approved"
  | "private_only"
  | "closed";
type StatusKey = keyof typeof STATUS_LABELS;
type Tone = "default" | "green" | "amber" | "blue" | "red";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  grade: string;
};

type Petition = {
  id: number;
  title: string;
  category: string;
  impact: string;
  description: string;
  rationale: string;
  feasibility: string;
  status: PetitionStatus;
  createdAt: string;
  signatures: number;
  threshold: number;
  signedBy: string[];
};

type Submission = {
  id: number;
  userId: string;
  studentName: string;
  studentEmail: string;
  submitterName: string;
  gradeLevel: string;
  acknowledged: boolean;
  type: SubmissionType;
  title: string;
  category: string;
  impact: string;
  description: string;
  rationale: string;
  feasibility: string;
  comments?: string;
  status: SubmissionStatus;
};

type CommentStatus = "pending" | "approved" | "hidden";
type CommentReaction = "like" | "dislike";

type PetitionComment = {
  id: number;
  petitionId: number;
  userId: string;
  studentName: string;
  studentEmail: string;
  body: string;
  status: CommentStatus;
  createdAt: string;
  reactions: Record<string, CommentReaction>;
};

const HOMEPAGE_FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: GraduationCap,
    title: "School Login",
    text: `Students and STUCO admins use ${SCHOOL_DOMAIN} accounts.`,
  },
  {
    icon: ShieldCheck,
    title: "Role Access",
    text: "Students and STUCO admins see different tools.",
  },
  {
    icon: Users,
    title: "One Signature",
    text: "Each student account can sign a petition only once.",
  },
  {
    icon: CheckCircle2,
    title: "Escalation",
    text: "Petitions reaching 50 signatures go back to STUCO.",
  },
];

const MOCK_USERS: User[] = [
  {
    id: "student-001",
    name: "Carlos Nguyen",
    email: "carlos.nguyen@stpaulhanoi.com",
    role: "student",
    grade: "Grade 11",
  },
  {
    id: "student-002",
    name: "Mina Park",
    email: "mina.park@stpaulhanoi.com",
    role: "student",
    grade: "Grade 12",
  },
  {
    id: "stuco-001",
    name: "STUCO Admin",
    email: "stuco.admin@stpaulhanoi.com",
    role: "stuco_admin",
    grade: "Student Council",
  },
];

const INITIAL_PETITIONS: Petition[] = [
  {
    id: 1,
    title: "Add More Shaded Outdoor Seating",
    category: "Facilities & Campus",
    impact: "Most students",
    description:
      "Many students spend break and lunch outside, but shaded seating is limited. Adding more shaded benches or tables would make outdoor spaces more comfortable.",
    rationale:
      "This would improve comfort during hot weather and give students more usable community space during breaks.",
    feasibility:
      "The school could begin with a small number of movable benches or shaded tables before making larger changes.",
    status: "public",
    createdAt: daysAgo(5),
    signatures: 46,
    threshold: 50,
    signedBy: ["student-002"],
  },
  {
    id: 2,
    title: "Improve Cafeteria Line Organization",
    category: "Cafeteria / Food Services",
    impact: "The entire high school community",
    description:
      "Lunch lines can become crowded and unclear. A clearer line system or grade-level rotation could reduce waiting time and confusion.",
    rationale:
      "Students have limited lunch time, so reducing congestion would help students eat and return to class more comfortably.",
    feasibility:
      "This could be tested for one week using temporary signs and STUCO volunteers.",
    status: "threshold",
    createdAt: daysAgo(13),
    signatures: 56,
    threshold: 50,
    signedBy: ["student-001", "student-002"],
  },
];

function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function isSchoolEmail(email: string) {
  return email.toLowerCase().endsWith(SCHOOL_DOMAIN);
}

function displayNameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function userFromSupabase(authUser: SupabaseAuthUser): User | null {
  const email = authUser.email?.toLowerCase();
  if (!email || !isSchoolEmail(email)) return null;

  return {
    id: authUser.id,
    name: String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || displayNameFromEmail(email)),
    email,
    role: STUCO_ADMIN_EMAILS.includes(email) ? "stuco_admin" : "student",
    grade: "Student",
  };
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

function getDaysRemaining(petition: Petition, nowMs = Date.now()) {
  const createdAt = new Date(petition.createdAt).getTime();
  const closeAt = createdAt + PETITION_DURATION_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((closeAt - nowMs) / MS_PER_DAY));
}

function isPetitionExpired(petition: Petition, nowMs = Date.now()) {
  return getDaysRemaining(petition, nowMs) <= 0;
}

function reachedThreshold(petition: Petition) {
  return petition.signatures >= petition.threshold;
}

function getPetitionStatus(petition: Petition, nowMs = Date.now()): PetitionStatus {
  if (["discussion", "administration", "closed"].includes(petition.status)) {
    return petition.status;
  }

  if (isPetitionExpired(petition, nowMs)) {
    return reachedThreshold(petition) ? "threshold" : "closed";
  }

  if (reachedThreshold(petition) && petition.status === "public") {
    return "threshold";
  }

  return petition.status;
}

function getTimeRemainingText(petition: Petition, nowMs = Date.now()) {
  if (petition.status === "discussion") return "Signing closed · Under STUCO discussion";
  if (petition.status === "administration") return "Signing closed · Sent to administration";
  if (petition.status === "closed") return "Closed";

  const days = getDaysRemaining(petition, nowMs);

  if (isPetitionExpired(petition, nowMs)) {
    return reachedThreshold(petition) ? "Signing closed · STUCO review needed" : "Closed";
  }

  return days === 1 ? "1 day remaining" : `${days} days remaining`;
}

function formValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function isPetitionOpenForSigning(petition: Petition, nowMs = Date.now()) {
  const status = getPetitionStatus(petition, nowMs);
  return (status === "public" || status === "threshold") && !isPetitionExpired(petition, nowMs);
}

function shouldShowTimeBadge(petition: Petition, status: PetitionStatus, nowMs = Date.now()) {
  return !(status === "closed" && getTimeRemainingText(petition, nowMs) === "Closed");
}

function statusTone(status: PetitionStatus | SubmissionStatus): Tone {
  if (status === "closed" || status === "private_only") return "red";
  if (status === "threshold") return "green";
  if (status === "pending" || status === "revision") return "amber";
  if (status === "public" || status === "public_consent_requested" || status === "administration") return "blue";
  return "green";
}

function petitionCardTone(status: PetitionStatus) {
  const tones: Record<PetitionStatus, string> = {
    public: "border-blue-200 bg-blue-50/75 hover:bg-blue-50",
    threshold: "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-50",
    discussion: "border-blue-200 bg-blue-50/80 hover:bg-blue-50",
    administration: "border-violet-200 bg-violet-50/80 hover:bg-violet-50",
    closed: "border-rose-200 bg-rose-50/80 hover:bg-rose-50",
  };
  return tones[status];
}

function Badge({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={classNames("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

function ProgressBar({ value, max, muted = false }: { value: number; max: number; muted?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const thresholdReached = value >= max;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{value} signatures</span>
        <span>{max} needed</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div className={classNames("h-full rounded-full transition-all", thresholdReached ? "bg-emerald-500" : muted ? "bg-slate-400" : "bg-blue-600")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MessageLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 5.5h11a2 2 0 0 1 2 2v7.7a2 2 0 0 1-2 2h-7.1l-4.9 3v-3a2 2 0 0 1-1-1.7v-8a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function PersonIcon({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.15} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.8" />
      <path d="M6.5 20c.45-4.25 2.6-6.4 5.5-6.4s5.05 2.15 5.5 6.4" />
    </svg>
  );
}

export default function HighSchoolSuggestionBoxWebsite() {
  const [currentUser, setCurrentUser] = useState<User | null>(isSupabaseConfigured ? null : MOCK_USERS[0]);
  const [authError, setAuthError] = useState("");
  const [page, setPage] = useState<Page>("home");
  const [petitionViewId, setPetitionViewId] = useState(1);
  const [petitions, setPetitions] = useState<Petition[]>(INITIAL_PETITIONS);
  const [submissions, setSubmissions] = useState<Submission[]>([
    {
      id: 101,
      userId: "student-001",
      studentName: "Carlos Nguyen",
      studentEmail: "carlos.nguyen@stpaulhanoi.com",
      submitterName: "Carlos Nguyen",
      gradeLevel: "Grade 11",
      acknowledged: true,
      type: "Private Suggestion",
      title: "More club fair information before sign-ups",
      category: "Clubs & Athletics",
      impact: "Most students",
      description: "Students often miss club fair details before sign-ups begin.",
      rationale: "More advance information would help students choose clubs more thoughtfully.",
      feasibility: "STUCO could publish a short club preview document before the fair.",
      status: "pending",
    },
    {
      id: 102,
      userId: "student-002",
      studentName: "Mina Park",
      studentEmail: "mina.park@stpaulhanoi.com",
      submitterName: "Mina Park",
      gradeLevel: "Grade 12",
      acknowledged: true,
      type: "Petition Request",
      title: "More quiet study spaces during lunch",
      category: "Facilities & Campus",
      impact: "Most students",
      description: "Some students want a quiet place to study or finish work during lunch, but available spaces are limited.",
      rationale: "A quiet study area would support students who need a calm space during the school day.",
      feasibility: "The school could test one supervised classroom or library zone during lunch for two weeks.",
      status: "pending",
    },
  ]);
  const [comments, setComments] = useState<PetitionComment[]>([
    {
      id: 201,
      petitionId: 1,
      userId: "student-002",
      studentName: "Mina Park",
      studentEmail: "mina.park@stpaulhanoi.com",
      body: "This would make the outdoor tables easier to use during lunch, especially on very sunny days.",
      status: "approved",
      createdAt: daysAgo(1),
      reactions: { "student-001": "like" },
    },
  ]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [adminSubmissionViewId, setAdminSubmissionViewId] = useState<number | null>(null);
  const [studentSubmissionViewId, setStudentSubmissionViewId] = useState<number | null>(null);
  const [, setMySubmissionsClickCount] = useState(0);
  const [developerMode, setDeveloperMode] = useState(false);
  const [mockCurrentDate, setMockCurrentDate] = useState("");
  const isAdmin = currentUser?.role === "stuco_admin";
  const isStudent = currentUser?.role === "student";
  const currentTimeMs = useMemo(() => (mockCurrentDate ? new Date(`${mockCurrentDate}T12:00:00`).getTime() : Date.now()), [mockCurrentDate]);
  const developerDateValue = mockCurrentDate || new Date(currentTimeMs).toISOString().slice(0, 10);

  useEffect(() => {
    if (!supabase) return undefined;
    const authClient = supabase.auth;

    let isMounted = true;

    const applyAuthUser = async (authUser: SupabaseAuthUser | null) => {
      if (!authUser) {
        if (isMounted) setCurrentUser(null);
        return;
      }

      const nextUser = userFromSupabase(authUser);
      if (!nextUser) {
        await authClient.signOut();
        if (isMounted) {
          setCurrentUser(null);
          setAuthError(`Only ${SCHOOL_DOMAIN} Google accounts can use Suggestion Box.`);
          setPage("login");
        }
        return;
      }

      if (isMounted) {
        setAuthError("");
        setCurrentUser(nextUser);
      }
    };

    authClient.getSession().then(({ data }) => {
      void applyAuthUser(data.session?.user ?? null);
    });

    const { data: listener } = authClient.onAuthStateChange((_event, session) => {
      void applyAuthUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const closeExpiredPetitions = () => {
      setPetitions((prev) =>
        prev.map((petition) => {
          if (!isPetitionExpired(petition, currentTimeMs)) return petition;
          if (["discussion", "administration", "closed"].includes(petition.status)) return petition;
          return { ...petition, status: reachedThreshold(petition) ? "threshold" : "closed" };
        })
      );
    };

    closeExpiredPetitions();
    const timer = window.setInterval(closeExpiredPetitions, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [currentTimeMs]);

  const activePetitions = petitions.filter((petition) => ["public", "threshold", "discussion"].includes(getPetitionStatus(petition, currentTimeMs))).length;
  const sentToAdmin = petitions.filter((petition) => petition.status === "administration").length;
  const visibleSubmissions = isAdmin ? submissions : submissions.filter((submission) => submission.userId === currentUser?.id);

  const filteredPetitions = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return petitions.filter((petition) => {
      const matchesCategory = filter === "All" || petition.category === filter;
      const matchesQuery = `${petition.title} ${petition.description}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [petitions, filter, query]);

  function navigate(targetPage: Page) {
    if (!currentUser && targetPage !== "home") {
      setPage("login");
      return;
    }
    if ((targetPage === "admin" || targetPage === "admin-submission-detail" || targetPage === "admin-petition-detail") && !isAdmin) {
      setPage("not-authorized");
      return;
    }
    if (targetPage === "submission-detail" && !isStudent) {
      setPage("not-authorized");
      return;
    }
    if (targetPage === "submit") {
      setEditingSubmissionId(null);
    }
    setPage(targetPage);
  }

  function handleNavClick(targetPage: Page) {
    if (targetPage === "my") {
      setMySubmissionsClickCount((count) => {
        const nextCount = count + 1;
        if (nextCount >= 8 && !developerMode) {
          setDeveloperMode(true);
          window.alert("Developer options enabled.");
        }
        return nextCount;
      });
    }
    navigate(targetPage);
  }

  function setDeveloperSignature(petitionId: number, signatures: number) {
    setPetitions((prev) =>
      prev.map((petition) => {
        if (petition.id !== petitionId) return petition;
        const nextSignatures = Math.max(0, signatures);
        const nextStatus: PetitionStatus =
          petition.status === "public" || petition.status === "threshold"
            ? nextSignatures >= petition.threshold
              ? "threshold"
              : "public"
            : petition.status;
        return { ...petition, signatures: nextSignatures, status: nextStatus };
      })
    );
  }

  async function signInWithGoogle() {
    if (!supabase) {
      window.alert("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: SCHOOL_DOMAIN.replace("@", ""),
        },
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }

  function signPetition(id: number) {
    if (!currentUser) {
      setPage("login");
      return;
    }
    if (!isStudent) {
      window.alert("Only student accounts can sign petitions.");
      return;
    }

    const targetPetition = petitions.find((petition) => petition.id === id);
    if (!targetPetition || !isPetitionOpenForSigning(targetPetition, currentTimeMs)) {
      window.alert("This petition's signing period is closed.");
      return;
    }

    setPetitions((prev) =>
      prev.map((petition) => {
        if (petition.id !== id || petition.signedBy.includes(currentUser.id)) return petition;
        const newCount = petition.signatures + 1;
        return {
          ...petition,
          signatures: newCount,
          signedBy: [...petition.signedBy, currentUser.id],
          status: newCount >= petition.threshold ? "threshold" : petition.status,
        };
      })
    );
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const confirmed = window.confirm(SUBMISSION_CONFIRMATION_MESSAGE);
    if (!confirmed) return;

    if (!currentUser) {
      setPage("login");
      return;
    }
    if (!isStudent) {
      window.alert("Only student accounts can submit suggestions or petition requests.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const type = formValue(form, "submissionType");
    const nextSubmissionFields = {
      id: Date.now(),
      userId: currentUser.id,
      studentName: currentUser.name,
      studentEmail: currentUser.email,
      submitterName: currentUser.name,
      gradeLevel: formValue(form, "gradeLevel"),
      acknowledged: form.get("acknowledgement") === "on",
      type: type === "petition" ? "Petition Request" : "Private Suggestion",
      title: formValue(form, "title"),
      category: formValue(form, "category"),
      impact: formValue(form, "impact"),
      description: formValue(form, "description"),
      rationale: formValue(form, "rationale"),
      feasibility: formValue(form, "feasibility") || "No feasibility notes provided.",
      comments: formValue(form, "comments") || undefined,
      status: "pending",
    } satisfies Submission;

    if (editingSubmissionId) {
      setSubmissions((prev) =>
        prev.map((submission) =>
          submission.id === editingSubmissionId && submission.userId === currentUser.id && submission.status === "revision"
            ? { ...nextSubmissionFields, id: submission.id }
            : submission
        )
      );
      setEditingSubmissionId(null);
      window.alert("Revision submitted. STUCO can review it again.");
    } else {
      setSubmissions((prev) => [nextSubmissionFields, ...prev]);
      window.alert("Submitted. STUCO can now review it.");
    }

    event.currentTarget.reset();
    setPage("my");
  }

  function publishSubmissionForPublicOpinion(submission: Submission, finalSubmissionStatus: SubmissionStatus = "approved") {
    const newPetition: Petition = {
      id: Date.now(),
      title: submission.title,
      category: submission.category,
      impact: submission.impact || "Most students",
      description: submission.description || "No description provided.",
      rationale: submission.rationale || "No rationale provided.",
      feasibility: submission.feasibility || "No feasibility notes provided.",
      status: "public",
      createdAt: new Date(currentTimeMs).toISOString(),
      signatures: 0,
      threshold: 50,
      signedBy: [],
    };

    setPetitions((prev) => [newPetition, ...prev]);
    setSubmissions((prev) => prev.map((item) => (item.id === submission.id ? { ...item, status: finalSubmissionStatus } : item)));
  }

  function approveMockPetition(submission: Submission) {
    if (submission.type !== "Petition Request" || submission.status !== "pending") return;
    publishSubmissionForPublicOpinion(submission, "approved");
    window.alert("Petition approved and published. It is now visible on the Public Petitions page.");
  }

  function requestPublicOpinionPermission(submission: Submission) {
    if (submission.type !== "Private Suggestion") return;
    setSubmissions((prev) => prev.map((item) => (item.id === submission.id ? { ...item, status: "public_consent_requested" } : item)));
    window.alert("Request sent to the student. The suggestion will stay private unless the student approves public posting.");
  }

  function approvePublicOpinionRequest(submission: Submission) {
    if (submission.userId !== currentUser?.id) return;
    publishSubmissionForPublicOpinion(submission, "public_consent_approved");
    window.alert("Approved. Your suggestion is now public for student opinion.");
  }

  function declinePublicOpinionRequest(submission: Submission) {
    if (submission.userId !== currentUser?.id) return;
    setSubmissions((prev) => prev.map((item) => (item.id === submission.id ? { ...item, status: "private_only" } : item)));
    window.alert("Your suggestion will remain private to STUCO.");
  }

  function submitComment(event: FormEvent<HTMLFormElement>, petition: Petition) {
    event.preventDefault();
    if (!currentUser || !isStudent) {
      window.alert("Only student accounts can comment on petitions.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const body = formValue(form, "comment");
    if (body.length < 10) {
      window.alert("Please write at least 10 characters so STUCO can understand your point.");
      return;
    }

    const newComment: PetitionComment = {
      id: Date.now(),
      petitionId: petition.id,
      userId: currentUser.id,
      studentName: currentUser.name,
      studentEmail: currentUser.email,
      body: body.slice(0, 500),
      status: "pending",
      createdAt: new Date(currentTimeMs).toISOString(),
      reactions: {},
    };

    setComments((prev) => [newComment, ...prev]);
    event.currentTarget.reset();
    window.alert("Comment submitted for STUCO review before it appears publicly.");
  }

  function reactToComment(commentId: number, reaction: CommentReaction) {
    if (!currentUser || !isStudent) {
      window.alert("Only student accounts can react to comments.");
      return;
    }

    setComments((prev) =>
      prev.map((comment) => {
        if (comment.id !== commentId || comment.status !== "approved") return comment;
        const currentReaction = comment.reactions[currentUser.id];
        const nextReactions = { ...comment.reactions };

        if (currentReaction === reaction) {
          delete nextReactions[currentUser.id];
        } else {
          nextReactions[currentUser.id] = reaction;
        }

        return { ...comment, reactions: nextReactions };
      })
    );
  }

  function setCommentStatus(commentId: number, status: CommentStatus) {
    setComments((prev) => prev.map((comment) => (comment.id === commentId ? { ...comment, status } : comment)));
  }

  async function logout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setPage("home");
  }

  const viewedPetition = petitions.find((petition) => petition.id === petitionViewId) ?? petitions[0];
  const viewedPetitionStatus = viewedPetition ? getPetitionStatus(viewedPetition, currentTimeMs) : "closed";
  const hasSignedViewedPetition = Boolean(currentUser && viewedPetition?.signedBy.includes(currentUser.id));
  const openFilteredPetitions = filteredPetitions.filter((petition) => isPetitionOpenForSigning(petition, currentTimeMs));
  const closedFilteredPetitions = filteredPetitions.filter((petition) => !isPetitionOpenForSigning(petition, currentTimeMs));
  const editingSubmission = submissions.find((submission) => submission.id === editingSubmissionId && submission.userId === currentUser?.id && submission.status === "revision");
  const viewedAdminSubmission = submissions.find((submission) => submission.id === adminSubmissionViewId);
  const viewedStudentSubmission = submissions.find((submission) => submission.id === studentSubmissionViewId && submission.userId === currentUser?.id);
  const loginUsers = MOCK_USERS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button onClick={() => navigate("home")} className="flex items-center gap-2 text-left">
            <div className="grid h-12 w-12 place-items-center rounded-[1.15rem] bg-slate-950 text-white">
              <MessageLogo />
            </div>
            <div>
              <div className="text-base font-black">Suggestion Box</div>
              <div className="text-xs font-semibold text-slate-500">High School Student Council</div>
            </div>
          </button>

          <nav className="hidden items-center gap-2 md:flex">
            {[
              ["home", "Home"],
              ["submit", "Submit"],
              ["petitions", "Petitions"],
              ["my", "My Submissions"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleNavClick(key as Page)}
                className={classNames("rounded-xl px-3 py-2 text-sm font-bold transition", page === key ? "bg-slate-950 text-white hover:bg-slate-900" : "text-slate-600 hover:bg-slate-200 hover:text-slate-950")}
              >
                {label}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => navigate("admin")} className={classNames("rounded-xl px-3 py-2 text-sm font-bold transition", page === "admin" ? "bg-slate-950 text-white hover:bg-slate-900" : "text-slate-600 hover:bg-slate-200 hover:text-slate-950")}>
                STUCO Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="ml-auto flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm md:min-w-[210px] md:px-4">
                <PersonIcon className="shrink-0 text-slate-950" size={22} />
                <div className="hidden min-w-0 flex-1 text-right md:block">
                  <div className="truncate text-sm font-black leading-tight">{currentUser.name}</div>
                  <div className="mt-0.5 text-xs font-black leading-tight text-slate-500">{currentUser.role === "stuco_admin" ? "STUCO Admin" : "Student"}</div>
                </div>
                <button onClick={logout} className="shrink-0 rounded-xl p-1.5 text-slate-950 hover:bg-slate-100" aria-label="Log out">
                  <LogOut size={22} strokeWidth={2.3} />
                </button>
              </div>
            ) : (
              <button onClick={() => setPage("login")} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
                School Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-8 pt-20">
        {page === "home" && (
          <div className="space-y-8">
            <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-sm">
              <div className="grid gap-8 p-8 md:grid-cols-[1.25fr_0.75fr] md:p-12">
                <div>
                  <Badge tone="blue">{HOMEPAGE_BADGE_TEXT}</Badge>
                  <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-6xl">Turn school suggestions into visible action.</h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{HOMEPAGE_DESCRIPTION}</p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button onClick={() => navigate("submit")} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
                      Submit a Suggestion
                    </button>
                    <button onClick={() => navigate("petitions")} className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white">
                      View Petitions
                    </button>
                    {!currentUser && (
                      <button onClick={() => setPage("login")} className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white">
                        Sign in with {SCHOOL_DOMAIN} Account
                      </button>
                    )}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <div className="flex items-center gap-3">
                    <BarChart3 />
                    <h2 className="font-black">Live Suggestion Box Snapshot</h2>
                  </div>
                  <div className="mt-5 grid gap-3">
                    <StatCard label="Total submissions" value={submissions.length + petitions.length} tone="blue" />
                    <StatCard label="Active petitions" value={activePetitions} tone="green" />
                    <StatCard label="Sent to administration" value={sentToAdmin} tone="amber" />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              {HOMEPAGE_FEATURES.map((feature) => (
                <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} text={feature.text} />
              ))}
            </section>
          </div>
        )}

        {page === "login" && (
          <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">
                <Lock size={20} />
              </div>
              <div>
                <h1 className="text-3xl font-black">School Account Login</h1>
                <p className="mt-1 text-sm text-slate-600">{isSupabaseConfigured ? `Sign in with your ${SCHOOL_DOMAIN} Google account.` : `Prototype login. Configure Supabase to enable real Google login for ${SCHOOL_DOMAIN} accounts.`}</p>
              </div>
            </div>

            {authError && <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">{authError}</div>}

            {isSupabaseConfigured ? (
              <div className="mt-6 grid gap-3">
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <div className="text-base font-black leading-tight">Continue with Google</div>
                    <div className="mt-2 text-sm font-semibold leading-tight text-slate-500">Use a real {SCHOOL_DOMAIN} account. STUCO admin access is based on the admin email list.</div>
                  </div>
                  <ArrowRight className="shrink-0 text-slate-500" />
                </button>
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
                <div>
                  <h2 className="font-black">Use a Sample Account</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">For assignment review, choose one of these demo users without using Google login.</p>
                </div>
                <Badge tone="amber">Demo Mode</Badge>
              </div>

              <div className="mt-4 grid gap-3">
                {loginUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (!isSchoolEmail(user.email)) {
                        window.alert(`Only ${SCHOOL_DOMAIN} accounts can log in.`);
                        return;
                      }
                      setAuthError("");
                      setCurrentUser(user);
                      setPage("home");
                    }}
                    className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-base font-black leading-tight">{user.name}</div>
                      <div className="mt-3 truncate text-sm font-extrabold leading-tight text-slate-500">{user.email}</div>
                    </div>
                    <Badge tone={user.role === "stuco_admin" ? "blue" : "green"}>{user.role === "stuco_admin" ? "STUCO Admin" : "Student"}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {page === "not-authorized" && (
          <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Lock className="mx-auto" size={32} />
            <h1 className="mt-4 text-2xl font-black">Admin Access Required</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Only STUCO admin accounts can open the admin dashboard.</p>
            <button onClick={() => setPage("login")} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
              Switch Account
            </button>
          </section>
        )}

        {page === "submit" && (
          <ProtectedPage currentUser={currentUser} requiredRole="student" onLogin={() => setPage("login")}>
            <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h1 className="text-3xl font-black">{editingSubmission ? "Revise Submission" : "Submit to Student Council"}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{editingSubmission ? "Update the fields STUCO asked you to revise, then resubmit for review." : "Choose a private suggestion or petition request. Petition requests are reviewed by STUCO before becoming public."}</p>
              <form key={editingSubmission?.id ?? "new-submission"} onSubmit={submitForm} className="mt-8 space-y-5">
                <FormSection title="Section 1: Acknowledgement" description="Confirm that this form is for constructive school community suggestions.">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                    <input type="checkbox" name="acknowledgement" required defaultChecked={editingSubmission?.acknowledged} className="h-4 w-4 shrink-0" />
                    <span>
                      I understand that this form is not for personal or individual complaints involving specific students or staff. Suggestions should be respectful, constructive, and relevant to the high school community.
                    </span>
                  </label>
                </FormSection>

                <FormSection title="Section 2: Submitter Information" description="This information is visible to STUCO only for review and follow-up.">
                  <TextField name="submitterName" label="Name" defaultValue={currentUser?.name || ""} readOnly />
                  <RadioGroup name="gradeLevel" label="Grade Level" options={GRADE_LEVELS} defaultValue={editingSubmission?.gradeLevel || currentUser?.grade} />
                </FormSection>

                <FormSection title="Section 3: Suggestion Type and Category" description="Tell STUCO how this idea should be reviewed.">
                  <div>
                    <FieldLabel required>Submission Type</FieldLabel>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="rounded-2xl border border-slate-200 p-4 text-sm font-bold">
                        <input className="mr-2" type="radio" name="submissionType" value="suggestion" defaultChecked={!editingSubmission || editingSubmission.type === "Private Suggestion"} /> Private Suggestion
                      </label>
                      <label className="rounded-2xl border border-slate-200 p-4 text-sm font-bold">
                        <input className="mr-2" type="radio" name="submissionType" value="petition" defaultChecked={editingSubmission?.type === "Petition Request"} /> Petition Request
                      </label>
                    </div>
                  </div>
                  <SelectField name="category" label="Category of Suggestion" options={CATEGORIES} defaultValue={editingSubmission?.category} />
                  <SelectField name="impact" label="Impact on the School Community" options={IMPACT_GROUPS} defaultValue={editingSubmission?.impact} />
                </FormSection>

                <FormSection title="Section 4: Suggestion Details" description="Explain the issue or idea clearly enough for STUCO to understand it.">
                  <TextField name="title" label="Title of Suggestion" placeholder="Example: Add more shaded outdoor seating" defaultValue={editingSubmission?.title} />
                  <TextArea name="description" label="Description of the Suggestion" defaultValue={editingSubmission?.description} />
                  <TextArea name="rationale" label="Rationale" defaultValue={editingSubmission?.rationale} />
                </FormSection>

                <FormSection title="Section 5: Feasibility and Additional Comments" description="Help STUCO understand how realistic the idea may be.">
                  <TextArea name="feasibility" label="Feasibility Considerations" defaultValue={editingSubmission?.feasibility} />
                  <TextArea name="comments" label="Additional Comments" required={false} defaultValue={editingSubmission?.comments} />
                </FormSection>
                <button className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">{editingSubmission ? "Resubmit for STUCO Review" : "Submit for STUCO Review"}</button>
              </form>
            </section>
          </ProtectedPage>
        )}

        {page === "petitions" && (
          <ProtectedPage currentUser={currentUser} onLogin={() => setPage("login")}>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <h1 className="text-3xl font-black">Public Petitions</h1>
                  <p className="mt-2 text-sm text-slate-600">Approved petitions appear here. Students can sign each petition once using their school account.</p>
                </div>
                {isStudent && (
                  <button onClick={() => navigate("submit")} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
                    Start a Petition
                  </button>
                )}
              </div>
              <div className="mt-8 grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search petitions..." className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm" />
                </div>
                <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
                  <option>All</option>
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="mt-8 space-y-8">
                <PetitionSection title="Open Petitions" petitions={openFilteredPetitions} currentUser={currentUser} currentTimeMs={currentTimeMs} onOpen={(id) => { setPetitionViewId(id); setPage("detail"); }} />
                <PetitionSection title="Closed Petitions" petitions={closedFilteredPetitions} currentUser={currentUser} currentTimeMs={currentTimeMs} onOpen={(id) => { setPetitionViewId(id); setPage("detail"); }} emptyText="No closed petitions match this search." />
              </div>
            </section>
          </ProtectedPage>
        )}

        {page === "detail" && viewedPetition && (
          <ProtectedPage currentUser={currentUser} onLogin={() => setPage("login")}>
            <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <button onClick={() => setPage("petitions")} className="mb-5 text-sm font-bold text-slate-500">
                Back to petitions
              </button>
              <div className="flex flex-wrap gap-2">
                <Badge>{viewedPetition.category}</Badge>
                <Badge tone={statusTone(viewedPetitionStatus)}>{STATUS_LABELS[viewedPetitionStatus]}</Badge>
                {shouldShowTimeBadge(viewedPetition, viewedPetitionStatus, currentTimeMs) && <Badge tone={viewedPetitionStatus === "closed" ? "red" : "blue"}>{getTimeRemainingText(viewedPetition, currentTimeMs)}</Badge>}
                {hasSignedViewedPetition && <Badge tone="blue">Signed by you</Badge>}
              </div>
              <h1 className="mt-5 text-3xl font-black">{viewedPetition.title}</h1>
              <p className="mt-4 text-sm leading-7 text-slate-700">{viewedPetition.description}</p>
              <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                <ProgressBar value={viewedPetition.signatures} max={viewedPetition.threshold} muted={viewedPetitionStatus === "closed" && !reachedThreshold(viewedPetition)} />
              </div>
              {isStudent ? (
                <button
                  onClick={() => signPetition(viewedPetition.id)}
                  disabled={hasSignedViewedPetition || !isPetitionOpenForSigning(viewedPetition, currentTimeMs)}
                  className={classNames(
                    "mt-6 w-full rounded-[1.75rem] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed",
                    hasSignedViewedPetition || !isPetitionOpenForSigning(viewedPetition, currentTimeMs)
                      ? "bg-slate-400"
                      : "bg-slate-950"
                  )}
                >
                  {!isPetitionOpenForSigning(viewedPetition, currentTimeMs) && !hasSignedViewedPetition ? "Petition Signing Closed" : hasSignedViewedPetition ? `Already Signed with Your ${SCHOOL_DOMAIN} Account` : `Sign Petition with ${SCHOOL_DOMAIN} Account`}
                </button>
              ) : (
                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Admin accounts can review petitions but cannot sign as students.</div>
              )}
              <div className="mt-8 grid gap-4 border-t border-slate-200 pt-6 md:grid-cols-2">
                <InfoBlock title="Rationale" text={viewedPetition.rationale} />
                <InfoBlock title="Impact Group" text={viewedPetition.impact} />
                <InfoBlock title="Feasibility" text={viewedPetition.feasibility} />
                <InfoBlock title="Privacy" text="Public pages do not show student identity. STUCO admins can see submitter identity for review purposes." />
              </div>
              <PetitionComments
                comments={comments.filter((comment) => comment.petitionId === viewedPetition.id)}
                currentUser={currentUser}
                isStudent={isStudent}
                onSubmit={(event) => submitComment(event, viewedPetition)}
                onReact={reactToComment}
              />
            </section>
          </ProtectedPage>
        )}

        {page === "my" && (
          <ProtectedPage currentUser={currentUser} requiredRole="student" onLogin={() => setPage("login")}>
            <section>
              <h1 className="text-3xl font-black">My Submissions</h1>
              <p className="mt-2 text-sm text-slate-600">Students can track whether their ideas are pending, approved, escalated, or closed.</p>
              <div className="mt-6 grid gap-4">
                {visibleSubmissions.length > 0 ? (
                  visibleSubmissions.map((submission) => (
                    <div key={submission.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                        <div className="min-w-0">
                          <h2 className="text-xl font-black [overflow-wrap:anywhere]">{submission.title}</h2>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {submission.category} · {submission.type}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={statusTone(submission.status)}>{STATUS_LABELS[submission.status]}</Badge>
                          <button
                            onClick={() => {
                              setStudentSubmissionViewId(submission.id);
                              setPage("submission-detail");
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full text-2xl font-black leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                            aria-label="View submission details"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                      {submission.status === "public_consent_requested" && (
                        <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                          <div className="font-black">STUCO is asking to make this suggestion public.</div>
                          <p className="mt-1">STUCO thinks this idea may need wider student opinion before it can be considered properly. Your name and email will stay hidden from the public page.</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => approvePublicOpinionRequest(submission)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
                              Allow Public Posting
                            </button>
                            <button onClick={() => declinePublicOpinionRequest(submission)} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black">
                              Keep Private
                            </button>
                          </div>
                        </div>
                      )}
                      {submission.status === "revision" && (
                        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                          <div className="font-black">STUCO requested a revision.</div>
                          <p className="mt-1">You can edit this submission and send it back to STUCO for another review.</p>
                          <button
                            onClick={() => {
                              setEditingSubmissionId(submission.id);
                              setPage("submit");
                            }}
                            className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
                          >
                            Edit and Resubmit
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">You have not submitted anything yet.</div>
                )}
              </div>
            </section>
          </ProtectedPage>
        )}

        {page === "submission-detail" && (
          <ProtectedPage currentUser={currentUser} requiredRole="student" onLogin={() => setPage("login")}>
            {viewedStudentSubmission ? (
              <StudentSubmissionDetail submission={viewedStudentSubmission} onBack={() => setPage("my")} />
            ) : (
              <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                <button onClick={() => setPage("my")} className="mb-5 text-sm font-bold text-slate-500">
                  Back to my submissions
                </button>
                <h1 className="text-3xl font-black">Submission Not Found</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">This submission is no longer available.</p>
              </section>
            )}
          </ProtectedPage>
        )}

        {page === "admin" && (
          <ProtectedPage currentUser={currentUser} requiredRole="stuco_admin" onLogin={() => setPage("login")}>
            <section>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <h1 className="text-3xl font-black">STUCO Admin Dashboard</h1>
                  <p className="mt-2 text-sm text-slate-600">Review submissions, approve petitions, and escalate high-support petitions.</p>
                </div>
                <Badge tone="blue">
                  <Lock size={13} className="mr-1" /> Admin account: {currentUser?.email}
                </Badge>
              </div>
              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                <AdminPendingSubmissions
                  submissions={submissions}
                  onApprove={approveMockPetition}
                  onRequestPublic={requestPublicOpinionPermission}
                  onSetStatus={(id, status) => setSubmissions((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))}
                  onViewDetails={(id) => {
                    setAdminSubmissionViewId(id);
                    setPage("admin-submission-detail");
                  }}
                />
                <AdminPetitionActions petitions={petitions} currentTimeMs={currentTimeMs} onSetStatus={(id, status) => setPetitions((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))} />
                <AdminUnderDiscussion
                  petitions={petitions}
                  onSetStatus={(id, status) => setPetitions((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))}
                  onViewDetails={(id) => {
                    setPetitionViewId(id);
                    setPage("admin-petition-detail");
                  }}
                />
                <AdminSentToAdministration
                  petitions={petitions}
                  onViewDetails={(id) => {
                    setPetitionViewId(id);
                    setPage("admin-petition-detail");
                  }}
                />
                <AdminCommentModeration comments={comments} petitions={petitions} onSetStatus={setCommentStatus} />
              </div>
            </section>
          </ProtectedPage>
        )}

        {page === "admin-petition-detail" && viewedPetition && (
          <ProtectedPage currentUser={currentUser} requiredRole="stuco_admin" onLogin={() => setPage("login")}>
            <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <button onClick={() => setPage("admin")} className="mb-5 text-sm font-bold text-slate-500">
                Back to dashboard
              </button>
              <div className="flex flex-wrap gap-2">
                <Badge>{viewedPetition.category}</Badge>
                <Badge tone={statusTone(viewedPetitionStatus)}>{STATUS_LABELS[viewedPetitionStatus]}</Badge>
                {shouldShowTimeBadge(viewedPetition, viewedPetitionStatus, currentTimeMs) && <Badge tone={viewedPetitionStatus === "closed" ? "red" : "blue"}>{getTimeRemainingText(viewedPetition, currentTimeMs)}</Badge>}
              </div>
              <h1 className="mt-5 text-3xl font-black">{viewedPetition.title}</h1>
              <p className="mt-4 text-sm leading-7 text-slate-700">{viewedPetition.description}</p>
              <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                <ProgressBar value={viewedPetition.signatures} max={viewedPetition.threshold} muted={viewedPetitionStatus === "closed" && !reachedThreshold(viewedPetition)} />
              </div>
              <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Read-only admin view. Admin accounts can review petition details but cannot sign.</div>
              <div className="mt-8 grid gap-4 border-t border-slate-200 pt-6 md:grid-cols-2">
                <InfoBlock title="Rationale" text={viewedPetition.rationale} />
                <InfoBlock title="Impact Group" text={viewedPetition.impact} />
                <InfoBlock title="Feasibility" text={viewedPetition.feasibility} />
                <InfoBlock title="Privacy" text="Public pages do not show student identity. STUCO admins can see submitter identity for review purposes." />
              </div>
            </section>
          </ProtectedPage>
        )}

        {page === "admin-submission-detail" && (
          <ProtectedPage currentUser={currentUser} requiredRole="stuco_admin" onLogin={() => setPage("login")}>
            {viewedAdminSubmission ? (
              <AdminSubmissionDetail submission={viewedAdminSubmission} onBack={() => setPage("admin")} />
            ) : (
              <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                <button onClick={() => setPage("admin")} className="mb-5 text-sm font-bold text-slate-500">
                  Back to dashboard
                </button>
                <h1 className="text-3xl font-black">Submission Not Found</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">This submission is no longer available.</p>
              </section>
            )}
          </ProtectedPage>
        )}
      </main>
      {developerMode && (
        <DeveloperPanel
          petitions={petitions}
          currentDate={developerDateValue}
          onDateChange={setMockCurrentDate}
          onResetDate={() => setMockCurrentDate("")}
          onSetSignature={setDeveloperSignature}
          onClose={() => setDeveloperMode(false)}
        />
      )}
      <Footer />
    </div>
  );
}

function DeveloperPanel({
  petitions,
  currentDate,
  onDateChange,
  onResetDate,
  onSetSignature,
  onClose,
}: {
  petitions: Petition[];
  currentDate: string;
  onDateChange: (date: string) => void;
  onResetDate: () => void;
  onSetSignature: (petitionId: number, signatures: number) => void;
  onClose: () => void;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  function startDrag(event: ReactMouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("input, button, select, textarea")) return;
    const panel = event.currentTarget;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    function movePanel(moveEvent: MouseEvent) {
      const x = Math.min(Math.max(8, moveEvent.clientX - offsetX), window.innerWidth - rect.width - 8);
      const y = Math.min(Math.max(8, moveEvent.clientY - offsetY), window.innerHeight - rect.height - 8);
      setPosition({ x, y });
    }

    function stopDrag() {
      window.removeEventListener("mousemove", movePanel);
      window.removeEventListener("mouseup", stopDrag);
    }

    setPosition({ x: rect.left, y: rect.top });
    window.addEventListener("mousemove", movePanel);
    window.addEventListener("mouseup", stopDrag);
    event.preventDefault();
  }

  return (
    <aside
      onMouseDown={startDrag}
      className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] cursor-grab rounded-3xl border border-slate-300 bg-white p-4 shadow-2xl active:cursor-grabbing"
      style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
      aria-label="Developer options"
    >
      <h2 className="select-none text-base font-black">Developer Options</h2>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Testing controls for petition signatures and the date used for days remaining.</p>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="text-xs font-black text-slate-700">Current date</span>
          <input type="date" value={currentDate} onChange={(event) => onDateChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>

        {petitions.map((petition) => (
          <label key={petition.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3">
            <span className="min-w-0 text-xs font-black leading-5 text-slate-700 [overflow-wrap:anywhere]">{petition.title}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={petition.signatures}
              onChange={(event) => onSetSignature(petition.id, Number(event.target.value))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onResetDate} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
          Use Real Date
        </button>
        <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">
          Hide
        </button>
      </div>
    </aside>
  );
}

function Footer() {
  return (
    <footer className="mt-8 bg-slate-200/70 px-4 py-8">
      <div className="mx-auto max-w-6xl pl-4 text-sm md:pl-8">
        <h2 className="font-black text-slate-950">High School Student Council</h2>
        <div className="mt-3 grid gap-2 text-slate-600 md:grid-cols-2">
          <div>
            <span className="font-black text-slate-700">Email: </span>
            <a className="font-semibold text-slate-600 hover:text-slate-950" href={`mailto:${STUCO_CONTACT.email}`}>{STUCO_CONTACT.email}</a>
          </div>
          <div>
            <span className="font-black text-slate-700">President: </span>
            <strong className="text-slate-500">{STUCO_CONTACT.president}</strong>
          </div>
          <div>
            <span className="font-black text-slate-700">President Contact: </span>
            <a className="font-semibold text-slate-600 hover:text-slate-950" href={`mailto:${STUCO_CONTACT.presidentEmail}`}>{STUCO_CONTACT.presidentEmail}</a>
          </div>
          <div>
            <span className="font-black text-slate-700">Vice President: </span>
            <strong className="text-slate-500">{STUCO_CONTACT.vicePresident}</strong>
          </div>
          <div>
            <span className="font-black text-slate-700">Vice President Contact: </span>
            <a className="font-semibold text-slate-600 hover:text-slate-950" href={`mailto:${STUCO_CONTACT.vicePresidentEmail}`}>{STUCO_CONTACT.vicePresidentEmail}</a>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-3 text-xs font-bold text-slate-500">{STUCO_CONTACT.commissionedBy}</div>
      </div>
    </footer>
  );
}

function ProtectedPage({ currentUser, requiredRole, onLogin, children }: { currentUser: User | null; requiredRole?: Role; onLogin: () => void; children: ReactNode }) {
  if (!currentUser) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Lock className="mx-auto" size={32} />
        <h1 className="mt-4 text-2xl font-black">School Login Required</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Please sign in with your {SCHOOL_DOMAIN} account before using this page.</p>
        <button onClick={onLogin} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
          Sign in with {SCHOOL_DOMAIN} Account
        </button>
      </section>
    );
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Lock className="mx-auto" size={32} />
        <h1 className="mt-4 text-2xl font-black">Access Restricted</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">This page is only available to {requiredRole === "stuco_admin" ? "STUCO admin" : "student"} accounts.</p>
      </section>
    );
  }

  return <>{children}</>;
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "blue" | "green" | "amber" }) {
  const tones = {
    default: "bg-white text-slate-950",
    blue: "bg-blue-500/20 text-blue-50 ring-1 ring-blue-300/30",
    green: "bg-emerald-500/20 text-emerald-50 ring-1 ring-emerald-300/30",
    amber: "bg-amber-400/20 text-amber-50 ring-1 ring-amber-200/30",
  };
  const labelTones = {
    default: "text-slate-500",
    blue: "text-blue-100",
    green: "text-emerald-100",
    amber: "text-amber-100",
  };

  return (
    <div className={classNames("rounded-2xl p-4", tones[tone])}>
      <div className="text-3xl font-black">{value}</div>
      <div className={classNames("mt-1 text-xs font-bold", labelTones[tone])}>{label}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function PetitionSection({
  title,
  petitions,
  currentUser,
  currentTimeMs,
  onOpen,
  emptyText = "No open petitions match this search.",
}: {
  title: string;
  petitions: Petition[];
  currentUser: User | null;
  currentTimeMs: number;
  onOpen: (id: number) => void;
  emptyText?: string;
}) {
  return (
    <section>
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 grid gap-4">
        {petitions.length > 0 ? (
          petitions.map((petition) => {
            const signed = Boolean(currentUser && petition.signedBy.includes(currentUser.id));
            const petitionStatus = getPetitionStatus(petition, currentTimeMs);
            return (
              <button key={petition.id} onClick={() => onOpen(petition.id)} className={classNames("rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", petitionCardTone(petitionStatus))}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">{petition.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge>{petition.category}</Badge>
                      <Badge tone={statusTone(petitionStatus)}>{STATUS_LABELS[petitionStatus]}</Badge>
                      {shouldShowTimeBadge(petition, petitionStatus, currentTimeMs) && <Badge tone={petitionStatus === "closed" ? "red" : "blue"}>{getTimeRemainingText(petition, currentTimeMs)}</Badge>}
                      {signed && <Badge tone="blue">Signed by you</Badge>}
                    </div>
                  </div>
                  <ArrowRight className="text-slate-400" />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{petition.description}</p>
                <div className="mt-5">
                  <ProgressBar value={petition.signatures} max={petition.threshold} muted={petitionStatus === "closed" && !reachedThreshold(petition)} />
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">{emptyText}</div>
        )}
      </div>
    </section>
  );
}

function TextField({ name, label, placeholder, defaultValue, readOnly = false }: { name: string; label: string; placeholder?: string; defaultValue?: string; readOnly?: boolean }) {
  return (
    <label className="block">
      <FieldLabel required>{label}</FieldLabel>
      <input
        required
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className={classNames(
          "mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400",
          readOnly && "bg-slate-100 text-slate-600"
        )}
      />
    </label>
  );
}

function TextArea({ name, label, required = true, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      <textarea required={required} name={name} rows={4} defaultValue={defaultValue} className="mt-3 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
    </label>
  );
}

function SelectField({ name, label, options, defaultValue }: { name: string; label: string; options: readonly string[]; defaultValue?: string }) {
  return (
    <label className="block">
      <FieldLabel required>{label}</FieldLabel>
      <select required name={name} defaultValue={defaultValue} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-black">
      {children}
      {required && <span className="ml-1 text-rose-600" aria-label="required">*</span>}
    </span>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <details open className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none rounded-3xl p-5 marker:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <span className="text-2xl font-black text-slate-400">⌄</span>
        </div>
      </summary>
      <div className="space-y-5 border-t border-slate-200 p-5">{children}</div>
    </details>
  );
}

function RadioGroup({ name, label, options, defaultValue }: { name: string; label: string; options: readonly string[]; defaultValue?: string }) {
  return (
    <div>
      <FieldLabel required>{label}</FieldLabel>
      <div className="mt-2 grid gap-2">
        {options.map((option, index) => (
          <label key={option} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold">
            <input className="mr-2" type="radio" name={name} value={option} required defaultChecked={option === defaultValue || (!defaultValue && index === 0)} /> {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-sm font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function StudentSubmissionDetail({ submission, onBack }: { submission: Submission; onBack: () => void }) {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <button onClick={onBack} className="mb-5 text-sm font-bold text-slate-500">
        Back to my submissions
      </button>
      <h1 className="text-3xl font-black">Submission Details</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Read-only view of what you submitted. If STUCO asks for a revision, you will be able to edit it from My Submissions.
      </p>

      <div className="mt-4">
        <Badge tone={statusTone(submission.status)}>{STATUS_LABELS[submission.status]}</Badge>
      </div>

      <div className="mt-7 space-y-5">
        <FormSection title="Section 1: Acknowledgement" description="Your confirmation for appropriate use of the form.">
          <label className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold leading-6 text-slate-600">
            <input type="checkbox" checked={submission.acknowledged} disabled readOnly className="h-4 w-4 shrink-0" />
            <span>
              I understand that this form is not for personal or individual complaints involving specific students or staff. Suggestions should be respectful, constructive, and relevant to the high school community.
            </span>
          </label>
        </FormSection>
        <FormSection title="Section 2: Submitter Information" description="This information is visible to STUCO only.">
          <ReadOnlyField label="Name" value={submission.submitterName} />
          <ReadOnlyField label="Grade Level" value={submission.gradeLevel} />
        </FormSection>
        <FormSection title="Section 3: Suggestion Type and Category" description="How you submitted the idea.">
          <ReadOnlyField label="Submission Type" value={submission.type} />
          <ReadOnlyField label="Category of Suggestion" value={submission.category} />
          <ReadOnlyField label="Impact on the School Community" value={submission.impact} />
        </FormSection>
        <FormSection title="Section 4: Suggestion Details" description="The main idea and reasoning.">
          <ReadOnlyField label="Title of Suggestion" value={submission.title} />
          <ReadOnlyField label="Description of the Suggestion" value={submission.description} multiline />
          <ReadOnlyField label="Rationale" value={submission.rationale} multiline />
        </FormSection>
        <FormSection title="Section 5: Feasibility and Additional Comments" description="Implementation notes and optional comments.">
          <ReadOnlyField label="Feasibility Considerations" value={submission.feasibility} multiline />
          <ReadOnlyField label="Additional Comments" value={submission.comments || "No additional comments provided."} multiline required={false} />
        </FormSection>
      </div>
    </section>
  );
}

function AdminSubmissionDetail({ submission, onBack }: { submission: Submission; onBack: () => void }) {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <button onClick={onBack} className="mb-5 text-sm font-bold text-slate-500">
        Back to dashboard
      </button>
      <h1 className="text-3xl font-black">Submission Details</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Read-only review view. Text boxes are shaded because STUCO admins cannot edit student submissions.
      </p>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Submitter visible to STUCO only: <strong>{submission.studentName}</strong> · {submission.studentEmail}
      </div>

      <div className="mt-7 space-y-5">
        <FormSection title="Section 1: Acknowledgement" description="Student confirmation for appropriate use of the form.">
          <label className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold leading-6 text-slate-600">
            <input type="checkbox" checked={submission.acknowledged} disabled readOnly className="h-4 w-4 shrink-0" />
            <span>
              I understand that this form is not for personal or individual complaints involving specific students or staff. Suggestions should be respectful, constructive, and relevant to the high school community.
            </span>
          </label>
        </FormSection>
        <FormSection title="Section 2: Submitter Information" description="This information is visible to STUCO only.">
          <ReadOnlyField label="Name" value={submission.submitterName} />
          <ReadOnlyField label="Grade Level" value={submission.gradeLevel} />
        </FormSection>
        <FormSection title="Section 3: Suggestion Type and Category" description="How the student submitted the idea.">
          <ReadOnlyField label="Submission Type" value={submission.type} />
          <ReadOnlyField label="Category of Suggestion" value={submission.category} />
          <ReadOnlyField label="Impact on the School Community" value={submission.impact} />
        </FormSection>
        <FormSection title="Section 4: Suggestion Details" description="The main idea and reasoning.">
          <ReadOnlyField label="Title of Suggestion" value={submission.title} />
          <ReadOnlyField label="Description of the Suggestion" value={submission.description} multiline />
          <ReadOnlyField label="Rationale" value={submission.rationale} multiline />
        </FormSection>
        <FormSection title="Section 5: Feasibility and Additional Comments" description="Implementation notes and optional student comments.">
          <ReadOnlyField label="Feasibility Considerations" value={submission.feasibility} multiline />
          <ReadOnlyField label="Additional Comments" value={submission.comments || "No additional comments provided."} multiline required={false} />
        </FormSection>
      </div>
    </section>
  );
}

function ReadOnlyField({ label, value, multiline = false, required = true }: { label: string; value: string; multiline?: boolean; required?: boolean }) {
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      {multiline ? (
        <textarea value={value} readOnly disabled rows={4} className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700 opacity-100" />
      ) : (
        <input value={value} readOnly disabled className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700 opacity-100" />
      )}
    </label>
  );
}

function PetitionComments({
  comments,
  currentUser,
  isStudent,
  onSubmit,
  onReact,
}: {
  comments: PetitionComment[];
  currentUser: User | null;
  isStudent: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReact: (commentId: number, reaction: CommentReaction) => void;
}) {
  const approvedComments = comments.filter((comment) => comment.status === "approved");
  const myPendingComments = comments.filter((comment) => comment.status === "pending" && comment.userId === currentUser?.id);

  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Student Discussion</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Comments are reviewed by STUCO before posting. Keep feedback specific, respectful, and related to the petition.</p>
        </div>
        <Badge tone="blue">Moderated</Badge>
      </div>

      {isStudent ? (
        <form onSubmit={onSubmit} className="mt-4 rounded-3xl bg-slate-50 p-4">
          <label className="text-sm font-black" htmlFor="comment">
            Add your perspective
          </label>
          <textarea id="comment" name="comment" required minLength={10} maxLength={500} rows={4} placeholder="Share a constructive thought, concern, or question about this petition." className="mt-2 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500">Public comments do not show student names. STUCO can see authors for moderation.</p>
            <button type="submit" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Submit Comment</button>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Admin accounts can moderate comments but cannot comment as students.</div>
      )}

      {myPendingComments.length > 0 && (
        <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <div className="font-black">Your pending comments</div>
          <p className="mt-1">{myPendingComments.length} comment{myPendingComments.length === 1 ? " is" : "s are"} waiting for STUCO review.</p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {approvedComments.length > 0 ? (
          approvedComments.map((comment) => <CommentCard key={comment.id} comment={comment} currentUser={currentUser} isStudent={isStudent} onReact={onReact} />)
        ) : (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No approved comments yet.</div>
        )}
      </div>
    </section>
  );
}

function CommentCard({ comment, currentUser, isStudent, onReact }: { comment: PetitionComment; currentUser: User | null; isStudent: boolean; onReact: (commentId: number, reaction: CommentReaction) => void }) {
  const likes = Object.values(comment.reactions).filter((reaction) => reaction === "like").length;
  const dislikes = Object.values(comment.reactions).filter((reaction) => reaction === "dislike").length;
  const currentReaction = currentUser ? comment.reactions[currentUser.id] : undefined;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-wide text-slate-500">Student comment</div>
        <div className="text-xs font-semibold text-slate-400">{new Date(comment.createdAt).toLocaleDateString()}</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{comment.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onReact(comment.id, "like")}
          disabled={!isStudent}
          className={classNames("rounded-xl border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50", currentReaction === "like" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white")}
        >
          Like · {likes}
        </button>
        <button
          onClick={() => onReact(comment.id, "dislike")}
          disabled={!isStudent}
          className={classNames("rounded-xl border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50", currentReaction === "dislike" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white")}
        >
          Dislike · {dislikes}
        </button>
      </div>
    </article>
  );
}

function AdminPendingSubmissions({
  submissions,
  onApprove,
  onRequestPublic,
  onSetStatus,
  onViewDetails,
}: {
  submissions: Submission[];
  onApprove: (submission: Submission) => void;
  onRequestPublic: (submission: Submission) => void;
  onSetStatus: (id: number, status: SubmissionStatus) => void;
  onViewDetails: (id: number) => void;
}) {
  const pending = submissions.filter((submission) => submission.status === "pending");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Pending Review</h2>
      <div className="mt-4 space-y-3">
        {pending.map((submission) => (
          <div key={submission.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-3">
              <div className="min-w-0">
                <div className="font-black [overflow-wrap:anywhere]">{submission.title}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  {submission.category} · {submission.type}
                </div>
              </div>
              <button
                onClick={() => onViewDetails(submission.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl font-black text-slate-500 hover:bg-white hover:text-slate-950"
                aria-label="View submission details"
              >
                ›
              </button>
            </div>
            <div className="mt-2 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">
              Submitter visible to STUCO only: <strong>{submission.studentName}</strong> · {submission.studentEmail}
            </div>
            {submission.comments && <div className="mt-2 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">Additional comments: {submission.comments}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {submission.type === "Petition Request" && (
                <button onClick={() => onApprove(submission)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
                  Approve + Publish
                </button>
              )}
              {submission.type === "Private Suggestion" && (
                <button onClick={() => onRequestPublic(submission)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">
                  Request Public Opinion
                </button>
              )}
              <button onClick={() => onSetStatus(submission.id, "revision")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">
                Request Revision
              </button>
              <button onClick={() => onSetStatus(submission.id, "closed")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">
                Close
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No submissions are pending review.</div>}
      </div>
    </div>
  );
}

function AdminPetitionActions({ petitions, currentTimeMs, onSetStatus }: { petitions: Petition[]; currentTimeMs: number; onSetStatus: (id: number, status: PetitionStatus) => void }) {
  const needsAction = petitions.filter((petition) => getPetitionStatus(petition, currentTimeMs) === "threshold");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Petitions Needing Action</h2>
      <div className="mt-4 space-y-3">
        {needsAction.map((petition) => (
          <div key={petition.id} className="rounded-2xl bg-amber-50 p-4">
            <div className="font-black">{petition.title}</div>
            <div className="mt-1 text-xs font-semibold text-amber-700">
              {petition.signatures}/{petition.threshold} signatures · Threshold reached · {getTimeRemainingText(petition, currentTimeMs)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onSetStatus(petition.id, "discussion")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
                Mark Discussion
              </button>
              <button onClick={() => onSetStatus(petition.id, "administration")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">
                Send to Administration
              </button>
            </div>
          </div>
        ))}
        {needsAction.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No petition has reached the threshold right now.</div>}
      </div>
    </div>
  );
}

function AdminUnderDiscussion({ petitions, onSetStatus, onViewDetails }: { petitions: Petition[]; onSetStatus: (id: number, status: PetitionStatus) => void; onViewDetails: (id: number) => void }) {
  const underDiscussion = petitions.filter((petition) => petition.status === "discussion");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Under STUCO Discussion</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Keep these petitions available while STUCO prepares next steps before speaking with school administration.</p>
      <div className="mt-4 space-y-3">
        {underDiscussion.map((petition) => (
          <div key={petition.id} className="rounded-2xl bg-blue-50 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-3">
              <div className="min-w-0">
                <div className="font-black [overflow-wrap:anywhere]">{petition.title}</div>
                <div className="mt-1 text-xs font-semibold text-blue-700">
                  {petition.signatures}/{petition.threshold} signatures · {petition.category}
                </div>
              </div>
              <button
                onClick={() => onViewDetails(petition.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl font-black text-slate-500 hover:bg-white hover:text-slate-950"
                aria-label="View petition details"
              >
                ›
              </button>
            </div>
            <button onClick={() => onSetStatus(petition.id, "administration")} className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
              Send to Administration
            </button>
          </div>
        ))}
        {underDiscussion.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No petitions are marked for STUCO discussion right now.</div>}
      </div>
    </div>
  );
}

function AdminSentToAdministration({ petitions, onViewDetails }: { petitions: Petition[]; onViewDetails: (id: number) => void }) {
  const sent = petitions.filter((petition) => petition.status === "administration");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Sent to Administration</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Reference these petitions when STUCO discusses next steps with school administration.</p>
      <div className="mt-4 space-y-3">
        {sent.map((petition) => (
          <div key={petition.id} className="rounded-2xl bg-blue-50 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-3">
              <div className="min-w-0">
                <div className="font-black [overflow-wrap:anywhere]">{petition.title}</div>
                <div className="mt-1 text-xs font-semibold text-blue-700">
                  {petition.signatures}/{petition.threshold} signatures · {petition.category}
                </div>
              </div>
              <button
                onClick={() => onViewDetails(petition.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl font-black text-slate-500 hover:bg-white hover:text-slate-950"
                aria-label="View petition details"
              >
                ›
              </button>
            </div>
          </div>
        ))}
        {sent.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No petitions have been sent to administration yet.</div>}
      </div>
    </div>
  );
}

function AdminCommentModeration({ comments, petitions, onSetStatus }: { comments: PetitionComment[]; petitions: Petition[]; onSetStatus: (id: number, status: CommentStatus) => void }) {
  const pendingComments = comments.filter((comment) => comment.status === "pending");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Pending Comments</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Approve only constructive, petition-related comments. Hide anything personal, hostile, identifying, or off-topic.</p>
      <div className="mt-4 space-y-3">
        {pendingComments.map((comment) => {
          const petition = petitions.find((item) => item.id === comment.petitionId);
          return (
            <div key={comment.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">{petition?.title ?? "Unknown petition"}</div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{comment.body}</p>
              <div className="mt-2 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">
                Author visible to STUCO only: <strong>{comment.studentName}</strong> · {comment.studentEmail}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => onSetStatus(comment.id, "approved")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
                  Approve Comment
                </button>
                <button onClick={() => onSetStatus(comment.id, "hidden")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">
                  Hide
                </button>
              </div>
            </div>
          );
        })}
        {pendingComments.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No comments are waiting for review.</div>}
      </div>
    </div>
  );
}
