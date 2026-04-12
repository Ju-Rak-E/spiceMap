"""
행정동-상권 공간 결합 (면적 교차 비율)

행정동(admin_boundary)과 상권(commerce_boundary) 폴리곤의 교차 면적을 계산하여
adm_comm_mapping 테이블에 매핑을 생성한다.

실행: python -m backend.analysis.spatial_join
검증: python -m backend.analysis.spatial_join --test
"""
import argparse
import sys

import geopandas as gpd
import pandas as pd
from shapely.geometry import box
from sqlalchemy import create_engine, text

from backend.config import settings

ENGINE = create_engine(settings.database_url)

# 면적 계산용 투영 좌표계 (Korea 2000 / Unified CS, 미터 단위)
CRS_PROJECTED = "EPSG:5179"
CRS_WGS84 = "EPSG:4326"


def load_boundaries() -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """PostGIS에서 행정동/상권 경계를 GeoDataFrame으로 로드 (CRS 명시 변환)."""
    admin = gpd.read_postgis(
        "SELECT adm_cd, adm_nm, gu_nm, ST_Transform(geom, 4326) AS geom FROM admin_boundary",
        ENGINE, geom_col="geom", crs=CRS_WGS84,
    )
    commerce = gpd.read_postgis(
        "SELECT comm_cd, comm_nm, comm_type, ST_Transform(geom, 4326) AS geom FROM commerce_boundary",
        ENGINE, geom_col="geom", crs=CRS_WGS84,
    )
    print(f"로드 완료: 행정동 {len(admin)}건, 상권 {len(commerce)}건")
    return admin, commerce


def _repair_geometries(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """유효하지 않은 폴리곤을 buffer(0)으로 수정."""
    invalid = ~gdf.geometry.is_valid
    if invalid.any():
        print(f"  WARN: {invalid.sum()}개 유효하지 않은 폴리곤 — buffer(0) 수정")
        gdf = gdf.copy()
        gdf.loc[invalid, "geometry"] = gdf.loc[invalid, "geometry"].buffer(0)
    return gdf


def compute_mapping(
    admin: gpd.GeoDataFrame,
    commerce: gpd.GeoDataFrame,
) -> pd.DataFrame:
    """폴리곤 교차 면적 비율을 계산하여 매핑 DataFrame 반환."""

    # 투영 좌표계로 변환 + 유효성 수정 (면적 계산 정확도)
    admin_proj = _repair_geometries(admin.to_crs(CRS_PROJECTED))
    commerce_proj = _repair_geometries(commerce.to_crs(CRS_PROJECTED))

    # 각 폴리곤의 전체 면적 미리 계산
    admin_proj["adm_area"] = admin_proj.geometry.area
    commerce_proj["comm_area"] = commerce_proj.geometry.area

    # 퇴화 폴리곤 (면적 0) 제거
    zero_adm = admin_proj["adm_area"] == 0
    zero_comm = commerce_proj["comm_area"] == 0
    if zero_adm.any():
        print(f"  WARN: 면적 0인 행정동 {zero_adm.sum()}개 제거")
        admin_proj = admin_proj[~zero_adm]
    if zero_comm.any():
        print(f"  WARN: 면적 0인 상권 {zero_comm.sum()}개 제거")
        commerce_proj = commerce_proj[~zero_comm]

    # 교차 영역 계산
    overlay = gpd.overlay(
        admin_proj[["adm_cd", "adm_nm", "adm_area", "geometry"]],
        commerce_proj[["comm_cd", "comm_nm", "comm_area", "geometry"]],
        how="intersection",
    )

    if overlay.empty:
        print("교차 영역 없음")
        return pd.DataFrame()

    overlay["overlap_area"] = overlay.geometry.area

    # 면적 비율 계산
    overlay["comm_area_ratio"] = overlay["overlap_area"] / overlay["comm_area"]
    overlay["adm_area_ratio"] = overlay["overlap_area"] / overlay["adm_area"]

    # 극소 교차 제거 (면적 비율 0.1% 미만)
    overlay = overlay[overlay["comm_area_ratio"] >= 0.001].copy()

    result = overlay[
        ["adm_cd", "comm_cd", "overlap_area", "comm_area_ratio", "adm_area_ratio"]
    ].round({"overlap_area": 2, "comm_area_ratio": 6, "adm_area_ratio": 6})

    print(f"매핑 생성: {len(result)}건 (행정동 {result['adm_cd'].nunique()}개 × 상권 {result['comm_cd'].nunique()}개)")
    return result


def save_mapping(df: pd.DataFrame) -> None:
    """매핑 결과를 DB에 저장 (단일 트랜잭션: TRUNCATE → INSERT)."""
    with ENGINE.begin() as conn:
        conn.execute(text("TRUNCATE TABLE adm_comm_mapping"))
        df.to_sql("adm_comm_mapping", conn, if_exists="append", index=False)
    print(f"DB 저장 완료: {len(df)}건")


def validate_mapping(df: pd.DataFrame) -> bool:
    """매핑 품질 검증."""
    ok = True

    # 상권별 comm_area_ratio 합 ≈ 1.0 확인
    ratio_sum = df.groupby("comm_cd")["comm_area_ratio"].sum()
    bad = ratio_sum[(ratio_sum < 0.95) | (ratio_sum > 1.05)]
    if len(bad) > 0:
        print(f"WARN: 상권 {len(bad)}개의 comm_area_ratio 합이 [0.95, 1.05] 범위 밖")
        print(bad.head(5))
        ok = False

    # 음수 비율 확인
    if (df["comm_area_ratio"] < 0).any() or (df["adm_area_ratio"] < 0).any():
        print("FAIL: 음수 비율 발견")
        ok = False

    if ok:
        print("PASS: 매핑 검증 통과")
    return ok


# ── 테스트: 합성 데이터 ─────────────────────────────────
def run_test() -> None:
    """합성 폴리곤으로 알고리즘 검증."""
    print("=== 합성 데이터 테스트 ===\n")

    # 행정동 2개: 나란한 사각형 (127.0~127.01, 37.5~37.51)
    #   A: 왼쪽 절반, B: 오른쪽 절반
    admin = gpd.GeoDataFrame(
        {
            "adm_cd": ["11680100", "11680200"],
            "adm_nm": ["테스트동A", "테스트동B"],
            "gu_nm": ["강남구", "강남구"],
        },
        geometry=[
            box(127.000, 37.500, 127.005, 37.510),  # A: 왼쪽
            box(127.005, 37.500, 127.010, 37.510),  # B: 오른쪽
        ],
        crs=CRS_WGS84,
    )

    # 상권 3개:
    #   C1: A에만 포함 (완전 포함)
    #   C2: A-B에 걸침 (50:50 기대)
    #   C3: B에만 포함 (완전 포함)
    commerce = gpd.GeoDataFrame(
        {
            "comm_cd": ["3110001", "3110002", "3110003"],
            "comm_nm": ["상권C1", "상권C2", "상권C3"],
            "comm_type": ["골목상권", "발달상권", "골목상권"],
        },
        geometry=[
            box(127.001, 37.502, 127.004, 37.508),        # C1: A 안에
            box(127.003, 37.503, 127.007, 37.507),        # C2: A-B 걸침
            box(127.006, 37.501, 127.009, 37.509),        # C3: B 안에
        ],
        crs=CRS_WGS84,
    )

    print(f"행정동: {len(admin)}개, 상권: {len(commerce)}개")

    result = compute_mapping(admin, commerce)
    print(f"\n매핑 결과:\n{result.to_string(index=False)}\n")

    # 검증
    validate_mapping(result)

    # 케이스별 검증
    c1_rows = result[result["comm_cd"] == "3110001"]
    c2_rows = result[result["comm_cd"] == "3110002"]
    c3_rows = result[result["comm_cd"] == "3110003"]

    # C1: A에만 포함 → comm_area_ratio ≈ 1.0
    assert len(c1_rows) == 1, f"C1은 1개 행정동에만 매핑되어야 함 (실제: {len(c1_rows)})"
    assert c1_rows.iloc[0]["adm_cd"] == "11680100", "C1은 행정동A에 매핑"
    assert abs(c1_rows.iloc[0]["comm_area_ratio"] - 1.0) < 0.01, "C1 비율 ≈ 1.0"

    # C2: A-B에 걸침 → 약 50:50
    assert len(c2_rows) == 2, f"C2는 2개 행정동에 매핑되어야 함 (실제: {len(c2_rows)})"
    c2_a = c2_rows[c2_rows["adm_cd"] == "11680100"]["comm_area_ratio"].values[0]
    c2_b = c2_rows[c2_rows["adm_cd"] == "11680200"]["comm_area_ratio"].values[0]
    assert abs(c2_a - 0.5) < 0.05, f"C2-A 비율 ≈ 0.5 (실제: {c2_a:.3f})"
    assert abs(c2_b - 0.5) < 0.05, f"C2-B 비율 ≈ 0.5 (실제: {c2_b:.3f})"
    assert abs(c2_a + c2_b - 1.0) < 0.01, "C2 비율 합 ≈ 1.0"

    # C3: B에만 포함 → comm_area_ratio ≈ 1.0
    assert len(c3_rows) == 1, f"C3은 1개 행정동에만 매핑되어야 함 (실제: {len(c3_rows)})"
    assert c3_rows.iloc[0]["adm_cd"] == "11680200", "C3은 행정동B에 매핑"
    assert abs(c3_rows.iloc[0]["comm_area_ratio"] - 1.0) < 0.01, "C3 비율 ≈ 1.0"

    print("모든 테스트 PASS")


# ── main ─────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="행정동-상권 공간 결합")
    parser.add_argument("--test", action="store_true", help="합성 데이터로 테스트")
    args = parser.parse_args()

    if args.test:
        run_test()
        return

    # 실제 실행
    admin, commerce = load_boundaries()
    if admin.empty or commerce.empty:
        print("ERROR: admin_boundary 또는 commerce_boundary가 비어있습니다.")
        print("  SHP 파일을 먼저 적재하세요:")
        print("  python -m backend.pipeline.load_spatial admin <shp_path>")
        print("  python -m backend.pipeline.load_spatial commerce <shp_path>")
        sys.exit(1)

    result = compute_mapping(admin, commerce)
    if result.empty:
        print("ERROR: 교차 영역이 없습니다. CRS를 확인하세요.")
        sys.exit(1)

    if not validate_mapping(result):
        print("ERROR: 검증 실패. DB 저장 중단.")
        sys.exit(1)
    save_mapping(result)


if __name__ == "__main__":
    main()
