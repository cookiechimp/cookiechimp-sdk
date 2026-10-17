import { readFileSync } from "node:fs";
import { expect, type Page, type Request, test } from "@playwright/test";

const URL = "http://127.0.0.1:3104/connected";
const API = "https://cookiechimp.com/api/v1/mobile-sdk/";
const fixture = JSON.parse(
  readFileSync(
    "packages/core/src/fixtures/platform-offline-bundle.json",
    "utf8",
  ),
);

// Intercept every platform API request. These example tests never write to
// CookieChimp's live backend and do not satisfy its live release gate.
async function platform(
  page: Page,
  deliver?: (request: Request) => object | number | undefined,
) {
  const records: Request[] = [];
  await page.route(`${API}**`, async (route) => {
    const request = route.request();
    if (request.url() === `${API}offline/acctREDACTED`) {
      if (request.headers()["if-none-match"])
        await route.fulfill({ status: 304 });
      else await route.fulfill({ json: fixture });
    } else if (request.url() === `${API}sync/acctREDACTED`) {
      records.push(request);
      const response = deliver?.(request);
      if (typeof response === "number")
        await route.fulfill({ status: response });
      else
        await route.fulfill({
          json: response ?? {
            synced: request
              .postDataJSON()
              .consents.map((record: { client_id: string }) => ({
                client_id: record.client_id,
                server_id: 1,
              })),
            failed: [],
          },
        });
    } else await route.abort();
  });
  return records;
}

test("setup makes no platform request and rejects keys used as account IDs", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route(`${API}**`, async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await page.goto(URL);
  await expect(page.getByTestId("connected-config")).toContainText(
    "Enter your public CookieChimp account ID",
  );
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  await page
    .getByLabel("Public CookieChimp account ID")
    .fill("cc_sk_do_not_send");
  await page
    .getByRole("button", { name: "Load CookieChimp configuration" })
    .click();
  await expect(page.getByTestId("connected-config")).toContainText(
    "never an API key or secret",
  );
  expect(requests).toEqual([]);
});

test("dashboard config, cookie and copy drive consent with a matching platform receipt", async ({
  page,
  context,
}) => {
  const records = await platform(page);
  await context.addCookies([
    {
      name: "platform_session",
      value: "must-not-be-sent",
      domain: "cookiechimp.com",
      path: "/",
      secure: true,
      sameSite: "None",
    },
  ]);
  await page.goto(`${URL}?project=acctREDACTED`);
  await expect(page.getByTestId("connected-config")).toContainText(
    "Banner bnrEU1; version a1b2c3d4",
  );
  await expect(
    page.getByRole("heading", { name: "We value your privacy" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept All", exact: true }).click();
  await expect(page.getByTestId("connected-delivery")).toHaveText(
    "Platform acknowledged 1 consent record(s).",
  );
  await expect(page.getByTestId("connected-pending")).toHaveText(
    "Queued records: 0",
  );
  expect(records).toHaveLength(1);
  const request = records[0] as Request;
  expect(request.method()).toBe("POST");
  expect((await request.allHeaders()).cookie).toBeUndefined();
  expect((await request.allHeaders()).authorization).toBeUndefined();
  expect(request.postDataJSON().consents[0]).toMatchObject({
    consent_banner_hashid: "bnrEU1",
    language_code: "en",
    platform: "web",
    url: "http://127.0.0.1:3104",
    user_preferences: {
      action: "accept_all",
      acceptedCategories: expect.arrayContaining(["analytics", "marketing"]),
    },
  });
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "cookiechimp_pref_REDACTED",
    )?.value,
  ).toMatch(/^v1\./);
  await page.reload();
  await expect(page.getByTestId("connected-config")).toContainText(
    "Configuration loaded from CookieChimp",
  );
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review cookie choices" }),
  ).toBeVisible();
  expect(records).toHaveLength(1);
});

test("dashboard preference categories produce a custom decision in the platform payload", async ({
  page,
}) => {
  const records = await platform(page);
  await page.goto(`${URL}?project=acctREDACTED`);
  await page
    .getByRole("button", { name: "Manage Preferences", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Cookie Settings" }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "analytics", exact: true }).click();
  await page
    .getByRole("button", { name: "Save Preferences", exact: true })
    .click();
  await expect(page.getByTestId("connected-delivery")).toHaveText(
    "Platform acknowledged 1 consent record(s).",
  );
  expect(records).toHaveLength(1);
  expect(records[0]?.postDataJSON().consents[0].user_preferences).toMatchObject(
    {
      action: "custom",
      acceptedCategories: expect.arrayContaining(["analytics"]),
      rejectedCategories: expect.arrayContaining(["marketing"]),
    },
  );
});

test("a failed delivery stays queued and a retry receives a platform acknowledgement", async ({
  page,
}) => {
  let calls = 0;
  const records = await platform(page, () => (++calls === 1 ? 500 : undefined));
  await page.goto(`${URL}?project=acctREDACTED`);
  await page.getByRole("button", { name: "Reject All", exact: true }).click();
  await expect(page.getByTestId("connected-pending")).toHaveText(
    "Queued records: 1",
  );
  await expect(page.getByTestId("connected-delivery")).toHaveText(
    "Platform acknowledged 1 consent record(s).",
    { timeout: 10000 },
  );
  expect(records).toHaveLength(2);
  expect(records[0]?.postDataJSON().consents[0].client_id).toBe(
    records[1]?.postDataJSON().consents[0].client_id,
  );
  expect(
    records[0]?.postDataJSON().consents[0].user_preferences.rejectedCategories,
  ).toEqual(expect.arrayContaining(["analytics", "marketing"]));
});

test("an empty queue without a matching receipt is not reported as verified delivery", async ({
  page,
}) => {
  await platform(page, () => ({}));
  await page.goto(`${URL}?project=acctREDACTED`);
  await page.getByRole("button", { name: "Accept All", exact: true }).click();
  await expect(page.getByTestId("connected-delivery")).toHaveText(
    "Platform responded; awaiting a matching receipt.",
  );
  await expect(page.getByTestId("connected-pending")).toHaveText(
    "Queued records: 0",
  );
});

test("backend config failure is visible and never presented as a successful connection", async ({
  page,
}) => {
  await page.route(`${API}**`, (route) => route.fulfill({ status: 403 }));
  await page.goto(`${URL}?project=acctREDACTED`);
  await expect(page.getByTestId("connected-config")).toContainText(
    "Live configuration unavailable (HTTP 403)",
  );
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  await expect(page.getByTestId("connected-delivery")).not.toContainText(
    "acknowledged",
  );
});
