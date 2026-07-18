import { isSuperUser } from "@/lib/auth/super-user";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function requireSuperUser() {
  const user = await currentUser();

  if (!isSuperUser(user)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
