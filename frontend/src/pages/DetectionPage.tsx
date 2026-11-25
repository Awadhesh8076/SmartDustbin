import React, { useState, useRef, useEffect } from 'react';
import {
  ScanLine,
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Cpu,
  Layers,
  History,
  Play,
  Wifi,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useHardware } from '../context/HardwareContext';
import { useRewards } from '../context/RewardsContext';
import { api } from '../services/api';
import { DetectionResult, DetectionHistoryItem, WasteCategory, SortingExecuteResponse } from '../types/api';

const CATEGORY_COLORS: Record<WasteCategory, { bg: string; text: string; border: string; bar: string; label: string }> = {
  PLASTIC: { bg: 'bg-blue-950/60', text: 'text-blue-400', border: 'border-blue-600/60', bar: 'bg-blue-500', label: 'Compartment 1 (Chute CW 400ms)' },
  METAL: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-600/60', bar: 'bg-amber-500', label: 'Compartment 2 (Chute CW 800ms)' },
  WET: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-600/60', bar: 'bg-emerald-500', label: 'Compartment 3 (Chute CW 1200ms)' },
  DRY: { bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-600/60', bar: 'bg-purple-500', label: 'Compartment 4 (Chute CW 1600ms)' },
  UNKNOWN: { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700', bar: 'bg-slate-500', label: 'Locked (Cannot Actuate)' },
};

const COMPARTMENT_DETAILS: Record<Exclude<WasteCategory, 'UNKNOWN'>, { name: string; coins: number; angle: number; desc: string }> = {
  PLASTIC: { name: 'Plastic Bin', coins: 3, angle: 45, desc: 'Servo 1: CW 400ms | Flap 90° for 1.2s' },
  METAL: { name: 'Metal Bin', coins: 5, angle: 90, desc: 'Servo 1: CW 800ms | Flap 90° for 1.2s' },
  WET: { name: 'Wet / Organic Bin', coins: 1, angle: 135, desc: 'Servo 1: CW 1200ms | Flap 90° for 1.2s' },
  DRY: { name: 'Dry / Paper Bin', coins: 2, angle: 180, desc: 'Servo 1: CW 1600ms | Flap 90° for 1.2s' },
};

export const DetectionPage: React.FC = () => {
  const { activeMode, deviceStatus, refreshStatus } = useHardware();
  const { refreshBalance } = useRewards();
  const [sourceMode, setSourceMode] = useState<'ESP32' | 'WEBCAM' | 'UPLOAD'>('WEBCAM');

  // Webcam state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Upload state
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Inference state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [teachStatus, setTeachStatus] = useState<string | null>(null);
  const [isTeaching, setIsTeaching] = useState<boolean>(false);

  // Button-Controlled Sorting State
  const [selectedCategory, setSelectedCategory] = useState<WasteCategory>('UNKNOWN');
  const [isSorting, setIsSorting] = useState<boolean>(false);
  const [sortingProgressStage, setSortingProgressStage] = useState<string | null>(null);
  const [sortingResult, setSortingResult] = useState<SortingExecuteResponse | null>(null);
  const [sortingError, setSortingError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<DetectionHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const isSim = activeMode === 'SIMULATION';
  const camOnline = deviceStatus?.cam_status === 'ONLINE' || (isSim && deviceStatus?.cam_status === 'SIMULATED');
  const devkitOnline = deviceStatus?.devkit_status === 'ONLINE' || (isSim && deviceStatus?.devkit_status === 'SIMULATED');

  // Load detection history on mount
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.getDetectionHistory(8);
      setHistory(res.items);
    } catch {
      // Ignore
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    refreshStatus();
    return () => {
      stopCamera();
    };
  }, []);

  // Update selectedCategory whenever a new AI classification result arrives
  useEffect(() => {
    if (result) {
      setSelectedCategory(result.category);
      // Reset previous sorting execution states
      setSortingResult(null);
      setSortingError(null);
      setSortingProgressStage(null);
    }
  }, [result]);

  // Webcam Management
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      setCameraError(err.message || 'Camera access denied or device not found.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureWebcamFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setPreviewUrl(URL.createObjectURL(blob));
      await executeClassification(blob, 'BROWSER_CAMERA');
    }, 'image/jpeg', 0.9);
  };

  // Upload Management
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG/PNG).');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadAnalyze = async () => {
    if (!selectedFile) return;
    await executeClassification(selectedFile, 'UPLOAD');
  };

  // ESP32-CAM Capture
  const handleESP32Capture = async () => {
    setIsAnalyzing(true);
    setResult(null);
    setCaptureError(null);
    setTeachStatus(null);
    setSortingResult(null);
    setSortingError(null);
    try {
      // In REAL_HARDWARE mode, calls FastAPI /api/devices/camera/capture which requests http://<CAM_IP>/capture
      const res = await api.captureCameraFrame();
      setResult(res);
      setPreviewUrl(res.image_url);
      await loadHistory();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      setCaptureError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Classification via Upload / Webcam
  const executeClassification = async (fileBlob: Blob | File, source: string) => {
    setIsAnalyzing(true);
    setResult(null);
    setCaptureError(null);
    setTeachStatus(null);
    setSortingResult(null);
    setSortingError(null);
    try {
      const res = await api.scanImage(fileBlob, source);
      setResult(res);
      await loadHistory();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      setCaptureError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // User-Assisted Teaching
  const handleTeachCategory = async (confirmedCategory: WasteCategory) => {
    if (!result || !result.detection_id) return;
    setIsTeaching(true);
    try {
      const res = await api.teachCategory(result.detection_id, confirmedCategory);
      setTeachStatus(res.message);
      // Immediately reflect newly trained state
      setResult((prev) =>
        prev
          ? {
              ...prev,
              category: res.immediate_new_prediction,
              confidence: res.immediate_new_confidence,
              confidence_level: 'HIGH',
              requires_user_label: false,
              is_known_in_memory: true,
              message: `Learned! Model updated for ${res.immediate_new_prediction}`,
            }
          : null
      );
      setSelectedCategory(res.immediate_new_prediction);
      await loadHistory();
    } catch (err: any) {
      alert(`Teaching failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsTeaching(false);
    }
  };

  // Button-Controlled Sorting Execution
  const handleConfirmAndSort = async () => {
    if (!result || selectedCategory === 'UNKNOWN') return;
    setIsSorting(true);
    setSortingResult(null);
    setSortingError(null);
    setSortingProgressStage('Sending sort command to FastAPI...');

    try {
      // Step 1: Dispatch to FastAPI
      setSortingProgressStage(`Actuating servos: Rotating 360° chute to ${selectedCategory} & opening 180° flap...`);
      
      const response = await api.executeSorting(selectedCategory, result.detection_id);
      
      setSortingResult(response);
      setSortingProgressStage(null);

      // Refresh rewards balance immediately upon confirmed sorting
      await refreshBalance();
      await loadHistory();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Sorting execution failed';
      setSortingError(errMsg);
      setSortingProgressStage(null);
    } finally {
      setIsSorting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header & Source Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ScanLine className="w-6 h-6 text-emerald-400" />
            Button-Controlled Waste Classification & Sorting
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Capture image $\to$ AI classifies waste $\to$ Review prediction $\to$ Click <strong>CONFIRM & SORT</strong> to actuate servos.
          </p>
        </div>

        {/* Source Selector Pills */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/80 shrink-0">
          <button
            onClick={() => {
              setSourceMode('ESP32');
              stopCamera();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sourceMode === 'ESP32'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>ESP32-CAM</span>
          </button>

          <button
            onClick={() => {
              setSourceMode('WEBCAM');
              if (!isCameraActive) startCamera();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sourceMode === 'WEBCAM'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Webcam</span>
          </button>

          <button
            onClick={() => {
              setSourceMode('UPLOAD');
              stopCamera();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sourceMode === 'UPLOAD'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* Hardware Connection Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* ESP32-CAM Status */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Camera className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-bold text-white">ESP32-CAM Node</div>
              <div className="text-[11px] font-mono text-slate-400">{deviceStatus?.esp32_cam_ip || '192.168.4.10'}</div>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
            camOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
          }`}>
            {deviceStatus?.cam_status || (isSim ? 'SIMULATED' : 'OFFLINE')}
          </span>
        </div>

        {/* ESP32 DevKit Status */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-blue-400" />
            <div>
              <div className="text-xs font-bold text-white">ESP32 DevKit Sorter</div>
              <div className="text-[11px] font-mono text-slate-400">{deviceStatus?.esp32_devkit_ip || '192.168.4.20'}</div>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
            devkitOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
          }`}>
            {deviceStatus?.devkit_status || (isSim ? 'SIMULATED' : 'OFFLINE')}
          </span>
        </div>

        {/* Active Mode */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <Wifi className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-xs font-bold text-white">Operating Mode</div>
              <div className="text-[11px] text-slate-400">{isSim ? 'Virtual Simulation' : 'Physical Hardware'}</div>
            </div>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            isSim ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' : 'bg-blue-900/60 text-blue-300 border border-blue-600/60'
          }`}>
            {activeMode}
          </span>
        </div>
      </div>

      {/* Camera Capture Error Banner */}
      {captureError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-300 flex items-start justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">ESP32-CAM Not Reachable via Wi-Fi</div>
              <div className="mt-0.5 font-mono text-rose-200">{captureError}</div>
              <div className="text-slate-400 mt-1">
                You can switch to <b>Live Browser Viewfinder (Laptop Webcam)</b> tab above to test AI detection and sort without ESP32-CAM!
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setCaptureError(null);
              setSourceMode('WEBCAM');
              startCamera();
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 transition-all shadow"
          >
            Use Laptop Webcam
          </button>
        </div>
      )}

      {/* Main Grid: Viewfinder & Prediction / Sorting Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Viewfinder & Image Capture */}
        <div className="lg:col-span-6 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[480px]">
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              {sourceMode === 'ESP32' && `ESP32-CAM Frame Capture`}
              {sourceMode === 'WEBCAM' && 'Live Browser Viewfinder'}
              {sourceMode === 'UPLOAD' && 'Image Upload & Dropzone'}
            </span>
            <span className="text-xs font-mono text-slate-400">128 × 128 Center Crop</span>
          </div>

          {/* Center Display Area */}
          <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-xl bg-slate-950/80 border border-slate-800 p-2 min-h-[300px]">
            {/* Mode 1: ESP32-CAM Snapshot */}
            {sourceMode === 'ESP32' && (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                {previewUrl ? (
                  <div className="max-h-[320px] flex flex-col items-center">
                    <img src={previewUrl} alt="ESP32 snapshot" className="max-h-[250px] rounded-lg object-contain shadow-lg mb-2 border border-slate-700" />
                    <span className="text-[11px] text-slate-400 font-mono">Captured frame ready for classification</span>
                  </div>
                ) : (
                  <div>
                    <Cpu className="w-14 h-14 text-blue-400/60 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-white mb-1">Live Waste Image Capture</h4>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">
                      {isSim
                        ? 'Simulation Mode: Generates synthetic test camera frames for classification testing.'
                        : `Real Hardware Mode: Queries http://${deviceStatus?.esp32_cam_ip || '192.168.4.10'}/capture directly over Wi-Fi.`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Webcam Feed */}
            {sourceMode === 'WEBCAM' && (
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                <video
                  ref={videoRef}
                  className={`w-full max-h-[320px] object-contain rounded-lg ${isCameraActive ? 'block' : 'hidden'}`}
                  autoPlay
                  playsInline
                  muted
                />

                {!isCameraActive && (
                  <div className="text-center p-6">
                    <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-300 mb-1">Webcam Inactive</p>
                    <p className="text-xs text-slate-500 max-w-sm mb-4">
                      Enable your browser camera to capture waste items for classification.
                    </p>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20"
                    >
                      Start Camera
                    </button>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-xs text-amber-300 mb-3">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded border border-slate-700 text-white"
                    >
                      Retry Permission
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Drag & Drop Upload */}
            {sourceMode === 'UPLOAD' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleFileDrop}
                className={`w-full h-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-all ${
                  dragActive ? 'border-emerald-400 bg-emerald-950/20' : 'border-slate-700/80 bg-slate-900/40'
                }`}
              >
                {previewUrl ? (
                  <div className="relative max-h-[300px] flex flex-col items-center">
                    <img src={previewUrl} alt="Upload preview" className="max-h-[240px] rounded-lg object-contain shadow-lg mb-3" />
                    <div className="flex gap-2">
                      <label className="cursor-pointer px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700">
                        Choose Another
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
                        />
                      </label>
                      <button
                        onClick={handleUploadAnalyze}
                        disabled={isAnalyzing}
                        className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-all flex items-center gap-1.5"
                      >
                        {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Analyze Image</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-300 mb-1">Drag & Drop Waste Image</p>
                    <p className="text-xs text-slate-500 mb-4">Supports JPEG, PNG, WEBP (Max 10MB)</p>
                    <label className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 transition-all inline-block shadow">
                      Browse Local Files
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="border-t border-slate-700/60 pt-4 flex items-center justify-between mt-4">
            {sourceMode === 'ESP32' && (
              <button
                onClick={handleESP32Capture}
                disabled={isAnalyzing || isSorting}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Capturing Image & Running AI...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Capture Image from ESP32-CAM</span>
                  </>
                )}
              </button>
            )}

            {sourceMode === 'WEBCAM' && (
              <div className="flex items-center gap-3 w-full justify-between">
                <span className="text-xs text-slate-400">
                  {isCameraActive ? 'Live stream active' : 'Click start to open webcam'}
                </span>
                <div className="flex gap-2">
                  {isCameraActive ? (
                    <>
                      <button
                        onClick={stopCamera}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                      >
                        Stop
                      </button>
                      <button
                        onClick={captureWebcamFrame}
                        disabled={isAnalyzing || isSorting}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                      >
                        {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Capture Frame</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startCamera}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm"
                    >
                      Start Camera
                    </button>
                  )}
                </div>
              </div>
            )}

            {sourceMode === 'UPLOAD' && (
              <div className="flex items-center justify-between w-full text-xs text-slate-400">
                <span>Select or drop a file to classify</span>
                <span>Aspect: Center-Crop 1:1</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Results & Button-Controlled Sorting */}
        <div className="lg:col-span-6 space-y-5">
          {/* Main Prediction & Sorting Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                AI Prediction & Sorter Control
              </span>
              <span className="text-xs font-mono text-slate-400">{result?.model_version || 'v1.0 TinyML'}</span>
            </div>

            {isAnalyzing ? (
              <div className="py-12 text-center">
                <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white">Extracting 32-D TinyML Features...</h4>
                <p className="text-xs text-slate-400 mt-1">Evaluating Pearson correlation ($r \ge 0.70$) against memory centroids</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Result Hero Banner */}
                <div
                  className={`p-4 rounded-xl border text-center ${
                    CATEGORY_COLORS[result.category].bg
                  } ${CATEGORY_COLORS[result.category].border}`}
                >
                  <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-0.5">
                    {result.category === 'UNKNOWN' ? 'Zero-Guessing: Unrecognized Material' : 'Detected Waste Category'}
                  </div>
                  <div className={`text-3xl font-extrabold ${CATEGORY_COLORS[result.category].text}`}>
                    {result.category}
                  </div>
                  <div className="text-xs font-medium text-slate-300 mt-1 flex items-center justify-center gap-3">
                    <span>Confidence: <strong>{(result.confidence * 100).toFixed(1)}%</strong> ({result.confidence_level})</span>
                    <span>Pearson Similarity: <strong>{result.similarity.toFixed(4)}</strong></span>
                  </div>
                </div>

                {/* Target Compartment Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Target Sorting Compartment:</span>
                    <span className="text-slate-400 text-[11px]">Click to change before actuating</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['PLASTIC', 'METAL', 'WET', 'DRY'] as Array<Exclude<WasteCategory, 'UNKNOWN'>>).map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const details = COMPARTMENT_DETAILS[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          disabled={isSorting}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-blue-600/30 border-blue-500 text-white shadow-lg'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-[11px] font-bold text-white flex items-center justify-between">
                            <span>{cat}</span>
                            <span className="text-amber-400 text-[10px]">+{details.coins}¢</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{details.name}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5 font-mono">{details.angle}° chute</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* UNKNOWN Safety Guard Alert */}
                {selectedCategory === 'UNKNOWN' && (
                  <div className="bg-amber-950/50 border border-amber-600/60 rounded-xl p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Motor Actuation Locked (Zero-Guessing Guard)</div>
                      <p className="mt-0.5 text-slate-300 text-[11px]">
                        The material similarity ($r = {result.similarity.toFixed(3)}$) is below the 0.70 threshold. Servos cannot be actuated for UNKNOWN items. Select a verified compartment above or teach the material below.
                      </p>
                    </div>
                  </div>
                )}

                {/* THE CORE CONFIRM & SORT BUTTON */}
                <div className="pt-2">
                  <button
                    onClick={handleConfirmAndSort}
                    disabled={isSorting || selectedCategory === 'UNKNOWN'}
                    className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2.5 ${
                      selectedCategory === 'UNKNOWN'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : isSorting
                        ? 'bg-blue-700 text-white cursor-wait'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:scale-[1.01]'
                    }`}
                  >
                    {isSorting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Actuating Servos: Sorting into {selectedCategory}...</span>
                      </>
                    ) : selectedCategory === 'UNKNOWN' ? (
                      <>
                        <ShieldAlert className="w-5 h-5 text-amber-400" />
                        <span>Locked: Select a Category to Sort</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        <span>CONFIRM & SORT INTO {selectedCategory}</span>
                        <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
                      </>
                    )}
                  </button>

                  <div className="text-center text-[11px] text-slate-400 mt-1.5">
                    {isSorting
                      ? 'Executing dual-servo routine: 360° chute rotation & 180° flap drop...'
                      : 'Nothing moves until you click this button. Explicit confirmation required.'}
                  </div>
                </div>

                {/* Sorting Progress / Stage Tracker */}
                {sortingProgressStage && (
                  <div className="p-3 bg-blue-950/50 border border-blue-600/60 rounded-xl text-xs text-blue-300 flex items-center gap-2 animate-in fade-in">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                    <span>{sortingProgressStage}</span>
                  </div>
                )}

                {/* Sorting Success Result */}
                {sortingResult && (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-500/60 rounded-xl text-xs text-emerald-300 space-y-1.5 animate-in fade-in shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Sorting Confirmed by ESP32 DevKit!
                      </span>
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono">
                        +{sortingResult.coins_earned} Coins
                      </span>
                    </div>
                    <div className="text-slate-200 text-[11px]">{sortingResult.message}</div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-emerald-900/60 font-mono">
                      <span>Mode: {sortingResult.mode}</span>
                      <span>Execution Duration: {sortingResult.execution_duration_seconds}s</span>
                      <span>New Balance: {sortingResult.balance_after}¢</span>
                    </div>
                  </div>
                )}

                {/* Sorting Error Banner */}
                {sortingError && (
                  <div className="p-4 bg-rose-950/60 border border-rose-600/60 rounded-xl text-xs text-rose-300 space-y-1 animate-in fade-in shadow-lg">
                    <div className="font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      Sorting Command Failed
                    </div>
                    <div className="text-slate-200 text-[11px] font-mono">{sortingError}</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Check that ESP32 DevKit is powered, connected to local Wi-Fi, and port 80 is reachable.
                    </div>
                  </div>
                )}

                {/* User-Assisted Teaching Prompt (When UNKNOWN) */}
                {result.requires_user_label && (
                  <div className="bg-amber-950/30 border border-amber-600/50 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-amber-300 uppercase">Teach AI Memory</h5>
                        <p className="text-[11px] text-slate-300">
                          Confirm correct category to train the model immediately via 1-Shot Online Adaptation:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(['PLASTIC', 'METAL', 'WET', 'DRY'] as WasteCategory[]).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleTeachCategory(cat)}
                          disabled={isTeaching}
                          className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all"
                        >
                          Teach {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teaching Success Banner */}
                {teachStatus && (
                  <div className="bg-emerald-950/50 border border-emerald-500/60 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{teachStatus}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500">
                <Layers className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-300">Awaiting Waste Snapshot</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Click <strong>Capture Image from ESP32-CAM</strong> to scan waste item. Nothing will actuate until you click Confirm & Sort.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Scans History Drawer */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">Recent Detections & Sorted Items</h3>
          </div>
          <button
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {history.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {history.map((item) => {
              const colors = CATEGORY_COLORS[item.detected_category] || CATEGORY_COLORS.UNKNOWN;
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 flex flex-col items-center text-center group hover:border-slate-700 transition-all"
                >
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-950 mb-2 border border-slate-800">
                    <img
                      src={item.image_url}
                      alt={item.detected_category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {item.detected_category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 mt-1">
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="text-[9px] text-slate-500 mt-0.5">
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            No detection records found in database yet.
          </div>
        )}
      </div>
    </div>
  );
};
