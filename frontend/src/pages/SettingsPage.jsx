import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  Database, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Server,
  Layers,
  Sparkles
} from 'lucide-react';
import { getSettings, updateSettings, getHealth, clearLogs } from '../services/api';
import ThresholdSlider from '../components/ThresholdSlider';

export default function SettingsPage({ systemSettings, onSettingsChange }) {
  const [threshold, setThreshold] = useState(systemSettings?.matching_threshold || 0.50);
  const [minDetScore, setMinDetScore] = useState(systemSettings?.min_detection_confidence || 0.45);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [healthInfo, setHealthInfo] = useState(null);

  useEffect(() => {
    if (systemSettings?.matching_threshold !== undefined) {
      setThreshold(systemSettings.matching_threshold);
    }
    if (systemSettings?.min_detection_confidence !== undefined) {
      setMinDetScore(systemSettings.min_detection_confidence);
    }
  }, [systemSettings]);

  useEffect(() => {
    getHealth().then(setHealthInfo).catch(console.warn);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const updated = await updateSettings({
        matching_threshold: threshold,
        min_detection_confidence: minDetScore
      });
      setStatusMsg("System configuration successfully saved and applied to runtime engine.");
      if (onSettingsChange) onSettingsChange();
    } catch (err) {
      setErrorMsg("Failed to save settings: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (val) => {
    setThreshold(val);
  };

  const handleClearAuditLogs = async () => {
    if (!window.confirm("Are you sure you want to delete all historical recognition audit logs? This cannot be undone.")) {
      return;
    }
    setClearingLogs(true);
    try {
      await clearLogs();
      setStatusMsg("Recognition audit logs successfully cleared.");
      if (onSettingsChange) onSettingsChange();
    } catch (err) {
      setErrorMsg("Failed to clear logs.");
    } finally {
      setClearingLogs(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Sliders className="w-7 h-7 text-cyan-400" />
            System Configuration & Model Diagnostics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Calibrate biometric matching thresholds, manage security profiles, and inspect local ONNX inference telemetry.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 self-start sm:self-auto hover:scale-[1.02]"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Status Notifications */}
      {statusMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid: Threshold Tuning & Security Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Threshold Slider & Presets (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Matching Threshold Calibration (τ)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Any probe scoring below this threshold is strictly rejected as UNKNOWN.
                </p>
              </div>

              <span className="font-mono text-xl font-extrabold text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-xl border border-cyan-800">
                {threshold.toFixed(2)}
              </span>
            </div>

            {/* Slider Component */}
            <ThresholdSlider
              threshold={threshold}
              onChange={(val) => setThreshold(val)}
            />

            {/* Quick Security Presets */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Operational Security Presets
              </label>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handlePresetSelect(0.65)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    Math.abs(threshold - 0.65) < 0.01
                      ? 'border-rose-500 bg-rose-950/40 text-rose-200'
                      : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>High Security</span>
                    <span className="font-mono text-[11px]">0.65</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Near-zero FAR, gates & finance
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect(0.50)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    Math.abs(threshold - 0.50) < 0.01
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>Balanced</span>
                    <span className="font-mono text-[11px]">0.50</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Equal Error Rate balance
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect(0.42)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    Math.abs(threshold - 0.42) < 0.01
                      ? 'border-amber-500 bg-amber-950/40 text-amber-200'
                      : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>Convenience</span>
                    <span className="font-mono text-[11px]">0.42</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Low false rejection rate
                  </div>
                </button>
              </div>
            </div>

            {/* Minimum Detection Confidence */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Minimum Face Detection Confidence
                </label>
                <span className="text-xs font-mono text-slate-400">
                  {minDetScore.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.05"
                value={minDetScore}
                onChange={(e) => setMinDetScore(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-[11px] text-slate-500">
                Filters out background clutter and blurry non-face objects during detection.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Engine Telemetry & Maintenance (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Machine Learning Engine Telemetry */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Machine Learning Telemetry
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Face Detector</span>
                <span className="font-mono font-semibold text-slate-200">SCRFD 500M (InsightFace)</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Alignment Pipeline</span>
                <span className="font-mono font-semibold text-slate-200">5-Point Affine 112×112</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Feature Extractor</span>
                <span className="font-mono font-semibold text-slate-200">ArcFace 512D ResNet/MBF</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Vector Normalization</span>
                <span className="font-mono font-semibold text-slate-200">L2 Unit Hypersphere</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Execution Provider</span>
                <span className="font-mono font-semibold text-emerald-400">CPUExecutionProvider</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Local Privacy</span>
                <span className="font-semibold text-cyan-400">100% Offline / Zero Cloud</span>
              </div>
            </div>
          </div>

          {/* Database Maintenance */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Storage & Audit Maintenance
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Database Engine:</span>
                <span className="font-mono font-semibold text-slate-200">SQLite + SQLAlchemy</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Database Location:</span>
                <span className="font-mono text-[11px] text-slate-300">backend/data/face_recognition.db</span>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClearAuditLogs}
                  disabled={clearingLogs}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/60 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>{clearingLogs ? 'Clearing Logs...' : 'Clear All Recognition History Logs'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
