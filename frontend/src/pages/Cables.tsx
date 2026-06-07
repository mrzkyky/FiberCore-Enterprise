import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Cable as CableIcon, Plus, Loader2, UploadCloud, Layers, Box, Trash2, Edit2, ShieldAlert, Activity, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../store/useAuthStore';
import Modal from '../components/Modal';

const cableSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.string().min(1, "Type is required"),
  capacity: z.preprocess((val) => Number(val), z.number().min(1, "Capacity must be at least 1 core")),
  description: z.string().optional()
});

type CableFormData = z.infer<typeof cableSchema>;

interface Cable {
  id: string;
  name: string;
  type: string;
  capacity: number;
  region?: string;
  import_batch?: string;
  description?: string;
}

interface Core {
  id: string;
  core_number: number;
  tube_number: number;
  color: string;
  status: string;
}

export default function Cables() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCable, setSelectedCable] = useState<Cable | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [tracingCoreId, setTracingCoreId] = useState<string | null>(null);
  const [isManageImportsOpen, setIsManageImportsOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CableFormData>({
    // @ts-expect-error Zod resolver type mismatch with react-hook-form
    resolver: zodResolver(cableSchema)
  });

  const { data: cables, isLoading, error } = useQuery({
    queryKey: ['cables'],
    queryFn: async () => {
      const response = await axios.get<Cable[]>('/api/v1/cables/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const { data: cores, isLoading: isLoadingCores } = useQuery({
    queryKey: ['cores', selectedCable?.id],
    queryFn: async () => {
      if (!selectedCable) return [];
      const response = await axios.get<Core[]>(`/api/v1/cables/${selectedCable.id}/cores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!selectedCable
  });

  const { data: traceData, isLoading: isLoadingTrace } = useQuery({
    queryKey: ['trace', tracingCoreId],
    queryFn: async () => {
      if (!tracingCoreId) return null;
      const response = await axios.get(`/api/v1/splices/trace/${tracingCoreId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!tracingCoreId
  });

  const mutation = useMutation({
    mutationFn: async (data: CableFormData) => {
      if (editingId) {
        return axios.put(`/api/v1/cables/${editingId}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      return axios.post('/api/v1/cables/', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cables'] });
      closeModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return axios.delete(`/api/v1/cables/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cables'] });
      if (selectedCable?.id === deleteMutation.variables) setSelectedCable(null);
    }
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return axios.delete(`/api/v1/cables/batch/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cables'] });
      setSelectedCable(null);
      alert("KMZ Batch deleted successfully!");
    }
  });

  const deleteRegionMutation = useMutation({
    mutationFn: async (regionName: string) => {
      return axios.delete(`/api/v1/cables/region/${encodeURIComponent(regionName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cables'] });
      setSelectedCable(null);
      alert("Region routes deleted successfully!");
    }
  });

  const openModal = (cable?: Cable) => {
    if (cable) {
      setEditingId(cable.id);
      setValue('name', cable.name);
      setValue('type', cable.type);
      setValue('capacity', cable.capacity);
      setValue('description', cable.description || '');
    } else {
      setEditingId(null);
      reset();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    reset();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const region = window.prompt("Enter Region Name for these routes (e.g., Brebes, Tegal):", "Unknown");
    if (region === null) {
      event.target.value = '';
      return; 
    }
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await axios.post(`/api/v1/uploads/kml?region=${encodeURIComponent(region)}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      queryClient.invalidateQueries({ queryKey: ['cables'] });
      alert(`KMZ/KML Routes imported successfully into Region: ${region}!`);
    } catch (err: any) {
      alert("Failed to upload KMZ/KML: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteRegion = (region: string | undefined) => {
    if (!region) return;
    if (window.confirm(`Are you sure you want to delete ALL cables in region '${region}'? This cannot be undone!`)) {
      deleteRegionMutation.mutate(region);
    }
  };

  const handleDeleteBatch = (batchId: string | undefined) => {
    if (!batchId) return;
    if (window.confirm(`Are you sure you want to delete this specific KMZ import batch? This will remove all associated cables and cores.`)) {
      deleteBatchMutation.mutate(batchId);
    }
  };

  const onSubmit = (data: CableFormData) => {
    mutation.mutate(data);
  };

  const getTailwindColor = (color: string) => {
    const map: Record<string, string> = {
      Blue: 'bg-blue-500 text-white', Orange: 'bg-orange-500 text-white', Green: 'bg-green-500 text-white',
      Brown: 'bg-amber-800 text-white', Slate: 'bg-slate-400 text-white', White: 'bg-white text-black border border-gray-300',
      Red: 'bg-red-500 text-white', Black: 'bg-black text-white border border-gray-600', Yellow: 'bg-yellow-400 text-black',
      Violet: 'bg-purple-500 text-white', Rose: 'bg-pink-400 text-white', Aqua: 'bg-teal-300 text-black'
    };
    return map[color] || 'bg-gray-500 text-white';
  };

  const uniqueRegions = Array.from(new Set(cables?.map(c => c.region).filter(Boolean) as string[]));
  const filteredCables = cables?.filter(c => regionFilter === 'All' || c.region === regionFilter);

  const importBatches = Array.from(new Set(cables?.filter(c => c.import_batch).map(c => c.import_batch) as string[])).map(batchId => {
    const batchCables = cables?.filter(c => c.import_batch === batchId) || [];
    return {
      id: batchId,
      count: batchCables.length,
      region: batchCables[0]?.region || 'Unknown'
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <Box className="text-primary" />
            Cables & Cores Inventory
          </h2>
          <p className="text-dark-muted text-sm mt-1">Manage physical fiber cables and internal core allocations</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsManageImportsOpen(true)}
            className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg border border-dark-border hover:bg-dark-surface transition-colors"
          >
            <Trash2 size={18} /> Manage KMZs
          </button>
          <label className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors">
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            Import KMZ
            <input type="file" accept=".kml,.kmz" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
          <button 
            onClick={() => openModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} /> Tambah Kabel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cables Table */}
        <div className="lg:col-span-2 bg-white border border-dark-border rounded-xl flex flex-col shadow-sm h-[calc(100vh-160px)] min-h-[600px]">
          <div className="p-5 border-b border-dark-border flex justify-between items-center bg-white rounded-t-xl z-10 shrink-0">
            <h3 className="text-lg font-bold text-dark-text">Cable Data Grid</h3>
            {uniqueRegions.length > 0 && (
              <select 
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="bg-dark-surface border border-dark-border rounded-lg px-4 py-1.5 text-sm text-dark-text focus:outline-none focus:border-primary"
              >
                <option value="All">All Regions</option>
                {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>
          
          <div className="flex-1 overflow-auto bg-white rounded-b-xl">
            {isLoading ? (
              <div className="flex justify-center py-12 text-primary">
                <Loader2 className="animate-spin" size={32} />
              </div>
            ) : error ? (
              <div className="text-danger p-6 text-center flex flex-col items-center gap-2">
                <ShieldAlert size={24} />
                Failed to load cables.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-dark-surface border-b border-dark-border text-dark-muted text-sm shadow-sm z-10">
                  <tr>
                    <th className="py-3 px-5 font-semibold">Cable Name</th>
                    <th className="py-3 px-5 font-semibold">Region</th>
                    <th className="py-3 px-5 font-semibold">Type</th>
                    <th className="py-3 px-5 font-semibold">Capacity</th>
                    <th className="py-3 px-5 font-semibold">Details</th>
                    <th className="py-3 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-dark-text text-sm divide-y divide-dark-border">
                  {filteredCables?.map((cable) => (
                    <tr 
                      key={cable.id} 
                      className={`hover:bg-accent/50 transition-colors cursor-pointer ${selectedCable?.id === cable.id ? 'bg-accent border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                      onClick={() => setSelectedCable(cable)}
                    >
                      <td className="py-4 px-5 font-medium text-primary max-w-[200px] truncate" title={cable.name}>{cable.name}</td>
                      <td className="py-4 px-5">
                        {cable.region ? (
                           <span className="bg-dark-surface px-2 py-1 rounded text-xs border border-dark-border text-dark-muted font-medium">{cable.region}</span>
                        ) : '-'}
                      </td>
                      <td className="py-4 px-5">{cable.type}</td>
                      <td className="py-4 px-5 font-mono font-medium">{cable.capacity}C</td>
                      <td className="py-4 px-5 max-w-[150px] truncate" title={cable.description}>{cable.description || '-'}</td>
                      <td className="py-4 px-5 text-right whitespace-nowrap space-x-3">
                        {cable.import_batch && (
                           <button onClick={(e) => { e.stopPropagation(); handleDeleteBatch(cable.import_batch); }} className="text-orange hover:text-orange-light transition-colors" title="Delete entire KMZ batch"><Trash2 size={16}/></button>
                        )}
                        {!cable.import_batch && cable.region && (
                           <button onClick={(e) => { e.stopPropagation(); handleDeleteRegion(cable.region); }} className="text-orange hover:text-orange-light transition-colors" title="Delete ALL cables in this region"><Trash2 size={16}/></button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); openModal(cable); }} className="text-primary hover:text-primary-glow transition-colors" title="Edit Cable"><Edit2 size={16}/></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(cable.id); }} className="text-danger hover:text-red-400 transition-colors" title="Delete Cable"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {filteredCables?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-dark-muted">
                        No cables found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Core Management */}
        <div className="bg-white border border-dark-border rounded-xl flex flex-col shadow-sm h-[calc(100vh-160px)] min-h-[600px]">
          <div className="p-5 border-b border-dark-border bg-dark-surface rounded-t-xl shrink-0">
            <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              Core Matrix
            </h3>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto bg-white rounded-b-xl">
            {!selectedCable ? (
              <div className="h-full flex flex-col items-center justify-center text-dark-muted border-2 border-dashed border-dark-border rounded-xl">
                <Box size={48} className="mb-4 opacity-20" />
                <p className="font-medium">Select a cable to view its core matrix</p>
              </div>
            ) : isLoadingCores ? (
               <div className="flex justify-center py-12 text-primary">
                 <Loader2 className="animate-spin" size={32} />
               </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-accent/30 rounded-lg border border-primary/20">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Active Selection</p>
                  <p className="font-bold text-dark-text text-lg">{selectedCable.name}</p>
                  <div className="flex gap-4 mt-2 text-sm text-dark-muted">
                    <span>{selectedCable.capacity} Cores</span>
                    <span>•</span>
                    <span>{selectedCable.type}</span>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-dark-muted mb-3 uppercase tracking-wider">Physical Cores</h4>
                  <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    {cores?.map(core => (
                      <div 
                        key={core.id} 
                        onClick={() => setTracingCoreId(core.id)}
                        className={`h-10 w-full rounded-md shadow-sm border border-black/10 flex items-center justify-center text-xs font-bold cursor-pointer hover:opacity-80 hover:scale-105 transition-all ${getTailwindColor(core.color)}`}
                        title={`Tube ${core.tube_number} | Core ${core.core_number} | ${core.color} | ${core.status}. Click to trace route.`}
                      >
                        {core.core_number}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 bg-dark-surface rounded-lg border border-dark-border">
                  <p className="text-xs text-dark-muted font-medium flex items-center gap-2 justify-center">
                    <Activity size={14} className="text-primary" />
                    Click a core to trace its physical route
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Definitions */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Edit Cable" : "Add New Cable"}>
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5 p-2">
          <div>
            <label className="block text-sm font-bold text-dark-text mb-1.5">Cable Designation</label>
            <input 
              {...register('name')} 
              className="w-full bg-white border border-dark-border rounded-lg px-4 py-2.5 text-dark-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="e.g. Backbone-JKT-BDG"
            />
            {errors.name && <p className="text-danger text-xs mt-1 font-medium">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-dark-text mb-1.5">Network Type</label>
              <select 
                {...register('type')} 
                className="w-full bg-white border border-dark-border rounded-lg px-4 py-2.5 text-dark-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              >
                <option value="">Select Tier</option>
                <option value="Backbone">Backbone</option>
                <option value="Feeder">Feeder</option>
                <option value="Distribution">Distribution</option>
                <option value="Drop">Drop</option>
              </select>
              {errors.type && <p className="text-danger text-xs mt-1 font-medium">{errors.type.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-dark-text mb-1.5">Core Capacity</label>
              <select 
                {...register('capacity')} 
                className={`w-full bg-white border border-dark-border rounded-lg px-4 py-2.5 text-dark-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all ${editingId ? 'bg-dark-surface opacity-70' : ''}`}
                disabled={!!editingId}
              >
                <option value="">Select Capacity</option>
                <option value="4">4 Cores</option>
                <option value="6">6 Cores</option>
                <option value="12">12 Cores</option>
                <option value="24">24 Cores</option>
                <option value="48">48 Cores</option>
                <option value="96">96 Cores</option>
                <option value="144">144 Cores</option>
              </select>
              {errors.capacity && <p className="text-danger text-xs mt-1 font-medium">{errors.capacity.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-dark-text mb-1.5">Description / Cable Notes</label>
            <textarea 
              {...register('description')} 
              rows={3}
              className="w-full bg-white border border-dark-border rounded-lg px-4 py-2.5 text-dark-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
              placeholder="e.g. Slack 20m di Tiang ODP-XYZ, disambung dengan FO Drop..."
            />
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-dark-border mt-6">
            <button type="button" onClick={closeModal} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary disabled:opacity-50 min-w-[100px]">
              {mutation.isPending ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Save Cable'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Trace Route Modal */}
      <Modal isOpen={!!tracingCoreId} onClose={() => setTracingCoreId(null)} title="Core Tracing Analytics">
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isLoadingTrace ? (
            <div className="flex justify-center py-12 text-primary">
              <Loader2 className="animate-spin" size={40} />
            </div>
          ) : traceData ? (
            <div>
              <div className="bg-accent/30 p-4 rounded-lg border border-primary/20 mb-6 flex items-start gap-4">
                <div className="p-2 bg-white rounded shadow-sm text-primary">
                  <Activity size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-dark-text">End-to-End Tracing Complete</h4>
                  <p className="text-sm text-dark-muted mt-1">
                    Traced a continuous physical connection spanning <strong>{traceData.path.length}</strong> nodes across the network.
                  </p>
                </div>
              </div>
              
              <div className="relative border-l-2 border-primary/30 ml-6 space-y-8 py-2">
                {traceData.path.map((node: any, idx: number) => (
                  <div key={idx} className="relative pl-8 group">
                    <div className="absolute -left-[11px] top-1.5 h-5 w-5 rounded-full bg-white border-4 border-primary group-hover:scale-125 transition-transform shadow-sm"></div>
                    
                    {node.type === 'core' ? (
                      <div className="bg-dark-surface p-4 rounded-xl border border-dark-border shadow-sm group-hover:border-primary/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-dark-text font-bold">{node.cable_name}</p>
                          <span className="px-2 py-1 bg-success/10 text-success text-xs font-bold rounded">Active</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-sm">
                          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-dark-border">
                            <div className="w-3 h-3 rounded-full shadow-inner border border-black/10" style={{ backgroundColor: node.color.toLowerCase() }}></div>
                            <span className="font-mono font-medium text-dark-text">Tube {node.tube} / Core {node.core_number}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-accent/10 p-3 rounded-lg border border-accent">
                        <p className="text-primary font-bold flex items-center gap-2">
                          <Box size={16} />
                          Splice Joint @ {node.closure_name}
                        </p>
                        {node.attenuation > 0 && (
                          <p className="text-xs font-medium text-danger mt-1.5 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Optical Loss: {node.attenuation} dB
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
             <div className="text-center py-8 text-danger flex flex-col items-center gap-2">
               <ShieldAlert size={32} />
               <p className="font-medium">Failed to trace physical route.</p>
             </div>
          )}
        </div>
      </Modal>

      {/* Manage KMZ Imports Modal */}
      <Modal isOpen={isManageImportsOpen} onClose={() => setIsManageImportsOpen(false)} title="Manage KMZ Imports">
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {importBatches.length === 0 ? (
            <p className="text-dark-muted text-center py-8">No imported KMZ batches found.</p>
          ) : (
            <div className="space-y-3">
              {importBatches.map(batch => (
                <div key={batch.id} className="flex items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-lg">
                  <div>
                    <h4 className="font-bold text-dark-text flex items-center gap-2">
                      <Box size={16} className="text-primary" />
                      Import Batch
                    </h4>
                    <p className="text-sm text-dark-muted mt-1">Region: <strong>{batch.region}</strong> • {batch.count} cables</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteBatch(batch.id)}
                    disabled={deleteBatchMutation.isPending}
                    className="text-danger hover:text-red-400 bg-danger/10 hover:bg-danger/20 p-2 rounded transition-colors flex items-center gap-2 text-sm font-semibold"
                  >
                    {deleteBatchMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} 
                    Delete Batch
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
