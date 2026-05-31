import "server-only";

import { headers } from "next/headers";
import { collection, getDocs } from "firebase/firestore/lite";
import { COLLECTIONS } from "../shared/collections";
import type { AppInitialData } from "../client/api-client";
import type { PayoutRecord } from "../shared/payout-record";
import type { Student } from "../shared/student";
import { listOptions, listSchoolCourses } from "./repositories/options";
import { listPayoutRecords } from "./repositories/payout-records";
import { listStudents, listTrash } from "./repositories/students";
import type { SessionUser } from "../shared/user";
import { getAuthIdTokenFromHeaders } from "./auth";
import { getServerAppFirestore } from "./firebase-server-app";
import { isDevAppEnv } from "../shared/app-env";
import { isAdminRole } from "../shared/roles";

async function listCollectionWithServerApp<T>(collectionName: string, authIdToken: string | null) {
  if (!authIdToken) return null;

  try {
    const requestHeaders = await headers();
    const firestore = getServerAppFirestore({
      authIdToken,
      releaseOnDeref: requestHeaders
    });
    const snapshot = await getDocs(collection(firestore, collectionName));
    return snapshot.docs.map((docSnap) => docSnap.data() as T);
  } catch (error) {
    const code = typeof (error as { code?: unknown })?.code === "string"
      ? String((error as { code?: string }).code)
      : "";

    if (
      code.includes("permission-denied") ||
      code.includes("unauthenticated") ||
      code.includes("failed-precondition")
    ) {
      return null;
    }

    throw error;
  }
}

export async function getAppInitialData(user: SessionUser) {
  const shouldUseServerAppReads = !isDevAppEnv() && !isAdminRole(user.claims.role) && user.claims.admin !== true;
  const authIdToken = shouldUseServerAppReads ? await getAuthIdTokenFromHeaders() : null;
  const [serverAppStudents, serverAppPayoutRecords] = await Promise.all([
    listCollectionWithServerApp<Student>(COLLECTIONS.students, authIdToken),
    listCollectionWithServerApp<PayoutRecord>(COLLECTIONS.payoutRecords, authIdToken)
  ]);

  const [students, trash, payoutRecords, barangays, schools, courses, batches, schoolCourses] =
    await Promise.all([
      serverAppStudents ?? listStudents(),
      user.claims.admin ? listTrash() : Promise.resolve([]),
      serverAppPayoutRecords ?? listPayoutRecords(),
      listOptions("barangays"),
      listOptions("schools"),
      listOptions("courses"),
      listOptions("batches"),
      listSchoolCourses()
    ]);

  const initialData: AppInitialData = {
    user,
    students,
    trash,
    payoutRecords,
    options: {
      barangays,
      schools,
      courses,
      batches,
      schoolCourses
    }
  };

  return initialData;
}
