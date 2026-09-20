import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Play, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  TrendingUp, 
  CheckCircle2,
  Sliders,
  Info,
  AlertTriangle,
  FileSpreadsheet,
  Table,
  HelpCircle,
  Clock,
  Database,
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Cell
} from 'recharts';
import MetricCard from '../components/MetricCard';
import { runEvaluation, getEvaluationSummary, updateSettings } from '../services/api';

export default function EvaluationPage({ systemSettings, onThresholdUpdate }) {
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await getEvaluationSummary();
      setEvalData(data);
    } catch (err) {
      console.error("Evaluation load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleRunEvaluation = async () => {
    setLoading(true);
    setApplySuccess(null);
    try {
      const data = await runEvaluation();
      setEvalData(data);
    } catch (err) {
      alert("Failed to execute threshold calibration.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyThreshold = async (val, label = "Suggested Threshold") => {
    setApplying(true);
    setApplySuccess(null);
    try {
      await updateSettings({ matching_threshold: val });
      setApplySuccess(`Operating threshold successfully updated to τ = ${val.toFixed(2)} (${label})`);
      if (onThresholdUpdate) onThresholdUpdate();
      fetchSummary();
    } catch (err) {
      alert("Failed to update threshold.");
    } finally {
      setApplying(false);
    }
  };

  const metrics = evalData?.metrics;
  const isInsufficient = evalData?.is_insufficient;
  const warningMsg = evalData?.warning;
  const thresholdTable = evalData?.threshold_table || [];
  const confusionMatrix = evalData?.confusion_matrix;
  const simDist = evalData?.similarity_distribution;
  const testCases = evalData?.test_cases || [];

  const currentThVal = evalData?.current_threshold !== undefined
    ? evalData.current_threshold
    : systemSettings?.matching_threshold !== undefined
      ? systemSettings.matching_threshold
      : 0.50;

  const suggestedThVal = evalData?.suggested_threshold !== undefined
    ? evalData.suggested_threshold
    : metrics?.suggested_threshold !== undefined
      ? metrics.suggested_threshold
      : 0.50;

  // Chart data for Threshold vs FAR / FRR
  const thresholdChartData = thresholdTable.map(row => ({
    threshold: row.threshold.toFixed(2),
    far: Number((row.far * 100).toFixed(2)),
    frr: Number((row.frr * 100).toFixed(2)),
    precision: Number((row.precision * 100).toFixed(1)),
    recall: Number((row.recall * 100).toFixed(1)),
    f1: Number((row.f1 * 100).toFixed(1)),
  }));

  // Chart data for Genuine vs Impostor similarity distribution
  const distributionChartData = [];
  if (simDist) {
    const genuineScores = simDist.genuine_scores || [];
    const impostorScores = simDist.impostor_scores || [];

    for (let i = 0; i < 10; i++) {
      const low = i / 10;
      const high = (i + 1) / 10;
      const binLabel = `${low.toFixed(1)}-${high.toFixed(1)}`;
      
      const genuineCount = genuineScores.filter(s => s >= low && (i === 9 ? s <= high : s < high)).length;
      const impostorCount = impostorScores.filter(s => s >= low && (i === 9 ? s <= high : s < high)).length;

      distributionChartData.push({
        bin: binLabel,
        genuine: genuineCount,
        impostor: impostorCount
      });
    }
  }

  const [sliderVal, setSliderVal] = useState(currentThVal);

  useEffect(() => {
    setSliderVal(currentThVal);
  }, [currentThVal]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Run Calibration Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <SlidersHorizontal className="w-7 h-7 text-cyan-400" />
            Threshold Calibration & Biometric Sensitivity
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Fine-tune facial match sensitivity and empirically test recognition accuracy against benchmark probes.
          </p>
        </div>

        <button
          id="btn-run-calibration"
          onClick={handleRunEvaluation}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-xl shadow-cyan-500/20 transition-all disabled:opacity-50 self-start sm:self-auto hover:scale-[1.02]"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Calibrating Test Probes (~15s)...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Execute Calibration on Validation Data</span>
            </>
          )}
        </button>
      </div>

      {/* Calibration Progress Alert */}
      {loading && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-sm flex items-center gap-3 animate-pulse shadow-lg">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="font-semibold text-cyan-200">AI Model is evaluating test validation probes...</p>
            <p className="text-xs text-cyan-300/80">Calculating Genuine matches vs. Impostor rejections across candidate thresholds. Please wait.</p>
          </div>
        </div>
      )}

      {/* Threshold Apply Notification */}
      {applySuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{applySuccess}</span>
        </div>
      )}

      {/* Interactive Threshold Control & Presets Card */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-cyan-950/20 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              Direct Threshold Controller (Sensitivity Dial)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Drag the slider or choose a preset below to adjust how strictly the AI matches faces across the entire system.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Selected:</span>
            <span className="text-2xl font-black font-mono text-cyan-300 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">
              {sliderVal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Draggable Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0.20"
            max="0.85"
            step="0.01"
            value={sliderVal}
            onChange={(e) => setSliderVal(parseFloat(e.target.value))}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>0.20 (Very Lenient)</span>
            <span className="text-cyan-400 font-semibold">0.50 (Balanced Standard)</span>
            <span>0.85 (Ultra Strict)</span>
          </div>
        </div>

        {/* Quick Presets & Apply Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1 font-semibold">Presets:</span>
            <button
              onClick={() => setSliderVal(0.42)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                Math.abs(sliderVal - 0.42) < 0.01
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              ⚡ Convenience (0.42)
            </button>
            <button
              onClick={() => setSliderVal(0.50)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                Math.abs(sliderVal - 0.50) < 0.01
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              ⚖️ Balanced (0.50)
            </button>
            <button
              onClick={() => setSliderVal(0.65)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                Math.abs(sliderVal - 0.65) < 0.01
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              🛡️ High Security (0.65)
            </button>
          </div>

          <button
            onClick={() => handleApplyThreshold(sliderVal, "Manual Custom Adjustment")}
            disabled={applying || Math.abs(currentThVal - sliderVal) < 0.005}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {Math.abs(currentThVal - sliderVal) < 0.005 ? 'Active Operating Threshold' : 'Apply & Save Threshold'}
          </button>
        </div>
      </div>

      {/* Threshold Comparison Banner (Current vs Suggested) */}
      {!isInsufficient && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Threshold Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Current Operating Threshold (τ)
              </span>
              <div className="text-3xl font-black text-white font-mono">
                {currentThVal.toFixed(2)}
              </div>
              <p className="text-xs text-slate-400 mt-1">Active operational cutoff applied to all live camera queries</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
              <Sliders className="w-6 h-6 text-cyan-400" />
            </div>
          </div>

          {/* Suggested Threshold Card */}
          <div className="p-6 rounded-3xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-slate-900 to-slate-900 shadow-xl shadow-cyan-950/20 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  AI Suggested Threshold (Validation Data)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                  Empirical
                </span>
              </div>
              <div className="text-3xl font-black text-cyan-300 font-mono">
                {suggestedThVal.toFixed(2)}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {Math.abs(currentThVal - suggestedThVal) < 0.01 
                  ? 'Your current threshold is already set to the suggested value.' 
                  : 'Optimal F1 balance calculated from validation probes'}
              </p>
            </div>

            <button
              onClick={() => handleApplyThreshold(suggestedThVal, "Empirical Validation")}
              disabled={applying || Math.abs(currentThVal - suggestedThVal) < 0.01}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {Math.abs(currentThVal - suggestedThVal) < 0.01 ? 'Active (Current)' : 'Apply Suggested'}
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Calibration Principle Callout */}
      <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-3.5 shadow-lg">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-slate-200">Biometric Threshold Calibration Principle</h4>
          <p className="text-slate-400 leading-relaxed">
            Threshold performance depends on the dataset, camera conditions, image quality, lighting, and demographic composition. 
            The suggested threshold is empirically derived from validation data and should not be claimed as universally optimal. 
            Deployments in high-security facilities should calibrate toward higher thresholds (minimizing FAR), while frictionless convenience applications may prioritize lower thresholds (minimizing FRR).
          </p>
        </div>
      </div>

      {/* Threshold Analysis Table */}
      {thresholdTable.length > 0 && !isInsufficient && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Table className="w-4 h-4 text-cyan-400" />
                Threshold Analysis Table
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluation across candidate thresholds comparing Genuine Matches vs. Impostor Rejections.
              </p>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Evaluated: <span className="text-cyan-300 font-bold">{metrics?.genuine_pairs_count || 0} genuine pairs</span> • <span className="text-rose-300 font-bold">{metrics?.impostor_pairs_count || 0} impostor pairs</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-800 font-mono">
                  <th className="py-3 px-4 font-bold">Threshold (τ)</th>
                  <th className="py-3 px-4 font-bold text-rose-400">False Acceptance Rate (FAR)</th>
                  <th className="py-3 px-4 font-bold text-amber-400">False Rejection Rate (FRR)</th>
                  <th className="py-3 px-4 font-bold">Precision</th>
                  <th className="py-3 px-4 font-bold">Recall</th>
                  <th className="py-3 px-4 font-bold text-cyan-400">F1 Score</th>
                  <th className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {thresholdTable.map((row) => {
                  const isCurrent = Math.abs(row.threshold - currentThVal) < 0.01;
                  const isSuggested = Math.abs(row.threshold - suggestedThVal) < 0.01;

                  return (
                    <tr
                      key={row.threshold}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isCurrent 
                          ? 'bg-cyan-950/30 border-l-4 border-l-cyan-400' 
                          : isSuggested
                            ? 'bg-indigo-950/20 border-l-4 border-l-indigo-400'
                            : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-extrabold text-white flex items-center gap-2">
                        <span>{row.threshold.toFixed(2)}</span>
                        {isCurrent && (
                          <span className="text-[10px] uppercase font-sans font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            Current
                          </span>
                        )}
                        {isSuggested && !isCurrent && (
                          <span className="text-[10px] uppercase font-sans font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            Suggested
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-rose-300">
                        {(row.far * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-amber-300">
                        {(row.frr * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {(row.precision * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {(row.recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-cyan-300 font-extrabold">
                        {row.f1.toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => handleApplyThreshold(row.threshold, `τ=${row.threshold.toFixed(2)}`)}
                          disabled={applying || isCurrent}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {isCurrent ? 'Active' : 'Apply'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Threshold Analysis Charts: Threshold vs Error Rates & Similarity Distribution */}
      {!isInsufficient && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart 1: Threshold Analysis Chart (Threshold vs FAR & FRR) */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Threshold Analysis Chart
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Trade-off: False Acceptance Rate (FAR) vs. False Rejection Rate (FRR)
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800">
                EER: {metrics?.eer !== undefined ? `${(metrics.eer * 100).toFixed(1)}%` : '0.0%'}
              </span>
            </div>

            <div className="h-72 w-full flex items-center justify-center">
              {loading ? (
                <div className="text-center p-6 space-y-3">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-cyan-300 font-mono">Calculating error trade-offs...</p>
                </div>
              ) : thresholdChartData.length === 0 ? (
                <div className="text-center p-6 space-y-3">
                  <TrendingUp className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 max-w-xs">
                    Calibration curves not yet generated. Click <span className="text-cyan-400 font-semibold">"Execute Calibration on Validation Data"</span> above to test and plot the error curves.
                  </p>
                  <button
                    onClick={handleRunEvaluation}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-semibold transition-all"
                  >
                    Run Calibration Now
                  </button>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={thresholdChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="threshold" 
                      stroke="#64748b" 
                      label={{ value: 'Threshold (τ)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                      formatter={(val, name) => [`${val}%`, name === 'far' ? 'FAR (False Acceptance)' : name === 'frr' ? 'FRR (False Rejection)' : 'F1 Score']}
                      labelFormatter={(v) => `Threshold: ${v}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="far" 
                      name="FAR (False Acceptance)"
                      stroke="#f43f5e" 
                      strokeWidth={2.5} 
                      dot={{ r: 4, fill: '#f43f5e' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="frr" 
                      name="FRR (False Rejection)"
                      stroke="#f59e0b" 
                      strokeWidth={2.5} 
                      dot={{ r: 4, fill: '#f59e0b' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="f1" 
                      name="F1 Score"
                      stroke="#38bdf8" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Similarity Distribution (Genuine Scores vs Impostor Scores) */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Similarity Score Distribution
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Genuine Similarity (same person) vs. Impostor Similarity (different person / unknown)
                </p>
              </div>
              <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${
                distributionChartData.some(d => d.genuine > 0 || d.impostor > 0)
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                  : 'text-slate-400 bg-slate-900 border-slate-800'
              }`}>
                {distributionChartData.some(d => d.genuine > 0 || d.impostor > 0) ? 'Separation Clear' : 'Awaiting Data'}
              </span>
            </div>

            <div className="h-72 w-full flex items-center justify-center">
              {loading ? (
                <div className="text-center p-6 space-y-3">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-cyan-300 font-mono">Analyzing score distributions...</p>
                </div>
              ) : !distributionChartData.some(d => d.genuine > 0 || d.impostor > 0) ? (
                <div className="text-center p-6 space-y-2">
                  <BarChart3 className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 max-w-xs">
                    Score separation data will display here after executing calibration on validation probes.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="bin" 
                      stroke="#64748b" 
                      label={{ value: 'Cosine Similarity Score Range', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
                    />
                    <YAxis stroke="#64748b" allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="impostor" name="Impostor Scores (Different/Unknown)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="genuine" name="Genuine Scores (Same Person)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confusion Matrix & Detailed Test Cases */}
      {confusionMatrix && !isInsufficient && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Confusion Matrix (6 cols) */}
          <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Confusion Matrix at Current Threshold (τ = {currentThVal.toFixed(2)})
            </h3>
            <p className="text-xs text-slate-400">
              Binary classification mapping of validation attempts.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60">
                <div className="text-[11px] font-bold uppercase text-emerald-400">
                  True Positive (TP)
                </div>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {confusionMatrix.true_positive}
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  Enrolled person correctly accepted
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60">
                <div className="text-[11px] font-bold uppercase text-rose-400">
                  False Positive (FP / FAR)
                </div>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {confusionMatrix.false_positive}
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  Impostor falsely accepted as known
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60">
                <div className="text-[11px] font-bold uppercase text-amber-400">
                  False Negative (FN / FRR)
                </div>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {confusionMatrix.false_negative}
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  Enrolled person rejected below threshold
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/60">
                <div className="text-[11px] font-bold uppercase text-blue-400">
                  True Negative (TN)
                </div>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {confusionMatrix.true_negative}
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  Impostor correctly rejected as UNKNOWN
                </div>
              </div>
            </div>
          </div>

          {/* Individual Test Cases Table (6 cols) */}
          <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Validation Probes Audit ({testCases.length} Test Images)
            </h3>
            <p className="text-xs text-slate-400">
              Probes tested from <span className="font-mono text-cyan-300">evaluation/</span> directory.
            </p>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-950/50">
              {testCases.map((tc, idx) => (
                <div key={idx} className="p-3 text-xs flex items-center justify-between hover:bg-slate-900/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">
                        {tc.ground_truth_label}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        tc.is_correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {tc.classification_category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Probe: {tc.relative_path}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-slate-300 font-semibold">
                      Pred: {tc.predicted_label}
                    </div>
                    <div className="text-[10px] text-cyan-400">
                      Sim: {tc.similarity_score.toFixed(3)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
