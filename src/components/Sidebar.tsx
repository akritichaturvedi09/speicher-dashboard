"use client";
import React from "react";

const modules = [
  { name: "Inbox", label: "Inbox / Conversations" },
  { name: "ChatHistory", label: "Chat History" },
  { name: "Leads", label: "Leads" },
  { name: "Analytics", label: "Analytics / Performance" },
  { name: "Sales", label: "Sales / Business Analytics" },
  { name: "Inventory", label: "Inventory / Stock" },
  { name: "CRM", label: "CRM / Customer Insights" },
  { name: "KnowledgeBase", label: "Knowledge Base" },
  { name: "Automations", label: "Automations & Integrations" },
  { name: "Settings", label: "Settings" },
];

export default function Sidebar({ selected, setSelectedAction }: { selected: string; setSelectedAction: (m: string) => void }) {
  return (
  <aside className="h-full w-64 bg-white text-gray-900 flex flex-col py-6 px-2 border-r border-gray-200">
      <div className="text-2xl font-bold mb-8 text-center">Speicher Dashboard</div>
      <nav className="flex-1">
        {modules.map((mod) => (
          <button
            key={mod.name}
            className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition-colors font-medium border ${selected === mod.name ? "bg-blue-100 border-blue-300 text-blue-900" : "hover:bg-gray-100 border-gray-300 text-gray-900"}`}
            onClick={() => setSelectedAction(mod.name)}
          >
            {mod.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
