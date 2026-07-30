import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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
    path.resolve(rootDir, "omega-90935-firebase-adminsdk-fbsvc-c1f8995154.json"),
  ];

  const matchingFiles = readdirSync(rootDir)
    .filter((fileName) => /firebase|service-account|service_account|adminsdk/i.test(fileName) && /\.json$/i.test(fileName))
    .map((fileName) => path.resolve(rootDir, fileName));

  return [...candidateFiles, ...matchingFiles].find((filePath) => existsSync(filePath)) || null;
}

function getServiceAccount() {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (envJson) {
    try {
      return JSON.parse(envJson);
    } catch (error) {
      try {
        const normalized = envJson.replace(/\\n/g, "\n");
        return JSON.parse(normalized);
      } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
      }
    }
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
    ? `Firebase Admin SDK is not configured. Add a service account JSON via FIREBASE_SERVICE_ACCOUNT_JSON or set GOOGLE_APPLICATION_CREDENTIALS. Original error: ${message}`
    : message;
}

export { auth, db, adminInitError };
