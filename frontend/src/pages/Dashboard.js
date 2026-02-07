import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import RosterSheet from '../components/RosterSheet';
import { Shield, Users, FileSpreadsheet, RotateCcw, Printer, Download, Calendar, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

const Dashboard = () => {
  const [activeDay, setActiveDay] = useState('friday');
  const [activeType, setActiveType] = useState('rdo');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStatus, setResetStatus] = useState(null);
  const { resetAllSheets, sheets, isAuthenticated, loading } = useApp();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const handleAdminClick = () => {
    if (isAuthenticated) {
      navigate('/admin');
    } else {
      navigate('/login');
    }
  };

  const handleReset = async () => {
    setResetStatus('loading');
    try {
      await resetAllSheets();
      setResetStatus('success');
      setTimeout(() => { setResetStatus(null); setShowResetConfirm(false); }, 1500);
    } catch {
      setResetStatus('error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const [showPdfModal, setShowPdfModal] = useState(false);

  const handleExportPDF = () => {
    setShowPdfModal(true);
  };

  const days = [
    { id: 'friday', label: 'Friday' },
    { id: 'saturday', label: 'Saturday' },
    { id: 'sunday', label: 'Sunday' }
  ];

  const sheetTypes = [
    { id: 'rdo', label: 'RDO 2000-0500' },
    { id: 'days_ext', label: 'Days EXT 2000-2100' },
    { id: 'nights_ext', label: 'Nights EXT 1600-2000' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard-page">
      {/* Header */}
      <header className="bg-slate-900 text-white print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <h1 className="text-xl font-black tracking-tight uppercase font-['Chivo']">
              OT ROSTER — Unit 214
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleAdminClick}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-sm hover:bg-slate-700 transition-colors text-sm"
              data-testid="admin-button"
            >
              <Users className="w-4 h-4" />
              Admin
            </button>
          </div>
        </div>
      </header>

      {/* Day Selector */}
      <div className="bg-slate-800 text-white print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-4">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 uppercase tracking-wider">Select Day:</span>
          <div className="flex gap-1">
            {days.map(day => (
              <button
                key={day.id}
                onClick={() => setActiveDay(day.id)}
                className={`px-4 py-1.5 text-sm font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  activeDay === day.id
                    ? 'bg-white text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                data-testid={`day-${day.id}`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex gap-2">
            {sheetTypes.map(type => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  activeType === type.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid={`tab-${type.id}`}
              >
                <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                {type.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-sm hover:bg-slate-200 transition-colors text-sm"
              data-testid="print-button"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-sm hover:bg-slate-200 transition-colors text-sm"
              data-testid="export-pdf-button"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-sm hover:bg-red-100 transition-colors text-sm"
              data-testid="reset-button"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All
            </button>
          </div>
        </div>
      </div>

      {/* Sheet Content */}
      <main className="max-w-[1400px] mx-auto p-4 md:p-8" ref={printRef}>
        <RosterSheet day={activeDay} sheetType={activeType} />
      </main>

      {/* Print Footer */}
      <footer className="hidden print:block text-center text-xs text-slate-400 mt-8">
        Generated: {new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} CST — Unit 214 Overtime Roster
      </footer>

      {/* PDF Viewer Modal */}
      {showPdfModal && (() => {
        const sheet = sheets[activeDay]?.[activeType];
        const dayLabels = { friday: 'FRIDAY', saturday: 'SATURDAY', sunday: 'SUNDAY' };
        const typeLabels = { rdo: 'RDO 2000-0500', days_ext: 'Days EXT 2000-2100', nights_ext: 'Nights EXT 1600-2000' };
        return (
          <div className="fixed inset-0 bg-white z-50 overflow-auto" data-testid="pdf-modal" id="export-view">
            <div className="flex items-center justify-between px-6 py-3 bg-slate-900 text-white print:hidden sticky top-0">
              <span className="text-sm font-semibold uppercase tracking-wider">Export View — Use Ctrl+P or Cmd+P to Print / Save as PDF</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-4 py-1.5 bg-green-600 rounded hover:bg-green-700 text-sm font-semibold"
                  data-testid="modal-print-btn"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="flex items-center gap-1 px-4 py-1.5 bg-slate-700 rounded hover:bg-slate-600 text-sm"
                  data-testid="close-pdf-modal"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-w-[900px] mx-auto p-8 font-mono">
              <h1 className="text-xl font-bold mb-1">{dayLabels[activeDay]} — OVERTIME WORKING — {typeLabels[activeType]}</h1>
              <p className="text-sm text-slate-600 mb-1">Sergeant: {sheet?.sergeant_name || '___________'} &nbsp;&nbsp; Star#: {sheet?.sergeant_star || '_____'}</p>
              <p className="text-sm text-slate-500 mb-4">Generated: {new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} CST</p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['Team','BT#','Location','Officer','Star','Seniority','Date/Time'].map(h => (
                      <th key={h} className="bg-slate-900 text-white text-left text-xs font-bold p-2 border border-black">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(sheet?.rows || []).map((row, i) => {
                    const a = row.assignment_a;
                    const name = a?.officer_display?.split(' — ')[0] || a?.officer_display || '';
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2 border border-slate-300 text-center font-bold">{row.team}</td>
                        <td className="p-2 border border-slate-300">{row.officer_number || ''}</td>
                        <td className="p-2 border border-slate-300">{row.deployment_location || ''}</td>
                        <td className="p-2 border border-slate-300">{name}</td>
                        <td className="p-2 border border-slate-300">{a?.star || ''}</td>
                        <td className="p-2 border border-slate-300">{a?.seniority || ''}</td>
                        <td className="p-2 border border-slate-300">{a?.timestamp || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-4">Unit 214 Overtime Roster</p>
            </div>
          </div>
        );
      })()}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-sm shadow-xl p-6 w-96 max-w-[90vw]">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-bold text-slate-800 uppercase">Reset All Sheets</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will clear ALL officer assignments for every day and sheet type. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={resetStatus === 'loading'}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold transition-colors ${
                  resetStatus === 'success' ? 'bg-green-600 text-white' :
                  resetStatus === 'loading' ? 'bg-red-400 text-white cursor-wait' :
                  'bg-red-600 text-white hover:bg-red-700'
                }`}
                data-testid="confirm-reset-button"
              >
                {resetStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 resetStatus === 'success' ? <CheckCircle className="w-4 h-4" /> :
                 <RotateCcw className="w-4 h-4" />}
                {resetStatus === 'success' ? 'Reset Complete!' : resetStatus === 'loading' ? 'Resetting...' : 'Yes, Reset All'}
              </button>
              <button
                onClick={() => { setShowResetConfirm(false); setResetStatus(null); }}
                className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-sm hover:bg-slate-300 transition-colors text-sm font-semibold"
                data-testid="cancel-reset-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
