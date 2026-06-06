import React from 'react';
import { Activity, Server, Box, Users, Network } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

interface DashboardStats {
  organizations: number;
  pops: number;
  cables: number;
  splices: number;
  devices: number;
}

export default function Dashboard() {
  const token = useAuthStore(state => state.token);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await axios.get<DashboardStats>('/api/v1/analytics/dashboard-stats', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Network Overview</h1>
        <p className="text-dark-muted">Real-time status of FiberCore infrastructure.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total PoPs', value: isLoading ? '...' : stats?.pops || 0, icon: Server, color: 'text-primary' },
          { label: 'Total Cables', value: isLoading ? '...' : stats?.cables || 0, icon: Box, color: 'text-accent' },
          { label: 'Spliced Cores', value: isLoading ? '...' : stats?.splices || 0, icon: Network, color: 'text-primary' },
          { label: 'Devices Deployed', value: isLoading ? '...' : stats?.devices || 0, icon: Activity, color: 'text-dark-muted' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-6 flex items-start justify-between">
            <div>
              <p className="text-dark-muted text-sm font-mono">{stat.label}</p>
              <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-dark-bg border border-dark-border ${stat.color}`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Graph/Map Area */}
      <div className="glass-panel h-[500px] flex flex-col overflow-hidden relative">
        <MapContainer 
          center={[-6.200000, 106.816666]} // Jakarta (Default Center)
          zoom={11} 
          style={{ height: '100%', width: '100%', backgroundColor: '#1a1a1a' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <Marker position={[-6.200000, 106.816666]}>
            <Popup>
              <div className="text-black font-semibold">Headquarter</div>
              <div className="text-sm">Central Node</div>
            </Popup>
          </Marker>
        </MapContainer>
        
        {/* Map Overlay Label */}
        <div className="absolute top-4 left-4 z-[400] glass-panel px-4 py-2 pointer-events-none shadow-lg">
          <p className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-glow-accent"></span>
            Live Topology
          </p>
        </div>
      </div>
    </div>
  );
}
