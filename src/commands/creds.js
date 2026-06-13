"use strict";

const { prompt } = require("../lib/auth");

async function cmdCreds(args) {
  if (args.action === "status") {
    const { loadCredentials } = require("../lib/auth");
    const creds = loadCredentials(false);
    if (!creds) {
      console.log("Credentials: belum diset.");
      return 1;
    }
    console.log("Credentials: tersedia");
    console.log(`Email: ${creds.email}`);
    console.log(`Password: ${creds.password}`);
    return 0;
  }
  const { saveCredentials } = require("../lib/auth");
  const email = String(await prompt("Email: ")).trim();
  const password = String(await prompt("Password: ")).trim();
  const saved = saveCredentials(email, password);
  console.log(`Credentials tersimpan: ${saved}`);
  return 0;
}

module.exports = { cmdCreds };
