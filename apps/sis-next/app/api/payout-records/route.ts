import { listPayoutRecords, savePayoutRecord } from "../../lib/server/repositories/payout-records";
import { requireSessionUserForApi } from "../../lib/server/auth";
import { jsonError } from "../../lib/shared/http";
import type { PayoutRecordInput } from "../../lib/shared/payout-record";

export async function GET() {
  try {
    await requireSessionUserForApi();
    const payoutRecords = await listPayoutRecords();
    return Response.json({ payoutRecords });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSessionUserForApi();
    const body = (await request.json()) as { payoutRecord?: PayoutRecordInput };
    const payoutRecord = await savePayoutRecord(body.payoutRecord || {});
    return Response.json({ payoutRecord }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
