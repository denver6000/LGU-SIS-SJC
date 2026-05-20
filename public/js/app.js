import {
  createManagedUser,
  deleteBarangay,
  deleteBatch,
  deleteCourse,
  deleteSchool,
  getBarangays,
  getBatches,
  getCourses,
  getSchoolCourses,
  getPayoutRecords,
  getSchools,
  getTrash,
  getStudents,
  importBatchWorkbookOptions,
  deleteTrashStudent,
  moveStudentToTrash,
  onAuthUserChanged,
  restoreStudent,
  saveBarangay,
  saveBatch,
  saveSchoolCourse,
  saveCourse,
  savePayoutRecord,
  saveSchool,
  saveStudent,
  seedLocalFromBundledJson,
  signInUser,
  signOutUser,
  storageMode,
  updateStudent
} from "./store.js?v=role-claims-functions-20260520";
import { PayrollExportService, StudentExportService } from "./export-service.js?v=excel-total-j25-20260513";

const documentFields = [
  "certificate_of_residency",
  "pagpapatunay_form",
  "picture_of_the_house",
  "good_moral_certificate",
  "original_certificate_of_grades",
  "proof_of_enrollment",
  "school_id"
];

const barangayOptions = [
  "Abar 1st",
  "Calaocan",
  "Canuto Ramos",
  "Crisanto Sanchez",
  "Ferdinand E. Marcos",
  "Malasin",
  "Rafael Rueda Sr.",
  "Raymundo Eugenio",
  "Sibut",
  "Sto. Niño 1st",
  "Abar 2nd",
  "A. Pascual",
  "Bagong Sikat",
  "Caanawan",
  "Camanacsacan",
  "Culaylay",
  "Dizol",
  "Kaliwanagan",
  "Kita-Kita",
  "Manicla",
  "Palestina",
  "Parang Mangga",
  "Pinili",
  "Porais",
  "San Agustin",
  "San Juan",
  "San Mauricio",
  "Sto. Niño 2nd",
  "Sto. Niño 3rd",
  "Sto. Tomas",
  "Sinipit Bubon",
  "Tabulac",
  "Tayabo",
  "Tondod",
  "Tulat",
  "Villa Floresta",
  "Villa Joson",
  "Villa Marina"
];

const defaultSchoolOptions = [
  "PHINMA Araullo University San Jose City",
  "Core Gateway College, Inc.",
  "San Jose Christian Colleges",
  "Golden Success University",
  "STI College San Jose",
  "Central Luzon State University"
];

const defaultCourseOptions = [
  "Accountancy",
  "BA Filipino",
  "BA Language / Literature",
  "BA Psychology",
  "BA Social Sciences",
  "BS Accountancy",
  "BS Accounting Technology",
  "BS Agribusiness",
  "BS Agricultural and Biosystems Engineering",
  "BS Agriculture",
  "BS Animal Science / Animal Husbandry",
  "BS Biology",
  "BS Business Administration",
  "BS Chemistry",
  "BS Civil Engineering",
  "BS Development Communication",
  "BS Environmental Science",
  "BS Entrepreneurship",
  "BS Fashion and Textile Technology",
  "BS Fisheries / Aquaculture",
  "BS Food Technology",
  "BS Hospitality Management",
  "BS Information Technology",
  "Bachelor of Early Childhood Education",
  "Bachelor of Elementary Education (BEEd)",
  "Bachelor of Physical Education",
  "Bachelor of Secondary Education (BSEd) - English",
  "Bachelor of Secondary Education (BSEd) - Filipino",
  "Bachelor of Secondary Education (BSEd) - MAPEH",
  "Bachelor of Secondary Education (BSEd) - Math",
  "Bachelor of Secondary Education (BSEd) - Science",
  "Bachelor of Secondary Education (BSEd) - Social Studies",
  "Bachelor of Secondary Education (BSEd) - TLE",
  "Business Administration",
  "Business Administration (Management, Accounting)",
  "Civil Engineering",
  "Computer Science",
  "Criminology",
  "Doctor of Veterinary Medicine (DVM)",
  "Education",
  "Education (Elementary & Secondary)",
  "Hospitality / Tourism",
  "Hospitality Management",
  "Information Technology",
  "Master's: Education, Public Administration",
  "Nursing",
  "Political Science",
  "Tourism Management"
];

const defaultBatchOptions = ["1", "2", "3", "4", "5", "6", "7"];

const ROLE_ADMIN = "admin";
const ROLE_USER = "user";

const state = {
  students: [],
  schoolCourses: [],
  barangays: [],
  schools: [],
  courses: [],
  batches: [],
  payoutRecords: [],
  trash: [],
  editingStudentId: null,
  selectedRenewalStudentId: null,
  selectedPayrollStudentIds: new Set(),
  currentUser: null,
  currentUserClaims: {},
  currentUserRole: null,
  pendingSignedOutAuthMessage: null,
  authUnsubscribe: null,
  authEventsBound: false,
  appEventsBound: false,
  appStarted: false,
  studentRowsClusterize: null,
  payoutRecordsByStudentId: new Map(),
  studentPayoutFlags: new Map()
};

function getUserRoleLabel(role) {
  if (role === ROLE_ADMIN) return "Admin";
  if (role === ROLE_USER) return "User";
  return "Unauthorized";
}

function userHasAppAccess() {
  return state.currentUserRole === ROLE_ADMIN || state.currentUserRole === ROLE_USER;
}

function userCanDeleteStudent() {
  return state.currentUserRole === ROLE_ADMIN;
}

function userCanManageUsers() {
  return state.currentUserRole === ROLE_ADMIN;
}

function renderRoleGatedUi() {
  qsa("[data-admin-only]").forEach((element) => {
    element.hidden = !userCanManageUsers();
  });
}

const payrollExportService = new PayrollExportService();
const studentExportService = new StudentExportService();
const viewNames = [
  "dashboard",
  "register",
  "renewal",
  "records",
  "payouts",
  "import",
  "setup",
  "exports",
  "trash"
];

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function feedbackType(type) {
  return type === "error" ? "error" : type === "info" ? "info" : "success";
}

function feedbackTitle(type) {
  if (type === "error") return "Action Needed";
  if (type === "info") return "Please Wait";
  return "Action Complete";
}

function isTransientStatus(message) {
  return String(message || "").trim().endsWith("...");
}

function showFeedbackDialog(message, type) {
  const dialog = qs("#feedbackDialog");
  if (!dialog || isTransientStatus(message)) return;

  const normalizedType = feedbackType(type);
  qs("#feedbackTitle").textContent = feedbackTitle(normalizedType);
  qs("#feedbackEyebrow").textContent = normalizedType === "error" ? "System Notice" : "System Feedback";
  qs("#feedbackMessage").textContent = message;
  dialog.dataset.type = normalizedType;

  if (dialog.open) dialog.close();
  dialog.showModal();
}

function closeFeedbackDialog() {
  const dialog = qs("#feedbackDialog");
  if (dialog?.open) dialog.close();
}

function setLoading(isLoading, message = "Loading records...") {
  const overlay = qs("#loadingOverlay");
  const messageEl = qs("#loadingMessage");
  if (!overlay) return;
  if (messageEl) messageEl.textContent = message;
  overlay.hidden = !isLoading;
  document.body.classList.toggle("is-loading", isLoading);
}

async function withLoading(message, task) {
  setLoading(true, message);
  try {
    return await task();
  } finally {
    setLoading(false);
  }
}

function setStatus(message, type = "success", options = {}) {
  const el = qs("#statusMessage");
  el.textContent = message;
  el.dataset.type = type;
  if (options.dialog !== false) showFeedbackDialog(message, type);
}

function setAuthMessage(message, type = "info") {
  const el = qs("#authMessage");
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
}

function userDisplayName(user = state.currentUser, claims = state.currentUserClaims) {
  const explicitName = user?.displayName || claims?.name || claims?.displayName || "";
  if (explicitName) return explicitName;
  const email = user?.email || "";
  const localPart = email.split("@")[0] || "User";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function userInitials(name) {
  return String(name || "SJ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "SJ";
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function setSidebarOpen(isOpen) {
  document.body.dataset.sidebar = isOpen ? "open" : "closed";
  const scrim = qs("#navScrim");
  const toggle = qs("#openSidebar");
  if (scrim) scrim.hidden = !isOpen;
  if (toggle) toggle.setAttribute("aria-expanded", String(isOpen));
}

function closeSidebar() {
  setSidebarOpen(false);
}

function openSidebar() {
  if (isMobileLayout()) setSidebarOpen(true);
}

function setAuthUi(user) {
  const isSignedIn = Boolean(user);
  qs("#authView").hidden = isSignedIn;
  qs("#appTopbar").hidden = !isSignedIn;
  qs("#appLayout").hidden = !isSignedIn;
  const roleLabel = getUserRoleLabel(state.currentUserRole);
  const displayName = userDisplayName(user);
  const email = user?.email || "";
  qs("#signedInUser").textContent = displayName && email ? `${displayName} • ${roleLabel}` : "";
  qs("#sidebarUserName").textContent = displayName || "Signed In User";
  qs("#sidebarUserRole").textContent = roleLabel;
  qs("#sidebarUserEmail").textContent = email || "No email available";
  qs("#profileAvatar").textContent = userInitials(displayName);
  document.body.dataset.auth = isSignedIn ? "signed-in" : "signed-out";
  document.body.dataset.role = state.currentUserRole || "none";
  document.body.dataset.sidebar = "closed";
  renderRoleGatedUi();
}

function setLoginBusy(isBusy) {
  const button = qs("#loginSubmit");
  const form = qs("#authForm");
  if (button) {
    button.disabled = isBusy;
    button.textContent = isBusy ? "Signing In..." : "Sign In";
  }
  if (form) form.dataset.busy = String(isBusy);
}

function currentRouteView() {
  const view = new URLSearchParams(window.location.search).get("view");
  return viewNames.includes(view) ? view : "dashboard";
}

function urlForView(view) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  return `${url.pathname}${url.search}${url.hash}`;
}

function setView(view, options = {}) {
  const nextView = viewNames.includes(view) ? view : "dashboard";
  qsa("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== nextView;
  });
  qsa("[data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === nextView);
  });
  document.body.dataset.page = nextView;
  if (nextView === "records") {
    requestAnimationFrame(() => {
      renderStudents();
      refreshStudentRowsVirtualizer(true);
    });
  }
  if (options.push !== false && urlForView(nextView) !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.pushState({ view: nextView }, "", urlForView(nextView));
  }
}

function navigateToView(view) {
  setView(view);
  if (isMobileLayout()) closeSidebar();
}

async function renderIcons() {
  try {
    const { createIcons, icons } = await import("https://cdn.jsdelivr.net/npm/lucide@0.468.0/+esm");
    createIcons({ icons });
  } catch {
    qsa("[data-lucide]").forEach((icon) => {
      icon.setAttribute("data-icon-fallback", "");
    });
  }
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function completionStatus(student) {
  const done = documentFields.filter((field) => Boolean(student[field])).length;
  return done === documentFields.length ? "Complete" : `Incomplete (${done}/${documentFields.length})`;
}

function readStudentForm(form) {
  const data = new FormData(form);
  const student = Object.fromEntries(data.entries());
  documentFields.forEach((field) => {
    student[field] = data.has(field);
  });
  student.status = completionStatus(student);
  return student;
}

function setFormMode(student = null) {
  const form = qs("#studentForm");
  state.editingStudentId = student?.student_id || null;
  qs("#studentFormTitle").textContent = student ? "Update Student Record" : "Register New Student";
  qs("#studentSubmitLabel").textContent = student ? "Update Student" : "Save Student";
  qs("#cancelEditStudent").hidden = !student;

  form.reset();
  if (!student) return;

  [
    "full_name",
    "student_number",
    "barangay",
    "address",
    "phone_number",
    "school_address",
    "school_course",
    "year_level",
    "batch"
  ].forEach((field) => {
    if (form.elements[field]) form.elements[field].value = student[field] || "";
  });
  documentFields.forEach((field) => {
    if (form.elements[field]) form.elements[field].checked = Boolean(student[field]);
  });
}

function updateSchoolCourseOptions() {
  const schools = optionNames(state.schools, state.schoolCourses.map((item) => item.school_name));
  const courses = optionNames(state.courses, state.schoolCourses.map((item) => item.course_name));
  qs("#schoolList").innerHTML = schools.map((school) => `<option value="${escapeHtml(school)}"></option>`).join("");
  qs("#courseList").innerHTML = courses.map((course) => `<option value="${escapeHtml(course)}"></option>`).join("");
}

function renderBarangayOptions() {
  const barangays = optionNames(state.barangays, barangayOptions);
  qs("#barangay").innerHTML = [
    `<option value="">Select Barangay</option>`,
    ...barangays.map((barangay) => `<option value="${escapeHtml(barangay)}">${escapeHtml(barangay)}</option>`)
  ].join("");
}

function renderBatchOptions() {
  const batches = optionNames(state.batches, defaultBatchOptions);
  const options = [
    `<option value="">All batches</option>`,
    ...batches.map((batch) => `<option value="${escapeHtml(batch)}">Batch ${escapeHtml(batch)}</option>`)
  ].join("");
  qs("#batch").innerHTML = [
    `<option value="">Select Batch</option>`,
    ...batches.map((batch) => `<option value="${escapeHtml(batch)}">${escapeHtml(batch)}</option>`)
  ].join("");
  ["#renewalBatchFilter", "#batchFilter", "#payrollBatchFilter", "#payoutBatchFilter", "#trashBatchFilter"].forEach((selector) => {
    const select = qs(selector);
    if (!select) return;
    const selected = select.value;
    select.innerHTML = options;
    select.value = batches.includes(selected) ? selected : "";
  });
}

function optionNames(records, fallback = []) {
  const names = records.map((item) => item.name).filter(Boolean);
  const source = names.length ? names : fallback;
  return [...new Set(source.filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));
}

async function ensureDefaultBarangays() {
  if (state.barangays.length) return false;
  await Promise.all(barangayOptions.map((name) => saveBarangay({ name })));
  return true;
}

async function ensureDefaultSchoolsAndCourses() {
  const writes = [];
  if (!state.schools.length) {
    writes.push(...defaultSchoolOptions.map((name) => saveSchool({ name })));
  }
  if (!state.courses.length) {
    writes.push(...defaultCourseOptions.map((name) => saveCourse({ name })));
  }
  if (!writes.length) return false;
  await Promise.all(writes);
  return true;
}

function setActionCount(view, value) {
  const badge = qs(`[data-count-for="${view}"]`);
  if (badge) badge.textContent = String(value);
}

function pendingRenewalCount() {
  return state.students.filter((student) => hasPreviousPayout(student) && !hasRenewalTracking(student)).length;
}

function updateActionCounts() {
  const optionCount = state.barangays.length + state.schools.length + state.courses.length + state.batches.length;
  setActionCount("dashboard", state.students.length);
  setActionCount("register", state.students.length);
  setActionCount("renewal", pendingRenewalCount());
  setActionCount("records", state.students.length);
  setActionCount("payouts", state.payoutRecords.length);
  setActionCount("import", state.students.length);
  setActionCount("setup", optionCount);
  setActionCount("exports", state.selectedPayrollStudentIds.size);
  setActionCount("trash", state.trash.length);
}

function renderStats() {
  qs("#totalStudents").textContent = state.students.length;
  qs("#pendingRenewals").textContent = pendingRenewalCount();
  qs("#claimedStudents").textContent = state.students.filter(hasPreviousPayout).length;
  qs("#trashCount").textContent = state.trash.length;
  updateActionCounts();
}

function studentKey(student) {
  return String(student?.student_id || "");
}

function sortStudentsByBatchAndLastName(students) {
  return [...students].sort((a, b) => {
    const batchA = parseInt(a.batch || "0", 10);
    const batchB = parseInt(b.batch || "0", 10);

    if (batchA !== batchB) {
      return batchA - batchB;
    }

    const lastNameA = (a.full_name || "").split(" ").pop().toLowerCase();
    const lastNameB = (b.full_name || "").split(" ").pop().toLowerCase();

    return lastNameA.localeCompare(lastNameB);
  });
}

function rebuildPayoutIndexes() {
  const payoutRecordsByStudentId = new Map();

  state.payoutRecords.forEach((record) => {
    const id = String(record?.student_id || "");
    if (!id) return;
    const records = payoutRecordsByStudentId.get(id) || [];
    records.push(record);
    payoutRecordsByStudentId.set(id, records);
  });

  payoutRecordsByStudentId.forEach((records, id) => {
    records.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    state.studentPayoutFlags.set(id, {
      claimed: records.some((record) => ["subsidy_claim", "payout_release"].includes(record.type)),
      renewed: records.some((record) => record.type === "renewal_tracking"),
      payrolled: records.some((record) => record.type === "payroll_prepared"),
      latest: records[0] || null
    });
  });

  state.payoutRecordsByStudentId = payoutRecordsByStudentId;
}

function payoutRecordsForStudent(student) {
  const id = studentKey(student);
  if (!id) return [];
  return state.payoutRecordsByStudentId.get(id) || [];
}

function hasPreviousPayout(student) {
  return Boolean(state.studentPayoutFlags.get(studentKey(student))?.claimed);
}

function hasRenewalTracking(student) {
  return Boolean(state.studentPayoutFlags.get(studentKey(student))?.renewed);
}

function hasPayrollPreparation(student) {
  return Boolean(state.studentPayoutFlags.get(studentKey(student))?.payrolled);
}

function latestPayoutRecord(student) {
  return state.studentPayoutFlags.get(studentKey(student))?.latest || null;
}

function buildPayoutRecord(student, overrides = {}) {
  return {
    student_id: studentKey(student),
    student_name: student.full_name || "",
    student_number: student.student_number || "",
    school: student.school_address || "",
    course: student.school_course || "",
    year_level: student.year_level || "",
    batch: student.batch || "",
    ...overrides
  };
}

function selectedPayrollStudents() {
  return state.students.filter((student) => state.selectedPayrollStudentIds.has(studentKey(student)));
}

function withDerivedPayoutState(student) {
  return {
    ...student,
    claimed: hasPreviousPayout(student),
    renewed: hasRenewalTracking(student),
    payrolled: hasPayrollPreparation(student)
  };
}

function withDerivedPayoutStates(students) {
  return students.map(withDerivedPayoutState);
}

function updatePayrollSelectionSummary() {
  const summary = qs("#payrollSelectionSummary");
  if (!summary) return;
  summary.textContent = `${state.selectedPayrollStudentIds.size} of 15 students selected.`;
  updateActionCounts();
}

function selectAllPayrollStudents() {
  const students = filteredPayrollStudents();
  if (!students.length) {
    setStatus("No students match the current payroll filters.", "error");
    return;
  }

  const remainingSlots = Math.max(0, 15 - state.selectedPayrollStudentIds.size);
  const unselectedStudents = students.filter((student) => !state.selectedPayrollStudentIds.has(studentKey(student)));

  if (!remainingSlots && unselectedStudents.length) {
    setStatus("Payroll export is limited to 15 selected students.", "error");
    return;
  }

  const studentsToAdd = unselectedStudents.slice(0, remainingSlots);
  studentsToAdd.forEach((student) => state.selectedPayrollStudentIds.add(studentKey(student)));

  renderStudents();
  renderPayrollStudents();

  if (!studentsToAdd.length) {
    setStatus("All matching payroll students are already selected.");
    return;
  }

  if (studentsToAdd.length < unselectedStudents.length) {
    setStatus(`Selected ${studentsToAdd.length} additional student(s). Payroll export is limited to 15 students.`, "info", { dialog: false });
    return;
  }

  setStatus(`Selected ${studentsToAdd.length} payroll student(s).`, "info", { dialog: false });
}

function togglePayrollSelection(input) {
  const selectedId = input.dataset.selectPayroll;
  if (!selectedId) return;

  if (input.checked && state.selectedPayrollStudentIds.size >= 15) {
    input.checked = false;
    setStatus("Payroll export is limited to 15 selected students.", "error");
    return;
  }

  if (input.checked) {
    state.selectedPayrollStudentIds.add(selectedId);
  } else {
    state.selectedPayrollStudentIds.delete(selectedId);
  }
  renderStudents();
  renderPayrollStudents();
  updatePayrollSelectionSummary();
}

function filteredStudents() {
  const search = qs("#searchStudents").value.trim().toLowerCase();
  const filter = qs("#statusFilter").value;
  const batch = qs("#batchFilter").value;
  return filterStudentRecords(search, filter, batch);
}

function filteredPayrollStudents() {
  const search = qs("#payrollSearch").value.trim().toLowerCase();
  const filter = qs("#payrollStatusFilter").value;
  const batch = qs("#payrollBatchFilter").value;
  return filterStudentRecords(search, filter, batch);
}

function filterStudentRecords(search, filter, batch = "") {
  const filtered = state.students.filter((student) => {
    const haystack = [
      student.student_id,
      student.full_name,
      student.school_course,
      student.school_address,
      student.batch
    ].join(" ").toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (batch === "none") {
      if (student.batch) return false;
    } else if (batch && student.batch !== batch) return false;
    if (filter === "renewed" && !hasRenewalTracking(student)) return false;
    if (filter === "unrenewed" && hasRenewalTracking(student)) return false;
    if (filter === "claimed" && !hasPreviousPayout(student)) return false;
    if (filter === "unclaimed" && hasPreviousPayout(student)) return false;
    if (filter === "payrolled" && !hasPayrollPreparation(student)) return false;
    if (filter === "unpayrolled" && hasPayrollPreparation(student)) return false;
    if (filter === "incomplete" && completionStatus(student) === "Complete") return false;
    return true;
  });

  return sortStudentsByBatchAndLastName(filtered);
}

function filteredRenewalStudents() {
  const search = qs("#renewalSearch").value.trim().toLowerCase();
  const batch = qs("#renewalBatchFilter").value;
  const year = qs("#renewalYearFilter").value;
  const renewalStatus = qs("#renewalStatusFilter").value;

  const filtered = state.students.filter((student) => {
    if (!hasPreviousPayout(student)) return false;

    const haystack = [
      student.student_id,
      student.full_name,
      student.school_course,
      student.school_address,
      student.batch,
      student.year_level
    ].join(" ").toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (batch === "none") {
      if (student.batch) return false;
    } else if (batch && student.batch !== batch) return false;
    if (year && student.year_level !== year) return false;
    if (renewalStatus === "pending" && hasRenewalTracking(student)) return false;
    if (renewalStatus === "renewed" && !hasRenewalTracking(student)) return false;
    return true;
  });

  return sortStudentsByBatchAndLastName(filtered);
}

function updateRenewalSelectionSummary() {
  const summary = qs("#renewalSelectionSummary");
  if (!summary) return;
  const student = state.students.find((item) => item.student_id === state.selectedRenewalStudentId);
  summary.textContent = student
    ? `Selected claimed student for renewal tracking: ${student.full_name} (${student.student_id}).`
    : "No previously claimed student selected for renewal.";
}

function renderRenewalStudents() {
  const rows = filteredRenewalStudents().map((student) => `
    <tr>
      <td>
        <input
          type="radio"
          name="renewalStudent"
          aria-label="Select ${escapeHtml(student.full_name || student.student_id)} for renewal tracking"
          data-select-renewal="${escapeHtml(student.student_id)}"
          ${state.selectedRenewalStudentId === student.student_id ? "checked" : ""}
        >
      </td>
      <td>${escapeHtml(student.student_id)}</td>
      <td>
        <strong>${escapeHtml(student.full_name)}</strong>
        <span>${escapeHtml(student.phone_number)}</span>
      </td>
      <td>${escapeHtml(student.school_address)}</td>
      <td>${escapeHtml(student.school_course)}</td>
      <td>${escapeHtml(student.year_level)}</td>
      <td>${escapeHtml(student.batch)}</td>
      <td>${escapeHtml(student.status || completionStatus(student))}</td>
      <td>${hasRenewalTracking(student) ? "Yes" : "No"}</td>
    </tr>
  `).join("");

  qs("#renewalRows").innerHTML = rows || `<tr><td colspan="9" class="empty-state">No matching previously claimed students.</td></tr>`;
  updateRenewalSelectionSummary();
}

function recordsViewIsVisible() {
  const recordsView = qs("[data-view='records']");
  return Boolean(recordsView && !recordsView.hidden);
}

function ensureStudentRowsVirtualizer(rows = []) {
  if (state.studentRowsClusterize) return state.studentRowsClusterize;
  if (!recordsViewIsVisible()) return null;
  if (typeof window.Clusterize !== "function") return null;

  state.studentRowsClusterize = new window.Clusterize({
    rows,
    scrollElem: qs("#studentRowsScroll"),
    contentElem: qs("#studentRows"),
    tag: "tr",
    rows_in_block: 40,
    blocks_in_cluster: 4,
    no_data_text: "No matching student records."
  });

  return state.studentRowsClusterize;
}

function refreshStudentRowsVirtualizer(force = false) {
  if (!state.studentRowsClusterize) return;
  requestAnimationFrame(() => state.studentRowsClusterize?.refresh(force));
}

function studentRecordRow(student) {
  return `
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label="Select ${escapeHtml(student.full_name || student.student_id)} for payroll"
          data-select-payroll="${escapeHtml(studentKey(student))}"
          ${state.selectedPayrollStudentIds.has(studentKey(student)) ? "checked" : ""}
        >
      </td>
      <td>${escapeHtml(student.student_id)}</td>
      <td>
        <strong>${escapeHtml(student.full_name)}</strong>
        <span>${escapeHtml(student.phone_number)}</span>
      </td>
      <td>${escapeHtml(student.school_address)}</td>
      <td>${escapeHtml(student.school_course)}</td>
      <td>${escapeHtml(student.year_level)}</td>
      <td>${escapeHtml(student.batch)}</td>
      <td>${escapeHtml(student.status || completionStatus(student))}</td>
      <td>${hasRenewalTracking(student) ? "Yes" : "No"}</td>
      <td>${hasPreviousPayout(student) ? "Yes" : "No"}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-view-student="${escapeHtml(student.student_id)}">View</button>
          <button type="button" data-edit="${escapeHtml(student.student_id)}">Edit</button>
          <button type="button" data-claim="${escapeHtml(student.student_id)}">Claim</button>
          ${userCanDeleteStudent() ? `<button type="button" data-delete="${escapeHtml(student.student_id)}" class="danger">Trash</button>` : ""}
        </div>
      </td>
    </tr>
  `;
}

function renderStudents() {
  const clusterize = ensureStudentRowsVirtualizer();
  if (!recordsViewIsVisible() && !clusterize) {
    updatePayrollSelectionSummary();
    return;
  }

  const rows = filteredStudents().map(studentRecordRow);

  if (clusterize) {
    clusterize.update(rows);
    refreshStudentRowsVirtualizer();
  } else {
    qs("#studentRows").innerHTML = rows.join("") || `<tr><td colspan="11" class="empty-state">No matching student records.</td></tr>`;
  }

  updatePayrollSelectionSummary();
}

function renderPayrollStudents() {
  const rows = filteredPayrollStudents().map((student) => `
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label="Select ${escapeHtml(student.full_name || student.student_id)} for payroll"
          data-select-payroll="${escapeHtml(studentKey(student))}"
          ${state.selectedPayrollStudentIds.has(studentKey(student)) ? "checked" : ""}
        >
      </td>
      <td>${escapeHtml(student.student_id)}</td>
      <td>
        <strong>${escapeHtml(student.full_name)}</strong>
        <span>${escapeHtml(completionStatus(student))}</span>
      </td>
      <td>${escapeHtml(student.school_address)}</td>
      <td>${escapeHtml(student.school_course)}</td>
      <td>${escapeHtml(student.year_level)}</td>
      <td>${escapeHtml(student.batch)}</td>
      <td>${hasPreviousPayout(student) ? "Yes" : "No"}</td>
      <td>${hasPayrollPreparation(student) ? "Yes" : "No"}</td>
    </tr>
  `).join("");

  qs("#payrollRows").innerHTML = rows || `<tr><td colspan="9" class="empty-state">No matching student records for payroll.</td></tr>`;
  updatePayrollSelectionSummary();
}

function filteredTrashStudents() {
  const search = qs("#trashSearch").value.trim().toLowerCase();
  const batch = qs("#trashBatchFilter").value;
  return state.trash.filter((student) => {
    const haystack = [
      student.student_id,
      student.full_name,
      student.phone_number,
      student.school_address,
      student.school_course,
      student.batch
    ].join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (batch === "none") {
      if (student.batch) return false;
    } else if (batch && student.batch !== batch) return false;
    return true;
  });
}

function renderTrash() {
  qs("#trashRows").innerHTML = filteredTrashStudents().map((student) => `
    <tr>
      <td>${escapeHtml(student.student_id)}</td>
      <td>
        <strong>${escapeHtml(student.full_name)}</strong>
        <span>${escapeHtml(student.phone_number)}</span>
      </td>
      <td>${escapeHtml(student.school_address)}</td>
      <td>${escapeHtml(student.school_course)}</td>
      <td>${escapeHtml(student.batch)}</td>
      <td>${escapeHtml(formatDateTime(student.deleted_at))}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-restore="${escapeHtml(student.student_id)}">Restore</button>
          ${userCanDeleteStudent() ? `<button type="button" data-delete-forever="${escapeHtml(student.student_id)}" class="danger">Delete</button>` : ""}
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="empty-state">No matching trash records.</td></tr>`;
}

function renderOptionRows() {
  qs("#barangayRows").innerHTML = state.barangays.map((item) => optionRow(item, "barangay")).join("")
    || `<tr><td colspan="3" class="empty-state">No barangay records.</td></tr>`;
  qs("#schoolRows").innerHTML = state.schools.map((item) => optionRow(item, "school")).join("")
    || `<tr><td colspan="3" class="empty-state">No school records.</td></tr>`;
  qs("#courseRows").innerHTML = state.courses.map((item) => optionRow(item, "course")).join("")
    || `<tr><td colspan="3" class="empty-state">No course records.</td></tr>`;
  qs("#batchRows").innerHTML = state.batches.map((item) => optionRow(item, "batch")).join("")
    || `<tr><td colspan="3" class="empty-state">No batch records.</td></tr>`;
}

function optionRow(item, type) {
  return `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(formatDateTime(item.added_at))}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-edit-option="${escapeHtml(type)}" data-option-id="${escapeHtml(item.id)}">Edit</button>
          <button type="button" class="danger" data-delete-option="${escapeHtml(type)}" data-option-id="${escapeHtml(item.id)}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function filteredPayoutRecords() {
  const search = qs("#payoutSearch").value.trim().toLowerCase();
  const batch = qs("#payoutBatchFilter").value;
  return state.payoutRecords.filter((record) => {
    const haystack = [
      record.student_id,
      record.student_name,
      record.student_number,
      record.school,
      record.course,
      record.year_level,
      record.batch,
      record.type,
      record.status,
      record.notes
    ].join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (batch === "none") {
      if (record.batch) return false;
    } else if (batch && record.batch !== batch) return false;
    return true;
  });
}

function renderPayoutRecords() {
  const rows = filteredPayoutRecords()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((record) => `
      <tr>
        <td>${escapeHtml(formatDateTime(record.created_at))}</td>
        <td>
          <strong>${escapeHtml(record.student_name)}</strong>
          <span>${escapeHtml(record.student_id)}</span>
        </td>
        <td>${escapeHtml(record.batch)}</td>
        <td>${escapeHtml(record.type)}</td>
        <td>${escapeHtml(record.status)}</td>
        <td>${record.amount ? escapeHtml(record.amount) : ""}</td>
        <td>${escapeHtml(record.notes)}</td>
      </tr>
    `).join("");

  qs("#payoutRows").innerHTML = rows || `<tr><td colspan="7" class="empty-state">No matching payout records.</td></tr>`;
}

function optionRecordsByType(type) {
  if (type === "barangay") return state.barangays;
  if (type === "school") return state.schools;
  if (type === "course") return state.courses;
  if (type === "batch") return state.batches;
  return [];
}

async function saveOptionByType(type, record) {
  if (type === "barangay") return saveBarangay(record);
  if (type === "school") return saveSchool(record);
  if (type === "course") return saveCourse(record);
  if (type === "batch") return saveBatch(record);
  throw new Error("Unknown option type.");
}

async function deleteOptionByType(type, id) {
  if (type === "barangay") return deleteBarangay(id);
  if (type === "school") return deleteSchool(id);
  if (type === "course") return deleteCourse(id);
  if (type === "batch") return deleteBatch(id);
  throw new Error("Unknown option type.");
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function renderStudentDetails(student) {
  const documents = documentFields.map((field) => `
    <div class="detail-row">
      <span>${escapeHtml(field.replaceAll("_", " "))}</span>
      <strong>${student[field] ? "Submitted" : "Missing"}</strong>
    </div>
  `).join("");
  const payoutHistory = payoutRecordsForStudent(student).map((record) => `
    <div class="detail-row">
      <span>${escapeHtml(record.type)} / ${escapeHtml(record.status)}</span>
      <strong>${escapeHtml(formatDateTime(record.created_at))}</strong>
    </div>
  `).join("") || `<p>No payout records for this student.</p>`;

  qs("#studentDetailsBody").innerHTML = `
    <div class="details-grid">
      <div>
        <h3>${escapeHtml(student.full_name)}</h3>
        <p>${escapeHtml(student.student_id)}${student.student_number ? ` / ${escapeHtml(student.student_number)}` : ""}</p>
        <div class="detail-row"><span>Barangay</span><strong>${escapeHtml(student.barangay)}</strong></div>
        <div class="detail-row"><span>Address</span><strong>${escapeHtml(student.address)}</strong></div>
        <div class="detail-row"><span>Phone</span><strong>${escapeHtml(student.phone_number)}</strong></div>
        <div class="detail-row"><span>School</span><strong>${escapeHtml(student.school_address)}</strong></div>
        <div class="detail-row"><span>Course</span><strong>${escapeHtml(student.school_course)}</strong></div>
        <div class="detail-row"><span>Year / Batch</span><strong>${escapeHtml(student.year_level)} / ${escapeHtml(student.batch)}</strong></div>
        <div class="detail-row"><span>Status</span><strong>${escapeHtml(student.status || completionStatus(student))}</strong></div>
        <div class="detail-row"><span>Prior payout</span><strong>${hasPreviousPayout(student) ? "Yes" : "No"}</strong></div>
        <div class="detail-row"><span>Renewal tracked</span><strong>${hasRenewalTracking(student) ? "Yes" : "No"}</strong></div>
        <div class="detail-row"><span>Payroll prepared</span><strong>${hasPayrollPreparation(student) ? "Yes" : "No"}</strong></div>
        <div class="detail-row"><span>Latest payout record</span><strong>${escapeHtml(formatDateTime(latestPayoutRecord(student)?.created_at))}</strong></div>
      </div>
      <div>
        <h3>Documents</h3>
        ${documents}
        <h3 class="details-subhead">Payout History</h3>
        ${payoutHistory}
      </div>
    </div>
  `;
  qs("#studentDetailsDialog").showModal();
}

function normalizeImportKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pickImportValue(row, names) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

async function importStudentsFromExcel(file) {
  const { read, utils } = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const workbook = read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(sheet, { defval: "" }).map((row) => {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeImportKey(key)] = value;
    });
    return normalized;
  });

  let imported = 0;
  for (const row of rows) {
    const fullName = pickImportValue(row, ["full_name", "name", "student_name"]);
    if (!fullName) continue;
    await saveStudent({
      student_id: pickImportValue(row, ["student_id", "id"]),
      student_number: pickImportValue(row, ["student_number", "student_no", "student_num"]),
      full_name: fullName,
      barangay: pickImportValue(row, ["barangay", "brgy"]),
      address: pickImportValue(row, ["address", "home_address"]),
      phone_number: pickImportValue(row, ["phone_number", "contact_number", "phone", "contact"]),
      school_address: pickImportValue(row, ["school_address", "school", "school_name"]),
      school_course: pickImportValue(row, ["school_course", "course", "course_name"]),
      year_level: pickImportValue(row, ["year_level", "year"]),
      batch: pickImportValue(row, ["batch"]),
      status: "Pending"
    });
    imported += 1;
  }

  return imported;
}

function payrollTemplateFields() {
  return {
    date_of_filing: qs("#payrollDateOfFiling").value.trim(),
    school_year: qs("#payrollSchoolYear").value.trim(),
    sem_number: qs("#payrollSemester").value.trim()
  };
}

async function exportPayrollWord() {
  const students = selectedPayrollStudents();
  const templateFields = payrollTemplateFields();
  if (!students.length) {
    setStatus("Select at least one student before exporting payroll.", "error");
    return;
  }
  if (!templateFields.date_of_filing || !templateFields.school_year || !templateFields.sem_number) {
    setStatus("Enter the date of filing, school year, and semester number before exporting payroll.", "error");
    return;
  }
  if (students.length > 15) {
    setStatus("Payroll export is limited to 15 selected students.", "error");
    return;
  }

  setStatus("Generating payroll Word and Excel files...");
  try {
    await withLoading("Generating payroll files...", async () => {
      const exportStudents = withDerivedPayoutStates(students);
      await payrollExportService.exportWord(exportStudents, "payroll.docx", templateFields);
      await payrollExportService.exportExcel(exportStudents);
      const exportedAt = new Date().toISOString();
      await Promise.all(students.map((student) => savePayoutRecord(buildPayoutRecord(student, {
        type: "payroll_prepared",
        status: "prepared",
        created_at: exportedAt,
        notes: "Included in generated payroll Word and Excel export."
      }))));
    });
    state.selectedPayrollStudentIds.clear();
    setStatus(`Generated payroll Word and Excel files and marked ${students.length} student(s) as payrolled.`);
    await refresh();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function ensureBatchWorkbookOptions() {
  if (state.barangays.length && state.schools.length && state.batches.length) return false;
  const result = await importBatchWorkbookOptions();
  if (!result.skipped) {
    setStatus(
      `Loaded workbook options: ${result.barangaysCreated} barangay(s), ${result.schoolsCreated} school(s), and ${result.batchesCreated} batch(es).`,
      "info",
      { dialog: false }
    );
  }
  return !result.skipped;
}

async function refresh() {
  setLoading(true, "Loading records...");
  const storageModeEl = qs("#storageMode");
  try {
    if (storageModeEl) storageModeEl.textContent = storageMode();
    const [
      students,
      schoolCourses,
      trash,
      payoutRecords,
      barangays,
      schools,
      courses,
      batches
    ] = await Promise.all([
      getStudents(),
      getSchoolCourses(),
      getTrash(),
      getPayoutRecords(),
      getBarangays(),
      getSchools(),
      getCourses(),
      getBatches()
    ]);
    state.students = students;
    state.schoolCourses = schoolCourses;
    state.trash = trash;
    state.payoutRecords = payoutRecords;
    state.studentPayoutFlags = new Map();
    state.barangays = barangays;
    state.schools = schools;
    state.courses = courses;
    state.batches = batches;
    rebuildPayoutIndexes();
    if (await ensureBatchWorkbookOptions()) {
      [state.barangays, state.schools, state.batches] = await Promise.all([getBarangays(), getSchools(), getBatches()]);
    }
    if (await ensureDefaultBarangays()) {
      state.barangays = await getBarangays();
    }
    if (await ensureDefaultSchoolsAndCourses()) {
      [state.schools, state.courses] = await Promise.all([getSchools(), getCourses()]);
    }
    const validStudentIds = new Set(state.students.map(studentKey));
    state.selectedPayrollStudentIds.forEach((id) => {
      if (!validStudentIds.has(id)) state.selectedPayrollStudentIds.delete(id);
    });
    if (state.selectedRenewalStudentId && !validStudentIds.has(state.selectedRenewalStudentId)) {
      state.selectedRenewalStudentId = null;
    }
    updateSchoolCourseOptions();
    renderBarangayOptions();
    renderBatchOptions();
    renderStats();
    renderRenewalStudents();
    renderStudents();
    renderPayrollStudents();
    renderOptionRows();
    renderPayoutRecords();
    renderTrash();
  } finally {
    setLoading(false);
  }
}

async function seedLocalIfEmpty() {
  if (storageMode() !== "local browser storage") return;
  const result = await seedLocalFromBundledJson();
  if (!result.skipped && result.students) {
    setStatus(`Loaded ${result.students} bundled student records into local browser storage.`, "info", { dialog: false });
  }
}

function bindEvents() {
  if (state.appEventsBound) return;
  state.appEventsBound = true;
  qsa("[data-nav]").forEach((button) => button.addEventListener("click", () => navigateToView(button.dataset.nav)));
  qs("#openSidebar").addEventListener("click", openSidebar);
  qs("#navScrim").addEventListener("click", closeSidebar);
  window.addEventListener("resize", () => {
    if (!isMobileLayout()) closeSidebar();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });
  qs("#signOut").addEventListener("click", async () => {
    closeSidebar();
    await signOutUser();
    setStatus("Signed out.", "info", { dialog: false });
  });
  window.addEventListener("popstate", () => setView(currentRouteView(), { push: false }));
  qs("#closeFeedbackDialog").addEventListener("click", closeFeedbackDialog);
  qs("#confirmFeedbackDialog").addEventListener("click", closeFeedbackDialog);
  qs("#searchStudents").addEventListener("input", renderStudents);
  qs("#statusFilter").addEventListener("change", renderStudents);
  qs("#batchFilter").addEventListener("change", renderStudents);
  qs("#payrollSearch").addEventListener("input", renderPayrollStudents);
  qs("#payrollStatusFilter").addEventListener("change", renderPayrollStudents);
  qs("#payrollBatchFilter").addEventListener("change", renderPayrollStudents);
  qs("#payoutSearch").addEventListener("input", renderPayoutRecords);
  qs("#payoutBatchFilter").addEventListener("change", renderPayoutRecords);
  qs("#trashSearch").addEventListener("input", renderTrash);
  qs("#trashBatchFilter").addEventListener("change", renderTrash);
  qs("#renewalSearch").addEventListener("input", renderRenewalStudents);
  qs("#renewalBatchFilter").addEventListener("change", renderRenewalStudents);
  qs("#renewalYearFilter").addEventListener("change", renderRenewalStudents);
  qs("#renewalStatusFilter").addEventListener("change", renderRenewalStudents);
  qs("#exportStudents").addEventListener("click", exportPayrollWord);
  qs("#selectAllPayroll").addEventListener("click", selectAllPayrollStudents);
  qs("#clearPayrollSelection").addEventListener("click", () => {
    state.selectedPayrollStudentIds.clear();
    renderStudents();
    renderPayrollStudents();
    setStatus("Payroll selection cleared.");
  });
  qs("#exportCsv").addEventListener("click", () => {
    const students = filteredStudents();
    if (!students.length) {
      setStatus("No students match the current filters.", "error");
      return;
    }
    studentExportService.exportCsv(withDerivedPayoutStates(students));
    setStatus(`Exported ${students.length} filtered student record(s) to CSV.`);
  });
  qs("#closeStudentDetails").addEventListener("click", () => qs("#studentDetailsDialog").close());
  qs("#cancelEditStudent").addEventListener("click", () => {
    setFormMode();
    setStatus("Edit cancelled.");
  });

  qs("#studentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formStudent = readStudentForm(event.currentTarget);
    await withLoading("Saving student record...", async () => {
      if (state.editingStudentId) {
        await updateStudent(state.editingStudentId, formStudent);
        setStatus("Student record updated.");
      } else {
        await saveStudent(formStudent);
        setStatus("Student record saved.");
      }
    });
    event.currentTarget.reset();
    setFormMode();
    await refresh();
    setView("records");
  });

  qs("#barangayForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await withLoading("Saving barangay...", () => saveBarangay(Object.fromEntries(new FormData(event.currentTarget).entries())));
    event.currentTarget.reset();
    setStatus("Barangay saved.");
    await refresh();
  });

  qs("#schoolForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await withLoading("Saving school...", () => saveSchool(Object.fromEntries(new FormData(event.currentTarget).entries())));
    event.currentTarget.reset();
    setStatus("School saved.");
    await refresh();
  });

  qs("#courseForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await withLoading("Saving course...", () => saveCourse(Object.fromEntries(new FormData(event.currentTarget).entries())));
    event.currentTarget.reset();
    setStatus("Course saved.");
    await refresh();
  });

  qs("#batchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await withLoading("Saving batch...", () => saveBatch(Object.fromEntries(new FormData(event.currentTarget).entries())));
    event.currentTarget.reset();
    setStatus("Batch saved.");
    await refresh();
  });

  qs("#userManagementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!userCanManageUsers()) {
      setStatus("Only admins can create managed users.", "error");
      return;
    }

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    await withLoading("Creating user account...", async () => {
      const result = await createManagedUser(payload);
      setStatus(`Created ${result.role} user: ${result.email}.`);
    });

    form.reset();
  });

  qs("#loadDefaultBarangays").addEventListener("click", async () => {
    await withLoading("Loading default barangays...", () => Promise.all(barangayOptions.map((name) => saveBarangay({ name }))));
    setStatus("Barangays from the legacy desktop registration list loaded into the editable collection.");
    await refresh();
  });

  qs("[data-view='setup']").addEventListener("click", async (event) => {
    const editType = event.target.dataset.editOption;
    const deleteType = event.target.dataset.deleteOption;
    const id = event.target.dataset.optionId;
    if (!id || (!editType && !deleteType)) return;

    const type = editType || deleteType;
    const records = optionRecordsByType(type);
    const current = records.find((item) => item.id === id);
    if (!current) return;

    if (editType) {
      const name = prompt(`Edit ${type}`, current.name);
      if (name === null) return;
      await withLoading(`Updating ${type}...`, () => saveOptionByType(type, { ...current, name }));
      setStatus(`${capitalize(type)} updated.`);
      await refresh();
      return;
    }

    if (deleteType) {
      await withLoading(`Deleting ${type}...`, () => deleteOptionByType(type, id));
      setStatus(`${capitalize(type)} deleted.`);
      await refresh();
    }
  });

  qs("#renewalRows").addEventListener("change", (event) => {
    const selectedId = event.target.dataset.selectRenewal;
    if (!selectedId) return;
    state.selectedRenewalStudentId = selectedId;
    updateRenewalSelectionSummary();
  });

  qs("#clearRenewalSelection").addEventListener("click", () => {
    state.selectedRenewalStudentId = null;
    renderRenewalStudents();
    setStatus("Renewal selection cleared.");
  });

  qs("#saveRenewal").addEventListener("click", async () => {
    if (!state.selectedRenewalStudentId) {
      setStatus("Select a student before saving renewal.", "error");
      return;
    }

    const student = state.students.find((item) => item.student_id === state.selectedRenewalStudentId);
    if (!hasPreviousPayout(student)) {
      setStatus("Renewal tracking applies only to students with a previous subsidy claim.", "error");
      return;
    }
    if (hasRenewalTracking(student)) {
      setStatus("This student already has a renewal tracking record.", "error");
      return;
    }

    await withLoading("Saving renewal tracking...", () => savePayoutRecord(buildPayoutRecord(student, {
      type: "renewal_tracking",
      status: "tracked",
      notes: "Returning beneficiary observed from payout history."
    })));
    state.selectedRenewalStudentId = null;
    setStatus("Renewal tracking saved for previous subsidy claimant.");
    await refresh();
  });

  qs("#studentRows").addEventListener("click", async (event) => {
    const viewId = event.target.dataset.viewStudent;
    const editId = event.target.dataset.edit;
    const claimId = event.target.dataset.claim;
    const deleteId = event.target.dataset.delete;

    if (viewId) {
      const student = state.students.find((item) => item.student_id === viewId);
      if (student) renderStudentDetails(student);
      return;
    }
    if (editId) {
      const student = state.students.find((item) => item.student_id === editId);
      if (student) {
        setFormMode(student);
        setView("register");
      }
      return;
    }
    if (claimId) {
      const student = state.students.find((item) => item.student_id === claimId);
      if (hasPreviousPayout(student)) {
        setStatus("This student already has a payout record. Review payout history before releasing again.", "error");
        return;
      }
      await withLoading("Recording payout release...", () => savePayoutRecord(buildPayoutRecord(student, {
        type: "subsidy_claim",
        status: "released",
        amount: 5000,
        notes: "Subsidy claim/release recorded from listing action."
      })));
    }
    if (deleteId) {
      if (!userCanDeleteStudent()) {
        setStatus("You do not have permission to delete student records.", "error");
      } else {
        await withLoading("Moving student to trash...", () => moveStudentToTrash(deleteId));
      }
    }

    if (claimId || (deleteId && userCanDeleteStudent())) {
      setStatus("Record updated.");
      await refresh();
    }
  });

  qs("#trashRows").addEventListener("click", async (event) => {
    const restoreId = event.target.dataset.restore;
    const deleteForeverId = event.target.dataset.deleteForever;

    if (restoreId) {
      await withLoading("Restoring student...", () => restoreStudent(restoreId));
      setStatus("Student restored from trash.");
      await refresh();
    }
    if (deleteForeverId) {
      if (!userCanDeleteStudent()) {
        setStatus("You do not have permission to permanently delete student records.", "error");
      } else {
        await withLoading("Deleting trash record...", () => deleteTrashStudent(deleteForeverId));
        setStatus("Student permanently deleted from trash.");
        await refresh();
      }
    }
  });

  qs("#importForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = qs("#excelFile").files[0];
    if (!file) {
      setStatus("Choose an Excel file to import.", "error");
      return;
    }

    try {
      setStatus("Importing scholarship Excel data...");
      const imported = await withLoading("Importing scholarship records...", () => importStudentsFromExcel(file));
      event.currentTarget.reset();
      setStatus(`Imported ${imported} student record(s).`);
      await refresh();
      setView("records");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  qs("#studentRows").addEventListener("change", (event) => {
    if (event.target.dataset.selectPayroll) togglePayrollSelection(event.target);
  });

  qs("#payrollRows").addEventListener("change", (event) => {
    if (event.target.dataset.selectPayroll) togglePayrollSelection(event.target);
  });
}

function bindAuthEvents() {
  if (state.authEventsBound) return;
  state.authEventsBound = true;
  qs("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (!email || !password) {
      setAuthMessage("Enter your email and password.", "error");
      return;
    }

    try {
      setLoginBusy(true);
      setAuthMessage("Checking account...");
      await signInUser(email, password);
      setAuthMessage("");
      event.currentTarget.reset();
    } catch (error) {
      setAuthMessage(error.message || "Sign in failed.", "error");
    } finally {
      setLoginBusy(false);
    }
  });
}

async function startApp() {
  if (!state.appStarted) {
    bindEvents();
    setView(currentRouteView(), { push: false });
    renderIcons();
    renderBarangayOptions();
    state.appStarted = true;
    await seedLocalIfEmpty();
  }
  await refresh();
}

async function initAuth() {
  bindAuthEvents();
  setLoading(true, "Checking sign-in...");
  setAuthMessage("Checking sign-in...");

  try {
    state.authUnsubscribe = await onAuthUserChanged(async (session) => {
      setLoading(false);

      if (!session?.user) {
        state.currentUser = null;
        state.currentUserClaims = {};
        state.currentUserRole = null;
        setAuthUi(null);
        if (state.pendingSignedOutAuthMessage) {
          setAuthMessage(state.pendingSignedOutAuthMessage.message, state.pendingSignedOutAuthMessage.type);
          state.pendingSignedOutAuthMessage = null;
        } else {
          setAuthMessage("Sign in with your Firebase account.");
        }
        return;
      }

      state.currentUser = session.user;
      state.currentUserClaims = session.claims || {};
      state.currentUserRole = session.role;

      if (!userHasAppAccess()) {
        state.pendingSignedOutAuthMessage = {
          message: "Your account is signed in but does not have an assigned app role. Ask an admin to set an 'admin' or 'user' claim.",
          type: "error"
        };
        await signOutUser();
        return;
      }

      setAuthUi(session.user);
      setAuthMessage("");
      try {
        await startApp();
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
  } catch (error) {
    setLoading(false);
    setAuthUi(null);
    setAuthMessage(error.message || "Firebase Auth could not start.", "error");
  }
}

initAuth();
