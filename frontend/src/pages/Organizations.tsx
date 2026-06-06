import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface Organization {
  id: string;
  name: string;
  level: string;
  parent_id?: string;
}

export default function Organizations() {
  const token = useAuthStore(state => state.token);

  const { data: organizations, isLoading, error } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await axios.get<Organization[]>('/api/v1/organizations/', {
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
            <Building2 className="text-primary" />
            Organizations
          </h2>
          <p className="text-dark-muted text-sm mt-1">Manage headquarters, branches, and units</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-dark-bg font-semibold hover:bg-primary/90 transition-colors">
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
              <tbody className="text-white text-sm">
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
                      <button className="text-primary hover:underline text-xs mr-3">Edit</button>
                      <button className="text-danger hover:underline text-xs">Delete</button>
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
    </div>
  );
}
