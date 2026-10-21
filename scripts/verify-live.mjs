// Explicit live test: creates two disposable Firebase accounts and removes them.
// Never use personal credentials. Run with VERIFY_LIVE=1 against the chosen URL.
import { chromium } from "@playwright/test";
import { jwtClockFetch } from "../src/lib/supabase/fetch.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

if (process.env.VERIFY_LIVE !== "1")
  throw new Error("Set VERIFY_LIVE=1 to authorize temporary test accounts.");
const base = process.env.VERIFY_URL || "http://localhost:3000";
const apiKey = "AIzaSyCPs6BlLuZuYD7nxdP--4JpiDRyrmq7mi4";
const supabase = "https://luyiptrahuggjsmtgdtw.supabase.co";
const publishable = "sb_publishable_oNF3jMdpWS1dRWxco9JsEg_MrA2bkKS";
const email = `pokestream-test-${randomUUID()}@example.com`;
const password = `Poke!${randomUUID()}`;
const accounts = [];
let scene;
let token;
const firebase = async (action, body) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(`Firebase ${action}: ${result.error?.message}`);
  return result;
};
const request = (
  path,
  { method = "GET", body, user = token, origin = base } = {},
) =>
  fetch(`${base}${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(user ? { Cookie: `pokestream-session=${user}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
const rpc = async (viewToken) => {
  const response = await jwtClockFetch(`${supabase}/rest/v1/rpc/read_overlay`, {
    method: "POST",
    headers: { apikey: publishable, "Content-Type": "application/json" },
    body: JSON.stringify({ token: viewToken }),
  });
  assert.equal(response.status, 200);
  return response.json();
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("response", async (response) => {
  if (
    response.status() >= 400 &&
    (response.url().includes("identitytoolkit") ||
      response.url().includes("/api/auth/session"))
  )
    console.error(
      "Auth failure",
      new URL(response.url()).pathname,
      response.status(),
    );
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (req) => {
  if (req.url() === `${base}/api/auth/session` && req.method() === "POST") {
    try {
      token = req.postDataJSON().token;
    } catch {
      /* No payload. */
    }
  }
});
try {
  assert.equal(
    (await request("/api/scenes", { method: "POST", body: {}, user: null }))
      .status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/session", {
        method: "POST",
        body: { token: "forged" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/session", {
        method: "POST",
        body: { token: "forged" },
        origin: "https://example.com",
      })
    ).status,
    403,
  );
  await page.goto(`${base}/login`);
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await page.getByLabel("Pseudo", { exact: true }).fill("Test Studio");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await page.waitForURL(`${base}/studio`, { timeout: 30000 });
  assert(token, "Signup must establish a session");
  accounts.push(token);
  console.log("PASS signup and authenticated dashboard");
  await page
    .getByRole("button", { name: "Nouvelle aventure", exact: true })
    .click();
  await page
    .getByLabel("Nom de l’aventure", { exact: true })
    .fill("Vérification Studio");
  await page
    .getByRole("button", { name: "Créer l’aventure", exact: true })
    .click();
  await page.waitForURL(/\/studio\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = page.url().split("/").at(-1);
  const listing = await jwtClockFetch(
    `${supabase}/rest/v1/scenes?id=eq.${id}&select=*`,
    { headers: { apikey: publishable, Authorization: `Bearer ${token}` } },
  );
  assert.equal(listing.status, 200);
  [scene] = await listing.json();
  assert(scene, "Firebase JWT must be trusted by Supabase RLS");
  const second = await firebase("signUp", {
    email: `pokestream-test-${randomUUID()}@example.com`,
    password: `Poke!${randomUUID()}`,
    returnSecureToken: true,
  });
  accounts.push(second.idToken);
  for (const user of [null, second.idToken]) {
    const response = await jwtClockFetch(
      `${supabase}/rest/v1/scenes?id=eq.${id}&select=*`,
      {
        headers: {
          apikey: publishable,
          ...(user ? { Authorization: `Bearer ${user}` } : {}),
        },
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  }
  assert.equal(
    (
      await request(`/api/scenes/${id}`, {
        method: "PATCH",
        user: second.idToken,
        body: { version: scene.version, enabled: false },
      })
    ).status,
    409,
  );
  const forgedOwner = await jwtClockFetch(`${supabase}/rest/v1/scenes`, {
    method: "POST",
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${second.idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ owner_id: scene.owner_id, data: scene.data }),
  });
  assert([401, 403].includes(forgedOwner.status));
  assert.equal((await forgedOwner.json()).code, "42501");
  console.log(
    "PASS Firebase/Supabase trust, tenant isolation and ownership protection",
  );
  await page
    .getByRole("button", { name: /Ajouter.*1|Emplacement 1/ })
    .first()
    .click();
  await page.getByLabel("Rechercher un Pokémon", { exact: true }).fill("evoli");
  await page.getByRole("button", { name: /Évoli/ }).click();
  await page.getByRole("button", { name: /Évoli/ }).first().click();
  await page.getByLabel("Surnom", { exact: true }).fill("Pixel");
  await page.getByLabel("Niveau", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page
    .getByText("Enregistré", { exact: true })
    .waitFor({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Roche : non obtenu", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Mode Nuzlocke", exact: true })
    .check();
  await page
    .getByRole("button", {
      name: "Augmenter le compteur de morts",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Style", exact: true }).click();
  await page.getByRole("button", { name: "Verre", exact: true }).click();
  await page
    .getByText("Enregistré", { exact: true })
    .waitFor({ timeout: 20000 });
  await page.reload();
  await page.getByText("Pixel", { exact: true }).first().waitFor();
  const saved = await rpc(scene.view_token);
  assert.equal(saved.data.team[0].nickname, "Pixel");
  assert.equal(saved.data.team[0].level, 25);
  assert.deepEqual(saved.data.badges, [0]);
  assert.equal(saved.data.deaths, 1);
  assert.equal(saved.data.style.theme, "glass");
  // OBS revisions include Connect updates; management uses the owner's scene version.
  const ownerState = await jwtClockFetch(`${supabase}/rest/v1/scenes?id=eq.${id}&select=version`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
  });
  assert.equal(ownerState.status, 200);
  scene.version = (await ownerState.json())[0].version;
  console.log("PASS Pokémon search, editing, cloud save, reload and OBS data");
  await mkdir(".artifacts", { recursive: true });
  await page.screenshot({
    path: ".artifacts/studio-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({
    path: ".artifacts/studio-mobile.png",
    fullPage: true,
  });
  const obs = await browser.newPage({ viewport: { width: 1920, height: 600 } });
  await obs.goto(`${base}/overlay/${scene.view_token}`);
  await obs.getByText("Pixel", { exact: true }).waitFor();
  assert.equal(
    await obs.evaluate(() => getComputedStyle(document.body).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  await obs.goto(`${base}/overlay/invalid`);
  assert.equal(
    await obs.evaluate(() => getComputedStyle(document.body).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  console.log("PASS mobile layout and transparent OBS output");
  let response = await request(`/api/scenes/${id}`, {
    method: "PATCH",
    body: { version: scene.version, enabled: false },
  });
  assert.equal(response.status, 200);
  scene = await response.json();
  assert.equal(await rpc(scene.view_token), null);
  assert.equal(
    (
      await request(`/api/scenes/${id}`, {
        method: "PATCH",
        body: { version: scene.version - 1, enabled: true },
      })
    ).status,
    409,
  );
  const oldToken = scene.view_token;
  response = await request(`/api/scenes/${id}`, {
    method: "PATCH",
    body: { version: scene.version, enabled: true, rotateToken: true },
  });
  assert.equal(response.status, 200);
  scene = await response.json();
  assert.notEqual(scene.view_token, oldToken);
  assert.equal(await rpc(oldToken), null);
  assert(await rpc(scene.view_token));
  console.log("PASS pause, resume, link rotation and stale-write rejection");
  await page.goto(`${base}/studio`);
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page.waitForURL(`${base}/`);
  await page.goto(`${base}/login`);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(`${base}/studio`, { timeout: 30000 });
  console.log("PASS logout and email/password login");
  assert.deepEqual(errors, []);
} catch (error) {
  console.error(
    "Failure page:",
    page.url(),
    (await page.locator("body").innerText()).slice(0, 1800),
  );
  console.error("Browser errors:", errors);
  throw error;
} finally {
  if (scene && token) {
    const result = await request(`/api/scenes/${scene.id}`, {
      method: "DELETE",
    });
    assert.equal(result.status, 204);
  }
  // Also recover the test account if registration succeeded before a UI assertion failed.
  if (!accounts.length) {
    try {
      const user = await firebase("signInWithPassword", {
        email,
        password,
        returnSecureToken: true,
      });
      accounts.push(user.idToken);
    } catch {
      /* Account was never created. */
    }
  }
  for (const idToken of accounts) await firebase("delete", { idToken });
  await browser.close();
  console.log("Temporary test accounts and adventure removed.");
}
