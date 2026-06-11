import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Activity, BarChart3, Box, Layers, LogOut, 
  Map, Settings, ShieldAlert, Users, 
  Server, Route, Cpu, Bell, Search 
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: BarChart3, path: '/' },
    { name: 'Peta Jaringan (GIS)', icon: Map, path: '/map' },
    { name: 'Area / Witel', icon: Users, path: '/organizations' },
    { name: 'STO / PoP', icon: Server, path: '/pops' },
    { name: 'Perangkat ODP/ODC', icon: Box, path: '/devices' },
    { name: 'Kabel FO', icon: Route, path: '/cables' },
    { name: 'Penyambungan (Splicing)', icon: Layers, path: '/splicing' },
  ];

  return (
    <div className="flex h-screen w-screen bg-dark-surface overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-dark-border flex flex-col shrink-0 z-20">
        <div className="h-16 flex items-center px-6 border-b border-dark-border">
          <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-bold text-xl mr-3 shadow-sm">
            F
          </div>
          <h1 className="text-xl font-bold text-dark-text tracking-tight">FiberCore</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-1">
          <div className="px-6 mb-2 text-xs font-semibold text-dark-muted uppercase tracking-wider">
            Network Operations
          </div>
          {navItems.map((item) => (
            <div
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span className="text-sm">{item.name}</span>
            </div>
          ))}

          <div className="px-6 mb-2 mt-8 text-xs font-semibold text-dark-muted uppercase tracking-wider">
            System
          </div>
          <div className="sidebar-item">
            <Settings size={18} />
            <span className="text-sm">Settings</span>
          </div>
        </div>

        <div className="p-4 border-t border-dark-border">
          <div 
            onClick={handleLogout}
            className="sidebar-item text-danger hover:bg-danger/10 hover:text-danger mt-auto"
          >
            <LogOut size={18} />
            <span className="text-sm">Sign Out</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <header className="h-16 bg-white border-b border-dark-border flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
              <input 
                type="text" 
                placeholder="Search resources, cores, or incidents..." 
                className="w-full pl-10 pr-4 py-2 bg-dark-card border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-dark-muted hover:text-primary transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-light rounded-full border border-white"></span>
            </button>
            <div className="h-8 w-px bg-dark-border mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-dark-text">{user?.full_name}</p>
                <p className="text-xs text-dark-muted">{user?.role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-accent text-primary flex items-center justify-center font-bold border border-primary/20">
                {user?.full_name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
