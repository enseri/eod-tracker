/** Normalize Whop company id for storage keys / paths. */
function sanitizeCompanyId(companyId) {
  if (!companyId || typeof companyId !== 'string') {
    throw Object.assign(new Error('companyId is required'), { status: 400 });
  }
  const id = companyId.trim();
  if (!id) {
    throw Object.assign(new Error('companyId is required'), { status: 400 });
  }
  return id;
}

function storageSlug(companyId) {
  return sanitizeCompanyId(companyId).replace(/[^a-zA-Z0-9_-]/g, '_');
}

module.exports = { sanitizeCompanyId, storageSlug };
