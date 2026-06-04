import { createStudent, listStudents, listStudentsPage } from "../../lib/server/repositories/students";
import { jsonError } from "../../lib/shared/http";
import { requireSessionUserForApi } from "../../lib/server/auth";
import type { StudentInput } from "../../lib/shared/student";

export async function GET(request: Request) {
  try {
    await requireSessionUserForApi();
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");

    if (limit || cursor) {
      const page = await listStudentsPage({
        limit: limit ? Number(limit) : undefined,
        cursor
      });
      return Response.json(page);
    }

    const students = await listStudents();
    return Response.json({ students });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUserForApi();
    const body = (await request.json()) as { student?: StudentInput };
    const student = await createStudent(body.student || {}, user);
    return Response.json({ student }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
