# Dev-A 에스컬레이션 메시지 (집계본 공유로 전환)

> 작성: 2026-04-22 / 김광오 (Dev-C)
> 갱신: 2026-04-29 — Week 3 PR 2 (Supabase 이전) 시점 메시지로 교체
> 수신: 남인경 (Dev-A, @Ninky0, 2020113392@dgu.ac.kr)
> 근거: `docs/week2_decisions.md` Section 1, `docs/od_flows_aggregation.md`, `prompt_plan.md` Week 3 PR 2

---

## 배경 변경 요약 (2026-04-26)

원본 `od_flows` (8천만 행, ~80MB) 공유가 비현실적이라는 결론에 따라
**분기 단위 집계본 (`od_flows_aggregated`)**을 canonical 입력으로 채택했다.

- 집계 키: `(year_quarter, origin_adm_cd, dest_adm_cd, move_purpose)`
- 압축률: 80M → ~300K 행 (99.6% 축소)
- 집계 스크립트: `backend/pipeline/aggregate_od_flows.py`
- 어댑터: `backend/analysis/module_a_graph.py: load_quarterly_od_flows`
- Supabase 수용 가능 — Module A/B/C/D/E의 단일 입력 테이블

따라서 본 메시지는 "원본 CSV/SHP 직접 공유 요청" → **"집계본을 Dev-C가 직접
생성·공유할 테니, 원본 데이터(CSV) 또는 Dev-A 로컬에서 한 번만 집계 실행"**
으로 범위가 축소된다.

---

## 버전 1 — 슬랙/디스코드 용 (짧은 메시지)

```
인경님, 김광오입니다.

PR 2 (Supabase 이전) 진행 중인데, od_flows 원본 처리 방향을 정리해서
공유드립니다.

방향:
  - 원본 od_flows (80M 행) 공유는 더 이상 요청드리지 않습니다.
  - 대신 분기 단위 집계본 od_flows_aggregated (~300K 행)으로 전환했고
    backend/pipeline/aggregate_od_flows.py 가 이미 동작합니다.

부탁드릴 일 (택 1):
  A) 인경님 로컬 DB에서 한 번만 집계 실행 (5분 내):
       python -m backend.pipeline.aggregate_od_flows --all
     결과(약 300K 행)를 pg_dump 해서 공유 → 제가 Supabase 적재.

  B) 원본 CSV (seoul_purpose_admdong3_final_*.csv)만 GWS에 업로드:
     → 제가 받아 직접 집계+적재 진행.

옵션 A가 빠릅니다. 둘 다 어렵거나 다른 방법이 있으시면 알려주세요.

별도 SHP 2종(admin_boundary, commerce_boundary)은 여전히 필요합니다 —
공간 매핑/closure_rate 매칭에 사용합니다.
```

---

## 버전 2 — 이메일 용 (공식)

```
제목: [spiceMap] PR 2 (Supabase 이전) — od_flows 집계본 공유 요청

인경님,

김광오입니다. Week 3 종료를 앞두고 PR 2 (Supabase 이전) 단계에 진입했습니다.

## 변경된 데이터 전략

원본 od_flows 공유가 부담된다는 점을 감안해, 4/26 결정으로
분기 집계본을 canonical 입력으로 전환했습니다.

  원본 (~80M 행) → 분기·출·도·목적 4차원 집계 (~300K 행)
  스크립트: backend/pipeline/aggregate_od_flows.py
  스키마:   backend/models.py:OdFlowAggregated
  설계:     docs/od_flows_aggregation.md

이 집계본만 있으면 Module A/B/C/D/E와 H1 검증, /api 엔드포인트가
모두 동작합니다.

## 요청 사항 (택 1)

### 옵션 A — 인경님 로컬에서 한 번 집계 실행 (권장, 5분 내)

  $ git pull
  $ python -m backend.pipeline.aggregate_od_flows --all
  $ pg_dump -Fc -t od_flows_aggregated -U postgres -h 127.0.0.1 -p 5433 \
            spicemap > od_agg_$(date +%Y%m%d).dump
  → 결과 dump를 GWS 또는 채팅으로 전달

제가 받아 Supabase에 pg_restore 합니다.

### 옵션 B — 원본 CSV만 GWS 업로드

seoul_purpose_admdong3_final_*.csv 만 GWS에 올려주시면
저희 쪽에서 적재 → 집계 → Supabase 반영까지 진행하겠습니다.

옵션 A가 시간/대역폭 모두 효율적입니다.

## 별도 — admin_boundary / commerce_boundary SHP

PR 2와 별개로 SHP 2종은 아직 필요합니다. closure_rate(자치구 단위)를
상권으로 매핑하는 데 admin_boundary 공간 조인이 필요하고,
/api/commerce/type-map 의 자치구 필터도 동일 의존성입니다.

  - 행정동 SHP 세트 (.shp/.shx/.dbf/.prj)
  - 상권 SHP 세트 (.shp/.shx/.dbf/.prj)

가능한 시점에 GWS 공유 부탁드립니다.

## 타임라인

PR 2 머지 목표: 2026-04-29 EOD (Week 3 마감 4/28 +1일).
오늘(4/29) 중 옵션 확정 부탁드립니다.

감사합니다.
김광오
```

---

## 전송 전 확인 사항

- [x] 집계본 스키마/스크립트가 동작하는가 → `tests/pipeline/test_aggregate_od_flows.py` 14건 통과
- [x] Module A 어댑터가 집계본을 입력으로 받는가 → `load_quarterly_od_flows` 구현 완료
- [x] run_analysis 파이프라인이 집계본만으로 동작하는가 → `tests/pipeline/test_run_analysis.py` 18건 통과
- [ ] 옵션 A의 pg_dump 명령이 Dev-A 환경에서 동작하는가 → docker-compose 포트 동일 가정

## 전달 채널

- 1차: 슬랙/디스코드 DM (즉시성 높음)
- 2차 (24h 무응답 시): 이메일

## 후속 — Supabase 이전 (PR 2)

| 항목 | 상태 | 비고 |
|------|------|------|
| `od_flows_aggregated` 적재 | Dev-A 회신 대기 | 옵션 A/B 결정 후 |
| `commerce_analysis` 모델 5컬럼 추가 | ✅ 완료 (4/26) | `models.py` + `init_db.migrate_db()` |
| `policy_cards` 테이블 생성 | ✅ 완료 (4/26) | `Base.metadata.create_all` 자동 |
| `.env.example` Supabase 기본값 | ✅ 완료 | `aws-1-ap-northeast-2.pooler.supabase.com` |
| `run_analysis.py` 분석 INSERT 파이프라인 | ✅ 완료 (4/29) | `backend/pipeline/run_analysis.py` |
| `/api/commerce/type-map` 5컬럼 노출 | ✅ 완료 (4/29) | 응답 properties 확장 |
| `/api/insights/policy` policy_cards 어댑터 | ✅ 완료 (PR #19) | 기존 구현 |
