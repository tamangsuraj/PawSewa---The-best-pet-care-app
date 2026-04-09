'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { AlertCircle, Plus, Tag, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface PromoCode {
  _id: string;
  code: string;
  discountPercentage: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  expiryDate: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

const BRAND_BROWN = '#703418';

export default function PromocodesPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [code, setCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('10');
  const [minOrderAmount, setMinOrderAmount] = useState<string>('500');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState('');
  const [usageLimit, setUsageLimit] = useState<string>('100');
  const [submitting, setSubmitting] = useState(false);

  const loadPromos = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/promocodes');
      setPromos(resp.data?.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to load promocodes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const codeTrim = code.trim().toUpperCase();
    if (!codeTrim) {
      setFormError('Code name is required.');
      return;
    }
    const pct = parseFloat(discountPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setFormError('Discount % must be 0–100.');
      return;
    }
    const min = parseFloat(minOrderAmount);
    if (isNaN(min) || min < 0) {
      setFormError('Min order RS must be a positive number.');
      return;
    }
    const limit = parseInt(usageLimit, 10);
    if (isNaN(limit) || limit < 0) {
      setFormError('Usage limit must be ≥ 0.');
      return;
    }
    if (!expiryDate) {
      setFormError('Expiry date is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/promocodes', {
        code: codeTrim,
        discountPercentage: pct,
        minOrderAmount: min,
        maxDiscountAmount: maxDiscountAmount.trim() ? parseFloat(maxDiscountAmount) : undefined,
        expiryDate: new Date(expiryDate).toISOString(),
        usageLimit: limit,
      });
      setCode('');
      setDiscountPercentage('10');
      setMinOrderAmount('500');
      setMaxDiscountAmount('');
      setExpiryDate('');
      setUsageLimit('100');
      await loadPromos();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setFormError(e2.response?.data?.message || 'Failed to create promo code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/promocodes/${id}`, { isActive: !isActive });
      await loadPromos();
    } catch (err: unknown) {
      const e3 = err as { response?: { data?: { message?: string } } };
      setError(e3.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this promo code? This cannot be undone.')) return;
    try {
      await api.delete(`/promocodes/${id}`);
      await loadPromos();
    } catch (err: unknown) {
      const e4 = err as { response?: { data?: { message?: string } } };
      setError(e4.response?.data?.message || 'Failed to delete');
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Promocodes</h1>
        <p className="text-gray-600 mt-1">
          Create seasonal codes (e.g. PETLOVE20 for 20% off) and manage usage.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Create form – white card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5" style={{ color: BRAND_BROWN }} />
            Create new code
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{formError}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code name</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. PETLOVE20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min order (Rs)</label>
                <input
                  type="number"
                  min={0}
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max discount (Rs) – optional</label>
              <input
                type="number"
                min={0}
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="Cap discount amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage limit</label>
                <input
                  type="number"
                  min={0}
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: BRAND_BROWN }}
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">
            All codes
          </h2>
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
              <p className="mt-3 text-gray-600 text-sm">Loading…</p>
            </div>
          ) : promos.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No promocodes yet. Create one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Min Rs</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Used</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {promos.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{p.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.discountPercentage}%</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.minOrderAmount}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.usedCount} / {p.usageLimit}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(p.expiryDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeactivate(p._id, p.isActive)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 mr-2"
                          title={p.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {p.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          {p.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p._id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
