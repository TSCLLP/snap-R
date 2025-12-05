import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const json = await request.json();

  const { data: existingUser } = await supabase.auth.getUser();
  if (!existingUser?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("profiles")
    .update({ role: json.role })
    .eq("id", existingUser.user.id);

  return NextResponse.json({ success: true });
}

