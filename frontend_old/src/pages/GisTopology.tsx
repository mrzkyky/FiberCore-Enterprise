// @ts-nocheck
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Map, { Source, Layer, Popup as MapPopup, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre';
import type { CircleLayer, LineLayer, SymbolLayer, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuthStore } from '../store/useAuthStore';
import { 
  Loader2, Layers, MapPin, Server, Activity, X, Edit, Box, GitMerge, List, 
  Route, Database, ChevronDown, ChevronUp, Map as MapIcon, RotateCw, 
  Plus, Download, Trash2, MousePointer, FolderPlus, Route as RouteIcon, 
  Check, Undo2, Compass, AlertCircle, Maximize2, Minimize2, FileText
} from 'lucide-react';

export default function GisTopology() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();
  const [selectedClosure, setSelectedClosure] = useState<string | null>(null);
  const [mapRegionFilter, setMapRegionFilter] = useState<string>('All');
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [isFullScreenMap, setIsFullScreenMap] = useState<boolean>(false);
  const mapRef = useRef<MapRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [loadedIcons, setLoadedIcons] = useState<string[]>([]);
  
  // --- Web Editor States ---
  const [editorMode, setEditorMode] = useState<'select' | 'add-node' | 'draw-cable'>('select');
  const [selectedNodeType, setSelectedNodeType] = useState<string>('Tiang');
  const [selectedCableType, setSelectedCableType] = useState<string>('Distribution');
  const [cablePoints, setCablePoints] = useState<[number, number][]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Custom Created Projects / Regions
  const [customRegions, setCustomRegions] = useState<string[]>([]);
  const [newProjectModal, setNewProjectModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');

  // Batch Splice (Pelebaran) Modal State
  const [batchSpliceModal, setBatchSpliceModal] = useState<boolean>(false);
  const [batchSpliceForm, setBatchSpliceForm] = useState({
    cable_a_id: '',
    cable_b_id: '',
    closure_id: '',
    count: 12,
    start_core_a: 1,
    start_core_b: 1,
    auto_update_description: true,
    custom_note: ''
  });
  const [isBatchSplicing, setIsBatchSplicing] = useState<boolean>(false);

  // Modals for Adding New Node & Cable
  const [newNodeModal, setNewNodeModal] = useState<{ lng: number; lat: number } | null>(null);
  const [newNodeForm, setNewNodeForm] = useState({
    name: '',
    device_type: 'Tiang',
    capacity: '8',
    region: '',
    description: ''
  });

  const [newCableModal, setNewCableModal] = useState<boolean>(false);
  const [newCableForm, setNewCableForm] = useState({
    name: '',
    type: 'Distribution',
    capacity: 24,
    line_width: 3.5,
    region: '',
    description: ''
  });
  
  // Edit State & Popup State
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ used_capacity: '', description: '' });
  
  const [popupInfo, setPopupInfo] = useState<{
    feature: any;
    lngLat: [number, number];
  } | null>(null);

  const { data: geoData, isLoading } = useQuery({
    queryKey: ['map-topology', mapRegionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mapRegionFilter !== 'All') {
        params.append('region', mapRegionFilter);
      }
      const response = await axios.get(`/api/v1/map/topology?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data; // GeoJSON FeatureCollection
    },
    refetchInterval: autoSync ? 5000 : false, // Auto-sync with Google Earth Pro every 5s
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
      setPopupInfo(null);
    }
  });

  // Extract unique regions for dropdown (we fallback to fetching 'All' initially to get them)
  const { data: allGeoData } = useQuery({
    queryKey: ['map-topology', 'All'],
    queryFn: async () => {
      const response = await axios.get(`/api/v1/map/topology`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    staleTime: 60000 // Cache for 1 min
  });

  const uniqueRegions = useMemo(() => {
    const fromData = Array.from(new Set(
      allGeoData?.features
        ?.map((f: any) => f.properties.region)
        .filter(Boolean)
    )) as string[];
    return Array.from(new Set([...fromData, ...customRegions]));
  }, [allGeoData, customRegions]);

  const availableCables = useMemo(() => {
    if (!allGeoData?.features) return [];
    return allGeoData.features
      .filter((f: any) => f.properties?.type === 'cable')
      .map((f: any) => ({
        id: f.properties.id,
        name: f.properties.name,
        capacity: f.properties.capacity,
        region: f.properties.region,
        cable_type: f.properties.cable_type
      }));
  }, [allGeoData]);

  const availableClosures = useMemo(() => {
    if (!allGeoData?.features) return [];
    return allGeoData.features
      .filter((f: any) => f.properties?.type === 'device' && ['Closure', 'Joint Closure', 'ODP', 'Joint Box'].some(t => (f.properties?.device_type || '').toLowerCase().includes(t.toLowerCase())))
      .map((f: any) => ({
        id: f.properties.id,
        name: f.properties.name,
        device_type: f.properties.device_type,
        region: f.properties.region
      }));
  }, [allGeoData]);

  // Computed KPI Stats from Map
  const stats = useMemo(() => {
    if (!geoData?.features) return null;
    const s = {
      pop: 0,
      odp: 0,
      totalTiang: 0,
      tiangSpek: 0,
      tiangBiasa: 0,
      closure: 0,
      jointClosure: 0,
      jointBox: 0,
      slack: 0,
      backboneMeters: 0,
      dropcoreMeters: 0,
      distributionMeters: 0,
      feederMeters: 0
    };

    geoData.features.forEach((f: any) => {
      const props = f.properties;
      if (props.type === 'pop') {
        s.pop++;
      } else if (props.type === 'device') {
        const type = (props.device_type || '').toLowerCase();
        const desc = (props.description || '').toLowerCase();
        
        if (type.includes('odp')) s.odp++;
        else if (type === 'tiang spek') { s.totalTiang++; s.tiangSpek++; }
        else if (type.includes('tiang') || type.includes('pole')) { s.totalTiang++; s.tiangBiasa++; }
        else if (type === 'joint closure') s.jointClosure++;
        else if (type === 'joint box') s.jointBox++;
        else if (type.includes('closure')) s.closure++;
        else if (type.includes('slack') || type.includes('oloop')) s.slack++;
      } else if (props.type === 'cable') {
        const cType = (props.cable_type || '').toLowerCase();
        const length = parseFloat(props.length) || 0;
        if (cType === 'backbone') s.backboneMeters += length;
        else if (cType === 'dropcore' || cType === 'drop') s.dropcoreMeters += length;
        else if (cType === 'feeder') s.feederMeters += length;
        else s.distributionMeters += length;
      }
    });
    return s;
  }, [geoData]);

  const formatLength = (meters: number) => {
    if (meters < 1000) return `${meters.toFixed(0)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const [showDataTable, setShowDataTable] = useState(true);
  const [tableSearch, setTableSearch] = useState('');

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

  // --- Handlers for Web Editing ---
  const onMapClick = (event: any) => {
    const { features, lngLat } = event;
    
    if (editorMode === 'add-node') {
      const reg = mapRegionFilter !== 'All' ? mapRegionFilter : (uniqueRegions[0] || 'Default_Project');
      const prefix = selectedNodeType === 'Tiang' ? 'T-' : selectedNodeType === 'ODP' ? 'ODP-' : selectedNodeType === 'Closure' ? 'CLS-' : 'NODE-';
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setNewNodeForm({
        name: `${prefix}${randomSuffix}`,
        device_type: selectedNodeType,
        capacity: selectedNodeType === 'ODP' ? '8' : selectedNodeType === 'POP' ? '16' : '24',
        region: reg,
        description: ''
      });
      setNewNodeModal({ lng: lngLat.lng, lat: lngLat.lat });
      return;
    }
    
    if (editorMode === 'draw-cable') {
      setCablePoints(prev => [...prev, [lngLat.lng, lngLat.lat]]);
      return;
    }

    if (features && features.length > 0) {
      const clickedFeature = features[0];
      setPopupInfo({
        feature: clickedFeature,
        lngLat: [lngLat.lng, lngLat.lat]
      });
    } else {
      setPopupInfo(null);
    }
  };

  const handleSaveNewNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeModal) return;
    setIsSubmitting(true);
    try {
      await axios.post('/api/v1/devices/', {
        name: newNodeForm.name,
        device_type: newNodeForm.device_type,
        capacity: newNodeForm.capacity ? parseInt(newNodeForm.capacity) : null,
        used_capacity: 0,
        region: newNodeForm.region || (mapRegionFilter !== 'All' ? mapRegionFilter : 'Default_Project'),
        description: newNodeForm.description,
        latitude: newNodeModal.lat,
        longitude: newNodeModal.lng
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      queryClient.invalidateQueries({ queryKey: ['map-topology'] });
      setNewNodeModal(null);
    } catch (err: any) {
      alert('Gagal menambah node: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDrawnCable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cablePoints.length < 2) return;
    setIsSubmitting(true);
    try {
      await axios.post('/api/v1/cables/draw', {
        name: newCableForm.name || `Kabel-${newCableForm.type}`,
        capacity: Number(newCableForm.capacity) || 12,
        type: newCableForm.type,
        line_width: Number(newCableForm.line_width) || 3.5,
        region: newCableForm.region || (mapRegionFilter !== 'All' ? mapRegionFilter : 'Default_Project'),
        description: newCableForm.description,
        coordinates: cablePoints
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      queryClient.invalidateQueries({ queryKey: ['map-topology'] });
      setCablePoints([]);
      setNewCableModal(false);
      setEditorMode('select');
    } catch (err: any) {
      alert('Gagal menyimpan kabel: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeature = async (id: string, type: 'device' | 'cable', name: string) => {
    if (!confirm(`Hapus ${type === 'device' ? 'perangkat' : 'jalur kabel'} "${name}" dari database?`)) return;
    try {
      if (type === 'device') {
        await axios.delete(`/api/v1/devices/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.delete(`/api/v1/cables/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      queryClient.invalidateQueries({ queryKey: ['map-topology'] });
      setPopupInfo(null);
    } catch (err: any) {
      alert('Gagal menghapus: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const cleanName = newProjectName.trim().replace(/\s+/g, '_');
    setCustomRegions(prev => Array.from(new Set([...prev, cleanName])));
    setMapRegionFilter(cleanName);
    setNewProjectName('');
    setNewProjectModal(false);
  };

  const handleBatchSplice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchSpliceForm.cable_a_id || !batchSpliceForm.cable_b_id) {
      alert("Harap pilih kabel asal dan kabel tujuan!");
      return;
    }
    if (batchSpliceForm.cable_a_id === batchSpliceForm.cable_b_id) {
      alert("Kabel asal dan kabel tujuan tidak boleh sama!");
      return;
    }
    setIsBatchSplicing(true);
    try {
      const res = await axios.post('/api/v1/splices/batch-connect', {
        cable_a_id: batchSpliceForm.cable_a_id,
        cable_b_id: batchSpliceForm.cable_b_id,
        closure_id: batchSpliceForm.closure_id || null,
        count: Number(batchSpliceForm.count) || 12,
        start_core_a: Number(batchSpliceForm.start_core_a) || 1,
        start_core_b: Number(batchSpliceForm.start_core_b) || 1,
        auto_update_description: batchSpliceForm.auto_update_description,
        custom_note: batchSpliceForm.custom_note
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['map-topology'] });
      setBatchSpliceModal(false);
    } catch (err: any) {
      alert('Gagal menyambung kabel: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsBatchSplicing(false);
    }
  };

  const toggleFullScreen = () => {
    const elem = mapContainerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => setIsFullScreenMap(true));
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
      setIsFullScreenMap(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullScreenMap(false);
    }
    setTimeout(() => mapRef.current?.resize(), 200);
  };

  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullScreenMap(isFs);
      setTimeout(() => mapRef.current?.resize(), 200);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const currentDrawnLength = useMemo(() => {
    if (cablePoints.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < cablePoints.length - 1; i++) {
      const [lon1, lat1] = cablePoints[i];
      const [lon2, lat2] = cablePoints[i + 1];
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += R * c;
    }
    return total;
  }, [cablePoints]);

  const handleExportKmz = async () => {
    try {
      const regParam = mapRegionFilter !== 'All' ? `?region=${encodeURIComponent(mapRegionFilter)}` : '';
      const response = await axios.get(`/api/v1/map/export-kmz${regParam}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = new Blob([response.data], { type: 'application/vnd.google-earth.kmz' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FiberCore_${mapRegionFilter}.kmz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Gagal mengekspor file KMZ: ' + (err.message || err));
    }
  };

  const handleExportKml = async () => {
    try {
      const regParam = mapRegionFilter !== 'All' ? `?region=${encodeURIComponent(mapRegionFilter)}` : '';
      const response = await axios.get(`/api/v1/map/export-kml${regParam}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = new Blob([response.data], { type: 'application/vnd.google-earth.kml+xml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FiberCore_${mapRegionFilter}.kml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Gagal mengekspor file KML: ' + (err.message || err));
    }
  };

  const drawingLineGeoJSON = useMemo(() => {
    if (cablePoints.length < 2) return null;
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: cablePoints
      },
      properties: {}
    };
  }, [cablePoints]);

  const drawingPointsGeoJSON = useMemo(() => {
    if (cablePoints.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: cablePoints.map((pt, idx) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: pt
        },
        properties: { index: idx }
      }))
    };
  }, [cablePoints]);

  // --- Custom GIS Vector Icons ---
  const CUSTOM_SVGS: Record<string, string> = {
    'custom-icon-tiang': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#ef4444" stroke="#ffffff" stroke-width="2.5"/><rect x="16.5" y="7" width="3" height="22" rx="1.5" fill="#ffffff"/><rect x="8" y="11" width="20" height="3" rx="1" fill="#ffffff"/><rect x="11" y="16.5" width="14" height="2.2" rx="1" fill="#ffffff"/><circle cx="9.5" cy="10.5" r="1.5" fill="#fef08a"/><circle cx="26.5" cy="10.5" r="1.5" fill="#fef08a"/><circle cx="12.5" cy="15.5" r="1.2" fill="#fef08a"/><circle cx="23.5" cy="15.5" r="1.2" fill="#fef08a"/></svg>',
    'custom-icon-odp': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#16a34a" stroke="#ffffff" stroke-width="2.5"/><rect x="9" y="9" width="18" height="18" rx="3" fill="#ffffff"/><circle cx="13" cy="13.5" r="1.6" fill="#16a34a"/><circle cx="18" cy="13.5" r="1.6" fill="#16a34a"/><circle cx="23" cy="13.5" r="1.6" fill="#16a34a"/><circle cx="13" cy="18.5" r="1.6" fill="#16a34a"/><circle cx="18" cy="18.5" r="1.6" fill="#16a34a"/><circle cx="23" cy="18.5" r="1.6" fill="#16a34a"/><rect x="11.5" y="22.5" width="13" height="2" rx="1" fill="#15803d"/></svg>',
    'custom-icon-closure': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#7c3aed" stroke="#ffffff" stroke-width="2.5"/><rect x="8" y="12" width="20" height="12" rx="4" fill="#ffffff"/><line x1="5" y1="18" x2="8" y2="18" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="18" x2="31" y2="18" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><rect x="15" y="13" width="6" height="10" rx="1" fill="#7c3aed"/></svg>',
    'custom-icon-pop': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/><rect x="10" y="8" width="16" height="5.5" rx="1.5" fill="#ffffff"/><rect x="10" y="15" width="16" height="5.5" rx="1.5" fill="#ffffff"/><rect x="10" y="22" width="16" height="5.5" rx="1.5" fill="#ffffff"/><circle cx="13" cy="10.8" r="1" fill="#2563eb"/><circle cx="13" cy="17.8" r="1" fill="#2563eb"/><circle cx="13" cy="24.8" r="1" fill="#2563eb"/><line x1="16" y1="10.8" x2="23" y2="10.8" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="17.8" x2="23" y2="17.8" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="24.8" x2="23" y2="24.8" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round"/></svg>',
    'custom-icon-slack': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#eab308" stroke="#ffffff" stroke-width="2.5"/><circle cx="18" cy="18" r="8" fill="none" stroke="#ffffff" stroke-width="2.5"/><circle cx="18" cy="18" r="4" fill="none" stroke="#ffffff" stroke-width="2"/><circle cx="18" cy="18" r="1.5" fill="#ffffff"/></svg>',
    'custom-icon-joint_box': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#db2777" stroke="#ffffff" stroke-width="2.5"/><rect x="10" y="10" width="16" height="16" rx="2" fill="#ffffff"/><path d="M14 14l8 8m0-8l-8 8" stroke="#db2777" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  // --- Icon System: Hash-based IDs for MapLibre ---
  const iconMapping = useRef<Record<string, string>>({});
  const iconCounter = useRef(0);

  const processedGeoData = useMemo(() => {
    if (!geoData) return null;
    iconMapping.current = {};
    iconCounter.current = 0;

    const features = geoData.features.map((f: any) => {
      let iconId = null;
      if (f.properties?.icon_url) {
        const url = f.properties.icon_url;
        if (!iconMapping.current[url]) {
          iconMapping.current[url] = `kmz-icon-${iconCounter.current++}`;
        }
        iconId = iconMapping.current[url];
      } else if (f.properties?.type === 'device') {
        const dtype = (f.properties?.device_type || '').toLowerCase();
        if (dtype.includes('odp')) iconId = 'custom-icon-odp';
        else if (dtype.includes('joint closure')) iconId = 'custom-icon-closure';
        else if (dtype.includes('closure')) iconId = 'custom-icon-closure';
        else if (dtype.includes('joint box')) iconId = 'custom-icon-joint_box';
        else if (dtype.includes('slack') || dtype.includes('oloop')) iconId = 'custom-icon-slack';
        else if (dtype.includes('pop') || dtype.includes('olt')) iconId = 'custom-icon-pop';
        else iconId = 'custom-icon-tiang';
      }
      return {
        ...f,
        properties: {
          ...f.properties,
          icon_id: iconId
        }
      };
    });

    return { ...geoData, features };
  }, [geoData]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const newlyLoaded: string[] = [];

    // Pre-load custom SVG icons
    Object.entries(CUSTOM_SVGS).forEach(([id, svg]) => {
      if (!map.hasImage(id)) {
        const img = new Image(36, 36);
        img.onload = () => {
          if (!map.hasImage(id)) {
            map.addImage(id, img);
            setLoadedIcons(prev => prev.includes(id) ? prev : [...prev, id]);
          }
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
      } else {
        newlyLoaded.push(id);
      }
    });

    // Load KMZ remote icons if any
    Object.entries(iconMapping.current).forEach(([url, iconId]) => {
      if (map.hasImage(iconId)) {
        newlyLoaded.push(iconId);
        return;
      }

      if (url.startsWith('data:')) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          if (!map.hasImage(iconId)) {
            map.addImage(iconId, img);
            setLoadedIcons(prev => (!prev.includes(iconId) ? [...prev, iconId] : prev));
          }
        };
        img.onerror = () => console.warn('Failed to load base64 icon:', iconId);
      } else {
        map.loadImage(url, (error: any, imgData: any) => {
          if (error) { return; }
          if (imgData && !map.hasImage(iconId)) {
            map.addImage(iconId, imgData);
            setLoadedIcons(prev => (!prev.includes(iconId) ? [...prev, iconId] : prev));
          }
        });
      }
    });

    if (newlyLoaded.length > 0) {
      setLoadedIcons(prev => Array.from(new Set([...prev, ...newlyLoaded])));
    }
  }, [processedGeoData]);

  // --- MapLibre Styling Layers ---
  
  const cableLayerStyle: LineLayer = {
    id: 'cables',
    type: 'line',
    source: 'topology',
    filter: ['==', ['get', 'type'], 'cable'],
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#475569'],
      'line-width': ['coalesce', ['get', 'line_width'], 3.5],
      'line-opacity': 0.85
    }
  };

  const popLayerStyle: CircleLayer = {
    id: 'pops',
    type: 'circle',
    source: 'topology',
    filter: ['==', ['get', 'type'], 'pop'],
    paint: {
      'circle-radius': 8,
      'circle-color': '#9333ea',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  };

  const hasIconExpression = loadedIcons.length > 0 
    ? ['in', ['get', 'icon_id'], ['literal', loadedIcons]] 
    : false;

  const deviceSymbolLayerStyle: SymbolLayer = {
    id: 'devices-symbol',
    type: 'symbol',
    source: 'topology',
    filter: ['all', ['==', ['get', 'type'], 'device'], hasIconExpression],
    layout: {
      'icon-image': ['get', 'icon_id'],
      'icon-size': 0.85,
      'icon-allow-overlap': true
    }
  };

  const deviceLayerStyle: CircleLayer = {
    id: 'devices',
    type: 'circle',
    source: 'topology',
    filter: ['all', ['==', ['get', 'type'], 'device'], ['!', hasIconExpression]],
    paint: {
      'circle-radius': [
        'match',
        ['get', 'device_type'],
        'POP', 8,
        'OLT', 8,
        'Closure', 6,
        'Joint Closure', 6,
        'Joint Box', 6,
        'ODP', 5,
        'Slack', 5,
        'Tiang Spek', 4,
        4 // Default Pole (Tiang Biasa)
      ],
      'circle-color': [
        'match',
        ['get', 'device_type'],
        'POP', '#9333ea',
        'OLT', '#9333ea',
        'Closure', '#f97316',
        'Joint Closure', '#a855f7',
        'Joint Box', '#ec4899',
        'ODP', '#22c55e',
        'Slack', '#facc15',
        'Tiang Spek', '#ef4444',
        '#ef4444' // Default Pole (Tiang Biasa) = RED like reference
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': [
        'match',
        ['get', 'device_type'],
        'Slack', '#ca8a04',
        'Joint Closure', '#7c3aed',
        'Joint Box', '#db2777',
        'ODP', '#16a34a',
        '#ffffff'
      ]
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] relative gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <MapPin className="text-primary" />
            FTTH Topology Viewer
          </h1>
          <p className="text-dark-muted text-sm mt-1">Interactive Map & Asset Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live Auto-Sync Indicator & Toggle */}
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              autoSync 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' 
                : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
            }`}
            title="Auto-refresh map topology every 5 seconds when Google Earth saves changes"
          >
            <span className={`h-2 w-2 rounded-full ${autoSync ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
            {autoSync ? 'Live Sync (5s)' : 'Live Sync: Off'}
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['map-topology'] });
            }}
            disabled={isLoading}
            className="p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text hover:bg-dark-border transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
            title="Refresh Map Now"
          >
            <RotateCw size={16} className={isLoading ? 'animate-spin text-primary' : ''} />
          </button>

          <select 
            value={mapRegionFilter}
            onChange={(e) => {
              setMapRegionFilter(e.target.value);
              setPopupInfo(null);
            }}
            className="bg-dark-surface border border-dark-border rounded-lg px-4 py-2 text-sm text-dark-text focus:outline-none focus:border-primary font-medium"
          >
            <option value="All">🌐 All Regions / Overview</option>
            {uniqueRegions.map(r => <option key={r} value={r}>📍 Region: {r}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 shrink-0">
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><Server size={12}/> POP</span>
            <span className="text-2xl font-bold text-orange-500 mt-2">{stats.pop}</span>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><Database size={12}/> ODP</span>
            <span className="text-2xl font-bold text-blue-500 mt-2">{stats.odp}</span>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm col-span-2">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><MapPin size={12}/> Total Tiang</span>
            <div className="flex flex-col mt-1">
              <span className="text-2xl font-bold text-blue-400">{stats.totalTiang}</span>
              <span className="text-[10px] text-dark-muted font-bold mt-1 tracking-wider uppercase">TIANG SPEK: {stats.tiangSpek}, TIANG BIASA: {stats.tiangBiasa}</span>
            </div>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><GitMerge size={12}/> Closure</span>
            <span className="text-2xl font-bold text-purple-400 mt-2">{stats.closure}</span>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><Box size={12}/> Joint Closure</span>
            <span className="text-2xl font-bold text-purple-500 mt-2">{stats.jointClosure}</span>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><Box size={12}/> Joint Box</span>
            <span className="text-2xl font-bold text-red-500 mt-2">{stats.jointBox}</span>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm col-span-2">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><Route size={12}/> Total Panjang Kabel</span>
            <div className="flex flex-col mt-1">
              <span className="text-2xl font-bold text-emerald-400">
                {formatLength(stats.backboneMeters + stats.feederMeters + stats.distributionMeters + stats.dropcoreMeters)}
              </span>
              <span className="text-[10px] text-dark-muted font-bold mt-1 tracking-wider uppercase">
                DIST: {formatLength(stats.distributionMeters)}, FDR: {formatLength(stats.feederMeters)}, DROP: {formatLength(stats.dropcoreMeters)}
              </span>
            </div>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-xs text-dark-muted font-semibold flex items-center gap-1 uppercase tracking-wider"><Activity size={12}/> Slack Kabel</span>
            <span className="text-2xl font-bold text-yellow-500 mt-2">{stats.slack}</span>
          </div>
        </div>
      )}

      {/* --- WEB GIS EDITOR & ACTIONS TOOLBAR --- */}
      <div className="bg-dark-surface border border-dark-border rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-dark-muted mr-1 uppercase tracking-wider flex items-center gap-1">
            <Compass size={14} className="text-primary" /> Mode Editor:
          </span>

          <button
            onClick={() => { setEditorMode('select'); setCablePoints([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              editorMode === 'select'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-dark-border/40 text-dark-text hover:bg-dark-border'
            }`}
          >
            <MousePointer size={14} /> 🖱️ Jelajah / Info
          </button>

          <button
            onClick={() => { setEditorMode('add-node'); setCablePoints([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              editorMode === 'add-node'
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                : 'bg-dark-border/40 text-dark-text hover:bg-dark-border'
            }`}
          >
            <MapPin size={14} /> 📍 + Pasang Node
          </button>

          {editorMode === 'add-node' && (
            <select
              value={selectedNodeType}
              onChange={(e) => setSelectedNodeType(e.target.value)}
              className="bg-emerald-50 border border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none"
            >
              <option value="Tiang">📍 Tiang (Pole)</option>
              <option value="ODP">🟩 ODP (Distribution Point)</option>
              <option value="Closure">🔶 Closure</option>
              <option value="Joint Closure">🟣 Joint Closure</option>
              <option value="Joint Box">🔴 Joint Box</option>
              <option value="POP">🏢 POP / OLT</option>
              <option value="Slack">🟡 Slack Kabel</option>
            </select>
          )}

          <button
            onClick={() => { setEditorMode('draw-cable'); setCablePoints([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              editorMode === 'draw-cable'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                : 'bg-dark-border/40 text-dark-text hover:bg-dark-border'
            }`}
          >
            <RouteIcon size={14} /> 〰️ + Tarik Kabel
          </button>

          {editorMode === 'draw-cable' && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg px-2.5 py-1">
              <select
                value={selectedCableType}
                onChange={(e) => setSelectedCableType(e.target.value)}
                className="bg-transparent text-amber-900 dark:text-amber-200 text-xs font-bold focus:outline-none"
              >
                <option value="Distribution">🟦 Distribution</option>
                <option value="Feeder">🟧 Feeder</option>
                <option value="Backbone">🟥 Backbone</option>
                <option value="Dropcore">🟩 Dropcore</option>
              </select>

              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
                Titik: {cablePoints.length}
              </span>

              {cablePoints.length >= 2 && (
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-mono">
                  Panjang: {formatLength(currentDrawnLength)}
                </span>
              )}

              {cablePoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCablePoints(prev => prev.slice(0, -1))}
                  className="text-xs text-amber-800 hover:text-amber-950 font-bold px-1 cursor-pointer"
                  title="Undo titik terakhir"
                >
                  ↩️ Undo
                </button>
              )}

              {cablePoints.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const reg = mapRegionFilter !== 'All' ? mapRegionFilter : (uniqueRegions[0] || 'Default_Project');
                    setNewCableForm({
                      name: `Kabel-${selectedCableType}-${Math.floor(100 + Math.random()*900)}`,
                      type: selectedCableType,
                      capacity: selectedCableType === 'Backbone' ? 96 : selectedCableType === 'Feeder' ? 48 : 24,
                      region: reg,
                      description: ''
                    });
                    setNewCableModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-xs font-bold cursor-pointer transition-colors shadow-xs"
                >
                  ✅ Selesai & Simpan
                </button>
              )}

              <button
                type="button"
                onClick={() => { setCablePoints([]); setEditorMode('select'); }}
                className="text-xs text-red-600 hover:text-red-800 font-bold px-1 cursor-pointer"
              >
                ❌ Batal
              </button>
            </div>
          )}
        </div>

        {/* Right: Project Management, Splicing, Export & Fullscreen */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setBatchSpliceModal(true)}
            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Sambungkan kabel proyek lama dengan kabel pelebaran baru secara otomatis"
          >
            <GitMerge size={13} /> + Sambung Pelebaran
          </button>

          <button
            onClick={() => setNewProjectModal(true)}
            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <FolderPlus size={13} /> + Project Baru
          </button>

          <button
            onClick={handleExportKml}
            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Download file KML standar Google Earth (langsung tanpa blokir browser)"
          >
            <FileText size={13} /> Export KML
          </button>

          <button
            onClick={handleExportKmz}
            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Download file KMZ arsip untuk Google Earth Pro"
          >
            <Download size={13} /> Export KMZ
          </button>

          <button
            onClick={toggleFullScreen}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title={isFullScreenMap ? "Keluar dari Layar Penuh" : "Tampilkan Peta Layar Penuh"}
          >
            {isFullScreenMap ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullScreenMap ? "Keluar Fullscreen" : "Fullscreen Peta"}
          </button>
        </div>
      </div>

      <div 
        ref={mapContainerRef}
        className={`flex flex-col bg-dark-surface border border-dark-border overflow-hidden relative shadow-sm transition-all duration-200 ${
          isFullScreenMap 
            ? 'fixed inset-0 z-[99999] w-screen h-screen rounded-none border-none bg-white' 
            : 'flex-1 min-h-0 rounded-xl'
        }`}
      >
        {isFullScreenMap && (
          <div className="absolute top-4 left-4 z-[450] bg-dark-surface/95 backdrop-blur-md border border-dark-border px-3 py-2 rounded-xl shadow-2xl flex items-center gap-3">
            <span className="text-xs font-bold text-dark-text flex items-center gap-1.5">
              <Compass size={14} className="text-primary" /> Mode Fullscreen
            </span>
            <button
              onClick={toggleFullScreen}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <Minimize2 size={12} /> Keluar Fullscreen
            </button>
          </div>
        )}
        {/* Floating Active Tool Banner */}
        {editorMode !== 'select' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] bg-dark-surface/95 backdrop-blur-md border border-dark-border px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold text-dark-text animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            {editorMode === 'add-node' && (
              <span>📍 Mode Pasang Node: Klik di peta untuk menaruh <strong>{selectedNodeType}</strong></span>
            )}
            {editorMode === 'draw-cable' && (
              <span>〰️ Mode Tarik Kabel: Klik titik demi titik untuk kabel <strong>{selectedCableType}</strong> ({cablePoints.length} titik)</span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <p className="text-primary font-mono animate-pulse">Loading spatial data...</p>
          </div>
        ) : null}

        <Map
          ref={mapRef}
          initialViewState={{
            longitude: 106.816666,
            latitude: -6.200000,
            zoom: 10
          }}
          mapStyle={
            mapType === 'streets' 
              ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              : {
                  version: 8,
                  sources: {
                    'esri-satellite': {
                      type: 'raster',
                      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                      tileSize: 256
                    }
                  },
                  layers: [
                    {
                      id: 'satellite',
                      type: 'raster',
                      source: 'esri-satellite',
                      minzoom: 0,
                      maxzoom: 22
                    }
                  ]
                }
          }
          interactiveLayerIds={editorMode === 'select' ? ['cables', 'pops', 'devices', 'devices-symbol'] : []}
          onClick={onMapClick}
          cursor={editorMode === 'select' ? 'pointer' : 'crosshair'}
        >
          <NavigationControl position="top-right" />
          <FullscreenControl position="top-right" />

          {/* Active Drawing Layers */}
          {drawingLineGeoJSON && (
            <Source id="drawing-cable-source" type="geojson" data={drawingLineGeoJSON}>
              <Layer
                id="drawing-cable-layer"
                type="line"
                paint={{
                  'line-color': '#f59e0b',
                  'line-width': 4,
                  'line-dasharray': [2, 1]
                }}
              />
            </Source>
          )}
          {drawingPointsGeoJSON && (
            <Source id="drawing-points-source" type="geojson" data={drawingPointsGeoJSON}>
              <Layer
                id="drawing-points-layer"
                type="circle"
                paint={{
                  'circle-radius': 6,
                  'circle-color': '#f59e0b',
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#ffffff'
                }}
              />
            </Source>
          )}

          {/* Map Style Toggle */}
          <div className="absolute top-28 right-2.5 z-10 bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <button 
              onClick={() => setMapType('streets')}
              className={`p-2 transition-colors ${mapType === 'streets' ? 'bg-blue-100 text-blue-600' : 'bg-white hover:bg-gray-100'}`}
              title="Streets View"
            >
              <MapPin size={18} />
            </button>
            <button 
              onClick={() => setMapType('satellite')}
              className={`p-2 transition-colors border-t border-gray-200 ${mapType === 'satellite' ? 'bg-blue-100 text-blue-600' : 'bg-white hover:bg-gray-100'}`}
              title="Satellite View"
            >
              <MapIcon size={18} />
            </button>
          </div>

          {processedGeoData && (
            <Source id="topology" type="geojson" data={processedGeoData}>
              <Layer {...cableLayerStyle} />
              <Layer {...popLayerStyle} />
              <Layer {...deviceLayerStyle} />
              <Layer {...deviceSymbolLayerStyle} />
            </Source>
          )}

          {/* Popup Rendering */}
          {popupInfo && (
            <MapPopup
              longitude={popupInfo.lngLat[0]}
              latitude={popupInfo.lngLat[1]}
              anchor="bottom"
              onClose={() => setPopupInfo(null)}
              closeButton={true}
              closeOnClick={false}
              className="z-[100]"
              maxWidth="300px"
            >
              <div className="p-1 min-w-[200px] text-dark-text">
                <h3 className="font-bold text-lg border-b pb-2 mb-2">{popupInfo.feature.properties.name}</h3>
                
                {popupInfo.feature.properties.type === 'cable' ? (
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><strong>Type:</strong> {popupInfo.feature.properties.cable_type}</p>
                    <p><strong>Region:</strong> {popupInfo.feature.properties.region || '-'}</p>
                    <p><strong>Capacity:</strong> {popupInfo.feature.properties.capacity} Core</p>
                    <p><strong>Panjang Kabel:</strong> <span className="font-bold text-emerald-600 font-mono">{formatLength(popupInfo.feature.properties.length || 0)}</span></p>
                    {popupInfo.feature.properties.description && popupInfo.feature.properties.description.trim() !== '' && (
                      <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-2 mb-2">
                        <p className="text-sm text-gray-800 font-medium">Description:</p>
                        <p className="text-xs text-gray-600">
                          {popupInfo.feature.properties.description}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setBatchSpliceForm(prev => ({ ...prev, cable_a_id: popupInfo.feature.properties.id }));
                          setBatchSpliceModal(true);
                        }}
                        className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Sambungkan kabel ini dengan kabel pelebaran / proyek lain"
                      >
                        <GitMerge size={13} /> Sambung Pelebaran Kabel Ini
                      </button>
                      <button 
                        onClick={() => handleDeleteFeature(popupInfo.feature.properties.id, 'cable', popupInfo.feature.properties.name)}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} /> Hapus Jalur Kabel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                      {popupInfo.feature.properties.type === 'device' ? <Server size={14} /> : <MapPin size={14} />} 
                      {popupInfo.feature.properties.type === 'device' ? popupInfo.feature.properties.device_type : 'PoP Site'}
                    </p>
                    
                    {popupInfo.feature.properties.used_capacity !== undefined && popupInfo.feature.properties.used_capacity !== null && (
                      <p className="text-sm text-gray-700 mb-2 font-medium">
                          Capacity: <span className="text-primary">{popupInfo.feature.properties.used_capacity}</span> Ports Used
                      </p>
                    )}
                    
                    {popupInfo.feature.properties.description && popupInfo.feature.properties.description.trim() !== '' && (
                      <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-2 mb-3">
                        <p className="text-sm text-gray-800 font-medium mb-1">Description:</p>
                        <p className="text-xs text-gray-600">
                          {popupInfo.feature.properties.description}
                        </p>
                      </div>
                    )}
                    
                    {popupInfo.feature.properties.type === 'device' && (
                      <div className="mt-3 flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingDevice(popupInfo.feature.properties);
                            setEditFormData({
                              used_capacity: popupInfo.feature.properties.used_capacity?.toString() || '',
                              description: popupInfo.feature.properties.description || ''
                            });
                          }}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-1.5 px-2 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        
                        {(popupInfo.feature.properties.device_type === 'Closure' || popupInfo.feature.properties.device_type === 'ODP') && (
                          <button 
                            onClick={() => setSelectedClosure(popupInfo.feature.properties.id)}
                            className="flex-1 btn-primary py-1.5 px-2 text-sm flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Activity size={14} /> Matrix
                          </button>
                        )}

                        <button 
                          onClick={() => handleDeleteFeature(popupInfo.feature.properties.id, 'device', popupInfo.feature.properties.name)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus Perangkat"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </MapPopup>
          )}
        </Map>

        {/* Legend */}
        <div className="absolute top-4 right-12 z-[400] bg-dark-surface/90 backdrop-blur border border-dark-border p-3 rounded-xl shadow-lg flex gap-6 pointer-events-none max-w-md">
          <div>
            <div className="space-y-1.5 text-xs text-dark-text">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444] border border-white"></div><span>Tiang</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e] border border-[#16a34a]"></div><span>ODP</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f97316] border border-white"></div><span>Closure</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#a855f7] border border-[#7c3aed]"></div><span>Joint Closure</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ec4899] border border-[#db2777]"></div><span>Joint Box</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#facc15] border border-[#ca8a04]"></div><span>Slack</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#9333ea] border border-white"></div><span>PoP/OLT</span></div>
            </div>
          </div>
          <div>
            <div className="space-y-1.5 text-xs text-dark-text">
              <div className="flex items-center gap-2"><div className="w-5 h-1 bg-[#1E3A8A] rounded"></div><span>Backbone</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-0.5 bg-[#0284C7] rounded"></div><span>Feeder</span></div>
              <div className="flex items-center gap-2"><div className="w-5 border-b border-[#475569] rounded"></div><span>Distribution/Drop</span></div>
            </div>
          </div>
        </div>

        {/* Data Table Panel */}
        <div className={`absolute bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border transition-all duration-300 flex flex-col ${showDataTable ? 'h-64' : 'h-10'}`}>
          <div 
            className="h-10 flex items-center justify-between px-4 bg-dark-surface border-b border-dark-border cursor-pointer hover:bg-dark-surface/80"
            onClick={() => setShowDataTable(!showDataTable)}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-dark-text">
              <List size={16} className="text-primary" />
              Data Table
            </div>
            <div className="flex items-center gap-3">
              {showDataTable && (
                <input 
                  type="text"
                  placeholder="Cari nama..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-black/20 border border-dark-border rounded px-2 py-1 text-xs text-dark-text focus:outline-none w-48"
                />
              )}
              <div className="text-dark-muted">
                {showDataTable ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </div>
            </div>
          </div>
          
          {showDataTable && geoData && (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-dark-surface sticky top-0 z-10 shadow-sm">
                  <tr className="text-dark-muted uppercase tracking-wider">
                    <th className="px-4 py-2 font-medium">Nama</th>
                    <th className="px-4 py-2 font-medium">Tipe</th>
                    <th className="px-4 py-2 font-medium">Kategori / Core</th>
                    <th className="px-4 py-2 font-medium">Panjang / Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border text-dark-text">
                  {geoData.features
                    .filter((f: any) => f.properties.name.toLowerCase().includes(tableSearch.toLowerCase()))
                    .map((f: any) => (
                    <tr key={f.properties.id || Math.random()} className="hover:bg-dark-border/50">
                      <td className="px-4 py-2 font-medium">{f.properties.name}</td>
                      <td className="px-4 py-2 opacity-80">
                        {f.properties.type === 'cable' ? 'Cable Route' : 'Node Device'}
                      </td>
                      <td className="px-4 py-2">
                        {f.properties.type === 'cable' 
                          ? `${f.properties.cable_type} (${f.properties.capacity} Core)` 
                          : f.properties.device_type}
                      </td>
                      <td className="px-4 py-2 text-primary font-mono">
                        {f.properties.type === 'cable' && f.properties.length
                          ? formatLength(f.properties.length)
                          : f.properties.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                    className="w-full px-3 py-2 border border-dark-border rounded-lg focus:outline-none focus:border-primary text-sm bg-white text-dark-text"
                    placeholder="e.g. 12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Description / Notes</label>
                  <textarea 
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg focus:outline-none focus:border-primary text-sm bg-white text-dark-text"
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

      {/* --- MODAL: TAMBAH NODE / TIANG / ODP BARU --- */}
      {newNodeModal && (
        <div className="fixed inset-0 bg-dark-text/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-base font-bold text-dark-text flex items-center gap-2">
                <MapPin className="text-emerald-500" size={18} />
                Pasang {newNodeForm.device_type} Baru
              </h3>
              <button onClick={() => setNewNodeModal(null)} className="text-dark-muted hover:text-danger transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewNode} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Nama Perangkat / Kode</label>
                <input
                  type="text"
                  required
                  value={newNodeForm.name}
                  onChange={(e) => setNewNodeForm({...newNodeForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  placeholder="Contoh: ODP-12/05, T-102"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Tipe Node</label>
                  <select
                    value={newNodeForm.device_type}
                    onChange={(e) => setNewNodeForm({...newNodeForm, device_type: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  >
                    <option value="Tiang">📍 Tiang (Pole)</option>
                    <option value="ODP">🟩 ODP (Distribution)</option>
                    <option value="Closure">🔶 Closure</option>
                    <option value="Joint Closure">🟣 Joint Closure</option>
                    <option value="Joint Box">🔴 Joint Box</option>
                    <option value="POP">🏢 POP / OLT</option>
                    <option value="Slack">🟡 Slack Kabel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Kapasitas (Port/Tray)</label>
                  <input
                    type="number"
                    value={newNodeForm.capacity}
                    onChange={(e) => setNewNodeForm({...newNodeForm, capacity: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                    placeholder="8, 16, 24"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Project / Region</label>
                <select
                  value={newNodeForm.region}
                  onChange={(e) => setNewNodeForm({...newNodeForm, region: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                >
                  {uniqueRegions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Catatan / Deskripsi</label>
                <textarea
                  value={newNodeForm.description}
                  onChange={(e) => setNewNodeForm({...newNodeForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  rows={2}
                  placeholder="Catatan lapangan atau spesifikasi..."
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-[11px] text-gray-500 font-mono">
                Koordinat: {newNodeModal.lat.toFixed(6)}, {newNodeModal.lng.toFixed(6)}
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setNewNodeModal(null)}
                  className="px-4 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Simpan Node ke Peta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: SIMPAN JALUR KABEL YANG DITARIK --- */}
      {newCableModal && (
        <div className="fixed inset-0 bg-dark-text/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-base font-bold text-dark-text flex items-center gap-2">
                <RouteIcon className="text-amber-500" size={18} />
                Simpan Jalur Kabel Baru
              </h3>
              <button onClick={() => setNewCableModal(false)} className="text-dark-muted hover:text-danger transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDrawnCable} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Nama Jalur Kabel</label>
                <input
                  type="text"
                  required
                  value={newCableForm.name}
                  onChange={(e) => setNewCableForm({...newCableForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  placeholder="Contoh: Kabel Feeder OLT ke ODP-01"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Tipe Kabel</label>
                  <select
                    value={newCableForm.type}
                    onChange={(e) => setNewCableForm({...newCableForm, type: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  >
                    <option value="Distribution">🟦 Distribution</option>
                    <option value="Feeder">🟧 Feeder</option>
                    <option value="Backbone">🟥 Backbone</option>
                    <option value="Dropcore">🟩 Dropcore</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Kapasitas Core</label>
                  <select
                    value={newCableForm.capacity}
                    onChange={(e) => setNewCableForm({...newCableForm, capacity: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  >
                    <option value={12}>12 Core</option>
                    <option value={24}>24 Core</option>
                    <option value={48}>48 Core</option>
                    <option value={96}>96 Core</option>
                    <option value={144}>144 Core</option>
                    <option value={288}>288 Core</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Ketebalan Garis Kabel</label>
                  <select
                    value={newCableForm.line_width}
                    onChange={(e) => setNewCableForm({...newCableForm, line_width: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  >
                    <option value={2}>Tipis (2 px)</option>
                    <option value={3.5}>Standar (3.5 px)</option>
                    <option value={5}>Tebal (5 px)</option>
                    <option value={7}>Sangat Tebal (7 px)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Project / Region</label>
                  <select
                    value={newCableForm.region}
                    onChange={(e) => setNewCableForm({...newCableForm, region: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  >
                    {uniqueRegions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Catatan / Deskripsi</label>
                <textarea
                  value={newCableForm.description}
                  onChange={(e) => setNewCableForm({...newCableForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  rows={2}
                  placeholder="Keterangan rute atau kontraktor..."
                />
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-between">
                <span>📍 Total Titik: <strong>{cablePoints.length} Titik</strong></span>
                <span>📏 Panjang: <strong className="font-mono text-sm">{formatLength(currentDrawnLength)}</strong></span>
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setNewCableModal(false)}
                  className="px-4 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Simpan Jalur Kabel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: SAMBUNG PELEBARAN KABEL (BATCH SPLICING) --- */}
      {batchSpliceModal && (
        <div className="fixed inset-0 bg-dark-text/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-base font-bold text-dark-text flex items-center gap-2">
                <GitMerge className="text-purple-600" size={18} />
                Sambung Pelebaran Kabel (Auto-Splice)
              </h3>
              <button onClick={() => setBatchSpliceModal(false)} className="text-dark-muted hover:text-danger transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBatchSplice} className="p-4 space-y-3.5">
              <p className="text-xs text-dark-muted leading-relaxed">
                Sambungkan kabel proyek lama dengan kabel proyek baru / pelebaran secara otomatis. Sistem akan mengalokasikan core dan otomatis memperbarui deskripsi kabel.
              </p>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Kabel Asal (Proyek Lama)</label>
                <select
                  required
                  value={batchSpliceForm.cable_a_id}
                  onChange={(e) => setBatchSpliceForm({...batchSpliceForm, cable_a_id: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                >
                  <option value="">-- Pilih Kabel Asal --</option>
                  {availableCables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.capacity} Core) - [{c.region || 'No Region'}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Kabel Tujuan (Pelebaran / Proyek Baru)</label>
                <select
                  required
                  value={batchSpliceForm.cable_b_id}
                  onChange={(e) => setBatchSpliceForm({...batchSpliceForm, cable_b_id: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                >
                  <option value="">-- Pilih Kabel Pelebaran / Tujuan --</option>
                  {availableCables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.capacity} Core) - [{c.region || 'No Region'}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Start Core A</label>
                  <input
                    type="number"
                    min={1}
                    value={batchSpliceForm.start_core_a}
                    onChange={(e) => setBatchSpliceForm({...batchSpliceForm, start_core_a: Math.max(1, Number(e.target.value))})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Start Core B</label>
                  <input
                    type="number"
                    min={1}
                    value={batchSpliceForm.start_core_b}
                    onChange={(e) => setBatchSpliceForm({...batchSpliceForm, start_core_b: Math.max(1, Number(e.target.value))})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Jumlah Core</label>
                  <input
                    type="number"
                    min={1}
                    value={batchSpliceForm.count}
                    onChange={(e) => setBatchSpliceForm({...batchSpliceForm, count: Math.max(1, Number(e.target.value))})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Perangkat Sambung (Closure / ODP)</label>
                <select
                  value={batchSpliceForm.closure_id}
                  onChange={(e) => setBatchSpliceForm({...batchSpliceForm, closure_id: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                >
                  <option value="">Auto-Detect / Joint Baru</option>
                  {availableClosures.map(cl => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} ({cl.device_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auto_desc_checkbox"
                  checked={batchSpliceForm.auto_update_description}
                  onChange={(e) => setBatchSpliceForm({...batchSpliceForm, auto_update_description: e.target.checked})}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="auto_desc_checkbox" className="text-xs font-medium text-dark-text cursor-pointer">
                  Otomatis update deskripsi kabel dengan catatan sambungan
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={batchSpliceForm.custom_note}
                  onChange={(e) => setBatchSpliceForm({...batchSpliceForm, custom_note: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  placeholder="Contoh: Pelebaran Tahap 2 Cluster Barat"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setBatchSpliceModal(false)}
                  className="px-4 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isBatchSplicing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isBatchSplicing ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                  Sambungkan Core & Update Deskripsi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: BUAT PROJECT / REGION BARU --- */}
      {newProjectModal && (
        <div className="fixed inset-0 bg-dark-text/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-sm rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-base font-bold text-dark-text flex items-center gap-2">
                <FolderPlus className="text-blue-500" size={18} />
                Buat Project / Region Baru
              </h3>
              <button onClick={() => setNewProjectModal(false)} className="text-dark-muted hover:text-danger transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Nama Project / Region</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  placeholder="Contoh: Cluster_Banyuwangi, Area_A"
                  autoFocus
                />
                <p className="text-[11px] text-dark-muted mt-1">
                  Nama project akan digunakan sebagai pengelompokan data dan penamaan file KMZ.
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setNewProjectModal(false)}
                  className="px-4 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={14} /> Mulai Project Ini
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
