import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Activity, Map as MapIcon, Box, Server, LogOut, Search } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-bg">
      {/* Sidebar */}
      <aside className="w-64 glass-panel m-4 flex flex-col z-10">
        <div className="p-6 border-b border-dark-border">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent flex items-center gap-2">
            <Activity className="text-primary" />
            FiberCore
          </h1>
          <p className="text-xs text-dark-muted mt-1 uppercase tracking-wider font-mono">Enterprise Edition</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink to="/" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Activity size={18} /> <span>Dashboard</span>
          </NavLink>
          <NavLink to="/map" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <MapIcon size={18} /> <span>GIS Topology</span>
          </NavLink>
          <NavLink to="/assets" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Server size={18} /> <span>Network Assets</span>
          </NavLink>
          <NavLink to="/cables" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Box size={18} /> <span>Cables & Cores</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-dark-border">
          <div className="flex items-center gap-3 mb-4 p-2 bg-dark-bg rounded-lg border border-dark-border">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-primary font-mono">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-danger hover:text-red-400 text-sm font-medium w-full px-2 py-2 rounded-lg hover:bg-danger/10 transition-colors">
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 z-10 pt-4">
          <div className="glass-panel px-4 py-2 flex items-center gap-2 w-96">
            <Search size={16} className="text-dark-muted" />
            <input 
              type="text" 
              placeholder="Search assets, cores, or coordinates..." 
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-dark-muted focus:ring-0"
            />
          </div>
          <div className="flex items-center gap-4">
             <div className="glass-panel px-4 py-2 text-xs font-mono text-dark-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-glow-accent"></span>
                API: <span className="text-white">50005</span>
             </div>
          </div>
        </header>

        {/* Content Router */}
        <div className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
