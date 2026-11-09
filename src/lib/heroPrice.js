// The quiet price line under the landing hero buttons. Built from PLANS so a
// price change in plans.js cannot leave it stale.
export function heroPriceLine(plans) {
  const premium = plans.find((p) => p.id === "premium");
  const free = plans.find((p) => p.id === "free");
  if (!premium || !free) return "";
  return `Free to start. ${premium.name} ${premium.price}/mo, cancel anytime.`;
}
