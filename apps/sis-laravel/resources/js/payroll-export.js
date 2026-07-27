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
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to start reading the object URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chunkStudents(students) {
    const chunks = [];
    for (let index = 0; index < students.length; index += MAX_STUDENTS) chunks.push(students.slice(index, index + MAX_STUDENTS));
    return chunks;
}

const sortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function batchLabel(student) {
    return String(student.batch ?? '').trim() || 'Unassigned batch';
}

function sortStudents(students) {
    return [...students].sort((left, right) => {
        const leftBatch = String(left.batch ?? '').trim();
        const rightBatch = String(right.batch ?? '').trim();
        if (!leftBatch && rightBatch) return 1;
        if (leftBatch && !rightBatch) return -1;

        const batchOrder = sortCollator.compare(leftBatch, rightBatch);
        if (batchOrder !== 0) return batchOrder;

        const nameOrder = sortCollator.compare(String(left.full_name ?? '').trim(), String(right.full_name ?? '').trim());
        if (nameOrder !== 0) return nameOrder;

        return sortCollator.compare(String(left.student_id ?? ''), String(right.student_id ?? ''));
    });
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
        selected_count: metadata.total_count ?? students.length,
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

async function loadTemplate(url, label) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load ${label} template: ${response.status}`);
    return response.arrayBuffer();
}

function documentBodyContent(documentXml) {
    const bodyStart = documentXml.indexOf('<w:body>');
    const bodyEnd = documentXml.lastIndexOf('</w:body>');
    if (bodyStart < 0 || bodyEnd < 0) throw new Error('Word template has no document body.');
    const body = documentXml.slice(bodyStart + '<w:body>'.length, bodyEnd);
    const sectionStart = body.lastIndexOf('<w:sectPr');
    return { content: sectionStart >= 0 ? body.slice(0, sectionStart) : body, section: sectionStart >= 0 ? body.slice(sectionStart) : '' };
}

function mergeWordDocuments(documentXmls) {
    if (!documentXmls.length) throw new Error('No Word document groups were generated.');
    const first = documentXmls[0];
    const firstBodyStart = first.indexOf('<w:body>');
    const firstBodyEnd = first.lastIndexOf('</w:body>');
    const sections = documentBodyContent(first);
    const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    const content = documentXmls.map((xml) => documentBodyContent(xml).content).join(pageBreak);
    return first.slice(0, firstBodyStart + '<w:body>'.length)
        + content
        + sections.section
        + '</w:body>'
        + first.slice(firstBodyEnd + '</w:body>'.length);
}

function buildWordDocumentXml(students, metadata, templateBuffer) {
    const doc = new Docxtemplater(new PizZip(templateBuffer), { paragraphLoop: true, linebreaks: true });
    doc.render(buildWordData(students, metadata));
    return doc.getZip().file('word/document.xml').asText();
}

function worksheetName(batch, part, usedNames) {
    const cleaned = String(batch || 'Unassigned batch').replace(/[:\\/?*\[\]]/g, '-').trim() || 'Unassigned batch';
    const base = `${cleaned} - Part ${String(part).padStart(2, '0')}`.slice(0, 31);
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) {
        const ending = `-${suffix++}`;
        name = `${base.slice(0, 31 - ending.length)}${ending}`;
    }
    usedNames.add(name);
    return name;
}

function buildExcelSheetXml(templateXml, students, sheetNumber, totalSheets) {
    let xml = replaceCellXml(templateXml, 'O3', `Sheet ${sheetNumber} of ${totalSheets} Sheets`);
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
    return replaceCellXml(xml, 'J25', students.length * DEFAULT_AMOUNT);
}

function buildExcelWorkbookBlob(groups, metadata, templateBuffer) {
    const zip = new PizZip(templateBuffer);
    const sheet = zip.file('xl/worksheets/sheet1.xml');
    if (!sheet) throw new Error('Payroll Excel template is missing the first worksheet.');

    const usedNames = new Set();
    const totalSheets = groups.length;
    const sheets = groups.map((group, index) => ({
        name: worksheetName(batchLabel(group[0]), index + 1, usedNames),
        xml: buildExcelSheetXml(sheet.asText(), group, index + 1, totalSheets),
    }));
    sheets.forEach((item, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, item.xml));

    const workbook = zip.file('xl/workbook.xml');
    const relationships = zip.file('xl/_rels/workbook.xml.rels');
    const contentTypes = zip.file('[Content_Types].xml');
    if (!workbook || !relationships || !contentTypes) throw new Error('Payroll Excel template is missing workbook metadata.');

    const workbookXml = workbook.asText().replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets>${sheets.map((item, index) => `<sheet name="${escapeXml(item.name)}" sheetId="${index + 1}" r:id="rId${index === 0 ? 1 : index + 4}"/>`).join('')}</sheets>`);
    const relXml = relationships.asText().replace('</Relationships>', `${sheets.slice(1).map((_, index) => `<Relationship Id="rId${index + 5}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 2}.xml"/>`).join('')}</Relationships>`);
    const typeXml = contentTypes.asText().replace('</Types>', `${sheets.slice(1).map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 2}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
    zip.file('xl/workbook.xml', workbookXml);
    zip.file('xl/_rels/workbook.xml.rels', relXml);
    zip.file('[Content_Types].xml', typeXml);

    return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
}

async function exportPayrollFiles(students, metadata, filenamePrefix) {
    if (!students.length) throw new Error('Select at least one student before exporting payroll files.');
    const sortedStudents = sortStudents(students);
    const groups = chunkStudents(sortedStudents);
    const [wordTemplate, excelTemplate] = await Promise.all([
        loadTemplate('/templates/PAYROLL_WORD_TEMPLATE.docx', 'Word'),
        loadTemplate('/templates/PAYROLL_TEMPLATE.xlsx', 'Excel'),
    ]);
    const wordXmlGroups = groups.map((group) => buildWordDocumentXml(group, { ...metadata, total_count: sortedStudents.length }, wordTemplate));
    const wordZip = new PizZip(wordTemplate);
    wordZip.file('word/document.xml', mergeWordDocuments(wordXmlGroups));
    const wordBlob = wordZip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
    const excelBlob = buildExcelWorkbookBlob(groups, metadata, excelTemplate);
    const archive = new PizZip();
    archive.file(`${filenamePrefix}/${filenamePrefix}.docx`, await wordBlob.arrayBuffer());
    archive.file(`${filenamePrefix}/${filenamePrefix}.xlsx`, await excelBlob.arrayBuffer());
    downloadBlob(`${filenamePrefix}.zip`, archive.generate({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' }));
    return { groups: groups.length, students: sortedStudents };
}

export { chunkStudents, sortStudents, buildWordDocumentXml, mergeWordDocuments, buildExcelWorkbookBlob };

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    const selectAllButtons = [...document.querySelectorAll('[data-payroll-select-all]')];
    const studentCheckboxes = [...document.querySelectorAll('[data-payroll-student]')];
    const allRows = JSON.parse(document.querySelector('#payroll-export-data')?.textContent || '[]');
    const summary = document.querySelector('[data-payroll-export-summary]');
    const selectedStudents = () => {
        const selectedIds = new Set(studentCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => String(checkbox.value)));
        return sortStudents(allRows.filter((student) => selectedIds.has(String(student.student_cycle_id))));
    };
    const updateExportSummary = () => {
        if (!summary) return;
        const selected = selectedStudents();
        summary.textContent = `Selected students: ${selected.length} · Excel sheets: ${Math.ceil(selected.length / MAX_STUDENTS)} · Order: batch, then name`;
    };
    if (selectAllButtons.length) {
        const syncSelectAllButton = () => {
            const allSelected = studentCheckboxes.length > 0 && studentCheckboxes.every((checkbox) => checkbox.checked);
            selectAllButtons.forEach((button) => {
                button.textContent = allSelected ? 'Deselect all' : 'Select all';
                button.setAttribute('aria-pressed', allSelected ? 'true' : 'false');
            });
        };
        selectAllButtons.forEach((button) => button.addEventListener('click', () => {
            const shouldSelect = !studentCheckboxes.length || !studentCheckboxes.every((checkbox) => checkbox.checked);
            studentCheckboxes.forEach((checkbox) => { checkbox.checked = shouldSelect; });
            syncSelectAllButton();
            updateExportSummary();
        }));
        studentCheckboxes.forEach((checkbox) => checkbox.addEventListener('change', () => {
            syncSelectAllButton();
            updateExportSummary();
        }));
        syncSelectAllButton();
        updateExportSummary();
    }

    const button = document.querySelector('[data-payroll-export]');
    if (!button) return;
    button.addEventListener('click', async () => {
        const students = selectedStudents();
        const checkedCount = studentCheckboxes.filter((checkbox) => checkbox.checked).length;
        const date = document.querySelector('[name="date_of_filing"]')?.value?.trim() || '';
        const semester = document.querySelector('[name="export_semester"]')?.value?.trim() || '';
        if (!date) return alert('Fill in the Date Of Filing before creating payroll files.');
        if (!semester) return alert('Type the semester for the export before creating payroll files.');
        if (!students.length) return alert('Select at least one student before creating payroll files.');
        if (students.length !== checkedCount) return alert('The selected payroll rows no longer match the export data. Refresh the page and try again.');
        const groups = chunkStudents(students);
        const batchOrder = [...new Set(students.map(batchLabel))].join(', ');
        const firstRows = students.slice(0, 5).map((student) => `${batchLabel(student)} — ${student.full_name || student.student_id}`).join('\n');
        if (!window.confirm(`Export ${students.length} student(s) as 1 Word document and 1 Excel workbook with ${groups.length} worksheet(s)?\n\nSorted batches: ${batchOrder}\n\nFirst students in final order:\n${firstRows}`)) return;
        button.disabled = true;
        button.textContent = 'Creating...';
        try {
            const cycle = document.querySelector('#payroll-export-data')?.dataset || {};
            await exportPayrollFiles(students, { date_of_filing: date, school_year: cycle.schoolYear, sem_number: semester }, `payroll-${new Date().toISOString().slice(0, 10)}`);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to create payroll files.');
        } finally {
            button.disabled = false;
            button.textContent = 'Create Payroll Files';
        }
    });
});
