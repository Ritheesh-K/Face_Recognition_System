import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  AlertCircle,
  Filter,
  Eye,
  X
} from 'lucide-react';
import { getLogs, clearLogs } from '../services/api';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectLog, setInspectLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getLogs({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery || undefined,
        limit: 100,
      });
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, searchQuery]);

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all recognition history?")) return;
    try {
      await clearLogs();
      fetchLogs();
    } catch (err) {
      alert("Failed to clear logs.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <History className="w-7 h-7 text-cyan-400" />
            Recognition Audit Trail
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete cryptographic audit log of all identification attempts, similarity scores, and unknown rejections.
          </p>
        </div>

        {total > 0 && (
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 text-xs font-semibold transition-all self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'MATCH', 'UNKNOWN', 'NO_FACE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading audit history...</div>
      ) : logs.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center text-slate-400">
          No audit logs matching current filter.
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Face Thumbnail</th>
                  <th className="p-4">Decision / Identity</th>
                  <th className="p-4">Cosine Score</th>
                  <th className="p-4">Operating τ</th>
                  <th className="p-4">Latency</th>
                  <th className="p-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => {
                  const isMatch = log.status === 'MATCH';
                  const isUnknown = log.status === 'UNKNOWN';

                  return (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4 text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>

                      <td className="p-4">
                        {log.query_image_path ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                            <img
                              src={`/media/${log.query_image_path}`}
                              alt="Face"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                            N/A
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isMatch
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isUnknown
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {isMatch ? (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            ) : isUnknown ? (
                              <ShieldAlert className="w-3.5 h-3.5" />
                            ) : null}
                            <span>{log.matched_name}</span>
                          </span>
                        </div>
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-200">
                        {(log.similarity_score * 100).toFixed(1)}%
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          ({log.similarity_score.toFixed(4)})
                        </span>
                      </td>

                      <td className="p-4 font-mono text-cyan-400">
                        {log.threshold_used.toFixed(2)}
                      </td>

                      <td className="p-4 text-slate-400 font-mono">
                        {log.latency_ms} ms
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => setInspectLog(log)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* INSPECT MODAL */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-3xl border border-slate-700 p-6 relative">
            <button
              onClick={() => setInspectLog(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Recognition Audit Detail</h3>

            <div className="flex items-center gap-4 mb-5">
              {inspectLog.query_image_path && (
                <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                  <img
                    src={`/media/${inspectLog.query_image_path}`}
                    alt="Query"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <div className="text-xs text-slate-400 font-mono mb-1">
                  {new Date(inspectLog.timestamp).toLocaleString()}
                </div>
                <div className="text-xl font-extrabold text-white">
                  {inspectLog.matched_name}
                </div>
                <div className="text-xs text-cyan-400 font-mono mt-0.5">
                  Status: {inspectLog.status}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Cosine Similarity:</span>
                <span className="font-mono font-bold text-slate-200">
                  {inspectLog.similarity_score.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Threshold Used:</span>
                <span className="font-mono font-bold text-cyan-400">
                  {inspectLog.threshold_used.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Margin (Score - τ):</span>
                <span className={`font-mono font-bold ${
                  inspectLog.similarity_score >= inspectLog.threshold_used ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {(inspectLog.similarity_score - inspectLog.threshold_used).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Inference Latency:</span>
                <span className="font-mono text-slate-200">{inspectLog.latency_ms} ms</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
