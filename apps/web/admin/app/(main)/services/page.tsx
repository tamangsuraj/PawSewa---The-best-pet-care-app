'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import ScrollableTableWrapper from '@/components/ui/ScrollableTableWrapper';

interface ServiceRow {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  duration?: number;
  isActive: boolean;
}
export default function ServicesPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'home_visit',
    duration: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/services', { params: { includeInactive: 'true' } });
      setRows(res.data?.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', category: 'home_visit', duration: '' });
    setModal(true);
  };

  const openEdit = (s: ServiceRow) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || '',
      price: String(s.price),
      category: s.category,
      duration: s.duration != null ? String(s.duration) : '',
    });
    setModal(true);
  };

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category: form.category,
      duration: form.duration ? Number(form.duration) : undefined,
    };
    if (editing) await api.put(`/services/${editing._id}`, payload);
    else await api.post('/services', payload);
    setModal(false);
    load();
  };

  const toggle = async (id: string) => {
    await api.patch(`/services/${id}/toggle`);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Service Catalogue</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ScrollableTableWrapper>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Price (NPR)</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s._id} className="border-b">
                  <td className="py-3 pr-4 font-medium">{s.name}</td>
                  <td className="py-3 pr-4">{s.category}</td>
                  <td className="py-3 pr-4">{s.price}</td>
                  <td className="py-3 pr-4">{s.duration ?? '—'} min</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        s.isActive ? 'text-green-700 font-medium' : 'text-red-600 font-medium'
                      }
                    >
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 flex gap-2">
                    <button type="button" onClick={() => openEdit(s)} aria-label="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => toggle(s._id)} aria-label="Toggle">
                      {s.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTableWrapper>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            className="bg-white rounded-xl p-6 w-full max-w-md space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <h2 className="text-lg font-bold">{editing ? 'Edit' : 'Add'} Service</h2>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <textarea
              className="w-full border rounded px-3 py-2"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              placeholder="Price NPR"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
            <select
              className="w-full border rounded px-3 py-2"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="home_visit">Home visit</option>
              <option value="vaccination">Vaccination</option>
              <option value="grooming">Grooming</option>
              <option value="consultation">Consultation</option>
              <option value="other">Other</option>
            </select>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              placeholder="Duration (minutes)"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2">
                Cancel
              </button>
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
