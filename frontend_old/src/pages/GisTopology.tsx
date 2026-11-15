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
  Route, Database, ChevronDown, ChevronUp, Map as MapIcon, RotateCw, RotateCcw,
  Plus, Download, Trash2, MousePointer, FolderPlus, Route as RouteIcon, 
  Check, Undo2, Compass, AlertCircle, Maximize2, Minimize2, FileText
} from 'lucide-react';

const FIBER_COLOR_CLASSES: Record<string, string> = {
  Biru: 'bg-blue-600 text-white',
  Oren: 'bg-orange-500 text-white',
  Hijau: 'bg-green-600 text-white',
  Cokelat: 'bg-amber-800 text-white',
  Abu: 'bg-slate-400 text-white',
  Putih: 'bg-white text-gray-900 border border-gray-300',
  Merah: 'bg-red-600 text-white',
  Hitam: 'bg-gray-900 text-white',
  Kuning: 'bg-yellow-400 text-gray-900',
  Ungu: 'bg-purple-600 text-white',
  Pink: 'bg-pink-400 text-white',
  Toska: 'bg-teal-400 text-gray-900',
  // Alias & kompatibilitas:
  Blue: 'bg-blue-600 text-white',
  Orange: 'bg-orange-500 text-white',
  Oranye: 'bg-orange-500 text-white',
  Green: 'bg-green-600 text-white',
  Brown: 'bg-amber-800 text-white',
  Coklat: 'bg-amber-800 text-white',
  Slate: 'bg-slate-400 text-white',
  'Abu-abu': 'bg-slate-400 text-white',
  White: 'bg-white text-gray-900 border border-gray-300',
  Red: 'bg-red-600 text-white',
  Black: 'bg-gray-900 text-white',
  Yellow: 'bg-yellow-400 text-gray-900',
  Violet: 'bg-purple-600 text-white',
  Rose: 'bg-pink-400 text-white',
  Aqua: 'bg-teal-400 text-gray-900',
  Tosca: 'bg-teal-400 text-gray-900'
};

const getFiberBadge = (color: string) => FIBER_COLOR_CLASSES[color] || 'bg-gray-500 text-white';

const STANDARD_TUBES = [
  { num: 1, name: 'Tube 1 (Biru)', color: 'Biru' },
  { num: 2, name: 'Tube 2 (Oren)', color: 'Oren' },
  { num: 3, name: 'Tube 3 (Hijau)', color: 'Hijau' },
  { num: 4, name: 'Tube 4 (Cokelat)', color: 'Cokelat' },
  { num: 5, name: 'Tube 5 (Abu)', color: 'Abu' },
  { num: 6, name: 'Tube 6 (Putih)', color: 'Putih' },
  { num: 7, name: 'Tube 7 (Merah)', color: 'Merah' },
  { num: 8, name: 'Tube 8 (Hitam)', color: 'Hitam' },
  { num: 9, name: 'Tube 9 (Kuning)', color: 'Kuning' },
  { num: 10, name: 'Tube 10 (Ungu)', color: 'Ungu' },
  { num: 11, name: 'Tube 11 (Pink)', color: 'Pink' },
  { num: 12, name: 'Tube 12 (Toska)', color: 'Toska' },
];

const STANDARD_CORE_NAMES = [
  'Biru', 'Oren', 'Hijau', 'Cokelat', 'Abu', 'Putih',
  'Merah', 'Hitam', 'Kuning', 'Ungu', 'Pink', 'Toska'
];

const getTubeCount = (capacity?: number) => {
  if (!capacity || capacity <= 0) return 1;
  return Math.max(1, Math.ceil(capacity / 12));
};

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

  // Batch Splice (Pelebaran & Petik) Modal State
  const [batchSpliceModal, setBatchSpliceModal] = useState<boolean>(false);
  const [batchSpliceForm, setBatchSpliceForm] = useState({
    cable_a_id: '',
    cable_b_id: '',
    closure_id: '',
    count: 12,
    start_core_a: 1,
    start_core_b: 1,
    auto_update_description: true,
    custom_note: '',
    splice_type: 'straight', // 'straight' | 'petik'
    petik_tube: 'Tube 1 (Biru)',
    petik_core: 'Core 1 (Biru)',
    petik_target: '',
    skip_spliced: true, // Default true: otomatis lewati core yang sudah dipetik/tersambung
    selection_mode: 'tube', // 'tube' | 'range' | 'custom'
    selected_tube_a: 1,
    selected_tube_b: 1,
    selected_cores_a: [] as number[],
  });
  const [isBatchSplicing, setIsBatchSplicing] = useState<boolean>(false);

  // Modals for Adding New Node & Cable
  const [newNodeModal, setNewNodeModal] = useState<{ lng: number; lat: number } | null>(null);
  const [newNodeForm, setNewNodeForm] = useState({
    name: '',
    device_type: 'Tiang',
    capacity: '8',
    region: '',
    description: '',
    // Smart FTTH parameters:
    has_slack: false,
    slack_meters: '15',
    pole_spec: 'Tiang Besi 7m',
    odp_source_cable: '',
    odp_tube: 'Tube 1 (Biru)',
    odp_core: 'Core 1 (Biru)',
    odp_splitter: '1:8 PLC',
    closure_joint_type: 'Percabangan Feeder ke Distribusi'
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
  const [editFormData, setEditFormData] = useState({
    name: '',
    device_type: '',
    capacity: '',
    used_capacity: '',
    description: '',
    icon_url: '',
    slack_meters: '',
    odp_source: ''
  });

  const [editingCable, setEditingCable] = useState<any | null>(null);
  const [isLegendExpanded, setIsLegendExpanded] = useState<boolean>(true);
  const [editCableFormData, setEditCableFormData] = useState({
    name: '',
    type: 'Distribution',
    capacity: '12',
    region: '',
    description: ''
  });
  
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

  const editCableMutation = useMutation({
    mutationFn: async (data: { id: string, payload: any }) => {
      const response = await axios.put(`/api/v1/cables/${data.id}`, data.payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-topology'] });
      setEditingCable(null);
      setPopupInfo(null);
    }
  });

  const handleEditCableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCable) return;
    editCableMutation.mutate({
      id: editingCable.id,
      payload: {
        name: editCableFormData.name,
        type: editCableFormData.type,
        capacity: editCableFormData.capacity ? parseInt(editCableFormData.capacity) : 12,
        region: editCableFormData.region,
        description: editCableFormData.description
      }
    });
  };

  const getDistanceMeters = (coord1?: [number, number], coord2?: [number, number]) => {
    if (!coord1 || !coord2) return 999999999;
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLam = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

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
        region: f.properties.region,
        coordinates: f.geometry?.coordinates as [number, number] | undefined
      }));
  }, [allGeoData]);

  const selectedCableA = useMemo(() => {
    if (!allGeoData?.features || !batchSpliceForm.cable_a_id) return null;
    return allGeoData.features.find((f: any) => f.properties?.id === batchSpliceForm.cable_a_id);
  }, [allGeoData, batchSpliceForm.cable_a_id]);

  // Query status core kabel A untuk modal sambungan
  const { data: batchCoresA } = useQuery<any[]>({
    queryKey: ['cable-cores', batchSpliceForm.cable_a_id],
    queryFn: async () => {
      if (!batchSpliceForm.cable_a_id) return [];
      const res = await axios.get(`/api/v1/cables/${batchSpliceForm.cable_a_id}/cores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    enabled: !!batchSpliceForm.cable_a_id && batchSpliceModal
  });

  const selectedCableB = useMemo(() => {
    if (!allGeoData?.features || !batchSpliceForm.cable_b_id) return null;
    return allGeoData.features.find((f: any) => f.properties?.id === batchSpliceForm.cable_b_id);
  }, [allGeoData, batchSpliceForm.cable_b_id]);

  const { data: batchCoresB } = useQuery<any[]>({
    queryKey: ['cable-cores', batchSpliceForm.cable_b_id],
    queryFn: async () => {
      if (!batchSpliceForm.cable_b_id) return [];
      const res = await axios.get(`/api/v1/cables/${batchSpliceForm.cable_b_id}/cores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    enabled: !!batchSpliceForm.cable_b_id && batchSpliceModal
  });

  const sortedClosures = useMemo(() => {
    if (!availableClosures.length) return [];
    
    let refCoord: [number, number] | null = popupInfo?.lngLat || null;
    if (!refCoord && selectedCableA?.geometry?.coordinates) {
      const coords = selectedCableA.geometry.coordinates;
      refCoord = Array.isArray(coords[0]) ? coords[0] : coords;
    }
    
    const cableRegion = selectedCableA?.properties?.region;

    return [...availableClosures].map(cl => {
      let dist = Infinity;
      if (refCoord && cl.coordinates) {
        dist = getDistanceMeters(refCoord, cl.coordinates);
      }
      const isSameRegion = !cableRegion || !cl.region || cl.region === cableRegion;
      return {
        ...cl,
        dist,
        isSameRegion,
        sortScore: (isSameRegion ? 0 : 50000) + dist
      };
    }).sort((a, b) => a.sortScore - b.sortScore);
  }, [availableClosures, popupInfo, selectedCableA]);

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
    
    let desc = editFormData.description.trim();
    if (editFormData.slack_meters && !desc.toLowerCase().includes('slack')) {
      desc = desc ? `${desc} | Slack: ${editFormData.slack_meters}m` : `Slack: ${editFormData.slack_meters}m`;
    }
    
    editDeviceMutation.mutate({
      id: editingDevice.id,
      payload: {
        name: editFormData.name || editingDevice.name,
        device_type: editFormData.device_type || editingDevice.device_type,
        capacity: editFormData.capacity ? parseInt(editFormData.capacity) : null,
        used_capacity: editFormData.used_capacity ? parseInt(editFormData.used_capacity) : 0,
        description: desc,
        icon_url: editFormData.icon_url || null
      }
    });
  };

  // --- Handlers for Web Editing ---
  const onMapClick = (event: any) => {
    const { features, lngLat } = event;
    
    if (editorMode === 'add-node') {
      const reg = mapRegionFilter !== 'All' ? mapRegionFilter : (uniqueRegions[0] || 'Default_Project');
      const prefix = selectedNodeType === 'Tiang' ? 'T-' : selectedNodeType === 'ODP' ? 'ODP-' : selectedNodeType === 'Closure' ? 'CLS-' : selectedNodeType === 'Joint Closure' ? 'JC-' : selectedNodeType === 'Slack' ? 'SLK-' : 'NODE-';
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setNewNodeForm({
        name: `${prefix}${randomSuffix}`,
        device_type: selectedNodeType,
        capacity: selectedNodeType === 'ODP' ? '8' : selectedNodeType === 'POP' ? '16' : selectedNodeType.includes('Closure') ? '24' : '0',
        region: reg,
        description: '',
        has_slack: selectedNodeType === 'Slack',
        slack_meters: '15',
        pole_spec: 'Tiang Besi 7m',
        odp_source_cable: availableCables[0]?.name || '',
        odp_tube: 'Tube 1 (Biru)',
        odp_core: 'Core 1 (Biru)',
        odp_splitter: '1:8 PLC',
        closure_joint_type: 'Percabangan Feeder ke Distribusi'
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

    let finalDesc = newNodeForm.description.trim();
    const parts = [];

    if (newNodeForm.device_type === 'Tiang') {
      if (newNodeForm.pole_spec) parts.push(`[${newNodeForm.pole_spec}]`);
      if (newNodeForm.has_slack && newNodeForm.slack_meters) {
        parts.push(`[Slack: ${newNodeForm.slack_meters}m${newNodeForm.odp_source_cable ? ' ' + newNodeForm.odp_source_cable : ''}]`);
      }
    } else if (newNodeForm.device_type === 'ODP') {
      if (newNodeForm.odp_splitter) parts.push(`[ODP ${newNodeForm.odp_splitter}]`);
      if (newNodeForm.odp_source_cable) {
        parts.push(`Sumber: ${newNodeForm.odp_source_cable} (${newNodeForm.odp_tube}, ${newNodeForm.odp_core})`);
      }
      if (newNodeForm.has_slack && newNodeForm.slack_meters) {
        parts.push(`[Slack: ${newNodeForm.slack_meters}m]`);
      }
    } else if (newNodeForm.device_type === 'Slack') {
      parts.push(`[Slack: ${newNodeForm.slack_meters || '20'}m]`);
      if (newNodeForm.odp_source_cable) {
        parts.push(`Kabel: ${newNodeForm.odp_source_cable}`);
      }
    } else if (newNodeForm.device_type === 'Closure' || newNodeForm.device_type === 'Joint Closure') {
      if (newNodeForm.closure_joint_type) parts.push(`[${newNodeForm.closure_joint_type}]`);
      if (newNodeForm.has_slack && newNodeForm.slack_meters) parts.push(`[Slack: ${newNodeForm.slack_meters}m]`);
    }

    if (parts.length > 0) {
      const autoText = parts.join(' | ');
      finalDesc = finalDesc ? `${autoText} | Catatan: ${finalDesc}` : autoText;
    }

    try {
      await axios.post('/api/v1/devices/', {
        name: newNodeForm.name,
        device_type: newNodeForm.device_type,
        capacity: newNodeForm.capacity ? parseInt(newNodeForm.capacity) : null,
        used_capacity: 0,
        region: newNodeForm.region || (mapRegionFilter !== 'All' ? mapRegionFilter : 'Default_Project'),
        description: finalDesc,
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

    const isCustom = batchSpliceForm.splice_type === 'straight' && batchSpliceForm.selection_mode === 'custom';
    const isTube = batchSpliceForm.splice_type === 'straight' && batchSpliceForm.selection_mode === 'tube';
    if (isCustom && (!batchSpliceForm.selected_cores_a || batchSpliceForm.selected_cores_a.length === 0)) {
      alert("Harap centang minimal 1 core untuk disambung!");
      return;
    }

    setIsBatchSplicing(true);

    let startA = Number(batchSpliceForm.start_core_a) || 1;
    let startB = Number(batchSpliceForm.start_core_b) || 1;
    let count = Number(batchSpliceForm.count) || 12;

    if (isTube) {
      startA = (Number(batchSpliceForm.selected_tube_a) - 1) * 12 + 1;
      startB = (Number(batchSpliceForm.selected_tube_b) - 1) * 12 + 1;
      count = 12;
    }

    let note = batchSpliceForm.custom_note.trim();
    if (batchSpliceForm.splice_type === 'petik') {
      const petikDesc = `${batchSpliceForm.petik_tube} / ${batchSpliceForm.petik_core}${batchSpliceForm.petik_target ? ' - ' + batchSpliceForm.petik_target : ''}`;
      note = note ? `${petikDesc} | ${note}` : petikDesc;
    } else if (isTube) {
      const tubeAName = STANDARD_TUBES.find(t => t.num === Number(batchSpliceForm.selected_tube_a))?.name || `Tube ${batchSpliceForm.selected_tube_a}`;
      const tubeBName = STANDARD_TUBES.find(t => t.num === Number(batchSpliceForm.selected_tube_b))?.name || `Tube ${batchSpliceForm.selected_tube_b}`;
      const tubeNote = `Sambung ${tubeAName} ➔ ${tubeBName}`;
      note = note ? `${tubeNote} (${note})` : tubeNote;
    }

    try {
      const payload: any = {
        cable_a_id: batchSpliceForm.cable_a_id,
        cable_b_id: batchSpliceForm.cable_b_id,
        closure_id: batchSpliceForm.closure_id || null,
        count: batchSpliceForm.splice_type === 'petik' ? 1 : count,
        start_core_a: startA,
        start_core_b: startB,
        auto_update_description: batchSpliceForm.auto_update_description,
        custom_note: note,
        splice_type: batchSpliceForm.splice_type,
        petik_tube: batchSpliceForm.petik_tube,
        petik_core: batchSpliceForm.petik_core,
        petik_target: batchSpliceForm.petik_target,
        skip_spliced: batchSpliceForm.splice_type === 'petik' ? false : batchSpliceForm.skip_spliced
      };

      if (isCustom) {
        payload.selected_cores_a = batchSpliceForm.selected_cores_a;
        // Mapping ke nomor core kabel B dengan offset start_core_b
        const offset = (Number(batchSpliceForm.start_core_b) || 1) - (Number(batchSpliceForm.start_core_a) || 1);
        payload.selected_cores_b = batchSpliceForm.selected_cores_a.map(num => Math.max(1, num + offset));
      }

      const res = await axios.post('/api/v1/splices/batch-connect', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['map-topology'] });
      queryClient.invalidateQueries({ queryKey: ['cable-cores'] });
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
    'custom-icon-joint_box': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#db2777" stroke="#ffffff" stroke-width="2.5"/><rect x="10" y="10" width="16" height="16" rx="2" fill="#ffffff"/><path d="M14 14l8 8m0-8l-8 8" stroke="#db2777" stroke-width="2" stroke-linecap="round"/></svg>',

    // Builtin KMZ Google Earth Pushpins (Resolusi Tajam & Bebas CORS)
    'icon-pin-red': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="M18 2C12.5 2 8 6.5 8 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.5-4.5-10-10-10z" fill="#dc2626" stroke="#ffffff" stroke-width="2"/><circle cx="18" cy="12" r="4.5" fill="#ffffff"/><circle cx="18" cy="12" r="2.2" fill="#dc2626"/></svg>',
    'icon-pin-blue': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="M18 2C12.5 2 8 6.5 8 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.5-4.5-10-10-10z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/><circle cx="18" cy="12" r="4.5" fill="#ffffff"/><circle cx="18" cy="12" r="2.2" fill="#2563eb"/></svg>',
    'icon-pin-green': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="M18 2C12.5 2 8 6.5 8 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.5-4.5-10-10-10z" fill="#16a34a" stroke="#ffffff" stroke-width="2"/><circle cx="18" cy="12" r="4.5" fill="#ffffff"/><circle cx="18" cy="12" r="2.2" fill="#16a34a"/></svg>',
    'icon-pin-yellow': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="M18 2C12.5 2 8 6.5 8 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.5-4.5-10-10-10z" fill="#eab308" stroke="#ffffff" stroke-width="2"/><circle cx="18" cy="12" r="4.5" fill="#ffffff"/><circle cx="18" cy="12" r="2.2" fill="#eab308"/></svg>',
    'icon-pin-purple': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="M18 2C12.5 2 8 6.5 8 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.5-4.5-10-10-10z" fill="#9333ea" stroke="#ffffff" stroke-width="2"/><circle cx="18" cy="12" r="4.5" fill="#ffffff"/><circle cx="18" cy="12" r="2.2" fill="#9333ea"/></svg>',

    // Builtin KMZ Google Earth Geometric Shapes
    'icon-shape-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="#ef4444" stroke="#ffffff" stroke-width="3"/><circle cx="18" cy="18" r="5" fill="#ffffff"/></svg>',
    'icon-shape-square': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect x="5" y="5" width="26" height="26" rx="4" fill="#16a34a" stroke="#ffffff" stroke-width="3"/><rect x="11" y="11" width="14" height="14" rx="2" fill="#ffffff"/><circle cx="18" cy="18" r="3" fill="#16a34a"/></svg>',
    'icon-shape-triangle': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><polygon points="18,4 33,31 3,31" fill="#a855f7" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><circle cx="18" cy="22" r="3.5" fill="#ffffff"/></svg>',
    'icon-shape-donut': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="#ec4899" stroke="#ffffff" stroke-width="3"/><circle cx="18" cy="18" r="6" fill="#ffffff"/></svg>',
    'icon-shape-caution': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><polygon points="18,4 34,31 2,31" fill="#eab308" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><rect x="16.5" y="13" width="3" height="8" rx="1.5" fill="#000000"/><circle cx="18" cy="25" r="1.8" fill="#000000"/></svg>',
    'icon-shape-target': '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/><circle cx="18" cy="18" r="10" fill="#ffffff"/><circle cx="18" cy="18" r="5" fill="#2563eb"/></svg>'
  };

  const getSvgIconIdFromUrl = (url?: string): string | null => {
    if (!url) return null;
    const u = url.toLowerCase();
    if (u.includes('blue-pushpin')) return 'icon-pin-blue';
    if (u.includes('red-pushpin')) return 'icon-pin-red';
    if (u.includes('grn-pushpin') || u.includes('green-pushpin')) return 'icon-pin-green';
    if (u.includes('ylw-pushpin') || u.includes('yellow-pushpin')) return 'icon-pin-yellow';
    if (u.includes('purple-pushpin')) return 'icon-pin-purple';
    if (u.includes('placemark_circle') || (u.includes('circle') && !u.includes('square'))) return 'icon-shape-circle';
    if (u.includes('square')) return 'icon-shape-square';
    if (u.includes('triangle')) return 'icon-shape-triangle';
    if (u.includes('donut')) return 'icon-shape-donut';
    if (u.includes('caution')) return 'icon-shape-caution';
    if (u.includes('target')) return 'icon-shape-target';
    return null;
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
        const builtinSvgId = getSvgIconIdFromUrl(url);
        if (builtinSvgId) {
          iconId = builtinSvgId;
        } else if (!iconMapping.current[url]) {
          iconMapping.current[url] = `kmz-icon-${iconCounter.current++}`;
          iconId = iconMapping.current[url];
        } else {
          iconId = iconMapping.current[url];
        }
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
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200'
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
            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Sambungkan kabel proyek lama dengan kabel pelebaran baru secara otomatis"
          >
            <GitMerge size={13} /> + Sambung Pelebaran
          </button>

          <button
            onClick={() => setNewProjectModal(true)}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <FolderPlus size={13} /> + Project Baru
          </button>

          <button
            onClick={handleExportKml}
            className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
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

          {/* Map Style Toggle - Tepat di bawah zoom controls di pojok kanan atas secara vertikal rapi */}
          <div className="absolute top-[105px] right-[10px] z-10 bg-white rounded-md shadow-md border border-gray-200 overflow-hidden flex flex-col">
            <button 
              type="button"
              onClick={() => setMapType('streets')}
              className={`p-2 transition-colors cursor-pointer ${mapType === 'streets' ? 'bg-blue-100 text-blue-600' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
              title="Tampilan Peta Jalan (Streets)"
            >
              <MapPin size={16} />
            </button>
            <button 
              type="button"
              onClick={() => setMapType('satellite')}
              className={`p-2 transition-colors border-t border-gray-200 cursor-pointer ${mapType === 'satellite' ? 'bg-blue-100 text-blue-600' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
              title="Tampilan Peta Satelit (Satellite)"
            >
              <MapIcon size={16} />
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
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 mt-2 mb-2 max-h-[160px] overflow-y-auto">
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Keterangan Sambungan:</p>
                        <div className="space-y-1">
                          {popupInfo.feature.properties.description.split(' | ').map((part: string, idx: number) => (
                            <div key={idx} className="text-xs text-gray-800 font-mono bg-white p-1.5 rounded border border-gray-200 flex items-start gap-1.5 leading-relaxed">
                              <span className="text-purple-600 font-bold shrink-0">⚡</span>
                              <span>{part.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          const cableId = popupInfo.feature.properties.id;
                          const cableRegion = popupInfo.feature.properties.region;
                          const clickCoords: [number, number] = popupInfo.lngLat;
                          
                          let bestClosureId = '';
                          let bestDist = Infinity;
                          availableClosures.forEach(cl => {
                            const isSame = !cableRegion || !cl.region || cl.region === cableRegion;
                            if (cl.coordinates) {
                              const d = getDistanceMeters(clickCoords, cl.coordinates);
                              const score = (isSame ? 0 : 50000) + d;
                              if (score < bestDist) {
                                bestDist = score;
                                bestClosureId = cl.id;
                              }
                            }
                          });

                          setBatchSpliceForm(prev => ({ 
                            ...prev, 
                            cable_a_id: cableId,
                            closure_id: bestClosureId || prev.closure_id
                          }));
                          setBatchSpliceModal(true);
                        }}
                        className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Sambungkan kabel ini dengan kabel pelebaran atau petik ke ODP"
                      >
                        <GitMerge size={13} /> Sambung Pelebaran / Petik Kabel Ini
                      </button>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingCable(popupInfo.feature.properties);
                            setEditCableFormData({
                              name: popupInfo.feature.properties.name || '',
                              type: popupInfo.feature.properties.cable_type || 'Distribution',
                              capacity: popupInfo.feature.properties.capacity?.toString() || '12',
                              region: popupInfo.feature.properties.region || '',
                              description: popupInfo.feature.properties.description || ''
                            });
                          }}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit size={13} /> Edit Kabel
                        </button>
                        <button 
                          onClick={async () => {
                            const cableId = popupInfo.feature.properties.id;
                            const cableName = popupInfo.feature.properties.name;
                            if (!confirm(`Reset semua splice & deskripsi kabel "${cableName}"?\n\nSemua sambungan splice akan dihapus dan core dibebaskan. Lakukan ini hanya jika input sebelumnya salah.`)) return;
                            try {
                              await axios.post(`/api/v1/cables/${cableId}/unsplice-all`, {}, { headers: { Authorization: `Bearer ${token}` } });
                              queryClient.invalidateQueries({ queryKey: ['map-topology'] });
                              setPopupInfo(null);
                              alert(`✅ Splice kabel "${cableName}" berhasil direset. Silakan input ulang.`);
                            } catch (err: any) {
                              alert('Gagal reset: ' + (err.response?.data?.detail || err.message));
                            }
                          }}
                          className="bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Reset semua splice & deskripsi kabel ini (untuk koreksi input yang salah)"
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteFeature(popupInfo.feature.properties.id, 'cable', popupInfo.feature.properties.name)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Hapus Jalur Kabel"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <p className="text-sm text-gray-700 flex items-center gap-1.5 font-bold">
                        {popupInfo.feature.properties.type === 'device' ? <Server size={14} className="text-primary" /> : <MapPin size={14} />} 
                        {popupInfo.feature.properties.type === 'device' ? popupInfo.feature.properties.device_type : 'PoP Site'}
                      </p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                        {popupInfo.feature.properties.region || 'No Region'}
                      </span>
                    </div>
                    
                    {/* Capacity for ODP / OLT / POP */}
                    {['ODP', 'OLT', 'POP'].includes(popupInfo.feature.properties.device_type) && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mb-2 text-xs text-emerald-800 flex items-center justify-between">
                        <span className="font-medium">Port Terpakai:</span>
                        <span className="font-bold font-mono">
                          {popupInfo.feature.properties.used_capacity || 0} / {popupInfo.feature.properties.capacity || 8} Port
                        </span>
                      </div>
                    )}

                    {/* Slack Badge if present */}
                    {popupInfo.feature.properties.description && (popupInfo.feature.properties.description.toLowerCase().includes('slack') || popupInfo.feature.properties.device_type === 'Slack') && (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-1.5 px-2 mb-2 text-xs text-amber-900 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>🟡 Ada Gulungan Slack Kabel</span>
                      </div>
                    )}
                    
                    {/* Detailed Specifications / Description */}
                    {popupInfo.feature.properties.description && popupInfo.feature.properties.description.trim() !== '' && (
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 mt-2 mb-3">
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Spesifikasi &amp; Detail Teknis:</p>
                        <div className="space-y-1.5">
                          {popupInfo.feature.properties.description.split(' | ').map((part: string, idx: number) => {
                            const trimmed = part.trim();
                            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                              return (
                                <span key={idx} className="inline-block bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded border border-blue-200 mr-1.5 mb-1">
                                  {trimmed.slice(1, -1)}
                                </span>
                              );
                            }
                            if (trimmed.startsWith('Sumber:')) {
                              return (
                                <div key={idx} className="text-xs text-emerald-900 bg-emerald-50 p-1.5 rounded border border-emerald-200 font-mono font-medium flex items-center gap-1.5">
                                  <span>⚡</span>
                                  <span>{trimmed}</span>
                                </div>
                              );
                            }
                            if (trimmed.startsWith('Catatan:')) {
                              return (
                                <div key={idx} className="text-xs text-gray-700 bg-white p-1.5 rounded border border-gray-200 italic">
                                  📝 {trimmed}
                                </div>
                              );
                            }
                            return (
                              <div key={idx} className="text-xs text-gray-800 font-mono leading-relaxed bg-white p-1.5 rounded border border-gray-100">
                                {trimmed}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {popupInfo.feature.properties.type === 'device' && (
                      <div className="mt-3 flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingDevice(popupInfo.feature.properties);
                            setEditFormData({
                              name: popupInfo.feature.properties.name || '',
                              device_type: popupInfo.feature.properties.device_type || 'Tiang',
                              capacity: popupInfo.feature.properties.capacity?.toString() || '',
                              used_capacity: popupInfo.feature.properties.used_capacity?.toString() || '0',
                              description: popupInfo.feature.properties.description || '',
                              icon_url: popupInfo.feature.properties.icon_url || '',
                              slack_meters: '',
                              odp_source: ''
                            });
                          }}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-1.5 px-2 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors font-medium"
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

        {/* Legend Box - Pojok Kiri Atas (Terpisah Jauh dari Kontrol Zoom di Kanan Atas) */}
        <div className="absolute top-3 left-3 z-[400]">
          {!isLegendExpanded ? (
            <button 
              type="button"
              onClick={() => setIsLegendExpanded(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-dark-surface/95 backdrop-blur-md border border-dark-border rounded-xl shadow-md text-xs font-bold text-dark-text hover:bg-gray-50 dark:hover:bg-dark-card transition-all cursor-pointer pointer-events-auto"
              title="Buka Legenda Simbol Peta"
            >
              <Layers size={14} className="text-primary" />
              <span>Legenda Peta</span>
              <ChevronDown size={14} className="text-dark-muted" />
            </button>
          ) : (
            <div className="bg-white/95 dark:bg-dark-surface/95 backdrop-blur-md border border-dark-border p-3.5 rounded-xl shadow-xl flex flex-col gap-2.5 max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-dark-border">
                <span className="text-xs font-bold text-dark-text flex items-center gap-1.5">
                  <Layers size={14} className="text-primary" /> Legenda Simbol Peta
                </span>
                <button 
                  type="button"
                  onClick={() => setIsLegendExpanded(false)}
                  className="text-dark-muted hover:text-dark-text p-0.5 rounded cursor-pointer"
                  title="Tutup Legenda"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-6">
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
                    <div className="flex items-center gap-2"><div className="w-5 border-b-2 border-dashed border-[#475569]"></div><span>Dist/Drop</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
        <div className="fixed inset-0 bg-dark-text/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-base font-bold text-dark-text flex items-center gap-2">
                <Edit className="text-primary" size={18} />
                Edit {editingDevice.name}
              </h3>
              <button onClick={() => setEditingDevice(null)} className="text-dark-muted hover:text-danger transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Nama Perangkat</label>
                  <input 
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Tipe Node</label>
                  <select
                    value={editFormData.device_type}
                    onChange={(e) => setEditFormData({...editFormData, device_type: e.target.value})}
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
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Kapasitas (Port)</label>
                  <input 
                    type="number"
                    value={editFormData.capacity}
                    onChange={(e) => setEditFormData({...editFormData, capacity: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                    placeholder="8, 16, 24"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Port Terpakai</label>
                  <input 
                    type="number"
                    value={editFormData.used_capacity}
                    onChange={(e) => setEditFormData({...editFormData, used_capacity: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Quick Helper for Slack & Source */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  ⚡ Helper Cepat Spesifikasi &amp; Slack
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">Tambah/Set Slack (m)</label>
                    <input 
                      type="number"
                      value={editFormData.slack_meters}
                      onChange={(e) => setEditFormData({...editFormData, slack_meters: e.target.value})}
                      className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs bg-white text-gray-800"
                      placeholder="e.g. 15"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">Sumber Kabel/Core</label>
                    <input 
                      type="text"
                      value={editFormData.odp_source}
                      onChange={(e) => setEditFormData({...editFormData, odp_source: e.target.value})}
                      className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs bg-white text-gray-800"
                      placeholder="e.g. Feeder-01 Tube 1 Core 2"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1 flex items-center justify-between">
                  <span>Ikon Node (Tampilan Peta &amp; Google Earth KMZ)</span>
                  {editFormData.icon_url && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Ikon Kustom Aktif
                    </span>
                  )}
                </label>
                <select
                  value={editFormData.icon_url}
                  onChange={(e) => setEditFormData({...editFormData, icon_url: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-primary"
                >
                  <option value="">⚙️ Default (Otomatis Sesuai Tipe Node)</option>
                  <option value="http://maps.google.com/mapfiles/kml/pushpin/blue-pushpin.png">📍 Jarum Biru (Blue Pushpin)</option>
                  <option value="http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png">📍 Jarum Merah (Red Pushpin)</option>
                  <option value="http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png">📍 Jarum Hijau (Green Pushpin)</option>
                  <option value="http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png">📍 Jarum Kuning (Yellow Pushpin)</option>
                  <option value="http://maps.google.com/mapfiles/kml/pushpin/purple-pushpin.png">📍 Jarum Ungu (Purple Pushpin)</option>
                  <option value="http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png">🔴 Bulat Merah (Placemark Circle)</option>
                  <option value="http://maps.google.com/mapfiles/kml/shapes/square.png">🟩 Kotak Hijau (Square - ODP)</option>
                  <option value="http://maps.google.com/mapfiles/kml/shapes/triangle.png">🔺 Segitiga Ungu (Triangle - Closure / JC)</option>
                  <option value="http://maps.google.com/mapfiles/kml/shapes/donut.png">🍩 Cincin Pink (Donut - Joint Box)</option>
                  <option value="http://maps.google.com/mapfiles/kml/shapes/caution.png">⚠️ Peringatan Kuning (Caution - Slack)</option>
                  <option value="http://maps.google.com/mapfiles/kml/shapes/target.png">🎯 Target Biru (POP / Sentral)</option>
                </select>
                <p className="text-[11px] text-dark-muted mt-1">
                  Ikon akan langsung tampil di Peta Web App dan otomatis tersimpan ke file KMZ / KML Google Earth.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Deskripsi Lengkap / Spesifikasi</label>
                <textarea 
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg focus:outline-none focus:border-primary text-xs bg-white text-dark-text font-mono"
                  placeholder="[Tiang Besi 7m] | [Slack: 15m] | Catatan..."
                  rows={3}
                />
              </div>
              
              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-dark-border">
                <button 
                  type="button" 
                  onClick={() => setEditingDevice(null)}
                  className="px-4 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={editDeviceMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editDeviceMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Simpan Perubahan
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
          <div className="bg-white border border-dark-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-base font-bold text-dark-text flex items-center gap-2">
                <MapPin className="text-emerald-500" size={18} />
                Pasang {newNodeForm.device_type} Baru
              </h3>
              <button onClick={() => setNewNodeModal(null)} className="text-dark-muted hover:text-danger transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewNode} className="p-4 space-y-3 overflow-y-auto">
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
                    onChange={(e) => {
                      const dt = e.target.value;
                      const prefix = dt === 'Tiang' ? 'T-' : dt === 'ODP' ? 'ODP-' : dt === 'Closure' ? 'CLS-' : dt === 'Joint Closure' ? 'JC-' : dt === 'Slack' ? 'SLK-' : 'NODE-';
                      const randomSuffix = Math.floor(100 + Math.random() * 900);
                      setNewNodeForm(prev => ({
                        ...prev,
                        device_type: dt,
                        name: `${prefix}${randomSuffix}`,
                        capacity: dt === 'ODP' ? '8' : dt === 'POP' ? '16' : dt.includes('Closure') ? '24' : '0',
                        has_slack: dt === 'Slack'
                      }));
                    }}
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

              {/* --- SMART FTTH DYNAMIC ASSISTANT --- */}
              {newNodeForm.device_type === 'Tiang' && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2.5">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    📍 Spesifikasi Tiang &amp; Slack
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-blue-900 mb-1">Jenis / Tinggi Tiang</label>
                      <select
                        value={newNodeForm.pole_spec}
                        onChange={(e) => setNewNodeForm({...newNodeForm, pole_spec: e.target.value})}
                        className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs bg-white text-gray-800"
                      >
                        <option value="Tiang Besi 7m">Tiang Besi 7m</option>
                        <option value="Tiang Besi 9m">Tiang Besi 9m</option>
                        <option value="Tiang Beton 9m">Tiang Beton 9m</option>
                        <option value="Tiang PLN">Tiang PLN (Numpang)</option>
                        <option value="Tiang Telkom">Tiang Telkom</option>
                        <option value="Tiang Khusus / Tower">Tiang Khusus / Tower</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-blue-900 mb-1">Ada Slack / Gulungan?</label>
                      <div className="flex items-center h-[34px]">
                        <label className="inline-flex items-center gap-2 text-xs text-blue-900 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newNodeForm.has_slack}
                            onChange={(e) => setNewNodeForm({...newNodeForm, has_slack: e.target.checked})}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Ada Slack Kabel</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {newNodeForm.has_slack && (
                    <div className="pt-2 border-t border-blue-200 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-blue-900 mb-1">Panjang Slack (Meter)</label>
                        <input
                          type="number"
                          value={newNodeForm.slack_meters}
                          onChange={(e) => setNewNodeForm({...newNodeForm, slack_meters: e.target.value})}
                          className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs bg-white text-gray-800"
                          placeholder="Contoh: 15"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-blue-900 mb-1">Kabel Slack</label>
                        <input
                          type="text"
                          value={newNodeForm.odp_source_cable}
                          onChange={(e) => setNewNodeForm({...newNodeForm, odp_source_cable: e.target.value})}
                          className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs bg-white text-gray-800"
                          placeholder="e.g. Feeder 24C"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {newNodeForm.device_type === 'ODP' && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-2.5">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    🟩 Konfigurasi ODP &amp; Core Feeder
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Splitter Ratio</label>
                      <select
                        value={newNodeForm.odp_splitter}
                        onChange={(e) => {
                          const ratio = e.target.value;
                          const cap = ratio.includes('1:16') ? '16' : ratio.includes('1:8') ? '8' : ratio.includes('1:4') ? '4' : '8';
                          setNewNodeForm({...newNodeForm, odp_splitter: ratio, capacity: cap});
                        }}
                        className="w-full px-2 py-1.5 border border-emerald-300 rounded text-xs bg-white text-gray-800"
                      >
                        <option value="1:8 PLC">1:8 PLC (8 Port)</option>
                        <option value="1:16 PLC">1:16 PLC (16 Port)</option>
                        <option value="1:4 PLC">1:4 PLC (4 Port)</option>
                        <option value="1:2 FBT">1:2 FBT (2 Port)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Kabel Sumber Feeder</label>
                      <input
                        type="text"
                        list="modal-cable-list"
                        value={newNodeForm.odp_source_cable}
                        onChange={(e) => setNewNodeForm({...newNodeForm, odp_source_cable: e.target.value})}
                        className="w-full px-2 py-1.5 border border-emerald-300 rounded text-xs bg-white text-gray-800"
                        placeholder="Pilih/ketik kabel..."
                      />
                      <datalist id="modal-cable-list">
                        {availableCables.map(c => (
                          <option key={c.id} value={c.name}>{c.name} ({c.cable_type || 'Kabel'}, {c.capacity || 12}C)</option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Warna Tube</label>
                      <select
                        value={newNodeForm.odp_tube}
                        onChange={(e) => setNewNodeForm({...newNodeForm, odp_tube: e.target.value})}
                        className="w-full px-2 py-1.5 border border-emerald-300 rounded text-xs bg-white text-gray-800"
                      >
                        <option value="Tube 1 (Biru)">Tube 1 (Biru)</option>
                        <option value="Tube 2 (Oren)">Tube 2 (Oren)</option>
                        <option value="Tube 3 (Hijau)">Tube 3 (Hijau)</option>
                        <option value="Tube 4 (Cokelat)">Tube 4 (Cokelat)</option>
                        <option value="Tube 5 (Abu)">Tube 5 (Abu)</option>
                        <option value="Tube 6 (Putih)">Tube 6 (Putih)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Warna Core</label>
                      <select
                        value={newNodeForm.odp_core}
                        onChange={(e) => setNewNodeForm({...newNodeForm, odp_core: e.target.value})}
                        className="w-full px-2 py-1.5 border border-emerald-300 rounded text-xs bg-white text-gray-800"
                      >
                        <option value="Core 1 (Biru)">Core 1 (Biru)</option>
                        <option value="Core 2 (Oren)">Core 2 (Oren)</option>
                        <option value="Core 3 (Hijau)">Core 3 (Hijau)</option>
                        <option value="Core 4 (Cokelat)">Core 4 (Cokelat)</option>
                        <option value="Core 5 (Abu)">Core 5 (Abu)</option>
                        <option value="Core 6 (Putih)">Core 6 (Putih)</option>
                        <option value="Core 7 (Merah)">Core 7 (Merah)</option>
                        <option value="Core 8 (Hitam)">Core 8 (Hitam)</option>
                        <option value="Core 9 (Kuning)">Core 9 (Kuning)</option>
                        <option value="Core 10 (Ungu)">Core 10 (Ungu)</option>
                        <option value="Core 11 (Pink)">Core 11 (Pink)</option>
                        <option value="Core 12 (Toska)">Core 12 (Toska)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
                    <label className="inline-flex items-center gap-2 text-xs text-emerald-900 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newNodeForm.has_slack}
                        onChange={(e) => setNewNodeForm({...newNodeForm, has_slack: e.target.checked})}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Ada Slack di ODP</span>
                    </label>
                    {newNodeForm.has_slack && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-emerald-900 font-medium">Panjang:</span>
                        <input
                          type="number"
                          value={newNodeForm.slack_meters}
                          onChange={(e) => setNewNodeForm({...newNodeForm, slack_meters: e.target.value})}
                          className="w-16 px-2 py-1 border border-emerald-300 rounded text-xs bg-white text-gray-800"
                          placeholder="10"
                        />
                        <span className="text-xs text-emerald-900">meter</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(newNodeForm.device_type === 'Closure' || newNodeForm.device_type === 'Joint Closure') && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2.5">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    🟣 Sambungan Closure / JC
                  </span>
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-900 mb-1">Fungsi / Tipe Sambungan</label>
                    <select
                      value={newNodeForm.closure_joint_type}
                      onChange={(e) => setNewNodeForm({...newNodeForm, closure_joint_type: e.target.value})}
                      className="w-full px-2 py-1.5 border border-purple-300 rounded text-xs bg-white text-gray-800"
                    >
                      <option value="Percabangan Feeder ke Distribusi">Percabangan Feeder ke Distribusi</option>
                      <option value="Sambungan Pelebaran Lurus (Straight Joint)">Sambungan Pelebaran Lurus (Straight Joint)</option>
                      <option value="Distribusi ke Cabang Drop">Distribusi ke Cabang Drop</option>
                      <option value="Splice Backbone / Main Trunk">Splice Backbone / Main Trunk</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-purple-200">
                    <label className="inline-flex items-center gap-2 text-xs text-purple-900 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newNodeForm.has_slack}
                        onChange={(e) => setNewNodeForm({...newNodeForm, has_slack: e.target.checked})}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Ada Slack / Gulungan Kabel</span>
                    </label>
                    {newNodeForm.has_slack && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-purple-900 font-medium">Panjang:</span>
                        <input
                          type="number"
                          value={newNodeForm.slack_meters}
                          onChange={(e) => setNewNodeForm({...newNodeForm, slack_meters: e.target.value})}
                          className="w-16 px-2 py-1 border border-purple-300 rounded text-xs bg-white text-gray-800"
                          placeholder="20"
                        />
                        <span className="text-xs text-purple-900">meter</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {newNodeForm.device_type === 'Slack' && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2.5">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    🟡 Titik Gulungan Slack Kabel
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">Panjang Slack (Meter)</label>
                      <input
                        type="number"
                        value={newNodeForm.slack_meters}
                        onChange={(e) => setNewNodeForm({...newNodeForm, slack_meters: e.target.value})}
                        className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs bg-white text-gray-800"
                        placeholder="Contoh: 20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">Kabel yang Di-slack</label>
                      <input
                        type="text"
                        list="modal-cable-list"
                        value={newNodeForm.odp_source_cable}
                        onChange={(e) => setNewNodeForm({...newNodeForm, odp_source_cable: e.target.value})}
                        className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs bg-white text-gray-800"
                        placeholder="Pilih/ketik kabel..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Project / Region */}
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
                <label className="block text-xs font-semibold text-dark-text mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  value={newNodeForm.description}
                  onChange={(e) => setNewNodeForm({...newNodeForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-primary"
                  rows={2}
                  placeholder="Catatan lapangan atau rute..."
                />
              </div>

              {/* Live Auto-Compiled Preview */}
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block mb-1">
                  ✨ Preview Deskripsi Otomatis (Masuk ke Peta &amp; Google Earth):
                </span>
                <div className="text-xs font-mono text-emerald-700 bg-white p-2 rounded border border-gray-100 break-words">
                  {(() => {
                    const parts = [];
                    if (newNodeForm.device_type === 'Tiang') {
                      if (newNodeForm.pole_spec) parts.push(`[${newNodeForm.pole_spec}]`);
                      if (newNodeForm.has_slack && newNodeForm.slack_meters) {
                        parts.push(`[Slack: ${newNodeForm.slack_meters}m${newNodeForm.odp_source_cable ? ' ' + newNodeForm.odp_source_cable : ''}]`);
                      }
                    } else if (newNodeForm.device_type === 'ODP') {
                      if (newNodeForm.odp_splitter) parts.push(`[ODP ${newNodeForm.odp_splitter}]`);
                      if (newNodeForm.odp_source_cable) {
                        parts.push(`Sumber: ${newNodeForm.odp_source_cable} (${newNodeForm.odp_tube}, ${newNodeForm.odp_core})`);
                      }
                      if (newNodeForm.has_slack && newNodeForm.slack_meters) {
                        parts.push(`[Slack: ${newNodeForm.slack_meters}m]`);
                      }
                    } else if (newNodeForm.device_type === 'Slack') {
                      parts.push(`[Slack: ${newNodeForm.slack_meters || '20'}m]`);
                      if (newNodeForm.odp_source_cable) parts.push(`Kabel: ${newNodeForm.odp_source_cable}`);
                    } else if (newNodeForm.device_type === 'Closure' || newNodeForm.device_type === 'Joint Closure') {
                      if (newNodeForm.closure_joint_type) parts.push(`[${newNodeForm.closure_joint_type}]`);
                      if (newNodeForm.has_slack && newNodeForm.slack_meters) parts.push(`[Slack: ${newNodeForm.slack_meters}m]`);
                    }
                    if (newNodeForm.description?.trim()) parts.push(`Catatan: ${newNodeForm.description.trim()}`);
                    return parts.length > 0 ? parts.join(' | ') : '(Belum ada konfigurasi khusus)';
                  })()}
                </div>
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
        <div className="fixed inset-0 bg-dark-text/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-3 sm:p-5">
          <div className="bg-white border border-dark-border w-full max-w-3xl lg:max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header Sticky */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-border bg-dark-surface shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
                  <GitMerge size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-dark-text">Sambung Pelebaran Kabel (Auto-Splice)</h3>
                  <p className="text-[11px] text-dark-muted">Sambungkan kabel antar-proyek dan perbarui acuan lapangan otomatis</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setBatchSpliceModal(false)} 
                className="text-dark-muted hover:text-danger p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Scrollable Body */}
            <form onSubmit={handleBatchSplice} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Mode Sambungan */}
              <div>
                <label className="block text-xs font-bold text-dark-text mb-1.5">Mode Sambungan</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBatchSpliceForm(prev => ({ ...prev, splice_type: 'straight' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      batchSpliceForm.splice_type === 'straight' 
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-200' 
                        : 'bg-white text-dark-text border-dark-border hover:bg-gray-50'
                    }`}
                  >
                    <GitMerge size={15} /> ⚡ Pelebaran Lurus (Trunk / Tube to Tube)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchSpliceForm(prev => ({ ...prev, splice_type: 'petik', count: 1, start_core_a: 1, start_core_b: 1 }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      batchSpliceForm.splice_type === 'petik' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-200' 
                        : 'bg-white text-dark-text border-dark-border hover:bg-gray-50'
                    }`}
                  >
                    <span>🌿</span> Sambung Petik ke ODP / Dropcore
                  </button>
                </div>
              </div>

              {/* Pemilihan 2 Kabel: Kabel Asal & Kabel Tujuan (Grid 2 Kolom) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-gray-50/90 rounded-xl border border-gray-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">Kabel Asal (Proyek Lama)</label>
                    {selectedCableA && (
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {selectedCableA.properties?.capacity || 12} Core ({getTubeCount(selectedCableA.properties?.capacity)} Tube)
                      </span>
                    )}
                  </div>
                  <select
                    required
                    value={batchSpliceForm.cable_a_id}
                    onChange={(e) => setBatchSpliceForm({...batchSpliceForm, cable_a_id: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-purple-600 shadow-xs font-medium"
                  >
                    <option value="">-- Pilih Kabel Asal --</option>
                    {availableCables.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.capacity}C) - [{c.region || 'No Region'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">Kabel Tujuan (Pelebaran / Proyek Baru)</label>
                    {selectedCableB && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {selectedCableB.properties?.capacity || 48} Core ({getTubeCount(selectedCableB.properties?.capacity)} Tube)
                      </span>
                    )}
                  </div>
                  <select
                    required
                    value={batchSpliceForm.cable_b_id}
                    onChange={(e) => setBatchSpliceForm({...batchSpliceForm, cable_b_id: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-purple-600 shadow-xs font-medium"
                  >
                    <option value="">-- Pilih Kabel Tujuan --</option>
                    {availableCables.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.capacity}C) - [{c.region || 'No Region'}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mode Petik Konfigurasi */}
              {batchSpliceForm.splice_type === 'petik' && (
                <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    🌿 Konfigurasi Petik Core Feeder
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Warna Tube Feeder</label>
                      <select
                        value={batchSpliceForm.petik_tube}
                        onChange={(e) => {
                          const val = e.target.value;
                          const tubeNum = parseInt(val.match(/\d+/)?.[0] || '1');
                          const coreInTube = parseInt(batchSpliceForm.petik_core.match(/\d+/)?.[0] || '1');
                          const absCore = (tubeNum - 1) * 12 + coreInTube;
                          setBatchSpliceForm({...batchSpliceForm, petik_tube: val, start_core_b: absCore, start_core_a: 1});
                        }}
                        className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs bg-white text-gray-800 font-medium"
                      >
                        {STANDARD_TUBES.slice(0, 8).map(t => (
                          <option key={t.num} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Warna Core Feeder</label>
                      <select
                        value={batchSpliceForm.petik_core}
                        onChange={(e) => {
                          const val = e.target.value;
                          const coreInTube = parseInt(val.match(/\d+/)?.[0] || '1');
                          const tubeNum = parseInt(batchSpliceForm.petik_tube.match(/\d+/)?.[0] || '1');
                          const absCore = (tubeNum - 1) * 12 + coreInTube;
                          setBatchSpliceForm({...batchSpliceForm, petik_core: val, start_core_b: absCore, start_core_a: 1});
                        }}
                        className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs bg-white text-gray-800 font-medium"
                      >
                        {STANDARD_CORE_NAMES.map((name, i) => (
                          <option key={i} value={`Core ${i+1} (${name})`}>Core {i+1} ({name})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-900 mb-1">Tujuan Sambungan Petik</label>
                    <input
                      type="text"
                      value={batchSpliceForm.petik_target}
                      onChange={(e) => setBatchSpliceForm({...batchSpliceForm, petik_target: e.target.value})}
                      className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs bg-white text-gray-800"
                      placeholder="Contoh: Jalur ODP 36, DC Jalur ODP 29"
                    />
                  </div>
                </div>
              )}

              {/* Mode Trunk / Pelebaran Lurus: 3 METODE PEMILIHAN */}
              {batchSpliceForm.splice_type === 'straight' && (
                <div className="space-y-3 bg-gray-50/90 p-4 rounded-xl border border-gray-200">
                  {/* Tab Pilihan 3 Metode */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-gray-200 gap-2">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Layers size={14} className="text-purple-600" /> Metode Pemilihan Sambungan:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const tA = Number(batchSpliceForm.selected_tube_a) || 1;
                          const tB = Number(batchSpliceForm.selected_tube_b) || 1;
                          setBatchSpliceForm(prev => ({
                            ...prev,
                            selection_mode: 'tube',
                            start_core_a: (tA - 1) * 12 + 1,
                            start_core_b: (tB - 1) * 12 + 1,
                            count: 12
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          batchSpliceForm.selection_mode === 'tube' 
                            ? 'bg-purple-600 text-white shadow-xs' 
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        🎨 Sambung per Tube (Pilih Tube)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBatchSpliceForm(prev => ({ ...prev, selection_mode: 'range' }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          batchSpliceForm.selection_mode === 'range' 
                            ? 'bg-purple-600 text-white shadow-xs' 
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        ⚡ Berurutan (Manual)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const freeCores = batchCoresA?.filter(c => c.status === 'Free').map(c => c.core_number) || [];
                          const allCores = batchCoresA?.map(c => c.core_number) || Array.from({length: 12}, (_, i) => i + 1);
                          setBatchSpliceForm(prev => ({ 
                            ...prev, 
                            selection_mode: 'custom',
                            selected_cores_a: prev.selected_cores_a.length > 0 ? prev.selected_cores_a : (freeCores.length > 0 ? freeCores : allCores)
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          batchSpliceForm.selection_mode === 'custom' 
                            ? 'bg-purple-600 text-white shadow-xs' 
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        🎯 Checklist Core
                      </button>
                    </div>
                  </div>

                  {/* METODE 1: SAMBUNG PER TUBE (FITUR UTAMA) */}
                  {batchSpliceForm.selection_mode === 'tube' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Tube Kabel Asal */}
                        <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs">
                          <label className="block text-xs font-bold text-purple-950 mb-1 flex items-center justify-between">
                            <span>Tube Kabel Asal</span>
                            <span className="text-[10px] text-gray-500 font-normal">
                              Total: {getTubeCount(selectedCableA?.properties?.capacity || 12)} Tube
                            </span>
                          </label>
                          <select
                            value={batchSpliceForm.selected_tube_a}
                            onChange={(e) => {
                              const tA = Number(e.target.value);
                              setBatchSpliceForm(prev => ({
                                ...prev,
                                selected_tube_a: tA,
                                start_core_a: (tA - 1) * 12 + 1
                              }));
                            }}
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs bg-purple-50/50 text-gray-900 font-bold focus:outline-none focus:border-purple-600"
                          >
                            {STANDARD_TUBES.slice(0, getTubeCount(selectedCableA?.properties?.capacity || 12)).map(t => (
                              <option key={t.num} value={t.num}>
                                {t.name} [Core {(t.num - 1) * 12 + 1} s/d {t.num * 12}]
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Tube Kabel Tujuan */}
                        <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
                          <label className="block text-xs font-bold text-emerald-950 mb-1 flex items-center justify-between">
                            <span>Tube Kabel Tujuan</span>
                            <span className="text-[10px] text-gray-500 font-normal">
                              Total: {getTubeCount(selectedCableB?.properties?.capacity || 48)} Tube
                            </span>
                          </label>
                          <select
                            value={batchSpliceForm.selected_tube_b}
                            onChange={(e) => {
                              const tB = Number(e.target.value);
                              setBatchSpliceForm(prev => ({
                                ...prev,
                                selected_tube_b: tB,
                                start_core_b: (tB - 1) * 12 + 1
                              }));
                            }}
                            className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs bg-emerald-50/50 text-gray-900 font-bold focus:outline-none focus:border-emerald-600"
                          >
                            {STANDARD_TUBES.slice(0, getTubeCount(selectedCableB?.properties?.capacity || 48)).map(t => (
                              <option key={t.num} value={t.num}>
                                {t.name} [Core {(t.num - 1) * 12 + 1} s/d {t.num * 12}]
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Visual Mapping 12 Core Antar-Tube */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-800 mb-2">
                          <span>Pemetaan 12 Core (Standar Lapangan):</span>
                          <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Tube {batchSpliceForm.selected_tube_a} [C{(batchSpliceForm.selected_tube_a - 1) * 12 + 1}..{batchSpliceForm.selected_tube_a * 12}] ➔ Tube {batchSpliceForm.selected_tube_b} [C{(batchSpliceForm.selected_tube_b - 1) * 12 + 1}..{batchSpliceForm.selected_tube_b * 12}]
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                          {STANDARD_CORE_NAMES.map((cName, idx) => {
                            const coreNumA = (batchSpliceForm.selected_tube_a - 1) * 12 + idx + 1;
                            const coreNumB = (batchSpliceForm.selected_tube_b - 1) * 12 + idx + 1;
                            return (
                              <div key={idx} className="p-1.5 rounded-lg border border-gray-200 bg-gray-50/60 text-center flex flex-col items-center gap-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-full truncate ${getFiberBadge(cName)}`}>
                                  {cName}
                                </span>
                                <div className="flex items-center justify-between w-full text-[11px] font-mono font-bold text-gray-700 px-0.5">
                                  <span>C{coreNumA}</span>
                                  <span className="text-purple-600">➔</span>
                                  <span>C{coreNumB}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Auto-Skip Checkbox */}
                      <div className="flex items-center gap-2 p-2 bg-purple-50/80 rounded-lg border border-purple-200">
                        <input
                          type="checkbox"
                          id="skip_spliced_tube_cb"
                          checked={batchSpliceForm.skip_spliced}
                          onChange={(e) => setBatchSpliceForm({...batchSpliceForm, skip_spliced: e.target.checked})}
                          className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <label htmlFor="skip_spliced_tube_cb" className="text-[11px] font-semibold text-purple-900 cursor-pointer">
                          ⚡ Otomatis lewati (skip) core yang sudah dipetik/tersambung ke ODP sebelumnya
                        </label>
                      </div>
                    </div>
                  )}

                  {/* METODE 2: BERURUTAN MANUAL */}
                  {batchSpliceForm.selection_mode === 'range' && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-dark-text mb-1">Start Core A</label>
                          <input
                            type="number"
                            min={1}
                            value={batchSpliceForm.start_core_a}
                            onChange={(e) => setBatchSpliceForm({...batchSpliceForm, start_core_a: Math.max(1, Number(e.target.value))})}
                            className="w-full px-2.5 py-1.5 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-primary font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-dark-text mb-1">Start Core B</label>
                          <input
                            type="number"
                            min={1}
                            value={batchSpliceForm.start_core_b}
                            onChange={(e) => setBatchSpliceForm({...batchSpliceForm, start_core_b: Math.max(1, Number(e.target.value))})}
                            className="w-full px-2.5 py-1.5 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-primary font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-dark-text mb-1">Jumlah Core</label>
                          <input
                            type="number"
                            min={1}
                            value={batchSpliceForm.count}
                            onChange={(e) => setBatchSpliceForm({...batchSpliceForm, count: Math.max(1, Number(e.target.value))})}
                            className="w-full px-2.5 py-1.5 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-primary font-medium"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-purple-50/80 rounded-lg border border-purple-200">
                        <input
                          type="checkbox"
                          id="skip_spliced_cb"
                          checked={batchSpliceForm.skip_spliced}
                          onChange={(e) => setBatchSpliceForm({...batchSpliceForm, skip_spliced: e.target.checked})}
                          className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <label htmlFor="skip_spliced_cb" className="text-[11px] font-semibold text-purple-900 cursor-pointer">
                          ⚡ Otomatis lewati (skip) core yang sudah dipetik/tersambung ke ODP
                        </label>
                      </div>
                    </div>
                  )}

                  {/* METODE 3: CHECKLIST CORE SPESIFIK */}
                  {batchSpliceForm.selection_mode === 'custom' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-700 font-bold">
                          Pilih core kabel asal ({batchSpliceForm.selected_cores_a.length} terpilih):
                        </span>
                        <div className="flex gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              const allNums = batchCoresA?.map(c => c.core_number) || Array.from({length: 12}, (_, i) => i + 1);
                              setBatchSpliceForm(prev => ({ ...prev, selected_cores_a: allNums }));
                            }}
                            className="text-purple-700 hover:underline font-bold cursor-pointer"
                          >
                            Pilih Semua
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => {
                              const freeNums = batchCoresA?.filter(c => c.status === 'Free').map(c => c.core_number) || [];
                              setBatchSpliceForm(prev => ({ ...prev, selected_cores_a: freeNums }));
                            }}
                            className="text-emerald-700 hover:underline font-bold cursor-pointer"
                          >
                            Hanya Core Bebas
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setBatchSpliceForm(prev => ({ ...prev, selected_cores_a: [] }))}
                            className="text-red-600 hover:underline font-bold cursor-pointer"
                          >
                            Kosongkan
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border border-gray-200">
                        {(batchCoresA && batchCoresA.length > 0 ? batchCoresA : Array.from({length: 12}, (_, i) => ({ 
                          core_number: i + 1, 
                          tube_number: 1, 
                          color: STANDARD_CORE_NAMES[i % 12], 
                          status: 'Free' 
                        }))).map((core: any) => {
                          const isSelected = batchSpliceForm.selected_cores_a.includes(core.core_number);
                          const isSpliced = core.status === 'Spliced';
                          return (
                            <div
                              key={core.core_number}
                              onClick={() => {
                                setBatchSpliceForm(prev => {
                                  const exists = prev.selected_cores_a.includes(core.core_number);
                                  return {
                                    ...prev,
                                    selected_cores_a: exists
                                      ? prev.selected_cores_a.filter(n => n !== core.core_number)
                                      : [...prev.selected_cores_a, core.core_number].sort((a, b) => a - b)
                                  };
                                });
                              }}
                              className={`p-1.5 rounded-lg border text-center cursor-pointer transition-all flex flex-col items-center justify-between gap-1 select-none ${
                                isSelected
                                  ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500 shadow-xs'
                                  : 'bg-gray-50/60 border-gray-200 hover:bg-gray-100 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-bold text-gray-700">C{core.core_number}</span>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="rounded text-purple-600 focus:ring-purple-500 scale-75 cursor-pointer pointer-events-none"
                                />
                              </div>
                              <span className={`text-[9px] font-semibold px-1 py-0.5 rounded w-full truncate ${getFiberBadge(core.color)}`}>
                                {core.color}
                              </span>
                              {isSpliced ? (
                                <span className="text-[8px] font-bold text-amber-800 bg-amber-100 px-1 rounded w-full truncate">
                                  Terpakai
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded w-full truncate">
                                  Bebas
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Titik Temu JC & Catatan Tambahan (Grid 2 Kolom) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-dark-text mb-1">
                    Titik Temu / Perangkat Sambung (Joint Closure)
                  </label>
                  <select
                    value={batchSpliceForm.closure_id || (sortedClosures[0]?.id || '')}
                    onChange={(e) => setBatchSpliceForm({...batchSpliceForm, closure_id: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-purple-600 font-medium"
                  >
                    {sortedClosures.map((cl, idx) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.name} ({cl.device_type}) {cl.dist < 50000 ? `[${cl.dist < 1000 ? Math.round(cl.dist) + 'm' : (cl.dist/1000).toFixed(1) + 'km'}${idx === 0 ? ' - ⭐ Terdekat' : ''}]` : ''}
                      </option>
                    ))}
                    <option value="">Auto-Detect Terdekat / Buat Joint Baru</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark-text mb-1">Catatan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    value={batchSpliceForm.custom_note}
                    onChange={(e) => setBatchSpliceForm({...batchSpliceForm, custom_note: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-xs bg-white text-dark-text focus:outline-none focus:border-purple-600"
                    placeholder="Contoh: Sambung Pelebaran Tahap 2"
                  />
                </div>
              </div>

              {/* Checkbox Otomatis Catat Hasil */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="auto_desc_checkbox"
                  checked={batchSpliceForm.auto_update_description}
                  onChange={(e) => setBatchSpliceForm({...batchSpliceForm, auto_update_description: e.target.checked})}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="auto_desc_checkbox" className="text-xs font-medium text-dark-text cursor-pointer">
                  Otomatis catat hasil sambungan ke Titik Joint Closure (JC) &amp; Kabel (Sebagai Acuan Lapangan)
                </label>
              </div>

              {/* Live Preview Deskripsi Sambungan */}
              <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 text-xs">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block mb-1">
                  ✨ Format Catatan yang Akan Tersimpan ke JC &amp; Kabel:
                </span>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="text-purple-700 bg-white p-2 rounded-lg border border-gray-200 shadow-xs">
                    <strong className="text-purple-900">Di Joint Closure:</strong>{' '}
                    {batchSpliceForm.splice_type === 'petik'
                      ? `${(availableCables.find(c => c.id === batchSpliceForm.cable_a_id)?.name || 'Kabel-A')} ➔ ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')} (${batchSpliceForm.petik_tube} / ${batchSpliceForm.petik_core}${batchSpliceForm.petik_target ? ' - ' + batchSpliceForm.petik_target : ''})`
                      : batchSpliceForm.selection_mode === 'tube'
                        ? `${(availableCables.find(c => c.id === batchSpliceForm.cable_a_id)?.name || 'Kabel-A')} (Tube ${batchSpliceForm.selected_tube_a}) ➔ ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')} (Tube ${batchSpliceForm.selected_tube_b}: Core ${(batchSpliceForm.selected_tube_b - 1) * 12 + 1}-${batchSpliceForm.selected_tube_b * 12})`
                        : batchSpliceForm.selection_mode === 'custom'
                          ? `${(availableCables.find(c => c.id === batchSpliceForm.cable_a_id)?.name || 'Kabel-A')} (Core [${batchSpliceForm.selected_cores_a.join(',')}]) ➔ ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')}${batchSpliceForm.custom_note ? ` - ${batchSpliceForm.custom_note}` : ''}`
                          : `${(availableCables.find(c => c.id === batchSpliceForm.cable_a_id)?.name || 'Kabel-A')} (Core ${batchSpliceForm.start_core_a}-${Number(batchSpliceForm.start_core_a)+Number(batchSpliceForm.count)-1}${batchSpliceForm.skip_spliced ? ' [Auto-Skip]' : ''}) ➔ ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')} (Core ${batchSpliceForm.start_core_b}-${Number(batchSpliceForm.start_core_b)+Number(batchSpliceForm.count)-1})${batchSpliceForm.custom_note ? ` - ${batchSpliceForm.custom_note}` : ''}`
                    }
                  </div>
                  <div className="text-emerald-700 bg-white p-2 rounded-lg border border-gray-200 shadow-xs">
                    <strong className="text-emerald-900">Di Kabel Asal:</strong>{' '}
                    {batchSpliceForm.splice_type === 'petik'
                      ? `Sambung ke ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')} via ${(sortedClosures.find(c => c.id === (batchSpliceForm.closure_id || sortedClosures[0]?.id))?.name || 'JC Terdekat')} (${batchSpliceForm.petik_tube} / ${batchSpliceForm.petik_core}${batchSpliceForm.petik_target ? ' - ' + batchSpliceForm.petik_target : ''})`
                      : batchSpliceForm.selection_mode === 'tube'
                        ? `Sambung ke ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')} via ${(sortedClosures.find(c => c.id === (batchSpliceForm.closure_id || sortedClosures[0]?.id))?.name || 'JC Terdekat')} (Tube ${batchSpliceForm.selected_tube_a} ➔ Tube ${batchSpliceForm.selected_tube_b})`
                        : batchSpliceForm.selection_mode === 'custom'
                          ? `Sambung ke ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')} via ${(sortedClosures.find(c => c.id === (batchSpliceForm.closure_id || sortedClosures[0]?.id))?.name || 'JC Terdekat')} (Core [${batchSpliceForm.selected_cores_a.join(',')}])`
                          : `Sambung ke ${(availableCables.find(c => c.id === batchSpliceForm.cable_b_id)?.name || 'Kabel-B')} via ${(sortedClosures.find(c => c.id === (batchSpliceForm.closure_id || sortedClosures[0]?.id))?.name || 'JC Terdekat')} (Core ${batchSpliceForm.start_core_a}-${Number(batchSpliceForm.start_core_a)+Number(batchSpliceForm.count)-1})${batchSpliceForm.custom_note ? ` - ${batchSpliceForm.custom_note}` : ''}`
                    }
                  </div>
                </div>
              </div>

              {/* Footer Sticky */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-dark-border shrink-0">
                <button
                  type="button"
                  onClick={() => setBatchSpliceModal(false)}
                  className="px-4 py-2 border border-dark-border rounded-xl text-dark-text hover:bg-gray-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isBatchSplicing}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isBatchSplicing ? <Loader2 size={15} className="animate-spin" /> : <GitMerge size={15} />}
                  Sambungkan Core &amp; Update Deskripsi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Cable Modal */}
      {editingCable && (
        <div className="fixed inset-0 bg-dark-text/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-dark-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
              <h3 className="text-base font-bold text-dark-text flex items-center gap-2">
                <Edit className="text-primary" size={18} />
                Edit Jalur Kabel: {editingCable.name}
              </h3>
              <button onClick={() => setEditingCable(null)} className="text-dark-muted hover:text-danger transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditCableSubmit} className="p-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Nama Kabel</label>
                  <input 
                    type="text"
                    value={editCableFormData.name}
                    onChange={(e) => setEditCableFormData({...editCableFormData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Tipe Kabel</label>
                  <select
                    value={editCableFormData.type}
                    onChange={(e) => setEditCableFormData({...editCableFormData, type: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  >
                    <option value="Backbone">🔴 Backbone</option>
                    <option value="Feeder">🟠 Feeder</option>
                    <option value="Distribution">🔵 Distribution</option>
                    <option value="Dropcore">🟢 Dropcore</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Kapasitas (Core)</label>
                  <input 
                    type="number"
                    value={editCableFormData.capacity}
                    onChange={(e) => setEditCableFormData({...editCableFormData, capacity: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-text mb-1">Project / Region</label>
                  <input 
                    type="text"
                    value={editCableFormData.region}
                    onChange={(e) => setEditCableFormData({...editCableFormData, region: e.target.value})}
                    className="w-full px-3 py-2 border border-dark-border rounded-lg text-sm bg-white text-dark-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-text mb-1">Deskripsi / Catatan Sambungan</label>
                <textarea 
                  value={editCableFormData.description}
                  onChange={(e) => setEditCableFormData({...editCableFormData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-dark-border rounded-lg focus:outline-none focus:border-primary text-xs bg-white text-dark-text font-mono"
                  rows={4}
                  placeholder="Catatan sambungan atau pelebaran..."
                />
              </div>
              
              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-dark-border">
                <button 
                  type="button" 
                  onClick={() => setEditingCable(null)}
                  className="px-4 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={editCableMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editCableMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Simpan Perubahan Kabel
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
