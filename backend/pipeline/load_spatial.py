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
from geoalchemy2 import Geometry
from sqlalchemy import create_engine, text

from backend.config import settings
from backend.models import AdminBoundary, CommerceBoundary

TARGET_CRS = "EPSG:4326"


def load_commerce(path: Path, engine) -> int:
    print(f"[상권 경계] {path.name} 읽는 중...")
    gdf = gpd.read_file(path, encoding="cp949")
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
        gdf = gpd.read_file(path, encoding="cp949")
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
