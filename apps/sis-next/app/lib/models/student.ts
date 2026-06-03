import type { CurrentCycleConfig } from "../shared/current-cycle";
import {
  REQUIREMENT_KEYS,
  RENEWAL_REQUIREMENT_KEYS,
  type Student,
  type StudentPayoutType,
  type StudentRequirementMap,
  type StudentRenewalRequirementMap,
  type StudentSemesterRecord
} from "../shared/student";

export type StudentDocShape = Student;

export type StudentTimelineDebugRow = {
  source: "requirements" | "payrolls";
  selected_cycle: string;
  student_id: string;
  full_name: string;
  school: string;
  top_level_payrolled: boolean;
  top_level_renewed: boolean;
  permanent_payrolled: boolean;
  lifecycle: StudentPayoutType;
  selected_cycle_payroll_status: string;
  selected_cycle_renewal_status: string;
  selected_cycle_payrolled: boolean;
  selected_cycle_record_payout_type: string;
  global_initial_ready: string;
  selected_cycle_initial_snapshot_ready: string;
  selected_cycle_renewal_ready: string;
  semester_record_count: number;
};

function countReadyRequirements(requirements?: Partial<StudentRequirementMap>) {
  return REQUIREMENT_KEYS.filter((key) => requirements?.[key] === true).length;
}

function countReadyRenewalRequirements(requirements?: Partial<StudentRenewalRequirementMap>) {
  return RENEWAL_REQUIREMENT_KEYS.filter((key) => requirements?.[key] === true).length;
}

function emptyInitialRequirementMap(): StudentRequirementMap {
  return Object.fromEntries(REQUIREMENT_KEYS.map((key) => [key, false])) as StudentRequirementMap;
}

function mergeInitialRequirementMaps(...maps: Array<Partial<StudentRequirementMap> | undefined>) {
  const requirements = emptyInitialRequirementMap();

  for (const map of maps) {
    for (const key of REQUIREMENT_KEYS) {
      requirements[key] = requirements[key] || map?.[key] === true;
    }
  }

  return requirements;
}

export class StudentModel {
  constructor(readonly doc: StudentDocShape) {}

  get semesterRecords() {
    return Array.isArray(this.doc.semester_records) ? this.doc.semester_records : [];
  }

  get topLevelPayrolled() {
    return this.doc.payrolled === true || Boolean(this.doc.payrolled_at);
  }

  get topLevelRenewed() {
    return this.doc.renewed === true || Boolean(this.doc.renewed_at);
  }

  get permanentPayrolled() {
    return (
      this.topLevelPayrolled ||
      this.semesterRecords.some(
        (record) =>
          record.payroll_status === "payrolled" ||
          record.renewal_status === "payrolled" ||
          Boolean(record.payroll_id || record.payrolled_at)
      )
    );
  }

  get lifecycle(): StudentPayoutType {
    return this.permanentPayrolled ? "renewal" : "initial";
  }

  get globalInitialRequirements() {
    const globalRequirements = mergeInitialRequirementMaps(
      this.doc.requirements,
      Object.fromEntries(REQUIREMENT_KEYS.map((key) => [key, this.doc[key] === true])) as StudentRequirementMap
    );
    return countReadyRequirements(globalRequirements) > 0
      ? globalRequirements
      : mergeInitialRequirementMaps(...this.semesterRecords.map((record) => record.initial_payout_requirements));
  }

  recordForCycle(cycle: Pick<CurrentCycleConfig, "cycle_key">) {
    return this.semesterRecords.find((record) => record.cycle_key === cycle.cycle_key) || null;
  }

  cyclePayrollStatus(cycle: Pick<CurrentCycleConfig, "cycle_key">) {
    const record = this.recordForCycle(cycle);
    if (record?.payroll_status) return record.payroll_status;
    if (record?.renewal_status === "payrolled") return "payrolled";
    if (record?.renewal_status === "renewed") return "qualified";
    return "not_qualified";
  }

  isPayrolledForCycle(cycle: Pick<CurrentCycleConfig, "cycle_key">) {
    const record = this.recordForCycle(cycle);
    return (
      this.cyclePayrollStatus(cycle) === "payrolled" ||
      Boolean(record?.payroll_id || record?.payrolled_at)
    );
  }

  debugRow(source: StudentTimelineDebugRow["source"], cycle: CurrentCycleConfig): StudentTimelineDebugRow {
    const record = this.recordForCycle(cycle);

    return {
      source,
      selected_cycle: cycle.cycle_key,
      student_id: this.doc.student_id,
      full_name: this.doc.full_name,
      school: this.doc.school_address || "",
      top_level_payrolled: this.topLevelPayrolled,
      top_level_renewed: this.topLevelRenewed,
      permanent_payrolled: this.permanentPayrolled,
      lifecycle: this.lifecycle,
      selected_cycle_payroll_status: this.cyclePayrollStatus(cycle),
      selected_cycle_renewal_status: record?.renewal_status || "",
      selected_cycle_payrolled: this.isPayrolledForCycle(cycle),
      selected_cycle_record_payout_type: record?.payout_type || "",
      global_initial_ready: `${countReadyRequirements(this.globalInitialRequirements)}/${REQUIREMENT_KEYS.length}`,
      selected_cycle_initial_snapshot_ready: `${countReadyRequirements(record?.initial_payout_requirements)}/${REQUIREMENT_KEYS.length}`,
      selected_cycle_renewal_ready: `${countReadyRenewalRequirements(record?.renewal_requirements ?? record?.requirements)}/${RENEWAL_REQUIREMENT_KEYS.length}`,
      semester_record_count: this.semesterRecords.length
    };
  }
}

export function studentModel(student: StudentDocShape) {
  return new StudentModel(student);
}

export function hasPermanentPayroll(student: StudentDocShape) {
  return studentModel(student).permanentPayrolled;
}

export function lifecyclePayoutType(student: StudentDocShape): StudentPayoutType {
  return studentModel(student).lifecycle;
}

export function buildStudentTimelineDebugRows(
  source: StudentTimelineDebugRow["source"],
  cycle: CurrentCycleConfig,
  students: StudentDocShape[]
) {
  return students.map((student) => studentModel(student).debugRow(source, cycle));
}
