"use client";
import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function Analytics() {
  type Metric = {
    date: string;
    conversations: number;
    leads: number;
    messages: number;
  };
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/metrics`)
      .then(res => res.json())
      .then(data => {
        if (data) setMetrics(data);
        setLoading(false);
      });
  }, []);

  return (
  <div className="p-8 bg-white text-gray-900">
      <h2 className="font-bold text-2xl mb-6">Analytics / Performance</h2>
      {loading ? (
  <div className="text-gray-500">Loading analytics...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
            <h3 className="font-semibold mb-2">Conversations Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics}>
                <XAxis dataKey="date" stroke="#ccc" />
                <YAxis stroke="#ccc" />
                <Tooltip />
                <Line type="monotone" dataKey="conversations" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
            <h3 className="font-semibold mb-2">Response Time Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics}>
                <XAxis dataKey="date" stroke="#ccc" />
                <YAxis stroke="#ccc" />
                <Tooltip />
                <Bar dataKey="avg_response_time" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}