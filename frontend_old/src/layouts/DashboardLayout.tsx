import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Activity, Map as MapIcon, Box, Server, 
  LogOut, Search, Building2, MapPin, 
  Network, Bell, Settings, FileText,
  ChevronLeft, ChevronRight, Menu, X, Zap, Route, CheckCheck, AlertTriangle, GitMerge
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function DashboardLayout() {
  const { user, logout, token } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // --- State Geser Sidebar (Collapsible / Sliding Sidebar) ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fibercore_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const nextState = !prev;
      try {
        localStorage.setItem('fibercore_sidebar_collapsed', String(nextState));
      } catch {}
      return nextState;
    });
  };

  // --- Notification Bell States ---
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);

  // --- Google-Style Live Global Search States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ambil data kabel untuk Search & Notifikasi
  const { data: cablesData } = useQuery({
    queryKey: ['cables'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/cables/?limit=300', { headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    refetchInterval: 30000,
    enabled: !!token
  });

  // Ambil data topologi untuk pencarian Device (ODP, JC, Tiang, PoP) & koordinat fisiknya
  const { data: topologyData } = useQuery({
    queryKey: ['map-topology', 'All'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/map/topology', { headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    refetchInterval: 30000,
    enabled: !!token
  });

  // Ambil data splicing terbaru untuk notifikasi
  const { data: spliceData } = useQuery({
    queryKey: ['layout-splice-notif'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/splices/?limit=5', { headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    refetchInterval: 30000,
    enabled: !!token
  });

  // List notifikasi dari data nyata
  const notifications: { id: string; type: 'info' | 'warn'; text: string; link?: string }[] = useMemo(() => {
    const list: { id: string; type: 'info' | 'warn'; text: string; link?: string }[] = [];
    if (Array.isArray(cablesData)) {
      const penuh = cablesData.filter((c: any) => c.capacity > 0 && c.used_capacity >= c.capacity);
      if (penuh.length > 0) {
        list.push({ 
          id: 'cap-full', 
          type: 'warn', 
          text: `⚠️ ${penuh.length} kabel kapasitas penuh (100% terpakai). Perlu penarikan kabel pelebaran.`,
          link: '/cables'
        });
      }
      const tanpaSambung = cablesData.filter((c: any) => !c.description || c.description.trim() === '');
      if (tanpaSambung.length > 0) {
        list.push({ 
          id: 'no-desc', 
          type: 'info', 
          text: `ℹ️ ${tanpaSambung.length} kabel baru belum memiliki catatan sambungan/deskripsi rute.`,
          link: '/cables'
        });
      }
    }
    if (Array.isArray(spliceData) && spliceData.length > 0) {
      list.push({ 
        id: `splice-recent`, 
        type: 'info', 
        text: `⚡ Aktivitas sambungan core fisik terbaru tercatat di database.`,
        link: '/splicing'
      });
    }
    return list;
  }, [cablesData, spliceData]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  // Tutup notifikasi & popup search saat klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Shortcut keyboard Escape & '/' untuk search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setNotifOpen(false);
      }
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Filter Search Real-Time ala Google ---
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { cables: [], devices: [], total: 0 };

    const cables = (Array.isArray(cablesData) ? cablesData : []).filter((c: any) => {
      const name = (c.name || '').toLowerCase();
      const type = (c.type || '').toLowerCase();
      const reg = (c.region || '').toLowerCase();
      const desc = (c.description || '').toLowerCase();
      return name.includes(q) || type.includes(q) || reg.includes(q) || desc.includes(q);
    }).slice(0, 8);

    const devicesList: any[] = [];
    if (topologyData?.features && Array.isArray(topologyData.features)) {
      for (const f of topologyData.features) {
        if (f.geometry?.type === 'Point' && f.properties) {
          const p = f.properties;
          const name = (p.name || '').toLowerCase();
          const devType = (p.device_type || p.type || '').toLowerCase();
          const reg = (p.region || '').toLowerCase();
          const desc = (p.description || '').toLowerCase();
          if (name.includes(q) || devType.includes(q) || reg.includes(q) || desc.includes(q)) {
            devicesList.push({
              id: p.id,
              name: p.name,
              device_type: p.device_type || (p.type === 'pop' ? 'PoP / STO' : 'Node'),
              region: p.region,
              description: p.description,
              coordinates: f.geometry.coordinates
            });
          }
        }
      }
    }

    return {
      cables,
      devices: devicesList.slice(0, 10),
      total: cables.length + devicesList.length
    };
  }, [searchQuery, cablesData, topologyData]);

  const handleSelectCable = (cable: any) => {
    setIsSearchOpen(false);
    navigate(`/cables?cableId=${cable.id}&cableName=${encodeURIComponent(cable.name)}`);
  };

  const handleSelectDevice = (device: any) => {
    setIsSearchOpen(false);
    if (device.coordinates && device.coordinates.length === 2) {
      const [lng, lat] = device.coordinates;
      navigate(`/map?lat=${lat}&lng=${lng}&name=${encodeURIComponent(device.name)}&type=${encodeURIComponent(device.device_type)}`);
    } else {
      navigate('/map');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: Activity, path: '/' },
    { name: 'GIS Topology', icon: MapIcon, path: '/map' },
    { name: 'Organizations', icon: Building2, path: '/organizations' },
    { name: 'PoP Sites', icon: MapPin, path: '/pops' },
    { name: 'POP Asset Reports', icon: FileText, path: '/pop-reports' },
    { name: 'Devices & Assets', icon: Server, path: '/devices' },
    { name: 'Cables & Cores', icon: Box, path: '/cables' },
    { name: 'Splicing & Patching', icon: Network, path: '/splicing' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-surface">
      {/* Left Sidebar - Collapsible & Geser (Slide Animation) */}
      <aside 
        className={`bg-white border-r border-dark-border flex flex-col shrink-0 z-20 transition-all duration-300 ease-in-out relative ${
          isSidebarCollapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {/* Tombol Geser / Toggle Sidebar Melayang di Sisi Kanan Sidebar */}
        <button
          type="button"
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? "Geser & Perluas Menu (Expand)" : "Geser & Tutup Menu (Collapse)"}
          className="absolute -right-3.5 top-6 z-30 w-7 h-7 bg-white border border-dark-border rounded-full shadow-md hover:bg-primary hover:text-white text-gray-600 flex items-center justify-center transition-all cursor-pointer hover:scale-110"
        >
          {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4.5 border-b border-dark-border overflow-hidden">
          <div className="flex items-center min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              <Network size={20} strokeWidth={2.5} />
            </div>
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-extrabold text-dark-text tracking-tight ml-3 whitespace-nowrap animate-in fade-in duration-200">
                <span className="text-primary">Fiber</span>Core
              </h1>
            )}
          </div>
        </div>
        
        {/* Navigation Items (Sub-menu List) */}
        <div className="flex-1 overflow-y-auto py-4 space-y-1 overflow-x-hidden">
          <div className={`px-4 mb-2 text-[10px] font-bold text-dark-muted uppercase tracking-wider transition-opacity ${
            isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden mb-0' : 'opacity-100'
          }`}>
            Network Operations
          </div>

          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink 
                key={item.name}
                to={item.path} 
                title={isSidebarCollapsed ? item.name : undefined}
                className={`sidebar-item flex items-center gap-3 py-2.5 mx-2 rounded-xl font-medium transition-all duration-150 ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-3.5'
                } ${
                  isActive 
                    ? 'bg-primary text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-primary'
                }`}
              >
                <item.icon size={19} className="shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="text-xs sm:text-sm font-semibold truncate animate-in fade-in duration-150">
                    {item.name}
                  </span>
                )}
              </NavLink>
            );
          })}

          <div className={`px-4 mb-2 mt-6 text-[10px] font-bold text-dark-muted uppercase tracking-wider transition-opacity ${
            isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden mb-0' : 'opacity-100'
          }`}>
            System
          </div>
          
          <div 
            title={isSidebarCollapsed ? "Settings" : undefined}
            className={`sidebar-item flex items-center gap-3 py-2.5 mx-2 rounded-xl font-medium text-gray-600 hover:bg-gray-100 hover:text-primary cursor-pointer transition-all ${
              isSidebarCollapsed ? 'px-0 justify-center' : 'px-3.5'
            }`}
          >
            <Settings size={19} className="shrink-0" />
            {!isSidebarCollapsed && (
              <span className="text-xs sm:text-sm font-semibold truncate animate-in fade-in duration-150">
                Settings
              </span>
            )}
          </div>
        </div>

        {/* Sidebar Footer / Sign Out */}
        <div className="p-3 border-t border-dark-border">
          <button 
            type="button"
            onClick={handleLogout} 
            title={isSidebarCollapsed ? "Sign Out" : undefined}
            className={`flex items-center gap-3 w-full py-2.5 rounded-xl text-danger hover:bg-danger/10 transition-colors text-xs sm:text-sm font-bold cursor-pointer ${
              isSidebarCollapsed ? 'px-0 justify-center' : 'px-3.5'
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {!isSidebarCollapsed && (
              <span className="truncate animate-in fade-in duration-150">Sign Out</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Navigation */}
        <header className="h-16 bg-white border-b border-dark-border flex items-center justify-between px-4 sm:px-6 shrink-0 z-30">
          {/* Toggle Sidebar & Google-Style Search */}
          <div className="flex items-center gap-3 flex-1 max-w-2xl">
            {/* Tombol Hamburger Geser Menu */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Geser / Tutup-Buka Menu Sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Google-Style Global Omnisearch */}
            <div className="flex-1 relative" ref={searchContainerRef}>
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Cari kabel FO, ODP, Joint Closure, PoP... (Tekan '/' untuk cari)" 
                  className="w-full pl-10 pr-9 py-2 bg-gray-50 hover:bg-white border border-dark-border rounded-xl text-xs sm:text-sm text-dark-text placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-xs font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Instant Search Dropdown Popover */}
              {isSearchOpen && (
                <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-[80vh] flex flex-col">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs text-gray-500 font-medium">
                    {searchQuery.trim() ? (
                      <span className="flex items-center gap-1.5 text-gray-700 font-semibold">
                        <Zap size={14} className="text-amber-500" />
                        Hasil pencarian: {searchResults.total} item
                      </span>
                    ) : (
                      <span>💡 Ketik nama kabel, nomor ODP, JC, atau wilayah</span>
                    )}
                    <span className="text-[11px] bg-white border border-gray-300 rounded px-1.5 py-0.5 font-mono shadow-2xs">ESC untuk tutup</span>
                  </div>

                  <div className="overflow-y-auto divide-y divide-gray-100 flex-1 p-2 space-y-2">
                    {!searchQuery.trim() && (
                      <div className="p-3">
                        <span className="text-xs font-bold text-gray-700 block mb-2">⚡ Pintasan Pencarian Cepat:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {['ODP', 'Joint Closure', '48 CORE', '12 CORE', 'Feeder', 'Distribution', 'Dropcore'].map(chip => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                setSearchQuery(chip);
                                searchInputRef.current?.focus();
                              }}
                              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-primary/10 hover:text-primary text-gray-700 rounded-lg transition-colors font-medium border border-gray-200"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchQuery.trim() && searchResults.total === 0 && (
                      <div className="py-8 text-center text-gray-400">
                        <Search size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold">Tidak ada kabel atau perangkat yang cocok dengan "{searchQuery}"</p>
                      </div>
                    )}

                    {searchResults.cables.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                          <Route size={13} /> Kabel Fiber Optik ({searchResults.cables.length})
                        </div>
                        <div className="space-y-1">
                          {searchResults.cables.map((cable: any) => (
                            <div 
                              key={cable.id}
                              onClick={() => handleSelectCable(cable)}
                              className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 border border-transparent hover:border-purple-200 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                                  <Route size={16} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate group-hover:text-purple-700">
                                    {cable.name}
                                  </p>
                                  <p className="text-[11px] text-gray-500 truncate">
                                    {cable.type} • {cable.capacity} Core • {cable.length ? `${Math.round(cable.length)}m` : '0m'}
                                    {cable.region && ` • [${cable.region}]`}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                {cable.capacity}C
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.devices.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                          <MapPin size={13} /> Perangkat &amp; Titik Sambung ({searchResults.devices.length})
                        </div>
                        <div className="space-y-1">
                          {searchResults.devices.map((device: any) => (
                            <div 
                              key={device.id}
                              onClick={() => handleSelectDevice(device)}
                              className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                  <MapPin size={16} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-gray-900 group-hover:text-emerald-700 truncate">
                                      {device.name}
                                    </span>
                                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                      {device.device_type}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 truncate">
                                    {device.region ? `Wilayah: ${device.region}` : 'Lokasi Terdaftar di Peta GIS'}
                                    {device.description ? ` • ${device.description}` : ''}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[11px] bg-white border border-emerald-300 text-emerald-700 font-semibold px-2 py-0.5 rounded shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                                Buka di Peta ➔
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center text-[11px] text-gray-400">
                    Klik kabel untuk membuka <strong>Core Matrix</strong> • Klik perangkat untuk <strong>Zoom Peta GIS</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Header Navigation & Notifications */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => { 
                  setNotifOpen(!notifOpen); 
                  setReadIds(new Set(notifications.map(n => n.id))); 
                }}
                className="relative p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                title="Pusat Pemberitahuan Jaringan"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-84 bg-white border border-dark-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Bell size={13} />
                      </div>
                      <span className="text-xs font-bold text-dark-text">Pemberitahuan &amp; Insiden</span>
                    </div>
                    <span className="text-[11px] font-semibold text-dark-muted bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                      {notifications.length} Info
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-dark-muted">
                        <CheckCheck size={28} className="mx-auto mb-2 text-emerald-500" />
                        Semua kabel dan perangkat jaringan normal!
                      </div>
                    ) : notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          if (n.link) {
                            navigate(n.link);
                            setNotifOpen(false);
                          }
                        }}
                        className={`p-3.5 hover:bg-gray-50 flex items-start gap-3 transition-colors ${n.link ? 'cursor-pointer' : ''}`}
                      >
                        {n.type === 'warn' ? (
                          <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle size={15} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                            <GitMerge size={15} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 font-medium leading-relaxed">{n.text}</p>
                          {n.link && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1">
                              Buka Halaman Terkait ➔
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-7 w-px bg-dark-border mx-1"></div>

            {/* User Profile */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-dark-text leading-tight">{user?.full_name}</p>
                <p className="text-[11px] text-dark-muted font-medium">{user?.role || 'Super Admin'}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-xs border border-primary/20">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Content Router */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}