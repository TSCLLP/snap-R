"use client";

import { useState } from "react";

export default function ChooseRole() {
  const [role, setRole] = useState<"photographer" | "agent" | null>(null);

  async function handleContinue() {
    if (!role) {
      console.warn("No role selected");
      return;
    }

    // Save role → non-blocking
    try {
      await fetch("/api/user/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
    } catch (err) {
      console.error("Role save error", err);
      // NO BLOCK — navigation must continue
    }

    // 🚀 NAVIGATION MUST NEVER FAIL
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 100);
  }

  return (
    <div className="flex flex-col items-center mt-24 gap-10 px-6">
      <h1 className="text-3xl font-bold">Choose Your Role</h1>

      <div className="flex gap-10">
        <button
          type="button"
          onClick={() => setRole("photographer")}
          className={`px-8 py-4 border rounded-lg text-lg ${
            role === "photographer"
              ? "bg-yellow-400 border-yellow-600 font-bold"
              : "bg-white border-gray-400"
          }`}
        >
          Photographer
        </button>

        <button
          type="button"
          onClick={() => setRole("agent")}
          className={`px-8 py-4 border rounded-lg text-lg ${
            role === "agent"
              ? "bg-yellow-400 border-yellow-600 font-bold"
              : "bg-white border-gray-400"
          }`}
        >
          Real Estate Agent
        </button>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        className="px-10 py-4 bg-green-600 text-white rounded-lg text-lg font-bold"
      >
        Continue →
      </button>
    </div>
  );
}
