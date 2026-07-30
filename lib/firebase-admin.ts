import { existsSync, readFileSync } from "fs";
import path from "path";
import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    const resolvedPath = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.resolve(process.cwd(), credentialsPath);

    if (existsSync(resolvedPath)) {
      return JSON.parse(readFileSync(resolvedPath, "utf8"));
    }

    throw new Error(`Google credentials file not found at ${resolvedPath}`);
  }

  const localFile = path.resolve(process.cwd(), "firebase-service-account.json");
  if (existsSync(localFile)) {
    return JSON.parse(readFileSync(localFile, "utf8"));
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
