import { NextResponse } from "next/server";
import { publicState, reset } from "@/lib/db";

export async function POST() {
  reset();
  return NextResponse.json(publicState());
}
