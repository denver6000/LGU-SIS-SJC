"use client";

import { collection, getDocs } from "firebase/firestore";
import { firebaseDb } from "./firebase-client";

export type Student = {
  student_id: string;
  full_name: string;
  school_address?: string;
  school_course?: string;
  year_level?: string;
  batch?: string;
  phone_number?: string;
  status?: string;
  claimed?: boolean;
  renewed?: boolean;
  payrolled?: boolean;
  created_at?: string;
  claimed_at?: string;
};

const COLLECTIONS = {
  students: "students",
  trash: "trash"
};

async function getCollectionRows<T>(collectionName: string) {
  const snapshot = await getDocs(collection(firebaseDb, collectionName));
  return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), _docId: docSnap.id })) as T[];
}

async function getSeedRows<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}.`);
  return response.json() as Promise<T[]>;
}

export async function getStudents() {
  try {
    const rows = await getCollectionRows<Student>(COLLECTIONS.students);
    return rows.length ? rows : getSeedRows<Student>("/data/student_data.seed.json");
  } catch {
    return getSeedRows<Student>("/data/student_data.seed.json");
  }
}

export async function getTrash() {
  try {
    const rows = await getCollectionRows<Student>(COLLECTIONS.trash);
    return rows.length ? rows : getSeedRows<Student>("/data/trash_data.seed.json");
  } catch {
    return getSeedRows<Student>("/data/trash_data.seed.json");
  }
}
