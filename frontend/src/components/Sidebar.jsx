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
  Cpu,
  Layers,
  ShieldCheck,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  systemSettings, 
  backendOnline, 
  enrolledCount,
  mobileOpen,
  setMobileOpen
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'enroll', label: 'Enroll Person', icon: UserPlus, badge: null },
    { id: 'recognize', label: 'Recognize Face', icon: Scan, badge: 'Live' },
    { id: 'persons', label: 'Persons Database', icon: Users, badge: enrolledCount > 0 ? enrolledCount : null },
    { id: 'history', label: 'Recognition History', icon: History, badge: null },
    { id: 'evaluation', label: 'Threshold Calibration', icon: BarChart3, badge: 'Val' },
    { id: 'settings', label: 'Settings', icon: Sliders, badge: null },
    { id: 'docs', label: 'Documentation', icon: BookOpen, badge: null },
  ];

  const thresholdDisplay = systemSettings?.matching_threshold !== undefined
    ? Number(systemSettings.matching_threshold).toFixed(2)
    : '0.50';

  const NavContent = () => (
    <div className="flex flex-col h-full justify-between p-4">
      {/* Brand & Header */}
      <div>
        <div 
          onClick={() => {
            setActiveTab('dashboard');
            if (setMobileOpen) setMobileOpen(false);
          }}
          className="flex items-center gap-3 px-2 py-3 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
            <Scan className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                FaceID<span className="text-cyan-400">.ai</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">ArcFace 512D Identification</p>
          </div>
        </div>

        {/* Separator */}
        <div className="my-4 border-t border-slate-800/80" />

        {/* Nav Links */}
        <nav className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Biometric Suite
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-item-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (setMobileOpen) setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    isActive 
                      ? 'bg-cyan-500 text-slate-950' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Telemetry Card */}
      <div className="space-y-3 pt-4 border-t border-slate-800/80">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-semibold">Inference Engine:</span>
            <div className={`flex items-center gap-1.5 text-[11px] font-mono font-bold ${
              backendOnline ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{backendOnline ? 'ONNX CPU' : 'Offline'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
            <span className="text-slate-400 font-semibold">Active Threshold (τ):</span>
            <button
              onClick={() => {
                setActiveTab('evaluation');
                if (setMobileOpen) setMobileOpen(false);
              }}
              title="Click to calibrate threshold"
              className="font-mono font-bold text-cyan-300 hover:underline"
            >
              {thresholdDisplay}
            </button>
          </div>
        </div>

        <div className="px-2 text-[10px] text-slate-500 text-center font-mono">
          Local SCRFD + ArcFace • Offline
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800/80 bg-slate-950/90 backdrop-blur-xl shrink-0 h-screen sticky top-0 z-40">
        <NavContent />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 lg:hidden"
        />
      )}

      {/* Mobile Drawer */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex justify-end p-2">
          <button 
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <NavContent />
      </div>
    </>
  );
}
