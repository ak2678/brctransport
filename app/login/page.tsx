"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setError("Invalid email or password.");
      return;
    }

    // Successful login → Dashboard
    window.location.href = "/dashboard";
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
          <label>EMAIL ADDRESS</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
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
        <p
          className="muted"
          style={{ color: "#dc2626", marginTop: 14 }}
        >
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
