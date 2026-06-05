import React from 'react';
import { Activity, Server, Box, Users } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Network Overview</h1>
        <p className="text-dark-muted">Real-time status of FiberCore infrastructure.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active POPs', value: '12', icon: Server, color: 'text-primary' },
          { label: 'Total Cables', value: '1,248 km', icon: Box, color: 'text-accent' },
          { label: 'Splicing Accuracy', value: '99.8%', icon: Activity, color: 'text-primary' },
          { label: 'Field Engineers', value: '24', icon: Users, color: 'text-dark-muted' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-6 flex items-start justify-between">
            <div>
              <p className="text-dark-muted text-sm font-mono">{stat.label}</p>
              <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-dark-bg border border-dark-border ${stat.color}`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Graph/Map Area Placeholder */}
      <div className="glass-panel p-6 h-[500px] flex flex-col items-center justify-center border-dashed border-dark-border/50">
        <Activity size={48} className="text-dark-muted mb-4 opacity-50" />
        <p className="text-dark-muted font-mono tracking-widest uppercase">Map Visualization Engine Offline</p>
        <p className="text-xs text-dark-muted mt-2">Awaiting GIS Module Integration in Next Deployment...</p>
      </div>
    </div>
  );
}
