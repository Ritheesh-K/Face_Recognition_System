import React from 'react';
import { Sliders, Shield, ShieldAlert, Sparkles } from 'lucide-react';

export default function ThresholdSlider({
  threshold,
  onChange,
  onSave,
  saving = false
}) {
  const presets = [
    { label: 'Convenience', value: 0.38, desc: 'High Recall (FAR higher)' },
    { label: 'Balanced', value: 0.50, desc: 'Recommended Default' },
    { label: 'High Security', value: 0.65, desc: 'Strict Rejection (FRR higher)' }
  ];

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100">Recognition Threshold (τ)</h4>
            <p className="text-xs text-slate-400">Cosine similarity cutoff for unknown-person rejection</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xl font-extrabold text-cyan-400 bg-cyan-950/50 px-3 py-1 rounded-xl border border-cyan-800/50">
            {Number(threshold).toFixed(2)}
          </span>
          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Set as System Default'}
            </button>
          )}
        </div>
      </div>

      {/* Slider input */}
      <div className="space-y-2">
        <input
          type="range"
          min="0.10"
          max="0.90"
          step="0.01"
          value={threshold}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <div className="flex justify-between text-[11px] font-mono text-slate-500">
          <span>0.10 (Permissive)</span>
          <span>0.50 (Default)</span>
          <span>0.90 (Ultra-Strict)</span>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {presets.map((p) => {
          const isSelected = Math.abs(threshold - p.value) < 0.01;
          return (
            <button
              key={p.label}
              onClick={() => onChange(p.value)}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                isSelected
                  ? 'bg-cyan-950/50 border-cyan-500/80 text-cyan-300 ring-1 ring-cyan-500/40'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              <div className="text-xs font-bold">{p.label}</div>
              <div className="font-mono text-[10px] text-cyan-400 mt-0.5">τ = {p.value.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{p.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
