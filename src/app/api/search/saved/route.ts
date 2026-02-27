import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserSavedSearches, createSavedSearch, deleteSavedSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/saved — List user's saved searches
 * POST /api/search/saved — Create a saved search
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searches = await getUserSavedSearches(user.id);
  return NextResponse.json({ searches });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.name || !body.query) {
      return NextResponse.json({ error: "Name and query required" }, { status: 400 });
    }

    const saved = await createSavedSearch(user.id, {
      name: body.name,
      query: body.query,
      mode: body.mode,
      filters: body.filters,
    });

    return NextResponse.json({ saved }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save search" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Search ID required" }, { status: 400 });
  }

  const deleted = await deleteSavedSearch(user.id, id);
  return NextResponse.json({ deleted });
}
