const STUDENT_EXPORT_HEADERS = [
  "Student ID",
  "Full Name",
  "Student Number",
  "Barangay",
  "Address",
  "School",
  "Phone",
  "Course",
  "Year Level",
  "Batch",
  "Status",
  "Renewed",
  "Claimed"
];

const PAYROLL_EXPORT_HEADERS = [
  "Student ID",
  "Full Name",
  "Student Number",
  "Course",
  "Payroll Notes"
];

const PAYROLL_WORD_TEMPLATE_URL = "./templates/PAYROLL_WORD_TEMPLATE.docx";
const PAYROLL_EXCEL_TEMPLATE_URL = "./templates/PAYROLL_TEMPLATE.xlsx";
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PAYROLL_MAX_STUDENTS = 15;
const PAYROLL_MARKER_ROW = 16;
const PAYROLL_END_MARKER = "X-X-X-X";
const PAYROLL_EXCEL_START_ROW = 10;
const PAYROLL_EXCEL_END_ROW = 24;
const PAYROLL_DEFAULT_AMOUNT = 5000;

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

export function buildStudentExportRows(students) {
  return students.map((student) => [
    student.student_id,
    student.full_name,
    student.student_number,
    student.barangay,
    student.address,
    student.school_address,
    student.phone_number,
    student.school_course,
    student.year_level,
    student.batch,
    student.status,
    student.renewed ? "Yes" : "No",
    student.claimed ? "Yes" : "No"
  ]);
}

export function buildPayrollExportRows(students) {
  return students.map((student) => [
    student.student_id,
    student.full_name,
    student.student_number,
    student.school_course,
    ""
  ]);
}

function formatLongDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatSemester(value) {
  const semester = Number.parseInt(value, 10);
  if (!Number.isFinite(semester)) return value || "";
  const suffix = semester === 1 ? "st" : semester === 2 ? "nd" : semester === 3 ? "rd" : "th";
  return `${semester}${suffix} Semester`.toUpperCase();
}

function buildPayrollWordData(students, metadata = {}) {
  if (students.length > PAYROLL_MAX_STUDENTS) {
    throw new Error(`Payroll Word export is limited to ${PAYROLL_MAX_STUDENTS} students.`);
  }

  const data = {
    generated_at: new Date().toLocaleString(),
    date_of_filing: formatLongDate(metadata.date_of_filing),
    school_year: metadata.school_year || "",
    sem_number: formatSemester(metadata.sem_number),
    selected_count: students.length,
    students: students.map((student, index) => ({
      no: index + 1,
      student_id: student.student_id || "",
      full_name: student.full_name || "",
      student_number: student.student_number || "",
      barangay: student.barangay || "",
      address: student.address || "",
      phone_number: student.phone_number || "",
      school: student.school_address || "",
      school_address: student.school_address || "",
      course: student.school_course || "",
      school_course: student.school_course || "",
      year_level: student.year_level || "",
      batch: student.batch || "",
      status: student.status || "",
      renewed: student.renewed ? "Yes" : "No",
      claimed: student.claimed ? "Yes" : "No"
    }))
  };

  for (let row = 1; row <= PAYROLL_MARKER_ROW; row += 1) {
    data[`student_${row}_fname`] = "";
    data[`student_${row}_name`] = "";
    data[`student_${row}_year_level`] = "";
    data[`student_${row}_school`] = "";
  }

  students.slice(0, PAYROLL_MAX_STUDENTS).forEach((student, index) => {
    const row = index + 1;
    data[`student_${row}_fname`] = student.full_name || "";
    data[`student_${row}_name`] = student.full_name || "";
    data[`student_${row}_year_level`] = student.year_level || "";
    data[`student_${row}_school`] = student.school_address || "";
  });

  const markerRow = Math.min(students.length + 1, PAYROLL_MARKER_ROW);
  data[`student_${markerRow}_fname`] = PAYROLL_END_MARKER;
  data[`student_${markerRow}_name`] = PAYROLL_END_MARKER;

  return data;
}

function assertPayrollLimit(students) {
  if (students.length > PAYROLL_MAX_STUDENTS) {
    throw new Error(`Payroll export is limited to ${PAYROLL_MAX_STUDENTS} students.`);
  }
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cellPattern(address) {
  return new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
}

function cellAttributes(cellXml, address) {
  const openingTag = cellXml.slice(0, cellXml.indexOf(">") + 1);
  if (!openingTag) {
    throw new Error(`Unable to update Excel template cell ${address}.`);
  }
  return openingTag
    .replace(/^<c\b/, "")
    .replace(/\/?>$/, "")
    .replace(/\s+t="[^"]*"/, "");
}

function replaceCellXml(sheetXml, address, value) {
  const pattern = cellPattern(address);
  const current = sheetXml.match(pattern)?.[0];
  if (!current) {
    throw new Error(`Payroll Excel template is missing expected cell ${address}.`);
  }
  const attrs = cellAttributes(current, address);
  if (value === "" || value === null || value === undefined) {
    return sheetXml.replace(pattern, `<c${attrs}/>`);
  }
  if (typeof value === "number") {
    return sheetXml.replace(pattern, `<c${attrs}><v>${value}</v></c>`);
  }
  return sheetXml.replace(
    pattern,
    `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
  );
}

function fillPayrollExcelSheetXml(sheetXml, students) {
  let xml = replaceCellXml(sheetXml, "O3", "Sheet 1 of 1 Sheets");

  for (let row = PAYROLL_EXCEL_START_ROW; row <= PAYROLL_EXCEL_END_ROW + 1; row += 1) {
    xml = replaceCellXml(xml, `B${row}`, "");
    if (row <= PAYROLL_EXCEL_END_ROW) {
      xml = replaceCellXml(xml, `E${row}`, "");
      xml = replaceCellXml(xml, `J${row}`, "");
    }
  }

  students.forEach((student, index) => {
    const row = PAYROLL_EXCEL_START_ROW + index;
    xml = replaceCellXml(xml, `B${row}`, student.full_name || "");
    xml = replaceCellXml(xml, `E${row}`, PAYROLL_DEFAULT_AMOUNT);
    xml = replaceCellXml(xml, `J${row}`, PAYROLL_DEFAULT_AMOUNT);
  });

  const markerRow = PAYROLL_EXCEL_START_ROW + students.length;
  xml = replaceCellXml(xml, `B${markerRow}`, PAYROLL_END_MARKER);
  xml = replaceCellXml(xml, "J25", students.length * PAYROLL_DEFAULT_AMOUNT);
  return xml;
}

export class StudentExportService {
  exportCsv(students, filename = "student-records.csv") {
    downloadCsv(filename, [STUDENT_EXPORT_HEADERS, ...buildStudentExportRows(students)]);
  }
}

export class PayrollExportService {
  exportCsv(students, filename = "payroll.csv") {
    downloadCsv(filename, [PAYROLL_EXPORT_HEADERS, ...buildPayrollExportRows(students)]);
  }

  async exportWord(students, filename = "payroll.docx", metadata = {}) {
    assertPayrollLimit(students);
    const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/pizzip@3.1.8/+esm"),
      import("https://cdn.jsdelivr.net/npm/docxtemplater@3.52.0/+esm")
    ]);

    const response = await fetch(PAYROLL_WORD_TEMPLATE_URL);
    if (!response.ok) {
      throw new Error(`Unable to load Word template: ${response.status} ${response.statusText}`);
    }

    const content = await response.arrayBuffer();
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    });

    doc.render(buildPayrollWordData(students, metadata));

    const blob = doc.getZip().generate({
      type: "blob",
      mimeType: DOCX_MIME_TYPE
    });
    downloadBlob(filename, blob);
  }

  async exportExcel(students, filename = "payroll.xlsx") {
    assertPayrollLimit(students);
    const { default: PizZip } = await import("https://cdn.jsdelivr.net/npm/pizzip@3.1.8/+esm");
    const response = await fetch(PAYROLL_EXCEL_TEMPLATE_URL);
    if (!response.ok) {
      throw new Error(`Unable to load Excel template: ${response.status} ${response.statusText}`);
    }

    const zip = new PizZip(await response.arrayBuffer());
    const sheetPath = "xl/worksheets/sheet1.xml";
    const sheet = zip.file(sheetPath);
    if (!sheet) {
      throw new Error("Payroll Excel template is missing the first worksheet.");
    }

    zip.file(sheetPath, fillPayrollExcelSheetXml(sheet.asText(), students));
    const blob = zip.generate({
      type: "blob",
      mimeType: XLSX_MIME_TYPE,
      compression: "DEFLATE"
    });
    downloadBlob(filename, blob);
  }
}
