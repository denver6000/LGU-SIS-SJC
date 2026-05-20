import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "../../../lib/firebase-admin";

const SESSION_COOKIE_NAME = "__session";
const SESSION_EXPIRES_IN = 1000 * 60 * 60 * 24 * 5;

function userFromDecodedToken(decodedToken: Awaited<ReturnType<ReturnType<typeof getAdminAuth>["verifySessionCookie"]>>) {
  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? "",
    name: decodedToken.name ?? decodedToken.email ?? "Signed In User",
    role: decodedToken.role ?? (decodedToken.admin ? "admin" : "user"),
    claims: {
      admin: decodedToken.admin === true,
      role: decodedToken.role ?? null
    }
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return NextResponse.json({ user: userFromDecodedToken(decodedToken) });
  } catch {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return NextResponse.json({ user: null }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const { idToken } = (await request.json()) as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ message: "Missing Firebase ID token." }, { status: 400 });
  }

  const adminAuth = getAdminAuth();
  const decodedIdToken = await adminAuth.verifyIdToken(idToken);
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN
  });
  const response = NextResponse.json({ user: userFromDecodedToken(decodedIdToken) });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRES_IN / 1000
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
