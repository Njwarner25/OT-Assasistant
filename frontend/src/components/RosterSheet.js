import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import OfficerSelect from './OfficerSelect';
import { AlertTriangle } from 'lucide-react';

const SHEET_CONFIG = {
  rdo: {
    title: 'OVERTIME WORKING — RDO 2000–0500',
    columns: ['a', 'b']
  },
  days_ext: {
    title: 'OVERTIME WORKING — 4HR EXT TOUR (2000–2100 DAYS EXT)',
    columns: ['a', 'b', 'c', 'd']
  },
  nights_ext: {
    title: 'OVERTIME WORKING — 4HR EXT TOUR (1600–2000 NIGHTS EXT)',
    columns: ['a', 'b', 'c', 'd', 'e', 'f']
  }
};

const RosterSheet = ({ sheetType }) => {
  const { sheets, updateSheet, officers, checkDuplicate } = useApp();
  const [localSheet, setLocalSheet] = useState(null);
  const config = SHEET_CONFIG[sheetType];

  useEffect(() => {
    if (sheets[sheetType]) {
      setLocalSheet(sheets[sheetType]);
    }
  }, [sheets, sheetType]);

  const saveSheet = useCallback(async (updatedSheet) => {
    setLocalSheet(updatedSheet);
    await updateSheet(sheetType, updatedSheet);
  }, [sheetType, updateSheet]);

  const handleSergeantChange = (field, value) => {
    if (!localSheet) return;
    const updated = { ...localSheet, [field]: value };
    saveSheet(updated);
  };

  const handleRowChange = (rowIndex, field, value) => {
    if (!localSheet) return;
    const updatedRows = [...localSheet.rows];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    const updated = { ...localSheet, rows: updatedRows };
    saveSheet(updated);
  };

  const handleOfficerSelect = (rowIndex, assignmentKey, officer) => {
    if (!localSheet) return;
    const updatedRows = [...localSheet.rows];
    let assignment = null;
    
    // Get current time in CST (Central Standard Time) - military format
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'America/Chicago' 
    });
    
    if (officer) {
      if (officer.isManual) {
        // Manual entry - just use the name they typed
        assignment = {
          officer_id: officer.id,
          officer_display: officer.last_name,
          star: '',
          seniority: '',
          timestamp: timestamp,
          isManual: true
        };
      } else {
        // Regular officer from roster
        assignment = {
          officer_id: officer.id,
          officer_display: `${officer.last_name}, ${officer.first_name} — ${officer.star} — ${officer.seniority_date}`,
          star: officer.star,
          seniority: officer.seniority_date,
          timestamp: timestamp,
          isManual: false
        };
      }
    }
    
    updatedRows[rowIndex] = { 
      ...updatedRows[rowIndex], 
      [`assignment_${assignmentKey}`]: assignment 
    };
    const updated = { ...localSheet, rows: updatedRows };
    saveSheet(updated);
  };

  const isDuplicate = (officerId) => {
    if (!officerId) return false;
    return checkDuplicate(officerId);
  };

  if (!localSheet) {
    return <div className="text-slate-500">Loading sheet...</div>;
  }

  return (
    <div className="bg-white rounded-sm border border-slate-300 shadow-sm print:shadow-none print:border-black" data-testid={`roster-sheet-${sheetType}`}>
      {/* Sheet Header */}
      <div className="p-4 border-b-2 border-slate-900 print:border-black">
        <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase border-b-2 border-slate-900 pb-1 mb-4 font-['Chivo']">
          {config.title}
        </h2>
        
        {/* Sergeant Info */}
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sergeant:</label>
            <input
              type="text"
              value={localSheet.sergeant_name || ''}
              onChange={(e) => handleSergeantChange('sergeant_name', e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-sm text-sm font-mono w-48 print:border-black"
              placeholder="Enter name"
              data-testid="sergeant-name-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Star#:</label>
            <input
              type="text"
              value={localSheet.sergeant_star || ''}
              onChange={(e) => handleSergeantChange('sergeant_star', e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-sm text-sm font-mono w-24 print:border-black"
              placeholder="#####"
              data-testid="sergeant-star-input"
            />
          </div>
          <div className="text-xs text-slate-400 self-center print:hidden">
            Generated: {new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} CST
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs font-mono" data-testid="roster-table">
          <thead>
            <tr className="bg-slate-100 print:bg-gray-200">
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-12 print:border-black">Team</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-20 print:border-black">Officer #</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-32 print:border-black">Location</th>
              {config.columns.map(col => (
                <React.Fragment key={col}>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 min-w-[180px] print:border-black">{col.toUpperCase()}</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-16 print:border-black">Star</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-24 print:border-black">Sen</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-20 print:border-black">Time</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {localSheet.rows.map((row, rowIndex) => (
              <tr key={row.id} className="even:bg-slate-50 print:even:bg-white hover:bg-slate-100 print:hover:bg-white" data-testid={`row-${rowIndex}`}>
                <td className="p-2 border border-slate-300 text-center font-bold text-slate-700 print:border-black">
                  {row.team}
                </td>
                <td className="p-2 border border-slate-300 print:border-black">
                  <input
                    type="text"
                    value={row.officer_number || ''}
                    onChange={(e) => handleRowChange(rowIndex, 'officer_number', e.target.value)}
                    className="w-full px-1 py-0.5 border border-slate-200 rounded-sm text-xs print:border-black"
                    data-testid={`officer-number-${rowIndex}`}
                  />
                </td>
                <td className="p-2 border border-slate-300 print:border-black">
                  <input
                    type="text"
                    value={row.deployment_location || ''}
                    onChange={(e) => handleRowChange(rowIndex, 'deployment_location', e.target.value)}
                    className="w-full px-1 py-0.5 border border-slate-200 rounded-sm text-xs print:border-black"
                    data-testid={`deployment-location-${rowIndex}`}
                  />
                </td>
                {config.columns.map(col => {
                  const assignment = row[`assignment_${col}`];
                  const hasDuplicate = isDuplicate(assignment?.officer_id);
                  return (
                    <React.Fragment key={col}>
                      <td className={`p-1 border border-slate-300 print:border-black ${hasDuplicate ? 'bg-red-100 text-red-900' : ''}`}>
                        <div className="flex items-center gap-1">
                          {hasDuplicate && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                          <OfficerSelect
                            officers={officers}
                            selectedOfficerId={assignment?.officer_id}
                            selectedAssignment={assignment}
                            onSelect={(officer) => handleOfficerSelect(rowIndex, col, officer)}
                            testId={`select-${rowIndex}-${col}`}
                          />
                        </div>
                      </td>
                      <td className={`p-2 border border-slate-300 text-slate-900 print:border-black ${hasDuplicate ? 'bg-red-100' : ''}`}>
                        {assignment?.star || ''}
                      </td>
                      <td className={`p-2 border border-slate-300 text-slate-900 print:border-black ${hasDuplicate ? 'bg-red-100' : ''}`}>
                        {assignment?.seniority || ''}
                      </td>
                      <td className={`p-2 border border-slate-300 text-slate-600 print:border-black ${hasDuplicate ? 'bg-red-100' : ''}`}>
                        {assignment?.timestamp || ''}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between print:bg-white print:border-black">
        <span>Last Updated: {new Date(localSheet.updated_at).toLocaleString()}</span>
        <span>Sheet ID: {localSheet.id?.slice(0, 8)}</span>
      </div>
    </div>
  );
};

export default RosterSheet;
