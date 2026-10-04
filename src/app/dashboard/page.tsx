import { redirect } from "next/navigation";

/** Preserve old bookmarks while keeping Projects as the single home. */
export default function DashboardPage() {
  redirect("/projects");
}
