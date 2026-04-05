'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { BellRing, CalendarDays, PhoneCall, CheckCircle2, RefreshCw } from 'lucide-react';

type ReminderCategory = 'vaccination' | 'deworming' | 'flea_tick' | 'checkup';
type ReminderStatus = 'upcoming' | 'completed' | 'skipped';

interface Reminder {
  _id: string;
  category: ReminderCategory;
  title: string;
  dueDate: string;
  status: ReminderStatus;
  called: boolean;
  priority?: 'low' | 'normal' | 'high';
}

interface ReminderRow {
  petId: string;
  pawId?: string;
  petName: string;
  species: string;
  ownerId: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  reminder: Reminder;
}

export default function RemindersPage() {
  const [tab, setTab] = useState<'today' | 'upcoming'>('today');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = tab === 'today' ? '/reminders/admin/today' : '/reminders/admin/upcoming';
      const resp = await api.get(endpoint, tab === 'upcoming' ? { params: { days } } : undefined);
      setRows(resp.data?.data || []);
    } catch (e) {
      setRows([]);
      setError('Failed to load reminders.');
      // eslint-disable-next-line no-console
      console.error('Error fetching reminders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, days]);

  const grouped = useMemo(() => {
    const byDate: Record<string, ReminderRow[]> = {};
    rows.forEach((r) => {
      const day = new Date(r.reminder.dueDate).toISOString().slice(0, 10);
      byDate[day] = byDate[day] || [];
      byDate[day].push(r);
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const patchReminder = async (petId: string, reminderId: string, body: any) => {
    await api.patch(`/reminders/pets/${petId}/${reminderId}`, body);
    await fetchRows();
  };

  return (
    <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                  <BellRing className="w-8 h-8 text-primary" />
                  Reminders Dashboard
                </h1>
                <p className="text-gray-600">
                  Track medical follow-ups due today and upcoming reminders for manual outreach.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchRows}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('today')}
                className={[
                  'px-4 py-2 rounded-xl border text-sm font-medium',
                  tab === 'today' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50',
                ].join(' ')}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setTab('upcoming')}
                className={[
                  'px-4 py-2 rounded-xl border text-sm font-medium',
                  tab === 'upcoming' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50',
                ].join(' ')}
              >
                Upcoming (7 days)
              </button>

              {tab === 'upcoming' && (
                <div className="ml-2 flex items-center gap-2 text-sm text-gray-700">
                  <CalendarDays className="w-4 h-4" />
                  <span>Days:</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={days}
                    onChange={(e) => setDays(Math.min(Math.max(Number(e.target.value) || 7, 1), 30))}
                    className="w-20 px-3 py-2 rounded-xl border border-gray-200 bg-white"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {loading ? 'Loading…' : `${rows.length} reminder(s)`}
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-sm text-gray-600">Loading reminders…</div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-sm text-gray-600">No reminders in this window.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {grouped.map(([day, items]) => (
                    <div key={day}>
                      <div className="px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-700">
                        Due date: {day}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="text-left text-gray-600">
                            <tr className="border-b border-gray-100">
                              <th className="px-6 py-3 font-medium">Pet</th>
                              <th className="px-6 py-3 font-medium">Owner</th>
                              <th className="px-6 py-3 font-medium">Reminder</th>
                              <th className="px-6 py-3 font-medium">Priority</th>
                              <th className="px-6 py-3 font-medium">Called</th>
                              <th className="px-6 py-3 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-900">
                            {items.map((r) => (
                              <tr key={`${r.petId}-${r.reminder._id}`} className="border-b border-gray-50">
                                <td className="px-6 py-4">
                                  <div className="font-semibold">{r.petName}</div>
                                  <div className="text-xs text-gray-600">
                                    {r.species}
                                    {r.pawId ? ` • ${r.pawId}` : ''}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-medium">{r.ownerName || 'Unknown'}</div>
                                  <div className="text-xs text-gray-600">
                                    {r.ownerPhone || r.ownerEmail || 'No contact'}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-medium">{r.reminder.title}</div>
                                  <div className="text-xs text-gray-600">{r.reminder.category}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={[
                                      'inline-flex px-2 py-1 rounded-lg text-xs font-semibold',
                                      r.reminder.priority === 'high'
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : r.reminder.priority === 'low'
                                          ? 'bg-gray-50 text-gray-700 border border-gray-200'
                                          : 'bg-blue-50 text-blue-700 border border-blue-200',
                                    ].join(' ')}
                                  >
                                    {r.reminder.priority || 'normal'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={[
                                      'inline-flex px-2 py-1 rounded-lg text-xs font-semibold border',
                                      r.reminder.called ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-200',
                                    ].join(' ')}
                                  >
                                    {r.reminder.called ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => patchReminder(r.petId, r.reminder._id, { called: !r.reminder.called })}
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50"
                                    >
                                      <PhoneCall className="w-4 h-4" />
                                      {r.reminder.called ? 'Unmark Called' : 'Mark Called'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => patchReminder(r.petId, r.reminder._id, { status: 'completed' })}
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white hover:opacity-90"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      Completed
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
    </>
  );
}

