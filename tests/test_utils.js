const API_BASE = "http://localhost:8000/api";

/**
 * POST JSON body to an API endpoint.
 * @param {string} path - Path relative to API_BASE (e.g. "/steps/generate-query")
 * @param {object} body - JSON-serializable payload
 * @returns {Promise<object>} Parsed JSON response
 */
async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * POST a FormData object to an API endpoint.
 * @param {string} path
 * @param {FormData} formData
 * @returns {Promise<object>}
 */
async function apiPostForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Render a success result into the #result element.
 * @param {object|string} data
 */
function showResult(data) {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "block";
  el.style.borderColor = "#22c55e";
  el.style.background = "#f0fdf4";
  el.querySelector(".label").textContent = "Response";
  el.querySelector("pre").textContent = JSON.stringify(data, null, 2);
}

/**
 * Render an error into the #result element.
 * @param {Error|string} err
 */
function showError(err) {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "block";
  el.style.borderColor = "#ef4444";
  el.style.background = "#fef2f2";
  el.querySelector(".label").textContent = "Error";
  el.querySelector("pre").textContent = err instanceof Error ? err.message : String(err);
}

/** Shared CSS injected into each test page. */
const SHARED_STYLES = `
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 28px; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  input[type=text], textarea, select {
    width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px;
    font-size: 14px; font-family: inherit; box-sizing: border-box; margin-bottom: 16px;
  }
  button {
    background: #1a1a1a; color: #fff; border: none; border-radius: 8px;
    padding: 10px 20px; font-size: 14px; cursor: pointer; margin-bottom: 24px;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  #result {
    display: none; border: 1px solid; border-radius: 8px; padding: 16px; margin-top: 8px;
  }
  #result .label { font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; margin-bottom: 8px; }
  #result pre { margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
`;
