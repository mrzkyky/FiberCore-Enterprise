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

  // Custom Icon Generator
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

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
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
            maxClusterRadius={40}
            spiderfyOnMaxZoom={true}
          >
            {geoData?.features?.map((feature: any, index: number) => {
              if (feature.geometry.type === "Point") {
                const isDevice = feature.properties.type === "device";
                const coords: [number, number] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                
                // Get custom icon
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
                        {isDevice && (feature.properties.device_type === 'Closure' || feature.properties.device_type === 'ODP') && (
                          <button 
                            onClick={() => setSelectedClosure(feature.properties.id)}
                            className="mt-2 w-full btn-primary py-1.5 px-2 text-sm flex items-center justify-center gap-1"
                          >
                            <Activity size={16} /> View Splice Matrix
                          </button>
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

              let cableStatus = 'Active';
              if (feature.properties.name.toLowerCase().includes('cut') || feature.properties.name.toLowerCase().includes('broken')) cableStatus = 'Damaged';
              else if (feature.properties.name.toLowerCase().includes('maint')) cableStatus = 'Maintenance';
              else if (index % 5 === 0) cableStatus = 'Healthy';

              const cableType = feature.properties.cable_type || 'Distribution';
              const typeColorMap: Record<string, string> = {
                'Backbone': '#1E3A8A', // very dark blue
                'Feeder': '#0284C7', // sky blue
                'Distribution': '#475569', // slate
                'Drop': '#94A3B8' // light slate
              };
              
              const baseColor = typeColorMap[cableType] || '#475569';
              let finalColor = baseColor;
              let dashArray = '';
              let weight = cableType === 'Backbone' ? 5 : cableType === 'Feeder' ? 4 : cableType === 'Distribution' ? 3 : 2;

              if (cableStatus === 'Damaged') {
                finalColor = '#EF4444'; // Red
                dashArray = '5, 5';
              } else if (cableStatus === 'Maintenance') {
                finalColor = '#F97316'; // Orange
                dashArray = '10, 10';
              } else if (cableType === 'Drop') {
                dashArray = '4, 4';
              }

              return (
                <Polyline 
                  key={index} 
                  positions={coords} 
                  pathOptions={{ color: finalColor, weight, opacity: 0.8, dashArray }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-lg border-b pb-2 mb-2">{feature.properties.name}</h3>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p><strong>Type:</strong> {feature.properties.cable_type}</p>
                        <p><strong>Region:</strong> {feature.properties.region || '-'}</p>
                        <p><strong>Status:</strong> <span style={{color: finalColor}}>{cableStatus}</span></p>
                        <p><strong>Capacity:</strong> {feature.properties.capacity} Core</p>
                        {feature.properties.description && (
                          <p className="italic text-xs mt-1">"{feature.properties.description}"</p>
                        )}
                      </div>
                      <button 
                        onClick={() => alert("Kabel ini memiliki " + feature.properties.capacity + " core. Fitur view detail kabel akan datang di update selanjutnya!")}
                        className="mt-3 w-full btn-primary py-1 px-2 text-sm"
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
        
        <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur border border-dark-border p-4 rounded-xl shadow-lg flex gap-8">
          <div>
            <h4 className="text-dark-text font-semibold mb-2 text-sm border-b pb-1">Nodes (Devices)</h4>
            <div className="space-y-2 text-sm text-dark-muted">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-500 border border-white"></div>
                <span>Pole (Tiang)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-600 flex items-center justify-center text-[8px] font-bold text-yellow-900">S</div>
                <span>Slack / Oloop</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-sm bg-orange-500 border-2 border-white"></div>
                <span>Closure (JC/JB)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-sm bg-green-500 border-2 border-white"></div>
                <span>ODP</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-purple-600 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">P</div>
                <span>PoP / OLT</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-dark-text font-semibold mb-2 text-sm border-b pb-1">Cables (Routes)</h4>
            <div className="space-y-2 text-sm text-dark-muted">
              <div className="flex items-center gap-2">
                <div className="w-6 h-1.5 bg-[#1E3A8A] rounded"></div>
                <span>Backbone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 bg-[#0284C7] rounded"></div>
                <span>Feeder</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-[#475569] rounded"></div>
                <span>Distribution</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 border-b-2 border-dashed border-[#94A3B8]"></div>
                <span>Drop</span>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-dark-border/50">
                <div className="w-6 border-b-2 border-dashed border-[#EF4444]"></div>
                <span className="text-danger">Cut / Damaged</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Splice Matrix Modal */}
      {selectedClosure && (
        <div className="fixed inset-0 bg-dark-text/30 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
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
