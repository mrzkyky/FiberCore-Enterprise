import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Network, Plus, Loader2, Cable, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import Modal from '../components/Modal';

interface Device {
  id: string;
  name: string;
  device_type: string;
}

interface CableType {
  id: string;
  name: string;
}

interface CoreType {
  id: string;
  core_number: number;
  tube_number: number;
  color: string;
  status: string;
}

interface SpliceRecord {
  id: string;
  core_a_id: string;
  core_b_id: string;
  closure_id: string;
  attenuation: number;
}

export default function Splicing() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  const [selectedClosureId, setSelectedClosureId] = useState<string>('');
  const [isSpliceModalOpen, setIsSpliceModalOpen] = useState(false);

  // Form State
  const [cableInId, setCableInId] = useState<string>('');
  const [cableOutId, setCableOutId] = useState<string>('');
  const [coreInId, setCoreInId] = useState<string>('');
  const [coreOutId, setCoreOutId] = useState<string>('');
  const [attenuation, setAttenuation] = useState<number>(0);

  // Queries
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await axios.get<Device[]>('/api/v1/devices/', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.filter(d => ['Closure', 'ODP', 'OTB'].includes(d.device_type));
    }
  });

  const { data: cables } = useQuery({
    queryKey: ['cables'],
    queryFn: async () => {
      const response = await axios.get<CableType[]>('/api/v1/cables/', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const { data: coresIn } = useQuery({
    queryKey: ['cores', cableInId],
    queryFn: async () => {
      if (!cableInId) return [];
      const response = await axios.get<CoreType[]>(`/api/v1/cables/${cableInId}/cores`, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!cableInId
  });

  const { data: coresOut } = useQuery({
    queryKey: ['cores', cableOutId],
    queryFn: async () => {
      if (!cableOutId) return [];
      const response = await axios.get<CoreType[]>(`/api/v1/cables/${cableOutId}/cores`, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!cableOutId
  });

  const { data: matrixData, isLoading: isLoadingSplices } = useQuery({
    queryKey: ['splices', selectedClosureId],
    queryFn: async () => {
      if (!selectedClosureId) return null;
      const response = await axios.get(`/api/v1/splices/matrix/${selectedClosureId}`, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!selectedClosureId
  });

  const splices = matrixData?.splices || [];
  const analytics = matrixData?.analytics;

  // Mutations
  const spliceMutation = useMutation({
    mutationFn: async () => {
      return axios.post('/api/v1/splices/', {
        core_a_id: coreInId,
        core_b_id: coreOutId,
        closure_id: selectedClosureId,
        attenuation: attenuation
      }, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splices', selectedClosureId] });
      queryClient.invalidateQueries({ queryKey: ['cores'] });
      setIsSpliceModalOpen(false);
      resetForm();
    }
  });

  const deleteSpliceMutation = useMutation({
    mutationFn: async (id: string) => {
      return axios.delete(`/api/v1/splices/${id}`, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splices', selectedClosureId] });
      queryClient.invalidateQueries({ queryKey: ['cores'] });
    }
  });

  const resetForm = () => {
    setCableInId('');
    setCableOutId('');
    setCoreInId('');
    setCoreOutId('');
    setAttenuation(0);
  };

  const getTailwindColor = (color: string) => {
    const map: Record<string, string> = {
      Blue: 'bg-blue-500', Orange: 'bg-orange-500', Green: 'bg-green-500',
      Brown: 'bg-amber-800', Slate: 'bg-slate-400', White: 'bg-white text-black',
      Red: 'bg-red-500', Black: 'bg-black border border-gray-600', Yellow: 'bg-yellow-400 text-black',
      Violet: 'bg-purple-500', Rose: 'bg-pink-400', Aqua: 'bg-teal-300 text-black'
    };
    return map[color] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <Network className="text-primary" />
            Manajemen Penyambungan (Splicing)
          </h2>
          <p className="text-dark-muted text-sm mt-1">Kelola penyambungan antar core kabel di dalam perangkat (Closure/ODP/OTB)</p>
        </div>
      </div>

      <div className="bg-white border border-dark-border rounded-xl p-6 mb-6 shadow-sm">
        <label className="block text-sm font-medium text-dark-muted mb-2">Pilih Perangkat (Closure / ODP / OTB) untuk mengelola splicing</label>
        <select 
          value={selectedClosureId}
          onChange={(e) => setSelectedClosureId(e.target.value)}
          className="w-full md:w-1/2 bg-white border border-dark-border rounded-lg px-4 py-3 text-dark-text focus:outline-none focus:border-primary text-lg"
        >
          <option value="">-- Pilih Perangkat --</option>
          {devices?.map(d => (
            <option key={d.id} value={d.id}>{d.name} ({d.device_type})</option>
          ))}
        </select>
      </div>

      {selectedClosureId && (
        <div className="bg-white border border-dark-border rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-dark-text flex items-center gap-2">
              <Cable className="text-primary" />
              Data Penyambungan
            </h3>
            <button 
              onClick={() => setIsSpliceModalOpen(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={18} /> Penyambungan Baru
            </button>
          </div>

          {/* Closure Analytics Summary */}
          {analytics && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-dark-surface p-4 rounded-lg border border-dark-border text-center">
                <p className="text-dark-muted text-xs uppercase font-semibold mb-1">Kabel Tersambung</p>
                <p className="text-2xl font-bold text-primary">{analytics.total_cables_connected}</p>
              </div>
              <div className="bg-dark-surface p-4 rounded-lg border border-dark-border text-center">
                <p className="text-dark-muted text-xs uppercase font-semibold mb-1">Core Di-Splice</p>
                <p className="text-2xl font-bold text-accent">{analytics.total_spliced_cores}</p>
              </div>
              <div className="bg-dark-surface p-4 rounded-lg border border-dark-border text-center">
                <p className="text-dark-muted text-xs uppercase font-semibold mb-1">Sisa Core (Free)</p>
                <p className="text-2xl font-bold text-success">{analytics.total_free_cores}</p>
              </div>
            </div>
          )}

          {isLoadingSplices ? (
             <div className="flex justify-center p-8 text-primary">
               <Loader2 className="animate-spin" size={32} />
             </div>
          ) : splices?.length === 0 ? (
            <div className="text-center py-12 text-dark-muted border border-dashed border-dark-border rounded-lg">
              <p>Belum ada data penyambungan di perangkat ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-border text-dark-muted text-sm">
                    <th className="pb-3 px-4 font-medium">Core A</th>
                    <th className="pb-3 px-4 font-medium">Core B</th>
                    <th className="pb-3 px-4 font-medium">Loss (dB)</th>
                    <th className="pb-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-dark-text text-sm font-mono">
                  {splices?.map((splice: any) => (
                    <tr key={splice.splice_id} className="border-b border-dark-border/50 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                           <span className={`inline-block w-3 h-3 rounded-full ${getTailwindColor(splice.core_a.color)}`}></span>
                           <span>Tube {splice.core_a.tube_number} - Core {splice.core_a.core_number}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                           <span className={`inline-block w-3 h-3 rounded-full ${getTailwindColor(splice.core_b.color)}`}></span>
                           <span>Tube {splice.core_b.tube_number} - Core {splice.core_b.core_number}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">{splice.attenuation} dB</td>
                      <td className="py-4 px-4 text-right">
                        <button 
                          onClick={() => deleteSpliceMutation.mutate(splice.splice_id)} 
                          className="text-danger hover:text-red-400 p-1"
                          title="Delete Splice (Unsplice)"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isSpliceModalOpen} onClose={() => setIsSpliceModalOpen(false)} title="New Splice Connection">
        <div className="space-y-6">
          
          <div className="grid grid-cols-2 gap-6">
            {/* Cable IN Selection */}
            <div className="p-4 bg-white border border-dark-border rounded-lg space-y-4">
              <h4 className="font-semibold text-primary">Cable IN (Source)</h4>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Select Cable</label>
                <select 
                  value={cableInId} onChange={e => {setCableInId(e.target.value); setCoreInId('');}}
                  className="w-full bg-white border border-dark-border rounded px-3 py-2 text-dark-text text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">- Choose Cable -</option>
                  {cables?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Select Core</label>
                <select 
                  value={coreInId} onChange={e => setCoreInId(e.target.value)}
                  className="w-full bg-white border border-dark-border rounded px-3 py-2 text-dark-text text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">- Choose Free Core -</option>
                  {coresIn?.filter(c => c.status === 'Free').map(core => (
                    <option key={core.id} value={core.id}>Tube {core.tube_number} - Core {core.core_number} ({core.color})</option>
                  ))}
                </select>
                {coreInId && (
                  <div className="mt-2 text-xs text-dark-text">
                    Selected Core Color:{' '}
                    <span className={`inline-block w-3 h-3 rounded-full ml-1 ${getTailwindColor(coresIn?.find(c=>c.id===coreInId)?.color || '')}`}></span>
                  </div>
                )}
              </div>
            </div>

            {/* Cable OUT Selection */}
            <div className="p-4 bg-white border border-dark-border rounded-lg space-y-4">
              <h4 className="font-semibold text-accent">Cable OUT (Destination)</h4>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Select Cable</label>
                <select 
                  value={cableOutId} onChange={e => {setCableOutId(e.target.value); setCoreOutId('');}}
                  className="w-full bg-white border border-dark-border rounded px-3 py-2 text-dark-text text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">- Choose Cable -</option>
                  {cables?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">Select Core</label>
                <select 
                  value={coreOutId} onChange={e => setCoreOutId(e.target.value)}
                  className="w-full bg-white border border-dark-border rounded px-3 py-2 text-dark-text text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">- Choose Free Core -</option>
                  {coresOut?.filter(c => c.status === 'Free').map(core => (
                    <option key={core.id} value={core.id}>Tube {core.tube_number} - Core {core.core_number} ({core.color})</option>
                  ))}
                </select>
                {coreOutId && (
                  <div className="mt-2 text-xs text-dark-text">
                    Selected Core Color:{' '}
                    <span className={`inline-block w-3 h-3 rounded-full ml-1 ${getTailwindColor(coresOut?.find(c=>c.id===coreOutId)?.color || '')}`}></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-dark-border rounded-lg">
             <label className="block text-xs text-dark-muted mb-1">Attenuation / Splice Loss (dB)</label>
             <input 
                type="number" step="0.01" value={attenuation} onChange={e => setAttenuation(parseFloat(e.target.value))}
                className="w-full md:w-1/3 bg-white border border-dark-border rounded px-3 py-2 text-dark-text text-sm focus:border-primary focus:outline-none"
             />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button onClick={() => setIsSpliceModalOpen(false)} className="px-4 py-2 rounded-lg text-dark-muted hover:text-primary transition-colors">
              Cancel
            </button>
            <button 
              onClick={() => spliceMutation.mutate()} 
              disabled={spliceMutation.isPending || !coreInId || !coreOutId} 
              className="px-6 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {spliceMutation.isPending ? 'Splicing...' : 'Perform Splice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
