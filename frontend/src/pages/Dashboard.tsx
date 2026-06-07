import React from 'react';
import { Activity, Server, Box, Network, Route } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const token = useAuthStore(state => state.token);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await axios.get('/api/v1/analytics/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
  });

  const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-text">Dashboard Utilisasi Jaringan</h1>
        <p className="text-dark-muted">Pantau kapasitas kabel FO, status core, dan perangkat secara real-time.</p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Data Kabel FO', value: isLoading ? '...' : stats?.cables || 0, icon: Route, color: 'text-primary', bg: 'bg-accent' },
          { label: 'Perangkat ODP/ODC', value: isLoading ? '...' : stats?.devices || 0, icon: Box, color: 'text-orange', bg: 'bg-orange-light/20' },
          { label: 'Total STO / PoP', value: isLoading ? '...' : stats?.pops || 0, icon: Server, color: 'text-primary', bg: 'bg-accent' },
          { label: 'Total Penyambungan', value: isLoading ? '...' : stats?.splices || 0, icon: Network, color: 'text-success', bg: 'bg-success/20' },
          { label: 'Kapasitas Core', value: isLoading ? '...' : stats?.total_cores || 0, icon: Activity, color: 'text-warning', bg: 'bg-warning/20' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-dark-border rounded-xl p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform cursor-default shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-dark-text">{stat.value}</p>
              <p className="text-dark-muted text-xs font-medium uppercase mt-1 tracking-wide">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        {/* Left Section: Core Status Pie Chart */}
        <div className="bg-white border border-dark-border rounded-xl flex flex-col shadow-sm">
          <div className="px-5 py-4 border-b border-dark-border bg-white rounded-t-xl">
            <h3 className="font-bold text-dark-text">Distribusi Status Core</h3>
          </div>
          <div className="flex-1 p-4">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-dark-muted">Memuat grafik...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.core_status || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(stats?.core_status || []).map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Section: Device/Cable Types Bar Chart */}
        <div className="bg-white border border-dark-border rounded-xl flex flex-col shadow-sm">
          <div className="px-5 py-4 border-b border-dark-border bg-white rounded-t-xl">
            <h3 className="font-bold text-dark-text">Kabel FO Berdasarkan Tipe</h3>
          </div>
          <div className="flex-1 p-4">
            {isLoading ? (
               <div className="h-full flex items-center justify-center text-dark-muted">Memuat grafik...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.cable_types || []}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
