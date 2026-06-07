import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../store/useAuthStore';
import Modal from '../components/Modal';

const orgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  level: z.string().min(1, "Level is required"),
  parent_id: z.string().uuid("Invalid Parent ID").optional().or(z.literal('')),
});

type OrgFormData = z.infer<typeof orgSchema>;

interface Organization {
  id: string;
  name: string;
  level: string;
  parent_id?: string;
}

export default function Organizations() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema)
  });

  const { data: organizations, isLoading, error } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await axios.get<Organization[]>('/api/v1/organizations/', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: OrgFormData) => {
      const payload = { ...data, parent_id: data.parent_id || null };
      if (editingId) {
        return axios.put(`/api/v1/organizations/${editingId}`, payload, {
          
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      return axios.post('/api/v1/organizations/', payload, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      closeModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return axios.delete(`/api/v1/organizations/${id}`, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  });

  const openModal = (org?: Organization) => {
    if (org) {
      setEditingId(org.id);
      setValue('name', org.name);
      setValue('level', org.level);
      setValue('parent_id', org.parent_id || '');
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

  const onSubmit = (data: OrgFormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <Building2 className="text-primary" />
            Organizations
          </h2>
          <p className="text-dark-muted text-sm mt-1">Manage headquarters, branches, and units</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} /> Add Organization
        </button>
      </div>

      <div className="glass-panel p-6">
        {isLoading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : error ? (
          <div className="text-danger p-4 text-center">Failed to load organizations.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dark-border text-dark-muted text-sm">
                  <th className="pb-3 px-4 font-medium">Name</th>
                  <th className="pb-3 px-4 font-medium">Level</th>
                  <th className="pb-3 px-4 font-medium">Parent</th>
                  <th className="pb-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-dark-text text-sm">
                {organizations?.map((org) => (
                  <tr key={org.id} className="border-b border-dark-border/50 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4 font-medium">{org.name}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-dark-border text-xs rounded-full font-mono text-accent">
                        {org.level}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-dark-muted">
                      {org.parent_id ? organizations.find(o => o.id === org.parent_id)?.name || org.parent_id : '-'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button onClick={() => openModal(org)} className="text-primary hover:underline text-xs mr-3">Edit</button>
                      <button onClick={() => deleteMutation.mutate(org.id)} className="text-danger hover:underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
                {organizations?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-dark-muted">
                      No organizations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Edit Organization" : "Add Organization"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Organization Name</label>
            <input 
              {...register('name')} 
              className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
              placeholder="e.g. Headquarter Jakarta"
            />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Level</label>
            <select 
              {...register('level')} 
              className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
            >
              <option value="">Select Level</option>
              <option value="Region">Region</option>
              <option value="Branch">Branch</option>
              <option value="Unit">Unit</option>
              <option value="Cluster">Cluster</option>
            </select>
            {errors.level && <p className="text-danger text-xs mt-1">{errors.level.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Parent Organization</label>
            <select 
              {...register('parent_id')} 
              className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
            >
              <option value="">None (Top Level)</option>
              {organizations?.filter(o => o.id !== editingId).map(org => (
                <option key={org.id} value={org.id}>{org.name} ({org.level})</option>
              ))}
            </select>
            {errors.parent_id && <p className="text-danger text-xs mt-1">{errors.parent_id.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-dark-muted hover:text-primary transition-colors">
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
