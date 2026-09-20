import React from 'react';
import { 
  LayoutDashboard,
  UserPlus, 
  Scan, 
  Users, 
  History, 
  BarChart3, 
  Sliders, 
  BookOpen, 
  SlidersHorizontal,
  CheckCircle2, 
  AlertCircle,
  Cpu
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  systemSettings, 
  backendOnline, 
  enrolledCount 
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'enroll', label: 'Enroll Person', icon: UserPlus },
    { id: 'recognize', label: 'Recognize Face', icon: Scan },
    { id: 'persons', label: 'Persons Database', icon: Users },
    { id: 'history', label: 'Recognition History', icon: History },
    { id: 'evaluation', label: 'Evaluation', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Sliders },
    { id: 'docs', label: 'Docs', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
              <Scan className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  FaceID<span className="text-cyan-400">.ai</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 hidden sm:inline-block">
                  ArcFace 512D
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden lg:block">Open-Set Biometric Identification</p>
            </div>
          </div>

          {/* Desktop Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Status & Threshold pill */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Threshold badge */}
            <div 
              onClick={() => setActiveTab('settings')}
              title="Click to calibrate matching threshold in Settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer hover:border-cyan-500/50 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <div className="text-xs">
                <span className="text-slate-400 hidden lg:inline">τ: </span>
                <span className="font-semibold text-cyan-300">
                  {systemSettings?.matching_threshold !== undefined ? systemSettings.matching_threshold.toFixed(2) : '0.50'}
                </span>
              </div>
            </div>

            {/* Backend Status indicator */}
            <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium ${
              backendOnline 
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="hidden sm:inline">{backendOnline ? 'ONNX CPU' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Scrollbar */}
        <div className="md:hidden flex items-center py-2 border-t border-slate-800/60 overflow-x-auto gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all ${
                  isActive ? 'text-slate-950 bg-cyan-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
