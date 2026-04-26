"""흐름 단절 구간 API 응답 스키마."""
from pydantic import BaseModel


class BarrierItem(BaseModel):
    from_comm_cd: str
    from_comm_nm: str | None
    to_comm_cd: str
    to_comm_nm: str | None
    barrier_score: float
    barrier_type: str | None


class BarriersResponse(BaseModel):
    quarter: str
    total: int
    barriers: list[BarrierItem]
