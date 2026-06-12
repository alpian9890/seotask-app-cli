"use strict";

const {
  todayEarnings,
  sumEarnings,
  averagePerTask,
  roundRub,
} = require("../lib/earnings");

async function cmdEarnings() {
  const today = todayEarnings();
  const last7 = sumEarnings(7);
  const last30 = sumEarnings(30);
  const total = sumEarnings(null);
  const avgDaily = last7.days ? roundRub(last7.rub / last7.days) : 0;
  const avgTask = averagePerTask(total);

  console.log("Earnings");
  console.log("");
  console.log(`Hari ini: ${today.rub} RUB / ${today.tasks} task`);
  console.log(`7 hari terakhir: ${last7.rub} RUB / ${last7.tasks} task`);
  console.log(`30 hari terakhir: ${last30.rub} RUB / ${last30.tasks} task`);
  console.log(`Total tercatat: ${total.rub} RUB / ${total.tasks} task`);
  console.log("");
  console.log(`Rata-rata harian (7 hari data terakhir): ${avgDaily} RUB`);
  console.log(`Rata-rata per task: ${avgTask} RUB`);
  if (!total.tasks) {
    console.log("");
    console.log("Belum ada pendapatan tercatat. Jalankan task terlebih dulu.");
    return 1;
  }
  return 0;
}

module.exports = { cmdEarnings };