import "server-only";

import type {
  Student,
  StudentInput,
  StudentRenewalHistoryEntry,
  StudentYearLevelHistoryEntry
} from "../../shared/student";
import { COLLECTIONS } from "../../shared/collections";
import { getAdminDb } from "../firebase-admin";
import { HttpError } from "../../shared/http";
import type { SessionUser } from "../../shared/user";

const db = getAdminDb();

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeYearLevelHistory(value: unknown): StudentYearLevelHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<StudentYearLevelHistoryEntry[]>((entries, entry) => {
      if (!entry || typeof entry !== "object") return entries;
      const record = entry as Partial<StudentYearLevelHistoryEntry>;
      const changedAt = String(record.changed_at ?? "").trim();
      const toYearLevel = String(record.to_year_level ?? "").trim();

      if (!changedAt || !toYearLevel) return entries;

      entries.push({
        from_year_level: String(record.from_year_level ?? "").trim(),
        to_year_level: toYearLevel,
        changed_at: changedAt,
        changed_by_uid: String(record.changed_by_uid ?? "").trim(),
        changed_by_email: String(record.changed_by_email ?? "").trim(),
        reason: String(record.reason ?? "").trim()
      });
      return entries;
    }, []);
}

function normalizeRenewalHistory(value: unknown): StudentRenewalHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<StudentRenewalHistoryEntry[]>((entries, entry) => {
    if (!entry || typeof entry !== "object") return entries;
    const record = entry as Partial<StudentRenewalHistoryEntry>;
    const changedAt = String(record.changed_at ?? "").trim();
    const status = record.status === "pending" ? "pending" : record.status === "renewed" ? "renewed" : "";

    if (!changedAt || !status) return entries;

    entries.push({
      status,
      changed_at: changedAt,
      changed_by_uid: String(record.changed_by_uid ?? "").trim(),
      changed_by_email: String(record.changed_by_email ?? "").trim(),
      reason: String(record.reason ?? "").trim()
    });
    return entries;
  }, []);
}

function buildYearLevelHistoryEntry({
  fromYearLevel,
  toYearLevel,
  actor,
  changedAt,
  reason = "Year level updated from student registry."
}: {
  fromYearLevel: string;
  toYearLevel: string;
  actor?: SessionUser | null;
  changedAt: string;
  reason?: string;
}): StudentYearLevelHistoryEntry {
  return {
    from_year_level: fromYearLevel,
    to_year_level: toYearLevel,
    changed_at: changedAt,
    changed_by_uid: actor?.uid || "",
    changed_by_email: actor?.email || "",
    reason
  };
}

function buildRenewalHistoryEntry({
  renewed,
  actor,
  changedAt,
  reason
}: {
  renewed: boolean;
  actor?: SessionUser | null;
  changedAt: string;
  reason: string;
}): StudentRenewalHistoryEntry {
  return {
    status: renewed ? "renewed" : "pending",
    changed_at: changedAt,
    changed_by_uid: actor?.uid || "",
    changed_by_email: actor?.email || "",
    reason
  };
}

export function normalizeStudentRecord(
  input: StudentInput = {},
  overrides: Partial<Student> = {}
): Student {
  const renewalHistorySource = overrides.renewal_history ?? input.renewal_history;
  const renewalHistory = normalizeRenewalHistory(renewalHistorySource);
  const renewed = normalizeBoolean(overrides.renewed ?? input.renewed);
  const renewedAt = String(overrides.renewed_at ?? input.renewed_at ?? "").trim();

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
    year_level_history: normalizeYearLevelHistory(overrides.year_level_history ?? input.year_level_history),
    batch: String(overrides.batch ?? input.batch ?? "").trim(),
    certificate_of_residency: normalizeBoolean(overrides.certificate_of_residency ?? input.certificate_of_residency),
    pagpapatunay_form: normalizeBoolean(overrides.pagpapatunay_form ?? input.pagpapatunay_form),
    picture_of_the_house: normalizeBoolean(overrides.picture_of_the_house ?? input.picture_of_the_house),
    good_moral_certificate: normalizeBoolean(overrides.good_moral_certificate ?? input.good_moral_certificate),
    original_certificate_of_grades: normalizeBoolean(overrides.original_certificate_of_grades ?? input.original_certificate_of_grades),
    proof_of_enrollment: normalizeBoolean(overrides.proof_of_enrollment ?? input.proof_of_enrollment),
    school_id: normalizeBoolean(overrides.school_id ?? input.school_id),
    claimed: normalizeBoolean(overrides.claimed ?? input.claimed),
    renewed,
    payrolled: normalizeBoolean(overrides.payrolled ?? input.payrolled),
    claimed_at: String(overrides.claimed_at ?? input.claimed_at ?? "").trim(),
    renewed_at: renewedAt,
    renewal_history: renewalHistory.length
      ? renewalHistory
      : renewed
        ? [
            {
              status: "renewed",
              changed_at: renewedAt || String(overrides.created_at ?? input.created_at ?? new Date().toISOString()).trim(),
              changed_by_uid: "",
              changed_by_email: "",
              reason: "Legacy renewed state inferred from the student record."
            }
          ]
        : [],
    payrolled_at: String(overrides.payrolled_at ?? input.payrolled_at ?? "").trim(),
    migration_source: String(overrides.migration_source ?? input.migration_source ?? "").trim(),
    migration_source_sheet: String(overrides.migration_source_sheet ?? input.migration_source_sheet ?? "").trim(),
    migration_source_row: String(overrides.migration_source_row ?? input.migration_source_row ?? "").trim(),
    migration_source_no: String(overrides.migration_source_no ?? input.migration_source_no ?? "").trim(),
    migration_source_key: String(overrides.migration_source_key ?? input.migration_source_key ?? "").trim(),
    migration_group: String(overrides.migration_group ?? input.migration_group ?? "").trim(),
    created_at: String(overrides.created_at ?? input.created_at ?? new Date().toISOString()).trim(),
    deleted_at: String(overrides.deleted_at ?? input.deleted_at ?? "").trim()
  };
}

export async function listStudents() {
  const snapshot = await db.collection(COLLECTIONS.students).get();
  return snapshot.docs.map((docSnap) => normalizeStudentRecord(docSnap.data() as Student, { student_id: docSnap.id }));
}

export async function listTrash() {
  const snapshot = await db.collection(COLLECTIONS.trash).get();
  return snapshot.docs.map((docSnap) => normalizeStudentRecord(docSnap.data() as Student, { student_id: docSnap.id }));
}

export async function nextStudentId() {
  const snapshot = await db
    .collection(COLLECTIONS.students)
    .orderBy("student_id", "desc")
    .limit(1)
    .get();

  const currentId = snapshot.docs[0]?.data()?.student_id;
  const numeric = Number.parseInt(String(currentId ?? "").replace(/^STU/i, ""), 10);
  const next = Number.isFinite(numeric) ? numeric + 1 : 1;
  return `STU${String(next).padStart(3, "0")}`;
}

export async function createStudent(input: StudentInput, actor?: SessionUser | null) {
  const studentId = String(input.student_id ?? "").trim() || await nextStudentId();
  const createdAt = input.created_at || new Date().toISOString();
  const yearLevel = String(input.year_level ?? "").trim();
  const student = normalizeStudentRecord(input, {
    student_id: studentId,
    created_at: createdAt,
    year_level_history: yearLevel
      ? [
          buildYearLevelHistoryEntry({
            fromYearLevel: "",
            toYearLevel: yearLevel,
            actor,
            changedAt: createdAt,
            reason: "Initial year level recorded when the student was created."
          })
        ]
      : [],
    renewal_history: input.renewed
      ? [
          buildRenewalHistoryEntry({
            renewed: true,
            actor,
            changedAt: createdAt,
            reason: "Initial renewal state recorded when the student was created."
          })
        ]
      : [],
    deleted_at: ""
  });

  await db.collection(COLLECTIONS.students).doc(studentId).set(student);
  return student;
}

export async function updateStudent(studentId: string, input: StudentInput, actor?: SessionUser | null) {
  const studentRef = db.collection(COLLECTIONS.students).doc(studentId);
  let updatedStudent: Student | undefined;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(studentRef);
    if (!snapshot.exists) {
      throw new HttpError(404, "Student record not found.");
    }

    const existing = normalizeStudentRecord(snapshot.data() as Student, { student_id: studentId });
    const nextStudent = normalizeStudentRecord({ ...existing, ...input }, {
      student_id: studentId,
      created_at: existing.created_at || input.created_at || new Date().toISOString(),
      deleted_at: ""
    });

    const previousYearLevel = String(existing.year_level || "").trim();
    const nextYearLevel = String(nextStudent.year_level || "").trim();

    if (previousYearLevel !== nextYearLevel) {
      nextStudent.year_level_history = [
        ...normalizeYearLevelHistory(existing.year_level_history),
        buildYearLevelHistoryEntry({
          fromYearLevel: previousYearLevel,
          toYearLevel: nextYearLevel,
          actor,
          changedAt: new Date().toISOString()
        })
      ];
    }

    if (Object.prototype.hasOwnProperty.call(input, "renewed") && existing.renewed !== nextStudent.renewed) {
      nextStudent.renewal_history = [
        ...normalizeRenewalHistory(existing.renewal_history),
        buildRenewalHistoryEntry({
          renewed: Boolean(nextStudent.renewed),
          actor,
          changedAt: new Date().toISOString(),
          reason: nextStudent.renewed
            ? "Student was marked renewed. Renewal count is informational and not limit-enforced."
            : "Student was moved back to pending renewal."
        })
      ];
    }

    transaction.set(studentRef, nextStudent);
    updatedStudent = nextStudent;
  });

  if (!updatedStudent) {
    throw new HttpError(500, "Student update did not complete.");
  }

  return updatedStudent;
}

export async function moveStudentToTrash(studentId: string) {
  const studentRef = db.collection(COLLECTIONS.students).doc(studentId);
  const trashRef = db.collection(COLLECTIONS.trash).doc(studentId);

  let movedStudent: Student | null = null;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(studentRef);
    if (!snapshot.exists) {
      throw new HttpError(404, "Student record not found.");
    }

    movedStudent = normalizeStudentRecord(snapshot.data() as Student, {
      student_id: studentId,
      deleted_at: new Date().toISOString()
    });
    transaction.set(trashRef, movedStudent);
    transaction.delete(studentRef);
  });

  return movedStudent;
}

export async function restoreStudent(studentId: string) {
  const studentRef = db.collection(COLLECTIONS.students).doc(studentId);
  const trashRef = db.collection(COLLECTIONS.trash).doc(studentId);

  let restoredStudent: Student | null = null;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(trashRef);
    if (!snapshot.exists) {
      throw new HttpError(404, "Trash record not found.");
    }

    restoredStudent = normalizeStudentRecord(snapshot.data() as Student, {
      student_id: studentId,
      deleted_at: ""
    });
    transaction.set(studentRef, restoredStudent);
    transaction.delete(trashRef);
  });

  return restoredStudent;
}

export async function deleteTrashStudent(studentId: string) {
  await db.collection(COLLECTIONS.trash).doc(studentId).delete();
  return { studentId, deleted: true };
}
