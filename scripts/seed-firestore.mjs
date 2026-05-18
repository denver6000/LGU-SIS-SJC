import { readFile } from "node:fs/promises";

const firebaseConfig = {
  apiKey: "AIzaSyBVKHZM21GXb-3ycPCcD9xGh6CclFVmGUQ",
  projectId: "lgus-sjc-scholarship"
};

const baseUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: firestoreFields(value) } };
  return { stringValue: String(value) };
}

function firestoreFields(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, firestoreValue(value)])
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

async function writeDocument(collectionName, documentId, record) {
  const url = `${baseUrl}/${collectionName}/${encodeURIComponent(documentId)}?key=${firebaseConfig.apiKey}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: firestoreFields(record) })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${collectionName}/${documentId}: ${response.status} ${body}`);
  }
}

async function seedCollection(collectionName, records, idField) {
  let count = 0;
  for (const record of records) {
    const id = record[idField] || crypto.randomUUID();
    await writeDocument(collectionName, id, { ...record, [idField]: id });
    count += 1;
  }
  return count;
}

const students = await readJson("../public/data/student_data.seed.json");
const trash = await readJson("../public/data/trash_data.seed.json");
const schoolCourses = await readJson("../public/data/schools_courses.seed.json");

const result = {
  students: await seedCollection("students", students, "student_id"),
  trash: await seedCollection("trash", trash, "student_id"),
  schoolCourses: await seedCollection("schoolCourses", schoolCourses, "id")
};

console.log(JSON.stringify(result, null, 2));
