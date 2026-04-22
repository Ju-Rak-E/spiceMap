# Dev-A 에스컬레이션 메시지 초안

> 작성: 2026-04-22 / 김광오 (Dev-C)
> 수신: 남인경 (Dev-A, @Ninky0, 2020113392@dgu.ac.kr)
> 근거: `docs/week2_decisions.md` Section 1 에스컬레이션 조건

---

## 버전 1 — 슬랙/디스코드 용 (짧은 메시지)

```
인경님, 김광오입니다.

Week 2 마감(4/21)이 지났고, week2_decisions 에스컬레이션 조건
"2026-04-16 EOD 무응답 → Dev-C 직접 적재" 도 이미 6일 경과 상태입니다.

현재 저희 로컬 DB에 다음 3종이 0건이라 Module A/C와 H1 검증
실데이터 실행이 막혀 있습니다:

  - od_flows         (OA-22300 CSV)
  - admin_boundary   (SHP)
  - commerce_boundary (SHP)

오늘(4/22) 중으로 둘 중 하나 부탁드립니다:

  A) 원본 파일 공유 (GWS/드라이브 등 어디든 OK)
     → 제가 직접 load_* 스크립트 돌려 적재

  B) 인경님 로컬 DB dump 공유
     → pg_dump -Fc spicemap > spicemap.dump
     → 저희 쪽에서 pg_restore

Week 3 Module D/E 진입 타이밍에 맞추려면 금일 중 확정이 필요합니다.
둘 다 어렵거나 다른 방법이 있으시면 알려주세요.
```

---

## 버전 2 — 이메일 용 (공식)

```
제목: [spiceMap] Week 2 이월 블로커 해제 요청 — od_flows / *_boundary 공유

인경님,

김광오입니다. Week 2 마감(2026-04-21)이 지났고, week2_decisions.md
Section 1에 기록된 에스컬레이션 조건 중 "2026-04-16 EOD Dev-A 무응답 시
Dev-C 직접 적재 전환"도 이미 6일 경과한 상황입니다.

## 현재 블로커

저희 로컬 DB의 다음 3개 테이블이 0건이라 Module A의 실데이터 검증,
Module C 구현, H1 가설 검증 실행이 모두 정체되어 있습니다:

  - od_flows           (OA-22300, 대용량 CSV)
  - admin_boundary     (행정동 SHP)
  - commerce_boundary  (상권 SHP)

API 3종(living_population, store_info, commerce_sales)은 제가 오늘
직접 재수집 완료했으니 이 3건 외에는 추가 요청 없습니다.

## 요청 사항 (택 1)

### 옵션 A — 원본 파일 공유
GWS 공유 드라이브(또는 편하신 채널)에 아래 파일 업로드 부탁드립니다:

  - seoul_purpose_admdong3_final_*.csv
  - 행정동 SHP 세트 (.shp/.shx/.dbf/.prj)
  - 상권 SHP 세트 (.shp/.shx/.dbf/.prj)

제가 backend/pipeline/load_spatial.py, load_od_flows.py 로 직접 적재합니다.

### 옵션 B — DB dump 공유
인경님 로컬 DB를 dump해 전달 주시면 pg_restore로 바로 반영합니다.

  $ pg_dump -Fc -U postgres -h 127.0.0.1 -p 5433 spicemap > spicemap.dump
  (로컬 Docker 포트에 맞춰 조정)

## 타임라인 요청

오늘(4/22) 중으로 옵션/일정 확정 부탁드립니다. Week 3 Module D/E 진입
타이밍에 맞추려면 내일(4/23)까지는 실데이터가 필요합니다.

## 근본 대책 제안 (참고)

매 환경마다 수동 전달이 반복되고 있어서, Week 3 중 팀 논의로
아래 중 하나 도입을 제안하려고 합니다:

  1. scripts/dump_db.sh + GWS 공유 폴더 (주 1회 정기 덤프)
  2. Supabase 공유 DB로 이전 (QJC 데이터 정책 부합)
  3. 공개 CSV/SHP만 GWS에 올려두고 load_* 스크립트로 재생 가능한 구조

감사합니다.
김광오
```

---

## 전송 전 확인 사항

- [ ] 에스컬레이션 조건 일자(4/16)가 정확한가 → `docs/week2_decisions.md` Section 1 확인 완료
- [ ] API 3종이 실제로 재수집 완료되었는가 → collect_* 실행 후 건수 확인 필요
- [ ] 옵션 B의 pg_dump 명령이 Dev-A 환경에서 동작하는가 → Dev-A docker-compose 설정 동일하다고 가정
- [ ] Week 3 Module D/E 타임라인이 현실적인가 → prompt_plan.md Week 3 섹션 재확인

## 전달 채널

팀에서 주로 쓰는 채널 확인 필요:
- GitHub PR 코멘트? (공개, 기록 남음)
- 슬랙/디스코드 DM? (빠름)
- 이메일? (공식적, 답변 보장)
- 카톡? (비공식, 개인 선호)
