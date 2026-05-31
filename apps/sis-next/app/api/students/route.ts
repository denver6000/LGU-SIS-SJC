import { createStudent, listStudents } from "../../lib/server/repositories/students";
import { jsonError } from "../../lib/shared/http";
import { requireAdminForApi, requireSessionUserForApi } from "../../lib/server/auth";
import type { StudentInput } from "../../lib/shared/student";

export async function GET() {
  try {
    await requireSessionUserForApi();
    const students = await listStudents();
    return Response.json({ students });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminForApi();
    const body = (await request.json()) as { student?: StudentInput };
    const student = await createStudent(body.student || {});
    return Response.json({ student }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
