"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChooseRole() {
  const router = useRouter();
  const [role, setRole] = useState<"photographer" | "agent" | null>(null);

  async function handleContinue() {
    // Always allow click; no disabled blocking
    if (!role) {
      console.warn("Continue clicked without role selection");
      return;
    }

    try {
      await fetch("/api/user/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
    } catch (e) {
      console.error("Failed to set role", e);
      // Even if API fails, still let user through so flow is not blocked
    }

    // Send user to dashboard no matter what
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col items-center mt-20 space-y-8">
      <h1 className="text-2xl font-bold">Choose Your Role</h1>

      <div className="flex gap-6">
        <button
          type="button"
          className={`px-6 py-3 border rounded-md ${
            role === "photographer" ? "bg-yellow-400 text-black font-bold" : "bg-white text-black"
          }`}
          onClick={() => setRole("photographer")}
        >
          Photographer
        </button>

        <button
          type="button"
          className={`px-6 py-3 border rounded-md ${
            role === "agent" ? "bg-yellow-400 text-black font-bold" : "bg-white text-black"
          }`}
          onClick={() => setRole("agent")}
        >
          Real Estate Agent
        </button>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        className={`px-8 py-3 rounded-md font-bold transition-all ${
          role
            ? "bg-green-500 text-white cursor-pointer"
            : "bg-gray-500 text-white cursor-pointer"
        }`}
      >
        Continue →
      </button>
    </div>
  );
}
