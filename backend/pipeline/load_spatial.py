"""
공간 데이터 SHP/GeoJSON → PostGIS 적재

실행 방법:
    # 상권 경계
    python -m backend.pipeline.load_spatial commerce "data/서울시 상권분석서비스(영역-상권)/서울시 상권분석서비스(영역-상권).shp"

    # 행정동 경계
    python -m backend.pipeline.load_spatial admin data/HangJeongDong.shp
    python -m backend.pipeline.load_spatial admin data/HangJeongDong.geojson
"""
import argparse
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
from geoalchemy2 import Geometry
from sqlalchemy import create_engine, text

from backend.config import settings
from backend.models import AdminBoundary, CommerceBoundary

TARGET_CRS = "EPSG:4326"

# 서울시 25개 자치구 표준 코드(adm_cd 앞 5자리) → 명칭.
# 행정안전부 행정동 코드 체계: 11(서울) + signgu(3자리) = 5자리 자치구 코드.
SEOUL_SIGUNGU_CD_TO_NM: dict[str, str] = {
    "11110": "종로구", "11140": "중구", "11170": "용산구", "11200": "성동구",
    "11215": "광진구", "11230": "동대문구", "11260": "중랑구", "11290": "성북구",
    "11305": "강북구", "11320": "도봉구", "11350": "노원구", "11380": "은평구",
    "11410": "서대문구", "11440": "마포구", "11470": "양천구", "11500": "강서구",
    "11530": "구로구", "11545": "금천구", "11560": "영등포구", "11590": "동작구",
    "11620": "관악구", "11650": "서초구", "11680": "강남구", "11710": "송파구",
    "11740": "강동구",
}


def load_commerce(path: Path, engine) -> int:
    print(f"[상권 경계] {path.name} 읽는 중...")
    gdf = gpd.read_file(path)
    print(f"  원본 CRS: {gdf.crs}, 행 수: {len(gdf):,}")

    gdf = gdf.to_crs(TARGET_CRS)

    df = gdf[["TRDAR_CD", "TRDAR_CD_N", "TRDAR_SE_1", "geometry"]].copy()
    df = df.rename(columns={
        "TRDAR_CD":   "comm_cd",
        "TRDAR_CD_N": "comm_nm",
        "TRDAR_SE_1": "comm_type",
    })
    df["comm_cd"]   = df["comm_cd"].astype(str).str.strip()
    df["comm_nm"]   = df["comm_nm"].astype(str).str.strip()
    df["comm_type"] = df["comm_type"].astype(str).str.strip()

    # geometry 컬럼명을 모델과 맞춤 (geom)
    df = df.rename_geometry("geom")

    # 테이블 초기화 후 적재
    with engine.connect() as conn:
        conn.execute(text(f"TRUNCATE TABLE {CommerceBoundary.__tablename__}"))
        conn.commit()

    df.to_postgis(
        CommerceBoundary.__tablename__,
        engine,
        if_exists="append",
        index=False,
        dtype={"geom": Geometry("MULTIPOLYGON", srid=4326)},
    )
    print(f"[상권 경계] 완료: {len(df):,}행 적재")
    return len(df)


def load_admin(path: Path, engine) -> int:
    print(f"[행정동 경계] {path.name} 읽는 중...")
    suffix = path.suffix.lower()
    if suffix == ".geojson":
        gdf = gpd.read_file(path)
    else:
        gdf = gpd.read_file(path)
    print(f"  원본 CRS: {gdf.crs}, 행 수: {len(gdf):,}, 컬럼: {list(gdf.columns)}")

    gdf = gdf.to_crs(TARGET_CRS)

    # 컬럼명 자동 탐지 (데이터셋마다 다름)
    col_cd  = _find_col(gdf, ["adm_cd", "adm_dr_cd", "hjd_cd", "emd_cd", "dong_cd", "adstrd_cd"])
    col_nm  = _find_col(gdf, ["adm_nm", "adm_dr_nm", "hjd_nm", "emd_nm", "dong_nm", "adstrd_nm"])
    col_gu  = _find_col(gdf, ["sgg_nm", "gu_nm", "signgu_nm", "sigungu_nm"], required=False)

    if not col_cd or not col_nm:
        print(f"  [오류] 행정동 코드/명 컬럼을 찾지 못했습니다. 컬럼 목록: {list(gdf.columns)}")
        sys.exit(1)

    print(f"  코드 컬럼: {col_cd}, 명 컬럼: {col_nm}, 구 컬럼: {col_gu}")

    df = gdf[[col_cd, col_nm, *([col_gu] if col_gu else []), "geometry"]].copy()
    df = df.rename(columns={col_cd: "adm_cd", col_nm: "adm_nm", **(
        {col_gu: "gu_nm"} if col_gu else {}
    )})
    if "gu_nm" not in df.columns:
        df["gu_nm"] = None

    df["adm_cd"] = df["adm_cd"].astype(str).str.strip()
    df["adm_nm"] = df["adm_nm"].astype(str).str.strip()

    # gu_nm 누락(NULL) 시 adm_cd 앞 5자리(자치구 코드)로부터 자동 도출.
    # 서울시 25개 자치구 코드 → 명칭 매핑은 행정안전부 표준이라 정적 테이블 가능.
    df["gu_nm"] = df.apply(
        lambda r: r["gu_nm"] if pd.notna(r["gu_nm"]) and str(r["gu_nm"]).strip()
        else SEOUL_SIGUNGU_CD_TO_NM.get(str(r["adm_cd"])[:5]),
        axis=1,
    )

    # geometry 컬럼명을 모델과 맞춤 (geom)
    df = df.rename_geometry("geom")

    with engine.connect() as conn:
        conn.execute(text(f"TRUNCATE TABLE {AdminBoundary.__tablename__}"))
        conn.commit()

    df.to_postgis(
        AdminBoundary.__tablename__,
        engine,
        if_exists="append",
        index=False,
        dtype={"geom": Geometry("MULTIPOLYGON", srid=4326)},
    )
    print(f"[행정동 경계] 완료: {len(df):,}행 적재")
    return len(df)


def _find_col(gdf, candidates: list[str], required: bool = True) -> str | None:
    lower = {c.lower(): c for c in gdf.columns}
    for cand in candidates:
        if cand.lower() in lower:
            return lower[cand.lower()]
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="공간 데이터 DB 적재")
    parser.add_argument("target", choices=["commerce", "admin"], help="적재 대상")
    parser.add_argument("file", help="SHP 또는 GeoJSON 파일 경로")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"[오류] 파일 없음: {path}", file=sys.stderr)
        sys.exit(1)

    engine = create_engine(settings.database_url)

    if args.target == "commerce":
        load_commerce(path, engine)
    else:
        load_admin(path, engine)


if __name__ == "__main__":
    main()
