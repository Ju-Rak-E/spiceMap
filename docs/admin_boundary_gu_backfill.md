# admin_boundary.gu_nm 백필 (2026-04-29)

> Supabase `clyqvncpcfyfljbqgdig`에 적재된 `admin_boundary` 425행의
> `gu_nm`이 모두 NULL 상태였음. type-map gu 필터, closure_rate 자치구
> 매핑이 모두 작동하지 않아 1회성 백필을 수행했다.

## 배경

`backend/pipeline/load_spatial.py`는 SHP/GeoJSON에서 `sgg_nm`/`gu_nm` 등
컬럼을 자동 탐지하지만, 적재된 SHP에는 해당 컬럼이 없었다. 따라서 모든
425행이 `gu_nm = NULL`로 적재됨.

영향:
- `/api/commerce/type-map?gu=강남구` → 결과 0건 (gu_nm 매칭 실패)
- `run_analysis`의 `_load_closures_by_comm` spatial path → 자치구 결합 0건

## 백필 SQL (Supabase에서 1회 실행)

`adm_cd` 앞 5자리 = 자치구 코드 (행정안전부 표준). 25개 자치구 정적 매핑.

```sql
UPDATE admin_boundary
SET gu_nm = CASE LEFT(adm_cd, 5)
    WHEN '11110' THEN '종로구'    WHEN '11140' THEN '중구'
    WHEN '11170' THEN '용산구'    WHEN '11200' THEN '성동구'
    WHEN '11215' THEN '광진구'    WHEN '11230' THEN '동대문구'
    WHEN '11260' THEN '중랑구'    WHEN '11290' THEN '성북구'
    WHEN '11305' THEN '강북구'    WHEN '11320' THEN '도봉구'
    WHEN '11350' THEN '노원구'    WHEN '11380' THEN '은평구'
    WHEN '11410' THEN '서대문구'  WHEN '11440' THEN '마포구'
    WHEN '11470' THEN '양천구'    WHEN '11500' THEN '강서구'
    WHEN '11530' THEN '구로구'    WHEN '11545' THEN '금천구'
    WHEN '11560' THEN '영등포구'  WHEN '11590' THEN '동작구'
    WHEN '11620' THEN '관악구'    WHEN '11650' THEN '서초구'
    WHEN '11680' THEN '강남구'    WHEN '11710' THEN '송파구'
    WHEN '11740' THEN '강동구'
END
WHERE gu_nm IS NULL;
```

## 검증 (실행 후)

| 검증 | 결과 |
|------|------|
| `admin_boundary.gu_nm` 채워진 행수 | 425/425 (25개 자치구 모두 분포) |
| `commerce_boundary` ↔ `admin_boundary` spatial join 결과 | 1,650/1,650 매핑 |
| `gu='강남구'` 필터 | 104 commerces |
| `gu='관악구'` 필터 | 74 commerces |
| `closure_rate` 매핑 | 178건 (강남 104 + 관악 74, store_info 보유 자치구) |

## 향후 재적재 대비

`backend/pipeline/load_spatial.py`에 `SEOUL_SIGUNGU_CD_TO_NM` 정적 매핑을
추가하여, SHP에 `gu_nm`이 없을 때 `adm_cd[:5]` 기반으로 자동 도출하도록
함. 따라서 향후 `python -m backend.pipeline.load_spatial admin <path>`
재실행 시 본 백필이 불필요.
