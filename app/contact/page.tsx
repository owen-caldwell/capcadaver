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
    "w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/40";
  const labelClass = "mb-1 block text-xs font-medium text-white/65";

  return (
    <div className="flex min-h-screen flex-col items-center bg-black p-6 font-sans text-white">
      <main className="w-full max-w-xl">
        <Link
          href="/"
          className="mb-8 inline-block cursor-pointer text-sm text-white/75 underline underline-offset-2"
        >
          ← Back
        </Link>

        <div className="rounded-xl border border-white/25 bg-black shadow-none">
          <div className="border-b border-white/20 px-6 py-4">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Contact
            </h1>
            <p className="mt-0.5 text-sm text-white/65">
              Send a message and we’ll get back to you.
            </p>
          </div>

          <div className="p-6">
            {submitted ? (
              <p className="rounded-lg border border-white/20 bg-white/5 py-6 text-center text-sm text-white/85">
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
                  className="cursor-pointer text-sm text-white underline underline-offset-2"
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
