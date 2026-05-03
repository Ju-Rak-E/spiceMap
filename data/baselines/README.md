# Baselines (D-9, 2026-05-03)

본 디렉토리는 외부 베이스라인 비교용 정적 데이터를 보관한다. **`.gitignore` 정책에 따라 대용량 원본 CSV는 git 추적 제외**, 본 README 와 산출 스크립트만 추적한다.

## B1 — 서울시 공식 상권변화지표 (OA-15576)

비교 대상: Module E priority_score 와 서울시 공식 발표 위험 상권의 Top-N 일치도 (Jaccard).

- 출처: 서울 열린데이터광장 (OA-15576 상권변화지표)
- URL: https://data.seoul.go.kr/dataList/OA-15576/S/1/datasetView.do
- 분기 단위 정적 CSV. API 연동 어려움(서비스 ID 불안정) → 직접 다운로드 권장 (docs/strategy_d13.md §2 결정 C).

### 다운로드 절차

```bash
# 분기별 CSV 를 다음 위치에 저장:
#   data/baselines/seoul_change_index_2025Q3.csv
#   data/baselines/seoul_change_index_2025Q4.csv
#
# 필수 컬럼:
#   TRDAR_CD          상권 코드 (str)
#   TRDAR_CHNG_IX_NM  변화지표 명 (정체/주의/상권쇠퇴/다이나믹/HH 등)
```

인코딩은 utf-8 / utf-8-sig / cp949 모두 자동 시도 (`backend/analysis/baseline_b1.py:load_change_index_csv`).

### Jaccard 산출

CSV 가 준비되면:

```bash
python -m scripts.run_baseline_b1 \
    --csv data/baselines/seoul_change_index_2025Q4.csv \
    --quarter 2025Q4
```

스크립트 산출물:
- 콘솔에 B1Result (n_total, jaccard, new_in_priority 등) 출력
- 결과를 `frontend/src/data/validation_results.json` 의 B1 카드에 직접 반영 (수동)

`validation_results.json` 의 현재 fixture (Jaccard 0.58, 추가 식별 14건) 은 기존 분석 결과를 카드 표시용으로 이전한 값이며, 위 스크립트로 정확한 재현이 가능하다.

## B3 — 직전 매출 추세 모델

비교 대상: Q3→Q4 매출 단순 하락율 (`backend/analysis/baseline_comparison.py`).

- 출처: 내부 산출 (commerce_sales Q3 + Q4)
- 정적 다운로드 불필요 — DB 만으로 산출.
- 실행: `scripts/run_validation_h2_b1.py` (H2 + B3 동시 산출 가능)

## 기여 규칙

- 본 디렉토리에 PII 또는 공개 비허용 데이터를 두지 않는다.
- 원본 CSV (대용량) 은 `.gitignore` 패턴으로 제외, 산출 결과 (JSON, 마크다운 표) 만 트래킹.
