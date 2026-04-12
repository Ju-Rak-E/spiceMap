"""
SQLAlchemy ORM 모델 — 7개 핵심 테이블 정의
공간 데이터는 GeoAlchemy2의 Geometry 타입 사용 (PostGIS 필요)
"""
from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    Float,
    Integer,
    String,
    Text,
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
    """행정동 간 OD 이동량 (OA-22300)

    원본 파일: seoul_purpose_admdong3_final_YYYYMMDD.csv
    일별 파일이며 st_time_cd=0 (전일 합산)
    """
    __tablename__ = "od_flows"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_date = Column(Date, nullable=False, comment="기준일 (etl_ymd)")
    origin_adm_cd = Column(String(10), nullable=False, comment="출발 행정동 코드 (o_admdong_cd)")
    dest_adm_cd = Column(String(10), nullable=False, comment="도착 행정동 코드 (d_admdong_cd)")
    move_purpose = Column(Integer, comment="이동 목적 코드 (1=출근 2=하원 3=귀가 6=? 7=?)")
    in_forn_div = Column(String(10), comment="내외국인 구분 (내국인/단기외국인/장기외국인)")
    trip_count = Column(Float, nullable=False, comment="이동 건수 추정값 (cnt)")


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

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter = Column(String(7), nullable=False, comment="분기")
    comm_cd = Column(String(20), nullable=False, comment="상권 코드")
    comm_nm = Column(String(100), comment="상권 명")
    gri_score = Column(Float, comment="상권 위험 지수 (0~100)")
    flow_volume = Column(BigInteger, comment="유입 이동량 합산")
    dominant_origin = Column(String(10), comment="주 유입 출발 행정동 코드")
    analysis_note = Column(Text, comment="정책 제언 텍스트")


class FlowBarrier(Base):
    """유동 장벽 분석 결과 (상권 간 이동 단절 지점)"""
    __tablename__ = "flow_barriers"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    year_quarter = Column(String(7), nullable=False, comment="분기")
    from_comm_cd = Column(String(20), comment="출발 상권 코드")
    to_comm_cd = Column(String(20), comment="도착 상권 코드")
    barrier_score = Column(Float, comment="단절 강도 (높을수록 단절)")
    barrier_type = Column(String(50), comment="단절 유형 (도로/경계 등)")
