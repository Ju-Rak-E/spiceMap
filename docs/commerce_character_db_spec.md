# 상권 성격 분류용 DB 명세서

작성일: 2026-04-28  
기준: 현재 Supabase 적재 상태 + 서울 열린데이터광장 원본 데이터셋

## 결론

현재 DB만 보면 **A) 원본 `comm_type` 확장**은 바로 어렵다. 현재 적재된 `commerce_boundary.comm_type`은 `골목상권`, `발달상권`, `전통시장`, `관광특구` 수준의 원본 상권 구분만 담고 있고, `역세권`, `대학가`, `주택가`, `오피스` 같은 세부 성격 필드는 없다.

따라서 현 시점 추천은 **B) 파생 분류 추가**다. 단, `역세권/대학가/오피스/주거`를 신뢰도 있게 만들려면 지하철역, 대학교, 집객시설, 직장인구, 상주인구, 매출/업종 구성 같은 보조 레이어가 필요하다.

## Supabase와 원본 SHP의 역할

상권 경계 데이터는 이미 Supabase의 `commerce_boundary`에 적재되어 있다. 지금 서비스가 쓰는 데이터는 이 테이블 기준으로 충분히 조회할 수 있다.

원본 SHP가 필요한 이유는 **서비스 실행 때문이 아니라, 적재 과정에서 버린 추가 컬럼이 있는지 확인하기 위해서**다. 현재 적재 로직은 SHP에서 `TRDAR_CD`, `TRDAR_CD_N`, `TRDAR_SE_1`, `geometry`만 가져온다. 만약 원본 SHP에 세부 성격 컬럼이 있었는데 이 로직에서 누락했다면 A안을 살릴 수 있고, 그런 컬럼이 없으면 A안은 폐기해야 한다.

정리하면 다음과 같다.

| 대상 | 필요 여부 | 목적 |
|---|---|---|
| Supabase `commerce_boundary` | 이미 있음 | 현재 서비스 조회와 분석 입력 |
| 원본 SHP 파일 | A안 검증 시 필요 | DB에 안 넣은 추가 컬럼 존재 여부 확인 |
| 지하철역/대학교/직장인구/집객시설 등 보조 데이터 | B안 구현 시 필요 | `commerce_character` 파생 분류 생성 |

## 공식 원본 데이터 위치

| 용도 | 서울 데이터셋 | 현재 DB 반영 상태 |
|---|---|---|
| 상권 경계/원본 상권 구분 | 서울시 상권분석서비스(영역-상권), OA-15560 | `commerce_boundary` 적재 완료 |
| 상권 생활인구 | 서울시 상권분석서비스(길단위인구-상권), OA-15568 | 현재 DB의 `living_population`은 행정동 단위 |
| 직장인구 | 서울시 상권분석서비스(직장인구-상권/상권배후지) | 현재 DB 미적재 |
| 추정매출 | 서울시 상권분석서비스(추정매출-상권), OA-15572 | 테이블은 있으나 현재 Supabase 기준 0건 |
| 점포 | 서울시 상권분석서비스(점포-상권/자치구) | 현재 `store_info`는 자치구 x 업종 단위 |
| 집객시설 | 서울시 상권분석서비스(집객시설-상권) | 현재 DB 미적재 |

공식 페이지에서 OA-15560은 상권영역 정보이며, 원본 시스템은 서울시 상권분석 서비스다. 같은 페이지의 연관데이터에 추정매출, 점포, 직장인구, 생활인구, 집객시설 등이 별도 데이터셋으로 분리되어 있다.

## 현재 DB 테이블 요약

| 테이블 | 현재 행 수 | 주요 컬럼 | 상권 성격 분류에 쓸 수 있는 정도 |
|---|---:|---|---|
| `commerce_boundary` | 1,650 | `comm_cd`, `comm_nm`, `comm_type`, `geom` | 원본 4분류와 상권 폴리곤 제공 |
| `admin_boundary` | 425 | `adm_cd`, `adm_nm`, `gu_nm`, `geom` | 행정동 공간 조인 기준 |
| `adm_comm_mapping` | 2,207 | `adm_cd`, `comm_cd`, `comm_area_ratio`, `adm_area_ratio` | 행정동 데이터를 상권으로 배분하는 연결표 |
| `od_flows_aggregated` | 182,971 | `year_quarter`, `origin_adm_cd`, `dest_adm_cd`, `move_purpose`, `trip_count_sum` | 유입/유출, 중심성, 이동 목적 기반 보조 지표 |
| `living_population` | 94,944 | `base_date`, `hour_slot`, `adm_cd`, `total_pop` | 시간대별 생활인구, 단 행정동 단위 |
| `store_info` | 5,599 | `year_quarter`, `signgu_cd`, `industry_cd`, `store_count`, `close_rate` | 자치구 x 업종 수준이라 상권 직접 분류에는 약함 |
| `commerce_sales` | 0 | `year_quarter`, `trdar_cd`, `industry_cd`, `sales_amount`, `sales_count` | 스키마는 유용하지만 현재 적재 데이터 없음 |
| `commerce_analysis` | 178 | `comm_cd`, `gri_score`, `commerce_type`, `net_flow`, `degree_centrality`, `closure_rate` | 현재 분석 결과. 성격 분류와는 별개 |

## `commerce_boundary.comm_type` 실제 분포

| 값 | 건수 |
|---|---:|
| `골목상권` | 1,090 |
| `전통시장` | 305 |
| `발달상권` | 249 |
| `관광특구` | 6 |

이 값은 정책/원본 상권 구분으로는 쓸 수 있지만, 예비 창업자가 원하는 "역세권인가, 대학가인가, 주거지인가, 오피스인가"를 직접 답하지 못한다.

## A/B/C 판단

### A) 원본 `comm_type` 확장

현재 적재 로직은 SHP에서 아래 3개 속성만 가져온다.

```python
TRDAR_CD   -> comm_cd
TRDAR_CD_N -> comm_nm
TRDAR_SE_1 -> comm_type
```

현재 DB 기준으로는 `TRDAR_SE_1` 외에 세부 성격 필드가 없다. 원본 SHP에 추가 필드가 숨겨져 있는지 확인할 수는 있지만, 현재 적재된 테이블만 보면 A는 불가능에 가깝다.

확인 방법:

먼저 프로젝트 루트에 SHP 파일이 있는지 확인한다.

```powershell
rg --files -g "*.shp" -g "*.SHP"
```

아무 결과도 없으면 아직 서울 열린데이터광장에서 `서울시 상권분석서비스(영역-상권).zip`을 내려받아 압축 해제하지 않은 상태다. 이 경우 `data` 폴더를 만들고 ZIP을 풀어둔 뒤 실제 `.shp` 경로로 아래 명령의 `$shp` 값을 바꾼다.

```powershell
$shp = "data\서울시 상권분석서비스(영역-상권)\서울시 상권분석서비스(영역-상권).shp"
python -c "import geopandas as gpd; p=r'$shp'; g=gpd.read_file(p); print(g.columns.tolist()); print(g.head())"
```

여기서 `역세권`, `대학`, `업무`, `주거`에 해당하는 필드가 없으면 A는 폐기한다.

### B) 파생 분류 추가

추천안이다. `comm_type`은 원본 4분류로 유지하고, 별도 컬럼 또는 별도 테이블에 `commerce_character`를 만든다.

권장 분류 예시:

| character | 판정 근거 |
|---|---|
| `station_area` | 지하철/철도역 500m 버퍼와 상권 폴리곤 교차 |
| `university_area` | 대학교/캠퍼스 1km 버퍼와 교차 |
| `office_area` | 직장인구/주간 생활인구/업무 관련 업종 비중 높음 |
| `residential_area` | 야간 생활인구 또는 상주인구 비중 높음 |
| `market_area` | 원본 `comm_type = 전통시장` |
| `tourism_area` | 원본 `comm_type = 관광특구`, 집객시설/관광시설 밀도 |
| `mixed_area` | 여러 조건이 동시에 강함 |
| `unknown` | 근거 데이터 부족 |

현재 DB만으로 바로 가능한 태그는 `market_area`, `tourism_area`, 이동 기반 유입/유출 특성 정도다. `station_area`, `university_area`, `office_area`, `residential_area`는 추가 데이터가 있어야 신뢰도가 올라간다.

### C) DB 명세서 받고 결정

이 문서 기준으로 1차 결정은 가능하다. 현재 DB에는 세부 성격 원본 필드가 없으므로, C의 결론은 "B로 가되 필요한 보조 레이어를 추가한다"다.

## 추천 스키마

빠른 구현은 `commerce_analysis`에 컬럼을 추가하는 방식이다.

```sql
ALTER TABLE commerce_analysis
  ADD COLUMN IF NOT EXISTS commerce_character VARCHAR(30),
  ADD COLUMN IF NOT EXISTS character_tags JSONB,
  ADD COLUMN IF NOT EXISTS character_confidence FLOAT8,
  ADD COLUMN IF NOT EXISTS character_basis JSONB;
```

장기적으로는 분류 기준이 바뀔 수 있으므로 별도 테이블이 더 안전하다.

```sql
CREATE TABLE IF NOT EXISTS commerce_character_analysis (
  id BIGSERIAL PRIMARY KEY,
  year_quarter VARCHAR(7) NOT NULL,
  comm_cd VARCHAR(20) NOT NULL,
  commerce_character VARCHAR(30) NOT NULL,
  character_tags JSONB,
  character_confidence FLOAT8,
  character_basis JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (year_quarter, comm_cd)
);
```

`character_basis` 예시:

```json
{
  "source_comm_type": "골목상권",
  "station_distance_m": 320,
  "university_distance_m": null,
  "day_night_population_ratio": 1.8,
  "top_industries": ["커피-음료", "한식음식점"],
  "rules": ["station_buffer_500m", "high_daytime_population"]
}
```

## 추가로 필요한 데이터

| 필요 데이터 | 필요한 이유 | 후보 소스 |
|---|---|---|
| 지하철/철도역 좌표 | 역세권 판정 | 서울교통공사/서울 열린데이터광장 역 위치 데이터 |
| 대학교/캠퍼스 좌표 | 대학가 판정 | 공공데이터포털/서울 열린데이터광장 시설 데이터 |
| 집객시설 | 관광/교육/의료/교통 시설 밀도 | 서울시 상권분석서비스 집객시설-상권 |
| 직장인구 | 오피스 상권 판정 | 서울시 상권분석서비스 직장인구 |
| 상주인구 또는 주거지표 | 주거 상권 판정 | 서울시 상권분석서비스 상주인구/아파트 |
| 상권별 추정매출/업종 | 창업자용 업종 적합성 | `commerce_sales` 재적재 필요 |

## 현재 DB 명세 다시 뽑는 SQL

컬럼 목록:

```sql
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'commerce_boundary',
    'commerce_sales',
    'store_info',
    'commerce_analysis',
    'adm_comm_mapping',
    'admin_boundary',
    'od_flows_aggregated',
    'living_population'
  )
ORDER BY table_name, ordinal_position;
```

행 수:

```sql
SELECT 'commerce_boundary' AS table_name, COUNT(*) FROM commerce_boundary
UNION ALL SELECT 'commerce_sales', COUNT(*) FROM commerce_sales
UNION ALL SELECT 'store_info', COUNT(*) FROM store_info
UNION ALL SELECT 'commerce_analysis', COUNT(*) FROM commerce_analysis
UNION ALL SELECT 'adm_comm_mapping', COUNT(*) FROM adm_comm_mapping
UNION ALL SELECT 'admin_boundary', COUNT(*) FROM admin_boundary
UNION ALL SELECT 'od_flows_aggregated', COUNT(*) FROM od_flows_aggregated
UNION ALL SELECT 'living_population', COUNT(*) FROM living_population;
```

원본 상권 구분 분포:

```sql
SELECT comm_type, COUNT(*)
FROM commerce_boundary
GROUP BY comm_type
ORDER BY COUNT(*) DESC;
```

상권명 샘플:

```sql
SELECT comm_cd, comm_nm, comm_type
FROM commerce_boundary
ORDER BY comm_cd
LIMIT 30;
```

`commerce_sales`가 실제로 비어 있는지 확인:

```sql
SELECT
  COUNT(*) AS row_count,
  COUNT(DISTINCT year_quarter) AS quarter_count,
  COUNT(DISTINCT trdar_cd) AS commerce_count,
  COUNT(DISTINCT industry_cd) AS industry_count
FROM commerce_sales;
```

## 구현 우선순위

1. `commerce_character_analysis` 테이블을 추가한다.
2. 원본 `comm_type` 기반으로 `market_area`, `tourism_area`, `general_commerce` 1차 태그를 만든다.
3. 지하철역/대학교 좌표를 적재해 `station_area`, `university_area`를 공간 규칙으로 만든다.
4. 직장인구/상주인구/집객시설/추정매출을 적재해 `office_area`, `residential_area`, `mixed_area` 신뢰도를 올린다.
5. 프론트에서는 `commerce_type`을 성장/쇠퇴 분석 유형으로, `commerce_character`를 상권 성격으로 분리해서 표시한다.

## 용어 분리

| 필드 | 의미 | 사용자에게 보여줄 이름 |
|---|---|---|
| `source_comm_type` 또는 `commerce_boundary.comm_type` | 서울시 원본 상권 구분 | 원본 상권 구분 |
| `commerce_type` | GRI/유동/폐업률 기반 분석 유형 | 성장/위험 유형 |
| `commerce_character` | 역세권/대학가/주거/오피스 등 파생 성격 | 상권 성격 |

이 세 개를 분리하지 않으면 "고등학교가 흡수형_성장"처럼 사용자 입장에서 이상한 문장이 계속 나온다. `흡수형_성장`은 장소의 정체성이 아니라 분석 결과 유형이고, `고등학교 일대`는 상권명 또는 공간 기준명이다.
