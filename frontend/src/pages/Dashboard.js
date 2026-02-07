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
  const [pdfLoading, setPdfLoading] = useState(false);
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
    // Open a clean print window with just the sheet content
    const sheet = sheets[activeDay]?.[activeType];
    if (!sheet) return;
    
    const dayLabels = { friday: 'FRIDAY', saturday: 'SATURDAY', sunday: 'SUNDAY' };
    const typeLabels = { rdo: 'RDO 2000-0500', days_ext: 'Days EXT 2000-2100', nights_ext: 'Nights EXT 1600-2000' };

    const rows = sheet.rows.map(row => {
      const a = row.assignment_a;
      const name = a?.officer_display?.split(' — ')[0] || a?.officer_display || '';
      return `<tr>
        <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold">${row.team || ''}</td>
        <td style="border:1px solid #000;padding:6px">${row.officer_number || ''}</td>
        <td style="border:1px solid #000;padding:6px">${row.deployment_location || ''}</td>
        <td style="border:1px solid #000;padding:6px">${name}</td>
        <td style="border:1px solid #000;padding:6px">${a?.star || ''}</td>
        <td style="border:1px solid #000;padding:6px">${a?.seniority || ''}</td>
        <td style="border:1px solid #000;padding:6px">${a?.timestamp || ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>OT Roster - ${dayLabels[activeDay]} - ${typeLabels[activeType]}</title>
      <style>body{font-family:monospace;margin:20px}table{border-collapse:collapse;width:100%}th{background:#0f172a;color:#fff;padding:8px;border:1px solid #000;text-align:left;font-size:11px}td{font-size:12px}h1{font-size:18px;margin-bottom:4px}p{font-size:12px;color:#666;margin:2px 0}@media print{@page{size:landscape;margin:0.5in}}</style>
      </head><body>
      <h1>${dayLabels[activeDay]} — OVERTIME WORKING — ${typeLabels[activeType]}</h1>
      <p>Sergeant: ${sheet.sergeant_name || '___________'} &nbsp; Star#: ${sheet.sergeant_star || '_____'}</p>
      <p>Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} CST</p>
      <br/>
      <table><thead><tr><th>Team</th><th>Officer #</th><th>Location</th><th>Officer</th><th>Star</th><th>Seniority</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  // handleExportPDF - fetch blob and trigger same-origin download
  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/sheets/${activeDay}/${activeType}/export-pdf`;
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `OT_Roster_${activeDay}_${activeType}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
    setPdfLoading(false);
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
            <a
              href={`${process.env.REACT_APP_BACKEND_URL}/api/sheets/${activeDay}/${activeType}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-sm hover:bg-slate-200 transition-colors text-sm no-underline"
              data-testid="export-pdf-button"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </a>
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
