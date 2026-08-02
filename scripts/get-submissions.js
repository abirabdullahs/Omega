// scripts/get-submissions.js
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  const p = path.resolve(process.cwd(), 'serviceAccount.json');
  if (!fs.existsSync(p)) {
    console.error('Place service account JSON at:', p, 'or set FIREBASE_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  const sa = await loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  // Usage:
  // node scripts/get-submissions.js recent
  // node scripts/get-submissions.js task <TASK_ID> [pending|graded|all]
  const argv = process.argv.slice(2);
  const mode = argv[0] || 'recent';

  if (mode === 'recent') {
    // Avoid collectionGroup queries (may require special indexes). Instead
    // fetch recent tasks and read a bounded number of recent entries per task,
    // then merge/sort locally.
    const tasksSnap = await db.collection('tasks').orderBy('updatedAt', 'desc').limit(20).get();
    const taskIds = tasksSnap.docs.map(d => d.id);
    const fetched = [];
    for (const tId of taskIds) {
      const entriesSnap = await db.collection('submissions').doc(tId).collection('entries').orderBy('submittedAt', 'desc').limit(5).get();
      for (const doc of entriesSnap.docs) {
        const data = doc.data();
        fetched.push({ doc, data, taskId: tId });
      }
    }

    const items = [];
    for (const it of fetched) {
      const taskDoc = await db.collection('tasks').doc(it.taskId).get();
      items.push({
        id: it.doc.id,
        taskId: it.taskId,
        taskTitle: taskDoc?.exists ? (taskDoc.data().title || '') : '',
        studentId: it.data.studentId,
        studentPhone: it.data.studentPhone,
        text: it.data.text,
        submittedAt: it.data.submittedAt ? (it.data.submittedAt.toDate ? it.data.submittedAt.toDate() : it.data.submittedAt) : null,
        grade: it.data.grade || null,
      });
    }

    // sort by submittedAt desc and limit
    items.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });

    console.log(JSON.stringify({ items: items.slice(0, 20) }, null, 2));
    process.exit(0);
  } else if (mode === 'task') {
    const taskId = argv[1];
    const status = argv[2] || 'all'; // pending|graded|all
    if (!taskId) {
      console.error('Usage: node scripts/get-submissions.js task <TASK_ID> [pending|graded|all]');
      process.exit(1);
    }
    let ref = db.collection('submissions').doc(taskId).collection('entries').orderBy('submittedAt', 'desc');
    if (status === 'pending') ref = ref.where('grade', '==', null);
    if (status === 'graded') ref = ref.where('grade', '!=', null);
    const snap = await ref.get();
    const items = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
    console.log(JSON.stringify({ items }, null, 2));
    process.exit(0);
  } else {
    console.error('Unknown mode:', mode);
    process.exit(2);
  }
}

main().catch(e => { console.error(e); process.exit(1); });