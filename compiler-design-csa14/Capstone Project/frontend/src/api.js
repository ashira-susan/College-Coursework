// Thin wrapper around the FastAPI backend. In development Vite proxies /api to port 8000.

async function request(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error('Cannot reach the backend on port 8000. Start it with scripts/dev.sh (or see the README).');
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      /* keep the generic message */
    }
    throw new Error(detail);
  }
  return response.json();
}

export const getHealth = () => request('/api/health');
export const getExamples = () => request('/api/examples');

export const compileSource = (source) =>
  request('/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, run: true }),
  });
