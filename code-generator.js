const crypto = require("crypto");
// The next two functions help us generate the code challenge
// required by Etsy’s OAuth implementation.
const base64URLEncode = (str) =>
  str
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest();

// We’ll use the verifier to generate the challenge.
// The verifier needs to be saved for a future step in the OAuth flow.
const codeVerifier = base64URLEncode(crypto.randomBytes(32));

// With these functions, we can generate
// the values needed for our OAuth authorization grant.
const codeChallenge = base64URLEncode(sha256(codeVerifier));
const state = Math.random().toString(36).substring(7);

console.log(`State: ${state}`);
console.log(`Code challenge: ${codeChallenge}`);
console.log(`Code verifier: ${codeVerifier}`);
const REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? process.env.BACKEND_URL_PROD
    : process.env.BACKEND_URL_LOCAL;
console.log(
  `Full URL: https://www.etsy.com/oauth/connect?response_type=code&redirect_uri=${REDIRECT_URI}&scope=email_r&client_id=${process.env.ETSY_CLIENT_ID}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`,
);
