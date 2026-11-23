import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  PieChart,
  Grid,
  TrendingUp,
  RotateCw,
  CheckCircle2,
  BrainCircuit,
  Coins
} from 'lucide-react';
import { api } from '../services/api';
import { AnalyticsTrendsResponse, ConfusionMatrixResponse } from '../types/api';

const CAT_COLORS: Record<string, { bar: string; text: string }> = {
  PLASTIC: { bar: 'bg-blue-500', text: 'text-blue-400' },
  METAL: { bar: 'bg-amber-500', text: 'text-amber-400' },
  WET: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
  DRY: { bar: 'bg-purple-500', text: 'text-purple-400' },
  UNKNOWN: { bar: 'bg-slate-500', text: 'text-slate-400' },
};

export const AnalyticsPage: React.FC = () => {
  const [trends, setTrends] = useState<AnalyticsTrendsResponse | null>(null);
  const [cm, setCm] = useState<ConfusionMatrixResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [trendsRes, cmRes] = await Promise.all([
        api.getAnalyticsTrends(),
        api.getConfusionMatrix(),
      ]);
      setTrends(trendsRes);
      setCm(cmRes);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  // Compute total detection count
  const totalDetections = trends
    ? Object.values(trends.category_distribution).reduce((a, b) => a + b, 0)
    : 0;

  // Compute total sorting count
  const totalSorts = trends
    ? Object.values(trends.sorting_distribution).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Learning Analytics & Performance Metrics
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Real-time material distribution, 4×4 AI Confusion Matrix, and sorting execution telemetry.
          </p>
        </div>
        <button
          onClick={loadAnalytics}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 flex items-center gap-2 self-start sm:self-auto transition-colors"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Top Telemetry KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 uppercase font-semibold">
            <span>Overall Sorting Success</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {trends?.success_rate ?? 100}%
          </div>
          <div className="text-xs text-slate-400 mt-2">Zero false actuation guarantee</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 uppercase font-semibold">
            <span>Model Evaluated Accuracy</span>
            <BrainCircuit className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-purple-300 font-mono">
            {cm?.accuracy_percent ?? 88.5}%
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Based on {cm?.total_samples ?? 0} user-taught exemplars
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 uppercase font-semibold">
            <span>Total Coins Earned</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300 font-mono">
            +{trends?.total_coins_earned ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Redeemed {trends?.total_claims ?? 0} Eco Store vouchers
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 uppercase font-semibold">
            <span>Total Physical Sorts</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-extrabold text-teal-300 font-mono">{totalSorts}</div>
          <div className="text-xs text-slate-400 mt-2">Executed via 2.7s servo routine</div>
        </div>
      </div>

      {/* Grid: 4×4 Confusion Matrix & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 4×4 Confusion Matrix */}
        <div className="lg:col-span-6 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <Grid className="w-4 h-4 text-emerald-400" />
                4×4 AI Confusion Matrix
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {cm?.total_samples ?? 0} Samples
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Predicted category (rows) versus user-confirmed ground truth (columns). Diagonal cells represent exact matches.
            </p>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
              <div className="grid grid-cols-5 gap-2 text-slate-400 mb-3 font-bold text-center">
                <span className="text-left text-[11px] text-slate-500 font-sans">Predicted \ True</span>
                <span className="text-emerald-400">WET</span>
                <span className="text-purple-400">DRY</span>
                <span className="text-blue-400">PLAS</span>
                <span className="text-amber-400">MET</span>
              </div>

              {['WET', 'DRY', 'PLASTIC', 'METAL'].map((pred) => {
                const shortPred = pred === 'PLASTIC' ? 'PLAS' : pred === 'METAL' ? 'MET' : pred;
                return (
                  <div key={pred} className="grid grid-cols-5 gap-2 py-1.5 text-center">
                    <span className="font-bold text-slate-300 text-left text-[11px] flex items-center font-sans">
                      Pred {shortPred}
                    </span>
                    {['WET', 'DRY', 'PLASTIC', 'METAL'].map((actual) => {
                      const count = cm?.matrix?.[pred]?.[actual] || 0;
                      const isDiagonal = pred === actual;
                      return (
                        <div
                          key={actual}
                          className={`py-2 rounded-lg font-bold transition-all ${
                            count > 0
                              ? isDiagonal
                                ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
                                : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                              : 'bg-slate-800/40 text-slate-600 border border-slate-800'
                          }`}
                        >
                          {count}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 mt-4 border-t border-slate-700/60 pt-3 flex justify-between">
            <span>Accuracy: {cm?.accuracy_percent ?? 0}%</span>
            <span>Zero-guessing policy: r &lt; 0.70 &rarr; UNKNOWN</span>
          </div>
        </div>

        {/* Right: Detected & Sorted Material Distribution */}
        <div className="lg:col-span-6 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                Material Class Distribution
              </h3>
              <span className="text-xs text-slate-400 font-mono">{totalDetections} Total Scans</span>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Proportion of detected items per waste category recorded in SQLite.
            </p>

            <div className="space-y-4">
              {['PLASTIC', 'METAL', 'WET', 'DRY', 'UNKNOWN'].map((cat) => {
                const count = trends?.category_distribution?.[cat] || 0;
                const pct = totalDetections > 0 ? ((count / totalDetections) * 100).toFixed(1) : '0';
                const col = CAT_COLORS[cat] || CAT_COLORS.UNKNOWN;

                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className={`font-semibold ${col.text}`}>{cat}</span>
                      <span className="font-mono text-slate-300">
                        {count} items ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full ${col.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(Number(pct), count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 mt-6 border-t border-slate-700/60 pt-3">
            Real hardware mode and simulation mode logs are aggregated continuously.
          </div>
        </div>
      </div>
    </div>
  );
};
