"""Generate Canva-friendly editable SVGs for the spiceMap IA diagram.

The IA is split into two 16:9 screens so no branch runs below the canvas:

1. map/filter screen
2. AI/explore screen

The SVGs intentionally use only simple rect, line, and text elements so Canva
can separate and edit the objects after upload.
"""
from __future__ import annotations

from pathlib import Path
from shutil import copyfile
from xml.sax.saxutils import escape


OUT_1 = Path("docs/spicemap_ia_canva_editable_01.svg")
OUT_2 = Path("docs/spicemap_ia_canva_editable_02.svg")
OUT_COMPAT = Path("docs/spicemap_ia_canva_editable.svg")
W, H = 1920, 1080

FONT = "Malgun Gothic, Noto Sans KR, Arial, sans-serif"
TEXT = "#111827"
MUTED = "#6b7280"
LINE = "#8b98a8"
ROOT = "#f97316"
ROOT_LINE = "#c2410c"
SECTION = "#fbbf24"
SECTION_LINE = "#d97706"
NODE = "#ffffff"
LEAF = "#f8fafc"
BOX_LINE = "#a7b0bb"
LEAF_LINE = "#cbd5e1"


def rect(x, y, w, h, fill, stroke, sw=2, rx=2):
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
    )


def line(x1, y1, x2, y2):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{LINE}" stroke-width="2"/>'


def text(x, y, value, size=16, weight=700, color=TEXT):
    return (
        f'<text x="{x}" y="{y}" text-anchor="middle" dominant-baseline="middle" '
        f'font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
        f'fill="{color}">{escape(value)}</text>'
    )


def title(x, y, value, size=32, weight=800, color=TEXT):
    return (
        f'<text x="{x}" y="{y}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="{size}" font-weight="{weight}" fill="{color}">{escape(value)}</text>'
    )


def box(cx, y, w, h, label, kind="node"):
    if kind == "root":
        fill, stroke, size, weight, color = ROOT, ROOT_LINE, 21, 800, "#ffffff"
    elif kind == "section":
        fill, stroke, size, weight, color = SECTION, SECTION_LINE, 20, 800, TEXT
    elif kind == "leaf":
        fill, stroke, size, weight, color = LEAF, LEAF_LINE, 14, 600, "#374151"
    else:
        fill, stroke, size, weight, color = NODE, BOX_LINE, 16, 700, TEXT
    x = int(cx - w / 2)
    return [
        rect(x, y, w, h, fill, stroke, 2 if kind in {"root", "section"} else 1.5),
        text(cx, y + h / 2 + 1, label, size, weight, color),
    ]


def header_parts(screen_no: str, subtitle: str):
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
        title(W / 2, 42, f"spiceMap IA 화면 구조 {screen_no}", 32, 800),
        title(W / 2, 72, subtitle, 16, 500, MUTED),
    ]
    return parts


def draw_root(parts, left_section, right_section):
    root_cx = W / 2
    parts.extend(box(root_cx, 105, 230, 52, "spiceMap", "root"))
    parts.append(line(root_cx, 157, root_cx, 202))
    parts.extend(box(root_cx, 202, 230, 48, "메인 화면", "node"))
    branch_y = 300
    section_y = 340
    left_cx, right_cx = 480, 1440
    parts.append(line(root_cx, 250, root_cx, branch_y))
    parts.append(line(left_cx, branch_y, right_cx, branch_y))
    for cx, label in [(left_cx, left_section), (right_cx, right_section)]:
        parts.append(line(cx, branch_y, cx, section_y))
        parts.extend(box(cx, section_y, 280, 54, label, "section"))
    return left_cx, right_cx, section_y


def draw_group(parts, cx, x_offset, y, group_title, leaves):
    """Draw one compact group card."""
    node_w, node_h = 260, 42
    leaf_w, leaf_h = 230, 30
    gap = 9
    parts.extend(box(cx + x_offset, y, node_w, node_h, group_title, "node"))
    child_x = cx + x_offset
    leaf_y = y + node_h + 18
    parts.append(line(child_x, y + node_h, child_x, leaf_y))
    for i, leaf in enumerate(leaves):
        ly = leaf_y + i * (leaf_h + gap)
        if i > 0:
            parts.append(line(child_x, ly - gap, child_x, ly))
        parts.extend(box(child_x, ly, leaf_w, leaf_h, leaf, "leaf"))
    return leaf_y + len(leaves) * leaf_h + max(0, len(leaves) - 1) * gap


def draw_section_groups(parts, section_cx, section_y, groups):
    """Draw four groups in a 2x2 layout under one section."""
    x_offsets = [-170, 170, -170, 170]
    y_values = [455, 455, 730, 730]
    for (group_title, leaves), x_offset, y in zip(groups, x_offsets, y_values):
        group_cx = section_cx + x_offset
        parts.append(line(section_cx, section_y + 54, section_cx, y - 28))
        parts.append(line(section_cx, y - 28, group_cx, y - 28))
        parts.append(line(group_cx, y - 28, group_cx, y))
        draw_group(parts, section_cx, x_offset, y, group_title, leaves)


def build_screen_1():
    parts = header_parts("1/2", "지도 영역 + 필터설정")
    left_cx, right_cx, section_y = draw_root(parts, "지도 영역", "1. 필터설정")
    draw_section_groups(
        parts,
        left_cx,
        section_y,
        [
            ("지도 기본 레이어", ["서울 행정구역", "상권 경계", "기본 지도 스타일"]),
            ("AI 결과 표시", ["추천/주의/비추천 마커", "선택 상권 강조", "상권 등급 색상"]),
            ("유동인구 레이어", ["OD 흐름선", "시간대별 흐름", "유형별 흐름"]),
            ("지도 인터랙션", ["줌 / 이동", "상권 클릭 선택", "지도 중심 이동"]),
        ],
    )
    draw_section_groups(
        parts,
        right_cx,
        section_y,
        [
            ("업종 선택", ["업종 목록 조회", "업종 드롭다운", "선택 업종 표시"]),
            ("관심 자치구 선택", ["전체 선택 / 초기화", "권역 그룹 선택", "자치구 검색", "구별 선택 버튼"]),
            ("분석 기준", ["분기 선택", "선택 조건 요약", "분석 가능 상태"]),
            ("분석 실행", ["AI 분석 버튼", "로딩 상태", "오류 메시지"]),
        ],
    )
    parts.append(title(W / 2, H - 36, "화면 1: 사용자가 분석 범위를 정하고 지도에서 기본 상권 구조를 확인하는 영역", 16, 500, MUTED))
    parts.append("</svg>")
    return "\n".join(parts)


def build_screen_2():
    parts = header_parts("2/2", "AI 분석 + 상권 탐색")
    left_cx, right_cx, section_y = draw_root(parts, "2. AI 분석", "3. 상권 탐색")
    draw_section_groups(
        parts,
        left_cx,
        section_y,
        [
            ("분석 데이터", ["상권 분석 데이터", "업종 점포 데이터", "OD 유동인구"]),
            ("5개 지표 가중합산", ["GRI 역점수 25%", "유동인구량 20%", "폐업 안정성 25%", "업종 점포 기반 20%", "네트워크 중심성 10%"]),
            ("3등급 자동분류", ["추천: 상위 30%", "주의: 중간 40%", "비추천: 하위 30%"]),
            ("Claude AI 해설", ["전체 요약", "주의 문구", "카드별 추천 이유"]),
        ],
    )
    draw_section_groups(
        parts,
        right_cx,
        section_y,
        [
            ("추천 카드 목록", ["상권명 / 자치구", "점수 / 등급", "핵심 이유 / 리스크", "다음 행동 제안"]),
            ("지도 위치 확인", ["선택 상권 위치", "지도 중심 이동", "주변 상권 비교"]),
            ("상권 상세 지표", ["GRI", "순유동", "폐업률", "적합도 / 상권 특성"]),
            ("유동인구 확인", ["시간대 슬라이더", "유형별 필터", "흐름 밀도 조절", "재생 / 일시정지"]),
        ],
    )
    parts.append(title(W / 2, H - 36, "화면 2: AI가 추천 결과를 만들고 사용자가 추천 상권을 지도·지표·유동인구로 탐색하는 영역", 16, 500, MUTED))
    parts.append("</svg>")
    return "\n".join(parts)


if __name__ == "__main__":
    OUT_1.write_text(build_screen_1(), encoding="utf-8")
    OUT_2.write_text(build_screen_2(), encoding="utf-8")
    copyfile(OUT_1, OUT_COMPAT)
    print(f"created {OUT_1}")
    print(f"created {OUT_2}")
    print(f"updated {OUT_COMPAT} -> screen 1")

