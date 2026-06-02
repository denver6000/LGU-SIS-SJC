import "server-only";

import { headers } from "next/headers";
import { collection, getDocs } from "firebase/firestore/lite";
import { COLLECTIONS } from "../shared/collections";
import type { CurrentCycleConfig } from "../shared/current-cycle";
import type { AppInitialData } from "../client/api-client";
import type { OperationLog } from "../shared/operation-log";
import type { PayoutRecord } from "../shared/payout-record";
import type { Student } from "../shared/student";
import { listOptions, listSchoolCourses } from "./repositories/options";
import { listOperationLogs } from "./repositories/operation-logs";
import { listPayoutRecords } from "./repositories/payout-records";
import { getCurrentCycleConfig } from "./repositories/system-config";
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
  const isAdmin = isAdminRole(user.claims.role) || user.claims.admin === true;
  const shouldUseServerAppReads = !isDevAppEnv() && !isAdmin;
  const authIdToken = shouldUseServerAppReads ? await getAuthIdTokenFromHeaders() : null;
  const [serverAppStudents, serverAppPayoutRecords, serverAppOperationLogs] = await Promise.all([
    listCollectionWithServerApp<Student>(COLLECTIONS.students, authIdToken),
    isAdmin ? listCollectionWithServerApp<PayoutRecord>(COLLECTIONS.payoutRecords, authIdToken) : Promise.resolve(null),
    listCollectionWithServerApp<OperationLog>(COLLECTIONS.operationLogs, authIdToken)
  ]);

  const [students, trash, payoutRecords, operationLogs, currentCycle, barangays, schools, courses, batches, schoolCourses] =
    await Promise.all([
      serverAppStudents ?? listStudents(),
      isAdmin ? listTrash() : Promise.resolve([]),
      isAdmin ? serverAppPayoutRecords ?? listPayoutRecords() : Promise.resolve([]),
      isAdmin
        ? serverAppOperationLogs ?? listOperationLogs()
        : (serverAppOperationLogs ?? await listOperationLogs()).filter((record) => record.entity !== "payroll"),
      getCurrentCycleConfig(),
      listOptions("barangays"),
      listOptions("schools"),
      listOptions("courses"),
      listOptions("batches"),
      listSchoolCourses()
    ]);

  const initialData: AppInitialData = {
    user,
    currentCycle: currentCycle as CurrentCycleConfig,
    students,
    trash,
    payoutRecords,
    operationLogs,
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
