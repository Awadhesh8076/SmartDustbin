import React, { useState, useEffect } from 'react';
import { useHardware } from '../context/HardwareContext';
import { api } from '../services/api';
import {
  Cpu,
  Camera,
  CheckCircle2,
  RefreshCw,
  Save,
  Wifi,
  Compass,
  Laptop
} from 'lucide-react';
import { DetectionResult } from '../types/api';

export const DeviceManagementPage: React.FC = () => {
  const { deviceStatus, activeMode, refreshStatus, switchMode } = useHardware();
  const [camIp, setCamIp] = useState(deviceStatus?.esp32_cam_ip || '192.168.4.10');
  const [devkitIp, setDevkitIp] = useState(deviceStatus?.esp32_devkit_ip || '192.168.4.20');
  const [camTimeout, setCamTimeout] = useState(4);
  const [devkitTimeout, setDevkitTimeout] = useState(10);

  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Diagnostic Test Snapshot
  const [testSnapshot, setTestSnapshot] = useState<DetectionResult | null>(null);
  const [isTestingCamera, setIsTestingCamera] = useState<boolean>(false);

  const isSim = activeMode === 'SIMULATION';

  useEffect(() => {
    api.getSettings().then((s) => {
      setCamIp(s.esp32_cam_ip);
      setDevkitIp(s.esp32_devkit_ip);
      setCamTimeout(s.camera_timeout_seconds);
      setDevkitTimeout(s.devkit_timeout_seconds);
    }).catch(() => null);
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateSettings({
        esp32_cam_ip: camIp,
        esp32_devkit_ip: devkitIp,
        camera_timeout_seconds: camTimeout,
        devkit_timeout_seconds: devkitTimeout,
      });
      await refreshStatus();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPing = async (device: 'CAM' | 'DEVKIT') => {
    setIsPinging(device);
    setPingResult(null);
    try {
      const targetIp = device === 'CAM' ? camIp : devkitIp;
      const res = await api.testDeviceConnection(device, targetIp);
      setPingResult(`[${res.device}] ${res.online ? 'Online' : 'Offline'}: ${res.status_message}`);
      await refreshStatus();
    } catch (e: any) {
      setPingResult(`Ping failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setIsPinging(null);
    }
  };

  const handleTestCapture = async () => {
    setIsTestingCamera(true);
    setTestSnapshot(null);
    try {
      const res = await api.captureCameraFrame();
      setTestSnapshot(res);
    } catch (e: any) {
      setPingResult(`Camera test capture failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setIsTestingCamera(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-emerald-400" />
            IoT Device Management
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Monitor connection health, configure static IP addresses, and ping ESP32 microcontrollers safely.
          </p>
        </div>
        <button
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save IP Settings</span>
        </button>
      </div>

      {/* Mode Status Banner */}
      {isSim ? (
        <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Laptop className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-300">Simulation Mode Active (Safe Default)</div>
              <div className="text-xs text-slate-300 mt-0.5">
                Microcontroller communication is virtualized. Pings, AI frame generation, and dual-servo sequences run without physical hardware.
              </div>
            </div>
          </div>
          <button
            onClick={() => switchMode('REAL_HARDWARE')}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 transition-colors shrink-0"
          >
            Switch to Real Hardware
          </button>
        </div>
      ) : (
        <div className="bg-blue-950/40 border border-blue-700/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-blue-300">Real Hardware Mode Enabled</div>
              <div className="text-xs text-slate-300 mt-0.5">
                FastAPI communicates directly with ESP32-CAM ({camIp}) and DevKit ({devkitIp}) on your local subnet.
              </div>
            </div>
          </div>
          <button
            onClick={() => switchMode('SIMULATION')}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-600 text-xs font-semibold text-emerald-200 transition-colors shrink-0"
          >
            Return to Simulation Mode
          </button>
        </div>
      )}

      {/* Save Success Notification */}
      {saveSuccess && (
        <div className="bg-emerald-950/60 border border-emerald-500/60 rounded-xl p-3.5 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Device network configuration successfully updated and saved to SQLite!</span>
        </div>
      )}

      {/* Two Microcontroller Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ESP32-CAM Node Card */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">ESP32-CAM Node</h3>
                  <span className="text-xs text-slate-400">AI-Thinker OV2640 Module</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold font-mono ${
                deviceStatus?.cam_status === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : deviceStatus?.cam_status === 'SIMULATED'
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/60'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {deviceStatus?.cam_status || (isSim ? 'SIMULATED' : 'OFFLINE')}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Captures live waste snapshots over HTTP GET /capture and streams raw JPEG bytes to FastAPI for 128×128 preprocessing.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Device IP / Host</label>
                <input
                  type="text"
                  value={camIp}
                  onChange={(e) => setCamIp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">HTTP Timeout (Seconds)</label>
                <input
                  type="number"
                  value={camTimeout}
                  onChange={(e) => setCamTimeout(parseInt(e.target.value) || 4)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-400">
                <div>Endpoint: <span className="text-slate-200">http://{camIp}/capture</span></div>
                <div>Protocol: <span className="text-slate-200">HTTP/1.1 GET (image/jpeg)</span></div>
                <div>Flash Pin: <span className="text-slate-200">GPIO 4</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-700/60">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTestPing('CAM')}
                disabled={isPinging === 'CAM'}
                className="py-2.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPinging === 'CAM' ? 'animate-spin' : ''}`} />
                <span>Ping Probe</span>
              </button>

              <button
                onClick={handleTestCapture}
                disabled={isTestingCamera}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Camera className={`w-3.5 h-3.5 ${isTestingCamera ? 'animate-spin' : ''}`} />
                <span>Test Capture</span>
              </button>
            </div>

            {testSnapshot && (
              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                <img
                  src={testSnapshot.image_url}
                  alt="Captured test"
                  className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                />
                <div className="text-xs">
                  <div className="font-bold text-white">Test Frame Received</div>
                  <div className="text-slate-400">
                    Category: <span className="text-emerald-400 font-semibold">{testSnapshot.category}</span> ({(testSnapshot.confidence * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ESP32 DevKit Node Card */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">ESP32 DevKit V1 Sorter</h3>
                  <span className="text-xs text-slate-400">Dual-Servo Actuator Controller</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold font-mono ${
                deviceStatus?.devkit_status === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : deviceStatus?.devkit_status === 'SIMULATED'
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/60'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {deviceStatus?.devkit_status || (isSim ? 'SIMULATED' : 'OFFLINE')}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Drives Chute selector (GPIO 18, 0°–180°) and Trapdoor release flap (GPIO 19, 0°–90° for 1.2s) upon GET /sort?type=...
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Device IP / Host</label>
                <input
                  type="text"
                  value={devkitIp}
                  onChange={(e) => setDevkitIp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">HTTP Timeout (Seconds)</label>
                <input
                  type="number"
                  value={devkitTimeout}
                  onChange={(e) => setDevkitTimeout(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-400">
                <div>Endpoint: <span className="text-slate-200">http://{devkitIp}/sort?type=...</span></div>
                <div>Chute Servo: <span className="text-slate-200">GPIO 18 (45°, 90°, 135°, 180°)</span></div>
                <div>Trapdoor Servo: <span className="text-slate-200">GPIO 19 (0° closed, 90° open)</span></div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/60">
            <button
              onClick={() => handleTestPing('DEVKIT')}
              disabled={isPinging === 'DEVKIT'}
              className="w-full py-2.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPinging === 'DEVKIT' ? 'animate-spin' : ''}`} />
              <span>Ping DevKit Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ping Results Output */}
      {pingResult && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-xs font-mono text-emerald-300 flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{pingResult}</span>
        </div>
      )}
    </div>
  );
};
