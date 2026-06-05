import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Create FormData as OAuth2PasswordRequestForm expects it
      const formData = new FormData();
      formData.append('username', email); // OAuth2 expects 'username' field
      formData.append('password', password);
      
      // Gunakan IP yang sama dengan browser (agar tidak nyasar ke localhost laptop)
      const baseUrl = `http://${window.location.hostname}:50005/api/v1`;
      const response = await axios.post(`${baseUrl}/auth/token`, formData);
      
      const { access_token } = response.data;
      
      // Temporary mock user data until we implement /me endpoint
      const mockUser = {
        id: '1',
        email: email,
        full_name: 'System Admin',
        role: 'Super Admin'
      };
      
      login(access_token, mockUser);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials or backend offline.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-dark-bg relative overflow-hidden">
      {/* Background abstract glowing lines */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px]"></div>
      
      <div className="glass-panel w-full max-w-md p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-dark-bg border border-dark-border shadow-glow-primary flex items-center justify-center mb-4">
            <Activity size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">System Access</h1>
          <p className="text-dark-muted text-sm mt-1">FiberCore Enterprise Network</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs text-dark-muted font-mono uppercase tracking-wider">Operator Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="admin@fibercore.local"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-dark-muted font-mono uppercase tracking-wider">Access Code</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-neon btn-neon-primary py-3 mt-4 flex justify-center items-center"
          >
            {loading ? <span className="animate-pulse">Authenticating...</span> : 'Initialize Connection'}
          </button>
        </form>
      </div>
    </div>
  );
}
