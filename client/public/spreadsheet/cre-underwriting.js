/* =============================================================================
   CRE UNDERWRITING — SPREADSHEET PLATFORM (Google Sheets replica, pure JS)
   -----------------------------------------------------------------------------
   Drop into any website (no HTML file needed — it builds its own DOM):

     <div id="cre-underwriting"></div>
     <script src="cre-underwriting.js"><\/script>
     <script>CREUnderwriting.init();<\/script>

   What this is:
   - A real spreadsheet UI: cell grid, formula bar, A1 refs, sheet tabs,
     keyboard navigation, in-cell editing — styled like Google Sheets.
   - The full CRE underwriting model (all asset types) is BUILT FROM LIVE CELL
     FORMULAS (=SUM, =IRR, =PMT, cross-sheet refs), so every number is
     traceable and editable exactly like Sheets/Excel.
   - Upload any .xlsx (Excel or a Google Sheets export) and it opens as tabs,
     formulas included. Download exports a real .xlsx with live formulas that
     opens in Excel and imports straight into Google Sheets.

   No hard-coded values in logic: the model template lives in buildTemplate()
   as cell formulas/inputs (all editable in the grid); environment values live
   in CONFIG (overridable via init(options)).
   ========================================================================== */
(function (global) {
  "use strict";

  /* ================================ CONFIG ================================= */
  var CONFIG = {
    mountId: "cre-underwriting",
    sheetJsUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    exportFileName: "CRE_Underwriting_Model.xlsx",
    minRows: 30,
    minCols: 12,
    extraRows: 12,
    extraCols: 2,
    colWidthDefault: 108,
    zoomSteps: [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2],
    colWidthLabel: 236,
    irrLowerBound: -0.9999,
    irrUpperBound: 10,
    irrTolerance: 1e-7,
    irrMaxIterations: 200,
    locale: "en-US"
  };

  /* ============================ VALUE HELPERS ============================== */
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function err(code) { return { __err: code }; }
  function isErr(v) { return v && typeof v === "object" && v.__err; }

  function colToLetters(c) {
    var s = "";
    c = c + 1;
    while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
    return s;
  }
  function lettersToCol(s) {
    var c = 0;
    for (var i = 0; i < s.length; i++) c = c * 26 + (s.charCodeAt(i) - 64);
    return c - 1;
  }
  function addr(col, row) { return colToLetters(col) + (row + 1); }
  function parseAddr(a) {
    var m = /^\$?([A-Z]{1,3})\$?([0-9]+)$/.exec(a);
    if (!m) return null;
    return { col: lettersToCol(m[1]), row: parseInt(m[2], 10) - 1 };
  }

  /* ================================ LEXER ================================== */
  function lex(src) {
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var ch = src[i];
      if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
      if (ch >= "0" && ch <= "9" || (ch === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
        var j = i;
        while (j < n && /[0-9.eE]/.test(src[j])) {
          if ((src[j] === "e" || src[j] === "E") && (src[j + 1] === "+" || src[j + 1] === "-")) j++;
          j++;
        }
        toks.push({ t: "num", v: parseFloat(src.slice(i, j)) });
        i = j; continue;
      }
      if (ch === '"') {
        var j2 = i + 1, out = "";
        while (j2 < n) {
          if (src[j2] === '"' && src[j2 + 1] === '"') { out += '"'; j2 += 2; continue; }
          if (src[j2] === '"') break;
          out += src[j2++];
        }
        toks.push({ t: "str", v: out });
        i = j2 + 1; continue;
      }
      if (ch === "'") { /* quoted sheet name: 'Pro Forma'! */
        var j3 = i + 1, name = "";
        while (j3 < n && src[j3] !== "'") name += src[j3++];
        i = j3 + 1;
        if (src[i] === "!") { toks.push({ t: "sheet", v: name }); i++; continue; }
        toks.push({ t: "str", v: name }); continue;
      }
      if (/[A-Za-z_$]/.test(ch)) {
        var j4 = i;
        while (j4 < n && /[A-Za-z0-9_.$]/.test(src[j4])) j4++;
        var word = src.slice(i, j4);
        i = j4;
        if (src[i] === "!") { toks.push({ t: "sheet", v: word }); i++; continue; }
        var up = word.toUpperCase();
        if (parseAddr(up)) { toks.push({ t: "ref", v: up }); continue; }
        if (up === "TRUE") { toks.push({ t: "bool", v: true }); continue; }
        if (up === "FALSE") { toks.push({ t: "bool", v: false }); continue; }
        toks.push({ t: "id", v: up }); continue;
      }
      if (ch === "#") {
        var em = /^#(REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|CYCLE!)/.exec(src.slice(i));
        if (em) { toks.push({ t: "err", v: "#" + em[1] }); i += em[0].length; continue; }
      }
      if (ch === "<" && src[i + 1] === "=") { toks.push({ t: "op", v: "<=" }); i += 2; continue; }
      if (ch === ">" && src[i + 1] === "=") { toks.push({ t: "op", v: ">=" }); i += 2; continue; }
      if (ch === "<" && src[i + 1] === ">") { toks.push({ t: "op", v: "<>" }); i += 2; continue; }
      if ("+-*/^&%(),:<>=".indexOf(ch) >= 0) { toks.push({ t: "op", v: ch }); i++; continue; }
      throw new Error("Bad token '" + ch + "'");
    }
    return toks;
  }

  /* ================================ PARSER ================================= */
  function parseFormula(src) {
    var toks = lex(src), p = 0;
    function peek() { return toks[p]; }
    function next() { return toks[p++]; }
    function expectOp(v) {
      var t = next();
      if (!t || t.t !== "op" || t.v !== v) throw new Error("Expected '" + v + "'");
    }
    function atom() {
      var t = next();
      if (!t) throw new Error("Unexpected end");
      if (t.t === "num") return { k: "num", v: t.v };
      if (t.t === "str") return { k: "str", v: t.v };
      if (t.t === "bool") return { k: "bool", v: t.v };
      if (t.t === "err") return { k: "errlit", v: t.v };
      if (t.t === "sheet") {
        var r = next();
        if (!r || r.t !== "ref") throw new Error("Expected cell ref after sheet name");
        return refOrRange({ sheet: t.v, a: r.v });
      }
      if (t.t === "ref") return refOrRange({ sheet: null, a: t.v });
      if (t.t === "id") {
        if (peek() && peek().t === "op" && peek().v === "(") {
          next();
          var args = [];
          if (!(peek() && peek().t === "op" && peek().v === ")")) {
            args.push(compare());
            while (peek() && peek().t === "op" && peek().v === ",") { next(); args.push(compare()); }
          }
          expectOp(")");
          return { k: "fn", name: t.v, args: args };
        }
        throw new Error("Unknown name " + t.v);
      }
      if (t.t === "op" && t.v === "(") {
        var e = compare();
        expectOp(")");
        return e;
      }
      if (t.t === "op" && t.v === "-") return { k: "neg", a: unary() };
      if (t.t === "op" && t.v === "+") return unary();
      throw new Error("Unexpected " + (t.v !== undefined ? t.v : t.t));
    }
    function refOrRange(first) {
      if (peek() && peek().t === "op" && peek().v === ":") {
        next();
        var t2 = next();
        if (t2 && t2.t === "sheet") t2 = next();
        if (!t2 || t2.t !== "ref") throw new Error("Bad range");
        return { k: "range", sheet: first.sheet, a: first.a, b: t2.v };
      }
      return { k: "ref", sheet: first.sheet, a: first.a };
    }
    function unary() {
      if (peek() && peek().t === "op" && (peek().v === "-" || peek().v === "+")) {
        var op = next().v;
        var e = unary();
        return op === "-" ? { k: "neg", a: e } : e;
      }
      var a = atom();
      while (peek() && peek().t === "op" && peek().v === "%") { next(); a = { k: "pct", a: a }; }
      return a;
    }
    function pow() {
      var a = unary();
      while (peek() && peek().t === "op" && peek().v === "^") { next(); a = { k: "bin", op: "^", a: a, b: unary() }; }
      return a;
    }
    function mul() {
      var a = pow();
      while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
        var op = next().v; a = { k: "bin", op: op, a: a, b: pow() };
      }
      return a;
    }
    function add() {
      var a = mul();
      while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
        var op = next().v; a = { k: "bin", op: op, a: a, b: mul() };
      }
      return a;
    }
    function concat() {
      var a = add();
      while (peek() && peek().t === "op" && peek().v === "&") { next(); a = { k: "bin", op: "&", a: a, b: add() }; }
      return a;
    }
    function compare() {
      var a = concat();
      while (peek() && peek().t === "op" && ["=", "<", ">", "<=", ">=", "<>"].indexOf(peek().v) >= 0) {
        var op = next().v; a = { k: "bin", op: op, a: a, b: concat() };
      }
      return a;
    }
    var ast = compare();
    if (p < toks.length) throw new Error("Trailing input");
    return ast;
  }

  /* ============================== FUNCTIONS ================================ */
  function toN(v) {
    if (isErr(v)) return v;
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "number") return isFinite(v) ? v : err("#NUM!");
    var n = parseFloat(v);
    return isFinite(n) ? n : err("#VALUE!");
  }
  function flatNums(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var v = args[i];
      if (Array.isArray(v)) {
        var sub = flatNums(v);
        if (isErr(sub)) return sub;
        out = out.concat(sub);
      } else if (isErr(v)) return v;
      else if (isNum(v)) out.push(v);
    }
    return out;
  }
  function npvAt(rate, flows) {
    var v = 0;
    for (var t = 0; t < flows.length; t++) v += flows[t] / Math.pow(1 + rate, t);
    return v;
  }
  function irrCalc(flows) {
    var hasNeg = false, hasPos = false, i;
    for (i = 0; i < flows.length; i++) { if (flows[i] < 0) hasNeg = true; if (flows[i] > 0) hasPos = true; }
    if (!hasNeg || !hasPos) return err("#NUM!");
    var lo = CONFIG.irrLowerBound, hi = CONFIG.irrUpperBound;
    var fLo = npvAt(lo, flows), fHi = npvAt(hi, flows);
    if (fLo * fHi > 0) return err("#NUM!");
    for (i = 0; i < CONFIG.irrMaxIterations; i++) {
      var mid = (lo + hi) / 2, fMid = npvAt(mid, flows);
      if (Math.abs(fMid) < CONFIG.irrTolerance) return mid;
      if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
    }
    return (lo + hi) / 2;
  }

  var FUNCS = {
    SUM: function (a) { var xs = flatNums(a); if (isErr(xs)) return xs; return xs.reduce(function (s, v) { return s + v; }, 0); },
    MIN: function (a) { var xs = flatNums(a); if (isErr(xs)) return xs; return xs.length ? Math.min.apply(null, xs) : 0; },
    MAX: function (a) { var xs = flatNums(a); if (isErr(xs)) return xs; return xs.length ? Math.max.apply(null, xs) : 0; },
    AVERAGE: function (a) { var xs = flatNums(a); if (isErr(xs)) return xs; return xs.length ? xs.reduce(function (s, v) { return s + v; }, 0) / xs.length : err("#DIV/0!"); },
    COUNT: function (a) { var xs = flatNums(a); if (isErr(xs)) return xs; return xs.length; },
    ABS: function (a) { var n = toN(a[0]); return isErr(n) ? n : Math.abs(n); },
    ROUND: function (a) {
      var n = toN(a[0]), d = toN(a.length > 1 ? a[1] : 0);
      if (isErr(n)) return n; if (isErr(d)) return d;
      var f = Math.pow(10, d); return Math.round(n * f) / f;
    },
    POWER: function (a) { var x = toN(a[0]), y = toN(a[1]); if (isErr(x)) return x; if (isErr(y)) return y; return Math.pow(x, y); },
    SQRT: function (a) { var n = toN(a[0]); if (isErr(n)) return n; return n < 0 ? err("#NUM!") : Math.sqrt(n); },
    MOD: function (a) { var x = toN(a[0]), y = toN(a[1]); if (isErr(x)) return x; if (isErr(y)) return y; return y === 0 ? err("#DIV/0!") : x - y * Math.floor(x / y); },
    AND: function (a) { for (var i = 0; i < a.length; i++) { if (isErr(a[i])) return a[i]; if (!a[i]) return false; } return true; },
    OR: function (a) { for (var i = 0; i < a.length; i++) { if (isErr(a[i])) return a[i]; if (a[i]) return true; } return false; },
    NOT: function (a) { return isErr(a[0]) ? a[0] : !a[0]; },
    IFERROR: function (a) { return isErr(a[0]) ? a[1] : a[0]; },
    INDEX: function (a) {
      var arr = Array.isArray(a[0]) ? a[0] : [a[0]];
      var n = toN(a[1]); if (isErr(n)) return n;
      n = Math.round(n);
      if (a.length >= 3) {
        var cc = toN(a[2]); if (isErr(cc)) return cc;
        cc = Math.round(cc);
        var w = arr.__w || arr.length;
        var idx = (n - 1) * w + (cc - 1);
        if (n < 1 || cc < 1 || cc > w || idx >= arr.length) return err("#REF!");
        var v2 = arr[idx];
        return v2 === undefined ? 0 : v2;
      }
      if (n < 1 || n > arr.length) return err("#REF!");
      var v = arr[n - 1];
      return v === undefined ? 0 : v;
    },
    NPV: function (a) {
      var r = toN(a[0]); if (isErr(r)) return r;
      var xs = flatNums(a.slice(1)); if (isErr(xs)) return xs;
      var v = 0;
      for (var t = 0; t < xs.length; t++) v += xs[t] / Math.pow(1 + r, t + 1);
      return v;
    },
    IRR: function (a) { var xs = flatNums(a); if (isErr(xs)) return xs; return irrCalc(xs); },
    /* Excel-compatible signs: PMT(rate,nper,pv) is negative for +pv */
    PMT: function (a) {
      var r = toN(a[0]), n = toN(a[1]), pv = toN(a[2]);
      if (isErr(r)) return r; if (isErr(n)) return n; if (isErr(pv)) return pv;
      if (n === 0) return err("#DIV/0!");
      if (r === 0) return -pv / n;
      var f = Math.pow(1 + r, n);
      return -(pv * r * f) / (f - 1);
    },
    PV: function (a) {
      var r = toN(a[0]), n = toN(a[1]), pmt = toN(a[2]);
      if (isErr(r)) return r; if (isErr(n)) return n; if (isErr(pmt)) return pmt;
      if (r === 0) return -pmt * n;
      var f = Math.pow(1 + r, n);
      return -pmt * (f - 1) / (r * f);
    },
    FV: function (a) {
      var r = toN(a[0]), n = toN(a[1]), pmt = toN(a[2]), pv = toN(a.length > 3 ? a[3] : 0);
      if (isErr(r)) return r; if (isErr(n)) return n; if (isErr(pmt)) return pmt; if (isErr(pv)) return pv;
      if (r === 0) return -(pv + pmt * n);
      var f = Math.pow(1 + r, n);
      return -(pv * f + pmt * (f - 1) / r);
    }
    /* IF and SCEN.IRR are wired inside the evaluator (lazy / needs context). */
  };

  /* =============================== WORKBOOK ================================ */
  function Workbook() {
    this.order = [];
    this.sheets = {};
  }
  Workbook.prototype.addSheet = function (name) {
    if (!this.sheets[name]) { this.sheets[name] = { cells: {} }; this.order.push(name); }
    return this.sheets[name];
  };
  Workbook.prototype.cell = function (sheet, a1) {
    var sh = this.sheets[sheet];
    return sh ? sh.cells[a1] : undefined;
  };
  Workbook.prototype.setCell = function (sheet, a1, data) {
    this.addSheet(sheet).cells[a1] = data;
  };
  Workbook.prototype.usedRange = function (sheet) {
    var sh = this.sheets[sheet], maxR = 0, maxC = 0;
    if (sh) Object.keys(sh.cells).forEach(function (a1) {
      var p = parseAddr(a1);
      if (p) { if (p.row > maxR) maxR = p.row; if (p.col > maxC) maxC = p.col; }
    });
    return { rows: maxR + 1, cols: maxC + 1 };
  };

  /* =============================== EVALUATOR =============================== */
  function Evaluator(wb) {
    this.wb = wb;
    this.memo = {};
    this.stack = {};
    this.overrides = null;
    this.scenCache = {};
    this.scenDepth = 0;
  }
  Evaluator.prototype.reset = function () { this.memo = {}; this.stack = {}; this.scenCache = {}; };
  Evaluator.prototype.value = function (sheet, a1raw) {
    var a1 = a1raw.replace(/\$/g, "");
    var k = sheet + "!" + a1;
    if (this.overrides && k in this.overrides) return this.overrides[k];
    if (k in this.memo) return this.memo[k];
    if (this.stack[k]) return err("#CYCLE!");
    if (!this.wb.sheets[sheet]) { this.memo[k] = err("#REF!"); return this.memo[k]; }
    var cell = this.wb.cell(sheet, a1);
    var out;
    if (!cell) out = null;
    else if (cell.f !== undefined && cell.f !== null) {
      this.stack[k] = true;
      try {
        var ast = cell.__ast || (cell.__ast = parseFormula(cell.f));
        out = this.evalNode(ast, sheet);
      } catch (e) {
        out = err("#NAME?");
      }
      delete this.stack[k];
      if (isErr(out) && out.__err === "#NAME?" && cell.iv !== undefined) out = cell.iv;
    } else out = cell.v === undefined ? null : cell.v;
    this.memo[k] = out;
    return out;
  };
  Evaluator.prototype.rangeValues = function (sheet, a, b) {
    var p1 = parseAddr(a.replace(/\$/g, "")), p2 = parseAddr(b.replace(/\$/g, ""));
    if (!p1 || !p2) return err("#REF!");
    var out = [];
    var r1 = Math.min(p1.row, p2.row), rN = Math.max(p1.row, p2.row);
    var c1 = Math.min(p1.col, p2.col), cN = Math.max(p1.col, p2.col);
    for (var r = r1; r <= rN; r++) {
      for (var c = c1; c <= cN; c++) out.push(this.value(sheet, addr(c, r)));
    }
    out.__w = cN - c1 + 1;
    out.__h = rN - r1 + 1;
    return out;
  };
  function valEq(a, b) {
    if (typeof a === "string" || typeof b === "string") {
      return String(a === null ? "" : a).toUpperCase() === String(b === null ? "" : b).toUpperCase();
    }
    return toN(a) === toN(b);
  }
  Evaluator.prototype.evalNode = function (node, sheet) {
    var self = this;
    switch (node.k) {
      case "num": return node.v;
      case "str": return node.v;
      case "bool": return node.v;
      case "errlit": return err(node.v);
      case "ref": return this.value(node.sheet || sheet, node.a);
      case "range": return this.rangeValues(node.sheet || sheet, node.a, node.b);
      case "neg": { var v = toN(this.evalNode(node.a, sheet)); return isErr(v) ? v : -v; }
      case "pct": { var pv = toN(this.evalNode(node.a, sheet)); return isErr(pv) ? pv : pv / 100; }
      case "bin": {
        var a = this.evalNode(node.a, sheet);
        var b = this.evalNode(node.b, sheet);
        if (node.op === "&") {
          return String(isErr(a) ? a.__err : a === null ? "" : a) +
                 String(isErr(b) ? b.__err : b === null ? "" : b);
        }
        if (isErr(a)) return a;
        if (isErr(b)) return b;
        switch (node.op) {
          case "+": { var x = toN(a), y = toN(b); if (isErr(x)) return x; if (isErr(y)) return y; return x + y; }
          case "-": { var x2 = toN(a), y2 = toN(b); if (isErr(x2)) return x2; if (isErr(y2)) return y2; return x2 - y2; }
          case "*": { var x3 = toN(a), y3 = toN(b); if (isErr(x3)) return x3; if (isErr(y3)) return y3; return x3 * y3; }
          case "/": { var x4 = toN(a), y4 = toN(b); if (isErr(x4)) return x4; if (isErr(y4)) return y4; return y4 === 0 ? err("#DIV/0!") : x4 / y4; }
          case "^": { var x5 = toN(a), y5 = toN(b); if (isErr(x5)) return x5; if (isErr(y5)) return y5; return Math.pow(x5, y5); }
          case "=": return valEq(a, b);
          case "<>": return !valEq(a, b);
          case "<": return toN(a) < toN(b);
          case ">": return toN(a) > toN(b);
          case "<=": return toN(a) <= toN(b);
          case ">=": return toN(a) >= toN(b);
        }
        return err("#VALUE!");
      }
      case "fn": {
        if (node.name === "IF") {
          var cond = this.evalNode(node.args[0], sheet);
          if (isErr(cond)) return cond;
          if (cond) return node.args.length > 1 ? this.evalNode(node.args[1], sheet) : true;
          return node.args.length > 2 ? this.evalNode(node.args[2], sheet) : false;
        }
        if (node.name === "SCEN.IRR") return this.scenIRR(node, sheet);
        var fn = FUNCS[node.name];
        if (!fn) return err("#NAME?");
        var args = node.args.map(function (n2) { return self.evalNode(n2, sheet); });
        return fn(args);
      }
    }
    return err("#VALUE!");
  };
  /* SCEN.IRR(exitCap, rentGrowth): in-app Data Table — re-evaluates the
     workbook's levered-IRR cell with the two Inputs cells overridden.
     Exported to .xlsx as computed values (noted on the Sensitivity tab).   */
  Evaluator.prototype.scenIRR = function (node, sheet) {
    if (this.scenDepth > 0) return err("#CYCLE!");
    var cap = toN(this.evalNode(node.args[0], sheet));
    var g = toN(this.evalNode(node.args[1], sheet));
    if (isErr(cap)) return cap; if (isErr(g)) return g;
    var key = cap + "|" + g;
    if (key in this.scenCache) return this.scenCache[key];
    var sub = new Evaluator(this.wb);
    sub.scenDepth = this.scenDepth + 1;
    sub.overrides = {};
    sub.overrides[TPL.exitCapKey] = cap;
    sub.overrides[TPL.rentGrowthKey] = g;
    var out = sub.value(TPL.irrSheet, TPL.irrA1);
    this.scenCache[key] = out;
    return out;
  };

  /* ============ TEMPLATE: the full underwriting model as formulas =========== */
  /* TPL records key cell addresses so the app (SCEN.IRR, exports) can find
     them; everything else is ordinary cells the user can edit or extend.    */
  var TPL = {
    irrSheet: "Cash Flows", irrA1: "B7",
    exitCapKey: "Inputs!B47", rentGrowthKey: "Inputs!B32"
  };

  function buildTemplate() {
    var wb = new Workbook();
    var S; /* current sheet name */
    function set(a1, v, fmt, style) {
      var cell = {};
      if (typeof v === "string" && v.charAt(0) === "=") cell.f = v.slice(1);
      else cell.v = v;
      if (fmt) cell.fmt = fmt;
      if (style) cell.style = style;
      wb.setCell(S, a1, cell);
    }
    function label(a1, text, style) { set(a1, text, null, style || "label"); }
    function head(a1, text) { set(a1, text, null, "head"); }

    /* ------------------------------ INPUTS ------------------------------- */
    S = "Inputs"; wb.addSheet(S);
    head("A1", "CRE UNDERWRITING — ASSUMPTIONS (edit the blue cells)");
    head("A3", "DEAL");
    label("A4", "Property Name"); set("B4", "Sample Deal", null, "input");
    label("A5", "Property Type (Multifamily / Retail / Industrial / Office / Self-Storage / Mixed-Use)"); set("B5", "Multifamily", null, "input");
    label("A6", "Income Basis (UNIT or SF)"); set("B6", "UNIT", null, "input");
    label("A7", "Units"); set("B7", 100, "int", "input");
    label("A8", "Rentable SF"); set("B8", 90000, "int", "input");
    label("A9", "Purchase Price"); set("B9", 12000000, "cur", "input");
    label("A10", "Closing Costs %"); set("B10", 0.02, "pct", "input");
    label("A11", "CapEx / Renovation Budget"); set("B11", 500000, "cur", "input");

    head("A13", "INCOME (YEAR 1)");
    label("A14", "Avg Rent / Unit / Month (UNIT basis)"); set("B14", 1250, "cur", "input");
    label("A15", "Avg Rent / SF / Year (SF basis)"); set("B15", 22, "cur2", "input");
    label("A16", "Other Income (Annual)"); set("B16", 60000, "cur", "input");
    label("A17", "Vacancy %"); set("B17", 0.05, "pct", "input");
    label("A18", "Credit Loss %"); set("B18", 0.01, "pct", "input");
    label("A19", "Concessions %"); set("B19", 0.005, "pct", "input");

    head("A21", "OPERATING EXPENSES (YEAR 1)");
    var exp = [
      ["Property Taxes", 150000], ["Insurance", 55000], ["Utilities", 90000],
      ["Repairs & Maintenance", 85000], ["Payroll", 110000], ["Administrative", 25000],
      ["Turnover", 40000], ["Landscaping / Grounds", 18000], ["Marketing", 15000],
      ["Legal & Professional", 10000]
    ];
    for (var e = 0; e < exp.length; e++) {
      label("A" + (22 + e), exp[e][0]); set("B" + (22 + e), exp[e][1], "cur", "input");
    }
    label("A32", "Management Fee (% of EGI)"); set("B32", 0.04, "pct", "input");
    label("A33", "Replacement Reserves ($ / Unit / Yr)"); set("B33", 300, "cur", "input");

    head("A35", "GROWTH RATES (ANNUAL)");
    label("A36", "Rent Growth"); set("B36", 0.03, "pct", "input");
    label("A37", "Other Income Growth"); set("B37", 0.02, "pct", "input");
    label("A38", "Expense Growth"); set("B38", 0.025, "pct", "input");
    label("A39", "Property Tax Growth"); set("B39", 0.02, "pct", "input");

    head("A41", "FINANCING");
    label("A42", "Manual Loan Amount (0 = auto-size)"); set("B42", 0, "cur", "input");
    label("A43", "Max LTV"); set("B43", 0.70, "pct", "input");
    label("A44", "Min DSCR"); set("B44", 1.25, "x", "input");
    label("A45", "Min Debt Yield"); set("B45", 0.09, "pct", "input");
    label("A46", "Interest Rate"); set("B46", 0.0625, "pct", "input");
    label("A47", "Amortization (Years)"); set("B47", 30, "int", "input");
    label("A48", "Interest-Only Period (Years)"); set("B48", 1, "int", "input");
    label("A49", "Loan Fee %"); set("B49", 0.01, "pct", "input");

    head("A51", "HOLD & EXIT");
    label("A52", "Hold Period (Years, 1-10)"); set("B52", 5, "int", "input");
    label("A53", "Exit Cap Rate"); set("B53", 0.06, "pct", "input");
    label("A54", "Sale Costs %"); set("B54", 0.02, "pct", "input");

    head("A56", "EQUITY STRUCTURE");
    label("A57", "LP Equity Share"); set("B57", 0.90, "pct", "input");
    label("A58", "Preferred Return (compounding)"); set("B58", 0.08, "pct", "input");
    label("A59", "LP Residual Split (after pref + return of capital)"); set("B59", 0.70, "pct", "input");

    head("A61", "SENSITIVITY STEPS");
    label("A62", "Exit Cap Step"); set("B62", 0.0025, "pct", "input");
    label("A63", "Rent Growth Step"); set("B63", 0.005, "pct", "input");

    TPL.exitCapKey = "Inputs!B53";
    TPL.rentGrowthKey = "Inputs!B36";

    /* ----------------------------- PRO FORMA ------------------------------ */
    /* Columns B..L = Years 1..11 (Year 11 exists only to supply forward NOI). */
    S = "Pro Forma"; wb.addSheet(S);
    head("A1", "OPERATING PRO FORMA (Years 1-10; Yr 11 = forward year for exit value)");
    label("A2", "Year", "bold");
    var cols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    set("B2", 1, "int", "bold");
    for (var c = 1; c < cols.length; c++) set(cols[c] + "2", "=" + cols[c - 1] + "2+1", "int", "bold");

    label("A3", "Gross Potential Rent");
    set("B3", '=IF(Inputs!$B$6="SF",Inputs!$B$8*Inputs!$B$15,Inputs!$B$7*Inputs!$B$14*12)', "cur");
    label("A4", "Other Income"); set("B4", "=Inputs!$B$16", "cur");
    label("A5", "Vacancy"); label("A6", "Credit Loss"); label("A7", "Concessions");
    set("B5", "=-B3*Inputs!$B$17", "cur"); set("B6", "=-B3*Inputs!$B$18", "cur"); set("B7", "=-B3*Inputs!$B$19", "cur");
    label("A8", "Effective Gross Income", "bold"); set("B8", "=SUM(B3:B7)", "cur", "bold");
    /* expense lines rows 10-19 pull Inputs B22..B31; taxes grow at tax rate  */
    for (var e2 = 0; e2 < exp.length; e2++) {
      label("A" + (10 + e2), exp[e2][0]);
      set("B" + (10 + e2), "=-Inputs!$B$" + (22 + e2), "cur");
    }
    label("A20", "Management Fee"); set("B20", "=-B8*Inputs!$B$32", "cur");
    label("A21", "Replacement Reserves"); set("B21", "=-Inputs!$B$7*Inputs!$B$33", "cur");
    label("A22", "Total Operating Expenses", "bold"); set("B22", "=SUM(B10:B21)", "cur", "bold");
    label("A23", "Net Operating Income", "bold"); set("B23", "=B8+B22", "cur", "noi");
    label("A24", "OpEx Ratio"); set("B24", "=-B22/B8", "pct");

    for (var c2 = 1; c2 < cols.length; c2++) {
      var C = cols[c2], P = cols[c2 - 1];
      set(C + "3", "=" + P + "3*(1+Inputs!$B$36)", "cur");
      set(C + "4", "=" + P + "4*(1+Inputs!$B$37)", "cur");
      set(C + "5", "=-" + C + "3*Inputs!$B$17", "cur");
      set(C + "6", "=-" + C + "3*Inputs!$B$18", "cur");
      set(C + "7", "=-" + C + "3*Inputs!$B$19", "cur");
      set(C + "8", "=SUM(" + C + "3:" + C + "7)", "cur", "bold");
      set(C + "10", "=" + P + "10*(1+Inputs!$B$39)", "cur"); /* taxes @ tax growth */
      for (var r2 = 11; r2 <= 19; r2++) set(C + r2, "=" + P + r2 + "*(1+Inputs!$B$38)", "cur");
      set(C + "20", "=-" + C + "8*Inputs!$B$32", "cur");
      set(C + "21", "=" + P + "21*(1+Inputs!$B$38)", "cur");
      set(C + "22", "=SUM(" + C + "10:" + C + "21)", "cur", "bold");
      set(C + "23", "=" + C + "8+" + C + "22", "cur", "noi");
      set(C + "24", "=-" + C + "22/" + C + "8", "pct");
    }

    /* -------------------------------- DEBT -------------------------------- */
    S = "Debt"; wb.addSheet(S);
    head("A1", "LOAN SIZING & AMORTIZATION");
    label("A3", "Loan @ Max LTV"); set("B3", "=Inputs!$B$9*Inputs!$B$43", "cur");
    label("A4", "Loan @ Min DSCR"); set("B4", "=PV(Inputs!$B$46/12,Inputs!$B$47*12,-('Pro Forma'!$B$23/Inputs!$B$44)/12)", "cur");
    label("A5", "Loan @ Min Debt Yield"); set("B5", "='Pro Forma'!$B$23/Inputs!$B$45", "cur");
    label("A6", "LOAN AMOUNT", "bold"); set("B6", "=IF(Inputs!$B$42>0,Inputs!$B$42,MIN(B3:B5))", "cur", "noi");
    label("A7", "Monthly Payment (amortizing)"); set("B7", "=-PMT(Inputs!$B$46/12,Inputs!$B$47*12,$B$6)", "cur2");
    label("A8", "LTV"); set("B8", "=$B$6/Inputs!$B$9", "pct");

    label("A10", "Year", "bold");
    var dc = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]; /* years 1-10 */
    set("B10", 1, "int", "bold");
    for (var d1 = 1; d1 < dc.length; d1++) set(dc[d1] + "10", "=" + dc[d1 - 1] + "10+1", "int", "bold");
    label("A11", "Beginning Balance"); set("B11", "=$B$6", "cur");
    label("A12", "Ending Balance");
    label("A13", "Principal");
    label("A14", "Debt Service");
    label("A15", "Interest");
    label("A16", "DSCR");
    label("A17", "Debt Yield");
    for (var d2 = 0; d2 < dc.length; d2++) {
      var D = dc[d2];
      if (d2 > 0) set(D + "11", "=" + dc[d2 - 1] + "12", "cur");
      set(D + "12", "=IF(" + D + "10<=Inputs!$B$48," + D + "11,MAX(0," + D +
        "11*POWER(1+Inputs!$B$46/12,12)-$B$7*(POWER(1+Inputs!$B$46/12,12)-1)/(Inputs!$B$46/12)))", "cur");
      set(D + "13", "=" + D + "11-" + D + "12", "cur");
      set(D + "14", "=IF(" + D + "10<=Inputs!$B$48," + D + "11*Inputs!$B$46,$B$7*12)", "cur");
      set(D + "15", "=" + D + "14-" + D + "13", "cur");
      set(D + "16", "='Pro Forma'!" + D + "23/" + D + "14", "x");
      set(D + "17", "='Pro Forma'!" + D + "23/$B$6", "pct");
    }

    /* ------------------------------- SUMMARY ------------------------------- */
    S = "Summary"; wb.addSheet(S);
    head("A1", "DEAL SUMMARY");
    label("A2", "Property"); set("B2", "=Inputs!B4");
    head("A4", "SOURCES & USES");
    label("A5", "Purchase Price"); set("B5", "=Inputs!$B$9", "cur");
    label("A6", "Closing Costs"); set("B6", "=Inputs!$B$9*Inputs!$B$10", "cur");
    label("A7", "CapEx Budget"); set("B7", "=Inputs!$B$11", "cur");
    label("A8", "Loan Fee"); set("B8", "=Debt!$B$6*Inputs!$B$49", "cur");
    label("A9", "Total Uses", "bold"); set("B9", "=SUM(B5:B8)", "cur", "bold");
    label("A10", "Loan"); set("B10", "=Debt!$B$6", "cur");
    label("A11", "Equity Required", "bold"); set("B11", "=B9-B10", "cur", "noi");

    head("A13", "YEAR 1 METRICS");
    label("A14", "NOI (Year 1)"); set("B14", "='Pro Forma'!$B$23", "cur");
    label("A15", "Going-in Cap Rate"); set("B15", "=B14/Inputs!$B$9", "pct");
    label("A16", "Price / Unit"); set("B16", "=IFERROR(Inputs!$B$9/Inputs!$B$7,0)", "cur");
    label("A17", "Price / SF"); set("B17", "=IFERROR(Inputs!$B$9/Inputs!$B$8,0)", "cur2");
    label("A18", "GRM"); set("B18", "=Inputs!$B$9/'Pro Forma'!$B$3", "x");
    label("A19", "OpEx Ratio"); set("B19", "='Pro Forma'!$B$24", "pct");
    label("A20", "DSCR (Year 1)"); set("B20", "=Debt!$B$16", "x");
    label("A21", "Debt Yield (Year 1)"); set("B21", "=Debt!$B$17", "pct");
    label("A22", "LTV"); set("B22", "=Debt!$B$8", "pct");
    label("A23", "Cash-on-Cash (Year 1)"); set("B23", "='Cash Flows'!C5/$B$11", "pct");
    label("A24", "Break-even Occupancy");
    set("B24", "=(-'Pro Forma'!$B$22+Debt!$B$14)/('Pro Forma'!$B$3+'Pro Forma'!$B$4)", "pct");

    head("A26", "EXIT");
    label("A27", "Hold (Years)"); set("B27", "=Inputs!$B$52", "int");
    label("A28", "Forward NOI (Yr Hold+1)"); set("B28", "=INDEX('Pro Forma'!B23:L23,$B$27+1)", "cur");
    label("A29", "Exit Cap Rate"); set("B29", "=Inputs!$B$53", "pct");
    label("A30", "Gross Sale Price"); set("B30", "=B28/B29", "cur");
    label("A31", "Sale Costs"); set("B31", "=-B30*Inputs!$B$54", "cur");
    label("A32", "Loan Payoff"); set("B32", "=-INDEX(Debt!B12:K12,$B$27)", "cur");
    label("A33", "Net Sale Proceeds", "bold"); set("B33", "=B30+B31+B32", "cur", "bold");

    head("A35", "RETURNS");
    label("A36", "Levered IRR"); set("B36", "='Cash Flows'!$B$7", "pct");
    label("A37", "Unlevered IRR"); set("B37", "='Cash Flows'!$B$8", "pct");
    label("A38", "Equity Multiple"); set("B38", "='Cash Flows'!$B$9", "x");
    label("A39", "Avg Cash-on-Cash"); set("B39", "='Cash Flows'!$B$10", "pct");
    label("A40", "Total Profit"); set("B40", "='Cash Flows'!$B$11", "cur");
    head("A42", "WATERFALL RETURNS");
    label("A43", "LP IRR"); set("B43", "='Cash Flows'!$B$12", "pct");
    label("A44", "LP Equity Multiple"); set("B44", "='Cash Flows'!$B$13", "x");
    label("A45", "GP IRR"); set("B45", "='Cash Flows'!$B$14", "pct");
    label("A46", "GP Equity Multiple"); set("B46", "='Cash Flows'!$B$15", "x");

    /* ----------------------------- CASH FLOWS ------------------------------ */
    /* Columns B..L = Years 0..10.                                            */
    S = "Cash Flows"; wb.addSheet(S);
    head("A1", "CASH FLOWS & RETURNS (IRR ranges ignore blank years past the hold)");
    label("A2", "Year", "bold");
    var yc = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    set("B2", 0, "int", "bold");
    for (var y1 = 1; y1 < yc.length; y1++) set(yc[y1] + "2", "=" + yc[y1 - 1] + "2+1", "int", "bold");
    label("A3", "Levered Cash Flow");
    label("A4", "Unlevered Cash Flow");
    label("A5", "Operating CF (after debt, pre-sale)");
    set("B3", "=-Summary!$B$11", "cur");
    set("B4", "=-(Summary!$B$5+Summary!$B$6+Summary!$B$7)", "cur");
    /* Year y (col index i on this sheet) maps to Pro Forma / Debt column i-1 */
    var pfCols = ["", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    for (var y2 = 1; y2 <= 10; y2++) {
      var Y = yc[y2], M = pfCols[y2];
      set(Y + "5", "=IF(" + Y + "2>Inputs!$B$52,\"\",'Pro Forma'!" + M + "23-Debt!" + M + "14)", "cur");
      set(Y + "3", "=IF(" + Y + "2>Inputs!$B$52,\"\"," + Y + "5+IF(" + Y + "2=Inputs!$B$52,Summary!$B$33,0))", "cur");
      set(Y + "4", "=IF(" + Y + "2>Inputs!$B$52,\"\",'Pro Forma'!" + M + "23+IF(" + Y + "2=Inputs!$B$52,Summary!$B$30+Summary!$B$31,0))", "cur");
    }
    label("A7", "Levered IRR", "bold"); set("B7", "=IRR(B3:L3)", "pct", "noi");
    label("A8", "Unlevered IRR", "bold"); set("B8", "=IRR(B4:L4)", "pct", "bold");
    label("A9", "Equity Multiple", "bold"); set("B9", "=SUM(C3:L3)/Summary!$B$11", "x", "bold");
    label("A10", "Avg Cash-on-Cash"); set("B10", "=SUM(C5:L5)/Inputs!$B$52/Summary!$B$11", "pct");
    label("A11", "Total Profit"); set("B11", "=SUM(C3:L3)-Summary!$B$11", "cur");
    label("A12", "LP IRR", "bold"); set("B12", "=IRR(B17:L17)", "pct", "bold");
    label("A13", "LP Equity Multiple"); set("B13", "=SUM(C17:L17)/(Summary!$B$11*Inputs!$B$57)", "x");
    label("A14", "GP IRR", "bold"); set("B14", "=IRR(B18:L18)", "pct", "bold");
    label("A15", "GP Equity Multiple"); set("B15", "=IFERROR(SUM(C18:L18)/(Summary!$B$11*(1-Inputs!$B$57)),0)", "x");
    label("A17", "LP Cash Flow"); label("A18", "GP Cash Flow");
    set("B17", "=-Summary!$B$11*Inputs!$B$57", "cur");
    set("B18", "=-Summary!$B$11*(1-Inputs!$B$57)", "cur");
    for (var y3 = 1; y3 <= 10; y3++) {
      var Y2 = yc[y3], W = pfCols[y3];
      set(Y2 + "17", "=IF(" + Y2 + "2>Inputs!$B$52,\"\",Waterfall!" + W + "12)", "cur");
      set(Y2 + "18", "=IF(" + Y2 + "2>Inputs!$B$52,\"\",Waterfall!" + W + "13)", "cur");
    }

    /* ------------------------------ WATERFALL ------------------------------ */
    /* Pref (compounding) -> return of capital -> residual promote split.
       Both partners earn pref pari passu on capital; LP gets its equity share
       of pref + ROC; residual splits at the LP Residual Split input.         */
    S = "Waterfall"; wb.addSheet(S);
    head("A1", "EQUITY WATERFALL — pref, return of capital, promote (per year)");
    label("A2", "Year", "bold");
    var wc = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    set("B2", 1, "int", "bold");
    for (var w1 = 1; w1 < wc.length; w1++) set(wc[w1] + "2", "=" + wc[w1 - 1] + "2+1", "int", "bold");
    label("A3", "Distributable Cash");
    label("A4", "Beginning Unreturned Capital");
    label("A5", "Beginning Unpaid Pref");
    label("A6", "Pref Accrual");
    label("A7", "Pref Paid");
    label("A8", "Return of Capital");
    label("A9", "Residual");
    label("A10", "Ending Unreturned Capital");
    label("A11", "Ending Unpaid Pref");
    label("A12", "LP Distribution", "bold");
    label("A13", "GP Distribution", "bold");
    for (var w2 = 0; w2 < wc.length; w2++) {
      var Wc = wc[w2], Pw = w2 > 0 ? wc[w2 - 1] : null;
      set(Wc + "3", "=IF(" + Wc + "2>Inputs!$B$52,0,MAX(0,'Cash Flows'!" + yc[w2 + 1] + "3))", "cur");
      set(Wc + "4", w2 === 0 ? "=Summary!$B$11" : "=" + Pw + "10", "cur");
      set(Wc + "5", w2 === 0 ? "=0" : "=" + Pw + "11", "cur");
      set(Wc + "6", "=(" + Wc + "4+" + Wc + "5)*Inputs!$B$58", "cur");
      set(Wc + "7", "=MIN(" + Wc + "3," + Wc + "5+" + Wc + "6)", "cur");
      set(Wc + "8", "=MIN(" + Wc + "3-" + Wc + "7," + Wc + "4)", "cur");
      set(Wc + "9", "=" + Wc + "3-" + Wc + "7-" + Wc + "8", "cur");
      set(Wc + "10", "=" + Wc + "4-" + Wc + "8", "cur");
      set(Wc + "11", "=" + Wc + "5+" + Wc + "6-" + Wc + "7", "cur");
      set(Wc + "12", "=Inputs!$B$57*(" + Wc + "7+" + Wc + "8)+Inputs!$B$59*" + Wc + "9", "cur", "bold");
      set(Wc + "13", "=" + Wc + "3-" + Wc + "12", "cur", "bold");
    }

    /* ----------------------------- SENSITIVITY ----------------------------- */
    S = "Sensitivity"; wb.addSheet(S);
    head("A1", "LEVERED IRR SENSITIVITY — Exit Cap (across) x Rent Growth (down)");
    label("A2", "In-app these cells use SCEN.IRR(cap,growth); the .xlsx export writes the computed values.", "note");
    set("D4", "=Inputs!$B$53-2*Inputs!$B$62", "pct", "bold");
    set("E4", "=Inputs!$B$53-Inputs!$B$62", "pct", "bold");
    set("F4", "=Inputs!$B$53", "pct", "bold");
    set("G4", "=Inputs!$B$53+Inputs!$B$62", "pct", "bold");
    set("H4", "=Inputs!$B$53+2*Inputs!$B$62", "pct", "bold");
    set("C5", "=Inputs!$B$36+2*Inputs!$B$63", "pct", "bold");
    set("C6", "=Inputs!$B$36+Inputs!$B$63", "pct", "bold");
    set("C7", "=Inputs!$B$36", "pct", "bold");
    set("C8", "=Inputs!$B$36-Inputs!$B$63", "pct", "bold");
    set("C9", "=Inputs!$B$36-2*Inputs!$B$63", "pct", "bold");
    var scols = ["D", "E", "F", "G", "H"];
    for (var sr = 5; sr <= 9; sr++) {
      for (var sc = 0; sc < scols.length; sc++) {
        set(scols[sc] + sr, "=SCEN.IRR(" + scols[sc] + "$4,$C" + sr + ")", "pct");
      }
    }
    return wb;
  }


  /* ===================== EXTENDED FUNCTION LIBRARY ========================= */
  function makeCrit(c) {
    if (typeof c === "string") {
      var m = /^(<=|>=|<>|=|<|>)(.*)$/.exec(c);
      if (m) {
        var op = m[1], rhsRaw = m[2], rhsN = parseFloat(rhsRaw);
        var rhsIsN = rhsRaw !== "" && isFinite(Number(rhsRaw));
        return function (v) {
          if (rhsIsN) {
            var n = typeof v === "number" ? v : NaN;
            if (!isFinite(n)) return op === "<>";
            switch (op) {
              case "<": return n < rhsN; case ">": return n > rhsN;
              case "<=": return n <= rhsN; case ">=": return n >= rhsN;
              case "<>": return n !== rhsN; default: return n === rhsN;
            }
          }
          var s = String(v === null || v === undefined ? "" : v).toUpperCase();
          var eq = s === rhsRaw.toUpperCase();
          return op === "<>" ? !eq : eq;
        };
      }
      var target = c.toUpperCase();
      return function (v) { return String(v === null || v === undefined ? "" : v).toUpperCase() === target; };
    }
    var cn = typeof c === "number" ? c : NaN;
    return function (v) { return typeof v === "number" && v === cn; };
  }
  function asArr(v) { return Array.isArray(v) ? v : [v]; }
  function firstErr(arr) { for (var i = 0; i < arr.length; i++) if (isErr(arr[i])) return arr[i]; return null; }

  Object.assign(FUNCS, {
    COUNTA: function (a) {
      var arr = [];
      a.forEach(function (v) { arr = arr.concat(asArr(v)); });
      return arr.filter(function (v) { return v !== null && v !== undefined && v !== ""; }).length;
    },
    SUMIF: function (a) {
      var rng = asArr(a[0]), sumR = a.length > 2 ? asArr(a[2]) : rng;
      var e1 = firstErr(rng); if (e1) return e1;
      var crit = makeCrit(a[1]), s = 0;
      for (var i = 0; i < rng.length; i++) {
        if (crit(rng[i])) { var v = sumR[i]; if (isErr(v)) return v; if (isNum(v)) s += v; }
      }
      return s;
    },
    COUNTIF: function (a) {
      var rng = asArr(a[0]); var e1 = firstErr(rng); if (e1) return e1;
      var crit = makeCrit(a[1]), n = 0;
      for (var i = 0; i < rng.length; i++) if (crit(rng[i])) n++;
      return n;
    },
    AVERAGEIF: function (a) {
      var rng = asArr(a[0]), avgR = a.length > 2 ? asArr(a[2]) : rng;
      var crit = makeCrit(a[1]), s = 0, n = 0;
      for (var i = 0; i < rng.length; i++) {
        if (crit(rng[i])) { var v = avgR[i]; if (isErr(v)) return v; if (isNum(v)) { s += v; n++; } }
      }
      return n ? s / n : err("#DIV/0!");
    },
    SUMIFS: function (a) {
      var sumR = asArr(a[0]);
      var crits = [];
      for (var i = 1; i + 1 < a.length; i += 2) crits.push({ r: asArr(a[i]), c: makeCrit(a[i + 1]) });
      var s = 0;
      for (var j = 0; j < sumR.length; j++) {
        var ok = true;
        for (var k = 0; k < crits.length; k++) if (!crits[k].c(crits[k].r[j])) { ok = false; break; }
        if (ok) { var v = sumR[j]; if (isErr(v)) return v; if (isNum(v)) s += v; }
      }
      return s;
    },
    SUMPRODUCT: function (a) {
      var arrs = a.map(asArr);
      var len = arrs[0].length, s = 0;
      for (var i = 0; i < len; i++) {
        var p = 1;
        for (var j = 0; j < arrs.length; j++) {
          var v = toN(arrs[j][i] === undefined ? 0 : arrs[j][i]);
          if (isErr(v)) return v;
          p *= v;
        }
        s += p;
      }
      return s;
    },
    VLOOKUP: function (a) {
      var key = a[0], rng = asArr(a[1]);
      var colN = toN(a[2]); if (isErr(colN)) return colN;
      colN = Math.round(colN);
      var approx = a.length > 3 ? !!a[3] : true;
      var w = rng.__w || 1, h = rng.__h || rng.length;
      if (colN < 1 || colN > w) return err("#REF!");
      var keyN = typeof key === "number";
      var lastRow = -1;
      for (var r = 0; r < h; r++) {
        var v = rng[r * w];
        if (approx) {
          if (keyN ? (isNum(v) && v <= key) : String(v).toUpperCase() <= String(key).toUpperCase()) lastRow = r;
          else if (keyN && isNum(v) && v > key) break;
        } else if (valEq(v, key)) return rng[r * w + colN - 1] === undefined ? 0 : rng[r * w + colN - 1];
      }
      if (approx && lastRow >= 0) return rng[lastRow * w + colN - 1] === undefined ? 0 : rng[lastRow * w + colN - 1];
      return err("#N/A");
    },
    HLOOKUP: function (a) {
      var key = a[0], rng = asArr(a[1]);
      var rowN = toN(a[2]); if (isErr(rowN)) return rowN;
      rowN = Math.round(rowN);
      var approx = a.length > 3 ? !!a[3] : true;
      var w = rng.__w || rng.length, h = rng.__h || 1;
      if (rowN < 1 || rowN > h) return err("#REF!");
      var keyN = typeof key === "number", lastCol = -1;
      for (var c = 0; c < w; c++) {
        var v = rng[c];
        if (approx) {
          if (keyN ? (isNum(v) && v <= key) : String(v).toUpperCase() <= String(key).toUpperCase()) lastCol = c;
          else if (keyN && isNum(v) && v > key) break;
        } else if (valEq(v, key)) return rng[(rowN - 1) * w + c] === undefined ? 0 : rng[(rowN - 1) * w + c];
      }
      if (approx && lastCol >= 0) return rng[(rowN - 1) * w + lastCol] === undefined ? 0 : rng[(rowN - 1) * w + lastCol];
      return err("#N/A");
    },
    MATCH: function (a) {
      var key = a[0], rng = asArr(a[1]);
      var type = a.length > 2 ? toN(a[2]) : 1;
      if (isErr(type)) return type;
      if (type === 0) {
        for (var i = 0; i < rng.length; i++) if (valEq(rng[i], key)) return i + 1;
        return err("#N/A");
      }
      var best = -1;
      for (var j = 0; j < rng.length; j++) {
        var v = rng[j];
        if (!isNum(v) && typeof v !== "string") continue;
        if (type > 0) { if (toN(v) <= toN(key)) best = j; }
        else { if (toN(v) >= toN(key)) best = j; }
      }
      return best >= 0 ? best + 1 : err("#N/A");
    },
    MEDIAN: function (a) {
      var xs = flatNums(a); if (isErr(xs)) return xs;
      if (!xs.length) return err("#NUM!");
      xs.sort(function (x, y) { return x - y; });
      var m = xs.length >> 1;
      return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
    },
    STDEV: function (a) {
      var xs = flatNums(a); if (isErr(xs)) return xs;
      if (xs.length < 2) return err("#DIV/0!");
      var mu = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length;
      var ss = xs.reduce(function (s, v) { return s + (v - mu) * (v - mu); }, 0);
      return Math.sqrt(ss / (xs.length - 1));
    },
    LARGE: function (a) {
      var xs = flatNums([a[0]]); if (isErr(xs)) return xs;
      var n = Math.round(toN(a[1]));
      xs.sort(function (x, y) { return y - x; });
      return n >= 1 && n <= xs.length ? xs[n - 1] : err("#NUM!");
    },
    SMALL: function (a) {
      var xs = flatNums([a[0]]); if (isErr(xs)) return xs;
      var n = Math.round(toN(a[1]));
      xs.sort(function (x, y) { return x - y; });
      return n >= 1 && n <= xs.length ? xs[n - 1] : err("#NUM!");
    },
    ROUNDUP: function (a) {
      var n = toN(a[0]), d = toN(a.length > 1 ? a[1] : 0);
      if (isErr(n)) return n; if (isErr(d)) return d;
      var f = Math.pow(10, d);
      return (n >= 0 ? Math.ceil(n * f) : Math.floor(n * f)) / f;
    },
    ROUNDDOWN: function (a) {
      var n = toN(a[0]), d = toN(a.length > 1 ? a[1] : 0);
      if (isErr(n)) return n; if (isErr(d)) return d;
      var f = Math.pow(10, d);
      return (n >= 0 ? Math.floor(n * f) : Math.ceil(n * f)) / f;
    },
    INT: function (a) { var n = toN(a[0]); return isErr(n) ? n : Math.floor(n); },
    CEILING: function (a) {
      var n = toN(a[0]), s = toN(a.length > 1 ? a[1] : 1);
      if (isErr(n)) return n; if (isErr(s)) return s;
      return s === 0 ? 0 : Math.ceil(n / s) * s;
    },
    FLOOR: function (a) {
      var n = toN(a[0]), s = toN(a.length > 1 ? a[1] : 1);
      if (isErr(n)) return n; if (isErr(s)) return s;
      return s === 0 ? 0 : Math.floor(n / s) * s;
    },
    XNPV: function (a) {
      var r = toN(a[0]); if (isErr(r)) return r;
      var vals = asArr(a[1]), dates = asArr(a[2]);
      var e1 = firstErr(vals) || firstErr(dates); if (e1) return e1;
      var d0 = toN(dates[0]), s = 0;
      for (var i = 0; i < vals.length; i++) {
        if (!isNum(vals[i]) || !isNum(dates[i])) continue;
        s += vals[i] / Math.pow(1 + r, (dates[i] - d0) / 365);
      }
      return s;
    },
    XIRR: function (a) {
      var vals0 = asArr(a[0]), dates0 = asArr(a[1]);
      var vals = [], dates = [];
      for (var i = 0; i < vals0.length; i++) {
        if (isNum(vals0[i]) && isNum(dates0[i])) { vals.push(vals0[i]); dates.push(dates0[i]); }
      }
      if (vals.length < 2) return err("#NUM!");
      var d0 = dates[0];
      var f = function (r) {
        var s = 0;
        for (var j = 0; j < vals.length; j++) s += vals[j] / Math.pow(1 + r, (dates[j] - d0) / 365);
        return s;
      };
      var lo = CONFIG.irrLowerBound, hi = CONFIG.irrUpperBound;
      var fLo = f(lo), fHi = f(hi);
      if (fLo * fHi > 0) return err("#NUM!");
      for (var k = 0; k < CONFIG.irrMaxIterations; k++) {
        var mid = (lo + hi) / 2, fm = f(mid);
        if (Math.abs(fm) < CONFIG.irrTolerance) return mid;
        if (fLo * fm < 0) { hi = mid; fHi = fm; } else { lo = mid; fLo = fm; }
      }
      return (lo + hi) / 2;
    },
    DATE: function (a) {
      var y = toN(a[0]), m = toN(a[1]), d = toN(a[2]);
      if (isErr(y)) return y; if (isErr(m)) return m; if (isErr(d)) return d;
      var epoch = Date.UTC(1899, 11, 30);
      return Math.round((Date.UTC(y, m - 1, d) - epoch) / 86400000);
    },
    TODAY: function () {
      var now = new Date();
      var epoch = Date.UTC(1899, 11, 30);
      return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - epoch) / 86400000);
    },
    CONCATENATE: function (a) {
      return a.map(function (v) { return isErr(v) ? v.__err : v === null || v === undefined ? "" : String(v); }).join("");
    },
    LEFT: function (a) { var s = String(a[0] === null ? "" : a[0]); var n = a.length > 1 ? Math.round(toN(a[1])) : 1; return s.slice(0, Math.max(0, n)); },
    RIGHT: function (a) { var s = String(a[0] === null ? "" : a[0]); var n = a.length > 1 ? Math.round(toN(a[1])) : 1; return n <= 0 ? "" : s.slice(-n); },
    MID: function (a) { var s = String(a[0] === null ? "" : a[0]); return s.substr(Math.max(0, Math.round(toN(a[1])) - 1), Math.max(0, Math.round(toN(a[2])))); },
    LEN: function (a) { return String(a[0] === null || a[0] === undefined ? "" : a[0]).length; },
    UPPER: function (a) { return String(a[0] === null ? "" : a[0]).toUpperCase(); },
    LOWER: function (a) { return String(a[0] === null ? "" : a[0]).toLowerCase(); },
    TRIM: function (a) { return String(a[0] === null ? "" : a[0]).replace(/\s+/g, " ").trim(); },
    ISNUMBER: function (a) { return isNum(a[0]); },
    ISBLANK: function (a) { return a[0] === null || a[0] === undefined || a[0] === ""; },
    ISERROR: function (a) { return !!isErr(a[0]); },
    RANK: function (a) {
      var x = toN(a[0]); if (isErr(x)) return x;
      var xs = flatNums([a[1]]); if (isErr(xs)) return xs;
      var asc = a.length > 2 && a[2];
      xs.sort(asc ? function (p, q) { return p - q; } : function (p, q) { return q - p; });
      var i = xs.indexOf(x);
      return i >= 0 ? i + 1 : err("#N/A");
    }
  });

  /* =================== FORMULA REFERENCE REWRITING ========================= */
  /* Splits string literals out, then rewrites every cell reference via a
     callback. Used for copy/paste offsets, row/col insert/delete shifts, and
     sheet renames. Requires lookbehind (all evergreen browsers, Node 9+).   */
  var REF_RE = /(?:(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_.]*))!)?(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7})(?![0-9A-Za-z_.(!$])/g;
  function mapRefs(formula, fn) {
    var parts = formula.split(/("(?:[^"]|"")*")/);
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) continue; /* inside a string literal */
      parts[i] = parts[i].replace(REF_RE, function (m, qs, us, cAbs, colL, rAbs, rowD, off, whole) {
        /* reject matches immediately preceded by identifier chars (poor man's lookbehind) */
        var prevChar = whole.charAt(off - 1);
        if (prevChar && /[A-Za-z0-9_.$]/.test(prevChar)) return m;
        var ref = {
          sheet: qs !== undefined ? qs : (us !== undefined ? us : null),
          absCol: cAbs === "$", col: lettersToCol(colL),
          absRow: rAbs === "$", row: parseInt(rowD, 10) - 1
        };
        var out = fn(ref);
        if (out === null) return m;
        if (out === "#REF!") return "#REF!";
        var sheetPart = out.sheet === null ? "" :
          (/^[A-Za-z_][A-Za-z0-9_]*$/.test(out.sheet) ? out.sheet : "'" + out.sheet + "'") + "!";
        return sheetPart + (out.absCol ? "$" : "") + colToLetters(out.col) +
          (out.absRow ? "$" : "") + (out.row + 1);
      });
    }
    return parts.join("");
  }
  function offsetFormula(f, dRow, dCol) {
    return mapRefs(f, function (r) {
      var nr = r.absRow ? r.row : r.row + dRow;
      var nc = r.absCol ? r.col : r.col + dCol;
      if (nr < 0 || nc < 0) return "#REF!";
      return { sheet: r.sheet, absCol: r.absCol, col: nc, absRow: r.absRow, row: nr };
    });
  }
  function shiftFormula(f, ownSheet, targetSheet, axis, index, delta) {
    return mapRefs(f, function (r) {
      var refSheet = r.sheet === null ? ownSheet : r.sheet;
      if (refSheet !== targetSheet) return null;
      var v = axis === "row" ? r.row : r.col;
      if (delta < 0 && v >= index && v < index - delta) return "#REF!";
      if (v >= index) v += delta;
      var out = { sheet: r.sheet, absCol: r.absCol, col: r.col, absRow: r.absRow, row: r.row };
      if (axis === "row") out.row = v; else out.col = v;
      return out;
    });
  }
  function renameInFormula(f, from, to) {
    return mapRefs(f, function (r) {
      if (r.sheet !== from) return null;
      return { sheet: to, absCol: r.absCol, col: r.col, absRow: r.absRow, row: r.row };
    });
  }

  /* ====================== STRUCTURE OPERATIONS ============================= */
  function rewriteAllFormulas(wb, fn) {
    wb.order.forEach(function (name) {
      var cells = wb.sheets[name].cells;
      Object.keys(cells).forEach(function (a1) {
        var c = cells[a1];
        if (c.f !== undefined && c.f !== null) {
          var nf = fn(c.f, name);
          if (nf !== c.f) { c.f = nf; delete c.__ast; }
        } else delete c.__ast;
      });
    });
  }
  function shiftStructure(wb, sheetName, axis, index, delta) {
    var sh = wb.sheets[sheetName];
    var moved = {};
    Object.keys(sh.cells).forEach(function (a1) {
      var p = parseAddr(a1);
      var v = axis === "row" ? p.row : p.col;
      if (delta < 0 && v >= index && v < index - delta) return; /* deleted */
      var np = { col: p.col, row: p.row };
      if (v >= index) { if (axis === "row") np.row += delta; else np.col += delta; }
      moved[addr(np.col, np.row)] = sh.cells[a1];
    });
    sh.cells = moved;
    if (sh.widths && axis === "col") {
      var w2 = {};
      Object.keys(sh.widths).forEach(function (ci) {
        var c = parseInt(ci, 10);
        if (delta < 0 && c >= index && c < index - delta) return;
        w2[c >= index ? c + delta : c] = sh.widths[ci];
      });
      sh.widths = w2;
    }
    rewriteAllFormulas(wb, function (f, own) {
      return shiftFormula(f, own, sheetName, axis, index, delta);
    });
  }

  /* ============================== FORMATTING =============================== */
  /* fmt is either a legacy name ("cur","cur2","pct","x","int") or an object
     { t: "cur"|"pct"|"num"|"x", dp: <decimals> }. Toolbar writes objects.   */
  function fmtObj(fmt) {
    if (!fmt) return null;
    if (typeof fmt === "object") return fmt;
    switch (fmt) {
      case "cur": return { t: "cur", dp: 0 };
      case "cur2": return { t: "cur", dp: 2 };
      case "pct": return { t: "pct", dp: 2 };
      case "x": return { t: "x", dp: 2 };
      case "int": return { t: "num", dp: 0 };
      default: return null;
    }
  }
  function displayValue(v, fmt) {
    if (v === null || v === undefined || v === "") return "";
    if (isErr(v)) return v.__err;
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "string") return v;
    if (!isFinite(v)) return "#NUM!";
    var o = fmtObj(fmt);
    if (o) {
      var dp = Math.max(0, Math.min(8, o.dp === undefined ? 2 : o.dp));
      switch (o.t) {
        case "cur": return "$" + v.toLocaleString(CONFIG.locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
        case "pct": return (v * 100).toFixed(dp) + "%";
        case "x": return v.toFixed(dp) + "x";
        case "num": return v.toLocaleString(CONFIG.locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
      }
    }
    return Math.abs(v) >= 1000
      ? v.toLocaleString(CONFIG.locale, { maximumFractionDigits: 2 })
      : String(Math.round(v * 1e6) / 1e6);
  }
  function fmtToZ(fmt) {
    var o = fmtObj(fmt);
    if (!o) return null;
    var dec = o.dp > 0 ? "." + new Array(o.dp + 1).join("0") : "";
    switch (o.t) {
      case "cur": return '"$"#,##0' + dec;
      case "pct": return "0" + dec + "%";
      case "x": return "0" + dec + '"x"';
      case "num": return "#,##0" + dec;
    }
    return null;
  }
  function parseInput(raw) {
    var s = raw.trim();
    if (s === "") return { v: undefined };
    if (s.charAt(0) === "=") return { f: s.slice(1) };
    if (/^-?\$?[\d,]+(\.\d+)?%?$/.test(s)) {
      var isPct = s.slice(-1) === "%";
      var n = parseFloat(s.replace(/[$,%]/g, ""));
      if (isFinite(n)) return { v: isPct ? n / 100 : n };
    }
    if (/^TRUE$/i.test(s)) return { v: true };
    if (/^FALSE$/i.test(s)) return { v: false };
    var num = Number(s);
    if (s !== "" && isFinite(num)) return { v: num };
    return { v: s };
  }
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  /* ================================ STYLES ================================= */
  var STYLE_ID = "creuw-styles";
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      ".creuw{--grid:#e1e3e6;--hdr:#f8f9fa;--hdrline:#c7cace;--sel:#1a73e8;--selbg:#e8f0fe;",
      "--rangebg:#e8f0fe80;--green:#188038;--ink:#202124;--muted:#5f6368;--inputbg:#e7f0fd;--headbg:#0b5c33;",
      "font-family:'Google Sans',Roboto,'Segoe UI',Arial,sans-serif;color:var(--ink);",
      "background:#fff;font-size:13px;display:flex;flex-direction:column;height:100%;min-height:640px;position:relative}",
      ".creuw *{box-sizing:border-box}",
      ".creuw-top{display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid var(--grid)}",
      ".creuw-logo{width:26px;height:34px;background:var(--green);border-radius:3px;position:relative;flex:none}",
      ".creuw-logo:after{content:'';position:absolute;inset:7px 5px;background:",
      "repeating-linear-gradient(#fff 0 2px,transparent 2px 7px),repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 8px)}",
      ".creuw-title{font-size:16px;font-weight:500}",
      ".creuw-sub{font-size:11px;color:var(--muted)}",
      ".creuw-toolbtns{margin-left:auto;display:flex;gap:8px}",
      ".creuw button{cursor:pointer;font:inherit;border:1px solid #dadce0;background:#fff;",
      "border-radius:4px;padding:7px 14px;font-weight:500;color:var(--ink)}",
      ".creuw button.green{background:var(--green);border-color:var(--green);color:#fff}",
      ".creuw button:hover{background:#f1f3f4}.creuw button.green:hover{background:#0b5c33}",
      ".creuw-toolbar{display:flex;align-items:center;gap:2px;padding:4px 10px;border-bottom:1px solid var(--grid);background:#fff;flex-wrap:wrap}",
      ".creuw-toolbar button{border:0;background:transparent;width:30px;height:28px;padding:0;border-radius:4px;",
      "font-size:13px;display:inline-flex;align-items:center;justify-content:center;color:var(--ink)}",
      ".creuw-toolbar button:hover{background:#f1f3f4}",
      ".creuw-toolbar .sep{width:1px;height:20px;background:var(--grid);margin:0 6px}",
      ".creuw-toolbar button[disabled]{opacity:.35;cursor:default}",
      ".creuw-pal{position:absolute;background:#fff;border:1px solid var(--grid);box-shadow:0 2px 10px rgba(0,0,0,.2);",
      "border-radius:6px;padding:8px;display:grid;grid-template-columns:repeat(5,22px);gap:6px;z-index:30}",
      ".creuw-pal span{width:22px;height:22px;border-radius:3px;border:1px solid var(--grid);cursor:pointer;display:block}",
      ".creuw-fbar{display:flex;align-items:center;border-bottom:1px solid var(--grid);height:32px}",
      ".creuw-namebox{width:110px;padding:0 10px;border-right:1px solid var(--grid);height:100%;",
      "display:flex;align-items:center;font-size:12.5px}",
      ".creuw-fx{padding:0 8px;color:var(--muted);font-style:italic;font-family:Georgia,serif;border-right:1px solid var(--grid);height:100%;display:flex;align-items:center}",
      ".creuw-finput{flex:1;border:0;height:100%;padding:0 10px;font:12.5px ui-monospace,Menlo,Consolas,monospace;outline:none}",
      ".creuw-gridwrap{flex:1;overflow:auto;position:relative;outline:none}",
      ".creuw table{border-collapse:separate;border-spacing:0;table-layout:fixed}",
      ".creuw td,.creuw th{border-right:1px solid var(--grid);border-bottom:1px solid var(--grid);",
      "padding:0 6px;height:24px;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".creuw th{background:var(--hdr);color:var(--muted);font-weight:500;text-align:center;",
      "position:sticky;user-select:none;border-color:var(--hdrline)}",
      ".creuw thead th{top:0;z-index:3}",
      ".creuw tbody th{left:0;z-index:2;width:46px;min-width:46px}",
      ".creuw thead th:first-child{left:0;z-index:4}",
      ".creuw thead th .rz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:5}",
      ".creuw td{background:#fff;cursor:cell;text-align:right;",
      "font-variant-numeric:tabular-nums;font-family:Roboto,Arial,sans-serif}",
      ".creuw td.txt{text-align:left}",
      ".creuw td.range{background:var(--rangebg)}",
      ".creuw td.sel{outline:2px solid var(--sel);outline-offset:-2px;background:var(--selbg)}",
      ".creuw td.selend{position:relative}",
      ".creuw td.selend:after{content:'';position:absolute;right:-1px;bottom:-1px;width:7px;height:7px;",
      "background:var(--sel);border:1px solid #fff;cursor:crosshair}",
      ".creuw td.s-input{background:var(--inputbg)}",
      ".creuw td.s-label{text-align:left}",
      ".creuw td.s-note{text-align:left;color:var(--muted);font-size:11px}",
      ".creuw td.s-bold{font-weight:700}",
      ".creuw td.s-head{background:var(--headbg);color:#fff;font-weight:700;text-align:left;letter-spacing:.03em}",
      ".creuw td.s-noi{background:#e6f4ea;font-weight:700}",
      ".creuw td.err{color:#c5221f;font-weight:600}",
      ".creuw td input{position:absolute;inset:0;border:2px solid var(--sel);padding:0 4px;",
      "font:12.5px ui-monospace,Menlo,Consolas,monospace;outline:none;width:100%;height:100%}",
      ".creuw td.editing{position:relative;padding:0}",
      ".creuw-gridwrap.nogrid td{border-right-color:transparent;border-bottom-color:transparent}",
      ".creuw-gridwrap.nogrid td.range,.creuw-gridwrap.nogrid td.sel{border-right-color:var(--grid);border-bottom-color:var(--grid)}",
      ".creuw-toolbar button.on{background:#e8f0fe;color:var(--sel)}",
      ".creuw-zoomsel{border:1px solid #dadce0;border-radius:4px;height:26px;font:inherit;font-size:12px;background:#fff;padding:0 4px;cursor:pointer}",
      ".creuw-tabs{display:flex;align-items:center;gap:2px;border-top:1px solid var(--grid);",
      "background:var(--hdr);padding:0 8px;height:34px;overflow-x:auto}",
      ".creuw-addsheet{width:28px;height:26px;border-radius:50%;font-size:16px;line-height:1;padding:0}",
      ".creuw-tab{padding:6px 16px;font-size:12.5px;border:1px solid transparent;border-bottom:0;",
      "cursor:pointer;color:var(--muted);background:transparent;font-weight:500;white-space:nowrap}",
      ".creuw-tab.active{background:#fff;color:var(--green);border-color:var(--grid);",
      "font-weight:700;box-shadow:0 -2px 0 var(--green) inset}",
      ".creuw-status{margin-left:auto;font-size:11px;color:var(--muted);padding-right:8px;white-space:nowrap}",
      ".creuw-msg{position:absolute;top:8px;right:16px;background:#fff;border:1px solid var(--grid);",
      "box-shadow:0 2px 8px rgba(0,0,0,.15);padding:10px 14px;font-size:12px;border-radius:6px;z-index:40;max-width:420px}",
      ".creuw-msg.err{border-color:#c5221f;color:#c5221f}",
      ".creuw-menu{position:absolute;background:#fff;border:1px solid var(--grid);border-radius:6px;",
      "box-shadow:0 2px 12px rgba(0,0,0,.25);padding:6px 0;z-index:50;min-width:190px}",
      ".creuw-menu div{padding:7px 16px;cursor:pointer;font-size:13px}",
      ".creuw-menu div:hover{background:#f1f3f4}",
      ".creuw-menu hr{border:0;border-top:1px solid var(--grid);margin:4px 0}"
    ].join("");
    var tag = document.createElement("style");
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ================================= APP =================================== */
  function App(mount) {
    this.mount = mount;
    this.wb = buildTemplate();
    this.ev = new Evaluator(this.wb);
    this.active = this.wb.order[0];
    this.sel = { col: 1, row: 3 };
    this.selEnd = { col: 1, row: 3 };
    this.editing = false;
    this.clip = null;
    this.undoStack = [];
    this.redoStack = [];
    this.dragging = null; /* "select" | "fill" | {resize} */
    this.gridlines = true;
    this.zoom = 1;
    this.build();
    this.renderGrid();
  }

  /* ---------------------------- undo / redo ------------------------------ */
  App.prototype.snapshot = function () {
    return JSON.stringify({ order: this.wb.order, sheets: this.wb.sheets, active: this.active },
      function (k, v) { return k === "__ast" ? undefined : v; });
  };
  App.prototype.restore = function (snap) {
    var s = JSON.parse(snap);
    this.wb = new Workbook();
    this.wb.order = s.order;
    this.wb.sheets = s.sheets;
    this.ev = new Evaluator(this.wb);
    this.active = this.wb.sheets[s.active] ? s.active : this.wb.order[0];
    this.clampSel();
    this.renderGrid();
  };
  App.prototype.pushUndo = function () {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  };
  App.prototype.undo = function () {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    this.restore(this.undoStack.pop());
  };
  App.prototype.redo = function () {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    this.restore(this.redoStack.pop());
  };

  /* ------------------------------- layout -------------------------------- */
  App.prototype.build = function () {
    var self = this;
    this.mount.classList.add("creuw");
    this.mount.innerHTML =
      '<div class="creuw-top"><div class="creuw-logo"></div>' +
      '<div><div class="creuw-title">CRE Underwriting Model</div>' +
      '<div class="creuw-sub">All asset types \u00b7 live formulas \u00b7 not investment advice</div></div>' +
      '<div class="creuw-toolbtns">' +
      '<button type="button" data-act="upload">Upload .xlsx</button>' +
      '<input type="file" accept=".xlsx,.xls,.xlsm" data-act="file" style="display:none">' +
      '<button type="button" class="green" data-act="download">Download .xlsx</button>' +
      '<button type="button" data-act="reset">Reset model</button></div></div>' +
      '<div class="creuw-toolbar" data-el="toolbar">' +
      '<button type="button" data-tb="undo" title="Undo (Ctrl+Z)">\u21b6</button>' +
      '<button type="button" data-tb="redo" title="Redo (Ctrl+Y)">\u21b7</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-tb="bold" title="Bold (Ctrl+B)" style="font-weight:800">B</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-tb="cur" title="Format as currency">$</button>' +
      '<button type="button" data-tb="pct" title="Format as percent">%</button>' +
      '<button type="button" data-tb="num" title="Format as number">#</button>' +
      '<button type="button" data-tb="decm" title="Decrease decimal places">.0\u2190</button>' +
      '<button type="button" data-tb="decp" title="Increase decimal places">.00\u2192</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-tb="color" title="Text color" style="border-bottom:3px solid #c5221f">A</button>' +
      '<button type="button" data-tb="bg" title="Fill color">\ud83c\udfa8</button>' +
      '<button type="button" data-tb="clear" title="Clear formatting">\u2298</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-tb="grid" class="on" title="View: show or hide gridlines">\u229e</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-tb="zoomout" title="Zoom out">\u2212</button>' +
      '<select data-tb="zoomsel" class="creuw-zoomsel" title="Zoom" aria-label="Zoom level"></select>' +
      '<button type="button" data-tb="zoomin" title="Zoom in">+</button>' +
      "</div>" +
      '<div class="creuw-fbar"><div class="creuw-namebox" data-el="namebox">A1</div>' +
      '<div class="creuw-fx">fx</div>' +
      '<input class="creuw-finput" data-el="finput" spellcheck="false" aria-label="Formula bar"></div>' +
      '<div class="creuw-gridwrap" data-el="gridwrap" tabindex="0"></div>' +
      '<div class="creuw-tabs" data-el="tabs"></div>';
    this.el = {
      toolbar: this.mount.querySelector('[data-el="toolbar"]'),
      namebox: this.mount.querySelector('[data-el="namebox"]'),
      finput: this.mount.querySelector('[data-el="finput"]'),
      gridwrap: this.mount.querySelector('[data-el="gridwrap"]'),
      tabs: this.mount.querySelector('[data-el="tabs"]'),
      file: this.mount.querySelector('[data-act="file"]')
    };
    this.mount.querySelector('[data-act="upload"]').addEventListener("click", function () { self.el.file.click(); });
    this.mount.querySelector('[data-act="download"]').addEventListener("click", function () { self.download(); });
    this.mount.querySelector('[data-act="reset"]').addEventListener("click", function () {
      self.pushUndo();
      self.wb = buildTemplate(); self.ev = new Evaluator(self.wb);
      self.active = self.wb.order[0]; self.sel = { col: 1, row: 3 }; self.selEnd = { col: 1, row: 3 };
      self.renderGrid();
    });
    this.el.file.addEventListener("change", function () {
      var f = self.el.file.files && self.el.file.files[0];
      if (f) self.upload(f);
      self.el.file.value = "";
    });
    this.el.finput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); self.pushUndo(); self.commitAt(self.sel, self.el.finput.value); self.renderGrid(); self.moveSel(0, 1); }
      if (e.key === "Escape") { self.syncBar(); self.el.gridwrap.focus(); }
    });
    this.el.toolbar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-tb]");
      if (b) self.toolbarAction(b.getAttribute("data-tb"), b);
    });
    this.el.zoomsel = this.el.toolbar.querySelector('[data-tb="zoomsel"]');
    CONFIG.zoomSteps.forEach(function (z) {
      var o = document.createElement("option");
      o.value = z;
      o.textContent = Math.round(z * 100) + "%";
      if (z === 1) o.selected = true;
      self.el.zoomsel.appendChild(o);
    });
    this.el.zoomsel.addEventListener("change", function () {
      self.setZoom(parseFloat(self.el.zoomsel.value));
    });
    this.el.gridwrap.addEventListener("keydown", function (e) { self.onKey(e); });
    this.el.gridwrap.addEventListener("mousedown", function (e) { self.onMouseDown(e); });
    this.el.gridwrap.addEventListener("dblclick", function (e) {
      if (e.target.closest("td[data-a1]")) self.startEdit();
    });
    this.el.gridwrap.addEventListener("contextmenu", function (e) { self.onContext(e); });
    this.el.gridwrap.addEventListener("paste", function (e) { self.onExternalPaste(e); });
    document.addEventListener("mousemove", function (e) { self.onMouseMove(e); });
    document.addEventListener("mouseup", function (e) { self.onMouseUp(e); });
    document.addEventListener("mousedown", function (e) {
      if (!e.target.closest(".creuw-menu") && !e.target.closest(".creuw-pal")) self.closePopups();
    });
  };

  App.prototype.sheet = function () { return this.wb.sheets[this.active]; };
  App.prototype.dims = function () {
    var used = this.wb.usedRange(this.active);
    return {
      rows: Math.max(CONFIG.minRows, used.rows + CONFIG.extraRows),
      cols: Math.max(CONFIG.minCols, used.cols + CONFIG.extraCols)
    };
  };
  App.prototype.clampSel = function () {
    var d = this.dims();
    var cl = function (p) {
      p.col = Math.max(0, Math.min(d.cols - 1, p.col));
      p.row = Math.max(0, Math.min(d.rows - 1, p.row));
    };
    cl(this.sel); cl(this.selEnd);
  };
  App.prototype.rangeRect = function () {
    return {
      c1: Math.min(this.sel.col, this.selEnd.col), c2: Math.max(this.sel.col, this.selEnd.col),
      r1: Math.min(this.sel.row, this.selEnd.row), r2: Math.max(this.sel.row, this.selEnd.row)
    };
  };

  /* ------------------------------ rendering ------------------------------ */
  App.prototype.renderGrid = function () {
    this.ev.reset();
    var d = this.dims(), sh = this.sheet();
    var widths = sh.widths || {};
    var html = '<table><colgroup><col style="width:46px">';
    for (var c = 0; c < d.cols; c++) {
      var w = widths[c] !== undefined ? widths[c] : (c === 0 ? CONFIG.colWidthLabel : CONFIG.colWidthDefault);
      html += '<col style="width:' + w + 'px">';
    }
    html += "</colgroup><thead><tr><th></th>";
    for (var c2 = 0; c2 < d.cols; c2++) {
      html += '<th data-col="' + c2 + '" style="position:sticky">' + colToLetters(c2) +
        '<span class="rz" data-rz="' + c2 + '"></span></th>';
    }
    html += "</tr></thead><tbody>";
    for (var r = 0; r < d.rows; r++) {
      html += '<tr><th data-row="' + r + '">' + (r + 1) + "</th>";
      for (var c3 = 0; c3 < d.cols; c3++) {
        var a1 = addr(c3, r);
        var cell = sh.cells[a1];
        var v = this.ev.value(this.active, a1);
        var cls = [], sty = "";
        if (cell && cell.style) cls.push("s-" + cell.style);
        if (typeof v === "string" && !(cell && cell.style)) cls.push("txt");
        if (isErr(v)) cls.push("err");
        if (cell) {
          if (cell.bold) sty += "font-weight:700;";
          if (cell.color) sty += "color:" + cell.color + ";";
          if (cell.bg) sty += "background:" + cell.bg + ";";
        }
        html += '<td data-a1="' + a1 + '"' + (cls.length ? ' class="' + cls.join(" ") + '"' : "") +
          (sty ? ' style="' + sty + '"' : "") + ">" +
          escHtml(displayValue(v, cell && cell.fmt)) + "</td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    this.el.gridwrap.innerHTML = html;
    this.applyZoom();
    this.renderTabs();
    this.highlight();
  };

  App.prototype.renderTabs = function () {
    var self = this;
    var h = '<button type="button" class="creuw-addsheet" data-addsheet="1" title="Add sheet">+</button>';
    this.wb.order.forEach(function (name) {
      h += '<button type="button" class="creuw-tab' + (name === self.active ? " active" : "") +
        '" data-tab="' + escHtml(name) + '">' + escHtml(name) + "</button>";
    });
    h += '<span class="creuw-status" data-el="status"></span>';
    this.el.tabs.innerHTML = h;
    this.el.status = this.el.tabs.querySelector('[data-el="status"]');
    this.el.tabs.querySelector("[data-addsheet]").addEventListener("click", function () { self.addSheet(); });
    this.el.tabs.querySelectorAll("[data-tab]").forEach(function (b) {
      var name = b.getAttribute("data-tab");
      b.addEventListener("click", function () {
        self.active = name;
        self.sel = { col: 0, row: 0 }; self.selEnd = { col: 0, row: 0 };
        self.renderGrid();
      });
      b.addEventListener("dblclick", function () { self.renameSheet(name); });
      b.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        self.showMenu(e, [
          ["Rename sheet", function () { self.renameSheet(name); }],
          ["Delete sheet", function () { self.deleteSheet(name); }]
        ]);
      });
    });
    this.updateStatus();
  };

  App.prototype.updateStatus = function () {
    if (!this.el.status) return;
    var rect = this.rangeRect(), sum = 0, cnt = 0;
    for (var r = rect.r1; r <= rect.r2; r++) {
      for (var c = rect.c1; c <= rect.c2; c++) {
        var v = this.ev.value(this.active, addr(c, r));
        if (isNum(v)) { sum += v; cnt++; }
      }
    }
    var multi = rect.r1 !== rect.r2 || rect.c1 !== rect.c2;
    this.el.status.textContent = multi && cnt
      ? "Sum " + displayValue(sum, null) + " \u00b7 Avg " + displayValue(sum / cnt, null) + " \u00b7 Count " + cnt
      : this.wb.order.length + " sheets \u00b7 formulas live";
  };

  App.prototype.tdAt = function (p) {
    return this.el.gridwrap.querySelector('td[data-a1="' + addr(p.col, p.row) + '"]');
  };
  App.prototype.highlight = function () {
    var self = this;
    this.el.gridwrap.querySelectorAll("td.sel,td.range,td.selend").forEach(function (td) {
      td.classList.remove("sel", "range", "selend");
    });
    var rect = this.rangeRect();
    for (var r = rect.r1; r <= rect.r2; r++) {
      for (var c = rect.c1; c <= rect.c2; c++) {
        var td = this.tdAt({ col: c, row: r });
        if (td) td.classList.add("range");
      }
    }
    var anchor = this.tdAt(this.sel);
    if (anchor) {
      anchor.classList.add("sel");
      if (typeof anchor.scrollIntoView === "function") anchor.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    var endTd = this.tdAt({ col: rect.c2, row: rect.r2 });
    if (endTd) endTd.classList.add("selend");
    this.syncBar();
    this.updateStatus();
  };
  App.prototype.syncBar = function () {
    var rect = this.rangeRect();
    var single = rect.r1 === rect.r2 && rect.c1 === rect.c2;
    this.el.namebox.textContent = single
      ? addr(this.sel.col, this.sel.row)
      : addr(rect.c1, rect.r1) + ":" + addr(rect.c2, rect.r2);
    var cell = this.wb.cell(this.active, addr(this.sel.col, this.sel.row));
    this.el.finput.value = cell
      ? (cell.f !== undefined && cell.f !== null ? "=" + cell.f : (cell.v === undefined ? "" : String(cell.v)))
      : "";
  };
  App.prototype.moveSel = function (dc, dr, extend) {
    var target = extend ? this.selEnd : this.sel;
    target.col += dc; target.row += dr;
    if (!extend) { this.selEnd = { col: this.sel.col, row: this.sel.row }; }
    this.clampSel();
    this.highlight();
  };

  /* --------------------------- mouse handling ---------------------------- */
  App.prototype.onMouseDown = function (e) {
    var rz = e.target.closest("[data-rz]");
    if (rz) {
      e.preventDefault();
      var ci = parseInt(rz.getAttribute("data-rz"), 10);
      var sh = this.sheet();
      sh.widths = sh.widths || {};
      var startW = sh.widths[ci] !== undefined ? sh.widths[ci] : (ci === 0 ? CONFIG.colWidthLabel : CONFIG.colWidthDefault);
      this.dragging = { kind: "resize", col: ci, x: e.clientX, w: startW };
      return;
    }
    var td = e.target.closest("td[data-a1]");
    if (!td) return;
    if (this.editing) this.stopEdit(true);
    var p = parseAddr(td.getAttribute("data-a1"));
    /* fill-handle drag: near bottom-right corner of the range end cell */
    var isEnd = td.classList.contains("selend");
    var box = td.getBoundingClientRect ? td.getBoundingClientRect() : null;
    if (isEnd && box && e.clientX > box.right - 9 && e.clientY > box.bottom - 9) {
      this.dragging = { kind: "fill", start: this.rangeRect(), to: { col: p.col, row: p.row } };
      e.preventDefault();
      return;
    }
    if (e.shiftKey) { this.selEnd = p; }
    else { this.sel = p; this.selEnd = { col: p.col, row: p.row }; this.dragging = { kind: "select" }; }
    this.highlight();
    this.el.gridwrap.focus();
  };
  App.prototype.onMouseMove = function (e) {
    if (!this.dragging) return;
    if (this.dragging.kind === "resize") {
      var sh = this.sheet();
      sh.widths[this.dragging.col] = Math.max(36, this.dragging.w + (e.clientX - this.dragging.x) / (this.zoom || 1));
      var col = this.el.gridwrap.querySelectorAll("colgroup col")[this.dragging.col + 1];
      if (col) col.style.width = sh.widths[this.dragging.col] + "px";
      return;
    }
    var td = e.target && e.target.closest ? e.target.closest("td[data-a1]") : null;
    if (!td) return;
    var p = parseAddr(td.getAttribute("data-a1"));
    if (this.dragging.kind === "select") { this.selEnd = p; this.highlight(); }
    else if (this.dragging.kind === "fill") { this.dragging.to = p; this.selEnd = p; this.highlight(); }
  };
  App.prototype.onMouseUp = function () {
    if (!this.dragging) return;
    var d = this.dragging;
    this.dragging = null;
    if (d.kind === "fill") this.performFill(d.start, d.to);
  };

  /* ------------------------- context menu / popups ------------------------ */
  App.prototype.closePopups = function () {
    this.mount.querySelectorAll(".creuw-menu,.creuw-pal").forEach(function (m) { m.remove(); });
  };
  App.prototype.showMenu = function (e, items) {
    this.closePopups();
    var m = document.createElement("div");
    m.className = "creuw-menu";
    var box = this.mount.getBoundingClientRect ? this.mount.getBoundingClientRect() : { left: 0, top: 0 };
    m.style.left = (e.clientX - box.left) + "px";
    m.style.top = (e.clientY - box.top) + "px";
    var self = this;
    items.forEach(function (it) {
      if (it === "-") { m.appendChild(document.createElement("hr")); return; }
      var d = document.createElement("div");
      d.textContent = it[0];
      d.addEventListener("click", function () { self.closePopups(); it[1](); });
      m.appendChild(d);
    });
    this.mount.appendChild(m);
  };
  App.prototype.onContext = function (e) {
    var self = this;
    var rowTh = e.target.closest("th[data-row]");
    var colTh = e.target.closest("th[data-col]");
    var td = e.target.closest("td[data-a1]");
    if (!rowTh && !colTh && !td) return;
    e.preventDefault();
    var items = [];
    var rect = this.rangeRect();
    if (td) {
      var p = parseAddr(td.getAttribute("data-a1"));
      if (p.row < rect.r1 || p.row > rect.r2 || p.col < rect.c1 || p.col > rect.c2) {
        this.sel = p; this.selEnd = { col: p.col, row: p.row }; this.highlight();
        rect = this.rangeRect();
      }
      items.push(
        ["Cut", function () { self.doCopy(true); }],
        ["Copy", function () { self.doCopy(false); }],
        ["Paste", function () { self.doPaste(); }],
        "-");
    }
    var r = rowTh ? parseInt(rowTh.getAttribute("data-row"), 10) : rect.r1;
    var c = colTh ? parseInt(colTh.getAttribute("data-col"), 10) : rect.c1;
    items.push(
      ["Insert row above", function () { self.structOp("row", r, 1); }],
      ["Insert row below", function () { self.structOp("row", r + 1, 1); }],
      ["Delete row " + (r + 1), function () { self.structOp("row", r, -1); }],
      "-",
      ["Insert column left", function () { self.structOp("col", c, 1); }],
      ["Insert column right", function () { self.structOp("col", c + 1, 1); }],
      ["Delete column " + colToLetters(c), function () { self.structOp("col", c, -1); }]);
    if (td) items.push("-", ["Clear contents", function () { self.clearRange(); }]);
    this.showMenu(e, items);
  };
  App.prototype.structOp = function (axis, index, delta) {
    this.pushUndo();
    shiftStructure(this.wb, this.active, axis, index, delta);
    this.clampSel();
    this.renderGrid();
  };

  /* ------------------------------ keyboard ------------------------------- */
  App.prototype.onKey = function (e) {
    if (this.editing) return;
    var k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (k === "z" || k === "Z")) { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
    if (ctrl && (k === "y" || k === "Y")) { e.preventDefault(); this.redo(); return; }
    if (ctrl && (k === "c" || k === "C")) { e.preventDefault(); this.doCopy(false); return; }
    if (ctrl && (k === "x" || k === "X")) { e.preventDefault(); this.doCopy(true); return; }
    if (ctrl && (k === "v" || k === "V")) { if (this.clip) { e.preventDefault(); this.doPaste(); } return; }
    if (ctrl && (k === "b" || k === "B")) { e.preventDefault(); this.applyStyle(function (c) { c.bold = !c.bold; }); return; }
    if (ctrl && (k === "d" || k === "D")) { e.preventDefault(); this.fillDown(); return; }
    if (ctrl && (k === "r" || k === "R")) { e.preventDefault(); this.fillRight(); return; }
    if (k === "ArrowUp") { e.preventDefault(); this.moveSel(0, -1, e.shiftKey); }
    else if (k === "ArrowDown") { e.preventDefault(); this.moveSel(0, 1, e.shiftKey); }
    else if (k === "ArrowLeft") { e.preventDefault(); this.moveSel(-1, 0, e.shiftKey); }
    else if (k === "ArrowRight") { e.preventDefault(); this.moveSel(1, 0, e.shiftKey); }
    else if (k === "Tab") { e.preventDefault(); this.moveSel(e.shiftKey ? -1 : 1, 0); }
    else if (k === "Enter") { e.preventDefault(); this.startEdit(); }
    else if (k === "F2") { e.preventDefault(); this.startEdit(); }
    else if (k === "Delete" || k === "Backspace") { e.preventDefault(); this.clearRange(); }
    else if (k.length === 1 && !ctrl && !e.altKey) { e.preventDefault(); this.startEdit(k); }
  };
  App.prototype.clearRange = function () {
    this.pushUndo();
    var rect = this.rangeRect(), cells = this.sheet().cells;
    for (var r = rect.r1; r <= rect.r2; r++) {
      for (var c = rect.c1; c <= rect.c2; c++) delete cells[addr(c, r)];
    }
    this.renderGrid();
  };

  /* -------------------------- copy / cut / paste -------------------------- */
  App.prototype.doCopy = function (cut) {
    var rect = this.rangeRect(), sh = this.sheet();
    var block = [], tsv = [];
    for (var r = rect.r1; r <= rect.r2; r++) {
      var line = [];
      for (var c = rect.c1; c <= rect.c2; c++) {
        var a1 = addr(c, r);
        var cell = sh.cells[a1];
        block.push({ dr: r - rect.r1, dc: c - rect.c1, cell: cell ? JSON.parse(this.stringifyCell(cell)) : null });
        line.push(displayValue(this.ev.value(this.active, a1), cell && cell.fmt));
      }
      tsv.push(line.join("\t"));
    }
    this.clip = { block: block, w: rect.c2 - rect.c1 + 1, h: rect.r2 - rect.r1 + 1, cut: !!cut, srcRect: rect, srcSheet: this.active };
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv.join("\n")).catch(function () { });
    }
  };
  App.prototype.stringifyCell = function (cell) {
    return JSON.stringify(cell, function (k, v) { return k === "__ast" ? undefined : v; });
  };
  App.prototype.doPaste = function () {
    if (!this.clip) return;
    this.pushUndo();
    var clip = this.clip, sh = this.sheet();
    var base = { col: Math.min(this.sel.col, this.selEnd.col), row: Math.min(this.sel.row, this.selEnd.row) };
    if (clip.cut && clip.srcSheet === this.active) {
      var s = clip.srcRect, cells = this.wb.sheets[clip.srcSheet].cells;
      for (var r0 = s.r1; r0 <= s.r2; r0++) for (var c0 = s.c1; c0 <= s.c2; c0++) delete cells[addr(c0, r0)];
    } else if (clip.cut) {
      var cells2 = this.wb.sheets[clip.srcSheet].cells, s2 = clip.srcRect;
      for (var r1 = s2.r1; r1 <= s2.r2; r1++) for (var c1 = s2.c1; c1 <= s2.c2; c1++) delete cells2[addr(c1, r1)];
    }
    var dRow = base.row - clip.srcRect.r1, dCol = base.col - clip.srcRect.c1;
    for (var i = 0; i < clip.block.length; i++) {
      var b = clip.block[i];
      var target = addr(base.col + b.dc, base.row + b.dr);
      if (!b.cell) { delete sh.cells[target]; continue; }
      var copy = JSON.parse(JSON.stringify(b.cell));
      if (copy.f !== undefined && copy.f !== null && !clip.cut) copy.f = offsetFormula(copy.f, dRow, dCol);
      sh.cells[target] = copy;
    }
    if (clip.cut) this.clip = null;
    this.selEnd = { col: base.col + clip.w - 1, row: base.row + clip.h - 1 };
    this.sel = { col: base.col, row: base.row };
    this.renderGrid();
  };
  App.prototype.onExternalPaste = function (e) {
    if (this.clip || this.editing) return;
    var text = e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData("text/plain") : "";
    if (!text) return;
    e.preventDefault();
    this.pushUndo();
    var sh = this.sheet();
    var base = { col: Math.min(this.sel.col, this.selEnd.col), row: Math.min(this.sel.row, this.selEnd.row) };
    var rows = text.replace(/\r/g, "").split("\n");
    for (var r = 0; r < rows.length; r++) {
      if (rows[r] === "" && r === rows.length - 1) continue;
      var vals = rows[r].split("\t");
      for (var c = 0; c < vals.length; c++) {
        var parsed = parseInput(vals[c]);
        var a1 = addr(base.col + c, base.row + r);
        if (parsed.f !== undefined) sh.cells[a1] = { f: parsed.f };
        else if (parsed.v === undefined) delete sh.cells[a1];
        else sh.cells[a1] = { v: parsed.v };
      }
    }
    this.renderGrid();
  };

  /* -------------------------------- fill ---------------------------------- */
  App.prototype.performFill = function (srcRect, to) {
    var down = to.row > srcRect.r2, right = to.col > srcRect.c2;
    if (!down && !right) { this.highlight(); return; }
    this.pushUndo();
    var sh = this.sheet();
    var srcH = srcRect.r2 - srcRect.r1 + 1, srcW = srcRect.c2 - srcRect.c1 + 1;
    if (down) {
      for (var r = srcRect.r2 + 1; r <= to.row; r++) {
        for (var c = srcRect.c1; c <= srcRect.c2; c++) {
          var srcR = srcRect.r1 + ((r - srcRect.r1) % srcH);
          this.copyCellOffset(sh, addr(c, srcR), addr(c, r), r - srcR, 0);
        }
      }
      this.selEnd = { col: srcRect.c2, row: to.row }; this.sel = { col: srcRect.c1, row: srcRect.r1 };
    } else {
      for (var c2 = srcRect.c2 + 1; c2 <= to.col; c2++) {
        for (var r2 = srcRect.r1; r2 <= srcRect.r2; r2++) {
          var srcC = srcRect.c1 + ((c2 - srcRect.c1) % srcW);
          this.copyCellOffset(sh, addr(srcC, r2), addr(c2, r2), 0, c2 - srcC);
        }
      }
      this.selEnd = { col: to.col, row: srcRect.r2 }; this.sel = { col: srcRect.c1, row: srcRect.r1 };
    }
    this.renderGrid();
  };
  App.prototype.copyCellOffset = function (sh, from, to, dRow, dCol) {
    var src = sh.cells[from];
    if (!src) { delete sh.cells[to]; return; }
    var copy = JSON.parse(this.stringifyCell(src));
    if (copy.f !== undefined && copy.f !== null) copy.f = offsetFormula(copy.f, dRow, dCol);
    sh.cells[to] = copy;
  };
  App.prototype.fillDown = function () {
    var rect = this.rangeRect();
    if (rect.r2 === rect.r1) return;
    this.pushUndo();
    var sh = this.sheet();
    for (var c = rect.c1; c <= rect.c2; c++) {
      for (var r = rect.r1 + 1; r <= rect.r2; r++) {
        this.copyCellOffset(sh, addr(c, rect.r1), addr(c, r), r - rect.r1, 0);
      }
    }
    this.renderGrid();
  };
  App.prototype.fillRight = function () {
    var rect = this.rangeRect();
    if (rect.c2 === rect.c1) return;
    this.pushUndo();
    var sh = this.sheet();
    for (var r = rect.r1; r <= rect.r2; r++) {
      for (var c = rect.c1 + 1; c <= rect.c2; c++) {
        this.copyCellOffset(sh, addr(rect.c1, r), addr(c, r), 0, c - rect.c1);
      }
    }
    this.renderGrid();
  };

  /* --------------------------- formatting ops ----------------------------- */
  App.prototype.applyStyle = function (mut) {
    this.pushUndo();
    var rect = this.rangeRect(), sh = this.sheet();
    for (var r = rect.r1; r <= rect.r2; r++) {
      for (var c = rect.c1; c <= rect.c2; c++) {
        var a1 = addr(c, r);
        var cell = sh.cells[a1];
        if (!cell) { cell = {}; sh.cells[a1] = cell; }
        mut(cell);
        if (cell.v === undefined && (cell.f === undefined || cell.f === null) &&
            !cell.fmt && !cell.bold && !cell.color && !cell.bg && !cell.style) {
          delete sh.cells[a1];
        }
      }
    }
    this.renderGrid();
  };
  var PALETTE = ["#202124", "#c5221f", "#e37400", "#188038", "#1a73e8", "#8430ce",
    "#ffffff", "#fce8e6", "#fef7e0", "#e6f4ea", "#e8f0fe", "#f3e8fd"];
  App.prototype.showPalette = function (anchorBtn, apply) {
    this.closePopups();
    var pal = document.createElement("div");
    pal.className = "creuw-pal";
    var box = this.mount.getBoundingClientRect ? this.mount.getBoundingClientRect() : { left: 0, top: 0 };
    var bb = anchorBtn.getBoundingClientRect ? anchorBtn.getBoundingClientRect() : { left: 0, bottom: 0 };
    pal.style.left = (bb.left - box.left) + "px";
    pal.style.top = (bb.bottom - box.top + 4) + "px";
    var self = this;
    PALETTE.forEach(function (hex) {
      var s = document.createElement("span");
      s.style.background = hex;
      s.title = hex;
      s.addEventListener("click", function () { self.closePopups(); apply(hex); });
      pal.appendChild(s);
    });
    this.mount.appendChild(pal);
  };
  App.prototype.toolbarAction = function (act, btn) {
    var self = this;
    switch (act) {
      case "undo": this.undo(); break;
      case "redo": this.redo(); break;
      case "bold": this.applyStyle(function (c) { c.bold = !c.bold; }); break;
      case "cur": this.applyStyle(function (c) { var o = fmtObj(c.fmt) || { dp: 0 }; c.fmt = { t: "cur", dp: o.dp === undefined ? 0 : o.dp }; }); break;
      case "pct": this.applyStyle(function (c) { var o = fmtObj(c.fmt) || { dp: 2 }; c.fmt = { t: "pct", dp: o.dp === undefined ? 2 : o.dp }; }); break;
      case "num": this.applyStyle(function (c) { var o = fmtObj(c.fmt) || { dp: 0 }; c.fmt = { t: "num", dp: o.dp === undefined ? 0 : o.dp }; }); break;
      case "decp": this.applyStyle(function (c) { var o = fmtObj(c.fmt) || { t: "num", dp: 0 }; o.dp = Math.min(8, (o.dp || 0) + 1); c.fmt = o; }); break;
      case "decm": this.applyStyle(function (c) { var o = fmtObj(c.fmt) || { t: "num", dp: 0 }; o.dp = Math.max(0, (o.dp || 0) - 1); c.fmt = o; }); break;
      case "color": this.showPalette(btn, function (hex) { self.applyStyle(function (c) { c.color = hex; }); }); break;
      case "bg": this.showPalette(btn, function (hex) { self.applyStyle(function (c) { c.bg = hex; }); }); break;
      case "clear": this.applyStyle(function (c) { delete c.fmt; delete c.bold; delete c.color; delete c.bg; delete c.style; }); break;
      case "grid":
        this.gridlines = !this.gridlines;
        this.el.gridwrap.classList.toggle("nogrid", !this.gridlines);
        if (btn) btn.classList.toggle("on", this.gridlines);
        break;
      case "zoomin": this.stepZoom(1); break;
      case "zoomout": this.stepZoom(-1); break;
    }
  };

  /* -------------------------------- zoom ---------------------------------- */
  App.prototype.setZoom = function (z) {
    var steps = CONFIG.zoomSteps;
    this.zoom = Math.max(steps[0], Math.min(steps[steps.length - 1], z || 1));
    if (this.el.zoomsel) {
      var best = steps.reduce(function (a, b) {
        return Math.abs(b - z) < Math.abs(a - z) ? b : a;
      });
      this.el.zoomsel.value = String(best);
    }
    this.applyZoom();
  };
  App.prototype.stepZoom = function (dir) {
    var steps = CONFIG.zoomSteps;
    var i = steps.indexOf(this.zoom);
    if (i < 0) {
      i = 0;
      for (var j = 0; j < steps.length; j++) if (Math.abs(steps[j] - this.zoom) < Math.abs(steps[i] - this.zoom)) i = j;
    }
    this.setZoom(steps[Math.max(0, Math.min(steps.length - 1, i + dir))]);
  };
  App.prototype.applyZoom = function () {
    var table = this.el.gridwrap.querySelector("table");
    if (!table) return;
    table.style.zoom = this.zoom;
    /* Fallback for engines without CSS zoom: scale transform + width fix */
    if (typeof getComputedStyle === "function") {
      var applied = getComputedStyle(table).zoom;
      if ((!applied || applied === "normal" || applied === "1") && this.zoom !== 1) {
        table.style.transformOrigin = "0 0";
        table.style.transform = "scale(" + this.zoom + ")";
      } else if (this.zoom === 1) {
        table.style.transform = "";
      }
    }
  };

  /* ------------------------------ sheet ops ------------------------------- */
  App.prototype.uniqueSheetName = function (base) {
    var n = base, i = 2;
    while (this.wb.sheets[n]) { n = base + " " + i; i++; }
    return n;
  };
  App.prototype.addSheet = function () {
    this.pushUndo();
    var name = this.uniqueSheetName("Sheet" + (this.wb.order.length + 1));
    this.wb.addSheet(name);
    this.active = name;
    this.sel = { col: 0, row: 0 }; this.selEnd = { col: 0, row: 0 };
    this.renderGrid();
  };
  App.prototype.renameSheet = function (oldName) {
    var promptFn = typeof window !== "undefined" && typeof window.prompt === "function" ? window.prompt : null;
    if (!promptFn) { this.notify("Renaming needs a browser prompt; not available here.", true); return; }
    var newName = promptFn("Rename sheet:", oldName);
    if (!newName || newName === oldName) return;
    newName = newName.trim().slice(0, 31);
    if (!newName || this.wb.sheets[newName]) { this.notify("Invalid or duplicate sheet name.", true); return; }
    this.pushUndo();
    this.wb.sheets[newName] = this.wb.sheets[oldName];
    delete this.wb.sheets[oldName];
    this.wb.order[this.wb.order.indexOf(oldName)] = newName;
    rewriteAllFormulas(this.wb, function (f) { return renameInFormula(f, oldName, newName); });
    if (this.active === oldName) this.active = newName;
    if (TPL.irrSheet === oldName) TPL.irrSheet = newName;
    TPL.exitCapKey = TPL.exitCapKey.replace(oldName + "!", newName + "!");
    TPL.rentGrowthKey = TPL.rentGrowthKey.replace(oldName + "!", newName + "!");
    this.renderGrid();
  };
  App.prototype.deleteSheet = function (name) {
    if (this.wb.order.length <= 1) { this.notify("Can't delete the only sheet.", true); return; }
    var confirmFn = typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm : null;
    if (confirmFn && !confirmFn('Delete sheet "' + name + '"? References to it will show #REF!.')) return;
    this.pushUndo();
    delete this.wb.sheets[name];
    this.wb.order.splice(this.wb.order.indexOf(name), 1);
    if (this.active === name) this.active = this.wb.order[0];
    this.renderGrid();
  };

  /* ------------------------------- editing -------------------------------- */
  App.prototype.startEdit = function (seed) {
    if (this.editing) return;
    var td = this.tdAt(this.sel);
    if (!td) return;
    this.editing = true;
    var a1 = addr(this.sel.col, this.sel.row);
    var cell = this.wb.cell(this.active, a1);
    var initial = seed !== undefined ? seed
      : cell ? (cell.f !== undefined && cell.f !== null ? "=" + cell.f : (cell.v === undefined ? "" : String(cell.v))) : "";
    td.classList.add("editing");
    td.innerHTML = "";
    var input = document.createElement("input");
    input.value = initial;
    td.appendChild(input);
    input.focus();
    input.setSelectionRange(initial.length, initial.length);
    var self = this;
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); self.stopEdit(true); self.moveSel(0, 1); }
      else if (e.key === "Tab") { e.preventDefault(); self.stopEdit(true); self.moveSel(e.shiftKey ? -1 : 1, 0); }
      else if (e.key === "Escape") { e.preventDefault(); self.stopEdit(false); }
      e.stopPropagation();
    });
    input.addEventListener("blur", function () { if (self.editing) self.stopEdit(true); });
    this.editInput = input;
  };
  App.prototype.stopEdit = function (commit) {
    if (!this.editing) return;
    var val = this.editInput.value;
    this.editing = false;
    this.editInput = null;
    if (commit) { this.pushUndo(); this.commitAt(this.sel, val); }
    this.renderGrid();
    this.el.gridwrap.focus();
  };
  App.prototype.commitAt = function (p, raw) {
    var a1 = addr(p.col, p.row);
    var parsed = parseInput(raw);
    var existing = this.wb.cell(this.active, a1) || {};
    var keep = { fmt: existing.fmt, style: existing.style, bold: existing.bold, color: existing.color, bg: existing.bg };
    if (parsed.f !== undefined) {
      this.wb.setCell(this.active, a1, Object.assign({ f: parsed.f }, keep));
    } else if (parsed.v === undefined) {
      delete this.sheet().cells[a1];
    } else {
      this.wb.setCell(this.active, a1, Object.assign({ v: parsed.v }, keep));
    }
  };

  App.prototype.notify = function (text, isError) {
    var old = this.mount.querySelector(".creuw-msg");
    if (old) old.remove();
    var d = document.createElement("div");
    d.className = "creuw-msg" + (isError ? " err" : "");
    d.textContent = text;
    this.el.gridwrap.appendChild(d);
    setTimeout(function () { d.remove(); }, 7000);
  };

  /* ------------------------------ XLSX I/O ------------------------------- */
  var sheetJsPromise = null;
  function loadSheetJS() {
    if (global.XLSX) return Promise.resolve(global.XLSX);
    if (sheetJsPromise) return sheetJsPromise;
    sheetJsPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = CONFIG.sheetJsUrl;
      s.onload = function () {
        if (global.XLSX) resolve(global.XLSX);
        else reject(new Error("SheetJS loaded but XLSX global missing"));
      };
      s.onerror = function () {
        reject(new Error("Could not load SheetJS from " + CONFIG.sheetJsUrl + " — check network / CSP, or self-host and set CONFIG.sheetJsUrl."));
      };
      document.head.appendChild(s);
    });
    return sheetJsPromise;
  }

  App.prototype.download = function () {
    var self = this;
    loadSheetJS().then(function (XLSX) {
      self.ev.reset();
      var out = XLSX.utils.book_new();
      self.wb.order.forEach(function (name) {
        var sh = self.wb.sheets[name];
        var ws = {};
        var maxR = 0, maxC = 0, has = false;
        Object.keys(sh.cells).forEach(function (a1) {
          var p = parseAddr(a1);
          if (!p) return;
          has = true;
          if (p.row > maxR) maxR = p.row;
          if (p.col > maxC) maxC = p.col;
          var cell = sh.cells[a1];
          var v = self.ev.value(name, a1);
          var o = {};
          var isScen = cell.f && cell.f.indexOf("SCEN.IRR") >= 0;
          if (cell.f !== undefined && cell.f !== null && !isScen) o.f = cell.f;
          if (isErr(v)) { o.t = "e"; o.v = v.__err; }
          else if (typeof v === "number") { o.t = "n"; o.v = v; }
          else if (typeof v === "boolean") { o.t = "b"; o.v = v; }
          else { o.t = "s"; o.v = v === null ? "" : String(v); }
          var z = fmtToZ(cell.fmt);
          if (z) o.z = z;
          ws[a1] = o;
        });
        ws["!ref"] = "A1:" + addr(Math.max(maxC, 0), Math.max(maxR, 0));
        if (!has) ws["A1"] = { t: "s", v: "" };
        var widths = sh.widths || {};
        var colsArr = [];
        for (var c = 0; c <= maxC; c++) {
          colsArr.push({ wpx: widths[c] !== undefined ? widths[c] : (c === 0 ? CONFIG.colWidthLabel : CONFIG.colWidthDefault) });
        }
        ws["!cols"] = colsArr;
        XLSX.utils.book_append_sheet(out, ws, name.slice(0, 31));
      });
      XLSX.writeFile(out, CONFIG.exportFileName);
      self.notify("Exported " + CONFIG.exportFileName + " with live formulas (opens in Excel; imports into Google Sheets via File \u2192 Import).");
    }).catch(function (e) { self.notify(e.message, true); });
  };

  App.prototype.upload = function (file) {
    var self = this;
    loadSheetJS().then(function (XLSX) {
      return file.arrayBuffer().then(function (buf) {
        var src = XLSX.read(buf, { type: "array", cellFormula: true, cellNF: false });
        self.pushUndo();
        var wb = new Workbook();
        src.SheetNames.forEach(function (name) {
          var ws = src.Sheets[name];
          var sh = wb.addSheet(name);
          Object.keys(ws).forEach(function (a1) {
            if (a1.charAt(0) === "!") return;
            var c = ws[a1];
            var cell = {};
            if (c.f) { cell.f = String(c.f); cell.iv = c.v; }
            else if (c.v !== undefined) cell.v = c.v;
            else return;
            sh.cells[a1] = cell;
          });
        });
        self.wb = wb;
        self.ev = new Evaluator(wb);
        self.active = wb.order[0];
        self.sel = { col: 0, row: 0 }; self.selEnd = { col: 0, row: 0 };
        self.renderGrid();
        self.notify('Opened "' + file.name + '" (' + wb.order.length +
          " sheets). Formulas evaluate live where supported; unsupported functions fall back to the file's saved values.");
      });
    }).catch(function (e) { self.notify("Upload failed: " + e.message, true); });
  };

  /* ================================= INIT ================================== */
  function init(options) {
    if (typeof document === "undefined") throw new Error("CREUnderwriting.init requires a browser.");
    var opt = options || {};
    Object.keys(opt).forEach(function (k) { if (k in CONFIG) CONFIG[k] = opt[k]; });
    var mount = document.getElementById(CONFIG.mountId);
    if (!mount) throw new Error('Mount element "#' + CONFIG.mountId + '" not found. Add <div id="' +
      CONFIG.mountId + '"></div> or pass { mountId } to init().');
    injectStyles();
    return new App(mount);
  }

  /* ============================== PUBLIC API =============================== */
  global.CREUnderwriting = {
    init: init,
    Workbook: Workbook,
    Evaluator: Evaluator,
    buildTemplate: buildTemplate,
    parseFormula: parseFormula,
    offsetFormula: offsetFormula,
    shiftFormula: shiftFormula,
    shiftStructure: shiftStructure,
    CONFIG: CONFIG,
    TPL: TPL
  };
})(typeof window !== "undefined" ? window : globalThis);
