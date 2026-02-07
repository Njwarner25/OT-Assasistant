import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Shield, AlertCircle } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      navigate('/admin');  // Go to Admin panel after login
    } else {
      setError(result.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-sm shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-sm mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase font-['Chivo']">
              OT ROSTER
            </h1>
            <p className="text-sm text-slate-500 mt-2 uppercase tracking-wider">
              Unit 214 Overtime Management
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Enter username"
                data-testid="username-input"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-sm text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Enter password"
                data-testid="password-input"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm" data-testid="error-message">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 text-white font-semibold uppercase tracking-wider rounded-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-button"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Contact your supervisor for access credentials
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
