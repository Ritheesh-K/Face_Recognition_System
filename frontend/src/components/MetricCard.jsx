import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'cyan',
  badge,
  onClick
}) {
  const colorMap = {
    cyan: 'from-cyan-500/20 to-blue-500/5 text-cyan-400 border-cyan-500/20 hover:border-cyan-500/50',
    emerald: 'from-emerald-500/20 to-teal-500/5 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/50',
    indigo: 'from-indigo-500/20 to-purple-500/5 text-indigo-400 border-indigo-500/20 hover:border-indigo-500/50',
    blue: 'from-blue-500/20 to-cyan-500/5 text-blue-400 border-blue-500/20 hover:border-blue-500/50',
    amber: 'from-amber-500/20 to-orange-500/5 text-amber-400 border-amber-500/20 hover:border-amber-500/50',
    purple: 'from-purple-500/20 to-pink-500/5 text-purple-400 border-purple-500/20 hover:border-purple-500/50',
    rose: 'from-rose-500/20 to-pink-500/5 text-rose-400 border-rose-500/20 hover:border-rose-500/50',
  };

  const currentTheme = colorMap[color] || colorMap.cyan;

  return (
    <div 
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:scale-[1.03] active:scale-[0.98] group hover:shadow-xl' : ''
      }`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${currentTheme} rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none`} />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition-colors">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-xl bg-slate-900 border ${currentTheme} group-hover:scale-110 transition-transform`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
          {value}
        </span>
        {badge && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        {onClick && (
          <span className="text-[10px] text-cyan-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-0.5 ml-2">
            <span>View</span>
            <ArrowUpRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}
