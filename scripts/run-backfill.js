const path = require('path');
const admin = require('firebase-admin');

async function main() {
  const mode = (process.argv[2] || 'preview').toLowerCase(); // 'preview' or 'apply'
  const batchSize = parseInt(process.argv[3], 10) || 500;

  const servicePath = path.join(__dirname, '..', 'omega-90935-firebase-adminsdk-fbsvc-c1f8995154.json');
  let serviceAccount;
  try {
    serviceAccount = require(servicePath);
  } catch (err) {
    console.error('Failed to load service account JSON at', servicePath);
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();

  console.log(`Running backfill (${mode}) with batchSize=${batchSize}...`);

  const snap = await db.collection('users').get();
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));

  const toUpdate = docs.filter((d) => {
    const hasRole = d.data && typeof d.data.role !== 'undefined' && d.data.role !== null && d.data.role !== '';
    const hasCreatedAt = d.data && typeof d.data.createdAt !== 'undefined' && d.data.createdAt !== null && d.data.createdAt !== '';
    return !hasRole || !hasCreatedAt;
  });

  console.log(`Total users: ${docs.length}. To update: ${toUpdate.length}`);

  if (mode === 'preview') {
    console.log('Sample missing docs (up to 20):');
    toUpdate.slice(0, 20).forEach((d) => {
      console.log(`- ${d.id}: roleMissing=${!d.data.role}, createdAtMissing=${!d.data.createdAt}`);
    });
    process.exit(0);
  }

  // apply
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batchDocs = toUpdate.slice(i, i + batchSize);
    const batch = db.batch();
    for (const docInfo of batchDocs) {
      const docRef = db.collection('users').doc(docInfo.id);
      const updates = {};
      if (!docInfo.data.role) updates.role = 'student';
      if (!docInfo.data.createdAt) updates.createdAt = Date.now();
      batch.update(docRef, updates);
    }
    await batch.commit();
    updated += batchDocs.length;
    console.log(`Committed batch: ${updated}/${toUpdate.length}`);
  }

  console.log(`Backfill complete. Updated ${updated} user docs.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill script error:', err && err.message ? err.message : err);
  process.exit(1);
});
