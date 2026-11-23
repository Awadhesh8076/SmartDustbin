import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Cpu,
  Laptop,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Coins,
  History,
  Clock,
  Sparkles
} from 'lucide-react';
import { useHardware } from '../context/HardwareContext';
import { useRewards } from '../context/RewardsContext';
import { api } from '../services/api';
import { WasteCategory, SortingHistoryItem, SortingStatsResponse } from '../types/api';

const CATEGORY_CONFIG: Record<
  WasteCategory,
  { angle: number; coins: number; color: string; bg: string; border: string; text: string; label: string }
> = {
  PLASTIC: {
    angle: 45,
    coins: 3,
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-950/40',
    border: 'border-blue-700/60',
    text: 'text-blue-400',
    label: 'Plastic (Chute 45°)',
  },
  METAL: {
    angle: 90,
    coins: 5,
    color: 'from-amber-500 to-yellow-500',
    bg: 'bg-amber-950/40',
    border: 'border-amber-700/60',
    text: 'text-amber-400',
    label: 'Metal (Chute 90°)',
  },
  WET: {
    angle: 135,
    coins: 1,
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-700/60',
    text: 'text-emerald-400',
    label: 'Wet / Organic (Chute 135°)',
  },
  DRY: {
    angle: 180,
    coins: 2,
    color: 'from-purple-500 to-pink-500',
    bg: 'bg-purple-950/40',
    border: 'border-purple-700/60',
    text: 'text-purple-400',
    label: 'Dry / Paper (Chute 180°)',
  },
  UNKNOWN: {
    angle: 0,
    coins: 0,
    color: 'from-slate-500 to-gray-500',
    bg: 'bg-slate-900',
    border: 'border-slate-700',
    text: 'text-slate-400',
    label: 'Unknown (Cannot Sort)',
  },
};

export const SortingPage: React.FC = () => {
  const { activeMode, deviceStatus } = useHardware();
  const { refreshBalance } = useRewards();
  const isSim = activeMode === 'SIMULATION';

  // State
  const [isSorting, setIsSorting] = useState<boolean>(false);
  const [currentCategory, setCurrentCategory] = useState<WasteCategory | null>(null);
  const [chuteAngle, setChuteAngle] = useState<number>(0);
  const [trapdoorAngle, setTrapdoorAngle] = useState<number>(0);
  const [stageText, setStageText] = useState<string>('Ready for sorting sequence');
  const [stageStep, setStageStep] = useState<number>(0); // 0=Idle, 1=Rotate Chute, 2=Trap Open, 3=Trap Close, 4=Reset Chute, 5=Success
  const [coinsCelebration, setCoinsCelebration] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // History & Stats
  const [history, setHistory] = useState<SortingHistoryItem[]>([]);
  const [stats, setStats] = useState<SortingStatsResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const loadHistoryAndStats = async () => {
    setIsLoadingHistory(true);
    try {
      const [histRes, statsRes] = await Promise.all([
        api.getSortingHistory(15, 0),
        api.getSortingStats(),
      ]);
      setHistory(histRes.items);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load sorting telemetry:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistoryAndStats();
  }, []);

  const triggerSort = async (cat: WasteCategory) => {
    if (isSorting) return;
    setIsSorting(true);
    setErrorMsg(null);
    setCoinsCelebration(null);
    setCurrentCategory(cat);

    const targetAngle = CATEGORY_CONFIG[cat].angle;

    try {
      // Step 1: PENDING / Chute Rotating (0ms -> 600ms)
      setStageStep(1);
      setStageText(`Rotating chute to ${cat} compartment (${targetAngle}°)...`);
      setChuteAngle(targetAngle);

      // Backend API call in background while visual animation runs
      const sortPromise = api.executeSorting(cat);

      // Animation Timeline mirroring ESP32 DevKit firmware:
      // Firmware: 600ms rotate chute -> 1200ms trapdoor 90° -> 500ms trapdoor 0° -> 400ms chute 0° (total 2700ms)
      await new Promise((r) => setTimeout(r, 650));

      // Step 2: Trapdoor Opening to 90° (Waste Falling)
      setStageStep(2);
      setTrapdoorAngle(90);
      setStageText(`Trapdoor open (90°) for 1.2s: Dropping ${cat} item...`);

      await new Promise((r) => setTimeout(r, 1200));

      // Step 3: Trapdoor Closing to 0°
      setStageStep(3);
      setTrapdoorAngle(0);
      setStageText('Trapdoor closed (0°). Returning chute to home...');

      await new Promise((r) => setTimeout(r, 500));

      // Step 4: Chute Returning to 0° Home
      setStageStep(4);
      setChuteAngle(0);
      setStageText('Resetting chute to 0° home position...');

      await new Promise((r) => setTimeout(r, 400));

      // Await backend response
      const result = await sortPromise;

      // Step 5: SUCCESS & REWARD
      setStageStep(5);
      setStageText(`Sorting complete! Awarded +${result.coins_earned} coins.`);
      setCoinsCelebration(result.coins_earned);

      // Refresh global coin balance in navbar and local records
      await refreshBalance();
      await loadHistoryAndStats();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Sorting execution failed';
      setErrorMsg(msg);
      setStageStep(0);
      setStageText(`Error: ${msg}`);
      setChuteAngle(0);
      setTrapdoorAngle(0);
    } finally {
      setIsSorting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Trash2 className="w-6 h-6 text-teal-400" />
            Sorting Simulation & Actuation Control
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Dual-servo physical execution: Chute rotation (0°–180°) and Trapdoor release flap (0°–90°).
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isSim ? (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 flex items-center gap-1.5 shadow-sm">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span>Simulated Servos Active</span>
            </span>
          ) : (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-950/50 border border-blue-700/60 text-blue-300 flex items-center gap-1.5 shadow-sm">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span>DevKit Hardware (GPIO 18 & 19)</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Interactive Actuator Simulation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 4-Compartment Virtual Dustbin Visualizer */}
        <div className="lg:col-span-8 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
          {/* Subtle Ambient Background */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-6">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-400" />
                Virtual Smart Dustbin Mechanism
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Cycle Timing: 2,700 ms
              </span>
            </div>

            {/* 4 Compartment Sector Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-8">
              {(['PLASTIC', 'METAL', 'WET', 'DRY'] as WasteCategory[]).map((cat) => {
                const conf = CATEGORY_CONFIG[cat];
                const isActive = currentCategory === cat && isSorting;
                return (
                  <div
                    key={cat}
                    className={`p-3.5 rounded-xl border transition-all duration-300 ${conf.bg} ${
                      isActive ? 'border-teal-400 shadow-lg scale-105' : conf.border
                    }`}
                  >
                    <div className={`text-xs font-bold ${conf.text}`}>{cat}</div>
                    <div className="text-lg font-mono font-bold text-white mt-0.5">{conf.angle}°</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">+{conf.coins} Coins</div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Dustbin Mechanism SVG Dial */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Outer Ring with Sector Labels */}
                <div className="absolute inset-0 rounded-full border-4 border-slate-700/60 flex items-center justify-center bg-slate-900/60 shadow-inner">
                  {/* Home Marker at 0° (Top) */}
                  <span className="absolute top-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Home (0°)
                  </span>
                  {/* Plastic at 45° */}
                  <span className="absolute top-10 right-4 text-[10px] font-bold text-blue-400">
                    PLASTIC 45°
                  </span>
                  {/* Metal at 90° (Right) */}
                  <span className="absolute right-2 text-[10px] font-bold text-amber-400">
                    METAL 90°
                  </span>
                  {/* Wet at 135° (Bottom Right) */}
                  <span className="absolute bottom-10 right-4 text-[10px] font-bold text-emerald-400">
                    WET 135°
                  </span>
                  {/* Dry at 180° (Bottom) */}
                  <span className="absolute bottom-1 text-[10px] font-bold text-purple-400">
                    DRY 180°
                  </span>
                </div>

                {/* Rotating Chute Pointer (Servo 1 - GPIO 18) */}
                <div
                  className="absolute w-full h-full flex items-center justify-center transition-transform duration-500 ease-out"
                  style={{ transform: `rotate(${chuteAngle}deg)` }}
                >
                  {/* Chute Needle */}
                  <div className="w-1.5 h-24 bg-gradient-to-t from-teal-400 to-emerald-300 rounded-full shadow-lg shadow-teal-500/50 -translate-y-12 relative">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-teal-300 rounded-full border-2 border-slate-900" />
                  </div>
                </div>

                {/* Central Trapdoor Flap Representation (Servo 2 - GPIO 19) */}
                <div className="relative z-10 w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-600 flex flex-col items-center justify-center shadow-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Chute</div>
                  <div className="text-xl font-bold font-mono text-white">{chuteAngle}°</div>
                  <div
                    className={`mt-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-300 ${
                      trapdoorAngle > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    Trap: {trapdoorAngle}°
                  </div>
                </div>
              </div>

              {/* Status Message Strip */}
              <div className="mt-6 text-center max-w-md">
                <div className="text-sm font-semibold text-white mb-1 flex items-center justify-center gap-2">
                  {isSorting ? (
                    <RotateCw className="w-4 h-4 text-teal-400 animate-spin" />
                  ) : stageStep === 5 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Compass className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{stageText}</span>
                </div>

                {coinsCelebration && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold animate-bounce">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+{coinsCelebration} Coins Credited to Eco Wallet!</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="border-t border-slate-700/60 pt-4">
            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className={`p-1.5 rounded ${stageStep >= 1 ? 'bg-teal-950/60 text-teal-300 font-bold' : 'text-slate-500'}`}>
                1. Rotate Chute
              </div>
              <div className={`p-1.5 rounded ${stageStep >= 2 ? 'bg-teal-950/60 text-teal-300 font-bold' : 'text-slate-500'}`}>
                2. Open Flap (1.2s)
              </div>
              <div className={`p-1.5 rounded ${stageStep >= 3 ? 'bg-teal-950/60 text-teal-300 font-bold' : 'text-slate-500'}`}>
                3. Close Flap
              </div>
              <div className={`p-1.5 rounded ${stageStep >= 4 ? 'bg-emerald-950/60 text-emerald-300 font-bold' : 'text-slate-500'}`}>
                4. Reset Home (0°)
              </div>
            </div>
          </div>
        </div>

        {/* Right: Manual Actuator Diagnostics & Trigger */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
            <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              Manual Sorting Diagnostics
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Execute test actuation cycles for any compartment. Validates servo angles and awards verified coins.
            </p>

            <div className="space-y-3">
              {(['PLASTIC', 'METAL', 'WET', 'DRY'] as WasteCategory[]).map((cat) => {
                const conf = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    disabled={isSorting}
                    onClick={() => triggerSort(cat)}
                    className={`w-full py-3 px-4 rounded-xl border transition-all flex items-center justify-between group ${
                      isSorting
                        ? 'opacity-50 cursor-not-allowed bg-slate-800/40 border-slate-700 text-slate-500'
                        : `${conf.bg} ${conf.border} hover:border-teal-400 hover:shadow-lg shadow-sm text-white`
                    }`}
                  >
                    <div className="text-left">
                      <div className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors">
                        Sort {cat}
                      </div>
                      <div className="text-[11px] text-slate-400">Angle: {conf.angle}°</div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/60 text-amber-300 text-xs font-bold font-mono">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>+{conf.coins}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hardware Pin Telemetry */}
            <div className="mt-6 pt-5 border-t border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Chute Servo:</span>
                <span className="font-mono text-slate-200">GPIO 18 (PWM 50Hz)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Trapdoor Servo:</span>
                <span className="font-mono text-slate-200">GPIO 19 (PWM 50Hz)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>DevKit Address:</span>
                <span className="font-mono text-slate-200">{deviceStatus?.esp32_devkit_ip || '192.168.4.20'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Execution Mode:</span>
                <span className="font-mono text-emerald-400 font-semibold">{activeMode}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Summary */}
          {stats && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Actuation Stats</h4>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-lg font-bold text-white font-mono">{stats.total_commands}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Total Sorts</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-lg font-bold text-emerald-400 font-mono">{stats.success_rate_percent}%</div>
                  <div className="text-[10px] text-slate-400 uppercase">Success Rate</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sorting History Records */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-white text-base">Actuation & Sorting History</h3>
          </div>
          <button
            onClick={loadHistoryAndStats}
            disabled={isLoadingHistory}
            className="px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No sorting operations logged yet. Run a test sort above to generate records.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/60">
                <tr>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Coins Awarded</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-slate-300">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.category === 'METAL'
                            ? 'bg-amber-400'
                            : item.category === 'PLASTIC'
                            ? 'bg-blue-400'
                            : item.category === 'WET'
                            ? 'bg-emerald-400'
                            : 'bg-purple-400'
                        }`}
                      />
                      <span>{item.category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 border border-emerald-700/50 text-emerald-300">
                        {item.result_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{item.mode}</td>
                    <td className="py-3 px-4 font-mono">{item.execution_duration_seconds}s</td>
                    <td className="py-3 px-4 font-bold text-amber-300">+{item.coins_awarded}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
