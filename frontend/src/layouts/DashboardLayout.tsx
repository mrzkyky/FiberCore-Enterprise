import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  Activity, Map as MapIcon, Box, Server, 
  LogOut, Search, Building2, MapPin, 
  Network, Bell, Settings, FileText
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-surface">
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
          <NavLink to="/" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Activity size={18} /> <span>Dashboard</span>
          </NavLink>
          <NavLink to="/map" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <MapIcon size={18} /> <span>GIS Topology</span>
          </NavLink>
          <NavLink to="/organizations" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Building2 size={18} /> <span>Organizations</span>
          </NavLink>
          <NavLink to="/pops" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <MapPin size={18} /> <span>PoP Sites</span>
          </NavLink>
          <NavLink to="/pop-reports" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} /> <span>POP Asset Reports</span>
          </NavLink>
          <NavLink to="/devices" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Server size={18} /> <span>Devices & Assets</span>
          </NavLink>
          <NavLink to="/cables" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Box size={18} /> <span>Cables & Cores</span>
          </NavLink>
          <NavLink to="/splicing" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Network size={18} /> <span>Splicing & Patching</span>
          </NavLink>

          <div className="px-6 mb-2 mt-8 text-xs font-semibold text-dark-muted uppercase tracking-wider">
            System
          </div>
          <div className="sidebar-item">
            <Settings size={18} /> <span>Settings</span>
          </div>
        </div>

        <div className="p-4 border-t border-dark-border">
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-danger hover:bg-danger/10 transition-colors text-sm font-medium"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Navigation */}
        <header className="h-16 bg-white border-b border-dark-border flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
              <input 
                type="text" 
                placeholder="Search resources, cores, or incidents..." 
                className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
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
                <p className="text-sm font-semibold text-dark-text leading-tight">{user?.full_name}</p>
                <p className="text-xs text-dark-muted">{user?.role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-accent text-primary flex items-center justify-center font-bold border border-primary/20">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Content Router */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
