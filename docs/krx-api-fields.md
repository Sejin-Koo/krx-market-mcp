# KRX OpenAPI 필드 사전

KRX 정보데이터시스템 OpenAPI 개발명세서(22종)를 정리한 기준 문서입니다. 2026-10-07에 명세서와 실제 응답(기준일 2026-10-06)을 코드로 대조했고, 승인된 17종은 응답 필드 목록이 명세서와 완전히 같았습니다.

- 공통 요청: 모든 API가 `basDd`(기준일자, YYYYMMDD) 하나만 받습니다. 인증은 헤더 `AUTH_KEY`.
- 모든 응답 값은 문자열입니다. 서버는 코드·이름·날짜를 제외하고 숫자로 변환합니다.
- "서버 라벨"은 이 MCP 서버 응답에서 쓰는 키입니다. 명세서 Description을 따르되 짧게 줄인 곳이 있습니다(예: 기준일자→기준일, 종가_가격→종가).
- 명세서에는 단위가 없습니다. 서버의 단위 안내는 값을 보고 판단한 것입니다.

## 목록

| API | 명세서 이름 | 제공 시작(명세서) | 상태 | 서버 데이터셋 |
|---|---|---|---|---|
| `sto/stk_isu_base_info` | 유가증권 종목기본정보 | 2010-01-04 | 승인 | KOSPI_BASE |
| `sto/ksq_isu_base_info` | 코스닥 종목기본정보 | 2010-01-04 | 승인 | KOSDAQ_BASE |
| `sto/knx_isu_base_info` | 코넥스 종목기본정보 | 2013-07-01 | 승인 | KONEX_BASE |
| `sto/stk_bydd_trd` | 유가증권 일별매매정보 | 2010-01-04 | 승인 | KOSPI_STOCK |
| `sto/ksq_bydd_trd` | 코스닥 일별매매정보 | 2010-01-04 | 승인 | KOSDAQ_STOCK |
| `sto/knx_bydd_trd` | 코넥스 일별매매정보 | 2013-07-01 | 승인 | KONEX_STOCK |
| `idx/krx_dd_trd` | KRX 시리즈 일별시세정보 | 2010-01-04 | 승인 | INDEX_KRX |
| `idx/kospi_dd_trd` | KOSPI 시리즈 일별시세정보 | 2010-01-04 | 승인 | INDEX_KOSPI |
| `idx/kosdaq_dd_trd` | KOSDAQ 시리즈 일별시세정보 | 2010-01-04 | 승인 | INDEX_KOSDAQ |
| `idx/bon_dd_trd` | 채권지수 시세정보 | 2010-01-04 | 승인 | INDEX_BOND |
| `etp/etf_bydd_trd` | ETF 일별매매정보 | 2010-01-04 | 승인 | ETF |
| `bon/kts_bydd_trd` | 국채전문유통시장 일별매매정보 | 2010-01-04 | 승인 | BOND_KTS |
| `bon/bnd_bydd_trd` | 일반채권시장 일별매매정보 | 2010-01-04 | 승인 | BOND_GENERAL |
| `bon/smb_bydd_trd` | 소액채권시장 일별매매정보 | 2010-01-04 | 승인 | BOND_SMALL |
| `gen/oil_bydd_trd` | 석유시장 일별매매정보 | 2012-03-30 | 승인 | OIL |
| `gen/gold_bydd_trd` | 금시장 일별매매정보 | 2014-03-24 | 승인 | GOLD |
| `gen/ets_bydd_trd` | 배출권 시장 일별매매정보 | 2015-01-12 | 승인 | EMISSION |
| `etp/elw_bydd_trd` | ELW 일별매매정보 | 2010-01-04 | **미승인**(401) | — |
| `etp/etn_bydd_trd` | ETN 일별매매정보 | 2014-11-17 | **미승인**(401) | — |
| `idx/drvprod_dd_trd` | 파생상품지수 시세정보 | 2010-01-04 | **미승인**(401) | — |
| `sto/sr_bydd_trd` | 신주인수권증서 일별매매정보 | 2010-02-12 | **미승인**(401) | — |
| `sto/sw_bydd_trd` | 신주인수권증권 일별매매정보 | 2010-01-04 | **미승인**(401) | — |

## 유가증권 종목기본정보 — `sto/stk_isu_base_info`

유가증권 종목기본정보 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `ISU_CD` | 표준코드 | 표준코드 |
| `ISU_SRT_CD` | 단축코드 | 종목코드 |
| `ISU_NM` | 한글 종목명 | 종목명 |
| `ISU_ABBRV` | 한글 종목약명 | 종목약명 |
| `ISU_ENG_NM` | 영문 종목명 | 영문명 |
| `LIST_DD` | 상장일 | 상장일 |
| `MKT_TP_NM` | 시장구분 | 시장 |
| `SECUGRP_NM` | 증권구분 | 증권구분 |
| `SECT_TP_NM` | 소속부 | 소속부 |
| `KIND_STKCERT_TP_NM` | 주식종류 | 주식종류 |
| `PARVAL` | 액면가 | 액면가 |
| `LIST_SHRS` | 상장주식수 | 상장주식수 |

## 코스닥 종목기본정보 — `sto/ksq_isu_base_info`

코스닥 종목기본정보 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `ISU_CD` | 표준코드 | 표준코드 |
| `ISU_SRT_CD` | 단축코드 | 종목코드 |
| `ISU_NM` | 한글 종목명 | 종목명 |
| `ISU_ABBRV` | 한글 종목약명 | 종목약명 |
| `ISU_ENG_NM` | 영문 종목명 | 영문명 |
| `LIST_DD` | 상장일 | 상장일 |
| `MKT_TP_NM` | 시장구분 | 시장 |
| `SECUGRP_NM` | 증권구분 | 증권구분 |
| `SECT_TP_NM` | 소속부 | 소속부 |
| `KIND_STKCERT_TP_NM` | 주식종류 | 주식종류 |
| `PARVAL` | 액면가 | 액면가 |
| `LIST_SHRS` | 상장주식수 | 상장주식수 |

## 코넥스 종목기본정보 — `sto/knx_isu_base_info`

코넥스 종목기본정보 ('13년07월01일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/knx_isu_base_info`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `ISU_CD` | 표준코드 | 표준코드 |
| `ISU_SRT_CD` | 단축코드 | 종목코드 |
| `ISU_NM` | 한글 종목명 | 종목명 |
| `ISU_ABBRV` | 한글 종목약명 | 종목약명 |
| `ISU_ENG_NM` | 영문 종목명 | 영문명 |
| `LIST_DD` | 상장일 | 상장일 |
| `MKT_TP_NM` | 시장구분 | 시장 |
| `SECUGRP_NM` | 증권구분 | 증권구분 |
| `SECT_TP_NM` | 소속부 | 소속부 |
| `KIND_STKCERT_TP_NM` | 주식종류 | 주식종류 |
| `PARVAL` | 액면가 | 액면가 |
| `LIST_SHRS` | 상장주식수 | 상장주식수 |

## 유가증권 일별매매정보 — `sto/stk_bydd_trd`

유가증권시장에 상장되어 있는 주권의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `MKT_NM` | 시장구분 | 시장 |
| `SECT_TP_NM` | 소속부 | 소속부 |
| `TDD_CLSPRC` | 종가 | 종가 |
| `CMPPREVDD_PRC` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `TDD_OPNPRC` | 시가 | 시가 |
| `TDD_HGPRC` | 고가 | 고가 |
| `TDD_LWPRC` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |
| `MKTCAP` | 시가총액 | 시가총액 |
| `LIST_SHRS` | 상장주식수 | 상장주식수 |

## 코스닥 일별매매정보 — `sto/ksq_bydd_trd`

코스닥시장에 상장되어 있는 주권의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `MKT_NM` | 시장구분 | 시장 |
| `SECT_TP_NM` | 소속부 | 소속부 |
| `TDD_CLSPRC` | 종가 | 종가 |
| `CMPPREVDD_PRC` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `TDD_OPNPRC` | 시가 | 시가 |
| `TDD_HGPRC` | 고가 | 고가 |
| `TDD_LWPRC` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |
| `MKTCAP` | 시가총액 | 시가총액 |
| `LIST_SHRS` | 상장주식수 | 상장주식수 |

## 코넥스 일별매매정보 — `sto/knx_bydd_trd`

코넥스시장에 상장되어 있는 주권의 매매정보 제공 ('13년07월01일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/knx_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `MKT_NM` | 시장구분 | 시장 |
| `SECT_TP_NM` | 소속부 | 소속부 |
| `TDD_CLSPRC` | 종가 | 종가 |
| `CMPPREVDD_PRC` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `TDD_OPNPRC` | 시가 | 시가 |
| `TDD_HGPRC` | 고가 | 고가 |
| `TDD_LWPRC` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |
| `MKTCAP` | 시가총액 | 시가총액 |
| `LIST_SHRS` | 상장주식수 | 상장주식수 |

## KRX 시리즈 일별시세정보 — `idx/krx_dd_trd`

KRX 시리즈 지수의 시세정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/idx/krx_dd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `IDX_CLSS` | 계열구분 | 계열구분 |
| `IDX_NM` | 지수명 | 지수명 |
| `CLSPRC_IDX` | 종가 | 종가 |
| `CMPPREVDD_IDX` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `OPNPRC_IDX` | 시가 | 시가 |
| `HGPRC_IDX` | 고가 | 고가 |
| `LWPRC_IDX` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |
| `MKTCAP` | 상장시가총액 | 상장시가총액 |

## KOSPI 시리즈 일별시세정보 — `idx/kospi_dd_trd`

KOSPI 시리즈 지수의 시세정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `IDX_CLSS` | 계열구분 | 계열구분 |
| `IDX_NM` | 지수명 | 지수명 |
| `CLSPRC_IDX` | 종가 | 종가 |
| `CMPPREVDD_IDX` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `OPNPRC_IDX` | 시가 | 시가 |
| `HGPRC_IDX` | 고가 | 고가 |
| `LWPRC_IDX` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |
| `MKTCAP` | 상장시가총액 | 상장시가총액 |

## KOSDAQ 시리즈 일별시세정보 — `idx/kosdaq_dd_trd`

KOSDAQ 시리즈 지수의 시세정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/idx/kosdaq_dd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `IDX_CLSS` | 계열구분 | 계열구분 |
| `IDX_NM` | 지수명 | 지수명 |
| `CLSPRC_IDX` | 종가 | 종가 |
| `CMPPREVDD_IDX` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `OPNPRC_IDX` | 시가 | 시가 |
| `HGPRC_IDX` | 고가 | 고가 |
| `LWPRC_IDX` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |
| `MKTCAP` | 상장시가총액 | 상장시가총액 |

## 채권지수 시세정보 — `idx/bon_dd_trd`

채권지수의 시세정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/idx/bon_dd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `BND_IDX_GRP_NM` | 지수명 | 지수명 |
| `TOT_EARNG_IDX` | 총수익지수_종가 | 총수익지수_종가 |
| `TOT_EARNG_IDX_CMPPREVDD` | 총수익지수_대비 | 총수익지수_대비 |
| `NETPRC_IDX` | 순가격지수_종가 | 순가격지수_종가 |
| `NETPRC_IDX_CMPPREVDD` | 순가격지수_대비 | 순가격지수_대비 |
| `ZERO_REINVST_IDX` | 제로재투자지수_종가 | 제로재투자지수_종가 |
| `ZERO_REINVST_IDX_CMPPREVDD` | 제로재투자지수_대비 | 제로재투자지수_대비 |
| `CALL_REINVST_IDX` | 콜재투자지수_종가 | 콜재투자지수_종가 |
| `CALL_REINVST_IDX_CMPPREVDD` | 콜재투자지수_대비 | 콜재투자지수_대비 |
| `MKT_PRC_IDX` | 시장가격지수_종가 | 시장가격지수_종가 |
| `MKT_PRC_IDX_CMPPREVDD` | 시장가격지수_대비 | 시장가격지수_대비 |
| `AVG_DURATION` | 듀레이션 | 듀레이션 |
| `AVG_CONVEXITY_PRC` | 컨벡시티 | 컨벡시티 |
| `BND_IDX_AVG_YD` | YTM | YTM |

## ETF 일별매매정보 — `etp/etf_bydd_trd`

ETF(상장지수펀드)의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `TDD_CLSPRC` | 종가 | 종가 |
| `CMPPREVDD_PRC` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `NAV` | 순자산가치(NAV) | NAV |
| `TDD_OPNPRC` | 시가 | 시가 |
| `TDD_HGPRC` | 고가 | 고가 |
| `TDD_LWPRC` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |
| `MKTCAP` | 시가총액 | 시가총액 |
| `INVSTASST_NETASST_TOTAMT` | 순자산총액 | 순자산총액 |
| `LIST_SHRS` | 상장좌수 | 상장좌수 |
| `IDX_IND_NM` | 기초지수_지수명 | 기초지수명 |
| `OBJ_STKPRC_IDX` | 기초지수_종가 | 기초지수종가 |
| `CMPPREVDD_IDX` | 기초지수_대비 | 기초지수대비 |
| `FLUC_RT_IDX` | 기초지수_등락률 | 기초지수등락률 |

## 국채전문유통시장 일별매매정보 — `bon/kts_bydd_trd`

국채전문유통시장에 상장되어있는 채권의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/bon/kts_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `MKT_NM` | 시장구분 | 시장 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `BND_EXP_TP_NM` | 만기년수 | 만기년수 |
| `GOVBND_ISU_TP_NM` | 종목구분 | 종목구분 |
| `CLSPRC` | 종가_가격 | 종가 |
| `CMPPREVDD_PRC` | 종가_대비 | 대비 |
| `CLSPRC_YD` | 종가_수익률 | 종가수익률 |
| `OPNPRC` | 시가_가격 | 시가 |
| `OPNPRC_YD` | 시가_수익률 | 시가수익률 |
| `HGPRC` | 고가_가격 | 고가 |
| `HGPRC_YD` | 고가_수익률 | 고가수익률 |
| `LWPRC` | 저가_가격 | 저가 |
| `LWPRC_YD` | 저가_수익률 | 저가수익률 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |

## 일반채권시장 일별매매정보 — `bon/bnd_bydd_trd`

일반채권시장에 상장되어있는 채권의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/bon/bnd_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `MKT_NM` | 시장구분 | 시장 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `CLSPRC` | 종가_가격 | 종가 |
| `CMPPREVDD_PRC` | 종가_대비 | 대비 |
| `CLSPRC_YD` | 종가_수익률 | 종가수익률 |
| `OPNPRC` | 시가_가격 | 시가 |
| `OPNPRC_YD` | 시가_수익률 | 시가수익률 |
| `HGPRC` | 고가_가격 | 고가 |
| `HGPRC_YD` | 고가_수익률 | 고가수익률 |
| `LWPRC` | 저가_가격 | 저가 |
| `LWPRC_YD` | 저가_수익률 | 저가수익률 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |

## 소액채권시장 일별매매정보 — `bon/smb_bydd_trd`

소액채권시장에 상장되어있는 채권의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/bon/smb_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `MKT_NM` | 시장구분 | 시장 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `CLSPRC` | 종가_가격 | 종가 |
| `CMPPREVDD_PRC` | 종가_대비 | 대비 |
| `CLSPRC_YD` | 종가_수익률 | 종가수익률 |
| `OPNPRC` | 시가_가격 | 시가 |
| `OPNPRC_YD` | 시가_수익률 | 시가수익률 |
| `HGPRC` | 고가_가격 | 고가 |
| `HGPRC_YD` | 고가_수익률 | 고가수익률 |
| `LWPRC` | 저가_가격 | 저가 |
| `LWPRC_YD` | 저가_수익률 | 저가수익률 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |

## 석유시장 일별매매정보 — `gen/oil_bydd_trd`

KRX 석유시장의 매매정보 제공 ('12년03월30일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/gen/oil_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `OIL_NM` | 유종구분 | 유종 |
| `WT_AVG_PRC` | 가중평균가격_경쟁 | 가중평균가격_경쟁 |
| `WT_DIS_AVG_PRC` | 가중평균가격_협의 | 가중평균가격_협의 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |

## 금시장 일별매매정보 — `gen/gold_bydd_trd`

KRX 금시장 매매정보 제공 ('14년03월24일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `TDD_CLSPRC` | 종가 | 종가 |
| `CMPPREVDD_PRC` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `TDD_OPNPRC` | 시가 | 시가 |
| `TDD_HGPRC` | 고가 | 고가 |
| `TDD_LWPRC` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |

## 배출권 시장 일별매매정보 — `gen/ets_bydd_trd`

KRX 탄소배출권 시장의 매매정보 제공 ('15년01월12일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/gen/ets_bydd_trd`

| 필드 | 명세서 설명 | 서버 라벨 |
|---|---|---|
| `BAS_DD` | 기준일자 | 기준일 |
| `ISU_CD` | 종목코드 | 종목코드 |
| `ISU_NM` | 종목명 | 종목명 |
| `TDD_CLSPRC` | 종가 | 종가 |
| `CMPPREVDD_PRC` | 대비 | 대비 |
| `FLUC_RT` | 등락률 | 등락률 |
| `TDD_OPNPRC` | 시가 | 시가 |
| `TDD_HGPRC` | 고가 | 고가 |
| `TDD_LWPRC` | 저가 | 저가 |
| `ACC_TRDVOL` | 거래량 | 거래량 |
| `ACC_TRDVAL` | 거래대금 | 거래대금 |

## ELW 일별매매정보 — `etp/elw_bydd_trd`

ELW(주식위런트증권)의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/etp/elw_bydd_trd` (미승인 — 도구 없음)

| 필드 | 명세서 설명 |
|---|---|
| `BAS_DD` | 기준일자 |
| `ISU_CD` | 종목코드 |
| `ISU_NM` | 종목명 |
| `TDD_CLSPRC` | 종가 |
| `CMPPREVDD_PRC` | 대비 |
| `TDD_OPNPRC` | 시가 |
| `TDD_HGPRC` | 고가 |
| `TDD_LWPRC` | 저가 |
| `ACC_TRDVOL` | 거래량 |
| `ACC_TRDVAL` | 거래대금 |
| `MKTCAP` | 시가총액 |
| `LIST_SHRS` | 상장증권수 |
| `ULY_NM` | 기초자산_자산명 |
| `ULY_PRC` | 기초자산_종가 |
| `CMPPREVDD_PRC_ULY` | 기초자산_대비 |
| `FLUC_RT_ULY` | 기초자산_등락률 |

## ETN 일별매매정보 — `etp/etn_bydd_trd`

ETN(상장지수증권)의 매매정보 제공 ('14년11월17일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/etp/etn_bydd_trd` (미승인 — 도구 없음)

| 필드 | 명세서 설명 |
|---|---|
| `BAS_DD` | 기준일자 |
| `ISU_CD` | 종목코드 |
| `ISU_NM` | 종목명 |
| `TDD_CLSPRC` | 종가 |
| `CMPPREVDD_PRC` | 대비 |
| `FLUC_RT` | 등락률 |
| `PER1SECU_INDIC_VAL` | 지표가치(IV) |
| `TDD_OPNPRC` | 시가 |
| `TDD_HGPRC` | 고가 |
| `TDD_LWPRC` | 저가 |
| `ACC_TRDVOL` | 거래량 |
| `ACC_TRDVAL` | 거래대금 |
| `MKTCAP` | 시가총액 |
| `INDIC_VAL_AMT` | 지표가치총액 |
| `LIST_SHRS` | 상장증권수 |
| `IDX_IND_NM` | 기초지수_지수명 |
| `OBJ_STKPRC_IDX` | 기초지수_종가 |
| `CMPPREVDD_IDX` | 기초지수_대비 |
| `FLUC_RT_IDX` | 기초지수_등락률 |

## 파생상품지수 시세정보 — `idx/drvprod_dd_trd`

파생상품지수의 시세정보를 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/idx/drvprod_dd_trd` (미승인 — 도구 없음)

| 필드 | 명세서 설명 |
|---|---|
| `BAS_DD` | 기준일자 |
| `IDX_CLSS` | 계열구분 |
| `IDX_NM` | 지수명 |
| `CLSPRC_IDX` | 종가 |
| `CMPPREVDD_IDX` | 대비 |
| `FLUC_RT` | 등락률 |
| `OPNPRC_IDX` | 시가 |
| `HGPRC_IDX` | 고가 |
| `LWPRC_IDX` | 저가 |

## 신주인수권증서 일별매매정보 — `sto/sr_bydd_trd`

유가증권/코스닥시장에 상장되어 있는 신주인수권증서의 매매정보 제공 ('10년02월12일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/sr_bydd_trd` (미승인 — 도구 없음)

| 필드 | 명세서 설명 |
|---|---|
| `BAS_DD` | 기준일자 |
| `MKT_NM` | 시장구분 |
| `ISU_CD` | 종목코드 |
| `ISU_NM` | 종목명 |
| `TDD_CLSPRC` | 종가 |
| `CMPPREVDD_PRC` | 대비 |
| `FLUC_RT` | 등락률 |
| `TDD_OPNPRC` | 시가 |
| `TDD_HGPRC` | 고가 |
| `TDD_LWPRC` | 저가 |
| `ACC_TRDVOL` | 거래량 |
| `ACC_TRDVAL` | 거래대금 |
| `MKTCAP` | 시가총액 |
| `LIST_SHRS` | 상장증서수 |
| `ISU_PRC` | 신주발행가 |
| `DELIST_DD` | 상장폐지일 |
| `TARSTK_ISU_SRT_CD` | 목적주권_종목코드 |
| `TARSTK_ISU_NM` | 목적주권_종목명 |
| `TARSTK_ISU_PRSNT_PRC` | 목적주권_종가 |

## 신주인수권증권 일별매매정보 — `sto/sw_bydd_trd`

유가증권/코스닥시장에 상장되어 있는 신주인수권증권의 매매정보 제공 ('10년01월04일 데이터부터 제공)

Endpoint: `https://data-dbg.krx.co.kr/svc/apis/sto/sw_bydd_trd` (미승인 — 도구 없음)

| 필드 | 명세서 설명 |
|---|---|
| `BAS_DD` | 기준일자 |
| `MKT_NM` | 시장구분 |
| `ISU_CD` | 종목코드 |
| `ISU_NM` | 종목명 |
| `TDD_CLSPRC` | 종가 |
| `CMPPREVDD_PRC` | 대비 |
| `FLUC_RT` | 등락률 |
| `TDD_OPNPRC` | 시가 |
| `TDD_HGPRC` | 고가 |
| `TDD_LWPRC` | 저가 |
| `ACC_TRDVOL` | 거래량 |
| `ACC_TRDVAL` | 거래대금 |
| `MKTCAP` | 시가총액 |
| `LIST_SHRS` | 상장증권수 |
| `EXER_PRC` | 행사가격 |
| `EXST_STRT_DD` | 존속기간_시작일 |
| `EXST_END_DD` | 존속기간_종료일 |
| `TARSTK_ISU_SRT_CD` | 목적주권_종목코드 |
| `TARSTK_ISU_NM` | 목적주권_종목명 |
| `TARSTK_ISU_PRSNT_PRC` | 목적주권_종가 |
