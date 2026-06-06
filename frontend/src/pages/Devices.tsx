import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Server, Plus, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  pop_id?: string;
}

export default function Devices() {
  const token = useAuthStore(state => state.token);

  const { data: devices, isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await axios.get<Device[]>('/api/v1/devices/', {
        baseURL: import.meta.env.VITE_API_URL,
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-accent/20 text-accent border border-accent/50';
      case 'inactive': return 'bg-dark-muted/20 text-dark-muted border border-dark-muted/50';
      case 'maintenance': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50';
      case 'error': return 'bg-danger/20 text-danger border border-danger/50';
      default: return 'bg-dark-border text-white';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="text-primary" />
            Devices & Assets
          </h2>
          <p className="text-dark-muted text-sm mt-1">Manage OLT, OTB, ODP, and Closures</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors">
          <Plus size={18} /> Add Device
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
                  <th className="pb-3 px-4 font-medium">Status</th>
                  <th className="pb-3 px-4 font-medium">PoP ID</th>
                  <th className="pb-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-white text-sm">
                {devices?.map((dev) => (
                  <tr key={dev.id} className="border-b border-dark-border/50 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4 font-medium">{dev.name}</td>
                    <td className="py-4 px-4 text-primary font-mono text-xs">{dev.type}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(dev.status)}`}>
                        {dev.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-dark-muted">{dev.pop_id || '-'}</td>
                    <td className="py-4 px-4 text-right">
                      <button className="text-primary hover:underline text-xs mr-3">Edit</button>
                      <button className="text-danger hover:underline text-xs">Delete</button>
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
    </div>
  );
}
