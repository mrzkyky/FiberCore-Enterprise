import React, { useMemo } from 'react';
import { Activity, Server, Box, Network, Route, Wifi, HeartPulse, Cpu } from 'lucide-react';
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  
  const healthScore = useMemo(() => {
    if (!stats) return 100;
    let score = 100;
    // Penalty for high avg loss
    if (stats.avg_splice_loss > 0.5) score -= 15;
    else if (stats.avg_splice_loss > 0.2) score -= 5;
    // Penalty if port utilization is 100%
    if (stats.total_ports > 0 && (stats.used_ports / stats.total_ports) > 0.9) score -= 10;
    return Math.max(0, score);
  }, [stats]);

  return (
    <div className="space-y-6 pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
          Command Center
        </h1>
        <p className="text-dark-muted mt-1">Live FTTH Network Overview & Telemetry</p>
      </div>

      {/* Top KPI Cards (Glassmorphism) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: 'Network Health', value: `${healthScore}%`, icon: HeartPulse, color: healthScore > 80 ? 'text-emerald-400' : 'text-yellow-400', glow: healthScore > 80 ? 'shadow-emerald-500/20' : 'shadow-yellow-500/20' },
          { label: 'Avg Splice Loss', value: `${stats?.avg_splice_loss || 0} dB`, icon: Activity, color: 'text-indigo-400', glow: 'shadow-indigo-500/20' },
          { label: 'Cables / Routes', value: stats?.cables, icon: Route, color: 'text-blue-400', glow: 'shadow-blue-500/20' },
          { label: 'Total Spliced', value: stats?.splices, icon: Network, color: 'text-purple-400', glow: 'shadow-purple-500/20' },
          { label: 'Nodes & Devices', value: stats?.devices, icon: Box, color: 'text-orange-400', glow: 'shadow-orange-500/20' },
          { label: 'Total PoPs', value: stats?.pops, icon: Server, color: 'text-teal-400', glow: 'shadow-teal-500/20' },
          { label: 'Total Cores', value: stats?.total_cores, icon: Cpu, color: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
          { label: 'ODP Ports', value: `${stats?.used_ports || 0} / ${stats?.total_ports || 0}`, icon: Wifi, color: 'text-pink-400', glow: 'shadow-pink-500/20' },
        ].map((stat, i) => (
          <div key={i} className={`bg-dark-surface border border-dark-border rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 shadow-lg ${stat.glow} hover:shadow-xl hover:border-gray-700 relative overflow-hidden group`}>
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity blur-2xl`}></div>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-xl bg-black/40 border border-white/5 ${stat.color}`}>
                <stat.icon size={22} strokeWidth={2} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-white tracking-tight">{isLoading ? '...' : stat.value || 0}</p>
              <p className="text-gray-400 text-xs font-semibold uppercase mt-1 tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        {/* Left Section: Core Status */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl flex flex-col shadow-lg relative overflow-hidden">
          <div className="px-6 py-5 border-b border-dark-border bg-black/20">
            <h3 className="font-semibold text-gray-200 tracking-wide flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div> Core Utilization
            </h3>
          </div>
          <div className="flex-1 p-4 pb-8">
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
                    stroke="none"
                  >
                    {(stats?.core_status || []).map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#94a3b8' }}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Section: Device/Cable Types Bar Chart */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl flex flex-col shadow-lg relative overflow-hidden">
          <div className="px-6 py-5 border-b border-dark-border bg-black/20">
            <h3 className="font-semibold text-gray-200 tracking-wide flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div> Infrastructure Composition
            </h3>
          </div>
          <div className="flex-1 p-6">
            {isLoading ? (
               <div className="h-full flex items-center justify-center text-dark-muted">Memuat grafik...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.cable_types || []}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    cursor={{fill: '#1e293b'}} 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  />
                  <Bar dataKey="value" fill="url(#colorUv)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
