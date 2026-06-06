import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, Layers, MapPin, Server, Activity, X } from 'lucide-react';

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
  const [selectedClosure, setSelectedClosure] = useState<string | null>(null);
  const [mapRegionFilter, setMapRegionFilter] = useState<string>('All');
  
  const { data: geoData, isLoading } = useQuery({
    queryKey: ['map-topology'],
    queryFn: async () => {
      const response = await axios.get('/api/v1/map/topology', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data; // GeoJSON FeatureCollection
    }
  });

  const { data: matrixData, isLoading: matrixLoading } = useQuery({
    queryKey: ['splice-matrix', selectedClosure],
    queryFn: async () => {
      if (!selectedClosure) return null;
      const response = await axios.get(`/api/v1/splices/matrix/${selectedClosure}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!selectedClosure
  });



  const uniqueRegions = Array.from(new Set(
    geoData?.features
      ?.map((f: any) => f.properties.region)
      .filter(Boolean)
  )) as string[];

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
        {uniqueRegions.length > 0 && (
          <select 
            value={mapRegionFilter}
            onChange={(e) => setMapRegionFilter(e.target.value)}
            className="bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="All">All Regions</option>
            {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
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
              const isDevice = feature.properties.type === "device";
              const coords: [number, number] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
              return (
                <Marker key={index} position={coords}>
                  <Popup className="custom-popup">
                    <div className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-lg border-b pb-2 mb-2">{feature.properties.name}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                        {isDevice ? <Server size={14} /> : <MapPin size={14} />} 
                        {isDevice ? feature.properties.device_type : 'PoP Site'}
                      </p>
                      {isDevice && (feature.properties.device_type === 'Closure' || feature.properties.device_type === 'ODP') && (
                        <button 
                          onClick={() => setSelectedClosure(feature.properties.id)}
                          className="mt-2 w-full btn-primary py-1.5 px-2 rounded-lg bg-primary text-dark-bg font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
                        >
                          <Activity size={16} /> View Splice Matrix
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            }
            if (feature.geometry.type === "LineString") {
              const coords: [number, number][] = feature.geometry.coordinates.map(
                (coord: [number, number]) => [coord[1], coord[0]] // Swap to [lat, lon]
              );
              
              if (mapRegionFilter !== 'All' && feature.properties.region !== mapRegionFilter) {
                return null;
              }

              const color = feature.properties.cable_type === 'Backbone' ? '#ef4444' : '#60a5fa'; // Red or Blue
              const weight = feature.properties.cable_type === 'Backbone' ? 4 : 3;
              
              return (
                <Polyline 
                  key={index} 
                  positions={coords} 
                  pathOptions={{ color, weight, opacity: 0.8 }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-lg border-b pb-2 mb-2">{feature.properties.name}</h3>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p><strong>Type:</strong> {feature.properties.cable_type}</p>
                        <p><strong>Region:</strong> {feature.properties.region || '-'}</p>
                        <p><strong>Capacity:</strong> {feature.properties.capacity} Core</p>
                      </div>
                      <button 
                        onClick={() => alert("Kabel ini memiliki " + feature.properties.capacity + " core. Fitur view detail kabel akan datang di update selanjutnya!")}
                        className="mt-3 w-full btn-primary py-1 px-2 rounded bg-primary text-dark-bg font-semibold text-sm hover:bg-primary/90"
                      >
                        View Cable Details
                      </button>
                    </div>
                  </Popup>
                </Polyline>
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
              <span>Node (PoP / Device)</span>
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

      {/* Splice Matrix Modal */}
      {selectedClosure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-dark-card border border-dark-border w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-dark-border bg-dark-bg/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="text-primary" />
                Splicing Matrix
              </h3>
              <button onClick={() => setSelectedClosure(null)} className="text-dark-muted hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {matrixLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
              ) : matrixData && matrixData.splices.length > 0 ? (
                <div className="space-y-6">
                  {/* Cables Summary */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {matrixData.cables.map((c: any) => (
                      <div key={c.id} className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                        <h4 className="font-semibold text-white">{c.name}</h4>
                        <p className="text-sm text-dark-muted">{c.type} • {c.capacity} Cores</p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Matrix Table */}
                  <div className="bg-dark-bg rounded-lg border border-dark-border overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-dark-card text-dark-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">Cable A</th>
                          <th className="px-4 py-3 font-medium">Core A</th>
                          <th className="px-4 py-3 font-medium text-center">Connection</th>
                          <th className="px-4 py-3 font-medium">Core B</th>
                          <th className="px-4 py-3 font-medium">Cable B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-border text-gray-300">
                        {matrixData.splices.map((splice: any) => {
                          const cableA = matrixData.cables.find((c: any) => c.id === splice.core_a.cable_id);
                          const cableB = matrixData.cables.find((c: any) => c.id === splice.core_b.cable_id);
                          return (
                            <tr key={splice.splice_id} className="hover:bg-dark-card/50">
                              <td className="px-4 py-3">{cableA?.name}</td>
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: splice.core_a.color.toLowerCase() }}></div>
                                  T{splice.core_a.tube_number}-C{splice.core_a.core_number}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-primary">↔</td>
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: splice.core_b.color.toLowerCase() }}></div>
                                  T{splice.core_b.tube_number}-C{splice.core_b.core_number}
                                </span>
                              </td>
                              <td className="px-4 py-3">{cableB?.name}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-dark-muted">
                  <Activity size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No active splices found in this Closure.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
