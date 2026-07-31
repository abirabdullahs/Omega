import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseServiceAccountValue(raw: string) {
  let value = stripWrappingQuotes(raw);
  if (!value.trim()) return null;

  // If the env value is actually a path, load the file contents.
  if (existsSync(value)) {
    try {
      value = readFileSync(value, "utf8");
    } catch {
      // ignore and continue parsing the original value
    }
  }

  const trimmedValue = value.trim();

  // Support base64-encoded service account JSON (recommended for Vercel).
  if (!trimmedValue.startsWith("{")) {
    try {
      const normalizedBase64 = trimmedValue.replace(/\s+/g, "");
      const decoded = Buffer.from(normalizedBase64, "base64").toString("utf8");
      if (decoded.trim().startsWith("{")) {
        value = decoded;
      }
    } catch {
      // ignore
    }
  }

  value = stripWrappingQuotes(value).trim();

  let parsed = tryParseJson(value);
  if (parsed) return parsed;

  // Vercel sometimes stores JSON with real newlines inside private_key.
  // Convert raw newlines into escaped \n so JSON.parse can succeed.
  if (value.includes("\n") || value.includes("\r")) {
    const compacted = value.replace(/\r?\n/g, "\\n");
    parsed = tryParseJson(compacted);
    if (parsed) return parsed;
  }

  // Also support env values that already use escaped newlines.
  if (value.includes("\\n")) {
    const normalized = value.replace(/\\n/g, "\n");
    parsed = tryParseJson(normalized);
    if (parsed) return parsed;
  }

  return null;
}

function getServiceAccountFromEnv() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64,
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.SERVICE_ACCOUNT_JSON,
    process.env.SERVICE_ACCOUNT_KEY,
    process.env.SERVICE_ACCOUNT,
    process.env.GOOGLE_CREDENTIALS_JSON,
    process.env.GOOGLE_CREDENTIALS,
  ];

  for (const value of candidates) {
    if (!value?.trim()) continue;
    const parsed = parseServiceAccountValue(value);
    if (parsed?.client_email && parsed?.private_key) {
      return {
        ...parsed,
        private_key: String(parsed.private_key).replace(/\\n/g, "\n"),
      };
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

  if (clientEmail && privateKey) {
    return {
      type: "service_account",
      project_id: projectId || "omega-90935",
      private_key: privateKey.replace(/\\n/g, "\n"),
      client_email: clientEmail,
    };
  }

  return null;
}

function getServiceAccountPath() {
  try {
    const explicitPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH;

    if (explicitPath) {
      const resolvedPath = path.isAbsolute(explicitPath)
        ? explicitPath
        : path.resolve(process.cwd(), explicitPath);

      if (existsSync(resolvedPath)) {
        return resolvedPath;
      }
      return null;
    }

    // Skip filesystem scanning on Vercel / serverless — no local key files.
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return null;
    }

    const rootDir = process.cwd();
    const candidateFiles = [
      path.resolve(rootDir, "firebase-service-account.json"),
      path.resolve(rootDir, "firebase-service-account.js"),
    ];

    const matchingFiles = readdirSync(rootDir)
      .filter((fileName) => /firebase|service-account|service_account/i.test(fileName) && /\.json$/i.test(fileName))
      .map((fileName) => path.resolve(rootDir, fileName));

    return [...candidateFiles, ...matchingFiles].find((filePath) => existsSync(filePath)) || null;
  } catch {
    return null;
  }
}

function getServiceAccount() {
  const envServiceAccount = getServiceAccountFromEnv();
  if (envServiceAccount) {
    return envServiceAccount;
  }

  const serviceAccountPath = getServiceAccountPath();
  if (serviceAccountPath) {
    return JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  }

  return null;
}

let auth: any = null;
let db: any = null;
let adminInitError: string | null = null;
let initialized = false;

function ensureFirebaseAdmin() {
  if (initialized) return;
  initialized = true;

  try {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      adminInitError =
        "Firebase Admin SDK is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, FIREBASE_SERVICE_ACCOUNT_BASE64, or GOOGLE_APPLICATION_CREDENTIALS in the Production environment on Vercel.";
      return;
    }

    const projectId =
      serviceAccount.project_id ||
      process.env.FIREBASE_PROJECT_ID ||
      "omega-90935";

    const app =
      getApps().length === 0
        ? initializeApp({
            credential: cert(serviceAccount),
            projectId,
          })
        : getApp();

    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error: any) {
    const message = error?.message || "Unknown Firebase Admin initialization error";
    adminInitError = `Firebase Admin init failed: ${message}`;
    auth = null;
    db = null;
  }
}

// Lazy getters so a bad env does not crash the module at import time.
export function getAdminAuth() {
  ensureFirebaseAdmin();
  return auth;
}

export function getAdminDb() {
  ensureFirebaseAdmin();
  return db;
}

export function getAdminInitError() {
  ensureFirebaseAdmin();
  return adminInitError;
}

// Backward-compatible exports (resolved on first property access via ensure)
export { auth, db, adminInitError };
