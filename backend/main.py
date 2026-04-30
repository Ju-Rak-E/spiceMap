"""
spiceMap FastAPI 앱 진입점

실행:
    uvicorn backend.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import commerce, od, barriers, insights, export, data_sources

app = FastAPI(
    title="spiceMap API",
    description="서울 상권 불균형 분석 플랫폼",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}


app.include_router(commerce.router, prefix="/api", tags=["commerce"])
app.include_router(od.router, prefix="/api", tags=["od"])
app.include_router(barriers.router, prefix="/api", tags=["barriers"])
app.include_router(insights.router, prefix="/api", tags=["insights"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(data_sources.router, prefix="/api", tags=["meta"])
