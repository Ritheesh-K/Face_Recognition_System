import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Shield,
  RefreshCw,
  ChevronsLeft,
  ChevronsRight,
  Info
} from 'lucide-react';
import { getLogs, clearLogs, deleteSingleLog } from '../services/api';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const StatusBadge = ({ status }) => {
  const isMatch = status === 'MATCH' || status === 'KNOWN';
  const isNoFace = status === 'NO_FACE';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
      isMatch
        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
        : isNoFace
        ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
        : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
    }`}>
      {isMatch ? <ShieldCheck className="w-3 h-3" /> : isNoFace ? <AlertCircle className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      <span>{isMatch ? 'KNOWN' : isNoFace ? 'NO_FACE' : 'UNKNOWN'}</span>
    </span>
  );
};

const formatDateTime = (ts) => {
  if (!ts) return { local: '—', date: '—', time: '—', iso: '' };
  try {
    let str = String(ts);
    if (!str.endsWith('Z') && !str.includes('+') && !str.slice(10).includes('-')) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return { local: String(ts), date: String(ts), time: '', iso: String(ts) };

    const dateStr = d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    return {
      local: `${dateStr}, ${timeStr}`,
      date: dateStr,
      time: timeStr,
      iso: d.toISOString()
    };
  } catch {
    return { local: String(ts), date: String(ts), time: '', iso: String(ts) };
  }
};

export default function HistoryPage({ onClearLogs, initialFilter = 'ALL' }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialFilter || 'ALL');

  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [inspectLog, setInspectLog] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await getLogs(params);
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, dateFrom, dateTo, page, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, dateFrom, dateTo, pageSize]);

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all recognition history? This action cannot be undone.')) return;
    try {
      await clearLogs();
      fetchLogs();
      if (onClearLogs) onClearLogs();
    } catch {
      alert('Failed to clear logs.');
    }
  };

  const handleDeleteSingleLog = async (logId) => {
    if (!window.confirm(`Delete recognition record #${logId}? This action cannot be undone.`)) return;
    setDeletingId(logId);
    try {
      await deleteSingleLog(logId);
      if (inspectLog && inspectLog.id === logId) {
        setInspectLog(null);
      }
      await fetchLogs();
      if (onClearLogs) onClearLogs();
    } catch (err) {
      alert("Failed to delete recognition record.");
    } finally {
      setDeletingId(null);
    }
  };

  const goToPage = (p) => setPage(Math.max(1, Math.min(p, totalPages)));

  return (
    <div className="space-y-8">

      {/* Privacy Notice Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-950/50 border border-indigo-800/50">
        <Shield className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-indigo-300">Privacy &amp; Data Retention Notice</p>
          <p className="text-xs text-indigo-400/80 mt-0.5 leading-relaxed">
            Recognition logs contain biometric-adjacent data including face similarity scores.
            Probe images are automatically deleted after <strong className="text-indigo-300">{window.__RETENTION_DAYS || 30} days</strong> per the configured
            retention policy. Raw face embeddings are never stored in this log. This system is intended
            for local academic/internship demonstration use only.
          </p>
        </div>
        <button onClick={() => setShowPrivacy(true)} className="text-indigo-400 hover:text-indigo-200 flex-shrink-0">
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <History className="w-7 h-7 text-cyan-400" />
            Recognition History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {total > 0 ? (
              <>Showing <strong className="text-slate-200">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)}</strong> of <strong className="text-slate-200">{total}</strong> audit records</>
            ) : 'Complete chronological audit trail of all identification events.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-semibold transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {total > 0 && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 text-xs font-semibold transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 glass-panel p-4 rounded-2xl border border-slate-800">
        {/* Status tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'KNOWN', 'UNKNOWN', 'NO_FACE'].map((st) => (
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

        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 w-full sm:w-52">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by person name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
            className="bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-600"
          />
          <span className="text-slate-600 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
            className="bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-600"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-slate-500 hover:text-rose-400 transition-colors"
              title="Clear date filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Page size */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Show</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-slate-900/80 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500">per page</span>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
            Loading audit history…
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Clock className="w-8 h-8 text-slate-600 mb-2" />
            <span className="font-semibold text-slate-300">No Recognition Records</span>
            <span className="text-xs text-slate-500 mt-1">
              Events will appear here as soon as images are evaluated through the recognition interface.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Probe Crop</th>
                  <th className="py-3 px-4">Person</th>
                  <th className="py-3 px-4">Similarity</th>
                  <th className="py-3 px-4">Threshold</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {logs.map((log, idx) => (
                  <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-mono text-[10px]">
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                      <div className="font-semibold text-slate-200">{formatDateTime(log.timestamp).date}</div>
                      <div className="text-[10px] text-slate-500">{formatDateTime(log.timestamp).time}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 overflow-hidden border border-slate-800 flex items-center justify-center">
                        {log.query_image_path ? (
                          <img
                            src={`/media/${log.query_image_path}`}
                            alt="Crop"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-600">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {log.matched_name || <span className="text-slate-600 font-normal italic">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {log.similarity_score != null ? Number(log.similarity_score).toFixed(4) : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {log.threshold_used != null ? Number(log.threshold_used).toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {log.latency_ms != null ? `${log.latency_ms} ms` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectLog(log)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSingleLog(log.id)}
                          disabled={deletingId === log.id}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all disabled:opacity-40"
                          title={`Delete record #${log.id}`}
                        >
                          {deletingId === log.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-500">
            Page <strong className="text-slate-300">{page}</strong> of <strong className="text-slate-300">{totalPages}</strong>
            {' '}· {total} total records
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={page === 1}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (page <= 4) {
                p = i + 1;
              } else if (page >= totalPages - 3) {
                p = totalPages - 6 + i;
              } else {
                p = page - 3 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                    p === page
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={page === totalPages}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Privacy Detail */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-3xl border border-indigo-800/50 p-6 sm:p-8 relative">
            <button onClick={() => setShowPrivacy(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-900/60 flex items-center justify-center border border-indigo-700/50">
                <Shield className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Privacy &amp; Data Handling Policy</h3>
            </div>
            <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="font-semibold text-slate-200 mb-1">What is stored</p>
                <p>Recognition events are logged with: timestamp, detection status, matched identity name (if any), cosine similarity score, threshold value, and processing latency. Probe thumbnail images may also be stored if the image retention feature is enabled.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="font-semibold text-slate-200 mb-1">What is NOT stored</p>
                <p>Raw face embedding vectors (512-dimensional biometric floats) are <strong className="text-slate-300">never</strong> stored in the recognition log. They are computed in memory only and used for matching.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="font-semibold text-slate-200 mb-1">Image retention</p>
                <p>Probe images (query thumbnails) are automatically deleted after <strong className="text-slate-300">{window.__RETENTION_DAYS || 30} days</strong> by the background retention-cleanup daemon. You can adjust this in Settings or set <code className="text-cyan-400">IMAGE_RETENTION_DAYS=0</code> in the <code className="text-cyan-400">.env</code> file to disable probe image storage entirely.</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40">
                <p className="font-semibold text-amber-300 mb-1">Academic / Local Use Only</p>
                <p className="text-amber-400/80">This system is designed for local internship demonstration purposes. It is <strong className="text-amber-300">not certified</strong> for production biometric security applications or GDPR/CCPA regulated environments without additional legal and technical review.</p>
              </div>
            </div>
            <div className="pt-6 mt-2 flex justify-end">
              <button
                onClick={() => setShowPrivacy(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Log Inspector */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-3xl border border-slate-700 p-6 sm:p-8 relative">
            <button
              onClick={() => setInspectLog(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">
              Audit Record <span className="text-slate-500 font-mono text-base">#{inspectLog.id}</span>
            </h3>

            <div className="space-y-4">
              {inspectLog.query_image_path && (
                <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden mx-auto mb-2">
                  <img
                    src={`/media/${inspectLog.query_image_path}`}
                    alt="Probe Face"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Status</span>
                  <StatusBadge status={inspectLog.status} />
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Matched Identity</span>
                  <span className="font-bold text-white">{inspectLog.matched_name || '—'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Cosine Similarity</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {inspectLog.similarity_score != null ? Number(inspectLog.similarity_score).toFixed(6) : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Operating Threshold</span>
                  <span className="font-mono font-bold text-slate-300">
                    {inspectLog.threshold_used != null ? Number(inspectLog.threshold_used).toFixed(4) : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Latency</span>
                  <span className="font-mono text-slate-300">{inspectLog.latency_ms != null ? `${inspectLog.latency_ms} ms` : '—'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Faces Detected</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {inspectLog.detected_face_count ?? inspectLog.faces_detected ?? (inspectLog.status === 'NO_FACE' ? 0 : 1)} face{((inspectLog.detected_face_count ?? inspectLog.faces_detected ?? (inspectLog.status === 'NO_FACE' ? 0 : 1)) !== 1) ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Recorded Date &amp; Time
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Local Time
                  </span>
                </div>
                <div className="text-sm font-bold text-white font-mono">
                  {formatDateTime(inspectLog.timestamp).local}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  UTC (ISO 8601): {formatDateTime(inspectLog.timestamp).iso}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/30 text-xs text-indigo-400/80">
                <Shield className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />
                Raw face embedding vectors are not stored in this log record.
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  const id = inspectLog.id;
                  handleDeleteSingleLog(id);
                }}
                disabled={deletingId === inspectLog.id}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/80 text-xs font-semibold transition-all disabled:opacity-40"
              >
                {deletingId === inspectLog.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete Record</span>
              </button>
              <button
                onClick={() => setInspectLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
