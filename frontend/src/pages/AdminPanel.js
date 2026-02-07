import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Shield, ArrowLeft, Plus, Pencil, Trash2, Save, X, History, Mail, Copy, Check, AlertTriangle, Bell, CheckCircle, Lock, Send } from 'lucide-react';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { 
    officers, addOfficer, updateOfficer, deleteOfficer, 
    versionLogs, fetchVersionLogs,
    bumpedOfficers, fetchBumpedOfficers, markBumpedNotified, deleteBumpedRecord, clearAllBumped,
    sheets
  } = useApp();
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

  const DAYS = ['friday', 'saturday', 'sunday'];
  const SHEET_TYPES = ['rdo', 'days_ext', 'nights_ext'];
  const TYPE_LABELS = { rdo: 'RDO 2000-0500', days_ext: 'Days EXT 2000-2100', nights_ext: 'Nights EXT 1600-2000' };

  const isSheetLocked = (sheet) => {
    if (!sheet) return false;
    if (sheet.locked) return true;
    if (sheet.auto_lock_enabled && sheet.auto_lock_time && new Date() > new Date(sheet.auto_lock_time)) return true;
    return false;
  };

  const allSheetsLocked = DAYS.every(day =>
    SHEET_TYPES.every(type => isSheetLocked(sheets[day]?.[type]))
  );

  const buildRosterSummary = () => {
    let summary = 'UNIT 214 — OVERTIME ROSTER (COMPLETE)\n';
    summary += '='.repeat(50) + '\n\n';
    for (const day of DAYS) {
      summary += `${day.toUpperCase()}\n`;
      summary += '-'.repeat(50) + '\n';
      for (const type of SHEET_TYPES) {
        const sheet = sheets[day]?.[type];
        if (!sheet) continue;
        summary += `\n  ${TYPE_LABELS[type]}\n`;
        summary += '  Team | Officer                    | Star#  | Seniority   | Time\n';
        for (const row of sheet.rows) {
          const a = row.assignment_a;
          const name = a?.officer_display?.split(' — ')[0] || a?.officer_display || '';
          if (name) {
            summary += `  ${(row.team || '').padEnd(4)} | ${name.padEnd(26)} | ${(a?.star || '').padEnd(6)} | ${(a?.seniority || '').padEnd(11)} | ${a?.timestamp || ''}\n`;
          }
        }
      }
      summary += '\n';
    }
    summary += `\nView the full roster online: ${shareUrl}\n`;
    return summary;
  };

  const handleShareRosterEmail = () => {
    const subject = encodeURIComponent('Unit 214 — Complete Overtime Roster');
    const body = encodeURIComponent(buildRosterSummary());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  useEffect(() => {
    fetchVersionLogs();
    fetchBumpedOfficers();
  }, [fetchVersionLogs, fetchBumpedOfficers]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
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

  const handleEmailBumped = (bumped) => {
    const subject = encodeURIComponent(`Unit 214 OT Roster - Overtime Slot Update`);
    const body = encodeURIComponent(
      `Dear ${bumped.officer_name},\n\n` +
      `This is to inform you that you have been removed from the overtime roster for ${bumped.day.toUpperCase()} - ${bumped.sheet_type.replace('_', ' ').toUpperCase()} due to seniority.\n\n` +
      `Details:\n` +
      `- Your Seniority Date: ${bumped.officer_seniority}\n` +
      `- Bumped by: ${bumped.bumped_by_name} (Star: ${bumped.bumped_by_star})\n` +
      `- Their Seniority Date: ${bumped.bumped_by_seniority}\n` +
      `- Slot: ${bumped.assignment_slot}\n` +
      `- Time of change: ${new Date(bumped.bumped_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST\n\n` +
      `We apologize for any inconvenience. Please check the roster for available slots.\n\n` +
      `Thank you.`
    );
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

  const unnotifiedCount = bumpedOfficers.filter(b => !b.notified).length;

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
            {unnotifiedCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                <Bell className="w-3 h-3" />
                {unnotifiedCount} Pending
              </span>
            )}
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
        {/* Bumped Officers Alert */}
        {bumpedOfficers.length > 0 && (
          <div className="mb-8 bg-red-50 border-2 border-red-300 rounded-sm p-4" data-testid="bumped-officers-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-red-800 uppercase flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Bumped Officers - Action Required
              </h2>
              <button
                onClick={() => {
                  if (window.confirm('Clear all bumped officer records?')) {
                    clearAllBumped();
                  }
                }}
                className="text-xs text-red-600 hover:text-red-800 underline"
              >
                Clear All
              </button>
            </div>
            <p className="text-sm text-red-700 mb-4">
              The following officers were removed from the roster due to seniority. Please notify them via email.
            </p>
            <div className="space-y-3">
              {bumpedOfficers.map((bumped) => (
                <div 
                  key={bumped.id} 
                  className={`p-3 rounded border ${bumped.notified ? 'bg-white border-slate-200' : 'bg-red-100 border-red-300'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-red-900 text-sm">
                        {bumped.officer_name} (Star: {bumped.officer_star})
                      </div>
                      <div className="text-xs text-red-700 mt-1">
                        Seniority: {bumped.officer_seniority}
                      </div>
                      <div className="text-xs text-slate-600 mt-2">
                        <strong>Bumped by:</strong> {bumped.bumped_by_name} (Star: {bumped.bumped_by_star}, Seniority: {bumped.bumped_by_seniority})
                      </div>
                      <div className="text-xs text-slate-600">
                        <strong>Sheet:</strong> {bumped.day.toUpperCase()} - {bumped.sheet_type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-600">
                        <strong>Slot:</strong> {bumped.assignment_slot}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        <strong>Time:</strong> {new Date(bumped.bumped_at).toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} CST
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {bumped.notified ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                          <CheckCircle className="w-4 h-4" />
                          Notified
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEmailBumped(bumped)}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                            data-testid={`email-bumped-${bumped.id}`}
                          >
                            <Mail className="w-3 h-3" />
                            Email
                          </button>
                          <button
                            onClick={() => markBumpedNotified(bumped.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                            data-testid={`mark-notified-${bumped.id}`}
                          >
                            <Check className="w-3 h-3" />
                            Mark Notified
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteBumpedRecord(bumped.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300 transition-colors"
                        data-testid={`delete-bumped-${bumped.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Version Log */}
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
            <div className="bg-slate-100 rounded-sm border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase mb-2">Admin Info</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use this panel to manage the officer roster. Changes are automatically saved and logged.
                Officers are sorted by seniority date (most senior first).
              </p>
            </div>

            {/* Share Section */}
            <div className="bg-white rounded-sm border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-200">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Share Roster
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-500">
                  Share this link with officers to sign up for overtime:
                </p>
                <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-sm">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-transparent text-xs font-mono text-slate-700 outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-200 text-slate-700 rounded-sm hover:bg-slate-300 transition-colors text-xs"
                    data-testid="copy-link-button"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleShareEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-sm hover:bg-slate-800 transition-colors text-sm font-semibold"
                  data-testid="share-email-button"
                >
                  <Mail className="w-4 h-4" />
                  Share via Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
