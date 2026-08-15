import { isAdmin } from "../_lib/admin-auth.js";
import { writeOperationalEvent } from "../_lib/operational-log.js";
import {
  ensureCategoriesTable,
  seedCategories,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../_lib/categories.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin(env, request) {
  if (!(await isAdmin(env, request))) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

export async function onRequestGet({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;

  try {
    await ensureCategoriesTable(env);
    await seedCategories(env);
    const categories = await listCategories(env);
    return json({ categories, count: categories.length });
  } catch (error) {
    return json({ error: error.message || "failed to list categories" }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    await ensureCategoriesTable(env);
    await createCategory(env, {
      name: clean(body.name),
      pattern: clean(body.pattern)
    });
    await writeOperationalEvent(env, request, {
      workflow: "categories",
      action: "create",
      status: "success",
      severity: "info",
      http_status: 200,
      message: `Category created: ${clean(body.name)}`
    });
    const categories = await listCategories(env);
    return json({ categories, count: categories.length });
  } catch (error) {
    return json({ error: error.message || "failed to create category" }, 400);
  }
}

export async function onRequestPatch({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    await ensureCategoriesTable(env);
    await updateCategory(env, {
      name: clean(body.name),
      newName: body.newName === undefined ? undefined : clean(body.newName),
      pattern: body.pattern === undefined ? undefined : clean(body.pattern)
    });
    await writeOperationalEvent(env, request, {
      workflow: "categories",
      action: "rename",
      status: "success",
      severity: "info",
      http_status: 200,
      message: `Category renamed: ${clean(body.name)} -> ${clean(body.newName ?? body.name)}`
    });
    const categories = await listCategories(env);
    return json({ categories, count: categories.length });
  } catch (error) {
    return json({ error: error.message || "failed to update category" }, 400);
  }
}

export async function onRequestDelete({ env, request }) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await ensureCategoriesTable(env);
    await deleteCategory(env, {
      name: clean(body.name),
      reassignTo: clean(body.reassignTo)
    });
    await writeOperationalEvent(env, request, {
      workflow: "categories",
      action: "delete",
      status: "success",
      severity: "info",
      http_status: 200,
      message: `Category deleted: ${clean(body.name)} (items reassigned to ${clean(body.reassignTo) || "Other news"})`
    });
    const categories = await listCategories(env);
    return json({ categories, count: categories.length });
  } catch (error) {
    return json({ error: error.message || "failed to delete category" }, 400);
  }
}
