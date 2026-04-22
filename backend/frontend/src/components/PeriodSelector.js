import React from 'react';
import { Calendar } from 'lucide-react';

const PERIODS = [
  { id: 'ADJ', label: 'Adj. Week',  dates: 'Jan 1–7' },
  { id: 'P1',  label: 'Period 1',   dates: 'Jan 8–Feb 4' },
  { id: 'P2',  label: 'Period 2',   dates: 'Feb 5–Mar 4' },
  { id: 'P3',  label: 'Period 3',   dates: 'Mar 5–Apr 1' },
  { id: 'P4',  label: 'Period 4',   dates: 'Apr 2–29' },
  { id: 'P5',  label: 'Period 5',   dates: 'Apr 30–May 27' },
  { id: 'P6',  label: 'Period 6',   dates: 'May 28–Jun 24' },
  { id: 'P7',  label: 'Period 7',   dates: 'Jun 25–Jul 22' },
  { id: 'P8',  label: 'Period 8',   dates: 'Jul 23–Aug 19' },
  { id: 'P9',  label: 'Period 9',   dates: 'Aug 20–Sep 16' },
  { id: 'P10', label: 'Period 10',  dates: 'Sep 17–Oct 14' },
  { id: 'P11', label: 'Period 11',  dates: 'Oct 15–Nov 11' },
  { id: 'P12', label: 'Period 12',  dates: 'Nov 12–Dec 9' },
  { id: 'P13', label: 'Period 13',  dates: 'Dec 10–Jan 6' },
];

const PeriodSelector = ({ activePeriod, onChange, currentPeriod }) => {
  return (
    <div className="bg-slate-800 text-white print:hidden">
      <div className="max-w-[1400px] mx-auto px-4 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Period</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => onChange(p.id)}
                title={p.dates}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${
                  activePeriod === p.id
                    ? 'bg-white text-slate-900'
                    : currentPeriod === p.id
                    ? 'bg-slate-600 text-white ring-1 ring-slate-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {p.id === 'ADJ' ? 'ADJ' : p.id}
                {currentPeriod === p.id && activePeriod !== p.id && (
                  <span className="ml-1 text-slate-300">•</span>
                )}
              </button>
            ))}
          </div>
          {activePeriod && (
            <span className="text-xs text-slate-300 ml-2">
              {PERIODS.find(p => p.id === activePeriod)?.label} —{' '}
              {PERIODS.find(p => p.id === activePeriod)?.dates}, 2026
              {activePeriod === currentPeriod && (
                <span className="ml-2 px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-sm uppercase">
                  Current
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeriodSelector;
