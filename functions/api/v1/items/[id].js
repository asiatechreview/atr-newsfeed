import { json, loadAllBulletinItems, publicId, stripPublicId, toPublicItem } from "../../../_lib/public-api.js";

export async function onRequestGet({ params, request }) {
  const requestedId = stripPublicId(params.id);
  const isNumeric = /^\d+$/.test(requestedId);
  const source = await loadAllBulletinItems(request);
  const item = source.items
    .map(toPublicItem)
    .find((candidate) =>
      isNumeric
        ? stripPublicId(candidate.id) === requestedId || stripPublicId(candidate.raw_id) === requestedId || candidate.id === publicId(requestedId)
        : candidate.link_key === requestedId.toLowerCase()
    );

  if (!item) {
    return json({
      error: "Not found",
      id: publicId(requestedId)
    }, 404, 60);
  }

  return json(item);
}
