// Creates disposable accounts/scenes and deletes them in finally. No personal credentials.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { jwtClockFetch } from "../src/lib/supabase/fetch.ts";
if (process.env.VERIFY_LIVE !== "1") throw new Error("Set VERIFY_LIVE=1");
const base = process.env.VERIFY_URL || "http://localhost:3002";
const key = "AIzaSyCPs6BlLuZuYD7nxdP--4JpiDRyrmq7mi4";
const url = "https://luyiptrahuggjsmtgdtw.supabase.co";
const pub = "sb_publishable_oNF3jMdpWS1dRWxco9JsEg_MrA2bkKS";
const accounts = [];
let scene;
let createdScene;
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function firebase(action, body) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await r.json();
  assert(r.ok, `Firebase ${action}`);
  return data;
}
async function request(
  path,
  {
    user = accounts[0]?.idToken,
    body,
    method = "GET",
    secret,
    origin = base,
  } = {},
) {
  return fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(user ? { Cookie: `pokestream-session=${user}` } : {}),
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function rpc(name, body) {
  return jwtClockFetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: pub, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const secret = randomBytes(32).toString("hex"),
  device = randomUUID(),
  challenge = createHash("sha256").update(secret).digest("hex");
const pairing = { device, challenge, name: "Connect test PC" };
const data = {
  name: "Connect verification",
  game: "sinnoh",
  team: Array(6).fill(null),
  badges: [],
  nuzlocke: false,
  deaths: 0,
  style: {
    theme: "carbon",
    accent: "#ef3340",
    orientation: "horizontal",
    sprite: "artwork",
    showNames: true,
    showLevels: true,
    showTypes: true,
    showItems: false,
    showBadges: true,
    scale: 1,
  },
};
const frame = {
  game: "sinnoh",
  team: [
    {
      species: 133,
      nickname: "Pixel",
      level: 25,
      shiny: true,
      egg: false,
      hp: 0,
      maxHp: 65,
    },
  ],
};
try {
  for (let i = 0; i < 2; i++) {
    const email = `pokestream-connect-${randomUUID()}@example.com`,
      password = `Poke!${randomUUID()}`;
    accounts.push({
      ...(await firebase("signUp", {
        email,
        password,
        returnSecureToken: true,
      })),
      email,
      password,
    });
  }
  let r = await request("/api/scenes", { method: "POST", body: data });
  scene = await r.json();
  assert.equal(r.status, 201);
  r = await request("/api/connect/pair", {
    method: "POST",
    user: accounts[1].idToken,
    body: { ...pairing, scene: scene.id },
  });
  assert.equal(r.status, 409);
  const next = "/connect?" + new URLSearchParams(pairing);
  r = await request(next, { user: null });
  assert.equal(r.status, 307);
  assert(r.headers.get("location").includes("/login?next="));
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login?next=" + encodeURIComponent(next));
  await page.getByLabel("E-mail", { exact: true }).fill(accounts[0].email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill(accounts[0].password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + next, { timeout: 30000 });
  await page.getByRole("button", { name: "Associer", exact: true }).click();
  await page.getByRole("heading", { name: "Appareil associé" }).waitFor();
  console.log(
    "PASS browser email login preserves pairing; explicit association; cross-account isolation",
  );
  r = await request("/api/connect/device", {
    user: null,
    secret: device + "." + challenge,
  });
  assert.equal(r.status, 401);
  r = await request("/api/connect/device", {
    user: null,
    secret: device + "." + secret,
  });
  assert.equal(r.status, 200);
  r = await request("/api/connect/device", {
    method: "POST",
    user: null,
    secret: device + "." + secret,
    body: frame,
  });
  assert.equal(r.status, 200);
  let overlay = await (
    await rpc("read_overlay", { token: scene.view_token })
  ).json();
  assert.equal(overlay.data.team[0].nickname, "Pixel");
  assert.equal(overlay.data.team[0].fainted, true);
  for (const game of ["kanto", "johto", "hoenn", "sinnoh", "unova", "unova2", "kalos", "alola", "hisui", "galar-sword", "galar-shield", "paldea"]) {
    await new Promise((resolve) => setTimeout(resolve, 850));
    const species = game === "paldea" ? 1025 : 133;
    r = await request("/api/connect/device", { method: "POST", user: null, secret: device + "." + secret, body: { ...frame, game, team: [{ ...frame.team[0], species }] } });
    assert.equal(r.status, 200, game);
    const state = await (await rpc("read_overlay", { token: scene.view_token })).json();
    assert.equal(state.data.game, game);
    assert.equal(state.data.team[0].speciesId, species);
  }
  console.log("PASS native frames for 12 regions through API, Supabase and overlay, including species 1025");
  r = await rpc("connect_exchange", {
    device,
    secret,
    snapshot: {
      game: "sinnoh",
      team: Array(6).fill(null),
      style: { accent: "#ffffff" },
    },
  });
  assert.equal(r.status, 400);
  r = await rpc("connect_exchange", {
    device,
    secret,
    snapshot: { game: "sinnoh", team: [{}, null, null, null, null, null] },
  });
  assert.equal(r.status, 400);
  r = await request("/api/connect/device", {
    method: "POST",
    secret: device + "." + secret,
    body: { ...frame, team: [{ ...frame.team[0], hp: 9999 }] },
  });
  assert.equal(r.status, 400);
  r = await request(`/api/scenes/${scene.id}`, {
    method: "PATCH",
    body: {
      version: scene.version,
      data: { ...data, style: { ...data.style, accent: "#38bdf8" } },
    },
  });
  assert.equal(
    r.status,
    200,
    "Connect must not invalidate manual scene version",
  );
  scene = await r.json();
  overlay = await (
    await rpc("read_overlay", { token: scene.view_token })
  ).json();
  assert.equal(overlay.data.style.accent, "#38bdf8");
  assert.equal(overlay.data.team[0].nickname, "Pixel");
  console.log(
    "PASS capability secret, strict SQL/API validation, live overlay, independent manual editing",
  );
  await page.goto(base + `/studio/${scene.id}`);
  await page.getByText("Connect · Équipe en direct").waitFor();
  await page.screenshot({
    path: ".artifacts/connect-studio.png",
    fullPage: true,
  });
  await page.goto(base + "/connect");
  await page.screenshot({
    path: ".artifacts/connect-page.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Jeux compatibles", { exact: true }).click();
  await page.screenshot({
    path: ".artifacts/connect-mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  r = await request("/api/connect/devices", {
    method: "DELETE",
    user: accounts[1].idToken,
    body: { id: device },
  });
  assert.equal(r.status, 200);
  r = await request("/api/connect/device", {
    user: null,
    secret: device + "." + secret,
  });
  assert.equal(r.status, 200, "Other account must not revoke");
  r = await request("/api/connect/devices", {
    method: "DELETE",
    body: { id: device },
  });
  assert.equal(r.status, 200);
  r = await request("/api/connect/device", {
    method: "POST",
    user: null,
    secret: device + "." + secret,
    body: frame,
  });
  assert.equal(r.status, 401);
  overlay = await (
    await rpc("read_overlay", { token: scene.view_token })
  ).json();
  assert.equal(overlay.data.team[0].nickname, "Pixel");
  assert.equal(overlay.data.style.accent, "#38bdf8");
  assert.deepEqual(errors, []);
  // A first-time user can pair without leaving Connect to create an adventure.
  const firstDevice = randomUUID();
  const firstSecret = randomBytes(32).toString("hex");
  const firstNext =
    "/connect?" +
    new URLSearchParams({
      device: firstDevice,
      challenge: createHash("sha256").update(firstSecret).digest("hex"),
      name: "New Connect PC",
    });
  const first = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await first.goto(base + "/login?next=" + encodeURIComponent(firstNext));
  await first.getByLabel("E-mail", { exact: true }).fill(accounts[1].email);
  await first
    .getByLabel("Mot de passe", { exact: true })
    .fill(accounts[1].password);
  await first
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await first.waitForURL(base + firstNext, { timeout: 30000 });
  assert.equal(
    await first.getByLabel("Aventure", { exact: true }).inputValue(),
    "new",
  );
  await first
    .getByLabel("Nom de l’aventure", { exact: true })
    .fill("Ma première partie");
  let creations = 0;
  first.on("response", async (response) => {
    if (response.url() === base + "/api/scenes" && response.status() === 201) {
      creations++;
      createdScene = await response.json();
    }
  });
  await first.route(
    "**/api/connect/pair",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Réessaie l’association." }),
      }),
    { times: 1 },
  );
  await first.getByRole("button", { name: "Associer", exact: true }).click();
  await first.getByRole("alert").filter({ hasText: "Réessaie" }).waitFor();
  assert.notEqual(
    await first.getByLabel("Aventure", { exact: true }).inputValue(),
    "new",
  );
  await first.getByRole("button", { name: "Associer", exact: true }).click();
  await first.getByRole("heading", { name: "Appareil associé" }).waitFor();
  assert.equal(creations, 1, "Retry must reuse the new adventure");
  r = await request("/api/connect/device", {
    user: null,
    secret: firstDevice + "." + firstSecret,
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).scene, "Ma première partie");
  await first.screenshot({
    path: ".artifacts/connect-pair-mobile.png",
    fullPage: true,
  });
  assert(
    await first.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await first.reload();
  await first.getByRole("heading", { name: "Appareil associé" }).waitFor();
  console.log(
    "PASS first-user inline creation, retry without duplicates, remembered pairing, mobile layout",
  );
  console.log(
    "PASS revocation, freeze last team, responsive page, no browser errors",
  );
} finally {
  if (createdScene)
    await request(`/api/scenes/${createdScene.id}`, {
      method: "DELETE",
      user: accounts[1].idToken,
    });
  if (scene) await request(`/api/scenes/${scene.id}`, { method: "DELETE" });
  for (const a of accounts) await firebase("delete", { idToken: a.idToken });
  await browser.close();
  console.log("Temporary accounts and scene removed");
}
