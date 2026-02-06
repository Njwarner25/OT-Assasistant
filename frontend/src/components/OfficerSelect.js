import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const OfficerSelect = ({ officers, selectedOfficerId, onSelect, testId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOfficer = officers.find(o => o.id === selectedOfficerId);

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
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSelect(null);
  };

  const displayValue = selectedOfficer 
    ? `${selectedOfficer.last_name}, ${selectedOfficer.first_name}` 
    : '';

  return (
    <div ref={containerRef} className="relative w-full print:static" data-testid={testId}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-sm text-xs text-left hover:border-slate-400 transition-colors print:border-black print:hidden"
        data-testid={`${testId}-trigger`}
      >
        <span className={selectedOfficer ? 'text-slate-900' : 'text-slate-400'}>
          {displayValue || 'Select officer...'}
        </span>
        <div className="flex items-center gap-1">
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

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-slate-300 rounded-sm shadow-lg max-h-64 overflow-hidden">
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
        </div>
      )}
    </div>
  );
};

export default OfficerSelect;
