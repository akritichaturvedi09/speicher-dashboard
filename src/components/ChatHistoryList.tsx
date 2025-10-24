'use client';
import React from 'react';
import type { ChatHistorySession, ChatHistoryState } from '../types/chat-history';

// Helper function to format relative time (copied from Inbox pattern)
function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}

// Helper function to format duration
function formatDuration(durationMs?: number): string {
  if (!durationMs) return 'Unknown';
  
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

interface ChatHistoryListProps {
  sessions: ChatHistorySession[];
  selectedSession: ChatHistorySession | null;
  loading: boolean;
  error: string | null;
  pagination: ChatHistoryState['sessionsPagination'];
  onSessionSelect: (session: ChatHistorySession) => void;
  onLoadMore?: () => void;
  onRetry?: () => void;
  hasActiveFilters?: boolean;
}

export default function ChatHistoryList({
  sessions,
  selectedSession,
  loading,
  error,
  pagination,
  onSessionSelect,
  onLoadMore,
  onRetry,
  hasActiveFilters = false,
}: ChatHistoryListProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
        {pagination && (
          <div className="text-xs text-gray-500 mt-1">
            Showing {sessions.length} of {pagination.total} sessions
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Loading state */}
        {loading && sessions.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Loading sessions...</span>
          </div>
        )}

        {/* Error state */}
        {error && sessions.length === 0 && (
          <div className="p-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="text-red-400">⚠️</div>
                <div className="ml-2">
                  <h3 className="text-sm font-medium text-red-800">Error Loading Sessions</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sessions.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-gray-500">
              {hasActiveFilters ? (
                <>
                  <div className="text-4xl mb-4">🔍</div>
                  <div className="text-lg font-medium mb-2">No matching sessions found</div>
                  <div className="text-sm">Try adjusting your search criteria or clearing filters</div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-4">📭</div>
                  <div className="text-lg font-medium mb-2">No chat sessions found</div>
                  <div className="text-sm">Chat conversations will appear here once they are created</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sessions list */}
        {sessions.length > 0 && (
          <div className="overflow-y-auto h-full">
            <ul className="divide-y divide-gray-200" data-testid="chat-history-list">
              {sessions.map((session) => {
                const isSelected = selectedSession?.id === session.id;
                
                return (
                  <li
                    key={session.id}
                    className={`p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                      isSelected
                        ? 'bg-blue-50 border-r-4 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onSessionSelect(session)}
                    data-testid="session-item"
                  >
                    {/* Header with user info and status */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {session.userName || 'Anonymous User'}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {session.userEmail || 'No email provided'}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                          session.status === 'waiting'
                            ? 'bg-orange-100 text-orange-800'
                            : session.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>

                    {/* Message preview */}
                    <div className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {session.lastMessage || session.initialMessage || 'No messages yet'}
                    </div>

                    {/* Session metadata */}
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <div className="flex items-center space-x-3">
                        {/* Agent info */}
                        <span>
                          {session.agentName
                            ? `Agent: ${session.agentName}`
                            : 'No agent assigned'}
                        </span>
                        
                        {/* Message count */}
                        {session.messageCount !== undefined && (
                          <span>
                            {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        
                        {/* Duration */}
                        {session.duration && (
                          <span>
                            Duration: {formatDuration(session.duration)}
                          </span>
                        )}
                      </div>
                      
                      {/* Timestamp */}
                      <span
                        title={new Date(session.updatedAt || session.createdAt).toLocaleString()}
                      >
                        {formatRelativeTime(session.lastMessageTime || session.updatedAt || session.createdAt)}
                      </span>
                    </div>

                    {/* Session ID for debugging */}
                    <div className="text-xs text-gray-400 mt-1">
                      ID: {session.id.slice(-8)}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Load more button */}
            {pagination && pagination.hasNext && onLoadMore && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={onLoadMore}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    `Load More (${pagination.total - sessions.length} remaining)`
                  )}
                </button>
              </div>
            )}

            {/* Pagination info */}
            {pagination && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-500 text-center">
                  Page {pagination.page} of {pagination.totalPages} • {pagination.total} total sessions
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}