import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  Cell, ReferenceLine, LineChart, Line, CartesianGrid, ComposedChart,
} from "recharts";
import * as XLSX from "xlsx";
import { API_ENDPOINTS, API_BASE_URL } from "../../config/api";
import PDFViewerModal from "../PDFViewerModal";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MarketResearchTab from "./MarketResearchTab";
import UnderwritingModelTab from "./UnderwritingModelTab";
import MonteCarloTab from "./MonteCarloTab";
import { calculateFullAnalysis } from "../../utils/realEstateCalculations";
import { geocodeAddress } from "../../utils/geocode";
import { supabase } from "../../lib/supabase";
import { getGmailStatus, sendGmail } from "../../lib/gmailService";

// Satellite imagery uses Mapbox (higher-res) when a token is configured,
// falling back to free Esri World Imagery tiles if it isn't.
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

/* ================================================================
   DATA / CONFIG LAYER — every number lives here or is derived.
   ================================================================ */
const CFG = {
  deal: {
    name: "Cobblestone on The Lake",
    address: "4400 Cortina Circle, Fort Myers, FL 33916",
    type: "Multifamily",
    units: 248,
    yearBuilt: 2008,
    buildings: 11,
    stories: 4,
    parcel: "10627234",
    nrsf: 329849,
    acres: 13.68,
    avgUnitSize: 1330,
  },
  acq: {
    price: 37200000,
    holdYears: 5,
    closingDate: "3/7/26",
    saleDate: "3/7/31",
    closingCosts: 509613,
    workingCapital: 0,
    acqFeePct: 0.01,
    dispFeePct: 0.01,
    costsOfSalePct: 0.02,
  },
  assumptions: {
    growth: 0.03,
    expGrowth: 0.03,
    stabVacancy: 0.05,
    y1Vacancy: 0.07,
    badDebtPct: 0.01,
    concessionsPct: 0.005,
    otherIncomeT12: 688248,
    exitCap: 0.055,
    assetMgmtPct: 0.01,
    capexReservePerUnit: 250,
  },
  unitMix: [
    { type: "2BR/2BA", count: 160, baseRent: 1717, sf: 1228, code: "69593b1" },
    { type: "3BR/3BA", count: 64, baseRent: 2045, sf: 1772, code: "69593c2" },
    { type: "1BR/1BA", count: 24, baseRent: 1500, sf: 764, code: "69593a1" },
  ],
  vacantCount: 23,
  reno: { premium: 200, costPerUnit: 5000, targetType: "1BR/1BA", months: 6 },
  scenarios: {
    bridge: { label: "Bridge", rate: 0.09, amort: 30, io: 24, term: 10, fees: 0.01, ltv: 0.70, cons: { dscr: "1.1x", dy: "7%", ltv: "75%" }, desc: "Short-term financing with IO period for value-add" },
    agencyAm: { label: "Agency Am", rate: 0.0625, amort: 30, io: 0, term: 10, fees: 0.01, ltv: 0.70, cons: { dscr: "1.25x", dy: "8%", ltv: "70%" }, desc: "Agency amortizing loan" },
    agencyIO: { label: "Agency IO", rate: 0.0625, amort: 30, io: 60, term: 10, fees: 0.01, ltv: 0.70, cons: { dscr: "1.25x", dy: "8%", ltv: "65%" }, desc: "Agency full-term IO" },
  },
  waterfall: { lpShare: 0.9, pref: 0.08, promote: 0.2 },
  rubs: {
    items: [
      { key: "water", label: "Water / Sewer", share: 0.45 },
      { key: "electric", label: "Electric (Common Areas)", share: 0.25 },
      { key: "trash", label: "Trash Removal", share: 0.20 },
      { key: "gas", label: "Gas", share: 0.10 },
    ],
    defaultRecovery: 1.0,
  },
  salesComps: [
    { name: "The Preserve at Estero", units: 320, year: 2006, price: 51200000, date: "11/25" },
    { name: "Lakewood Ranch Flats", units: 264, year: 2010, price: 44880000, date: "08/25" },
    { name: "Cypress Pointe", units: 208, year: 2004, price: 29640000, date: "05/25" },
    { name: "Gulf Breeze Commons", units: 296, year: 2012, price: 54760000, date: "02/26" },
  ],
  rentComps: [
    { name: "The Preserve at Estero", oneBr: 1595, twoBr: 1810, threeBr: 2120, occ: 0.94 },
    { name: "Lakewood Ranch Flats", oneBr: 1540, twoBr: 1765, threeBr: 2075, occ: 0.93 },
    { name: "Cypress Pointe", oneBr: 1480, twoBr: 1700, threeBr: 1990, occ: 0.91 },
    { name: "Gulf Breeze Commons", oneBr: 1620, twoBr: 1850, threeBr: 2180, occ: 0.95 },
  ],
  firstNames: ["Patricia", "Adrian", "Mercedes", "Susana", "Daniela", "Eric", "Alexandre", "Annabelle", "Britany", "Gabriel", "Amanda", "Frank", "Joel", "Maria", "Kevin", "Lena", "Oscar", "Priya", "Tom", "Nadia"],
  lastNames: ["Smith", "Hernandez Cruz", "Dacosta", "Paneque", "Noval Molano", "Vieira", "Morais", "Lipsett", "Cozad", "Albertoni", "Thompson", "Carriera", "Nguyen", "Okafor", "Silva", "Kowalski", "Reyes", "Patel", "Brooks", "Ivanova"],
};

/* ---------------- deterministic rng ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- formatting ---------------- */
const fm = (n, d = 0) => (n === null || n === undefined || isNaN(n)) ? "—" :
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const $f = (n, d = 0) => n < 0 ? `-$${fm(Math.abs(n), d)}` : `$${fm(n, d)}`;
const $p = (n) => n < 0 ? `($${fm(Math.abs(n))})` : `$${fm(n)}`;
const pct = (n, d = 2) => `${fm(n * 100, d)}%`;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ================================================================
   FINANCIAL ENGINE — everything derived, nothing hardcoded in UI
   ================================================================ */
function buildUnits() {
  const rnd = mulberry32(42);
  const units = [];
  let num = 120;
  const mixExpanded = [];
  CFG.unitMix.forEach((m) => { for (let i = 0; i < m.count; i++) mixExpanded.push(m); });
  // deterministic shuffle
  for (let i = mixExpanded.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [mixExpanded[i], mixExpanded[j]] = [mixExpanded[j], mixExpanded[i]];
  }
  const vacantIdx = new Set();
  while (vacantIdx.size < CFG.vacantCount) vacantIdx.add(Math.floor(rnd() * CFG.deal.units));
  const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  for (let i = 0; i < CFG.deal.units; i++) {
    const m = mixExpanded[i];
    const rent = Math.round(m.baseRent * (0.9 + rnd() * 0.24));
    const vac = vacantIdx.has(i);
    const startYr = 2019 + Math.floor(rnd() * 7);
    const sm = months[Math.floor(rnd() * 12)];
    const expYr = 2025 + Math.floor(rnd() * 2);
    const em = months[Math.floor(rnd() * 12)];
    units.push({
      id: i, unit: String(num + i).padStart(4, "0"), expYear: expYr,
      tenant: vac ? "VACANT" : `${CFG.firstNames[Math.floor(rnd() * 20)]} ${CFG.lastNames[Math.floor(rnd() * 20)]}`,
      code: m.code, type: m.type, sf: m.sf, rent, vacant: vac,
      leaseStart: vac ? "N/A" : `${sm}/${Math.floor(rnd() * 27 + 1)}/${startYr}`,
      leaseExp: vac ? "N/A" : `${em}/${Math.floor(rnd() * 27 + 1)}/${expYr}`,
      expMonthIdx: Math.floor(rnd() * 12),
      tenureYears: vac ? 0 : +(rnd() * 6).toFixed(1),
    });
  }
  return units;
}

function buildT12(rnd = mulberry32(7)) {
  const M = 12;
  const gpr = [], rows = {};
  const mk = (base, vol, anomalies = {}) =>
    Array.from({ length: M }, (_, i) => anomalies[i] !== undefined ? anomalies[i] : Math.round(base * (1 - vol + rnd() * vol * 2)));
  for (let i = 0; i < M; i++) gpr.push(Math.round(455000 * (0.985 + rnd() * 0.03)));
  rows.gpr = gpr;
  rows.physVac = mk(-40000, 0.25);
  rows.badDebt = mk(-8000, 0.6, { 4: -22643 });
  rows.concessions = mk(-4500, 0.6, { 10: -12400 });
  rows.otherLoss = mk(-3000, 1.5, { 0: 2953, 5: 19317 });
  rows.otherIncome = mk(CFG.assumptions.otherIncomeT12 / 12, 0.08);
  rows.payroll = mk(-27000, 0.08, { 5: -41877, 10: -41210 });
  rows.utilities = mk(-45000, 0.12, { 11: -33901 });
  rows.rm = mk(-17000, 0.2, { 1: -32721 });
  rows.insurance = mk(-29000, 0.12);
  rows.reTax = mk(-56376, 0.0, { 4: 30723, 5: -48458 });
  rows.propMgmt = mk(-13500, 0.06);
  rows.marketing = mk(-2600, 0.2);
  rows.admin = mk(-13000, 0.15, { 2: -7588 });
  rows.contract = mk(-21500, 0.15, { 2: -29609 });
  rows.turnover = mk(-2900, 0.4, { 6: -7893 });
  rows.other = mk(0, 0);
  return rows;
}
const sum = (a) => a.reduce((x, y) => x + y, 0);

/* ---------------- real-deal builders --------------------------------
   Same output shape as buildUnits()/buildT12() above, but every input
   number is sourced from the actual parsed deal (unit count/mix, GPR,
   expenses, EGI) instead of the hardcoded "Cobblestone" demo — only the
   individual tenant names/lease dates/monthly jitter stay synthetic since
   the parser doesn't extract that level of detail. Annual totals always
   tie back to the real parsed figures. */
function spreadAnnual(total, rnd, vol = 0.06) {
  const weights = Array.from({ length: 12 }, () => 1 - vol + rnd() * vol * 2);
  const wSum = sum(weights);
  return weights.map((w) => Math.round((total * w) / wSum));
}

function buildRealUnits(totalUnits, mix, vacantCount) {
  const rnd = mulberry32(42);
  const mixExpanded = [];
  mix.forEach((m) => { for (let i = 0; i < m.count; i++) mixExpanded.push(m); });
  while (mixExpanded.length < totalUnits) mixExpanded.push(mix[mixExpanded.length % mix.length]);
  mixExpanded.length = totalUnits;
  for (let i = mixExpanded.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [mixExpanded[i], mixExpanded[j]] = [mixExpanded[j], mixExpanded[i]];
  }
  const vacantIdx = new Set();
  const vc = Math.max(0, Math.min(vacantCount, totalUnits));
  while (vacantIdx.size < vc) vacantIdx.add(Math.floor(rnd() * totalUnits));
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const units = [];
  for (let i = 0; i < totalUnits; i++) {
    const m = mixExpanded[i];
    const baseRent = m.baseRent > 0 ? m.baseRent : 1200;
    const rent = Math.round(baseRent * (0.94 + rnd() * 0.12));
    const vac = vacantIdx.has(i);
    const startYr = 2019 + Math.floor(rnd() * 7);
    const sm = months[Math.floor(rnd() * 12)];
    const expYr = 2025 + Math.floor(rnd() * 2);
    const em = months[Math.floor(rnd() * 12)];
    units.push({
      id: i, unit: String(100 + i).padStart(4, "0"), expYear: expYr,
      tenant: vac ? "VACANT" : `${CFG.firstNames[Math.floor(rnd() * 20)]} ${CFG.lastNames[Math.floor(rnd() * 20)]}`,
      code: m.code, type: m.type, sf: m.sf, rent, vacant: vac,
      leaseStart: vac ? "N/A" : `${sm}/${Math.floor(rnd() * 27 + 1)}/${startYr}`,
      leaseExp: vac ? "N/A" : `${em}/${Math.floor(rnd() * 27 + 1)}/${expYr}`,
      expMonthIdx: Math.floor(rnd() * 12),
      tenureYears: vac ? 0 : +(rnd() * 6).toFixed(1),
    });
  }
  return units;
}

function buildRealT12(real) {
  const rnd = mulberry32(11);
  const pnl = real?.pnl || {};
  const exp = real?.expenses || {};
  const gprAnnual = pnl.gross_potential_rent || 0;
  const otherIncomeAnnual = pnl.other_income || 0;
  const egiAnnual = pnl.effective_gross_income || (gprAnnual + otherIncomeAnnual);
  // The parser doesn't split vacancy/bad debt/concessions/other-loss out
  // individually — the whole GPR→EGI gap is booked to Physical Vacancy so
  // the statement still ties exactly to the real parsed EGI.
  const lossAnnual = Math.max(0, gprAnnual + otherIncomeAnnual - egiAnnual);
  const rows = {};
  rows.gpr = spreadAnnual(gprAnnual, rnd, 0.02);
  rows.physVac = spreadAnnual(-lossAnnual, rnd, 0.15);
  rows.badDebt = Array(12).fill(0);
  rows.concessions = Array(12).fill(0);
  rows.otherLoss = Array(12).fill(0);
  rows.otherIncome = spreadAnnual(otherIncomeAnnual, rnd, 0.08);
  rows.payroll = spreadAnnual(-(exp.payroll || 0), rnd, 0.08);
  rows.utilities = spreadAnnual(-(exp.utilities || 0), rnd, 0.1);
  rows.rm = spreadAnnual(-(exp.repairs_maintenance || 0), rnd, 0.2);
  rows.insurance = spreadAnnual(-(exp.insurance || 0), rnd, 0.05);
  rows.reTax = spreadAnnual(-(exp.taxes || 0), rnd, 0.02);
  rows.propMgmt = spreadAnnual(-(exp.management || 0), rnd, 0.05);
  rows.marketing = spreadAnnual(-(exp.marketing || 0), rnd, 0.15);
  rows.admin = spreadAnnual(-(exp.admin || 0), rnd, 0.1);
  rows.contract = Array(12).fill(0);
  rows.turnover = Array(12).fill(0);
  rows.other = spreadAnnual(-(exp.other || 0), rnd, 0.1);
  return rows;
}

function annuityPmt(loan, rate, amortYrs) {
  const r = rate / 12, n = amortYrs * 12;
  return loan * r / (1 - Math.pow(1 + r, -n));
}
function balanceAfter(loan, rate, amortYrs, ioMonths, monthsElapsed) {
  if (monthsElapsed <= ioMonths) return loan;
  const r = rate / 12, pmt = annuityPmt(loan, rate, amortYrs);
  let bal = loan;
  for (let m = ioMonths; m < monthsElapsed; m++) bal = bal * (1 + r) - pmt;
  return bal;
}
function irr(flows) {
  let lo = -0.95, hi = 3;
  const npv = (r) => flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + r, i), 0);
  if (npv(lo) * npv(hi) > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function useModel(state, real) {
  return useMemo(() => {
    const { ltv, loanFeesPct, scenarioKey, rateOverride, spread, baseRate, amort, ioMonths,
      exitCap, costsOfSalePct, growth, incomeMethod, renoPremium, renoCost, selectedRenoIds, distWeights,
      scheduleStart, scheduleEnd, rubsSelected, rubsRecoveryPct, imputeVacant,
      renoDowntime, maxConcurrent, capexMode, gpPct, cmFeePct, amFeePct, acqFeePct, dispFeePct,
      jvOn, jvContribPct, jvPrefRate, jvMode, refiYear, refiLTV, refiRate, refiOn, purchasePrice } = state;
    const A = CFG.assumptions, ACQ = { ...CFG.acq, price: purchasePrice ?? CFG.acq.price };
    // Real-deal overrides: derive unit count/mix/vacancy/T-12 from the ACTUAL
    // parsed deal instead of the hardcoded "Cobblestone" demo dataset — every
    // deal used to show the exact same fake 248-unit property here regardless
    // of what was uploaded.
    const realUnitsCount = real?.property?.units > 0 ? Math.round(real.property.units) : 0;
    const realMix = Array.isArray(real?.unit_mix) ? real.unit_mix.filter((m) => m && m.units > 0) : [];
    const useRealUnits = realUnitsCount > 0 && realMix.length > 0;
    const dealUnits = useRealUnits ? realUnitsCount : CFG.deal.units;
    const unitMixSource = useRealUnits ? realMix.map((m) => ({
      type: m.type || "Unit",
      count: Math.round(m.units),
      baseRent: m.rent_current || m.rent_market || 0,
      sf: m.unit_sf || CFG.deal.avgUnitSize,
      code: (m.type || "unit").toLowerCase().replace(/[^a-z0-9]/g, ""),
    })) : CFG.unitMix;
    const vacRatePct = real?.pnl?.vacancy_rate_current ?? real?.pnl?.vacancy_rate ?? null;
    const vacantCount = useRealUnits
      ? Math.max(0, Math.min(dealUnits, Math.round(dealUnits * ((vacRatePct != null ? vacRatePct : 5) / 100))))
      : CFG.vacantCount;
    const hasRealFinancials = (real?.pnl?.gross_potential_rent > 0) || (real?.pnl?.effective_gross_income > 0);
    const units = useRealUnits ? buildRealUnits(dealUnits, unitMixSource, vacantCount) : buildUnits();
    const t12 = hasRealFinancials ? buildRealT12(real) : buildT12();


    /* rent roll aggregates */
    const gprMonthly = units.reduce((s, u) => s + u.rent, 0);
    const inPlaceMonthly = units.filter((u) => !u.vacant).reduce((s, u) => s + u.rent, 0);
    const occupied = units.filter((u) => !u.vacant).length;

    /* reno set */
    const renoPool = units.filter((u) => u.type === CFG.reno.targetType);
    const renoUnits = renoPool.filter((u) => selectedRenoIds.has(u.id));
    const renoCount = renoUnits.length;
    const totalRenoCost = renoCount * renoCost;
    const totalPremiumYr = renoCount * renoPremium * 12;

    /* capacity-constrained schedule: vacant units first, then by lease expiration;
       at most maxConcurrent starts per month; offline for renoDowntime months */
    const schedule = {};
    const ordered = [...renoUnits].sort((a, b) => (a.vacant === b.vacant ? a.expMonthIdx - b.expMonthIdx : a.vacant ? -1 : 1));
    ordered.forEach((u, rank) => {
      const start = 1 + Math.floor(rank / Math.max(maxConcurrent, 1));
      schedule[u.id] = { start, ret: start + renoDowntime };
    });
    const renoStart = (u) => (schedule[u.id] ? schedule[u.id].start : 1);
    const renoReturn = (u) => (schedule[u.id] ? schedule[u.id].ret : 1 + renoDowntime);
    const ganttMonths = 13;
    const downUnits = Array.from({ length: ganttMonths }, (_, mi) => {
      const m = mi + 1;
      return renoUnits.filter((u) => m >= renoStart(u) && m < renoReturn(u)).length;
    });

    /* T-12 aggregates */
    const t12NetRental = t12.gpr.map((g, i) => g + t12.physVac[i] + t12.badDebt[i] + t12.concessions[i] + t12.otherLoss[i]);
    const t12EGR = t12NetRental.map((n, i) => n + t12.otherIncome[i]);
    const expKeys = ["payroll", "utilities", "rm", "insurance", "reTax", "propMgmt", "marketing", "admin", "contract", "turnover", "other"];
    const t12OpexM = t12.gpr.map((_, i) => expKeys.reduce((s, k) => s + t12[k][i], 0));
    const T12 = {
      gpr: sum(t12.gpr), egr: sum(t12EGR), opex: sum(t12OpexM),
      noi: sum(t12EGR) + sum(t12OpexM), rows: t12, netRental: t12NetRental, egrM: t12EGR, opexM: t12OpexM,
      opexRatio: -sum(t12OpexM) / sum(t12EGR),
    };

    /* Due Diligence findings now come from the real Claude-powered audit endpoint
       (see useDueDiligence hook) — no more fabricated anomaly detection here. */

    /* rent roll AI: new-lease trend + MTM, computed from units */
    const occUnits = units.filter((u) => !u.vacant);
    const recentLeases = occUnits.filter((u) => u.tenureYears >= 0.5 && u.tenureYears < 1);
    const olderLeases = occUnits.filter((u) => u.tenureYears >= 1);
    const avgRent = (arr) => arr.length ? arr.reduce((s, u) => s + u.rent, 0) / arr.length : 0;
    const rentTrend = {
      recent: Math.round(avgRent(recentLeases)), older: Math.round(avgRent(olderLeases)),
      nRecent: recentLeases.length, nOlder: olderLeases.length,
      pct: avgRent(olderLeases) > 0 ? avgRent(recentLeases) / avgRent(olderLeases) - 1 : 0,
    };
    const mtmPct = occUnits.length ? occUnits.filter((u) => u.expYear === 2025 && u.expMonthIdx <= 1).length / occUnits.length : 0;

    /* RUBS bill-back */
    const utilAnnual = -sum(t12.utilities);
    const rubsRows = CFG.rubs.items.map((it) => {
      const annual = utilAnnual * it.share;
      return { ...it, annual, perUnitMo: annual / dealUnits / 12, selected: rubsSelected.has(it.key) };
    });
    const rubsActive = incomeMethod === "rubs";
    const rubsAnnual = rubsActive
      ? rubsRows.filter((r) => r.selected).reduce((s, r) => s + r.annual, 0) * rubsRecoveryPct
      : 0;
    const rubsValueImpact = rubsAnnual / exitCap;
    const rubsPerUnitMo = rubsAnnual / dealUnits / 12;

    /* pro forma years 1..hold */
    const H = ACQ.holdYears;
    const years = [];
    const premiumActive = incomeMethod === "simple" || incomeMethod === "advanced";
    const marketGprY1 = (gprMonthly + (premiumActive ? renoCount * renoPremium : 0)) * 12;
    // Real other-income (from the parsed T-12) when available, else the demo constant.
    const otherIncomeAnnualBase = hasRealFinancials ? (real?.pnl?.other_income || 0) : A.otherIncomeT12;
    for (let y = 1; y <= H + 1; y++) {
      const g = Math.pow(1 + growth, y - 1);
      const gprY = marketGprY1 * g;
      const vac = y === 1 ? A.y1Vacancy : A.stabVacancy;
      const physVac = -gprY * vac;
      const badDebt = -gprY * A.badDebtPct;
      const conc = -gprY * A.concessionsPct;
      const netRental = gprY + physVac + badDebt + conc;
      const rubsInc = rubsAnnual * g;
      const otherInc = otherIncomeAnnualBase * g + rubsInc;
      const egr = netRental + otherInc;
      const opex = T12.opex * Math.pow(1 + A.expGrowth, y);
      const noi = egr + opex;
      const amFee = -egr * amFeePct;
      const cmFee = y === 1 ? -cmFeePct * totalRenoCost : 0;
      const capexSpend = y === 1 && capexMode === "cashflow" ? -totalRenoCost : 0;
      const capexRes = -A.capexReservePerUnit * dealUnits * g;
      const cfbds = noi + amFee + cmFee + capexSpend + capexRes;
      years.push({ y, gprY, physVac, badDebt, conc, netRental, otherInc, rubsInc, egr, opex, noi, amFee, cmFee, capexSpend, capexRes, cfbds, opexRatio: -opex / egr });
    }

    /* debt */
    const scen = CFG.scenarios[scenarioKey];
    const rate = rateOverride ?? (scenarioKey === "bridge" ? scen.rate : baseRate + spread);
    const loan = Math.round(ACQ.price * ltv);
    const acqFeeAmt = ACQ.price * acqFeePct;
    const capexAtClosing = capexMode === "closing" ? totalRenoCost : 0;
    const totalUses = ACQ.price + ACQ.closingCosts + acqFeeAmt + loan * loanFeesPct + capexAtClosing;
    const ltc = loan / totalUses;
    const equity = totalUses - loan;
    const ioPmtYr = loan * rate;
    const amortPmtYr = annuityPmt(loan, rate, amort) * 12;
    const dsYear = (y) => {
      const mStart = (y - 1) * 12, mEnd = y * 12;
      let ds = 0;
      for (let m = mStart; m < mEnd; m++) ds += m < ioMonths ? loan * rate / 12 : annuityPmt(loan, rate, amort);
      return ds;
    };
    const yr1DS = loan > 0 ? dsYear(1) : 0;
    const metrics = {
      dscr: loan > 0 ? years[0].noi / yr1DS : null,
      debtYield: loan > 0 ? years[0].noi / loan : null,
      loanConstant: loan > 0 ? (ioMonths >= 12 ? rate : amortPmtYr / loan) : null,
      yearlyPmt: loan > 0 ? (ioMonths >= 12 ? ioPmtYr : amortPmtYr) : 0,
    };

    /* exit */
    const salePrice = years[H].noi / exitCap; // forward NOI
    const costsOfSale = -salePrice * costsOfSalePct;
    const dispFee = -salePrice * dispFeePct;
    const payoff = loan > 0 ? balanceAfter(loan, rate, amort, ioMonths, H * 12) : 0;

    /* refinance event (enabled with the JV add-on): new value at cap -> refi loan -> retire bridge */
    const refiActive = (refiOn || jvOn) && refiYear >= 1 && refiYear < H && loan >= 0;
    const refiValue = refiActive ? years[refiYear].noi / exitCap : 0;
    const refiLoan = refiActive ? refiLTV * refiValue : 0;
    const refiFees = refiActive ? refiLoan * 0.01 : 0;
    const oldPayoffAtRefi = refiActive && loan > 0 ? balanceAfter(loan, rate, amort, ioMonths, refiYear * 12) : 0;
    const netRefi = refiActive ? refiLoan - oldPayoffAtRefi - refiFees : 0;
    const refiDSyr = refiActive ? annuityPmt(refiLoan, refiRate, 30) * 12 : 0;
    const refiPayoffAtExit = refiActive ? balanceAfter(refiLoan, refiRate, 30, 0, (H - refiYear) * 12) : 0;
    const dsYearEff = (y) => (refiActive && y > refiYear ? refiDSyr : loan > 0 ? dsYear(y) : 0);
    const exitPayoff = refiActive ? refiPayoffAtExit : payoff;

    /* levered & unlevered flows */
    const lev = [-equity];
    const unlev = [-totalUses];
    const rowsCF = [];
    for (let y = 1; y <= H; y++) {
      const ds = dsYearEff(y);
      let cf = years[y - 1].cfbds - ds;
      let ucf = years[y - 1].cfbds;
      if (refiActive && y === refiYear) cf += netRefi;
      if (y === H) {
        cf += salePrice + costsOfSale + dispFee - exitPayoff;
        ucf += salePrice + costsOfSale + dispFee;
      }
      lev.push(cf);
      unlev.push(ucf);
      rowsCF.push({ y, ds, cfads: years[y - 1].cfbds - ds });
    }
    const leveredIRR = irr(lev);
    const unleveredIRR = irr(unlev);
    const totalDist = lev.slice(1).reduce((a, b) => a + b, 0);
    const equityMultiple = totalDist / equity;
    const avgCoC = rowsCF.slice(0, H - 1).reduce((a, r) => a + r.cfads, 0) / Math.max(H - 1, 1) / equity;
    const goingInCap = years[0].noi / ACQ.price;

    /* waterfall */
    const WF = CFG.waterfall;
    const lpShare = 1 - gpPct;
    const lpEq = equity * lpShare, gpEq = equity * gpPct;
    let prefBal = 0, capBal = equity;
    const wfRows = lev.slice(1).map((cf, i) => {
      prefBal += capBal * WF.pref;
      const prefPaid = Math.max(Math.min(cf, prefBal), 0);
      prefBal -= prefPaid;
      let rem = Math.max(cf - prefPaid, 0);
      const roc = Math.min(rem, capBal);
      capBal -= roc; rem -= roc;
      const gpPromote = rem * WF.promote;
      const lpResid = rem - gpPromote;
      return { y: i + 1, cf, prefPaid, roc, lpResid, gpPromote };
    });

    /* GP economics: fees + pro-rata distributions + promote */
    const finFeeAmt = loan * loanFeesPct;
    const cmFeeAmt = cmFeePct * totalRenoCost;
    const amFeeYr = years.slice(0, H).map((y) => -y.amFee);
    const dispFeeAmt = -dispFee;
    const gpFeeTotal = acqFeeAmt + finFeeAmt + cmFeeAmt + amFeeYr.reduce((a, b) => a + b, 0) + dispFeeAmt;
    const proRata = (r) => r.prefPaid + r.roc + r.lpResid; // non-promote distributions, split pro-rata
    const gpCFexPromote = wfRows.reduce((s, r) => s + proRata(r) * gpPct, 0);
    const gpPromoteTotal = wfRows.reduce((s, r) => s + r.gpPromote, 0);
    const gpCompTotal = gpPromoteTotal + gpCFexPromote + gpFeeTotal;
    const gpFlows = [-gpEq + acqFeeAmt + finFeeAmt + cmFeeAmt];
    const lpFlows = [-lpEq];
    wfRows.forEach((r, i) => {
      let g = proRata(r) * gpPct + r.gpPromote + amFeeYr[i];
      if (i === H - 1) g += dispFeeAmt;
      gpFlows.push(g);
      lpFlows.push(proRata(r) * lpShare);
    });
    const gpIRR = irr(gpFlows), lpIRR = irr(lpFlows);
    const gpEM = gpEq > 0 ? gpFlows.slice(1).reduce((a, b) => a + b, 0) / gpEq : null;
    const lpEM = lpEq > 0 ? lpFlows.slice(1).reduce((a, b) => a + b, 0) / lpEq : null;

    /* JV equity partner: funds equity; pref paid current (shortfall accrues) or fully accrued; buyout at refi */
    const jvCap = jvOn ? Math.min(equity * jvContribPct, equity) : 0;
    const sponsorEq = equity - jvCap;
    const jvYears = [];
    let jvAccr = 0, jvDeferred = 0;
    let jvBuyoutPaid = 0, jvBuyoutOwed = 0;
    const B = refiActive ? refiYear : H;
    if (jvOn && jvCap > 0) {
      for (let y = 1; y <= H; y++) {
        if (y <= B) {
          const owed = (jvCap + jvAccr) * jvPrefRate;
          const cash = Math.max(rowsCF[y - 1].cfads, 0);
          const paid = jvMode === "current" ? Math.min(cash, owed) : 0;
          jvAccr += owed - paid;
          jvYears.push({ y, owed, paid, accrued: owed - paid, balance: jvCap + jvAccr });
        } else {
          jvYears.push({ y, owed: 0, paid: 0, accrued: 0, balance: 0 });
        }
      }
      jvBuyoutOwed = jvCap + jvAccr;
      const fundsAtB = B === H ? Infinity : Math.max(netRefi, 0) + Math.max(rowsCF[B - 1].cfads, 0);
      jvBuyoutPaid = Math.min(jvBuyoutOwed, fundsAtB);
      jvDeferred = jvBuyoutOwed - jvBuyoutPaid;
    }
    /* sponsor (client) and partner cash flow streams */
    const sponsorFlows = [-sponsorEq];
    const jvFlows = [-jvCap];
    lev.slice(1).forEach((cf, i) => {
      const y = i + 1;
      const jvOut = (jvYears[i] ? jvYears[i].paid : 0) + (y === B ? jvBuyoutPaid : 0) + (y === H ? jvDeferred : 0);
      sponsorFlows.push(cf - jvOut);
      jvFlows.push(jvOut);
    });
    const sponsorIRR = jvOn ? irr(sponsorFlows) : null;
    const sponsorEM = jvOn && sponsorEq > 0 ? sponsorFlows.slice(1).reduce((a, b) => a + b, 0) / sponsorEq : null;
    const jvIRR = jvOn && jvCap > 0 ? irr(jvFlows) : null;
    const jvEM = jvOn && jvCap > 0 ? jvFlows.slice(1).reduce((a, b) => a + b, 0) / jvCap : null;

    /* amortization schedule (monthly, full loan term) */
    const termMonths = CFG.scenarios[scenarioKey].term * 12;
    const amort_r = rate / 12, amortPmtM = annuityPmt(loan, rate, amort);
    const amSchedule = [];
    if (loan > 0) {
      let bal = loan;
      const [cm_, cd_, cy_] = CFG.acq.closingDate.split("/").map((x) => parseInt(x, 10));
      for (let m = 1; m <= termMonths; m++) {
        const io = m <= ioMonths;
        const interest = bal * amort_r;
        const pmt = io ? interest : amortPmtM;
        const principal = io ? 0 : pmt - interest;
        const begin = bal;
        bal = bal - principal;
        const mm = (cm_ - 1 + m) % 12, yy = 2000 + cy_ + Math.floor((cm_ - 1 + m) / 12);
        amSchedule.push({ n: m, io, date: `${MONTH_NAMES[mm]} ${cd_}, ${yy}`, begin, interest, principal, pmt, end: bal });
      }
    }
    const balloon = amSchedule.length ? amSchedule[amSchedule.length - 1].end : 0;
    const dsByYear = Array.from({ length: H }, (_, i) => dsYearEff(i + 1));

    /* simple value-add: 60-month current / target / blended */
    const simpleTrend = Array.from({ length: 60 }, (_, mi) => {
      const m = mi + 1;
      const grow = Math.pow(1 + growth, mi / 12);
      const cur = gprMonthly * grow;
      const tgt = (gprMonthly + renoCount * renoPremium) * grow;
      const span = Math.max(scheduleEnd - scheduleStart + 1, 1);
      const frac = Math.max(0, Math.min((m - scheduleStart + 1) / span, 1));
      return { m, cur: Math.round(cur), tgt: Math.round(tgt), blend: Math.round(cur + frac * (tgt - cur)) };
    });

    /* value-add monthly matrix (12 mo) */
    const matrix = units.slice(0, 40).map((u) => {
      const isReno = selectedRenoIds.has(u.id);
      const start = isReno ? renoStart(u) : 0;
      const ret = isReno ? renoReturn(u) : 0;
      const cells = Array.from({ length: 12 }, (_, mi) => {
        const m = mi + 1;
        const grow = Math.pow(1.0025, mi);
        if (isReno && m >= start && m < ret) return { v: 0, s: "reno" };
        if (isReno && m >= ret) return { v: Math.round((u.rent + renoPremium) * grow), s: "prem" };
        if (u.vacant && !isReno) {
          // Impute Vacant ON: assume the unit re-leases at market rent after a 2-mo lease-up.
          // Impute Vacant OFF: show it as producing $0 all year (no lease-up assumed).
          if (!imputeVacant) return { v: 0, s: "reno" };
          if (m <= 2) return { v: 0, s: "reno" };
        }
        return { v: Math.round(u.rent * grow), s: "inplace" };
      });
      return { u, cells, start, ret };
    });
    const matrixTotals = Array.from({ length: 12 }, (_, mi) => {
      let tot = 0, full = 0;
      units.forEach((u) => {
        const isReno = selectedRenoIds.has(u.id);
        const start = isReno ? renoStart(u) : 0;
        const ret = isReno ? renoReturn(u) : 0;
        const grow = Math.pow(1.0025, mi);
        const m = mi + 1;
        const fullRent = Math.round((u.rent + (isReno ? renoPremium : 0)) * grow);
        full += fullRent;
        if (isReno && m >= start && m < ret) tot += 0;
        else if (isReno && m >= ret) tot += fullRent;
        else if (u.vacant && !isReno && (!imputeVacant || m <= 2)) tot += 0;
        else tot += Math.round(u.rent * grow);
      });
      return { tot, full, loss: tot - full };
    });

    /* reno spend distribution */
    const wSum = sum(distWeights) || 1;
    const spend = distWeights.map((w) => (w / wSum) * totalRenoCost);

    /* lease expirations */
    const expByMonth = Array.from({ length: 12 }, () => 0);
    units.forEach((u) => { if (!u.vacant) expByMonth[u.expMonthIdx]++; });
    const exp12 = sum(expByMonth.slice(0, 8));
    const tenure = units.filter((u) => !u.vacant);
    const avgTenure = tenure.reduce((a, u) => a + u.tenureYears, 0) / tenure.length;
    const over3 = tenure.filter((u) => u.tenureYears > 3).length / tenure.length;

    /* sensitivity IRR matrix */
    const caps = [0.05, 0.0525, 0.055, 0.0575, 0.06];
    const grs = [0.02, 0.025, 0.03, 0.035, 0.04];
    const sens = caps.map((c) =>
      grs.map((g) => {
        const n1 = years[0].noi;
        const flows = [-equity];
        for (let y = 1; y <= H; y++) {
          const noiY = n1 * Math.pow(1 + g, y - 1);
          const cfb = noiY + years[y - 1].amFee + years[y - 1].capexRes;
          const ds = loan > 0 ? dsYear(y) : 0;
          let cf = cfb - ds;
          if (y === H) {
            const sp = (n1 * Math.pow(1 + g, H)) / c;
            cf += sp * (1 - costsOfSalePct - dispFeePct) - (loan > 0 ? balanceAfter(loan, rate, amort, ioMonths, H * 12) : 0);
          }
          flows.push(cf);
        }
        return irr(flows);
      })
    );

    return {
      purchasePrice: ACQ.price,
      units, t12, T12, years, loan, ltc, equity, totalUses, rate, metrics, salePrice, costsOfSale,
      dispFee, payoff, lev, unlev, leveredIRR, unleveredIRR, equityMultiple, avgCoC, goingInCap,
      rowsCF, wfRows, lpEq, gpEq, matrix, matrixTotals, spend, gprMonthly, inPlaceMonthly, occupied,
      renoUnits, renoPool, renoCount, totalRenoCost, totalPremiumYr, expByMonth, exp12, avgTenure, over3,
      caps, grs, sens, renoStart, renoReturn,
      rubsRows, rubsActive, rubsAnnual, rubsValueImpact, rubsPerUnitMo, utilAnnual,
      rentTrend, mtmPct,
      schedule, downUnits, ganttMonths, lpShare,
      acqFeeAmt, finFeeAmt, cmFeeAmt, amFeeYr, dispFeeAmt, gpFeeTotal,
      gpCFexPromote, gpPromoteTotal, gpCompTotal, gpIRR, lpIRR, gpEM, lpEM,
      amSchedule, balloon, termMonths, dsByYear, amortPmtM, simpleTrend, capexAtClosing,
      refiActive, refiValue, refiLoan, refiFees, oldPayoffAtRefi, netRefi, refiDSyr, exitPayoff,
      jvCap, sponsorEq, jvYears, jvBuyoutOwed, jvBuyoutPaid, jvDeferred, jvBuyoutYear: B,
      sponsorIRR, sponsorEM, jvIRR, jvEM, jvOn,
      dealUnits, vacantCount, isRealDeal: useRealUnits,
    };
  }, [state, real]);
}

/* ================================================================
   EXCEL EXPORT — live-formula workbook (opens in Excel & Google Sheets)
   ================================================================ */
function exportWorkbook(M, S) {
  const wb = XLSX.utils.book_new();
  const H = CFG.acq.holdYears;
  const F = (f) => ({ t: "n", f });
  const P = (n) => ({ t: "n", v: n, z: "0.00%" });
  const D = (n) => ({ t: "n", v: Math.round(n), z: "#,##0" });

  /* INPUTS — the single source every other sheet references */
  const inputs = [
    ["DEAL SNIPER — MODEL INPUTS", null],
    ["Purchase Price", D(M.purchasePrice)],
    ["LTV", P(S.ltv)],
    ["Interest Rate", P(M.rate)],
    ["Amortization (yrs)", S.amort],
    ["IO Period (months)", S.ioMonths],
    ["Exit Cap Rate", P(S.exitCap)],
    ["Rent Growth", P(S.growth)],
    ["Stabilized Vacancy", P(CFG.assumptions.stabVacancy)],
    ["Year 1 Vacancy", P(CFG.assumptions.y1Vacancy)],
    ["Bad Debt %", P(CFG.assumptions.badDebtPct)],
    ["Concessions %", P(CFG.assumptions.concessionsPct)],
    ["Other Income (annual)", D(CFG.assumptions.otherIncomeT12)],
    ["Total Units", M.dealUnits],
    ["Hold Period (yrs)", H],
    ["Closing Costs", D(CFG.acq.closingCosts)],
    ["Acquisition Fee %", P(S.acqFeePct)],
    ["Costs of Sale %", P(S.costsOfSalePct)],
    ["Disposition Fee %", P(S.dispFeePct)],
    ["Loan Fees %", P(S.loanFeesPct)],
    ["Reno Premium ($/unit/mo)", D(S.renoPremium)],
    ["Units Renovated", M.renoCount],
    ["Reno Cost per Unit", D(S.renoCost)],
    ["In-Place GPR (monthly)", D(M.gprMonthly)],
    ["T-12 OpEx (annual)", D(M.T12.opex)],
    ["CapEx Reserve ($/unit/yr)", D(CFG.assumptions.capexReservePerUnit)],
    ["Asset Mgmt Fee %", P(S.amFeePct)],
    ["Loan Amount", F("B2*B3")],
    ["Annual IO Payment", F("B28*B4")],
    ["Monthly Amortizing Pmt", F("-PMT(B4/12,B5*12,B28)")],
  ];
  const shI = XLSX.utils.aoa_to_sheet(inputs);
  shI["!cols"] = [{ wch: 26 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, shI, "Inputs");

  /* SOURCES & USES — pure formulas off Inputs */
  const su = [
    ["SOURCES & USES", null, null],
    ["Sources", "Amount", "%"],
    ["Equity", F("B8-Inputs!B28"), F("B3/B5")],
    ["Debt", F("Inputs!B28"), F("B4/B5")],
    ["Total Sources", F("B3+B4"), F("B5/B8")],
    [],
    ["Uses", "Amount", "%"],
    ["Total Uses", F("Inputs!B2+Inputs!B16+Inputs!B2*Inputs!B17+Inputs!B28*Inputs!B20" + (S.capexMode === "closing" ? "+Inputs!B22*Inputs!B23" : "")), 1],
    ["  Purchase Price", F("Inputs!B2"), F("B9/B8")],
    ["  Closing Costs", F("Inputs!B16"), F("B10/B8")],
    ["  Acquisition Fee", F("Inputs!B2*Inputs!B17"), F("B11/B8")],
    ["  Loan Fees", F("Inputs!B28*Inputs!B20"), F("B12/B8")],
    ["  CapEx" + (S.capexMode === "closing" ? " (at closing)" : " (from cashflow)"), S.capexMode === "closing" ? F("Inputs!B22*Inputs!B23") : 0, null],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(su), "Sources & Uses");

  /* RENT ROLL — all units, SUM/COUNT formulas */
  const rrHead = ["Unit", "Tenant", "Type", "SF", "Status", "In-Place Rent", "Lease Start", "Lease Expiration"];
  const rrRows = M.units.map((u) => [u.unit, u.tenant, u.type, u.sf, u.vacant ? "Vacant" : "Occupied", D(u.rent), u.leaseStart, u.leaseExp]);
  const n = M.units.length;
  const rr = [rrHead, ...rrRows,
    ["Totals", null, null, F(`SUM(D2:D${n + 1})`), F(`COUNTIF(E2:E${n + 1},"Occupied")`), F(`SUM(F2:F${n + 1})`), null, null],
    ["Avg Rent", null, null, null, null, F(`AVERAGE(F2:F${n + 1})`), null, null],
    ["Occupancy", null, null, null, null, F(`COUNTIF(E2:E${n + 1},"Occupied")/${n}`), null, null]];
  const shRR = XLSX.utils.aoa_to_sheet(rr);
  shRR["!cols"] = rrHead.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, shRR, "Rent Roll");

  /* T-12 — monthly values, annual & totals as formulas */
  const t = M.t12;
  const t12Rows = [["T-12", ...MONTH_NAMES, "Annual"]];
  const addT = (label, arr) => t12Rows.push([label, ...arr.map((v) => D(v)), F(`SUM(B${t12Rows.length + 1}:M${t12Rows.length + 1})`)]);
  addT("Gross Potential Rental", t.gpr); addT("Physical Vacancy", t.physVac); addT("Bad Debt", t.badDebt);
  addT("Concessions", t.concessions); addT("Other Loss", t.otherLoss); addT("Other Income", t.otherIncome);
  const egrRow = t12Rows.length + 1;
  t12Rows.push(["Effective Gross Revenue", ...MONTH_NAMES.map((_, i) => F(`SUM(${XLSX.utils.encode_col(i + 1)}2:${XLSX.utils.encode_col(i + 1)}7)`)), F(`SUM(B${egrRow}:M${egrRow})`)]);
  const expKeys = [["Payroll", t.payroll], ["Utilities", t.utilities], ["Repairs & Maintenance", t.rm], ["Insurance", t.insurance], ["Real Estate Taxes", t.reTax], ["Property Management", t.propMgmt], ["Marketing", t.marketing], ["Administrative", t.admin], ["Contract Services", t.contract], ["Turnover Costs", t.turnover]];
  expKeys.forEach(([l, a]) => addT(l, a));
  const opexRow = t12Rows.length + 1;
  t12Rows.push(["Total Operating Expenses", ...MONTH_NAMES.map((_, i) => F(`SUM(${XLSX.utils.encode_col(i + 1)}9:${XLSX.utils.encode_col(i + 1)}${opexRow - 1})`)), F(`SUM(B${opexRow}:M${opexRow})`)]);
  t12Rows.push(["Net Operating Income", ...MONTH_NAMES.map((_, i) => F(`${XLSX.utils.encode_col(i + 1)}${egrRow}+${XLSX.utils.encode_col(i + 1)}${opexRow}`)), F(`N${egrRow}+N${opexRow}`)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t12Rows), "T-12");

  /* PRO FORMA CASHFLOW — growth-chained formulas + IRR */
  const yc = (i) => XLSX.utils.encode_col(i + 1); // B.. for year 1..H
  const cf = [["PRO FORMA", ...Array.from({ length: H }, (_, i) => `Year ${i + 1}`)]];
  cf.push(["GPR", F("(Inputs!B24+Inputs!B22*Inputs!B21)*12"), ...Array.from({ length: H - 1 }, (_, i) => F(`${yc(i)}2*(1+Inputs!B8)`))]);
  cf.push(["Vacancy", F("-B2*Inputs!B10"), ...Array.from({ length: H - 1 }, (_, i) => F(`-${yc(i + 1)}2*Inputs!B9`))]);
  cf.push(["Bad Debt & Concessions", ...Array.from({ length: H }, (_, i) => F(`-${yc(i)}2*(Inputs!B11+Inputs!B12)`))]);
  cf.push(["Other Income", F("Inputs!B13"), ...Array.from({ length: H - 1 }, (_, i) => F(`${yc(i)}5*(1+Inputs!B8)`))]);
  cf.push(["EGR", ...Array.from({ length: H }, (_, i) => F(`SUM(${yc(i)}2:${yc(i)}5)`))]);
  cf.push(["OpEx", F("Inputs!B25*(1+Inputs!B8)"), ...Array.from({ length: H - 1 }, (_, i) => F(`${yc(i)}7*(1+Inputs!B8)`))]);
  cf.push(["NOI", ...Array.from({ length: H }, (_, i) => F(`${yc(i)}6+${yc(i)}7`))]);
  cf.push(["Asset Mgmt Fee", ...Array.from({ length: H }, (_, i) => F(`-${yc(i)}6*Inputs!B27`))]);
  cf.push(["CapEx Reserves", ...Array.from({ length: H }, (_, i) => F(`-Inputs!B26*Inputs!B14*(1+Inputs!B8)^${i}`))]);
  cf.push(["Debt Service", ...Array.from({ length: H }, (_, i) => D(-M.dsByYear[i]))]);
  cf.push(["Sale Price (Yr " + H + ")", ...Array.from({ length: H }, (_, i) => (i === H - 1 ? F(`${yc(i)}8/Inputs!B7`) : 0))]);
  cf.push(["Costs of Sale + Disp Fee", ...Array.from({ length: H }, (_, i) => (i === H - 1 ? F(`-${yc(i)}12*(Inputs!B18+Inputs!B19)`) : 0))]);
  cf.push(["Loan Payoff", ...Array.from({ length: H }, (_, i) => (i === H - 1 ? D(-M.exitPayoff) : 0))]);
  cf.push(["Net Levered Cash Flow", ...Array.from({ length: H }, (_, i) => F(`SUM(${yc(i)}8:${yc(i)}14)`))]);
  cf.push([]);
  cf.push(["Equity (Yr 0 outflow)", F("-('Sources & Uses'!B3)")]);
  cf.push(["IRR", F(`IRR((B17,B15:${yc(H - 1)}15))`)]);
  cf.push(["Equity Multiple", F(`SUM(B15:${yc(H - 1)}15)/-B17`)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cf), "Cashflow");

  /* AMORTIZATION — fully formula-driven off Inputs */
  const am = [["#", "IO?", "Beginning Balance", "Interest", "Principal", "Payment", "Ending Balance"]];
  for (let m = 1; m <= M.termMonths; m++) {
    const r = m + 1;
    am.push([m, F(`IF(A${r}<=Inputs!B6,"IO","")`),
      m === 1 ? F("Inputs!B28") : F(`G${r - 1}`),
      F(`C${r}*Inputs!B4/12`),
      F(`IF(A${r}<=Inputs!B6,0,Inputs!B30-D${r})`),
      F(`D${r}+E${r}`),
      F(`C${r}-E${r}`)]);
  }
  am.push(["Balloon", null, null, null, null, null, F(`G${M.termMonths + 1}`)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(am), "Amortization");

  /* WATERFALL / JV — values with key formulas */
  const wf = [["EQUITY WATERFALL", "", "", "", "", ""],
    ["Year", "Distributable CF", "Pref (8%)", "Return of Capital", "Residual", "GP Promote"],
    ...M.wfRows.map((r) => [`Year ${r.y}`, D(r.cf), D(r.prefPaid), D(r.roc), D(r.lpResid), D(r.gpPromote)])];
  if (M.jvOn) {
    wf.push([], ["JOINT VENTURE", "", "", "", "", ""],
      ["JV Capital", D(M.jvCap)], ["Pref Rate", P(S.jvPrefRate)], ["Buyout Year", M.jvBuyoutYear],
      ["Buyout Owed", D(M.jvBuyoutOwed)], ["Paid at Refi", D(M.jvBuyoutPaid)], ["Deferred to Sale", D(M.jvDeferred)],
      ["Refi Value", D(M.refiValue)], ["Refi Loan", D(M.refiLoan)], ["Net Refi Proceeds", D(M.netRefi)],
      ["Partner IRR", M.jvIRR === null ? "—" : P(M.jvIRR)], ["Sponsor IRR", M.sponsorIRR === null ? "—" : M.sponsorEq <= 0 ? "n/a ($0 in)" : P(M.sponsorIRR)]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wf), "Waterfall");

  XLSX.writeFile(wb, `DealSniper_${CFG.deal.name.replace(/[^A-Za-z0-9]+/g, "_")}.xlsx`);
}

/* ================================================================
   UI PRIMITIVES
   ================================================================ */
const GRAD = "bg-gradient-to-r from-emerald-400 to-cyan-500";
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>{children}</div>
);
const GradPill = ({ children, className = "" }) => (
  <span className={`inline-flex items-center gap-2 ${GRAD} text-white text-xs font-bold tracking-wide px-4 py-2 rounded-lg uppercase ${className}`}>{children}</span>
);
const GradBanner = ({ children, className = "", gradient = GRAD }) => (
  <div className={`${gradient} text-white rounded-xl px-5 py-3 flex items-center justify-between ${className}`}>{children}</div>
);
const Ghost = ({ children, onClick, className = "", active }) => (
  <button onClick={onClick} className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition ${active ? `${GRAD} text-white border-transparent` : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"} ${className}`}>{children}</button>
);
const Primary = ({ children, onClick, className = "", disabled = false }) => (
  <button onClick={onClick} disabled={disabled} className={`${GRAD} text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}>{children}</button>
);
const Toggle = ({ on, onChange, green = true }) => (
  <button onClick={() => onChange(!on)} className={`w-11 h-6 rounded-full p-0.5 transition ${on ? (green ? "bg-emerald-400" : "bg-white/40") : "bg-white/30"}`}>
    <div className={`w-5 h-5 bg-white rounded-full shadow transition ${on ? "translate-x-5" : ""}`} />
  </button>
);
const StatCard = ({ label, value, sub, valueClass = "" }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[130px]">
    <div className="text-xs text-gray-500 font-medium">{label}</div>
    <div className={`text-xl font-bold text-gray-900 ${valueClass}`}>{value}</div>
    {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
  </div>
);
const Pill = ({ children, tone = "gray" }) => {
  const t = {
    gray: "bg-gray-100 text-gray-600", green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-600", purple: "bg-emerald-100 text-emerald-700",
    purpleSolid: "bg-emerald-500 text-white", yellow: "bg-amber-100 text-amber-700",
    orange: "bg-orange-100 text-orange-700", outline: "border border-gray-300 text-gray-600",
  }[tone];
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${t}`}>{children}</span>;
};
const Seg = ({ options, value, onChange, light }) => (
  <div className={`flex rounded-lg p-0.5 ${light ? "bg-gray-100" : "bg-white/20"}`}>
    {options.map((o) => (
      <button key={o} onClick={() => onChange(o)} className={`px-3 py-1 text-xs font-semibold rounded-md transition ${value === o ? (light ? "bg-white shadow text-gray-800" : "bg-white text-emerald-700") : (light ? "text-gray-500" : "text-white/80")}`}>{o}</button>
    ))}
  </div>
);
const Field = ({ icon, label, children, note }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
    <div className="flex items-center gap-2 text-sm text-gray-600"><span className="text-gray-400">{icon}</span>{label}</div>
    <div className="flex flex-col items-end">{children}{note && <span className="text-[11px] text-gray-400 mt-1">{note}</span>}</div>
  </div>
);
const SnapRow = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between gap-2">
    <span className={`text-[13px] ${highlight ? "text-gray-600 font-medium" : "text-gray-500"}`}>{label}</span>
    <span className={`font-semibold text-[13px] text-right ${highlight ? "text-emerald-600" : "text-gray-800"}`}>{value}</span>
  </div>
);
const INCOME_METHOD_LABELS = {
  stabilized: "Stabilized",
  simple: "Value-Add (Simple)",
  advanced: "Value-Add (Advanced)",
  rubs: "Value-Add (RUBS / Utility Bill-Back)",
};
// Controlled numeric/text field whose displayed `value` prop is usually a
// FORMATTED string derived from global state (commas, fixed decimals, %
// rounding, etc. — see `fm()`). If we echoed that formatted value straight
// back into the input on every keystroke, typing anything beyond a single
// whole-number digit breaks: decimals get rounded away mid-type, commas get
// inserted mid-type, and the caret can't keep up — effectively "nothing
// works". Fix: keep a local, unformatted edit buffer while the field is
// focused, and only resync to the (reformatted) upstream value on blur.
const Input = ({ value, onChange, suffix, w = "w-36", readOnly }) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  return (
    <div className={`flex items-center border rounded-lg overflow-hidden ${readOnly ? "bg-gray-100 border-gray-200" : "bg-white border-gray-300"} ${w}`}>
      <input
        value={focused ? draft : value}
        readOnly={readOnly}
        onFocus={(e) => { setFocused(true); setDraft(value); e.target.select(); }}
        onChange={(e) => { setDraft(e.target.value); onChange && onChange(e.target.value); }}
        onBlur={() => setFocused(false)}
        className="px-3 py-1.5 text-sm w-full outline-none bg-transparent text-right"
      />
      {suffix && <span className="px-2 text-xs text-gray-400">{suffix}</span>}
    </div>
  );
};
const SubHead = ({ children }) => (
  <div className="text-emerald-600 text-xs font-bold tracking-wide uppercase pt-4 pb-1 border-b border-gray-100 flex items-center gap-1.5">{children}</div>
);
const Mono = ({ v, red, green, bold }) => (
  <span className={`text-[13px] ${bold ? "font-bold" : ""} ${red || v < 0 ? "text-red-500" : green ? "text-emerald-600" : "text-gray-700"}`}>{typeof v === "number" ? $f(v) : v}</span>
);

/* small inline svg icons */
const I = {
  doc: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
  target: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>,
  dollar: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  chart: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-7"/></svg>,
  card: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  cash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>,
  wrench: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6l-3 3-3-3z"/></svg>,
  pctI: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  trend: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
  bldg: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1"/></svg>,
  folder: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  mail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>,
  spark: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>,
  dl: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  warn: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3A19.5 19.5 0 0 1 5.2 13 19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>,
  undo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  share: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>,
  dash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  cal: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  sliders: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
  people: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  home: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  pin: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  tag: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  layers: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 2 10 6-10 6L2 8z"/><path d="m2 14 10 6 10-6"/></svg>,
  hash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>,
  ruler: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4zM7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2"/></svg>,
  map: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m1 6 7-3 8 3 7-3v15l-7 3-8-3-7 3z"/><path d="M8 3v15M16 6v15"/></svg>,
  car: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 11 6.5 6.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a2 2 0 0 1 2 2v4h-2m-14-6a2 2 0 0 0-2 2v4h2m0 0a2 2 0 1 0 4 0m-4 0h4m6 0a2 2 0 1 0 4 0m-4 0h4"/></svg>,
  person: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  bank: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-6 9 6M4 9v11m16-11v11M2 20h20M8 12v5M12 12v5M16 12v5"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  sheet: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
  presentation: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  rocket: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
};

/* ================================================================
   UPLOAD / ENTRY PAGE
   ================================================================ */
function detectDocType(name) {
  const n = name.toLowerCase();
  if (/t-?12|trailing|operating/.test(n)) return ["T-12", "yellow"];
  if (/rent\s?roll|rentroll|rr[_\-]/.test(n)) return ["Rent Roll", "green"];
  if (/om|offering|memorandum/.test(n)) return ["Offering Memo", "purple"];
  if (/capex|budget/.test(n)) return ["CapEx", "orange"];
  return ["Document", "gray"];
}
function UploadPage({ onEnter, files, setFiles }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const addFiles = (fileList) => {
    const incoming = Array.from(fileList).slice(0, 10 - files.length).map((f, i) => {
      const [type, tone] = detectDocType(f.name);
      return { id: Date.now() + i, name: f.name, size: f.size, type, tone, status: "parsing", pct: 0 };
    });
    if (!incoming.length) return;
    setFiles((p) => [...p, ...incoming]);
    incoming.forEach((f) => {
      const iv = setInterval(() => {
        setFiles((p) => p.map((x) => {
          if (x.id !== f.id) return x;
          const pct = Math.min(x.pct + 12 + Math.random() * 18, 100);
          return { ...x, pct, status: pct >= 100 ? "parsed" : "parsing" };
        }));
      }, 220);
      setTimeout(() => clearInterval(iv), 3500);
    });
  };
  const ready = files.some((f) => f.status === "parsed");
  const fmtSize = (b) => (b > 1048576 ? `${fm(b / 1048576, 1)} MB` : `${fm(Math.max(b / 1024, 1), 0)} KB`);
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-1 font-bold text-lg text-slate-800">
          Deal<span className="border-2 border-emerald-500 text-emerald-600 rounded-md px-1.5 text-sm ml-0.5">Sniper</span>
        </div>
        <Ghost>{I.home} Home</Ghost>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Upload & Parse Documents</h1>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Drag & drop your T-12, Rent Roll, and OM files to automatically extract data</span>
            <Pill tone="green">AI-Powered</Pill>
          </div>
        </div>

        <Card className="p-6 mb-8 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-150">
          <div className="flex items-start gap-4">
            <span className={`w-10 h-10 rounded-lg ${GRAD} text-white flex items-center justify-center shrink-0 text-lg`}>{I.spark}</span>
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-base">Get Started with Your Deal</div>
              <div className="text-sm text-gray-600 mt-1">Upload your deal documents below to unlock the full underwriting experience. Our AI will automatically extract key data from your files.</div>
              <div className="flex gap-6 mt-3 text-sm font-medium flex-wrap">
                <span className="flex items-center gap-2 text-emerald-700">
                  <span className="text-emerald-500">→</span> T-12 <span className="font-normal text-gray-500">for income & expenses</span>
                </span>
                <span className="flex items-center gap-2 text-emerald-700">
                  <span className="text-emerald-500">→</span> Rent Roll <span className="font-normal text-gray-500">for unit details</span>
                </span>
                <span className="flex items-center gap-2 text-emerald-700">
                  <span className="text-emerald-500">→</span> OM <span className="font-normal text-gray-500">for property info</span>
                </span>
              </div>
            </div>
          </div>
        </Card>

        <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current && inputRef.current.click()}
          className={`rounded-3xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-20 px-8 text-center ${drag ? "border-emerald-400 bg-emerald-50/80 scale-[1.01] shadow-md" : "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300 hover:bg-emerald-50/50"}`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all ${drag ? "bg-emerald-500 text-white scale-110" : "bg-white text-emerald-500 border-2 border-emerald-100 shadow-sm"}`}>
            {I.dl}
          </div>
          <div className="font-bold text-gray-900 text-xl mb-2">Drag & drop your documents here</div>
          <div className="text-sm text-gray-500 mb-3">or click to browse and select multiple files</div>
          <div className="text-xs text-gray-400">Supported: PDF, Excel (.xlsx/.xls), Word, CSV · Up to 10 files · Max 50MB each</div>
          <div className="text-xs font-semibold text-emerald-600 mt-2">✦ Document type detected automatically</div>
        </div>

        {files.length > 0 && (
          <Card className="mt-8 p-5 bg-white border border-gray-150">
            <div className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-emerald-600">{I.doc}</span>
              Documents ({files.length}/10)
            </div>
            <div className="flex flex-col gap-3">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 hover:border-emerald-100 transition-colors">
                  <span className="text-gray-400 text-lg">{I.doc}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800 truncate">{f.name}</span>
                      <Pill tone={f.tone}>{f.type}</Pill>
                    </div>
                    {f.status === "parsing" ? (
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${GRAD} rounded-full transition-all`} style={{ width: `${f.pct}%` }} />
                      </div>
                    ) : (
                      <div className="text-[12px] text-emerald-600 font-semibold flex items-center gap-1">{I.check} Parsed · key fields extracted</div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                  <button onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((x) => x.id !== f.id)); }} className="text-gray-300 hover:text-red-400 hover:bg-red-50 p-1 rounded transition-colors">{I.x}</button>
                </div>
              ))}
            </div>
            <Primary onClick={onEnter} className={`w-full mt-6 py-3 text-base font-semibold ${ready ? "" : "opacity-40 pointer-events-none"}`}>
              Continue to Underwriting {I.arrow}
            </Primary>
          </Card>
        )}

        <div className="flex items-center gap-4 my-8"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs font-bold text-gray-400">OR</span><div className="flex-1 h-px bg-gray-200" /></div>
        
        <div className="flex justify-center">
          <Primary onClick={onEnter} className="px-8 py-3 flex items-center gap-2 text-base">{I.doc} Enter Manually</Primary>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   CHROME
   ================================================================ */
function TopBar({
  onExportPDF, onExportToSheets, onExportToExcel, onGeneratePitchDeck, onGenerateBusinessPlan, onPushToPipeline,
  isSheetsExporting, isExcelExporting, isExportingPDF, isPushingToPipeline,
  sheetsExportStatus, isInPipeline, pipelineSuccess, onGoHome, dealName, dealUnits,
}) {
  const navigate = useNavigate();
  const shareLink = () => {
    const url = window.location.href;
    const copy = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(url)
      : Promise.reject();
    copy.then(() => alert("Deal link copied to clipboard")).catch(() => alert(url));
  };
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-2 shrink-0 z-30 overflow-x-auto">
      <div className="flex items-center gap-1 font-bold text-lg text-slate-800 shrink-0">
        Deal<span className="border-2 border-emerald-500 text-emerald-600 rounded-md px-1.5 text-sm ml-0.5">Sniper</span>
      </div>
      <Ghost onClick={() => navigate("/dashboard")}>{I.dash} Dashboard</Ghost>
      <Ghost onClick={shareLink}>{I.share} Share</Ghost>
      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
        <div className="text-center leading-tight min-w-0">
          <div className="font-semibold text-gray-800 text-sm truncate">{dealName || CFG.deal.name}</div>
          <div className="text-[11px] text-gray-400">{dealUnits || CFG.deal.units} Units</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Ghost onClick={onExportPDF} className={isExportingPDF ? "opacity-50 pointer-events-none" : ""}>
          {I.dl} {isExportingPDF ? "Exporting…" : "PDF"}
        </Ghost>
        <Ghost onClick={onExportToSheets} className={isSheetsExporting ? "opacity-50 pointer-events-none" : ""}>
          {I.sheet} {isSheetsExporting ? "Sending…" : sheetsExportStatus === "success" ? "Sent ✓" : sheetsExportStatus === "error" ? "Failed" : "Sheets"}
        </Ghost>
        <Ghost onClick={onExportToExcel} className={isExcelExporting ? "opacity-50 pointer-events-none" : ""}>
          {I.dl} {isExcelExporting ? "Generating…" : "Excel"}
        </Ghost>
        <Ghost onClick={onGeneratePitchDeck} className={isExportingPDF ? "opacity-50 pointer-events-none" : ""}>
          {I.presentation} Pitch Deck
        </Ghost>
        {onGenerateBusinessPlan && (
          <Ghost onClick={onGenerateBusinessPlan}>
            {I.doc} Business Plan
          </Ghost>
        )}
        <button onClick={onPushToPipeline} disabled={isPushingToPipeline}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition whitespace-nowrap ${pipelineSuccess ? "bg-emerald-500 text-white" : isPushingToPipeline ? "bg-gray-300 text-white cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
          {I.rocket} {pipelineSuccess ? "In Pipeline" : isPushingToPipeline ? "Pushing…" : isInPipeline ? "Update Pipeline" : "Push to Pipeline"}
        </button>
        {onGoHome && (
          <button onClick={onGoHome} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-500 text-white hover:opacity-90 transition whitespace-nowrap">
            ＋ New Deal
          </button>
        )}
      </div>
      <Ghost onClick={() => alert("Undo — coming soon!")}>{I.undo} Undo</Ghost>
      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-semibold flex items-center justify-center text-sm shrink-0">J</div>
    </div>
  );
}

function IconRail({ mode, setMode }) {
  const icons = [
    { k: "underwrite", i: I.chart }, { k: "docs", i: I.folder },
    { k: "a", i: I.card }, { k: "b", i: I.doc }, { k: "c", i: I.mail },
    { k: "d", i: I.cal }, { k: "e", i: I.people }, { k: "f", i: I.trend },
  ];
  return (
    <div className="w-14 bg-white border-r border-gray-100 flex flex-col items-center pt-4 gap-3 shrink-0">
      {icons.map((ic) => {
        const active = mode === ic.k;
        return (
          <button key={ic.k} onClick={() => (ic.k === "docs" || ic.k === "underwrite") && setMode(ic.k)}
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition ${active ? `${GRAD} text-white shadow` : "text-gray-400 hover:bg-gray-50"}`}>
            {ic.i}
            {active && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-400 rounded-full border border-white" />}
          </button>
        );
      })}
    </div>
  );
}

const NAV = [
  { k: "summary", l: "Summary", i: I.doc },
  { k: "strategy", l: "Strategy", i: I.target },
  { k: "income", l: "Income", i: I.dollar },
  { k: "rentroll", l: "Rent Roll", i: I.doc },
  { k: "t12", l: "T-12", i: I.chart },
  { k: "expenses", l: "Expenses", i: I.card },
  { k: "cashflow", l: "Cashflow", i: I.cash, expandable: true },
  { k: "renovations", l: "Renovations", i: I.wrench },
  { k: "waterfall", l: "Waterfall", i: I.chart },
  { k: "financing", l: "Financing", i: I.pctI },
  { k: "returns", l: "Returns", i: I.trend },
  { k: "comps", l: "Comps", i: I.bldg },
  { k: "model", l: "Model", i: I.grid },
  { k: "montecarlo", l: "Monte Carlo", i: I.warn },
];
function Sidebar({ tab, setTab, cfView, setCfView, mode, setMode, onExport, docsSubView, setDocsSubView }) {
  if (mode === "docs") {
    const items = [
      { k: "overview", l: "Overview", ic: I.grid },
      { k: "upload", l: "Upload & Parse Files", ic: I.dl },
      { k: "create", l: "Create Documents", ic: I.doc, soon: true },
      { k: "parsed", l: "Parsed Data", ic: I.layers },
    ];
    return (
      <div className="w-56 bg-white border-r border-gray-100 py-4 px-3 flex flex-col gap-1 shrink-0">
        {items.map((it) => {
          const active = docsSubView === it.k;
          return (
            <button key={it.k} onClick={() => setDocsSubView(it.k)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left ${active ? `${GRAD} text-white shadow` : "text-gray-600 hover:bg-gray-50"}`}>
              <span className={active ? "text-white" : "text-gray-400"}>{it.ic}</span>{it.l}
              {it.soon && <span className={`ml-auto text-[9px] font-semibold italic ${active ? "text-white/80" : "text-gray-400"}`}>soon</span>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="w-56 bg-white border-r border-gray-100 py-3 px-3 flex flex-col gap-0.5 shrink-0 overflow-y-auto">
      {NAV.map((n) => (
        <React.Fragment key={n.k}>
          <button onClick={() => setTab(n.k)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-left transition ${tab === n.k ? `${GRAD} text-white shadow` : "text-gray-600 hover:bg-gray-50"}`}>
            <span className="flex items-center gap-2"><span className={tab === n.k ? "text-white" : "text-gray-400"}>{n.i}</span>{n.l}</span>
            {n.expandable && <span className="text-xs opacity-70">{tab === "cashflow" ? "▾" : "›"}</span>}
          </button>
          {n.k === "cashflow" && tab === "cashflow" && (
            <div className="pl-9 flex flex-col gap-0.5 py-0.5">
              {["Annual", "Monthly"].map((v) => (
                <button key={v} onClick={() => setCfView(v)}
                  className={`text-left text-xs font-semibold px-3 py-1.5 rounded-full w-max ${cfView === v ? "bg-emerald-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{v}</button>
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
      <div className="mt-auto pt-4">
        <Primary onClick={onExport} className="w-full flex items-center justify-center gap-2">{I.doc} Export All to Excel</Primary>
      </div>
    </div>
  );
}

/* ================================================================
   TABS
   ================================================================ */
function DocsView({ scenarioData, uploaded = [], onGoUpload }) {
  const originalDoc = useMemo(() => {
    const name = scenarioData?.source_filename;
    if (!name) return null;
    const [type, tone] = detectDocType(name);
    return { id: "original", name, type, tone, isOriginal: true };
  }, [scenarioData]);

  const allDocs = useMemo(() => {
    const extra = uploaded
      .filter((f) => f.status !== "error")
      .map((f) => ({ id: f.id, name: f.name, type: f.type, tone: f.tone, isOriginal: false }));
    return originalDoc ? [originalDoc, ...extra] : extra;
  }, [originalDoc, uploaded]);

  const [activeFolder, setActiveFolder] = useState("All");
  const folderCounts = {};
  allDocs.forEach((d) => { folderCounts[d.type] = (folderCounts[d.type] || 0) + 1; });
  const folders = [["All", allDocs.length], ...Object.entries(folderCounts)];
  const visibleDocs = activeFolder === "All" ? allDocs : allDocs.filter((d) => d.type === activeFolder);
  const extOf = (name) => (name.split(".").pop() || "").toUpperCase().slice(0, 4);

  return (
    <div className="flex gap-5 p-6">
      <Card className="w-72 p-4 shrink-0">
        <div className="flex items-center gap-2 font-bold text-gray-800 mb-3">{I.folder} Document Library</div>
        <div className="flex flex-col gap-0.5">
          {folders.map(([name, count]) => (
            <button key={name} onClick={() => setActiveFolder(name)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left ${activeFolder === name ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>
              <span className="flex items-center gap-2"><span className="text-gray-400">{I.folder}</span>{name}</span>
              <span className="bg-gray-100 text-gray-500 text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center">{count}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="flex-1 p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="font-bold text-gray-800">{activeFolder === "All" ? "All Documents" : activeFolder}</div>
          <div className="text-xs text-gray-400 flex items-center gap-1">{I.dl} Drop files anywhere or click to upload</div>
        </div>
        {allDocs.length === 0 && (
          <div className="text-sm text-gray-400 mb-4">No documents uploaded yet — the document you uploaded to underwrite this deal, and anything you add below, will show up here.</div>
        )}
        <div className="flex gap-4 flex-wrap">
          {visibleDocs.map((d) => (
            <div key={d.id} className="w-36 relative group">
              <div className="relative h-40 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-gray-300">{I.doc}
                <span className="absolute -right-1 top-6 bg-gray-500 text-white rounded p-0.5 text-[9px] font-bold">{extOf(d.name)}</span>
              </div>
              <div className="text-xs text-gray-700 font-medium mt-2 text-center leading-tight truncate" title={d.name}>{d.name}</div>
              <div className="flex justify-center mt-1 gap-1 flex-wrap">
                <Pill tone={d.tone}>{d.type}</Pill>
                {d.isOriginal && <Pill tone="gray">Original Upload</Pill>}
              </div>
            </div>
          ))}
          <div onClick={onGoUpload} className="w-36 h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-2 cursor-pointer hover:border-emerald-300">
            <div className="text-2xl">＋</div><div className="text-xs">Upload Files</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================
   CREATE DOCUMENTS — placeholder list, not yet built
   ================================================================ */
function CreateDocumentsView() {
  const types = [
    ["Letter of Intent (LOI)", I.doc],
    ["Purchase & Sale Agreement", I.doc],
    ["Offering Memorandum", I.bldg],
    ["Investor Summary", I.card],
    ["Pitch Deck", I.trend],
  ];
  return (
    <div className="p-6 flex flex-col gap-5 w-full max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Documents</h1>
        <div className="text-sm text-gray-500 mt-0.5">Generate deal documents directly from your underwriting model.</div>
      </div>
      <Card className="divide-y divide-gray-100">
        {types.map(([label, icon]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700"><span className="text-gray-400">{icon}</span>{label}</span>
            <span className="text-[10px] font-semibold text-gray-400 italic">Coming soon</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================
   UPLOAD & PARSE FILES — add more documents to an existing deal.
   Calls the real parse endpoint; extracted fields flow into the
   Parsed Data view. Auto-merging into the live model is not yet built.
   ================================================================ */
function AdditionalUploadView({ dealId, files, setFiles, onParsed }) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    setError(null);
    for (const file of list) {
      const [type, tone] = detectDocType(file.name);
      const id = Date.now() + Math.random();
      setFiles((p) => [...p, { id, name: file.name, size: file.size, type, tone, status: "parsing", pct: 60 }]);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE_URL}/v2/deals/parse`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Parse failed (${res.status})`);
        const data = await res.json();
        setFiles((p) => p.map((f) => (f.id === id ? { ...f, status: "parsed", pct: 100 } : f)));
        onParsed && onParsed({ name: file.name, parsed: data.parsed || {} });
      } catch (e) {
        setFiles((p) => p.map((f) => (f.id === id ? { ...f, status: "error", pct: 100 } : f)));
        setError(e.message || "Failed to parse document");
      }
    }
  };

  const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(Math.round(b / 1024), 1)} KB`);

  return (
    <div className="p-6 flex flex-col gap-5 w-full max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload &amp; Parse Files</h1>
        <div className="text-sm text-gray-500 mt-0.5">
          Add more documents to this deal — rent rolls, T-12s, leases, tax bills, and more.
          {dealId && <span className="text-gray-400"> (Deal ID: {dealId})</span>}
        </div>
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className={`rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-16 px-8 text-center ${drag ? "border-emerald-400 bg-emerald-50/80" : "border-gray-300 bg-gray-50 hover:border-emerald-300"}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${drag ? "bg-emerald-500 text-white" : "bg-white text-emerald-500 border border-emerald-100"}`}>{I.dl}</div>
        <div className="font-bold text-gray-900 text-base mb-1">Drag &amp; drop additional documents here</div>
        <div className="text-sm text-gray-500">or click to browse · PDF, Excel, CSV, Word · Max 50MB each</div>
      </div>
      {error && <Card className="p-3 bg-red-50 border-red-100 text-sm text-red-600">{error}</Card>}
      {files.length > 0 && (
        <Card className="p-5">
          <div className="text-sm font-bold text-gray-800 mb-3">Documents for this deal ({files.length})</div>
          <div className="flex flex-col gap-2.5">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
                <span className="text-gray-400">{I.doc}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 truncate">{f.name}</span>
                    <Pill tone={f.tone}>{f.type}</Pill>
                  </div>
                  {f.status === "parsing" ? (
                    <div className="text-[11px] text-gray-400 mt-0.5">Parsing…</div>
                  ) : f.status === "error" ? (
                    <div className="text-[11px] text-red-500 mt-0.5">Failed to parse</div>
                  ) : (
                    <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">{I.check} Parsed — see Parsed Data tab</div>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                <button onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} className="text-gray-300 hover:text-red-400 hover:bg-red-50 p-1 rounded transition-colors">{I.x}</button>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-gray-400 mt-3">Auto-merging new figures into your live underwriting model is <span className="italic font-semibold">coming soon</span>. For now, review extracted fields in the Parsed Data tab.</div>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
   PARSED DATA — shows every field actually extracted from the
   deal's uploaded documents, grouped by section. Hover a row to see
   which tab/field it was filled into.
   ================================================================ */
const PARSED_DATA_SECTION_TITLES = {
  property: "Property",
  pnl: "P&L / Financials",
  pricing_financing: "Pricing & Financing",
  financing: "Financing",
  expenses: "Expenses",
  unit_mix: "Unit Mix",
  rent_roll: "Rent Roll",
  deal: "Deal",
};
const PARSED_DATA_FIELD_MAP = {
  "property.property_name": { label: "Property Name", tab: "Summary" },
  "property.name": { label: "Property Name", tab: "Summary" },
  "property.address": { label: "Address", tab: "Summary" },
  "property.city": { label: "City", tab: "Summary" },
  "property.state": { label: "State", tab: "Summary" },
  "property.zip": { label: "ZIP Code", tab: "Summary" },
  "property.units": { label: "Total Units", tab: "Summary" },
  "property.year_built": { label: "Year Built", tab: "Summary" },
  "pricing_financing.price": { label: "Purchase Price", tab: "Summary" },
  "pricing_financing.purchase_price": { label: "Purchase Price", tab: "Summary" },
  "pnl.gross_potential_rent": { label: "Gross Potential Rent", tab: "Income" },
  "pnl.effective_gross_income": { label: "Effective Gross Income", tab: "Income" },
  "pnl.vacancy_loss": { label: "Vacancy Loss", tab: "Income" },
  "pnl.bad_debt": { label: "Bad Debt", tab: "Income" },
  "pnl.other_income": { label: "Other Income", tab: "Income" },
  "pnl.operating_expenses_t12": { label: "Total Operating Expenses", tab: "Expenses" },
  "pnl.operating_expenses": { label: "Total Operating Expenses", tab: "Expenses" },
  "pnl.noi_t12": { label: "Net Operating Income", tab: "T-12" },
  "pnl.noi": { label: "Net Operating Income", tab: "T-12" },
  "pnl.noi_proforma": { label: "Proforma NOI", tab: "T-12" },
  "pnl.cap_rate_t12": { label: "Cap Rate", tab: "T-12" },
  "pnl.cap_rate": { label: "Cap Rate", tab: "T-12" },
  "pnl.expense_ratio_t12": { label: "Expense Ratio", tab: "Expenses" },
  "financing.ltv": { label: "LTV", tab: "Financing" },
  "financing.interest_rate": { label: "Interest Rate", tab: "Financing" },
  "financing.loan_term_years": { label: "Loan Term", tab: "Financing" },
  "financing.amortization_years": { label: "Amortization", tab: "Financing" },
  "financing.io_years": { label: "Interest-Only Period", tab: "Financing" },
  "financing.loan_fees_percent": { label: "Loan Fees", tab: "Financing" },
  "expenses.total": { label: "Total Expenses", tab: "Expenses" },
  "expenses.vacancy_pct": { label: "Vacancy %", tab: "Expenses" },
};
function humanizeParsedKey(key) {
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function flattenParsedData(obj, prefix = "") {
  const rows = [];
  if (!obj || typeof obj !== "object") return rows;
  Object.entries(obj).forEach(([key, val]) => {
    if (["_raw_markdown", "images", "source_filename"].includes(key)) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined || val === "") return;
    if (Array.isArray(val)) {
      if (val.length === 0) return;
      const allPrimitive = val.every((v) => v === null || typeof v !== "object");
      const value = allPrimitive
        ? val.slice(0, 8).join(", ") + (val.length > 8 ? "…" : "")
        : `${val.length} item${val.length === 1 ? "" : "s"} parsed`;
      rows.push({ path, value });
      return;
    }
    if (typeof val === "object") {
      rows.push(...flattenParsedData(val, path));
      return;
    }
    rows.push({ path, value: val });
  });
  return rows;
}
function resolveConfidencePage(confEntry) {
  if (!confEntry) return null;
  if (confEntry.page && Number.isFinite(Number(confEntry.page))) return Number(confEntry.page);
  const src = confEntry.source || confEntry.note || "";
  const match = src.match(/page\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}
function ParsedDataView({ scenarioData, extraDocs = [], pdfData, pdfUrl }) {
  const [viewer, setViewer] = useState(null); // { path, label, value }
  // Only offer the "view in source PDF" feature when the uploaded file is
  // actually a PDF — pdf.js can't render Excel/CSV sources, which would
  // otherwise surface a confusing "Unable to load PDF document" error.
  const isPdfSource = !scenarioData?.source_filename || /\.pdf$/i.test(scenarioData.source_filename.trim());
  const hasPdf = !!(pdfData || pdfUrl) && isPdfSource;
  const confidence = scenarioData?._confidence || {};

  const groups = useMemo(() => {
    if (!scenarioData) return [];
    const rows = flattenParsedData(scenarioData);
    const bySection = {};
    rows.forEach((r) => {
      const sectionKey = r.path.split(".")[0];
      if (!bySection[sectionKey]) bySection[sectionKey] = [];
      bySection[sectionKey].push(r);
    });
    return Object.entries(bySection).map(([key, items]) => ({
      key, title: PARSED_DATA_SECTION_TITLES[key] || humanizeParsedKey(key), items,
    }));
  }, [scenarioData]);

  if (!scenarioData || groups.length === 0) {
    return (
      <div className="p-16 text-center text-gray-400 flex flex-col items-center">
        <span className="mb-3 text-gray-300">{I.layers}</span>
        <div className="font-semibold text-gray-600">No parsed data yet</div>
        <div className="text-sm mt-1">Upload a document to see every extracted field here.</div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parsed Data</h1>
          <div className="text-sm text-gray-500 mt-0.5">
            Every field automatically extracted from your uploaded documents.
            {hasPdf ? " Click a row to see it highlighted in the source PDF." : " Hover a row to see where it was used."}
          </div>
        </div>
        <Pill tone="green">{groups.reduce((s, g) => s + g.items.length, 0)} fields parsed</Pill>
      </div>
      {!hasPdf && (
        <Card className="p-3 bg-gray-50 border-gray-100 text-xs text-gray-500">
          {!isPdfSource
            ? "The uploaded source document isn't a PDF, so fields can't be highlighted on a page here."
            : "Original source document isn't available in this session, so fields can't be highlighted in the PDF here. Re-upload the document (Upload & Parse Files) to enable this."}
        </Card>
      )}
      {extraDocs.length > 0 && (
        <Card className="p-3 bg-emerald-50/50 border-emerald-100 text-xs text-emerald-700 font-medium">
          Includes data from {extraDocs.length} additional document{extraDocs.length === 1 ? "" : "s"}: {extraDocs.map((d) => d.name).join(", ")}
        </Card>
      )}
      {groups.map((g) => (
        <Card key={g.key} className="overflow-hidden">
          <div className={`px-4 py-2.5 ${GRAD} text-white font-bold text-sm`}>{g.title}</div>
          <div>
            {g.items.map((row) => {
              const mapped = PARSED_DATA_FIELD_MAP[row.path];
              const label = mapped?.label || humanizeParsedKey(row.path.split(".").pop());
              const tabName = mapped?.tab || "General";
              const confEntry = confidence[row.path];
              const page = resolveConfidencePage(confEntry);
              return (
                <div key={row.path}
                  onClick={() => hasPdf && setViewer({ path: row.path, label, value: row.value, page: page || 1 })}
                  className={`group relative flex items-center justify-between px-4 py-2.5 border-t border-gray-50 first:border-0 transition-colors hover:bg-yellow-100 ${hasPdf ? "cursor-pointer" : "cursor-default"}`}>
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="text-sm font-semibold text-gray-800">{typeof row.value === "number" ? row.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(row.value)}</span>
                  <span className="pointer-events-none absolute right-4 top-full mt-1 z-20 hidden group-hover:block bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                    {hasPdf
                      ? `🔍 Click to view in source PDF${page ? ` · Page ${page}` : ""}`
                      : `→ Used in ${tabName} tab as "${label}"`}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {viewer && (
        <PDFViewerModal
          isOpen={!!viewer}
          onClose={() => setViewer(null)}
          pdfData={pdfData}
          pdfUrl={pdfUrl}
          fieldLabel={viewer.label}
          fieldValue={typeof viewer.value === "number" ? viewer.value.toLocaleString() : String(viewer.value)}
          highlightInfo={{ page: viewer.page, searchTerm: String(viewer.value) }}
        />
      )}
    </div>
  );
}

function SummaryTab({ M, S, set, pdfData, pdfUrl, scenarioData, fullCalcs }) {
  const [toast, setToast] = useState(true);
  const [capexOpen, setCapexOpen] = useState(false);
  const [debtOpen, setDebtOpen] = useState(false);
  const verify = useVerifyPanel();
  const applyScen = (k) => {
    const sc = CFG.scenarios[k];
    set({ scenarioKey: k, rateOverride: sc.rate, amort: sc.amort, ioMonths: sc.io });
    setDebtOpen(false);
  };
  // Real data from the actual parsed/uploaded deal, with the demo dataset
  // only ever used as a last-resort fallback (e.g. nothing uploaded yet).
  const realProperty = scenarioData?.property || {};
  const hasReal = !!(fullCalcs && Object.keys(fullCalcs).length > 0);
  const realUnits = realProperty.units || CFG.deal.units;
  const realAddress = realProperty.address || scenarioData?.address || CFG.deal.address;
  const realYearBuilt = realProperty.year_built || CFG.deal.yearBuilt;
  const realRba = realProperty.rba_sqft || CFG.deal.nrsf;
  const realAcres = realProperty.land_area_acres || CFG.deal.acres;
  const realPropertyType = realProperty.property_type || CFG.deal.type;
  const realParking = realProperty.parking_spaces;
  // Real Sources & Uses / Financing / Returns figures from the calc engine —
  // fall back to the demo M model only when no real deal is loaded yet.
  // NOTE: fullCalcs stores rates/returns as PERCENTAGES (e.g. 6.5 = 6.5%)
  // while M/S store the same fields as DECIMALS (e.g. 0.065) — normalized
  // to decimals here so every value below can go through the same pct().
  const realLoan = hasReal ? fullCalcs.financing.loanAmount : M.loan;
  const realTotalUses = hasReal ? (fullCalcs.sourcesAndUses?.uses?.total || 0) : M.totalUses;
  const realEquity = hasReal ? (fullCalcs.sourcesAndUses?.sources?.equity ?? fullCalcs.financing.totalEquityRequired) : M.equity;
  const realRate = hasReal ? (fullCalcs.financing.interestRate || 0) / 100 : M.rate;
  const realLtv = hasReal ? (fullCalcs.financing.ltv || 0) / 100 : S.ltv;
  const realAmortYears = hasReal ? fullCalcs.financing.amortYears : S.amort;
  const realIoYears = hasReal ? fullCalcs.financing.ioYears : 0;
  const realDscr = hasReal ? fullCalcs.year1?.dscr : (M.metrics.dscr === null ? null : M.metrics.dscr);
  const realGoingInCap = hasReal ? (fullCalcs.year1?.capRate || 0) / 100 : M.goingInCap;
  const realIRR = hasReal ? (fullCalcs.returns?.leveredIRR != null ? fullCalcs.returns.leveredIRR / 100 : null) : M.leveredIRR;
  const realEM = hasReal ? fullCalcs.returns?.leveredEquityMultiple : M.equityMultiple;
  const realAvgCoC = hasReal ? (fullCalcs.returns?.avgCashOnCash || 0) / 100 : M.avgCoC;
  const realExitCap = hasReal ? (fullCalcs.returns?.exitCapRate || 0) / 100 : S.exitCap;
  const realHoldPeriod = hasReal ? (fullCalcs.returns?.holdingPeriod || CFG.acq.holdYears) : CFG.acq.holdYears;
  // Value-add impact: NOI/value/cashflow/return uplift attributable to whichever
  // strategy is currently selected on the Strategy tab (reno premiums or RUBS) —
  // this is a hypothetical modeling tool, not an extracted fact, so it's still
  // layered on top of the demo T-12 unless/until the value-add engine itself
  // gets rewired to the real unit mix.
  const strategyAnnualIncrease = S.incomeMethod === "rubs" ? M.rubsAnnual
    : (S.incomeMethod === "simple" || S.incomeMethod === "advanced") ? M.totalPremiumYr : 0;
  const strategyNewNOI = M.T12.noi + strategyAnnualIncrease;
  const strategyValueAdd = strategyAnnualIncrease / S.exitCap;
  const strategyNewValue = M.purchasePrice + strategyValueAdd;
  const strategyNewMonthlyCF = M.lev[1] / 12;
  const strategyNewCoC = M.avgCoC;
  const ADD = <span className="italic text-gray-400 text-[13px]">Click to add…</span>;
  const realAvgUnitSize = realRba && realUnits ? Math.round(realRba / realUnits) : 0;
  const info = [
    [I.bldg, "Property Name", realAddress], [I.pin, "Address", realAddress], [I.tag, "Property Type", realPropertyType || CFG.deal.type], [I.grid, "Total Units", fm(realUnits)],
    [I.cal, "Year Built", realYearBuilt || ADD], [I.bldg, "Buildings", ADD], [I.layers, "# Stories", ADD], [I.hash, "Parcel ID/Folio #", ADD],
    [I.ruler, "NRSF", realRba ? fm(realRba) : ADD], [I.map, "Land Area (Acres)", realAcres ? `${realAcres} Acres` : ADD], [I.car, "Parking Spaces", realParking ? fm(realParking) : ADD], [I.ruler, "Avg Unit Size", realAvgUnitSize ? fm(realAvgUnitSize) : ADD],
    [I.person, "Ownership", null, "search"], [I.cal, "Last Sale Date", ADD], [I.dollar, "Last Sale Price", ADD], [I.bank, "Lender", ADD],
    [I.dollar, "Loan Amount", hasReal ? $f(fullCalcs.financing.loanAmount) : ADD], [I.tag, "Loan Type", ADD], [I.cal, "Maturity Date", ADD], [I.cal, "Mortgage Date", ADD],
  ];
  const acqFee = hasReal ? fullCalcs.acquisition.acquisitionFee : M.acqFeeAmt;
  const loanFees = hasReal ? (fullCalcs.financing.loanFees || 0) + (fullCalcs.financing.financingFees || 0) : M.finFeeAmt;
  // Real per-field citations from the parser (page + snippet) when available —
  // only these render a working "open source PDF" button; everything else
  // is demo/calculated data with no real document to point to.
  const conf = scenarioData?._confidence || {};
  const withSource = (path) => {
    const c = conf[path];
    return c && c.page != null ? { page: c.page, snippet: c.snippet } : {};
  };
  const summaryVerifyFields = [
    { label: "Property Name", value: realAddress, source: "Offering Memorandum", ...withSource("property.name") },
    { label: "Address", value: realAddress, source: "Offering Memorandum", ...withSource("property.address") },
    { label: "Total Units", value: fm(realUnits), source: "Offering Memorandum", ...withSource("property.units") },
    { label: "Year Built", value: realYearBuilt, source: "Offering Memorandum", ...withSource("property.year_built") },
    { label: "NRSF", value: fm(realRba), source: "Offering Memorandum", ...withSource("property.rba_sqft") },
    { label: "Purchase Price", value: $f(M.purchasePrice), source: "Purchase & Sale Agreement", ...withSource("pricing_financing.price") },
    { label: "Closing Costs", value: $f(hasReal ? fullCalcs.acquisition.closingCosts : CFG.acq.closingCosts), source: "Purchase & Sale Agreement" },
    { label: "Sale Price", value: $f(Math.round(hasReal ? (fullCalcs.returns.terminalValue || 0) : M.salePrice)), source: "Calculated", note: hasReal ? "Exit-year NOI \u00f7 exit cap" : "Year 5 forward NOI \u00f7 exit cap" },
    { label: "Loan Amount", value: $f(hasReal ? fullCalcs.financing.loanAmount : M.loan), source: "Lender Term Sheet", ...withSource("pricing_financing.loan_amount") },
    { label: "Total Sources/Uses", value: $f(hasReal ? fullCalcs.sourcesAndUses?.uses?.total : M.totalUses), source: "Calculated" },
  ];
  return (
    <div className="p-6 flex flex-col gap-6 w-full">
      <div className="flex justify-end"><VerifyButton onClick={verify.toggle} /></div>
      <Card className="p-5 grid grid-cols-4 gap-x-5 gap-y-4">
        {info.map(([ic, l, v, extra]) => (
          <div key={l}>
            <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5 mb-1"><span className="text-gray-300">{ic}</span>{l}</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 bg-white min-h-[34px] flex items-center">{v === null ? ADD : v}</div>
              {extra === "search" && <button className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">{I.search} Search</button>}
            </div>
          </div>
        ))}
      </Card>
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <GradBanner className="rounded-b-none"><span className="font-bold">Acquisition</span></GradBanner>
          <div className="p-4 grid grid-cols-2 gap-x-6">
            <Field icon={I.dollar} label="Purchase Price"><Input w="w-36" value={fm(M.purchasePrice)} onChange={(v) => set({ purchasePrice: parseInt(String(v).replace(/,/g, ""), 10) || CFG.acq.price })} /></Field>
            <Field icon={I.dollar} label="Price per Unit"><Input w="w-32" value={fm(Math.round(M.purchasePrice / realUnits))} readOnly /></Field>
            <Field icon={I.cal} label="Hold Period"><Input w="w-28" value={hasReal ? (fullCalcs.returns.holdingPeriod || CFG.acq.holdYears) : CFG.acq.holdYears} readOnly suffix="Years" /></Field>
            <Field icon={I.cal} label="Closing Date"><Input w="w-28" value={CFG.acq.closingDate} readOnly /></Field>
            <Field icon={I.cash} label="Working Capital"><span className="font-bold">{$f(CFG.acq.workingCapital)}</span></Field>
            <Field icon={I.card} label="Closing Costs">
              <span className="flex items-center gap-1.5 font-bold">{$f(hasReal ? fullCalcs.acquisition.closingCosts : CFG.acq.closingCosts)}
                <span className="bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">$</span>
                <span className="text-gray-300 text-xs">%</span></span>
            </Field>
          </div>
        </Card>
        <Card>
          <GradBanner className="rounded-b-none"><span className="font-bold">Disposition</span></GradBanner>
          <div className="p-4 grid grid-cols-2 gap-x-6">
            <Field icon={I.dollar} label="Sale Price"><Input w="w-36" value={fm(Math.round(hasReal ? (fullCalcs.returns.terminalValue || 0) : M.salePrice))} readOnly /></Field>
            <Field icon={I.dollar} label="Sale Price Per Unit"><Input w="w-32" value={fm(Math.round((hasReal ? (fullCalcs.returns.terminalValue || 0) : M.salePrice) / realUnits))} readOnly /></Field>
            <Field icon={I.pctI} label="Exit Cap Rate"><Input w="w-24" value={fm(S.exitCap * 100, 2)} onChange={(v) => set({ exitCap: (parseFloat(v) || 5.5) / 100 })} suffix="%" /></Field>
            <Field icon={I.pctI} label="Costs of Sale"><Input w="w-24" value={fm(S.costsOfSalePct * 100, 1)} onChange={(v) => set({ costsOfSalePct: (parseFloat(v) || 2) / 100 })} suffix="%" /></Field>
            <Field icon={I.cal} label="Sale Date"><Input w="w-28" value={CFG.acq.saleDate} readOnly /></Field>
            <Field icon={I.trend} label="Cap Rate Compression / Yr ⓘ"><span className="font-bold text-emerald-600 text-sm">18 bps</span></Field>
          </div>
        </Card>
      </div>
      <div>
        <GradPill className="mb-4">Sources &amp; Uses</GradPill>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">{I.trend} Sources of Funds</div>
            <Card className="overflow-hidden">
              <div className={`grid grid-cols-3 text-[11px] font-bold uppercase ${GRAD} text-white px-4 py-2`}><span>Item</span><span className="text-right">Amount</span><span className="text-right">%</span></div>
              {M.jvOn ? (<>
                <div className="grid grid-cols-3 px-4 py-2.5 text-sm border-t border-gray-50"><span className="text-gray-700">$ Sponsor Equity</span><Mono v={Math.round(M.sponsorEq)} /><span className="text-right text-[13px] text-gray-500">{pct(M.sponsorEq / M.totalUses, 1)}</span></div>
                <div className="grid grid-cols-3 px-4 py-2.5 text-sm border-t border-gray-50"><span className="text-gray-700 flex items-center gap-1.5">🤝 JV Partner Equity <Pill tone="green">{pct(S.jvPrefRate, 1)} pref</Pill></span><Mono v={Math.round(M.jvCap)} /><span className="text-right text-[13px] text-gray-500">{pct(M.jvCap / M.totalUses, 1)}</span></div>
              </>) : (
                <div className="grid grid-cols-3 px-4 py-2.5 text-sm border-t border-gray-50"><span className="text-gray-700">$ Equity ＋</span><Mono v={realEquity} /><span className="text-right text-[13px] text-gray-500">{pct(realEquity / realTotalUses, 1)}</span></div>
              )}
              <div className="grid grid-cols-3 px-4 py-2.5 text-sm border-t border-gray-50 relative">
                <span className="text-gray-700 flex items-center gap-1.5">Debt ({CFG.scenarios[S.scenarioKey].label})
                  <button onClick={() => setDebtOpen(!debtOpen)} className="w-5 h-5 rounded-full border border-gray-300 text-gray-400 text-xs leading-none">＋</button>
                </span>
                <Mono v={realLoan} /><span className="text-right text-[13px] text-gray-500">{pct(realLoan / realTotalUses, 1)}</span>
                {debtOpen && (
                  <div className="absolute top-10 left-4 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-30 p-2">
                    <div className="text-xs font-semibold text-gray-500 px-2 py-1.5">Financing Scenario</div>
                    {Object.keys(CFG.scenarios).map((k) => {
                      const sc = CFG.scenarios[k];
                      return (
                        <button key={k} onClick={() => applyScen(k)} className={`w-full text-left rounded-xl px-3 py-2.5 ${S.scenarioKey === k ? "bg-emerald-50" : "hover:bg-gray-50"}`}>
                          <div className="font-bold text-sm text-gray-800 flex justify-between">{sc.label} Loan {S.scenarioKey === k && <span className="text-emerald-500">%</span>}</div>
                          <div className="text-xs text-gray-500">{pct(sc.rate, sc.rate === 0.09 ? 0 : 2)} · {sc.term}yr · {sc.cons.ltv} LTV</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5 text-sm bg-emerald-50 font-bold border-t border-emerald-100"><span>Total Sources</span><span className="text-right">{$f(realTotalUses)}</span><span className="text-right">100%</span></div>
            </Card>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">{I.wrench} Uses of Funds</div>
            <Card className="overflow-hidden">
              <div className={`grid grid-cols-3 text-[11px] font-bold uppercase ${GRAD} text-white px-4 py-2`}><span>Item</span><span className="text-right">Amount</span><span className="text-right">%</span></div>
              {[["Purchase Price", M.purchasePrice], ["› Closing Costs", hasReal ? fullCalcs.acquisition.closingCosts : CFG.acq.closingCosts],
                [<span className="relative inline-flex items-center gap-2">CapEx
                  <button onClick={() => setCapexOpen(!capexOpen)}><Pill tone="purple">{S.capexMode === "closing" ? "Funded at Closing" : "Funded from Cashflow"}</Pill></button>
                  {capexOpen && (
                    <span className="absolute top-8 left-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-30 p-2 block font-normal">
                      <span className="block text-xs font-semibold text-gray-500 px-2 py-1.5">CapEx Funding Mode</span>
                      {[["closing", "Fund at Closing", "Capital raised at close covers renovation costs"], ["cashflow", "Fund from Cashflow", "Property cashflows fund renovations over time"]].map(([k, t, d]) => (
                        <button key={k} onClick={() => { set({ capexMode: k }); setCapexOpen(false); }} className={`w-full text-left rounded-xl px-3 py-2.5 block ${S.capexMode === k ? "bg-emerald-50" : "hover:bg-gray-50"}`}>
                          <span className="block font-bold text-sm text-gray-800">{t}</span>
                          <span className="block text-xs text-gray-500">{d}</span>
                        </button>
                      ))}
                    </span>
                  )}
                </span>, M.capexAtClosing, "capex"],
                ["Working Capital", CFG.acq.workingCapital], ["Acquisition Fee", acqFee], ["Loan Fees", loanFees]].map(([l, v], i) => (
                <div key={i} className="grid grid-cols-3 px-4 py-2.5 text-sm border-t border-gray-50 items-center"><span className="text-gray-700">{l}</span><Mono v={v} /><span className="text-right text-[13px] text-gray-500">{pct(v / realTotalUses, 1)}</span></div>
              ))}
              <div className="grid grid-cols-3 px-4 py-2.5 text-sm bg-emerald-50 font-bold border-t border-emerald-100"><span>Total Uses</span><span className="text-right">{$f(realTotalUses)}</span><span className="text-right">100%</span></div>
            </Card>
          </div>
        </div>
      </div>
      <div>
        <GradPill className="mb-4">Financing, Strategy &amp; Returns Snapshot</GradPill>
        <div className="text-xs text-gray-400 -mt-2 mb-3">Reflects whatever you've currently selected on the Financing, Strategy, and Returns tabs</div>
        <div className="grid grid-cols-3 gap-5">
          <Card className="overflow-hidden">
            <GradBanner className="rounded-b-none"><span className="font-bold text-sm">Financing</span></GradBanner>
            <div className="p-4 flex flex-col gap-2 text-sm">
              <SnapRow label="Scenario" value={CFG.scenarios[S.scenarioKey].label} />
              <SnapRow label="Loan Amount" value={$f(realLoan)} />
              <SnapRow label="Rate / LTV" value={`${pct(realRate, 2)} · ${pct(realLtv, 0)} LTV`} />
              <SnapRow label="Amort / IO" value={`${realAmortYears}yr / ${realIoYears * 12}mo IO`} />
              <SnapRow label="DSCR" value={realDscr == null ? "—" : `${fm(realDscr, 2)}x`} />
              <SnapRow label="Refinance"
                value={S.refiOn ? `Year ${S.refiYear} @ ${pct(S.refiLTV, 0)} LTV, ${pct(S.refiRate, 2)}` : "Not modeled"} />
            </div>
          </Card>
          <Card className="overflow-hidden">
            <GradBanner className="rounded-b-none"><span className="font-bold text-sm">Value-Add Strategy</span></GradBanner>
            <div className="p-4 flex flex-col gap-2 text-sm">
              <SnapRow label="Method" value={INCOME_METHOD_LABELS[S.incomeMethod] || S.incomeMethod} />
              {S.incomeMethod === "stabilized" && (
                <div className="text-gray-500 text-[13px]">In-place market rents, no renovation program modeled.</div>
              )}
              {(S.incomeMethod === "simple" || S.incomeMethod === "advanced") && (<>
                <SnapRow label="Units Renovated" value={`${M.renoCount} / ${M.dealUnits}`} />
                <SnapRow label="Avg Premium / Unit" value={`${$f(S.renoPremium)}/mo`} />
                <SnapRow label="Total Premium / Yr (Increase)" value={`+${$f(M.totalPremiumYr)}`} />
                <SnapRow label="Reno Schedule" value={`Month ${S.scheduleStart} – ${S.scheduleEnd}`} />
                <SnapRow label="Total Reno Cost" value={$f(M.totalRenoCost)} />
                <div className="border-t border-gray-100 my-1" />
                <SnapRow label="New NOI" value={$f(Math.round(strategyNewNOI))} highlight />
                <SnapRow label="New Property Value" value={$f(Math.round(strategyNewValue))} highlight />
                <SnapRow label="New Cash Flow / Mo" value={$f(Math.round(strategyNewMonthlyCF))} highlight />
                <SnapRow label="New Cash-on-Cash Return" value={pct(strategyNewCoC)} highlight />
              </>)}
              {S.incomeMethod === "rubs" && (<>
                <SnapRow label="Items Selected" value={`${S.rubsSelected.size} of ${CFG.rubs.items.length}`} />
                <SnapRow label="Recovery Rate" value={pct(S.rubsRecoveryPct, 0)} />
                <SnapRow label="Recovered / Yr (Increase to NOI)" value={`+${$f(Math.round(M.rubsAnnual))}`} />
                <div className="border-t border-gray-100 my-1" />
                <SnapRow label="New NOI" value={$f(Math.round(strategyNewNOI))} highlight />
                <SnapRow label="New Property Value" value={$f(Math.round(strategyNewValue))} highlight />
                <SnapRow label="New Cash Flow / Mo" value={$f(Math.round(strategyNewMonthlyCF))} highlight />
                <SnapRow label="New Cash-on-Cash Return" value={pct(strategyNewCoC)} highlight />
              </>)}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <GradBanner className="rounded-b-none"><span className="font-bold text-sm">Returns</span></GradBanner>
            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <SnapRow label="Going-In Cap" value={pct(realGoingInCap)} />
              <SnapRow label="Levered IRR" value={realIRR === null ? "—" : pct(realIRR)} />
              <SnapRow label="Equity Multiple" value={`${fm(realEM, 2)}x`} />
              <SnapRow label="Avg Cash-on-Cash" value={pct(realAvgCoC)} />
              <SnapRow label="Exit Cap Rate" value={pct(realExitCap, 2)} />
              <SnapRow label="Hold Period" value={`${realHoldPeriod} yrs`} />
            </div>
          </Card>
        </div>
      </div>
      {toast && <div className="fixed bottom-5 right-5 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-72 z-20">
        <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-gray-500">Document Activity</span><button onClick={() => setToast(false)} className="text-gray-300">{I.x}</button></div>
        <div className="flex items-start gap-2 text-sm text-gray-700"><span className="text-emerald-500 mt-0.5">{I.check}</span>T-12 parsed — your underwriting updated</div>
        <button className="mt-3 flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-lg w-full">{I.doc} Go to Underwriting Workflow</button>
      </div>}
      {verify.open && <DocSourcePanel title="Summary" fields={summaryVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

/* -------- Strategy -------- */
function StrategyTab({ M, S, set, pdfData, pdfUrl }) {
  const [subTab, setSubTab] = useState("Units");
  const [search, setSearch] = useState("");
  const [ganttType, setGanttType] = useState("all");
  const [ganttMonth, setGanttMonth] = useState(0);
  const [unitTypeFilter, setUnitTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Units");
  const [typeDDOpen, setTypeDDOpen] = useState(false);
  const [statusDDOpen, setStatusDDOpen] = useState(false);
  const [unitFiltersOpen, setUnitFiltersOpen] = useState(false);
  const [rentMin, setRentMin] = useState("");
  const [rentMax, setRentMax] = useState("");
  const methods = [
    ["stabilized", "Stabilized", "Uses current in-place rents as Market Rent. Applies annual rent growth for projections.", I.bldg],
    ["simple", "Value-Add (Simple)", "Define total units to renovate, start/end months, and a uniform absorption schedule. Blends income from current to target rents.", I.trend],
    ["advanced", "Value-Add (Advanced)", "Unit-level control over renovations and lease-up. Select specific units, set individual premiums, and schedule based on lease expirations.", I.card],
    ["rubs", "Value-Add (RUBS / Utility Bill-Back)", "Push owner-paid utility expenses onto tenants via ratio utility billing. Select which expenses to bill back — recovered costs flow straight to NOI and increase value at the cap rate.", I.cash],
  ];
  const toggleUnit = (id) => {
    const next = new Set(S.selectedRenoIds);
    next.has(id) ? next.delete(id) : next.add(id);
    set({ selectedRenoIds: next });
  };
  const pool = M.renoPool
    .filter((u) => u.unit.includes(search) || u.tenant.toLowerCase().includes(search.toLowerCase()))
    .filter((u) => unitTypeFilter === "All Types" || u.type === unitTypeFilter)
    .filter((u) => {
      if (statusFilter === "Selected Only") return S.selectedRenoIds.has(u.id);
      if (statusFilter === "Unselected Only") return !S.selectedRenoIds.has(u.id);
      return true;
    })
    .filter((u) => (!rentMin || u.rent >= parseInt(rentMin, 10)) && (!rentMax || u.rent <= parseInt(rentMax, 10)));
  const verify = useVerifyPanel();
  const strategyVerifyFields = [
    { label: "Income Method", value: S.incomeMethod, source: "Model Assumption" },
    { label: "Reno Premium / Unit", value: $f(S.renoPremium) + "/mo", source: "Model Assumption" },
    { label: "Reno Cost / Unit", value: $f(S.renoCost), source: "Model Assumption" },
    { label: "Units Selected for Reno", value: `${M.renoCount} / ${M.dealUnits}`, source: "Rent Roll", note: "Target unit type from rent roll" },
    { label: "Max Concurrent Renos", value: `${S.maxConcurrent} units/mo`, source: "Model Assumption" },
    { label: "Unit Downtime", value: `${S.renoDowntime} months`, source: "Model Assumption" },
  ];
  return (
    <div className="p-6 flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Strategy</h1>
        <VerifyButton onClick={verify.toggle} />
      </div>
      <div><GradPill>Income Method</GradPill></div>
      <Card className="p-5 flex flex-col gap-3">
        <div className="text-sm text-gray-600">Select how rental income is projected for this deal</div>
        {methods.map(([k, t, d, ic]) => (
          <button key={k} onClick={() => set({ incomeMethod: k })}
            className={`flex items-start gap-3 text-left border rounded-xl px-4 py-3.5 transition ${S.incomeMethod === k ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-gray-300"}`}>
            <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${S.incomeMethod === k ? "border-emerald-600" : "border-gray-300"}`}>{S.incomeMethod === k && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}</span>
            <span className="text-gray-500 mt-0.5">{ic}</span>
            <span><span className="font-semibold text-gray-800 text-sm">{t}</span><span className="block text-xs text-gray-500 mt-0.5">{d}</span></span>
          </button>
        ))}
      </Card>
      {S.incomeMethod === "rubs" && <RubsPanel M={M} S={S} set={set} />}
      {(S.incomeMethod === "simple" || S.incomeMethod === "advanced") && (<>
        <div><GradPill>Renovation &amp; Absorption Schedule</GradPill></div>
        <div className="flex gap-4">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[130px]"><div className="text-xs text-gray-500 font-medium">Total Units</div><div className="text-xl font-bold text-gray-900">{fm(M.dealUnits)}</div></div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[130px]"><div className="text-xs text-gray-500 font-medium">Start Month</div>
            <input value={S.scheduleStart} onChange={(e) => set({ scheduleStart: Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, S.scheduleEnd)) })} className="text-xl font-bold text-blue-600 w-16 outline-none border-b border-dashed border-blue-300 bg-transparent" /></div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[130px]"><div className="text-xs text-gray-500 font-medium">End Month</div>
            <input value={S.scheduleEnd} onChange={(e) => set({ scheduleEnd: Math.max(S.scheduleStart, Math.min(parseInt(e.target.value, 10) || 12, 12)) })} className="text-xl font-bold text-blue-600 w-16 outline-none border-b border-dashed border-blue-300 bg-transparent" /></div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[130px]"><div className="text-xs text-gray-500 font-medium">Absorption ⓘ</div><div className="text-xl font-bold text-gray-900">{pct(1 / Math.max(S.scheduleEnd - S.scheduleStart + 1, 1), 2)}</div></div>
        </div>
      </>)}
      {S.incomeMethod === "advanced" && (<>
        <div className="flex gap-2">
          {["Units", "Batch", "Schedule", "Impact"].map((t) => (
            <Ghost key={t} active={subTab === t} onClick={() => setSubTab(t)}>{t === "Units" ? I.people : t === "Batch" ? I.card : t === "Schedule" ? I.cal : I.trend} {t}</Ghost>
          ))}
        </div>
        {subTab === "Units" && (
          <Card className="p-5">
            <div className="flex items-center gap-2 font-bold text-lg text-gray-900">{I.cal} Unit Selection</div>
            <div className="text-sm text-gray-500 mb-4">Select which units to include in the renovation schedule and set target premiums</div>
            <div className="flex gap-4 mb-4">
              <StatCard label="Units Selected" value={`${M.renoCount} / ${M.dealUnits}`} />
              <StatCard label="Avg Premium" value={$f(S.renoPremium)} />
              <StatCard label="Total Premium/Yr" value={$f(M.totalPremiumYr)} />
              <StatCard label="Total Reno Cost" value={$f(M.totalRenoCost)} />
            </div>
            <div className="flex gap-3 mb-4 relative">
              <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">{I.search}<input placeholder="Search units…" value={search} onChange={(e) => setSearch(e.target.value)} className="outline-none w-full text-gray-700" /></div>
              <Ghost active={unitFiltersOpen} onClick={() => setUnitFiltersOpen(!unitFiltersOpen)}>{I.sliders}</Ghost>
              <div className="relative">
                <Ghost onClick={() => setTypeDDOpen(!typeDDOpen)}>{unitTypeFilter} ▾</Ghost>
                {typeDDOpen && (
                  <div className="absolute top-10 right-0 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-30 p-1.5">
                    {["All Types", ...CFG.unitMix.map((m) => m.type)].map((t) => (
                      <button key={t} onClick={() => { setUnitTypeFilter(t); setTypeDDOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${unitTypeFilter === t ? "bg-emerald-500 text-white font-semibold" : "text-gray-700 hover:bg-gray-50"}`}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <Ghost onClick={() => setStatusDDOpen(!statusDDOpen)}>{statusFilter} ▾</Ghost>
                {statusDDOpen && (
                  <div className="absolute top-10 right-0 w-44 bg-white rounded-xl shadow-2xl border border-gray-100 z-30 p-1.5">
                    {["All Units", "Selected Only", "Unselected Only"].map((t) => (
                      <button key={t} onClick={() => { setStatusFilter(t); setStatusDDOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${statusFilter === t ? "bg-emerald-500 text-white font-semibold" : "text-gray-700 hover:bg-gray-50"}`}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {unitFiltersOpen && (
              <Card className="p-4 mb-4">
                <div className="flex items-end gap-6 flex-wrap">
                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">Rent Range ($)</div>
                    <div className="flex items-center gap-1.5"><Input w="w-24" value={rentMin} onChange={setRentMin} /><span className="text-gray-400">–</span><Input w="w-24" value={rentMax} onChange={setRentMax} /></div>
                  </div>
                  <Ghost onClick={() => { setRentMin(""); setRentMax(""); setUnitTypeFilter("All Types"); setStatusFilter("All Units"); setSearch(""); }}>Clear Filters</Ghost>
                </div>
              </Card>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                  {["", "Unit #", "Type", "Current Rent", "Premium", "Target Rent", "Reno Cost", "Lease End", "Start Mo", "Return Mo"].map((h) => <th key={h} className="py-2 px-2 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {pool.map((u) => {
                    const sel = S.selectedRenoIds.has(u.id);
                    const start = M.renoStart(u);
                    return (
                      <tr key={u.id} className={`border-b border-gray-50 ${sel ? "bg-emerald-50/60" : ""}`}>
                        <td className="py-2.5 px-2"><button onClick={() => toggleUnit(u.id)} className={`w-5 h-5 rounded-full flex items-center justify-center ${sel ? "bg-emerald-500 text-white" : "border-2 border-gray-300"}`}>{sel && I.check}</button></td>
                        <td className="px-2 font-semibold">{u.unit}</td>
                        <td className="px-2"><Pill tone="outline">{u.type}</Pill></td>
                        <td className="px-2">{$f(u.rent)}</td>
                        <td className="px-2"><span className="flex items-center gap-1 text-gray-400">$<Input w="w-20" value={S.renoPremium} onChange={(v) => set({ renoPremium: parseInt(v) || 0 })} /></span></td>
                        <td className="px-2 text-emerald-600 font-semibold">{$f(u.rent + S.renoPremium)}</td>
                        <td className="px-2"><span className="flex items-center gap-1 text-gray-400">$<Input w="w-20" value={fm(S.renoCost)} onChange={(v) => set({ renoCost: parseInt(String(v).replace(/,/g, ""), 10) || 0 })} /></span></td>
                        <td className="px-2 text-gray-600">{u.vacant ? "Vacant" : `${MONTH_NAMES[parseInt(u.leaseExp.slice(0, 2), 10) - 1]} ${u.leaseExp.slice(-4)}`}</td>
                        <td className="px-2 font-semibold">M{start}</td>
                        <td className="px-2"><span className="bg-emerald-500 text-white text-[11px] font-bold px-2 py-1 rounded-full">M{M.renoReturn(u)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {subTab === "Batch" && (
          <Card className="p-5 flex flex-col gap-4">
            <div className="font-bold text-gray-900">Batch Apply</div>
            <div className="text-sm text-gray-500">Apply a premium and reno cost across every selected unit at once.</div>
            <div className="flex gap-6">
              <Field icon={I.dollar} label="Premium (all units)"><Input value={S.renoPremium} onChange={(v) => set({ renoPremium: parseInt(v) || 0 })} suffix="/mo" /></Field>
              <Field icon={I.wrench} label="Reno Cost (per unit)"><Input value={S.renoCost} onChange={(v) => set({ renoCost: parseInt(v) || 0 })} suffix="$" /></Field>
            </div>
            <div className="flex gap-3">
              <Primary onClick={() => set({ selectedRenoIds: new Set(M.renoPool.map((u) => u.id)) })}>Select all {M.renoPool.length} {CFG.reno.targetType}</Primary>
              <Ghost onClick={() => set({ selectedRenoIds: new Set() })}>Clear selection</Ghost>
            </div>
          </Card>
        )}
        {subTab === "Schedule" && (<>
          <Card className="p-5">
            <div className="flex items-center gap-2 font-bold text-lg text-gray-900">{I.people} Renovation Timing</div>
            <div className="text-sm text-gray-500 mb-4">Configure how long renovations take</div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold text-gray-800">Max Concurrent Renovations per Month</div>
              <span className="bg-gray-100 rounded-lg px-3 py-1 text-sm font-bold">{S.maxConcurrent} units</span>
            </div>
            <input type="range" min="1" max="24" value={S.maxConcurrent} onChange={(e) => set({ maxConcurrent: parseInt(e.target.value, 10) })} className="w-full accent-emerald-500" />
            <div className="text-xs text-gray-400 mb-5">Maximum units that can begin renovation in any given month</div>
            <div className="text-sm font-semibold text-gray-800 mb-1.5">Unit Downtime (Months)</div>
            <Input w="w-full" value={S.renoDowntime} onChange={(v) => set({ renoDowntime: Math.max(1, Math.min(parseInt(v, 10) || 1, 12)) })} />
            <div className="text-xs text-gray-400 mt-1.5">Total months a unit is offline from lease end to new tenant move-in</div>
          </Card>
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <Ghost onClick={() => setGanttType(ganttType === "all" ? CFG.reno.targetType : "all")}>{I.sliders} {ganttType === "all" ? "All Unit Types" : ganttType} ▾</Ghost>
              <Ghost onClick={() => setGanttMonth((ganttMonth + 1) % 4)}>{I.cal} {["All Months", "M1–M4", "M5–M8", "M9–M13"][ganttMonth]} ▾</Ghost>
            </div>
            <span className="bg-gray-100 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700">{M.renoCount} of {M.dealUnits} units selected for renovation</span>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-5 text-sm text-gray-600"><span className="font-semibold">Legend:</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-sky-100 border border-sky-300" /> Scheduled</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-orange-100 border border-orange-300" /> Renovating</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300" /> Leased</span>
            </div>
          </Card>
          <Card className="p-5">
            <div className="font-bold text-xl text-gray-900">Renovation Timeline</div>
            <div className="text-sm text-gray-500 mb-4">Visual schedule showing unit status across months</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-gray-500"><th className="py-2 pr-2">Unit</th><th className="pr-2">Type</th>
                  {Array.from({ length: M.ganttMonths }, (_, i) => <th key={i} className="text-center px-1 font-semibold">M{i + 1}</th>)}
                </tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100 bg-orange-50/40">
                    <td className="py-2 pr-2 font-bold text-gray-700" colSpan={2}>Down Units</td>
                    {M.downUnits.map((d, i) => <td key={i} className={`text-center px-1 font-bold ${d > 0 ? "text-orange-500" : "text-gray-300"}`}>{d > 0 ? d : "—"}</td>)}
                  </tr>
                  {M.renoUnits.filter((u) => ganttType === "all" || u.type === ganttType).slice(0, 30).map((u) => {
                    const s = M.renoStart(u), r = M.renoReturn(u);
                    return (
                      <tr key={u.id} className="border-t border-gray-50">
                        <td className="py-1.5 pr-2 font-bold">{u.unit} <span className="text-emerald-500">•</span></td>
                        <td className="pr-2"><Pill tone="outline">{u.type}</Pill></td>
                        {Array.from({ length: M.ganttMonths }, (_, mi) => {
                          const m = mi + 1;
                          const cls = m < s ? "bg-sky-100 border-sky-200" : m < r ? "bg-orange-100 border-orange-200" : "bg-emerald-100 border-emerald-200";
                          return <td key={mi} className="px-0.5 py-1"><div className={`h-6 rounded border ${cls}`} /></td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>)}
        {subTab === "Impact" && (
          <Card className="p-5">
            <div className="font-bold text-gray-900 mb-3">Renovation Impact</div>
            <div className="flex gap-4">
              <StatCard label="GPR Before" value={$f(M.gprMonthly * 12)} sub="annualized" />
              <StatCard label="GPR After" value={$f((M.gprMonthly + M.renoCount * S.renoPremium) * 12)} sub="annualized" />
              <StatCard label="Lift" value={$f(M.totalPremiumYr)} valueClass="text-emerald-600" />
              <StatCard label="Simple ROI on Reno" value={M.totalRenoCost > 0 ? pct(M.totalPremiumYr / M.totalRenoCost, 1) : "—"} sub="premium / cost" />
            </div>
          </Card>
        )}
        <RentMatrix M={M} S={S} set={set} />
      </>)}
      {S.incomeMethod === "simple" && <RentMatrix M={M} S={S} set={set} simple />}
      {verify.open && <DocSourcePanel title="Strategy" fields={strategyVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

function RubsPanel({ M, S, set }) {
  const toggle = (key) => {
    const next = new Set(S.rubsSelected);
    next.has(key) ? next.delete(key) : next.add(key);
    set({ rubsSelected: next });
  };
  const selRows = M.rubsRows.filter((r) => r.selected);
  const recovered = M.rubsAnnual;
  return (
    <>
      <div><GradPill>{I.cash} RUBS — Expense Bill-Back</GradPill></div>
      <Card className="overflow-hidden">
        <GradBanner className="rounded-b-none rounded-t-2xl">
          <div>
            <div className="font-bold">Utility Bill-Back (RUBS)</div>
            <div className="text-[11px] text-white/85">Select owner-paid expenses to push onto tenants. Annual figures come from the T-12.</div>
          </div>
          <span className="flex items-center gap-2 text-[11px] font-semibold">Recovery Rate
            <span className="bg-white/20 rounded-lg px-1"><Input w="w-16" value={fm(S.rubsRecoveryPct * 100, 0)} onChange={(v) => set({ rubsRecoveryPct: Math.max(0, Math.min((parseFloat(v) || 0) / 100, 1)) })} suffix="%" /></span>
          </span>
        </GradBanner>
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500 bg-gray-50">
            <th className="py-2.5 px-4 w-10"></th><th>Expense</th>
            <th className="text-right px-4">T-12 Annual</th>
            <th className="text-right px-4">÷ {M.dealUnits} Units</th>
            <th className="text-right px-4">÷ 12 Mo = Tenant Charge</th>
            <th className="text-right px-4">NOI Impact / Yr</th>
          </tr></thead>
          <tbody>
            {M.rubsRows.map((r) => (
              <tr key={r.key} className={`border-t border-gray-50 ${r.selected ? "bg-emerald-50/50" : ""}`}>
                <td className="py-2.5 px-4">
                  <button onClick={() => toggle(r.key)} className={`w-5 h-5 rounded-full flex items-center justify-center ${r.selected ? "bg-emerald-500 text-white" : "border-2 border-gray-300"}`}>{r.selected && I.check}</button>
                </td>
                <td className="font-semibold">{r.label}</td>
                <td className="text-right px-4">{$f(Math.round(r.annual))}</td>
                <td className="text-right px-4 text-gray-500">{$f(r.annual / M.dealUnits, 2)}/yr</td>
                <td className="text-right px-4 font-semibold text-emerald-700">{$f(r.perUnitMo, 2)}/unit/mo</td>
                <td className="text-right px-4 font-semibold">{r.selected ? `+${$f(Math.round(r.annual * S.rubsRecoveryPct))}` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-50 font-bold border-t border-emerald-100">
              <td className="py-2.5 px-4" /><td>Total Selected ({selRows.length})</td>
              <td className="text-right px-4">{$f(Math.round(selRows.reduce((s, r) => s + r.annual, 0)))}</td>
              <td />
              <td className="text-right px-4 text-emerald-700">{$f(M.rubsPerUnitMo, 2)}/unit/mo</td>
              <td className="text-right px-4 text-emerald-700">+{$f(Math.round(recovered))}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Recovered / Yr → NOI" value={`+${$f(Math.round(recovered))}`} valueClass="!text-emerald-600" sub={`at ${pct(S.rubsRecoveryPct, 0)} recovery`} />
        <StatCard label="Tenant Charge" value={`${$f(M.rubsPerUnitMo, 2)}`} sub="per unit / month" />
        <StatCard label="Exit Cap Rate" value={pct(S.exitCap)} sub="drives value impact" />
        <StatCard label="Value Created" value={`+${$f(Math.round(M.rubsValueImpact))}`} valueClass="!text-emerald-600" sub={`recovery ÷ ${pct(S.exitCap)} cap`} />
      </div>
      {selRows.length > 0 && (
        <Card className="p-4 text-sm text-gray-700 bg-emerald-50/40 border-emerald-100">
          <b>Breakdown:</b> {selRows.map((r) => `${r.label} ${$f(Math.round(r.annual))}/yr ÷ ${M.dealUnits} units ÷ 12 = ${$f(r.perUnitMo, 2)}/mo`).join(" · ")}.
          Recovered <b>{$f(Math.round(recovered))}</b>/yr added to NOI ÷ {pct(S.exitCap)} cap = <b className="text-emerald-700">+{$f(Math.round(M.rubsValueImpact))}</b> in property value.
        </Card>
      )}
    </>
  );
}

function exportRentMatrix(M, simple) {
  const wb = XLSX.utils.book_new();
  if (simple) {
    const rows = [["Month", "Current Rent", "Target Rent", "Blended Rent"],
      ...M.simpleTrend.map((t) => [t.m, Math.round(t.cur), Math.round(t.tgt), Math.round(t.blend)])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Income Trend");
  } else {
    const header = ["Unit", "Type", ...Array.from({ length: 12 }, (_, i) => `M${i + 1}`)];
    const rows = [header, ...M.matrix.map(({ u, cells }) => [u.unit, u.type, ...cells.map((c) => Math.round(c.v))])];
    rows.push(["Total", `${M.dealUnits} units`, ...M.matrixTotals.map((t) => Math.round(t.tot))]);
    rows.push(["GPR", "Full Potential", ...M.matrixTotals.map((t) => Math.round(t.full))]);
    rows.push(["Vacancy", "Reno Loss", ...M.matrixTotals.map((t) => -Math.round(t.loss))]);
    rows.push(["Net", "Rental Income", ...M.matrixTotals.map((t) => Math.round(t.tot))]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Rent Matrix");
  }
  XLSX.writeFile(wb, `DealSniper_RentIncomeBreakdown_${CFG.deal.name.replace(/[^A-Za-z0-9]+/g, "_")}.xlsx`);
}

function RentMatrix({ M, S, set, simple }) {
  const cellCls = { inplace: "bg-sky-50 text-sky-800", reno: "bg-orange-50 text-orange-600", prem: "bg-emerald-50 text-emerald-700" };
  const [collapsed, setCollapsed] = useState(false);
  const isAnnual = S.matrixView === "Annual";

  // Simple mode: 60-month trend → aggregate into 5 yearly totals when Annual
  const simplePeriods = useMemo(() => {
    if (!isAnnual) return M.simpleTrend.slice(0, 12).map((t) => ({ label: `Month ${t.m}`, ...t }));
    const years = [];
    for (let y = 0; y < 5; y++) {
      const months = M.simpleTrend.slice(y * 12, y * 12 + 12);
      years.push({
        label: `Year ${y + 1}`,
        m: `Y${y + 1}`,
        cur: sum(months.map((t) => t.cur)),
        tgt: sum(months.map((t) => t.tgt)),
        blend: sum(months.map((t) => t.blend)),
      });
    }
    return years;
  }, [M.simpleTrend, isAnnual]);

  // Advanced mode: 12-month per-unit matrix → collapse to one annual total column when Annual
  const advancedUnitRows = useMemo(() => {
    if (!isAnnual) return M.matrix;
    return M.matrix.map(({ u, cells }) => ({
      u,
      cells: [{ v: sum(cells.map((c) => c.v)), s: cells.some((c) => c.s === "reno") ? "reno" : cells[cells.length - 1].s }],
    }));
  }, [M.matrix, isAnnual]);
  const advancedTotals = useMemo(() => {
    if (!isAnnual) return M.matrixTotals;
    return [{
      tot: sum(M.matrixTotals.map((t) => t.tot)),
      full: sum(M.matrixTotals.map((t) => t.full)),
      loss: sum(M.matrixTotals.map((t) => t.loss)),
    }];
  }, [M.matrixTotals, isAnnual]);
  const advancedColCount = isAnnual ? 1 : 12;

  return (
    <div>
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-between mb-3 w-full">
        <GradPill>{I.chart} Rent Income Breakdown</GradPill>
        <span className="text-gray-400">{collapsed ? "⌄" : "⌃"}</span>
      </button>
      {!collapsed && (
      <Card className="overflow-hidden">
        <GradBanner className="rounded-b-none rounded-t-2xl">
          <div>
            <div className="font-bold">Rent Income Breakdown</div>
            <div className="text-[11px] text-white/80">{simple ? "Based on absorption schedule and lease-up timeline" : "Unit-level absorption based on individual renovation schedules"}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-white/20 text-[11px] font-semibold px-2.5 py-1 rounded-full">{simple ? "↗ Value-Add" : "Value-Add (Advanced)"}</span>
            {!simple && <span className="flex items-center gap-1.5 text-[11px] font-semibold">{I.home} Impute Vacant <Toggle on={S.imputeVacant} onChange={(v) => set({ imputeVacant: v })} /></span>}
            <Seg options={["Monthly", "Annual"]} value={S.matrixView} onChange={(v) => set({ matrixView: v })} />
            <button onClick={() => exportRentMatrix(M, simple)} className="bg-white text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-50 transition">{I.dl} Export</button>
          </div>
        </GradBanner>
        {simple ? (
          <div className="p-4">
            <div className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">{I.trend} Income Trend ({S.matrixView})</div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={simplePeriods}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="m" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={isAnnual ? 0 : 3} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} domain={[0, "dataMax + 50000"]} />
                  <RTooltip formatter={(v) => $f(v)} labelFormatter={(l, p) => p?.[0]?.payload?.label || l} />
                  <Line type="monotone" dataKey="cur" name="Current Rent" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tgt" name="Target Rent" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="blend" name="Blended Rent" stroke="#06B6D4" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-5 justify-center text-[11px] text-gray-500 mt-1">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Current Rent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Target Rent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Blended Rent</span>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-gray-500 bg-gray-50"><th className="py-2.5 px-3">Income Type</th>
                  {simplePeriods.map((t) => <th key={t.m} className="text-right px-3 whitespace-nowrap">{t.label}</th>)}
                </tr></thead>
                <tbody>
                  {[["Current Rent Income", "cur", "text-blue-600"], ["Target Rent Income", "tgt", "text-emerald-600"], ["Blended Rent Income", "blend", "text-cyan-600"]].map(([l, k, c]) => (
                    <tr key={k} className="border-t border-gray-50">
                      <td className={`py-2.5 px-3 font-semibold whitespace-nowrap ${c}`}>● {l} ⓘ</td>
                      {simplePeriods.map((t) => <td key={t.m} className="text-right px-3">{$f(t[k])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (<>
        <div className="px-4 py-2 text-xs text-gray-500 flex items-center gap-4 border-b border-gray-100">
          <span className="font-semibold">Legend:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> In-Place</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Renovating / Vacant ($0)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Leased at Premium</span>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="text-[12px] w-full">
            <thead className="sticky top-0 bg-white z-10"><tr className="text-gray-500">
              <th className="text-left py-2 px-3 sticky left-0 bg-white">Unit</th><th className="text-left px-2">Type</th>
              {Array.from({ length: advancedColCount }, (_, i) => <th key={i} className="px-2 text-right font-semibold">{isAnnual ? "Year 1 Total" : `M${i + 1}`}</th>)}
            </tr></thead>
            <tbody>
              {advancedUnitRows.map(({ u, cells }) => (
                <tr key={u.id} className="border-t border-gray-50">
                  <td className="py-1.5 px-3 font-semibold sticky left-0 bg-white">{u.unit}</td>
                  <td className="px-2 text-gray-500">{u.type}</td>
                  {cells.map((c, i) => <td key={i} className={`px-2 py-1.5 text-right ${cellCls[c.s]}`}>{c.v === 0 ? "$0" : $f(c.v)}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 font-bold border-t border-emerald-100"><td className="py-2 px-3 sticky left-0 bg-emerald-50">Total</td><td className="px-2">{M.dealUnits} units</td>
                {advancedTotals.map((t, i) => <td key={i} className="px-2 text-right">{$f(t.tot)}</td>)}</tr>
              <tr className="bg-sky-50 border-t border-sky-100"><td className="py-2 px-3 sticky left-0 bg-sky-50 font-semibold text-sky-800">GPR</td><td className="px-2 text-sky-700 font-semibold">Full Potential</td>
                {advancedTotals.map((t, i) => <td key={i} className="px-2 text-right text-sky-800">{$f(t.full)}</td>)}</tr>
              <tr className="bg-red-50 border-t border-red-100"><td className="py-2 px-3 sticky left-0 bg-red-50 font-semibold text-red-600">Vacancy</td><td className="px-2 text-red-500 font-semibold">Reno Loss</td>
                {advancedTotals.map((t, i) => <td key={i} className="px-2 text-right text-red-500">{t.loss === 0 ? "$0" : $p(t.loss)}</td>)}</tr>
              <tr className="bg-emerald-50 border-t border-emerald-100"><td className="py-2 px-3 sticky left-0 bg-emerald-50 font-semibold text-emerald-700">Net</td><td className="px-2 text-emerald-600 font-semibold">Rental Income</td>
                {advancedTotals.map((t, i) => <td key={i} className="px-2 text-right text-emerald-700">{$f(t.tot)}</td>)}</tr>
            </tfoot>
          </table>
        </div>
        </>)}
      </Card>
      )}
    </div>
  );
}

/* -------- Income -------- */
function IncomeTab({ M, pdfData, pdfUrl }) {
  const y1 = M.years[0];
  const rows = [
    ["Gross Potential Rental Revenue", y1.gprY], ["Physical Vacancy", y1.physVac], ["Bad Debt", y1.badDebt],
    ["Concessions", y1.conc], ["Net Rental Income", y1.netRental, true],
    ...(M.rubsActive ? [["RUBS Reimbursement Income", y1.rubsInc]] : []),
    ["Other Income", y1.otherInc],
    ["Effective Gross Revenue", y1.egr, true, "egr"],
  ];
  // Build unit-type rows from the ACTUAL units in this deal, not the fake
  // demo CFG.unitMix — a real deal's type set (e.g. "2x1") almost never
  // matches the demo's "2BR/2BA"/"3BR/3BA"/"1BR/1BA" labels, which used to
  // leave every row at $0/NaN while the fake counts (160/64/24) still showed.
  const realTypes = Array.from(new Set(M.units.map((u) => u.type)));
  const mixRows = realTypes.map((type) => {
    const us = M.units.filter((u) => u.type === type);
    const rev = us.reduce((s, u) => s + u.rent, 0);
    return { type, count: us.length, rev, avg: us.length ? rev / us.length : 0 };
  });
  const verify = useVerifyPanel();
  const incomeVerifyFields = [
    { label: "Gross Potential Rental", value: $f(y1.gprY), source: "Rent Roll" },
    { label: "Physical Vacancy", value: $f(y1.physVac), source: "T-12 Operating Statement", note: "Year 1 assumption applied to GPR" },
    { label: "Bad Debt", value: $f(y1.badDebt), source: "T-12 Operating Statement" },
    { label: "Concessions", value: $f(y1.conc), source: "T-12 Operating Statement" },
    { label: "Other Income", value: $f(y1.otherInc), source: "T-12 Operating Statement" },
    { label: "Effective Gross Revenue", value: $f(y1.egr), source: "Calculated" },
  ];
  return (
    <div className="p-6 flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Income</h1>
        <VerifyButton onClick={verify.toggle} />
      </div>
      <div><GradPill>Year 1 Income Summary</GradPill></div>
      <Card className="overflow-hidden">
        {rows.map(([l, v, bold, tone]) => (
          <div key={l} className={`flex justify-between px-5 py-3 border-b border-gray-50 last:border-0 ${tone === "egr" ? "bg-emerald-50" : ""}`}>
            <span className={`text-sm ${bold ? "font-bold text-gray-800" : "text-gray-600"}`}>{l}</span>
            <Mono v={Math.round(v)} bold={bold} green={tone === "egr"} />
          </div>
        ))}
      </Card>
      <div><GradPill>Income by Unit Type</GradPill></div>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500 bg-gray-50"><th className="py-2.5 px-4">Unit Type</th><th className="text-right px-4">Units</th><th className="text-right px-4">Avg Rent</th><th className="text-right px-4">Monthly Revenue</th><th className="text-right px-4">% of Revenue</th></tr></thead>
          <tbody>{mixRows.map((r) => (
            <tr key={r.type} className="border-t border-gray-50">
              <td className="py-2.5 px-4 font-semibold">{r.type}</td><td className="text-right px-4">{r.count}</td>
              <td className="text-right px-4">{$f(r.avg)}</td><td className="text-right px-4">{$f(r.rev)}</td>
              <td className="text-right px-4 text-gray-500">{pct(r.rev / M.gprMonthly, 0)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr className="bg-emerald-50 font-bold border-t border-emerald-100"><td className="py-2.5 px-4">Gross Potential Rent</td><td className="text-right px-4">{M.dealUnits}</td><td className="text-right px-4">{$f(M.gprMonthly / M.dealUnits)}</td><td className="text-right px-4">{$f(M.gprMonthly)}</td><td className="text-right px-4">100%</td></tr></tfoot>
        </table>
      </Card>
      {verify.open && <DocSourcePanel title="Income" fields={incomeVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

/* -------- Rent Roll -------- */
function RentRollTab({ M, scenarioData }) {
  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [trendWin, setTrendWin] = useState("6 Mo");
  const [toast, setToast] = useState(true);
  const [saving, setSaving] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fType, setFType] = useState("All Types");
  const [fStatus, setFStatus] = useState("All Statuses");
  const [fLease, setFLease] = useState("All");
  const [leaseDD, setLeaseDD] = useState(false);
  const [rentMin, setRentMin] = useState(""); const [rentMax, setRentMax] = useState("");
  const [sfMin, setSfMin] = useState(""); const [sfMax, setSfMax] = useState("");
  const [belowMkt, setBelowMkt] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);
  const [verify, setVerify] = useState(false);
  const [verifyUnit, setVerifyUnit] = useState(null);
  const [draft, setDraft] = useState({ open: false, loading: false, error: null, text: "", title: "" });
  const [gmail, setGmail] = useState({ userId: null, connected: false, email: null });
  const [showExpChart, setShowExpChart] = useState(true);
  const [sendTo, setSendTo] = useState(scenarioData?.brokerEmail || scenarioData?.property?.broker_email || "");
  const [sendState, setSendState] = useState({ sending: false, error: null, sent: false });
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id;
      if (!userId || cancelled) return;
      getGmailStatus(userId).then((status) => { if (!cancelled) setGmail({ userId, ...status }); });
    });
    return () => { cancelled = true; };
  }, []);
  const handleSendGmail = async () => {
    if (!gmail.userId || !sendTo) return;
    setSendState({ sending: true, error: null, sent: false });
    try {
      await sendGmail(gmail.userId, sendTo, draft.title, draft.text);
      setSendState({ sending: false, error: null, sent: true });
    } catch (e) {
      setSendState({ sending: false, error: e.message || "Failed to send", sent: false });
    }
  };
  const dd = useDueDiligence();
  const findings = dd.findings;
  const critCount = findings.filter((x) => x.severity === "critical").length;
  const avgAll = M.gprMonthly / M.dealUnits;
  const draftDocument = async (docType, topic) => {
    setDraft({
      open: true, loading: true, error: null, text: "",
      title: docType === "loi" ? "LOI Cover Email Draft" : topic ? `Email Draft — ${topic}` : "Email Draft — All Findings",
    });
    setSendState({ sending: false, error: null, sent: false });
    try {
      const res = await fetch(`${API_BASE_URL}/api/claude-chat/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: docType,
          topic: topic || null,
          deal_name: scenarioData?.property?.address || CFG.deal.name,
          address: scenarioData?.property?.address || CFG.deal.address,
          units: M.dealUnits,
          findings: docType === "email" ? findings.map((f) => ({ severity: f.severity, label: f.label, detail: f.detail })) : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) setDraft((p) => ({ ...p, loading: false, text: json.draft }));
      else setDraft((p) => ({ ...p, loading: false, error: json.error || "Failed to generate draft" }));
    } catch (e) {
      setDraft((p) => ({ ...p, loading: false, error: e.message || "Failed to generate draft" }));
    }
  };
  const runDueDiligence = () => {
    setDdOpen(true);
    dd.run({
      section: "rentroll",
      dealName: scenarioData?.property?.address || CFG.deal.name,
      units: M.dealUnits,
      data: { units: M.units.slice(0, 80).map((u) => ({
        unit: u.unit, type: u.type, vacant: u.vacant, rent: u.rent, sf: u.sf,
        leaseStart: u.leaseStart, leaseExp: u.leaseExp, tenureYears: u.tenureYears,
      })) },
    });
  };
  const openVerifyFor = (unitId) => { setVerifyUnit(M.units.find((u) => u.unit === unitId) || null); setVerify(true); };
  const LEASE_OPTS = ["All", "Expiring 0-3 mo", "Expiring 3-6 mo", "Expiring 6-12 mo", "12+ months", "MTM / Expired", "Signed last 30 days", "Signed last 90 days", "Signed last 6 months"];
  const passLease = (u) => {
    if (fLease === "All") return true;
    if (u.vacant) return false;
    const moToExp = (u.expYear - 2026) * 12 + u.expMonthIdx - 2; // months from closing (Mar 2026)
    if (fLease === "Expiring 0-3 mo") return moToExp >= 0 && moToExp <= 3;
    if (fLease === "Expiring 3-6 mo") return moToExp > 3 && moToExp <= 6;
    if (fLease === "Expiring 6-12 mo") return moToExp > 6 && moToExp <= 12;
    if (fLease === "12+ months") return moToExp > 12;
    if (fLease === "MTM / Expired") return moToExp < 0;
    if (fLease === "Signed last 30 days") return u.tenureYears <= 1 / 12;
    if (fLease === "Signed last 90 days") return u.tenureYears <= 0.25;
    if (fLease === "Signed last 6 months") return u.tenureYears <= 0.5;
    return true;
  };
  const passFilters = (u) =>
    (fType === "All Types" || u.type === fType) &&
    (fStatus === "All Statuses" || (fStatus === "Occupied" ? !u.vacant : u.vacant)) &&
    passLease(u) &&
    (!rentMin || u.rent >= parseInt(rentMin, 10)) && (!rentMax || u.rent <= parseInt(rentMax, 10)) &&
    (!sfMin || u.sf >= parseInt(sfMin, 10)) && (!sfMax || u.sf <= parseInt(sfMax, 10)) &&
    (!belowMkt || u.rent < 0.9 * avgAll);
  const list = M.units.filter((u) => (u.unit + u.tenant + u.type).toLowerCase().includes(search.toLowerCase()) && passFilters(u)).slice(0, 60);
  const mixRows = CFG.unitMix.map((m) => {
    const us = M.units.filter((u) => u.type === m.type);
    const rev = us.reduce((s, u) => s + u.rent, 0);
    return { ...m, rev, pu: us.length / M.dealUnits, pr: rev / M.gprMonthly };
  });
  const forecast = [{ m: "Vacant", v: M.vacantCount, vac: true }, ...["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"].map((m, i) => ({ m, v: M.expByMonth[i] }))];
  const avgRoll = Math.round(sum(M.expByMonth) / 12);
  return (
    <div className="p-6 flex flex-col gap-5 w-full">
      {saving && <button onClick={() => setSaving(false)} className="fixed top-16 right-5 bg-white border border-gray-200 rounded-full shadow px-3 py-1 text-xs text-gray-500 z-20">Saving…</button>}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rent Roll</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Primary onClick={() => (dd.hasRun ? setDdOpen(!ddOpen) : runDueDiligence())}>{I.spark} {dd.loading ? "Analyzing…" : "Due Diligence"}</Primary>
            {dd.hasRun && !dd.loading && <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{findings.length}</span>}
          </div>
          <Ghost active={view === "ai"} onClick={() => setView(view === "table" ? "ai" : "table")}>{I.chart} Analytics</Ghost>
          <Ghost onClick={() => openVerifyFor(verifyUnit?.unit || M.units[0]?.unit)} className="!border-emerald-300 !text-emerald-600"><span className="text-emerald-500">{I.check}</span> Verify Source</Ghost>
          <Ghost>{I.dl} Export to Excel</Ghost>
        </div>
      </div>
      {ddOpen && (
        <Card className="p-4 bg-amber-50/50 border-amber-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-semibold text-gray-800"><span className="text-amber-500">{I.warn}</span> Due Diligence <Pill tone="yellow">{findings.length} findings</Pill><Pill tone="orange">{critCount} critical</Pill></div>
            <div className="flex items-center gap-2">
              <button onClick={runDueDiligence} disabled={dd.loading} className="text-[11px] font-semibold text-emerald-600 hover:underline disabled:opacity-40">{dd.loading ? "Analyzing…" : "Re-run"}</button>
              <button onClick={() => setDdOpen(false)} className="text-gray-400">▾</button>
            </div>
          </div>
          {dd.loading && <div className="text-xs text-gray-500 py-2">Claude is reviewing the rent roll for irregularities…</div>}
          {dd.error && <div className="text-xs text-red-500 py-2">{dd.error}</div>}
          {!dd.loading && !dd.error && findings.length === 0 && dd.hasRun && (
            <div className="text-xs text-gray-500 py-2">No material irregularities detected in this rent roll.</div>
          )}
          {!dd.loading && findings.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {findings.map((f, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 w-full ${f.severity === "critical" ? "bg-red-50 border border-red-100" : "bg-amber-50 border border-amber-100"}`}>
                  <span className={f.severity === "critical" ? "text-red-400 mt-0.5" : "text-amber-500 mt-0.5"}>{f.severity === "critical" ? "⊙" : "↗"}</span>
                  <span className="text-gray-700 flex-1"><b>{f.label}</b> — {f.detail}</span>
                  {f.unitId && <button onClick={() => openVerifyFor(f.unitId)} className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Verify</button>}
                  {f.unitId && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Unit {f.unitId}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      {view === "table" && (<>
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">{I.search}<input placeholder="Search by unit, tenant, type, or status…" value={search} onChange={(e) => setSearch(e.target.value)} className="outline-none w-full text-gray-700" /></div>
          <Ghost active={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>{I.sliders} Filters</Ghost>
        </div>
        {filtersOpen && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
              <div><div className="text-[11px] font-semibold text-gray-500 mb-1">Unit Type</div>
                <select value={fType} onChange={(e) => setFType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none">
                  {["All Types", ...CFG.unitMix.map((m) => m.type)].map((o) => <option key={o}>{o}</option>)}
                </select></div>
              <div><div className="text-[11px] font-semibold text-gray-500 mb-1">Status</div>
                <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none">
                  {["All Statuses", "Occupied", "Vacant"].map((o) => <option key={o}>{o}</option>)}
                </select></div>
              <div className="relative"><div className="text-[11px] font-semibold text-gray-500 mb-1">Lease Expiration</div>
                <button onClick={() => setLeaseDD(!leaseDD)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white w-44 text-left flex justify-between items-center">{fLease}<span className="text-gray-400">⌄</span></button>
                {leaseDD && (
                  <div className="absolute top-16 left-0 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-30 p-1.5 max-h-72 overflow-y-auto">
                    {LEASE_OPTS.map((o) => (
                      <button key={o} onClick={() => { setFLease(o); setLeaseDD(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${fLease === o ? "bg-emerald-500 text-white font-semibold" : "text-gray-700 hover:bg-gray-50"}`}>
                        {fLease === o && o === "All" ? "✓ " : ""}{o}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><div className="text-[11px] font-semibold text-gray-500 mb-1">Rent Range ($)</div>
                <div className="flex items-center gap-1.5"><Input w="w-20" value={rentMin} onChange={setRentMin} /><span className="text-gray-400">–</span><Input w="w-20" value={rentMax} onChange={setRentMax} /></div></div>
              <div><div className="text-[11px] font-semibold text-gray-500 mb-1">SF Range</div>
                <div className="flex items-center gap-1.5"><Input w="w-20" value={sfMin} onChange={setSfMin} /><span className="text-gray-400">–</span><Input w="w-20" value={sfMax} onChange={setSfMax} /></div></div>
              <div><div className="text-[11px] font-semibold text-gray-500 mb-1">Below Market</div>
                <div className="flex items-center gap-2"><button onClick={() => setBelowMkt(!belowMkt)} className={`w-10 h-5 rounded-full p-0.5 transition ${belowMkt ? "bg-emerald-400" : "bg-gray-200"}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition ${belowMkt ? "translate-x-5" : ""}`} /></button><span className="text-xs text-gray-500">&lt;90% avg</span></div></div>
            </div>
          </Card>
        )}
        <div className="flex gap-3 flex-wrap">
          {[[I.grid, "Total Units", fm(M.dealUnits)], [I.people, "Occupied", fm(M.occupied)], [I.home, "Vacant", fm(M.dealUnits - M.occupied)],
            [I.pctI, "Occupancy", pct(M.occupied / M.dealUnits, 1)], [I.dollar, "Total In-Place Rent", $f(M.inPlaceMonthly)], [I.cash, "Avg In-Place Rent", $f(Math.round(M.inPlaceMonthly / M.occupied))]].map(([ic, l, v]) => (
            <div key={l} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[130px]">
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5"><span className="text-gray-300">{ic}</span>{l}</div>
              <div className="text-xl font-bold text-gray-900">{v}</div>
            </div>
          ))}
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-white shadow-sm"><tr className="text-left text-gray-500">
                {["#", "Unit", "Tenant", "Unit Code", "Unit Type", "SF", "Status", "In-Place Rent", "Lease Start", "Lease Expiration"].map((h) => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>{list.map((u, i) => {
                const finding = findings.find((f) => f.unitId === u.unit);
                return (
                <tr key={u.id} className={`border-t border-gray-50 relative group ${finding ? (finding.severity === "critical" ? "bg-red-50" : "bg-amber-50") : ""}`}>
                  <td className="py-2.5 px-3 text-gray-400">{i + 1}</td>
                  <td className="px-3 font-bold flex items-center gap-1.5">{u.unit}{finding && <span className={finding.severity === "critical" ? "text-red-400" : "text-amber-500"} title={finding.detail}>{I.warn}</span>}</td>
                  <td className="px-3">{u.tenant}</td>
                  <td className="px-3 text-gray-500 text-xs">{u.code}</td>
                  <td className="px-3">{u.type.replace("BR/", " BD / ").replace("BA", " BA")}</td>
                  <td className="px-3">{fm(u.sf)}</td>
                  <td className="px-3"><Pill tone={u.vacant ? "red" : "green"}>{u.vacant ? "Vacant" : "Occupied"}</Pill></td>
                  <td className="px-3 font-bold text-emerald-700">{$f(u.rent)}</td>
                  <td className="px-3 text-gray-500">{u.leaseStart}</td>
                  <td className="px-3 text-gray-500">{u.leaseExp}</td>
                  {finding && (
                    <span className="hidden group-hover:block absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-left text-[11px] text-gray-600 font-sans whitespace-normal">
                      <b className="block text-gray-800 mb-1">{finding.label} — Unit {u.unit}</b>
                      {finding.detail}
                    </span>
                  )}
                </tr>
              );})}</tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Showing {list.length} of {M.dealUnits} units</div>
        </Card>
      </>)}
      {view === "ai" && (<>
        <Card className="p-4 bg-orange-50/60 border-orange-100">
          <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm mb-3"><span className="text-orange-400">⚠</span> Tenant Tenure Risk Profile</div>
          <div className="flex gap-10">
            <div><div className="text-[11px] text-gray-500">Avg Tenure</div><div className="font-bold text-lg">{fm(M.avgTenure, 1)} yrs</div></div>
            <div><div className="text-[11px] text-gray-500">&gt; 3 Years</div><div className="font-bold text-lg">{pct(M.over3, 0)}</div></div>
            <div><div className="text-[11px] text-gray-500">Month-to-Month</div><div className="font-bold text-lg">{pct(M.mtmPct, 0)}</div></div>
          </div>
          <div className="text-xs text-gray-600 mt-3 flex items-center gap-1.5">{I.warn} {pct(M.units.filter((u) => u.tenureYears > 4).length / M.dealUnits, 0)} of tenants have been in place &gt; 4 years{M.rentTrend.pct < 0 ? ` while new leases are signing ${fm(Math.abs(M.rentTrend.pct) * 100, 1)}% below older leases` : ""}. That signals embedded upside plus potential turnover risk.</div>
        </Card>
        <Card className="overflow-hidden border-sky-100">
          <div className="px-4 py-3 bg-sky-50 font-semibold text-sm text-sky-800 flex items-center gap-2">{I.chart} Concentration Risk Detection</div>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-gray-500"><th className="py-2 px-4">Unit Type</th><th className="text-right px-4">Units</th><th className="text-right px-4">% of Units</th><th className="text-right px-4">Revenue</th><th className="text-right px-4">% of Revenue</th><th className="text-right px-4">Spread</th></tr></thead>
            <tbody>
              {mixRows.map((r) => (
                <tr key={r.type} className="border-t border-gray-50"><td className="py-2 px-4 font-semibold">{r.type}</td><td className="text-right px-4">{r.count}</td><td className="text-right px-4">{pct(r.pu, 0)}</td><td className="text-right px-4">{$f(r.rev)}</td><td className="text-right px-4">{pct(r.pr, 0)}</td><td className={`text-right px-4 font-semibold ${r.pr - r.pu >= 0 ? "text-emerald-600" : "text-red-500"}`}>{r.pr - r.pu >= 0 ? "+" : ""}{fm((r.pr - r.pu) * 100, 0)}pp</td></tr>
              ))}
              <tr className="border-t border-gray-100 font-bold"><td className="py-2 px-4">Gross Potential Rent</td><td className="text-right px-4">{M.dealUnits} units</td><td /><td className="text-right px-4">{$f(M.gprMonthly)}</td><td className="text-right px-4">100%</td><td /></tr>
              <tr className="text-emerald-600 font-semibold"><td className="py-1.5 px-4">In-Place Collected</td><td /><td /><td className="text-right px-4">{$f(M.inPlaceMonthly)}</td><td className="text-right px-4">{pct(M.inPlaceMonthly / M.gprMonthly, 0)}</td><td /></tr>
              <tr className="text-red-500 font-semibold"><td className="py-1.5 px-4 pb-3">Vacancy Loss</td><td /><td /><td className="text-right px-4">-{$f(M.gprMonthly - M.inPlaceMonthly)}</td><td className="text-right px-4">-{pct(1 - M.inPlaceMonthly / M.gprMonthly, 0)}</td><td /></tr>
            </tbody>
          </table>
        </Card>
        <Card className="p-4 bg-red-50/50 border-red-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-semibold text-sm text-gray-800">↘ New Lease Rent Trend <Pill tone={M.rentTrend.pct < 0 ? "red" : "green"}>{M.rentTrend.pct >= 0 ? "+" : ""}{fm(M.rentTrend.pct * 100, 1)}%</Pill></div>
            <Seg light options={["3 Mo", "6 Mo", "12 Mo"]} value={trendWin} onChange={setTrendWin} />
          </div>
          <div className="text-sm text-gray-700">Leases signed <b>6–12 months ago</b> average <b>{$f(M.rentTrend.recent)}/mo</b> ({M.rentTrend.nRecent} leases), compared to <b>{$f(M.rentTrend.older)}/mo</b> for those signed over 1 year ago.</div>
          <div className="flex items-center gap-4 mt-3">
            <div><div className="text-[11px] text-gray-500">6–12 months ago</div><div className="font-bold">{$f(M.rentTrend.recent)}</div><div className="text-[10px] text-gray-400">{M.rentTrend.nRecent} leases</div></div>
            <span className="text-gray-400">→</span>
            <div><div className="text-[11px] text-gray-500">over 1 year ago</div><div className="font-bold">{$f(M.rentTrend.older)}</div><div className="text-[10px] text-gray-400">{M.rentTrend.nOlder} leases</div></div>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className={`px-4 py-3 ${GRAD} text-white font-semibold text-sm flex items-center gap-2`}>{I.cal} Lease Expiration &amp; Turnover Timeline</div>
          <div className="p-4">
            <div className="flex gap-8 flex-wrap mb-4">
              <div><div className="text-[11px] text-gray-500 flex items-center gap-1">🔴 Currently Vacant ⓘ</div><div className="font-bold text-red-500 text-lg">{M.vacantCount} ({pct(M.vacantCount / M.dealUnits, 1)})</div></div>
              <div><div className="text-[11px] text-gray-500">🗓 Expiring (12 Mo)</div><div className="font-bold text-lg">{sum(M.expByMonth)} leases</div></div>
              <div><div className="text-[11px] text-gray-500">⚠ Peak Month</div><div className="font-bold text-lg">{MONTH_NAMES[M.expByMonth.indexOf(Math.max(...M.expByMonth))]} ({Math.max(...M.expByMonth)})</div></div>
              <div><div className="text-[11px] text-gray-500">Avg Monthly Roll</div><div className="font-bold text-lg">{avgRoll} units</div></div>
              <div><div className="text-[11px] text-gray-500">↗ Rolling in 12 Mo</div><div className="font-bold text-lg">{pct(sum(M.expByMonth) / M.dealUnits, 0)} ({sum(M.expByMonth)} units)</div></div>
            </div>
            <div className="flex justify-between items-center mb-1"><div className="text-sm font-semibold flex items-center gap-1.5">{I.chart} 12-Month Expiration Forecast</div><button onClick={() => setShowExpChart((v) => !v)} className="text-xs text-gray-400 hover:text-gray-600">{showExpChart ? "Hide Chart" : "Show Chart"}</button></div>
            {showExpChart && (<>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={forecast}>
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RTooltip />
                  <ReferenceLine y={avgRoll} stroke="#9CA3AF" strokeDasharray="4 4" />
                  <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                    {forecast.map((d, i) => <Cell key={i} fill={d.vac ? "#EF4444" : "#10B981"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 text-[11px] text-gray-500 mt-1">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Currently Vacant</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Expiring Leases</span>
              <span className="flex items-center gap-1">- - - Monthly average</span>
            </div>
            </>)}
          </div>
        </Card>
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">{I.search}<input placeholder="Search by unit, tenant, type, or status…" className="outline-none w-full text-gray-700" /></div>
          <Ghost>{I.sliders} Filters</Ghost>
        </div>
        {toast && (
          <div className="fixed bottom-5 right-5 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-80 z-20">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-gray-500">Rent Roll AI Insights detected</span><button onClick={() => setToast(false)} className="text-gray-300">{I.x}</button></div>
            <button onClick={() => draftDocument("email", null)} className="flex items-start gap-2 text-sm text-gray-800 font-semibold text-left w-full hover:bg-gray-50 rounded-lg p-1 -m-1 transition">
              <span className="text-teal-500 mt-0.5">{I.mail}</span>
              <span>Email all findings to broker<span className="block text-[11px] text-gray-400 font-normal">Draft email covering all insights</span></span>
            </button>
            <button onClick={() => draftDocument("loi", null)} className="flex items-start gap-2 text-sm text-gray-800 font-semibold text-left w-full hover:bg-gray-50 rounded-lg p-1 -m-1 transition mt-2">
              <span className="text-blue-500 mt-0.5">{I.doc}</span>
              <span>Draft LOI cover email<span className="block text-[11px] text-gray-400 font-normal">AI-generated Letter of Intent email</span></span>
            </button>
            <div className="text-[10px] font-bold text-gray-400 uppercase mt-3 mb-1.5">Or pick a topic:</div>
            <div className="flex gap-1.5 flex-wrap">
              {["Tenure Risk", "Rent Trend", "Lease Expirations"].map((c) => (
                <button key={c} onClick={() => draftDocument("email", c)} className="text-[11px] font-semibold border border-gray-200 rounded-full px-2.5 py-1 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 transition">{c}</button>
              ))}
            </div>
          </div>
        )}
        {draft.open && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex justify-between items-start mb-3">
                <div className="text-lg font-bold text-gray-900">{draft.title}</div>
                <button onClick={() => setDraft((p) => ({ ...p, open: false }))} className="text-gray-400">{I.x}</button>
              </div>
              {draft.loading && (
                <div className="text-sm text-gray-500 py-10 text-center flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
                  Drafting with Claude…
                </div>
              )}
              {!draft.loading && draft.error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{draft.error}</div>
              )}
              {!draft.loading && !draft.error && (
                <>
                  <textarea readOnly value={draft.text} className="w-full h-64 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 resize-none outline-none" />
                  {gmail.connected && (
                    <div className="mt-3 flex items-center gap-2">
                      <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="broker@email.com"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-300" />
                    </div>
                  )}
                  <div className="flex gap-2 mt-3 items-center flex-wrap">
                    <Primary onClick={() => navigator.clipboard.writeText(draft.text)}>{I.check} Copy to Clipboard</Primary>
                    {gmail.connected ? (
                      <button onClick={handleSendGmail} disabled={sendState.sending || !sendTo}
                        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-red-500 text-white disabled:opacity-40">
                        {I.mail} {sendState.sending ? "Sending…" : `Send from ${gmail.email}`}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Connect Gmail in your Dashboard to send this directly.</span>
                    )}
                    <Ghost onClick={() => setDraft((p) => ({ ...p, open: false }))}>Close</Ghost>
                  </div>
                  {sendState.sent && <div className="text-xs text-emerald-600 font-semibold mt-2">Sent ✓</div>}
                  {sendState.error && <div className="text-xs text-red-500 font-semibold mt-2">{sendState.error}</div>}
                </>
              )}
            </div>
          </div>
        )}
      </>)}
      {verify && verifyUnit && (
        <div className="fixed top-20 right-5 w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800"><span className="text-emerald-500">{I.check}</span> Source Verification — Unit {verifyUnit.unit}</div>
            <button onClick={() => setVerify(false)} className="text-gray-500">{I.x}</button>
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">Parsed live from Rent Roll upload · {M.dealUnits} unit roll</div>
          <table className="w-full text-[12px]">
            <tbody>
              {[["Unit #", verifyUnit.unit], ["Tenant", verifyUnit.tenant], ["Unit Code", verifyUnit.code],
                ["Unit Type", verifyUnit.type], ["Square Feet", fm(verifyUnit.sf)],
                ["Status", verifyUnit.vacant ? "Vacant" : "Occupied"], ["In-Place Rent", $f(verifyUnit.rent)],
                ["Lease Start", verifyUnit.leaseStart], ["Lease Expiration", verifyUnit.leaseExp],
                ["Tenure (Years)", fm(verifyUnit.tenureYears, 1)]].map(([l, v]) => (
                <tr key={l} className="border-t border-gray-50">
                  <td className="py-2 px-4 text-gray-500">{l}</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">Traced to source rent roll row for unit <span className="text-emerald-600 font-semibold">{verifyUnit.unit}</span>.</div>
        </div>
      )}
    </div>
  );
}

/* -------- T-12 -------- */
const T12_LABELS = {
  payroll: "Payroll", utilities: "Utilities", rm: "Repairs & Maintenance", insurance: "Insurance",
  reTax: "Real Estate Taxes", propMgmt: "Property Management", marketing: "Marketing",
  admin: "Administrative", contract: "Contract Services", turnover: "Turnover Costs", other: "Other Expenses",
};
const DD_LABELS = { ...T12_LABELS, badDebt: "Bad Debt", concessions: "Concessions", otherLoss: "Other Loss" };

/* ================================================================
   DUE DILIGENCE — calls the backend Claude-powered financial auditor
   to find real irregularities in T-12 / Expenses / Rent Roll data.
   ================================================================ */
function useDueDiligence() {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasRun, setHasRun] = useState(false);

  const run = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ENDPOINTS.financialAudit, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Analysis request failed (${res.status})`);
      }
      const data = await res.json();
      setFindings(data.findings || []);
      setHasRun(true);
    } catch (e) {
      setError(e.message || "Analysis failed");
      setFindings([]);
      setHasRun(true);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFindings([]); setHasRun(false); setError(null); };
  return { findings, loading, error, hasRun, run, reset };
}

/* GL code mapping used by the Verify Source panel — shows the real
   dollar figure pulled live from the T-12 data for whichever month/row
   is active, rather than a static hardcoded snapshot. */
const GL_CODE_MAP = {
  gpr: { code: "40210.0000", desc: "Gross Rental Income (Market)" },
  physVac: { code: "40310.0000", desc: "Vacancy Loss–Current" },
  badDebt: { code: "40420.0000", desc: "Write Offs–Unpaid Rent" },
  concessions: { code: "40425.1000", desc: "Concessions–New Lease" },
  otherLoss: { code: "40440.0000", desc: "Other Rental Losses" },
  otherIncome: { code: "40510.0000", desc: "Other Income–Combined" },
  payroll: { code: "50110.0000", desc: "Payroll & Benefits" },
  utilities: { code: "52110.0000", desc: "Utilities–Combined" },
  rm: { code: "54110.0000", desc: "Repairs & Maintenance" },
  insurance: { code: "55110.0000", desc: "Insurance Premiums" },
  reTax: { code: "56110.0000", desc: "Real Estate Taxes–Current Year" },
  propMgmt: { code: "57110.0000", desc: "Property Management Fees" },
  marketing: { code: "58110.0000", desc: "Marketing & Advertising" },
  admin: { code: "59110.0000", desc: "Administrative & Office" },
  contract: { code: "59510.0000", desc: "Contract Services" },
  turnover: { code: "59810.0000", desc: "Turnover / Make-Ready Costs" },
  other: { code: "59910.0000", desc: "Other Operating Expenses" },
};
const VERIFY_FIELD_ORDER = ["gpr", "physVac", "badDebt", "concessions", "otherLoss", "otherIncome", "egr",
  "payroll", "utilities", "rm", "insurance", "reTax", "propMgmt", "marketing", "admin", "contract", "turnover", "other",
  "opex", "noi", "netRental"];
const VERIFY_LABELS = {
  egr: "Effective Gross Revenue", opex: "Total Operating Expenses", noi: "Net Operating Income (NOI)", netRental: "Net Rental Income",
  ...DD_LABELS, otherIncome: "Other Income",
};
function buildGLRows(key, month, t, M) {
  const mLabel = MONTH_NAMES[month];
  const header = [
    ["", `Period = ${mLabel} (Month ${month + 1} of T-12)`, ""],
    ["", "Book = Accrual ; Tree = wb_ops_full", ""],
    ["", "", ""],
  ];
  if (GL_CODE_MAP[key]) {
    const { code, desc } = GL_CODE_MAP[key];
    const val = t[key] ? t[key][month] : 0;
    return [...header, ["", "INCOME" in {} ? "" : (["payroll","utilities","rm","insurance","reTax","propMgmt","marketing","admin","contract","turnover","other"].includes(key) ? "OPERATING EXPENSES" : "INCOME"), ""], [code, desc, $f(val)]];
  }
  if (key === "egr") return [...header, ["", "ROLLUP", ""], ["", "= Net Rental Income + Other Income", $f(M.T12.egrM[month])]];
  if (key === "opex") return [...header, ["", "ROLLUP", ""], ["", "= Sum of all expense categories", $f(M.T12.opexM[month])]];
  if (key === "noi") return [...header, ["", "ROLLUP", ""], ["", "= EGR + Total OpEx", $f(M.T12.egrM[month] + M.T12.opexM[month])]];
  if (key === "netRental") return [...header, ["", "ROLLUP", ""], ["", "= GPR + Vacancy + Bad Debt + Concessions + Other Loss", $f(M.T12.netRental[month])]];
  return header;
}
function SourceVerificationPanel({ t, M, fieldKey, month, onNavigate, onClose }) {
  const idx = VERIFY_FIELD_ORDER.indexOf(fieldKey);
  const safeIdx = idx === -1 ? 0 : idx;
  const rows = buildGLRows(VERIFY_FIELD_ORDER[safeIdx], month, t, M);
  return (
    <div className="fixed top-20 right-5 w-[440px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 overflow-hidden">
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800"><span className="text-emerald-500">{I.check}</span> Source Verification — {VERIFY_LABELS[VERIFY_FIELD_ORDER[safeIdx]]}</div>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <button onClick={() => onNavigate(VERIFY_FIELD_ORDER[(safeIdx + VERIFY_FIELD_ORDER.length - 1) % VERIFY_FIELD_ORDER.length])}>‹</button>
          <span className="text-xs">{safeIdx + 1} / {VERIFY_FIELD_ORDER.length}</span>
          <button onClick={() => onNavigate(VERIFY_FIELD_ORDER[(safeIdx + 1) % VERIFY_FIELD_ORDER.length])}>›</button>
          <button onClick={onClose}>{I.x}</button>
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-gray-500 flex justify-between border-b border-gray-100"><span>Live T-12 data · {M.dealUnits} unit rent roll</span><span>Month {month + 1}</span></div>
      <div className="max-h-[380px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead><tr className="text-left text-gray-400 bg-gray-50"><th className="py-1.5 px-3 w-8">#</th><th>GL Code</th><th>Description</th><th className="text-right px-3">Amount</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-gray-50 ${i === rows.length - 1 ? "ring-2 ring-inset ring-emerald-400 bg-emerald-50/50" : ""}`}>
                <td className="py-1.5 px-3 text-gray-300">{i + 3}</td>
                <td className="text-gray-600">{r[0]}</td>
                <td className="text-gray-800">{r[1]}</td>
                <td className="text-right px-3 text-gray-700 font-semibold">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">Parsed field: <span className="text-emerald-600 font-semibold">⭘ {VERIFY_LABELS[VERIFY_FIELD_ORDER[safeIdx]]}</span> traced to source ledger.</div>
    </div>
  );
}

/* ================================================================
   GENERIC VERIFY SOURCE — reusable across every tab. Shows exactly
   which uploaded document each field's value was parsed from.
   fields: [{ label, value, source, note? }]
   ================================================================ */
const DOC_TONE = {
  "Offering Memorandum": "purple",
  "T-12 Operating Statement": "green",
  "Rent Roll": "green",
  "Purchase & Sale Agreement": "yellow",
  "Lender Term Sheet": "orange",
  "Model Assumption": "gray",
  "Calculated": "gray",
  "RentCast Market Data": "purple",
};
function DocSourcePanel({ title, fields, onClose, pdfData, pdfUrl }) {
  const [viewer, setViewer] = useState(null); // { label, value, page, snippet }
  const hasPdf = !!(pdfData || pdfUrl);
  return (
    <div className="fixed top-20 right-5 w-[460px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 overflow-hidden">
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800"><span className="text-emerald-500">{I.check}</span> Verify Source — {title}</div>
        <button onClick={onClose} className="text-gray-500">{I.x}</button>
      </div>
      <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">Traces each field back to the document it was parsed from</div>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-white"><tr className="text-left text-gray-400 bg-gray-50">
            <th className="py-1.5 px-3">Field</th><th className="px-3">Source Document</th><th className="text-right px-3">Value</th><th className="w-8" />
          </tr></thead>
          <tbody>
            {fields.map((f, i) => {
              const canOpen = hasPdf && f.page != null;
              return (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-2 px-3 text-gray-700 font-medium">{f.label}{f.note && <span className="block text-[10px] text-gray-400 font-normal">{f.note}</span>}</td>
                  <td className="px-3"><Pill tone={DOC_TONE[f.source] || "gray"}>{f.source}</Pill></td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-800">{f.value}</td>
                  <td className="px-2 text-center">
                    {canOpen && (
                      <button title="Open source PDF" onClick={() => setViewer(f)} className="text-emerald-500 hover:text-emerald-700">{I.eye}</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!hasPdf && (
        <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">No source PDF attached to this deal yet — upload one to enable click-to-verify.</div>
      )}
      {viewer && (
        <PDFViewerModal
          isOpen={!!viewer}
          onClose={() => setViewer(null)}
          pdfData={pdfData}
          pdfUrl={pdfUrl}
          fieldLabel={viewer.label}
          fieldValue={typeof viewer.value === "number" ? viewer.value.toLocaleString() : String(viewer.value)}
          highlightInfo={{ page: viewer.page, searchTerm: viewer.snippet || String(viewer.value) }}
        />
      )}
    </div>
  );
}
/* Small header button + toggle state for the Verify Source panel, shared by every tab */
function useVerifyPanel() {
  const [open, setOpen] = useState(false);
  return { open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}
const VerifyButton = ({ onClick }) => (
  <Ghost onClick={onClick} className="!border-emerald-300 !text-emerald-600"><span className="text-emerald-500">{I.check}</span> Verify Source</Ghost>
);

function T12Tab({ M, scenarioData }) {
  const [email, setEmail] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(true);
  const [expOpen, setExpOpen] = useState(true);
  const [selFinding, setSelFinding] = useState(null);
  const [verify, setVerify] = useState(false);
  const [verifyKey, setVerifyKey] = useState("gpr");
  const [verifyMonth, setVerifyMonth] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const cellRefs = useRef({});
  const dd = useDueDiligence();
  const findings = dd.findings;
  const critCount = findings.filter((x) => x.severity === "critical").length;
  const REV_KEYS = ["badDebt", "concessions", "otherLoss"];
  const pickFinding = (f) => {
    if (selFinding && selFinding.rowKey === f.rowKey && selFinding.month === f.month) { setSelFinding(null); return; }
    if (f.rowKey) (REV_KEYS.includes(f.rowKey) ? setRevOpen : setExpOpen)(true);
    setSelFinding(f);
  };
  const openVerifyFor = (key, month) => {
    setVerifyKey(key || "gpr");
    setVerifyMonth(typeof month === "number" ? month : 0);
    setVerify(true);
  };
  const runDueDiligence = () => {
    setDdOpen(true);
    dd.run({
      section: "t12",
      dealName: scenarioData?.property?.address || CFG.deal.name,
      units: M.dealUnits,
      data: { rows: DD_LABELS ? Object.fromEntries(Object.keys(DD_LABELS).map((k) => [k, M.t12[k]])) : {}, labels: DD_LABELS },
    });
  };
  useEffect(() => {
    if (!selFinding) return;
    const el = cellRefs.current[`${selFinding.rowKey}-${selFinding.month}`];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [selFinding, revOpen, expOpen]);
  const t = M.t12;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const Row = ({ label, arr, expand, cls = "", rowKey }) => (
    <tr className={`border-t border-gray-50 ${cls.includes("bg-") ? cls : `bg-white ${cls}`}`}>
      <td className="py-2 px-3 sticky left-0 bg-inherit whitespace-nowrap">{expand && <span className="text-gray-300 mr-1">›</span>}{label}</td>
      {arr.map((v, i) => {
        const finding = rowKey ? findings.find((x) => x.rowKey === rowKey && x.month === i) : null;
        const flash = selFinding && selFinding.rowKey === rowKey && selFinding.month === i;
        return (
          <td key={i} ref={finding ? (el) => { cellRefs.current[`${rowKey}-${i}`] = el; } : undefined}
            className={`px-2 py-2 text-right text-[12px] relative group ${v < 0 ? "text-red-500" : "text-gray-700"} ${finding ? (finding.severity === "critical" ? "bg-red-100 rounded" : "bg-amber-100 rounded") : ""} ${flash ? "ring-2 ring-amber-500 rounded" : ""}`}>
            {$f(v)}
            {finding && (
              <span className="hidden group-hover:block absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-left text-[11px] text-gray-600 font-sans whitespace-normal">
                <b className="block text-gray-800 mb-1">{finding.label} — {MONTH_NAMES[finding.month]}</b>
                {finding.detail}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
  return (
    <div className="p-6 flex flex-col gap-5 w-full relative">
      <div className="flex items-center justify-between">
        <Ghost className="font-semibold">{I.doc} T-12 Operating Statement</Ghost>
        <div className="flex gap-2 items-center">
          <div className="relative"><Ghost onClick={() => (dd.hasRun ? setDdOpen(!ddOpen) : runDueDiligence())}><span className="text-teal-500">{I.spark}</span> {dd.loading ? "Analyzing…" : "Due Diligence"}</Ghost>
            {dd.hasRun && !dd.loading && <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{findings.length}</span>}</div>
          <Ghost onClick={() => openVerifyFor(verifyKey, verifyMonth)} className="!border-emerald-300 !text-emerald-600"><span className="text-emerald-500">{I.check}</span> Verify Source</Ghost>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <button onClick={() => setZoomPct((p) => Math.max(60, p - 10))} className="hover:text-gray-800">−</button>
            <span>{zoomPct}%</span>
            <button onClick={() => setZoomPct((p) => Math.min(150, p + 10))} className="hover:text-gray-800">＋</button>
            <button onClick={() => setZoomPct(100)} className="hover:text-gray-800">⟲</button>
          </div>
        </div>
      </div>
      {ddOpen && (
        <Card className="p-4 bg-amber-50/50 border-amber-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-semibold text-gray-800"><span className="text-amber-500">{I.warn}</span> Due Diligence <Pill tone="yellow">{findings.length} findings</Pill><Pill tone="orange">{critCount} critical</Pill></div>
            <div className="flex items-center gap-2">
              <button onClick={runDueDiligence} disabled={dd.loading} className="text-[11px] font-semibold text-emerald-600 hover:underline disabled:opacity-40">{dd.loading ? "Analyzing…" : "Re-run"}</button>
              <button onClick={() => setDdOpen(false)} className="text-gray-400">▾</button>
            </div>
          </div>
          {dd.loading && <div className="text-xs text-gray-500 py-2">Claude is reviewing the T-12 for irregularities…</div>}
          {dd.error && <div className="text-xs text-red-500 py-2">{dd.error}</div>}
          {!dd.loading && !dd.error && findings.length === 0 && dd.hasRun && (
            <div className="text-xs text-gray-500 py-2">No material irregularities detected in this T-12.</div>
          )}
          {!dd.loading && findings.length > 0 && (<>
            <div className="text-xs text-gray-600 mb-3">Claude flagged {critCount} critical item{critCount === 1 ? "" : "s"} alongside {findings.length - critCount} additional irregularities across the trailing twelve months. Click any row to locate it in the table, or verify its source.</div>
            <div className="flex flex-col gap-1.5">
              {findings.map((f, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 w-full transition ${f.severity === "critical" ? "bg-red-50 border border-red-100" : "bg-amber-50 border border-amber-100"} ${selFinding === f ? "ring-2 ring-amber-400" : ""}`}>
                  <button onClick={() => pickFinding(f)} className="flex items-start gap-2 flex-1 text-left">
                    <span className={f.severity === "critical" ? "text-red-400 mt-0.5" : "text-amber-500 mt-0.5"}>{f.severity === "critical" ? "⊙" : "↗"}</span>
                    <span className="text-gray-700 flex-1"><b>{f.label}</b> — {f.detail}</span>
                  </button>
                  {f.rowKey && <button onClick={() => openVerifyFor(f.rowKey, f.month ?? 0)} className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Verify</button>}
                  {typeof f.month === "number" && <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${f.severity === "critical" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>{MONTH_NAMES[f.month]}</span>}
                </div>
              ))}
            </div>
          </>)}
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto" style={{ fontSize: `${zoomPct}%` }}>
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-emerald-50/60"><th className="text-left py-3 px-3 sticky left-0 bg-emerald-50/60 text-emerald-800 font-bold text-sm">Month</th>
                {months.map((m, i) => <th key={m} className="px-2 py-2 text-center"><span className="inline-flex flex-col items-center gap-0.5"><span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">{i + 1}</span><span className="text-[11px] font-semibold text-gray-600">{m}</span></span></th>)}</tr>
            </thead>
            <tbody className="bg-white">
              <tr className="bg-emerald-50"><td colSpan={13} className="py-2 px-3 text-emerald-700 font-bold text-xs"><button onClick={() => setRevOpen(!revOpen)} className="flex items-center gap-1">{revOpen ? "⌄" : "›"} 💲 REVENUE</button></td></tr>
              {revOpen && (<>
                <Row label="Gross Potential Rental" arr={t.gpr} rowKey="gpr" />
                <Row label="Physical Vacancy" arr={t.physVac} expand rowKey="physVac" />
                <Row label="Bad Debt" arr={t.badDebt} expand rowKey="badDebt" />
                <Row label="Concessions" arr={t.concessions} expand rowKey="concessions" />
                <Row label="Loss to Lease" arr={Array.from({ length: 12 }, () => 0)} />
                <Row label="Other Loss" arr={t.otherLoss} expand rowKey="otherLoss" />
                <Row label="Net Rental Income" arr={M.T12.netRental} cls="font-semibold" />
                <Row label="Other Income" arr={t.otherIncome} expand cls="text-emerald-600" rowKey="otherIncome" />
              </>)}
              <Row label="Effective Gross Revenue" arr={M.T12.egrM} cls="bg-emerald-50 font-bold" />
              <tr className="bg-red-50"><td colSpan={13} className="py-2 px-3 text-red-500 font-bold text-xs"><button onClick={() => setExpOpen(!expOpen)} className="flex items-center gap-1">{expOpen ? "⌄" : "›"} OPERATING EXPENSES</button></td></tr>
              {expOpen && Object.keys(T12_LABELS).map((k) => <Row key={k} label={T12_LABELS[k]} arr={t[k]} rowKey={k} expand={["payroll","utilities","rm","marketing","admin","contract","turnover"].includes(k)} />)}
              <Row label="Total Operating Expenses" arr={M.T12.opexM} cls="bg-red-50 font-bold" />
              <Row label="Net Operating Income (NOI)" arr={M.T12.egrM.map((v, i) => v + M.T12.opexM[i])} cls="bg-sky-50 font-bold" />
            </tbody>
          </table>
        </div>
      </Card>
      {verify && (
        <SourceVerificationPanel t={t} M={M} fieldKey={verifyKey} month={verifyMonth}
          onNavigate={(k) => setVerifyKey(k)} onClose={() => setVerify(false)} />
      )}
      {!email && !ddOpen && (
        <div className="fixed bottom-24 right-5 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-64 z-20">
          <div className="text-xs font-semibold text-gray-500 mb-2">T-12 Operating Statement</div>
          <button onClick={runDueDiligence} className="flex items-start gap-2 text-sm text-gray-800 font-semibold text-left">
            <span className="text-teal-500 mt-0.5">{I.spark}</span>
            <span>Run Due Diligence<span className="block text-[11px] text-gray-400 font-normal">Analyze T-12 for anomalies &amp; discrepancies</span></span>
          </button>
        </div>
      )}
      {!email && dd.hasRun && findings.length > 0 && (
        <button onClick={() => setEmail(true)} className="fixed bottom-5 right-5 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-64 text-left z-20">
          <div className="text-xs font-semibold text-gray-500 mb-2">Due Diligence findings detected</div>
          <div className="flex items-start gap-2 text-sm text-gray-800 font-semibold"><span className="text-teal-500 mt-0.5">{I.mail}</span> Draft email to broker</div>
          <div className="text-[11px] text-gray-400 ml-6">Ask about T-12 discrepancies</div>
        </button>
      )}
      {email && <EmailComposer findings={findings} scenarioData={scenarioData} onClose={() => setEmail(false)} />}
    </div>
  );
}
function EmailComposer({ findings = [], scenarioData, onClose }) {
  const dealLabel = scenarioData?.property?.address || CFG.deal.name;
  const [subject, setSubject] = useState(`${dealLabel} T-12 Discrepancies`);
  const [to, setTo] = useState(scenarioData?.brokerEmail || scenarioData?.property?.broker_email || "");
  const [body, setBody] = useState(`Hi,

While reviewing the T-12 for ${dealLabel}, our due diligence analysis flagged several items needing clarification. Could you please provide additional details or supporting documentation for the following:

${findings.map((f, i) => `${i + 1}. ${f.label}${typeof f.month === "number" ? ` (${MONTH_NAMES[f.month]})` : ""}: ${f.detail}`).join("\n")}

Thanks,`);
  const [gmail, setGmail] = useState({ userId: null, connected: false, email: null });
  const [sendState, setSendState] = useState({ sending: false, error: null, sent: false });
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id;
      if (!userId || cancelled) return;
      getGmailStatus(userId).then((status) => { if (!cancelled) setGmail({ userId, ...status }); });
    });
    return () => { cancelled = true; };
  }, []);
  const handleSend = async () => {
    if (!gmail.userId || !to) return;
    setSendState({ sending: true, error: null, sent: false });
    try {
      await sendGmail(gmail.userId, to, subject, body);
      setSendState({ sending: false, error: null, sent: true });
    } catch (e) {
      setSendState({ sending: false, error: e.message || "Failed to send", sent: false });
    }
  };
  return (
    <div className="fixed bottom-5 right-5 w-[520px] bg-white border-2 border-emerald-300 rounded-2xl shadow-2xl z-40 flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 font-semibold text-gray-800"><span className="text-teal-500">{I.mail}</span> Email Composer</div>
        <button onClick={onClose} className="text-gray-400">{I.x}</button>
      </div>
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 text-sm"><span className="text-gray-400 w-14">To</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="broker@email.com" className="flex-1 outline-none text-gray-700" />
      </div>
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 text-sm"><span className="text-gray-400 w-14">Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 outline-none text-gray-700 font-semibold" />
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} className="flex-1 p-4 text-sm text-gray-700 outline-none resize-none min-h-[240px] font-sans" />
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        <Primary onClick={() => navigator.clipboard.writeText(body)}>{I.check} Copy to Clipboard</Primary>
        {gmail.connected ? (
          <button onClick={handleSend} disabled={sendState.sending || !to}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-red-500 text-white disabled:opacity-40">
            {I.mail} {sendState.sending ? "Sending…" : `Send from ${gmail.email}`}
          </button>
        ) : (
          <span className="text-xs text-gray-400">Connect Gmail in your Dashboard to send this directly.</span>
        )}
        {sendState.sent && <span className="text-xs text-emerald-600 font-semibold">Sent ✓</span>}
        {sendState.error && <span className="text-xs text-red-500 font-semibold">{sendState.error}</span>}
      </div>
    </div>
  );
}

/* -------- Real expense data (from the actual uploaded deal document,
   independent of the demo T-12 model above) -------- */
const UTIL_BREAKDOWN_LABELS = {
  water_sewer: "Water / Sewer", electric: "Electric", gas: "Gas",
  trash: "Trash / Refuse", cable_internet: "Cable / Internet", other_utility: "Other Utility",
};
const EXPENSE_LINE_LABELS = {
  taxes: "Property Taxes", insurance: "Insurance", utilities: "Utilities",
  repairs_maintenance: "Repairs & Maintenance", management: "Management Fee",
  payroll: "Payroll", admin: "Administrative", marketing: "Marketing", other: "Other",
};

function RealExpenseDataCard({ scenarioData }) {
  const exp = scenarioData?.expenses || null;
  const units = Number(scenarioData?.property?.units) || 0;
  if (!exp || !(Number(exp.utilities) > 0)) return null;

  const breakdown = exp.utilities_breakdown || {};
  const breakdownEntries = Object.entries(UTIL_BREAKDOWN_LABELS)
    .map(([k, label]) => [k, label, Number(breakdown[k]) || 0])
    .filter(([, , v]) => v > 0);
  const hasBreakdown = breakdownEntries.length > 0;
  const utilitiesTotal = Number(exp.utilities) || 0;

  return (
    <Card className="overflow-hidden">
      <GradBanner>
        <span className="font-bold text-sm">Utilities — As Reported In Source Document</span>
        <Pill tone={hasBreakdown ? "green" : "gray"}>{hasBreakdown ? "Itemized" : "Combined Total"}</Pill>
      </GradBanner>
      <div className="p-4">
        {hasBreakdown ? (
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-gray-500"><th className="py-2">Utility</th><th className="text-right py-2">Annual</th><th className="text-right py-2">Per Unit / Yr</th></tr></thead>
            <tbody>
              {breakdownEntries.map(([k, label, v]) => (
                <tr key={k} className="border-t border-gray-50">
                  <td className="py-2">{label}</td>
                  <td className="text-right py-2"><Mono v={v} /></td>
                  <td className="text-right py-2 text-gray-500">{units ? $f(v / units) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-bold">
                <td className="py-2">Total Utilities</td>
                <td className="text-right py-2"><Mono v={utilitiesTotal} bold /></td>
                <td className="text-right py-2">{units ? $f(utilitiesTotal / units) : "—"}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="text-sm text-gray-500">
            The source document reported utilities as a single combined total (<b>{$f(utilitiesTotal)}</b>/yr) with no
            itemized water/electric/gas/trash breakdown. Re-upload a T-12 or expense schedule that itemizes utilities
            to see a per-utility breakdown here.
          </div>
        )}
      </div>
    </Card>
  );
}

/* -------- Expense pass-through / RUBS calculator — driven entirely by the
   deal's real reported expenses, not the demo model. Lets the user select
   ANY expense line item (or utility sub-item, when broken out) to bill back
   to tenants and see the resulting NOI impact. -------- */
function ExpensePassThroughCalculator({ scenarioData }) {
  const exp = scenarioData?.expenses || null;
  const pnl = scenarioData?.pnl || {};
  const units = Number(scenarioData?.property?.units) || 0;
  const baseNOI = Number(pnl.noi_t12 ?? pnl.noi) || 0;

  const items = useMemo(() => {
    if (!exp) return [];
    const breakdown = exp.utilities_breakdown || {};
    const hasBreakdown = Object.values(breakdown).some((v) => Number(v) > 0);
    const rows = [];
    Object.entries(EXPENSE_LINE_LABELS).forEach(([key, label]) => {
      if (key === "utilities" && hasBreakdown) {
        Object.entries(UTIL_BREAKDOWN_LABELS).forEach(([uk, ulabel]) => {
          const v = Number(breakdown[uk]) || 0;
          if (v > 0) rows.push({ key: `utilities.${uk}`, label: `Utilities — ${ulabel}`, value: v });
        });
      } else {
        const v = Number(exp[key]) || 0;
        if (v > 0) rows.push({ key, label, value: v });
      }
    });
    return rows;
  }, [exp]);

  const [selected, setSelected] = useState({});
  const [recovery, setRecovery] = useState({});
  const toggle = (key) => setSelected((p) => ({ ...p, [key]: !p[key] }));
  const setRec = (key, val) => setRecovery((p) => ({ ...p, [key]: Math.max(0, Math.min(100, val)) }));

  if (!exp || items.length === 0) {
    return (
      <Card className="p-6 text-sm text-gray-500">
        Upload this deal's T-12 or expense schedule to enable the expense pass-through (RUBS) calculator.
      </Card>
    );
  }

  const totalAnnualIncrease = items.reduce((s, it) => {
    if (!selected[it.key]) return s;
    const p = recovery[it.key] ?? 100;
    return s + it.value * (p / 100);
  }, 0);
  const newNOI = baseNOI + totalAnnualIncrease;
  const perUnitYear = units ? totalAnnualIncrease / units : 0;
  const perUnitMonth = units ? totalAnnualIncrease / units / 12 : 0;
  const anySelected = items.some((it) => selected[it.key]);

  return (
    <Card className="overflow-hidden">
      <GradBanner>
        <span className="font-bold text-sm">Expense Pass-Through to Tenants (RUBS)</span>
        <span className="text-xs opacity-90">Based on actual reported expenses</span>
      </GradBanner>
      <div className="p-4 flex flex-col gap-4">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 w-8"></th><th className="py-2">Expense</th>
              <th className="text-right py-2">Annual Amount</th>
              <th className="text-right py-2 w-32">Recovery %</th>
              <th className="text-right py-2">Recovered / Yr</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const isOn = !!selected[it.key];
              const pctVal = recovery[it.key] ?? 100;
              const recovered = isOn ? it.value * (pctVal / 100) : 0;
              return (
                <tr key={it.key} className={`border-t border-gray-50 ${isOn ? "bg-emerald-50/50" : ""}`}>
                  <td className="py-2"><input type="checkbox" checked={isOn} onChange={() => toggle(it.key)} className="accent-emerald-500 w-4 h-4" /></td>
                  <td className="py-2">{it.label}</td>
                  <td className="text-right py-2"><Mono v={it.value} /></td>
                  <td className="text-right py-2">
                    <input type="number" min={0} max={100} value={pctVal} disabled={!isOn}
                      onChange={(e) => setRec(it.key, Number(e.target.value))}
                      className="w-16 text-right border border-gray-200 rounded px-1.5 py-0.5 text-xs disabled:bg-gray-50 disabled:text-gray-300" />
                    <span className="text-gray-400 text-xs ml-0.5">%</span>
                  </td>
                  <td className="text-right py-2"><Mono v={recovered} green={recovered > 0} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex gap-4 flex-wrap">
          <StatCard label="Total Annual NOI Increase" value={$f(totalAnnualIncrease)} valueClass="text-emerald-600" />
          <StatCard label="New NOI (Est.)" value={$f(newNOI)} sub={baseNOI ? `from ${$f(baseNOI)}` : undefined} />
          <StatCard label="Per Unit / Month" value={units ? $f(perUnitMonth) : "—"} />
          <StatCard label="Per Unit / Year" value={units ? $f(perUnitYear) : "—"} />
        </div>
        {!anySelected && <div className="text-xs text-gray-400">Select one or more expense line items above to see the NOI impact of billing them back to tenants.</div>}
      </div>
    </Card>
  );
}

/* -------- Expenses -------- */
function ExpensesTab({ M, scenarioData }) {
  const y1 = M.years[0];
  const keys = Object.keys(T12_LABELS);
  const dd = useDueDiligence();
  const [ddOpen, setDdOpen] = useState(false);
  const [verify, setVerify] = useState(false);
  const [verifyKey, setVerifyKey] = useState(keys[0]);
  const findings = dd.findings;
  const critCount = findings.filter((x) => x.severity === "critical").length;
  const runDueDiligence = () => {
    setDdOpen(true);
    dd.run({
      section: "expenses",
      dealName: scenarioData?.property?.address || CFG.deal.name,
      units: M.dealUnits,
      data: { rows: Object.fromEntries(keys.map((k) => [k, M.t12[k]])), labels: T12_LABELS },
    });
  };
  const openVerifyFor = (key) => { setVerifyKey(key); setVerify(true); };
  return (
    <div className="p-6 flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <div className="flex gap-2 items-center">
          <div className="relative"><Ghost onClick={() => (dd.hasRun ? setDdOpen(!ddOpen) : runDueDiligence())}><span className="text-teal-500">{I.spark}</span> {dd.loading ? "Analyzing…" : "Due Diligence"}</Ghost>
            {dd.hasRun && !dd.loading && <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{findings.length}</span>}</div>
          <Ghost onClick={() => openVerifyFor(verifyKey)} className="!border-emerald-300 !text-emerald-600"><span className="text-emerald-500">{I.check}</span> Verify Source</Ghost>
        </div>
      </div>
      {ddOpen && (
        <Card className="p-4 bg-amber-50/50 border-amber-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-semibold text-gray-800"><span className="text-amber-500">{I.warn}</span> Due Diligence <Pill tone="yellow">{findings.length} findings</Pill><Pill tone="orange">{critCount} critical</Pill></div>
            <div className="flex items-center gap-2">
              <button onClick={runDueDiligence} disabled={dd.loading} className="text-[11px] font-semibold text-emerald-600 hover:underline disabled:opacity-40">{dd.loading ? "Analyzing…" : "Re-run"}</button>
              <button onClick={() => setDdOpen(false)} className="text-gray-400">▾</button>
            </div>
          </div>
          {dd.loading && <div className="text-xs text-gray-500 py-2">Claude is reviewing the expense schedule for irregularities…</div>}
          {dd.error && <div className="text-xs text-red-500 py-2">{dd.error}</div>}
          {!dd.loading && !dd.error && findings.length === 0 && dd.hasRun && (
            <div className="text-xs text-gray-500 py-2">No material irregularities detected in the expense schedule.</div>
          )}
          {!dd.loading && findings.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {findings.map((f, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 w-full ${f.severity === "critical" ? "bg-red-50 border border-red-100" : "bg-amber-50 border border-amber-100"}`}>
                  <span className={f.severity === "critical" ? "text-red-400 mt-0.5" : "text-amber-500 mt-0.5"}>{f.severity === "critical" ? "⊙" : "↗"}</span>
                  <span className="text-gray-700 flex-1"><b>{f.label}</b> — {f.detail}</span>
                  {f.rowKey && <button onClick={() => openVerifyFor(f.rowKey)} className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Verify</button>}
                  {typeof f.month === "number" && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{MONTH_NAMES[f.month]}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      <div className="flex gap-4">
        <StatCard label="T-12 Total OpEx" value={$f(-M.T12.opex)} />
        <StatCard label="T-12 OpEx Ratio" value={pct(M.T12.opexRatio, 1)} />
        <StatCard label="Per Unit / Yr" value={$f(-M.T12.opex / M.dealUnits)} />
        <StatCard label="Year 1 Pro Forma OpEx" value={$f(-y1.opex)} />
      </div>
      <Card className="overflow-hidden">
        <div className={`px-4 py-3 ${GRAD} text-white font-bold text-sm`}>Operating Expense Detail — T-12 vs Pro Forma Yr 1</div>
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500 bg-gray-50"><th className="py-2.5 px-4">Category</th><th className="text-right px-4">T-12</th><th className="text-right px-4">Per Unit</th><th className="text-right px-4">% of EGR</th><th className="text-right px-4">Pro Forma Yr 1</th></tr></thead>
          <tbody>
            {keys.map((k) => {
              const v = sum(M.t12[k]);
              const flagged = findings.some((f) => f.rowKey === k);
              return (
                <tr key={k} className={`border-t border-gray-50 ${flagged ? "bg-amber-50" : ""}`}>
                  <td className="py-2.5 px-4 flex items-center gap-1.5">{T12_LABELS[k]}{flagged && <span className="text-amber-500" title="Flagged in Due Diligence">{I.warn}</span>}</td>
                  <td className="text-right px-4"><Mono v={v} /></td>
                  <td className="text-right px-4 text-gray-500">{$f(-v / M.dealUnits)}</td>
                  <td className="text-right px-4 text-gray-500">{pct(-v / M.T12.egr, 1)}</td>
                  <td className="text-right px-4"><Mono v={Math.round(v * (1 + CFG.assumptions.expGrowth))} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-red-50 font-bold border-t border-red-100"><td className="py-2.5 px-4">Total Operating Expenses</td><td className="text-right px-4"><Mono v={M.T12.opex} bold /></td><td className="text-right px-4">{$f(-M.T12.opex / M.dealUnits)}</td><td className="text-right px-4">{pct(M.T12.opexRatio, 1)}</td><td className="text-right px-4"><Mono v={Math.round(y1.opex)} bold /></td></tr>
            <tr className="bg-sky-50 font-bold"><td className="py-2.5 px-4">Net Operating Income (NOI)</td><td className="text-right px-4">{$f(M.T12.noi)}</td><td /><td /><td className="text-right px-4">{$f(Math.round(y1.noi))}</td></tr>
          </tfoot>
        </table>
      </Card>
      {verify && (
        <SourceVerificationPanel t={M.t12} M={M} fieldKey={verifyKey} month={0}
          onNavigate={(k) => setVerifyKey(k)} onClose={() => setVerify(false)} />
      )}
      <RealExpenseDataCard scenarioData={scenarioData} />
      <ExpensePassThroughCalculator scenarioData={scenarioData} />
    </div>
  );
}

/* -------- Cashflow -------- */
function CashflowTab({ M, S, set, cfView, pdfData, pdfUrl }) {
  const H = CFG.acq.holdYears;
  const years = M.years.slice(0, H);
  const isMonthly = cfView === "Monthly";
  const [open, setOpen] = useState({ rev: true, opex: true, fees: true, loan: true, jv: true, wc: true, acq: true });
  const flip = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const g = CFG.assumptions.expGrowth;
  const t12sum = (k) => sum(M.t12[k]);
  const wcap = CFG.acq.workingCapital;
  const loanFees = M.finFeeAmt;
  const Sect = ({ k, cls, children }) => (
    <tr className={cls}><td colSpan={isMonthly ? 13 : 3 + H} className="py-2 px-3 font-bold text-xs"><button onClick={() => flip(k)} className="flex items-center gap-1.5">{open[k] ? "\u2304" : "›"} {children}</button></td></tr>
  );
  const CFRow = ({ label, get, hist, closing, tone = "", bold, red, isPct }) => (
    <tr className={`border-t border-gray-50 ${tone}`}>
      <td className={`py-2 px-3 text-right sticky left-0 whitespace-nowrap ${bold ? "font-bold" : "text-gray-600"} ${tone || "bg-white"}`}>{label}</td>
      <td className="px-2 py-2 text-right text-[12px] border-l-2 border-emerald-200">{hist === undefined || hist === null ? "" : isPct ? <span className="text-gray-600">{pct(hist, 1)}</span> : <Mono v={Math.round(hist)} bold={bold} />}</td>
      <td className="px-2 py-2 text-right text-[12px] border-r-2 border-emerald-200">{closing === undefined || closing === null ? "" : <Mono v={Math.round(closing)} red={red} bold={bold} green={closing > 0} />}</td>
      {years.map((y, i) => <td key={i} className="px-2 py-2 text-right text-[12px]">{get ? (isPct ? <span className="text-gray-600">{pct(get(y, i), 1)}</span> : <Mono v={Math.round(get(y, i))} bold={bold} />) : ""}</td>)}
    </tr>
  );
  // Monthly view: Year 1 broken into 12 months. Revenue/expense lines come
  // straight from the real per-month T-12 (buildRealT12), debt service comes
  // from the real month-by-month amortization schedule — not a flat annual÷12
  // guess, except for the handful of fields (fees/capex) that only exist as
  // an annual figure to begin with.
  const CFRowM = ({ label, get, tone = "", bold, red, isPct }) => (
    <tr className={`border-t border-gray-50 ${tone}`}>
      <td className={`py-2 px-3 text-right sticky left-0 whitespace-nowrap ${bold ? "font-bold" : "text-gray-600"} ${tone || "bg-white"}`}>{label}</td>
      {Array.from({ length: 12 }, (_, i) => (
        <td key={i} className="px-2 py-2 text-right text-[12px]">
          {get ? (isPct ? <span className="text-gray-600">{pct(get(i), 1)}</span> : <Mono v={Math.round(get(i))} bold={bold} red={red} />) : ""}
        </td>
      ))}
    </tr>
  );
  const y1 = years[0];
  const t12M = (k, i) => (M.t12[k] ? M.t12[k][i] : 0);
  const monthlyDS = (i) => (M.amSchedule[i] ? M.amSchedule[i].pmt : 0);
  const monthlyNetRental = (i) => t12M("gpr", i) + t12M("physVac", i) + t12M("badDebt", i) + t12M("concessions", i) + t12M("otherLoss", i);
  const monthlyRubsInc = () => (M.rubsActive ? y1.rubsInc / 12 : 0);
  const monthlyOtherInc = (i) => t12M("otherIncome", i) + monthlyRubsInc();
  const monthlyEGR = (i) => monthlyNetRental(i) + monthlyOtherInc(i);
  const monthlyOpexTotal = (i) => Object.keys(T12_LABELS).reduce((s, k) => s + t12M(k, i), 0);
  const monthlyNOI = (i) => monthlyEGR(i) + monthlyOpexTotal(i);
  const monthlyAmFee = () => y1.amFee / 12;
  const monthlyCmFee = () => y1.cmFee / 12;
  const monthlyCapexSpend = () => y1.capexSpend / 12;
  const monthlyCapexRes = () => y1.capexRes / 12;
  const monthlyCFBDS = (i) => monthlyNOI(i) + monthlyAmFee() + monthlyCmFee() + monthlyCapexSpend() + monthlyCapexRes();
  const monthlyCFADS = (i) => monthlyCFBDS(i) - monthlyDS(i);
  const dsY = (i) => M.rowsCF[i].ds;
  const verify = useVerifyPanel();
  const cashflowVerifyFields = [
    { label: "T-12 GPR", value: $f(M.T12.gpr), source: "T-12 Operating Statement" },
    { label: "T-12 Total OpEx", value: $f(M.T12.opex), source: "T-12 Operating Statement" },
    { label: "Loan Amount", value: $f(M.loan), source: "Lender Term Sheet" },
    { label: "Year 1 NOI", value: $f(Math.round(years[0]?.noi || 0)), source: "Calculated" },
    { label: "Debt Service (Yr 1)", value: $f(Math.round(dsY(0) || 0)), source: "Calculated", note: "Derived from loan terms + amortization" },
    { label: "Sale Price (Exit)", value: $f(Math.round(M.salePrice)), source: "Calculated" },
  ];
  return (
    <div className="p-6 flex flex-col gap-5 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GradPill>{I.chart} Pro Forma Cash Flow</GradPill>
          <select value={S.incomeMethod} onChange={(e) => set({ incomeMethod: e.target.value })}
            className="text-sm text-emerald-700 font-semibold border border-emerald-200 bg-emerald-50 rounded-lg px-2 py-1 outline-none">
            {Object.entries(INCOME_METHOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="flex gap-2"><VerifyButton onClick={verify.toggle} /><Ghost>{I.sliders} Controls</Ghost></div>
      </div>
      {isMonthly && <div className="text-xs text-gray-400">Monthly view of Year 1 — revenue/expense lines from the real parsed T-12's month-by-month figures, debt service from the actual amortization schedule.</div>}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {isMonthly ? (
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white" />
                <th colSpan={12} className={`${GRAD} text-white text-xs font-bold py-2`}>↗ Year 1 — Monthly Pro Forma</th>
              </tr>
              <tr className="bg-emerald-50/60">
                <th className="text-right py-2 px-3 text-[11px] text-gray-500 sticky left-0 bg-emerald-50/60">Month</th>
                {MONTH_NAMES.map((m) => <th key={m} className="px-2 py-2 text-center text-[11px] text-gray-500">{m}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white">
              <Sect k="rev" cls="bg-emerald-50 text-emerald-700">💲 REVENUE</Sect>
              {open.rev && (<>
                <CFRowM label="Gross Potential Rental Revenue" get={(i) => t12M("gpr", i)} />
                <CFRowM label="Physical Vacancy" get={(i) => t12M("physVac", i)} />
                <CFRowM label="Bad Debt" get={(i) => t12M("badDebt", i)} />
                <CFRowM label="Concessions" get={(i) => t12M("concessions", i)} />
                <CFRowM label="Other Loss" get={(i) => t12M("otherLoss", i)} />
                <CFRowM label="Net Rental Income" get={monthlyNetRental} />
                {M.rubsActive && <CFRowM label="RUBS Reimbursement Income" get={monthlyRubsInc} />}
                <CFRowM label="Total Other Income" get={(i) => t12M("otherIncome", i)} />
              </>)}
              <CFRowM label="Effective Gross Revenue" get={monthlyEGR} tone="bg-emerald-50" bold />
              <Sect k="opex" cls="bg-red-50 text-red-500">OPERATING EXPENSES ⚙</Sect>
              {open.opex && (<>
                <CFRowM label="Operating Expense Ratio" get={(i) => -monthlyOpexTotal(i) / monthlyEGR(i)} isPct />
                {Object.keys(T12_LABELS).map((k) => (
                  <CFRowM key={k} label={T12_LABELS[k]} get={(i) => t12M(k, i)} />
                ))}
              </>)}
              <CFRowM label="Total Operating Expenses" get={monthlyOpexTotal} tone="bg-red-50" bold />
              <CFRowM label="Net Operating Income (NOI)" get={monthlyNOI} tone="bg-sky-50" bold />
              <Sect k="fees" cls="text-gray-500">ADDITIONAL FEES</Sect>
              {open.fees && (<>
                <CFRowM label="Construction Management Fee" get={monthlyCmFee} />
                <CFRowM label="Asset Management Fee" get={monthlyAmFee} />
                <CFRowM label="Renovations / CapEx" get={monthlyCapexSpend} red />
                <CFRowM label="CapEx Reserves" get={monthlyCapexRes} />
              </>)}
              <CFRowM label="Cash Flow Before Debt Service" get={monthlyCFBDS} tone="bg-emerald-50" bold />
              <Sect k="loan" cls="text-gray-500">LOAN INFORMATION</Sect>
              {open.loan && (<>
                <CFRowM label="Debt Service (P&I)" get={(i) => -monthlyDS(i)} red />
              </>)}
              <CFRowM label="Cash Flow After Debt Service" get={monthlyCFADS} tone="bg-emerald-50" bold />
            </tbody>
          </table>
          ) : (
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white" />
                <th colSpan={2} className={`${GRAD} text-white text-xs font-bold py-2 px-3`}>📊 Historical (Actuals)</th>
                <th colSpan={H} className={`${GRAD} text-white text-xs font-bold py-2`}>↗ Pro-Forma</th>
              </tr>
              <tr className="bg-emerald-50/60">
                <th className="text-right py-2 px-3 text-[11px] text-gray-500 sticky left-0 bg-emerald-50/60">Year<br/>Period</th>
                <th className="px-2 py-2 text-center border-l-2 border-emerald-200"><Pill tone="purple">T-12</Pill><div className="text-[10px] text-gray-400 mt-0.5">Jul–Jun 25</div></th>
                <th className="px-2 py-2 text-center border-r-2 border-emerald-200"><Pill tone="purple">Closing</Pill><div className="text-[10px] text-gray-400 mt-0.5">{CFG.acq.closingDate}</div></th>
                {years.map((y) => <th key={y.y} className="px-2 py-2 text-center"><span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold inline-flex items-center justify-center">{y.y}</span><div className="text-[10px] text-gray-400 mt-0.5">3/31/{26 + y.y}</div></th>)}
              </tr>
            </thead>
            <tbody className="bg-white">
              <Sect k="rev" cls="bg-emerald-50 text-emerald-700">💲 REVENUE</Sect>
              {open.rev && (<>
                <CFRow label="Gross Potential Rental Revenue" hist={M.T12.gpr} get={(y) => y.gprY} />
                <CFRow label="Physical Vacancy" hist={sum(M.t12.physVac)} get={(y) => y.physVac} />
                <CFRow label="Bad Debt" hist={sum(M.t12.badDebt)} get={(y) => y.badDebt} />
                <CFRow label="Concessions" hist={sum(M.t12.concessions)} get={(y) => y.conc} />
                <CFRow label="Other Loss" hist={sum(M.t12.otherLoss)} get={() => 0} />
                <CFRow label="Net Rental Income" hist={sum(M.T12.netRental)} get={(y) => y.netRental} />
                {M.rubsActive && <CFRow label="RUBS Reimbursement Income" get={(y) => y.rubsInc} />}
                <CFRow label="Total Other Income" hist={sum(M.t12.otherIncome)} get={(y) => y.otherInc} />
              </>)}
              <CFRow label="Effective Gross Revenue" hist={M.T12.egr} get={(y) => y.egr} tone="bg-emerald-50" bold />
              <Sect k="opex" cls="bg-red-50 text-red-500">OPERATING EXPENSES ⚙</Sect>
              {open.opex && (<>
                <CFRow label="Operating Expense Ratio" hist={M.T12.opexRatio} get={(y) => y.opexRatio} isPct />
                {Object.keys(T12_LABELS).map((k) => (
                  <CFRow key={k} label={T12_LABELS[k]} hist={t12sum(k)} get={(y) => t12sum(k) * Math.pow(1 + g, y.y)} />
                ))}
              </>)}
              <CFRow label="Total Operating Expenses" hist={M.T12.opex} get={(y) => y.opex} tone="bg-red-50" bold />
              <CFRow label="Net Operating Income (NOI)" hist={M.T12.noi} get={(y) => y.noi} tone="bg-sky-50" bold />
              <Sect k="fees" cls="text-gray-500">ADDITIONAL FEES</Sect>
              {open.fees && (<>
                <CFRow label="Construction Management Fee" get={(y) => y.cmFee} />
                <CFRow label="Asset Management Fee" get={(y) => y.amFee} />
                <CFRow label="Renovations / CapEx" closing={S.capexMode === "closing" ? -M.capexAtClosing : null} get={(y) => y.capexSpend} red />
                <CFRow label="CapEx Reserves" get={(y) => y.capexRes} />
              </>)}
              <CFRow label="Cash Flow Before Debt Service" get={(y) => y.cfbds} tone="bg-emerald-50" bold />
              <Sect k="loan" cls="text-gray-500">LOAN INFORMATION</Sect>
              {open.loan && (<>
                <CFRow label="Loan Funding" closing={M.loan} get={() => 0} />
                <CFRow label="Total Payment" closing={0} get={(y, i) => -dsY(i)} />
                <CFRow label="Loan Payoff" closing={0} get={(y, i) => i === H - 1 ? -M.exitPayoff : (M.refiActive && i === S.refiYear - 1 ? -M.oldPayoffAtRefi : 0)} />
                <CFRow label="Loan Fees" closing={-loanFees} get={() => 0} red />
              </>)}
              <CFRow label="Cash Flow After Debt Service" get={(y, i) => M.rowsCF[i].cfads} tone="bg-emerald-50" bold />
              {M.jvOn && (<>
                <Sect k="jv" cls="text-emerald-700 bg-emerald-50/60">🤝 JOINT VENTURE &amp; REFINANCE</Sect>
                {open.jv && (<>
                  <CFRow label="Refinance Proceeds (Net)" get={(y, i) => M.refiActive && i === S.refiYear - 1 ? M.netRefi : 0} />
                  <CFRow label="JV Preferred Payments" get={(y, i) => -(M.jvYears[i] ? M.jvYears[i].paid : 0)} />
                  <CFRow label="JV Buyout (Capital + Accrual)" get={(y, i) => i === M.jvBuyoutYear - 1 ? -M.jvBuyoutPaid : (i === H - 1 ? -M.jvDeferred : 0)} />
                  <CFRow label="Sponsor Net Cash Flow" get={(y, i) => M.lev[i + 1] - (M.jvYears[i] ? M.jvYears[i].paid : 0) - (i + 1 === M.jvBuyoutYear ? M.jvBuyoutPaid : 0) - (i === H - 1 ? M.jvDeferred : 0)} tone="bg-emerald-50" bold />
                </>)}
              </>)}
              <Sect k="wc" cls="text-gray-500">WORKING CAPITAL FUNDING</Sect>
              {open.wc && (<>
                <CFRow label="Working Capital Contributed" closing={wcap} get={() => 0} />
                <CFRow label="Working Capital Drawdown" get={() => 0} />
              </>)}
              <Sect k="acq" cls="text-gray-500">ACQUISITION &amp; SALE INFORMATION</Sect>
              {open.acq && (<>
                <CFRow label="Purchase Price" closing={-M.purchasePrice} red />
                <CFRow label="Closing Costs" closing={-CFG.acq.closingCosts} red />
                <CFRow label="Sale Price" get={(y, i) => i === H - 1 ? M.salePrice : 0} />
                <CFRow label="Costs of Sale" get={(y, i) => i === H - 1 ? M.costsOfSale : 0} />
                <CFRow label="Acquisition Fee" closing={-M.acqFeeAmt} red />
                <CFRow label="Financing Fee" closing={-M.finFeeAmt} red />
                <CFRow label="Disposition Fee" get={(y, i) => i === H - 1 ? M.dispFee : 0} />
              </>)}
              <tr className="bg-emerald-50 border-t-2 border-emerald-200 font-bold">
                <td className="py-2.5 px-3 text-right sticky left-0 bg-emerald-50">Net Levered Cash Flow</td>
                <td className="px-2 text-right text-[12px] border-l-2 border-emerald-200"></td>
                <td className="px-2 text-right text-[12px] border-r-2 border-emerald-200"><Mono v={Math.round(M.lev[0])} bold /></td>
                {M.lev.slice(1).map((v, i) => <td key={i} className="px-2 text-right text-[12px]"><Mono v={Math.round(v)} bold /></td>)}
              </tr>
            </tbody>
          </table>
          )}
        </div>
      </Card>
      {verify.open && <DocSourcePanel title="Cashflow" fields={cashflowVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

/* -------- Renovations -------- */
function RenovationsTab({ M, S, set, pdfData, pdfUrl }) {
  const [modal, setModal] = useState(false);
  const data = useMemo(() => {
    let running = 0;
    return S.distWeights.map((w, i) => {
      const v = Math.round(M.spend[i]);
      running += v;
      return { m: `M${i + 1}`, v, cumulative: running };
    });
  }, [S.distWeights, M.spend]);
  const peak = Math.max(...M.spend);
  const verify = useVerifyPanel();
  const renoVerifyFields = [
    { label: "Units to Renovate", value: `${M.renoCount} / ${M.dealUnits}`, source: "Rent Roll" },
    { label: "Reno Cost / Unit", value: $f(S.renoCost), source: "Model Assumption" },
    { label: "Total CapEx Budget", value: $f(M.totalRenoCost), source: "Calculated" },
    { label: "Rent Premium / Unit", value: $f(S.renoPremium) + "/mo", source: "Model Assumption" },
  ];
  return (
    <div className="p-6 flex flex-col gap-5 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Renovations &amp; CapEx</h1>
        <VerifyButton onClick={verify.toggle} />
      </div>
      <div>
        <button onClick={() => setModal(true)} className="bg-blue-600 hover:bg-blue-700 transition text-white text-xs font-bold px-4 py-2 rounded-lg uppercase">Renovation Timeline Preview</button>
      </div>
      <Card className="p-5">
        <div className="flex items-center gap-3 text-sm mb-3">
          <span className="text-gray-500">Active Period:</span>
          <span className="font-bold bg-gray-100 rounded px-2 py-0.5">M1 → M{CFG.reno.months}</span>
          <span className="text-gray-500">Custom Timelines:</span><Pill tone="purple">1 items</Pill>
          <span className="ml-auto text-xs text-gray-400">ⓘ Click Timeline on each item to customize</span>
        </div>
        <div className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">{I.trend} Monthly Renovation Spend Preview</div>
        <div className="h-44">
          <ResponsiveContainer>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} />
              <RTooltip content={({ active, payload, label }) => active && payload && payload.length ? (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs">
                  <div className="font-bold text-gray-800">Month {String(label).replace("M", "")}</div>
                  <div className="text-emerald-600">Spend: {$f(payload.find((p) => p.dataKey === "v")?.value || 0)}</div>
                  <div className="text-blue-600">Cumulative: {$f(payload.find((p) => p.dataKey === "cumulative")?.value || 0)}</div>
                  <div className="text-gray-400">{M.totalRenoCost > 0 ? pct((payload.find((p) => p.dataKey === "v")?.value || 0) / M.totalRenoCost, 1) : "0%"} of total</div>
                </div>
              ) : null} />
              <Bar yAxisId="left" dataKey="v" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3, fill: "#2563EB" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 justify-center text-[11px] text-gray-500 mt-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Monthly Spend</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Cumulative Spend</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Total Budget: {$f(M.totalRenoCost)}</span><span>Peak Month: {$f(peak)}</span></div>
      </Card>
      <GradBanner><span className="font-bold text-lg">CapEx Budget Total: {$f(M.totalRenoCost)}</span><span>{I.dl}</span></GradBanner>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Category</th><th>Item</th><th className="text-right px-4">Cost</th><th className="text-right px-4">Per Unit</th><th className="text-right px-4">Units</th><th className="px-4">Timeline</th><th /></tr></thead>
          <tbody>
            <tr className="bg-sky-50/60 border-t border-sky-100"><td className="py-2.5 px-4">＋</td><td className="font-bold text-sky-800">Exterior Subtotal</td><td className="text-right px-4">$0</td><td colSpan={4} /></tr>
            <tr className="border-t border-gray-50">
              <td className="py-2.5 px-4"><Pill tone="green">Interior</Pill></td>
              <td className="flex items-center gap-2 py-2.5">Interior Renovations <Pill tone="purple">⟲ Synced</Pill></td>
              <td className="text-right px-4 font-semibold">{$f(M.totalRenoCost)}</td>
              <td className="text-right px-4">{$f(S.renoCost)}</td>
              <td className="text-right px-4">{M.renoCount}</td>
              <td className="px-4"><button onClick={() => setModal(true)} className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full">🗓 M1–{CFG.reno.months}</button></td>
              <td className="px-2 text-red-400">{I.trash}</td>
            </tr>
            <tr className="bg-emerald-50/60 border-t border-emerald-100"><td className="py-2.5 px-4">＋</td><td className="font-bold text-emerald-700">Interior Subtotal</td><td className="text-right px-4 font-bold">{$f(M.totalRenoCost)}</td><td colSpan={4} /></tr>
            <tr className="bg-orange-50/60 border-t border-orange-100"><td className="py-2.5 px-4">＋</td><td className="font-bold text-orange-600">Misc. Fees Subtotal</td><td className="text-right px-4">$0</td><td colSpan={4} /></tr>
            <tr className="bg-emerald-50 border-t border-emerald-100 font-bold"><td className="py-3 px-4" /><td>Grand Total</td><td className="text-right px-4">{$f(M.totalRenoCost)}</td><td colSpan={4} /></tr>
          </tbody>
        </table>
      </Card>
      {modal && <TimelineModal M={M} S={S} set={set} onClose={() => setModal(false)} />}
      {verify.open && <DocSourcePanel title="Renovations" fields={renoVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}
function TimelineModal({ M, S, set, onClose }) {
  const [weights, setWeights] = useState([...S.distWeights]);
  const [startM, setStartM] = useState(1);
  const [endM, setEndM] = useState(CFG.reno.months);
  const masked = weights.map((w, i) => (i + 1 >= startM && i + 1 <= endM ? w : 0));
  const wSum = sum(masked) || 1;
  const presets = {
    "Front 3mo": { g: "▛", w: [3, 3, 3, 1, 1, 1] }, "Front 6mo": { g: "▙", w: [2, 2, 2, 1.5, 1.2, 1] },
    "Back Load": { g: "▟", w: [1, 1, 1, 3, 3, 3] }, Even: { g: "▬", w: [1, 1, 1, 1, 1, 1] },
    "Ramp Up": { g: "◢", w: [1, 2, 3, 4, 5, 6] }, "Ramp Down": { g: "◣", w: [6, 5, 4, 3, 2, 1] },
  };
  const data = masked.map((w, i) => ({ m: `M${i + 1}`, v: Math.round((w / wSum) * M.totalRenoCost) }));
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-start mb-1">
          <div><div className="text-lg font-bold text-gray-900">Timeline &amp; Distribution: Interior Renovations</div>
            <div className="text-sm text-gray-500">Set the start/end months and drag bars to customize monthly spend distribution.</div></div>
          <button onClick={onClose} className="text-gray-400">{I.x}</button>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-8 mt-4">
          <div><div className="text-sm font-semibold text-gray-700 mb-2">Start Month</div>
            <input type="range" min="1" max={CFG.reno.months} value={startM} onChange={(e) => { const v = Math.min(parseInt(e.target.value, 10), endM); setStartM(v); }} className="w-full accent-emerald-500" />
            <div className="text-center text-sm text-gray-500 mt-1">Month {startM}</div></div>
          <div><div className="text-sm font-semibold text-gray-700 mb-2">End Month</div>
            <input type="range" min="1" max={CFG.reno.months} value={endM} onChange={(e) => { const v = Math.max(parseInt(e.target.value, 10), startM); setEndM(v); }} className="w-full accent-emerald-500" />
            <div className="text-center text-sm text-gray-500 mt-1">Month {endM}</div></div>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center mt-3">
          <span className="flex items-center gap-2 text-sm text-gray-600">{I.dollar} Item Budget:</span>
          <span className="font-bold">{$f(M.totalRenoCost)}</span>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {Object.keys(presets).map((p) => <Ghost key={p} onClick={() => setWeights(presets[p].w)}><span className="text-teal-400">{presets[p].g}</span> {p}</Ghost>)}
        </div>
        <div className="h-52 mt-3 border border-gray-100 rounded-xl p-2">
          <ResponsiveContainer>
            <BarChart data={data}><XAxis dataKey="m" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} /><RTooltip formatter={(v) => $f(v)} /><Bar dataKey="v" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center mt-3">
          <span className="font-bold text-gray-800">Total:</span>
          <span className="font-bold text-emerald-600">{pct(sum(masked.map((w) => w / wSum)), 2)}</span>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Ghost onClick={onClose}>Cancel</Ghost>
          <Primary onClick={() => { set({ distWeights: masked }); onClose(); }}>Apply Distribution</Primary>
        </div>
      </div>
    </div>
  );
}

/* -------- Waterfall -------- */
function WaterfallTab({ M, S, set, pdfData, pdfUrl }) {
  const [mode, setMode] = useState("$");
  const WF = CFG.waterfall;
  const fmtV = (v, tot) => (mode === "$" ? $f(Math.round(v)) : pct(tot > 0 ? v / tot : 0));
  const FeeInput = ({ label, value, onChange, amount, note }) => (
    <div>
      <div className="text-sm font-semibold text-gray-700 mb-1.5">{label} ⓘ</div>
      <Input w="w-full" value={fm(value * 100, 2)} onChange={(v) => onChange((parseFloat(v) || 0) / 100)} suffix="%" />
      <div className="text-sm text-gray-500 mt-1">{$f(Math.round(amount))}{note ? <span className="italic text-gray-400"> ({note})</span> : null}</div>
    </div>
  );
  const verify = useVerifyPanel();
  const waterfallVerifyFields = [
    { label: "Total Equity", value: $f(Math.round(M.equity)), source: "Calculated" },
    { label: "Preferred Return", value: pct(WF.pref), source: "Model Assumption", note: "Operating agreement terms" },
    { label: "GP Promote", value: pct(WF.promote), source: "Model Assumption" },
    { label: "LP Share", value: pct(M.lpShare), source: "Model Assumption" },
  ];
  return (
    <div className="p-6 flex flex-col gap-5 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Equity Waterfall</h1>
        <div className="flex gap-2 items-center">
          <VerifyButton onClick={verify.toggle} />
          <Ghost onClick={() => exportWorkbook(M, S)}>{I.dl} Export</Ghost>
          <span className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-800 bg-white">Total Equity: {$f(Math.round(M.equity))}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-lg text-gray-900">Investment Structure</div>
            <div className="flex gap-1">
              {["$", "%"].map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`w-9 h-9 rounded-lg text-sm font-bold ${mode === m ? "bg-emerald-500 text-white" : "bg-white border border-gray-200 text-gray-500"}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-1.5">GP Investment</div>
            <div className="flex items-center gap-3">
              <Input w="w-56" value={fm(Math.round(M.gpEq))} onChange={(v) => {
                const amt = parseInt(String(v).replace(/,/g, ""), 10) || 0;
                set({ gpPct: Math.max(0, Math.min(M.equity > 0 ? amt / M.equity : 0, 1)) });
              }} />
              <span className="text-sm text-gray-500 font-semibold">{pct(S.gpPct)}</span>
            </div>
          </div>
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-1.5">LP Investment</div>
            <div className="flex items-center gap-3">
              <Input w="w-56" value={fm(Math.round(M.lpEq))} readOnly />
              <span className="text-sm text-gray-500 font-semibold">{pct(M.lpShare)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <span className="font-bold text-gray-800">Total Equity Used:</span>
            <span className="bg-emerald-500 text-white text-sm font-bold px-3 py-1 rounded-full">{$f(Math.round(M.equity))}</span>
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-bold text-lg text-gray-900 mb-4">GP Fee Structure</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <FeeInput label="Acquisition Fee" value={S.acqFeePct} onChange={(v) => set({ acqFeePct: v })} amount={M.acqFeeAmt} />
            <FeeInput label="Financing Fee" value={S.loanFeesPct} onChange={(v) => set({ loanFeesPct: v })} amount={M.finFeeAmt} />
            <FeeInput label="Construction Management Fee" value={S.cmFeePct} onChange={(v) => set({ cmFeePct: v })} amount={M.cmFeeAmt} />
            <FeeInput label="Asset Management Fee" value={S.amFeePct} onChange={(v) => set({ amFeePct: v })} amount={M.amFeeYr.reduce((a, b) => a + b, 0)} note="total" />
            <FeeInput label="Disposition Fee" value={S.dispFeePct} onChange={(v) => set({ dispFeePct: v })} amount={M.dispFeeAmt} />
          </div>
        </Card>
      </div>
      <Card className="p-5 border-l-4 border-l-emerald-500">
        <div className="font-bold text-lg text-gray-900 mb-3">GP Total Compensation Summary</div>
        <div className="grid grid-cols-4 gap-4 items-start">
          <div><div className="text-sm text-gray-500">Total GP Promote (Performance)</div><div className="text-2xl font-bold text-gray-900 mt-1">{$f(Math.round(M.gpPromoteTotal))}</div></div>
          <div><div className="text-sm text-gray-500">GP Cashflow (Excl. Promote)</div><div className="text-2xl font-bold text-gray-900 mt-1">{$f(Math.round(M.gpCFexPromote))}</div></div>
          <div><div className="text-sm text-gray-500">› Fee-Based Compensation</div><div className="text-2xl font-bold text-gray-900 mt-1">{$f(Math.round(M.gpFeeTotal))}</div></div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3"><div className="text-sm text-emerald-700 font-semibold">Total GP Compensation</div><div className="text-2xl font-bold text-gray-900 mt-1">{$f(Math.round(M.gpCompTotal))}</div></div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-5">
          <Pill tone="purple">GP Returns</Pill>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div><div className="text-[11px] font-bold text-gray-400 uppercase">IRR</div><div className="text-2xl font-bold text-gray-900">{M.gpIRR === null ? "—" : pct(M.gpIRR)}</div></div>
            <div><div className="text-[11px] font-bold text-gray-400 uppercase">Equity Multiple</div><div className="text-2xl font-bold text-gray-900">{M.gpEM === null ? "—" : `${fm(M.gpEM, 2)}x`}</div></div>
          </div>
          <div className="text-[11px] text-gray-400 mt-2">Includes fees and promote on {pct(S.gpPct)} co-invest.</div>
        </Card>
        <Card className="p-5">
          <Pill tone="green">LP Returns</Pill>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div><div className="text-[11px] font-bold text-gray-400 uppercase">IRR</div><div className="text-2xl font-bold text-gray-900">{M.lpIRR === null ? "—" : pct(M.lpIRR)}</div></div>
            <div><div className="text-[11px] font-bold text-gray-400 uppercase">Equity Multiple</div><div className="text-2xl font-bold text-gray-900">{M.lpEM === null ? "—" : `${fm(M.lpEM, 2)}x`}</div></div>
          </div>
          <div className="text-[11px] text-gray-400 mt-2">Pro-rata distributions after {pct(WF.pref, 0)} pref, net of GP promote.</div>
        </Card>
      </div>
      <GradBanner gradient="bg-gradient-to-r from-emerald-500 to-teal-600">
        <span className="font-bold text-sm tracking-wide">🤝 JOINT VENTURE — EQUITY PARTNER</span>
        <Toggle green={false} on={S.jvOn} onChange={(v) => set({ jvOn: v, refiOn: v ? true : S.refiOn })} />
      </GradBanner>
      {S.jvOn && (<>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-4">An equity partner funds the down payment, closing costs, and fees. They earn a preferred return — paid from cash flow when it supports it — and are bought out from refinance proceeds at the end of the value-add.</div>
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <div><div className="text-sm font-semibold text-gray-700 mb-1.5">Partner Share of Equity</div>
              <Input w="w-full" value={fm(S.jvContribPct * 100, 0)} onChange={(v) => set({ jvContribPct: Math.max(0, Math.min((parseFloat(v) || 0) / 100, 1)) })} suffix="%" />
              <div className="text-sm text-gray-500 mt-1">{$f(Math.round(M.jvCap))} of {$f(Math.round(M.equity))} total equity</div></div>
            <div><div className="text-sm font-semibold text-gray-700 mb-1.5">Preferred Return</div>
              <Input w="w-full" value={fm(S.jvPrefRate * 100, 1)} onChange={(v) => set({ jvPrefRate: Math.max(0, (parseFloat(v) || 0) / 100) })} suffix="%" />
              <div className="text-sm text-gray-500 mt-1">{$f(Math.round(M.jvCap * S.jvPrefRate))}/yr ({$f(Math.round(M.jvCap * S.jvPrefRate / 12))}/mo)</div></div>
            <div><div className="text-sm font-semibold text-gray-700 mb-1.5">Refinance / Buyout Year</div>
              <Input w="w-full" value={S.refiYear} onChange={(v) => set({ refiYear: Math.max(1, Math.min(parseInt(v, 10) || 1, CFG.acq.holdYears - 1)) })} suffix="yr" />
              <div className="text-sm text-gray-500 mt-1">End of value-add period</div></div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Payment Structure</div>
            <div className="grid grid-cols-2 gap-3">
              {[["current", "Pay Monthly from Cash Flow", "Preferred return paid as cash flow allows — any shortfall accrues to the buyout"], ["accrue", "Accrue & Buyout at Refi", "Nothing paid until refinance — pref compounds and is paid with capital at the buyout"]].map(([k, t, d]) => (
                <button key={k} onClick={() => set({ jvMode: k })} className={`border rounded-xl p-3 flex gap-2 items-start text-left ${S.jvMode === k ? "border-emerald-400 bg-emerald-50" : "border-gray-200"}`}>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${S.jvMode === k ? "border-emerald-600" : "border-gray-300"}`}>{S.jvMode === k && <span className="w-2 h-2 bg-emerald-600 rounded-full" />}</span>
                  <span><b className="text-sm">{t}</b><span className="block text-[11px] text-gray-500">{d}</span></span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4">
            <div><div className="text-sm font-semibold text-gray-700 mb-1.5">Refinance LTV</div>
              <Input w="w-full" value={fm(S.refiLTV * 100, 0)} onChange={(v) => set({ refiLTV: Math.max(0, Math.min((parseFloat(v) || 0) / 100, 0.9)) })} suffix="%" /></div>
            <div><div className="text-sm font-semibold text-gray-700 mb-1.5">Refinance Rate</div>
              <Input w="w-full" value={fm(S.refiRate * 100, 2)} onChange={(v) => set({ refiRate: Math.max(0, (parseFloat(v) || 0) / 100) })} suffix="%" /></div>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 font-bold text-sm text-emerald-800">Refinance at End of Year {S.refiYear} — funds the buyout</div>
          <div className="grid grid-cols-5 divide-x divide-gray-100">
            {[["Stabilized Value", M.refiValue, `NOI ÷ ${pct(S.exitCap)} cap`], ["New Loan", M.refiLoan, `${pct(S.refiLTV, 0)} LTV @ ${pct(S.refiRate)}`],
              ["Bridge Payoff", -M.oldPayoffAtRefi, "retires existing debt"], ["Refi Fees", -M.refiFees, "1% of new loan"],
              ["Net Proceeds", M.netRefi, "available for buyout"]].map(([l, v, s]) => (
              <div key={l} className="p-3"><div className="text-[11px] font-bold text-gray-400 uppercase">{l}</div>
                <div className={`text-lg font-bold ${v < 0 ? "text-red-500" : "text-gray-900"}`}>{$f(Math.round(v))}</div>
                <div className="text-[10px] text-gray-400">{s}</div></div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className={`px-4 py-3 ${GRAD} text-white font-bold text-sm`}>Partner Ledger — pref owed, paid, and accrued to buyout</div>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-gray-500 bg-gray-50"><th className="py-2.5 px-4">Year</th><th className="text-right px-4">Pref Owed</th><th className="text-right px-4">Paid from Cash Flow</th><th className="text-right px-4">Shortfall Accrued</th><th className="text-right px-4">Partner Balance</th></tr></thead>
            <tbody>
              {M.jvYears.filter((r) => r.y <= M.jvBuyoutYear).map((r) => (
                <tr key={r.y} className="border-t border-gray-50">
                  <td className="py-2.5 px-4 font-semibold">Year {r.y}</td>
                  <td className="text-right px-4">{$f(Math.round(r.owed))}</td>
                  <td className="text-right px-4 text-emerald-600 font-semibold">{$f(Math.round(r.paid))}</td>
                  <td className="text-right px-4 text-orange-500">{$f(Math.round(r.accrued))}</td>
                  <td className="text-right px-4 font-semibold">{$f(Math.round(r.balance))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-emerald-50 font-bold border-t border-emerald-100">
              <td className="py-2.5 px-4">Buyout at Year {M.jvBuyoutYear}</td>
              <td className="text-right px-4">{$f(Math.round(M.jvBuyoutOwed))}</td>
              <td className="text-right px-4 text-emerald-700">{$f(Math.round(M.jvBuyoutPaid))} paid</td>
              <td className="text-right px-4 text-orange-500">{M.jvDeferred > 1 ? `${$f(Math.round(M.jvDeferred))} deferred to sale` : "—"}</td>
              <td className="text-right px-4">$0 after</td>
            </tr></tfoot>
          </table>
        </Card>
        <div className="grid grid-cols-2 gap-5">
          <Card className="p-5">
            <Pill tone="green">Equity Partner Returns</Pill>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div><div className="text-[11px] font-bold text-gray-400 uppercase">IRR</div><div className="text-2xl font-bold text-gray-900">{M.jvIRR === null ? "—" : pct(M.jvIRR)}</div></div>
              <div><div className="text-[11px] font-bold text-gray-400 uppercase">Equity Multiple</div><div className="text-2xl font-bold text-gray-900">{M.jvEM === null ? "—" : `${fm(M.jvEM, 2)}x`}</div></div>
            </div>
            <div className="text-[11px] text-gray-400 mt-2">{$f(Math.round(M.jvCap))} in · pref {pct(S.jvPrefRate, 1)} · out at year {M.jvBuyoutYear}.</div>
          </Card>
          <Card className="p-5">
            <Pill tone="purple">Sponsor (You) Net Returns</Pill>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div><div className="text-[11px] font-bold text-gray-400 uppercase">IRR</div><div className="text-2xl font-bold text-gray-900">{M.sponsorIRR === null ? "—" : M.sponsorEq <= 0 ? "∞" : pct(M.sponsorIRR)}</div></div>
              <div><div className="text-[11px] font-bold text-gray-400 uppercase">Equity Multiple</div><div className="text-2xl font-bold text-gray-900">{M.sponsorEM === null ? "—" : `${fm(M.sponsorEM, 2)}x`}</div></div>
            </div>
            <div className="text-[11px] text-gray-400 mt-2">{$f(Math.round(M.sponsorEq))} of your own capital after the partner funds {pct(S.jvContribPct, 0)}.</div>
          </Card>
        </div>
      </>)}
      <Card className="overflow-hidden">
        <div className={`px-4 py-3 ${GRAD} text-white font-bold text-sm`}>Distribution Waterfall by Year ({mode === "$" ? "dollars" : "% of distributable"})</div>
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500 bg-gray-50"><th className="py-2.5 px-4">Year</th><th className="text-right px-4">Distributable CF</th><th className="text-right px-4">Tier 1 · Pref ({pct(WF.pref, 0)})</th><th className="text-right px-4">Tier 2 · Return of Capital</th><th className="text-right px-4">Tier 3 · Residual</th><th className="text-right px-4">GP Promote</th></tr></thead>
          <tbody>
            {M.wfRows.map((r) => (
              <tr key={r.y} className="border-t border-gray-50">
                <td className="py-2.5 px-4 font-semibold">Year {r.y}</td>
                <td className="text-right px-4"><Mono v={Math.round(r.cf)} /></td>
                <td className="text-right px-4">{fmtV(r.prefPaid, r.cf)}</td>
                <td className="text-right px-4">{fmtV(r.roc, r.cf)}</td>
                <td className="text-right px-4">{fmtV(r.lpResid, r.cf)}</td>
                <td className="text-right px-4 font-semibold text-emerald-700">{fmtV(r.gpPromote, r.cf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {verify.open && <DocSourcePanel title="Equity Waterfall" fields={waterfallVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

/* -------- Financing -------- */
// Given target DSCR / debt yield / max LTV constraints, computes the
// largest loan each one supports (using the deal's real Year-1 NOI and the
// currently-selected rate/amortization) and applies whichever is most
// conservative (lowest) — the same "size to the tightest constraint"
// convention lenders actually use.
function LoanSizingModal({ M, S, set, onClose }) {
  const noi = M.years[0]?.noi || 0;
  const [targetDscr, setTargetDscr] = useState("1.25");
  const [targetDy, setTargetDy] = useState("10");
  const [maxLtvPct, setMaxLtvPct] = useState(fm(S.ltv * 100, 0));
  const unitPmt = annuityPmt(1, M.rate, S.amort); // monthly payment per $1 of loan
  const dscrNum = parseFloat(targetDscr) || 0;
  const dyNum = parseFloat(targetDy) || 0;
  const ltvNum = parseFloat(maxLtvPct) || 0;
  const loanByDscr = dscrNum > 0 && unitPmt > 0 ? (noi / dscrNum / 12) / unitPmt : null;
  const loanByDy = dyNum > 0 ? noi / (dyNum / 100) : null;
  const loanByLtv = ltvNum > 0 ? M.purchasePrice * (ltvNum / 100) : null;
  const constraints = [
    { label: "Target DSCR", value: dscrNum ? `${fm(dscrNum, 2)}x` : "—", loan: loanByDscr },
    { label: "Target Debt Yield", value: dyNum ? `${fm(dyNum, 1)}%` : "—", loan: loanByDy },
    { label: "Max LTV", value: ltvNum ? `${fm(ltvNum, 0)}%` : "—", loan: loanByLtv },
  ].filter((c) => c.loan != null && c.loan > 0);
  const maxLoan = constraints.length ? Math.min(...constraints.map((c) => c.loan)) : null;
  const bindingLabel = constraints.find((c) => c.loan === maxLoan)?.label;
  const apply = () => {
    if (!maxLoan || !M.purchasePrice) return;
    set({ ltv: Math.min(1, maxLoan / M.purchasePrice) });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="text-lg font-bold text-gray-900">Size My Loan</div>
          <button onClick={onClose} className="text-gray-400">{I.x}</button>
        </div>
        <div className="text-xs text-gray-500 mb-4">Based on this deal's Year 1 NOI ({$f(Math.round(noi))}) at the current rate ({pct(M.rate, 2)}) and {S.amort}-year amortization. Leave a field blank to ignore that constraint.</div>
        <div className="flex flex-col gap-3">
          <Field icon={I.pctI} label="Target DSCR"><Input w="w-28" value={targetDscr} onChange={setTargetDscr} suffix="x" /></Field>
          <Field icon={I.pctI} label="Target Debt Yield"><Input w="w-28" value={targetDy} onChange={setTargetDy} suffix="%" /></Field>
          <Field icon={I.target} label="Max LTV"><Input w="w-28" value={maxLtvPct} onChange={setMaxLtvPct} suffix="%" /></Field>
        </div>
        <div className="border-t border-gray-100 mt-4 pt-4 flex flex-col gap-1.5">
          {constraints.map((c) => (
            <div key={c.label} className={`flex justify-between text-sm ${c.loan === maxLoan ? "font-bold text-emerald-700" : "text-gray-500"}`}>
              <span>{c.label} ({c.value})</span><span>{$f(Math.round(c.loan))}</span>
            </div>
          ))}
          {constraints.length === 0 && <div className="text-xs text-gray-400">Enter at least one constraint above.</div>}
        </div>
        <div className="bg-emerald-50 rounded-lg px-4 py-3 mt-3 flex justify-between items-center">
          <div>
            <div className="text-[11px] text-gray-500 font-semibold uppercase">Max Supportable Loan</div>
            {bindingLabel && <div className="text-[11px] text-gray-400">Binding constraint: {bindingLabel}</div>}
          </div>
          <div className="text-xl font-bold text-emerald-700">{maxLoan ? $f(Math.round(maxLoan)) : "—"}</div>
        </div>
        <div className="flex gap-2 mt-4">
          <Primary onClick={apply} disabled={!maxLoan}>Apply to LTV</Primary>
          <Ghost onClick={onClose}>Cancel</Ghost>
        </div>
      </div>
    </div>
  );
}

function FinancingTab({ M, S, set, pdfData, pdfUrl }) {
  const [hover, setHover] = useState(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [sizingOpen, setSizingOpen] = useState(false);
  // Preferred Equity / Mezz / Seller Financing inputs used to be plain local
  // state, which got wiped back to defaults every time you switched away
  // from this tab and back (FinancingTab unmounts when another tab is
  // active). Lifted into the shared `S` scenario state (via set()) so
  // they persist like every other field on this page.
  const prefOn = S.prefOn ?? true;
  const setPrefOn = (v) => set({ prefOn: v });
  const mezzOn = S.mezzOn ?? false;
  const setMezzOn = (v) => set({ mezzOn: v });
  const sellerOn = S.sellerOn ?? false;
  const setSellerOn = (v) => set({ sellerOn: v });
  const prefAmt = S.prefAmt ?? 0;
  const setPrefAmt = (v) => set({ prefAmt: v });
  const prefPaymentMode = S.prefPaymentMode ?? "accruing";
  const setPrefPaymentMode = (v) => set({ prefPaymentMode: v });
  const mezzAmt = S.mezzAmt ?? 0;
  const setMezzAmt = (v) => set({ mezzAmt: v });
  const sellerAmt = S.sellerAmt ?? 0;
  const setSellerAmt = (v) => set({ sellerAmt: v });
  const [pmtYr, setPmtYr] = useState(0);
  const [treasuryRates, setTreasuryRates] = useState([]);
  const [treasuryAsOf, setTreasuryAsOf] = useState(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryError, setTreasuryError] = useState("");
  const prefAccrual = prefAmt * (Math.pow(1 + CFG.waterfall.pref, CFG.acq.holdYears) - 1);

  useEffect(() => {
    let cancelled = false;
    setTreasuryLoading(true);
    fetch(`${API_BASE_URL}/api/treasury-rates`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        setTreasuryRates(Array.isArray(data?.rates) ? data.rates : []);
        setTreasuryAsOf(data?.as_of || null);
      })
      .catch(() => { if (!cancelled) { setTreasuryError("Treasury rates unavailable right now."); setTreasuryRates([]); } })
      .finally(() => { if (!cancelled) setTreasuryLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const toggles = [
    ["REFINANCE ASSUMPTIONS", GRAD, "refi", S.refiOn, (v) => set({ refiOn: v })],
    ["PREFERRED EQUITY", "bg-gradient-to-r from-emerald-400 to-cyan-500", "pref", prefOn, setPrefOn],
    ["MEZZANINE DEBT", "bg-gradient-to-r from-amber-400 to-orange-500", "mezz", mezzOn, setMezzOn],
    ["SELLER FINANCING", "bg-gradient-to-r from-emerald-500 to-teal-600", "seller", sellerOn, setSellerOn],
  ];
  const scen = CFG.scenarios[S.scenarioKey];
  const applyScenario = (k) => {
    const s = CFG.scenarios[k];
    set({ scenarioKey: k, rateOverride: s.rate, amort: s.amort, ioMonths: s.io });
  };
  const verify = useVerifyPanel();
  const financingVerifyFields = [
    { label: "Loan Amount", value: $f(M.loan), source: "Lender Term Sheet" },
    { label: "Interest Rate", value: pct(M.rate), source: "Lender Term Sheet" },
    { label: "LTV", value: pct(S.ltv, 0), source: "Lender Term Sheet" },
    { label: "Amortization", value: `${S.amort} yrs`, source: "Lender Term Sheet" },
    { label: "IO Period", value: `${S.ioMonths} mos`, source: "Lender Term Sheet" },
    { label: "DSCR", value: M.metrics.dscr === null ? "—" : `${fm(M.metrics.dscr, 2)}x`, source: "Calculated" },
  ];
  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600 font-medium">Financing Scenario ⓘ</div>
        <div className="flex gap-2"><VerifyButton onClick={verify.toggle} /><Ghost onClick={() => setSizingOpen(true)}>{I.sliders} Size My Loan</Ghost><Ghost onClick={() => exportWorkbook(M, S)}>{I.dl} Export</Ghost></div>
      </div>
      {sizingOpen && <LoanSizingModal M={M} S={S} set={set} onClose={() => setSizingOpen(false)} />}
      <div className="flex gap-2 mb-5 relative">
        {Object.keys(CFG.scenarios).map((k) => (
          <div key={k} className="relative" onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
            <Ghost active={S.scenarioKey === k} onClick={() => applyScenario(k)}>{I.wrench} {CFG.scenarios[k].label}</Ghost>
            {hover === k && (
              <div className="absolute top-12 left-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-40 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4">
                  <div className="font-bold flex items-center gap-2">{I.wrench} {CFG.scenarios[k].label} Loan</div>
                  <div className="text-xs text-white/85 mt-1">{CFG.scenarios[k].desc}</div>
                </div>
                <div className="p-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase flex justify-between">Loan Parameters <span>✎</span></div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-700">
                    <span>％ Rate: <b>{pct(CFG.scenarios[k].rate, CFG.scenarios[k].rate === 0.09 ? 0 : 2)}</b></span>
                    <span>🗓 Amort: <b>{CFG.scenarios[k].amort}yr</b></span>
                    <span>🕐 IO: <b>{CFG.scenarios[k].io}mo</b></span>
                  </div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase mt-4">Lender Constraints</div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[["DSCR", CFG.scenarios[k].cons.dscr], ["$ DY", CFG.scenarios[k].cons.dy], ["LTV", CFG.scenarios[k].cons.ltv]].map(([l, v]) => (
                      <div key={l} className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-[10px] text-gray-400 font-semibold">{l}</div><div className="font-bold text-sm">{v}</div></div>
                    ))}
                  </div>
                  <div className="text-[11px] text-gray-400 text-center mt-3">Click to apply · Double-click to rename</div>
                </div>
              </div>
            )}
          </div>
        ))}
        <button onClick={() => alert("Create custom scenario: Loan type, rate, amortization, interest-only period, and lender constraints. Coming soon!")} className="border-2 border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 text-sm font-medium px-3 py-2 rounded-lg transition">＋ Add</button>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <GradBanner className="mb-3"><span className="font-bold text-sm tracking-wide">LOAN ASSUMPTIONS</span></GradBanner>
          <Card className="px-5 py-2">
            <Field icon={I.dollar} label="Purchase Price"><Input value={fm(M.purchasePrice)} readOnly /></Field>
            <Field icon={I.dollar} label="Loan Amount"><Input value={fm(M.loan)} readOnly /></Field>
            <Field icon={I.target} label="LTV"><Input w="w-28" value={fm(S.ltv * 100, 0)} onChange={(v) => set({ ltv: (parseFloat(v) || 70) / 100 })} suffix="%" /></Field>
            <Field icon={I.pctI} label="LTC"><Input w="w-28" value={pct(M.ltc)} readOnly /></Field>
            <Field icon={I.card} label="Loan Fees"><Input w="w-28" value={fm(S.loanFeesPct * 100, 2)} onChange={(v) => set({ loanFeesPct: (parseFloat(v) || 1) / 100 })} suffix="%" /></Field>
            <SubHead>{I.pctI} Interest Rate</SubHead>
            <Field icon={null} label="Total Rate">
              <div className="flex items-center gap-2"><Input w="w-28" value={fm(M.rate * 100, 2)} onChange={(v) => set({ rateOverride: (parseFloat(v) || 6.25) / 100 })} suffix="%" /><button onClick={() => setRateOpen(!rateOpen)} className="text-gray-400">{rateOpen ? "⌃" : "⌄"}</button></div>
            </Field>
            {rateOpen && (<>
              <Field icon={null} label="Base Rate">
                <div className="flex items-center gap-2"><span className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700">SOFR 90-Day Avg</span><span className="text-sm">{pct(S.baseRate)}</span><button onClick={() => set({ rateOverride: null })} className="text-gray-400">⟲</button></div>
              </Field>
              <Field icon={null} label="Spread"><Input w="w-28" value={fm(S.spread * 100, 1)} onChange={(v) => set({ spread: (parseFloat(v) || 2.5) / 100, rateOverride: null })} suffix="%" /></Field>
            </>)}
            <SubHead>{I.trend} Live Treasury Rates <span className="text-[11px] font-normal text-gray-400 normal-case">{treasuryAsOf ? `as of ${treasuryAsOf}` : ""}</span></SubHead>
            {treasuryLoading ? (
              <div className="text-xs text-gray-400 px-1 py-2">Loading Treasury rates…</div>
            ) : treasuryRates.length > 0 ? (
              <div className="grid grid-cols-5 gap-2 px-1 py-2">
                {treasuryRates.map((entry) => {
                  const applied = (Number(entry.rate) || 0) / 100 + S.spread;
                  const isSelected = Math.abs((M.rate || 0) - applied) < 0.0005;
                  return (
                    <button key={entry.term} onClick={() => set({ rateOverride: applied })}
                      className={`text-left rounded-lg border px-2.5 py-2 transition ${isSelected ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">{entry.term}Yr</div>
                      <div className="text-sm font-bold text-gray-800">{fm(entry.rate, 2)}%</div>
                      <div className="text-[10px] text-gray-400">+{fm(S.spread * 100, 1)}% = {fm(applied * 100, 2)}%</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-400 px-1 py-2">{treasuryError || "Treasury rates unavailable right now."}</div>
            )}
            <SubHead>{I.sliders} Loan Terms</SubHead>
            <Field icon={I.cal} label="Loan Term" note="Max 5 yrs (hold period)"><Input w="w-28" value={scen.term} readOnly suffix="yrs" /></Field>
            <Field icon={I.cal} label="Amortization"><Input w="w-28" value={S.amort} onChange={(v) => set({ amort: parseInt(v) || 30 })} suffix="yrs" /></Field>
            <Field icon={I.cal} label="IO Period"><Input w="w-28" value={S.ioMonths} onChange={(v) => set({ ioMonths: parseInt(v) || 0 })} suffix="mos" /></Field>
            <SubHead>Reserves</SubHead>
            <Field icon={I.clock} label="Interest Reserve"><Input w="w-28" value="0" readOnly suffix="mos" /></Field>
            <Field icon={I.cash} label="Reserve Amount ⭘"><Input w="w-28" value="0" readOnly suffix="$" /></Field>
          </Card>
        </div>
        <div className="flex flex-col gap-3">
          {toggles.map(([l, g, k, on, setOn]) => (
            <React.Fragment key={k}>
              <GradBanner gradient={g}><span className="font-bold text-sm tracking-wide">{l}</span><Toggle green={false} on={on} onChange={setOn} /></GradBanner>
              {k === "refi" && on && (
                <Card className="px-5 py-2">
                  <Field icon={I.cal} label="Refinance Year"><Input w="w-28" value={S.refiYear} onChange={(v) => set({ refiYear: Math.max(1, Math.min(parseInt(v, 10) || 1, CFG.acq.holdYears - 1)) })} suffix="yr" /></Field>
                  <Field icon={I.target} label="Refinance LTV"><Input w="w-28" value={fm(S.refiLTV * 100, 0)} onChange={(v) => set({ refiLTV: Math.max(0, Math.min((parseFloat(v) || 0) / 100, 0.9)) })} suffix="%" /></Field>
                  <Field icon={I.pctI} label="Refinance Rate"><Input w="w-28" value={fm(S.refiRate * 100, 2)} onChange={(v) => set({ refiRate: Math.max(0, (parseFloat(v) || 0) / 100) })} suffix="%" /></Field>
                  <div className="bg-gray-50 rounded-xl p-3 my-3 grid grid-cols-2 gap-3">
                    <div><div className="text-[11px] font-bold text-gray-400 uppercase">Stabilized Value</div><div className="text-sm font-bold text-gray-800">{$f(Math.round(M.refiValue))}</div></div>
                    <div><div className="text-[11px] font-bold text-gray-400 uppercase">New Loan</div><div className="text-sm font-bold text-gray-800">{$f(Math.round(M.refiLoan))}</div></div>
                    <div><div className="text-[11px] font-bold text-gray-400 uppercase">Bridge Payoff</div><div className="text-sm font-bold text-gray-800">-{$f(Math.round(M.oldPayoffAtRefi))}</div></div>
                    <div><div className="text-[11px] font-bold text-gray-400 uppercase">Net Proceeds</div><div className="text-sm font-bold text-emerald-600">{$f(Math.round(M.netRefi))}</div></div>
                  </div>
                  <div className="text-[11px] text-gray-400">Shared with the Waterfall tab — editing here updates the JV buyout calculation there too.</div>
                </Card>
              )}
              {k === "pref" && on && (
                <Card className="px-5 py-2">
                  <Field icon={I.dollar} label="Pref Amount"><Input value={fm(prefAmt)} onChange={(v) => setPrefAmt(parseInt(String(v).replace(/,/g, ""), 10) || 0)} /></Field>
                  <Field icon={I.pctI} label="Preferred Return"><Input w="w-28" value={fm(CFG.waterfall.pref * 100, 0)} readOnly suffix="%" /></Field>
                  <div className="py-3">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Payment Mode</div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "current", label: "Pay-Current", desc: "Periodic interest payments" },
                        { key: "accruing", label: "Accruing", desc: "Compounds, paid at exit" },
                      ].map((opt) => {
                        const active = prefPaymentMode === opt.key;
                        return (
                          <button type="button" key={opt.key} onClick={() => setPrefPaymentMode(opt.key)}
                            className={`text-left border rounded-xl p-3 flex gap-2 items-start transition ${active ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-gray-300"}`}>
                            <span className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${active ? "border-emerald-600" : "border-gray-300"}`}>
                              {active && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
                            </span>
                            <span><b className="text-sm">{opt.label}</b><span className="block text-[11px] text-gray-500">{opt.desc}</span></span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {prefPaymentMode === "accruing" ? (
                    <div className="bg-gray-50 rounded-xl p-3 my-3"><div className="text-[11px] font-bold text-gray-400 uppercase">Estimated Accrual at Disposition</div>{prefAmt > 0 ? <div className="text-sm font-bold text-gray-800">{$f(Math.round(prefAccrual))} <span className="font-normal text-gray-400 text-xs">over {CFG.acq.holdYears} yrs @ {pct(CFG.waterfall.pref, 0)} compounding</span></div> : <div className="text-sm text-gray-400">Enter a pref amount to see preview</div>}</div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-3 my-3"><div className="text-[11px] font-bold text-gray-400 uppercase">Estimated Periodic Payment</div>{prefAmt > 0 ? <div className="text-sm font-bold text-gray-800">{$f(Math.round((prefAmt * CFG.waterfall.pref) / 12))}<span className="font-normal text-gray-400 text-xs">/mo</span> <span className="font-normal text-gray-400 text-xs">({$f(Math.round(prefAmt * CFG.waterfall.pref))}/yr @ {pct(CFG.waterfall.pref, 0)})</span></div> : <div className="text-sm text-gray-400">Enter a pref amount to see preview</div>}</div>
                  )}
                </Card>
              )}
              {k === "mezz" && on && (
                <Card className="px-5 py-2">
                  <Field icon={I.dollar} label="Mezz Amount"><Input value={fm(mezzAmt)} onChange={(v) => setMezzAmt(parseInt(String(v).replace(/,/g, ""), 10) || 0)} /></Field>
                  <Field icon={I.pctI} label="Mezz Rate"><Input w="w-28" value="10.00" suffix="%" /></Field>
                  <Field icon={I.cal} label="Mezz Term"><Input w="w-28" value={S.amort} readOnly suffix="yrs" /></Field>
                  <SubHead>Accrual Structure</SubHead>
                  <div className="text-sm text-gray-600">PIK (Pay-in-Kind) accrues at 10% annually with repayment at exit</div>
                </Card>
              )}
              {k === "seller" && on && (
                <Card className="px-5 py-2">
                  <Field icon={I.dollar} label="Seller Note"><Input value={fm(sellerAmt)} onChange={(v) => setSellerAmt(parseInt(String(v).replace(/,/g, ""), 10) || 0)} /></Field>
                  <Field icon={I.pctI} label="Seller Rate"><Input w="w-28" value="4.50" suffix="%" /></Field>
                  <Field icon={I.cal} label="Seller Term"><Input w="w-28" value="5" readOnly suffix="yrs" /></Field>
                  <SubHead>Terms</SubHead>
                  <div className="text-sm text-gray-600">Seller financing subordinate to institutional debt, due at exit or refinance</div>
                </Card>
              )}
            </React.Fragment>
          ))}
          <GradBanner><span className="font-bold text-sm tracking-wide">LOAN METRICS</span></GradBanner>
          <div className="grid grid-cols-2 gap-3">
            {[["DSCR", M.metrics.dscr === null ? "—" : `${fm(M.metrics.dscr, 2)}x`], ["DEBT YIELD", M.metrics.debtYield === null ? "—" : pct(M.metrics.debtYield)],
              ["LOAN CONSTANT", M.metrics.loanConstant === null ? "—" : pct(M.metrics.loanConstant)]].map(([l, v]) => (
              <Card key={l} className="p-4"><div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase"><span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center">{I.trend}</span>{l}</div><div className="text-2xl font-bold text-gray-900 mt-1">{v}</div></Card>
            ))}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase"><span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center">{I.trend}</span>YEARLY PAYMENT</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-2xl font-bold text-gray-900">{$f(Math.round(M.dsByYear[pmtYr] || 0))}</div>
                <select value={pmtYr} onChange={(e) => setPmtYr(parseInt(e.target.value, 10))} className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 outline-none bg-white">
                  {M.dsByYear.map((_, i) => <option key={i} value={i}>Yr {i + 1}</option>)}
                </select>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <div className={`${GRAD} text-white rounded-xl px-4 py-2.5 inline-flex items-center gap-3 mb-3`}>
          <span className="font-bold text-sm tracking-wide">📋 AMORTIZATION SCHEDULE</span>
          <span className="bg-white/20 text-[11px] font-semibold px-2.5 py-1 rounded-full">{M.termMonths} monthly payments</span>
          <span className="bg-white/20 text-[11px] font-semibold px-2.5 py-1 rounded-full">{S.ioMonths} months interest-only</span>
          <span className="bg-white text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full">Balloon: {$f(Math.round(M.balloon))}</span>
        </div>
        <Card className="overflow-hidden">
          <div className="max-h-[440px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-white shadow-sm"><tr className="text-left text-gray-500">
                <th className="py-2.5 px-4">#</th><th>Date</th><th className="text-right px-4">Beginning Balance</th>
                <th className="text-right px-4">Interest</th><th className="text-right px-4">Principal</th>
                <th className="text-right px-4">Total Payment</th><th className="text-right px-4">Ending Balance</th>
              </tr></thead>
              <tbody>
                {M.amSchedule.map((r) => (
                  <tr key={r.n} className="border-t border-gray-50">
                    <td className="py-2 px-4">{r.n} {r.io && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1">IO</span>}</td>
                    <td>{r.date}</td>
                    <td className="text-right px-4">{$f(Math.round(r.begin))}</td>
                    <td className="text-right px-4 text-red-500">{$f(Math.round(r.interest))}</td>
                    <td className="text-right px-4 text-emerald-600">{$f(Math.round(r.principal))}</td>
                    <td className="text-right px-4 font-semibold">{$f(Math.round(r.pmt))}</td>
                    <td className="text-right px-4">{$f(Math.round(r.end))}</td>
                  </tr>
                ))}
                {M.amSchedule.length === 0 && <tr><td colSpan={7} className="py-4 px-4 text-gray-400 text-center">No debt — set an LTV above 0 to generate the schedule.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {verify.open && <DocSourcePanel title="Financing" fields={financingVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

/* -------- Returns -------- */
function ReturnsTab({ M, pdfData, pdfUrl }) {
  const verify = useVerifyPanel();
  const returnsVerifyFields = [
    { label: "Levered IRR", value: M.leveredIRR === null ? "—" : pct(M.leveredIRR), source: "Calculated" },
    { label: "Unlevered IRR", value: M.unleveredIRR === null ? "—" : pct(M.unleveredIRR), source: "Calculated" },
    { label: "Equity Multiple", value: `${fm(M.equityMultiple, 2)}x`, source: "Calculated" },
    { label: "Exit Value", value: $f(Math.round(M.salePrice)), source: "Calculated", note: "Year 5 forward NOI ÷ exit cap" },
  ];
  return (
    <div className="p-6 flex flex-col gap-5 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
        <VerifyButton onClick={verify.toggle} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[["LEVERED IRR", M.leveredIRR === null ? "—" : pct(M.leveredIRR)], ["UNLEVERED IRR", M.unleveredIRR === null ? "—" : pct(M.unleveredIRR)],
          ["EQUITY MULTIPLE", `${fm(M.equityMultiple, 2)}x`], ["AVG CASH-ON-CASH", pct(M.avgCoC)],
          ["GOING-IN CAP", pct(M.goingInCap)], ["EXIT VALUE", $f(Math.round(M.salePrice))],
          ...(M.jvOn ? [["SPONSOR NET IRR (JV)", M.sponsorIRR === null ? "—" : M.sponsorEq <= 0 ? "∞" : pct(M.sponsorIRR)], ["PARTNER IRR (JV)", M.jvIRR === null ? "—" : pct(M.jvIRR)]] : [])].map(([l, v]) => (
          <Card key={l} className="p-4"><div className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-2"><span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center">{I.trend}</span>{l}</div><div className="text-2xl font-bold text-gray-900 mt-1">{v}</div></Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className={`px-4 py-3 ${GRAD} text-white font-bold text-sm`}>Annual Levered Cash Flow &amp; Yield</div>
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500 bg-gray-50"><th className="py-2.5 px-4">Period</th><th className="text-right px-4">Cash Flow</th><th className="text-right px-4">Cash-on-Cash</th></tr></thead>
          <tbody>
            <tr className="border-t border-gray-50"><td className="py-2.5 px-4 font-semibold">Closing</td><td className="text-right px-4"><Mono v={Math.round(M.lev[0])} /></td><td className="text-right px-4 text-gray-400">—</td></tr>
            {M.rowsCF.map((r, i) => (
              <tr key={r.y} className="border-t border-gray-50"><td className="py-2.5 px-4 font-semibold">Year {r.y}</td>
                <td className="text-right px-4"><Mono v={Math.round(M.lev[i + 1])} /></td>
                <td className="text-right px-4 text-gray-600">{pct(r.cfads / M.equity)}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="overflow-hidden">
        <div className={`px-4 py-3 ${GRAD} text-white font-bold text-sm`}>IRR Sensitivity — Exit Cap × Rent Growth</div>
        <table className="w-full text-[13px]">
          <thead><tr className="text-gray-500 bg-gray-50"><th className="py-2.5 px-4 text-left">Exit Cap ↓ / Growth →</th>{M.grs.map((g) => <th key={g} className="text-right px-4">{pct(g, 1)}</th>)}</tr></thead>
          <tbody>{M.caps.map((c, ci) => (
            <tr key={c} className="border-t border-gray-50"><td className="py-2 px-4 font-semibold">{pct(c)}</td>
              {M.sens[ci].map((v, gi) => {
                const base = ci === 2 && gi === 2;
                return <td key={gi} className={`text-right px-4 ${base ? "bg-emerald-100 font-bold text-emerald-800 rounded" : v !== null && v < 0.08 ? "text-red-500" : v !== null && v > 0.15 ? "text-emerald-600" : "text-gray-700"}`}>{v === null ? "—" : pct(v, 1)}</td>;
              })}</tr>
          ))}</tbody>
        </table>
        <div className="px-4 py-2 text-[11px] text-gray-400">Highlighted cell = current assumptions. Red &lt; 8% · Green &gt; 15%.</div>
      </Card>
      {verify.open && <DocSourcePanel title="Returns" fields={returnsVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

/* -------- Comps: RentCast market data + Leaflet satellite map -------- */
function CompsFitBounds({ center, comps }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    if (!comps.length) { map.setView([center.lat, center.lng], 13); return; }
    const points = [[center.lat, center.lng], ...comps.map((c) => [Number(c.latitude), Number(c.longitude)])];
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, center, comps]);
  return null;
}
function CompsTab({ M, scenarioData, dealId, marketData, marketDataLoading, onRefetchMarketData, pdfData, pdfUrl }) {
  // Seed from the deal's saved rentcast_cache (written by the backend the
  // first time "Refresh Comps" is clicked for this deal) so reopening a deal
  // shows the same comps instantly, with zero extra RentCast API calls or
  // token cost — the button below only re-hits the live API when the user
  // explicitly wants a fresh pull.
  const cachedRentcast = scenarioData?.rentcast_cache;
  const [rc, setRc] = useState(() => (
    cachedRentcast?.data
      ? { loading: false, error: null, data: cachedRentcast.data, cachedAt: cachedRentcast.fetched_at }
      : { loading: false, error: null, data: null }
  ));
  const [repliers, setRepliers] = useState({ loading: false, error: null, comps: [] });
  const [hoveredComp, setHoveredComp] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const property = scenarioData?.property || {};
  const propertyAddress = property.address || scenarioData?.address || CFG.deal.address;
  const propertyCity = property.city || scenarioData?.city || "";
  const propertyState = property.state || scenarioData?.state || "";
  const propertyZip = property.zip || property.zipcode || scenarioData?.zip || "";
  const propertyLat = property.lat ?? property.latitude ?? scenarioData?.lat ?? scenarioData?.latitude;
  const propertyLng = property.lng ?? property.longitude ?? scenarioData?.lng ?? scenarioData?.longitude;

  // The deal's scenario data doesn't reliably carry lat/lng, so geocode the
  // subject address ourselves (Google, via utils/geocode.js) as a fallback —
  // ensures the map/Repliers search always has real coordinates instead of
  // only working after RentCast happens to return them.
  const [geocodedCoords, setGeocodedCoords] = useState(null);
  useEffect(() => {
    if (propertyLat != null && propertyLng != null) return;
    if (!propertyAddress || propertyAddress === CFG.deal.address) return;
    let cancelled = false;
    const fullAddress = [propertyAddress, propertyCity, propertyState, propertyZip].filter(Boolean).join(", ");
    geocodeAddress(fullAddress).then((loc) => {
      if (!cancelled && loc) setGeocodedCoords({ lat: loc.latitude, lng: loc.longitude });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyAddress, propertyCity, propertyState, propertyZip, propertyLat, propertyLng]);

  const fetchComps = async () => {
    if (!dealId) { setRc({ loading: false, error: "Save or upload this deal first to fetch nearby comps.", data: null }); return; }
    setRc((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE_URL}/v2/deals/${dealId}/rentcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: propertyAddress, city: propertyCity, state: propertyState, zip: propertyZip,
          property_type: "Apartment",
        }),
      });
      const json = await res.json();
      if (json.success) setRc({ loading: false, error: null, data: json.data, cachedAt: new Date().toISOString() });
      else setRc({ loading: false, error: json.error || "Failed to fetch comps from RentCast", data: null });
    } catch (e) {
      setRc({ loading: false, error: e.message || "Failed to fetch comps from RentCast", data: null });
    }
  };


  const fetchRepliersComps = async (lat, lng) => {
    if (!dealId || lat == null || lng == null) return;
    setRepliers((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE_URL}/v2/deals/${dealId}/repliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radius_km: 3 }),
      });
      const json = await res.json();
      if (json.success) setRepliers({ loading: false, error: null, comps: json.data?.comparables || [] });
      else setRepliers({ loading: false, error: json.error || "Failed to fetch Repliers comps", comps: [] });
    } catch (e) {
      setRepliers({ loading: false, error: e.message || "Failed to fetch Repliers comps", comps: [] });
    }
  };

  // RentCast/Repliers comps are NOT auto-fetched on load — each call costs a paid
  // API request, so the user must explicitly click "Refresh Comps" to fetch them.

  const mapCenter = useMemo(() => {
    if (rc.data?.latitude && rc.data?.longitude) return { lat: Number(rc.data.latitude), lng: Number(rc.data.longitude) };
    if (propertyLat != null && propertyLng != null) return { lat: Number(propertyLat), lng: Number(propertyLng) };
    if (geocodedCoords) return geocodedCoords;
    return null;
  }, [rc.data, propertyLat, propertyLng, geocodedCoords]);

  // Repliers comps are also only fetched on demand (via the Refresh Comps button),
  // not automatically — see fetchComps/fetchRepliersComps call in the button below.

  const comps = useMemo(() => {
    const raw = rc.data?.comparables;
    const rentcastList = (Array.isArray(raw) ? raw : (raw?.listings || []))
      .filter((c) => c.latitude && c.longitude)
      .map((c) => ({ ...c, source: c.source || "RentCast" }));
    const repliersList = repliers.comps.filter((c) => c.latitude && c.longitude);
    return [...rentcastList, ...repliersList];
  }, [rc.data, repliers.comps]);

  const subj = M.purchasePrice / M.dealUnits;
  const verify = useVerifyPanel();
  const compsVerifyFields = [
    { label: "Nearby Comps Found", value: `${comps.length} properties`, source: "RentCast Market Data" },
    { label: "Market Rent Estimate", value: rc.data?.rent != null ? $f(rc.data.rent) + "/mo" : "—", source: "RentCast Market Data" },
    { label: "Value Estimate", value: rc.data?.price != null ? $f(rc.data.price) : "—", source: "RentCast Market Data" },
    { label: "Subject Price / Unit", value: $f(Math.round(subj)), source: "Calculated" },
  ];

  const propertyLocation = {
    address: propertyAddress, city: propertyCity, state: propertyState, zip: propertyZip,
    lat: mapCenter?.lat ?? propertyLat, lng: mapCenter?.lng ?? propertyLng,
  };

  useEffect(() => {
    if (showAnalytics && !marketData && !marketDataLoading && onRefetchMarketData) {
      onRefetchMarketData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalytics]);

  return (
    <div className="p-6 flex flex-col gap-5 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Comps</h1>
        <div className="flex items-center gap-2">
          {rc.cachedAt && !rc.loading && (
            <span className="text-[11px] text-gray-400">Saved {new Date(rc.cachedAt).toLocaleDateString()}</span>
          )}
          <Ghost onClick={() => { fetchComps(); if (mapCenter) fetchRepliersComps(mapCenter.lat, mapCenter.lng); }}>
            {rc.loading || repliers.loading ? "Fetching…" : (rc.data ? "🔄 Get Fresh Comps" : "🔄 Refresh Comps")}
          </Ghost>
          <Ghost active={showAnalytics} onClick={() => setShowAnalytics((v) => !v)}>
            📊 Analytics
          </Ghost>
          <VerifyButton onClick={verify.toggle} />
        </div>
      </div>

      {showAnalytics && (
        <MarketResearchTab
          marketData={marketData}
          propertyLocation={propertyLocation}
          loading={marketDataLoading}
          onRefetchMarketData={onRefetchMarketData}
        />
      )}

      {repliers.error && <Card className="p-3 bg-amber-50 border-amber-100 text-sm text-amber-700">Repliers: {repliers.error}</Card>}

      {rc.error && <Card className="p-3 bg-red-50 border-red-100 text-sm text-red-600">{rc.error}</Card>}

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Market Rent Estimate" value={rc.data?.rent != null ? `${$f(rc.data.rent)}/mo` : "—"} sub="RentCast AVM" />
        <StatCard label="Rent Range" value={rc.data?.rentRangeLow != null ? `${$f(rc.data.rentRangeLow)}–${$f(rc.data.rentRangeHigh)}` : "—"} sub="low – high" />
        <StatCard label="Value Estimate" value={rc.data?.price != null ? $f(rc.data.price) : "—"} sub="RentCast AVM" />
        <StatCard label="Nearby Comps" value={comps.length} sub="within search radius" />
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-5">
        <Card className="overflow-hidden p-0">
          <div className={`px-4 py-3 ${GRAD} text-white font-bold text-sm flex items-center justify-between`}>
            <span>Property &amp; Nearby Comps</span>
            <span className="text-[11px] font-normal text-white/85 flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Subject</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" /> Comp</span>
            </span>
          </div>
          <div style={{ height: 460 }}>
            {mapCenter ? (
              <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                {MAPBOX_TOKEN ? (
                  <TileLayer
                    url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
                    attribution="&copy; Mapbox &copy; OpenStreetMap"
                    maxNativeZoom={20}
                  />
                ) : (
                  <>
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="&copy; Esri"
                    />
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                      attribution=""
                    />
                  </>
                )}
                <CompsFitBounds center={mapCenter} comps={comps} />

                <CircleMarker
                  center={[mapCenter.lat, mapCenter.lng]}
                  radius={14}
                  pathOptions={{ fillColor: "#ef4444", fillOpacity: 1, color: "#fff", weight: 3 }}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <div className="font-bold text-sm">📍 {propertyAddress}</div>
                      {rc.data?.rent != null && <div className="text-xs text-emerald-600 font-semibold mt-1">Est: {$f(rc.data.rent)}/mo</div>}
                    </div>
                  </Popup>
                </CircleMarker>

                {comps.map((c, i) => (
                  <CircleMarker
                    key={i}
                    center={[Number(c.latitude), Number(c.longitude)]}
                    radius={hoveredComp === i ? 12 : 8}
                    pathOptions={{
                      fillColor: hoveredComp === i ? "#f59e0b" : "#6366f1",
                      fillOpacity: hoveredComp === i ? 1 : 0.85,
                      color: "#fff", weight: 2,
                    }}
                    eventHandlers={{
                      mouseover: () => setHoveredComp(i),
                      mouseout: () => setHoveredComp(null),
                      click: () => setSelectedComp(selectedComp === i ? null : i),
                    }}
                  >
                    {selectedComp === i && (
                      <Popup>
                        <div style={{ minWidth: 170 }}>
                          <div className="font-bold text-sm">{c.price != null ? `${$f(c.price)}/mo` : "—"}</div>
                          <div className="text-xs text-gray-500 mt-1">{c.bedrooms ?? "?"} bed • {c.bathrooms ?? "?"} bath{c.squareFootage ? ` • ${fm(c.squareFootage)} sf` : ""}</div>
                          <div className="text-[11px] text-gray-400 mt-1">{c.formattedAddress || c.addressLine1 || ""}</div>
                          {c.distance != null && <div className="text-[11px] text-emerald-600 font-semibold mt-1">{fm(c.distance, 2)} mi away</div>}
                        </div>
                      </Popup>
                    )}
                  </CircleMarker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                <span className="text-3xl">🗺️</span>
                <span className="text-sm">{rc.loading ? "Loading comps…" : "No location data available for this property yet."}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-bold text-gray-800 text-sm">Nearby Comps</span>
            <Pill tone="purple">{comps.length}</Pill>
          </div>
          <div className="overflow-y-auto p-3 flex flex-col gap-2" style={{ maxHeight: 460 }}>
            {comps.length === 0 && (
              <div className="text-xs text-gray-400 px-2 py-6 text-center">
                {rc.loading ? "Loading comps…" : "No comps loaded yet."}
              </div>
            )}
            {comps.map((c, i) => (
              <div key={i}
                onMouseEnter={() => setHoveredComp(i)}
                onMouseLeave={() => setHoveredComp(null)}
                className={`rounded-lg border px-3 py-2.5 transition ${hoveredComp === i ? "border-indigo-300 bg-indigo-50/50" : "border-gray-100"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900">{c.price != null ? `${$f(c.price)}/mo` : "—"}</span>
                  {c.distance != null && <span className="text-[11px] text-emerald-600 font-semibold">{fm(c.distance, 2)} mi</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{c.bedrooms ?? "?"} bd • {c.bathrooms ?? "?"} ba{c.squareFootage ? ` • ${fm(c.squareFootage)} sf` : ""}</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-gray-400 truncate">{c.formattedAddress || c.addressLine1 || ""}</span>
                  <Pill tone={c.source === "Repliers" ? "orange" : "purple"}>{c.source || "RentCast"}</Pill>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {verify.open && <DocSourcePanel title="Comps" fields={compsVerifyFields} onClose={verify.close} pdfData={pdfData} pdfUrl={pdfUrl} />}
    </div>
  );
}

/* ================================================================
   APP
   ================================================================ */
export default function App({
  skipUploadPhase = false, scenarioData = null, dealId = null, pdfData = null, pdfUrl = null,
  onExportPDF, onExportToSheets, onExportToExcel, onGeneratePitchDeck, onGenerateBusinessPlan, onPushToPipeline,
  isSheetsExporting, isExcelExporting, isExportingPDF, isPushingToPipeline,
  sheetsExportStatus, isInPipeline, pipelineSuccess, onGoHome,
  marketData = null, marketDataLoading = false, onRefetchMarketData,
}) {
  const [phase, setPhase] = useState(skipUploadPhase ? "workspace" : "upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [extraParsedDocs, setExtraParsedDocs] = useState([]);
  const [mode, setMode] = useState("underwrite");
  const [docsSubView, setDocsSubView] = useState("overview");
  const [tab, setTab] = useState("summary");
  const [cfView, setCfView] = useState("Annual");
  const [S, setS] = useState(() => ({
    ltv: 0.70, loanFeesPct: 0.01, scenarioKey: "bridge",
    rateOverride: CFG.scenarios.bridge.rate, baseRate: 0.0375, spread: 0.025,
    amort: 30, ioMonths: 24,
    exitCap: CFG.assumptions.exitCap, costsOfSalePct: CFG.acq.costsOfSalePct,
    growth: CFG.assumptions.growth,
    incomeMethod: "advanced", renoPremium: CFG.reno.premium, renoCost: CFG.reno.costPerUnit,
    selectedRenoIds: new Set(buildUnits().filter((u) => u.type === CFG.reno.targetType).map((u) => u.id)),
    distWeights: [1, 1, 1, 1, 1, 1], imputeVacant: true, matrixView: "Monthly",
    scheduleStart: 1, scheduleEnd: 12,
    rubsSelected: new Set(), rubsRecoveryPct: CFG.rubs.defaultRecovery,
    renoDowntime: 2, maxConcurrent: 10, capexMode: "closing",
    gpPct: 0.05, cmFeePct: 0.02, amFeePct: CFG.assumptions.assetMgmtPct,
    acqFeePct: CFG.acq.acqFeePct, dispFeePct: CFG.acq.dispFeePct,
    jvOn: false, jvContribPct: 1.0, jvPrefRate: 0.10, jvMode: "current",
    refiYear: 3, refiLTV: 0.70, refiRate: 0.0625, refiOn: false,
    purchasePrice: CFG.acq.price,
    prefOn: true, mezzOn: false, sellerOn: false, prefAmt: 0, mezzAmt: 0, sellerAmt: 0,
    prefPaymentMode: "accruing",
  }));
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const mergedParsedData = useMemo(() => {
    if (!scenarioData) return null;
    if (extraParsedDocs.length === 0) return scenarioData;
    const merged = JSON.parse(JSON.stringify(scenarioData));
    extraParsedDocs.forEach((doc) => {
      Object.entries(doc.parsed || {}).forEach(([section, val]) => {
        if (val && typeof val === "object" && !Array.isArray(val)) {
          merged[section] = { ...(merged[section] || {}), ...val };
        } else {
          merged[section] = val;
        }
      });
    });
    return merged;
  }, [scenarioData, extraParsedDocs]);
  const M = useModel(S, mergedParsedData);
  // Sync the real deal's purchase price into S on load — S.purchasePrice
  // previously ONLY ever initialized to the hardcoded demo CFG.acq.price
  // and nothing synced it from the actual uploaded/parsed deal, so every
  // real deal silently showed the demo property's price throughout Summary/
  // Financing/Sources & Uses. This does not touch S.purchasePrice again
  // after the initial sync so in-tab edits still work as before.
  const realPriceSynced = useRef(false);
  useEffect(() => {
    if (realPriceSynced.current) return;
    const realPrice = mergedParsedData?.pricing_financing?.purchase_price || mergedParsedData?.pricing_financing?.price;
    if (realPrice && realPrice > 0) {
      realPriceSynced.current = true;
      setS((p) => ({ ...p, purchasePrice: realPrice }));
    }
  }, [mergedParsedData]);
  // Same problem existed for the exit cap rate: S.exitCap was ALWAYS
  // initialized to the demo's fake 5.5% (CFG.assumptions.exitCap), which is
  // wildly optimistic for a real deal that actually trades at a much higher
  // cap rate (e.g. a 9%+ cap workforce-housing asset) — using a 5.5% exit
  // cap to value a property that really trades at 9%+ inflates the modeled
  // exit/sale price by 60%+ (Value = NOI / capRate). Sync it once from the
  // real parsed going-in cap rate (or an explicit underwriting assumption,
  // if the OM stated one) so the projected sale price stays plausible.
  const realExitCapSynced = useRef(false);
  useEffect(() => {
    if (realExitCapSynced.current) return;
    const underwritingExitCap = mergedParsedData?.underwriting?.exit_cap_rate;
    const goingInCap = mergedParsedData?.pnl?.cap_rate_t12 || mergedParsedData?.pnl?.cap_rate;
    const realExitCapPct = underwritingExitCap || goingInCap;
    if (realExitCapPct && realExitCapPct > 0) {
      realExitCapSynced.current = true;
      setS((p) => ({ ...p, exitCap: realExitCapPct / 100 }));
    }
  }, [mergedParsedData]);
  // Real, deterministic calc engine (same one Sensitivity/Deal Room/Investor views use) —
  // independent from the mock CFG-driven `M` model used by the other underwriting tabs.
  // Overlays the user's LIVE edits (purchase price, exit cap, value-add strategy — all
  // part of S) on top of the parsed deal before recomputing, so editing those actually
  // changes the Summary tab's Sources&Uses/Financing/Returns numbers instead of them being
  // frozen to whatever was originally parsed.
  const valueAddRentIncrease = S.incomeMethod === "simple" || S.incomeMethod === "advanced" ? M.totalPremiumYr : 0;
  const valueAddOtherIncomeIncrease = S.incomeMethod === "rubs" ? M.rubsAnnual : 0;
  const hasValueAdd = valueAddRentIncrease > 0 || valueAddOtherIncomeIncrease > 0;
  const effectiveScenarioData = useMemo(() => {
    if (!mergedParsedData) return null;
    const origPrice = mergedParsedData.pricing_financing?.purchase_price || mergedParsedData.pricing_financing?.price || 0;
    const basePnl = mergedParsedData.pnl || {};
    const baseGpr = basePnl.gross_potential_rent || basePnl.potential_gross_income || 0;
    return {
      ...mergedParsedData,
      pricing_financing: {
        ...mergedParsedData.pricing_financing,
        _original_purchase_price: origPrice,
        purchase_price: S.purchasePrice,
        price: S.purchasePrice,
      },
      // Only touch pnl at all once an actual value-add strategy is selected —
      // otherwise leave the parsed EGI/NOI exactly as the backend reported them.
      pnl: !hasValueAdd ? basePnl : {
        ...basePnl,
        gross_potential_rent: baseGpr + valueAddRentIncrease,
        other_income: (basePnl.other_income || 0) + valueAddOtherIncomeIncrease,
        // The backend-parsed EGI/NOI totals are now stale once a value-add
        // strategy is applied — force calculateFullAnalysis to recompute
        // both from the bumped GPR/other-income instead of using them as-is.
        effective_gross_income: undefined,
        noi: undefined,
        noi_t12: undefined,
      },
      underwriting: {
        ...mergedParsedData.underwriting,
        exit_cap_rate: S.exitCap * 100,
      },
    };
  }, [mergedParsedData, S.purchasePrice, S.exitCap, hasValueAdd, valueAddRentIncrease, valueAddOtherIncomeIncrease]);
  const fullCalcs = useMemo(() => {
    if (!effectiveScenarioData) return {};
    try { return calculateFullAnalysis(effectiveScenarioData); } catch { return {}; }
  }, [effectiveScenarioData]);
  const tabs = {
    summary: <SummaryTab M={M} S={S} set={set} pdfData={pdfData} pdfUrl={pdfUrl} scenarioData={mergedParsedData} fullCalcs={fullCalcs} />,
    strategy: <StrategyTab M={M} S={S} set={set} pdfData={pdfData} pdfUrl={pdfUrl} />,
    income: <IncomeTab M={M} pdfData={pdfData} pdfUrl={pdfUrl} />,
    rentroll: <RentRollTab M={M} scenarioData={mergedParsedData} />,
    t12: <T12Tab M={M} scenarioData={mergedParsedData} />,
    expenses: <ExpensesTab M={M} scenarioData={mergedParsedData} />,
    cashflow: <CashflowTab M={M} S={S} set={set} cfView={cfView} pdfData={pdfData} pdfUrl={pdfUrl} />,
    renovations: <RenovationsTab M={M} S={S} set={set} pdfData={pdfData} pdfUrl={pdfUrl} />,
    waterfall: <WaterfallTab M={M} S={S} set={set} pdfData={pdfData} pdfUrl={pdfUrl} />,
    financing: <FinancingTab M={M} S={S} set={set} pdfData={pdfData} pdfUrl={pdfUrl} />,
    returns: <ReturnsTab M={M} pdfData={pdfData} pdfUrl={pdfUrl} />,
    comps: <CompsTab M={M} scenarioData={mergedParsedData} dealId={dealId} marketData={marketData} marketDataLoading={marketDataLoading} onRefetchMarketData={onRefetchMarketData} pdfData={pdfData} pdfUrl={pdfUrl} />,
    model: <UnderwritingModelTab scenarioData={mergedParsedData} dealId={dealId} />,
    montecarlo: <MonteCarloTab scenarioData={mergedParsedData} fullCalcs={fullCalcs} dealId={dealId} />,
  };
  const renderDocsSubView = () => {
    if (docsSubView === "upload") {
      return (
        <AdditionalUploadView
          dealId={dealId}
          files={uploadedFiles}
          setFiles={setUploadedFiles}
          onParsed={(doc) => setExtraParsedDocs((p) => [...p, doc])}
        />
      );
    }
    if (docsSubView === "create") return <CreateDocumentsView />;
    if (docsSubView === "parsed") return <ParsedDataView scenarioData={mergedParsedData} extraDocs={extraParsedDocs} pdfData={pdfData} pdfUrl={pdfUrl} />;
    return <DocsView scenarioData={scenarioData} uploaded={uploadedFiles} onGoUpload={() => setDocsSubView("upload")} />;
  };
  if (phase === "upload") return <UploadPage onEnter={() => setPhase("workspace")} files={uploadedFiles} setFiles={setUploadedFiles} />;
  return (
    <div className="h-screen flex flex-col bg-gray-100 font-sans text-gray-900">
      <TopBar
        onExportPDF={onExportPDF}
        onExportToSheets={onExportToSheets}
        onExportToExcel={onExportToExcel}
        onGeneratePitchDeck={onGeneratePitchDeck}
        onGenerateBusinessPlan={onGenerateBusinessPlan}
        onPushToPipeline={onPushToPipeline}
        isSheetsExporting={isSheetsExporting}
        isExcelExporting={isExcelExporting}
        isExportingPDF={isExportingPDF}
        isPushingToPipeline={isPushingToPipeline}
        sheetsExportStatus={sheetsExportStatus}
        isInPipeline={isInPipeline}
        pipelineSuccess={pipelineSuccess}
        onGoHome={onGoHome}
        dealName={mergedParsedData?.property?.address}
        dealUnits={M.dealUnits}
      />
      <div className="flex flex-1 overflow-hidden">
        <IconRail mode={mode} setMode={setMode} />
        <Sidebar tab={tab} setTab={setTab} cfView={cfView} setCfView={setCfView} mode={mode} setMode={setMode} onExport={() => exportWorkbook(M, S)} docsSubView={docsSubView} setDocsSubView={setDocsSubView} />
        <div className="flex-1 overflow-y-auto">
          {mode === "docs" ? renderDocsSubView() : tabs[tab]}
        </div>
      </div>
    </div>
  );
}
