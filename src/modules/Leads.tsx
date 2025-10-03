"use client";
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function Leads() {
  const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!);
  type Lead = {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    created_at: string;
  };
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leads`)
      .then(res => res.json())
      .then(data => {
        if (data) setLeads(data);
      });
    socket.on("lead:new", (lead: Lead) => {
      setLeads((prev) => [lead, ...prev]);
    });
    return () => {
      socket.off("lead:new");
    };
  }, [socket]);

  return (
  <div className="p-8 bg-white text-gray-900">
  <h2 className="font-bold text-2xl mb-6 text-gray-900">Leads</h2>
  <ul className="space-y-4">
        {leads.map((lead) => (
          <li key={lead.id} className="bg-white rounded-xl p-4 shadow border border-gray-200">
            <div className="font-semibold text-lg text-gray-900">{lead.name}</div>
            <div className="text-sm text-gray-500">Email: {lead.email}</div>
            <div className="text-sm text-gray-500">Phone: {lead.phone}</div>
            <div className="text-sm text-gray-500">Company: {lead.company}</div>
            <div className="text-xs text-gray-400">Created: {new Date(lead.created_at).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
