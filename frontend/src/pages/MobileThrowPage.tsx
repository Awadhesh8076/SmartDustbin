import React, { useState } from 'react';
import { 
  Sparkles, 
  Award, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck,
  CheckCircle2,
  Camera,
  Layers,
  Edit3
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
  // STAGES: IDLE -> CAPTURING -> REVIEW (show predicted output & ask user to confirm) -> SORTING -> COMPLETED
  const [stage, setStage] = useState<'IDLE' | 'CAPTURING' | 'REVIEW' | 'SORTING' | 'COMPLETED' | 'ERROR'>('IDLE');
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [confirmedCategory, setConfirmedCategory] = useState<WasteCategory>('PLASTIC');
  const [coinsEarned, setCoinsEarned] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Capture photo from ESP32-CAM and get AI Prediction
  const handleCaptureFromCamera = async () => {
    setErrorMessage(null);
    setStage('CAPTURING');

    try {
      const result = await api.captureCameraFrame();
      setDetection(result);
      
      // Default confirmed category to predicted category (if known) or PLASTIC
      const initialCat = (result.category === 'UNKNOWN' ? 'PLASTIC' : result.category) as WasteCategory;
      setConfirmedCategory(initialCat);
      setStage('REVIEW');
    } catch (err: any) {
      setStage('ERROR');
      const msg = err.response?.data?.detail || err.message || 'Could not connect to ESP32-CAM. Make sure camera is on and bin hatch is illuminated.';
      setErrorMessage(msg);
    }
  };

  // Step 2: User confirms or corrects category, then sends actuation command to ESP32 DevKit
  const handleConfirmAndSort = async () => {
    if (!detection) return;
    setErrorMessage(null);
    setStage('SORTING');

    try {
      // If user corrected category, optionally teach the AI
      if (detection.category !== confirmedCategory && detection.category === 'UNKNOWN') {
        try {
          await api.teachCategory(detection.detection_id, confirmedCategory);
        } catch {
          // Non-blocking
        }
      }

      // Send sort command to DevKit
      const sortRes = await api.executeSorting(confirmedCategory, detection.detection_id);

      if (sortRes.status === 'SUCCESS' || (sortRes.status as any) === 'SIMULATED') {
        setCoinsEarned(sortRes.coins_earned || REWARD_MAP[confirmedCategory] || 1);
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
      {/* Top Header */}
      <header className="py-3 border-b border-slate-800 text-center">
        <div className="inline-flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SmartDustbin Connected</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Smart Eco Disposal</h1>
        <p className="text-xs text-slate-400">Capture • AI Prediction • Confirm • Physical Sort</p>
      </header>

      {/* Main Flow Content */}
      <main className="my-auto py-4">
        {/* STAGE 1: IDLE */}
        {stage === 'IDLE' && (
          <div className="text-center space-y-6">
            <div className="w-28 h-28 mx-auto rounded-3xl bg-emerald-500/10 border-2 border-dashed border-emerald-500/40 flex items-center justify-center animate-pulse">
              <Camera className="w-14 h-14 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">1. Place Item in Hatch</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Drop your item in the top compartment. ESP32-CAM will take a photo and predict the waste type.
              </p>
            </div>

            <button
              onClick={handleCaptureFromCamera}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-base shadow-lg shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              <span>Capture & Predict Waste</span>
            </button>
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
              <h2 className="text-base font-bold text-white">Capturing from ESP32-CAM...</h2>
              <p className="text-xs text-slate-400">Extracting 32-D features and running AI classification</p>
            </div>
          </div>
        )}

        {/* STAGE 2: REVIEW & USER CONFIRMATION */}
        {stage === 'REVIEW' && detection && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Camera Snapshot Image */}
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
                  alt="ESP32-CAM Input" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if proxy path issue
                    const target = e.currentTarget;
                    if (!target.src.includes(':8000')) {
                      target.src = `http://${window.location.hostname}:8000${detection.image_url}`;
                    }
                  }}
                />
              ) : (
                <div className="text-xs text-slate-400 flex flex-col items-center gap-1">
                  <Camera className="w-6 h-6 text-slate-500" />
                  <span>Captured Frame Received</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] text-slate-300 border border-slate-700/60">
                ESP32-CAM Feed
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
                <span className="text-slate-400">Similarity Confidence:</span>
                <span className="font-mono text-slate-200">{(detection.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Step: User Confirms or Selects Category */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                  Confirm Waste Type Before Sorting:
                </span>
                <span className="text-[10px] text-emerald-400">+{REWARD_MAP[confirmedCategory]} Coins</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setConfirmedCategory(cat.value)}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
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
                <span>Confirm & Actuate Servos</span>
              </button>

              <button
                onClick={handleCaptureFromCamera}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retake Photo</span>
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
                DevKit Actuating Dual Servos...
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Aligning chute to {confirmedCategory} angle, opening trapdoor flap, and dropping item into bin.
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
              <p className="text-xs text-slate-400">Waste sorted into {confirmedCategory} compartment.</p>
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
        SmartDustbin AI & IoT • Anti-Fraud Verified Actuation
      </footer>
    </div>
  );
};
