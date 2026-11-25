import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Award, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  Camera, 
  Layers, 
  Edit3,
  Video,
  VideoOff
} from 'lucide-react';
import { api } from '../services/api';
import { DetectionResult, WasteCategory } from '../types/api';

const REWARD_MAP: Record<WasteCategory, number> = {
  METAL: 5,
  PLASTIC: 3,
  DRY: 2,
  WET: 1,
  UNKNOWN: 0
};

const CATEGORIES: { label: string; value: WasteCategory; color: string }[] = [
  { label: 'Plastic', value: 'PLASTIC', color: 'border-blue-500 text-blue-400 bg-blue-950/40' },
  { label: 'Metal', value: 'METAL', color: 'border-amber-500 text-amber-400 bg-amber-950/40' },
  { label: 'Dry Waste', value: 'DRY', color: 'border-purple-500 text-purple-400 bg-purple-950/40' },
  { label: 'Wet / Organic', value: 'WET', color: 'border-emerald-500 text-emerald-400 bg-emerald-950/40' },
];

export const MobileThrowPage: React.FC = () => {
  // STAGES: IDLE -> CAPTURING -> REVIEW -> SORTING -> COMPLETED -> ERROR
  const [stage, setStage] = useState<'IDLE' | 'CAPTURING' | 'REVIEW' | 'SORTING' | 'COMPLETED' | 'ERROR'>('IDLE');
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [confirmedCategory, setConfirmedCategory] = useState<WasteCategory>('PLASTIC');
  const [coinsEarned, setCoinsEarned] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Webcam Independent State
  const [useWebcam, setUseWebcam] = useState<boolean>(true);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize or stop live webcam stream
  const startWebcam = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('Webcam permission error:', err);
      setIsCameraActive(false);
      setErrorMessage('Could not access laptop webcam. Please grant camera permissions in your browser.');
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (useWebcam && stage === 'IDLE') {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [useWebcam, stage]);

  // Step 1A: Capture from Laptop/Phone Live Webcam
  const handleCaptureFromWebcam = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setErrorMessage('Camera preview is not active.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setErrorMessage('Failed to capture frame from webcam.');
        return;
      }
      setErrorMessage(null);
      setStage('CAPTURING');
      stopWebcam();

      try {
        const result = await api.scanImage(blob, 'BROWSER_WEBCAM');
        setDetection(result);
        const initialCat = (result.category === 'UNKNOWN' ? 'PLASTIC' : result.category) as WasteCategory;
        setConfirmedCategory(initialCat);
        setStage('REVIEW');
      } catch (err: any) {
        setStage('ERROR');
        const msg = err.response?.data?.detail || err.message || 'Error classifying image.';
        setErrorMessage(msg);
      }
    }, 'image/jpeg', 0.9);
  };

  // Step 1B: Capture from ESP32-CAM via network (optional fallback)
  const handleCaptureFromEspCam = async () => {
    setErrorMessage(null);
    setStage('CAPTURING');
    stopWebcam();

    try {
      const result = await api.captureCameraFrame();
      setDetection(result);
      const initialCat = (result.category === 'UNKNOWN' ? 'PLASTIC' : result.category) as WasteCategory;
      setConfirmedCategory(initialCat);
      setStage('REVIEW');
    } catch (err: any) {
      setStage('ERROR');
      const msg = err.response?.data?.detail || err.message || 'Could not connect to ESP32-CAM. Use Laptop Webcam instead!';
      setErrorMessage(msg);
    }
  };

  // Step 2: User confirms or corrects category, then sends actuation command to ESP32 DevKit
  const handleConfirmAndSort = async () => {
    if (!detection) return;
    setErrorMessage(null);
    setStage('SORTING');

    try {
      // Continual Online Learning: ALWAYS update and train model whenever user confirms/corrects category!
      try {
        await api.teachCategory(detection.detection_id, confirmedCategory);
      } catch (teachErr) {
        console.warn('Continual learning update skipped/non-blocking:', teachErr);
      }

      // Send sort & dump command directly to ESP32 DevKit
      const sortRes = await api.executeSorting(confirmedCategory, detection.detection_id);

      if (sortRes.status === 'SUCCESS' || (sortRes.status as any) === 'SIMULATED') {
        setCoinsEarned(sortRes.coins_earned || REWARD_MAP[confirmedCategory] || 1);
        setStage('COMPLETED');
      } else {
        setStage('ERROR');
        setErrorMessage(sortRes.message || 'DevKit sorting actuator failed to respond.');
      }
    } catch (err: any) {
      setStage('ERROR');
      const msg = err.response?.data?.detail || err.message || 'Error communicating with ESP32 DevKit sorter.';
      setErrorMessage(msg);
    }
  };

  // Quick manual disposal without camera requirement
  const handleQuickManualSort = async (cat: WasteCategory) => {
    setConfirmedCategory(cat);
    setErrorMessage(null);
    setStage('SORTING');
    stopWebcam();

    try {
      const sortRes = await api.executeSorting(cat);
      if (sortRes.status === 'SUCCESS' || (sortRes.status as any) === 'SIMULATED') {
        setCoinsEarned(sortRes.coins_earned || REWARD_MAP[cat] || 1);
        setStage('COMPLETED');
      } else {
        setStage('ERROR');
        setErrorMessage(sortRes.message || 'Sorting actuator failed to respond.');
      }
    } catch (err: any) {
      setStage('ERROR');
      const msg = err.response?.data?.detail || err.message || 'Error communicating with ESP32 DevKit sorter.';
      setErrorMessage(msg);
    }
  };

  const handleReset = () => {
    setDetection(null);
    setCoinsEarned(0);
    setErrorMessage(null);
    setStage('IDLE');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto">
      {/* Hidden canvas for capturing video frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header */}
      <header className="py-3 border-b border-slate-800 text-center">
        <div className="inline-flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SmartDustbin Connected</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Smart Eco Disposal</h1>
        <p className="text-xs text-slate-400">Independent Webcam • AI • Real DevKit Dumping</p>
      </header>

      {/* Main Flow Content */}
      <main className="my-auto py-4">
        {/* STAGE 1: IDLE */}
        {stage === 'IDLE' && (
          <div className="text-center space-y-4">
            {/* Camera Source Selector Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setUseWebcam(true)}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  useWebcam ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Laptop Webcam (Direct)</span>
              </button>
              <button
                onClick={() => setUseWebcam(false)}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  !useWebcam ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>ESP32-CAM (Wi-Fi)</span>
              </button>
            </div>

            {/* Live Camera Viewport or Placeholder */}
            {useWebcam ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 aspect-video flex items-center justify-center shadow-lg">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-4">
                    <VideoOff className="w-8 h-8 text-slate-500 mb-2" />
                    <p className="text-xs text-slate-400">Webcam inactive. Click button below to start.</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] text-emerald-400 border border-slate-700/60 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Webcam Feed
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 mx-auto rounded-3xl bg-blue-500/10 border-2 border-dashed border-blue-500/40 flex items-center justify-center">
                <Camera className="w-12 h-12 text-blue-400" />
              </div>
            )}

            {/* Capture Button */}
            {useWebcam ? (
              <button
                onClick={handleCaptureFromWebcam}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Frame & Predict</span>
              </button>
            ) : (
              <button
                onClick={handleCaptureFromEspCam}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Capture from ESP32-CAM</span>
              </button>
            )}

            {/* Instant Manual Dump without Camera */}
            <div className="pt-2">
              <div className="flex items-center gap-2 my-2">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Or Direct Signal to DevKit</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleQuickManualSort(c.value)}
                    className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center justify-between active:scale-95"
                  >
                    <span>{c.label}</span>
                    <span className="text-[10px] text-emerald-400">+{REWARD_MAP[c.value]}c</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STAGE: CAPTURING */}
        {stage === 'CAPTURING' && (
          <div className="text-center space-y-6 py-8">
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              <Camera className="w-10 h-10 text-emerald-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Classifying Waste...</h2>
              <p className="text-xs text-slate-400">Extracting 32-D visual features and running inference</p>
            </div>
          </div>
        )}

        {/* STAGE 2: REVIEW & USER CONFIRMATION */}
        {stage === 'REVIEW' && detection && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Snapshot Image Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 aspect-video flex items-center justify-center shadow-lg">
              {detection.image_url ? (
                <img 
                  src={
                    detection.image_url.startsWith('http') 
                      ? detection.image_url 
                      : detection.image_url.startsWith('/api') 
                        ? detection.image_url 
                        : `/api${detection.image_url}`
                  } 
                  alt="Captured Waste" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes(':8000')) {
                      target.src = `http://${window.location.hostname}:8000${detection.image_url}`;
                    }
                  }}
                />
              ) : (
                <div className="text-xs text-slate-400 flex flex-col items-center gap-1">
                  <Camera className="w-6 h-6 text-slate-500" />
                  <span>Captured Frame Ready</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] text-slate-300 border border-slate-700/60">
                Processed Frame
              </div>
            </div>

            {/* AI Prediction Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  AI Prediction:
                </span>
                <span className={`font-bold uppercase px-2 py-0.5 rounded-md text-xs ${
                  detection.category === 'UNKNOWN' ? 'bg-slate-800 text-slate-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {detection.category}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Confidence:</span>
                <span className="font-mono text-slate-200">{(detection.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Confirm Category */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                  Confirm Waste Type Before Dumping:
                </span>
                <span className="text-[10px] text-emerald-400">+{REWARD_MAP[confirmedCategory]} Coins</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setConfirmedCategory(cat.value)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                      confirmedCategory === cat.value
                        ? `${cat.color} border-2 shadow-sm`
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {confirmedCategory === cat.value && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm & Actuate Button */}
            <div className="pt-2 space-y-2">
              <button
                onClick={handleConfirmAndSort}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-base shadow-lg shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Layers className="w-5 h-5" />
                <span>Send Signal to DevKit & Dump</span>
              </button>

              <button
                onClick={handleReset}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retake / Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* STAGE: SORTING ACTUATION IN PROGRESS */}
        {stage === 'SORTING' && (
          <div className="text-center space-y-6 py-8">
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">
                DevKit Dumping to {confirmedCategory}...
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Rotating chute to compartment, opening flap to 60°, and returning to 0° Home.
              </p>
            </div>
          </div>
        )}

        {/* STAGE 3: COMPLETED & REWARDS */}
        {stage === 'COMPLETED' && (
          <div className="text-center space-y-5 animate-in fade-in duration-300">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Award className="w-12 h-12 text-emerald-400 animate-bounce" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Disposal Confirmed!</span>
              <h2 className="text-3xl font-black text-white">+{coinsEarned} Eco Coins</h2>
              <p className="text-xs text-slate-400">Waste successfully dumped into {confirmedCategory} bin.</p>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all"
            >
              Throw Another Item
            </button>
          </div>
        )}

        {/* STAGE: ERROR */}
        {stage === 'ERROR' && (
          <div className="text-center space-y-5 animate-in fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Notice</h2>
              <p className="text-xs text-red-300 max-w-xs mx-auto">
                {errorMessage || 'Unable to complete sorting cycle.'}
              </p>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-2 text-[10px] text-slate-500">
        SmartDustbin AI & IoT • Independent Webcam System
      </footer>
    </div>
  );
};
