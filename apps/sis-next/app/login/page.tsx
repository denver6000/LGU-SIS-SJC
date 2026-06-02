"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { GraduationCap, LockKeyhole, Mail } from "lucide-react";
import { firebaseAuth } from "../lib/firebase-client";
import { useAuth } from "../auth-provider";

const SIGNED_OUT_MESSAGE_KEY = "sis-next:signed-out-message";
const LOGIN_DRAFT_STORAGE_KEY = "sis-next:login-draft";

function loginErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "auth/network-request-failed"
  ) {
    return "Firebase Auth could not be reached. Check the internet connection, Firebase emulator, or project network access, then try again.";
  }

  return error instanceof Error ? error.message : "Sign in failed.";
}

export default function LoginPage() {
  const { refreshSession, user } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState(user ? "You are already signed in." : "Enter your Firebase account.");
  const [isBusy, setIsBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const signedOutMessage = window.sessionStorage.getItem(SIGNED_OUT_MESSAGE_KEY);
    if (!signedOutMessage) return;

    setMessage("Signed out successfully.");
    window.sessionStorage.removeItem(SIGNED_OUT_MESSAGE_KEY);
  }, []);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(LOGIN_DRAFT_STORAGE_KEY);
    if (!savedDraft) return;

    try {
      const draft = JSON.parse(savedDraft) as { email?: string; password?: string };
      if (typeof draft.email === "string") setEmail(draft.email);
      if (typeof draft.password === "string") setPassword(draft.password);
    } catch {
      window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      LOGIN_DRAFT_STORAGE_KEY,
      JSON.stringify({
        email,
        password
      })
    );
  }, [email, password]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setIsBusy(true);
    setMessage("Checking account...");

    try {
      const credentials = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
      const idToken = await credentials.user.getIdToken(true);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "The backend could not create a session.");
      }

      await refreshSession();
      setMessage("Signed in. Opening the application...");
      setEmail("");
      setPassword("");
      window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(loginErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="authTitle">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-brand">
            <div className="login-icon" aria-hidden="true">
              <GraduationCap size={30} />
            </div>
            <div>
              <p>San Jose LGU</p>
              <h1>Scholarship Management System</h1>
            </div>
          </div>

          <div>
            <h2 id="authTitle">Login</h2>
            <p className="login-subtitle">Enter your account details to continue.</p>
          </div>

          <div className="field-group">
            <label htmlFor="loginEmail">Email address</label>
            <div className="login-input">
              <Mail size={20} aria-hidden="true" />
              <input
                id="loginEmail"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
              />
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="loginPassword">Password</label>
            <div className="login-input">
              <LockKeyhole size={20} aria-hidden="true" />
              <input
                id="loginPassword"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
              />
            </div>
          </div>
          <p className="login-message" aria-live="polite">{message}</p>
          <div className="login-actions">
            <button type="submit" className="primary" disabled={isBusy}>
              {isBusy ? "Signing In..." : "Sign In"}
            </button>
            <Link href="/">
              Continue to App
            </Link>
          </div>
        </form>
      </section>

      {isBusy ? (
        <div className="modal-backdrop" role="presentation">
          <div className="auth-progress-dialog" role="dialog" aria-modal="true" aria-labelledby="login-progress-title">
            <div className="auth-progress-spinner" aria-hidden="true" />
            <div className="auth-progress-copy">
              <h2 id="login-progress-title">Signing you in</h2>
              <p>Please wait while we prepare your session.</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
