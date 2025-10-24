'use client';
import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import type {
  ChatSession,
  ChatMessage,
} from '../../../speicher-chatbot/src/shared/types';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorBoundary from '../components/ErrorBoundary';

interface LiveChatNotification {
  sessionId: string;
  message: string;
  createdAt: string;
  user: string;
  email: string;
}

interface SessionFilter {
  status: 'all' | 'waiting' | 'active' | 'closed';
  sortBy: 'newest' | 'oldest' | 'status';
}

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

// Helper function to format relative time
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

function InboxComponent() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SessionFilter>({
    status: 'all',
    sortBy: 'newest',
  });
  const [liveChatNotification, setLiveChatNotification] =
    useState<LiveChatNotification | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<
    LiveChatNotification[]
  >([]);
  const [agentInfo] = useState({ id: 'agent_1', name: 'Support Agent' });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { handleError, withErrorHandling } = useErrorHandler({
    maxRetries: 3,
    showAlert: false, // We'll handle notifications manually in dashboard
    fallbackMessage: 'Dashboard operation failed',
  });

  // Suppress unused variable warnings - these are available for future error handling
  void handleError;
  void withErrorHandling;

  useEffect(() => {
    // Setup socket connection handlers
    const handleConnect = () => {
      console.log('✅ Dashboard connected to socket server');
      setIsConnected(true);
      setConnectionError(null);
      socket.emit('register-client', { type: 'dashboard' });
    };

    const handleDisconnect = () => {
      console.log('❌ Dashboard disconnected from socket server');
      setIsConnected(false);
    };

    const handleConnectError = (error: any) => {
      console.error('❌ Dashboard connection error:', error);
      setIsConnected(false);
      setConnectionError('Failed to connect to live chat server');
    };

    const handleClientRegistered = (data: any) => {
      console.log('✅ Dashboard client registered:', data);
    };

    // Register socket event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('client-registered', handleClientRegistered);

    // Set initial connection state
    setIsConnected(socket.connected);

    // Fetch existing chat sessions
    fetch('/api/chat-sessions?status=waiting,active,closed')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((response) => {
        // Handle structured API response
        if (response.success && Array.isArray(response.data)) {
          setChatSessions(response.data);
        } else if (Array.isArray(response)) {
          // Fallback for direct array response
          setChatSessions(response);
        } else {
          console.warn('API returned unexpected data format:', response);
          setChatSessions([]);
        }
      })
      .catch((err) => {
        console.error('Error fetching sessions:', err);
        setChatSessions([]); // Ensure chatSessions is always an array
      });

    // Listen for new chat sessions
    socket.on('new-chat-session', (session: ChatSession) => {
      console.log('📢 New chat session received:', session.id);

      // Update sessions list, ensuring no duplicates
      setChatSessions((prev) => {
        const exists = prev.some((s) => s.id === session.id);
        if (exists) {
          return prev.map((s) => (s.id === session.id ? session : s));
        }
        return [session, ...prev];
      });

      // Create notification
      const notification: LiveChatNotification = {
        sessionId: session.id,
        message: session.initialMessage,
        createdAt: session.createdAt,
        user: session.userName,
        email: session.userEmail,
      };

      // Add to notification queue and show prominently
      setNotificationQueue((prev) => [...prev, notification]);
      setLiveChatNotification(notification);

      // Clear notification timeout if exists
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }

      // Auto-hide notification after 15 seconds
      notificationTimeoutRef.current = setTimeout(() => {
        setLiveChatNotification(null);
        setNotificationQueue((prev) =>
          prev.filter((n) => n.sessionId !== notification.sessionId)
        );
      }, 15000);

      // Play notification sound (if browser allows)
      try {
        const audio = new Audio(
          'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT'
        );
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Ignore audio play errors (browser restrictions)
        });
      } catch (err) {
        // Ignore audio errors
        void err;
      }
    });

    // Listen for session updates (status changes, agent assignments)
    socket.on('session-updated', (data: { session: ChatSession }) => {
      console.log('🔄 Session updated:', data.session.id);
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === data.session.id ? data.session : session
        )
      );

      // Update selected session if it's the one that was updated
      if (selectedSession && selectedSession.id === data.session.id) {
        setSelectedSession(data.session);
      }
    });

    return () => {
      // Clean up socket event handlers
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('client-registered', handleClientRegistered);
      socket.off('new-chat-session');
      socket.off('session-updated');

      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedSession) {
      console.log('📖 Loading messages for session:', selectedSession.id);

      // Clear messages immediately when switching sessions
      setMessages([]);

      // Fetch messages for selected session with proper ordering
      fetch(`/api/chat-messages?sessionId=${selectedSession.id}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log(data.data,'in fetch data')
          if (Array.isArray(data.data)) {
            const sortedMessages = data.data
            setMessages(sortedMessages);
            console.log(
              `📖 Loaded ${sortedMessages.length} messages for session ${selectedSession.id}`
            );
          } else {
            console.warn('No messages found for session:', selectedSession.id);
            setMessages([]);
          }
        })
        .catch((err) => {
          console.error('❌ Error fetching messages:', err);
          setMessages([]);
        });

      // Join the session room
      socket.emit('join-session', selectedSession.id);

      // Listen for new messages with proper ordering
      const handleNewMessage = (message: ChatMessage) => {
        if (message.sessionId === selectedSession.id) {
          console.log(
            '📨 New message received for current session:',
            message.id
          );
          setMessages((prev) => {
            // Check if message already exists (deduplication)
            const exists = prev.some((msg) => msg.id === message.id);
            if (exists) {
              console.log('📨 Message already exists, skipping:', message.id);
              return prev;
            }

            // Add message and sort by timestamp to ensure proper ordering
            const newMessages = [...prev, message];
            return newMessages.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );
          });
        }
      };

      socket.on('new-message', handleNewMessage);

      return () => {
        socket.off('new-message', handleNewMessage);
      };
    } else {
      // Clear messages when no session is selected
      setMessages([]);
    }
  }, [selectedSession?.id]); // Include selectedSession to satisfy ESLint

  // Filter and sort sessions - ensure chatSessions is always an array
  const filteredSessions = (Array.isArray(chatSessions) ? chatSessions : [])
    .filter((session) => {
      // Status filter
      if (filter.status !== 'all' && session.status !== filter.status) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        return (
          session.initialMessage?.toLowerCase().includes(searchLower) ||
          session.status?.toLowerCase().includes(searchLower) ||
          session.userName?.toLowerCase().includes(searchLower) ||
          session.userEmail?.toLowerCase().includes(searchLower) ||
          session.agentName?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    })
    .sort((a, b) => {
      switch (filter.sortBy) {
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case 'status':
          // Priority: waiting > active > closed
          const statusPriority = { waiting: 3, active: 2, closed: 1 };
          const aPriority = statusPriority[a.status] || 0;
          const bPriority = statusPriority[b.status] || 0;
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          // If same status, sort by newest
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case 'newest':
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

  const joinChatSession = (session: ChatSession) => {
    console.log('👤 Agent attempting to join session:', session.id);

    // Optimistically update UI
    const optimisticSession = {
      ...session,
      status: 'active' as const,
      agentId: agentInfo.id,
      agentName: agentInfo.name,
      updatedAt: new Date().toISOString(),
    };

    setChatSessions((prev) =>
      prev.map((s) => (s.id === session.id ? optimisticSession : s))
    );
    setSelectedSession(optimisticSession);

    // Clear notifications for this session
    setLiveChatNotification((prev) =>
      prev?.sessionId === session.id ? null : prev
    );
    setNotificationQueue((prev) =>
      prev.filter((n) => n.sessionId !== session.id)
    );

    // Emit agent join event with callback for acknowledgment
    socket.emit(
      'agent-join-session',
      {
        sessionId: session.id,
        agentId: agentInfo.id,
        agentName: agentInfo.name,
      },
      (response: any) => {
        if (response?.success) {
          console.log('✅ Successfully joined session:', session.id);

          // Update with server response
          setChatSessions((prev) =>
            prev.map((s) => (s.id === session.id ? response.session : s))
          );
          setSelectedSession(response.session);

          // Also update via API for consistency
          fetch('/api/chat-sessions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: session.id,
              status: 'active',
              agentId: agentInfo.id,
              agentName: agentInfo.name,
            }),
          }).catch((err) => {
            console.error('❌ Failed to update session via API:', err);
          });
        } else {
          console.error(
            '❌ Failed to join session:',
            response?.error || 'Unknown error'
          );

          // Revert optimistic update
          setChatSessions((prev) =>
            prev.map((s) => (s.id === session.id ? session : s))
          );
          setSelectedSession(session);

          alert(
            `Failed to join session: ${response?.error || 'Unknown error'}`
          );
        }
      }
    );
  };

  const leaveSession = (session: ChatSession) => {
    console.log('👤 Agent leaving session:', session.id);

    // Update session status
    const updatedSession = {
      ...session,
      status: 'waiting' as const,
      agentId: undefined,
      agentName: undefined,
      updatedAt: new Date().toISOString(),
    };

    setChatSessions((prev) =>
      prev.map((s) => (s.id === session.id ? updatedSession : s))
    );

    // Don't clear selected session, just update it
    setSelectedSession(updatedSession);

    // Emit leave event
    socket.emit('agent-leave-session', {
      sessionId: session.id,
      agentId: agentInfo.id,
    });

    // Update via API
    fetch('/api/chat-sessions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        status: 'waiting',
        agentId: null,
        agentName: null,
      }),
    }).catch((err) => {
      console.error('❌ Failed to update session via API:', err);
    });
  };

  const closeSession = (session: ChatSession) => {
    if (
      !confirm(
        'Are you sure you want to close this chat session? This action cannot be undone.'
      )
    ) {
      return;
    }

    console.log('🔒 Closing session:', session.id);

    // Update session status
    const closedSession = {
      ...session,
      status: 'closed' as const,
      updatedAt: new Date().toISOString(),
    };

    setChatSessions((prev) =>
      prev.map((s) => (s.id === session.id ? closedSession : s))
    );
    setSelectedSession(closedSession);

    // Emit close event
    socket.emit('close-session', session.id);

    // Update via API
    fetch('/api/chat-sessions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        status: 'closed',
      }),
    }).catch((err) => {
      console.error('❌ Failed to close session via API:', err);
    });
  };

  const sendMessage = (messageText: string) => {
    if (!selectedSession || !messageText.trim()) return;

    const messageData: Omit<ChatMessage, '_id'> = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: selectedSession.id,
      sender: 'agent',
      message: messageText.trim(),
      createdAt: new Date().toISOString(),
    };

    // Optimistically add message to UI
    setMessages((prev) => [...prev, messageData]);

    // Send message with acknowledgment
    socket.emit('send-message', messageData, (response: any) => {
      if (!response.success) {
        console.error('❌ Failed to send message:', response.error);
        alert(`Failed to send message: ${response.error}`);

        // Remove the optimistically added message on failure
        setMessages((prev) => prev.filter((msg) => msg.id !== messageData.id));
      } else {
        console.log('✅ Message sent successfully');
      }
    });
  };

  return (
    <div className="flex h-full relative">
      {/* Connection Status */}
      {!isConnected && (
        <div className="absolute top-4 right-4 bg-red-100 text-red-900 px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {connectionError || 'Disconnected from live chat server'}
            </span>
          </div>
        </div>
      )}

      {/* Prominent Live Chat Notification */}
      {liveChatNotification && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl shadow-2xl z-50 animate-pulse border-2 border-white"
          data-testid="live-chat-notification"
        >
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-white rounded-full animate-bounce"></div>
            <div>
              <div className="font-bold text-lg">🔔 New Live Chat Request!</div>
              <div className="text-sm opacity-90 mt-1">
                <strong data-testid="notification-user-name">
                  {liveChatNotification.user || 'Anonymous User'}
                </strong>{' '}
                (
                <span data-testid="notification-user-email">
                  {liveChatNotification.email || 'No email'}
                </span>
                )
              </div>
              <div className="text-sm opacity-80 mt-1 max-w-md truncate">
                &ldquo;{liveChatNotification.message ?? ''}&rdquo;
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  className="bg-white text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-semibold transition-colors"
                  onClick={() => {
                    const session = chatSessions.find(
                      (s) => s.id === liveChatNotification.sessionId
                    );
                    if (session) {
                      joinChatSession(session);
                    }
                  }}
                  data-testid="accept-chat-button"
                >
                  Accept & Start Chat
                </button>
                <button
                  className="bg-transparent border border-white text-white hover:bg-white hover:text-blue-600 px-4 py-2 rounded-lg transition-colors"
                  onClick={() => {
                    setLiveChatNotification(null);
                    if (notificationTimeoutRef.current) {
                      clearTimeout(notificationTimeoutRef.current);
                    }
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Queue Indicator */}
      {notificationQueue.length > 1 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-orange-100 text-orange-900 px-4 py-2 rounded-lg shadow-lg z-40">
          <span className="text-sm font-medium">
            +{notificationQueue.length - 1} more chat request
            {notificationQueue.length > 2 ? 's' : ''} waiting
          </span>
        </div>
      )}
      <aside className="w-80 bg-white p-4 border-r border-gray-200 flex flex-col gap-4 h-full">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            className="w-full p-3 pl-10 rounded-lg bg-gray-50 text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
            placeholder="Search by name, email, or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              value={filter.status}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  status: e.target.value as SessionFilter['status'],
                }))
              }
              className="flex-1 p-2 rounded bg-gray-50 text-gray-900 border border-gray-300 text-sm"
            >
              <option value="all">All Status</option>
              <option value="waiting">Waiting</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={filter.sortBy}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  sortBy: e.target.value as SessionFilter['sortBy'],
                }))
              }
              className="flex-1 p-2 rounded bg-gray-50 text-gray-900 border border-gray-300 text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">By Status</option>
            </select>
          </div>

          {/* Session Count */}
          <div className="text-xs text-gray-500 flex justify-between">
            <span>
              {filteredSessions.length} session
              {filteredSessions.length !== 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <span className="text-orange-600">
                {chatSessions.filter((s) => s.status === 'waiting').length}{' '}
                waiting
              </span>
              <span className="text-green-600">
                {chatSessions.filter((s) => s.status === 'active').length}{' '}
                active
              </span>
            </span>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filteredSessions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-2xl mb-2">📭</div>
              <div className="text-sm">
                {search || filter.status !== 'all'
                  ? 'No sessions match your filters'
                  : 'No chat sessions yet'}
              </div>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="session-list">
              {filteredSessions.map((session) => {
                const isSelected = selectedSession?.id === session.id;
                const hasNewNotification = notificationQueue.some(
                  (n) => n.sessionId === session.id
                );

                return (
                  <li
                    key={session.id}
                    className={`p-3 rounded-lg cursor-pointer border transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 shadow-md'
                        : hasNewNotification
                        ? 'bg-yellow-50 border-yellow-300 animate-pulse'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedSession(session)}
                    data-testid="session-item"
                  >
                    {/* Header with name and status */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {session.userName || 'Anonymous User'}
                          {hasNewNotification && (
                            <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {session.userEmail}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                    <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {session.initialMessage || 'New Chat Session'}
                    </div>

                    {/* Footer with agent and time */}
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>
                        {session.agentName
                          ? `Agent: ${session.agentName}`
                          : 'No agent assigned'}
                      </span>
                      <span
                        title={new Date(session.createdAt).toLocaleString()}
                      >
                        {formatRelativeTime(session.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      <main className="flex-1 p-8">
        {selectedSession ? (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
              <div className="flex-1">
                <h2 className="font-bold text-xl text-gray-900">
                  Chat with {selectedSession.userName || 'Anonymous User'}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-sm text-gray-600">
                    {selectedSession.userEmail}
                  </p>
                  <span className="text-xs text-gray-500">
                    Session ID: {selectedSession.id.slice(-8)}
                  </span>
                  <span className="text-xs text-gray-500">
                    Created:{' '}
                    {new Date(selectedSession.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedSession.agentName && (
                  <p className="text-sm text-blue-600 mt-1">
                    Handled by: {selectedSession.agentName}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Connection Status Indicator */}
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></div>

                {/* Session Actions */}
                {selectedSession.status === 'waiting' && (
                  <button
                    onClick={() => joinChatSession(selectedSession)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Join Chat
                  </button>
                )}

                {selectedSession.status === 'active' &&
                  selectedSession.agentId === agentInfo.id && (
                    <>
                      <button
                        onClick={() => leaveSession(selectedSession)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Leave Chat
                      </button>
                      <button
                        onClick={() => closeSession(selectedSession)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Close Session
                      </button>
                    </>
                  )}

                {selectedSession.status === 'active' &&
                  selectedSession.agentId !== agentInfo.id && (
                    <span className="text-sm text-orange-600 bg-orange-100 px-3 py-1 rounded-lg">
                      Handled by another agent
                    </span>
                  )}

                {/* Status Badge */}
                <span
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    selectedSession.status === 'waiting'
                      ? 'bg-orange-100 text-orange-800'
                      : selectedSession.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedSession.status.charAt(0).toUpperCase() +
                    selectedSession.status.slice(1)}
                </span>
              </div>
            </div>

            {/* User Information Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                👤 Customer Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="ml-2 text-gray-900">
                    {selectedSession.userName || 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="ml-2 text-gray-900">
                    {selectedSession.userEmail || 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Initial Request:
                  </span>
                  <span className="ml-2 text-gray-900">
                    {selectedSession.initialMessage || 'No message'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Session Started:
                  </span>
                  <span className="ml-2 text-gray-900">
                    {new Date(selectedSession.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Previous Q&A Context */}
            {selectedSession.questionAnswerPairs &&
              selectedSession.questionAnswerPairs.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                      🤖 Previous Chatbot Conversation
                    </h4>
                    <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                      {selectedSession.questionAnswerPairs.length} interaction
                      {selectedSession.questionAnswerPairs.length !== 1
                        ? 's'
                        : ''}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {selectedSession.questionAnswerPairs.map((pair, index) => (
                      <div
                        key={pair.id || index}
                        className="bg-white rounded-lg p-3 border border-purple-100"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-medium text-purple-700">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">
                                Q:
                              </span>
                              <span className="ml-2 text-gray-900">
                                {pair.question}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium text-purple-700">
                                A:
                              </span>
                              <span className="ml-2 text-purple-900">
                                {pair.answer}
                              </span>
                            </div>
                            {pair.createdAt && (
                              <div className="text-xs text-gray-500">
                                {new Date(pair.createdAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-purple-600 bg-purple-100 p-2 rounded">
                    💡 This shows the customer&apos;s previous interaction with
                    the automated chatbot before requesting live support.
                  </div>
                </div>
              )}

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto mb-4 min-h-[300px] bg-gray-50 rounded-lg p-4"
              data-testid="message-display-area"
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2">💬</div>
                    <div className="text-sm">
                      {selectedSession.status === 'waiting'
                        ? 'Join the chat to start the conversation'
                        : 'No messages yet. Start the conversation!'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-2" data-testid="message-list">
                  {messages.map((msg, i) => {
                    const isAgent = msg.sender === 'agent';
                    const showTimestamp =
                      i === 0 ||
                      new Date(msg.createdAt).getTime() -
                        new Date(messages[i - 1].createdAt).getTime() >
                        300000; // 5 minutes

                    return (
                      <div key={msg.id || i}>
                        {/* Timestamp separator */}
                        {showTimestamp && (
                          <div className="text-center my-4">
                            <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                              {new Date(msg.createdAt).toLocaleString()}
                            </span>
                          </div>
                        )}

                        {/* Message */}
                        <div
                          className={`flex ${
                            isAgent ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`flex items-end gap-2 max-w-md ${
                              isAgent ? 'flex-row-reverse' : 'flex-row'
                            }`}
                          >
                            {/* Avatar */}
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isAgent
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-300 text-gray-700'
                              }`}
                            >
                              {isAgent ? 'A' : 'U'}
                            </div>

                            {/* Message bubble */}
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                isAgent
                                  ? 'bg-blue-500 text-white rounded-br-md'
                                  : 'bg-gray-200 text-gray-800 rounded-bl-md'
                              }`}
                            >
                              <div className="text-sm leading-relaxed">
                                {msg.message}
                              </div>
                              <div
                                className={`text-xs mt-1 ${
                                  isAgent ? 'text-blue-100' : 'text-gray-500'
                                }`}
                              >
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  [],
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="border-t border-gray-200 pt-4">
              {selectedSession.status !== 'active' ? (
                <div className="text-center py-4">
                  <div className="text-gray-500 text-sm mb-2">
                    {selectedSession.status === 'waiting'
                      ? 'Join the chat to start messaging'
                      : selectedSession.status === 'closed'
                      ? 'This session has been closed'
                      : 'Session not active'}
                  </div>
                  {selectedSession.status === 'waiting' && (
                    <button
                      onClick={() => joinChatSession(selectedSession)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Join Chat
                    </button>
                  )}
                </div>
              ) : selectedSession.agentId !== agentInfo.id ? (
                <div className="text-center py-4">
                  <div className="text-orange-600 text-sm">
                    This session is being handled by{' '}
                    {selectedSession.agentName || 'another agent'}
                  </div>
                </div>
              ) : (
                <form
                  className="flex gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem(
                      'adminMessage'
                    ) as HTMLInputElement;
                    const message = input.value.trim();
                    if (!message) return;
                    sendMessage(message);
                    input.value = '';
                  }}
                >
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      name="adminMessage"
                      className="w-full p-3 pr-12 rounded-lg bg-gray-50 text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                      placeholder="Type your message..."
                      autoComplete="off"
                      maxLength={1000}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      ↵
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <span>Send</span>
                    <span className="text-sm">📤</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 flex items-center justify-center h-full">
            Select a chat session to view messages.
          </div>
        )}
      </main>
    </div>
  );
}

// Wrap with error boundary
export default function Inbox() {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Inbox Error
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              The inbox module encountered an error. Please refresh the
              dashboard.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Refresh Dashboard
            </button>
          </div>
        </div>
      }
    >
      <InboxComponent />
    </ErrorBoundary>
  );
}
