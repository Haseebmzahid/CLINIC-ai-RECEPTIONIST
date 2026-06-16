"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { LockKeyhole, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

import { Button } from "../../components/ui/Button";
import { auth } from "../../lib/firebase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS !== "true") {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.replace(searchParams.get("next") || "/dashboard");
    } catch {
      setError("Sign-in failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form
        className="login-panel"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <div className="login-heading">
          <span className="brand-symbol">CA</span>
          <h1>Clinic AI Receptionist</h1>
        </div>
        <label className="field">
          <span>Email</span>
          <span className="input-wrap">
            <Mail aria-hidden="true" size={18} />
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </span>
        </label>
        <label className="field">
          <span>Password</span>
          <span className="input-wrap">
            <LockKeyhole aria-hidden="true" size={18} />
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </span>
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-status">Loading</main>}>
      <LoginForm />
    </Suspense>
  );
}
