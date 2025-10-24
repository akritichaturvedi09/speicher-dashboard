"use client";
import React, { useState } from 'react';
import Sidebar from "./Sidebar";
import ErrorBoundary from "./ErrorBoundary";
import Inbox from "../modules/Inbox";
import ChatHistory from "../modules/ChatHistory";
import Leads from "../modules/Leads";
import Analytics from "../modules/Analytics";
import Sales from "../modules/Sales";
import Inventory from "../modules/Inventory";
import CRM from "../modules/CRM";
import KnowledgeBase from "../modules/KnowledgeBase";
import Automations from "../modules/Automations";
import Settings from "../modules/Settings";

function DashboardMainComponent() {
  // Sidebar navigation state
  const [selectedModule, setSelectedModule] = useState<string>("Inbox");

  return (
    <div className="flex h-screen bg-white text-gray-900">
      {/* Topbar with notifications */}
      <div className="fixed top-0 left-0 w-full h-16 bg-white flex items-center justify-between px-8 shadow z-40 border-b border-gray-200">
        <div className="font-bold text-xl">Speicher Admin Dashboard</div>
      </div>
      {/* Sidebar navigation */}
      <Sidebar selected={selectedModule} setSelectedAction={setSelectedModule} />
      {/* Main content area: render selected module */}
      <main className="flex-1 pt-20 p-8">
        <ErrorBoundary
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Module Error</h3>
                <p className="text-gray-600 text-sm mb-4">
                  The {selectedModule} module encountered an error. Try switching to a different module or refresh the dashboard.
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setSelectedModule("Inbox")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Go to Inbox
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Refresh Dashboard
                  </button>
                </div>
              </div>
            </div>
          }
        >
          {selectedModule === "Inbox" && <Inbox />}
          {selectedModule === "ChatHistory" && <ChatHistory />}
          {selectedModule === "Leads" && <Leads />}
          {selectedModule === "Analytics" && <Analytics />}
          {selectedModule === "Sales" && <Sales />}
          {selectedModule === "Inventory" && <Inventory />}
          {selectedModule === "CRM" && <CRM />}
          {selectedModule === "KnowledgeBase" && <KnowledgeBase />}
          {selectedModule === "Automations" && <Automations />}
          {selectedModule === "Settings" && <Settings />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

// Wrap with error boundary
export default function DashboardMain() {
  return (
    <ErrorBoundary>
      <DashboardMainComponent />
    </ErrorBoundary>
  );
}
