import { afterEach, describe, expect, it } from "vitest";
import { isStripePilotEnabled, verifyStripeSignature } from "./stripe";
import { createHmac } from "crypto";

const ORIGINAL = {
  key: process.env.STRIPE_SECRET_KEY,
  price: process.env.STRIPE_PRICE_ID,
};

afterEach(() => {
  if (ORIGINAL.key === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL.key;
  if (ORIGINAL.price === undefined) delete process.env.STRIPE_PRICE_ID;
  else process.env.STRIPE_PRICE_ID = ORIGINAL.price;
});

describe("stripe helpers", () => {
  it("isStripePilotEnabled requires both key and price", () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    expect(isStripePilotEnabled()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    expect(isStripePilotEnabled()).toBe(false);
    process.env.STRIPE_PRICE_ID = "price_x";
    expect(isStripePilotEnabled()).toBe(true);
  });

  it("verifies stripe webhook signatures", () => {
    const secret = "whsec_test";
    const payload = '{"id":"evt_1"}';
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${t},v1=${v1}`, secret)).toBe(true);
    expect(verifyStripeSignature(payload, `t=${t},v1=bad`, secret)).toBe(false);
    expect(verifyStripeSignature(payload, null, secret)).toBe(false);
  });
});
