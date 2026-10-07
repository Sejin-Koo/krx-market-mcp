// KRX OpenAPI(data-dbg.krx.co.kr) 클라이언트
//
// - 인증: 헤더 AUTH_KEY (환경변수 KRX_AUTH_KEY). 키 값은 어떤 응답에도 싣지 않는다.
// - 모든 API는 basDd=YYYYMMDD 하나만 받고, 그날의 전 종목(전 지수)을 한 번에 돌려준다.
// - 매매·지수 API는 휴장일·당일·형식이 틀린 날짜에 모두 HTTP 200 + {"OutBlock_1": []} 를 준다(2026-10-07 실측).
//   종목기본정보는 휴장일에도 자료를 주고 당일·미래만 빈 배열이다.
//   그래서 형식 검사는 호출 전에 하고, 빈 배열은 "그날 자료 없음"으로만 해석해 하루씩 거슬러 간다.
// - 모든 값은 문자열로 온다. 숫자 변환은 여기서 한다.

const BASE_URL = "https://data-dbg.krx.co.kr/svc/apis/";

// 데이터셋 레지스트리 — 이용 승인된 API 전부(KRX 정보데이터시스템 이용현황 화면 기준).
// since: 첫 데이터가 있는 날(2026-10-07 실측). 그 이전 날짜는 호출하지 않고 안내한다.
// calendar: 종목기본정보는 주말·공휴일에도 그날 기준 스냅샷을 준다(2026-10-03·04·05 실측, 상장주식수가 날마다 바뀜).
//           당일·미래만 빈 배열이다. 그래서 이 데이터셋은 주말을 건너뛰지 않는다.
export const DATASETS = {
  KOSPI_BASE: { cat: "sto", api: "stk_isu_base_info", label: "유가증권 종목기본정보", market: "KOSPI", type: "base", calendar: true, since: "20100104" },
  KOSDAQ_BASE: { cat: "sto", api: "ksq_isu_base_info", label: "코스닥 종목기본정보", market: "KOSDAQ", type: "base", calendar: true, since: "20100104" },
  KONEX_BASE: { cat: "sto", api: "knx_isu_base_info", label: "코넥스 종목기본정보", market: "KONEX", type: "base", calendar: true, since: "20130701" },
  KOSPI_STOCK: { cat: "sto", api: "stk_bydd_trd", label: "유가증권 일별매매정보", market: "KOSPI", type: "stock", since: "20100104" },
  KOSDAQ_STOCK: { cat: "sto", api: "ksq_bydd_trd", label: "코스닥 일별매매정보", market: "KOSDAQ", type: "stock", since: "20100104" },
  KONEX_STOCK: { cat: "sto", api: "knx_bydd_trd", label: "코넥스 일별매매정보", market: "KONEX", type: "stock", since: "20130701" },
  INDEX_KRX: { cat: "idx", api: "krx_dd_trd", label: "KRX 시리즈 일별시세정보", market: "KRX", type: "index", since: "20100104" },
  INDEX_KOSPI: { cat: "idx", api: "kospi_dd_trd", label: "KOSPI 시리즈 일별시세정보", market: "KOSPI", type: "index", since: "20100104" },
  INDEX_KOSDAQ: { cat: "idx", api: "kosdaq_dd_trd", label: "KOSDAQ 시리즈 일별시세정보", market: "KOSDAQ", type: "index", since: "20100104" },
  INDEX_BOND: { cat: "idx", api: "bon_dd_trd", label: "채권지수 시세정보", market: "BOND", type: "bondindex", since: "20100104" },
  ETF: { cat: "etp", api: "etf_bydd_trd", label: "ETF 일별매매정보", market: "ETF", type: "etf", since: "20100104" },
  BOND_KTS: { cat: "bon", api: "kts_bydd_trd", label: "국채전문유통시장 일별매매정보", market: "KTS", type: "bond", since: "20100104" },
  BOND_GENERAL: { cat: "bon", api: "bnd_bydd_trd", label: "일반채권시장 일별매매정보", market: "GENERAL", type: "bond", since: "20100104" },
  BOND_SMALL: { cat: "bon", api: "smb_bydd_trd", label: "소액채권시장 일별매매정보", market: "SMALL", type: "bond", since: "20100104" },
  OIL: { cat: "gen", api: "oil_bydd_trd", label: "석유시장 일별매매정보", market: "OIL", type: "oil", since: "20120330" },
  GOLD: { cat: "gen", api: "gold_bydd_trd", label: "금시장 일별매매정보", market: "GOLD", type: "commodity", since: "20140324" },
  EMISSION: { cat: "gen", api: "ets_bydd_trd", label: "배출권 시장 일별매매정보", market: "EMISSION", type: "commodity", since: "20150112" },
};

// 이용신청 화면에 없는(=승인 안 된) API. 2026-10-07 호출 시 401 "Unauthorized API Call".
// 앞의 5개는 KRX 개발명세서로 API명을 확인했으므로 401은 미승인이다. 뒤의 5개는 명세서가 없어 이름 불일치일 수도 있다.
export const UNAPPROVED_APIS = [
  "sto/sr_bydd_trd (신주인수권증서, 명세서 확인 — 미승인)", "sto/sw_bydd_trd (신주인수권증권, 명세서 확인 — 미승인)",
  "idx/drvprod_dd_trd (파생상품지수, 명세서 확인 — 미승인)", "etp/elw_bydd_trd (ELW, 명세서 확인 — 미승인)",
  "etp/etn_bydd_trd (ETN, 명세서 확인 — 미승인)",
  "drv/fut_bydd_trd (선물, 명세서 없음 — 미승인 또는 이름 불일치)", "drv/opt_bydd_trd (옵션, 명세서 없음 — 미승인 또는 이름 불일치)",
  "esg/sri_bond_info (SRI채권, 명세서 없음 — 미승인 또는 이름 불일치)", "esg/esg_etp_info (ESG ETP, 명세서 없음 — 미승인 또는 이름 불일치)",
  "esg/esg_index_info (ESG 지수, 명세서 없음 — 미승인 또는 이름 불일치)",
];

// ── 필드 라벨 ────────────────────────────────────────────────────────────────
const COMMON_LABELS = {
  BAS_DD: "기준일", ISU_CD: "종목코드", ISU_SRT_CD: "종목코드", ISU_NM: "종목명", ISU_ABBRV: "종목약명", ISU_ENG_NM: "영문명",
  LIST_DD: "상장일", MKT_TP_NM: "시장", MKT_NM: "시장", SECUGRP_NM: "증권구분", SECT_TP_NM: "소속부",
  KIND_STKCERT_TP_NM: "주식종류", PARVAL: "액면가", LIST_SHRS: "상장주식수",
  TDD_CLSPRC: "종가", CMPPREVDD_PRC: "대비", FLUC_RT: "등락률", TDD_OPNPRC: "시가", TDD_HGPRC: "고가", TDD_LWPRC: "저가",
  ACC_TRDVOL: "거래량", ACC_TRDVAL: "거래대금", MKTCAP: "시가총액",
  IDX_CLSS: "계열구분", IDX_NM: "지수명", CLSPRC_IDX: "종가", CMPPREVDD_IDX: "대비", OPNPRC_IDX: "시가", HGPRC_IDX: "고가", LWPRC_IDX: "저가",
  NAV: "NAV", INVSTASST_NETASST_TOTAMT: "순자산총액", IDX_IND_NM: "기초지수명", OBJ_STKPRC_IDX: "기초지수종가", FLUC_RT_IDX: "기초지수등락률",
  CLSPRC: "종가", CLSPRC_YD: "종가수익률", OPNPRC: "시가", OPNPRC_YD: "시가수익률", HGPRC: "고가", HGPRC_YD: "고가수익률",
  LWPRC: "저가", LWPRC_YD: "저가수익률", BND_EXP_TP_NM: "만기년수", GOVBND_ISU_TP_NM: "종목구분",
  BND_IDX_GRP_NM: "지수명", TOT_EARNG_IDX: "총수익지수_종가", TOT_EARNG_IDX_CMPPREVDD: "총수익지수_대비",
  NETPRC_IDX: "순가격지수_종가", NETPRC_IDX_CMPPREVDD: "순가격지수_대비", ZERO_REINVST_IDX: "제로재투자지수_종가",
  ZERO_REINVST_IDX_CMPPREVDD: "제로재투자지수_대비", CALL_REINVST_IDX: "콜재투자지수_종가", CALL_REINVST_IDX_CMPPREVDD: "콜재투자지수_대비",
  MKT_PRC_IDX: "시장가격지수_종가", MKT_PRC_IDX_CMPPREVDD: "시장가격지수_대비", AVG_DURATION: "듀레이션",
  AVG_CONVEXITY_PRC: "컨벡시티", BND_IDX_AVG_YD: "YTM",
  OIL_NM: "유종", WT_AVG_PRC: "가중평균가격_경쟁", WT_DIS_AVG_PRC: "가중평균가격_협의",
};
// 라벨은 KRX 개발명세서(OutBlock_1 Description) 기준이다(2026-10-07 대조, 저장소 docs/krx-api-fields.md).
// 데이터셋별 덮어쓰기 — 종목기본정보의 ISU_CD는 12자리 표준코드, ETF의 상장수량은 좌수, 지수의 MKTCAP은 상장시가총액
const LABEL_OVERRIDES = {
  base: { ISU_CD: "표준코드", ISU_SRT_CD: "종목코드" },
  etf: { CMPPREVDD_IDX: "기초지수대비", LIST_SHRS: "상장좌수" },
  index: { MKTCAP: "상장시가총액" },
};
// 문자열로 남길 필드(코드·이름·날짜)
const STRING_FIELDS = new Set([
  "BAS_DD", "ISU_CD", "ISU_SRT_CD", "ISU_NM", "ISU_ABBRV", "ISU_ENG_NM", "LIST_DD", "MKT_TP_NM", "MKT_NM",
  "SECUGRP_NM", "SECT_TP_NM", "KIND_STKCERT_TP_NM", "IDX_CLSS", "IDX_NM", "IDX_IND_NM", "BND_IDX_GRP_NM",
  "GOVBND_ISU_TP_NM", "OIL_NM", "BND_EXP_TP_NM",
]);

export function labelOf(type, field) {
  return (LABEL_OVERRIDES[type] && LABEL_OVERRIDES[type][field]) || COMMON_LABELS[field] || field;
}

/** "1,234" / "-1.2" / "" / "-" → number | null. 숫자가 아니면 원문 유지 */
export function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

/** KRX 원본 행을 한국어 라벨 + 숫자 변환된 객체로 바꾼다 */
export function convertRow(type, raw, onlyFields) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (onlyFields && !onlyFields.includes(k)) continue;
    const label = labelOf(type, k);
    out[label] = STRING_FIELDS.has(k) ? (v === "" ? null : v) : toNum(v);
  }
  return out;
}

// ── 날짜 ─────────────────────────────────────────────────────────────────────
export function todayKst() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
export function parseYmd(s) {
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}
export function fmtYmd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
export function addDays(ymd, n) {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtYmd(d);
}
export function weekday(ymd) {
  return parseYmd(ymd).getUTCDay(); // 0=일 … 6=토
}
export function isWeekend(ymd) {
  const w = weekday(ymd);
  return w === 0 || w === 6;
}
export function dashed(ymd) {
  return ymd ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` : ymd;
}

/**
 * 날짜 입력을 YYYYMMDD로 정규화. YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 허용.
 * KRX는 형식이 틀려도 오류 없이 빈 배열을 주므로(실측), 반드시 여기서 걸러야 한다.
 */
export function normalizeDate(input, name = "bas_dd") {
  if (input === undefined || input === null || String(input).trim() === "") return null;
  const s = String(input).trim().replace(/[-./]/g, "");
  if (!/^\d{8}$/.test(s)) throw new Error(`${name} 형식이 잘못됐습니다: "${input}". YYYYMMDD 또는 YYYY-MM-DD로 주세요.`);
  const d = parseYmd(s);
  if (fmtYmd(d) !== s) throw new Error(`${name}가 존재하지 않는 날짜입니다: "${input}".`);
  return s;
}

// ── 호출 ─────────────────────────────────────────────────────────────────────
export function keyConfigured() {
  return !!(process.env.KRX_AUTH_KEY && process.env.KRX_AUTH_KEY.trim());
}

export class KrxError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/** 이번 도구 호출에서 KRX를 몇 번 불렀는지 센다(일일 한도 10,000건 공유 자원) */
export class Meter {
  constructor() {
    this.calls = 0;
    this.cacheHits = 0;
  }
}

// 과거 날짜 응답은 바뀌지 않으므로 인스턴스 메모리에 둔다(LRU).
// 빈 응답은 최근 7일 이내면 캐시하지 않는다 — 전 영업일 자료가 언제 올라오는지 확인되지 않았기 때문이다
// (당일은 15:50에도 빈 배열이었다, 2026-10-07 실측). 코스닥 하루치가 원문 약 560KB라 항목 수를 작게 둔다.
const CACHE = new Map();
const CACHE_MAX = 40;
export function cacheStats() {
  return { 항목수: CACHE.size, 최대: CACHE_MAX };
}
function cacheGet(k) {
  if (!CACHE.has(k)) return undefined;
  const v = CACHE.get(k);
  CACHE.delete(k);
  CACHE.set(k, v);
  return v;
}
function cacheSet(k, v) {
  CACHE.set(k, v);
  while (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
}

/** 원본 행 배열을 돌려준다. 빈 배열 = 그날 자료 없음(휴장·당일·제공 전) */
export async function fetchRaw(dsKey, ymd, meter, { cache = true } = {}) {
  const ds = DATASETS[dsKey];
  if (!ds) throw new KrxError(`알 수 없는 데이터셋: ${dsKey}`, "BAD_DATASET");
  if (!keyConfigured()) throw new KrxError("서버에 KRX_AUTH_KEY 환경변수가 설정되어 있지 않습니다.", "NO_KEY");
  const ck = `${ds.api}:${ymd}`;
  const hit = cacheGet(ck);
  if (hit !== undefined) {
    if (meter) meter.cacheHits++;
    return hit;
  }
  const url = `${BASE_URL}${ds.cat}/${ds.api}?basDd=${ymd}`;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30000);
    try {
      if (meter) meter.calls++;
      const r = await fetch(url, {
        headers: { AUTH_KEY: process.env.KRX_AUTH_KEY.trim(), "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: ac.signal,
      });
      const text = await r.text();
      clearTimeout(timer);
      if (r.status === 401) {
        let msg = text;
        try {
          msg = JSON.parse(text).respMsg || text;
        } catch {
          /* 원문 */
        }
        if (/Unauthorized Key/i.test(msg))
          throw new KrxError(`KRX가 인증키를 거부했습니다(${msg}). 키가 만료(이용기간 2027-06-25까지, KRX 화면 기준)됐거나 서버의 KRX_AUTH_KEY 값이 틀렸을 수 있습니다.`, "BAD_KEY");
        throw new KrxError(`KRX가 이 API 호출을 거부했습니다(${msg}) — ${ds.label}(${ds.cat}/${ds.api}). 이용신청 승인 상태를 KRX 정보데이터시스템에서 확인하세요.`, "UNAPPROVED");
      }
      if (r.status === 429) throw new KrxError("KRX 일일 호출 한도에 걸린 것으로 보입니다(HTTP 429). 재시도하지 말고 다음 날 다시 조회하세요.", "RATE_LIMIT");
      if (r.status >= 500) {
        lastErr = new KrxError(`KRX 서버 오류 HTTP ${r.status}`, "UPSTREAM");
        continue;
      }
      if (r.status !== 200) throw new KrxError(`KRX 응답 HTTP ${r.status}: ${text.slice(0, 200)}`, "UPSTREAM");
      if (!text.trim()) {
        lastErr = new KrxError("KRX가 HTTP 200에 빈 본문을 보냈습니다(자료 없음과 구분되지 않아 오류로 처리).", "EMPTY_BODY");
        continue;
      }
      let j;
      try {
        j = JSON.parse(text);
      } catch {
        throw new KrxError(`KRX 응답을 JSON으로 읽지 못했습니다: ${text.slice(0, 200)}`, "UPSTREAM");
      }
      const rows = Array.isArray(j.OutBlock_1) ? j.OutBlock_1 : null;
      if (!rows) throw new KrxError(`KRX 응답에 OutBlock_1이 없습니다: ${text.slice(0, 200)}`, "UPSTREAM");
      if (cache && (rows.length > 0 ? ymd < todayKst() : ymd < addDays(todayKst(), -7))) cacheSet(ck, rows);
      return rows;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof KrxError && e.code !== "UPSTREAM" && e.code !== "EMPTY_BODY") throw e;
      lastErr = e.name === "AbortError" ? new KrxError("KRX 응답이 30초 안에 오지 않았습니다.", "TIMEOUT") : e;
    }
  }
  throw lastErr;
}

/**
 * 기준일 결정 + 휴장일 자동 보정.
 * requested가 없으면 오늘(KST)부터, 있으면 그날부터 하루씩 거슬러 자료가 있는 날을 찾는다(최대 maxBack일).
 * 주말은 호출하지 않고 건너뛴다. exact=true면 거슬러 가지 않는다.
 */
export async function fetchWithFallback(dsKey, requested, meter, { exact = false, maxBack = 10, cache = true } = {}) {
  const ds = DATASETS[dsKey];
  const today = todayKst();
  let start = requested || today;
  const notes = [];
  if (start > today) {
    notes.push(`요청일 ${dashed(start)}이 미래라 오늘(${dashed(today)})부터 조회했습니다.`);
    start = today;
  }
  if (start < ds.since)
    throw new KrxError(`${ds.label}은 ${dashed(ds.since)}부터 제공됩니다(요청일 ${dashed(start)}).`, "BEFORE_SINCE");
  const skipped = [];
  let d = start;
  for (let i = 0; i <= (exact ? 0 : maxBack); i++) {
    if (d < ds.since) break;
    if (ds.calendar || !isWeekend(d)) {
      const rows = await fetchRaw(dsKey, d, meter, { cache });
      if (rows.length > 0) {
        if (skipped.length)
          notes.push(`${skipped.map(dashed).join(", ")}에는 자료가 없어(휴장일·당일 미제공 등) ${dashed(d)} 자료를 사용했습니다.`);
        return { rows, usedDate: d, requestedDate: requested || null, skipped, notes };
      }
    }
    skipped.push(d);
    d = addDays(d, -1);
  }
  const why = exact
    ? `${dashed(start)}에는 자료가 없습니다(휴장일이거나 당일 자료 미제공). exact=false로 두면 직전 영업일로 보정합니다.`
    : `${dashed(start)}부터 ${maxBack}일을 거슬러도 ${ds.label} 자료가 없습니다.`;
  throw new KrxError(why, "NO_DATA");
}

/** 같은 기준일로 여러 데이터셋을 조회. 첫 데이터셋에서 정한 사용일을 나머지에도 쓴다(없으면 각자 보정) */
export async function fetchMany(dsKeys, requested, meter, opts) {
  const out = {};
  let anchor = null;
  for (const k of dsKeys) {
    if (anchor) {
      try {
        out[k] = await fetchWithFallback(k, anchor, meter, { exact: true });
        continue;
      } catch (e) {
        if (!(e instanceof KrxError) || (e.code !== "NO_DATA" && e.code !== "BEFORE_SINCE")) throw e;
      }
    }
    try {
      out[k] = await fetchWithFallback(k, requested, meter, opts);
      if (!anchor) anchor = out[k].usedDate;
    } catch (e) {
      if (e instanceof KrxError && (e.code === "BEFORE_SINCE" || e.code === "NO_DATA")) out[k] = { error: e.message };
      else throw e;
    }
  }
  return out;
}

/** 동시 실행 개수를 제한해 비동기 작업을 돈다 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}
