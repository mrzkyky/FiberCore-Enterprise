import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Activity, BarChart3, Box, Layers, LogOut, 
  Map, Settings, ShieldAlert, Users, 
  Server, Route, Cpu, Bell, Search, CheckCheck, AlertTriangle, GitMerge,
  X, ExternalLink, MapPin, CornerDownLeft, ChevronRight, Zap
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, token } = useAuthStore();
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
      return res.data; // array of cables
    },
    refetchInterval: 30000,
    enabled: !!token
  });

  // Ambil data topologi untuk pencarian Device (ODP, JC, Tiang, PoP) & koordinat fisiknya
  const { data: topologyData } = useQuery({
    queryKey: ['map-topology', 'All'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/map/topology', { headers: { Authorization: `Bearer ${token}` } });
      return res.data; // GeoJSON FeatureCollection
    },
    refetchInterval: 30000,
    enabled: !!token
  });

  // Ambil data splicing terbaru untuk notifikasi
  const { data: spliceData } = useQuery({
    queryKey: ['layout-splice-notif'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/splices/?limit=5', { headers: { Authorization: `Bearer ${token}` } });
      return res.data; // array of splices
    },
    refetchInterval: 30000,
    enabled: !!token
  });

  // Bangun list notifikasi dari data nyata (Network Health & Incident Monitoring)
  const notifications: { id: string; type: 'info' | 'warn'; text: string; link?: string }[] = useMemo(() => {
    const list: { id: string; type: 'info' | 'warn'; text: string; link?: string }[] = [];
    if (Array.isArray(cablesData)) {
      const penuh = cablesData.filter((c: any) => c.capacity > 0 && c.used_capacity >= c.capacity);
      if (penuh.length > 0) {
        list.push({ 
          id: 'cap-full', 
          type: 'warn', 
          text: `⚠️ ${penuh.length} kabel kapasitas penuh (100% core terpakai). Perlu penarikan kabel pelebaran.`,
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

  // Shortcut keyboard Escape & '/' untuk search bar ala Google
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

    // Ambil devices dari GeoJSON topologi
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
              coordinates: f.geometry.coordinates // [lng, lat]
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
        <header className="h-16 bg-white border-b border-dark-border flex items-center justify-between px-6 shrink-0 z-30">
          {/* Google-Style Global Omnisearch */}
          <div className="flex items-center flex-1 max-w-2xl relative" ref={searchContainerRef}>
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
                placeholder="Cari kabel FO, ODP, Joint Closure, PoP, atau nomor core... (Tekan '/' untuk cari)" 
                className="w-full pl-10 pr-9 py-2 bg-gray-50 hover:bg-white border border-dark-border rounded-xl text-xs sm:text-sm text-dark-text placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
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

            {/* Google-Style Instant Dropdown Results */}
            {isSearchOpen && (
              <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-[80vh] flex flex-col">
                {/* Header Dropdown */}
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs text-gray-500 font-medium">
                  {searchQuery.trim() ? (
                    <span className="flex items-center gap-1.5 text-gray-700 font-semibold">
                      <Zap size={14} className="text-amber-500" />
                      Hasil pencarian untuk "{searchQuery}": {searchResults.total} item
                    </span>
                  ) : (
                    <span>💡 Ketik kata kunci pencarian (nama kabel, ODP, JC, atau region)</span>
                  )}
                  <span className="text-[11px] bg-white border border-gray-300 rounded px-1.5 py-0.5 font-mono shadow-2xs">ESC untuk tutup</span>
                </div>

                {/* Body Results */}
                <div className="overflow-y-auto divide-y divide-gray-100 flex-1 p-2 space-y-2">
                  {/* Quick Chips saat search kosong */}
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

                  {/* Jika ada query tapi tidak ditemukan hasil */}
                  {searchQuery.trim() && searchResults.total === 0 && (
                    <div className="py-8 text-center text-gray-400">
                      <Search size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-semibold">Tidak ada kabel atau perangkat yang cocok dengan "{searchQuery}"</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Coba gunakan kata kunci nama ODP (misal: "ODP 31") atau nama kabel.</p>
                    </div>
                  )}

                  {/* KATEGORI 1: KABEL FIBER OPTIK */}
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
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
                                {cable.capacity}C
                              </span>
                              <ChevronRight size={14} className="text-gray-400 group-hover:text-purple-600 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KATEGORI 2: PERANGKAT & TITIK SAMBUNG (ODP / JC / TIANG / POP) */}
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
                            <div className="flex items-center gap-1.5 shrink-0 text-emerald-600 text-xs font-semibold">
                              <span className="text-[11px] bg-white border border-emerald-300 px-2 py-0.5 rounded shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                Buka di Peta ➔
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Info */}
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Klik kabel untuk membuka <strong>Core Matrix</strong> • Klik perangkat untuk <strong>Zoom Peta GIS</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Right Header Navigation & Notifications */}
          <div className="flex items-center gap-4">
            {/* Notification Bell (Network Incident & Capacity Monitoring) */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { 
                  setNotifOpen(!notifOpen); 
                  setReadIds(new Set(notifications.map(n => n.id))); 
                }}
                className="relative p-2.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                title="Pusat Pemberitahuan & Monitoring Kapasitas Jaringan"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-88 bg-white border border-dark-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
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

                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center text-[10px] text-gray-400">
                    FiberCore Network Capacity &amp; Incident Monitoring
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

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}