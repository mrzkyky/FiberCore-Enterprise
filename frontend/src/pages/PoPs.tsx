import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../store/useAuthStore';
import Modal from '../components/Modal';

const popSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  org_id: z.string().uuid("Invalid Organization ID"),
  location: z.string().optional(),
});

type PopFormData = z.infer<typeof popSchema>;

interface PoP {
  id: string;
  name: string;
  org_id: string;
  location?: string;
}

export default function PoPs() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<PopFormData>({
    resolver: zodResolver(popSchema)
  });

  const { data: pops, isLoading, error } = useQuery({
    queryKey: ['pops'],
    queryFn: async () => {
      const response = await axios.get<PoP[]>('/api/v1/pops/', {
        baseURL: import.meta.env.VITE_API_URL,
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await axios.get<any[]>('/api/v1/organizations/', {
        baseURL: import.meta.env.VITE_API_URL,
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: PopFormData) => {
      if (editingId) {
        return axios.put(`/api/v1/pops/${editingId}`, data, {
          baseURL: import.meta.env.VITE_API_URL,
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      return axios.post('/api/v1/pops/', data, {
        baseURL: import.meta.env.VITE_API_URL,
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pops'] });
      closeModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return axios.delete(`/api/v1/pops/${id}`, {
        baseURL: import.meta.env.VITE_API_URL,
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pops'] });
    }
  });

  const openModal = (pop?: PoP) => {
    if (pop) {
      setEditingId(pop.id);
      setValue('name', pop.name);
      setValue('org_id', pop.org_id);
      setValue('location', pop.location || '');
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

  const onSubmit = (data: PopFormData) => {
    // Convert generic Lat,Lng to PostGIS POINT(lon lat)
    let finalLocation = data.location;
    if (finalLocation && typeof finalLocation === 'string' && !finalLocation.startsWith('POINT')) {
      const parts = finalLocation.replace(/[^\d.,-]/g, '').split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          finalLocation = `POINT(${lng} ${lat})`;
        }
      }
    }
    
    mutation.mutate({ ...data, location: finalLocation });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="text-primary" />
            Point of Presence (PoP)
          </h2>
          <p className="text-dark-muted text-sm mt-1">Manage network sites and data centers</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} /> Add PoP
        </button>
      </div>

      <div className="glass-panel p-6">
        {isLoading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : error ? (
          <div className="text-danger p-4 text-center">Failed to load PoPs.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dark-border text-dark-muted text-sm">
                  <th className="pb-3 px-4 font-medium">Name</th>
                  <th className="pb-3 px-4 font-medium">Organization ID</th>
                  <th className="pb-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-white text-sm">
                {pops?.map((pop) => (
                  <tr key={pop.id} className="border-b border-dark-border/50 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4 font-medium flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent"></div>
                      {pop.name}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-dark-muted">{pop.org_id}</td>
                    <td className="py-4 px-4 text-right">
                      <button onClick={() => openModal(pop)} className="text-primary hover:underline text-xs mr-3">Edit</button>
                      <button onClick={() => deleteMutation.mutate(pop.id)} className="text-danger hover:underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
                {pops?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-dark-muted">
                      No PoPs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Edit PoP" : "Add PoP"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">PoP Name</label>
            <input 
              {...register('name')} 
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
              placeholder="e.g. PoP Sudirman"
            />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Organization</label>
            <select 
              {...register('org_id')} 
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
            >
              <option value="">Select Organization</option>
              {organizations?.map(org => (
                <option key={org.id} value={org.id}>{org.name} ({org.level})</option>
              ))}
            </select>
            {errors.org_id && <p className="text-danger text-xs mt-1">{errors.org_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Location / Coordinates</label>
            <input 
              {...register('location')} 
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
              placeholder="e.g. -6.882452, 109.054952 (Decimal Degrees)"
            />
            {errors.location && <p className="text-danger text-xs mt-1">{errors.location.message}</p>}
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
