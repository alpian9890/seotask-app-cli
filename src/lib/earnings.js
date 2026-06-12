"use strict";

const {
  nowUtc,
  nowLogPrefix,
  atomicWriteJson,
  readJson,
  earningsPath,
  appendLogLine,
  localDateKey,
  parseRub,
  roundRub,
} = require("./utils");

// ─── Record earnings ─────────────────────────────────────────────────────────
function recordEarning(reward, taskInfo = {}) {
  const rub = roundRub(parseRub(reward));
  if (rub <= 0) return;
  const dateKey = localDateKey();
  const data = readJson(earningsPath()) || {};
  const day = data[dateKey] && typeof data[dateKey] === "object" ? data[dateKey] : {};
  day.rub = roundRub((Number(day.rub) || 0) + rub);
  day.tasks = (Number.parseInt(day.tasks || 0, 10) || 0) + 1;
  day.updated_at = nowUtc();
  if (!day.created_at) day.created_at = nowUtc();
  data[dateKey] = day;
  atomicWriteJson(earningsPath(), data);
  appendLogLine(`${nowLogPrefix()} [EARNINGS] date=${dateKey} | tasks=${day.tasks} | total=${day.rub} RUB | last_reward=${rub} RUB | id_status=${taskInfo.idStatus || "-"}`);
}

// ─── Earnings queries ────────────────────────────────────────────────────────
function recentEarningDays() {
  const data = readJson(earningsPath()) || {};
  return Object.entries(data)
    .filter(([, value]) => value && typeof value === "object")
    .map(([date, value]) => ({
      date,
      rub: roundRub(Number(value.rub) || 0),
      tasks: Number.parseInt(value.tasks || 0, 10) || 0,
    }))
    .filter((item) => item.rub > 0 || item.tasks > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sumEarnings(days = null) {
  const entries = recentEarningDays();
  const selected = days ? entries.slice(-days) : entries;
  const rub = selected.reduce((sum, item) => sum + item.rub, 0);
  const tasks = selected.reduce((sum, item) => sum + item.tasks, 0);
  return {
    rub: roundRub(rub),
    tasks,
    days: selected.length,
  };
}

function todayEarnings() {
  const date = localDateKey();
  const item = recentEarningDays().find((entry) => entry.date === date);
  return item || { date, rub: 0, tasks: 0 };
}

function averagePerTask(summary) {
  if (!summary.tasks) return 0;
  return roundRub(summary.rub / summary.tasks);
}

// ─── Earnings stats ──────────────────────────────────────────────────────────
function earningStats(days) {
  const recent = recentEarningDays().slice(-Math.max(7, days));
  const rubValues = recent.map((item) => item.rub);
  const taskValues = recent.map((item) => item.tasks);
  const totalRub = rubValues.reduce((sum, value) => sum + value, 0);
  const totalTasks = taskValues.reduce((sum, value) => sum + value, 0);
  const avgDailyRub = rubValues.length ? totalRub / rubValues.length : 0;
  const avgDailyTasks = taskValues.length ? totalTasks / taskValues.length : 0;
  const variance = rubValues.length
    ? rubValues.reduce((sum, value) => sum + Math.pow(value - avgDailyRub, 2), 0) / rubValues.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const coefficient = avgDailyRub > 0 ? stdDev / avgDailyRub : 0;
  let stability = "data belum cukup";
  if (rubValues.length >= 7) {
    if (coefficient <= 0.2) stability = "stabil";
    else if (coefficient <= 0.45) stability = "cukup stabil";
    else stability = "fluktuatif";
  }
  return {
    recent,
    dataDays: rubValues.length,
    totalRub: roundRub(totalRub),
    totalTasks,
    avgDailyRub: roundRub(avgDailyRub),
    avgDailyTasks: Math.round(avgDailyTasks),
    coefficient,
    stability,
  };
}

module.exports = {
  recordEarning,
  recentEarningDays,
  sumEarnings,
  todayEarnings,
  averagePerTask,
  earningStats,
};