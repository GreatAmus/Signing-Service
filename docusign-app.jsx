import { useState, useRef, useCallback } from "react";
import { Upload, ShieldCheck, Download, X, AlertCircle, CheckCircle2, Loader2, FileImage, RotateCcw, Info } from "lucide-react";

/*
 * ══════════════════════════════════════════════════════════════
 *  CONFIGURATION — Replace these values before going live
 * ══════════════════════════════════════════════════════════════
 *
 *  DigiCert C2PA Image Signing API
 *  Endpoint: POST /documentmanager/api/c2pa/v1/sign
 *  Docs:     https://dev.digicert.com/en/document-trust-api/image-signing-api.html
 *  Swagger:  https://demo.one.digicert.com/documentmanager/docs/swagger-ui/c2pa/index.html
 *
 *  NOTE: The API uses mTLS (client certificate authentication).
 *  In a browser context, the client cert must be installed in the
 *  OS/browser certificate store, or you need a backend proxy that
 *  attaches the client cert on outbound requests.
 * ══════════════════════════════════════════════════════════════
 */
const CONFIG = {
  BASE_URL: "https://clientauth.demo.one.digicert.com",
  ACCOUNT_ID: "YOUR_ACCOUNT_ID_HERE",
  HASH_ALGO: "SHA256",
  SIGN_ALGO: "1.2.840.113549.1.1.10",
  SIGN_ALGO_PARAMS: "MTIzNDQ=",
  SCHEMA_FIELD: "author,publisher",
};

const IS_TEST_MODE = CONFIG.ACCOUNT_ID === "YOUR_ACCOUNT_ID_HERE";

/* ─── API ─── */
async function signImageWithDigiCert(file) {
  const formData = new FormData();
  formData.append("hashAlgo", CONFIG.HASH_ALGO);
  formData.append("signAlgo", CONFIG.SIGN_ALGO);
  formData.append("signAlgoParams", CONFIG.SIGN_ALGO_PARAMS);
  formData.append("accountId", CONFIG.ACCOUNT_ID);
  formData.append("image", file);
  formData.append("schemaField", CONFIG.SCHEMA_FIELD);

  const response = await fetch(
    `${CONFIG.BASE_URL}/documentmanager/api/c2pa/v1/sign`,
    { method: "POST", headers: { Accept: "application/json" }, body: formData }
  );

  if (!response.ok) {
    const errText = await response.text();
    let errMsg;
    try { const j = JSON.parse(errText); errMsg = j.error_description || j.error || errText; } catch { errMsg = errText; }
    throw new Error(`DigiCert API error (${response.status}): ${errMsg}`);
  }

  const data = await response.json();
  const byteChars = atob(data.encoded_signed_content);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);

  return {
    blob: new Blob([byteArray], { type: data.mime_type || file.type }),
    fileName: data.file_name,
    mimeType: data.mime_type,
    hashAlgo: data.hash_algo,
    signAlgo: data.sign_algo,
    manifest: data.signed_manifest,
  };
}

async function mockSign(file) {
  await new Promise((r) => setTimeout(r, 2200));
  return {
    blob: new Blob([file], { type: file.type }),
    fileName: `signed-${file.name}`,
    mimeType: file.type,
    hashAlgo: "SHA256",
    signAlgo: "1.2.840.113549.1.1.10",
    manifest: '{"active_manifest":"urn:c2pa:mock-demo","validation_state":"Valid"}',
  };
}

async function doSign(file) {
  return IS_TEST_MODE ? mockSign(file) : signImageWithDigiCert(file);
}

/* ─── Helpers ─── */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const STAGE = { IDLE: "idle", SIGNING: "signing", DONE: "done", ERROR: "error" };
const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png"];

/* ─── Step indicator ─── */
function Steps({ current }) {
  const steps = [
    { num: 1, label: "Upload" },
    { num: 2, label: "Sign" },
    { num: 3, label: "Download" },
  ];
  const stageToStep = { idle: 1, signing: 2, done: 3, error: 2 };
  const active = stageToStep[current] || 1;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 0, marginBottom: 32,
    }}>
      {steps.map((s, i) => {
        const isActive = s.num <= active;
        const isCurrent = s.num === active;
        return (
          <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isActive ? "#003B5C" : "#E8ECF0",
                color: isActive ? "#fff" : "#9CA3AF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600,
                transition: "all 0.3s ease",
                boxShadow: isCurrent ? "0 0 0 3px rgba(0,59,92,0.15)" : "none",
              }}>
                {s.num < active ? (
                  <CheckCircle2 size={16} />
                ) : s.num}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: isActive ? "#003B5C" : "#9CA3AF",
                letterSpacing: "0.03em",
              }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 64, height: 2, margin: "0 12px",
                marginBottom: 22,
                background: s.num < active ? "#003B5C" : "#E8ECF0",
                borderRadius: 1,
                transition: "background 0.3s ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main ─── */
export default function C2PASigningTool() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [stage, setStage] = useState(STAGE.IDLE);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      setFile(null); setPreview(null);
      setError("Unsupported format. Please upload a .jpg or .png image.");
      setStage(STAGE.ERROR);
      return;
    }
    if (f.size > MAX_SIZE) {
      setFile(null); setPreview(null);
      setError("This file exceeds the 20 MB size limit.");
      setStage(STAGE.ERROR);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStage(STAGE.IDLE);
    setError("");
    setResult(null);
    if (signedUrl) URL.revokeObjectURL(signedUrl);
    setSignedUrl(null);
  }, [signedUrl]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  }, [handleFile]);

  const handleSign = async () => {
    if (!file) return;
    setStage(STAGE.SIGNING); setError("");
    try {
      const res = await doSign(file);
      setResult(res);
      setSignedUrl(URL.createObjectURL(res.blob));
      setStage(STAGE.DONE);
    } catch (err) {
      setError(err.message || "An unexpected error occurred during signing.");
      setStage(STAGE.ERROR);
    }
  };

  const handleDownload = () => {
    if (!signedUrl || !result) return;
    const a = document.createElement("a");
    a.href = signedUrl;
    a.download = result.fileName || `signed-${file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview);
    if (signedUrl) URL.revokeObjectURL(signedUrl);
    setFile(null); setPreview(null);
    setStage(STAGE.IDLE); setError("");
    setResult(null); setSignedUrl(null);
  };

  const stageForSteps = file ? stage : (stage === STAGE.ERROR ? "error" : "idle");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F3F5",
      fontFamily: "'Source Sans 3', 'Source Sans Pro', -apple-system, sans-serif",
      color: "#1A1A1A",
      display: "flex", flexDirection: "column",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ═══ Top bar ═══ */}
      <header style={{
        background: "#003B5C",
        padding: "0 32px",
        height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={22} color="#4EC9B0" strokeWidth={2.2} />
          <span style={{
            color: "#FFFFFF", fontSize: 16, fontWeight: 600,
            letterSpacing: "-0.02em",
          }}>
            DigiCert C2PA Signing Tool
          </span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 400,
        }}>
          <span>Document Trust Manager</span>
        </div>
      </header>

      {/* ═══ Body ═══ */}
      <main style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 560 }}>

          {/* Test mode banner */}
          {IS_TEST_MODE && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", marginBottom: 20,
              background: "#FFF9E6", border: "1px solid #F0DFA0",
              borderRadius: 8, fontSize: 13, color: "#6B5300",
            }}>
              <Info size={16} style={{ flexShrink: 0 }} />
              <span><strong>Test mode</strong> — mock signing is active. Replace <code style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5,
                background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3,
              }}>ACCOUNT_ID</code> in config to connect to DigiCert.</span>
            </div>
          )}

          {/* Card */}
          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            border: "1px solid #DEE2E6",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
            overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{
              padding: "24px 28px 0",
            }}>
              <Steps current={stageForSteps} />
            </div>

            <div style={{ padding: "0 28px 28px" }}>

              {/* ─── Dropzone ─── */}
              {!file && stage !== STAGE.ERROR && (
                <div
                  onDrop={onDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? "#003B5C" : "#D1D5DB"}`,
                    borderRadius: 10,
                    background: dragOver ? "#EDF5FA" : "#FAFBFC",
                    padding: "48px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: dragOver ? "#003B5C" : "#F0F2F4",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                    transition: "all 0.2s ease",
                  }}>
                    <Upload size={24} color={dragOver ? "#fff" : "#6B7280"} strokeWidth={1.8} />
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 600, marginBottom: 6,
                    color: dragOver ? "#003B5C" : "#1A1A1A",
                  }}>
                    {dragOver ? "Drop to upload" : "Drag and drop your image here"}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#9CA3AF", marginBottom: 14 }}>
                    or <span style={{
                      color: "#003B5C", fontWeight: 500,
                      textDecoration: "underline", textUnderlineOffset: 2,
                      cursor: "pointer",
                    }}>browse files</span>
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 12,
                    fontSize: 12, color: "#B0B5BC",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                    <span>JPG</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#D1D5DB", display: "inline-block" }} />
                    <span>PNG</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#D1D5DB", display: "inline-block" }} />
                    <span>Max 20 MB</span>
                  </div>
                  <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    style={{ display: "none" }}
                  />
                </div>
              )}

              {/* ─── Error (no file) ─── */}
              {!file && stage === STAGE.ERROR && (
                <div>
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "16px 18px", background: "#FEF2F2",
                    border: "1px solid #FECACA", borderRadius: 8, marginBottom: 16,
                  }}>
                    <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 13.5, color: "#991B1B", lineHeight: 1.5 }}>{error}</div>
                  </div>
                  <button onClick={() => { setStage(STAGE.IDLE); setError(""); }} style={{
                    width: "100%", padding: "11px", borderRadius: 8,
                    border: "1px solid #DEE2E6", background: "#FAFBFC",
                    fontSize: 13.5, fontWeight: 600, color: "#4B5563",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.target.style.background = "#F0F2F4"; }}
                    onMouseLeave={e => { e.target.style.background = "#FAFBFC"; }}
                  >Try Again</button>
                </div>
              )}

              {/* ─── File loaded ─── */}
              {file && (
                <>
                  {/* File row */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", background: "#FAFBFC",
                    border: "1px solid #E8EAED", borderRadius: 8, marginBottom: 20,
                  }}>
                    {preview ? (
                      <img src={preview} alt="" style={{
                        width: 48, height: 48, borderRadius: 6,
                        objectFit: "cover", border: "1px solid #E8EAED", flexShrink: 0,
                      }} />
                    ) : (
                      <div style={{
                        width: 48, height: 48, borderRadius: 6, background: "#F0F2F4",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <FileImage size={20} color="#9CA3AF" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{file.name}</div>
                      <div style={{
                        fontSize: 12, color: "#9CA3AF", marginTop: 3,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {formatBytes(file.size)} · {file.type === "image/png" ? "PNG" : "JPEG"}
                      </div>
                    </div>
                    {stage !== STAGE.SIGNING && (
                      <button onClick={handleReset} title="Remove file" style={{
                        width: 32, height: 32, borderRadius: 6,
                        border: "1px solid #E8EAED", background: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", flexShrink: 0,
                        transition: "all 0.15s",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#DC2626"; e.currentTarget.style.background = "#FEF2F2"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#E8EAED"; e.currentTarget.style.background = "#fff"; }}
                      >
                        <X size={14} color="#9CA3AF" />
                      </button>
                    )}
                  </div>

                  {/* Signing */}
                  {stage === STAGE.SIGNING && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "16px 18px", background: "#EDF5FA",
                      border: "1px solid #BDD9EC", borderRadius: 8, marginBottom: 20,
                    }}>
                      <Loader2 size={20} color="#003B5C" style={{
                        animation: "spin 1s linear infinite", flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#003B5C" }}>
                          Signing in progress
                        </div>
                        <div style={{ fontSize: 12.5, color: "#5A7A8F", marginTop: 2 }}>
                          Your image is being signed via the DigiCert C2PA service…
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Done */}
                  {stage === STAGE.DONE && result && (
                    <>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "16px 18px", background: "#F0FAF4",
                        border: "1px solid #A7DFC2", borderRadius: 8, marginBottom: 14,
                      }}>
                        <CheckCircle2 size={20} color="#15803D" style={{ flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#15803D" }}>
                            Image signed successfully{IS_TEST_MODE ? " (test)" : ""}
                          </div>
                          <div style={{ fontSize: 12.5, color: "#5A8F6E", marginTop: 2 }}>
                            C2PA manifest embedded · Ready for download
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div style={{
                        padding: "14px 16px", background: "#FAFBFC",
                        border: "1px solid #E8EAED", borderRadius: 8,
                        marginBottom: 20,
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px",
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                      }}>
                        <div>
                          <div style={{ color: "#9CA3AF", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                            Output file
                          </div>
                          <div style={{ color: "#1A1A1A", fontWeight: 500 }}>{result.fileName}</div>
                        </div>
                        <div>
                          <div style={{ color: "#9CA3AF", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                            Hash algorithm
                          </div>
                          <div style={{ color: "#1A1A1A", fontWeight: 500 }}>{result.hashAlgo}</div>
                        </div>
                        <div>
                          <div style={{ color: "#9CA3AF", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                            Signature algorithm
                          </div>
                          <div style={{ color: "#1A1A1A", fontWeight: 500 }}>RSASSA-PSS</div>
                        </div>
                        <div>
                          <div style={{ color: "#9CA3AF", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                            Standard
                          </div>
                          <div style={{ color: "#1A1A1A", fontWeight: 500 }}>C2PA v2</div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Error with file */}
                  {stage === STAGE.ERROR && (
                    <div style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "16px 18px", background: "#FEF2F2",
                      border: "1px solid #FECACA", borderRadius: 8, marginBottom: 20,
                    }}>
                      <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#991B1B" }}>Signing failed</div>
                        <div style={{ fontSize: 12.5, color: "#7F1D1D", marginTop: 3, lineHeight: 1.5 }}>{error}</div>
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div style={{ display: "flex", gap: 10 }}>
                    {(stage === STAGE.IDLE || stage === STAGE.ERROR) && (
                      <button onClick={handleSign} style={{
                        flex: 1, padding: "12px 20px", borderRadius: 8,
                        border: "none", background: "#003B5C", color: "#fff",
                        fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                        cursor: "pointer", transition: "background 0.15s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "#002E48"}
                        onMouseLeave={e => e.currentTarget.style.background = "#003B5C"}
                      >
                        <ShieldCheck size={16} strokeWidth={2.2} style={{ pointerEvents: "none" }} />
                        <span style={{ pointerEvents: "none" }}>Sign with C2PA</span>
                      </button>
                    )}
                    {stage === STAGE.DONE && (
                      <>
                        <button onClick={handleDownload} style={{
                          flex: 1, padding: "12px 20px", borderRadius: 8,
                          border: "none", background: "#15803D", color: "#fff",
                          fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                          cursor: "pointer", transition: "background 0.15s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = "#116B32"}
                          onMouseLeave={e => e.currentTarget.style.background = "#15803D"}
                        >
                          <Download size={16} strokeWidth={2.2} style={{ pointerEvents: "none" }} />
                          <span style={{ pointerEvents: "none" }}>Download Signed Image</span>
                        </button>
                        <button onClick={handleReset} title="Sign another image" style={{
                          padding: "12px 16px", borderRadius: 8,
                          border: "1px solid #DEE2E6", background: "#FAFBFC",
                          fontSize: 13.5, fontWeight: 600, color: "#6B7280",
                          fontFamily: "inherit", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          transition: "all 0.15s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#F0F2F4"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "#FAFBFC"; }}
                        >
                          <RotateCcw size={14} style={{ pointerEvents: "none" }} />
                          <span style={{ pointerEvents: "none" }}>New</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* How it works */}
          {!file && stage !== STAGE.ERROR && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
              marginTop: 24,
            }}>
              {[
                { icon: <Upload size={18} color="#003B5C" />, title: "Upload", desc: "Select a JPG or PNG image from your device" },
                { icon: <ShieldCheck size={18} color="#003B5C" />, title: "Sign", desc: "We send it to DigiCert for C2PA signing" },
                { icon: <Download size={18} color="#003B5C" />, title: "Download", desc: "Get your signed image with embedded manifest" },
              ].map((item, i) => (
                <div key={i} style={{
                  background: "#fff", border: "1px solid #E8EAED", borderRadius: 8,
                  padding: "18px 16px", textAlign: "center",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: "#EDF5FA",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 10,
                  }}>{item.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ═══ Footer ═══ */}
      <footer style={{
        padding: "16px 32px",
        borderTop: "1px solid #E8EAED",
        background: "#FAFBFC",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, flexShrink: 0,
      }}>
        <ShieldCheck size={13} color="#B0B5BC" />
        <span style={{ fontSize: 12, color: "#B0B5BC" }}>
          Secured by DigiCert Document Trust Manager · C2PA Compliant
        </span>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        code { font-family: 'IBM Plex Mono', monospace; }
      `}</style>
    </div>
  );
}
