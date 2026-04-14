"""KDS 41 30 00 기준 RC보 설계 검토 엔진

단위 체계: MPa, mm, N (부재력 입력은 kN, kN·m → 내부에서 N, N·mm 변환)
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .kds_common import clamp, demand_capacity_ratio, linear_interpolate


# ── 철근 규격 (공칭 단면적, mm²) ──

REBAR_AREA: dict[int, float] = {
    10: 71.3, 13: 126.7, 16: 198.6, 19: 286.5,
    22: 387.1, 25: 506.7, 29: 642.4, 32: 794.2, 35: 956.6,
}


def rebar_area(dia: int, count: int) -> float:
    """철근 총 단면적 (mm²)"""
    return REBAR_AREA.get(dia, 0.0) * count


def stirrup_area(dia: int, legs: int = 2) -> float:
    """스터럽 총 단면적 Av (mm²), 기본 2-leg"""
    return REBAR_AREA.get(dia, 0.0) * legs


# ── 기본 계수 ──

def beta1(fck: float) -> float:
    """[KDS 41 30 00] 등가직사각형 응력블록 계수 beta1."""
    if fck <= 28:
        return 0.85
    return max(0.85 - 0.007 * (fck - 28), 0.65)


def effective_depth(H: float, cover: float, stirrup_dia: float, main_dia: float) -> float:
    """[KDS 41 30 00] 유효깊이 d (mm)."""
    return H - cover - stirrup_dia - main_dia / 2


def flexure_phi_from_tension_strain(epsilon_t: float) -> float:
    """[KDS 41 30 00] 인장철근 변형률 기반 강도감소계수 phi 계산."""
    if epsilon_t >= 0.005:
        return 0.85
    if epsilon_t <= 0.002:
        return 0.65
    phi = linear_interpolate(epsilon_t, 0.002, 0.65, 0.005, 0.85)
    return clamp(phi, 0.65, 0.85)


def concrete_shear_strength_kN(B: float, d: float, fck: float) -> float:
    """[KDS 41 30 00] 콘크리트 전단강도 Vc = (1/6)*sqrt(fck)*B*d (kN)."""
    return (1 / 6) * math.sqrt(fck) * B * d / 1000


# ── 휨강도 ──

@dataclass
class FlexureResult:
    Mu_d: float       # 설계모멘트 (kN·m)
    phi_Mn: float      # 설계휨강도 (kN·m)
    dcr: float         # Demand/Capacity Ratio
    ok: bool
    a: float           # 등가응력블록 깊이 (mm)
    c: float           # 중립축 깊이 (mm)
    phi: float         # 강도감소계수
    epsilon_t: float   # 인장철근 변형률


def calc_flexural_strength(
    B: float, d: float, As: float, fck: float, fy: float, Mu_kNm: float,
) -> FlexureResult:
    """[KDS 41 30 00] 휨강도 검토 (등가직사각형 응력블록법).

    Args:
        B: 폭 (mm), d: 유효깊이 (mm), As: 인장철근 단면적 (mm²)
        fck: 콘크리트 설계기준강도 (MPa), fy: 철근 항복강도 (MPa)
        Mu_kNm: 설계모멘트 (kN·m, 절대값)
    """
    if As <= 0 or B <= 0 or d <= 0:
        return FlexureResult(Mu_d=Mu_kNm, phi_Mn=0, dcr=999, ok=False,
                             a=0, c=0, phi=0, epsilon_t=0)

    a = As * fy / (0.85 * fck * B)
    b1 = beta1(fck)
    c = a / b1

    # 인장철근 변형률
    epsilon_t = 0.003 * (d - c) / c if c > 0 else 999

    # [KDS 41 30 00] 변형률 기반 강도감소계수
    phi = flexure_phi_from_tension_strain(epsilon_t)

    # 설계휨강도 (N·mm → kN·m)
    phi_Mn = phi * As * fy * (d - a / 2) / 1e6

    Mu_abs = abs(Mu_kNm)
    dcr = demand_capacity_ratio(Mu_abs, phi_Mn)

    return FlexureResult(
        Mu_d=Mu_abs, phi_Mn=round(phi_Mn, 2), dcr=round(dcr, 4),
        ok=dcr <= 1.0, a=round(a, 1), c=round(c, 1),
        phi=round(phi, 3), epsilon_t=round(epsilon_t, 5),
    )


# ── 전단강도 ──

@dataclass
class ShearResult:
    Vu_d: float        # 설계전단력 (kN)
    phi_Vn: float      # 설계전단강도 (kN)
    dcr: float
    ok: bool
    Vc: float          # 콘크리트 전단강도 (kN)
    Vs: float          # 스터럽 전단강도 (kN)
    phi: float


def calc_shear_strength(
    B: float, d: float, fck: float, fyt: float,
    Av: float, s: float, Vu_kN: float,
) -> ShearResult:
    """[KDS 41 30 00] 전단강도 검토.

    Args:
        B, d: mm, fck, fyt: MPa, Av: 스터럽 단면적 (mm²),
        s: 스터럽 간격 (mm), Vu_kN: 설계전단력 (kN, 절대값)
    """
    phi = 0.75

    # [KDS 41 30 00] Vc = (1/6)*sqrt(fck)*B*d (N) -> kN
    Vc = concrete_shear_strength_kN(B, d, fck)

    # Vs = Av × fyt × d / s (N) → kN
    Vs = (Av * fyt * d / s / 1000) if s > 0 and Av > 0 else 0

    phi_Vn = phi * (Vc + Vs)
    Vu_abs = abs(Vu_kN)
    dcr = demand_capacity_ratio(Vu_abs, phi_Vn)

    return ShearResult(
        Vu_d=Vu_abs, phi_Vn=round(phi_Vn, 2), dcr=round(dcr, 4),
        ok=dcr <= 1.0, Vc=round(Vc, 2), Vs=round(Vs, 2), phi=phi,
    )


# ── 최소/최대 철근비 ──

@dataclass
class RebarRatioResult:
    rho: float
    rho_min: float
    rho_max: float
    min_ok: bool
    max_ok: bool


def check_rebar_ratio(
    As: float, B: float, d: float, fck: float, fy: float,
) -> RebarRatioResult:
    """[KDS 41 30 00] 최소/최대 철근비 검토."""
    rho = As / (B * d) if B * d > 0 else 0

    # [KDS 41 30 00] 최소철근비: max(0.25*sqrt(fck)/fy, 1.4/fy)
    rho_min = max(0.25 * math.sqrt(fck) / fy, 1.4 / fy)

    # [KDS 41 30 00] 최대철근비: 0.75 * rho_b
    b1 = beta1(fck)
    rho_b = 0.85 * b1 * fck / fy * 600 / (600 + fy)
    rho_max = 0.75 * rho_b

    return RebarRatioResult(
        rho=round(rho, 6), rho_min=round(rho_min, 6), rho_max=round(rho_max, 6),
        min_ok=rho >= rho_min, max_ok=rho <= rho_max,
    )


# ── 스터럽 간격 ──

@dataclass
class StirrupSpacingResult:
    spacing: float
    max_spacing: float
    ok: bool


def check_stirrup_spacing(
    d: float, fck: float, B: float, Vs_kN: float, s: float,
) -> StirrupSpacingResult:
    """[KDS 41 30 00] 스터럽 최대간격 검토."""
    # [KDS 41 30 00] Vs 한계 = (1/6)*sqrt(fck)*B*d (N) -> kN
    Vs_limit = concrete_shear_strength_kN(B, d, fck)

    if Vs_kN <= Vs_limit:
        s_max = min(d / 2, 600)
    else:
        s_max = min(d / 4, 300)

    return StirrupSpacingResult(
        spacing=s, max_spacing=round(s_max, 1), ok=s <= s_max,
    )


# ── 통합 검토 ──

@dataclass
class PositionCheck:
    section_name: str
    position: str  # "I", "C", "J"
    flex_neg: FlexureResult   # 상부근 (음의 모멘트)
    flex_pos: FlexureResult   # 하부근 (양의 모멘트)
    shear: ShearResult
    rebar_ratio: RebarRatioResult
    stirrup: StirrupSpacingResult
    all_ok: bool


def check_position(
    section_name: str,
    position: str,
    B: float,           # mm
    H: float,           # mm
    cover: float,        # mm
    fck: float,          # MPa
    fy: float,           # MPa
    fyt: float,          # MPa
    top_dia: int,
    top_count: int,
    bot_dia: int,
    bot_count: int,
    stirrup_dia: int,
    stirrup_legs: int = 2,
    stirrup_spacing: float = 200,  # mm
    Mu_neg_kNm: float = 0,  # 음의 모멘트 (상부근 인장)
    Mu_pos_kNm: float = 0,  # 양의 모멘트 (하부근 인장)
    Vu_kN: float = 0,       # 전단력
) -> PositionCheck:
    """[KDS 41 30 00] 단일 위치(I/C/J)에 대한 통합 검토."""

    As_top = rebar_area(top_dia, top_count)
    As_bot = rebar_area(bot_dia, bot_count)
    Av = stirrup_area(stirrup_dia, stirrup_legs)

    # 유효깊이 (음의 모멘트: 상부근 인장 → d from 하단, 양의 모멘트: 하부근 인장 → d from 상단)
    d_neg = effective_depth(H, cover, stirrup_dia, top_dia) if top_count > 0 else H * 0.9
    d_pos = effective_depth(H, cover, stirrup_dia, bot_dia) if bot_count > 0 else H * 0.9

    # 휨 검토 (상부/하부 별도)
    flex_neg = calc_flexural_strength(B, d_neg, As_top, fck, fy, Mu_neg_kNm)
    flex_pos = calc_flexural_strength(B, d_pos, As_bot, fck, fy, Mu_pos_kNm)

    # 전단 검토 (d는 큰 값 사용)
    d_shear = max(d_neg, d_pos)
    shear = calc_shear_strength(B, d_shear, fck, fyt, Av, stirrup_spacing, Vu_kN)

    # 철근비 (인장측 기준, 음/양 모멘트 중 큰 쪽)
    if abs(Mu_neg_kNm) >= abs(Mu_pos_kNm):
        ratio = check_rebar_ratio(As_top, B, d_neg, fck, fy)
    else:
        ratio = check_rebar_ratio(As_bot, B, d_pos, fck, fy)

    # 스터럽 간격
    stirrup_check = check_stirrup_spacing(d_shear, fck, B, shear.Vs, stirrup_spacing)

    all_ok = flex_neg.ok and flex_pos.ok and shear.ok and ratio.min_ok and ratio.max_ok and stirrup_check.ok

    return PositionCheck(
        section_name=section_name,
        position=position,
        flex_neg=flex_neg,
        flex_pos=flex_pos,
        shear=shear,
        rebar_ratio=ratio,
        stirrup=stirrup_check,
        all_ok=all_ok,
    )
