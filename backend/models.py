"""
SQLAlchemy ORM 모델 — 9개 핵심 테이블 정의
공간 데이터는 GeoAlchemy2의 Geometry 타입 사용 (PostGIS 필요)
"""
from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class AdminBoundary(Base):
    """행정동 경계 (서울 행정동 폴리곤)"""
    __tablename__ = "admin_boundary"

    adm_cd = Column(String(10), primary_key=True, comment="행정동 코드")
    adm_nm = Column(String(100), nullable=False, comment="행정동 명")
    gu_nm = Column(String(50), comment="자치구 명")
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)


class CommerceBoundary(Base):
    """상권 경계 (서울시 상권 폴리곤)"""
    __tablename__ = "commerce_boundary"

    comm_cd = Column(String(20), primary_key=True, comment="상권 코드")
    comm_nm = Column(String(100), nullable=False, comment="상권 명")
    comm_type = Column(String(50), comment="상권 유형 (골목상권 등)")
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)


class OdFlow(Base):
    """행정동 간 OD 이동량 원본 (OA-22300)

    원본 파일: seoul_purpose_admdong3_final_YYYYMMDD.csv
    일별 파일이며 st_time_cd=0 (전일 합산).

    팀 공유 대상 아님 — Dev-A 로컬 전용. 원본 80M 행 규모로 팀 간 배포가
    비현실적이라 `od_flows_aggregated` (분기 × 출 × 도 × 목적 집계본)을
    canonical 입력으로 사용한다. 본 테이블은 원본 보존용.
    """
    __tablename__ = "od_flows"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_date = Column(Date, nullable=False, comment="기준일 (etl_ymd)")
    origin_adm_cd = Column(String(10), nullable=False, comment="출발 행정동 코드 (o_admdong_cd)")
    dest_adm_cd = Column(String(10), nullable=False, comment="도착 행정동 코드 (d_admdong_cd)")
    move_purpose = Column(Integer, comment="이동 목적 코드 (1=출근 2=하원 3=귀가 6=? 7=?)")
    in_forn_div = Column(String(10), comment="내외국인 구분 (내국인/단기외국인/장기외국인)")
    trip_count = Column(Float, nullable=False, comment="이동 건수 추정값 (cnt)")


class OdFlowAggregated(Base):
    """행정동 OD 분기 집계본 (팀 공유 원장).

    원본 `od_flows` 8천만 행 → 일자·내외국인 차원 합산으로 수십만 행으로 축소.
    Module A/B/C/D/E의 canonical 입력. Supabase 공유 DB에 적재.

    집계 키: (year_quarter, origin_adm_cd, dest_adm_cd, move_purpose)
    집계 SQL: `backend/pipeline/aggregate_od_flows.py`
    """
    __tablename__ = "od_flows_aggregated"
    __table_args__ = (
        UniqueConstraint(
            "year_quarter", "origin_adm_cd", "dest_adm_cd", "move_purpose",
            name="uq_od_agg",
        ),
        Index("ix_od_agg_origin", "origin_adm_cd"),
        Index("ix_od_agg_dest", "dest_adm_cd"),
        Index("ix_od_agg_quarter", "year_quarter"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter = Column(String(6), nullable=False, comment="YYYYQ# (예: 2026Q1)")
    origin_adm_cd = Column(String(10), nullable=False, comment="출발 행정동 코드")
    dest_adm_cd = Column(String(10), nullable=False, comment="도착 행정동 코드")
    move_purpose = Column(Integer, nullable=True, comment="이동 목적 코드 (NULL 허용)")
    trip_count_sum = Column(Float, nullable=False, comment="일자·내외국인 합산 이동량")


class LivingPopulation(Base):
    """행정동별 서울 생활인구 (OA-14991, SPOP_LOCAL_RESD_DONG)

    기준일(STDR_DE_ID) + 시간대(TMZON_PD_SE) + 행정동(ADSTRD_CODE_SE) 단위
    """
    __tablename__ = "living_population"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_date = Column(Date, nullable=False, comment="기준일 (STDR_DE_ID)")
    hour_slot = Column(Integer, nullable=False, comment="시간대 구분 (0~23시)")
    adm_cd = Column(String(10), nullable=False, comment="행정동 코드 (ADSTRD_CODE_SE)")
    total_pop = Column(Float, comment="총 생활인구 (TOT_LVPOP_CO)")


class StoreInfo(Base):
    """자치구별 점포 정보 — 점포 수·폐업률 (OA-15577, VwsmSignguStorW)

    자치구(SIGNGU_CD) + 업종(SVC_INDUTY_CD) + 분기(STDR_YYQU_CD) 단위
    """
    __tablename__ = "store_info"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter = Column(String(6), nullable=False, comment="연도분기 코드 (예: 20251)")
    signgu_cd = Column(String(10), nullable=False, comment="자치구 코드 (SIGNGU_CD)")
    signgu_nm = Column(String(50), comment="자치구 명")
    industry_cd = Column(String(20), comment="업종 코드 (SVC_INDUTY_CD)")
    industry_nm = Column(String(100), comment="업종 명")
    store_count = Column(Float, comment="점포 수 (STOR_CO)")
    open_rate = Column(Float, comment="개업률 (OPBIZ_RT)")
    open_count = Column(Float, comment="개업 점포 수 (OPBIZ_STOR_CO)")
    close_rate = Column(Float, comment="폐업률 (CLSBIZ_RT)")
    close_count = Column(Float, comment="폐업 점포 수 (CLSBIZ_STOR_CO)")
    franchise_count = Column(Float, comment="프랜차이즈 점포 수 (FRC_STOR_CO)")


class CommerceSales(Base):
    """상권별 추정 매출 (OA-15572, VwsmTrdarSelngQq)

    상권(TRDAR_CD) + 업종(SVC_INDUTY_CD) + 분기(STDR_YYQU_CD) 단위
    """
    __tablename__ = "commerce_sales"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter = Column(String(6), nullable=False, comment="연도분기 코드 (예: 20251)")
    trdar_cd = Column(String(20), nullable=False, comment="상권 코드 (TRDAR_CD)")
    trdar_nm = Column(String(100), comment="상권 명")
    trdar_se_cd = Column(String(5), comment="상권 구분 코드 (A=골목 D=발달 등)")
    industry_cd = Column(String(20), comment="업종 코드 (SVC_INDUTY_CD)")
    industry_nm = Column(String(100), comment="업종 명")
    sales_amount = Column(Float, comment="월 매출액 (THSMON_SELNG_AMT)")
    sales_count = Column(Float, comment="월 매출 건수 (THSMON_SELNG_CO)")
    weekday_sales = Column(Float, comment="주중 매출액 (MDWK_SELNG_AMT)")
    weekend_sales = Column(Float, comment="주말 매출액 (WKEND_SELNG_AMT)")


class CommerceAnalysis(Base):
    """분석 결과 Pre-computed 테이블 (FastAPI가 직접 서빙)"""
    __tablename__ = "commerce_analysis"
    __table_args__ = (
        Index("ix_commerce_analysis_quarter_cd", "year_quarter", "comm_cd"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter = Column(String(7), nullable=False, comment="분기")
    comm_cd = Column(String(20), nullable=False, comment="상권 코드")
    comm_nm = Column(String(100), comment="상권 명")
    gri_score = Column(Float, comment="상권 위험 지수 (0~100)")
    flow_volume = Column(BigInteger, comment="유입 이동량 합산")
    dominant_origin = Column(String(10), comment="주 유입 출발 행정동 코드")
    analysis_note     = Column(Text,        comment="정책 제언 텍스트")
    commerce_type     = Column(String(20),  comment="상권 유형 (Module D 5유형)")
    priority_score    = Column(Float,       comment="정책 우선순위 점수 0~100 (Module E)")
    net_flow          = Column(Float,       comment="순유입(+)/순유출(-) 이동량 (Module A)")
    degree_centrality = Column(Float,       comment="네트워크 연결 중심성 (Module A)")
    closure_rate      = Column(Float,       comment="분기 폐업률 % (store_info 집계)")


class AdmCommMapping(Base):
    """행정동-상권 공간 매핑 (면적 교차 비율)

    행정동 데이터(OD 유동, 생활인구)를 상권 단위로 배분할 때 사용.
    comm_area_ratio: 상권 면적 중 이 행정동과 겹치는 비율 (행정동→상권 배분용)
    adm_area_ratio: 행정동 면적 중 이 상권과 겹치는 비율 (상권→행정동 역배분용)
    """
    __tablename__ = "adm_comm_mapping"
    __table_args__ = (
        UniqueConstraint("adm_cd", "comm_cd", name="uq_adm_comm"),
        Index("ix_adm_comm_adm_cd", "adm_cd"),
        Index("ix_adm_comm_comm_cd", "comm_cd"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    adm_cd = Column(String(10), nullable=False, comment="행정동 코드")
    comm_cd = Column(String(20), nullable=False, comment="상권 코드")
    overlap_area = Column(Float, comment="교차 면적 (m²)")
    comm_area_ratio = Column(Float, comment="상권 기준 비율 (0~1)")
    adm_area_ratio = Column(Float, comment="행정동 기준 비율 (0~1)")


class FlowBarrier(Base):
    """유동 장벽 분석 결과 (상권 간 이동 단절 지점)"""
    __tablename__ = "flow_barriers"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter = Column(String(7), nullable=False, comment="분기")
    from_comm_cd = Column(String(20), comment="출발 상권 코드")
    to_comm_cd = Column(String(20), comment="도착 상권 코드")
    barrier_score = Column(Float, comment="단절 강도 (높을수록 단절)")
    barrier_type = Column(String(50), comment="단절 유형 (도로/경계 등)")


class PolicyCard(Base):
    """정책 추천 카드 (Module D 결과, 1상권당 0~N건)"""
    __tablename__ = "policy_cards"
    __table_args__ = (
        Index("ix_policy_cards_quarter", "year_quarter"),
        Index("ix_policy_cards_comm_cd", "comm_cd"),
    )

    id                 = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter       = Column(String(7),  nullable=False, comment="분기 (예: 2025Q4)")
    comm_cd            = Column(String(20), nullable=False, comment="상권 코드")
    rule_id            = Column(String(5),  nullable=False, comment="규칙 ID (R4~R7)")
    severity           = Column(String(10), nullable=False, comment="Critical/High/Medium/Low")
    policy_text        = Column(Text,       nullable=False, comment="정책 추천 텍스트")
    rationale          = Column(Text,       comment="근거 1문장")
    triggering_metrics = Column(Text,       comment="발동 지표 JSON 문자열")
    generation_mode    = Column(String(20), nullable=False, default="rule_based")
