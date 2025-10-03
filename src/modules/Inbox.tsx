"use client";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
interface Conversation {
  id: string;
  initialMessage: string;
  status: string;
  startedAt: string;
  userName: string;
  userEmail: string;
  tags: string[];
}
interface Message {
  conversationId: string;
  sender: string;
  message: string;
  createdAt: string;
}
interface LiveChatNotification {
  conversationId: string;
  message: string;
  createdAt: string;
  user: string;
  email: string;
}
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!);

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [liveChatNotification, setLiveChatNotification] = useState<LiveChatNotification | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations?status=live,active`)
      .then(res => res.json())
      .then(data => {
        if (data) setConversations(data);
      });
    socket.on("conversation:new", (conv: Conversation) => {
      setConversations((prev) => [conv, ...prev]);
    });
    socket.on("livechat:request", (payload: LiveChatNotification) => {
      setLiveChatNotification(payload);
      setConversations((prev) => [
        {
          id: payload.conversationId,
          initialMessage: payload.message,
          status: "live",
          startedAt: payload.createdAt,
          userName: payload.user,
          userEmail: payload.email,
          tags: ["Live Chat"],
        },
        ...prev,
      ]);
      setTimeout(() => setLiveChatNotification(null), 5000);
    });
    return () => {
      socket.off("conversation:new");
      socket.off("livechat:request");
    };
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages?conversationId=${selectedConv.id}`)
        .then(res => res.json())
        .then(data => {
          if (data) setMessages(data);
        });
  socket.emit("join", selectedConv.id);
      socket.on("message:new", (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
      });
      return () => {
        socket.off("message:new");
      };
    }
  }, [selectedConv]);

  const filteredConvs = conversations.filter(
    (conv) =>
      conv.initialMessage?.toLowerCase().includes(search.toLowerCase()) ||
      conv.status?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full relative">
      {liveChatNotification && (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-900 px-6 py-3 rounded-xl shadow-lg z-50 animate-bounce">
          <span className="font-bold">Live Chat Requested!</span>
          <div className="text-sm mt-1">User: {liveChatNotification.user || 'Unknown'}</div>
          <div className="text-sm">Email: {liveChatNotification.email || 'Unknown'}</div>
          <div className="text-sm">Message: {liveChatNotification.message}</div>
          <button
            className="mt-2 bg-green-100 hover:bg-green-200 px-4 py-1 rounded text-green-900 border border-green-300"
            onClick={() => {
              setConversations((prev) => prev.map(conv =>
                conv.id === liveChatNotification.conversationId
                  ? { ...conv, status: "active" }
                  : conv
              ));
              setLiveChatNotification(null);
              setSelectedConv({
                id: liveChatNotification.conversationId,
                initialMessage: liveChatNotification.message,
                status: "active",
                startedAt: liveChatNotification.createdAt,
                userName: liveChatNotification.user,
                userEmail: liveChatNotification.email,
                tags: ["Live Chat"],
              });
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
          {filteredConvs.map((conv) => (
            <li
              key={conv.id}
              className={`p-2 rounded cursor-pointer mb-2 border ${selectedConv?.id === conv.id ? "bg-blue-100 border-blue-300 text-blue-900" : "bg-gray-100 border-gray-300 text-gray-900"}`}
              onClick={() => setSelectedConv(conv)}
            >
              <div className="font-semibold">{conv.initialMessage?.slice(0, 40) || "New Conversation"}</div>
              <div className="text-xs text-gray-500">{conv.status} • {new Date(conv.startedAt).toLocaleString()}</div>
              <div className="text-xs text-blue-700">{conv.tags?.join(", ")}</div>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex-1 p-8">
        {selectedConv ? (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h2 className="font-bold text-xl mb-4">Conversation</h2>
            <div className="space-y-2 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={msg.sender === "agent" ? "text-right" : "text-left"}>
                  <span className={msg.sender === "agent" ? "bg-blue-100 text-blue-900 px-3 py-2 rounded-xl inline-block shadow border border-blue-300" : "bg-gray-100 text-gray-900 px-3 py-2 rounded-xl inline-block shadow border border-gray-300"}>
                    {msg.message}
                    {msg.sender === "user" && <span className="ml-2 text-xs text-blue-400">(User)</span>}
                    {msg.sender === "agent" && <span className="ml-2 text-xs text-green-400">(You)</span>}
                  </span>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 mt-4"
              onSubmit={e => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('adminMessage') as HTMLInputElement);
                const message = input.value.trim();
                if (!message) return;
                socket.emit("message:new", {
                  conversationId: selectedConv.id,
                  sender: "agent",
                  message,
                  createdAt: new Date().toISOString(),
                });
                setMessages(prev => [...prev, {
                  conversationId: selectedConv.id,
                  sender: "agent",
                  message,
                  createdAt: new Date().toISOString(),
                }]);
                input.value = "";
              }}
            >
              <input
                type="text"
                name="adminMessage"
                className="flex-1 p-2 rounded bg-gray-100 text-gray-900 border border-gray-300"
                placeholder="Type your message..."
                autoComplete="off"
              />
              <button type="submit" className="bg-blue-100 hover:bg-blue-200 rounded px-3 py-1 text-blue-900 border border-blue-300">Send</button>
            </form>
            <div className="mt-4">
              <div className="font-semibold">User Info</div>
              <div className="text-xs text-gray-500">Name: {selectedConv.userName}</div>
              <div className="text-xs text-gray-500">Email: {selectedConv.userEmail}</div>
              <div className="text-xs text-gray-500">Tags: {selectedConv.tags?.join(", ")}</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Select a conversation to view messages.</div>
        )}
      </main>
    </div>
  );
}
