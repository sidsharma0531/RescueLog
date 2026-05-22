'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api-client';
import Logo from '@/components/Logo';

const FIELDS = [
  {
    key: 'org_name',
    label: 'Organization name',
    type: 'text',
    required: true,
    placeholder: 'e.g. Second Servings Houston',
  },
  {
    key: 'contact_name',
    label: 'Contact name',
    type: 'text',
    required: true,
    placeholder: 'Your name',
  },
  {
    key: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    placeholder: 'you@organization.org',
  },
  {
    key: 'phone',
    label: 'Phone',
    type: 'tel',
    required: false,
    placeholder: '(555) 123-4567',
  },
];

export default function OnboardPage() {
  const [form, setForm] = useState({
    org_name: '',
    contact_name: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiPost('/api/onboard', form);
      setDone(true);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-rescue-green-light px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-3 text-2xl font-bold text-rescue-ink">
            Get started with RescueLog
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered food rescue tracking for your organization
          </p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rescue-green">
              <span className="text-2xl font-bold text-white">✓</span>
            </div>
            <p className="mt-4 text-base font-semibold text-rescue-ink">
              Thanks! We&apos;ll set up your account within 24 hours.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              We&apos;ll reach out by email with your organization&apos;s login
              details.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="mb-4 text-sm text-gray-600">
              Tell us about your food rescue organization and we&apos;ll get you
              set up.
            </p>

            {FIELDS.map((f) => (
              <div key={f.key} className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {f.label}
                  {!f.required && (
                    <span className="text-gray-400"> (optional)</span>
                  )}
                </label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => {
                    const { value } = e.target;
                    setForm((s) => ({ ...s, [f.key]: value }));
                    setError('');
                  }}
                  required={f.required}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rescue-green focus:ring-1 focus:ring-rescue-green"
                />
              </div>
            ))}

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-rescue-green py-2.5 text-sm font-semibold text-white transition hover:bg-rescue-green-dark disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Request access'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Built for food rescue organizations
        </p>
      </div>
    </main>
  );
}
