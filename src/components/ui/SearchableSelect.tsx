import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, ChevronDown, Plus } from 'lucide-react';
import { removeDiacritics } from '../../utils/formatters';

export interface Option {
  id: string;
  name: string;
  subText?: string;
  badge?: string;
  badgeColor?: string;
  searchText?: string;
}

export interface SearchableSelectProps {
  value: string | null;
  onChange: (id: string | null, option?: Option) => void;
  onSearch?: (query: string) => Promise<Option[]>;
  options?: Option[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  initialOptions?: Option[];
  getDisplayValue?: (id: string) => string | undefined;
  onAddNew?: () => void;
  addNewLabel?: string;
  extraActions?: { label: string; onClick: () => void; icon?: React.ReactNode; className?: string }[];
  size?: 'sm' | 'md';
  dropdownMinWidth?: number;
  className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  onSearch,
  options: staticOptions,
  placeholder = 'Chọn...',
  label,
  disabled = false,
  initialOptions = [],
  getDisplayValue,
  onAddNew,
  addNewLabel = 'Thêm mới',
  extraActions,
  size = 'md',
  dropdownMinWidth = 280,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [asyncOptions, setAsyncOptions] = useState<Option[]>(initialOptions);
  const [isLoading, setIsLoading] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<any>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ top: 0, left: 0, width: 280 });

  const filteredOptions = useMemo(() => {
    const q = query.trim();
    const baseOptions = (staticOptions && staticOptions.length > 0) ? staticOptions : initialOptions;

    if (baseOptions && baseOptions.length > 0) {
      if (!q) return baseOptions;
      const qNorm = removeDiacritics(q).toLowerCase();
      return baseOptions.filter(opt => {
        const nameNorm = removeDiacritics(opt.name || '').toLowerCase();
        const subNorm = removeDiacritics(opt.subText || '').toLowerCase();
        const searchNorm = opt.searchText ? removeDiacritics(opt.searchText).toLowerCase() : '';
        return nameNorm.includes(qNorm) || subNorm.includes(qNorm) || searchNorm.includes(qNorm);
      });
    }

    if (!q) return asyncOptions;

    if (onSearch && q.length >= 2) {
      return asyncOptions;
    }

    return asyncOptions;
  }, [onSearch, asyncOptions, staticOptions, initialOptions, query]);

  useEffect(() => {
    let newDisplay = '';
    let newOption: Option | null = selectedOption;

    if (value !== undefined && value !== null && value !== '') {
      if (getDisplayValue) {
        const customDisplay = getDisplayValue(value);
        if (customDisplay) {
          newDisplay = customDisplay;
        }
      }

      if (!newDisplay) {
        if (selectedOption && selectedOption.id === value) {
          newDisplay = selectedOption.name;
        } else {
          const searchList = staticOptions || (asyncOptions.length ? asyncOptions : initialOptions);
          const found = searchList.find(o => o.id === value) || initialOptions.find(o => o.id === value);
          if (found) {
            newOption = found;
            newDisplay = found.name;
          } else if (selectedOption && selectedOption.name) {
            newDisplay = selectedOption.name;
          } else {
            newDisplay = value;
          }
        }
      }
    } else {
      newOption = null;
      newDisplay = '';
    }

    if (displayValue !== newDisplay) {
      setDisplayValue(newDisplay);
    }
    if (selectedOption?.id !== newOption?.id || selectedOption?.name !== newOption?.name) {
      setSelectedOption(newOption);
    }
  }, [value, staticOptions, asyncOptions, initialOptions, getDisplayValue]);

  useEffect(() => {
    const base = (staticOptions && staticOptions.length > 0) ? staticOptions : initialOptions;
    if (onSearch && (!query || query.length < 2)) {
      const isDifferent = base.length !== asyncOptions.length ||
        base.some((opt, idx) => opt.id !== asyncOptions[idx]?.id || opt.name !== asyncOptions[idx]?.name);
      if (isDifferent) {
        setAsyncOptions(base);
      }
    }
  }, [onSearch, staticOptions, initialOptions, query, asyncOptions]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.max(rect.width, dropdownMinWidth);
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const dropdownHeight = 350;
      const gap = 4;

      let top: number | undefined = undefined;
      let bottom: number | undefined = undefined;

      if (rect.bottom + gap + dropdownHeight > viewportH && rect.top - gap - dropdownHeight > 0) {
        bottom = viewportH - rect.top + gap;
      } else {
        top = rect.bottom + gap;
      }

      let left = rect.left;
      if (left + width > viewportW - 8) {
        left = viewportW - width - 8;
      }
      left = Math.max(8, left);

      setDropdownPos({ top, bottom, left, width });
    }
  }, [dropdownMinWidth]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);

    if (!onSearch) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (newQuery.length < 2) {
      setAsyncOptions(initialOptions);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(newQuery);
        setAsyncOptions(results);
      } catch (err) {
        console.error('[SearchableSelect] Search error:', err);
        setAsyncOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, [onSearch, initialOptions]);

  const handleSelect = (option: Option) => {
    setSelectedOption(option);
    onChange(option.id, option);
    setDisplayValue(option.name);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOption(null);
    onChange(null);
    setDisplayValue('');
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg text-left text-sm font-medium transition-all ${
          size === 'sm' ? 'px-3 py-2' : 'px-4 py-2.5'
        } ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-cyan-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
        } ${isOpen ? 'border-cyan-500 ring-2 ring-cyan-500/20' : ''}`}
      >
        <span className={`truncate ${displayValue ? 'text-slate-100' : 'text-slate-400'}`}>
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
              className="p-1 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X size={14} className="text-slate-400" />
            </span>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            bottom: dropdownPos.bottom,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="p-2.5 border-b border-slate-800">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Gõ để tìm kiếm..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none transition-colors"
              />
              {isLoading && (
                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" />
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                Không tìm thấy kết quả
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors ${
                    value === option.id ? 'bg-cyan-950/40 text-cyan-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-bold ${
                      value === option.id ? 'text-cyan-400' : 'text-slate-200'
                    }`}>
                      {option.name}
                    </p>
                    {option.badge && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300">
                        {option.badge}
                      </span>
                    )}
                  </div>
                  {option.subText && (
                    <p className="text-xs text-slate-400 mt-0.5">{option.subText}</p>
                  )}
                </button>
              ))
            )}
          </div>

          {(onAddNew || (extraActions && extraActions.length > 0)) && (
            <div className="border-t border-slate-800 p-2 space-y-1.5">
              {onAddNew && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-400 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  {addNewLabel?.replace(/^\+\s*/, '')}
                </button>
              )}
              {extraActions?.map((act, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    act.onClick();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 font-bold text-xs rounded-lg transition-colors cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  {act.icon || <Plus size={14} />}
                  {act.label?.replace(/^\+\s*/, '')}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableSelect;
