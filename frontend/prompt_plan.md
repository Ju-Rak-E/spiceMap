# Dev-B 프론트 구현 체크리스트

> 기준일: 2026-05-03  
> 범위: `frontend/` 구현과 FastAPI 연동 상태

## Week 3 완료

- [x] 상권 상세 패널 연결
  - [x] `App.tsx` 선택 상권 상태
  - [x] `Map.tsx` 노드 클릭 콜백
  - [x] `useGriHistory`
  - [x] `CommerceDetailPanel`
- [x] 타임라인 슬라이더 강화
  - [x] `useTimelineControl`
  - [x] 재생/정지/배속 제어
- [x] 자치구/상권 유형 필터
  - [x] 선택 자치구 상태
  - [x] 필터 UI
  - [x] 상권 유형 필터

## Week 4 완료

- [x] 상단 해설바 문장 정리
- [x] 초기 자치구 선택
- [x] 정책 카드 상세 패널 연결
- [x] GRI 위험도 테두리
- [x] 선택 상권 OD 흐름 강조
- [x] 데이터 없음/준비중 문구 정리
- [x] CSV 다운로드
- [x] 색각 구분 확인
- [x] aria-label 보강
- [x] 흐름 단절 레이어 토글/점선/툴팁
- [x] 흐름단절 파티클 애니메이션 (`DisruptedBarrierParticleLayer` + `barrierRouteAnimation`) — showBarriers ON 시 경로 따라 파티클 흐름, 단절 지점 scatter 효과 (304 tests)
- [x] 분기 비교 KPI delta
- [x] 상권 경계 폴리곤 레이어
- [x] 시각 점수 보조 설명
- [x] 지도 로딩 성능 측정
- [x] 발표 시나리오 모드
- [x] 태블릿 1024px 확인

## API 계약 보완 완료

- [x] `/api/barriers` live row 좌표 보존
- [x] API 상권 node에 `adm_cd`/`adm_nm` 제공
- [x] OD 하이라이트 키를 행정동 코드 기준으로 정렬
- [x] 선택 경계 필터에서 `comm_id`와 `comm_cd` 모두 매칭
- [x] `commerce_analysis` insert 전 NaN metric을 DB NULL로 변환

## 남은 운영 확인

- [ ] 운영 DB에서 `flow_barriers` 좌표 렌더링 확인
- [ ] 운영 DB에서 `commerce_boundary` 선택 하이라이트 확인
- [ ] 배포 환경에서 CSV 다운로드 파일명/인코딩 확인
- [ ] 발표 전 3분 시나리오 리허설
