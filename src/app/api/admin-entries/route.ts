import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createAdminEntry,
  createManyAdminEntries,
  deleteAdminEntry,
  readAdminEntries,
  updateAdminEntry,
} from "@/lib/admin-entries";
import type { UpsertInput } from "@/lib/admin-entries";
import type { AdminEntry } from "@/types/admin-entry";

async function isAuthorized(password?: string): Promise<boolean> {
  const cookieStore = await cookies();
  const hasAdminCookie = cookieStore.get("admin_access")?.value === "true";
  if (hasAdminCookie) return true;
  return Boolean(password && password === process.env.ADMIN_PASSWORD);
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const entries = await readAdminEntries();
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  try {
    const { password, entry, entries } = (await request.json()) as {
      password?: string;
      entry?: Record<string, unknown>;
      entries?: Record<string, unknown>[];
    };
    if (!(await isAuthorized(password))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (Array.isArray(entries)) {
      const createdEntries = await createManyAdminEntries(entries as UpsertInput[]);
      return NextResponse.json({ entries: createdEntries }, { status: 201 });
    }
    if (!entry || typeof entry !== "object") {
      return NextResponse.json({ error: "Invalid entry payload" }, { status: 400 });
    }
    const created = await createAdminEntry(entry as UpsertInput);
    return NextResponse.json({ entry: created }, { status: 201 });
  } catch (error) {
    console.error("Create admin entry failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { password, id, entry } = (await request.json()) as {
      password?: string;
      id?: string;
      entry?: Record<string, unknown>;
    };
    if (!(await isAuthorized(password))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!id || !entry || typeof entry !== "object") {
      return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
    }
    const updated = await updateAdminEntry(id, entry as Partial<AdminEntry>);
    if (!updated) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({ entry: updated });
  } catch (error) {
    console.error("Update admin entry failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { password, id } = (await request.json()) as { password?: string; id?: string };
    if (!(await isAuthorized(password))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const deleted = await deleteAdminEntry(id);
    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete admin entry failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
