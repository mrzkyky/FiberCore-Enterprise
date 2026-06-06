import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface PoP {
  id: string;
  name: string;
  org_id: string;
  location?: string;
}

export default function PoPs() {
  const token = useAuthStore(state => state.token);

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
        <button className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors">
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
                      <button className="text-primary hover:underline text-xs mr-3">Edit</button>
                      <button className="text-danger hover:underline text-xs">Delete</button>
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
    </div>
  );
}
