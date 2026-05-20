import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions/v2";
import {HttpsError, CallableRequest, onCall} from "firebase-functions/v2/https";

initializeApp();

setGlobalOptions({
  maxInstances: 10,
  region: "asia-southeast1",
});

const db = getFirestore();
const auth = getAuth();
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

type RemoveStudentData = {
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

export const createManagedUser = onCall<CreateManagedUserData>(async (request) => {
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
    throw new HttpsError("internal", error instanceof Error ? error.message : "Unable to create user.");
  }
});

export const removeStudent = onCall<RemoveStudentData>(async (request) => {
  assertAdmin(request);

  const studentId = requireNonEmptyString(request.data?.studentId, "Student ID");
  const studentRef = db.collection(STUDENTS_COLLECTION).doc(studentId);
  const trashRef = db.collection(TRASH_COLLECTION).doc(studentId);

  try {
    await db.runTransaction(async (transaction) => {
      const studentSnap = await transaction.get(studentRef);
      if (!studentSnap.exists) {
        throw new HttpsError("not-found", "Student record not found.");
      }

      transaction.set(trashRef, {
        ...studentSnap.data(),
        student_id: studentId,
        deleted_at: new Date().toISOString(),
      });
      transaction.delete(studentRef);
    });

    return {
      studentId,
      removed: true,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error instanceof Error ? error.message : "Unable to remove student.");
  }
});
