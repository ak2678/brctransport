"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Signup() {
  const [companyName, setCompanyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const cleanMobile = mobile.replace(/\D/g, "");

    if (cleanMobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (!companyName.trim()) {
      setError("Please enter your company name.");
      return;
    }

    setLoading(true);

    const phone = `+91${cleanMobile}`;

    const { data, error } = await supabase.auth.signUp({
      phone,
      password,
      options: {
        data: {
          company_name: companyName.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      window.location.href = "/";
      return;
    }

    setSuccess(
      "Account created successfully. You can now login to your BRC account."
    );
  }

  return (
    <main className="auth">
      <div className="tabs">
        <Link href="/login">Login</Link>
        <b>Sign Up</b>
      </div>

      <h1>Create your account</h1>
      <p className="muted">Create your BRC Transport account</p>

      <form onSubmit={handleSignup}>
        <div className="field">
          <label>COMPANY NAME</label>
          <input
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter company name"
          />
        </div>

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
            placeholder="Create password"
          />
        </div>

        <button
          className="btn"
          type="submit"
          disabled={loading}
          style={{ width: "100%", marginTop: 18 }}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      {error && (
        <p className="muted" style={{ color: "#dc2626", marginTop: 14 }}>
          {error}
        </p>
      )}

      {success && (
        <p className="muted" style={{ color: "#16a34a", marginTop: 14 }}>
          {success}
        </p>
      )}

      <p className="muted">
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#16a34a" }}>
          Login
        </Link>
      </p>
    </main>
  );
}
