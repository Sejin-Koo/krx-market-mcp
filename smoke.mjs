// 실제 KRX 인증키로 모든 도구를 MCP 프로토콜 그대로(인메모리 전송) 호출하는 스모크 테스트.
//   KRX_AUTH_KEY=... node smoke.mjs [도구명 ...]
// 검증값(인계서 3-5, 기준일 2026-10-06): 코스피 942/831/805, 코스닥 1,824/1,821/1,750(스팩 71), 코넥스 107/107/107

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "./lib/server.js";

const server = buildServer();
const client = new Client({ name: "smoke", version: "0" });
const [ct, st] = InMemoryTransport.createLinkedPair();
await server.connect(st);
await client.connect(ct);

const only = new Set(process.argv.slice(2));
let totalCalls = 0;
let fails = 0;

async function call(name, args, check, label = "") {
  if (only.size && !only.has(name)) return null;
  const t0 = Date.now();
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text || "";
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* 오류 문구 */
  }
  totalCalls += body?.요약?.KRX호출수 ?? 0;
  let verdict;
  try {
    verdict = check ? check(body, text, r) : !r.isError;
  } catch (e) {
    verdict = false;
  }
  if (!verdict) fails++;
  console.log(`${verdict ? "✅" : "❌"} ${name} ${label} ${JSON.stringify(args).slice(0, 110)} (${Date.now() - t0}ms, KRX ${body?.요약?.KRX호출수 ?? "-"}건)`);
  console.log("   ", text.slice(0, 500).replace(/\s+/g, " "));
  return body;
}

const tools = await client.listTools();
console.log("도구:", tools.tools.map((t) => t.name).join(", "));

await call("krx_api_status", {}, (b) => b.서버.KRX_AUTH_KEY_설정됨 === true && b.데이터셋.length === 17);

// ── 인계서 3-5 검증값 ──
await call(
  "krx_list_listed",
  { bas_dd: "20261006", summary_only: true },
  (b) => {
    const s = b.시장별집계;
    return (
      s.KOSPI.종목수 === 942 && s.KOSPI.보통주_회사수 === 831 && s.KOSPI.영업회사수 === 805 &&
      s.KOSPI.영업회사_제외내역.리츠 === 23 && s.KOSPI.영업회사_제외내역.인프라펀드 === 2 && s.KOSPI.영업회사_제외내역.투자회사 === 1 &&
      s.KOSDAQ.종목수 === 1824 && s.KOSDAQ.보통주_회사수 === 1821 && s.KOSDAQ.영업회사수 === 1750 && s.KOSDAQ.영업회사_제외내역.스팩 === 71 &&
      s.KONEX.종목수 === 107 && s.KONEX.보통주_회사수 === 107 && s.KONEX.영업회사수 === 107 &&
      s.KOSDAQ.소속부분포_보통주["중견기업부"] === 505 && s.KOSDAQ.소속부분포_보통주["SPAC(소속부없음)"] === 66
    );
  },
  "[3-5 검증값]"
);
await call("krx_list_listed", { market: "KOSDAQ", summary_only: "true" }, (b) => b.사용기준일.KOSDAQ === "2026-10-06", "[기준일 생략→최근 영업일]");
await call("krx_get_stock_daily", { market: "KOSPI", bas_dd: "2026-10-05", summary_only: true }, (b) => b.사용기준일.KOSPI === "2026-10-02" && b.안내?.length, "[매매 휴장일 보정]");
await call("krx_list_listed", { market: "KOSPI", bas_dd: "2026-10-04", summary_only: true }, (b) => b.사용기준일.KOSPI === "2026-10-04", "[기본정보는 휴일 스냅샷 제공]");
await call("krx_list_listed", { market: "KOSDAQ", bas_dd: "20261006", query: "스팩", sect: "관리종목" }, (b) => b.필터결과건수 === 5, "[관리종목 스팩 5]");
await call("krx_list_listed", { market: "ALL", bas_dd: "20261006", operating_only: true, limit: 3, sort: "list_date_desc" }, (b) => b.필터결과건수 === 805 + 1750 + 107 && b.잘림 === true);
await call("krx_list_listed", { market: "KOSPI", bas_dd: "20100104", summary_only: true }, (b) => b.시장별집계.KOSPI.종목수 === 925, "[2010-01-04 925]");

// ── 시세 ──
await call("krx_get_stock_daily", { codes: ["005930", "000660", "263750", "999999"], bas_dd: "20261006" }, (b) => b.반환건수 === 3 && b.미발견코드[0] === "999999");
await call("krx_get_stock_daily", { market: "KOSDAQ", bas_dd: "20261006", operating_only: true, summary_only: true }, (b) => b.시장별합계.KOSDAQ.영업회사만.종목수 === 1750);
await call("krx_get_stock_daily", { market: "KOSPI", bas_dd: "20261006", sort: "trdval", limit: 3 }, (b) => b.종목.length === 3);
await call("krx_get_index_daily", { bas_dd: "20261006", query: "코스피 200" }, (b) => b["KOSPI 시리즈 일별시세정보"].반환건수 >= 1);
await call("krx_get_index_daily", { series: "ALL", bas_dd: "20261006" }, (b) => b["KRX 시리즈 일별시세정보"].전체건수 === 40 && b["채권지수 시세정보"].전체건수 === 3 && b["KOSPI 시리즈 일별시세정보"].전체건수 === 54);
await call("krx_get_etf_daily", { bas_dd: "20261006", limit: 3 }, (b) => b.합계_전체.ETF수 === 1171 && b.ETF.length === 3);
await call("krx_get_etf_daily", { bas_dd: "20261006", codes: ["069500"], fields: "all" }, (b) => b.ETF[0].상장좌수 > 0 && !("상장주식수" in b.ETF[0]), "[명세서 라벨: 상장좌수]");
await call("krx_get_index_daily", { series: "BOND", bas_dd: "20261006" }, (b) => b["채권지수 시세정보"].지수[0].YTM > 0 && b["채권지수 시세정보"].지수[0].총수익지수_종가 > 0, "[명세서 라벨: YTM·총수익지수_종가]");
await call("krx_get_index_daily", { series: "KOSPI", bas_dd: "20261006", query: "코스피 200" }, (b) => b["KOSPI 시리즈 일별시세정보"].지수[0].상장시가총액 > 0, "[명세서 라벨: 상장시가총액]");
await call("krx_get_etf_daily", { bas_dd: "20261006", index_query: "코스피 200", summary_only: true }, (b) => b.필터결과건수 > 0);
await call("krx_get_bond_daily", { market: "ALL", bas_dd: "20261006", limit: 3 }, (b) => b.전체건수 === 336);
await call("krx_get_bond_daily", { market: "KTS", bas_dd: "20261006" }, (b) => b.전체건수 === 10 && b.채권[0].만기년수 && b.채권[0].종목구분 === "지표");
await call("krx_get_commodity_daily", { bas_dd: "20261006" }, (b) => b["석유시장 일별매매정보"].length === 3 && b["금시장 일별매매정보"].length === 2 && b["배출권 시장 일별매매정보"].length === 19);

// ── 시계열 ──
await call("krx_get_timeseries", { dataset: "KOSPI_STOCK", items: "005930,000660", from: "2026-09-01", to: "2026-10-06" }, (b) => b.시계열.length === 2 && b.시계열[0].관측수 > 15);
await call("krx_get_timeseries", { dataset: "INDEX_KOSPI", items: ["코스피", "코스피 200"], from: "20250101", interval: "month" }, (b) => b.시계열.length === 2 && b.시계열[0].관측수 >= 20);
await call("krx_get_timeseries", { dataset: "GOLD", items: ["04020000"], from: "20260901", to: "20261006", interval: "week" }, (b) => b.시계열[0].관측수 >= 4);

// ── 안내 경로 ──
await call("krx_get_timeseries", { dataset: "KOSDAQ_STOCK", items: ["263750"], from: "20200101" }, (b) => b.실행안함 === true, "[과대 기간 차단]");
await call("krx_get_timeseries", { dataset: "INDEX_KOSPI", items: ["없는지수"], from: "20261001", to: "20261006" }, (b) => b.미발견항목?.[0] === "없는지수");
await call("krx_list_listed", { bas_dd: "2026/13/01" }, (b, t, r) => r.isError && /존재하지 않는|형식/.test(t), "[잘못된 날짜]");
await call("krx_list_listed", { bas_dd: "202610" }, (b, t, r) => r.isError && /형식/.test(t), "[6자리 날짜]");
await call("krx_list_listed", { market: "KONEX", bas_dd: "20120101" }, (b) => /2013-07-01부터/.test(b.시장별집계.KONEX.오류), "[제공 시작 전]");
await call("krx_get_stock_daily", { market: "KOSPI", bas_dd: "20261005", exact: true }, (b) => /자료가 없습니다/.test(b.시장별합계.KOSPI.오류), "[exact 휴장일]");
await call("krx_list_listed", { exclude: "abc" }, (b, t, r) => r.isError, "[잘못된 exclude]");
await call("krx_api_status", { live_check: true }, (b) => b.점검요약.정상 === 17, "[live_check]");

console.log(`\nKRX 호출 합계: ${totalCalls}, 실패 ${fails}건`);
process.exit(fails ? 1 : 0);
