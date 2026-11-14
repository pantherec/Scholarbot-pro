// Contact details are stripped from a student's uploaded resume or brag sheet
// before the text is kept, in the browser or in the account. A resume carries a
// phone number, an email and a street address; none of them help a scholarship
// letter, and all of them raise the cost of a leak. The same rules run again on
// the server before any text reaches the AI (api/_shared/prompts.js); a test
// keeps the two in step.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const STREET_SUFFIX = "(?:[Ss]t(?:reet)?|[Aa]ve(?:nue)?|[Rr]d|[Rr]oad|[Bb]lvd|[Bb]oulevard|[Dd]r(?:ive)?|[Ll]n|[Ll]ane|[Cc]t|[Cc]ourt|[Ww]ay)";
const ADDRESS_RE = new RegExp(
  String.raw`(?<![\w$.,-])(?!(?:19|20)\d\d\b)\d{1,6}\s+(?:[A-Z0-9][A-Za-z0-9.'’-]*\s+){1,4}?` + STREET_SUFFIX + String.raw`\b\.?` +
  String.raw`(?:,?\s*(?:[Aa]pt|[Uu]nit|[Ss]uite|[Ss]te|#)\.?\s*[A-Za-z0-9-]+)?` +
  String.raw`(?:,?\s*[A-Z][A-Za-z.' -]{1,30},?\s+[A-Z]{2}\.?(?:\s+\d{5}(?:-\d{4})?)?)?`, "g");
const PHONE_RE = /(?<![\d.])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}(?![\d])|(?<![\d.-])\d{3}[-.]\d{4}(?![\d-])/g;

export function scrubContact(text) {
  return String(text || "")
    .replace(EMAIL_RE, "[removed]")
    .replace(ADDRESS_RE, "[removed]")
    .replace(PHONE_RE, "[removed]");
}

// How many contact details a text holds, for the "we removed N" notice.
export function countContact(text) {
  const t = String(text || "");
  return (t.match(EMAIL_RE) || []).length + (t.match(ADDRESS_RE) || []).length + (t.match(PHONE_RE) || []).length;
}
