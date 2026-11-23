import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanLine,
  BrainCircuit,
  Trash2,
  Coins,
  BarChart3,
  Cpu,
  Settings,
  Recycle,
  X,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Waste Detection', path: '/detection', icon: ScanLine },
  { name: 'AI Learning', path: '/learning', icon: BrainCircuit },
  { name: 'Sorting Control', path: '/sorting', icon: Trash2 },
  { name: 'Eco Rewards', path: '/rewards', icon: Coins },
  { name: 'Learning Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Device Management', path: '/devices', icon: Cpu },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Recycle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">SmartDustbin</h1>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">AI & IoT Platform</span>
            </div>
          </div>

          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onClose && onClose()}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer System Specs */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Architecture</div>
            <div className="text-xs text-slate-300 font-medium">Dual ESP32 + TinyML</div>
            <div className="text-[10px] text-slate-500 mt-0.5">GPIO 18 Chute • GPIO 19 Trap</div>
          </div>
        </div>
      </aside>
    </>
  );
};
