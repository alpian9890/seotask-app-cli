"use strict";

const { CliError, UsageError } = require("../lib/errors");
const { roundRub } = require("../lib/utils");
const { earningStats } = require("../lib/earnings");

async function cmdEstimate(args) {
  const days = Number.parseInt(args.days, 10);
  if (!Number.isFinite(days) || days <= 0 || String(args.days).trim() !== String(days)) {
    throw new UsageError("argument days: harus berupa angka hari.");
  }
  if (days < 7) throw new CliError("Estimate minimal 7 hari.");

  const stats = earningStats(days);
  if (!stats.dataDays) {
    console.log("Belum ada data pendapatan.");
    console.log("Jalankan task terlebih dulu agar SeoTask bisa mencatat reward harian.");
    return 1;
  }

  const stable = roundRub(stats.avgDailyRub * days);
  const slow = roundRub(stable * 0.7);
  const high = roundRub(stable * 1.3);
  const first = stats.recent[0];
  const last = stats.recent[stats.recent.length - 1];

  console.log(`Estimate: ${days} hari`);
  console.log("");
  console.log("Data pendapatan:");
  console.log(`- Rentang data: ${first.date} sampai ${last.date}`);
  console.log(`- Data tersedia: ${stats.dataDays} hari`);
  console.log(`- Total tercatat: ${stats.totalRub} RUB dari ${stats.totalTasks} task`);
  console.log(`- Rata-rata harian: ${stats.avgDailyRub} RUB`);
  console.log(`- Rata-rata task harian: ${stats.avgDailyTasks} task`);
  console.log(`- Stabilitas: ${stats.stability}`);
  if (stats.dataDays < 7) {
    console.log("- Catatan data: data belum mencapai 7 hari, estimasi masih kasar.");
  }
  console.log("");
  console.log("Perkiraan pendapatan:");
  console.log(`- Slow: ${slow} RUB`);
  console.log(`- Stabil: ${stable} RUB`);
  console.log(`- Tinggi: ${high} RUB`);
  console.log("");
  console.log(`Jika task stabil selalu tersedia dan rate reward tetap stabil, estimasi ${days} hari sekitar ${stable} RUB.`);
  console.log(`Jika task slow, estimasi bisa turun ke sekitar ${slow} RUB.`);
  console.log(`Jika task dan rate tinggi, estimasi bisa naik ke sekitar ${high} RUB.`);
  return 0;
}

module.exports = { cmdEstimate };