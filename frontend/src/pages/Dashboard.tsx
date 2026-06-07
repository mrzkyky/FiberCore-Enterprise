import React from 'react';
import { Activity, Server, Box, Network, AlertTriangle, ShieldAlert, CheckCircle2, Route, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet Default Icon Issue in React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function Dashboard() {
  const token = useAuthStore(state => state.token);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await axios.get('/api/v1/analytics/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-text">Network Operations Center</h1>
        <p className="text-dark-muted">Real-time infrastructure health and capacity monitoring.</p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Fiber Length', value: '1,240 km', icon: Route, color: 'text-primary', bg: 'bg-accent' },
          { label: 'Total ODP / OTB', value: isLoading ? '...' : stats?.devices || 0, icon: Server, color: 'text-orange', bg: 'bg-orange-light/20' },
          { label: 'Total Closures', value: isLoading ? '...' : stats?.pops || 0, icon: Box, color: 'text-primary', bg: 'bg-accent' },
          { label: 'Total Spliced Cores', value: isLoading ? '...' : stats?.splices || 0, icon: Network, color: 'text-success', bg: 'bg-success/20' },
          { label: 'Core Utilization', value: '68%', icon: Activity, color: 'text-warning', bg: 'bg-warning/20' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform cursor-default">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-xs font-semibold text-success flex items-center gap-1">+2.4%</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-dark-text">{stat.value}</p>
              <p className="text-dark-muted text-xs font-medium uppercase mt-1 tracking-wide">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
        {/* Left Section: Interactive GIS Map (60%) */}
        <div className="w-full lg:w-3/5 glass-panel overflow-hidden relative flex flex-col">
          <div className="px-5 py-4 border-b border-dark-border flex justify-between items-center bg-white z-10">
            <h3 className="font-bold text-dark-text flex items-center gap-2">
              <MapIcon className="text-primary" size={18} />
              Live Route Topology
            </h3>
            <span className="px-3 py-1 bg-success/10 text-success text-xs font-semibold rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              All Systems Operational
            </span>
          </div>
          <div className="flex-1 bg-gray-100">
            <MapContainer 
              center={[-6.200000, 106.816666]}
              zoom={11} 
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              />
              <Marker position={[-6.200000, 106.816666]}>
                <Popup>
                  <div className="font-semibold">NOC Headquarter</div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>

        {/* Right Section: Operational Summary Panel (40%) */}
        <div className="w-full lg:w-2/5 flex flex-col gap-6">
          {/* Capacity Warnings */}
          <div className="glass-panel p-5 flex-1 flex flex-col">
            <h3 className="font-bold text-dark-text mb-4 flex items-center gap-2">
              <AlertTriangle className="text-warning" size={18} />
              Capacity Warnings
            </h3>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              {[
                { name: 'Backbone JKT-BDG', used: 138, total: 144, status: 'Critical' },
                { name: 'Feeder BGR-01', used: 45, total: 48, status: 'Warning' },
                { name: 'Dist-TGR-05', used: 22, total: 24, status: 'Warning' },
              ].map((cable, idx) => (
                <div key={idx} className="bg-dark-surface p-3 rounded-lg border border-dark-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm text-dark-text">{cable.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cable.status === 'Critical' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                      {cable.status}
                    </span>
                  </div>
                  <div className="w-full bg-dark-border rounded-full h-2 mb-1">
                    <div 
                      className={`h-2 rounded-full ${cable.status === 'Critical' ? 'bg-danger' : 'bg-warning'}`} 
                      style={{ width: `${(cable.used / cable.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-xs text-dark-muted font-mono">
                    {cable.used} / {cable.total} Cores Used
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Incidents */}
          <div className="glass-panel p-5 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-dark-text flex items-center gap-2">
                <ShieldAlert className="text-danger" size={18} />
                Open Incidents
              </h3>
              <button className="text-primary text-xs font-semibold hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-start p-3 bg-danger/5 border border-danger/20 rounded-lg">
                <AlertCircle className="text-danger shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-sm font-semibold text-dark-text">Fiber Cut detected at KM 14</p>
                  <p className="text-xs text-dark-muted mt-1">Impact: 48 Cores offline. Dispatching team.</p>
                  <p className="text-xs font-mono text-danger mt-2">14 mins ago</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-3 bg-dark-surface border border-dark-border rounded-lg">
                <CheckCircle2 className="text-success shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-sm font-semibold text-dark-text">Maintenance Completed: ODP-JKT-12</p>
                  <p className="text-xs text-dark-muted mt-1">Splice box replaced successfully.</p>
                  <p className="text-xs font-mono text-dark-muted mt-2">2 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ensure MapIcon is imported since it's used in the code but renamed from lucide-react Map
import { Map as MapIcon } from 'lucide-react';
