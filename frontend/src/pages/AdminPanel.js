import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Shield, ArrowLeft, Plus, Pencil, Trash2, Save, X, History, Mail, Copy, Check } from 'lucide-react';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { officers, addOfficer, updateOfficer, deleteOfficer, versionLogs, fetchVersionLogs } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    last_name: '',
    first_name: '',
    star: '',
    seniority_date: ''
  });

  const shareUrl = window.location.origin;

  useEffect(() => {
    fetchVersionLogs();
  }, [fetchVersionLogs]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent('Unit 214 Overtime Roster - Sign Up Link');
    const body = encodeURIComponent(`You are invited to sign up for overtime.\n\nClick the link below to access the OT Roster:\n${shareUrl}\n\nPlease select your name from the dropdown or type your name manually.\n\nThank you.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateOfficer(editingId, formData);
        setEditingId(null);
      } else {
        await addOfficer(formData);
        setShowAddForm(false);
      }
      setFormData({ last_name: '', first_name: '', star: '', seniority_date: '' });
      await fetchVersionLogs();
    } catch (error) {
      alert('Error saving officer');
    }
  };

  const handleEdit = (officer) => {
    setEditingId(officer.id);
    setFormData({
      last_name: officer.last_name,
      first_name: officer.first_name,
      star: officer.star,
      seniority_date: officer.seniority_date
    });
    setShowAddForm(false);
  };

  const handleDelete = async (officerId) => {
    if (window.confirm('Are you sure you want to delete this officer?')) {
      try {
        await deleteOfficer(officerId);
        await fetchVersionLogs();
      } catch (error) {
        alert('Error deleting officer');
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData({ last_name: '', first_name: '', star: '', seniority_date: '' });
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-panel">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <h1 className="text-xl font-black tracking-tight uppercase font-['Chivo']">
              ADMIN PANEL
            </h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-sm hover:bg-slate-700 transition-colors text-sm"
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Officers List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-sm border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase">
                  Officer Roster
                </h2>
                <button
                  onClick={() => { setShowAddForm(true); setEditingId(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-sm hover:bg-slate-800 transition-colors text-sm"
                  data-testid="add-officer-button"
                >
                  <Plus className="w-4 h-4" />
                  Add Officer
                </button>
              </div>

              {/* Add/Edit Form */}
              {(showAddForm || editingId) && (
                <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border-b border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Last Name</label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm font-mono uppercase"
                        required
                        data-testid="input-last-name"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">First Name</label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm font-mono uppercase"
                        required
                        data-testid="input-first-name"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Star #</label>
                      <input
                        type="text"
                        value={formData.star}
                        onChange={(e) => setFormData({ ...formData, star: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm font-mono"
                        required
                        data-testid="input-star"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Seniority Date</label>
                      <input
                        type="text"
                        value={formData.seniority_date}
                        onChange={(e) => setFormData({ ...formData, seniority_date: e.target.value })}
                        placeholder="MM/DD/YYYY"
                        className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm font-mono"
                        required
                        data-testid="input-seniority"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-sm hover:bg-slate-800 transition-colors text-sm"
                      data-testid="save-officer-button"
                    >
                      <Save className="w-4 h-4" />
                      {editingId ? 'Update' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-sm hover:bg-slate-300 transition-colors text-sm"
                      data-testid="cancel-button"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Officers Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-3 border-b border-slate-200">Last Name</th>
                      <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-3 border-b border-slate-200">First Name</th>
                      <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-3 border-b border-slate-200">Star #</th>
                      <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-3 border-b border-slate-200">Seniority</th>
                      <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-3 border-b border-slate-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officers.map((officer, index) => (
                      <tr key={officer.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} data-testid={`officer-row-${officer.id}`}>
                        <td className="p-3 text-xs font-mono text-slate-900 border-b border-slate-100">{officer.last_name}</td>
                        <td className="p-3 text-xs font-mono text-slate-900 border-b border-slate-100">{officer.first_name}</td>
                        <td className="p-3 text-xs font-mono text-slate-900 border-b border-slate-100">{officer.star}</td>
                        <td className="p-3 text-xs font-mono text-slate-900 border-b border-slate-100">{officer.seniority_date}</td>
                        <td className="p-3 border-b border-slate-100">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(officer)}
                              className="p-1 text-slate-500 hover:text-slate-900 transition-colors"
                              data-testid={`edit-officer-${officer.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(officer.id)}
                              className="p-1 text-red-500 hover:text-red-700 transition-colors"
                              data-testid={`delete-officer-${officer.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                Total Officers: {officers.length}
              </div>
            </div>
          </div>

          {/* Version Log */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-sm border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Change Log
                </h2>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  {showLogs ? 'Hide' : 'Show'}
                </button>
              </div>
              {showLogs && (
                <div className="max-h-96 overflow-y-auto">
                  {versionLogs.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400">No changes logged yet</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {versionLogs.slice(0, 20).map((log) => (
                        <li key={log.id} className="p-3">
                          <div className="text-xs font-mono text-slate-900">{log.notes}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            v{log.version} — {new Date(log.updated_at).toLocaleString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-slate-100 rounded-sm border border-slate-200 p-4 mt-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase mb-2">Admin Info</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use this panel to manage the officer roster. Changes are automatically saved and logged.
                Officers are sorted by seniority date (most senior first).
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
