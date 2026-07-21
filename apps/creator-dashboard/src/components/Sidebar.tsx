import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  DollarSign,
  UserCircle,
  Settings,
  Zap,
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/revenue', icon: <DollarSign size={20} />, label: 'Revenue' },
  { to: '/creator', icon: <UserCircle size={20} />, label: 'Creator' },
  { to: '/settings', icon: <Settings size={20} />, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-surface-raised border-r border-border flex flex-col z-40">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Zap size={18} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Creator Hub</div>
          <div className="text-[11px] text-foreground-muted">Open Factory</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-overlay'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <div className="text-[11px] text-foreground-muted">v1.0.0</div>
      </div>
    </aside>
  );
}
