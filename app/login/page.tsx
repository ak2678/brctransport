"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");

    const cleanMobile = mobile.replace(/\D/g, "");

    if (cleanMobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const phone = `+91${cleanMobile}`;

    const { error } = await supabase.auth.signInWithPassword({
      phone,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Invalid mobile number or password.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="auth">
      <div className="tabs">
        <b>Login</b>
        <Link href="/signup">Sign Up</Link>
      </div>

      <h1>Welcome back!</h1>

      <p className="muted">Login to your BRC account</p>

      <form onSubmit={handleLogin}>
        <div className="field">
          <label>MOBILE NUMBER</label>
          <input
            required
            inputMode="numeric"
            value={mobile}
            onChange={(e) =>
              setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="+91 10-digit mobile"
          />
        </div>

        <div className="field">
          <label>PASSWORD</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>

        <button
          className="btn"
          type="submit"
          disabled={loading}
          style={{ width: "100%", marginTop: 18 }}
        >
          {loading ? "Logging in..." : "Login →"}
        </button>
      </form>

      {error && (
        <p className="muted" style={{ color: "#dc2626", marginTop: 14 }}>
          {error}
        </p>
      )}

      <p className="muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" style={{ color: "#16a34a" }}>
          Sign Up Free
        </Link>
      </p>
    </main>
  );
}
