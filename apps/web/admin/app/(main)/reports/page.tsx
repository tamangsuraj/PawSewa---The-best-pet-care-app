'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';

interface ReportData {
  dateRange: { from: string; to: string };
  revenue: number;
  orderCount: number;
  appointmentCount: number;
  subscriptionCount: number;
}
export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await api.get('/admin/reports/revenue', { params: { from, to } });
      setData(res.data?.data ?? null);
      if (!res.data?.data) setError('No report data returned for this date range.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to generate report. Check the date range and try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!reportRef.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf()
      .from(reportRef.current)
      .set({ margin: 10, filename: 'Pawsome_Revenue_Report.pdf' })
      .save();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Revenue Reports</h1>
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <label className="flex flex-col text-sm">
          From
          <input
            type="date"
            className="border rounded px-3 py-2 mt-1"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-sm">
          To
          <input
            type="date"
            className="border rounded px-3 py-2 mt-1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="bg-primary text-white px-4 py-2 rounded-lg h-10"
        >
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
        {data && (
          <button
            type="button"
            onClick={exportPdf}
            className="border border-primary text-primary px-4 py-2 rounded-lg h-10"
          >
            Export PDF
          </button>
        )}
      </div>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      )}
      {data && (
        <div
          ref={reportRef}
          className="bg-white border rounded-xl p-8 max-w-lg shadow-sm"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          <h2 className="text-xl font-bold mb-1">Pawsome Revenue Report</h2>
          <p className="text-gray-600 text-sm mb-6">
            {data.dateRange.from} — {data.dateRange.to}
          </p>
          <dl className="space-y-4">
            <div>
              <dt className="text-gray-500 text-sm">Total Revenue</dt>
              <dd className="text-2xl font-bold">NPR {data.revenue.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-sm">Total Orders</dt>
              <dd className="text-xl font-semibold">{data.orderCount}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-sm">Completed Appointments</dt>
              <dd className="text-xl font-semibold">{data.appointmentCount}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-sm">New Subscriptions</dt>
              <dd className="text-xl font-semibold">{data.subscriptionCount}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
