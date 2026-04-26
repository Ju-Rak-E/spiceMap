# spiceMap Dev-A 작업 기록 — Week 1 · 2

> 역할: 데이터 엔지니어 / 백엔드  
> 기간: 2026-04-08 ~ 2026-04-17  
> 기술 스택: Python 3.13, PostgreSQL 16 + PostGIS 3.4, FastAPI 0.115, Redis 5.1, Docker Compose, SQLAlchemy 2.0, GeoPandas 1.0, GeoAlchemy2 0.15

---

## 프로젝트 개요

**spiceMap**은 서울 상권 불균형을 인구·소비 흐름 네트워크로 시각화하는 정책 지원 플랫폼이다. 기존 상권 분석 서비스가 매출·폐업률 같은 스냅샷을 보여준다면, spiceMap은 "왜 그 상태가 됐는가"를 OD(Origin-Destination) 이동 흐름으로 설명한다.

Dev-A는 데이터 수집·적재 파이프라인과 FastAPI 백엔드 서버를 담당한다. 공공데이터 API가 느리고 불안정하기 때문에, 시연일 장애에 대비해 데이터를 사전에 DB에 저장하고 API 서버는 DB만 쿼리하는 구조로 설계했다. 이 구조 덕분에 지도 초기 로딩 5초 이내라는 성능 목표를 달성할 수 있다.

---

## Week 1 — 데이터 파이프라인 기반 구축

### 1. 인프라 세팅 — Docker Compose + PostgreSQL/PostGIS

**왜 PostGIS인가**

이 프로젝트에서 행정동 경계(OD 집계 단위)와 상권 경계(분석 단위)는 서로 다른 폴리곤 체계다. "역삼1동 → 신림동 4,200명"이라는 OD 데이터를 "신림 골목상권"으로 매핑하려면 두 폴리곤의 교차 면적을 계산해야 한다. 이 공간 결합을 순수 Python(Shapely)으로 처리하면 매 API 요청마다 수 초가 걸리지만, PostGIS의 `ST_Intersects`, `ST_Area` 같은 인덱스 지원 공간 연산을 쓰면 훨씬 빠르다. 또한 공간 데이터를 DB에 저장해두면 분석 결과를 pre-compute해서 `commerce_analysis` 테이블에 캐싱할 수 있어, 매 요청마다 재연산할 필요가 없다.

**포트 충돌 문제**

로컬 맥북에 Homebrew로 설치된 PostgreSQL이 이미 5432 포트를 점유하고 있었다. Docker 컨테이너를 5432로 띄우면 충돌이 발생한다. 해결책은 두 가지였다:
1. Homebrew PG를 중지하고 Docker 컨테이너를 5432로 사용
2. Docker 컨테이너를 다른 포트(5433)로 매핑

팀원 각자의 환경이 다를 수 있고, 다른 서비스가 Homebrew PG를 사용할 수 있다는 점을 고려해 **5433 포트 분리** 방식을 선택했다. `.env`에 `DB_PORT=5433`을 명시해 이 결정을 문서화했다.

```yaml
# docker-compose.yml
services:
  db:
    image: postgis/postgis:16-3.4
    ports:
      - "5433:5432"  # 5432는 로컬 Homebrew PG가 점유
```

---

### 2. ORM 설계 — SQLAlchemy 2.0 + GeoAlchemy2

**DeclarativeBase 선택**

SQLAlchemy 2.0의 새로운 `DeclarativeBase` 방식을 사용했다. 기존 `declarative_base()` 함수 방식 대비 타입 힌트가 더 자연스럽고, 향후 async 지원으로 전환할 때 구조 변경이 적다.

**GeoAlchemy2와 geometry 컬럼**

공간 데이터는 GeoAlchemy2의 `Geometry("MULTIPOLYGON", srid=4326)` 타입으로 정의했다. SRID를 4326(WGS84)으로 고정한 이유는 Maplibre GL, Deck.gl 같은 프론트엔드 지도 라이브러리가 기본적으로 WGS84 좌표계를 사용하기 때문이다. 원본 데이터가 EPSG:5181(GRS80 TM)이라도 적재 시점에 변환해두면 API에서 별도 변환 없이 바로 서빙할 수 있다.

**`hour_slot` 컬럼 타입 결정**

초기에 `hour_slot`을 `String(2)`로 정의했다가 `Integer`로 수정했다. 원본 API(`TMZON_PD_SE`)는 `"00"`, `"01"` 같은 문자열을 반환하지만, 실제 파일 다운로드 데이터에서 `시간대구분` 컬럼은 `0`, `1` 같은 정수로 제공됐다. 분석 시 시간대를 숫자로 집계(6~9시 피크 등)해야 하므로 `Integer`가 더 적합하다고 판단했다. 테이블을 `DROP & CREATE`해서 스키마를 수정했다.

---

### 3. OD 이동 데이터 수집 (OA-22300) — 가장 복잡한 데이터셋

OD 데이터는 이 프로젝트의 핵심 데이터셋이면서, 수집 방법이 가장 까다로웠다.

**API 미제공 → POST 다운로드 방식 역공학**

처음에는 공공데이터포털 API가 있을 것으로 기대했지만, OA-22300은 API를 제공하지 않고 파일 다운로드만 지원한다. 서울시 빅데이터 파일 서버(`datafile.seoul.go.kr`)에 POST 요청을 보내야 하는데, 브라우저 개발자 도구로 요청 형식을 분석해서 파악했다.

```
POST https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?useCache=false
Body: infId=OA-22300&seqNo=&seq=251001&infSeq=1
      ↑ seq는 YYMMDD 형식 (YYYYMMDD가 아님에 주의)
```

ZIP 파일로 응답이 오고, 내부에 CSV가 하나 있다. 이를 인메모리에서 압축 해제해 pandas로 처리한 뒤 DB에 적재했다. 디스크에 저장하지 않는 이유는 2025Q4 기준 일별 CSV 1개가 약 200MB로, 83일치를 저장하면 16GB가 넘기 때문이다.

**데이터 규모 문제**

MVP는 강남구·관악구만 다루지만, 원본 파일에는 서울 전체 행정동 간 이동량이 담겨있다. 하루치 원본 행 수는 약 600만~100만 행이다. 50,000행씩 청크로 읽어 필터링(강남·관악 포함 행만 추출) 후 DB에 적재했다. 필터 후 실제 적재 행수는 하루 약 45만~100만 행으로 줄어든다.

**중단 후 재개 기능**

초기에 2025Q4 전체(83일)를 `nohup`으로 실행했다가 중단하는 상황이 발생했다. 어디까지 수집됐는지 DB에서 `MAX(base_date)`를 조회한 뒤, `--from-date` 옵션으로 이어서 시작할 수 있도록 했다.

```bash
# 2025-10-10까지 적재됐을 경우, 10-10 삭제 후 재개
python -m backend.pipeline.download_od_files --quarter 2025Q4 --from-date 20251010
```

**Trade-off: 전체 적재 vs MVP 필터 적재**

MVP 필터로 적재하면 나중에 서울 전역으로 확장할 때 재수집이 필요하다. 반면 전체를 적재하면 약 8~10배 많은 저장 공간과 시간이 필요하다. 경진대회 제출 기한을 고려해 **MVP 필터 적재**를 선택하고, 확장 시 `--all-districts` 옵션으로 전체 수집이 가능하도록 스크립트를 설계했다.

---

### 4. 생활인구 데이터 수집 (OA-14991) — API와 파일의 이중 구조

**API 데이터 범위의 함정**

서울 열린데이터광장 `SPOP_LOCAL_RESD_DONG` API를 호출했더니 2025Q4 날짜에 대해 `INFO-200`(데이터 없음)이 반환됐다. 조사 결과 이 API는 **최근 2개월치만 제공**한다는 것을 알게 됐다. 2025Q4 데이터(10~12월)를 수집하려면 파일 다운로드 방식을 써야 했다.

서울 데이터포털을 확인하니 월별 CSV 파일(`LOCAL_PEOPLE_DONG_YYYYMM.csv`)을 2023년부터 제공하고 있었다. 10·11·12월 파일 3개를 다운받아 `load_living_pop_csv.py`를 별도 작성했다.

**UTF-8 BOM 인코딩 문제**

CSV를 `pd.read_csv(path)` 기본값으로 읽으면 첫 번째 컬럼명이 `\ufeff기준일ID`처럼 BOM 문자가 붙어서 읽힌다. 그냥 `encoding='utf-8-sig'`만 지정하면 될 것 같지만, 실제로는 `index_col=False`도 함께 줘야 컬럼이 정상적으로 매핑됐다. BOM 때문에 pandas가 첫 번째 컬럼을 인덱스로 잘못 인식하는 것이었다.

```python
pd.read_csv(path, encoding='utf-8-sig', index_col=False)
```

**배치 자동화와의 통합**

향후 월간 배치에서는 전월 데이터가 항상 API 제공 범위(최근 2개월) 안에 있으므로, API 방식을 쓸 수 있다. 따라서 `batch.py`에서는 `collect_living_pop.py`(API 방식)를 재사용한다. 과거 데이터 백필이 필요할 때는 `load_living_pop_csv.py`를 쓰는 이중 구조가 됐다.

---

### 5. 서울 열린데이터광장 API 클라이언트 (`seoul_client.py`)

**페이지네이션 방식의 차이**

공공데이터포털 일반 API는 `page`와 `perPage` 파라미터를 쓰는 반면, 서울 열린데이터광장 API는 `START`와 `END`라는 **절대 인덱스** 방식을 사용한다. 예를 들어 2번째 페이지 1000건을 가져오려면 `START=1001, END=2000`으로 지정한다. 처음에 page 방식으로 구현했다가 1페이지 데이터만 계속 반복 수집하는 버그가 발생했고, API 문서를 다시 확인하고 수정했다.

**공공데이터포털 API 키 이중 인코딩 문제**

`.env`에 저장된 API 키가 이미 URL 인코딩된 형태(`f3EBxGArPSLcuA%2F...`)인데, `requests`나 `httpx`의 `params=` 인자로 전달하면 `%`가 `%25`로 재인코딩되어 서버가 키를 인식하지 못한다. 해결책으로 API 키를 URL 문자열에 직접 삽입하는 방식을 사용했다.

```python
# ❌ 이중 인코딩 발생
response = httpx.get(url, params={"serviceKey": settings.public_data_api_key})

# ✅ URL에 직접 삽입
url = f"{base_url}?serviceKey={settings.public_data_api_key}&..."
response = httpx.get(url)
```

---

### 6. 공간 데이터 적재 (`load_spatial.py`) — SHP → PostGIS

**좌표계 변환**

서울시에서 제공하는 SHP 파일은 EPSG:5181(GRS80 TM, 한국 표준) 좌표계를 사용한다. 프론트엔드 지도 라이브러리와 PostGIS 공간 연산을 위해 EPSG:4326으로 변환했다. GeoPandas의 `to_crs()` 메서드로 처리했다.

**한글 인코딩 문제**

처음에 `encoding='cp949'`를 명시해서 SHP를 읽었더니 pyogrio가 일부 문자를 변환하지 못하고 한글이 깨졌다. 처음에는 이 경고를 무시했는데, 실제로 DB에 적재된 상권명이 `"씠깭썝 愿愿묓듅援"` 같은 형태로 저장됐다. API로 확인하기 전까지 문제를 인지하지 못했고, 파일을 이미 삭제한 후였다.

파일을 재다운로드한 뒤 `encoding` 파라미터를 제거하고 pyogrio의 자동 인코딩 감지에 맡겼더니 정상적으로 읽혔다. 명시적 인코딩 지정이 오히려 오탐을 유발한 케이스였다.

**`geopandas.to_postgis()`의 geometry 컬럼명 문제**

GeoAlchemy2로 정의한 테이블의 geometry 컬럼명은 `geom`이지만, GeoPandas의 기본 geometry 컬럼명은 `geometry`다. `to_postgis()`가 내부적으로 `Find_SRID('public', 'commerce_boundary', 'geometry')`를 호출하는데, 이 함수는 `geometry_columns` 뷰에서 컬럼명을 조회한다. 컬럼명이 맞지 않으면 `RaiseException: find_srid() - could not find the corresponding SRID` 오류가 발생한다.

해결책은 `rename_geometry("geom")`으로 컬럼명을 맞추고, `dtype={"geom": Geometry("MULTIPOLYGON", srid=4326)}`를 명시하는 것이다.

```python
gdf = gdf.rename_geometry("geom")
gdf.to_postgis(table_name, engine, dtype={"geom": Geometry("MULTIPOLYGON", srid=4326)})
```

---

## Week 2 — FastAPI 서버 구축

### 1. 서버 아키텍처 설계

**의존성 주입 패턴**

FastAPI의 `Depends()` 를 활용해 DB 세션과 Redis 클라이언트를 각 엔드포인트에 주입했다. 이렇게 하면 테스트 시 가짜 DB나 Redis를 주입하기 쉽고, 라우터 함수가 인프라에 직접 의존하지 않아 코드가 깔끔해진다.

```python
# backend/api/deps.py
def get_session() -> Generator[Session, None, None]:
    yield from get_db()

def get_cache() -> redis.Redis:
    return redis_client
```

```python
# 라우터에서 사용
@router.get("/commerce/type-map")
def type_map(db: Session = Depends(get_session), cache = Depends(get_cache)):
    ...
```

**라우터 분리**

각 도메인(`commerce`, `od`, `barriers`, `insights`, `export`)을 별도 파일로 분리하고 `main.py`에서 `prefix="/api"`로 등록했다. Week 3에 구현할 엔드포인트들은 빈 뼈대로 등록해두어, 프론트엔드에서 미리 URL을 확정할 수 있도록 했다.

---

### 2. `GET /api/commerce/type-map` — 핵심 엔드포인트

**geometry 직렬화 위치 결정**

GeoJSON 응답을 만들 때 geometry를 어디서 직렬화할지가 성능에 큰 영향을 미친다.

| 방식 | 방법 | 성능 |
|------|------|------|
| Python 레이어 | `geoalchemy2.shape.to_shape()` → Shapely → `geojson.mapping()` | DB에서 WKB로 받은 뒤 Python에서 변환 |
| SQL 레이어 | `ST_AsGeoJSON(geom)::json` | DB에서 GeoJSON JSON으로 직접 변환 |

`ST_AsGeoJSON()`은 PostGIS 내부에서 처리되므로 네트워크 전송량도 줄고 Python에서 변환 연산도 없다. 1,650개 상권 폴리곤을 반환하는 이 엔드포인트에서는 특히 차이가 크다. **SQL 레이어 직렬화**를 선택했다.

**`gu` 파라미터 제한**

현재 `commerce_boundary` 테이블에는 자치구 정보가 없다. SHP 원본에 `SIGNGU_CD` 컬럼이 있지만 모델 설계 시 포함하지 않았기 때문이다. `gu` 파라미터를 받더라도 현재는 전체를 반환하고 프론트에서 필터하는 방식으로 처리했다. 추후 `commerce_boundary`에 `signgu_cd` 컬럼을 추가하거나, `commerce_sales`와 JOIN해 자치구 필터를 DB 레벨로 내릴 계획이다.

**Dev-C 데이터 공백 처리**

`commerce_analysis` 테이블은 Dev-C가 분석 모듈을 완성해야 채워진다. LEFT JOIN을 사용해 분석 결과가 없어도 상권 폴리곤은 반환되도록 했다. `gri_score` 등은 `null`로 반환되며, 이 상태를 API 스펙에 명시해 Dev-B가 mock 데이터를 만들 때 `null` 케이스를 처리하도록 했다.

---

### 3. Redis 캐싱 전략

**TTL 1시간 선택 근거**

데이터 갱신 주기를 고려했다. OD·생활인구는 월 1회, 점포·매출은 분기 1회 갱신된다. 시연 중 실시간성이 필요하지 않으므로 TTL을 길게 잡아도 된다. 다만 Dev-C가 `commerce_analysis`를 업데이트하면 캐시가 즉시 반영되어야 하는데, 현재는 TTL 만료를 기다려야 한다. 운영 환경에서는 Dev-C 분석 완료 후 Redis `FLUSHDB`나 특정 키 삭제로 캐시를 무효화하는 방안을 검토할 것이다.

**캐시 키 설계**

```
type-map:{gu|'all'}:{quarter}   # 예: type-map:강남구:2025Q4
gri-history:{comm_cd}           # 예: gri-history:3110008
```

자치구·분기 조합별로 캐시를 분리해, 특정 자치구 캐시만 무효화할 수 있도록 했다.

---

### 4. 배치 자동화 (`batch.py`) — 월간과 분기 배치 분리

**왜 두 cron으로 분리했나**

처음에는 단일 배치 스크립트를 매월 실행하고 특정 달(1·4·7·10월)에만 분기 수집을 추가 실행하는 방식을 생각했다. 그런데 분기 데이터(점포정보, 상권매출)는 **분기 종료 후 1~2개월 뒤에 공공 데이터포털에 게시**된다. 예를 들어 2025Q4(10~12월) 데이터는 2026년 2월쯤 올라온다. 분기가 끝나자마자 수집하면 아직 게시되지 않은 데이터를 수집 시도하다 실패하거나 빈 데이터가 쌓인다.

분기 종료 다음 달 25일에 별도 cron으로 실행하면 게시 지연 문제를 자연스럽게 회피할 수 있다.

```
# 월간: 1일 (전월 수집)
0 2 1 * * python -m backend.pipeline.batch --type monthly

# 분기: 분기 종료 다음 달 25일 (게시 지연 대응)
0 2 25 1,4,7,10 * python -m backend.pipeline.batch --type quarterly
```

**`--dry-run` 설계**

실제 DB·API 호출 없이 어떤 기간이 수집 대상인지만 출력하는 옵션이다. cron 등록 전에 날짜 계산 로직을 검증하거나, 수집 전 영향 범위를 파악하는 데 유용하다.

---

## 기술적 의사결정 요약

| 결정 사항 | 선택 | 대안 | 이유 |
|---------|------|------|------|
| DB 포트 | 5433 | Homebrew PG 중지 후 5432 사용 | 팀원 환경 차이, 기존 서비스 영향 최소화 |
| OD 수집 방식 | POST 다운로드 + 인메모리 처리 | 디스크 저장 후 처리 | 일별 200MB × 83일 = 16GB 디스크 절약 |
| 생활인구 과거 데이터 | CSV 파일 다운로드 | API만 사용 | API가 최근 2개월만 제공, 2025Q4 수집 불가 |
| geometry 직렬화 위치 | SQL 레이어 (`ST_AsGeoJSON`) | Python 레이어 (Shapely) | DB 내부 처리로 변환 오버헤드 제거 |
| MVP 지역 필터 | 강남구 + 관악구 (적재 시 필터) | 전체 적재 후 API에서 필터 | 저장 공간·수집 시간 절약, 확장 옵션 유지 |
| 분기 배치 실행 시점 | 분기 종료 다음 달 25일 | 분기 시작 즉시 | 공공데이터 게시 지연(약 1~2개월) 대응 |
| geometry 컬럼명 | `geom` (GeoAlchemy2 기본 맞춤) | `geometry` | `to_postgis()` + `Find_SRID()` 호환 필요 |

---

## 주요 트러블슈팅

| 문제 | 원인 | 해결 |
|------|------|------|
| `psycopg2-binary` 설치 실패 | Python 3.13 + ARM64 빌드 없음 (==2.9.9) | `>=2.9.10`으로 변경 |
| DB 연결 실패 | 5432 포트 → 로컬 PG 연결됨, spicemap DB 없음 | docker-compose 포트 5433으로 변경 |
| API 키 인증 실패 | `params=` 전달 시 이중 URL 인코딩 | URL 문자열에 직접 삽입 |
| 생활인구 API `INFO-200` | API가 최근 2개월치만 제공 | 월별 CSV 파일 다운로드 방식으로 전환 |
| CSV 컬럼 미스매핑 | UTF-8 BOM으로 첫 컬럼 인덱스 오인식 | `encoding='utf-8-sig'`, `index_col=False` 병용 |
| SHP 한글 깨짐 | `encoding='cp949'` 강제 지정 → 일부 문자 변환 실패 | `encoding` 파라미터 제거, pyogrio 자동 감지 |
| `Find_SRID()` 오류 | GeoPandas geometry 컬럼명(`geometry`)과 모델 컬럼명(`geom`) 불일치 | `rename_geometry("geom")` + `dtype` 명시 |
| `seoul_api_key Extra inputs not permitted` | pydantic-settings 필드 누락 | `config.py`에 `seoul_api_key` 필드 추가 |
