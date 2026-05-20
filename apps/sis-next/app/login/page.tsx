"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../lib/firebase-client";
import { useAuth } from "../auth-provider";

export default function LoginPage() {
  const { refreshSession, user } = useAuth();
  const [message, setMessage] = useState(user ? "You are already signed in." : "Enter your Firebase account.");
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    if (!email || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setIsBusy(true);
    setMessage("Checking account...");

    try {
      const credentials = await signInWithEmailAndPassword(firebaseAuth, email, password);
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
      setMessage("Signed in. Continue when you are ready.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="auth-view" aria-labelledby="authTitle">
        <div className="brand auth-brand">
          <div className="brand-mark">SJ</div>
          <div>
            <p>San Jose City Educational Assistance</p>
            <h1>Student Information System</h1>
          </div>
        </div>

        <form className="auth-panel" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Secure Access</p>
            <h2 id="authTitle">Sign In</h2>
          </div>
          <div className="field-group">
            <label htmlFor="loginEmail">Email</label>
            <input id="loginEmail" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field-group">
            <label htmlFor="loginPassword">Password</label>
            <input id="loginPassword" name="password" type="password" autoComplete="current-password" required />
          </div>
          <p className="auth-note">The backend creates an HttpOnly Firebase session after your client sign-in succeeds.</p>
          <p className="auth-message" aria-live="polite">{message}</p>
          <div className="actions auth-actions">
            <button type="submit" className="primary" disabled={isBusy}>
              {isBusy ? "Signing In..." : "Sign In"}
            </button>
            <Link className="auth-link-button" href="/">
              Continue to App
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
