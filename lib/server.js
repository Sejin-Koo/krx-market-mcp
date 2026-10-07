// krx-market-mcp — KRX 시세·상장정보 MCP 서버
//
// KRX OpenAPI 인증키(KRX_AUTH_KEY) 하나로 이용 승인된 API 전부를 다룬다.
//   종목기본정보(유가증권·코스닥·코넥스) · 주식 일별매매(3시장) · 지수(KRX·KOSPI·KOSDAQ 시리즈, 채권지수) ·
//   ETF · 채권(국채전문유통·일반·소액) · 일반상품(석유·금·배출권) · 기간 시계열
// 저장소는 두지 않는다(매번 실시간 조회). 과거 날짜 응답만 인스턴스 메모리에 잠시 캐시한다.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  DATASETS,
  UNAPPROVED_APIS,
  KrxError,
  Meter,
  fetchRaw,
  fetchWithFallback,
  fetchMany,
  mapLimit,
  convertRow,
  labelOf,
  toNum,
  normalizeDate,
  todayKst,
  addDays,
  isWeekend,
  dashed,
  keyConfigured,
  cacheStats,
} from "./krx.js";

export const SERVER_VERSION = "1.0.0";

// ── 공통 헬퍼 ────────────────────────────────────────────────────────────────
const MAX_TEXT = 400000; // 응답 텍스트 상한(문자). 넘으면 행을 줄이고 잘렸다고 알린다

const ok = (obj) => {
  let text = JSON.stringify(obj, null, 1);
  if (text.length > 100000) text = JSON.stringify(obj);
  return { content: [{ type: "text", text }] };
};
const fail = (e, meter) => ({
  content: [
    {
      type: "text",
      text: `오류: ${e && e.message ? e.message : String(e)}` + (meter ? `\n(이번 호출 KRX API 호출 수: ${meter.calls})` : ""),
    },
  ],
  isError: true,
});

/** MCP 클라이언트가 인자를 문자열로 직렬화해 보내는 경우가 있어 number/boolean/배열은 관대하게 받는다 */
const num = (min, max, def) => {
  let s = z.coerce.number().int();
  if (min !== undefined) s = s.min(min);
  if (max !== undefined) s = s.max(max);
  return def === undefined ? s.optional() : s.default(def);
};
const bool = (def = false) =>
  z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(def);
const strList = () =>
  z
    .union([z.array(z.string()), z.string()])
    .transform((v) => {
      let a;
      if (Array.isArray(v)) a = v;
      else {
        const s = v.trim();
        if (s.startsWith("[")) {
          try {
            const j = JSON.parse(s);
            if (Array.isArray(j)) a = j.map(String);
          } catch {
            /* 아래로 */
          }
        }
        if (!a) a = s.split(/[,\n]+/);
      }
      return a.map((x) => String(x).trim()).filter(Boolean);
    })
    .optional();
const dateArg = (desc) => z.string().optional().describe(desc);

const meta = (meter, extra = {}) => ({ KRX호출수: meter.calls, 캐시사용: meter.cacheHits, ...extra });

const sum = (rows, f) => rows.reduce((s, r) => s + (typeof r[f] === "number" ? r[f] : toNum(r[f]) || 0), 0);
const countBy = (rows, f) => {
  const m = {};
  for (const r of rows) {
    const k = r[f] === "" || r[f] === undefined || r[f] === null ? "(없음)" : r[f];
    m[k] = (m[k] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();
const contains = (hay, needle) => norm(hay).includes(norm(needle));

/** 행 목록을 offset/limit로 자르고, 텍스트 상한을 넘으면 더 줄인다 */
function page(rows, offset, limit, render = (x) => x) {
  const total = rows.length;
  let slice = rows.slice(offset, offset + limit).map(render);
  let reason = null;
  let len = JSON.stringify(slice).length;
  if (len > MAX_TEXT) {
    const per = len / slice.length;
    const keep = Math.max(1, Math.floor(MAX_TEXT / per));
    slice = slice.slice(0, keep);
    reason = `응답 크기 상한(${MAX_TEXT.toLocaleString()}자) 때문에 ${keep}건만 담았습니다`;
  }
  const truncated = offset + slice.length < total;
  return {
    info: {
      전체건수: total,
      반환건수: slice.length,
      offset,
      잘림: truncated,
      ...(truncated
        ? {
            잘림사유: reason || `limit=${limit}에서 멈췄습니다`,
            다음호출: `offset=${offset + slice.length}로 이어 받거나, 필터(검색어·소속부 등)를 좁히세요. 건수만 필요하면 summary_only=true.`,
          }
        : {}),
    },
    rows: slice,
  };
}

const sortDesc = (f) => (a, b) => (toNum(b[f]) ?? -Infinity) - (toNum(a[f]) ?? -Infinity);
const sortAsc = (f) => (a, b) => (toNum(a[f]) ?? Infinity) - (toNum(b[f]) ?? Infinity);

// ── 상장 회사 수 집계 규칙(인계서 3-5, 2026-10-07 검증) ──────────────────────
// 1) 회사 수 = 주식종류 "보통주"인 종목 수 (우선주·종류주권은 같은 회사의 다른 종목)
// 2) 영업 회사 = 보통주에서 리츠·인프라펀드·투자회사·스팩을 뺀 것
//    스팩: 소속부가 "SPAC…" 이거나, 종목명에 "기업인수목적" 또는 약명에 "스팩"이 들어간 것.
//    ★ 관리종목으로 지정된 스팩은 소속부가 "관리종목(소속부없음)"으로 바뀌어 소속부만 보면 빠진다.
//    ★ 종목명(ISU_NM)은 "…기업인수목적"이고 "스팩"은 약명(ISU_ABBRV)에만 있다 — 종목명에서 "스팩"을 찾으면 5개가 빠진다.
// 3) 외국주권·주식예탁증권(DR)은 회사로 센다(exclude로 따로 뺄 수 있음)
const EXCLUDE_KEYS = ["spac", "reit", "infra", "investco", "foreign", "dr", "preferred"];
function classify(r) {
  const common = r.KIND_STKCERT_TP_NM === "보통주";
  const spac = /^SPAC/.test(r.SECT_TP_NM || "") || /기업인수목적/.test(r.ISU_NM || "") || /스팩/.test(r.ISU_ABBRV || "");
  const g = r.SECUGRP_NM;
  const f = {
    common,
    preferred: !common,
    spac,
    reit: g === "부동산투자회사",
    infra: g === "사회간접자본투융자회사",
    investco: g === "투자회사",
    foreign: g === "외국주권",
    dr: g === "주식예탁증권",
  };
  f.operating = common && !f.spac && !f.reit && !f.infra && !f.investco;
  return f;
}
const COUNT_RULE =
  "회사 수 = 주식종류 '보통주' 종목 수. 영업 회사 = 보통주에서 리츠(부동산투자회사)·인프라펀드(사회간접자본투융자회사)·투자회사·스팩 제외. " +
  "스팩 = 소속부 'SPAC…' 또는 종목명 '기업인수목적' 또는 약명 '스팩'(관리종목 지정 스팩은 소속부가 바뀌어 있음). 외국주권·주식예탁증권(DR)은 회사로 셈.";

function marketSummary(rawRows) {
  const cl = rawRows.map((r) => [r, classify(r)]);
  const common = cl.filter(([, c]) => c.common);
  const s = {
    종목수: rawRows.length,
    보통주_회사수: common.length,
    영업회사수: cl.filter(([, c]) => c.operating).length,
    영업회사_제외내역: {
      스팩: common.filter(([, c]) => c.spac).length,
      리츠: common.filter(([, c]) => c.reit).length,
      인프라펀드: common.filter(([, c]) => c.infra).length,
      투자회사: common.filter(([, c]) => c.investco).length,
    },
    보통주중_외국주권: common.filter(([, c]) => c.foreign).length,
    보통주중_주식예탁증권: common.filter(([, c]) => c.dr).length,
    주식종류분포: countBy(rawRows, "KIND_STKCERT_TP_NM"),
    증권구분분포: countBy(rawRows, "SECUGRP_NM"),
  };
  const sect = countBy(
    common.map(([r]) => r),
    "SECT_TP_NM"
  );
  if (!(Object.keys(sect).length === 1 && sect["(없음)"])) s.소속부분포_보통주 = sect;
  return s;
}

const MARKETS3 = ["KOSPI", "KOSDAQ", "KONEX"];
const marketList = (m) => (m === "ALL" ? MARKETS3 : [m]);

function dateInfo(res) {
  return { 요청기준일: res.requestedDate ? dashed(res.requestedDate) : "(생략 — 최근 영업일)", 사용기준일: dashed(res.usedDate) };
}

// 일별 데이터셋(시계열용) — 종목기본정보는 제외
const SERIES_DATASETS = Object.keys(DATASETS).filter((k) => DATASETS[k].type !== "base");
const BASIC_FIELDS = {
  stock: ["TDD_CLSPRC", "CMPPREVDD_PRC", "FLUC_RT", "TDD_OPNPRC", "TDD_HGPRC", "TDD_LWPRC", "ACC_TRDVOL", "ACC_TRDVAL", "MKTCAP", "LIST_SHRS"],
  index: ["CLSPRC_IDX", "CMPPREVDD_IDX", "FLUC_RT", "ACC_TRDVAL", "MKTCAP"],
  bondindex: ["TOT_EARNG_IDX", "NETPRC_IDX", "MKT_PRC_IDX", "BND_IDX_AVG_YD", "AVG_DURATION"],
  etf: ["TDD_CLSPRC", "FLUC_RT", "NAV", "ACC_TRDVAL", "MKTCAP", "INVSTASST_NETASST_TOTAMT", "OBJ_STKPRC_IDX"],
  bond: ["CLSPRC", "CMPPREVDD_PRC", "CLSPRC_YD", "ACC_TRDVOL", "ACC_TRDVAL"],
  oil: ["WT_AVG_PRC", "WT_DIS_AVG_PRC", "ACC_TRDVOL", "ACC_TRDVAL"],
  commodity: ["TDD_CLSPRC", "CMPPREVDD_PRC", "FLUC_RT", "ACC_TRDVOL", "ACC_TRDVAL"],
};
const PRICE_FIELD = { stock: "TDD_CLSPRC", index: "CLSPRC_IDX", bondindex: "TOT_EARNG_IDX", etf: "TDD_CLSPRC", bond: "CLSPRC", oil: "WT_DIS_AVG_PRC", commodity: "TDD_CLSPRC" };
const ID_FIELDS = ["ISU_CD", "ISU_SRT_CD", "ISU_NM", "ISU_ABBRV", "IDX_NM", "BND_IDX_GRP_NM", "OIL_NM"];
const NAME_FIELDS = ["ISU_NM", "IDX_NM", "BND_IDX_GRP_NM", "OIL_NM"];
const rowId = (r) => r.ISU_CD || r.IDX_NM || r.BND_IDX_GRP_NM || r.OIL_NM;
const rowName = (r) => NAME_FIELDS.map((f) => r[f]).find(Boolean);

const UNIT_NOTE = {
  stock: "가격 원, 거래대금·시가총액 원, 등락률 %. 종가는 수정주가가 아니다(액면분할·무상증자 전후 비교 주의)",
  index: "지수 포인트, 거래대금·상장시가총액 원. '(외국주포함)' 계열 등 일부 행은 지수값이 비어 있다(null)",
  bondindex: "지수 포인트, 평균수익률 %, 평균듀레이션 년",
  etf: "가격·NAV 원, 순자산총액·시가총액·거래대금 원",
  bond: "가격은 액면 10,000원 기준, 수익률 %, 거래량은 액면금액(원), 거래대금 원",
  oil: "가격 원/리터, 거래량 리터, 거래대금 원 (경쟁매매·협의매매 가중평균가격 — 거래가 없으면 0)",
  commodity: "금: 가격 원/g, 거래량 g · 배출권: 가격 원/톤(tCO2-eq), 거래량 톤 · 거래대금 원",
};

// ── 서버 ─────────────────────────────────────────────────────────────────────
export function buildServer() {
  const server = new McpServer({ name: "krx-market-mcp", version: SERVER_VERSION });

  const commonDateDesc =
    "기준일 YYYYMMDD(또는 YYYY-MM-DD). 생략하면 최근 영업일. 휴장일·당일(장 마감 후에도 당일 자료는 아직 없음)이면 자료가 있는 날까지 최대 10일 거슬러 조회하고, 응답의 사용기준일에 실제로 쓴 날을 적는다";
  const exactDesc = "true면 휴장일 보정을 하지 않고 그날 자료만 조회(없으면 오류)";

  // ── 1. 상장 종목·회사 목록 ─────────────────────────────────────────────────
  server.registerTool(
    "krx_list_listed",
    {
      title: "상장 종목·회사 목록과 회사 수 집계 (종목기본정보)",
      description:
        "유가증권·코스닥·코넥스 종목기본정보로 상장 종목 목록과 시장별 회사 수를 돌려준다. " +
        "API는 종목 단위(우선주가 따로 한 줄)라, 회사 수는 서버가 고정 규칙으로 계산한다 — " +
        COUNT_RULE +
        " 집계(시장별집계)는 필터와 무관하게 그 시장 전체 기준이고, 필터는 반환 목록에만 적용된다. " +
        "'상장사 몇 개야'는 summary_only=true로 충분하다. 2010-01-04 이후 과거 기준일도 조회된다(코넥스는 2013-07-01부터). " +
        "시세·시가총액은 krx_get_stock_daily.",
      inputSchema: {
        market: z.enum(["KOSPI", "KOSDAQ", "KONEX", "ALL"]).default("ALL").describe("시장. ALL이면 3시장 모두"),
        bas_dd: dateArg(commonDateDesc),
        exact: bool(false).describe(exactDesc),
        query: z.string().optional().describe("종목명·약명·영문명·종목코드(6자리)·표준코드 부분일치 검색(공백 무시)"),
        codes: strList().describe("종목코드(6자리 단축코드) 목록. 정확히 일치하는 것만"),
        sect: z.string().optional().describe("소속부 부분일치(예: 벤처기업부, 관리종목, SPAC). 코스피는 소속부가 비어 있다"),
        secugrp: strList().describe("증권구분 목록(예: 주권, 부동산투자회사, 외국주권, 주식예탁증권)"),
        kind: strList().describe("주식종류 목록(예: 보통주, 구형우선주, 신형우선주, 종류주권)"),
        common_only: bool(false).describe("보통주만(= 회사 단위)"),
        operating_only: bool(false).describe("영업 회사만(보통주 − 리츠·인프라펀드·투자회사·스팩)"),
        exclude: strList().describe(`목록에서 뺄 분류: ${EXCLUDE_KEYS.join(", ")} (preferred = 보통주가 아닌 종목)`),
        listed_from: dateArg("상장일 이 날 이후(포함)"),
        listed_to: dateArg("상장일 이 날 이전(포함)"),
        sort: z.enum(["code", "name", "list_date_desc", "list_date_asc", "list_shares"]).default("code").describe("정렬"),
        summary_only: bool(false).describe("true면 목록 없이 집계만"),
        fields: z.enum(["basic", "all"]).default("basic").describe("basic: 주요 필드, all: 표준코드·영문명·액면가·분류 플래그 포함"),
        limit: num(1, 2000, 100).describe("반환 행 수(기본 100, 최대 2000)"),
        offset: num(0, 100000, 0),
      },
    },
    async (a) => {
      const meter = new Meter();
      try {
        const bas = normalizeDate(a.bas_dd);
        const lf = normalizeDate(a.listed_from, "listed_from");
        const lt = normalizeDate(a.listed_to, "listed_to");
        const ex = new Set((a.exclude || []).map((x) => x.toLowerCase()));
        for (const x of ex) if (!EXCLUDE_KEYS.includes(x)) throw new Error(`exclude 값 "${x}"는 지원하지 않습니다. 가능: ${EXCLUDE_KEYS.join(", ")}`);
        const mkts = marketList(a.market);
        const res = await fetchMany(mkts.map((m) => `${m}_BASE`), bas, meter, { exact: a.exact });

        const summary = {};
        const notes = [];
        let all = [];
        const used = {};
        for (const m of mkts) {
          const r = res[`${m}_BASE`];
          if (r.error) {
            summary[m] = { 오류: r.error };
            continue;
          }
          used[m] = dashed(r.usedDate);
          notes.push(...r.notes);
          summary[m] = marketSummary(r.rows);
          all.push(...r.rows);
        }
        if (mkts.length > 1) {
          const ok3 = mkts.filter((m) => summary[m] && !summary[m].오류);
          summary.합계 = {
            종목수: ok3.reduce((s, m) => s + summary[m].종목수, 0),
            보통주_회사수: ok3.reduce((s, m) => s + summary[m].보통주_회사수, 0),
            영업회사수: ok3.reduce((s, m) => s + summary[m].영업회사수, 0),
          };
        }

        let rows = all.map((r) => ({ r, c: classify(r) }));
        if (a.query) rows = rows.filter(({ r }) => ["ISU_NM", "ISU_ABBRV", "ISU_ENG_NM", "ISU_SRT_CD", "ISU_CD"].some((f) => contains(r[f], a.query)));
        if (a.codes && a.codes.length) {
          const set = new Set(a.codes);
          rows = rows.filter(({ r }) => set.has(r.ISU_SRT_CD));
        }
        if (a.sect) rows = rows.filter(({ r }) => contains(r.SECT_TP_NM, a.sect));
        if (a.secugrp && a.secugrp.length) rows = rows.filter(({ r }) => a.secugrp.includes(r.SECUGRP_NM));
        if (a.kind && a.kind.length) rows = rows.filter(({ r }) => a.kind.includes(r.KIND_STKCERT_TP_NM));
        if (a.common_only) rows = rows.filter(({ c }) => c.common);
        if (a.operating_only) rows = rows.filter(({ c }) => c.operating);
        for (const x of ex) rows = rows.filter(({ c }) => !c[x]);
        if (lf) rows = rows.filter(({ r }) => r.LIST_DD >= lf);
        if (lt) rows = rows.filter(({ r }) => r.LIST_DD <= lt);
        const sorters = {
          code: (x, y) => x.r.ISU_SRT_CD.localeCompare(y.r.ISU_SRT_CD),
          name: (x, y) => x.r.ISU_ABBRV.localeCompare(y.r.ISU_ABBRV, "ko"),
          list_date_desc: (x, y) => y.r.LIST_DD.localeCompare(x.r.LIST_DD),
          list_date_asc: (x, y) => x.r.LIST_DD.localeCompare(y.r.LIST_DD),
          list_shares: (x, y) => (toNum(y.r.LIST_SHRS) || 0) - (toNum(x.r.LIST_SHRS) || 0),
        };
        rows.sort(sorters[a.sort]);

        const missing = a.codes && a.codes.length ? a.codes.filter((cd) => !rows.some(({ r }) => r.ISU_SRT_CD === cd)) : [];
        const render = ({ r, c }) => {
          if (a.fields === "all")
            return {
              ...convertRow("base", r),
              분류: { 보통주: c.common, 영업회사: c.operating, 스팩: c.spac, 리츠: c.reit, 인프라펀드: c.infra, 투자회사: c.investco, 외국주권: c.foreign, 주식예탁증권: c.dr },
            };
          return {
            종목코드: r.ISU_SRT_CD,
            종목명: r.ISU_NM,
            종목약명: r.ISU_ABBRV,
            시장: r.MKT_TP_NM,
            증권구분: r.SECUGRP_NM,
            소속부: r.SECT_TP_NM || null,
            주식종류: r.KIND_STKCERT_TP_NM,
            상장일: dashed(r.LIST_DD),
            상장주식수: toNum(r.LIST_SHRS),
            영업회사: c.operating,
          };
        };
        const out = {
          사용기준일: used,
          요청기준일: bas ? dashed(bas) : "(생략 — 최근 영업일)",
          시장별집계: summary,
          집계규칙: COUNT_RULE,
          ...(notes.length ? { 안내: [...new Set(notes)] } : {}),
        };
        const filtered = rows.length;
        out.필터결과건수 = filtered;
        if (missing.length) out.미발견코드 = missing;
        if (!a.summary_only) {
          const p = page(rows, a.offset, a.limit, render);
          Object.assign(out, p.info);
          out.종목 = p.rows;
        }
        out.요약 = meta(meter);
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  // ── 2. 주식 일별 시세 ──────────────────────────────────────────────────────
  server.registerTool(
    "krx_get_stock_daily",
    {
      title: "주식 일별 시세·시가총액 (유가증권·코스닥·코넥스)",
      description:
        "하루치 주식 시세를 돌려준다: 종가·대비·등락률·시가·고가·저가·거래량·거래대금·시가총액·상장주식수. " +
        "종목코드·종목명 검색, 정렬·상위 N, 시장별 합계(종목수·상승/하락/보합·시가총액·거래대금)를 제공한다. " +
        "with_base_info=true(또는 common_only/operating_only/exclude 지정)면 같은 날 종목기본정보를 붙여 주식종류·증권구분·상장일을 더하고, " +
        "보통주만·영업 회사만의 시가총액 합계처럼 회사 단위로 집계할 수 있다(호출 1건 추가). " +
        "종가는 수정주가가 아니다. 여러 날의 추이는 krx_get_timeseries.",
      inputSchema: {
        market: z.enum(["KOSPI", "KOSDAQ", "KONEX", "ALL"]).default("ALL").describe("시장. ALL이면 3시장(호출 3건)"),
        bas_dd: dateArg(commonDateDesc),
        exact: bool(false).describe(exactDesc),
        codes: strList().describe("종목코드(6자리) 목록. 정확히 일치"),
        query: z.string().optional().describe("종목명 부분일치(공백 무시)"),
        sect: z.string().optional().describe("소속부 부분일치(코스닥·코넥스만 값이 있음)"),
        with_base_info: bool(false).describe("종목기본정보(주식종류·증권구분·상장일)를 붙인다"),
        common_only: bool(false).describe("보통주만(기본정보 자동 결합)"),
        operating_only: bool(false).describe("영업 회사만(기본정보 자동 결합)"),
        exclude: strList().describe(`뺄 분류(기본정보 자동 결합): ${EXCLUDE_KEYS.join(", ")}`),
        sort: z
          .enum(["mktcap", "trdval", "trdvol", "fluc_rt", "fluc_rt_asc", "close", "code"])
          .default("mktcap")
          .describe("정렬: 시가총액·거래대금·거래량·등락률(내림/오름)·종가·코드"),
        summary_only: bool(false).describe("true면 시장별 합계만"),
        limit: num(1, 2000, 50).describe("반환 행 수(기본 50 = 상위 50)"),
        offset: num(0, 100000, 0),
      },
    },
    async (a) => {
      const meter = new Meter();
      try {
        const bas = normalizeDate(a.bas_dd);
        const ex = new Set((a.exclude || []).map((x) => x.toLowerCase()));
        for (const x of ex) if (!EXCLUDE_KEYS.includes(x)) throw new Error(`exclude 값 "${x}"는 지원하지 않습니다. 가능: ${EXCLUDE_KEYS.join(", ")}`);
        const needBase = a.with_base_info || a.common_only || a.operating_only || ex.size > 0;
        const mkts = marketList(a.market);
        const res = await fetchMany(mkts.map((m) => `${m}_STOCK`), bas, meter, { exact: a.exact });
        const used = {};
        const notes = [];
        const summary = {};
        let rows = [];
        for (const m of mkts) {
          const r = res[`${m}_STOCK`];
          if (r.error) {
            summary[m] = { 오류: r.error };
            continue;
          }
          used[m] = dashed(r.usedDate);
          notes.push(...r.notes);
          let base = null;
          if (needBase) {
            const b = await fetchRaw(`${m}_BASE`, r.usedDate, meter);
            base = new Map(b.map((x) => [x.ISU_SRT_CD, x]));
            if (!b.length) notes.push(`${m} 종목기본정보가 ${dashed(r.usedDate)}에 비어 있어 결합하지 못했습니다.`);
          }
          const mrows = r.rows.map((x) => {
            const b = base ? base.get(x.ISU_CD) : null;
            return { r: x, b, c: b ? classify(b) : null };
          });
          const s = (list) => ({
            종목수: list.length,
            상승: list.filter(({ r }) => toNum(r.CMPPREVDD_PRC) > 0).length,
            하락: list.filter(({ r }) => toNum(r.CMPPREVDD_PRC) < 0).length,
            보합: list.filter(({ r }) => toNum(r.CMPPREVDD_PRC) === 0).length,
            거래량0: list.filter(({ r }) => toNum(r.ACC_TRDVOL) === 0).length,
            시가총액합계: sum(list.map(({ r }) => r), "MKTCAP"),
            거래대금합계: sum(list.map(({ r }) => r), "ACC_TRDVAL"),
          });
          summary[m] = s(mrows);
          if (base) {
            summary[m].보통주만 = s(mrows.filter(({ c }) => c && c.common));
            summary[m].영업회사만 = s(mrows.filter(({ c }) => c && c.operating));
            const nob = mrows.filter(({ b }) => !b).length;
            if (nob) summary[m].기본정보미결합 = nob;
          }
          rows.push(...mrows);
        }
        if (a.codes && a.codes.length) {
          const set = new Set(a.codes);
          rows = rows.filter(({ r }) => set.has(r.ISU_CD));
        }
        if (a.query) rows = rows.filter(({ r }) => contains(r.ISU_NM, a.query) || contains(r.ISU_CD, a.query));
        if (a.sect) rows = rows.filter(({ r }) => contains(r.SECT_TP_NM, a.sect));
        if (a.common_only) rows = rows.filter(({ c }) => c && c.common);
        if (a.operating_only) rows = rows.filter(({ c }) => c && c.operating);
        for (const x of ex) rows = rows.filter(({ c }) => c && !c[x]);
        const so = {
          mktcap: sortDesc("MKTCAP"),
          trdval: sortDesc("ACC_TRDVAL"),
          trdvol: sortDesc("ACC_TRDVOL"),
          fluc_rt: sortDesc("FLUC_RT"),
          fluc_rt_asc: sortAsc("FLUC_RT"),
          close: sortDesc("TDD_CLSPRC"),
          code: (x, y) => x.ISU_CD.localeCompare(y.ISU_CD),
        }[a.sort];
        rows.sort((x, y) => so(x.r, y.r));
        const missing = a.codes && a.codes.length ? a.codes.filter((cd) => !rows.some(({ r }) => r.ISU_CD === cd)) : [];
        const render = ({ r, b, c }) => {
          const o = convertRow("stock", r);
          delete o.기준일;
          if (b) {
            o.주식종류 = b.KIND_STKCERT_TP_NM;
            o.증권구분 = b.SECUGRP_NM;
            o.상장일 = dashed(b.LIST_DD);
            o.영업회사 = c.operating;
          }
          return o;
        };
        const out = {
          사용기준일: used,
          요청기준일: bas ? dashed(bas) : "(생략 — 최근 영업일)",
          시장별합계: summary,
          단위: UNIT_NOTE.stock,
          ...(needBase ? { 집계규칙: COUNT_RULE } : {}),
          ...(notes.length ? { 안내: [...new Set(notes)] } : {}),
          필터결과건수: rows.length,
          ...(missing.length ? { 미발견코드: missing, 미발견안내: "해당 날짜에 그 시장에서 거래 자료가 없는 코드입니다(상장 전·상장폐지·다른 시장·ETF 등). 시장을 ALL로 두었는지, ETF라면 krx_get_etf_daily를 확인하세요." } : {}),
        };
        if (!a.summary_only) {
          const p = page(rows, a.offset, a.limit, render);
          Object.assign(out, p.info);
          out.종목 = p.rows;
        }
        out.요약 = meta(meter);
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  // ── 3. 지수 ───────────────────────────────────────────────────────────────
  server.registerTool(
    "krx_get_index_daily",
    {
      title: "지수 일별 시세 (KRX·KOSPI·KOSDAQ 시리즈, 채권지수)",
      description:
        "하루치 지수 시세. series: KRX(KRX 시리즈 — 코리아 밸류업·KRX 300 등), KOSPI(코스피·코스피200·업종지수 등), " +
        "KOSDAQ(코스닥·코스닥150·업종지수 등), BOND(채권지수 — KRX 채권지수·KTB 지수·국고채프라임지수; 총수익·순가격·시장가격지수, 평균수익률·듀레이션), ALL. " +
        "주가지수 필드: 계열구분·지수명·종가·대비·등락률·시가·고가·저가·거래량·거래대금·상장시가총액. " +
        "'코스피 (외국주포함)'처럼 지수값이 비어 있는 행이 있다(null로 표시, 시가총액·거래대금은 있음). 지수 추이는 krx_get_timeseries.",
      inputSchema: {
        series: z.enum(["KRX", "KOSPI", "KOSDAQ", "BOND", "ALL"]).default("ALL").describe("지수 계열"),
        bas_dd: dateArg(commonDateDesc),
        exact: bool(false).describe(exactDesc),
        query: z.string().optional().describe("지수명 부분일치(공백 무시). 예: 코스피 200, 밸류업, 코스닥 150"),
      },
    },
    async (a) => {
      const meter = new Meter();
      try {
        const bas = normalizeDate(a.bas_dd);
        const keys = a.series === "ALL" ? ["INDEX_KOSPI", "INDEX_KOSDAQ", "INDEX_KRX", "INDEX_BOND"] : [`INDEX_${a.series}`];
        const res = await fetchMany(keys, bas, meter, { exact: a.exact });
        const out = { 요청기준일: bas ? dashed(bas) : "(생략 — 최근 영업일)", 사용기준일: {}, 단위: { 주가지수: UNIT_NOTE.index, 채권지수: UNIT_NOTE.bondindex } };
        const notes = [];
        for (const k of keys) {
          const r = res[k];
          const name = DATASETS[k].label;
          if (r.error) {
            out[name] = { 오류: r.error };
            continue;
          }
          out.사용기준일[DATASETS[k].market] = dashed(r.usedDate);
          notes.push(...r.notes);
          let rows = r.rows;
          if (a.query) rows = rows.filter((x) => contains(x.IDX_NM || x.BND_IDX_GRP_NM, a.query));
          const type = DATASETS[k].type;
          out[name] = {
            전체건수: r.rows.length,
            반환건수: rows.length,
            지수: rows.map((x) => {
              const o = convertRow(type, x);
              delete o.기준일;
              return o;
            }),
          };
        }
        if (notes.length) out.안내 = [...new Set(notes)];
        out.요약 = meta(meter);
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  // ── 4. ETF ────────────────────────────────────────────────────────────────
  server.registerTool(
    "krx_get_etf_daily",
    {
      title: "ETF 일별 시세 (NAV·순자산·기초지수)",
      description:
        "하루치 ETF 시세: 종가·대비·등락률·NAV·시가·고가·저가·거래량·거래대금·시가총액·순자산총액·상장좌수·기초지수명·기초지수종가·기초지수대비·기초지수등락률. " +
        "종목명 또는 기초지수명 검색, 정렬·상위 N, 합계(ETF 수·순자산·거래대금)를 제공한다. 전체 원문이 약 560KB라 기본은 상위 50건만 담는다.",
      inputSchema: {
        bas_dd: dateArg(commonDateDesc),
        exact: bool(false).describe(exactDesc),
        codes: strList().describe("종목코드(6자리) 목록"),
        query: z.string().optional().describe("종목명 부분일치(공백 무시). 예: 200, 반도체, TIGER"),
        index_query: z.string().optional().describe("기초지수명 부분일치. 예: 코스피 200, S&P 500"),
        sort: z.enum(["netasset", "mktcap", "trdval", "trdvol", "fluc_rt", "fluc_rt_asc", "code"]).default("netasset").describe("정렬(기본 순자산총액 내림차순)"),
        summary_only: bool(false),
        fields: z.enum(["basic", "all"]).default("basic").describe("basic: 주요 필드만, all: 전 필드"),
        limit: num(1, 2000, 50),
        offset: num(0, 100000, 0),
      },
    },
    async (a) => {
      const meter = new Meter();
      try {
        const bas = normalizeDate(a.bas_dd);
        const r = await fetchWithFallback("ETF", bas, meter, { exact: a.exact });
        let rows = r.rows;
        if (a.codes && a.codes.length) {
          const set = new Set(a.codes);
          rows = rows.filter((x) => set.has(x.ISU_CD));
        }
        if (a.query) rows = rows.filter((x) => contains(x.ISU_NM, a.query) || contains(x.ISU_CD, a.query));
        if (a.index_query) rows = rows.filter((x) => contains(x.IDX_IND_NM, a.index_query));
        const so = {
          netasset: sortDesc("INVSTASST_NETASST_TOTAMT"),
          mktcap: sortDesc("MKTCAP"),
          trdval: sortDesc("ACC_TRDVAL"),
          trdvol: sortDesc("ACC_TRDVOL"),
          fluc_rt: sortDesc("FLUC_RT"),
          fluc_rt_asc: sortAsc("FLUC_RT"),
          code: (x, y) => x.ISU_CD.localeCompare(y.ISU_CD),
        }[a.sort];
        rows = [...rows].sort(so);
        const basicF = ["ISU_CD", "ISU_NM", ...BASIC_FIELDS.etf, "IDX_IND_NM"];
        const render = (x) => {
          const o = convertRow("etf", x, a.fields === "all" ? undefined : basicF);
          delete o.기준일;
          return o;
        };
        const out = {
          ...dateInfo(r),
          ...(r.notes.length ? { 안내: r.notes } : {}),
          단위: UNIT_NOTE.etf,
          합계_전체: { ETF수: r.rows.length, 순자산총액합계: sum(r.rows, "INVSTASST_NETASST_TOTAMT"), 거래대금합계: sum(r.rows, "ACC_TRDVAL"), 시가총액합계: sum(r.rows, "MKTCAP") },
          필터결과건수: rows.length,
        };
        if (rows.length !== r.rows.length) out.합계_필터 = { ETF수: rows.length, 순자산총액합계: sum(rows, "INVSTASST_NETASST_TOTAMT"), 거래대금합계: sum(rows, "ACC_TRDVAL") };
        if (a.codes && a.codes.length) {
          const miss = a.codes.filter((cd) => !rows.some((x) => x.ISU_CD === cd));
          if (miss.length) out.미발견코드 = miss;
        }
        if (!a.summary_only) {
          const p = page(rows, a.offset, a.limit, render);
          Object.assign(out, p.info);
          out.ETF = p.rows;
        }
        out.요약 = meta(meter);
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  // ── 5. 채권 ───────────────────────────────────────────────────────────────
  server.registerTool(
    "krx_get_bond_daily",
    {
      title: "채권 일별 시세 (국채전문유통·일반채권·소액채권)",
      description:
        "하루치 장내 채권 시세: 종가·대비·종가수익률·시가/고가/저가와 각 수익률·거래량·거래대금. " +
        "market: KTS(국채전문유통시장 — 지표/비지표, 만기년수 포함), GENERAL(일반채권시장 — 국민주택채권·회사채 등), SMALL(소액채권시장), ALL. " +
        "종목명·코드 검색, 거래대금 순 정렬을 제공한다. 가격은 액면 10,000원 기준이다.",
      inputSchema: {
        market: z.enum(["KTS", "GENERAL", "SMALL", "ALL"]).default("ALL"),
        bas_dd: dateArg(commonDateDesc),
        exact: bool(false).describe(exactDesc),
        codes: strList().describe("표준코드(12자리) 목록"),
        query: z.string().optional().describe("종목명 부분일치. 예: 국고, 국민주택1종, 26-09"),
        sort: z.enum(["trdval", "trdvol", "yield", "yield_asc", "code"]).default("trdval"),
        limit: num(1, 2000, 100),
        offset: num(0, 100000, 0),
      },
    },
    async (a) => {
      const meter = new Meter();
      try {
        const bas = normalizeDate(a.bas_dd);
        const keys = a.market === "ALL" ? ["BOND_KTS", "BOND_GENERAL", "BOND_SMALL"] : [`BOND_${a.market}`];
        const res = await fetchMany(keys, bas, meter, { exact: a.exact });
        const used = {};
        const notes = [];
        const summary = {};
        let rows = [];
        for (const k of keys) {
          const r = res[k];
          if (r.error) {
            summary[DATASETS[k].label] = { 오류: r.error };
            continue;
          }
          used[DATASETS[k].label] = dashed(r.usedDate);
          notes.push(...r.notes);
          summary[DATASETS[k].label] = { 종목수: r.rows.length, 거래대금합계: sum(r.rows, "ACC_TRDVAL"), 거래량합계: sum(r.rows, "ACC_TRDVOL") };
          rows.push(...r.rows);
        }
        if (a.codes && a.codes.length) {
          const set = new Set(a.codes);
          rows = rows.filter((x) => set.has(x.ISU_CD));
        }
        if (a.query) rows = rows.filter((x) => contains(x.ISU_NM, a.query) || contains(x.ISU_CD, a.query));
        const so = {
          trdval: sortDesc("ACC_TRDVAL"),
          trdvol: sortDesc("ACC_TRDVOL"),
          yield: sortDesc("CLSPRC_YD"),
          yield_asc: sortAsc("CLSPRC_YD"),
          code: (x, y) => x.ISU_CD.localeCompare(y.ISU_CD),
        }[a.sort];
        rows.sort(so);
        const out = { 사용기준일: used, 요청기준일: bas ? dashed(bas) : "(생략 — 최근 영업일)", 시장별합계: summary, 단위: UNIT_NOTE.bond, ...(notes.length ? { 안내: [...new Set(notes)] } : {}) };
        const p = page(rows, a.offset, a.limit, (x) => {
          const o = convertRow("bond", x);
          delete o.기준일;
          return o;
        });
        Object.assign(out, p.info);
        out.채권 = p.rows;
        out.요약 = meta(meter);
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  // ── 6. 일반상품 ───────────────────────────────────────────────────────────
  server.registerTool(
    "krx_get_commodity_daily",
    {
      title: "일반상품 일별 시세 (석유·금·배출권)",
      description:
        "하루치 KRX 일반상품시장 시세. OIL(석유시장 — 휘발유·경유·등유, 경쟁/협의매매 가중평균가격, 2012-03-30부터), " +
        "GOLD(금시장 — 금 99.99 1kg·미니금 100g, 2014-03-24부터), EMISSION(배출권시장 — KAU·KCU·KOC 등, 2015-01-12부터), ALL. 행 수가 적어 전부 돌려준다.",
      inputSchema: {
        market: z.enum(["OIL", "GOLD", "EMISSION", "ALL"]).default("ALL"),
        bas_dd: dateArg(commonDateDesc),
        exact: bool(false).describe(exactDesc),
        query: z.string().optional().describe("종목명·유종 부분일치. 예: KAU26, 미니금, 경유"),
      },
    },
    async (a) => {
      const meter = new Meter();
      try {
        const bas = normalizeDate(a.bas_dd);
        const keys = a.market === "ALL" ? ["GOLD", "EMISSION", "OIL"] : [a.market];
        const res = await fetchMany(keys, bas, meter, { exact: a.exact });
        const out = { 요청기준일: bas ? dashed(bas) : "(생략 — 최근 영업일)", 사용기준일: {}, 단위: { 석유: UNIT_NOTE.oil, "금·배출권": UNIT_NOTE.commodity } };
        const notes = [];
        for (const k of keys) {
          const r = res[k];
          const name = DATASETS[k].label;
          if (r.error) {
            out[name] = { 오류: r.error };
            continue;
          }
          out.사용기준일[name] = dashed(r.usedDate);
          notes.push(...r.notes);
          let rows = r.rows;
          if (a.query) rows = rows.filter((x) => contains(x.ISU_NM || x.OIL_NM, a.query));
          out[name] = rows.map((x) => {
            const o = convertRow(DATASETS[k].type, x);
            delete o.기준일;
            return o;
          });
        }
        if (notes.length) out.안내 = [...new Set(notes)];
        out.요약 = meta(meter);
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  // ── 7. 기간 시계열 ────────────────────────────────────────────────────────
  server.registerTool(
    "krx_get_timeseries",
    {
      title: "기간 시계열 (주식·지수·ETF·채권·일반상품 공통)",
      description:
        "KRX API는 하루치 전체만 주므로, 기간을 날짜별로 조회해 지정한 종목·지수만 뽑아 시계열로 만든다. 날짜 하나가 KRX 호출 1건이다(일일 한도 10,000건, 계정 공유). " +
        "interval=day는 평일마다 1건, week는 주마다 그 주 마지막 영업일 1건, month는 월마다 그 달 마지막 영업일 1건(휴장이면 그 기간 안에서 거슬러 추가 호출). " +
        "예상 호출 수가 max_calls를 넘으면 실행하지 않고 간격·기간 조정을 안내한다. 응답 시간 상한(약 100초)에 걸리면 받은 데까지 돌려주고 잘렸다고 표시한다. " +
        "dataset: " +
        SERIES_DATASETS.map((k) => `${k}(${DATASETS[k].label}, ${dashed(DATASETS[k].since)}~)`).join(", ") +
        ". items는 종목코드(주식·ETF 6자리, 채권 12자리, 금·배출권 8자리) 또는 정확한 이름(지수명·유종·종목명). " +
        "기간변화율은 첫 관측과 마지막 관측의 종가(채권지수는 총수익지수, 석유는 협의 가중평균가격) 비교이며, 주식 종가는 수정주가가 아니다.",
      inputSchema: {
        dataset: z.enum(SERIES_DATASETS).describe("데이터셋"),
        items: strList().describe("종목코드 또는 이름 목록(최대 20개). 예: [\"005930\",\"000660\"], [\"코스피\",\"코스닥 150\"]"),
        from: z.string().describe("시작일 YYYYMMDD 또는 YYYY-MM-DD"),
        to: dateArg("종료일(기본 오늘 — 당일 자료는 아직 없으므로 사실상 전 영업일까지)"),
        interval: z.enum(["day", "week", "month"]).default("day"),
        fields: z.enum(["basic", "all"]).default("basic").describe("basic: 데이터셋별 주요 필드, all: 전 필드"),
        max_calls: num(1, 400, 130).describe("예상 KRX 호출 수 상한(기본 130 ≈ 6개월 일별, 최대 400)"),
      },
    },
    async (a) => {
      const meter = new Meter();
      const t0 = Date.now();
      try {
        const ds = DATASETS[a.dataset];
        const items = a.items || [];
        if (!items.length) throw new Error("items가 비어 있습니다.");
        if (items.length > 20) throw new Error(`items는 최대 20개입니다(받은 수 ${items.length}).`);
        let from = normalizeDate(a.from, "from");
        if (!from) throw new Error("from이 필요합니다.");
        const today = todayKst();
        let to = normalizeDate(a.to, "to") || today;
        if (to > today) to = today;
        if (from > to) throw new Error(`from(${dashed(from)})이 to(${dashed(to)})보다 늦습니다.`);
        const notes = [];
        if (from < ds.since) {
          notes.push(`${ds.label}은 ${dashed(ds.since)}부터 제공되어 시작일을 그날로 당겼습니다.`);
          from = ds.since;
        }
        // 기간(period) 목록 만들기 — 각 기간은 '시도할 날짜들'(최근 날짜부터)
        const periods = [];
        const byKey = new Map();
        for (let d = from; d <= to; d = addDays(d, 1)) {
          if (isWeekend(d)) continue;
          let key = d;
          if (a.interval === "week") {
            const dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
            const dow = (dt.getUTCDay() + 6) % 7; // 월=0
            key = addDays(d, -dow); // 그 주 월요일
          } else if (a.interval === "month") key = d.slice(0, 6);
          if (!byKey.has(key)) {
            byKey.set(key, []);
            periods.push(key);
          }
          byKey.get(key).push(d);
        }
        const est = periods.length;
        if (est > a.max_calls) {
          return ok({
            실행안함: true,
            사유: `예상 KRX 호출 수 ${est}건이 max_calls(${a.max_calls})를 넘습니다.`,
            제안: [
              a.interval === "day" ? "interval=week(주말 기준) 또는 month(월말 기준)로 바꾸면 호출 수가 1/5, 1/20 수준으로 줄어듭니다." : "기간을 나눠 여러 번 조회하세요.",
              "꼭 필요하면 max_calls를 늘리세요(최대 400). 일일 한도 10,000건은 다른 대화와 공유합니다.",
            ],
            기간: `${dashed(from)} ~ ${dashed(to)}`,
            간격: a.interval,
          });
        }
        const wanted = items.map((x) => ({ q: x, nq: norm(x) }));
        const fields = a.fields === "all" ? null : BASIC_FIELDS[ds.type];
        const series = new Map(wanted.map((w) => [w.q, { 항목: w.q, 매칭: null, 시계열: [] }]));
        const empty = [];
        let timedOut = false;
        const HARD_CALLS = a.max_calls + 60;
        const results = await mapLimit(periods, 6, async (pk) => {
          const cands = [...byKey.get(pk)].reverse(); // 기간 안에서 최근 날짜부터
          for (const d of cands) {
            if (Date.now() - t0 > 100000 || meter.calls >= HARD_CALLS) {
              timedOut = true;
              return { pk, none: true, aborted: true };
            }
            const rows = await fetchRaw(a.dataset, d, meter, { cache: false });
            if (rows.length) return { pk, d, rows };
          }
          return { pk, none: true };
        });
        const ambiguous = {};
        for (const res of results) {
          if (res.none) {
            if (!res.aborted) empty.push(a.interval === "day" ? dashed(res.pk) : res.pk);
            continue;
          }
          for (const w of wanted) {
            const hits = res.rows.filter((r) => ID_FIELDS.some((f) => r[f] && norm(r[f]) === w.nq));
            if (!hits.length) continue;
            if (hits.length > 1) ambiguous[w.q] = hits.map((h) => `${h.IDX_CLSS ? h.IDX_CLSS + ":" : ""}${rowName(h)}(${rowId(h)})`).slice(0, 5);
            const h = hits[0];
            const s = series.get(w.q);
            if (!s.매칭) s.매칭 = { 코드: h.ISU_CD || null, 이름: rowName(h) };
            const o = { 기준일: dashed(res.d), ...convertRow(ds.type, h, fields || undefined) };
            delete o.종목코드;
            delete o.종목명;
            delete o.지수명;
            delete o.유종;
            s.시계열.push(o);
          }
        }
        const pf = PRICE_FIELD[ds.type];
        const priceLabel = labelOf(ds.type, pf);
        const outSeries = [];
        const notFound = [];
        for (const s of series.values()) {
          s.시계열.sort((x, y) => x.기준일.localeCompare(y.기준일));
          if (!s.시계열.length) {
            notFound.push(s.항목);
            continue;
          }
          const first = s.시계열.find((x) => typeof x[priceLabel] === "number" && x[priceLabel] !== 0);
          const last = [...s.시계열].reverse().find((x) => typeof x[priceLabel] === "number" && x[priceLabel] !== 0);
          outSeries.push({
            항목: s.항목,
            ...s.매칭,
            관측수: s.시계열.length,
            처음: s.시계열[0].기준일,
            마지막: s.시계열[s.시계열.length - 1].기준일,
            ...(first && last && first !== last
              ? { [`기간변화율_${priceLabel}(%)`]: Math.round(((last[priceLabel] / first[priceLabel]) - 1) * 10000) / 100, 변화율기준: `${first.기준일} ${first[priceLabel]} → ${last.기준일} ${last[priceLabel]}` }
              : {}),
            시계열: s.시계열,
          });
        }
        const out = {
          데이터셋: `${a.dataset} (${ds.label})`,
          기간: `${dashed(from)} ~ ${dashed(to)}`,
          간격: a.interval,
          단위: UNIT_NOTE[ds.type],
          ...(notes.length ? { 안내: notes } : {}),
          ...(timedOut
            ? { 잘림: true, 잘림사유: `응답 시간·호출 상한에 걸려 ${results.filter((r) => !r.aborted).length}/${periods.length}개 기간만 조회했습니다.`, 다음호출: "기간을 나누거나 interval을 넓혀 다시 조회하세요." }
            : { 잘림: false }),
          ...(notFound.length ? { 미발견항목: notFound, 미발견안내: "기간 내 어느 날에도 코드·이름이 정확히 일치하는 행이 없습니다. 이름은 공백 무시 완전일치이므로 krx_get_index_daily 등으로 정확한 이름을 먼저 확인하세요." } : {}),
          ...(Object.keys(ambiguous).length ? { 중복매칭: ambiguous, 중복안내: "같은 이름이 여러 행에 있어 첫 행을 썼습니다. 코드로 지정하세요." } : {}),
          자료없는기간: empty,
          시계열: outSeries,
          요약: meta(meter, { 조회기간수: periods.length, 소요초: Math.round((Date.now() - t0) / 100) / 10 }),
        };
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  // ── 8. 상태 ───────────────────────────────────────────────────────────────
  server.registerTool(
    "krx_api_status",
    {
      title: "서버 상태·데이터셋 안내",
      description:
        "서버 설정 상태(KRX_AUTH_KEY 설정 여부 — 값은 반환하지 않음), 데이터셋별 KRX API 경로·제공 시작일·담당 도구, 미승인 API 목록, 캐시 상태를 돌려준다. " +
        "live_check=true면 17개 API를 최근 영업일로 실제 호출해 승인·키 상태와 행 수를 확인한다(호출 17건 이상).",
      inputSchema: {
        live_check: bool(false).describe("true면 전 API를 실제로 호출해 점검"),
      },
    },
    async (a) => {
      const meter = new Meter();
      try {
        const tool = {
          base: "krx_list_listed",
          stock: "krx_get_stock_daily",
          index: "krx_get_index_daily",
          bondindex: "krx_get_index_daily",
          etf: "krx_get_etf_daily",
          bond: "krx_get_bond_daily",
          oil: "krx_get_commodity_daily",
          commodity: "krx_get_commodity_daily",
        };
        const list = Object.entries(DATASETS).map(([k, d]) => ({
          데이터셋: k,
          API: `${d.cat}/${d.api}`,
          설명: d.label,
          제공시작일: dashed(d.since),
          도구: tool[d.type] + (d.type !== "base" ? " · krx_get_timeseries" : ""),
        }));
        const out = {
          서버: { 이름: "krx-market-mcp", 버전: SERVER_VERSION, KRX_AUTH_KEY_설정됨: keyConfigured(), 오늘_KST: dashed(todayKst()) },
          이용조건: "KRX 정보데이터시스템 이용현황 화면 기준: API별 개별 승인, 이용기간 2026-06-26 ~ 2027-06-25, 하루 10,000건(계정 공유)",
          휴장일처리: "휴장일·당일·형식 오류 날짜는 KRX가 오류 없이 빈 배열을 준다. 서버는 날짜 형식을 먼저 검사하고, 빈 배열이면 최대 10일 거슬러 조회한 뒤 사용기준일을 표시한다",
          데이터셋: list,
          미승인API: { 설명: "2026-10-07 호출 시 401 Unauthorized API Call — 미승인 또는 API명 불일치. 필요하면 KRX 정보데이터시스템에서 이용신청", 목록: UNAPPROVED_APIS },
          캐시: cacheStats(),
        };
        if (a.live_check) {
          const keys = Object.keys(DATASETS);
          const anchorRes = await fetchWithFallback("KOSPI_STOCK", null, meter);
          const anchor = anchorRes.usedDate;
          out.점검기준일 = dashed(anchor);
          out.점검 = await mapLimit(keys, 4, async (k) => {
            try {
              const r = await fetchWithFallback(k, anchor, meter, { maxBack: 6 });
              return { 데이터셋: k, 상태: "정상", 사용일: dashed(r.usedDate), 행수: r.rows.length };
            } catch (e) {
              return { 데이터셋: k, 상태: e.code || "오류", 메시지: e.message };
            }
          });
          out.점검요약 = { 정상: out.점검.filter((x) => x.상태 === "정상").length, 전체: keys.length };
        }
        out.요약 = meta(meter);
        return ok(out);
      } catch (e) {
        return fail(e, meter);
      }
    }
  );

  return server;
}
