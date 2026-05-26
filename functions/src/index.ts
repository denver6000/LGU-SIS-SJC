import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions/v2";
import {HttpsError, CallableRequest, onCall} from "firebase-functions/v2/https";

initializeApp();

setGlobalOptions({
  invoker: "public",
  maxInstances: 10,
  region: "asia-southeast1",
});

const db = getFirestore();
const auth = getAuth();
const CALLABLE_OPTIONS = {invoker: "public"} as const;
const ROLE_ADMIN = "admin";
const ROLE_USER = "user";
const STUDENTS_COLLECTION = "students";
const TRASH_COLLECTION = "trash";

type AppRole = "admin" | "user";

type CreateManagedUserData = {
  email?: string;
  password?: string;
  displayName?: string;
  role?: string;
};

type DeleteManagedUserData = {
  uid?: string;
};

type UpdateManagedUserData = {
  uid?: string;
  displayName?: string;
  password?: string;
};

type StudentRecordInput = {
  student_id?: string;
  full_name?: string;
  student_number?: string;
  barangay?: string;
  address?: string;
  school_address?: string;
  phone_number?: string;
  school_course?: string;
  year_level?: string;
  batch?: string;
  status?: string;
  academic_status?: string;
  certificate_of_residency?: boolean;
  pagpapatunay_form?: boolean;
  picture_of_the_house?: boolean;
  good_moral_certificate?: boolean;
  original_certificate_of_grades?: boolean;
  proof_of_enrollment?: boolean;
  school_id?: boolean;
  migration_source?: string;
  migration_source_sheet?: string;
  migration_source_row?: string;
  migration_source_no?: string;
  migration_source_key?: string;
  migration_group?: string;
  created_at?: string;
  deleted_at?: string;
};

type SaveStudentData = {
  student?: StudentRecordInput;
};

type UpdateStudentData = {
  studentId?: string;
  student?: StudentRecordInput;
};

type StudentIdData = {
  studentId?: string;
};

function getRole(request: CallableRequest<unknown>): AppRole | null {
  const claims = request.auth?.token;
  if (!claims) return null;
  if (claims.role === ROLE_ADMIN || claims.admin === true) return ROLE_ADMIN;
  if (claims.role === ROLE_USER || claims.user === true) return ROLE_USER;
  return null;
}

function assertAdmin(request: CallableRequest<unknown>): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to use this function.");
  }

  if (getRole(request) !== ROLE_ADMIN) {
    throw new HttpsError("permission-denied", "This action requires the admin role.");
  }
}

function requireNonEmptyString(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new HttpsError("invalid-argument", `${label} is required.`);
  }
  return normalized;
}

function normalizeManagedRole(value: unknown): AppRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === ROLE_ADMIN || normalized === ROLE_USER) {
    return normalized;
  }
  throw new HttpsError("invalid-argument", "Role must be either 'admin' or 'user'.");
}

function roleFromClaims(claims: Record<string, unknown> = {}): AppRole | null {
  if (claims.role === ROLE_ADMIN || claims.admin === true) return ROLE_ADMIN;
  if (claims.role === ROLE_USER || claims.user === true) return ROLE_USER;
  return null;
}

function rethrowManagedUserError(error: unknown, fallbackMessage: string): never {
  if (error instanceof HttpsError) throw error;

  const adminCode = typeof (error as {code?: unknown})?.code === "string"
    ? String((error as {code?: string}).code)
    : "";
  const adminMessage = error instanceof Error ? error.message : fallbackMessage;

  switch (adminCode) {
  case "auth/email-already-exists":
    throw new HttpsError("already-exists", "A Firebase Auth user with that email already exists.");
  case "auth/invalid-email":
    throw new HttpsError("invalid-argument", "The email address is not valid.");
  case "auth/invalid-password":
    throw new HttpsError("invalid-argument", "The password does not meet Firebase Auth requirements.");
  case "auth/user-not-found":
    throw new HttpsError("not-found", "The Firebase Auth user could not be found.");
  case "auth/uid-already-exists":
    throw new HttpsError("already-exists", "That Firebase Auth user ID already exists.");
  case "auth/insufficient-permission":
    throw new HttpsError("permission-denied", "The function does not have permission to manage Firebase Auth users.");
  default:
    throw new HttpsError("internal", adminMessage || fallbackMessage);
  }
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeStudentRecord(input: StudentRecordInput = {}, overrides: Partial<StudentRecordInput> = {}): StudentRecordInput {
  return {
    student_id: String(overrides.student_id ?? input.student_id ?? "").trim(),
    full_name: String(overrides.full_name ?? input.full_name ?? "").trim(),
    student_number: String(overrides.student_number ?? input.student_number ?? "").trim(),
    barangay: String(overrides.barangay ?? input.barangay ?? "").trim(),
    address: String(overrides.address ?? input.address ?? "").trim(),
    school_address: String(overrides.school_address ?? input.school_address ?? "").trim(),
    phone_number: String(overrides.phone_number ?? input.phone_number ?? "").trim(),
    school_course: String(overrides.school_course ?? input.school_course ?? "").trim(),
    year_level: String(overrides.year_level ?? input.year_level ?? "").trim(),
    batch: String(overrides.batch ?? input.batch ?? "").trim(),
    status: String(overrides.status ?? input.status ?? "Pending").trim() || "Pending",
    academic_status: String(overrides.academic_status ?? input.academic_status ?? "").trim(),
    certificate_of_residency: normalizeBoolean(overrides.certificate_of_residency ?? input.certificate_of_residency),
    pagpapatunay_form: normalizeBoolean(overrides.pagpapatunay_form ?? input.pagpapatunay_form),
    picture_of_the_house: normalizeBoolean(overrides.picture_of_the_house ?? input.picture_of_the_house),
    good_moral_certificate: normalizeBoolean(overrides.good_moral_certificate ?? input.good_moral_certificate),
    original_certificate_of_grades: normalizeBoolean(overrides.original_certificate_of_grades ?? input.original_certificate_of_grades),
    proof_of_enrollment: normalizeBoolean(overrides.proof_of_enrollment ?? input.proof_of_enrollment),
    school_id: normalizeBoolean(overrides.school_id ?? input.school_id),
    migration_source: String(overrides.migration_source ?? input.migration_source ?? "").trim(),
    migration_source_sheet: String(overrides.migration_source_sheet ?? input.migration_source_sheet ?? "").trim(),
    migration_source_row: String(overrides.migration_source_row ?? input.migration_source_row ?? "").trim(),
    migration_source_no: String(overrides.migration_source_no ?? input.migration_source_no ?? "").trim(),
    migration_source_key: String(overrides.migration_source_key ?? input.migration_source_key ?? "").trim(),
    migration_group: String(overrides.migration_group ?? input.migration_group ?? "").trim(),
    created_at: String(overrides.created_at ?? input.created_at ?? new Date().toISOString()).trim(),
    deleted_at: String(overrides.deleted_at ?? input.deleted_at ?? "").trim(),
  };
}

async function nextStudentId(): Promise<string> {
  const snapshot = await db.collection(STUDENTS_COLLECTION)
    .orderBy("student_id", "desc")
    .limit(1)
    .get();
  const currentId = snapshot.docs[0]?.data()?.student_id;
  const numeric = Number.parseInt(String(currentId ?? "").replace(/^STU/i, ""), 10);
  const next = Number.isFinite(numeric) ? numeric + 1 : 1;
  return `STU${String(next).padStart(3, "0")}`;
}

async function listAllUsers() {
  const users = [];
  let pageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  return users;
}

export const createManagedUser = onCall<CreateManagedUserData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const email = requireNonEmptyString(request.data?.email, "Email");
  const password = requireNonEmptyString(request.data?.password, "Password");
  const role = normalizeManagedRole(request.data?.role);
  const displayName = String(request.data?.displayName ?? "").trim();

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || undefined,
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      role,
      admin: role === ROLE_ADMIN,
      user: role === ROLE_USER,
    });

    return {
      uid: userRecord.uid,
      email: userRecord.email,
      role,
    };
  } catch (error) {
    rethrowManagedUserError(error, "Unable to create user.");
  }
});

export const listManagedUsers = onCall(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  try {
    const users = await listAllUsers();
    return {
      users: users
        .map((userRecord) => ({
          uid: userRecord.uid,
          email: userRecord.email || "",
          displayName: userRecord.displayName || "",
          disabled: userRecord.disabled === true,
          role: roleFromClaims((userRecord.customClaims ?? {}) as Record<string, unknown>),
        }))
        .sort((left, right) => left.email.localeCompare(right.email, undefined, {sensitivity: "base"})),
    };
  } catch (error) {
    rethrowManagedUserError(error, "Unable to list users.");
  }
});

export const deleteManagedUser = onCall<DeleteManagedUserData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const uid = requireNonEmptyString(request.data?.uid, "UID");
  if (uid === request.auth?.uid) {
    throw new HttpsError("failed-precondition", "You cannot delete the account currently signed in.");
  }

  try {
    await auth.deleteUser(uid);
    return {uid, deleted: true};
  } catch (error) {
    rethrowManagedUserError(error, "Unable to delete user.");
  }
});

export const updateManagedUser = onCall<UpdateManagedUserData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const uid = requireNonEmptyString(request.data?.uid, "UID");
  const displayName = String(request.data?.displayName ?? "").trim();
  const password = String(request.data?.password ?? "").trim();

  if (!displayName && !password) {
    throw new HttpsError("invalid-argument", "Provide a display name or a new password.");
  }
  if (password && password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  try {
    const updatePayload: {displayName?: string; password?: string} = {};
    if (displayName) updatePayload.displayName = displayName;
    if (password) updatePayload.password = password;

    const userRecord = await auth.updateUser(uid, updatePayload);
    return {
      uid: userRecord.uid,
      email: userRecord.email || "",
      displayName: userRecord.displayName || "",
      disabled: userRecord.disabled === true,
      role: roleFromClaims((userRecord.customClaims ?? {}) as Record<string, unknown>),
    };
  } catch (error) {
    rethrowManagedUserError(error, "Unable to update user.");
  }
});

export const saveStudentByAdmin = onCall<SaveStudentData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const input = request.data?.student;
  if (!input || typeof input !== "object") {
    throw new HttpsError("invalid-argument", "Student payload is required.");
  }

  const studentId = String(input.student_id ?? "").trim() || await nextStudentId();
  const student = normalizeStudentRecord(input, {
    student_id: studentId,
    created_at: input.created_at || new Date().toISOString(),
    deleted_at: "",
  });

  try {
    await db.collection(STUDENTS_COLLECTION).doc(studentId).set(student);
    return {student};
  } catch (error) {
    throw new HttpsError("internal", error instanceof Error ? error.message : "Unable to save student.");
  }
});

export const updateStudentByAdmin = onCall<UpdateStudentData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const studentId = requireNonEmptyString(request.data?.studentId, "Student ID");
  const input = request.data?.student;
  if (!input || typeof input !== "object") {
    throw new HttpsError("invalid-argument", "Student payload is required.");
  }

  const studentRef = db.collection(STUDENTS_COLLECTION).doc(studentId);

  try {
    const snapshot = await studentRef.get();
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Student record not found.");
    }

    const existing = snapshot.data() as StudentRecordInput;
    const student = normalizeStudentRecord({...existing, ...input}, {
      student_id: studentId,
      created_at: existing.created_at || input.created_at || new Date().toISOString(),
      deleted_at: "",
    });
    await studentRef.set(student);
    return {student};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error instanceof Error ? error.message : "Unable to update student.");
  }
});

export const moveStudentToTrashByAdmin = onCall<StudentIdData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const studentId = requireNonEmptyString(request.data?.studentId, "Student ID");
  const studentRef = db.collection(STUDENTS_COLLECTION).doc(studentId);
  const trashRef = db.collection(TRASH_COLLECTION).doc(studentId);

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(studentRef);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "Student record not found.");
      }

      const student = normalizeStudentRecord(snapshot.data() as StudentRecordInput, {
        student_id: studentId,
        deleted_at: new Date().toISOString(),
      });
      transaction.set(trashRef, student);
      transaction.delete(studentRef);
    });
    return {studentId, removed: true};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error instanceof Error ? error.message : "Unable to remove student.");
  }
});

export const restoreStudentByAdmin = onCall<StudentIdData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const studentId = requireNonEmptyString(request.data?.studentId, "Student ID");
  const studentRef = db.collection(STUDENTS_COLLECTION).doc(studentId);
  const trashRef = db.collection(TRASH_COLLECTION).doc(studentId);

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(trashRef);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "Trash record not found.");
      }

      const restored = normalizeStudentRecord(snapshot.data() as StudentRecordInput, {
        student_id: studentId,
        deleted_at: "",
      });
      transaction.set(studentRef, restored);
      transaction.delete(trashRef);
    });
    return {studentId, restored: true};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error instanceof Error ? error.message : "Unable to restore student.");
  }
});

export const deleteTrashStudentByAdmin = onCall<StudentIdData>(CALLABLE_OPTIONS, async (request) => {
  assertAdmin(request);

  const studentId = requireNonEmptyString(request.data?.studentId, "Student ID");

  try {
    await db.collection(TRASH_COLLECTION).doc(studentId).delete();
    return {studentId, deleted: true};
  } catch (error) {
    throw new HttpsError("internal", error instanceof Error ? error.message : "Unable to permanently delete trash record.");
  }
});
