import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, Layers, MapPin, Server, Activity, X, Edit } from 'lucide-react';

// Fix for Leaflet default icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

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
  const queryClient = useQueryClient();
  const [selectedClosure, setSelectedClosure] = useState<string | null>(null);
  const [mapRegionFilter, setMapRegionFilter] = useState<string>('All');
  
  // Edit State
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ used_capacity: '', description: '' });

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

  const editDeviceMutation = useMutation({
    mutationFn: async (data: { id: string, payload: any }) => {
      const response = await axios.put(`/api/v1/devices/${data.id}`, data.payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-topology'] });
      setEditingDevice(null);
    }
  });

  const uniqueRegions = Array.from(new Set(
    geoData?.features
      ?.map((f: any) => f.properties.region)
      .filter(Boolean)
  )) as string[];

  const center: [number, number] = [-6.200000, 106.816666]; // Default to Jakarta if no PoPs

  // Custom Lightweight Icon Generator
  const getCustomIcon = (deviceType: string, name: string, description: string) => {
    const isSlack = name.toLowerCase().includes('slack') || (description && description.toLowerCase().includes('slack'));
    
    let bgColor = 'bg-gray-400';
    let sizeClass = 'w-4 h-4';
    let iconHtml = '';
    let isSquare = false;
    
    if (isSlack) {
      bgColor = 'bg-yellow-400 border-2 border-yellow-600';
      iconHtml = '<div class="text-[8px] font-bold text-yellow-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">S</div>';
      sizeClass = 'w-5 h-5';
    } else if (deviceType === 'Closure') {
      bgColor = 'bg-orange-500 border-2 border-white shadow-md';
      isSquare = true;
      sizeClass = 'w-5 h-5';
    } else if (deviceType === 'ODP') {
      bgColor = 'bg-green-500 border-2 border-white shadow-md';
      isSquare = true;
      sizeClass = 'w-5 h-5';
    } else if (deviceType === 'POP' || deviceType === 'OLT') {
      bgColor = 'bg-purple-600 border-2 border-white shadow-lg';
      iconHtml = '<div class="text-[8px] font-bold text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">P</div>';
      isSquare = true;
      sizeClass = 'w-6 h-6';
    } else {
      // Regular Pole or Unknown
      bgColor = 'bg-gray-500 border border-white shadow-sm';
    }

    const roundedClass = isSquare ? 'rounded-sm' : 'rounded-full';

    return L.divIcon({
      className: 'bg-transparent border-0',
      html: `<div class="relative ${sizeClass} ${bgColor} ${roundedClass} flex items-center justify-center">${iconHtml}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    
    editDeviceMutation.mutate({
      id: editingDevice.id,
      payload: {
        used_capacity: editFormData.used_capacity ? parseInt(editFormData.used_capacity) : null,
        description: editFormData.description
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] relative">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <Layers className="text-primary" />
            GIS Topology Map
          </h2>
          <p className="text-dark-muted text-sm mt-1">Live Map of PoPs and Fiber Routes</p>
        </div>
        {uniqueRegions.length > 0 && (
          <select 
            value={mapRegionFilter}
            onChange={(e) => setMapRegionFilter(e.target.value)}
            className="bg-white border border-dark-border rounded-lg px-4 py-2 text-sm text-dark-text focus:outline-none focus:border-primary"
          >
            <option value="All">All Regions</option>
            {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      <div className="flex-1 glass-panel overflow-hidden relative rounded-xl border border-dark-border">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <p className="text-primary font-mono animate-pulse">Loading spatial data...</p>
          </div>
        ) : null}

        <MapContainer 
          center={center} 
          zoom={10} 
          preferCanvas={true}
          className="w-full h-full bg-white"
          style={{ background: '#F8FAFC' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={25}
            spiderfyOnMaxZoom={true}
          >
            {geoData?.features?.map((feature: any, index: number) => {
              if (feature.geometry.type === "Point") {
                const isDevice = feature.properties.type === "device";
                const coords: [number, number] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                
                const customIcon = getCustomIcon(
                  feature.properties.device_type || 'Pole', 
                  feature.properties.name || '',
                  feature.properties.description || ''
                );

                return (
                  <Marker key={index} position={coords} icon={customIcon}>
                    <Popup className="custom-popup">
                      <div className="p-1 min-w-[200px]">
                        <h3 className="font-bold text-lg border-b pb-2 mb-2">{feature.properties.name}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                          {isDevice ? <Server size={14} /> : <MapPin size={14} />} 
                          {isDevice ? feature.properties.device_type : 'PoP Site'}
                        </p>
                        
                        {feature.properties.used_capacity !== undefined && feature.properties.used_capacity !== null && (
                          <p className="text-sm text-gray-700 mb-2 font-medium">
                              Capacity: <span className="text-primary">{feature.properties.used_capacity}</span> Ports Used
                          </p>
                        )}
                        
                        {feature.properties.description && (
                          <p className="text-xs text-gray-500 mb-2 italic">
                            "{feature.properties.description}"
                          </p>
                        )}
                        
                        {isDevice && (
                          <div className="mt-3 flex gap-2">
                            <button 
                              onClick={() => {
                                setEditingDevice(feature.properties);
                                setEditFormData({
                                  used_capacity: feature.properties.used_capacity?.toString() || '',
                                  description: feature.properties.description || ''
                                });
                              }}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-1.5 px-2 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
                            >
                              <Edit size={14} /> Edit Info
                            </button>
                            
                            {(feature.properties.device_type === 'Closure' || feature.properties.device_type === 'ODP') && (
                              <button 
                                onClick={() => setSelectedClosure(feature.properties.id)}
                                className="flex-1 btn-primary py-1.5 px-2 text-sm flex items-center justify-center gap-1"
                              >
                                <Activity size={14} /> Matrix
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              }
              return null;
            })}
          </MarkerClusterGroup>

          {geoData?.features?.map((feature: any, index: number) => {
            if (feature.geometry.type === "LineString") {
              const coords: [number, number][] = feature.geometry.coordinates.map(
                (coord: [number, number]) => [coord[1], coord[0]] // Swap to [lat, lon]
              );
              
              if (mapRegionFilter !== 'All' && feature.properties.region !== mapRegionFilter) {
                return null;
              }

              const cableType = feature.properties.cable_type || 'Distribution';
              let finalColor = feature.properties.color || '#475569'; // Use KMZ color if available
              let weight = cableType === 'Backbone' ? 5 : cableType === 'Feeder' ? 4 : cableType === 'Distribution' ? 3 : 2;

              return (
                <Polyline 
                  key={index} 
                  positions={coords} 
                  pathOptions={{ color: finalColor, weight, opacity: 0.8 }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-lg border-b pb-2 mb-2">{feature.properties.name}</h3>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p><strong>Type:</strong> {feature.properties.cable_type}</p>
                        <p><strong>Region:</strong> {feature.properties.region || '-'}</p>
                        <p><strong>Capacity:</strong> {feature.properties.capacity} Core</p>
                        {feature.properties.description && (
                          <p className="italic text-xs mt-1">"{feature.properties.description}"</p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            }
            return null;
          })}
        </MapContainer>
      </div>

      {/* Edit Device Modal */}
      {editingDevice && (
        <div className="fixed inset-0 bg-dark-text/30 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
                <Edit className="text-primary" size={18} />
                Edit {editingDevice.name}
              </h3>
              <button onClick={() => setEditingDevice(null)} className="text-dark-muted hover:text-danger transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Used Ports / Capacity</label>
                  <input 
                    type="number"
                    value={editFormData.used_capacity}
                    onChange={(e) => setEditFormData({...editFormData, used_capacity: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg focus:outline-none focus:border-primary text-sm bg-white"
                    placeholder="e.g. 12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Description / Notes</label>
                  <textarea 
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg focus:outline-none focus:border-primary text-sm bg-white"
                    placeholder="e.g. Spare 5 meter, Joint Box ODP..."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingDevice(null)}
                  className="px-4 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={editDeviceMutation.isPending}
                  className="px-4 py-2 btn-primary rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {editDeviceMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Splice Matrix Modal */}
      {selectedClosure && (
        <div className="fixed inset-0 bg-dark-text/30 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-dark-border bg-dark-surface">
              <h3 className="text-xl font-bold text-dark-text flex items-center gap-2">
                <Activity className="text-primary" />
                Splicing Matrix
              </h3>
              <button onClick={() => setSelectedClosure(null)} className="text-dark-muted hover:text-danger transition-colors">
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
                      <div key={c.id} className="bg-dark-surface p-4 rounded-lg border border-dark-border">
                        <h4 className="font-semibold text-dark-text">{c.name}</h4>
                        <p className="text-sm text-dark-muted">{c.type} • {c.capacity} Cores</p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Matrix Table */}
                  <div className="bg-white rounded-lg border border-dark-border overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-dark-surface text-dark-muted border-b border-dark-border">
                        <tr>
                          <th className="px-4 py-3 font-medium">Cable A</th>
                          <th className="px-4 py-3 font-medium">Core A</th>
                          <th className="px-4 py-3 font-medium text-center">Connection</th>
                          <th className="px-4 py-3 font-medium">Core B</th>
                          <th className="px-4 py-3 font-medium">Cable B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-border text-dark-text">
                        {matrixData.splices.map((splice: any) => {
                          const cableA = matrixData.cables.find((c: any) => c.id === splice.core_a.cable_id);
                          const cableB = matrixData.cables.find((c: any) => c.id === splice.core_b.cable_id);
                          return (
                            <tr key={splice.splice_id} className="hover:bg-dark-surface">
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
