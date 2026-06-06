import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Box, Plus, Loader2, Layers } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../store/useAuthStore';
import Modal from '../components/Modal';

const cableSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.string().min(1, "Type is required"),
  capacity: z.preprocess((val) => Number(val), z.number().min(1, "Capacity must be at least 1 core")),
});

type CableFormData = z.infer<typeof cableSchema>;

interface Cable {
  id: string;
  name: string;
  type: string;
  capacity: number;
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
  const [selectedCable, setSelectedCable] = useState<Cable | null>(null);

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

  const openModal = (cable?: Cable) => {
    if (cable) {
      setEditingId(cable.id);
      setValue('name', cable.name);
      setValue('type', cable.type);
      setValue('capacity', cable.capacity);
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

  const onSubmit = (data: CableFormData) => {
    mutation.mutate(data);
  };

  // Helper mapping fiber colors
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
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Box className="text-primary" />
            Cables & Cores
          </h2>
          <p className="text-dark-muted text-sm mt-1">Manage physical fiber cables and internal cores</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} /> Add Cable
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Cable Inventory</h3>
          {isLoading ? (
            <div className="flex justify-center p-8 text-primary">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : error ? (
            <div className="text-danger p-4 text-center">Failed to load cables.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-border text-dark-muted text-sm">
                    <th className="pb-3 px-4 font-medium">Cable Name</th>
                    <th className="pb-3 px-4 font-medium">Type</th>
                    <th className="pb-3 px-4 font-medium">Capacity</th>
                    <th className="pb-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-white text-sm">
                  {cables?.map((cable) => (
                    <tr 
                      key={cable.id} 
                      className={`border-b border-dark-border/50 hover:bg-white/5 transition-colors cursor-pointer ${selectedCable?.id === cable.id ? 'bg-primary/10' : ''}`}
                      onClick={() => setSelectedCable(cable)}
                    >
                      <td className="py-4 px-4 font-medium text-primary">{cable.name}</td>
                      <td className="py-4 px-4">{cable.type}</td>
                      <td className="py-4 px-4 font-mono">{cable.capacity} Cores</td>
                      <td className="py-4 px-4 text-right">
                        <button onClick={(e) => { e.stopPropagation(); openModal(cable); }} className="text-primary hover:underline text-xs mr-3">Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(cable.id); }} className="text-danger hover:underline text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {cables?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-dark-muted">
                        No cables found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Layers size={20} className="text-accent" />
            Core Management
          </h3>
          {!selectedCable ? (
            <div className="text-center py-12 text-dark-muted border border-dashed border-dark-border rounded-lg">
              <p>Select a cable to view its cores</p>
            </div>
          ) : isLoadingCores ? (
             <div className="flex justify-center p-8 text-primary">
               <Loader2 className="animate-spin" size={32} />
             </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-dark-bg rounded-lg border border-dark-border">
                <p className="text-sm text-dark-muted">Viewing Cores for</p>
                <p className="font-semibold text-white">{selectedCable.name}</p>
              </div>
              
              <div className="grid grid-cols-6 gap-2">
                {cores?.map(core => (
                  <div 
                    key={core.id} 
                    className={`h-8 w-full rounded shadow-sm flex items-center justify-center text-xs font-bold ${getTailwindColor(core.color)}`}
                    title={`Tube ${core.tube_number} | Core ${core.core_number} | ${core.color} | ${core.status}`}
                  >
                    {core.core_number}
                  </div>
                ))}
              </div>
              <p className="text-xs text-dark-muted text-center pt-2">Hover over a core to see details.</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Edit Cable" : "Add Cable"}>
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Cable Name</label>
            <input 
              {...register('name')} 
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
              placeholder="e.g. Feeder-01-JKT"
            />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">Type</label>
              <select 
                {...register('type')} 
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
              >
                <option value="">Select Type</option>
                <option value="Backbone">Backbone</option>
                <option value="Feeder">Feeder</option>
                <option value="Distribution">Distribution</option>
                <option value="Drop">Drop</option>
              </select>
              {errors.type && <p className="text-danger text-xs mt-1">{errors.type.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">Capacity (Cores)</label>
              <select 
                {...register('capacity')} 
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
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
              {errors.capacity && <p className="text-danger text-xs mt-1">{errors.capacity.message}</p>}
              {editingId && <p className="text-accent text-[10px] mt-1">Capacity cannot be changed after creation.</p>}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-dark-muted hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
