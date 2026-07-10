#!/usr/bin/env node
// Creates a Stripe coupon + promotion code for friendly/beta testers.
// Testers redeem it on the real Checkout page (allow_promotion_codes is
// already on in api/create-checkout.js), so the normal webhook flow
// upgrades their account in Supabase — a true end-to-end test.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/create-friendly-tester-coupon.js
//   STRIPE_SECRET_KEY=sk_test_... node scripts/create-friendly-tester-coupon.js MERITFRIENDS --redemptions=25 --months=3 --days=60
//
// Run with a sk_test_... key first to confirm it works, then re-run with
// the live sk_live_... key when you're ready to invite real testers.

import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const match = args.find((a) => a.startsWith(`--${name}=`));
  return match ? Number(match.split("=")[1]) : fallback;
};

const code = (args.find((a) => !a.startsWith("--")) || "MERITFRIENDS").toUpperCase();
const maxRedemptions = flag("redemptions", 25);
const durationInMonths = flag("months", 3);
const days = flag("days", 60);
const redeemBy = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;

const coupon = await stripe.coupons.create({
  name: "MeritLaunch Friendly Tester Access",
  percent_off: 100,
  duration: "repeating",
  duration_in_months: durationInMonths,
  max_redemptions: maxRedemptions,
  redeem_by: redeemBy,
});

const promotionCode = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code,
  max_redemptions: maxRedemptions,
  expires_at: redeemBy,
});

console.log(`Coupon:          ${coupon.id}`);
console.log(`Promotion code:  ${promotionCode.code}`);
console.log(`Redemptions:     ${maxRedemptions}`);
console.log(`Free months:     ${durationInMonths} (then billing resumes at full price)`);
console.log(`Expires:         ${new Date(redeemBy * 1000).toISOString()}`);
console.log("");
console.log(`Share with testers: "${promotionCode.code}" at checkout. A card is still required (Stripe charges $0.00).`);
