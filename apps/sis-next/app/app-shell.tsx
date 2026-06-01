"use client";

import {
  ClipboardList,
  FileDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Repeat2,
  RotateCcw,
  ShieldUser,
  SlidersHorizontal,
  Trash2,
  UserRoundPlus,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-provider";
import { exportPayrollFiles } from "./lib/payroll-export";
import { APP_VIEWS, isAdminOnlyView, labelForView, routeForView, type AppViewName } from "./lib/shared/views";
import {
  createManagedUser,
  createStudent,
  deleteManagedUser,
  deleteOption,
  deleteTrashStudent,
  getOptions,
  getStudents,
  getTrash,
  listManagedUsers,
  moveStudentToTrash,
  restoreStudent,
  saveOption,
  savePayoutRecord,
  updateManagedUser,
  updateStudent,
  type AppInitialData,
  type PayoutRecord,
  type Student
} from "./lib/student-store";
import type { OptionRecord } from "./lib/shared/options";
import type { PayrollExportMetadata } from "./lib/payroll-export";

type OptionCollectionName = "barangays" | "schools" | "courses" | "batches";

type OptionBuckets = {
  barangays: OptionRecord[];
  schools: OptionRecord[];
  courses: OptionRecord[];
  batches: OptionRecord[];
};

type ManagedUser = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  role: string | null;
};

type StudentDraft = {
  student_id: string;
  full_name: string;
  student_number: string;
  barangay: string;
  address: string;
  school_address: string;
  phone_number: string;
  school_course: string;
  year_level: string;
  batch: string;
  certificate_of_residency: boolean;
  pagpapatunay_form: boolean;
  picture_of_the_house: boolean;
  good_moral_certificate: boolean;
  original_certificate_of_grades: boolean;
  proof_of_enrollment: boolean;
  school_id: boolean;
};

type ManagedUserDraft = {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  role: string;
};

type PayrollMetadataDraft = PayrollExportMetadata;

const navIcons: Record<AppViewName, React.ComponentType<{ size?: number }>> = {
  dashboard: LayoutDashboard,
  catalogs: SlidersHorizontal,
  register: UserRoundPlus,
  renewal: Repeat2,
  records: ClipboardList,
  users: ShieldUser,
  payrolls: FileDown,
  trash: Trash2
};

const documentFields = [
  "certificate_of_residency",
  "pagpapatunay_form",
  "picture_of_the_house",
  "good_moral_certificate",
  "original_certificate_of_grades",
  "proof_of_enrollment",
  "school_id"
] as const;

const catalogDefinitions: Array<{ collection: OptionCollectionName; label: string; singular: string }> = [
  { collection: "barangays", label: "Barangays", singular: "barangay" },
  { collection: "schools", label: "Schools", singular: "school" },
  { collection: "courses", label: "Courses", singular: "course" },
  { collection: "batches", label: "Batches", singular: "batch" }
];

function emptyStudentDraft(): StudentDraft {
  return {
    student_id: "",
    full_name: "",
    student_number: "",
    barangay: "",
    address: "",
    school_address: "",
    phone_number: "",
    school_course: "",
    year_level: "",
    batch: "",
    certificate_of_residency: false,
    pagpapatunay_form: false,
    picture_of_the_house: false,
    good_moral_certificate: false,
    original_certificate_of_grades: false,
    proof_of_enrollment: false,
    school_id: false
  };
}

function emptyManagedUserDraft(): ManagedUserDraft {
  return {
    uid: "",
    email: "",
    password: "",
    displayName: "",
    role: "encoder"
  };
}

function emptyPayrollMetadataDraft(): PayrollMetadataDraft {
  return {
    date_of_filing: "",
    school_year: "",
    sem_number: ""
  };
}

function isAdminUser(
  user:
    | {
        role?: string;
        claims?: { admin?: boolean; role?: string | null };
      }
    | null
    | undefined
) {
  return user?.claims?.admin === true || user?.claims?.role === "admin" || user?.role === "admin";
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SJ"
  );
}

function completionStatus(student: Student) {
  const completed = documentFields.filter((field) => Boolean(student[field])).length;
  return completed === documentFields.length ? "Complete" : `Incomplete (${completed}/${documentFields.length})`;
}

function parseSortableNumber(value?: string) {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function getLastName(fullName: string) {
  const [beforeComma] = fullName.split(",");
  const parts = beforeComma.trim().split(/\s+/).filter(Boolean);
  return (parts[parts.length - 1] || fullName).toLocaleLowerCase();
}

function compareBatchValues(left?: string, right?: string) {
  const leftNumber = parseSortableNumber(left);
  const rightNumber = parseSortableNumber(right);
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return (left || "").localeCompare(right || "", undefined, { numeric: true, sensitivity: "base" });
}

function comparePayrollStudents(left: Student, right: Student) {
  const yearDiff = parseSortableNumber(left.year_level) - parseSortableNumber(right.year_level);
  if (yearDiff !== 0) return yearDiff;

  const lastNameDiff = getLastName(left.full_name).localeCompare(getLastName(right.full_name), undefined, {
    numeric: true,
    sensitivity: "base"
  });
  if (lastNameDiff !== 0) return lastNameDiff;

  return left.full_name.localeCompare(right.full_name, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatDateTime(value?: string) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  });
}

function yearLevelLabel(value?: string) {
  return String(value || "").trim() || "Not set";
}

function renewalHistoryCount(student: Student) {
  return student.renewal_history?.filter((entry) => entry.status === "renewed").length || 0;
}

function downloadTextFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportStudentsCsv(students: Student[]) {
  const headers = [
    "Student ID",
    "Full Name",
    "Student Number",
    "Barangay",
    "Address",
    "School",
    "Phone",
    "Course",
    "Year Level",
    "Batch",
    "Renewed",
    "Claimed"
  ];
  const rows = students.map((student) => [
    student.student_id,
    student.full_name,
    student.student_number,
    student.barangay,
    student.address,
    student.school_address,
    student.phone_number,
    student.school_course,
    student.year_level,
    student.batch,
    student.renewed ? "Yes" : "No",
    student.claimed ? "Yes" : "No"
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadTextFile("students-export.csv", "text/csv;charset=utf-8", csv);
}

export function AppShell({
  initialData,
  initialView
}: {
  initialData: AppInitialData;
  initialView: AppViewName;
}) {
  const { user, signOutUser } = useAuth();
  const router = useRouter();
  const currentUser = user || initialData.user;
  const isAdmin = isAdminUser(currentUser);
  const signedOutMessageKey = "sis-next:signed-out-message";

  const [activeView, setActiveView] = useState<AppViewName>(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [students, setStudents] = useState<Student[]>(initialData.students);
  const [trash, setTrash] = useState<Student[]>(initialData.trash);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>(initialData.payoutRecords);
  const [options, setOptions] = useState<OptionBuckets>(initialData.options);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [catalogCollection, setCatalogCollection] = useState<OptionCollectionName>("barangays");
  const [catalogDraftName, setCatalogDraftName] = useState("");
  const [catalogEditId, setCatalogEditId] = useState<string | null>(null);
  const [studentDraft, setStudentDraft] = useState<StudentDraft>(() => emptyStudentDraft());
  const [studentEditId, setStudentEditId] = useState<string | null>(null);
  const [managedUserDraft, setManagedUserDraft] = useState<ManagedUserDraft>(() => emptyManagedUserDraft());
  const [managedUserEditId, setManagedUserEditId] = useState<string | null>(null);
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<Set<string>>(() => new Set());
  const [payrollTab, setPayrollTab] = useState<"unpayrolled" | "renewed">("unpayrolled");
  const [payrollMetadataDraft, setPayrollMetadataDraft] = useState<PayrollMetadataDraft>(() => emptyPayrollMetadataDraft());
  const [payrollHistoryStudentId, setPayrollHistoryStudentId] = useState("");
  const [payrollHistoryQuery, setPayrollHistoryQuery] = useState("");
  const [payrollHistoryMenuOpen, setPayrollHistoryMenuOpen] = useState(false);
  const [actionsStudentId, setActionsStudentId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const visibleNavItems = APP_VIEWS.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    setActiveView(initialView);
    setSidebarOpen(false);
  }, [initialView]);

  useEffect(() => {
    let cancelled = false;

    async function refreshAll() {
      const [nextStudents, nextOptions, nextTrash] = await Promise.all([
        getStudents(),
        Promise.all([
          getOptions("barangays"),
          getOptions("schools"),
          getOptions("courses"),
          getOptions("batches")
        ]),
        isAdmin ? getTrash() : Promise.resolve([])
      ]);

      if (cancelled) return;

      setStudents(nextStudents);
      setOptions({
        barangays: nextOptions[0],
        schools: nextOptions[1],
        courses: nextOptions[2],
        batches: nextOptions[3]
      });
      setTrash(nextTrash);
    }

    refreshAll().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (activeView !== "users" || !isAdmin || usersLoaded) return;

    listManagedUsers()
      .then((records) => {
        setManagedUsers(records);
        setUsersLoaded(true);
      })
      .catch((error) => {
        showNotice(error instanceof Error ? error.message : "Unable to load managed users.", "error");
      });
  }, [activeView, isAdmin, usersLoaded]);

  useEffect(() => {
    if (isAdminOnlyView(activeView) && !isAdmin) {
      router.replace(routeForView("dashboard"));
    }
  }, [activeView, isAdmin, router]);

  const batchOptions = useMemo(() => {
    const batches = new Set(options.batches.map((item) => item.name).filter(Boolean));
    for (const student of students) {
      if (student.batch) batches.add(student.batch);
    }
    return [...batches].sort(compareBatchValues);
  }, [options.batches, students]);

  const catalogRecords = useMemo(
    () =>
      options[catalogCollection]
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" })),
    [catalogCollection, options]
  );

  const filteredStudents = useMemo(() => {
    const searchValue = search.trim().toLocaleLowerCase();

    return students.filter((student) => {
      const haystack = [
        student.student_id,
        student.full_name,
        student.student_number,
        student.barangay,
        student.school_address,
        student.school_course,
        student.year_level,
        student.batch
      ]
        .join(" ")
        .toLocaleLowerCase();

      if (searchValue && !haystack.includes(searchValue)) return false;
      if (batchFilter !== "all" && student.batch !== batchFilter) return false;
      if (statusFilter === "renewed" && !student.renewed) return false;
      if (statusFilter === "unrenewed" && student.renewed) return false;
      if (statusFilter === "payrolled" && !student.payrolled) return false;
      if (statusFilter === "unpayrolled" && student.payrolled) return false;
      if (statusFilter === "complete" && completionStatus(student) !== "Complete") return false;
      if (statusFilter === "incomplete" && completionStatus(student) === "Complete") return false;
      return true;
    });
  }, [batchFilter, search, statusFilter, students]);

  const renewalRows = useMemo(
    () => students.filter((student) => student.claimed).sort((left, right) => left.full_name.localeCompare(right.full_name)),
    [students]
  );

  const selectedPayrollHistoryStudent = useMemo(
    () => students.find((student) => student.student_id === payrollHistoryStudentId) || null,
    [payrollHistoryStudentId, students]
  );
  const payrollHistorySearchResults = useMemo(() => {
    const query = payrollHistoryQuery.trim().toLocaleLowerCase();
    const sortedStudents = students
      .slice()
      .sort((left, right) => left.full_name.localeCompare(right.full_name, undefined, { sensitivity: "base" }));

    if (!query) {
      return sortedStudents.slice(0, 10);
    }

    return sortedStudents
      .filter((student) =>
        [
          student.full_name,
          student.student_id,
          student.student_number,
          student.school_address,
          student.school_course,
          student.batch
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)
      )
      .slice(0, 12);
  }, [payrollHistoryQuery, students]);
  const actionsStudent = useMemo(
    () => students.find((student) => student.student_id === actionsStudentId) || null,
    [actionsStudentId, students]
  );

  useEffect(() => {
    if (!selectedPayrollHistoryStudent) return;
    setPayrollHistoryQuery(`${selectedPayrollHistoryStudent.full_name} (${selectedPayrollHistoryStudent.student_id})`);
  }, [selectedPayrollHistoryStudent]);

  const payrollSummaryByStudent = useMemo(() => {
    const summary = new Map<string, { count: number; amount: number; latestCreatedAt: string }>();
    for (const record of payoutRecords) {
      const studentId = String(record.student_id || "").trim();
      if (!studentId) continue;

      const current = summary.get(studentId) || { count: 0, amount: 0, latestCreatedAt: "" };
      const createdAt = String(record.created_at || "");
      summary.set(studentId, {
        count: current.count + 1,
        amount: current.amount + Number(record.amount || 0),
        latestCreatedAt: createdAt > current.latestCreatedAt ? createdAt : current.latestCreatedAt
      });
    }
    return summary;
  }, [payoutRecords]);
  const payrollHistoryRows = useMemo(() => {
    if (!payrollHistoryStudentId) return [];
    return payoutRecords
      .filter((record) => record.student_id === payrollHistoryStudentId)
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
  }, [payrollHistoryStudentId, payoutRecords]);

  const payrollRows = useMemo(() => {
    const rows = payrollTab === "renewed"
      ? filteredStudents.filter((student) => student.renewed)
      : filteredStudents.filter((student) => !student.payrolled);
    return rows.slice().sort(comparePayrollStudents);
  }, [filteredStudents, payrollTab]);
  const selectedPayrollRows = useMemo(
    () => payrollRows.filter((student) => selectedPayrollIds.has(student.student_id)),
    [payrollRows, selectedPayrollIds]
  );

  useEffect(() => {
    const visibleIds = new Set(payrollRows.map((student) => student.student_id));
    setSelectedPayrollIds((current) => {
      const next = new Set([...current].filter((studentId) => visibleIds.has(studentId)));
      return next.size === current.size ? current : next;
    });
  }, [payrollRows]);

  const stats = useMemo(
    () => ({
      total: students.length,
      claimed: students.filter((student) => student.claimed).length,
      renewedPending: renewalRows.filter((student) => !student.renewed).length,
      trash: trash.length,
      payrollRecords: payoutRecords.length
    }),
    [payoutRecords.length, renewalRows, students, trash]
  );

  function showNotice(message: string, type: "success" | "error" | "info" = "success") {
    setNotice({ message, type });
  }

  function withBusy<T>(key: string, task: () => Promise<T>) {
    setBusyKey(key);
    return task().finally(() => setBusyKey((current) => (current === key ? null : current)));
  }

  function navigate(view: AppViewName) {
    if (isAdminOnlyView(view) && !isAdmin) return;
    setActiveView(view);
    setSidebarOpen(false);
    router.push(routeForView(view));
  }

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      await signOutUser();
      window.sessionStorage.setItem(signedOutMessageKey, "1");
      window.location.reload();
    } catch (error) {
      setIsSigningOut(false);
      showNotice(error instanceof Error ? error.message : "Unable to sign out right now.", "error");
    }
  }

  function patchStudentDraft(student: Partial<StudentDraft>) {
    setStudentDraft((current) => ({ ...current, ...student }));
  }

  function patchPayrollMetadataDraft(metadata: Partial<PayrollMetadataDraft>) {
    setPayrollMetadataDraft((current) => ({ ...current, ...metadata }));
  }

  function selectPayrollHistoryStudent(student: Student) {
    setPayrollHistoryStudentId(student.student_id);
    setPayrollHistoryQuery(`${student.full_name} (${student.student_id})`);
    setPayrollHistoryMenuOpen(false);
  }

  function fillStudentDraft(student: Student) {
    setStudentEditId(student.student_id);
    navigate("register");
    setStudentDraft({
      student_id: student.student_id || "",
      full_name: student.full_name || "",
      student_number: student.student_number || "",
      barangay: student.barangay || "",
      address: student.address || "",
      school_address: student.school_address || "",
      phone_number: student.phone_number || "",
      school_course: student.school_course || "",
      year_level: student.year_level || "",
      batch: student.batch || "",
      certificate_of_residency: student.certificate_of_residency === true,
      pagpapatunay_form: student.pagpapatunay_form === true,
      picture_of_the_house: student.picture_of_the_house === true,
      good_moral_certificate: student.good_moral_certificate === true,
      original_certificate_of_grades: student.original_certificate_of_grades === true,
      proof_of_enrollment: student.proof_of_enrollment === true,
      school_id: student.school_id === true
    });
  }

  function resetStudentForm() {
    setStudentEditId(null);
    setStudentDraft(emptyStudentDraft());
  }

  async function handleStudentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    try {
      const savedStudent = await withBusy("student-submit", () =>
        studentEditId ? updateStudent(studentEditId, studentDraft) : createStudent(studentDraft)
      );

      setStudents((current) => {
        const exists = current.some((item) => item.student_id === savedStudent.student_id);
        return exists
          ? current.map((item) => (item.student_id === savedStudent.student_id ? savedStudent : item))
          : [savedStudent, ...current];
      });

      resetStudentForm();
      showNotice(studentEditId ? "Student record updated." : "Student record created.");
      navigate("records");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save student.", "error");
    }
  }

  async function handleStudentFlagUpdate(student: Student, field: "claimed" | "renewed" | "payrolled") {
    try {
      const nextValue = !student[field];
      const timestampField = `${field}_at` as "claimed_at" | "renewed_at" | "payrolled_at";
      const updatedStudent = await withBusy(`student-flag-${student.student_id}-${field}`, () =>
        updateStudent(student.student_id, {
          [field]: nextValue,
          [timestampField]: nextValue ? new Date().toISOString() : ""
        })
      );

      setStudents((current) =>
        current.map((item) => (item.student_id === updatedStudent.student_id ? updatedStudent : item))
      );
      showNotice(`${student.full_name} updated.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to update record.", "error");
    }
  }

  async function handleMoveToTrash(student: Student) {
    if (!isAdmin) return;

    try {
      const removed = await withBusy(`trash-${student.student_id}`, () => moveStudentToTrash(student.student_id));
      setStudents((current) => current.filter((item) => item.student_id !== student.student_id));
      if (removed) {
        setTrash((current) => [removed, ...current.filter((item) => item.student_id !== removed.student_id)]);
      }
      showNotice(`${student.full_name} moved to trash.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to move student to trash.", "error");
    }
  }

  async function handleRestoreStudent(student: Student) {
    try {
      const restored = await withBusy(`restore-${student.student_id}`, () => restoreStudent(student.student_id));
      setTrash((current) => current.filter((item) => item.student_id !== student.student_id));
      setStudents((current) => [restored, ...current.filter((item) => item.student_id !== restored.student_id)]);
      showNotice(`${student.full_name} restored.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to restore student.", "error");
    }
  }

  async function handlePermanentDelete(student: Student) {
    try {
      await withBusy(`delete-trash-${student.student_id}`, () => deleteTrashStudent(student.student_id));
      setTrash((current) => current.filter((item) => item.student_id !== student.student_id));
      showNotice(`${student.full_name} permanently deleted from trash.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to delete trash record.", "error");
    }
  }

  async function handleManagedUserSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    try {
      if (managedUserEditId) {
        const updated = await withBusy("managed-user-update", () =>
          updateManagedUser(managedUserEditId, {
            displayName: managedUserDraft.displayName,
            password: managedUserDraft.password
          })
        );
        setManagedUsers((current) => current.map((item) => (item.uid === updated.uid ? updated : item)));
        showNotice("Managed user updated.");
      } else {
        const created = await withBusy("managed-user-create", () =>
          createManagedUser({
            email: managedUserDraft.email,
            password: managedUserDraft.password,
            displayName: managedUserDraft.displayName,
            role: managedUserDraft.role
          })
        );
        setManagedUsers((current) => [created, ...current]);
        showNotice("Managed user created.");
      }

      setManagedUserDraft(emptyManagedUserDraft());
      setManagedUserEditId(null);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save managed user.", "error");
    }
  }

  function fillManagedUserDraft(userRecord: ManagedUser) {
    setManagedUserEditId(userRecord.uid);
    setManagedUserDraft({
      uid: userRecord.uid,
      email: userRecord.email,
      password: "",
      displayName: userRecord.displayName || "",
      role: userRecord.role || "encoder"
    });
    navigate("users");
  }

  async function handleDeleteManagedUser(userRecord: ManagedUser) {
    try {
      await withBusy(`delete-user-${userRecord.uid}`, () => deleteManagedUser(userRecord.uid));
      setManagedUsers((current) => current.filter((item) => item.uid !== userRecord.uid));
      showNotice(`${userRecord.email} removed.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to delete user.", "error");
    }
  }

  function resetCatalogEditor() {
    setCatalogEditId(null);
    setCatalogDraftName("");
  }

  function beginCatalogEdit(collection: OptionCollectionName, record: OptionRecord) {
    setCatalogCollection(collection);
    setCatalogEditId(record.id);
    setCatalogDraftName(record.name);
  }

  async function handleSaveOption(collection: OptionCollectionName = catalogCollection) {
    const name = catalogDraftName.trim();
    if (!name) return;

    try {
      const saved = await withBusy(`option-${collection}-save`, () =>
        saveOption(collection, { id: catalogEditId || undefined, name })
      );
      setOptions((current) => ({
        ...current,
        [collection]: [...current[collection].filter((item) => item.id !== saved.id), saved].sort((left, right) =>
          left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
        )
      }));
      resetCatalogEditor();
      showNotice(`${saved.name} ${catalogEditId ? "updated" : "added"} in ${collection}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save option.", "error");
    }
  }

  async function handleDeleteOption(collection: OptionCollectionName, record: OptionRecord) {
    try {
      await withBusy(`option-${collection}-${record.id}`, () => deleteOption(collection, record.id));
      setOptions((current) => ({
        ...current,
        [collection]: current[collection].filter((item) => item.id !== record.id)
      }));
      if (catalogEditId === record.id && catalogCollection === collection) {
        resetCatalogEditor();
      }
      showNotice(`${record.name} removed.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to delete option.", "error");
    }
  }

  async function handleExportPayroll() {
    if (!selectedPayrollRows.length) {
      showNotice("Select at least one student for payroll.", "error");
      return;
    }

    if (
      !payrollMetadataDraft.date_of_filing.trim() ||
      !payrollMetadataDraft.school_year.trim() ||
      !payrollMetadataDraft.sem_number.trim()
    ) {
      showNotice("Enter the date of filing, school year, and semester number before creating payroll files.", "error");
      return;
    }

    try {
      const payrollId = `payroll-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const shouldMarkRenewed = payrollTab === "unpayrolled";
      const payrollType = shouldMarkRenewed ? "new_student_payroll" : "renewed_student_payroll";
      const payrollNote = shouldMarkRenewed
        ? "Created from No Payrolled Students. Student was marked renewed and payrolled."
        : "Created from Renewed Students. Student was marked payrolled.";
      const groupCount = await withBusy("export-payroll", async () => {
        const exportedGroupCount = await exportPayrollFiles(selectedPayrollRows, payrollMetadataDraft, payrollId);
        const [createdRecords, updatedStudents] = await Promise.all([
          Promise.all(
            selectedPayrollRows.map((student) =>
              savePayoutRecord({
                payroll_id: payrollId,
                student_id: student.student_id,
                student_name: student.full_name,
                student_number: student.student_number,
                school: student.school_address,
                course: student.school_course,
                year_level: student.year_level,
                batch: student.batch,
                type: payrollType,
                status: "generated",
                amount: 5000,
                payroll_group_count: exportedGroupCount,
                payroll_student_count: selectedPayrollRows.length,
                notes: `${payrollNote} Generated on ${createdAt}.`
              })
            )
          ),
          Promise.all(
            selectedPayrollRows.map((student) =>
              student.payrolled && (!shouldMarkRenewed || student.renewed)
                ? Promise.resolve(student)
                : updateStudent(student.student_id, {
                    ...(shouldMarkRenewed ? { renewed: true, renewed_at: student.renewed_at || createdAt } : {}),
                    payrolled: true,
                    payrolled_at: createdAt
                  })
            )
          )
        ]);

        setPayoutRecords((current) => [...createdRecords, ...current]);
        setStudents((current) =>
          current.map((student) => updatedStudents.find((updated) => updated.student_id === student.student_id) || student)
        );
        setSelectedPayrollIds(new Set());
        return exportedGroupCount;
      });
      showNotice(`Created payroll ${payrollId} for ${selectedPayrollRows.length} student${selectedPayrollRows.length === 1 ? "" : "s"} across ${groupCount} file group${groupCount === 1 ? "" : "s"}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to create payroll.", "error");
    }
  }

  function renderCurrentView() {
    switch (activeView) {
      case "dashboard":
        return (
          <div className="content-stack">
            <SectionHeader eyebrow="Overview" title="Student Information System" description="A flat operational workspace for scholarship records, renewals, payroll preparation, and user maintenance." />
            <div className="stat-grid">
              <StatCard label="Total Scholars" value={stats.total} note="Active student records" />
              <StatCard label="Claimed" value={stats.claimed} note="Students with released subsidy" />
              <StatCard label="Pending Renewals" value={stats.renewedPending} note="Prior claimants not yet renewed" />
              <StatCard label="Trash" value={stats.trash} note="Archived records awaiting restore or deletion" />
            </div>
            <Surface title="Recent Students" subtitle="The latest student records currently visible in the system.">
              <DataTable
                columns={[
                  { key: "id", label: "ID", render: (student) => student.student_id },
                  { key: "name", label: "Student", render: (student) => student.full_name },
                  { key: "school", label: "School", render: (student) => student.school_address || "—" },
                  { key: "course", label: "Course", render: (student) => student.school_course || "—" },
                  { key: "documents", label: "Documents", render: (student) => completionStatus(student) }
                ]}
                rows={students.slice(0, 8)}
                getRowKey={(student) => student.student_id}
              />
            </Surface>
          </div>
        );
      case "register":
        return (
          <div className="content-stack">
            <SectionHeader eyebrow="Registry" title={studentEditId ? "Edit Student" : "Register Student"} description="Create or update scholarship student records without leaving the rail layout." />
            <Surface
              title={studentEditId ? "Student Details" : "New Student"}
              subtitle="This form covers the same student fields the legacy static app used for registry and document tracking."
              actions={
                studentEditId ? (
                  <button type="button" className="secondary-button" onClick={resetStudentForm}>
                    Reset Form
                  </button>
                ) : null
              }
            >
              <form className="form-grid" onSubmit={handleStudentSubmit}>
                <Field label="Full Name">
                  <input value={studentDraft.full_name} onChange={(event) => patchStudentDraft({ full_name: event.currentTarget.value })} required />
                </Field>
                <Field label="Student Number">
                  <input value={studentDraft.student_number} onChange={(event) => patchStudentDraft({ student_number: event.currentTarget.value })} />
                </Field>
                <Field label="Barangay">
                  <select value={studentDraft.barangay} onChange={(event) => patchStudentDraft({ barangay: event.currentTarget.value })}>
                    <option value="">Select barangay</option>
                    {options.barangays.map((option) => (
                      <option key={option.id} value={option.name}>{option.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Address">
                  <input value={studentDraft.address} onChange={(event) => patchStudentDraft({ address: event.currentTarget.value })} />
                </Field>
                <Field label="School">
                  <select value={studentDraft.school_address} onChange={(event) => patchStudentDraft({ school_address: event.currentTarget.value })}>
                    <option value="">Select school</option>
                    {options.schools.map((option) => (
                      <option key={option.id} value={option.name}>{option.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Course">
                  <select value={studentDraft.school_course} onChange={(event) => patchStudentDraft({ school_course: event.currentTarget.value })}>
                    <option value="">Select course</option>
                    {options.courses.map((option) => (
                      <option key={option.id} value={option.name}>{option.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Year Level">
                  <input value={studentDraft.year_level} onChange={(event) => patchStudentDraft({ year_level: event.currentTarget.value })} />
                </Field>
                <Field label="Batch">
                  <select value={studentDraft.batch} onChange={(event) => patchStudentDraft({ batch: event.currentTarget.value })}>
                    <option value="">Select batch</option>
                    {batchOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Phone">
                  <input value={studentDraft.phone_number} onChange={(event) => patchStudentDraft({ phone_number: event.currentTarget.value })} />
                </Field>
                <DocumentChecklist draft={studentDraft} onChange={patchStudentDraft} />
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={busyKey === "student-submit"}>
                    {busyKey === "student-submit" ? "Saving..." : studentEditId ? "Update Student" : "Create Student"}
                  </button>
                  <button type="button" className="secondary-button" onClick={resetStudentForm}>
                    Clear
                  </button>
                </div>
              </form>
            </Surface>
          </div>
        );
      case "records":
        return (
          <div className="content-stack">
            <SectionHeader eyebrow="Records" title="Scholarship Listing" description="Search, filter, edit, and recycle scholarship records from one flat workspace." />
            <FilterBar
              search={search}
              status={statusFilter}
              batch={batchFilter}
              batchOptions={batchOptions}
              onSearchChange={setSearch}
              onStatusChange={setStatusFilter}
              onBatchChange={setBatchFilter}
            />
            <Surface title="Student Records" subtitle={`${filteredStudents.length} records match the current filters.`}>
              <DataTable
                columns={[
                  { key: "id", label: "ID", render: (student) => student.student_id },
                  { key: "name", label: "Student", render: (student) => student.full_name },
                  { key: "school", label: "School", render: (student) => student.school_address || "—" },
                  { key: "course", label: "Course", render: (student) => student.school_course || "—" },
                  { key: "batch", label: "Batch", render: (student) => student.batch || "—" },
                  { key: "completion", label: "Documents", render: (student) => completionStatus(student) },
                  {
                    key: "renewals",
                    label: "Renewals",
                    render: (student) => renewalHistoryCount(student)
                  },
                  {
                    key: "payrolls",
                    label: "Payrolls",
                    render: (student) => {
                      const summary = payrollSummaryByStudent.get(student.student_id);
                      return (
                        <div className="payroll-summary-cell">
                          <strong>{summary?.count || 0}</strong>
                          <span>{summary?.amount ? `PHP ${summary.amount.toLocaleString()}` : "No payroll yet"}</span>
                        </div>
                      );
                    }
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (student) => (
                      <button type="button" className="action-button" onClick={() => setActionsStudentId(student.student_id)}>
                        Actions
                      </button>
                    )
                  }
                ]}
                rows={filteredStudents}
                getRowKey={(student) => student.student_id}
              />
            </Surface>
            <Surface
              title="Payroll History Lookup"
              subtitle={
                selectedPayrollHistoryStudent
                  ? `${payrollHistoryRows.length} payroll record${payrollHistoryRows.length === 1 ? "" : "s"} for ${selectedPayrollHistoryStudent.full_name}.`
                  : "Select a student to review payroll traces written during payroll creation."
              }
            >
              <div className="inline-form payroll-history-controls">
                <div className="search-select">
                  <input
                    type="search"
                    value={payrollHistoryQuery}
                    placeholder="Search student name, ID, number, school, course, batch"
                    onFocus={() => setPayrollHistoryMenuOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setPayrollHistoryMenuOpen(false), 120);
                    }}
                    onChange={(event) => {
                      setPayrollHistoryQuery(event.currentTarget.value);
                      setPayrollHistoryStudentId("");
                      setPayrollHistoryMenuOpen(true);
                    }}
                  />
                  {payrollHistoryMenuOpen ? (
                    <div className="search-select-menu" role="listbox" aria-label="Payroll history students">
                      {payrollHistorySearchResults.length ? (
                        payrollHistorySearchResults.map((student) => (
                          <button
                            key={student.student_id}
                            type="button"
                            className="search-select-option"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectPayrollHistoryStudent(student)}
                          >
                            <strong>{student.full_name}</strong>
                            <span>
                              {student.student_id}
                              {student.batch ? ` • Batch ${student.batch}` : ""}
                              {student.school_course ? ` • ${student.school_course}` : ""}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="search-select-empty">No students matched that search.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setPayrollHistoryStudentId("");
                    setPayrollHistoryQuery("");
                    setPayrollHistoryMenuOpen(false);
                  }}
                >
                  Clear
                </button>
              </div>
              <DataTable
                columns={[
                  { key: "created", label: "Created", render: (record) => formatDateTime(record.created_at) },
                  { key: "payroll", label: "Payroll", render: (record) => record.payroll_id || record.id },
                  { key: "batch", label: "Batch", render: (record) => record.batch || "—" },
                  { key: "amount", label: "Amount", render: (record) => Number(record.amount || 0).toLocaleString() }
                ]}
                rows={payrollHistoryRows}
                getRowKey={(record) => record.id}
              />
            </Surface>
          </div>
        );
      case "renewal":
        return (
          <div className="content-stack">
            <SectionHeader eyebrow="Renewal" title="Renewal Tracking" description="Track prior claimants and mark renewal progress without leaving the table." />
            <Surface title="Renewal Queue" subtitle={`${renewalRows.length} claimed students are in renewal scope.`}>
              <DataTable
                columns={[
                  { key: "id", label: "ID", render: (student) => student.student_id },
                  { key: "name", label: "Student", render: (student) => student.full_name },
                  { key: "school", label: "School", render: (student) => student.school_address || "—" },
                  { key: "batch", label: "Batch", render: (student) => student.batch || "—" },
                  {
                    key: "renewed",
                    label: "Renewed",
                    render: (student) => <FlagPill active={Boolean(student.renewed)} label={student.renewed ? "Renewed" : "Pending"} />
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (student) => (
                      <button type="button" className="action-button" onClick={() => handleStudentFlagUpdate(student, "renewed")}>
                        {student.renewed ? "Mark Pending" : "Mark Renewed"}
                      </button>
                    )
                  }
                ]}
                rows={renewalRows}
                getRowKey={(student) => student.student_id}
              />
            </Surface>
          </div>
        );
      case "users":
        return (
          <div className="content-stack">
            <SectionHeader eyebrow="Users" title="Managed Users" description="Create, update, and remove Firebase Auth users with the same admin role model used by the legacy app." />
            <Surface title={managedUserEditId ? "Update User" : "Create User"} subtitle="Admin claims are applied in the backend when users are created.">
              <form className="form-grid" onSubmit={handleManagedUserSubmit}>
                <Field label="Email">
                  <input
                    type="email"
                    value={managedUserDraft.email}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setManagedUserDraft((current) => ({ ...current, email: value }));
                    }}
                    disabled={Boolean(managedUserEditId)}
                    required
                  />
                </Field>
                <Field label="Display Name">
                  <input
                    value={managedUserDraft.displayName}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setManagedUserDraft((current) => ({ ...current, displayName: value }));
                    }}
                  />
                </Field>
                <Field label={managedUserEditId ? "New Password" : "Password"}>
                  <input
                    type="password"
                    value={managedUserDraft.password}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setManagedUserDraft((current) => ({ ...current, password: value }));
                    }}
                    required={!managedUserEditId}
                  />
                </Field>
                <Field label="Role">
                  <select
                    value={managedUserDraft.role}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setManagedUserDraft((current) => ({ ...current, role: value }));
                    }}
                    disabled={Boolean(managedUserEditId)}
                  >
                    <option value="encoder">Encoder</option>
                    <option value="admin">Admin</option>
                  </select>
                </Field>
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={busyKey === "managed-user-create" || busyKey === "managed-user-update"}>
                    {busyKey === "managed-user-create" || busyKey === "managed-user-update"
                      ? "Saving..."
                      : managedUserEditId
                        ? "Update User"
                        : "Create User"}
                  </button>
                  {managedUserEditId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setManagedUserDraft(emptyManagedUserDraft());
                        setManagedUserEditId(null);
                      }}
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
              </form>
            </Surface>
            <Surface title="Current Users" subtitle={`${managedUsers.length} users currently loaded from Firebase Auth.`}>
              <DataTable
                columns={[
                  { key: "email", label: "Email", render: (userRecord) => userRecord.email },
                  { key: "displayName", label: "Display Name", render: (userRecord) => userRecord.displayName || "—" },
                  { key: "role", label: "Role", render: (userRecord) => userRecord.role || "—" },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (userRecord) => (
                      <div className="row-actions">
                        <button type="button" className="action-button" onClick={() => fillManagedUserDraft(userRecord)}>
                          Edit
                        </button>
                        <button type="button" className="action-button danger" onClick={() => handleDeleteManagedUser(userRecord)}>
                          Delete
                        </button>
                      </div>
                    )
                  }
                ]}
                rows={managedUsers}
                getRowKey={(userRecord) => userRecord.uid}
              />
            </Surface>
          </div>
        );
      case "catalogs":
        return (
          <div className="content-stack">
            <SectionHeader
              eyebrow="Catalogs"
              title="Reference Records"
              description="Manage barangays, schools, courses, and batches from one unified admin surface."
            />
            <div className="stat-grid">
              <StatCard label="Barangays" value={options.barangays.length} note="Resident source list" />
              <StatCard label="Schools" value={options.schools.length} note="School choices in registry" />
              <StatCard label="Courses" value={options.courses.length} note="Course choices in registry" />
              <StatCard label="Batches" value={options.batches.length} note="Batch options for scholars" />
            </div>
            <Surface
              title="Catalog Manager"
              subtitle="Switch collections, add new records, edit existing names, and remove outdated entries."
              actions={
                <div className="segmented-control" role="tablist" aria-label="Catalog collections">
                  {catalogDefinitions.map(({ collection, label }) => (
                    <button
                      key={collection}
                      type="button"
                      className={catalogCollection === collection ? "active" : ""}
                      onClick={() => {
                        setCatalogCollection(collection);
                        resetCatalogEditor();
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="catalog-manager">
                <div className="catalog-editor">
                  <label className="field full">
                    <span>{catalogEditId ? "Update record" : "Add record"}</span>
                    <input
                      value={catalogDraftName}
                      onChange={(event) => setCatalogDraftName(event.currentTarget.value)}
                      placeholder={`Enter ${
                        catalogDefinitions.find((item) => item.collection === catalogCollection)?.singular || "record"
                      } name`}
                    />
                  </label>
                  <div className="form-actions">
                    <button type="button" className="primary-button" onClick={() => handleSaveOption()} disabled={!catalogDraftName.trim()}>
                      {catalogEditId ? "Update" : "Add"}
                    </button>
                    <button type="button" className="secondary-button" onClick={resetCatalogEditor}>
                      Clear
                    </button>
                  </div>
                </div>
                <DataTable
                  columns={[
                    { key: "name", label: "Name", render: (record) => record.name },
                    {
                      key: "added",
                      label: "Added",
                      render: (record) => (record.added_at ? new Date(record.added_at).toLocaleDateString() : "—")
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (record) => (
                        <div className="row-actions">
                          <button type="button" className="action-button" onClick={() => beginCatalogEdit(catalogCollection, record)}>
                            Edit
                          </button>
                          <button type="button" className="action-button danger" onClick={() => handleDeleteOption(catalogCollection, record)}>
                            Delete
                          </button>
                        </div>
                      )
                    }
                  ]}
                  rows={catalogRecords}
                  getRowKey={(record) => record.id}
                />
              </div>
            </Surface>
          </div>
        );
      case "payrolls":
        return (
          <div className="content-stack">
            <SectionHeader eyebrow="Payrolls" title="Payrolls" description="Generate payroll files and record each payroll as its own preparation event." />
            <FilterBar
              search={search}
              status={statusFilter}
              batch={batchFilter}
              batchOptions={batchOptions}
              onSearchChange={setSearch}
              onStatusChange={setStatusFilter}
              onBatchChange={setBatchFilter}
            />
            <Surface
              title="Payroll Scope"
              subtitle={`${stats.payrollRecords} payroll records are currently loaded.`}
            >
              <div className="segmented-control payroll-tabs" role="tablist" aria-label="Payroll student scope">
                <button
                  type="button"
                  className={payrollTab === "unpayrolled" ? "active" : ""}
                  onClick={() => setPayrollTab("unpayrolled")}
                  role="tab"
                  aria-selected={payrollTab === "unpayrolled"}
                >
                  No Payrolled Students
                </button>
                <button
                  type="button"
                  className={payrollTab === "renewed" ? "active" : ""}
                  onClick={() => setPayrollTab("renewed")}
                  role="tab"
                  aria-selected={payrollTab === "renewed"}
                >
                  Renewed Students
                </button>
              </div>
            </Surface>
            <Surface
              title={payrollTab === "unpayrolled" ? "No Payrolled Students Payroll Controls" : "Renewed Students Payroll Controls"}
              subtitle={
                payrollTab === "unpayrolled"
                  ? `${selectedPayrollRows.length} students selected from ${payrollRows.length} students without payroll. Creating this payroll also marks selected students renewed.`
                  : `${selectedPayrollRows.length} renewed students selected from ${payrollRows.length} visible rows. Creating this payroll records the payroll trace.`
              }
              actions={
                <div className="button-row">
                  <button type="button" className="primary-button" onClick={handleExportPayroll} disabled={busyKey === "export-payroll"}>
                    {busyKey === "export-payroll" ? "Creating..." : "Create Payroll Files"}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => exportStudentsCsv(payrollRows)}>
                    Export Student CSV
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setSelectedPayrollIds(new Set(payrollRows.map((student) => student.student_id)))}>
                    Select All
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setSelectedPayrollIds(new Set())}>
                    Clear Selection
                  </button>
                </div>
              }
            >
              <div className="form-grid payroll-metadata-grid">
                <Field label="Date Of Filing">
                  <input
                    type="date"
                    value={payrollMetadataDraft.date_of_filing}
                    onChange={(event) => patchPayrollMetadataDraft({ date_of_filing: event.currentTarget.value })}
                  />
                </Field>
                <Field label="School Year">
                  <input
                    value={payrollMetadataDraft.school_year}
                    onChange={(event) => patchPayrollMetadataDraft({ school_year: event.currentTarget.value })}
                    placeholder="2025-2026"
                  />
                </Field>
                <Field label="Semester Number">
                  <select
                    value={payrollMetadataDraft.sem_number}
                    onChange={(event) => patchPayrollMetadataDraft({ sem_number: event.currentTarget.value })}
                  >
                    <option value="">Select semester</option>
                    <option value="1">1st Semester</option>
                    <option value="2">2nd Semester</option>
                    <option value="3">3rd Semester</option>
                    <option value="4">4th Semester</option>
                  </select>
                </Field>
              </div>
              <DataTable
                columns={[
                  {
                    key: "select",
                    label: "Select",
                    render: (student) => (
                      <input
                        type="checkbox"
                        checked={selectedPayrollIds.has(student.student_id)}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setSelectedPayrollIds((current) => {
                            const next = new Set(current);
                            if (checked) next.add(student.student_id);
                            else next.delete(student.student_id);
                            return next;
                          });
                        }}
                      />
                    )
                  },
                  { key: "name", label: "Student", render: (student) => student.full_name },
                  { key: "school", label: "School", render: (student) => student.school_address || "—" },
                  { key: "course", label: "Course", render: (student) => student.school_course || "—" },
                  { key: "year", label: "Year", render: (student) => student.year_level || "—" },
                  {
                    key: "payrolled",
                    label: "Payrolled",
                    render: (student) => <FlagPill active={Boolean(student.payrolled)} label={student.payrolled ? "Yes" : "No"} />
                  }
                ]}
                rows={payrollRows}
                getRowKey={(student) => student.student_id}
              />
            </Surface>
          </div>
        );
      case "trash":
        return (
          <div className="content-stack">
            <SectionHeader eyebrow="Trash" title="Archived Records" description="Restore student records or permanently remove them from the trash collection." />
            <Surface title="Trash Records" subtitle={`${trash.length} archived student records currently loaded.`}>
              <DataTable
                columns={[
                  { key: "id", label: "ID", render: (student) => student.student_id },
                  { key: "name", label: "Student", render: (student) => student.full_name },
                  { key: "deleted", label: "Deleted At", render: (student) => student.deleted_at || "—" },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (student) => (
                      <div className="row-actions">
                        <button type="button" className="action-button" onClick={() => handleRestoreStudent(student)}>
                          Restore
                        </button>
                        <button type="button" className="action-button danger" onClick={() => handlePermanentDelete(student)}>
                          Delete
                        </button>
                      </div>
                    )
                  }
                ]}
                rows={trash}
                getRowKey={(student) => student.student_id}
              />
            </Surface>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="workspace-shell">
      <aside className={`workspace-rail ${sidebarOpen ? "open" : ""}`}>
        <div className="rail-brand">
          <div className="rail-mark">SJ</div>
          <div>
            <p>San Jose LGU</p>
            <strong>Scholarship System</strong>
          </div>
          <button type="button" className="rail-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <div className="rail-user">
          <div className="rail-avatar">{initials(currentUser?.name || currentUser?.email || "SJ")}</div>
          <div className="rail-user-copy">
            <strong>{currentUser?.name || "Signed In User"}</strong>
            <span>{currentUser?.role || "Encoder"}</span>
            <span>{currentUser?.email}</span>
          </div>
        </div>

        <nav className="rail-nav" aria-label="Primary routes">
          {visibleNavItems.map((item) => {
            const Icon = navIcons[item.view];
            return (
              <button
                key={item.view}
                type="button"
                className={activeView === item.view ? "active" : ""}
                onClick={() => navigate(item.view)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button type="button" className="rail-signout" onClick={handleSignOut} disabled={isSigningOut}>
          <LogOut size={18} />
          <span>{isSigningOut ? "Signing Out..." : "Sign Out"}</span>
        </button>
      </aside>

      {sidebarOpen ? <button type="button" className="rail-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" /> : null}

      <main className="workspace-main">
        <header className="workspace-header">
          <button type="button" className="nav-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div>
            <p>{labelForView(activeView)}</p>
            <h1>{labelForView(activeView)}</h1>
          </div>
        </header>

        {notice ? <div className={`notice-banner ${notice.type}`}>{notice.message}</div> : null}

        <section className="workspace-content">{renderCurrentView()}</section>
      </main>

      {actionsStudent ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setActionsStudentId("")}>
          <div
            className="action-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-actions-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="action-dialog-header">
              <div>
                <p>Record Actions</p>
                <h2 id="record-actions-title">{actionsStudent.full_name}</h2>
                <span>{actionsStudent.student_id}</span>
              </div>
              <button type="button" className="icon-button" onClick={() => setActionsStudentId("")} aria-label="Close actions">
                <X size={18} />
              </button>
            </div>
            <div className="action-dialog-summary">
              <div>
                <span>Year Level</span>
                <strong>{yearLevelLabel(actionsStudent.year_level)}</strong>
              </div>
              <div>
                <span>Payrolls</span>
                <strong>{payrollSummaryByStudent.get(actionsStudent.student_id)?.count || 0}</strong>
              </div>
              <div>
                <span>Renewals</span>
                <strong>{renewalHistoryCount(actionsStudent)}</strong>
              </div>
              <div>
                <span>Total Amount</span>
                <strong>PHP {(payrollSummaryByStudent.get(actionsStudent.student_id)?.amount || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>Latest</span>
                <strong>
                  {formatDateTime(payrollSummaryByStudent.get(actionsStudent.student_id)?.latestCreatedAt)}
                </strong>
              </div>
            </div>
            <div className="dialog-history-panel">
              <div className="dialog-history-header">
                <span>Year Level History</span>
                <strong>{actionsStudent.year_level_history?.length || 0}</strong>
              </div>
              {actionsStudent.year_level_history?.length ? (
                <div className="history-list">
                  {actionsStudent.year_level_history
                    .slice()
                    .sort((left, right) => String(right.changed_at || "").localeCompare(String(left.changed_at || "")))
                    .map((entry, index) => (
                      <div key={`${entry.changed_at}-${index}`} className="history-row">
                        <div>
                          <strong>
                            {yearLevelLabel(entry.from_year_level)} to {yearLevelLabel(entry.to_year_level)}
                          </strong>
                          <span>{entry.reason || "Year level updated."}</span>
                        </div>
                        <div>
                          <span>{formatDateTime(entry.changed_at)}</span>
                          <span>{entry.changed_by_email || "Unknown user"}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-history">No year-level changes have been recorded yet.</div>
              )}
            </div>
            <div className="dialog-history-panel">
              <div className="dialog-history-header">
                <span>Renewal History</span>
                <strong>{actionsStudent.renewal_history?.length || 0}</strong>
              </div>
              {actionsStudent.renewal_history?.length ? (
                <div className="history-list">
                  {actionsStudent.renewal_history
                    .slice()
                    .sort((left, right) => String(right.changed_at || "").localeCompare(String(left.changed_at || "")))
                    .map((entry, index) => (
                      <div key={`${entry.changed_at}-${entry.status}-${index}`} className="history-row">
                        <div>
                          <strong>{entry.status === "renewed" ? "Marked renewed" : "Moved to pending"}</strong>
                          <span>{entry.reason || "Renewal state updated."}</span>
                        </div>
                        <div>
                          <span>{formatDateTime(entry.changed_at)}</span>
                          <span>{entry.changed_by_email || "Unknown user"}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-history">No renewal changes have been recorded yet.</div>
              )}
            </div>
            <div className="dialog-action-grid">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  fillStudentDraft(actionsStudent);
                  setActionsStudentId("");
                }}
              >
                Edit Student
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPayrollHistoryStudentId(actionsStudent.student_id);
                  setActionsStudentId("");
                }}
              >
                Show Payroll History
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className="secondary-button danger"
                  onClick={() => {
                    handleMoveToTrash(actionsStudent);
                    setActionsStudentId("");
                  }}
                >
                  Move To Trash
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isSigningOut ? (
        <div className="modal-backdrop" role="presentation">
          <div className="auth-progress-dialog" role="dialog" aria-modal="true" aria-labelledby="signout-progress-title">
            <div className="auth-progress-spinner" aria-hidden="true" />
            <div className="auth-progress-copy">
              <h2 id="signout-progress-title">Signing you out</h2>
              <p>Please wait while we close your session and refresh the page.</p>
            </div>
          </div>
        </div>
      ) : null}

      {busyKey === "export-payroll" ? (
        <div className="modal-backdrop" role="presentation">
          <div className="auth-progress-dialog" role="dialog" aria-modal="true" aria-labelledby="payroll-progress-title">
            <div className="auth-progress-spinner" aria-hidden="true" />
            <div className="auth-progress-copy">
              <h2 id="payroll-progress-title">Creating payroll files</h2>
              <p>Please wait while we generate the payroll documents and prepare the download.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-header-block">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      <span>{description}</span>
    </div>
  );
}

function Surface({
  title,
  subtitle,
  actions,
  children
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface">
      <div className="surface-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {actions}
      </div>
      <div className="surface-body">{children}</div>
    </section>
  );
}

function StatCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <article className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function Field({
  label,
  children,
  span = "half"
}: {
  label: string;
  children: React.ReactNode;
  span?: "half" | "full";
}) {
  return (
    <label className={`field ${span === "full" ? "full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function DocumentChecklist({
  draft,
  onChange
}: {
  draft: StudentDraft;
  onChange: (student: Partial<StudentDraft>) => void;
}) {
  return (
    <div className="document-grid">
      {documentFields.map((field) => (
        <label key={field} className="document-check">
          <input
            type="checkbox"
            checked={draft[field]}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              onChange({ [field]: checked });
            }}
          />
          <span>{field.replaceAll("_", " ")}</span>
        </label>
      ))}
    </div>
  );
}

function FilterBar({
  search,
  status,
  batch,
  batchOptions,
  onSearchChange,
  onStatusChange,
  onBatchChange
}: {
  search: string;
  status: string;
  batch: string;
  batchOptions: string[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onBatchChange: (value: string) => void;
}) {
  return (
    <div className="filter-strip">
      <input type="search" value={search} placeholder="Search name, ID, school, course, batch" onChange={(event) => onSearchChange(event.currentTarget.value)} />
      <select value={status} onChange={(event) => onStatusChange(event.currentTarget.value)}>
        <option value="all">All statuses</option>
        <option value="complete">Complete documents</option>
        <option value="incomplete">Incomplete documents</option>
        <option value="renewed">Renewed</option>
        <option value="unrenewed">Unrenewed</option>
        <option value="payrolled">Payroll prepared</option>
        <option value="unpayrolled">Payroll not prepared</option>
      </select>
      <select value={batch} onChange={(event) => onBatchChange(event.currentTarget.value)}>
        <option value="all">All batches</option>
        {batchOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function OptionSurface({
  title,
  value,
  records,
  onChange,
  onSave,
  onDelete
}: {
  title: string;
  value: string;
  records: OptionRecord[];
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: (record: OptionRecord) => void;
}) {
  return (
    <Surface title={title} subtitle={`Manage ${title.toLowerCase()} used throughout the registry.`}>
      <div className="inline-form">
        <input value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder={`Add ${title.slice(0, -1).toLowerCase()}`} />
        <button type="button" className="primary-button" onClick={onSave}>
          Add
        </button>
      </div>
      <div className="token-list">
        {records.map((record) => (
          <div key={record.id} className="token-row">
            <span>{record.name}</span>
            <button type="button" className="action-button danger" onClick={() => onDelete(record)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function DataTable<T>({
  columns,
  rows,
  getRowKey
}: {
  columns: Array<{
    key: string;
    label: string;
    render: (row: T) => React.ReactNode;
  }>;
  rows: T[];
  getRowKey: (row: T) => string;
}) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state">No records available.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FlagPill({ active, label }: { active: boolean; label: string }) {
  return <span className={`flag-pill ${active ? "active" : ""}`}>{label}</span>;
}
