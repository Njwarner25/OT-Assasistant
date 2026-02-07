import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import OfficerSelect from './OfficerSelect';
import { AlertTriangle, Lock, LockOpen, Clock, XCircle } from 'lucide-react';

const SHEET_CONFIG = {
  rdo: {
    title: 'RDO 2000–0500',
    teams: ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E'],
    maxSlots: 10
  },
  days_ext: {
    title: '4HR EXT TOUR (2000–2100 DAYS EXT)',
    teams: ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E'],
    maxSlots: 10
  },
  nights_ext: {
    title: '4HR EXT TOUR (1600–2000 NIGHTS EXT)',
    teams: ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E'],
    maxSlots: 10
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

// Helper to format datetime for display in CST
const formatDeadline = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' CST';
};

// Check if deadline has passed
const isDeadlinePassed = (isoString) => {
  if (!isoString) return false;
  const deadline = new Date(isoString);
  const now = new Date();
  return now > deadline;
};

// Get time remaining until deadline
const getTimeRemaining = (isoString) => {
  if (!isoString) return null;
  const deadline = new Date(isoString);
  const now = new Date();
  const diff = deadline - now;
  
  if (diff <= 0) return null;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  return `${hours}h ${minutes}m remaining`;
};

const RosterSheet = ({ day, sheetType }) => {
  const { sheets, updateSheet, officers, checkDuplicate, addBumpedOfficer, isAuthenticated, lockSheet, unlockSheet, setAutoLock } = useApp();
  const [localSheet, setLocalSheet] = useState(null);
  const [showAutoLockModal, setShowAutoLockModal] = useState(false);
  const [autoLockDate, setAutoLockDate] = useState('');
  const [autoLockTime, setAutoLockTime] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null);
  const config = SHEET_CONFIG[sheetType];

  useEffect(() => {
    if (sheets[day]?.[sheetType]) {
      setLocalSheet(sheets[day][sheetType]);
    }
  }, [sheets, day, sheetType]);

  // Update time remaining every minute
  useEffect(() => {
    if (localSheet?.auto_lock_enabled && localSheet?.auto_lock_time) {
      const updateRemaining = () => {
        setTimeRemaining(getTimeRemaining(localSheet.auto_lock_time));
      };
      updateRemaining();
      const interval = setInterval(updateRemaining, 60000);
      return () => clearInterval(interval);
    }
  }, [localSheet?.auto_lock_enabled, localSheet?.auto_lock_time]);

  const saveSheet = useCallback(async (updatedSheet) => {
    setLocalSheet(updatedSheet);
    await updateSheet(day, sheetType, updatedSheet);
  }, [day, sheetType, updateSheet]);

  // Check if sheet is locked (either manually or auto-locked)
  const isSheetLocked = useCallback(() => {
    if (!localSheet) return false;
    if (localSheet.locked) return true;
    if (localSheet.auto_lock_enabled && localSheet.auto_lock_time) {
      return isDeadlinePassed(localSheet.auto_lock_time);
    }
    return false;
  }, [localSheet]);

  const handleSergeantChange = (field, value) => {
    if (!localSheet || isSheetLocked()) return;
    const updated = { ...localSheet, [field]: value };
    saveSheet(updated);
  };

  const handleRowChange = (rowIndex, field, value) => {
    if (!localSheet || isSheetLocked()) return;
    const updatedRows = [...localSheet.rows];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    const updated = { ...localSheet, rows: updatedRows };
    saveSheet(updated);
  };

  // Get all current assignments
  const getAllAssignments = useCallback(() => {
    if (!localSheet) return [];
    const assignments = [];
    localSheet.rows.forEach((row, rowIndex) => {
      const assignment = row.assignment_a;
      if (assignment?.officer_id && !assignment.isManual) {
        assignments.push({
          rowIndex,
          assignment,
          seniorityDate: parseSeniorityDate(assignment.seniority)
        });
      }
    });
    return assignments;
  }, [localSheet]);

  const getFilledSlotCount = useCallback(() => {
    return getAllAssignments().length;
  }, [getAllAssignments]);

  const findLowestSeniorityAssignment = useCallback(() => {
    const assignments = getAllAssignments();
    if (assignments.length === 0) return null;
    
    // Sort by seniority date descending (most recent = lowest seniority)
    assignments.sort((a, b) => b.seniorityDate - a.seniorityDate);
    return assignments[0];
  }, [getAllAssignments]);

  // Check if officer is already assigned on this day (any sheet type)
  const isOfficerOnDay = useCallback((officerId) => {
    if (!officerId) return false;
    const daySheets = sheets[day];
    if (!daySheets) return false;
    for (const type of Object.keys(daySheets)) {
      const sheet = daySheets[type];
      if (sheet?.rows) {
        for (const row of sheet.rows) {
          if (row.assignment_a?.officer_id === officerId) return true;
        }
      }
    }
    return false;
  }, [sheets, day]);

  const handleOfficerSelect = async (rowIndex, officer) => {
    if (!localSheet || isSheetLocked()) return;
    
    const updatedRows = [...localSheet.rows];
    let assignment = null;
    
    // Get current date+time in CST military format
    const timestamp = new Date().toLocaleString('en-US', { 
      hour12: false, 
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'America/Chicago' 
    });
    
    if (officer) {
      // Block same officer from being used twice on the same day
      if (!officer.isManual && officer.id && isOfficerOnDay(officer.id)) {
        alert(`${officer.last_name}, ${officer.first_name} is already signed up on ${day.toUpperCase()}. An officer cannot be assigned twice on the same day.`);
        return;
      }

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
        const currentAssignment = updatedRows[rowIndex].assignment_a;
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
              assignment_slot: `Row ${lowestSeniority.rowIndex + 1}, Team ${localSheet.rows[lowestSeniority.rowIndex].team}`
            });
            
            // Clear the bumped officer's slot
            updatedRows[lowestSeniority.rowIndex] = {
              ...updatedRows[lowestSeniority.rowIndex],
              assignment_a: null
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
      assignment_a: assignment 
    };
    const updated = { ...localSheet, rows: updatedRows };
    saveSheet(updated);
  };

  const isDuplicate = (officerId) => {
    if (!officerId) return false;
    return checkDuplicate(officerId, day);
  };

  const handleLockToggle = async () => {
    if (localSheet?.locked) {
      await unlockSheet(day, sheetType);
    } else {
      await lockSheet(day, sheetType);
    }
  };

  const handleSetAutoLock = async () => {
    if (autoLockDate && autoLockTime) {
      const dateTimeStr = `${autoLockDate}T${autoLockTime}:00`;
      const localDate = new Date(dateTimeStr);
      const isoString = localDate.toISOString();
      
      await setAutoLock(day, sheetType, isoString, true);
      setShowAutoLockModal(false);
      setAutoLockDate('');
      setAutoLockTime('');
    }
  };

  const handleDisableAutoLock = async () => {
    await setAutoLock(day, sheetType, null, false);
    setShowAutoLockModal(false);
  };

  if (!localSheet) {
    return <div className="text-slate-500">Loading sheet...</div>;
  }

  const filledSlots = getFilledSlotCount();
  const isSheetFull = filledSlots >= config.maxSlots;
  const locked = isSheetLocked();
  const deadlinePassed = localSheet.auto_lock_enabled && localSheet.auto_lock_time && isDeadlinePassed(localSheet.auto_lock_time);

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
            
            {/* Auto-lock countdown */}
            {localSheet.auto_lock_enabled && localSheet.auto_lock_time && !deadlinePassed && timeRemaining && (
              <span className="flex items-center gap-1 text-xs font-semibold uppercase px-2 py-1 rounded bg-orange-100 text-orange-700">
                <Clock className="w-3 h-3" />
                {timeRemaining}
              </span>
            )}
            
            {locked && (
              <span className="flex items-center gap-1 text-xs font-semibold uppercase px-2 py-1 rounded bg-red-100 text-red-700">
                <Lock className="w-3 h-3" />
                {deadlinePassed ? 'Deadline Passed' : 'Locked'}
              </span>
            )}
            
            {isAuthenticated && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAutoLockModal(true)}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold uppercase rounded bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                  data-testid="auto-lock-button"
                >
                  <Clock className="w-3 h-3" />
                  Set Deadline
                </button>
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
                      Lock Now
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Deadline Passed Warning */}
        {deadlinePassed && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded text-red-800 flex items-center gap-3">
            <XCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <div className="font-bold text-sm">DEADLINE HAS PASSED</div>
              <div className="text-xs mt-1">
                Overtime entries closed at {formatDeadline(localSheet.auto_lock_time)}. 
                You missed the deadline and can no longer sign up for this shift.
              </div>
            </div>
          </div>
        )}
        
        {/* Manual Locked Warning */}
        {localSheet.locked && !deadlinePassed && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            This sheet is locked. Only admins can unlock it to make changes.
          </div>
        )}
        
        {/* Auto-lock scheduled notice */}
        {localSheet.auto_lock_enabled && localSheet.auto_lock_time && !deadlinePassed && (
          <div className="mb-4 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>
              <strong>Entry Deadline:</strong> {formatDeadline(localSheet.auto_lock_time)}
              {timeRemaining && <span className="ml-2">({timeRemaining})</span>}
            </span>
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
              disabled={locked}
              className={`px-3 py-1 border border-slate-300 rounded-sm text-sm font-mono w-48 print:border-black ${locked ? 'bg-slate-100 cursor-not-allowed' : ''}`}
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
              disabled={locked}
              className={`px-3 py-1 border border-slate-300 rounded-sm text-sm font-mono w-24 print:border-black ${locked ? 'bg-slate-100 cursor-not-allowed' : ''}`}
              placeholder="#####"
              data-testid="sergeant-star-input"
            />
          </div>
          <div className="text-xs text-slate-400 self-center print:hidden">
            Generated: {new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} CST
          </div>
        </div>
      </div>

      {/* Auto-Lock Modal */}
      {showAutoLockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-bold text-slate-800 uppercase mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Set Entry Deadline
            </h3>
            
            {localSheet.auto_lock_enabled && localSheet.auto_lock_time && (
              <div className="mb-4 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                Current deadline: {formatDeadline(localSheet.auto_lock_time)}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Deadline Date
                </label>
                <input
                  type="date"
                  value={autoLockDate}
                  onChange={(e) => setAutoLockDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm"
                  data-testid="auto-lock-date"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Deadline Time (CST)
                </label>
                <input
                  type="time"
                  value={autoLockTime}
                  onChange={(e) => setAutoLockTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm"
                  data-testid="auto-lock-time"
                />
              </div>
              <p className="text-xs text-slate-500">
                Officers will see a countdown and won't be able to sign up after this deadline.
              </p>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSetAutoLock}
                disabled={!autoLockDate || !autoLockTime}
                className="flex-1 py-2 bg-orange-600 text-white font-semibold text-sm rounded-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="confirm-auto-lock"
              >
                Set Deadline
              </button>
              {localSheet.auto_lock_enabled && (
                <button
                  onClick={handleDisableAutoLock}
                  className="px-4 py-2 bg-red-100 text-red-700 font-semibold text-sm rounded-sm hover:bg-red-200 transition-colors"
                  data-testid="disable-auto-lock"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => setShowAutoLockModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold text-sm rounded-sm hover:bg-slate-300 transition-colors"
                data-testid="cancel-auto-lock"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table - Simplified with single officer column per row */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs font-mono" data-testid="roster-table">
          <thead>
            <tr className="bg-slate-100 print:bg-gray-200">
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-16 print:border-black">Team</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-20 print:border-black">BT#</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-32 print:border-black">Location</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 min-w-[200px] print:border-black">Officer</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-16 print:border-black">Star</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-24 print:border-black">Seniority</th>
              <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-2 border border-slate-300 w-36 print:border-black">Date/Time</th>
            </tr>
          </thead>
          <tbody>
            {localSheet.rows.map((row, rowIndex) => {
              const assignment = row.assignment_a;
              const hasDuplicate = isDuplicate(assignment?.officer_id);
              const isEntryFilled = !!assignment?.officer_id;
              const isEntryLocked = isEntryFilled && !isAuthenticated;
              const rowBg = hasDuplicate ? 'bg-red-100' : isEntryFilled ? 'bg-green-50' : (rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50');
              return (
                <tr key={row.id} className={`${rowBg} print:bg-white`} data-testid={`row-${rowIndex}`}>
                  <td className="p-2 border border-slate-300 text-center font-bold text-slate-700 print:border-black">
                    {row.team}
                  </td>
                  <td className="p-2 border border-slate-300 print:border-black">
                    <input
                      type="text"
                      value={row.officer_number || ''}
                      onChange={(e) => handleRowChange(rowIndex, 'officer_number', e.target.value)}
                      disabled={locked || isEntryLocked}
                      className={`w-full px-1 py-0.5 border border-slate-200 rounded-sm text-xs print:border-black ${(locked || isEntryLocked) ? 'bg-transparent cursor-not-allowed' : ''}`}
                      data-testid={`officer-number-${rowIndex}`}
                    />
                  </td>
                  <td className="p-2 border border-slate-300 print:border-black">
                    <input
                      type="text"
                      value={row.deployment_location || ''}
                      onChange={(e) => handleRowChange(rowIndex, 'deployment_location', e.target.value)}
                      disabled={locked || isEntryLocked}
                      className={`w-full px-1 py-0.5 border border-slate-200 rounded-sm text-xs print:border-black ${(locked || isEntryLocked) ? 'bg-transparent cursor-not-allowed' : ''}`}
                      data-testid={`deployment-location-${rowIndex}`}
                    />
                  </td>
                  <td className={`p-1 border border-slate-300 print:border-black ${hasDuplicate ? 'text-red-900' : ''}`}>
                    <div className="flex items-center gap-1">
                      {hasDuplicate && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                      <OfficerSelect
                        officers={officers}
                        selectedOfficerId={assignment?.officer_id}
                        selectedAssignment={assignment}
                        onSelect={(officer) => handleOfficerSelect(rowIndex, officer)}
                        disabled={locked || isEntryLocked}
                        testId={`select-${rowIndex}`}
                      />
                    </div>
                  </td>
                  <td className={`p-2 border border-slate-300 text-slate-900 print:border-black`}>
                    {assignment?.star || ''}
                  </td>
                  <td className={`p-2 border border-slate-300 text-slate-900 print:border-black`}>
                    {assignment?.seniority || ''}
                  </td>
                  <td className={`p-2 border border-slate-300 text-slate-600 print:border-black`}>
                    {assignment?.timestamp || ''}
                  </td>
                </tr>
              );
            })}
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
