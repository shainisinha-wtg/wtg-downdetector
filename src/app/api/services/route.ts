import { NextResponse } from "next/server";
import { getServiceList } from "@/modules/services/service-queries";

export async function GET() {
  try {
    const services = await getServiceList();
    return NextResponse.json(services);
  } catch {
      return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}
