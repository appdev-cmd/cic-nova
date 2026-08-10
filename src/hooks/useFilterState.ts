import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook quản lý trạng thái bộ lọc và lưu trữ tự động vào localStorage.
 * Giúp giữ nguyên bộ lọc khi F5 refresh trang.
 * 
 * @param storageKey Chìa khóa lưu vào localStorage (ví dụ: 'cic-nova-filters-project')
 * @param initialState Giá trị khởi tạo mặc định cho các bộ lọc
 */
export function useFilterState<T extends Record<string, any>>(
  storageKey: string,
  initialState: T
) {
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...initialState, ...parsed };
      }
    } catch (e) {
      console.warn(`[useFilterState] Lỗi đọc bộ lọc từ storage Key "${storageKey}":`, e);
    }
    return initialState;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (e) {
      console.warn(`[useFilterState] Lỗi ghi bộ lọc vào storage Key "${storageKey}":`, e);
    }
  }, [storageKey, filters]);

  const setFilters = useCallback((newFilters: T | ((prev: T) => T)) => {
    setFiltersState(newFilters);
  }, []);

  const updateFilter = useCallback(<K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) => {
    setFiltersState((prev) => ({
      ...prev,
      [key]: typeof value === 'function' ? (value as (p: T[K]) => T[K])(prev[key]) : value,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialState);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      // ignore
    }
  }, [initialState, storageKey]);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
  };
}
