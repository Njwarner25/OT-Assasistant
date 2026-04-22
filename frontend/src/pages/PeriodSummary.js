import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Download, RefreshCw } from 'lucide-react';
import AccumulationPanel from '../components/AccumulationPanel';
import PeriodSelector from '../components/PeriodSelector';

const API = process.env.REACT_APP_BACKEND_URL || '';

const PeriodSummary = () => {
  const navigate = useNavigate();
  const [activePeriod, setActivePeriod] = useState('P1');
  const [currentPeriod, setCurrentPeriod] = useState('P1');
  const [ytdData, setYtdData] = useState([]);
  const [ytdLoading, setYtdLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('period');

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

  useEffect(() => {
    if (activeTab !== 'ytd') return;
    setYtdLoading(true);
    fetch(`${API}/api/ytd-summary`)
      .then(r => r.json())
      .then(d => { setYtdData(d); setYtdLoading(false); })
      .catch(() => setYtdLoading(false));
  }, [activeTab]);

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      await fetch(`${API}/api/accumulation/${activePeriod}/recalculate`, { method: 'POST' });
    } catch {}
    setRecalcLoading(false);
    window.location.reload();
  };

  const tdCls = "px-3 py-2 text-xs font-mono";
  const thCls = "px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-700 rounded-sm hover:bg-slate-600 transition-colors text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <Shield className="w-5 h-5" />
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase leading-none">
                OT ACCUMULATION — Unit 214
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                Period & Year-to-Date Totals · 2026
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRecalculate}
              disabled={recalcLoading}
              title="Recalculate accumulation from raw sheet data"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 rounded-sm hover:bg-slate-600 transition-colors text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recalcLoading ? 'animate-spin' : ''}`} />
              Recalculate
            </button>
            <button
              onClick={() => window.open(`${API}/api/period-summary/${activePeriod}/export-pdf`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 rounded-sm hover:bg-slate-100 transition-colors text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-slate-800 text-white print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center gap-1 pt-2">
          <button
            onClick={() => setActiveTab('period')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-t-sm transition-colors ${
              activeTab === 'period' ? 'bg-slate-50 text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Period View
          </button>
          <button
            onClick={() => setActiveTab('ytd')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-t-sm transition-colors ${
              activeTab === 'ytd' ? 'bg-slate-50 text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Year-to-Date
          </button>
        </div>
      </div>

      {/* Period Selector (only for period tab) */}
      {activeTab === 'period' && (
        <PeriodSelector
          activePeriod={activePeriod}
          onChange={setActivePeriod}
          currentPeriod={currentPeriod}
        />
      )}

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {activeTab === 'period' ? (
          <AccumulationPanel period={activePeriod} />
        ) : (
          // YTD Summary Table
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                Year-to-Date OT Totals — All Periods
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregate across all 13 CPD 2026 operational periods
              </p>
            </div>
            {ytdLoading ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading YTD data...</div>
            ) : ytdData.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No YTD data yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className={thCls}>Officer</th>
                      <th className={`${thCls} text-center`}>Star</th>
                      <th className={`${thCls} text-center`}>RDO Hrs</th>
                      <th className={`${thCls} text-center`}>Days Ext</th>
                      <th className={`${thCls} text-center`}>Nights Ext</th>
                      <th className={`${thCls} text-center`}>YTD Total</th>
                      <th className={`${thCls} text-center`}>Shifts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ytdData.map((r, i) => (
                      <tr
                        key={r.officer_id || i}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${
                          i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className={`${tdCls} font-medium text-slate-900`}>{r.officer_display || '—'}</td>
                        <td className={`${tdCls} text-center text-slate-600`}>{r.star || '—'}</td>
                        <td className={`${tdCls} text-center ${r.ytd_rdo > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                          {r.ytd_rdo || 0}
                        </td>
                        <td className={`${tdCls} text-center ${r.ytd_days > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                          {r.ytd_days || 0}
                        </td>
                        <td className={`${tdCls} text-center ${r.ytd_nights > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                          {r.ytd_nights || 0}
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-mono font-bold ${
                            r.ytd_total >= 100 ? 'bg-red-100 text-red-800' :
                            r.ytd_total >= 50  ? 'bg-amber-100 text-amber-800' :
                            r.ytd_total > 0    ? 'bg-slate-900 text-white' :
                            'text-slate-300'
                          }`}>
                            {r.ytd_total || 0}
                          </span>
                        </td>
                        <td className={`${tdCls} text-center text-slate-600`}>{r.ytd_shifts || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white">
                      <td className="px-3 py-2 text-xs font-bold uppercase" colSpan={2}>UNIT TOTALS</td>
                      <td className="px-3 py-2 text-xs font-mono font-bold text-center">
                        {ytdData.reduce((s, r) => s + (r.ytd_rdo || 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono font-bold text-center">
                        {ytdData.reduce((s, r) => s + (r.ytd_days || 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono font-bold text-center">
                        {ytdData.reduce((s, r) => s + (r.ytd_nights || 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono font-bold text-center">
                        {ytdData.reduce((s, r) => s + (r.ytd_total || 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono font-bold text-center">
                        {ytdData.reduce((s, r) => s + (r.ytd_shifts || 0), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PeriodSummary;
