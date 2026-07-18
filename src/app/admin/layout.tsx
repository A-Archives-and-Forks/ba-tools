import { isSuperUser } from "@/lib/auth/super-user";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

export default async function AdminLayout({ children }: PropsWithChildren) {
  const user = await currentUser();

  if (!isSuperUser(user)) {
    redirect("/");
  }

  return children;
}
