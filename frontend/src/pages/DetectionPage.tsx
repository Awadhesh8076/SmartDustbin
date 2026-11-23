import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Trash2,
} from 'lucide-react';
import { useHardware } from '../context/HardwareContext';
import { api } from '../services/api';
import { DetectionResult, DetectionHistoryItem, WasteCategory } from '../types/api';

const CATEGORY_COLORS: Record<WasteCategory, { bg: string; text: string; border: string; bar: string }> = {
  PLASTIC: { bg: 'bg-blue-950/60', text: 'text-blue-400', border: 'border-blue-600/60', bar: 'bg-blue-500' },
  METAL: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-600/60', bar: 'bg-amber-500' },
  WET: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-600/60', bar: 'bg-emerald-500' },
  DRY: { bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-600/60', bar: 'bg-purple-500' },
  UNKNOWN: { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700', bar: 'bg-slate-500' },
};

export const DetectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeMode } = useHardware();
  const [sourceMode, setSourceMode] = useState<'WEBCAM' | 'UPLOAD' | 'ESP32'>('WEBCAM');

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
  const [teachStatus, setTeachStatus] = useState<string | null>(null);
  const [isTeaching, setIsTeaching] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<DetectionHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

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
    return () => {
      stopCamera();
    };
  }, []);

  // Camera Management
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
    setTeachStatus(null);
    try {
      const res = await api.captureCameraFrame();
      setResult(res);
      setPreviewUrl(res.image_url);
      await loadHistory();
    } catch (err: any) {
      alert(`Capture failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Execute Classification
  const executeClassification = async (fileBlob: Blob | File, source: string) => {
    setIsAnalyzing(true);
    setResult(null);
    setTeachStatus(null);
    try {
      const res = await api.scanImage(fileBlob, source);
      setResult(res);
      await loadHistory();
    } catch (err: any) {
      alert(`Classification error: ${err.response?.data?.detail || err.message}`);
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
              message: `Learned! Next scan of this material will be recognized as ${res.immediate_new_prediction}`,
            }
          : null
      );
      await loadHistory();
    } catch (err: any) {
      alert(`Teaching failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsTeaching(false);
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
            Waste Detection & AI Classification
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Center-crops to 128×128, extracts 32-D features, and evaluates Pearson correlation similarity against memory.
          </p>
        </div>

        {/* Source Selector Pills */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/80 shrink-0">
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
        </div>
      </div>

      {/* Main Grid: Viewfinder & Prediction Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Source (Webcam / Upload / ESP32) */}
        <div className="lg:col-span-7 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[460px]">
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              {sourceMode === 'WEBCAM' && 'Live Browser Viewfinder'}
              {sourceMode === 'UPLOAD' && 'Image Upload & Dropzone'}
              {sourceMode === 'ESP32' && `ESP32-CAM Stream (${activeMode})`}
            </span>
            <span className="text-xs font-mono text-slate-400">128 × 128 Bilinear Target</span>
          </div>

          {/* Center Display Area */}
          <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-xl bg-slate-950/80 border border-slate-800 p-2 min-h-[300px]">
            {/* Mode 1: Webcam Feed */}
            {sourceMode === 'WEBCAM' && (
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                <video
                  ref={videoRef}
                  className={`w-full max-h-[340px] object-contain rounded-lg ${isCameraActive ? 'block' : 'hidden'}`}
                  autoPlay
                  playsInline
                  muted
                />

                {!isCameraActive && (
                  <div className="text-center p-6">
                    <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-300 mb-1">Webcam Inactive</p>
                    <p className="text-xs text-slate-500 max-w-sm mb-4">
                      Enable your browser camera to capture real-world waste items for classification.
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

            {/* Mode 2: Drag & Drop Upload */}
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

            {/* Mode 3: ESP32-CAM Snapshot */}
            {sourceMode === 'ESP32' && (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                {previewUrl ? (
                  <div className="max-h-[300px] flex flex-col items-center">
                    <img src={previewUrl} alt="ESP32 snapshot" className="max-h-[220px] rounded-lg object-contain shadow-lg mb-3" />
                    <span className="text-[11px] text-slate-400 font-mono mb-3">Frame captured from ESP32 camera node</span>
                  </div>
                ) : (
                  <div>
                    <Cpu className="w-12 h-12 text-blue-400/60 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-white mb-1">ESP32-CAM Frame Capture</h4>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">
                      {activeMode === 'SIMULATION'
                        ? 'Simulation Mode: Generates synthetic test camera frames for testing AI classification.'
                        : 'Real Hardware Mode: Requests live HTTP snapshot from 192.168.4.10/capture.'}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleESP32Capture}
                  disabled={isAnalyzing}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Capturing & Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Capture from ESP32-CAM</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="border-t border-slate-700/60 pt-4 flex items-center justify-between mt-4">
            {sourceMode === 'WEBCAM' ? (
              <div className="flex items-center gap-3 w-full justify-between">
                <span className="text-xs text-slate-400">
                  {isCameraActive ? 'Camera streaming active' : 'Click start to open viewfinder'}
                </span>
                <div className="flex gap-2">
                  {isCameraActive ? (
                    <>
                      <button
                        onClick={stopCamera}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                      >
                        Stop Camera
                      </button>
                      <button
                        onClick={captureWebcamFrame}
                        disabled={isAnalyzing}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                      >
                        {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Capture & Classify</span>
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
            ) : (
              <div className="flex items-center justify-between w-full text-xs text-slate-400">
                <span>Direct FastAPI preprocessing pipeline</span>
                <span>Aspect: Center-Crop 1:1</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Classification Results & Learning Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Prediction Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                AI Inference Result
              </span>
              <span className="text-xs font-mono text-slate-400">{result?.model_version || 'v1.0 TinyML'}</span>
            </div>

            {isAnalyzing ? (
              <div className="py-12 text-center">
                <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white">Extracting 32-D Features...</h4>
                <p className="text-xs text-slate-400 mt-1">Evaluating Pearson correlation against trained centroids</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Result Hero Banner */}
                <div
                  className={`p-5 rounded-xl border text-center ${
                    CATEGORY_COLORS[result.category].bg
                  } ${CATEGORY_COLORS[result.category].border}`}
                >
                  <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    {result.category === 'UNKNOWN' ? 'Unrecognized Material' : 'Detected Waste Category'}
                  </div>
                  <div className={`text-3xl font-extrabold ${CATEGORY_COLORS[result.category].text}`}>
                    {result.category}
                  </div>
                  <div className="text-xs font-medium text-slate-300 mt-1">
                    Confidence: {(result.confidence * 100).toFixed(1)}% ({result.confidence_level})
                  </div>
                </div>

                {/* Similarity & Memory status */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Pearson Similarity (r):</span>
                    <span className="font-mono font-bold text-white">{result.similarity.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Memory Match Threshold:</span>
                    <span className="font-mono text-slate-300">r ≥ 0.70</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">In Trained Memory:</span>
                    <span className={result.is_known_in_memory ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {result.is_known_in_memory ? 'Yes (Centroid / Exemplar)' : 'No (Zero-Guessing)'}
                    </span>
                  </div>
                </div>

                {/* Probability Distribution */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>Softmax Probability Distribution</span>
                    <span className="text-[11px] text-slate-500 font-normal">W, D, P, M</span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(result.probabilities).map(([cat, prob]) => {
                      const typedCat = cat as WasteCategory;
                      const colors = CATEGORY_COLORS[typedCat] || CATEGORY_COLORS.UNKNOWN;
                      const pct = Math.round(prob * 100);
                      return (
                        <div key={cat} className="space-y-0.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-300">{cat}</span>
                            <span className="font-mono text-slate-400">{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* User-Assisted Teaching Prompt (When UNKNOWN or Requires Label) */}
                {result.requires_user_label && (
                  <div className="bg-amber-950/40 border border-amber-600/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-amber-300 uppercase">Teach AI Memory</h5>
                        <p className="text-xs text-slate-300 mt-0.5">
                          This item's similarity is below 0.70. Select the correct category below to teach the model (1-Shot Online Adaptation):
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleTeachCategory('PLASTIC')}
                        disabled={isTeaching}
                        className="py-2 px-3 rounded-lg bg-blue-900/60 hover:bg-blue-800 border border-blue-600/80 text-blue-200 text-xs font-bold transition-all"
                      >
                        Teach PLASTIC
                      </button>
                      <button
                        onClick={() => handleTeachCategory('METAL')}
                        disabled={isTeaching}
                        className="py-2 px-3 rounded-lg bg-amber-900/60 hover:bg-amber-800 border border-amber-600/80 text-amber-200 text-xs font-bold transition-all"
                      >
                        Teach METAL
                      </button>
                      <button
                        onClick={() => handleTeachCategory('WET')}
                        disabled={isTeaching}
                        className="py-2 px-3 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-600/80 text-emerald-200 text-xs font-bold transition-all"
                      >
                        Teach WET / Bio
                      </button>
                      <button
                        onClick={() => handleTeachCategory('DRY')}
                        disabled={isTeaching}
                        className="py-2 px-3 rounded-lg bg-purple-900/60 hover:bg-purple-800 border border-purple-600/80 text-purple-200 text-xs font-bold transition-all"
                      >
                        Teach DRY / Paper
                      </button>
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

                {/* Direct Action to Sorting Page when Recognized */}
                {result.category !== 'UNKNOWN' && (
                  <div className="pt-2">
                    <button
                      onClick={() => navigate('/sorting')}
                      className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Proceed to Actuate & Sort into {result.category}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No scan performed yet. Capture or upload an image to begin.</p>
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
            <h3 className="font-semibold text-white text-sm">Recent Detections</h3>
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
