"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

export default function LoginForm({ nextPath }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  const inputClass =
    "w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-white/40";

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <main className="w-full max-w-md rounded-xl border border-white/25 bg-black p-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">Admin sign in</h1>
          <p className="mt-1 text-sm text-white/65">
            Sign in to manage artists, events, and site content.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-xs font-medium text-white/65"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium text-white/65"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {error ? <p className="text-sm text-white/90">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="cursor-pointer text-sm text-white underline underline-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 inline-block text-sm text-white/80 underline underline-offset-2"
        >
          Back to site
        </Link>
      </main>
    </div>
  );
}
