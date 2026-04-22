import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, Calendar, ChevronDown, ChevronUp, Download } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const PERIOD_LABELS = {
  ADJ: 'Adj. Week',  P1: 'Period 1',  P2: 'Period 2',  P3: 'Period 3',
  P4:  'Period 4',   P5: 'Period 5',  P6: 'Period 6',  P7: 'Period 7',
  P8:  'Period 8',   P9: 'Period 9',  P10: 'Period 10', P11: 'Period 11',
  P12: 'Period 12',  P13: 'Period 13',
};

const AccumulationPanel = ({ period, officerId = null, compact = false }) => {
  const [data, setData] = useState([]);
  const [ytd, setYtd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [sortBy, setSortBy] = useState('total_hours');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (!period) return;
    setLoading(true);

    if (officerId) {
      // Single officer view
      Promise.all([
        fetch(`${API}/api/accumulation/${period}/${officerId}`).then(r => r.json()),
        fetch(`${API}/api/accumulation/officer/${officerId}/ytd`).then(r => r.json()),
      ]).then(([periodData, ytdData]) => {
        setData([periodData]);
        setYtd(ytdData);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      // Full unit view
      fetch(`${API}/api/accumulation/${period}`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [period, officerId]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortBy] ?? 0;
    const bv = b[sortBy] ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const totals = {
    rdo: data.reduce((s, r) => s + (r.rdo_hours || 0), 0),
    days: data.reduce((s, r) => s + (r.days_ext_hours || 0), 0),
    nights: data.reduce((s, r) => s + (r.nights_ext_hours || 0), 0),
    total: data.reduce((s, r) => s + (r.total_hours || 0), 0),
    shifts: data.reduce((s, r) => s + (r.shifts_worked || 0), 0),
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span className="text-slate-400 ml-1">↕</span>;
    return <span className="text-slate-900 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  const thCls = "px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 select-none";
  const tdCls = "px-3 py-2 text-xs font-mono";

  const exportPDF = () => {
    window.open(`${API}/api/period-summary/${period}/export-pdf`, '_blank');
  };

  if (compact) {
    // Mini card for dashboard sidebar
    const myRecord = data[0] || {};
    return (
      <div className="bg-white border border-slate-200 rounded-sm p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            OT Hours — {PERIOD_LABELS[period] || period}
          </span>
          <TrendingUp className="w-3 h-3 text-slate-400" />
        </div>
        {loading ? (
          <div className="text-xs text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">RDO (9hr)</span>
              <span className="text-xs font-mono font-bold text-slate-900">{myRecord.rdo_hours || 0} hrs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Days Ext (4hr)</span>
              <span className="text-xs font-mono font-bold text-slate-900">{myRecord.days_ext_hours || 0} hrs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Nights Ext (4hr)</span>
              <span className="text-xs font-mono font-bold text-slate-900">{myRecord.nights_ext_hours || 0} hrs</span>
            </div>
            <div className="border-t border-slate-200 pt-1 flex justify-between">
              <span className="text-xs font-bold text-slate-700">Total</span>
              <span className="text-xs font-mono font-bold text-slate-900">
                {myRecord.total_hours || 0} hrs / {myRecord.shifts_worked || 0} shifts
              </span>
            </div>
          </div>
        )}
        {ytd && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">YTD Total</span>
            <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
              {ytd.ytd_total_hours} hrs / {ytd.ytd_shifts} shifts
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full table view
  return (
    <div className="bg-white border border-slate-200 rounded-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-200 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            OT Accumulation — {PERIOD_LABELS[period] || period}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            ({data.length} officers · {totals.total} hrs total)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); exportPDF(); }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-900 text-white rounded-sm hover:bg-slate-700 transition-colors"
          >
            <Download className="w-3 h-3" /> PDF
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <>
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">Loading accumulation data...</div>
          ) : data.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              No OT hours recorded for {PERIOD_LABELS[period] || period} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={thCls} onClick={() => handleSort('officer_display')}>
                      Officer <SortIcon col="officer_display" />
                    </th>
                    <th className={`${thCls} text-center`}>Star</th>
                    <th className={`${thCls} text-center`} onClick={() => handleSort('rdo_hours')}>
                      RDO (9h) <SortIcon col="rdo_hours" />
                    </th>
                    <th className={`${thCls} text-center`} onClick={() => handleSort('days_ext_hours')}>
                      Days (4h) <SortIcon col="days_ext_hours" />
                    </th>
                    <th className={`${thCls} text-center`} onClick={() => handleSort('nights_ext_hours')}>
                      Nights (4h) <SortIcon col="nights_ext_hours" />
                    </th>
                    <th className={`${thCls} text-center`} onClick={() => handleSort('total_hours')}>
                      Total Hrs <SortIcon col="total_hours" />
                    </th>
                    <th className={`${thCls} text-center`} onClick={() => handleSort('shifts_worked')}>
                      Shifts <SortIcon col="shifts_worked" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr
                      key={r.officer_id || i}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className={`${tdCls} font-medium text-slate-900`}>{r.officer_display || '—'}</td>
                      <td className={`${tdCls} text-center text-slate-600`}>{r.star || '—'}</td>
                      <td className={`${tdCls} text-center ${r.rdo_hours > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                        {r.rdo_hours || 0}
                      </td>
                      <td className={`${tdCls} text-center ${r.days_ext_hours > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                        {r.days_ext_hours || 0}
                      </td>
                      <td className={`${tdCls} text-center ${r.nights_ext_hours > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                        {r.nights_ext_hours || 0}
                      </td>
                      <td className={`${tdCls} text-center`}>
                        <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-mono font-bold ${
                          r.total_hours >= 20 ? 'bg-red-100 text-red-800' :
                          r.total_hours >= 12 ? 'bg-amber-100 text-amber-800' :
                          r.total_hours > 0  ? 'bg-slate-900 text-white' :
                          'text-slate-300'
                        }`}>
                          {r.total_hours || 0}
                        </span>
                      </td>
                      <td className={`${tdCls} text-center text-slate-600`}>{r.shifts_worked || 0}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td className="px-3 py-2 text-xs font-bold uppercase tracking-wider" colSpan={2}>
                      UNIT TOTALS
                    </td>
                    <td className="px-3 py-2 text-xs font-mono font-bold text-center">{totals.rdo}</td>
                    <td className="px-3 py-2 text-xs font-mono font-bold text-center">{totals.days}</td>
                    <td className="px-3 py-2 text-xs font-mono font-bold text-center">{totals.nights}</td>
                    <td className="px-3 py-2 text-xs font-mono font-bold text-center">{totals.total}</td>
                    <td className="px-3 py-2 text-xs font-mono font-bold text-center">{totals.shifts}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AccumulationPanel;
