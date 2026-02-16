import { redirect } from "next/navigation";

/**
 * Legacy edit page — redirects to the project detail page which now uses a dialog.
 */
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
