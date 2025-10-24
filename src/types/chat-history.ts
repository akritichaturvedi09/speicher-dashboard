import type { ChatSession, ChatMessage } from './types';
import type { SessionFilters, PaginationOptions, PaginatedResult } from '@/db/services/chat-service';

/**
 * Enhanced ChatSession interface with computed metadata for Chat History module
 */
export interface ChatHistorySession extends ChatSession {
  /** Calculated duration in milliseconds between session start and end */
  duration?: number;
  /** Total number of messages in the conversation */
  messageCount?: number;
  /** Preview text of the last message in the conversation */
  lastMessage?: string;
  /** Timestamp of the last message */
  lastMessageTime?: string;
  /** Session end time (when status changed to 'closed') */
  endedAt?: string;
}

/**
 * Extended filters interface for Chat History search and filtering
 */
export interface ChatHistoryFilters extends SessionFilters {
  /** Search term to match against user names, agent names, and message content */
  searchTerm?: string;
  /** Minimum conversation duration in milliseconds */
  minDuration?: number;
  /** Maximum conversation duration in milliseconds */
  maxDuration?: number;
  /** Range filter for message count [min, max] */
  messageCountRange?: [number, number];
  /** Filter by specific agent names */
  agentNames?: string[];
  /** Include message content in search (affects performance) */
  includeMessageContent?: boolean;
}

/**
 * Search options specific to Chat History functionality
 */
export interface ChatHistorySearchOptions extends PaginationOptions {
  /** Whether to include message content in search results */
  includeMessageContent?: boolean;
  /** Whether to highlight search matches in results */
  highlightMatches?: boolean;
  /** Fields to search within */
  searchFields?: ('userName' | 'userEmail' | 'agentName' | 'initialMessage' | 'messageContent')[];
}

/**
 * State interface for Chat History component management
 */
export interface ChatHistoryState {
  /** List of chat sessions with metadata */
  sessions: ChatHistorySession[];
  /** Currently selected session for detail view */
  selectedSession: ChatHistorySession | null;
  /** Messages for the currently selected session */
  selectedSessionMessages: ChatMessage[];
  /** Current search and filter criteria */
  filters: ChatHistoryFilters;
  /** Pagination information for sessions */
  sessionsPagination: PaginatedResult<ChatHistorySession>['pagination'] | null;
  /** Pagination information for messages in selected session */
  messagesPagination: PaginatedResult<ChatMessage>['pagination'] | null;
  /** Loading states */
  loading: {
    sessions: boolean;
    messages: boolean;
    search: boolean;
  };
  /** Error states */
  errors: {
    sessions: string | null;
    messages: string | null;
    search: string | null;
  };
  /** UI state */
  ui: {
    /** Whether the search panel is expanded */
    searchExpanded: boolean;
    /** Whether the detail view is open */
    detailViewOpen: boolean;
    /** Current view mode */
    viewMode: 'list' | 'detail';
    /** Selected session ID for routing */
    selectedSessionId: string | null;
  };
}

/**
 * Action types for Chat History state management
 */
export type ChatHistoryAction =
  | { type: 'SET_SESSIONS'; payload: { sessions: ChatHistorySession[]; pagination: ChatHistoryState['sessionsPagination'] } }
  | { type: 'SET_SELECTED_SESSION'; payload: ChatHistorySession | null }
  | { type: 'SET_SELECTED_SESSION_MESSAGES'; payload: { messages: ChatMessage[]; pagination: ChatHistoryState['messagesPagination'] } }
  | { type: 'SET_FILTERS'; payload: Partial<ChatHistoryFilters> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_LOADING'; payload: { key: keyof ChatHistoryState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof ChatHistoryState['errors']; value: string | null } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_UI_STATE'; payload: Partial<ChatHistoryState['ui']> }
  | { type: 'TOGGLE_SEARCH_PANEL' }
  | { type: 'OPEN_DETAIL_VIEW'; payload: string }
  | { type: 'CLOSE_DETAIL_VIEW' }
  | { type: 'RESET_STATE' };

/**
 * Initial state for Chat History component
 */
export const initialChatHistoryState: ChatHistoryState = {
  sessions: [],
  selectedSession: null,
  selectedSessionMessages: [],
  filters: {},
  sessionsPagination: null,
  messagesPagination: null,
  loading: {
    sessions: false,
    messages: false,
    search: false,
  },
  errors: {
    sessions: null,
    messages: null,
    search: null,
  },
  ui: {
    searchExpanded: false,
    detailViewOpen: false,
    viewMode: 'list',
    selectedSessionId: null,
  },
};

/**
 * Duration categories for filtering
 */
export const DURATION_CATEGORIES = {
  SHORT: { label: 'Short (< 5 min)', min: 0, max: 5 * 60 * 1000 },
  MEDIUM: { label: 'Medium (5-30 min)', min: 5 * 60 * 1000, max: 30 * 60 * 1000 },
  LONG: { label: 'Long (> 30 min)', min: 30 * 60 * 1000, max: Infinity },
} as const;

/**
 * Message count categories for filtering
 */
export const MESSAGE_COUNT_CATEGORIES = {
  FEW: { label: 'Few (< 10)', min: 0, max: 10 },
  MODERATE: { label: 'Moderate (10-50)', min: 10, max: 50 },
  MANY: { label: 'Many (> 50)', min: 50, max: Infinity },
} as const;

/**
 * Utility type for duration category keys
 */
export type DurationCategory = keyof typeof DURATION_CATEGORIES;

/**
 * Utility type for message count category keys
 */
export type MessageCountCategory = keyof typeof MESSAGE_COUNT_CATEGORIES;