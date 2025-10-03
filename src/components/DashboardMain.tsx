"use client";
import React, { useState } from 'react';
import Sidebar from "./Sidebar";
import Inbox from "../modules/Inbox";
import Leads from "../modules/Leads";
import Analytics from "../modules/Analytics";
import Sales from "../modules/Sales";
import Inventory from "../modules/Inventory";
import CRM from "../modules/CRM";
import KnowledgeBase from "../modules/KnowledgeBase";
import Automations from "../modules/Automations";
import Settings from "../modules/Settings";

export default function DashboardMain() {
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
        {selectedModule === "Inbox" && <Inbox />}
        {selectedModule === "Leads" && <Leads />}
        {selectedModule === "Analytics" && <Analytics />}
        {selectedModule === "Sales" && <Sales />}
        {selectedModule === "Inventory" && <Inventory />}
        {selectedModule === "CRM" && <CRM />}
        {selectedModule === "KnowledgeBase" && <KnowledgeBase />}
        {selectedModule === "Automations" && <Automations />}
        {selectedModule === "Settings" && <Settings />}
      </main>
    </div>
  );
}
