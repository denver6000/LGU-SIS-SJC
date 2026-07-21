import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

const MAX_STUDENTS = 15;
const MARKER_ROW = 16;
const END_MARKER = 'X-X-X-X';
const EXCEL_START_ROW = 10;
const EXCEL_END_ROW = 24;
const DEFAULT_AMOUNT = 5000;

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function chunkStudents(students) {
    const chunks = [];
    for (let index = 0; index < students.length; index += MAX_STUDENTS) chunks.push(students.slice(index, index + MAX_STUDENTS));
    return chunks;
}

function formatLongDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatSemester(value) {
    const semester = Number.parseInt(value || '', 10);
    if (!Number.isFinite(semester)) return value || '';
    const suffix = semester === 1 ? 'st' : semester === 2 ? 'nd' : semester === 3 ? 'rd' : 'th';
    return `${semester}${suffix} SEMESTER`;
}

function buildWordData(students, metadata) {
    const data = {
        generated_at: new Date().toLocaleString(),
        date_of_filing: formatLongDate(metadata.date_of_filing),
        school_year: metadata.school_year || '',
        sem_number: formatSemester(metadata.sem_number),
        selected_count: students.length,
        students: students.map((student, index) => ({
            no: index + 1,
            student_id: student.student_id || '',
            full_name: student.full_name || '',
            student_number: student.student_number || '',
            barangay: student.barangay || '',
            address: student.address || '',
            phone_number: student.phone_number || '',
            school: student.school_address || '',
            school_address: student.school_address || '',
            course: student.school_course || '',
            school_course: student.school_course || '',
            year_level: student.year_level || '',
            batch: student.batch || '',
            status: student.status || '',
            renewed: student.renewed ? 'Yes' : 'No',
            claimed: student.claimed ? 'Yes' : 'No'
        }))
    };

    for (let row = 1; row <= MARKER_ROW; row += 1) {
        data[`student_${row}_fname`] = '';
        data[`student_${row}_name`] = '';
        data[`student_${row}_year_level`] = '';
        data[`student_${row}_school`] = '';
        data[`passed_${row}`] = '';
    }
    students.forEach((student, index) => {
        const row = index + 1;
        data[`student_${row}_fname`] = student.full_name || '';
        data[`student_${row}_name`] = student.full_name || '';
        data[`student_${row}_year_level`] = student.year_level || '';
        data[`student_${row}_school`] = student.school_address || '';
        data[`passed_${row}`] = 'PASSED';
    });
    const markerRow = Math.min(students.length + 1, MARKER_ROW);
    data[`student_${markerRow}_fname`] = END_MARKER;
    data[`student_${markerRow}_name`] = END_MARKER;
    return data;
}

function escapeXml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function replaceCellXml(sheetXml, address, value) {
    const pattern = new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
    const current = sheetXml.match(pattern)?.[0];
    if (!current) throw new Error(`Payroll Excel template is missing expected cell ${address}.`);
    const openingTag = current.slice(0, current.indexOf('>') + 1);
    const attrs = openingTag
        .replace(/^<c\b/, '')
        .replace(/\/?>$/, '')
        .replace(/\s+t="[^"]*"/g, '')
        .trim();
    const cellStart = attrs ? '<c ' + attrs : '<c';
    if (value === '') return sheetXml.replace(pattern, cellStart + '/>');
    if (typeof value === 'number') return sheetXml.replace(pattern, cellStart + '><v>' + value + '</v></c>');
    return sheetXml.replace(pattern, cellStart + ' t="inlineStr"><is><t xml:space="preserve">' + escapeXml(value) + '</t></is></c>');
}

async function buildWordBlob(students, metadata) {
    const response = await fetch('/templates/PAYROLL_WORD_TEMPLATE.docx', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load Word template: ${response.status}`);
    const doc = new Docxtemplater(new PizZip(await response.arrayBuffer()), { paragraphLoop: true, linebreaks: true });
    doc.render(buildWordData(students, metadata));
    return doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

async function buildExcelBlob(students, sheetNumber, totalSheets) {
    const response = await fetch('/templates/PAYROLL_TEMPLATE.xlsx', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load Excel template: ${response.status}`);
    const zip = new PizZip(await response.arrayBuffer());
    const sheet = zip.file('xl/worksheets/sheet1.xml');
    if (!sheet) throw new Error('Payroll Excel template is missing the first worksheet.');
    let xml = replaceCellXml(sheet.asText(), 'O3', `Sheet ${sheetNumber} of ${totalSheets} Sheets`);
    for (let row = EXCEL_START_ROW; row <= EXCEL_END_ROW + 1; row += 1) {
        xml = replaceCellXml(xml, `B${row}`, '');
        if (row <= EXCEL_END_ROW) {
            xml = replaceCellXml(xml, `E${row}`, '');
            xml = replaceCellXml(xml, `J${row}`, '');
        }
    }
    students.forEach((student, index) => {
        const row = EXCEL_START_ROW + index;
        xml = replaceCellXml(xml, `B${row}`, student.full_name || '');
        xml = replaceCellXml(xml, `E${row}`, DEFAULT_AMOUNT);
        xml = replaceCellXml(xml, `J${row}`, DEFAULT_AMOUNT);
    });
    xml = replaceCellXml(xml, `B${EXCEL_START_ROW + students.length}`, END_MARKER);
    xml = replaceCellXml(xml, 'J25', students.length * DEFAULT_AMOUNT);
    zip.file('xl/worksheets/sheet1.xml', xml);
    return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
}

async function exportPayrollFiles(students, metadata, filenamePrefix) {
    if (!students.length) throw new Error('Select at least one student before exporting payroll files.');
    const groups = chunkStudents(students);
    const archive = new PizZip();
    for (const [index, group] of groups.entries()) {
        const part = String(index + 1).padStart(2, '0');
        const [wordBlob, excelBlob] = await Promise.all([buildWordBlob(group, metadata), buildExcelBlob(group, index + 1, groups.length)]);
        archive.file(`${filenamePrefix}/group-${part}/${filenamePrefix}-group-${part}.docx`, await wordBlob.arrayBuffer());
        archive.file(`${filenamePrefix}/group-${part}/${filenamePrefix}-group-${part}.xlsx`, await excelBlob.arrayBuffer());
    }
    downloadBlob(`${filenamePrefix}-${groups.length}-groups.zip`, archive.generate({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' }));
    return groups.length;
}

document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-payroll-export]');
    if (!button) return;
    button.addEventListener('click', async () => {
        const selectedIds = new Set([...document.querySelectorAll('[data-payroll-student]:checked')].map((input) => input.value));
        const allRows = JSON.parse(document.querySelector('#payroll-export-data')?.textContent || '[]');
        const students = allRows.filter((student) => selectedIds.has(String(student.student_id)));
        const date = document.querySelector('[name="date_of_filing"]')?.value || '';
        if (!date) return alert('Fill in the Date Of Filing before creating payroll files.');
        if (!students.length) return alert('Select at least one student before creating payroll files.');
        button.disabled = true;
        button.textContent = 'Creating...';
        try {
            const cycle = document.querySelector('#payroll-export-data')?.dataset || {};
            await exportPayrollFiles(students, { date_of_filing: date, school_year: cycle.schoolYear, sem_number: cycle.semNumber }, `payroll-${new Date().toISOString().slice(0, 10)}`);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to create payroll files.');
        } finally {
            button.disabled = false;
            button.textContent = 'Create Payroll Files';
        }
    });
});
