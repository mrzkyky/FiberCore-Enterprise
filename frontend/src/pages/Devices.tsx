import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Server, Plus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../store/useAuthStore';
import Modal from '../components/Modal';

const deviceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  device_type: z.string().min(1, "Device Type is required"),
  pop_id: z.string().uuid("Invalid PoP ID").optional().or(z.literal('')),
  capacity: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(0, "Capacity must be positive").optional()),
  brand: z.string().optional()
});

type DeviceFormData = z.infer<typeof deviceSchema>;

interface Device {
  id: string;
  name: string;
  device_type: string;
  pop_id?: string;
  capacity?: number;
  brand?: string;
}

export default function Devices() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<DeviceFormData>({
    // @ts-expect-error Zod resolver type mismatch with react-hook-form
    resolver: zodResolver(deviceSchema)
  });

  const { data: devices, isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await axios.get<Device[]>('/api/v1/devices/', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const { data: pops } = useQuery({
    queryKey: ['pops'],
    queryFn: async () => {
      const response = await axios.get<any[]>('/api/v1/pops/', {
        
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: DeviceFormData) => {
      const payload = { ...data, pop_id: data.pop_id || null };
      if (editingId) {
        return axios.put(`/api/v1/devices/${editingId}`, payload, {
          
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      return axios.post('/api/v1/devices/', payload, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      closeModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return axios.delete(`/api/v1/devices/${id}`, {
        
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }
  });

  const openModal = (device?: Device) => {
    if (device) {
      setEditingId(device.id);
      setValue('name', device.name);
      setValue('device_type', device.device_type);
      setValue('pop_id', device.pop_id || '');
      setValue('capacity', device.capacity || 0);
      setValue('brand', device.brand || '');
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

  const onSubmit = (data: DeviceFormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <Server className="text-primary" />
            Devices & Assets
          </h2>
          <p className="text-dark-muted text-sm mt-1">Manage OLT, OTB, ODP, and Closures</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} /> Tambah Perangkat
        </button>
      </div>

      <div className="glass-panel p-6">
        {isLoading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : error ? (
          <div className="text-danger p-4 text-center">Failed to load devices.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dark-border text-dark-muted text-sm">
                  <th className="pb-3 px-4 font-medium">Name</th>
                  <th className="pb-3 px-4 font-medium">Type</th>
                  <th className="pb-3 px-4 font-medium">Brand</th>
                  <th className="pb-3 px-4 font-medium">Capacity</th>
                  <th className="pb-3 px-4 font-medium">PoP ID</th>
                  <th className="pb-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-dark-text text-sm">
                {devices?.map((dev) => (
                  <tr key={dev.id} className="border-b border-dark-border/50 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4 font-medium">{dev.name}</td>
                    <td className="py-4 px-4 text-primary font-mono text-xs">{dev.device_type}</td>
                    <td className="py-4 px-4">{dev.brand || '-'}</td>
                    <td className="py-4 px-4">{dev.capacity ? `${dev.capacity} ports` : '-'}</td>
                    <td className="py-4 px-4 font-mono text-xs text-dark-muted">{dev.pop_id || '-'}</td>
                    <td className="py-4 px-4 text-right">
                      <button onClick={() => openModal(dev)} className="text-primary hover:underline text-xs mr-3">Edit</button>
                      <button onClick={() => deleteMutation.mutate(dev.id)} className="text-danger hover:underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
                {devices?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-dark-muted">
                      No devices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Edit Device" : "Tambah Perangkat"}>
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Device Name</label>
            <input 
              {...register('name')} 
              className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
              placeholder="e.g. OLT ZTE C320"
            />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">Device Type</label>
              <select 
                {...register('device_type')} 
                className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
              >
                <option value="">Select Type</option>
                <option value="OLT">OLT</option>
                <option value="OTB">OTB</option>
                <option value="ODP">ODP</option>
                <option value="Closure">Closure</option>
              </select>
              {errors.device_type && <p className="text-danger text-xs mt-1">{errors.device_type.message}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">Brand</label>
              <input 
                {...register('brand')} 
                className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
                placeholder="e.g. ZTE, Huawei"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">PoP Location</label>
              <select 
                {...register('pop_id')} 
                className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
              >
                <option value="">None / Field Area</option>
                {pops?.map(pop => (
                  <option key={pop.id} value={pop.id}>{pop.name}</option>
                ))}
              </select>
              {errors.pop_id && <p className="text-danger text-xs mt-1">{errors.pop_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">Capacity (Ports/Trays)</label>
              <input 
                type="number"
                {...register('capacity')} 
                className="w-full bg-white border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
                placeholder="e.g. 16"
              />
              {errors.capacity && <p className="text-danger text-xs mt-1">{errors.capacity.message}</p>}
            </div>
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
