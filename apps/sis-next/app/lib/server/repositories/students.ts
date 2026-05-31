import "server-only";

import type { Student, StudentInput } from "../../shared/student";
import { COLLECTIONS } from "../../shared/collections";
import { getAdminDb } from "../firebase-admin";
import { HttpError } from "../../shared/http";

const db = getAdminDb();

function normalizeBoolean(value: unknown) {
  return value === true;
}

export function normalizeStudentRecord(
  input: StudentInput = {},
  overrides: Partial<Student> = {}
): Student {
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
    certificate_of_residency: normalizeBoolean(overrides.certificate_of_residency ?? input.certificate_of_residency),
    pagpapatunay_form: normalizeBoolean(overrides.pagpapatunay_form ?? input.pagpapatunay_form),
    picture_of_the_house: normalizeBoolean(overrides.picture_of_the_house ?? input.picture_of_the_house),
    good_moral_certificate: normalizeBoolean(overrides.good_moral_certificate ?? input.good_moral_certificate),
    original_certificate_of_grades: normalizeBoolean(overrides.original_certificate_of_grades ?? input.original_certificate_of_grades),
    proof_of_enrollment: normalizeBoolean(overrides.proof_of_enrollment ?? input.proof_of_enrollment),
    school_id: normalizeBoolean(overrides.school_id ?? input.school_id),
    claimed: normalizeBoolean(overrides.claimed ?? input.claimed),
    renewed: normalizeBoolean(overrides.renewed ?? input.renewed),
    payrolled: normalizeBoolean(overrides.payrolled ?? input.payrolled),
    claimed_at: String(overrides.claimed_at ?? input.claimed_at ?? "").trim(),
    renewed_at: String(overrides.renewed_at ?? input.renewed_at ?? "").trim(),
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
  return snapshot.docs.map((docSnap) => docSnap.data() as Student);
}

export async function listTrash() {
  const snapshot = await db.collection(COLLECTIONS.trash).get();
  return snapshot.docs.map((docSnap) => docSnap.data() as Student);
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

export async function createStudent(input: StudentInput) {
  const studentId = String(input.student_id ?? "").trim() || await nextStudentId();
  const student = normalizeStudentRecord(input, {
    student_id: studentId,
    created_at: input.created_at || new Date().toISOString(),
    deleted_at: ""
  });

  await db.collection(COLLECTIONS.students).doc(studentId).set(student);
  return student;
}

export async function updateStudent(studentId: string, input: StudentInput) {
  const studentRef = db.collection(COLLECTIONS.students).doc(studentId);
  const snapshot = await studentRef.get();
  if (!snapshot.exists) {
    throw new HttpError(404, "Student record not found.");
  }

  const existing = snapshot.data() as Student;
  const student = normalizeStudentRecord({ ...existing, ...input }, {
    student_id: studentId,
    created_at: existing.created_at || input.created_at || new Date().toISOString(),
    deleted_at: ""
  });

  await studentRef.set(student);
  return student;
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
