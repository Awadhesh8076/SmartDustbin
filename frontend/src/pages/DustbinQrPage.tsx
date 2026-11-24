import React, { useState } from 'react';
import { QrCode, Wifi, Smartphone, Printer, Sparkles, Copy, Check } from 'lucide-react';

export const DustbinQrPage: React.FC = () => {
  const currentHost = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  const portalUrl = `${window.location.protocol}//${currentHost}${port}/throw`;

  const wifiSSID = 'SmartDustbin';
  const wifiPass = 'dustbin1234';

  const wifiQrData = `WIFI:T:WPA;S:${wifiSSID};P:${wifiPass};;`;
  const portalQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(portalUrl)}`;
  const wifiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(wifiQrData)}`;

  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <QrCode className="w-7 h-7 text-emerald-400" />
            Dustbin QR Code & Mobile User Portal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Print or display these QR codes on the physical SmartDustbin for instant user connection and rewards.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all self-start md:self-auto"
        >
          <Printer className="w-4 h-4" />
          <span>Print Stickers</span>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QR 1: Mobile Portal */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 shadow-xl">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Sticker 1: Scan to Throw & Earn</span>
          </div>

          <div className="p-4 bg-white rounded-2xl shadow-inner my-2">
            <img src={portalQrUrl} alt="Throw & Earn QR Code" className="w-48 h-48 object-contain" />
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">User Disposal & Rewards App</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              When a user scans this with their phone camera, it immediately opens the clean mobile disposal interface.
            </p>
          </div>

          {/* Quick link button */}
          <div className="w-full flex items-center gap-2 pt-2">
            <input 
              readOnly 
              value={portalUrl} 
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono"
            />
            <button
              onClick={copyUrl}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center gap-1 border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* QR 2: Wi-Fi Hotspot */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 shadow-xl">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full">
            <Wifi className="w-3.5 h-3.5" />
            <span>Sticker 2: Dustbin Wi-Fi Connect</span>
          </div>

          <div className="p-4 bg-white rounded-2xl shadow-inner my-2">
            <img src={wifiQrUrl} alt="Wi-Fi Connect QR Code" className="w-48 h-48 object-contain" />
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">Auto-Connect to Dustbin Hotspot</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              Phone cameras auto-join the dustbin's Wi-Fi network with zero typing required.
            </p>
          </div>

          <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-left space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Wi-Fi Name (SSID):</span>
              <span className="font-mono font-bold text-slate-200">{wifiSSID}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Password:</span>
              <span className="font-mono text-slate-200">{wifiPass}</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Journey Walkthrough */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          Physical Dustbin User Journey
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/60 space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">1</div>
            <div className="font-semibold text-white">Scan Dustbin QR</div>
            <p className="text-slate-400">User scans the sticker on the physical bin with their phone camera.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/60 space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">2</div>
            <div className="font-semibold text-white">Drop Waste Item</div>
            <p className="text-slate-400">User places waste into the top bin hatch and taps "Scan & Sort".</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/60 space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">3</div>
            <div className="font-semibold text-white">Dual-Servo Sorting</div>
            <p className="text-slate-400">ESP32-CAM images the item, TinyML classifies it, and DevKit drops it into the proper chute.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/60 space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">4</div>
            <div className="font-semibold text-white">Instant Rewards</div>
            <p className="text-slate-400">Verified Eco Coins credit immediately to the user's mobile screen.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
