import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import RosterSheet from '../components/RosterSheet';
import { Shield, Users, FileSpreadsheet, RotateCcw, Printer, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('rdo');
  const { resetAllSheets, sheets, isAuthenticated } = useApp();
  const navigate = useNavigate();

  const handleAdminClick = () => {
    if (isAuthenticated) {
      navigate('/admin');
    } else {
      navigate('/login');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset ALL overtime sheets? This will clear all assignments.')) {
      await resetAllSheets();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const sheet = sheets[activeTab];
    if (!sheet) return;

    const doc = new jsPDF('landscape');
    const sheetTitles = {
      rdo: 'OVERTIME WORKING — RDO 2000–0500',
      days_ext: 'OVERTIME WORKING — 4HR EXT TOUR (2000–2100 DAYS EXT)',
      nights_ext: 'OVERTIME WORKING — 4HR EXT TOUR (1600–2000 NIGHTS EXT)'
    };

    doc.setFontSize(16);
    doc.text(sheetTitles[activeTab], 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Sergeant: ${sheet.sergeant_name || '___________'}    Star#: ${sheet.sergeant_star || '_____'}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    const headers = ['Team', 'Officer #', 'Location', 'A', 'Star', 'Sen', 'Time', 'B', 'Star', 'Sen', 'Time'];
    const rows = sheet.rows.map(row => [
      row.team,
      row.officer_number || '',
      row.deployment_location || '',
      row.assignment_a?.officer_display?.split(' — ')[0] || '',
      row.assignment_a?.star || '',
      row.assignment_a?.seniority || '',
      row.assignment_a?.timestamp || '',
      row.assignment_b?.officer_display?.split(' — ')[0] || '',
      row.assignment_b?.star || '',
      row.assignment_b?.seniority || '',
      row.assignment_b?.timestamp || ''
    ]);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 42,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`OT_Roster_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const tabs = [
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

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                {tab.label}
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
              onClick={handleReset}
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
      <main className="max-w-[1400px] mx-auto p-4 md:p-8">
        <RosterSheet sheetType={activeTab} />
      </main>

      {/* Print Footer */}
      <footer className="hidden print:block text-center text-xs text-slate-400 mt-8">
        Generated: {new Date().toLocaleString()} — Unit 214 Overtime Roster
      </footer>
    </div>
  );
};

export default Dashboard;
