/**
 * Self-contained HTML export for the Deal Room.
 *
 * Produces a single .html file with the section's CSS inlined and every
 * <img> converted to a data: URI, so the file opens by double-click with
 * zero network calls and zero external dependencies. Charts are already
 * inline SVG markup (see DealRoomCharts.jsx), so they need no conversion.
 */

async function imageToDataUri(url) {
  if (!url || url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[DealRoomExport] Failed to inline image, leaving remote URL:', url, e);
    return url;
  }
}

/**
 * NOTE ON THE PASSWORD GATE: this is a client-side JS prompt baked into the
 * exported HTML. It only hides content until the right string is typed —
 * anyone who views the page source can read the password and the content
 * both. It's obfuscation, not security. If real access control is needed,
 * generate a server-signed, expiring link instead and don't rely on this.
 */
function buildPasswordGateScript(password) {
  const escaped = JSON.stringify(password);
  return `
<script>
(function () {
  var pw = ${escaped};
  var content = document.getElementById('deal-room-root');
  var gate = document.getElementById('deal-room-gate');
  content.style.display = 'none';
  gate.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = document.getElementById('deal-room-gate-input').value;
    if (val === pw) {
      gate.style.display = 'none';
      content.style.display = 'block';
    } else {
      document.getElementById('deal-room-gate-error').style.display = 'block';
    }
  });
})();
</script>`;
}

function buildGateMarkup() {
  return `
<div id="deal-room-gate" style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;background:#FAFAF7;">
  <form style="background:#fff;border:1px solid #e5e7eb;padding:32px 36px;border-radius:8px;max-width:360px;width:100%;">
    <div style="font-size:14px;color:#374151;margin-bottom:12px;">This document is password protected. Enter the password provided by the sponsor to continue.</div>
    <input id="deal-room-gate-input" type="password" placeholder="Password" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:10px;" />
    <div id="deal-room-gate-error" style="display:none;color:#b91c1c;font-size:12px;margin-bottom:10px;">Incorrect password.</div>
    <button type="submit" style="width:100%;padding:10px 12px;border:none;border-radius:6px;background:#0f5132;color:#fff;font-weight:600;cursor:pointer;">Continue</button>
  </form>
</div>`;
}

/**
 * @param {Object} params
 * @param {HTMLElement} params.containerEl   The rendered Deal Room DOM node
 * @param {string} params.css                Full CSS text to inline (design system + section styles)
 * @param {string} params.title              Used for the <title> tag and the downloaded filename
 * @param {string} [params.password]         Optional client-side gate password (see note above)
 */
export async function exportDealRoomHtml({ containerEl, css, title, password }) {
  if (!containerEl) throw new Error('No content to export');

  const clone = containerEl.cloneNode(true);

  // Strip anything that shouldn't ship in the investor deliverable (export
  // controls, edit-only affordances) — marked with data-export-exclude.
  clone.querySelectorAll('[data-export-exclude]').forEach((el) => el.remove());

  // Inline every image as a data: URI so the file works fully offline.
  const imgs = Array.from(clone.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    img.setAttribute('src', await imageToDataUri(src));
  }));

  const bodyHtml = clone.outerHTML;
  const gateScript = password ? buildPasswordGateScript(password) : '';
  const gateMarkup = password ? buildGateMarkup() : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>${css}</style>
</head>
<body>
${gateMarkup}
<div id="deal-room-root">${bodyHtml}</div>
${gateScript}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (title || 'Deal_Room').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  a.download = `${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
