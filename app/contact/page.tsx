"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setName("");
    setEmail("");
    setMessage("");
  };

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500";
  const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-6 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-xl">
        <Link
          href="/"
          className="mb-8 inline-block cursor-pointer text-sm text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
        >
          ← Back
        </Link>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Contact
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Send a message and we’ll get back to you.
            </p>
          </div>

          <div className="p-6">
            {submitted ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 py-6 text-center text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
                Thanks for your message. We’ll be in touch.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className={labelClass}>
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className={labelClass}>
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className={inputClass}
                    placeholder="Your message..."
                  />
                </div>
                <button
                  type="submit"
                  className="cursor-pointer text-sm underline underline-offset-2"
                >
                  Send
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
