'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { AlertCircle, MapPin, Plus, Trash2, Pencil } from 'lucide-react';
import ScrollableTableWrapper from '@/components/ui/ScrollableTableWrapper';

interface Zone {
  _id: string;
  name: string;
  districts: string[];
  vetCount?: number;
  isActive?: boolean;
  createdAt?: string;
}
export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [name, setName] = useState('');
  const [districtsText, setDistrictsText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadZones = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/zones');
      setZones(resp.data?.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDistrictsText('');
    setShowModal(true);
  };

  const openEdit = (zone: Zone) => {
    setEditing(zone);
    setName(zone.name);
    setDistrictsText((zone.districts || []).join(', '));
    setShowModal(true);
  };

  const parseDistricts = () =>
    districtsText
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const payload = { name: name.trim(), districts: parseDistricts() };
      if (editing) {
        await api.put(`/zones/${editing._id}`, payload);
      } else {
        await api.post('/zones', payload);
      }
      setShowModal(false);
      loadZones();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save zone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this zone? Vets mapped to it will need reassignment.')) return;
    try {
      await api.delete(`/zones/${id}`);
      loadZones();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete zone');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#5CB0CC]/10 rounded-xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-[#5CB0CC]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Zones</h1>
            <p className="text-gray-600 text-sm">Map districts to vets for automatic assignment</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5CB0CC] hover:bg-[#4a9bb5] text-white rounded-lg font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Zone
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-2 border-[#5CB0CC] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-500">Loading zones…</p>
          </div>
        ) : (
          <ScrollableTableWrapper>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Districts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vets</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {zones.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500 text-sm">
                      No zones configured yet
                    </td>
                  </tr>
                ) : (
                  zones.map((zone) => (
                    <tr key={zone._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{zone.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {(zone.districts || []).join(', ') || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{zone.vetCount ?? 0}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(zone)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(zone._id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTableWrapper>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editing ? 'Edit Zone' : 'Add Zone'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Bhaktapur"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Districts (comma-separated)
                </label>
                <input
                  type="text"
                  value={districtsText}
                  onChange={(e) => setDistrictsText(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Bhaktapur, Madhyapur Thimi"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-[#5CB0CC] text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
