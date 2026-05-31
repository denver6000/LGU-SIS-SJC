import { COLLECTIONS, FIREBASE_CONFIG, USE_FIREBASE } from "../firebase-config.js";

const LOCAL_KEYS = {
  students: "sam.sis.students",
  trash: "sam.sis.trash",
  schoolCourses: "sam.sis.schoolCourses",
  payoutRecords: "sam.sis.payoutRecords",
  barangays: "sam.sis.barangays",
  schools: "sam.sis.schools",
  courses: "sam.sis.courses",
  batches: "sam.sis.batches"
};

const BATCH_WORKBOOK_SOURCE = "BATCH 1-7.xlsx";
const BATCH_OPTIONS_SEED_URL = "/data/batch_options.seed.json";
const FIRESTORE_BATCH_LIMIT = 450;
const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001
};

let firebaseRuntime = null;
const ROLE_ADMIN = "admin";
const ROLE_USER = "user";
const DEBUG_PREFIX = "[SamAuthDebug]";

function debugLog(label, payload) {
  try {
    if (payload === undefined) {
      console.info(`${DEBUG_PREFIX} ${label}`);
      return;
    }
    console.info(`${DEBUG_PREFIX} ${label}`, payload);
  } catch {
    console.info(`${DEBUG_PREFIX} ${label}`);
  }
}

function debugError(label, error) {
  console.error(`${DEBUG_PREFIX} ${label}`, {
    code: typeof error?.code === "string" ? error.code : "",
    message: typeof error?.message === "string" ? error.message : String(error),
    details: typeof error?.details === "string" ? error.details : "",
    customMessage: typeof error?.customData?.message === "string" ? error.customData.message : ""
  });
}

function hasFirebaseConfig() {
  return Boolean(
    USE_FIREBASE &&
    FIREBASE_CONFIG.apiKey &&
    !FIREBASE_CONFIG.apiKey.startsWith("YOUR_") &&
    FIREBASE_CONFIG.projectId &&
    !FIREBASE_CONFIG.projectId.startsWith("YOUR_")
  );
}

function shouldUseEmulators() {
  const params = new URLSearchParams(window.location.search);
  return params.get("emulators") === "1" || ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

async function getFirebaseRuntime() {
  if (!hasFirebaseConfig()) return null;
  if (firebaseRuntime) return firebaseRuntime;

  const appModule = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js");
  const firestore = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
  const authModule = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
  const functionsModule = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-functions.js");
  const app = appModule.initializeApp(FIREBASE_CONFIG);
  const db = firestore.getFirestore(app);
  const auth = authModule.getAuth(app);
  const functions = functionsModule.getFunctions(app, "asia-southeast1");
  if (shouldUseEmulators()) {
    firestore.connectFirestoreEmulator(db, "127.0.0.1", EMULATOR_PORTS.firestore);
    authModule.connectAuthEmulator(auth, `http://127.0.0.1:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    functionsModule.connectFunctionsEmulator(functions, "127.0.0.1", EMULATOR_PORTS.functions);
  }
  firebaseRuntime = { db, firestore, auth, authModule, functions, functionsModule };
  debugLog("firebase-runtime-ready", {
    projectId: FIREBASE_CONFIG.projectId,
    authDomain: FIREBASE_CONFIG.authDomain,
    functionsRegion: "asia-southeast1"
  });
  return firebaseRuntime;
}

function normalizeRoleFromClaims(claims = {}) {
  if (claims.role === ROLE_ADMIN || claims.admin === true) return ROLE_ADMIN;
  if (claims.role === ROLE_USER || claims.user === true) return ROLE_USER;
  return null;
}

function normalizeBackendError(error, sourceLabel = "Firebase") {
  const details = typeof error?.details === "string" ? error.details.trim() : "";
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  const code = typeof error?.code === "string" ? error.code.trim() : "";
  const customMessage = typeof error?.customData?.message === "string"
    ? error.customData.message.trim()
    : "";

  const preferredMessage = details || customMessage || message;
  if (preferredMessage && preferredMessage.toLowerCase() !== "internal") {
    return new Error(preferredMessage);
  }

  if (code.includes("permission-denied")) {
    return new Error("You do not have permission to perform this action.");
  }
  if (code.includes("unauthenticated")) {
    return new Error("You must sign in again before performing this action.");
  }
  if (code.includes("not-found")) {
    if (sourceLabel === "Firebase Functions") {
      return new Error("The requested Firebase function is not available. Deploy the latest functions and try again.");
    }
    return new Error("The requested Firestore record could not be found.");
  }
  if (code.includes("unavailable")) {
    return new Error(`${sourceLabel} is currently unavailable. Check your network connection or try again shortly.`);
  }
  if (code.includes("failed-precondition")) {
    return new Error("This action could not be completed because the required Firebase state is not ready.");
  }
  if (code.includes("already-exists")) {
    return new Error("That record already exists.");
  }
  if (code.includes("resource-exhausted")) {
    return new Error(`${sourceLabel} is currently rate limited. Try again shortly.`);
  }

  if (sourceLabel === "Firebase Functions") {
    return new Error("Firebase Functions returned an internal error. If you recently changed functions, deploy them and try again.");
  }

  return new Error(`${sourceLabel} returned an unexpected error. Please try again.`);
}

async function callFunction(name, data) {
  const runtime = await getFirebaseRuntime();
  if (!runtime) {
    throw new Error("Firebase Functions requires a valid Firebase configuration.");
  }

  try {
    const currentUser = runtime.auth.currentUser;
    let tokenPreview = null;
    let tokenError = null;
    if (currentUser) {
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        tokenPreview = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          issuedAtTime: tokenResult.issuedAtTime || "",
          expirationTime: tokenResult.expirationTime || "",
          claimsRole: tokenResult.claims?.role || null,
          admin: tokenResult.claims?.admin === true,
          user: tokenResult.claims?.user === true
        };
      } catch (error) {
        tokenError = {
          message: typeof error?.message === "string" ? error.message : String(error)
        };
      }
    }
    debugLog(`callable-start:${name}`, {
      hasCurrentUser: Boolean(currentUser),
      uid: currentUser?.uid || "",
      email: currentUser?.email || "",
      tokenPreview,
      tokenError,
      payloadKeys: data && typeof data === "object" ? Object.keys(data) : []
    });

    const callable = runtime.functionsModule.httpsCallable(runtime.functions, name);
    const result = await callable(data);
    debugLog(`callable-success:${name}`, {
      resultKeys: result?.data && typeof result.data === "object" ? Object.keys(result.data) : []
    });
    return result.data;
  } catch (error) {
    debugError(`callable-failure:${name}`, error);
    throw normalizeBackendError(error, "Firebase Functions");
  }
}

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeId(value) {
  return String(value || "").trim();
}

function nextStudentId(students) {
  const max = students.reduce((current, student) => {
    const numeric = Number.parseInt(String(student.student_id || "").replace(/^STU/i, ""), 10);
    return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
  }, 0);
  return `STU${String(max + 1).padStart(3, "0")}`;
}

async function getCollection(collectionName, localKey) {
  const runtime = await getFirebaseRuntime();
  if (!runtime) return readLocal(localKey);

  const { collection, getDocs } = runtime.firestore;
  try {
    const snapshot = await getDocs(collection(runtime.db, collectionName));
    return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), _docId: docSnap.id }));
  } catch (error) {
    throw normalizeBackendError(error, "Firestore");
  }
}

async function setDocument(collectionName, id, data) {
  const runtime = await getFirebaseRuntime();
  if (!runtime) return false;

  const { doc, setDoc } = runtime.firestore;
  try {
    await setDoc(doc(runtime.db, collectionName, id), data);
    return true;
  } catch (error) {
    throw normalizeBackendError(error, "Firestore");
  }
}

async function setDocuments(collectionName, records, getId) {
  const runtime = await getFirebaseRuntime();
  if (!runtime) return false;

  const { doc, writeBatch } = runtime.firestore;
  try {
    for (let index = 0; index < records.length; index += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(runtime.db);
      records.slice(index, index + FIRESTORE_BATCH_LIMIT).forEach((record) => {
        batch.set(doc(runtime.db, collectionName, getId(record)), record);
      });
      await batch.commit();
    }
    return true;
  } catch (error) {
    throw normalizeBackendError(error, "Firestore");
  }
}

async function deleteDocument(collectionName, id) {
  const runtime = await getFirebaseRuntime();
  if (!runtime) return false;

  const { deleteDoc, doc } = runtime.firestore;
  try {
    await deleteDoc(doc(runtime.db, collectionName, id));
    return true;
  } catch (error) {
    throw normalizeBackendError(error, "Firestore");
  }
}

export function storageMode() {
  return hasFirebaseConfig() ? "Firestore" : "local browser storage";
}

export async function onAuthUserChanged(callback) {
  const runtime = await getFirebaseRuntime();
  if (!runtime) {
    debugLog("auth-listener-local-mode");
    callback(null);
    return () => {};
  }
  return runtime.authModule.onAuthStateChanged(runtime.auth, async (user) => {
    if (!user) {
      debugLog("auth-state-changed", { signedIn: false });
      callback(null);
      return;
    }

    try {
      const tokenResult = await user.getIdTokenResult(true);
      debugLog("auth-state-changed", {
        signedIn: true,
        uid: user.uid,
        email: user.email || "",
        role: normalizeRoleFromClaims(tokenResult.claims || {}),
        claimsRole: tokenResult.claims?.role || null,
        admin: tokenResult.claims?.admin === true,
        user: tokenResult.claims?.user === true,
        issuedAtTime: tokenResult.issuedAtTime || "",
        expirationTime: tokenResult.expirationTime || ""
      });
      callback({
        user,
        claims: tokenResult.claims || {},
        role: normalizeRoleFromClaims(tokenResult.claims || {})
      });
    } catch (error) {
      debugError("auth-state-token-failure", error);
      throw normalizeBackendError(error, "Firebase Auth");
    }
  });
}

export async function signInUser(email, password) {
  const runtime = await getFirebaseRuntime();
  if (!runtime) {
    throw new Error("Firebase Auth requires a valid Firebase configuration.");
  }
  try {
    debugLog("sign-in-start", { email });
    const credentials = await runtime.authModule.signInWithEmailAndPassword(runtime.auth, email, password);
    const tokenResult = await credentials.user.getIdTokenResult(true);
    debugLog("sign-in-success", {
      uid: credentials.user.uid,
      email: credentials.user.email || "",
      role: normalizeRoleFromClaims(tokenResult.claims || {}),
      claimsRole: tokenResult.claims?.role || null,
      admin: tokenResult.claims?.admin === true,
      user: tokenResult.claims?.user === true
    });
    return credentials;
  } catch (error) {
    debugError("sign-in-failure", error);
    throw normalizeBackendError(error, "Firebase Auth");
  }
}

export async function signOutUser() {
  const runtime = await getFirebaseRuntime();
  if (!runtime) return;
  try {
    debugLog("sign-out-start", {
      uid: runtime.auth.currentUser?.uid || "",
      email: runtime.auth.currentUser?.email || ""
    });
    await runtime.authModule.signOut(runtime.auth);
    debugLog("sign-out-success");
  } catch (error) {
    debugError("sign-out-failure", error);
    throw normalizeBackendError(error, "Firebase Auth");
  }
}

export async function createManagedUser(input) {
  return callFunction("createManagedUser", input);
}

export async function listManagedUsers() {
  const runtime = await getFirebaseRuntime();
  if (!runtime) return [];
  const result = await callFunction("listManagedUsers");
  return Array.isArray(result?.users) ? result.users : [];
}

export async function deleteManagedUser(uid) {
  return callFunction("deleteManagedUser", { uid });
}

export async function updateManagedUser(input) {
  return callFunction("updateManagedUser", input);
}

export async function getStudents() {
  return getCollection(COLLECTIONS.students, LOCAL_KEYS.students);
}

export async function getPayoutRecords() {
  return getCollection(COLLECTIONS.payoutRecords, LOCAL_KEYS.payoutRecords);
}

export async function savePayoutRecord(input) {
  const payoutRecords = await getPayoutRecords();
  const record = {
    id: input.id || crypto.randomUUID(),
    student_id: normalizeId(input.student_id),
    student_name: normalizeId(input.student_name),
    student_number: normalizeId(input.student_number),
    school: normalizeId(input.school),
    course: normalizeId(input.course),
    year_level: normalizeId(input.year_level),
    batch: normalizeId(input.batch),
    type: normalizeId(input.type) || "subsidy_claim",
    status: normalizeId(input.status) || "recorded",
    amount: Number(input.amount || 0),
    notes: normalizeId(input.notes),
    migration_source: normalizeId(input.migration_source),
    migration_source_sheet: normalizeId(input.migration_source_sheet),
    migration_source_key: normalizeId(input.migration_source_key),
    created_at: input.created_at || new Date().toISOString()
  };

  const wroteRemote = await setDocument(COLLECTIONS.payoutRecords, record.id, record);
  if (!wroteRemote) writeLocal(LOCAL_KEYS.payoutRecords, [...payoutRecords, record]);
  return record;
}

export async function backfillPayoutRecordsFromLegacyStudents() {
  const [students, payoutRecords] = await Promise.all([getStudents(), getPayoutRecords()]);
  const existingKeys = new Set(payoutRecords.map((record) => `${record.student_id}:${record.type}`));
  let created = 0;

  for (const student of students) {
    const studentId = normalizeId(student.student_id);
    if (!studentId) continue;

    if (student.claimed && !existingKeys.has(`${studentId}:subsidy_claim`)) {
      await savePayoutRecord({
        student_id: studentId,
        student_name: normalizeId(student.full_name),
        student_number: normalizeId(student.student_number),
        school: normalizeId(student.school_address),
        course: normalizeId(student.school_course),
        year_level: normalizeId(student.year_level),
        batch: normalizeId(student.batch),
        type: "subsidy_claim",
        status: "released",
        amount: 5000,
        notes: "Backfilled from legacy student claimed flag.",
        created_at: student.claimed_at || new Date().toISOString()
      });
      created += 1;
    }

    if (student.payrolled && !existingKeys.has(`${studentId}:payroll_prepared`)) {
      await savePayoutRecord({
        student_id: studentId,
        student_name: normalizeId(student.full_name),
        student_number: normalizeId(student.student_number),
        school: normalizeId(student.school_address),
        course: normalizeId(student.school_course),
        year_level: normalizeId(student.year_level),
        batch: normalizeId(student.batch),
        type: "payroll_prepared",
        status: "prepared",
        notes: "Backfilled from legacy student payrolled flag.",
        created_at: student.payrolled_at || new Date().toISOString()
      });
      created += 1;
    }

    if (student.renewed && !existingKeys.has(`${studentId}:renewal_tracking`)) {
      await savePayoutRecord({
        student_id: studentId,
        student_name: normalizeId(student.full_name),
        student_number: normalizeId(student.student_number),
        school: normalizeId(student.school_address),
        course: normalizeId(student.school_course),
        year_level: normalizeId(student.year_level),
        batch: normalizeId(student.batch),
        type: "renewal_tracking",
        status: "tracked",
        notes: "Backfilled from legacy student renewed flag.",
        created_at: student.renewed_at || new Date().toISOString()
      });
      created += 1;
    }
  }

  return { created };
}

export async function saveStudent(input) {
  const students = await getStudents();
  const student = {
    student_id: normalizeId(input.student_id) || nextStudentId(students),
    full_name: normalizeId(input.full_name),
    student_number: normalizeId(input.student_number),
    barangay: normalizeId(input.barangay),
    address: normalizeId(input.address),
    school_address: normalizeId(input.school_address),
    phone_number: normalizeId(input.phone_number),
    school_course: normalizeId(input.school_course),
    year_level: normalizeId(input.year_level),
    batch: normalizeId(input.batch),
    status: normalizeId(input.status) || "Pending",
    academic_status: normalizeId(input.academic_status),
    certificate_of_residency: Boolean(input.certificate_of_residency),
    pagpapatunay_form: Boolean(input.pagpapatunay_form),
    picture_of_the_house: Boolean(input.picture_of_the_house),
    good_moral_certificate: Boolean(input.good_moral_certificate),
    original_certificate_of_grades: Boolean(input.original_certificate_of_grades),
    proof_of_enrollment: Boolean(input.proof_of_enrollment),
    school_id: Boolean(input.school_id),
    migration_source: normalizeId(input.migration_source),
    migration_source_sheet: normalizeId(input.migration_source_sheet),
    migration_source_row: input.migration_source_row || "",
    migration_source_no: normalizeId(input.migration_source_no),
    migration_source_key: normalizeId(input.migration_source_key),
    migration_group: normalizeId(input.migration_group),
    created_at: input.created_at || new Date().toISOString()
  };

  const runtime = await getFirebaseRuntime();
  if (runtime) {
    const result = await callFunction("saveStudentByAdmin", { student });
    return result.student;
  }

  const wroteRemote = await setDocument(COLLECTIONS.students, student.student_id, student);
  if (!wroteRemote) {
    const existingIndex = students.findIndex((item) => item.student_id === student.student_id);
    const nextStudents = existingIndex >= 0
      ? students.map((item) => item.student_id === student.student_id ? student : item)
      : [...students, student];
    writeLocal(LOCAL_KEYS.students, nextStudents);
  }
  return student;
}

export async function updateStudent(studentId, patch) {
  const students = await getStudents();
  const nextStudents = students.map((student) =>
    student.student_id === studentId ? { ...student, ...patch } : student
  );
  const updated = nextStudents.find((student) => student.student_id === studentId);
  if (!updated) return null;

  const runtime = await getFirebaseRuntime();
  if (runtime) {
    const result = await callFunction("updateStudentByAdmin", { studentId, student: patch });
    return result.student;
  }

  const wroteRemote = await setDocument(COLLECTIONS.students, studentId, updated);
  if (!wroteRemote) writeLocal(LOCAL_KEYS.students, nextStudents);
  return updated;
}

export async function moveStudentToTrash(studentId) {
  const students = await getStudents();
  const trash = await getTrash();
  const student = students.find((item) => item.student_id === studentId);
  if (!student) return null;

  const trashed = { ...student, deleted_at: new Date().toISOString() };
  const remaining = students.filter((item) => item.student_id !== studentId);
  const runtime = await getFirebaseRuntime();
  if (runtime) {
    await callFunction("moveStudentToTrashByAdmin", { studentId });
    return trashed;
  }

  const removedRemote = await deleteDocument(COLLECTIONS.students, studentId);
  const wroteTrashRemote = await setDocument(COLLECTIONS.trash, studentId, trashed);

  if (!removedRemote || !wroteTrashRemote) {
    writeLocal(LOCAL_KEYS.students, remaining);
    writeLocal(LOCAL_KEYS.trash, [...trash, trashed]);
  }

  return trashed;
}

export async function getTrash() {
  return getCollection(COLLECTIONS.trash, LOCAL_KEYS.trash);
}

export async function restoreStudent(studentId) {
  const students = await getStudents();
  const trash = await getTrash();
  const student = trash.find((item) => item.student_id === studentId);
  if (!student) return null;

  const restored = { ...student };
  delete restored.deleted_at;
  const nextTrash = trash.filter((item) => item.student_id !== studentId);

  const runtime = await getFirebaseRuntime();
  if (runtime) {
    await callFunction("restoreStudentByAdmin", { studentId });
    return restored;
  }

  const wroteStudentRemote = await setDocument(COLLECTIONS.students, studentId, restored);
  const removedTrashRemote = await deleteDocument(COLLECTIONS.trash, studentId);

  if (!wroteStudentRemote || !removedTrashRemote) {
    const nextStudents = students.some((item) => item.student_id === studentId)
      ? students.map((item) => item.student_id === studentId ? restored : item)
      : [...students, restored];
    writeLocal(LOCAL_KEYS.students, nextStudents);
    writeLocal(LOCAL_KEYS.trash, nextTrash);
  }

  return restored;
}

export async function deleteTrashStudent(studentId) {
  const trash = await getTrash();
  const runtime = await getFirebaseRuntime();
  if (runtime) {
    await callFunction("deleteTrashStudentByAdmin", { studentId });
    return true;
  }
  const removedRemote = await deleteDocument(COLLECTIONS.trash, studentId);
  if (!removedRemote) writeLocal(LOCAL_KEYS.trash, trash.filter((item) => item.student_id !== studentId));
  return true;
}

async function getOptionCollection(collectionName, localKey) {
  const records = await getCollection(collectionName, localKey);
  return records
    .map((item) => ({
      id: item.id || item._docId || crypto.randomUUID(),
      name: normalizeId(item.name),
      added_at: item.added_at || ""
    }))
    .filter((item) => item.name)
    .sort((a, b) => itemSort(a.name, b.name));
}

function itemSort(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
}

async function saveOption(collectionName, localKey, input) {
  const records = await getOptionCollection(collectionName, localKey);
  const name = normalizeId(input.name);
  const existingByName = records.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const record = {
    id: input.id || existingByName?.id || crypto.randomUUID(),
    name,
    added_at: input.added_at || new Date().toISOString()
  };
  if (!record.name) throw new Error("Option name is required.");

  const wroteRemote = await setDocument(collectionName, record.id, record);
  if (!wroteRemote) {
    const exists = records.some((item) => item.id === record.id);
    writeLocal(localKey, exists
      ? records.map((item) => item.id === record.id ? record : item)
      : [...records, record]);
  }
  return record;
}

async function deleteOption(collectionName, localKey, id) {
  const records = await getOptionCollection(collectionName, localKey);
  const removedRemote = await deleteDocument(collectionName, id);
  if (!removedRemote) writeLocal(localKey, records.filter((item) => item.id !== id));
  return true;
}

export function optionIdFromName(name) {
  const normalized = normalizeId(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || crypto.randomUUID();
}

export async function getBarangays() {
  return getOptionCollection(COLLECTIONS.barangays, LOCAL_KEYS.barangays);
}

export async function saveBarangay(input) {
  return saveOption(COLLECTIONS.barangays, LOCAL_KEYS.barangays, input);
}

export async function deleteBarangay(id) {
  return deleteOption(COLLECTIONS.barangays, LOCAL_KEYS.barangays, id);
}

export async function getSchools() {
  return getOptionCollection(COLLECTIONS.schools, LOCAL_KEYS.schools);
}

export async function saveSchool(input) {
  return saveOption(COLLECTIONS.schools, LOCAL_KEYS.schools, input);
}

export async function deleteSchool(id) {
  return deleteOption(COLLECTIONS.schools, LOCAL_KEYS.schools, id);
}

export async function getCourses() {
  return getOptionCollection(COLLECTIONS.courses, LOCAL_KEYS.courses);
}

export async function saveCourse(input) {
  return saveOption(COLLECTIONS.courses, LOCAL_KEYS.courses, input);
}

export async function deleteCourse(id) {
  return deleteOption(COLLECTIONS.courses, LOCAL_KEYS.courses, id);
}

export async function getBatches() {
  return getOptionCollection(COLLECTIONS.batches, LOCAL_KEYS.batches);
}

export async function saveBatch(input) {
  return saveOption(COLLECTIONS.batches, LOCAL_KEYS.batches, input);
}

export async function deleteBatch(id) {
  return deleteOption(COLLECTIONS.batches, LOCAL_KEYS.batches, id);
}

export async function getSchoolCourses() {
  return getCollection(COLLECTIONS.schoolCourses, LOCAL_KEYS.schoolCourses);
}

export async function saveSchoolCourse(input) {
  const schoolCourses = await getSchoolCourses();
  const record = {
    id: input.id || crypto.randomUUID(),
    school_name: normalizeId(input.school_name),
    course_name: normalizeId(input.course_name),
    added_at: input.added_at || new Date().toISOString()
  };

  const wroteRemote = await setDocument(COLLECTIONS.schoolCourses, record.id, record);
  if (!wroteRemote) writeLocal(LOCAL_KEYS.schoolCourses, [...schoolCourses, record]);
  return record;
}

async function fetchSeedJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load seed data ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function appendMissingById(existingRecords, incomingRecords, getId) {
  const existingIds = new Set(existingRecords.map(getId).filter(Boolean));
  return incomingRecords.filter((record) => {
    const id = getId(record);
    return id && !existingIds.has(id);
  });
}

async function seedOptionCollectionFromRecords(collectionName, localKey, currentRecords, incomingRecords) {
  const existingIds = new Set(currentRecords.map((record) => normalizeId(record.id)).filter(Boolean));
  const existingNames = new Set(currentRecords.map((record) => normalizeId(record.name).toLowerCase()).filter(Boolean));
  const missingRecords = incomingRecords.filter((record) => {
    const id = normalizeId(record.id);
    const name = normalizeId(record.name).toLowerCase();
    return id && name && !existingIds.has(id) && !existingNames.has(name);
  });
  const wroteRemote = missingRecords.length
    ? await setDocuments(collectionName, missingRecords, (record) => normalizeId(record.id))
    : true;

  if (!wroteRemote && missingRecords.length) {
    writeLocal(localKey, [...currentRecords, ...missingRecords]);
  }

  return missingRecords.length;
}

export async function importBatchWorkbookOptions() {
  const [currentBarangays, currentSchools, currentBatches, options] = await Promise.all([
    getBarangays(),
    getSchools(),
    getBatches(),
    fetchSeedJson(BATCH_OPTIONS_SEED_URL)
  ]);

  const barangaysCreated = await seedOptionCollectionFromRecords(
    COLLECTIONS.barangays,
    LOCAL_KEYS.barangays,
    currentBarangays,
    options.barangays || []
  );
  const schoolsCreated = await seedOptionCollectionFromRecords(
    COLLECTIONS.schools,
    LOCAL_KEYS.schools,
    currentSchools,
    options.schools || []
  );
  const batchesCreated = await seedOptionCollectionFromRecords(
    COLLECTIONS.batches,
    LOCAL_KEYS.batches,
    currentBatches,
    options.batches || []
  );

  return {
    skipped: !barangaysCreated && !schoolsCreated && !batchesCreated,
    barangaysCreated,
    schoolsCreated,
    batchesCreated,
    source: BATCH_WORKBOOK_SOURCE
  };
}

export async function seedFirestoreFromBundledJson() {
  if (!hasFirebaseConfig()) {
    throw new Error("Fill public/firebase-config.js and set USE_FIREBASE=true before seeding Firestore.");
  }

  const [students, trash, schoolCourses] = await Promise.all([
    fetch("/data/student_data.seed.json").then((response) => response.json()),
    fetch("/data/trash_data.seed.json").then((response) => response.json()),
    fetch("/data/schools_courses.seed.json").then((response) => response.json())
  ]);

  for (const student of students) {
    const id = student.student_id || crypto.randomUUID();
    await setDocument(COLLECTIONS.students, id, { ...student, student_id: id });
  }

  for (const item of trash) {
    const id = item.student_id || crypto.randomUUID();
    await setDocument(COLLECTIONS.trash, id, { ...item, student_id: id });
  }

  for (const item of schoolCourses) {
    const id = item.id || crypto.randomUUID();
    await setDocument(COLLECTIONS.schoolCourses, id, { ...item, id });
  }

  const schoolNames = [...new Set(schoolCourses.map((item) => normalizeId(item.school_name)).filter(Boolean))];
  const courseNames = [...new Set(schoolCourses.map((item) => normalizeId(item.course_name)).filter(Boolean))];

  for (const name of schoolNames) {
    await setDocument(COLLECTIONS.schools, optionIdFromName(name), { id: optionIdFromName(name), name, added_at: new Date().toISOString() });
  }

  for (const name of courseNames) {
    await setDocument(COLLECTIONS.courses, optionIdFromName(name), { id: optionIdFromName(name), name, added_at: new Date().toISOString() });
  }

  return {
    students: students.length,
    trash: trash.length,
    schoolCourses: schoolCourses.length,
    payoutRecords: 0,
    schools: schoolNames.length,
    courses: courseNames.length
  };
}

export async function seedLocalFromBundledJson({ overwrite = false } = {}) {
  const existingStudents = readLocal(LOCAL_KEYS.students);
  const existingTrash = readLocal(LOCAL_KEYS.trash);
  const existingSchoolCourses = readLocal(LOCAL_KEYS.schoolCourses);
  const existingPayoutRecords = readLocal(LOCAL_KEYS.payoutRecords);
  const existingBarangays = readLocal(LOCAL_KEYS.barangays);
  const existingSchools = readLocal(LOCAL_KEYS.schools);
  const existingCourses = readLocal(LOCAL_KEYS.courses);
  const existingBatches = readLocal(LOCAL_KEYS.batches);

  if (!overwrite && (
    existingStudents.length ||
    existingTrash.length ||
    existingSchoolCourses.length ||
    existingPayoutRecords.length ||
    existingBarangays.length ||
    existingSchools.length ||
    existingCourses.length ||
    existingBatches.length
  )) {
    return {
      skipped: true,
      students: existingStudents.length,
      trash: existingTrash.length,
      schoolCourses: existingSchoolCourses.length,
      payoutRecords: existingPayoutRecords.length,
      barangays: existingBarangays.length,
      schools: existingSchools.length,
      courses: existingCourses.length,
      batches: existingBatches.length
    };
  }

  const [students, trash, schoolCourses] = await Promise.all([
    fetch("/data/student_data.seed.json").then((response) => response.json()),
    fetch("/data/trash_data.seed.json").then((response) => response.json()),
    fetch("/data/schools_courses.seed.json").then((response) => response.json())
  ]);

  writeLocal(LOCAL_KEYS.students, students);
  writeLocal(LOCAL_KEYS.trash, trash);
  writeLocal(LOCAL_KEYS.schoolCourses, schoolCourses);
  writeLocal(LOCAL_KEYS.payoutRecords, []);
  writeLocal(LOCAL_KEYS.barangays, []);
  writeLocal(LOCAL_KEYS.schools, [...new Set(schoolCourses.map((item) => normalizeId(item.school_name)).filter(Boolean))]
    .map((name) => ({ id: optionIdFromName(name), name, added_at: new Date().toISOString() })));
  writeLocal(LOCAL_KEYS.courses, [...new Set(schoolCourses.map((item) => normalizeId(item.course_name)).filter(Boolean))]
    .map((name) => ({ id: optionIdFromName(name), name, added_at: new Date().toISOString() })));
  writeLocal(LOCAL_KEYS.batches, []);
  const schoolCount = [...new Set(schoolCourses.map((item) => normalizeId(item.school_name)).filter(Boolean))].length;
  const courseCount = [...new Set(schoolCourses.map((item) => normalizeId(item.course_name)).filter(Boolean))].length;

  return {
    skipped: false,
    students: students.length,
    trash: trash.length,
    schoolCourses: schoolCourses.length,
    payoutRecords: 0,
    barangays: 0,
    schools: schoolCount,
    courses: courseCount,
    batches: 0
  };
}
