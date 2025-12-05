"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ChooseRole() {
  const router = useRouter();
  const [role, setRole] = useState("");

  return (
    <div className="flex flex-col items-center mt-20 space-y-6">
      <h1 className="text-xl font-bold">Choose your role</h1>

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
        onClick={async () => {
          await fetch("/api/user/set-role", {
            method: "POST",
            body: JSON.stringify({ role }),
          });
          router.push("/dashboard");
        }}
      >
        Continue →
      </Button>
    </div>
  );
}

