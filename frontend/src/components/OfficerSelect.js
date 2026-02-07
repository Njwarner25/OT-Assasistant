import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Keyboard } from 'lucide-react';

const OfficerSelect = ({ officers, selectedOfficerId, selectedAssignment, onSelect, disabled, testId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // For regular officers, find in list. For manual entries, use assignment data
  const isManualEntry = selectedAssignment?.isManual || (selectedOfficerId && selectedOfficerId.startsWith('manual-'));
  const selectedOfficer = isManualEntry
    ? { id: selectedOfficerId, last_name: selectedAssignment?.officer_display || '', isManual: true }
    : officers.find(o => o.id === selectedOfficerId);

  const filteredOfficers = officers.filter(officer => {
    const searchLower = search.toLowerCase();
    return (
      officer.last_name.toLowerCase().includes(searchLower) ||
      officer.first_name.toLowerCase().includes(searchLower) ||
      officer.star.includes(search)
    );
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (officer) => {
    onSelect(officer);
    setIsOpen(false);
    setSearch('');
    setManualMode(false);
    setManualName('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSelect(null);
    setManualName('');
    setManualMode(false);
  };

  const handleManualEntry = () => {
    if (manualName.trim()) {
      // Create a manual entry object
      const manualOfficer = {
        id: `manual-${Date.now()}`,
        last_name: manualName.trim().toUpperCase(),
        first_name: '',
        star: 'MANUAL',
        seniority_date: 'N/A',
        isManual: true
      };
      onSelect(manualOfficer);
      setIsOpen(false);
      setManualMode(false);
      setManualName('');
    }
  };

  const handleManualKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleManualEntry();
    }
  };

  // Determine display value
  let displayValue = '';
  if (selectedOfficer) {
    if (selectedOfficer.isManual) {
      displayValue = selectedOfficer.last_name;
    } else {
      displayValue = `${selectedOfficer.last_name}, ${selectedOfficer.first_name}`;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full print:static" data-testid={testId} style={{ zIndex: isOpen ? 99999 : 1 }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-sm text-xs text-left transition-colors print:border-black print:hidden ${
          disabled ? 'bg-slate-100 cursor-not-allowed opacity-70' : 'hover:border-slate-400'
        }`}
        data-testid={`${testId}-trigger`}
      >
        <span className={selectedOfficer ? 'text-slate-900 truncate' : 'text-slate-400'}>
          {displayValue || 'Select officer...'}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedOfficer && (
            <X 
              className="w-3 h-3 text-slate-400 hover:text-slate-600" 
              onClick={handleClear}
            />
          )}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
      </button>

      {/* Print Display */}
      <span className="hidden print:block text-xs">
        {displayValue}
      </span>

      {/* Dropdown - Fixed positioning for better z-index behavior */}
      {isOpen && (
        <div 
          className="fixed bg-white border border-slate-300 rounded-sm shadow-2xl max-h-72 overflow-hidden"
          style={{ 
            zIndex: 999999,
            width: '300px',
            top: containerRef.current?.getBoundingClientRect().bottom + 4,
            left: Math.min(
              containerRef.current?.getBoundingClientRect().left,
              window.innerWidth - 310
            )
          }}
        >
          {/* Mode Toggle */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider ${!manualMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Search className="w-3 h-3 inline mr-1" />
              Select
            </button>
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider ${manualMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              data-testid={`${testId}-manual-toggle`}
            >
              <Keyboard className="w-3 h-3 inline mr-1" />
              Type Name
            </button>
          </div>

          {manualMode ? (
            /* Manual Entry Mode */
            <div className="p-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                Enter Officer Name Manually
              </label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyPress={handleManualKeyPress}
                placeholder="Type name here..."
                className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-slate-900"
                autoFocus
                data-testid={`${testId}-manual-input`}
              />
              <button
                type="button"
                onClick={handleManualEntry}
                disabled={!manualName.trim()}
                className="w-full mt-2 px-3 py-2 bg-slate-900 text-white text-xs font-semibold uppercase rounded-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`${testId}-manual-confirm`}
              >
                Confirm Entry
              </button>
              <p className="text-[10px] text-slate-400 mt-2">
                Use this option for officers not in the roster
              </p>
            </div>
          ) : (
            /* Dropdown Selection Mode */
            <>
              {/* Search Input */}
              <div className="p-2 border-b border-slate-200">
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-200 rounded-sm">
                  <Search className="w-3 h-3 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or star..."
                    className="flex-1 bg-transparent text-xs outline-none"
                    data-testid={`${testId}-search`}
                  />
                </div>
              </div>

              {/* Options List */}
              <div className="max-h-48 overflow-y-auto">
                {filteredOfficers.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">
                    No officers found
                  </div>
                ) : (
                  filteredOfficers.map((officer) => (
                    <button
                      key={officer.id}
                      type="button"
                      onClick={() => handleSelect(officer)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-100 transition-colors border-b border-slate-100 last:border-b-0 ${
                        selectedOfficerId === officer.id ? 'bg-slate-900 text-white hover:bg-slate-800' : ''
                      }`}
                      data-testid={`${testId}-option-${officer.id}`}
                    >
                      <div className="font-mono">
                        {officer.last_name}, {officer.first_name} — {officer.star} — {officer.seniority_date}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OfficerSelect;
