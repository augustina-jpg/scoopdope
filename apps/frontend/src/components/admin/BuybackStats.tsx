'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface BuybackStats {
  count: number;
  totalBstBought: number;
  totalXlmSpent: number;
  reserveBalance: number;
  config: {
    enabled: boolean;
    minReserve: number;
    maxSpendPerBuyback: number;
    intervalLedgers: number;
    revenueThreshold: number;
  };
}

interface BuybackRecord {
  ledger: number;
  timestamp: number;
  xlmSpent: number;
  bstBought: number;
  trigger: string;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
    </div>
  );
}

export function BuybackStats() {
  const [stats, setStats] = useState<BuybackStats | null>(null);
  const [history, setHistory] = useState<BuybackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/v1/buyback/stats'),
      api.get('/v1/buyback/history?limit=10'),
    ])
      .then(([s, h]) => {
        setStats(s.data);
        setHistory(h.data ?? []);
      })
      .catch(() => {
        // Mock data when API unavailable
        setStats({
          count: 12,
          totalBstBought: 600_000,
          totalXlmSpent: 12_000,
          reserveBalance: 45_000,
          config: {
            enabled: true,
            minReserve: 10_000,
            maxSpendPerBuyback: 1_000,
            intervalLedgers: 17_280,
            revenueThreshold: 5_000,
          },
        });
        setHistory([
          { ledger: 1234567, timestamp: Date.now() / 1000 - 86400, xlmSpent: 1000, bstBought: 50000, trigger: 'auto' },
          { ledger: 1217287, timestamp: Date.now() / 1000 - 172800, xlmSpent: 800, bstBought: 40000, trigger: 'manual' },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Config status */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            stats?.config.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {stats?.config.enabled ? '● Auto-buyback ON' : '○ Auto-buyback OFF'}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Threshold: {stats?.config.revenueThreshold?.toLocaleString()} XLM &nbsp;|&nbsp;
          Interval: {stats?.config.intervalLedgers?.toLocaleString()} ledgers
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Buybacks" value={String(stats?.count ?? 0)} />
        <StatCard label="BST Bought & Burned" value={(stats?.totalBstBought ?? 0).toLocaleString()} />
        <StatCard label="XLM Spent" value={(stats?.totalXlmSpent ?? 0).toLocaleString()} />
        <StatCard label="Reserve Balance (XLM)" value={(stats?.reserveBalance ?? 0).toLocaleString()} />
      </div>

      {/* Reserve bar */}
      {stats && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Reserve utilisation</span>
            <span>
              {stats.reserveBalance.toLocaleString()} / {(stats.reserveBalance + stats.totalXlmSpent).toLocaleString()} XLM
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{
                width: `${
                  stats.reserveBalance + stats.totalXlmSpent > 0
                    ? (stats.reserveBalance / (stats.reserveBalance + stats.totalXlmSpent)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* History table */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent Buybacks</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <tr>
                {['Ledger', 'Date', 'XLM Spent', 'BST Bought', 'Trigger'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No buybacks yet.</td>
                </tr>
              ) : (
                history.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.ledger}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(r.timestamp * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{r.xlmSpent.toLocaleString()}</td>
                    <td className="px-4 py-3 text-green-600 dark:text-green-400">{r.bstBought.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.trigger === 'auto'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}
                      >
                        {r.trigger}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
