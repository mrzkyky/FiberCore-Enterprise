import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, Layers, MapPin } from 'lucide-react';

// Fix for Leaflet default icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function GisTopology() {
  const token = useAuthStore(state => state.token);
  
  const { data: geoData, isLoading } = useQuery({
    queryKey: ['map-topology'],
    queryFn: async () => {
      const response = await axios.get('/api/v1/map/topology', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data; // GeoJSON FeatureCollection
    }
  });

  const center: [number, number] = [-6.200000, 106.816666]; // Default to Jakarta if no PoPs

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="text-primary" />
            GIS Topology Map
          </h2>
          <p className="text-dark-muted text-sm mt-1">Live Map of PoPs and Fiber Routes</p>
        </div>
      </div>

      <div className="flex-1 glass-panel overflow-hidden relative rounded-xl border border-dark-border">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-bg/80 z-50">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <p className="text-primary font-mono animate-pulse">Loading spatial data...</p>
          </div>
        ) : null}

        <MapContainer 
          center={center} 
          zoom={10} 
          className="w-full h-full bg-dark-bg"
          style={{ background: '#0a0a0a' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {geoData?.features?.map((feature: any, index: number) => {
            if (feature.geometry.type === "Point") {
              const coords: [number, number] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
              return (
                <Marker key={index} position={coords}>
                  <Popup className="custom-popup">
                    <div className="p-1">
                      <h3 className="font-bold text-lg border-b pb-2 mb-2">{feature.properties.name}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin size={14} /> PoP Site
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return null;
          })}
        </MapContainer>
        
        <div className="absolute bottom-6 left-6 z-[400] bg-dark-bg/90 backdrop-blur border border-dark-border p-4 rounded-xl shadow-xl">
          <h4 className="text-white font-semibold mb-2">Map Legend</h4>
          <div className="space-y-2 text-sm text-dark-muted">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              <span>Point of Presence (PoP)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-red-500 rounded"></div>
              <span>Backbone Cable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-blue-400 rounded"></div>
              <span>Distribution Cable</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
