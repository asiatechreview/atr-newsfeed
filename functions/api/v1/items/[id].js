import { json, loadBulletinItems, publicId, stripPublicId, toPublicItem } from "../../../_lib/public-api.js";

export async function onRequestGet({ params, request }) {
  const requestedId = stripPublicId(params.id);
  const items = await loadBulletinItems(request, { limit: 500 });
  const item = items
    .map(toPublicItem)
    .find((candidate) => stripPublicId(candidate.id) === requestedId || stripPublicId(candidate.raw_id) === requestedId || candidate.id === publicId(requestedId));

  if (!item) {
    return json({
      error: "Not found",
      id: publicId(requestedId)
    }, 404, 60);
  }

  return json(item);
}
