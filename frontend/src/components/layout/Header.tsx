import React, { useState } from 'react';
import { useHardware } from '../../context/HardwareContext';
import { useRewards } from '../../context/RewardsContext';
import { Coins, Cpu, Laptop, RefreshCw, CheckCircle2, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { activeMode, switchMode, health, isLoading, refreshStatus } = useHardware();
  const { balance } = useRewards();
  const [showModeModal, setShowModeModal] = useState<boolean>(false);

  const isSim = activeMode === 'SIMULATION';

  return (
    <header className="h-16 bg-slate-800/80 backdrop-blur border-b border-slate-700/60 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Mobile Toggle & Status */}
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white md:hidden"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center space-x-2">
          <span className={`w-2.5 h-2.5 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs font-medium text-slate-300 hidden sm:inline">
            {health?.status === 'healthy' ? 'FastAPI Core Online' : 'Connecting to Core...'}
          </span>
        </div>
        <button
          onClick={() => refreshStatus()}
          title="Refresh hardware status"
          className="text-slate-400 hover:text-slate-200 transition-colors p-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Right: Controls & Badges */}
      <div className="flex items-center space-x-4">
        {/* Mode Selector Pill */}
        <button
          onClick={() => setShowModeModal(true)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            isSim
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
              : 'bg-blue-950/60 text-blue-300 border-blue-700/60 hover:bg-blue-900/60'
          }`}
        >
          {isSim ? (
            <>
              <Laptop className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulation Mode</span>
            </>
          ) : (
            <>
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>Real Hardware Mode</span>
            </>
          )}
        </button>

        {/* Coin Balance Badge */}
        <div className="flex items-center space-x-2 bg-amber-950/40 border border-amber-600/40 text-amber-300 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
          <Coins className="w-4 h-4 text-amber-400 animate-bounce" style={{ animationDuration: '3s' }} />
          <span>{balance} Coins</span>
        </div>
      </div>

      {/* Mode Switch Modal */}
      {showModeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Select Operating Mode
            </h3>
            <p className="text-sm text-slate-300 mb-6">
              SmartDustbin supports two distinct modes. Simulation mode is safe and works without any microcontrollers connected.
            </p>

            <div className="space-y-3 mb-6">
              {/* Option: Simulation */}
              <button
                onClick={() => {
                  switchMode('SIMULATION');
                  setShowModeModal(false);
                }}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  isSim
                    ? 'border-emerald-500 bg-emerald-950/40 text-white'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-emerald-400" />
                    Simulation Mode (Recommended)
                  </span>
                  {isSim && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-xs text-slate-400">
                  Runs full AI classification and animates virtual chute & trapdoor. Zero physical hardware required.
                </p>
              </button>

              {/* Option: Real Hardware */}
              <button
                onClick={() => {
                  switchMode('REAL_HARDWARE');
                  setShowModeModal(false);
                }}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  !isSim
                    ? 'border-blue-500 bg-blue-950/40 text-white'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    Real Hardware Mode
                  </span>
                  {!isSim && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-xs text-slate-400">
                  Sends HTTP commands to ESP32-CAM (192.168.4.10) and DevKit dual-servos (192.168.4.20).
                </p>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModeModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
