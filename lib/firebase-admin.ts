import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccountFromEnv() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (!trimmed) continue;

    try {
      if (trimmed.startsWith("{")) {
        return JSON.parse(trimmed);
      }

      const normalized = trimmed.replace(/\\n/g, "\n");
      if (normalized.includes("-----BEGIN PRIVATE KEY-----")) {
        return {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "omega-90935",
          private_key: normalized,
          client_email: process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL,
        };
      }

      return JSON.parse(normalized);
    } catch {
      continue;
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
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (explicitPath) {
    const resolvedPath = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(process.cwd(), explicitPath);

    if (existsSync(resolvedPath)) {
      return resolvedPath;
    }

    throw new Error(`Google credentials file not found at ${resolvedPath}`);
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

try {
  const serviceAccount = getServiceAccount();
  const app = getApps().length === 0
    ? initializeApp({
        credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || "omega-90935",
      })
    : getApp();

  auth = getAuth(app);
  db = getFirestore(app);
} catch (error: any) {
  const message = error?.message || "Unknown Firebase Admin initialization error";
  adminInitError = message.includes("Could not load the default credentials")
    ? `Firebase Admin SDK is not configured. Add a service account JSON via FIREBASE_SERVICE_ACCOUNT_JSON, or set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID, or configure GOOGLE_APPLICATION_CREDENTIALS. Original error: ${message}`
    : message;
}

export { auth, db, adminInitError };
