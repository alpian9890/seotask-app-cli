"use strict";

const { CliError } = require("../lib/errors");
const { prompt } = require("../lib/auth");
const {
  gmailPath,
} = require("../lib/utils");
const {
  isGmail,
  maskGoogleEmail,
  saveGoogleEmail,
  loadGoogleEmail,
  sessionLoginEmail,
  effectiveGoogleEmail,
} = require("../lib/gmail");

async function promptGmail() {
  while (true) {
    const email = String(await prompt("Google email (@gmail.com): ")).trim().toLowerCase();
    if (isGmail(email)) return email;
    console.log("Email tidak valid. Wajib alamat @gmail.com, contoh: user@gmail.com.");
  }
}

async function cmdGmail(args) {
  if (args.action === "status") {
    const configured = loadGoogleEmail(false);
    const fallback = effectiveGoogleEmail();
    if (configured) {
      console.log("google_email: tersimpan");
      console.log(`Email: ${configured}`);
      console.log(`Masked: ${maskGoogleEmail(configured)}`);
      console.log(`File: ${gmailPath()}`);
      return 0;
    }
    if (fallback.email) {
      console.log("google_email: fallback dari email login/credentials");
      console.log(`Email: ${fallback.email}`);
      console.log(`Masked: ${maskGoogleEmail(fallback.email)}`);
      return 0;
    }
    console.log("google_email: belum tersedia.");
    console.log("Jalankan `seotask gmail` untuk menyimpan alamat @gmail.com.");
    return 1;
  }

  const loginEmail = sessionLoginEmail();
  let email = "";
  if (isGmail(loginEmail)) {
    console.log(`Email login SeoTask: ${loginEmail}`);
    while (true) {
      const answer = String(await prompt("Gunakan email login sebagai google_email? (y/n): ")).trim().toLowerCase();
      if (["y", "yes", ""].includes(answer)) {
        email = loginEmail;
        break;
      }
      if (["n", "no"].includes(answer)) {
        email = await promptGmail();
        break;
      }
      console.log("Input tidak valid. Jawab y atau n.");
    }
  } else {
    if (loginEmail) console.log(`Email login SeoTask bukan @gmail.com: ${loginEmail}`);
    email = await promptGmail();
  }

  if (!email) throw new CliError("google_email belum diisi.");
  const saved = saveGoogleEmail(email);
  console.log(`google_email tersimpan: ${saved}`);
  console.log(`Email: ${email}`);
  console.log(`Masked: ${maskGoogleEmail(email)}`);
  return 0;
}

module.exports = { cmdGmail };
