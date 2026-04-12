# 행정동-상권 공간 결합 설계

> 작성자: Dev-C | 작성일: 2026-04-12

## 1. 왜 필요한가

데이터셋별 공간 단위가 다르다:

| 데이터 | 공간 단위 | 키 |
|--------|----------|-----|
| OD 유동 | 행정동 (8자리) | `adm_cd` |
| 생활인구 | 행정동 (8자리) | `adm_cd` |
| 점포정보 | 자치구 (5자리) | `signgu_cd` |
| 추정매출 | 상권 | `trdar_cd` |

Week 2 분석(GRI, 유동 장벽, 우선순위)은 **상권 단위**로 통합해야 하므로, 행정동 데이터를 상권으로 배분하는 매핑이 필요하다.

## 2. 방식: 폴리곤 교차 면적 비율

### 대안 비교

| 방식 | 장점 | 단점 | 채택 |
|------|------|------|------|
| **면적 교차** | 부분 겹침 정확 배분 | 계산 비용 | **채택** |
| Centroid | 빠름 | 상권이 여러 행정동에 걸치면 1개만 매칭 | 탈락 |
| Contains | 명확 | 경계 상권 누락 | 탈락 |

### 배분 공식

```
상권 C가 행정동 A에 70%, 행정동 B에 30% 걸쳐있을 때:

  상권 C의 생활인구 = pop(A) × 0.70 + pop(B) × 0.30
  상권 C의 OD 유입 = flow(→A) × 0.70 + flow(→B) × 0.30
```

### 면적 비율 계산

```
comm_area_ratio = 교차면적 / 상권전체면적   (행정동→상권 배분용)
adm_area_ratio  = 교차면적 / 행정동전체면적  (상권→행정동 역배분용)
```

- CRS: 면적 계산은 EPSG:5179 (Korea 2000 TM, m² 단위)
- 저장: EPSG:4326 (WGS84)
- 극소 교차 (0.1% 미만) 제거

## 3. 매핑 테이블

```sql
CREATE TABLE adm_comm_mapping (
    id          BIGSERIAL PRIMARY KEY,
    adm_cd      VARCHAR(10) NOT NULL,   -- 행정동 코드
    comm_cd     VARCHAR(20) NOT NULL,   -- 상권 코드
    overlap_area FLOAT,                  -- 교차 면적 (m²)
    comm_area_ratio FLOAT,              -- 상권 기준 비율 (0~1)
    adm_area_ratio  FLOAT               -- 행정동 기준 비율 (0~1)
);
```

## 4. 사용법 예시

### 상권별 생활인구 배분

```sql
SELECT m.comm_cd,
       SUM(lp.total_pop * m.comm_area_ratio) AS estimated_pop
FROM living_population lp
JOIN adm_comm_mapping m ON lp.adm_cd = m.adm_cd
WHERE lp.base_date = '2026-04-07' AND lp.hour_slot = 14
GROUP BY m.comm_cd
ORDER BY estimated_pop DESC;
```

### 상권별 OD 유입량 배분

```sql
SELECT m.comm_cd,
       SUM(od.trip_count * m.comm_area_ratio) AS estimated_inflow
FROM od_flows od
JOIN adm_comm_mapping m ON od.dest_adm_cd = m.adm_cd
WHERE od.base_date = '2026-04-07'
GROUP BY m.comm_cd;
```

## 5. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 상권이 1개 행정동에 완전 포함 | comm_area_ratio = 1.0 |
| 상권이 여러 행정동에 걸침 | 각 행정동별 비율 합 = 1.0 |
| 교차 면적 0.1% 미만 | 제거 (노이즈) |
| 상권이 행정동 밖에 있음 | 매핑 없음 (분석에서 제외) |

## 6. 검증 결과 (합성 데이터)

```
행정동 2개 × 상권 3개 테스트:
- C1 (A에만 포함): comm_area_ratio = 1.0 → PASS
- C2 (A-B에 걸침): A=0.5, B=0.5 → PASS
- C3 (B에만 포함): comm_area_ratio = 1.0 → PASS
```

## 7. 실행

```bash
# 테스트
python -m backend.analysis.spatial_join --test

# 실제 매핑 생성 (SHP 적재 후)
python -m backend.analysis.spatial_join
```

## 8. 의존성

- SHP 적재 필수: `admin_boundary`, `commerce_boundary` 모두 데이터가 있어야 함
- Dev-A에게 SHP 파일 요청 상태
