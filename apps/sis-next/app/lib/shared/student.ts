export type StudentYearLevelHistoryEntry = {
  from_year_level: string;
  to_year_level: string;
  changed_at: string;
  changed_by_uid?: string;
  changed_by_email?: string;
  reason?: string;
};

export type StudentRenewalHistoryEntry = {
  status: "renewed" | "pending";
  changed_at: string;
  changed_by_uid?: string;
  changed_by_email?: string;
  reason?: string;
};

export type Student = {
  student_id: string;
  full_name: string;
  student_number?: string;
  barangay?: string;
  address?: string;
  school_address?: string;
  phone_number?: string;
  school_course?: string;
  year_level?: string;
  year_level_history?: StudentYearLevelHistoryEntry[];
  batch?: string;
  certificate_of_residency?: boolean;
  pagpapatunay_form?: boolean;
  picture_of_the_house?: boolean;
  good_moral_certificate?: boolean;
  original_certificate_of_grades?: boolean;
  proof_of_enrollment?: boolean;
  school_id?: boolean;
  claimed?: boolean;
  claimed_at?: string;
  renewed?: boolean;
  renewed_at?: string;
  renewal_history?: StudentRenewalHistoryEntry[];
  payrolled?: boolean;
  payrolled_at?: string;
  migration_source?: string;
  migration_source_sheet?: string;
  migration_source_row?: string;
  migration_source_no?: string;
  migration_source_key?: string;
  migration_group?: string;
  created_at?: string;
  deleted_at?: string;
};

export type StudentInput = Partial<Student>;
