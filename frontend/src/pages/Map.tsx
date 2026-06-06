import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

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

export default function Map() {
  const token = useAuthStore(state => state.token);

  // Future integration: fetch Pops/Devices coordinates here.
  // const { data: pops } = useQuery({ ... })

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapIcon className="text-primary" />
            GIS Topology Map
          </h2>
          <p className="text-dark-muted text-sm mt-1">Spatial view of Fiber network and Points of Presence</p>
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden border border-dark-border shadow-lg relative z-0">
        <MapContainer 
          center={[-6.200000, 106.816666]} // Jakarta
          zoom={12} 
          style={{ height: '100%', width: '100%', backgroundColor: '#1a1a1a' }}
        >
          {/* Using CartoDB Dark Matter for dark mode map */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          <Marker position={[-6.200000, 106.816666]}>
            <Popup>
              <div className="text-black font-semibold">Headquarter</div>
              <div className="text-sm">Central Jakarta</div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
