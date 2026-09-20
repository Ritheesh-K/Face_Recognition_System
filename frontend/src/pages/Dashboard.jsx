import React from 'react';
import { 
  Users, 
  Scan, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Cpu, 
  Database,
  Sliders,
  CheckCircle2,
  BarChart3,
  Layers,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import MetricCard from '../components/MetricCard';

export default function Dashboard({ 
  stats, 
  setActiveTab, 
  onNavigate,
  recentLogs = [], 
  systemSettings 
}) {
  const thresholdVal = systemSettings?.matching_threshold !== undefined 
    ? Number(systemSettings.matching_threshold).toFixed(2) 
    : '0.50';

  const handleNavigate = (tab, filter) => {
    if (onNavigate) {
      onNavigate(tab, filter);
    } else if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 sm:p-10 border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Biometric Identification System • Local ArcFace Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Face Recognition Dashboard
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            1:N open-set face recognition powered by ArcFace 512D embeddings, 
            SCRFD face detection, 5-point landmark alignment, and empirical threshold calibration.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-dash-recognize"
              onClick={() => handleNavigate('recognize')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02]"
            >
              <Scan className="w-4 h-4 text-slate-950" />
              <span>Recognize Face</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>

            <button
              id="btn-dash-enroll"
              onClick={() => handleNavigate('enroll')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-all"
            >
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Enroll Person</span>
            </button>

            <button
              id="btn-dash-calibrate"
              onClick={() => handleNavigate('evaluation')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-800 transition-all"
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Calibrate Threshold</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Required Dashboard Cards + Current Threshold */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            System Telemetry & Database Metrics
          </h2>
          <span className="text-xs text-slate-500 font-mono">Live SQLite Sync • Click cards to navigate</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* 1. Total People */}
          <MetricCard
            title="Total People"
            value={stats.personCount}
            subtitle="Registered gallery identities"
            icon={Users}
            color="cyan"
            badge="Enrolled"
            onClick={() => handleNavigate('persons')}
          />

          {/* 2. Total Embeddings */}
          <MetricCard
            title="Total Embeddings"
            value={stats.imageCount}
            subtitle="512D ArcFace feature vectors"
            icon={Layers}
            color="indigo"
            badge="512D Blobs"
            onClick={() => handleNavigate('persons')}
          />

          {/* 3. Recognition Attempts */}
          <MetricCard
            title="Recognition Attempts"
            value={stats.totalLogs}
            subtitle="All logged recognition runs"
            icon={Clock}
            color="blue"
            badge="Audit Total"
            onClick={() => handleNavigate('history', 'ALL')}
          />

          {/* 4. Known Matches */}
          <MetricCard
            title="Known Matches"
            value={stats.knownLogs ?? 0}
            subtitle="Verified identities (Score ≥ τ)"
            icon={ShieldCheck}
            color="emerald"
            badge="Match"
            onClick={() => handleNavigate('history', 'KNOWN')}
          />

          {/* 5. Unknown Matches */}
          <MetricCard
            title="Unknown Matches"
            value={stats.unknownLogs ?? 0}
            subtitle="Rejected unknown impostors"
            icon={ShieldAlert}
            color="amber"
            badge="Rejected"
            onClick={() => handleNavigate('history', 'UNKNOWN')}
          />

          {/* 6. Current Threshold */}
          <MetricCard
            title="Current Threshold"
            value={thresholdVal}
            subtitle="Cosine similarity cutoff (τ)"
            icon={Sliders}
            color="purple"
            badge="Operational"
            onClick={() => handleNavigate('evaluation')}
          />
        </div>
      </div>

      {/* Two Column Section: Inference Pipeline Architecture & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Biometric Pipeline Details */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Biometric Engine Pipeline
            </h3>

            <ol className="relative border-l border-slate-800 ml-2 space-y-4 text-xs">
              <li className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-cyan-500 bg-slate-900" />
                <h4 className="font-semibold text-slate-200">1. SCRFD Scale-Invariant Detection</h4>
                <p className="text-slate-400 mt-0.5">Detects multi-face bounding boxes and 5 facial landmark keypoints.</p>
              </li>
              <li className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-cyan-500 bg-slate-900" />
                <h4 className="font-semibold text-slate-200">2. 5-Point Affine Landmark Alignment</h4>
                <p className="text-slate-400 mt-0.5">Warps eyes, nose, and mouth to 112×112 canonical coordinate frame.</p>
              </li>
              <li className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-cyan-500 bg-slate-900" />
                <h4 className="font-semibold text-slate-200">3. ArcFace 512D Deep Embedding</h4>
                <p className="text-slate-400 mt-0.5">MobileFaceNet ONNX extracts continuous feature vector with L2 normalization.</p>
              </li>
              <li className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-cyan-500 bg-slate-900" />
                <h4 className="font-semibold text-slate-200">4. Cosine Similarity Matching</h4>
                <p className="text-slate-400 mt-0.5">Computes dot product similarity between query probe and enrolled templates.</p>
              </li>
              <li className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-cyan-500 bg-slate-900" />
                <h4 className="font-semibold text-slate-200">5. Strict Unknown Rejection (τ = {thresholdVal})</h4>
                <p className="text-slate-400 mt-0.5">Rejects as UNKNOWN if score &lt; {thresholdVal}. Prevents false acceptances.</p>
              </li>
            </ol>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="font-mono">Engine: ONNX CPU</span>
              <span className="text-cyan-400 font-semibold">100% Offline / Zero Cloud</span>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Recognition Feed */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Recent Recognition Activity
              </h3>
              <button
                id="btn-view-history"
                onClick={() => setActiveTab('history')}
                className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-medium transition-colors"
              >
                <span>View Full History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-slate-300">No recognition attempts recorded yet</p>
                <p className="text-xs text-slate-500 mt-1">Upload a face image in 'Recognize Face' to populate audit logs.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {recentLogs.slice(0, 6).map((log) => {
                  const isMatch = log.status === 'MATCH' || log.status === 'KNOWN';
                  const isUnknown = log.status === 'UNKNOWN';
                  const isNoFace = log.status === 'NO_FACE';

                  return (
                    <div key={log.id} className="py-3 flex items-center justify-between hover:bg-slate-800/20 px-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${
                          isMatch 
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' 
                            : isUnknown
                              ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                              : 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                        }`}>
                          {isMatch ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-200">
                              {log.matched_name || 'UNKNOWN'}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              isMatch 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                : isUnknown
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {isMatch ? 'KNOWN' : isUnknown ? 'UNKNOWN' : 'ERROR'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {new Date(log.timestamp).toLocaleTimeString()} • Latency: {log.latency_ms}ms
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-semibold text-slate-300">
                          {isNoFace ? (
                            <span className="text-slate-500">No Face</span>
                          ) : (
                            <span>Similarity: {log.similarity_score.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Threshold: {log.threshold_used.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Storage: SQLite embedded with 512D ArcFace L2-normalized float vectors</span>
            </div>
            <span className="font-mono text-cyan-400">Operational Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
