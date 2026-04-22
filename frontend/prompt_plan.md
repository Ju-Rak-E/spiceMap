# Week 3 구현 계획

## Phase 1 — 상권 상세 패널 [ ]
- App.tsx: selectedNode state + onNodeClick
- Map.tsx: 노드 클릭 → onNodeClick 콜백
- hooks/useGriHistory.ts (신규)
- components/CommerceDetailPanel.tsx (신규)

## Phase 2 — 타임라인 슬라이더 강화 [ ]
- hooks/useTimelineControl.ts (신규): isPlaying / speed / play/pause
- components/FlowControlPanel.tsx: 재생/정지 버튼 + 속도 토글

## Phase 3 — 자치구 필터 [ ]
- App.tsx: selectedDistricts state + 필터 로직
- components/FlowControlPanel.tsx: 자치구 토글 버튼 2개
