import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";

export async function GET() {
  const { requireAccessPassword } = getAppConfig();

  return NextResponse.json({
    ok: true,
    service: "mail-code-panel",
    requireAccessPassword
  });
}
