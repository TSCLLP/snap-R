import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const rawRole = String(body.role || "").toLowerCase();

    let normalized: "photographer" | "agent";
    switch (rawRole) {
      case "photographer":
        normalized = "photographer";
        break;
      case "agent":
      case "real estate agent":
      case "broker":
      case "property owner":
      case "owner":
      case "others":
      default:
        normalized = "agent";
        break;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabase
      .from("profiles")
      .update({ role: normalized })
      .eq("id", user.id);

    return NextResponse.json({ success: true, role: normalized });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to set role" },
      { status: 500 }
    );
  }
}
