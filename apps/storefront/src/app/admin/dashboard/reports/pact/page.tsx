'use client';

import { useState } from 'react';
import { generatePactReport } from '@/lib/admin-api';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export default function PactReportsPage() {
  const [state, setState] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const response = await generatePactReport({
        state,
        periodStart,
        periodEnd,
      });

      if (response.success && response.data) {
        setResult(response.data);
      } else {
        setError(response.error?.message || 'Failed to generate report');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setLastMonth = () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

    setPeriodStart(lastMonth.toISOString().split('T')[0]);
    setPeriodEnd(lastDay.toISOString().split('T')[0]);
  };

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">PACT Act Reports</h1>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <select
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="periodStart" className="block text-sm font-medium text-gray-700 mb-1">
                Period Start
              </label>
              <input
                type="date"
                id="periodStart"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="periodEnd" className="block text-sm font-medium text-gray-700 mb-1">
                Period End
              </label>
              <input
                type="date"
                id="periodEnd"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <button type="button" onClick={setLastMonth} className="text-sm text-indigo-600 hover:text-indigo-900">
              Use Last Month
            </button>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !state || !periodStart || !periodEnd}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </form>

        {result && (
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Generated</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">State:</span>
                <span className="font-medium">{result.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Period:</span>
                <span>
                  {new Date(result.periodStart).toLocaleDateString()} - {new Date(result.periodEnd).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">File Key:</span>
                <span className="font-mono text-xs">{result.fileKey}</span>
              </div>
              {result.orderCount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Orders:</span>
                  <span>{result.orderCount}</span>
                </div>
              )}
              {result.rowCount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Rows:</span>
                  <span>{result.rowCount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Generated:</span>
                <span>{new Date(result.generatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

