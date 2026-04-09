'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { UserPlus, RefreshCw, KeyRound, UserX, UserCheck } from 'lucide-react';

type PartnerRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
  isAccountActive?: boolean;
  createdAt?: string;
};

const ROLE_OPTIONS = [
  { value: 'shop_owner', label: 'Shop Owner' },
  { value: 'veterinarian', label: 'Vet' },
  { value: 'rider', label: 'Rider' },
  { value: 'petcare', label: 'Petcare (care service)' },
] as const;

function emailValid(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function PartnerManagementPage() {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('veterinarian');
  const [creating, setCreating] = useState(false);

  async function loadList() {
    try {
      setLoading(true);
      const resp = await api.get('/admin/partners', {
        params: search.trim() ? { search: search.trim() } : undefined,
      });
      setRows(resp.data?.data || []);
    } catch {
      setRows([]);
      setStatus('Could not load partners.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial table load only
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const n = name.trim();
    const em = email.trim();
    const pw = password;
    if (!n || !em || !pw || !role) {
      setStatus('Fill name, email, password, and role.');
      return;
    }
    if (!emailValid(em)) {
      setStatus('Invalid email format.');
      return;
    }
    if (pw.length < 8) {
      setStatus('Password must be at least 8 characters.');
      return;
    }
    try {
      setCreating(true);
      await api.post('/admin/partners', {
        name: n,
        email: em.toLowerCase(),
        password: pw,
        role,
      });
      setStatus('Partner account created.');
      setName('');
      setEmail('');
      setPassword('');
      await loadList();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setStatus(e?.response?.data?.message || 'Create failed.');
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async (id: string) => {
    const pw = window.prompt('New password (min 8 characters):');
    if (pw == null) return;
    if (pw.length < 8) {
      setStatus('Password must be at least 8 characters.');
      return;
    }
    setStatus(null);
    try {
      await api.patch(`/admin/partners/${id}/password`, { password: pw });
      setStatus('Password updated.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setStatus(e?.response?.data?.message || 'Reset failed.');
    }
  };

  const setActive = async (id: string, active: boolean) => {
    setStatus(null);
    try {
      await api.patch(`/admin/partners/${id}/active`, { isAccountActive: active });
      setStatus(active ? 'Account activated.' : 'Account deactivated.');
      await loadList();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setStatus(e?.response?.data?.message || 'Update failed.');
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
          <UserPlus className="w-8 h-8 text-primary" />
          Partner Management
        </h1>
        <p className="text-gray-600 max-w-3xl">
          Provision Shop Owner, Vet, Rider, and Petcare partner accounts. Partners sign in to PawSewa Partner with email and password.
        </p>
      </div>

      {status && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {status}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Create New Partner</h2>
          <form onSubmit={onCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Temporary password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-gray-500">Minimum 8 characters. Partner should change after first sign-in.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create partner account'}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Provisioned partners</h2>
            <button
              type="button"
              onClick={() => void loadList()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void loadList();
            }}
          >
            <input
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium">
              Search
            </button>
          </form>

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No partner accounts found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600">
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Role</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium">{r.name}</td>
                      <td className="py-2 pr-2">{r.email}</td>
                      <td className="py-2 pr-2">{r.role}</td>
                      <td className="py-2 pr-2">
                        {r.isAccountActive === false ? (
                          <span className="text-red-600">Deactivated</span>
                        ) : (
                          <span className="text-green-700">Active</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            title="Reset password"
                            onClick={() => resetPassword(r._id)}
                            className="inline-flex rounded border border-gray-200 p-1.5 hover:bg-gray-50"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          {r.isAccountActive !== false ? (
                            <button
                              type="button"
                              title="Deactivate"
                              onClick={() => {
                                if (window.confirm(`Deactivate ${r.email}?`)) setActive(r._id, false);
                              }}
                              className="inline-flex rounded border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Activate"
                              onClick={() => setActive(r._id, true)}
                              className="inline-flex rounded border border-green-200 p-1.5 text-green-700 hover:bg-green-50"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
