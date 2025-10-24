'use client';
import React from 'react';
import type { ChatHistorySession, ChatHistoryState } from '../types/chat-history';
import type { ChatMessage } from '../types/types';

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

// Helper function to calculate session duration
function calculateSessionDuration(session: ChatHistorySession): number | undefined {
  if (session.duration) return session.duration;
  
  const startTime = new Date(session.createdAt).getTime();
  const endTime = session.endedAt 
    ? new Date(session.endedAt).getTime()
    : session.updatedAt 
    ? new Date(session.updatedAt).getTime()
    : Date.now();
  
  return endTime - startTime;
}

interface ChatHistoryDetailProps {
  session: ChatHistorySession | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  pagination: ChatHistoryState['messagesPagination'];
  onClose?: () => void;
  onRetry?: () => void;
  onLoadMoreMessages?: () => void;
}

export default function ChatHistoryDetail({
  session,
  messages,
  loading,
  error,
  pagination,
  onClose,
  onRetry,
  onLoadMoreMessages,
}: ChatHistoryDetailProps) {
  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">💬</div>
          <div className="text-lg font-medium mb-2">Select a chat session</div>
          <div className="text-sm">Choose a conversation from the list to view details</div>
        </div>
      </div>
    );
  }

  const sessionDuration = calculateSessionDuration(session);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-900">
                  Chat with {session.userName || 'Anonymous User'}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
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
              
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Email:</span> {session.userEmail || 'Not provided'}
                </div>
                <div>
                  <span className="font-medium">Session ID:</span> {session.id.slice(-12)}
                </div>
                <div>
                  <span className="font-medium">Started:</span>{' '}
                  <span title={new Date(session.createdAt).toLocaleString()}>
                    {formatRelativeTime(session.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Duration:</span> {formatDuration(sessionDuration)}
                </div>
                <div>
                  <span className="font-medium">Agent:</span> {session.agentName || 'No agent assigned'}
                </div>
                <div>
                  <span className="font-medium">Messages:</span> {session.messageCount || messages.length}
                </div>
              </div>
            </div>
            
            {onClose && (
              <button
                onClick={onClose}
                className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close detail view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Content */}
      <div className="flex-1 overflow-hidden">
        {/* Loading state */}
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Loading messages...</span>
          </div>
        )}

        {/* Error state */}
        {error && messages.length === 0 && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="text-red-400">⚠️</div>
                <div className="ml-2">
                  <h3 className="text-sm font-medium text-red-800">Error Loading Messages</h3>
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

        {/* Empty messages state */}
        {!loading && !error && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-gray-500">
              <div className="text-3xl mb-4">💭</div>
              <div className="text-lg font-medium mb-2">No messages yet</div>
              <div className="text-sm">This conversation hasn&apos;t started</div>
            </div>
          </div>
        )}

        {/* Messages list */}
        {messages.length > 0 && (
          <div className="h-full overflow-y-auto">
            {/* Load more messages button (if paginated) */}
            {pagination && pagination.hasPrev && onLoadMoreMessages && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <button
                  onClick={onLoadMoreMessages}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    'Load Earlier Messages'
                  )}
                </button>
              </div>
            )}

            <div className="p-6 space-y-4" data-testid="messages-container">
              {messages.map((message, index) => {
                const isUser = message.sender === 'user';
                const isAgent = message.sender === 'agent';
                const isSystem = message.sender === 'system';
                
                return (
                  <div
                    key={message.id || index}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    data-testid="message-item"
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                        isUser
                          ? 'bg-blue-500 text-white'
                          : isAgent
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                      }`}
                    >
                      {/* Message sender label */}
                      <div className={`text-xs font-medium mb-1 ${
                        isUser ? 'text-blue-100' : isAgent ? 'text-gray-600' : 'text-yellow-600'
                      }`}>
                        {isUser ? session.userName || 'User' : isAgent ? session.agentName || 'Agent' : 'System'}
                      </div>
                      
                      {/* Message content */}
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {message.message}
                      </div>
                      
                      {/* Message timestamp */}
                      <div className={`text-xs mt-2 ${
                        isUser ? 'text-blue-100' : isAgent ? 'text-gray-500' : 'text-yellow-600'
                      }`}>
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination info */}
            {pagination && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-500 text-center">
                  Showing {messages.length} of {pagination.total} messages
                  {pagination.totalPages > 1 && (
                    <span> • Page {pagination.page} of {pagination.totalPages}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Metadata Panel */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
        <div className="p-4">
          <div className="text-xs text-gray-500 space-y-1">
            <div>
              <span className="font-medium">Created:</span>{' '}
              {new Date(session.createdAt).toLocaleString()}
            </div>
            {session.updatedAt && session.updatedAt !== session.createdAt && (
              <div>
                <span className="font-medium">Last Updated:</span>{' '}
                {new Date(session.updatedAt).toLocaleString()}
              </div>
            )}
            {session.endedAt && (
              <div>
                <span className="font-medium">Ended:</span>{' '}
                {new Date(session.endedAt).toLocaleString()}
              </div>
            )}
            {session.initialMessage && (
              <div>
                <span className="font-medium">Initial Message:</span>{' '}
                <span className="italic">"{session.initialMessage}"</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}