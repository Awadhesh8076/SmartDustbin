import React, { useEffect, useState } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  BrainCircuit,
  Database,
  Cpu,
  Laptop,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { SettingsResponse, OperatingMode } from '../types/api';
import { useHardware } from '../context/HardwareContext';

export const SettingsPage: React.FC = () => {
  const { activeMode, switchMode, refreshStatus } = useHardware();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [camIp, setCamIp] = useState('');
  const [devkitIp, setDevkitIp] = useState('');
  const [camTimeout, setCamTimeout] = useState(4);
  const [devkitTimeout, setDevkitTimeout] = useState(10);
  const [selectedMode, setSelectedMode] = useState<OperatingMode>(activeMode);
  const [savedMsg, setSavedMsg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setCamIp(s.esp32_cam_ip);
      setDevkitIp(s.esp32_devkit_ip);
      setCamTimeout(s.camera_timeout_seconds);
      setDevkitTimeout(s.devkit_timeout_seconds);
      setSelectedMode(s.active_mode);
    }).catch(() => null);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings({
        esp32_cam_ip: camIp,
        esp32_devkit_ip: devkitIp,
        camera_timeout_seconds: camTimeout,
        devkit_timeout_seconds: devkitTimeout,
        active_mode: selectedMode,
      });
      if (selectedMode !== activeMode) {
        await switchMode(selectedMode);
      }
      await refreshStatus();
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-teal-400" />
          System Settings & IoT Architecture
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Configure physical network endpoints, timeout intervals, AI parameters, and database paths.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Operating Mode */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Operating Mode
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Select whether the application simulates actuators or communicates with physical ESP32 devices.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedMode('SIMULATION')}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedMode === 'SIMULATION'
                  ? 'bg-emerald-950/50 border-emerald-500 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900/60 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  Simulation Mode (Default)
                </span>
                {selectedMode === 'SIMULATION' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-xs text-slate-400">
                Operates without physical hardware. AI inference, animations, and coin economy run synthetically.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('REAL_HARDWARE')}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedMode === 'REAL_HARDWARE'
                  ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-slate-900/60 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  Real Hardware Mode
                </span>
                {selectedMode === 'REAL_HARDWARE' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
              </div>
              <p className="text-xs text-slate-400">
                Dispatches live HTTP GET commands to ESP32-CAM and DevKit at their configured IP addresses.
              </p>
            </button>
          </div>
        </div>

        {/* Section 2: ESP32 Network Settings */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-400" />
            ESP32 Microcontroller Endpoints
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Static IP addresses and communication timeouts for the two physical nodes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">ESP32-CAM IP Address</label>
              <input
                type="text"
                value={camIp}
                onChange={(e) => setCamIp(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Default: 192.168.4.10 (GET /capture)</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">ESP32 DevKit IP Address</label>
              <input
                type="text"
                value={devkitIp}
                onChange={(e) => setDevkitIp(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Default: 192.168.4.20 (GET /sort?type=...)</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Camera Timeout (Seconds)</label>
              <input
                type="number"
                value={camTimeout}
                onChange={(e) => setCamTimeout(parseInt(e.target.value) || 4)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">DevKit Sorter Timeout (Seconds)</label>
              <input
                type="number"
                value={devkitTimeout}
                onChange={(e) => setDevkitTimeout(parseInt(e.target.value) || 10)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 3: AI & TinyML Parameters */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-purple-400" />
            AI & Continual Learning Architecture
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Mathematical parameters ported directly from the original Unity TinyML C# algorithm.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-slate-400 mb-0.5">Feature Dimensions</div>
              <div className="text-base font-bold text-white">32 Features</div>
              <div className="text-[11px] text-slate-500 mt-1">HSV + Quadrants + Edges</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-slate-400 mb-0.5">UNKNOWN Threshold</div>
              <div className="text-base font-bold text-amber-400">r &ge; 0.70</div>
              <div className="text-[11px] text-slate-500 mt-1">Strict Zero-Guessing</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-slate-400 mb-0.5">Input Resolution</div>
              <div className="text-base font-bold text-white">128 &times; 128 px</div>
              <div className="text-[11px] text-slate-500 mt-1">Center-Crop Bilinear</div>
            </div>
          </div>
        </div>

        {/* Section 4: Database & Storage Persistence */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Data Storage & Safe Backups
            </h3>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await api.createDatabaseBackup();
                  alert(`Backup created successfully: ${res.filename} (${(res.size_bytes / 1024).toFixed(1)} KB)`);
                } catch (e: any) {
                  alert(`Backup failed: ${e.message}`);
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Create DB Backup</span>
            </button>
          </div>

          <div className="space-y-2 text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div><strong className="text-slate-200">Database Engine:</strong> SQLite 3 via SQLAlchemy ORM</div>
            <div><strong className="text-slate-200">Database URL:</strong> {settings?.database_url}</div>
            <div><strong className="text-slate-200">Storage Directory:</strong> {settings?.storage_path}</div>
            <div><strong className="text-slate-200">Persistence Policy:</strong> Dual-persist (SQLite + JSON model backups)</div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between border-t border-slate-700/60 pt-4">
          {savedMsg ? (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              Settings successfully saved and synchronized!
            </span>
          ) : (
            <span className="text-xs text-slate-500">Changes apply immediately across all endpoints.</span>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-600/20 transition-all cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
