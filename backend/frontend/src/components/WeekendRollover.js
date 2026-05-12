import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { RotateCcw, History, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Loader2, Calendar, Users, Clock } from 'lucide-react';

const DAY_LABELS   = { thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
const TYPE_LABELS  = { rdo: 'RDO 9h', days_ext: 'Days EXT 4h', nights_ext: 'Nights EXT 4h' };

export default function WeekendRollover({ activePeriod }) {
  const { weekendRollover, fetchWeekendHistory } = useApp();

  const [showConfirm, setShowConfirm]     = useState(false);
  const [weekendLabel, setWeekendLabel]   = useState('');
  const [status, setStatus]               = useState(null); // null | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg]           = useState('');
  const [history, setHistory]             = useState([]);
  const [showHistory, setShowHistory]     = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId]       = useState(null);

  // Auto-suggest a label based on the upcoming Thursday date
  useEffect(() => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const daysUntilThu = (4 - day + 7) % 7 || 7;
    const thu = new Date(now);
    thu.setDate(now.getDate() + (daysUntilThu === 7 ? -3 : daysUntilThu)); // past Thu if midweek
    const sun = new Date(thu);
    sun.setDate(thu.getDate() + 3);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    setWeekendLabel(`${fmt(thu)}–${fmt(sun)}, ${thu.getFullYear()}`);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const data = await fetchWeekendHistory(activePeriod);
    setHistory(data);
    setHistoryLoading(false);
  }, [fetchWeekendHistory, activePeriod]);

  const handleRollover = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      await weekendRollover(activePeriod, weekendLabel || undefined);
      setStatus('success');
      setShowConfirm(false);
      // Refresh history list
      const data = await fetchWeekendHistory(activePeriod);
      setHistory(data);
      setShowHistory(true);
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || 'Rollover failed. Try again.');
      setStatus('error');
    }
  };

  const toggleHistory = async () => {
    if (!showHistory) await loadHistory();
    setShowHistory(v => !v);
  };

  return (
    <div className="border border-amber-200 rounded-sm bg-amber-50 p-4 space-y-3">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-amber-700" />
          <span className="text-sm font-bold text-amber-900 uppercase tracking-wide">Weekend Rollover</span>
        </div>
        <button
          onClick={toggleHistory}
          className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-semibold"
        >
          <History className="w-3.5 h-3.5" />
          History
          {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <p className="text-xs text-amber-800 leading-relaxed">
        Archives this weekend's signups to the summary record, then clears all sign-up slots
        so officers can register for the upcoming weekend.
        <strong> Accumulated hours are not affected.</strong>
      </p>

      {/* Success banner */}
      {status === 'success' && (
        <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-sm px-3 py-2 text-xs text-green-800 font-semibold">
          <CheckCircle className="w-4 h-4" />
          Weekend archived and sheets cleared. Officers can now sign up for the next weekend.
        </div>
      )}

      {/* Error banner */}
      {status === 'error' && (
        <div className="flex items-center gap-2 bg-red-100 border border-red-300 rounded-sm px-3 py-2 text-xs text-red-800 font-semibold">
          <AlertTriangle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* Rollover button */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          {status === 'loading'
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
            : <><RotateCcw className="w-3.5 h-3.5" /> Roll Over Weekend</>}
        </button>
      ) : (
        <div className="bg-white border border-amber-300 rounded-sm p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs uppercase">
            <AlertTriangle className="w-4 h-4" />
            Confirm Weekend Rollover
          </div>
          <p className="text-xs text-slate-600">
            This will <strong>archive</strong> all current sign-ups and <strong>clear the roster sheets</strong> so officers can sign up for the next weekend.
            This cannot be undone (but you can view archived data in History).
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Weekend label (for history records)</label>
            <input
              type="text"
              value={weekendLabel}
              onChange={e => setWeekendLabel(e.target.value)}
              className="w-full border border-slate-300 rounded-sm px-2 py-1.5 text-xs font-mono"
              placeholder="e.g. May 15–18, 2026"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRollover}
              disabled={status === 'loading'}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {status === 'loading'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Archiving…</>
                : 'Yes, Roll Over'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-sm hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="border-t border-amber-200 pt-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">Archived Weekends — {activePeriod}</span>
            <button onClick={loadHistory} className="text-xs text-amber-600 hover:text-amber-800 font-semibold">Refresh</button>
          </div>

          {historyLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          )}

          {!historyLoading && history.length === 0 && (
            <p className="text-xs text-slate-500 italic py-2">No weekends archived yet for this period.</p>
          )}

          {!historyLoading && history.map(entry => (
            <div key={entry.id} className="bg-white border border-amber-100 rounded-sm text-xs">
              <button
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-50 transition-colors"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div className="flex items-center gap-2 text-left">
                  <Calendar className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800">{entry.weekend_label}</span>
                    <span className="ml-2 text-slate-400">{entry.period}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {entry.total_signups} sign-ups
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.archived_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {expandedId === entry.id
                    ? <ChevronUp className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />}
                </div>
              </button>

              {expandedId === entry.id && (
                <div className="px-3 pb-3 border-t border-amber-100 pt-2 space-y-1">
                  {Object.entries(entry.sheet_counts || {}).length === 0
                    ? <p className="text-slate-400 italic">No signups were recorded.</p>
                    : Object.entries(entry.sheet_counts).map(([key, count]) => {
                        const [day, type] = key.split('/');
                        return (
                          <div key={key} className="flex items-center justify-between py-0.5">
                            <span className="text-slate-600">
                              <span className="font-semibold">{DAY_LABELS[day] || day}</span>
                              {' · '}
                              {TYPE_LABELS[type] || type}
                            </span>
                            <span className="font-bold text-slate-800">{count} officer{count !== 1 ? 's' : ''}</span>
                          </div>
                        );
                      })}
                  <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between font-bold text-slate-800">
                    <span>Total</span>
                    <span>{entry.total_signups} officer sign-ups</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
