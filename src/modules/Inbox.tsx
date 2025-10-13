"use client";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { ChatSession, ChatMessage } from '../../../speicher-chatbot/src/shared/types';

interface LiveChatNotification {
  sessionId: string;
  message: string;
  createdAt: string;
  user: string;
  email: string;
}

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002');

export default function Inbox() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [liveChatNotification, setLiveChatNotification] = useState<LiveChatNotification | null>(null);
  const [agentInfo] = useState({ id: 'agent_1', name: 'Support Agent' });

  useEffect(() => {
    // Fetch existing chat sessions
    fetch('/api/chat-sessions?status=waiting,active')
      .then(res => res.json())
      .then(data => {
        if (data) setChatSessions(data);
      })
      .catch(error => console.error('Error fetching sessions:', error));

    // Listen for new chat sessions
    socket.on("new-chat-session", (session: ChatSession) => {
      setChatSessions((prev) => [session, ...prev]);
      
      // Show notification for new session
      setLiveChatNotification({
        sessionId: session.id,
        message: session.initialMessage,
        createdAt: session.createdAt,
        user: session.userName,
        email: session.userEmail,
      });
      
      setTimeout(() => setLiveChatNotification(null), 10000);
    });

    return () => {
      socket.off("new-chat-session");
    };
  }, []);

  useEffect(() => {
    if (selectedSession) {
      // Fetch messages for selected session
      fetch(`/api/chat-messages?sessionId=${selectedSession.id}`)
        .then(res => res.json())
        .then(data => {
          if (data) setMessages(data);
        })
        .catch(error => console.error('Error fetching messages:', error));

      // Join the session room
      socket.emit("join-session", selectedSession.id);
      
      // Listen for new messages
      socket.on("new-message", (message: ChatMessage) => {
        if (message.sessionId === selectedSession.id) {
          setMessages((prev) => [...prev, message]);
        }
      });

      return () => {
        socket.off("new-message");
      };
    }
  }, [selectedSession]);

  const filteredSessions = chatSessions.filter(
    (session) =>
      session.initialMessage?.toLowerCase().includes(search.toLowerCase()) ||
      session.status?.toLowerCase().includes(search.toLowerCase()) ||
      session.userName?.toLowerCase().includes(search.toLowerCase()) ||
      session.userEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const joinChatSession = (session: ChatSession) => {
    // Update session status to active and assign agent
    fetch('/api/chat-sessions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        status: 'active',
        agentId: agentInfo.id,
        agentName: agentInfo.name
      })
    });

    // Emit agent join event
    socket.emit("agent-join-session", {
      sessionId: session.id,
      agentId: agentInfo.id,
      agentName: agentInfo.name
    });

    // Update local state
    setChatSessions(prev => prev.map(s => 
      s.id === session.id 
        ? { ...s, status: 'active', agentId: agentInfo.id, agentName: agentInfo.name }
        : s
    ));
    
    setSelectedSession({
      ...session,
      status: 'active',
      agentId: agentInfo.id,
      agentName: agentInfo.name
    });
    
    setLiveChatNotification(null);
  };

  const sendMessage = (messageText: string) => {
    if (!selectedSession || !messageText.trim()) return;

    const messageData: Omit<ChatMessage, '_id'> = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: selectedSession.id,
      sender: 'agent',
      message: messageText.trim(),
      createdAt: new Date().toISOString()
    };

    socket.emit("send-message", messageData);
    setMessages(prev => [...prev, messageData]);
  };

  return (
    <div className="flex h-full relative">
      {liveChatNotification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-900 px-6 py-3 rounded-xl shadow-lg z-50 animate-bounce">
          <span className="font-bold">New Live Chat Request!</span>
          <div className="text-sm mt-1">User: {liveChatNotification.user || 'Unknown'}</div>
          <div className="text-sm">Email: {liveChatNotification.email || 'Unknown'}</div>
          <div className="text-sm">Message: {liveChatNotification.message}</div>
          <button
            className="mt-2 bg-green-100 hover:bg-green-200 px-4 py-1 rounded text-green-900 border border-green-300"
            onClick={() => {
              const session = chatSessions.find(s => s.id === liveChatNotification.sessionId);
              if (session) {
                joinChatSession(session);
              }
            }}
          >Accept & Start Chat</button>
        </div>
      )}
  <aside className="w-80 bg-white p-4 border-r border-gray-200 flex flex-col gap-4 h-full">
        <input
          type="text"
          className="p-2 rounded bg-gray-100 text-gray-900 mb-2 border border-gray-300"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="overflow-y-auto flex-1">
          {filteredSessions.map((session) => (
            <li
              key={session.id}
              className={`p-2 rounded cursor-pointer mb-2 border ${selectedSession?.id === session.id ? "bg-blue-100 border-blue-300 text-blue-900" : "bg-gray-100 border-gray-300 text-gray-900"}`}
              onClick={() => setSelectedSession(session)}
            >
              <div className="font-semibold">{session.userName || 'Anonymous User'}</div>
              <div className="text-xs text-gray-600">{session.userEmail}</div>
              <div className="text-xs text-gray-500">{session.initialMessage?.slice(0, 40) || "New Chat Session"}</div>
              <div className="text-xs text-gray-500 flex justify-between">
                <span className={`px-2 py-1 rounded text-xs ${
                  session.status === 'waiting' ? 'bg-orange-100 text-orange-800' :
                  session.status === 'active' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {session.status}
                </span>
                <span>{new Date(session.createdAt).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex-1 p-8">
        {selectedSession ? (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-bold text-xl">Chat with {selectedSession.userName}</h2>
                <p className="text-sm text-gray-500">{selectedSession.userEmail}</p>
              </div>
              <div className="flex gap-2">
                {selectedSession.status === 'waiting' && (
                  <button
                    onClick={() => joinChatSession(selectedSession)}
                    className="bg-green-100 hover:bg-green-200 px-4 py-2 rounded text-green-900 border border-green-300"
                  >
                    Join Chat
                  </button>
                )}
                <span className={`px-3 py-1 rounded text-sm ${
                  selectedSession.status === 'waiting' ? 'bg-orange-100 text-orange-800' :
                  selectedSession.status === 'active' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedSession.status}
                </span>
              </div>
            </div>

            {/* Previous Q&A Context */}
            {selectedSession.questionAnswerPairs && selectedSession.questionAnswerPairs.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <h4 className="font-semibold text-sm mb-2">Previous Conversation Context:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedSession.questionAnswerPairs.slice(-3).map((pair, index) => (
                    <div key={index} className="text-xs">
                      <div className="text-gray-600">Q: {pair.question}</div>
                      <div className="text-blue-600 mb-1">A: {pair.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={msg.sender === "agent" ? "text-right" : "text-left"}>
                  <div className={`inline-block px-3 py-2 rounded-xl max-w-xs ${
                    msg.sender === "agent" 
                      ? "bg-blue-500 text-white" 
                      : "bg-gray-200 text-gray-800"
                  }`}>
                    <div>{msg.message}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <form
              className="flex gap-2"
              onSubmit={e => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('adminMessage') as HTMLInputElement);
                const message = input.value.trim();
                if (!message) return;
                sendMessage(message);
                input.value = "";
              }}
            >
              <input
                type="text"
                name="adminMessage"
                className="flex-1 p-2 rounded bg-gray-100 text-gray-900 border border-gray-300"
                placeholder={selectedSession.status === 'active' ? "Type your message..." : "Join the chat to send messages"}
                disabled={selectedSession.status !== 'active'}
                autoComplete="off"
              />
              <button 
                type="submit" 
                disabled={selectedSession.status !== 'active'}
                className="bg-blue-100 hover:bg-blue-200 rounded px-3 py-1 text-blue-900 border border-blue-300 disabled:bg-gray-200 disabled:text-gray-500"
              >
                Send
              </button>
            </form>
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
