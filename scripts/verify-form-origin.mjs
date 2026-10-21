// No external accounts or credentials. Checks actual browser form Origin behavior.
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "@playwright/test";
import config from "../next.config.ts";
const headers = (await config.headers()).find(
  (rule) => rule.source === "/:path*",
).headers;
const requests = [];
const server = http.createServer((req, res) => {
  for (const { key, value } of headers) res.setHeader(key, value);
  if (req.url === "/submit") {
    requests.push(req.headers.origin);
    res.statusCode = req.headers.origin === origin ? 200 : 403;
    res.end("done");
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    '<form method="post" action="' +
      origin +
      '/submit"><button>Submit</button></form>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port,
  origin = "http://127.0.0.1:" + port;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(origin);
  let response = page.waitForResponse((r) => r.url() === origin + "/submit");
  await page.getByRole("button", { name: "Submit" }).click();
  assert.equal((await response).status(), 200);
  assert.equal(requests.at(-1), origin);
  console.log("PASS same-origin browser form preserves Origin");
  await page.goto("http://localhost:" + port);
  response = page.waitForResponse((r) => r.url() === origin + "/submit");
  await page.getByRole("button", { name: "Submit" }).click();
  assert.equal((await response).status(), 403);
  assert.notEqual(requests.at(-1), origin);
  console.log("PASS cross-origin browser form remains blocked");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
