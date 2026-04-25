import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import RosterSheet from '../components/RosterSheet';
import PeriodSelector from '../components/PeriodSelector';
import AccumulationPanel from '../components/AccumulationPanel';
import { Shield, Users, RotateCcw, Printer, Download, AlertTriangle, CheckCircle, Loader2, TrendingUp, ChevronDown, Calendar } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

// CPD 2026 Operational Periods
const CPD_PERIODS = {
    "ADJ": { label: "Adj. Week", start: "01/01/2026", end: "01/07/2026" },
    "P1":  { label: "Period 1",  start: "01/08/2026", end: "02/04/2026" },
    "P2":  { label: "Period 2",  start: "02/05/2026", end: "03/04/2026" },
    "P3":  { label: "Period 3",  start: "03/05/2026", end: "04/01/2026" },
    "P4":  { label: "Period 4",  start: "04/02/2026", end: "04/29/2026" },
    "P5":  { label: "Period 5",  start: "04/30/2026", end: "05/27/2026" },
    "P6":  { label: "Period 6",  start: "05/28/2026", end: "06/24/2026" },
    "P7":  { label: "Period 7",  start: "06/25/2026", end: "07/22/2026" },
    "P8":  { label: "Period 8",  start: "07/23/2026", end: "08/19/2026" },
    "P9":  { label: "Period 9",  start: "08/20/2026", end: "09/16/2026" },
    "P10": { label: "Period 10", start: "09/17/2026", end: "10/14/2026" },
    "P11": { label: "Period 11", start: "10/15/2026", end: "11/11/2026" },
    "P12": { label: "Period 12", start: "11/12/2026", end: "12/09/2026" },
    "P13": { label: "Period 13", start: "12/10/2026", end: "01/06/2027" },
};

// Get the upcoming OT weekend dates (Thu-Sun) for a given period
// CPD OT weekends fall on the Thu-Sun of each week within the period
function getOTWeekendDates(period, day) {
    const info = CPD_PERIODS[period];
    if (!info) return null;
    const now = new Date();
    // Parse start/end
  const parseMDY = (s) => { const [m, d, y] = s.split('/'); return new Date(parseInt(y), parseInt(m)-1, parseInt(d)); };
    const periodStart = parseMDY(info.start);
    const periodEnd = parseMDY(info.end);
    const dayMap = { thursday: 4, friday: 5, saturday: 6, sunday: 0 };
    const targetDow = dayMap[day];
    // Find all matching days of week within period
  let dates = [];
    let cur = new Date(periodStart);
    while (cur <= periodEnd) {
          if (cur.getDay() === targetDow) dates.push(new Date(cur));
          cur.setDate(cur.getDate() + 1);
    }
    // Find the upcoming/current one (closest to today that is >= today or most recent)
  let chosen = dates.find(d => d >= now) || dates[dates.length - 1];
    return chosen;
}

// Format date as "THURSDAY, APRIL 25, 2026"
function formatOTDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'America/Chicago',
    }).toUpperCase();
}

// Get the weekend label (e.g., "Apr 24–27 Weekend")
function getWeekendLabel(period, activePeriod) {
    const info = CPD_PERIODS[period || activePeriod];
    if (!info) return '';
    const thu = getOTWeekendDates(period || activePeriod, 'thursday');
    const sun = getOTWeekendDates(period || activePeriod, 'sunday');
    if (!thu || !sun) return '';
    const opts = { month: 'short', day: 'numeric', timeZone: 'America/Chicago' };
    return `${thu.toLocaleDateString('en-US', opts)}–${sun.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Chicago' })} Weekend`;
}

const Dashboard = () => {
    const [activePeriod, setActivePeriod] = useState('P1');
    const [currentPeriod, setCurrentPeriod] = useState('P1');
    const [activeDay, setActiveDay] = useState('thursday');
    const [activeType, setActiveType] = useState('rdo');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [resetStatus, setResetStatus] = useState(null);
    const [showAccumulation, setShowAccumulation] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const { resetAllSheets, sheets, isAuthenticated, loading } = useApp();
    const navigate = useNavigate();
    const printRef = useRef(null);

    // Fetch current period on mount
    useEffect(() => {
          fetch(`${API}/api/periods`)
            .then(r => r.json())
            .then(d => {
                      const cp = d.current_period || 'P1';
                      setCurrentPeriod(cp);
                      setActivePeriod(cp);
            })
            .catch(() => {});
    }, []);

    // Update date every minute
    useEffect(() => {
          const interval = setInterval(() => setCurrentDate(new Date()), 60000);
          return () => clearInterval(interval);
    }, []);

    const handleAdminClick = () => {
          navigate(isAuthenticated ? '/admin' : '/login');
    };

    const handleReset = async () => {
          setResetStatus('loading');
          try {
                  await resetAllSheets(activePeriod);
                  setResetStatus('success');
                  setTimeout(() => {
                            setResetStatus(null);
                            setShowResetConfirm(false);
                  }, 1500);
          } catch {
                  setResetStatus('error');
          }
    };

    const days = [
      { id: 'thursday',  label: 'Thursday'  },
      { id: 'friday',    label: 'Friday'    },
      { id: 'saturday',  label: 'Saturday'  },
      { id: 'sunday',    label: 'Sunday'    },
        ];

    const sheetTypes = [
      { id: 'rdo',        label: 'RDO 2000–0500',       hours: 9 },
      { id: 'days_ext',   label: 'Days EXT 2000–2100',   hours: 4 },
      { id: 'nights_ext', label: 'Nights EXT 1600–2000', hours: 4 },
        ];

    // Compute the actual date for the active day in the active period
    const activeOTDate = getOTWeekendDates(activePeriod, activeDay);
    const activeDateDisplay = activeOTDate ? formatOTDate(activeOTDate) : '';
    const periodInfo = CPD_PERIODS[activePeriod];

    if (loading) {
          return (
                  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading roster...</span>
            </div>
            </div>
          );
    }

    return (
          <div className="min-h-screen bg-slate-50" data-testid="dashboard-page">
    {/* ── Header ─────────────────────────────────────────── */}
            <header className="bg-slate-900 text-white print:hidden">
              <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h1 className="text-lg font-black tracking-tight uppercase leading-none">
                      OT ROSTER — Unit 214
      </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                      CPD Operations · 2026
      </p>
      </div>
  {/* ── CPD Operational Date Display ── */}
              <div className="hidden sm:flex flex-col ml-4 pl-4 border-l border-slate-700">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-bold text-white tracking-wide">
{activeDateDisplay || currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' }).toUpperCase()}
</span>
  </div>
              <span className="text-[10px] text-blue-300 uppercase tracking-widest mt-0.5">
{periodInfo ? `${periodInfo.label} · ${periodInfo.start}–${periodInfo.end}` : ''}{' '}
{activePeriod === currentPeriod && <span className="text-green-400 font-bold">· CURRENT PERIOD</span>}
  </span>
  </div>
  </div>
           <div className="flex items-center gap-2">
              <button
               onClick={() => navigate('/summary')}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors bg-slate-700 text-white hover:bg-slate-600`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
                            Summary
              </button>
            <button
              onClick={handleAdminClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 rounded-sm hover:bg-slate-600 transition-colors text-xs font-semibold"
              data-testid="admin-button"
            >
                              <Users className="w-3.5 h-3.5" />
                              Admin
                </button>
                </div>
                </div>
                </header>

{/* ── Period Selector ─────────────────────────────────── */}
      <PeriodSelector activePeriod={activePeriod} onChange={setActivePeriod} currentPeriod={currentPeriod} />

      {/* ── Day + Sheet Type Selectors ───────────────────────── */}
      <div className="bg-slate-700 text-white print:hidden">
                <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-6 flex-wrap">
      {/* Day */}
          <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold shrink-0">Day</span>
            <div className="flex gap-1">
      {days.map(d => (
                        <button
                                  key={d.id}
                  onClick={() => setActiveDay(d.id)}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors ${
                                        activeDay === d.id
                                          ? 'bg-white text-slate-900'
                                          : 'text-slate-300 hover:text-white hover:bg-slate-600'
                  }`}
                >
{d.label}
</button>
              ))}
                </div>
                </div>

{/* Divider */}
          <div className="w-px h-5 bg-slate-500 hidden sm:block" />

          {/* Sheet Type */}
          <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold shrink-0">Shift</span>
            <div className="flex gap-1">
          {sheetTypes.map(t => (
                            <button
                                            key={t.id}
                  onClick={() => setActiveType(t.id)}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors ${
                                        activeType === t.id
                                          ? 'bg-white text-slate-900'
                                          : 'text-slate-300 hover:text-white hover:bg-slate-600'
                  }`}
                >
{t.label}
                  <span className="ml-1 text-[10px] opacity-60">({t.hours}h)</span>
                    </button>
              ))}
                </div>
                </div>
                </div>
                </div>

{/* ── Accumulation Panel (toggleable) ─────────────────── */}
{showAccumulation && (
          <div className="max-w-[1400px] mx-auto px-4 pt-4 print:hidden">
            <AccumulationPanel period={activePeriod} />
  </div>
       )}

{/* ── Action Bar ──────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between print:hidden">
                <div className="text-xs text-slate-500">
                  <span className="font-mono font-bold text-slate-700">
      {activePeriod} · {days.find(d => d.id === activeDay)?.label} · {sheetTypes.find(t => t.id === activeType)?.label}
</span>
{activeDateDisplay && (
              <span className="ml-3 text-blue-600 font-semibold">{activeDateDisplay}</span>
           )}
</div>
        <div className="flex items-center gap-2">
            <button
            onClick={() => window.open(`${API}/api/sheets/${activePeriod}/${activeDay}/${activeType}/export-pdf`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-sm hover:bg-slate-700 transition-colors text-xs font-semibold"
          >
                          <Download className="w-3.5 h-3.5" />
                          Export PDF
              </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-sm hover:bg-slate-300 transition-colors text-xs font-semibold"
          >
                          <Printer className="w-3.5 h-3.5" />
                          Print
              </button>
{!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-sm hover:bg-red-50 hover:text-red-700 transition-colors text-xs font-semibold"
             >
                               <RotateCcw className="w-3.5 h-3.5" />
                               Reset Period
                 </button>
           ) : (
                         <div className="flex items-center gap-1.5">
                           <span className="text-xs text-red-600 font-semibold">Reset all sheets for {activePeriod}?</span>
 {resetStatus === 'loading' ? (
                   <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                 ) : resetStatus === 'success' ? (
                                   <CheckCircle className="w-4 h-4 text-green-600" />
                 ) : (
                                   <>
                                     <button onClick={handleReset} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-sm hover:bg-red-700">
                       Yes, Reset
   </button>
                    <button onClick={() => setShowResetConfirm(false)} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-sm hover:bg-slate-300">
                       Cancel
   </button>
   </>
               )}
</div>
          )}
</div>
  </div>

{/* ── Roster Sheet ────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 pb-8" ref={printRef}>
                <RosterSheet period={activePeriod} day={activeDay} sheetType={activeType} />
        </div>
        </div>
  );
};

export default Dashboard;
