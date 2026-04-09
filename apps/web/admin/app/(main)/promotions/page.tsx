'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { PawSewaPromoModal } from '@/components/PawSewaPromoModal';

type PromotionPayload = {
  id: string;
  title: string;
  description: string;
  promoCode: string;
  imageUrl: string;
  active: boolean;
  updatedAt?: string;
};

export default function PromotionsPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [active, setActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<PromotionPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await api.get<{ success: boolean; data?: PromotionPayload | null }>(
          '/promotions/active',
        );
        if (cancelled) return;
        const data = resp.data?.data ?? null;
        if (data && data.active) {
          setTitle(data.title || '');
          setDescription(data.description || '');
          setPromoCode(data.promoCode || '');
          setImageUrl(data.imageUrl || '');
          setActive(true);
          setLastSaved(data);
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => {
    const img = file ? URL.createObjectURL(file) : imageUrl;
    return {
      title: title.trim() || 'Limited time offer',
      offerText: promoCode.trim() ? '10% OFF' : 'New offer',
      subtitle: description.trim() || 'Valid for selected services',
      promoCode: promoCode.trim() || 'ESEWA10',
      imageSrc: img || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=80',
    };
  }, [title, description, promoCode, imageUrl, file]);

  const save = async () => {
    setErr('');
    setOk('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set('title', title.trim());
      fd.set('description', description.trim());
      fd.set('promoCode', promoCode.trim());
      fd.set('imageUrl', imageUrl.trim());
      fd.set('active', String(active));
      if (file) fd.set('image', file);

      const resp = await api.put<{ success: boolean; data?: PromotionPayload; message?: string }>(
        '/admin/promotions/active',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (resp.data?.success && resp.data.data) {
        setLastSaved(resp.data.data);
        setOk('Promotion saved.');
      } else {
        setErr(resp.data?.message || 'Failed to save promotion.');
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setErr(ax.response?.data?.message || ax.message || 'Failed to save promotion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <p className="text-gray-600 mt-1 max-w-2xl">
          Control the global PawSewa promo modal across mobile and web clients.
        </p>
      </div>

      {err ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          {err}
        </div>
      ) : null}
      {ok ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm">
          {ok}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Promo title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="New offer"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[96px]"
                placeholder="Short description shown under the offer"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Promo code</label>
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="ESEWA10"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Image URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Or upload image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Global toggle</p>
                <p className="text-xs text-gray-600">When off, no clients will show this modal.</p>
              </div>
              <button
                type="button"
                onClick={() => setActive((v) => !v)}
                className={`h-7 w-12 rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                aria-label="Toggle promotion"
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-white shadow translate-y-[2px] transition-transform ${active ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Latest saved</h2>
          {lastSaved ? (
            <div className="text-sm text-gray-700 space-y-1">
              <div><span className="text-gray-500">Title:</span> {lastSaved.title}</div>
              <div><span className="text-gray-500">Code:</span> {lastSaved.promoCode || '—'}</div>
              <div><span className="text-gray-500">Active:</span> {String(lastSaved.active)}</div>
              <div><span className="text-gray-500">Image:</span> {lastSaved.imageUrl ? 'Set' : '—'}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No promotion saved in this session.</p>
          )}
        </div>
      </div>

      <PawSewaPromoModal
        open={previewOpen}
        title={preview.title}
        offerText={preview.offerText}
        subtitle={preview.subtitle}
        promoCode={preview.promoCode}
        promoHint="Applies to pre-payment only"
        ctaText="Order now"
        imageSrc={preview.imageSrc}
        onClose={() => setPreviewOpen(false)}
        onCta={() => setPreviewOpen(false)}
      />
    </div>
  );
}

