'use client';
import React, { useEffect, useReducer, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorBoundary from '../components/ErrorBoundary';
import ChatHistoryList from '../components/ChatHistoryList';
import ChatHistoryDetail from '../components/ChatHistoryDetail';
import ChatHistorySearch from '../components/ChatHistorySearch';
import type { ChatHistoryState, ChatHistoryAction, ChatHistorySession, ChatHistoryFilters } from '../types/chat-history';
import { initialChatHistoryState } from '../types/chat-history';

// Initialize socket connection outside component to avoid reconnections
const socket = io(
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
  {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    withCredentials: true,
    autoConnect: true,
  }
);

// Chat History state reducer
function chatHistoryReducer(state: ChatHistoryState, action: ChatHistoryAction): ChatHistoryState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return {
        ...state,
        sessions: action.payload.sessions,
        sessionsPagination: action.payload.pagination,
      };
    case 'SET_SELECTED_SESSION':
      return {
        ...state,
        selectedSession: action.payload,
        ui: {
          ...state.ui,
          selectedSessionId: action.payload?.id || null,
          detailViewOpen: !!action.payload,
          viewMode: action.payload ? 'detail' : 'list',
        },
      };
    case 'SET_SELECTED_SESSION_MESSAGES':
      return {
        ...state,
        selectedSessionMessages: action.payload.messages,
        messagesPagination: action.payload.pagination,
      };
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };
    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: {},
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value },
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.key]: action.payload.value },
      };
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: { sessions: null, messages: null, search: null },
      };
    case 'SET_UI_STATE':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };
    case 'TOGGLE_SEARCH_PANEL':
      return {
        ...state,
        ui: { ...state.ui, searchExpanded: !state.ui.searchExpanded },
      };
    case 'OPEN_DETAIL_VIEW':
      return {
        ...state,
        ui: {
          ...state.ui,
          detailViewOpen: true,
          viewMode: 'detail',
          selectedSessionId: action.payload,
        },
      };
    case 'CLOSE_DETAIL_VIEW':
      return {
        ...state,
        selectedSession: null,
        selectedSessionMessages: [],
        ui: {
          ...state.ui,
          detailViewOpen: false,
          viewMode: 'list',
          selectedSessionId: null,
        },
      };
    case 'RESET_STATE':
      return initialChatHistoryState;
    default:
      return state;
  }
}

function ChatHistoryComponent() {
  const [state, dispatch] = useReducer(chatHistoryReducer, initialChatHistoryState);
  const { handleError, withErrorHandling } = useErrorHandler({
    maxRetries: 3,
    showAlert: false,
    fallbackMessage: 'Chat History operation failed',
  });

  // Load chat sessions with filters and pagination
  const loadSessions = useCallback(async (page: number = 1, resetList: boolean = false) => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'sessions', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'sessions', value: null } });

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      // Add filters to query params
      if (state.filters.status) {
        if (Array.isArray(state.filters.status)) {
          queryParams.append('status', state.filters.status.join(','));
        } else {
          queryParams.append('status', state.filters.status);
        }
      }

      if (state.filters.agentId) {
        queryParams.append('agentId', state.filters.agentId);
      }

      if (state.filters.dateFrom) {
        queryParams.append('dateFrom', state.filters.dateFrom);
      }

      if (state.filters.dateTo) {
        queryParams.append('dateTo', state.filters.dateTo);
      }

      if (state.filters.searchTerm) {
        queryParams.append('searchTerm', state.filters.searchTerm);
      }

      if (state.filters.minDuration) {
        queryParams.append('minDuration', state.filters.minDuration.toString());
      }

      if (state.filters.maxDuration) {
        queryParams.append('maxDuration', state.filters.maxDuration.toString());
      }

      if (state.filters.messageCountRange) {
        queryParams.append('minMessageCount', state.filters.messageCountRange[0].toString());
        queryParams.append('maxMessageCount', state.filters.messageCountRange[1].toString());
      }

      // Use search endpoint if search term is provided
      const endpoint = state.filters.searchTerm 
        ? `/api/chat-sessions/search?${queryParams}`
        : `/api/chat-sessions?${queryParams}`;

      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        dispatch({
          type: 'SET_SESSIONS',
          payload: {
            sessions: resetList || page === 1 ? result.data : [...state.sessions, ...result.data],
            pagination: result.pagination || null,
          },
        });
      } else {
        throw new Error(result.error || 'Failed to load sessions');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load chat sessions';
      dispatch({ type: 'SET_ERROR', payload: { key: 'sessions', value: errorMessage } });
      handleError(String(error), 'Failed to load chat sessions');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'sessions', value: false } });
    }
  }, [state.filters, state.sessions, handleError]);

  // Load messages for selected session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'messages', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'messages', value: null } });

    try {
      const response = await fetch(`/api/chat-messages?sessionId=${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const messages = data.data
      if (Array.isArray(messages)) {
        // Sort messages by timestamp to ensure proper ordering
        const sortedMessages = messages.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        dispatch({
          type: 'SET_SELECTED_SESSION_MESSAGES',
          payload: {
            messages: sortedMessages,
            pagination: null, // Simple array response doesn't include pagination
          },
        });
      } else {
        dispatch({
          type: 'SET_SELECTED_SESSION_MESSAGES',
          payload: { messages: [], pagination: null },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load messages';
      dispatch({ type: 'SET_ERROR', payload: { key: 'messages', value: errorMessage } });
      handleError(String(error), 'Failed to load session messages');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'messages', value: false } });
    }
  }, [handleError]);

  // Socket connection management
  useEffect(() => {
    const handleConnect = () => {
      console.log('✅ Chat History connected to socket server');
      socket.emit('register-client', { type: 'dashboard-history' });
    };

    const handleDisconnect = () => {
      console.log('❌ Chat History disconnected from socket server');
    };

    const handleConnectError = (error: any) => {
      console.error('❌ Chat History connection error:', error);
    };

    const handleSessionUpdated = (data: { session: any }) => {
      console.log('🔄 Session updated in Chat History:', data.session.id);
      
      // Update sessions list if the updated session is in our current list
      dispatch({
  type: 'SET_SESSIONS',
  payload: {
    sessions: state.sessions.map((session) =>
      session.id === data.session.id ? { ...session, ...data.session } : session
    ),
    pagination: state.sessionsPagination,
  },
});

      // Update selected session if it's the one that was updated
      if (state.selectedSession && state.selectedSession.id === data.session.id) {
        dispatch({ type: 'SET_SELECTED_SESSION', payload: { ...state.selectedSession, ...data.session } });
      }
    };

    // Register socket event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('session-updated', handleSessionUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('session-updated', handleSessionUpdated);
    };
  }, [state.selectedSession]);

  // Initial data load
  useEffect(() => {
    loadSessions(1, true);
  }, [state.filters]);

  // Load initial sessions on mount
  useEffect(() => {
    if (state.sessions.length === 0 && !state.loading.sessions) {
      loadSessions(1, true);
    }
  }, []);

  // Load messages when session is selected
  useEffect(() => {
    if (state.selectedSession) {
      loadSessionMessages(state.selectedSession.id);
    }
  }, [state.selectedSession, loadSessionMessages]);

  // Handler functions for child components
  const handleSessionSelect = useCallback((session: ChatHistorySession) => {
    dispatch({ type: 'SET_SELECTED_SESSION', payload: session });
  }, []);

  const handleLoadMore = useCallback(() => {
    if (state.sessionsPagination?.hasNext) {
      loadSessions(state.sessionsPagination.page + 1, false);
    }
  }, [state.sessionsPagination, loadSessions]);

  // Handler functions for search component
  const handleFiltersChange = useCallback((newFilters: Partial<ChatHistoryFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
  }, []);

  const handleClearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  const handleToggleSearchPanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_SEARCH_PANEL' });
  }, []);

  const handleRetryMessages = useCallback(() => {
    if (state.selectedSession) {
      loadSessionMessages(state.selectedSession.id);
    }
  }, [state.selectedSession, loadSessionMessages]);

  const handleCloseDetail = useCallback(() => {
    dispatch({ type: 'CLOSE_DETAIL_VIEW' });
  }, []);

  return (
    <div className="h-full flex">
      {/* Chat History List with Search */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Search Component */}
        <ChatHistorySearch
          filters={state.filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          loading={state.loading.sessions}
          expanded={state.ui.searchExpanded}
          onToggleExpanded={handleToggleSearchPanel}
        />
        
        {/* Sessions List */}
        <div className="flex-1 overflow-hidden">
          <ChatHistoryList
            sessions={state.sessions}
            selectedSession={state.selectedSession}
            loading={state.loading.sessions}
            error={state.errors.sessions}
            pagination={state.sessionsPagination}
            onSessionSelect={handleSessionSelect}
            onLoadMore={handleLoadMore}
            onRetry={() => loadSessions(1, true)}
            hasActiveFilters={Boolean(
              state.filters.searchTerm ||
              state.filters.status ||
              state.filters.agentId ||
              state.filters.dateFrom ||
              state.filters.dateTo ||
              state.filters.minDuration ||
              state.filters.maxDuration ||
              state.filters.messageCountRange
            )}
          />
        </div>
      </div>

      {/* Chat History Detail */}
      <div className="flex-1">
        <ChatHistoryDetail
          session={state.selectedSession}
          messages={state.selectedSessionMessages}
          loading={state.loading.messages}
          error={state.errors.messages}
          pagination={state.messagesPagination}
          onClose={handleCloseDetail}
          onRetry={handleRetryMessages}
        />
      </div>
    </div>
  );
}

// Main Chat History module with error boundary
export default function ChatHistory() {
  return (
    <ErrorBoundary>
      <ChatHistoryComponent />
    </ErrorBoundary>
  );
}