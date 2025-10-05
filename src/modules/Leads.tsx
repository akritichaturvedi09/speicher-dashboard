"use client";
import React, { useEffect, useState } from "react";

export default function Leads() {
  type QuestionAnswerPair = {
    id: string;
    conversationId: string;
    question: string;
    answer: string;
    stepId: string;
    createdAt: string;
  };

  type Lead = {
    _id?: { $oid: string };
    id?: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    questionAnswerPairs?: QuestionAnswerPair[];
    createdAt: string | { $date: string };
    updatedAt?: string | { $date: string };
    status?: string;
    created_at?: string;
  };

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getServiceInterest = (pairs?: QuestionAnswerPair[]) => {
    const serviceAnswer = pairs?.find(
      (pair) => pair.stepId === "greeting"
    )?.answer;
    return serviceAnswer || "Not specified";
  };

  const getBudget = (pairs?: QuestionAnswerPair[]) => {
    const budgetAnswer = pairs?.find(
      (pair) => pair.stepId === "budget"
    )?.answer;
    return budgetAnswer || "Not specified";
  };

  const getTimeline = (pairs?: QuestionAnswerPair[]) => {
    const timelineAnswer = pairs?.find(
      (pair) => pair.stepId === "timeline"
    )?.answer;
    return timelineAnswer || "Not specified";
  };

  const getPlatform = (pairs?: QuestionAnswerPair[]) => {
    const platformAnswer = pairs?.find(
      (pair) =>
        pair.stepId === "ecommerce" ||
        pair.stepId === "digitalMarketing" ||
        pair.stepId === "websiteApp" ||
        pair.stepId === "itCloud" ||
        pair.stepId === "justBrowsing"
    )?.answer;

    return platformAnswer || "Not specified";
  };

  const formatDate = (dateValue: string | { $date: string }) => {
    if (typeof dateValue === "string") {
      return new Date(dateValue).toLocaleString();
    }
    return new Date(dateValue.$date).toLocaleString();
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/leads`);

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data)) {
        setLeads(data);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch leads");
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  if (loading) {
    return (
      <div className="p-8 bg-white text-gray-900">
        <h2 className="font-bold text-2xl mb-6 text-gray-900">Leads</h2>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-3 text-gray-600">Loading leads...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-white text-gray-900">
        <h2 className="font-bold text-2xl mb-6 text-gray-900">Leads</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading leads: {error}</p>
          <button
            onClick={fetchLeads}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-bold text-2xl text-gray-900">Leads</h2>
        <button
          onClick={fetchLeads}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Refreshing...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>
      <div className="space-y-4">
        {leads.map((lead) => {
          const leadId = lead._id?.$oid || lead.id || Math.random().toString();
          const createdDate = lead.createdAt || lead.created_at || "";

          return (
            <div
              key={leadId}
              className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-xl text-gray-900">
                    {lead.name}
                  </h3>
                  <p className="text-sm text-gray-600">{lead.company}</p>
                </div>
                {lead.status && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      lead.status === "new"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{lead.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{lead.phone}</p>
                </div>
              </div>

              {lead.questionAnswerPairs &&
                lead.questionAnswerPairs.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Service Requirements
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Service Interest
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {getServiceInterest(lead.questionAnswerPairs)}
                        </p>
                      </div>
                      {getPlatform(lead.questionAnswerPairs) !==
                        "Not specified" && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            Platform
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {getPlatform(lead.questionAnswerPairs)}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Budget
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {getBudget(lead.questionAnswerPairs)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Timeline
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {getTimeline(lead.questionAnswerPairs)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="border-t pt-3 mt-4">
                <p className="text-xs text-gray-400">
                  Created: {formatDate(createdDate)}
                </p>
              </div>
            </div>
          );
        })}

        {leads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No leads yet. New leads will appear here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
