"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ChooseRole() {
  const [role, setRole] = useState<"photographer" | "agent" | "">("");
  const router = useRouter();

  const handleContinue = async () => {
    if (!role) return;
    await fetch("/api/user/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col items-center mt-20 space-y-6">
      <h1 className="text-xl font-bold">Choose Your Role</h1>

      <div className="flex gap-6">
        <button
          className={`px-6 py-3 rounded-md border ${role === "photographer" ? "bg-yellow-400 text-black" : ""}`}
          onClick={() => setRole("photographer")}
        >
          Photographer
        </button>

        <button
          className={`px-6 py-3 rounded-md border ${role === "agent" ? "bg-yellow-400 text-black" : ""}`}
          onClick={() => setRole("agent")}
        >
          Real Estate Agent
        </button>
      </div>

      <Button
        disabled={!role}
        onClick={handleContinue}
      >
        Continue →
      </Button>
    </div>
  );
}

