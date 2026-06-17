const baseUrl = process.env.SMOKE_API_BASE_URL;
const authToken = process.env.SMOKE_AUTH_TOKEN;
const authPath = process.env.SMOKE_AUTH_PATH ?? "/api/me";

function required(value, name) {
  if (!value) {
    throw new Error(`${name} is required for deployment smoke tests.`);
  }

  return value;
}

async function readJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}, received: ${text.slice(0, 120)}`);
  }
}

async function expectOk(path, init = {}) {
  const url = new URL(path, required(baseUrl, "SMOKE_API_BASE_URL"));
  const response = await fetch(url, init);
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

const health = await expectOk("/api/health");

if (health?.status !== "ok") {
  throw new Error(`/api/health returned unexpected payload: ${JSON.stringify(health)}`);
}

const authPayload = await expectOk(authPath, {
  headers: {
    Authorization: `Bearer ${required(authToken, "SMOKE_AUTH_TOKEN")}`,
    Accept: "application/json",
  },
});

if (!authPayload || typeof authPayload !== "object" || !("uid" in authPayload)) {
  throw new Error(`${authPath} returned unexpected payload: ${JSON.stringify(authPayload)}`);
}

console.log("Deployment smoke tests passed.");
