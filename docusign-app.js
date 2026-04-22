<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DigiCert C2PA Signing Tool</title>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --navy: #003B5C;
      --navy-hover: #002E48;
      --teal: #4EC9B0;
      --bg: #F1F3F5;
      --card: #FFFFFF;
      --border: #DEE2E6;
      --border-light: #E8EAED;
      --text: #1A1A1A;
      --sub: #9CA3AF;
      --green: #15803D;
      --green-bg: #F0FAF4;
      --green-border: #A7DFC2;
      --red: #DC2626;
      --red-dark: #991B1B;
      --red-bg: #FEF2F2;
      --red-border: #FECACA;
      --blue-bg: #EDF5FA;
      --blue-border: #BDD9EC;
      --warn-bg: #FFF9E6;
      --warn-border: #F0DFA0;
      --warn-text: #6B5300;
      --font: 'Source Sans 3', 'Source Sans Pro', -apple-system, sans-serif;
      --mono: 'IBM Plex Mono', monospace;
    }

    body {
      font-family: var(--font);
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ═══ Header ═══ */
    header {
      background: var(--navy);
      padding: 0 32px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-left span {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .header-right {
      color: rgba(255,255,255,0.5);
      font-size: 12px;
    }

    /* ═══ Main ═══ */
    main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
    }
    .container { width: 100%; max-width: 560px; }

    /* Test banner */
    .test-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      margin-bottom: 20px;
      background: var(--warn-bg);
      border: 1px solid var(--warn-border);
      border-radius: 8px;
      font-size: 13px;
      color: var(--warn-text);
    }
    .test-banner code {
      font-family: var(--mono);
      font-size: 11.5px;
      background: rgba(0,0,0,0.06);
      padding: 1px 5px;
      border-radius: 3px;
    }

    /* Card */
    .card {
      background: var(--card);
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
      overflow: hidden;
    }
    .card-top { padding: 24px 28px 0; }
    .card-body { padding: 0 28px 28px; }

    /* Steps */
    .steps {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 32px;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .step-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .step-circle.active {
      background: var(--navy);
      color: #fff;
      box-shadow: 0 0 0 3px rgba(0,59,92,0.15);
    }
    .step-circle.done {
      background: var(--navy);
      color: #fff;
    }
    .step-circle.inactive {
      background: #E8ECF0;
      color: var(--sub);
    }
    .step-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.03em;
    }
    .step-label.on { color: var(--navy); }
    .step-label.off { color: var(--sub); }
    .step-line {
      width: 64px;
      height: 2px;
      margin: 0 12px;
      margin-bottom: 22px;
      border-radius: 1px;
      transition: background 0.3s ease;
    }
    .step-line.on { background: var(--navy); }
    .step-line.off { background: #E8ECF0; }

    /* Dropzone */
    .dropzone {
      border: 2px dashed var(--border);
      border-radius: 10px;
      background: #FAFBFC;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .dropzone.over {
      border-color: var(--navy);
      background: var(--blue-bg);
    }
    .dropzone-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: #F0F2F4;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      transition: all 0.2s ease;
    }
    .dropzone.over .dropzone-icon {
      background: var(--navy);
    }
    .dropzone.over .dropzone-icon svg { stroke: #fff; }
    .dropzone h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .dropzone p {
      font-size: 13.5px;
      color: var(--sub);
      margin-bottom: 14px;
    }
    .dropzone p a {
      color: var(--navy);
      font-weight: 500;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .dropzone .formats {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: #B0B5BC;
      font-family: var(--mono);
    }
    .formats .dot {
      width: 3px; height: 3px;
      border-radius: 50%;
      background: #D1D5DB;
      display: inline-block;
    }

    /* File row */
    .file-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: #FAFBFC;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .file-row img {
      width: 48px; height: 48px;
      border-radius: 6px;
      object-fit: cover;
      border: 1px solid var(--border-light);
      flex-shrink: 0;
    }
    .file-row .file-placeholder {
      width: 48px; height: 48px;
      border-radius: 6px;
      background: #F0F2F4;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .file-info { flex: 1; min-width: 0; }
    .file-info .name {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-info .meta {
      font-size: 12px;
      color: var(--sub);
      font-family: var(--mono);
      margin-top: 3px;
    }
    .btn-remove {
      width: 32px; height: 32px;
      border-radius: 6px;
      border: 1px solid var(--border-light);
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .btn-remove:hover {
      border-color: var(--red);
      background: var(--red-bg);
    }

    /* Status bars */
    .status-bar {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .status-bar.signing {
      background: var(--blue-bg);
      border: 1px solid var(--blue-border);
    }
    .status-bar.success {
      background: var(--green-bg);
      border: 1px solid var(--green-border);
    }
    .status-bar.error {
      background: var(--red-bg);
      border: 1px solid var(--red-border);
      align-items: flex-start;
    }
    .status-bar .title {
      font-size: 14px;
      font-weight: 600;
    }
    .status-bar .subtitle {
      font-size: 12.5px;
      margin-top: 2px;
    }
    .status-bar.signing .title { color: var(--navy); }
    .status-bar.signing .subtitle { color: #5A7A8F; }
    .status-bar.success .title { color: var(--green); }
    .status-bar.success .subtitle { color: #5A8F6E; }
    .status-bar.error .title { color: var(--red-dark); }
    .status-bar.error .subtitle { color: #7F1D1D; line-height: 1.5; }

    .spinner {
      width: 20px; height: 20px;
      border: 2.5px solid var(--navy);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .icon-circle {
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .icon-circle.green { background: var(--green); }
    .icon-circle.red { background: var(--red); }

    /* Details grid */
    .details-grid {
      padding: 14px 16px;
      background: #FAFBFC;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
      font-family: var(--mono);
      font-size: 12px;
    }
    .details-grid .label {
      color: var(--sub);
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 3px;
    }
    .details-grid .value {
      color: var(--text);
      font-weight: 500;
    }

    /* Buttons */
    .btn-row { display: flex; gap: 10px; }

    .btn-primary {
      flex: 1;
      padding: 12px 20px;
      border-radius: 8px;
      border: none;
      background: var(--navy);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      font-family: var(--font);
      cursor: pointer;
      transition: background 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-primary:hover { background: var(--navy-hover); }
    .btn-primary.green { background: var(--green); }
    .btn-primary.green:hover { background: #116B32; }

    .btn-secondary {
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #FAFBFC;
      font-size: 13.5px;
      font-weight: 600;
      color: #6B7280;
      font-family: var(--font);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-secondary:hover { background: #F0F2F4; }

    /* How it works */
    .how-it-works {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 24px;
    }
    .how-card {
      background: #fff;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 18px 16px;
      text-align: center;
    }
    .how-card .how-icon {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: var(--blue-bg);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }
    .how-card h4 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .how-card p {
      font-size: 12px;
      color: var(--sub);
      line-height: 1.5;
    }

    /* Footer */
    footer {
      padding: 16px 32px;
      border-top: 1px solid var(--border-light);
      background: #FAFBFC;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
      font-size: 12px;
      color: #B0B5BC;
    }

    .hidden { display: none !important; }

    @media (max-width: 600px) {
      header { padding: 0 16px; }
      main { padding: 24px 16px; }
      .how-it-works { grid-template-columns: 1fr; }
      .details-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <!-- ═══ Header ═══ -->
  <header>
    <div class="header-left">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4EC9B0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
      <span>DigiCert C2PA Signing Tool</span>
    </div>
    <div class="header-right">Document Trust Manager</div>
  </header>

  <!-- ═══ Main ═══ -->
  <main>
    <div class="container">

      <!-- Test banner -->
      <div class="test-banner" id="testBanner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span><strong>Test mode</strong> — mock signing is active. Replace <code>ACCOUNT_ID</code> in config to connect to DigiCert.</span>
      </div>

      <!-- Card -->
      <div class="card">
        <div class="card-top">
          <!-- Steps -->
          <div class="steps" id="steps">
            <div class="step">
              <div class="step-circle active" id="step1">1</div>
              <span class="step-label on" id="stepLabel1">Upload</span>
            </div>
            <div class="step-line off" id="line1"></div>
            <div class="step">
              <div class="step-circle inactive" id="step2">2</div>
              <span class="step-label off" id="stepLabel2">Sign</span>
            </div>
            <div class="step-line off" id="line2"></div>
            <div class="step">
              <div class="step-circle inactive" id="step3">3</div>
              <span class="step-label off" id="stepLabel3">Download</span>
            </div>
          </div>
        </div>

        <div class="card-body">

          <!-- Dropzone -->
          <div class="dropzone" id="dropzone">
            <div class="dropzone-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h3 id="dropTitle">Drag and drop your image here</h3>
            <p>or <a id="browseLink">browse files</a></p>
            <div class="formats">
              <span>JPG</span><span class="dot"></span>
              <span>PNG</span><span class="dot"></span>
              <span>Max 20 MB</span>
            </div>
            <input type="file" id="fileInput" accept=".jpg,.jpeg,.png" style="display:none">
          </div>

          <!-- File row -->
          <div class="file-row hidden" id="fileRow">
            <img id="filePreview" src="" alt="">
            <div class="file-info">
              <div class="name" id="fileName"></div>
              <div class="meta" id="fileMeta"></div>
            </div>
            <button class="btn-remove" id="btnRemove" title="Remove file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Signing status -->
          <div class="status-bar signing hidden" id="statusSigning">
            <div class="spinner"></div>
            <div>
              <div class="title">Signing in progress</div>
              <div class="subtitle">Your image is being signed via the DigiCert C2PA service…</div>
            </div>
          </div>

          <!-- Success status -->
          <div class="status-bar success hidden" id="statusSuccess">
            <div class="icon-circle green">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div>
              <div class="title" id="successTitle">Image signed successfully</div>
              <div class="subtitle" id="successSubtitle"></div>
            </div>
          </div>

          <!-- Error status -->
          <div class="status-bar error hidden" id="statusError">
            <div class="icon-circle red">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </div>
            <div>
              <div class="title">Signing failed</div>
              <div class="subtitle" id="errorMessage"></div>
            </div>
          </div>

          <!-- Details grid -->
          <div class="details-grid hidden" id="detailsGrid">
            <div><div class="label">Output file</div><div class="value" id="detailFile"></div></div>
            <div><div class="label">Hash algorithm</div><div class="value" id="detailHash"></div></div>
            <div><div class="label">Signature algorithm</div><div class="value" id="detailAlgo"></div></div>
            <div><div class="label">Standard</div><div class="value">C2PA v2</div></div>
          </div>

          <!-- Buttons -->
          <div class="btn-row hidden" id="btnSign">
            <button class="btn-primary" onclick="handleSign()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
              Sign with C2PA
            </button>
          </div>

          <div class="btn-row hidden" id="btnDownload">
            <button class="btn-primary green" onclick="handleDownload()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Signed Image
            </button>
            <button class="btn-secondary" onclick="handleReset()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              New
            </button>
          </div>

          <div class="btn-row hidden" id="btnRetry">
            <button class="btn-secondary" style="flex:1" onclick="handleReset()">Try Again</button>
          </div>

        </div>
      </div>

      <!-- How it works -->
      <div class="how-it-works" id="howItWorks">
        <div class="how-card">
          <div class="how-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003B5C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <h4>Upload</h4>
          <p>Select a JPG or PNG image from your device</p>
        </div>
        <div class="how-card">
          <div class="how-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003B5C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          </div>
          <h4>Sign</h4>
          <p>We send it to DigiCert for C2PA signing</p>
        </div>
        <div class="how-card">
          <div class="how-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003B5C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <h4>Download</h4>
          <p>Get your signed image with embedded manifest</p>
        </div>
      </div>

    </div>
  </main>

  <!-- ═══ Footer ═══ -->
  <footer>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    Secured by DigiCert Document Trust Manager · C2PA Compliant
  </footer>


  <script>
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

    /* ─── State ─── */
    let currentFile = null;
    let previewUrl = null;
    let signedBlobUrl = null;
    let signResult = null;

    /* ─── Elements ─── */
    const $ = (id) => document.getElementById(id);

    /* ─── Init ─── */
    if (!IS_TEST_MODE) $("testBanner").classList.add("hidden");

    /* ─── Dropzone events ─── */
    const dropzone = $("dropzone");
    const fileInput = $("fileInput");

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("over");
      $("dropTitle").textContent = "Drop to upload";
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("over");
      $("dropTitle").textContent = "Drag and drop your image here";
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("over");
      $("dropTitle").textContent = "Drag and drop your image here";
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    dropzone.addEventListener("click", () => fileInput.click());
    $("browseLink").addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
      fileInput.value = "";
    });

    $("btnRemove").addEventListener("click", handleReset);

    /* ─── File handling ─── */
    function handleFile(file) {
      const accepted = ["image/jpeg", "image/png"];
      if (!accepted.includes(file.type)) {
        showError("Unsupported format. Please upload a .jpg or .png image.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        showError("This file exceeds the 20 MB size limit.");
        return;
      }

      currentFile = file;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);

      $("filePreview").src = previewUrl;
      $("fileName").textContent = file.name;
      $("fileMeta").textContent = formatBytes(file.size) + " · " + (file.type === "image/png" ? "PNG" : "JPEG");

      dropzone.classList.add("hidden");
      $("howItWorks").classList.add("hidden");
      $("fileRow").classList.remove("hidden");
      $("btnSign").classList.remove("hidden");
      $("statusError").classList.add("hidden");
      $("statusSuccess").classList.add("hidden");
      $("statusSigning").classList.add("hidden");
      $("detailsGrid").classList.add("hidden");
      $("btnDownload").classList.add("hidden");
      $("btnRetry").classList.add("hidden");

      updateSteps(1);
    }

    /* ─── Sign ─── */
    async function handleSign() {
      if (!currentFile) return;

      $("btnSign").classList.add("hidden");
      $("statusError").classList.add("hidden");
      $("statusSigning").classList.remove("hidden");
      $("btnRemove").classList.add("hidden");
      updateSteps(2);

      try {
        const result = IS_TEST_MODE ? await mockSign(currentFile) : await signWithDigiCert(currentFile);
        signResult = result;
        if (signedBlobUrl) URL.revokeObjectURL(signedBlobUrl);
        signedBlobUrl = URL.createObjectURL(result.blob);

        $("statusSigning").classList.add("hidden");
        $("successTitle").textContent = "Image signed successfully" + (IS_TEST_MODE ? " (test)" : "");
        $("successSubtitle").textContent = "C2PA manifest embedded · " + result.fileName;
        $("statusSuccess").classList.remove("hidden");

        $("detailFile").textContent = result.fileName;
        $("detailHash").textContent = result.hashAlgo;
        $("detailAlgo").textContent = "RSASSA-PSS";
        $("detailsGrid").classList.remove("hidden");

        $("btnDownload").classList.remove("hidden");
        $("btnRemove").classList.remove("hidden");
        updateSteps(3);
      } catch (err) {
        $("statusSigning").classList.add("hidden");
        showErrorInline(err.message || "An unexpected error occurred during signing.");
        $("btnSign").classList.remove("hidden");
        $("btnRemove").classList.remove("hidden");
        updateSteps(2);
      }
    }

    /* ─── DigiCert API call ─── */
    async function signWithDigiCert(file) {
      const formData = new FormData();
      formData.append("hashAlgo", CONFIG.HASH_ALGO);
      formData.append("signAlgo", CONFIG.SIGN_ALGO);
      formData.append("signAlgoParams", CONFIG.SIGN_ALGO_PARAMS);
      formData.append("accountId", CONFIG.ACCOUNT_ID);
      formData.append("image", file);
      formData.append("schemaField", CONFIG.SCHEMA_FIELD);

      const response = await fetch(
        CONFIG.BASE_URL + "/documentmanager/api/c2pa/v1/sign",
        { method: "POST", headers: { Accept: "application/json" }, body: formData }
      );

      if (!response.ok) {
        const errText = await response.text();
        let errMsg;
        try { const j = JSON.parse(errText); errMsg = j.error_description || j.error || errText; } catch { errMsg = errText; }
        throw new Error("DigiCert API error (" + response.status + "): " + errMsg);
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

    /* ─── Mock ─── */
    async function mockSign(file) {
      await new Promise((r) => setTimeout(r, 2200));
      return {
        blob: new Blob([file], { type: file.type }),
        fileName: "signed-" + file.name,
        mimeType: file.type,
        hashAlgo: "SHA256",
        signAlgo: "1.2.840.113549.1.1.10",
        manifest: '{"active_manifest":"urn:c2pa:mock-demo","validation_state":"Valid"}',
      };
    }

    /* ─── Download ─── */
    function handleDownload() {
      if (!signedBlobUrl || !signResult) return;
      const a = document.createElement("a");
      a.href = signedBlobUrl;
      a.download = signResult.fileName || ("signed-" + currentFile.name);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    /* ─── Reset ─── */
    function handleReset() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (signedBlobUrl) URL.revokeObjectURL(signedBlobUrl);
      currentFile = null;
      previewUrl = null;
      signedBlobUrl = null;
      signResult = null;

      $("fileRow").classList.add("hidden");
      $("statusSigning").classList.add("hidden");
      $("statusSuccess").classList.add("hidden");
      $("statusError").classList.add("hidden");
      $("detailsGrid").classList.add("hidden");
      $("btnSign").classList.add("hidden");
      $("btnDownload").classList.add("hidden");
      $("btnRetry").classList.add("hidden");
      $("btnRemove").classList.remove("hidden");

      dropzone.classList.remove("hidden");
      $("howItWorks").classList.remove("hidden");
      updateSteps(0);
    }

    /* ─── Error helpers ─── */
    function showError(msg) {
      dropzone.classList.add("hidden");
      $("howItWorks").classList.add("hidden");
      $("errorMessage").textContent = msg;
      $("statusError").classList.remove("hidden");
      $("btnRetry").classList.remove("hidden");
      updateSteps(0);
    }

    function showErrorInline(msg) {
      $("errorMessage").textContent = msg;
      $("statusError").classList.remove("hidden");
    }

    /* ─── Steps ─── */
    const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

    function updateSteps(active) {
      for (let i = 1; i <= 3; i++) {
        const circle = $("step" + i);
        const label = $("stepLabel" + i);
        circle.className = "step-circle";
        label.className = "step-label";

        if (i < active) {
          circle.classList.add("done");
          circle.innerHTML = CHECK_SVG;
          label.classList.add("on");
        } else if (i === active) {
          circle.classList.add("active");
          circle.textContent = i;
          label.classList.add("on");
        } else {
          circle.classList.add("inactive");
          circle.textContent = i;
          label.classList.add("off");
        }
      }

      if (active >= 1) { $("line1").className = "step-line off"; }
      if (active >= 2) { $("line1").className = "step-line on"; }
      if (active >= 3) { $("line2").className = "step-line on"; }
      else { $("line2").className = "step-line off"; }
    }

    /* ─── Utility ─── */
    function formatBytes(bytes) {
      if (bytes === 0) return "0 B";
      const k = 1024, sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }
  </script>
</body>
</html>
