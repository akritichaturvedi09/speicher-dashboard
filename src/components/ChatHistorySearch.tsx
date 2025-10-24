'use client';
import React, { useState, useCallback, useEffect } from 'react';
import type { ChatHistoryFilters, DurationCategory, MessageCountCategory } from '../types/chat-history';
import { DURATION_CATEGORIES, MESSAGE_COUNT_CATEGORIES } from '../types/chat-history';

interface ChatHistorySearchProps {
  filters: ChatHistoryFilters;
  onFiltersChange: (filters: Partial<ChatHistoryFilters>) => void;
  onClearFilters: () => void;
  loading?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export default function ChatHistorySearch({
  filters,
  onFiltersChange,
  onClearFilters,
  loading = false,
  expanded = false,
  onToggleExpanded,
}: ChatHistorySearchProps) {
  // Local state for debounced search
  const [searchInput, setSearchInput] = useState(filters.searchTerm || '');
  
  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput !== filters.searchTerm) {
        onFiltersChange({ searchTerm: searchInput || undefined });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput, filters.searchTerm, onFiltersChange]);

  // Update local search input when filters change externally
  useEffect(() => {
    if (filters.searchTerm !== searchInput) {
      setSearchInput(filters.searchTerm || '');
    }
  }, [filters.searchTerm]);

  const handleStatusChange = useCallback((status: string) => {
    const currentStatuses = Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : [];
    
    if (currentStatuses.includes(status)) {
      // Remove status
      const newStatuses = currentStatuses.filter(s => s !== status);
      onFiltersChange({ 
        status: newStatuses.length === 0 ? undefined : 
               newStatuses.length === 1 ? newStatuses[0] : newStatuses 
      });
    } else {
      // Add status
      const newStatuses = [...currentStatuses, status];
      onFiltersChange({ 
        status: newStatuses.length === 1 ? newStatuses[0] : newStatuses 
      });
    }
  }, [filters.status, onFiltersChange]);

  const handleDurationCategoryChange = useCallback((category: DurationCategory | null) => {
    if (category === null) {
      onFiltersChange({ minDuration: undefined, maxDuration: undefined });
    } else {
      const { min, max } = DURATION_CATEGORIES[category];
      onFiltersChange({ 
        minDuration: min === 0 ? undefined : min,
        maxDuration: max === Infinity ? undefined : max 
      });
    }
  }, [onFiltersChange]);

  const handleMessageCountCategoryChange = useCallback((category: MessageCountCategory | null) => {
    if (category === null) {
      onFiltersChange({ messageCountRange: undefined });
    } else {
      const { min, max } = MESSAGE_COUNT_CATEGORIES[category];
      onFiltersChange({ 
        messageCountRange: [min, max === Infinity ? Number.MAX_SAFE_INTEGER : max] as [number, number]
      });
    }
  }, [onFiltersChange]);

  const handleDateFromChange = useCallback((date: string) => {
    onFiltersChange({ dateFrom: date || undefined });
  }, [onFiltersChange]);

  const handleDateToChange = useCallback((date: string) => {
    onFiltersChange({ dateTo: date || undefined });
  }, [onFiltersChange]);

  const handleAgentIdChange = useCallback((agentId: string) => {
    onFiltersChange({ agentId: agentId || undefined });
  }, [onFiltersChange]);

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    filters.searchTerm ||
    filters.status ||
    filters.agentId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.minDuration ||
    filters.maxDuration ||
    filters.messageCountRange
  );

  // Get current duration category
  const getCurrentDurationCategory = (): DurationCategory | null => {
    if (!filters.minDuration && !filters.maxDuration) return null;
    
    for (const [key, category] of Object.entries(DURATION_CATEGORIES)) {
      const categoryMin = category.min === 0 ? undefined : category.min;
      const categoryMax = category.max === Infinity ? undefined : category.max;
      
      if (filters.minDuration === categoryMin && filters.maxDuration === categoryMax) {
        return key as DurationCategory;
      }
    }
    return null;
  };

  // Get current message count category
  const getCurrentMessageCountCategory = (): MessageCountCategory | null => {
    if (!filters.messageCountRange) return null;
    
    const [min, max] = filters.messageCountRange;
    for (const [key, category] of Object.entries(MESSAGE_COUNT_CATEGORIES)) {
      const categoryMax = category.max === Infinity ? Number.MAX_SAFE_INTEGER : category.max;
      
      if (min === category.min && max === categoryMax) {
        return key as MessageCountCategory;
      }
    }
    return null;
  };

  const currentStatuses = Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : [];

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Search Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Search & Filter</h3>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="text-xs text-red-600 hover:text-red-800 underline"
                disabled={loading}
              >
                Clear All
              </button>
            )}
            {onToggleExpanded && (
              <button
                onClick={onToggleExpanded}
                className="text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {expanded ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="mt-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {loading && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {['waiting', 'active', 'closed'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={loading}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    currentStatuses.includes(status)
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleDateFromChange(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleDateToChange(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Agent Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Agent ID</label>
            <input
              type="text"
              placeholder="Enter agent ID..."
              value={filters.agentId || ''}
              onChange={(e) => handleAgentIdChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>

          {/* Duration Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Duration</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDurationCategoryChange(null)}
                disabled={loading}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  getCurrentDurationCategory() === null
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                Any Duration
              </button>
              {Object.entries(DURATION_CATEGORIES).map(([key, category]) => (
                <button
                  key={key}
                  onClick={() => handleDurationCategoryChange(key as DurationCategory)}
                  disabled={loading}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    getCurrentDurationCategory() === key
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Count Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Message Count</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleMessageCountCategoryChange(null)}
                disabled={loading}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  getCurrentMessageCountCategory() === null
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                Any Count
              </button>
              {Object.entries(MESSAGE_COUNT_CATEGORIES).map(([key, category]) => (
                <button
                  key={key}
                  onClick={() => handleMessageCountCategoryChange(key as MessageCountCategory)}
                  disabled={loading}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    getCurrentMessageCountCategory() === key
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-600">
                Active filters: {[
                  filters.searchTerm && 'Search',
                  filters.status && 'Status',
                  filters.agentId && 'Agent',
                  (filters.dateFrom || filters.dateTo) && 'Date Range',
                  (filters.minDuration || filters.maxDuration) && 'Duration',
                  filters.messageCountRange && 'Message Count'
                ].filter(Boolean).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}