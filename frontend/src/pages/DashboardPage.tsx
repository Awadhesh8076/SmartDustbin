import React, { useState, useEffect } from 'react';
import { useHardware } from '../context/HardwareContext';
import { useRewards } from '../context/RewardsContext';
import {
  Recycle,
  Coins,
  Cpu,
  BrainCircuit,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  RotateCw,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { DashboardStatsResponse, RecentActivityItem } from '../types/api';

export const DashboardPage: React.FC = () => {
  const { deviceStatus, health } = useHardware();
  const { balance } = useRewards();

  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, actRes] = await Promise.all([
        api.getDashboardStats(),
        api.getRecentActivity(8),
      ]);
      setStats(statsRes);
      setActivities(actRes.activities);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Waste Classification & IoT Actuation Engine</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">SmartDustbin Control Center</h2>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Dual-microcontroller architecture: ESP32-CAM for waste image capture and ESP32 DevKit controlling dual servos (GPIO 18 Chute 0°–180°, GPIO 19 Trapdoor 0°–90°), powered by on-device 32-D Pearson TinyML learning.
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl bg-slate-700/60 border border-slate-600 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-2 self-start sm:self-center transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Operating Mode */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Mode</span>
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            Real Hardware
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ESP32 Hardware Linked</span>
          </div>
        </div>

        {/* Coin Balance */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Eco Coins Balance</span>
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mb-1 font-mono">{balance} Coins</div>
          <div className="text-xs text-slate-400">
            <span>+{stats?.total_coins_earned || 0} Earned • -{stats?.total_coins_spent || 0} Spent</span>
          </div>
        </div>

        {/* AI Waste Detection */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Scanned</span>
            <BrainCircuit className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1 font-mono">{stats?.total_detected || 0}</div>
          <div className="text-xs text-slate-400">
            <span>Model v{stats?.model_version || '1.0'} • Pearson r ≥ 0.70</span>
          </div>
        </div>

        {/* Total Sorted */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sorted</span>
            <Recycle className="w-5 h-5 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-teal-300 mb-1 font-mono">{stats?.total_sorted || 0}</div>
          <div className="text-xs text-slate-400">
            <span>{stats?.total_failed_sorts || 0} Failed • Dual-Servo Cycles</span>
          </div>
        </div>
      </div>

      {/* Compartment Sorting Counters */}
      {stats && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Verified Sorted Compartments
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total Learned Exemplars: {stats.total_learned_samples}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-700/50">
              <div className="text-xs font-bold text-blue-400">PLASTIC (45°)</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {stats.category_sorted_counts?.PLASTIC || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">+3 Coins / item</div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-700/50">
              <div className="text-xs font-bold text-amber-400">METAL (90°)</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {stats.category_sorted_counts?.METAL || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">+5 Coins / item</div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-700/50">
              <div className="text-xs font-bold text-emerald-400">WET (135°)</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {stats.category_sorted_counts?.WET || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">+1 Coin / item</div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-700/50">
              <div className="text-xs font-bold text-purple-400">DRY (180°)</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {stats.category_sorted_counts?.DRY || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">+2 Coins / item</div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Section: Telemetry Nodes & Live Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Device Telemetry Details */}
        <div className="lg:col-span-5 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Hardware & Backend Telemetry
          </h3>

          <div className="space-y-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 mb-1">FastAPI Engine</div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{health?.status === 'healthy' ? 'Online & Operational' : 'Connecting'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Database: SQLite ({health?.database || 'connected'})</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 mb-1">ESP32-CAM (Capture Node)</div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{deviceStatus?.cam_status || 'ONLINE'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">IP: {deviceStatus?.esp32_cam_ip || '192.168.4.10'} (Port 80)</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 mb-1">ESP32 DevKit (Sorter Node)</div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{deviceStatus?.devkit_status || 'ONLINE'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                IP: {deviceStatus?.esp32_devkit_ip || '192.168.4.20'} • GPIO 18 & 19
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Combined Activity Stream */}
        <div className="lg:col-span-7 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                Live System Activity Stream
              </h3>
              <span className="text-xs text-slate-400 font-mono">SQLite Stream</span>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No recent activity logged. Perform a scan or test sort to see live telemetry!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                          act.type === 'DETECTION'
                            ? 'bg-purple-950/60 text-purple-300 border border-purple-700/50'
                            : 'bg-teal-950/60 text-teal-300 border border-teal-700/50'
                        }`}
                      >
                        {act.type === 'DETECTION' ? 'AI' : 'SORT'}
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{act.category}</span>
                          <span className="text-[10px] font-normal text-slate-400">({act.status})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{act.detail}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <span>Synchronized with SQLite database</span>
            <Link to="/analytics" className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold">
              <span>View Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/detection"
          className="group bg-gradient-to-br from-slate-800 to-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 rounded-2xl p-5 transition-all shadow-md flex items-center justify-between"
        >
          <div>
            <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
              Start Waste Detection
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Classify waste with webcam, image upload, or ESP32-CAM trigger.
            </p>
          </div>
        </Link>

        <Link
          to="/sorting"
          className="group bg-gradient-to-br from-slate-800 to-slate-800/60 border border-slate-700/60 hover:border-teal-500/50 rounded-2xl p-5 transition-all shadow-md flex items-center justify-between"
        >
          <div>
            <h4 className="font-semibold text-white group-hover:text-teal-400 transition-colors flex items-center gap-2">
              Virtual Sorting Control
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Test chute angles (0°–180°) and 1.2s trapdoor flap mechanics.
            </p>
          </div>
        </Link>

        <Link
          to="/rewards"
          className="group bg-gradient-to-br from-slate-800 to-slate-800/60 border border-slate-700/60 hover:border-amber-500/50 rounded-2xl p-5 transition-all shadow-md flex items-center justify-between"
        >
          <div>
            <h4 className="font-semibold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2">
              Eco Rewards & Store
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Redeem earned coins for vouchers, drinks, and UPI cashback.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
};
