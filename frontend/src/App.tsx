import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import { useAuthStore } from './store/useAuthStore';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated());
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes inside Layout */}
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<div className="text-white p-4">GIS Map Engine Module...</div>} />
          <Route path="assets" element={<div className="text-white p-4">Assets Inventory Module...</div>} />
          <Route path="cables" element={<div className="text-white p-4">Cables & Splicing Module...</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
