import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import EnrollmentPage from './pages/EnrollmentPage';
import RecognitionPage from './pages/RecognitionPage';
import PersonsPage from './pages/PersonsPage';
import HistoryPage from './pages/HistoryPage';
import EvaluationPage from './pages/EvaluationPage';
import SettingsPage from './pages/SettingsPage';
import DocsPage from './pages/DocsPage';
import { Menu, Scan, SlidersHorizontal, ShieldCheck } from 'lucide-react';

import { getHealth, getSettings, listPersons, getLogs, getLogStats } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [systemSettings, setSystemSettings] = useState(null);
  const [stats, setStats] = useState({
    personCount: 0,
    imageCount: 0,
    totalLogs: 0,
    knownLogs: 0,
    unknownLogs: 0,
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [historyInitialFilter, setHistoryInitialFilter] = useState('ALL');

  const navigateToTab = (tab, filter = null) => {
    if (filter) {
      setHistoryInitialFilter(filter);
    } else if (tab === 'history') {
      setHistoryInitialFilter('ALL');
    }
    setActiveTab(tab);
  };

  const refreshState = async () => {
    try {
      const health = await getHealth();
      setBackendOnline(health?.status === 'healthy');

      const settings = await getSettings();
      setSystemSettings(settings);

      const persons = await listPersons();
      const totalImages = persons.reduce((acc, p) => acc + (p.image_count || 0), 0);

      const logsData = await getLogs({ limit: 10 });
      let logStats = { total: logsData.total || 0, known: 0, unknown: 0 };
      try {
        logStats = await getLogStats();
      } catch {
        // fallback if stats endpoint unavailable
      }

      setStats({
        personCount: persons.length,
        imageCount: totalImages,
        totalLogs: logStats.total || logsData.total || 0,
        knownLogs: logStats.known || 0,
        unknownLogs: logStats.unknown || 0,
      });

      setRecentLogs(logsData.items || []);
    } catch (err) {
      console.warn("Backend connection notice:", err.message);
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Sleek Enterprise Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemSettings={systemSettings}
        backendOnline={backendOnline}
        enrolledCount={stats.personCount}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="lg:hidden border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
                <Scan className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-tight text-white">FaceID.ai</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300">
              τ: {systemSettings?.matching_threshold !== undefined ? systemSettings.matching_threshold.toFixed(2) : '0.50'}
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <Dashboard
                stats={stats}
                setActiveTab={setActiveTab}
                onNavigate={navigateToTab}
                recentLogs={recentLogs}
                systemSettings={systemSettings}
              />
            )}

            {activeTab === 'enroll' && (
              <EnrollmentPage
                onEnrollmentChange={refreshState}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'recognize' && (
              <RecognitionPage
                systemSettings={systemSettings}
                onRecognitionComplete={refreshState}
                onNavigate={setActiveTab}
                enrolledCount={stats.personCount}
              />
            )}

            {activeTab === 'persons' && (
              <PersonsPage
                onDataChange={refreshState}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'history' && (
              <HistoryPage
                onClearLogs={refreshState}
                initialFilter={historyInitialFilter}
              />
            )}

            {activeTab === 'evaluation' && (
              <EvaluationPage
                systemSettings={systemSettings}
                onThresholdUpdate={refreshState}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                systemSettings={systemSettings}
                onSettingsChange={refreshState}
              />
            )}

            {activeTab === 'docs' && (
              <DocsPage />
            )}
          </div>
        </main>

        {/* Professional Minimalist Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/90 py-5 text-xs text-slate-500 px-6 lg:px-10">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400">Face Recognition Identification System</span>
              <span>•</span>
              <span>ArcFace 512D + SCRFD Pipeline</span>
              <span>•</span>
              <span className="text-cyan-400 font-mono font-bold">100% Local Inference</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600">
              <span>SQLite Embedded DB</span>
              <span>•</span>
              <span>ONNX Runtime CPU</span>
              <span>•</span>
              <button
                onClick={() => setActiveTab('docs')}
                className="text-cyan-500/80 hover:text-cyan-400 transition-colors"
              >
                Docs & Architecture
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
