import React, { useState, useEffect } from 'react';
import { useHardware } from '../context/HardwareContext';
import { api } from '../services/api';
import {
  Cpu,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Wifi,
  Compass,
  Laptop,
  Play,
  Sparkles,
  ExternalLink,
  Info
} from 'lucide-react';
import { CameraTestCaptureResponse, DevKitTestSortResponse, DetectionResult, WasteCategory } from '../types/api';

export const DeviceManagementPage: React.FC = () => {
  const { deviceStatus, activeMode, refreshStatus, switchMode } = useHardware();
  const [camIp, setCamIp] = useState(deviceStatus?.esp32_cam_ip || '192.168.4.10');
  const [devkitIp, setDevkitIp] = useState(deviceStatus?.esp32_devkit_ip || '192.168.4.20');
  const [camTimeout, setCamTimeout] = useState(5);
  const [devkitTimeout, setDevkitTimeout] = useState(12);

  const [pingResult, setPingResult] = useState<{ device: string; message: string; isError: boolean } | null>(null);
  const [isPinging, setIsPinging] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Camera Live Test Frame
  const [camCaptureResult, setCamCaptureResult] = useState<CameraTestCaptureResponse | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [aiDetectionResult, setAiDetectionResult] = useState<DetectionResult | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);

  // DevKit Test Sort Actuation
  const [testSortCategory, setTestSortCategory] = useState<WasteCategory>('PLASTIC');
  const [isSorting, setIsSorting] = useState<boolean>(false);
  const [sortResult, setSortResult] = useState<DevKitTestSortResponse | null>(null);
  const [sortError, setSortError] = useState<string | null>(null);

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
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setPingResult({
        device: 'CONFIG',
        message: `Failed to save settings: ${err.response?.data?.detail || err.message}`,
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPing = async (device: 'CAM' | 'DEVKIT') => {
    setIsPinging(device);
    setPingResult(null);
    try {
      const targetIp = device === 'CAM' ? camIp : devkitIp;
      // forceReal=true allows user to test the real physical IP even while the website operates in Simulation mode
      const res = await api.testDeviceConnection(device, targetIp, true);
      setPingResult({
        device: res.device,
        message: `${res.online ? 'Online' : 'Offline'}: ${res.status_message}`,
        isError: !res.online,
      });
      await refreshStatus();
    } catch (e: any) {
      setPingResult({
        device,
        message: `Probe failed: ${e.response?.data?.detail || e.message}`,
        isError: true,
      });
    } finally {
      setIsPinging(null);
    }
  };

  const handleTestCameraCapture = async () => {
    setIsCapturing(true);
    setCamCaptureResult(null);
    setAiDetectionResult(null);
    setPingResult(null);
    try {
      const res = await api.testCameraCapture(camIp);
      setCamCaptureResult(res);
    } catch (e: any) {
      setPingResult({
        device: 'CAM',
        message: `Camera capture failed: ${e.response?.data?.detail || e.message}`,
        isError: true,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRunAiOnCapture = async () => {
    setIsClassifying(true);
    setAiDetectionResult(null);
    try {
      const res = await api.captureCameraFrame();
      setAiDetectionResult(res);
    } catch (e: any) {
      setPingResult({
        device: 'AI',
        message: `Classification failed: ${e.response?.data?.detail || e.message}`,
        isError: true,
      });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleTestSortActuation = async () => {
    setIsSorting(true);
    setSortResult(null);
    setSortError(null);
    try {
      const res = await api.testDevKitSort(testSortCategory, devkitIp);
      setSortResult(res);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message;
      setSortError(errMsg);
    } finally {
      setIsSorting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-emerald-400" />
            Hardware & Local Network Configuration
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Configure dynamic Wi-Fi DHCP IP addresses for ESP32 microcontrollers, run connection diagnostics, and verify physical servo actuation.
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
              <div className="text-sm font-bold text-emerald-300">Simulation Mode Active (Safe Commissioning Default)</div>
              <div className="text-xs text-slate-300 mt-0.5">
                Microcontroller communication is virtualized. You can test and verify physical ESP32 IPs using the probe tools below before enabling Real Hardware Mode.
              </div>
            </div>
          </div>
          <button
            onClick={() => switchMode('REAL_HARDWARE')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition-all shrink-0 flex items-center gap-1.5"
          >
            <Wifi className="w-4 h-4" />
            <span>Enable Real Hardware Mode</span>
          </button>
        </div>
      ) : (
        <div className="bg-blue-950/40 border border-blue-700/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-blue-300">Real Hardware Mode Enabled (Zero Silent Fallback)</div>
              <div className="text-xs text-slate-300 mt-0.5">
                FastAPI communicates directly with ESP32-CAM (<span className="text-white font-mono">{camIp}</span>) and DevKit (<span className="text-white font-mono">{devkitIp}</span>). In this mode, unreachable hardware generates explicit diagnostic errors.
              </div>
            </div>
          </div>
          <button
            onClick={() => switchMode('SIMULATION')}
            className="px-4 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/50 text-xs font-bold text-emerald-100 transition-all shrink-0 flex items-center gap-1.5"
          >
            <Laptop className="w-4 h-4" />
            <span>Switch to Simulation</span>
          </button>
        </div>
      )}

      {/* Save Success Notification */}
      {saveSuccess && (
        <div className="bg-emerald-950/60 border border-emerald-500/60 rounded-xl p-3.5 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Device network configuration successfully updated and saved to database!</span>
        </div>
      )}

      {/* Diagnostic Message Banner */}
      {pingResult && (
        <div className={`p-4 rounded-xl border text-xs font-mono flex items-start gap-2.5 shadow-md ${
          pingResult.isError
            ? 'bg-rose-950/50 border-rose-700/60 text-rose-300'
            : 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
        }`}>
          {pingResult.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold">[{pingResult.device} DIAGNOSTIC] </span>
            {pingResult.message}
          </div>
        </div>
      )}

      {/* Two Microcontroller Nodes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= ESP32-CAM NODE ================= */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl space-y-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">ESP32-CAM (OV2640)</h3>
                  <span className="text-xs text-slate-400">Wi-Fi Station Mode / DHCP Capture Server</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold font-mono ${
                deviceStatus?.cam_status === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : deviceStatus?.cam_status === 'SIMULATED'
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/60'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
              }`}>
                {deviceStatus?.cam_status || (isSim ? 'SIMULATED' : 'OFFLINE')}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Serves live JPEG frames over HTTP <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">GET /capture</code> to FastAPI. Check Serial Monitor on boot to verify the assigned DHCP IP.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Camera Assigned Wi-Fi IP Address
                </label>
                <input
                  type="text"
                  value={camIp}
                  onChange={(e) => setCamIp(e.target.value)}
                  placeholder="e.g. 192.168.1.50"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  HTTP Capture Timeout (Seconds)
                </label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={camTimeout}
                  onChange={(e) => setCamTimeout(parseInt(e.target.value) || 5)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 font-mono text-slate-400">
                <div className="flex justify-between">
                  <span>Root Endpoint:</span>
                  <a href={`http://${camIp}/`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1">
                    http://{camIp}/ <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span>Capture Stream:</span>
                  <a href={`http://${camIp}/capture`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1">
                    http://{camIp}/capture <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span>Sensor / Pin:</span>
                  <span className="text-slate-200">OV2640 / Flash GPIO 4</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-700/60">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTestPing('CAM')}
                disabled={isPinging === 'CAM'}
                className="py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPinging === 'CAM' ? 'animate-spin' : ''}`} />
                <span>Test Probe (GET /)</span>
              </button>

              <button
                onClick={handleTestCameraCapture}
                disabled={isCapturing}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Camera className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
                <span>{isCapturing ? 'Fetching...' : 'Capture Test Frame'}</span>
              </button>
            </div>

            {/* Live JPEG Preview Card */}
            {camCaptureResult && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Actual JPEG Received ({camCaptureResult.bytes_received.toLocaleString()} bytes)
                  </span>
                  <span className="text-slate-400 font-mono">{camCaptureResult.format}</span>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black flex justify-center items-center">
                  <img
                    src={camCaptureResult.image_preview_url}
                    alt="ESP32-CAM live capture"
                    className="max-h-56 w-auto object-contain"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">Captured from: http://{camCaptureResult.ip}/capture</span>
                  <button
                    onClick={handleRunAiOnCapture}
                    disabled={isClassifying}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isClassifying ? 'animate-spin' : ''}`} />
                    <span>Run AI Classification</span>
                  </button>
                </div>
              </div>
            )}

            {/* AI Classification of Test Capture */}
            {aiDetectionResult && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs space-y-1">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>TinyML Classification:</span>
                  <span className="text-emerald-400 font-bold">{aiDetectionResult.category}</span>
                </div>
                <div className="text-slate-400">
                  Confidence: <span className="text-white font-mono">{(aiDetectionResult.confidence * 100).toFixed(1)}%</span> | Similarity: <span className="text-white font-mono">{aiDetectionResult.similarity.toFixed(3)}</span>
                </div>
                <div className="text-[11px] text-slate-500">{aiDetectionResult.message}</div>
              </div>
            )}
          </div>
        </div>

        {/* ================= ESP32 DEVKIT NODE ================= */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl space-y-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">ESP32 DevKit V1 Sorter</h3>
                  <span className="text-xs text-slate-400">Continuous 360° + Positional 180° Servo Actuator</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold font-mono ${
                deviceStatus?.devkit_status === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : deviceStatus?.devkit_status === 'SIMULATED'
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/60'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
              }`}>
                {deviceStatus?.devkit_status || (isSim ? 'SIMULATED' : 'OFFLINE')}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Drives 360° continuous chute servo (GPIO 18, calibrated speed & stop pulses) and 180° trapdoor servo (GPIO 19, 0° to 90° for 1.2s) upon confirmed sort requests.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  DevKit Assigned Wi-Fi IP Address
                </label>
                <input
                  type="text"
                  value={devkitIp}
                  onChange={(e) => setDevkitIp(e.target.value)}
                  placeholder="e.g. 192.168.1.60"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  HTTP Actuation Timeout (Seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={devkitTimeout}
                  onChange={(e) => setDevkitTimeout(parseInt(e.target.value) || 12)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 font-mono text-slate-400">
                <div className="flex justify-between">
                  <span>Status Endpoint:</span>
                  <a href={`http://${devkitIp}/status`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                    http://{devkitIp}/status <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span>Servo 1 (Chute):</span>
                  <span className="text-slate-200">Continuous 360° (GPIO 18)</span>
                </div>
                <div className="flex justify-between">
                  <span>Servo 2 (Flap):</span>
                  <span className="text-slate-200">Positional 180° (GPIO 19, 0°-90°)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-700/60">
            <button
              onClick={() => handleTestPing('DEVKIT')}
              disabled={isPinging === 'DEVKIT'}
              className="w-full py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPinging === 'DEVKIT' ? 'animate-spin' : ''}`} />
              <span>Ping DevKit Status (GET /status)</span>
            </button>

            {/* Test Sort Actuation Section */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-blue-400" />
                  Physical Servo Actuation Test
                </span>
                <span className="text-[11px] text-slate-400">Sends confirmed /sort</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['PLASTIC', 'METAL', 'WET', 'DRY'] as WasteCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTestSortCategory(cat)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      testSortCategory === cat
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                onClick={handleTestSortActuation}
                disabled={isSorting}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isSorting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isSorting ? `Actuating ${testSortCategory}...` : `Actuate Physical ${testSortCategory} Sort`}</span>
              </button>

              {sortResult && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-xs text-emerald-300 space-y-1 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Physical Actuation Confirmed!
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">{sortResult.message}</div>
                </div>
              )}

              {sortError && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-700/50 text-xs text-rose-300 space-y-1 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Actuation Failed
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">{sortError}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Setup Note Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-white font-semibold">Wi-Fi Commissioning Tips</div>
          <p>
            Ensure both ESP32 microcontrollers and this Windows PC are connected to the same Wi-Fi router or Mobile Hotspot.
            Check the Arduino IDE Serial Monitor at 115200 baud to view the DHCP IP address assigned to each board, then paste the addresses above and click <strong>Save IP Settings</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
