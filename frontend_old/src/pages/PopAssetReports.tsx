import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, Server, MapPin, Box, GitMerge, Activity, Route } from 'lucide-react';

export default function PopAssetReports() {
  const token = useAuthStore(state => state.token);

  const { data: regionStats, isLoading } = useQuery({
    queryKey: ['region-stats'],
    queryFn: async () => {
      const response = await axios.get('/api/v1/analytics/region-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-dark-text flex items-center gap-2">
          <Server className="text-primary" />
          Laporan Aset per POP / Region
        </h1>
        <p className="text-dark-muted">Ringkasan inventaris tiang, ODP, dan kabel di masing-masing cabang.</p>
      </div>

      <div className="bg-white border border-dark-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-dark-border bg-dark-surface/50">
          <h2 className="font-semibold text-dark-text">Rekapitulasi Aset Wilayah</h2>
        </div>
        
        <div className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-primary" size={40} />
            </div>
          ) : !regionStats || regionStats.length === 0 ? (
            <div className="text-center py-20 text-dark-muted">
              <Server size={48} className="mx-auto mb-4 opacity-20" />
              <p>Belum ada data region yang diunggah.</p>
              <p className="text-sm mt-2">Silakan unggah file KMZ terlebih dahulu.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-dark-surface text-dark-muted border-b border-dark-border">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">POP / Region</th>
                  <th className="px-6 py-4 font-semibold text-center">Tiang (Poles)</th>
                  <th className="px-6 py-4 font-semibold text-center">ODP</th>
                  <th className="px-6 py-4 font-semibold text-center">Joint Closure</th>
                  <th className="px-6 py-4 font-semibold text-center">Joint Box</th>
                  <th className="px-6 py-4 font-semibold text-center">Slack / Oloop</th>
                  <th className="px-6 py-4 font-semibold text-center">Kabel (Routes)</th>
                  <th className="px-6 py-4 font-semibold text-center">Panjang Kabel (km)</th>
                  <th className="px-6 py-4 font-semibold text-center">Lainnya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-dark-text">
                {regionStats.map((stat: any, index: number) => (
                  <tr key={index} className="hover:bg-dark-surface/50 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <MapPin size={16} />
                      </div>
                      {stat.region}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full text-gray-700 font-medium">
                        {stat.pole_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                        {stat.odp_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-medium">
                        {stat.jc_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium">
                        {stat.jb_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full font-medium">
                        {stat.slack_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                        <Route size={14} className="opacity-70" /> {stat.cable_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                        {stat.cable_length_km || 0} km
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-dark-muted font-medium">
                      {stat.other_count || 0}
                    </td>
                  </tr>
                ))}
                
                {/* Total Row */}
                <tr className="bg-dark-surface font-bold">
                  <td className="px-6 py-4 text-right text-dark-text">TOTAL KESELURUHAN:</td>
                  <td className="px-6 py-4 text-center text-gray-800">
                    {regionStats.reduce((acc: number, curr: any) => acc + curr.pole_count, 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-green-800">
                    {regionStats.reduce((acc: number, curr: any) => acc + curr.odp_count, 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-orange-800">
                    {regionStats.reduce((acc: number, curr: any) => acc + (curr.jc_count || 0), 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-amber-800">
                    {regionStats.reduce((acc: number, curr: any) => acc + (curr.jb_count || 0), 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-yellow-800">
                    {regionStats.reduce((acc: number, curr: any) => acc + (curr.slack_count || 0), 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-blue-800">
                    {regionStats.reduce((acc: number, curr: any) => acc + (curr.cable_count || 0), 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-purple-800 font-bold">
                    {regionStats.reduce((acc: number, curr: any) => acc + (curr.cable_length_km || 0), 0).toFixed(2)} km
                  </td>
                  <td className="px-6 py-4 text-center text-dark-muted">
                    {regionStats.reduce((acc: number, curr: any) => acc + (curr.other_count || 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
