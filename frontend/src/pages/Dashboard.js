import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import RosterSheet from '../components/RosterSheet';
import { Shield, Users, FileSpreadsheet, RotateCcw, Printer, Download, Calendar } from 'lucide-react';

const Dashboard = () => {
  const [activeDay, setActiveDay] = useState('friday');
  const [activeType, setActiveType] = useState('rdo');
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
    if (window.confirm('Are you sure you want to reset ALL overtime sheets? This will clear all assignments for all days.')) {
      await resetAllSheets();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const sheet = sheets[activeDay]?.[activeType];
    if (!sheet) {
      alert('No sheet data to export');
      return;
    }

    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF('landscape');
      
      const dayLabels = {
        friday: 'FRIDAY',
        saturday: 'SATURDAY',
        sunday: 'SUNDAY'
      };
      
      const typeLabels = {
        rdo: 'RDO 2000-0500',
        days_ext: '4HR EXT TOUR (2000-2100 DAYS EXT)',
        nights_ext: '4HR EXT TOUR (1600-2000 NIGHTS EXT)'
      };

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${dayLabels[activeDay]} - OVERTIME WORKING - ${typeLabels[activeType]}`, 14, 20);
      
      // Sergeant info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Sergeant: ${sheet.sergeant_name || '___________'}    Star#: ${sheet.sergeant_star || '_____'}`, 14, 30);
      
      // Timestamp
      const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'America/Chicago', 
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generated: ${timestamp} CST`, 14, 36);

      // Table headers - simplified structure
      const headers = ['Team', 'Officer #', 'Location', 'Officer', 'Star', 'Seniority', 'Time'];
      
      // Table rows
      const rows = sheet.rows.map(row => {
        const name = row.assignment_a?.officer_display?.split(' — ')[0] || '';
        return [
          row.team || '',
          row.officer_number || '',
          row.deployment_location || '',
          name,
          row.assignment_a?.star || '',
          row.assignment_a?.seniority || '',
          row.assignment_a?.timestamp || ''
        ];
      });

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 42,
        styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 20 },  // Team
          1: { cellWidth: 25 },  // Officer #
          2: { cellWidth: 40 },  // Location
          3: { cellWidth: 60 },  // Officer
          4: { cellWidth: 20 },  // Star
          5: { cellWidth: 30 },  // Seniority
          6: { cellWidth: 25 }   // Time
        }
      });

      const filename = `OT_Roster_${activeDay}_${activeType}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error exporting PDF. Please try the Print option instead.');
    }
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
      <main className="max-w-[1400px] mx-auto p-4 md:p-8" ref={printRef}>
        <RosterSheet day={activeDay} sheetType={activeType} />
      </main>

      {/* Print Footer */}
      <footer className="hidden print:block text-center text-xs text-slate-400 mt-8">
        Generated: {new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} CST — Unit 214 Overtime Roster
      </footer>
    </div>
  );
};

export default Dashboard;
