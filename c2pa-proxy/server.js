const express = require("express");
const multer = require("multer");
const https = require("https");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ═══════════════════════════════════════════════════════
//  CONFIGURATION — All secrets come from env variables
// ═══════════════════════════════════════════════════════
const DIGICERT_URL = "https://clientauth.one.digicert.com/documentmanager/api/c2pa/v1/sign";

// Load the client certificate from a base64-encoded environment variable
const pfx = Buffer.from(process.env.DIGICERT_CERT_BASE64 || "", "base64");
const passphrase = process.env.DIGICERT_CERT_PASSWORD;

if (!process.env.DIGICERT_CERT_BASE64 || !passphrase) {
  console.error("ERROR: Missing environment variables.");
  console.error("  DIGICERT_CERT_BASE64   — base64-encoded .p12 certificate");
  console.error("  DIGICERT_CERT_PASSWORD — password for the .p12 certificate");
  process.exit(1);
}

// Create an HTTPS agent that presents the client cert on every request
const agent = new https.Agent({ pfx, passphrase });

// Serve the HTML frontend from the /public folder
app.use(express.static(path.join(__dirname, "public")));

// Proxy endpoint — browser sends file here, we forward to DigiCert with mTLS
app.post("/api/sign", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const form = new FormData();
    form.append("accountId", req.body.accountId);
    form.append("role", req.body.role || "publisher");
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await fetch(DIGICERT_URL, {
      method: "POST",
      headers: { Accept: "application/json", ...form.getHeaders() },
      body: form,
      agent,
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    res.json(data);
  } catch (err) {
    console.error("Signing error:", err);
    res.status(500).json({ error: "Internal proxy error", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`C2PA proxy running on http://localhost:${PORT}`));
