const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
const idx = env.indexOf("FIREBASE_SERVICE_ACCOUNT_JSON=");
if (idx < 0) {
  console.log("missing");
  process.exit(1);
}
let rest = env.slice(idx + "FIREBASE_SERVICE_ACCOUNT_JSON=".length);
const end = rest.search(/\r?\n[A-Z0-9_#]/);
let v = (end === -1 ? rest : rest.slice(0, end)).trim();
if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
  v = v.slice(1, -1);
}
try {
  const j = JSON.parse(v);
  console.log(
    "parse_ok",
    j.client_email,
    Boolean(j.private_key),
    j.project_id,
    "pk_has_begin",
    String(j.private_key || "").includes("BEGIN")
  );
} catch (e) {
  console.log("parse_fail", e.message);
  console.log("len", v.length, "starts", JSON.stringify(v.slice(0, 80)));
  console.log("has_real_newline", v.includes("\n"));
}
