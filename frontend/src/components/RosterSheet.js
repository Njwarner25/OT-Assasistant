import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import OfficerSelect from './OfficerSelect';
import { AlertTriangle, Lock, LockOpen } from 'lucide-react';

const SHEET_CONFIG = {
  rdo: {
    title: 'RDO 2000–0500',
    columns: ['a', 'b'],
    maxSlots: 12 // 6 rows x 2 columns
  },
  days_ext: {
    title: '4HR EXT TOUR (2000–2100 DAYS EXT)',
    columns: ['a', 'b', 'c', 'd'],
    maxSlots: 16 // 4 rows x 4 columns
  },
  nights_ext: {
    title: '4HR EXT TOUR (1600–2000 NIGHTS EXT)',
    columns: ['a', 'b', 'c', 'd', 'e', 'f'],
    maxSlots: 36 // 6 rows x 6 columns
  }
};

const DAY_LABELS = {
  friday: 'FRIDAY',
  saturday: 'SATURDAY',
  sunday: 'SUNDAY'
};

// Helper to parse seniority date for comparison
const parseSeniorityDate = (dateStr) => {
  if (!dateStr || dateStr === 'N/A') return new Date('2099-12-31');
  const parts = dateStr.split('/');
  if (parts.length !== 3) return new Date('2099-12-31');
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
};

const RosterSheet = ({ day, sheetType }) => {
  const { sheets, updateSheet, officers, checkDuplicate, addBumpedOfficer, isAuthenticated, lockSheet, unlockSheet } = useApp();
  const [localSheet, setLocalSheet] = useState(null);
  const config = SHEET_CONFIG[sheetType];

  useEffect(() => {
    if (sheets[day]?.[sheetType]) {
      setLocalSheet(sheets[day][sheetType]);
    }
  }, [sheets, day, sheetType]);

  const saveSheet = useCallback(async (updatedSheet) => {
    setLocalSheet(updatedSheet);
    await updateSheet(day, sheetType, updatedSheet);
  }, [day, sheetType, updateSheet]);

  const handleSergeantChange = (field, value) => {
    if (!localSheet || localSheet.locked) return;
    const updated = { ...localSheet, [field]: value };
    saveSheet(updated);
  };

  const handleRowChange = (rowIndex, field, value) => {
    if (!localSheet || localSheet.locked) return;
    const updatedRows = [...localSheet.rows];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    const updated = { ...localSheet, rows: updatedRows };
    saveSheet(updated);
  };

  // Get all current assignments and find the one with lowest seniority
  const getAllAssignments = useCallback(() => {
    if (!localSheet) return [];
    const assignments = [];
    localSheet.rows.forEach((row, rowIndex) => {
      config.columns.forEach(col => {
        const assignment = row[`assignment_${col}`];
        if (assignment?.officer_id && !assignment.isManual) {
          assignments.push({
            rowIndex,
            col,
            assignment,
            seniorityDate: parseSeniorityDate(assignment.seniority)
          });
        }
      });
    });
    return assignments;
  }, [localSheet, config.columns]);

  const getFilledSlotCount = useCallback(() => {
    return getAllAssignments().length;
  }, [getAllAssignments]);

  const findLowestSeniorityAssignment = useCallback(() => {
    const assignments = getAllAssignments();
    if (assignments.length === 0) return null;
    
    // Sort by seniority date descending (most recent = lowest seniority)
    assignments.sort((a, b) => b.seniorityDate - a.seniorityDate);
    return assignments[0]; // Return the one with most recent (lowest seniority) date
  }, [getAllAssignments]);

  const handleOfficerSelect = async (rowIndex, assignmentKey, officer) => {
    if (!localSheet || localSheet.locked) return;
    
    const updatedRows = [...localSheet.rows];
    let assignment = null;
    
    // Get current time in CST military format
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'America/Chicago' 
    });
    
    if (officer) {
      if (officer.isManual) {
        assignment = {
          officer_id: officer.id,
          officer_display: officer.last_name,
          star: '',
          seniority: '',
          timestamp: timestamp,
          isManual: true
        };
      } else {
        // Check if all slots are filled and this is a new entry
        const currentAssignment = updatedRows[rowIndex][`assignment_${assignmentKey}`];
        const isNewEntry = !currentAssignment?.officer_id;
        const filledSlots = getFilledSlotCount();
        
        // If all slots are filled and this is a new entry, check seniority
        if (isNewEntry && filledSlots >= config.maxSlots) {
          const lowestSeniority = findLowestSeniorityAssignment();
          const newOfficerSeniority = parseSeniorityDate(officer.seniority_date);
          
          if (lowestSeniority && newOfficerSeniority < lowestSeniority.seniorityDate) {
            // New officer has more seniority - bump the lowest
            const bumpedAssignment = lowestSeniority.assignment;
            
            // Record the bumped officer
            await addBumpedOfficer({
              officer_id: bumpedAssignment.officer_id,
              officer_name: bumpedAssignment.officer_display?.split(' — ')[0] || '',
              officer_star: bumpedAssignment.star || '',
              officer_seniority: bumpedAssignment.seniority || '',
              bumped_by_name: `${officer.last_name}, ${officer.first_name}`,
              bumped_by_star: officer.star,
              bumped_by_seniority: officer.seniority_date,
              day: day,
              sheet_type: sheetType,
              assignment_slot: `Row ${lowestSeniority.rowIndex + 1}, Column ${lowestSeniority.col.toUpperCase()}`
            });
            
            // Clear the bumped officer's slot
            updatedRows[lowestSeniority.rowIndex] = {
              ...updatedRows[lowestSeniority.rowIndex],
              [`assignment_${lowestSeniority.col}`]: null
            };
          } else {
            // New officer doesn't have more seniority - reject
            alert(`Cannot add ${officer.last_name}, ${officer.first_name}. All slots are filled and they do not have more seniority than current officers.`);
            return;
          }
        }
        
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

  const handleLockToggle = async () => {
    if (localSheet?.locked) {
      await unlockSheet(day, sheetType);
    } else {
      await lockSheet(day, sheetType);
    }
  };

  if (!localSheet) {
    return <div className="text-slate-500">Loading sheet...</div>;
  }

  const filledSlots = getFilledSlotCount();
  const isSheetFull = filledSlots >= config.maxSlots;

  return (
    <div className="bg-white rounded-sm border border-slate-300 shadow-sm print:shadow-none print:border-black" data-testid={`roster-sheet-${day}-${sheetType}`}>
      {/* Sheet Header */}
      <div className="p-4 border-b-2 border-slate-900 print:border-black">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase border-b-2 border-slate-900 pb-1 font-['Chivo']">
            {DAY_LABELS[day]} — OVERTIME WORKING — {config.title}
          </h2>
          
          {/* Lock Status & Control */}
          <div className="flex items-center gap-3 print:hidden">
            <span className={`text-xs font-semibold uppercase px-2 py-1 rounded ${isSheetFull ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {filledSlots}/{config.maxSlots} Slots Filled
            </span>
            
            {localSheet.locked && (
              <span className="flex items-center gap-1 text-xs font-semibold uppercase px-2 py-1 rounded bg-red-100 text-red-700">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
            
            {isAuthenticated && (
              <button
                onClick={handleLockToggle}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold uppercase rounded transition-colors ${
                  localSheet.locked 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                data-testid="lock-toggle-button"
              >
                {localSheet.locked ? (
                  <>
                    <LockOpen className="w-3 h-3" />
                    Unlock
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3" />
                    Lock
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Locked Warning */}
        {localSheet.locked && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            This sheet is locked. Only admins can unlock it to make changes.
          </div>
        )}
        
        {/* Sergeant Info */}
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sergeant:</label>
            <input
              type="text"
              value={localSheet.sergeant_name || ''}
              onChange={(e) => handleSergeantChange('sergeant_name', e.target.value)}
              disabled={localSheet.locked}
              className={`px-3 py-1 border border-slate-300 rounded-sm text-sm font-mono w-48 print:border-black ${localSheet.locked ? 'bg-slate-100 cursor-not-allowed' : ''}`}
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
              disabled={localSheet.locked}
              className={`px-3 py-1 border border-slate-300 rounded-sm text-sm font-mono w-24 print:border-black ${localSheet.locked ? 'bg-slate-100 cursor-not-allowed' : ''}`}
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
                    disabled={localSheet.locked}
                    className={`w-full px-1 py-0.5 border border-slate-200 rounded-sm text-xs print:border-black ${localSheet.locked ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                    data-testid={`officer-number-${rowIndex}`}
                  />
                </td>
                <td className="p-2 border border-slate-300 print:border-black">
                  <input
                    type="text"
                    value={row.deployment_location || ''}
                    onChange={(e) => handleRowChange(rowIndex, 'deployment_location', e.target.value)}
                    disabled={localSheet.locked}
                    className={`w-full px-1 py-0.5 border border-slate-200 rounded-sm text-xs print:border-black ${localSheet.locked ? 'bg-slate-100 cursor-not-allowed' : ''}`}
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
                            disabled={localSheet.locked}
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
