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
//
//  DIGICERT_CERT_BASE64  — base64-encoded .p12 certificate
//  DIGICERT_CERT_PASSWORD — password for the .p12 certificate
// ═══════════════════════════════════════════════════════
const DIGICERT_URL = "https://clientauth.one.digicert.com/documentmanager/api/c2pa/v1/sign";

if (!process.env.DIGICERT_CERT_BASE64 || !process.env.DIGICERT_CERT_PASSWORD) {
  console.error("ERROR: Missing environment variables.");
  console.error("  DIGICERT_CERT_BASE64  — base64-encoded .p12 certificate");
  console.error("  DIGICERT_CERT_PASSWORD — password for the .p12 certificate");
  process.exit(1);
}

const pfx = Buffer.from(process.env.DIGICERT_CERT_BASE64, "base64");
const passphrase = process.env.DIGICERT_CERT_PASSWORD;
const agent = new https.Agent({ pfx, passphrase });

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Signing proxy
app.post("/api/sign", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image provided" });

    const form = new FormData();
    form.append("hashAlgo", req.body.hashAlgo || "SHA256");
    form.append("signAlgo", req.body.signAlgo || "1.2.840.113549.1.1.10");
    form.append("signAlgoParams", req.body.signAlgoParams || "MTIzNDQ=");
    form.append("accountId", req.body.accountId);
    form.append("schemaField", req.body.schemaField || "author,publisher");
    form.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    console.log(`Signing: ${req.file.originalname} (${req.file.size} bytes)`);

    const response = await fetch(DIGICERT_URL, {
      method: "POST",
      headers: { Accept: "application/json", ...form.getHeaders() },
      body: form,
      agent,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`DigiCert error (${response.status}):`, data);
      return res.status(response.status).json(data);
    }

    console.log(`Signed successfully: ${data.file_name}`);
    res.json(data);
  } catch (err) {
    console.error("Signing error:", err);
    res.status(500).json({ error: "Internal proxy error", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`C2PA Signing Tool running on http://localhost:${PORT}`);
  console.log(`DigiCert endpoint: ${DIGICERT_URL}`);
});
