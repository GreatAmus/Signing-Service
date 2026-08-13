const express = require("express");
const multer = require("multer");
const https = require("https");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();

// ═══════════════════════════════════════════════════════
//  CONFIGURATION — All secrets come from env variables
// ═══════════════════════════════════════════════════════
const DIGICERT_URL =
  process.env.DIGICERT_C2PA_URL ||
  "https://clientauth.one.digicert.com/documentmanager/api/c2pa/v1/sign";

const DEFAULT_ACCOUNT_ID = process.env.DIGICERT_ACCOUNT_ID || "";
const DEFAULT_ROLE = process.env.DIGICERT_ROLE || "publisher";

// Video files are large. Raise this if you need to.
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 512);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// Signing a large video takes a while. Milliseconds.
const SIGN_TIMEOUT_MS = Number(process.env.SIGN_TIMEOUT_MS || 15 * 60 * 1000);

// How long a signed result stays on disk before the sweeper deletes it.
const ARTIFACT_TTL_MS = Number(process.env.ARTIFACT_TTL_MS || 60 * 60 * 1000);

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "c2pa-"));

const pfx = Buffer.from(process.env.DIGICERT_CERT_BASE64 || "", "base64");
const passphrase = process.env.DIGICERT_CERT_PASSWORD;

if (!process.env.DIGICERT_CERT_BASE64 || !passphrase) {
  console.error("ERROR: Missing environment variables.");
  console.error("  DIGICERT_CERT_BASE64   — base64-encoded .p12 certificate");
  console.error("  DIGICERT_CERT_PASSWORD — password for the .p12 certificate");
  console.error("Optional:");
  console.error("  DIGICERT_ACCOUNT_ID    — default account id handed to the UI");
  console.error("  DIGICERT_ROLE          — default signing role (publisher)");
  console.error("  MAX_FILE_MB            — upload ceiling, default 512");
  process.exit(1);
}

const agent = new https.Agent({ pfx, passphrase, keepAlive: true });

// ═══════════════════════════════════════════════════════
//  FORMAT REGISTRY
//  This drives labels, icons and previews in the UI only.
//  Nothing here gates what gets sent to DigiCert — every
//  file is submitted and the API decides. To surface a new
//  format in the UI, add one line. To sign a format that is
//  not listed, just upload it; it still goes through.
// ═══════════════════════════════════════════════════════
const FORMATS = [
  // kind is one of: image, vector, video, audio, document, other
  { ext: "jpg",  mime: "image/jpeg",       kind: "image",    label: "JPEG" },
  { ext: "jpeg", mime: "image/jpeg",       kind: "image",    label: "JPEG" },
  { ext: "png",  mime: "image/png",        kind: "image",    label: "PNG" },
  { ext: "webp", mime: "image/webp",       kind: "image",    label: "WebP" },
  { ext: "gif",  mime: "image/gif",        kind: "image",    label: "GIF" },
  { ext: "tif",  mime: "image/tiff",       kind: "image",    label: "TIFF" },
  { ext: "tiff", mime: "image/tiff",       kind: "image",    label: "TIFF" },
  { ext: "avif", mime: "image/avif",       kind: "image",    label: "AVIF" },
  { ext: "heic", mime: "image/heic",       kind: "image",    label: "HEIC" },
  { ext: "heif", mime: "image/heif",       kind: "image",    label: "HEIF" },
  { ext: "dng",  mime: "image/x-adobe-dng", kind: "image",   label: "DNG" },
  { ext: "svg",  mime: "image/svg+xml",    kind: "vector",   label: "SVG" },
  { ext: "mp4",  mime: "video/mp4",        kind: "video",    label: "MP4" },
  { ext: "m4v",  mime: "video/x-m4v",      kind: "video",    label: "M4V" },
  { ext: "mov",  mime: "video/quicktime",  kind: "video",    label: "MOV" },
  { ext: "webm", mime: "video/webm",       kind: "video",    label: "WebM" },
  { ext: "avi",  mime: "video/x-msvideo",  kind: "video",    label: "AVI" },
  { ext: "mkv",  mime: "video/x-matroska", kind: "video",    label: "MKV" },
  { ext: "mp3",  mime: "audio/mpeg",       kind: "audio",    label: "MP3" },
  { ext: "m4a",  mime: "audio/mp4",        kind: "audio",    label: "M4A" },
  { ext: "wav",  mime: "audio/wav",        kind: "audio",    label: "WAV" },
  { ext: "aac",  mime: "audio/aac",        kind: "audio",    label: "AAC" },
  { ext: "flac", mime: "audio/flac",       kind: "audio",    label: "FLAC" },
  { ext: "ogg",  mime: "audio/ogg",        kind: "audio",    label: "OGG" },
  { ext: "pdf",  mime: "application/pdf",  kind: "document", label: "PDF" },
];

const FORMAT_BY_EXT = new Map(FORMATS.map((f) => [f.ext, f]));

// Who the UI tells people to contact when the problem is not theirs to fix.
const SUPPORT_CONTACT = process.env.SUPPORT_CONTACT || "the Customer Zero team";

// When a format is declined, tell people what to convert to instead of
// leaving them stuck. Keyed by extension, falls back to the kind.
const SUGGESTED_ALTERNATIVE = {
  tif: "PNG or JPEG",
  tiff: "PNG or JPEG",
  heic: "JPEG",
  heif: "JPEG",
  dng: "JPEG or PNG",
  gif: "PNG for a still, MP4 for motion",
  avi: "MP4",
  mkv: "MP4",
  webm: "MP4",
  m4v: "MP4",
  flac: "WAV or MP3",
  ogg: "MP3",
  aac: "MP3",
  svg: "PNG, if the vector original is not required",
};

const SUGGESTED_BY_KIND = {
  image: "JPEG or PNG",
  vector: "PNG",
  video: "MP4",
  audio: "MP3 or WAV",
  document: "PDF",
  other: "JPEG, PNG, MP4 or PDF",
};

function suggestionFor(ext, kind) {
  return SUGGESTED_ALTERNATIVE[ext] || SUGGESTED_BY_KIND[kind] || SUGGESTED_BY_KIND.other;
}

function extOf(name) {
  const i = String(name || "").lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

// Browsers send an empty or generic type for plenty of formats, SVG and HEIC
// among them. The registry wins in that case so DigiCert sees a real type.
function resolveMime(originalname, browserMime) {
  const known = FORMAT_BY_EXT.get(extOf(originalname));
  const generic = !browserMime || browserMime === "application/octet-stream";
  if (generic && known) return known.mime;
  return browserMime || (known ? known.mime : "application/octet-stream");
}

// ═══════════════════════════════════════════════════════
//  UNSUPPORTED-TYPE DETECTION
//  A rejection on format grounds is a warning, not a failure.
//  Anything else (auth, quota, outage) stays a hard error.
//  Add patterns without touching code via UNSUPPORTED_PATTERNS,
//  a comma-separated list of case-insensitive substrings.
// ═══════════════════════════════════════════════════════
const UNSUPPORTED_PATTERNS = [
  /unsupported/i,
  /not\s+supported/i,
  /unsupported_file_type/i,
  /invalid\s+(file|content|media|mime)[\s_-]*type/i,
  /(file|content|media|mime)[\s_-]*type\s+(is\s+)?(not|invalid)/i,
  /(file\s*)?format\s+(is\s+)?(not\s+supported|invalid|unrecognized)/i,
  /cannot\s+(be\s+)?sign(ed)?\s+this/i,
  /no\s+(such\s+)?(signer|handler)\s+for/i,
  ...(process.env.UNSUPPORTED_PATTERNS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")),
];

// Walk an arbitrary error payload and pull every string out of it, so this
// keeps working when DigiCert changes the error envelope.
function collectStrings(value, out = [], depth = 0) {
  if (depth > 6 || value == null) return out;
  if (typeof value === "string") {
    if (value.trim()) out.push(value.trim());
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, out, depth + 1));
  } else if (typeof value === "object") {
    Object.values(value).forEach((v) => collectStrings(v, out, depth + 1));
  }
  return out;
}

function classifyFailure(status, payload, rawText) {
  const strings = payload ? collectStrings(payload) : [];
  if (rawText && !strings.length) strings.push(rawText.slice(0, 500));

  const message =
    (payload &&
      (payload.error_description ||
        payload.message ||
        (Array.isArray(payload.errors) && payload.errors[0]?.message))) ||
    strings[0] ||
    `DigiCert returned status ${status}`;

  return { message, status, strings };
}

// 415 is unambiguous. Otherwise look for format language anywhere in the body.
// Status class deliberately does not gate this: DigiCert returns 5xx for at
// least some unsupported types, and a 500 that says "unsupported" is still a
// format problem, not an outage.
function looksLikeFormatRejection(status, strings) {
  return status === 415 || strings.some((s) => UNSUPPORTED_PATTERNS.some((p) => p.test(s)));
}

// ═══════════════════════════════════════════════════════
//  SERVICE LIVENESS
//  A 5xx with an empty body is ambiguous on its own. It is not
//  ambiguous if something else signed thirty seconds ago — that
//  proves the service, the certificate and the account all work,
//  which leaves the file itself. Recording successes turns a
//  guess into an inference.
// ═══════════════════════════════════════════════════════
const SERVICE_UP_WINDOW_MS = Number(process.env.SERVICE_UP_WINDOW_MS || 10 * 60 * 1000);
let lastSuccessAt = 0;
const signedExts = new Set();

function recordSuccess(ext) {
  lastSuccessAt = Date.now();
  if (ext) signedExts.add(ext);
}

function serviceProvenUp() {
  return lastSuccessAt > 0 && Date.now() - lastSuccessAt < SERVICE_UP_WINDOW_MS;
}

// ═══════════════════════════════════════════════════════
//  PLAIN LANGUAGE ERRORS
//  Nobody using this tool should have to read a server log
//  or an upstream error envelope. Every failure resolves to
//  a code, a sentence a marketer can act on, and the raw
//  upstream text kept separately for whoever debugs it.
// ═══════════════════════════════════════════════════════
function matchAny(strings, re) {
  return strings.some((s) => re.test(s));
}

function explainFailure(status, payload, rawText, ctx) {
  const verdict = classifyFailure(status, payload, rawText);
  const { strings } = verdict;
  const label = ctx.label || (ctx.ext ? ctx.ext.toUpperCase() : "This file");
  const detail = verdict.message;
  const suggestion = suggestionFor(ctx.ext, ctx.kind);

  // Format language in the body settles it, whatever the status code.
  if (looksLikeFormatRejection(status, strings)) {
    return {
      code: "unsupported_format",
      unsupported: true,
      message: `${label} is not a format DigiCert can sign right now.`,
      action: `Convert the file to ${suggestion} and sign it again.`,
      detail,
    };
  }

  // Client certificate problems. The person signing cannot fix these.
  // Keyword sweeps are held to 4xx; a 500 body mentioning a certificate is
  // not evidence the certificate is the problem.
  if (status === 401 || (status < 500 && matchAny(strings, /certificate|unauthorized|authentication|expired/i))) {
    return {
      code: "auth",
      unsupported: false,
      message: "The signing certificate was rejected, so nothing was signed.",
      action: `Nothing to retry. Tell ${SUPPORT_CONTACT} the signing certificate needs attention.`,
      detail,
    };
  }

  if (status === 403 || (status < 500 && matchAny(strings, /entitle|not\s+permitted|forbidden|quota|licen[sc]e|seat/i))) {
    return {
      code: "entitlement",
      unsupported: false,
      message: "This account is not cleared to sign, or the signing allowance ran out.",
      action: `Nothing to retry. Ask ${SUPPORT_CONTACT} to check the account entitlement.`,
      detail,
    };
  }

  if (status === 429 || (status < 500 && matchAny(strings, /rate\s*limit|too\s+many\s+requests|throttl/i))) {
    return {
      code: "rate_limit",
      unsupported: false,
      message: "DigiCert is throttling this batch.",
      action: "Wait a couple of minutes, then sign the remaining files.",
      detail,
    };
  }

  if (status === 413 || (status < 500 && matchAny(strings, /too\s+large|payload\s+size|exceeds\s+.{0,20}(size|limit)/i))) {
    return {
      code: "too_large",
      unsupported: false,
      message: `${label} is larger than DigiCert accepts for signing.`,
      action: "Compress or shorten the file, then sign it again.",
      detail,
    };
  }

  if (status < 500 && matchAny(strings, /corrupt|malformed|cannot\s+(parse|read|decode)|invalid\s+(file|image|structure)/i)) {
    return {
      code: "damaged_file",
      unsupported: false,
      message: `DigiCert could not read ${label}. The file may be damaged or incomplete.`,
      action: "Re-export the file from its source application, then sign it again.",
      detail,
    };
  }

  // A 5xx or an unexplained rejection with no format language in it. On its
  // own this is genuinely ambiguous, so the wording depends on evidence
  // rather than assuming an outage.
  const proven = ctx.serviceProvenUp;
  const extHasSigned = ctx.extEverSigned;

  if (proven && !extHasSigned) {
    // Something else signed moments ago, and nothing of this type ever has.
    // The service, certificate and account are all fine. It is the format.
    return {
      code: "likely_unsupported_format",
      unsupported: true,
      message: `DigiCert refused ${label} without saying why. Other files signed fine just now, so the format is the cause.`,
      action: `Convert the file to ${suggestion} and sign it again.`,
      detail,
    };
  }

  if (proven) {
    // This type has signed before, so the format is not the problem.
    return {
      code: "file_rejected",
      unsupported: false,
      message: `DigiCert refused this particular file. Other ${label} files have signed, so it is this file rather than the format.`,
      action: "Re-export the file from its source application and sign it again.",
      detail,
    };
  }

  if (status >= 500) {
    // Nothing has signed yet, so an outage and a format problem look identical
    // from here. Say that plainly instead of picking one.
    return {
      code: "unclear",
      unsupported: false,
      message: `DigiCert refused ${label} and gave no reason.`,
      action: `Sign a JPG or PNG to check the service. If that works, the format is the problem — convert to ${suggestion}. If it also fails, tell ${SUPPORT_CONTACT}.`,
      detail,
    };
  }

  return {
    code: "unknown",
    unsupported: false,
    message: `Signing failed for ${label}.`,
    action: `Retry once. If it fails again, send ${SUPPORT_CONTACT} the details below.`,
    detail,
  };
}

// ═══════════════════════════════════════════════════════
//  DECLINED FORMAT MEMORY
//  Once DigiCert declines an extension, the UI can warn the
//  next person before they wait through another upload. This
//  learns at runtime, so a format that starts working simply
//  stops appearing here after a restart.
// ═══════════════════════════════════════════════════════
const declined = new Map(); // ext -> { ext, label, message, action, count, lastAt }

function recordDeclined(ext, label, explanation) {
  if (!ext) return;
  const prior = declined.get(ext);
  declined.set(ext, {
    ext,
    label,
    message: explanation.message,
    action: explanation.action,
    count: (prior?.count || 0) + 1,
    lastAt: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════
//  SIGNED ARTIFACT STORE
//  Signed bytes land on disk and the browser pulls them by id.
//  Keeps multi-hundred-megabyte videos out of the JSON payload.
// ═══════════════════════════════════════════════════════
const artifacts = new Map(); // id -> { path, fileName, mimeType, size, createdAt }

function putArtifact(record) {
  const id = crypto.randomUUID();
  artifacts.set(id, { ...record, createdAt: Date.now() });
  return id;
}

setInterval(() => {
  const cutoff = Date.now() - ARTIFACT_TTL_MS;
  for (const [id, a] of artifacts) {
    if (a.createdAt < cutoff) {
      fs.promises.unlink(a.path).catch(() => {});
      artifacts.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

function cleanup(file) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => {});
}

// ═══════════════════════════════════════════════════════
//  UPLOAD HANDLING — disk backed, so a 400 MB video does not
//  sit in the node heap
// ═══════════════════════════════════════════════════════
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  // No fileFilter. Every type goes to DigiCert; DigiCert decides.
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

// The UI reads its configuration from here instead of hardcoding it.
app.get("/api/config", (req, res) => {
  res.json({
    accountId: DEFAULT_ACCOUNT_ID,
    role: DEFAULT_ROLE,
    maxFileMb: MAX_FILE_MB,
    formats: FORMATS,
    supportContact: SUPPORT_CONTACT,
  });
});

// Formats DigiCert has declined since this process started. The UI reads this
// to flag a file before anyone waits through the upload.
app.get("/api/declined", (req, res) => {
  res.json({ declined: [...declined.values()] });
});

app.post("/api/sign", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ result: "error", message: "No file provided" });
  }

  const accountId = req.body.accountId || DEFAULT_ACCOUNT_ID;
  if (!accountId) {
    cleanup(req.file);
    return res
      .status(400)
      .json({ result: "error", message: "No accountId provided and no server default set" });
  }

  const originalName = req.file.originalname;
  const mimeType = resolveMime(originalName, req.file.mimetype);
  const known = FORMAT_BY_EXT.get(extOf(originalName));

  try {
    const form = new FormData();
    form.append("accountId", accountId);
    form.append("role", req.body.role || DEFAULT_ROLE);
    form.append("file", fs.createReadStream(req.file.path), {
      filename: originalName,
      contentType: mimeType,
      knownLength: req.file.size,
    });

    const response = await fetch(DIGICERT_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...form.getHeaders(),
        "Content-Length": form.getLengthSync(),
      },
      body: form,
      agent,
      timeout: SIGN_TIMEOUT_MS,
    });

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const isJson = contentType.includes("json");

    // ── Failure path ────────────────────────────────────
    if (!response.ok) {
      const rawText = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(rawText);
      } catch {
        /* not JSON, classifyFailure falls back to the raw text */
      }

      const ext = extOf(originalName);
      const explanation = explainFailure(response.status, payload, rawText, {
        ext,
        kind: known ? known.kind : "other",
        label: known ? known.label : ext.toUpperCase(),
        serviceProvenUp: serviceProvenUp(),
        extEverSigned: signedExts.has(ext),
      });

      if (explanation.unsupported) {
        recordDeclined(ext, known ? known.label : ext.toUpperCase(), explanation);
        console.warn(
          `Unsupported by DigiCert: ${originalName} (${mimeType}) — ${explanation.detail}`
        );
        // 200 on purpose. The proxy did the job; the format was declined.
        return res.json({
          result: "unsupported",
          fileName: originalName,
          mimeType,
          code: explanation.code,
          message: explanation.message,
          action: explanation.action,
          detail: explanation.detail,
          upstreamStatus: response.status,
        });
      }

      console.error(`Signing failed: ${originalName} — ${explanation.detail}`);
      return res.status(response.status).json({
        result: "error",
        fileName: originalName,
        code: explanation.code,
        message: explanation.message,
        action: explanation.action,
        detail: explanation.detail,
        upstreamStatus: response.status,
      });
    }

    // ── Success path ────────────────────────────────────
    // Handles both shapes: JSON with base64 content, or raw signed bytes.
    let signedName = null;
    let signedMime = null;
    let manifest = null;
    let hashAlgo = null;
    let signAlgo = null;
    const outPath = path.join(TMP_DIR, crypto.randomUUID());

    if (isJson) {
      const data = await response.json();

      if (!data.encoded_signed_content) {
        const ext = extOf(originalName);
        const explanation = explainFailure(400, data, null, {
          ext,
          kind: known ? known.kind : "other",
          label: known ? known.label : ext.toUpperCase(),
          serviceProvenUp: serviceProvenUp(),
          extEverSigned: signedExts.has(ext),
        });

        if (explanation.unsupported) {
          recordDeclined(ext, known ? known.label : ext.toUpperCase(), explanation);
          return res.json({
            result: "unsupported",
            fileName: originalName,
            mimeType,
            code: explanation.code,
            message: explanation.message,
            action: explanation.action,
            detail: explanation.detail,
            upstreamStatus: 200,
          });
        }

        return res.status(502).json({
          result: "error",
          fileName: originalName,
          code: "empty_response",
          message: "DigiCert accepted the file but returned nothing to download.",
          action: `Retry once. If it repeats, send ${SUPPORT_CONTACT} the details below.`,
          detail: explanation.detail,
        });
      }

      await fs.promises.writeFile(
        outPath,
        Buffer.from(data.encoded_signed_content, "base64")
      );
      signedName = data.file_name || `signed-${originalName}`;
      signedMime = data.mime_type || mimeType;
      manifest = data.signed_manifest || null;
      hashAlgo = data.hash_algo || null;
      signAlgo = data.sign_algo || null;
    } else {
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(outPath);
        response.body.pipe(out);
        response.body.on("error", reject);
        out.on("error", reject);
        out.on("finish", resolve);
      });
      signedName = `signed-${originalName}`;
      signedMime = contentType.split(";")[0] || mimeType;
      manifest = response.headers.get("x-c2pa-manifest") || null;
    }

    const stat = await fs.promises.stat(outPath);
    // Proof the service, certificate and account all work right now. This is
    // what lets an unexplained 5xx later be attributed to the file, not DigiCert.
    recordSuccess(extOf(originalName));
    const id = putArtifact({
      path: outPath,
      fileName: signedName,
      mimeType: signedMime,
      size: stat.size,
    });

    return res.json({
      result: "signed",
      id,
      fileName: signedName,
      mimeType: signedMime,
      size: stat.size,
      originalSize: req.file.size,
      kind: known ? known.kind : "other",
      manifest,
      hashAlgo,
      signAlgo,
      url: `/api/signed/${id}`,
      downloadUrl: `/api/signed/${id}?download=1`,
    });
  } catch (err) {
    console.error("Signing error:", err);
    const timedOut = err.type === "request-timeout" || err.name === "AbortError";
    return res.status(timedOut ? 504 : 500).json({
      result: "error",
      fileName: originalName,
      code: timedOut ? "timeout" : "network",
      message: timedOut
        ? `${originalName} took longer than ${Math.round(SIGN_TIMEOUT_MS / 60000)} minutes to sign and was cancelled.`
        : "This tool could not reach DigiCert, so nothing was signed.",
      action: timedOut
        ? "Large video takes a while. Try a shorter file, or sign it on its own rather than in a batch."
        : `Check your connection and retry. If it persists, tell ${SUPPORT_CONTACT}.`,
      detail: err.message,
    });
  } finally {
    cleanup(req.file);
  }
});

// Serve a signed file. Inline by default so the UI can preview video and
// images straight from the URL, attachment when ?download=1.
app.get("/api/signed/:id", (req, res) => {
  const a = artifacts.get(req.params.id);
  if (!a) return res.status(404).json({ result: "error", message: "Signed file expired" });

  res.setHeader("Content-Type", a.mimeType || "application/octet-stream");
  res.setHeader("Content-Length", a.size);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Content-Disposition",
    `${req.query.download ? "attachment" : "inline"}; filename="${a.fileName.replace(/"/g, "")}"`
  );
  fs.createReadStream(a.path)
    .on("error", () => res.status(500).end())
    .pipe(res);
});

// Multer and body errors arrive here. Return JSON, never an HTML error page.
app.use((err, req, res, next) => {
  cleanup(req.file);
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(413).json({
      result: "error",
      code: tooBig ? "too_large" : "upload_failed",
      message: tooBig
        ? `That file is over the ${MAX_FILE_MB} MB upload limit.`
        : "The upload did not complete.",
      action: tooBig
        ? `Compress the file, or ask ${SUPPORT_CONTACT} to raise the limit.`
        : "Retry the upload.",
      detail: err.message,
    });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ result: "error", message: "Internal proxy error" });
});

function shutdown() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(
    `C2PA proxy running on http://localhost:${PORT} — accepting any file type, max ${MAX_FILE_MB} MB`
  )
);