const { storageMode, hasBlobConfig, readStore, writeStore } = require('../lib/store');
const { resolveCompanyId } = require('../lib/company-resolve');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let companyId = null;
  try {
    companyId = await resolveCompanyId(req);
  } catch {
    companyId = req.query?.companyId || null;
  }

  const mode = storageMode();
  let blobWriteOk = null;
  let blobWriteError = null;
  let userCount = 0;

  if (companyId) {
    const store = await readStore(companyId);
    userCount = Object.keys(store.users || {}).length;

    if (mode === 'blob' && req.query.test === '1' && process.env.VERCEL_ENV !== 'production') {
      try {
        store._healthCheck = new Date().toISOString();
        await writeStore(companyId, store);
        blobWriteOk = true;
      } catch (err) {
        blobWriteOk = false;
        blobWriteError = err.blobError || err.message;
      }
    }
  }

  res.status(200).json({
    storageMode: mode,
    hasBlobConfig: hasBlobConfig(),
    companyId,
    userCount,
    blobWriteError,
    env: {
      VERCEL: !!process.env.VERCEL,
      BLOB_STORE_ID: !!process.env.BLOB_STORE_ID,
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      LEGACY_STORE_COMPANY_ID: !!process.env.LEGACY_STORE_COMPANY_ID,
    },
    blobWriteOk,
  });
};
