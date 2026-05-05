# OpenRouteService Key Note

- 영역 단절 도로 경로 표시를 실제 도로 기반으로 쓰려면 백엔드 실행 환경에 `OPENROUTESERVICE_API_KEY`를 등록해야 한다.
- 이 키는 프론트엔드에 노출하지 않는다. `.env`, 서버 환경변수, 배포 환경변수 중 백엔드가 읽는 위치에만 둔다.
- 키가 없거나 ORS 호출이 실패하면 `/api/barrier-routes`는 정적 mock route로 fallback한다.
- 프론트엔드는 route ID가 실제 barrier ID와 맞지 않는 fallback 상황에서도 mock route 형상을 현재 barrier 출발/도착 좌표에 맞춰 표시한다.
