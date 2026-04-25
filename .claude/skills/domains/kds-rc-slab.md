---
name: kds-rc-slab
description: KDS 14 20 RC 슬래브 설계 도메인 지식. 처짐(14 20 30) / 최소철근비(14 20 50) / 양방향 근사(14 20 70) / 뚫림전단(14 20 22) 조항 + 적용 값.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: KDS 14 20:2022
applies_to: rc-slab-reviewer 에이전트
---

# KDS 14 20 — RC 슬래브 도메인 지식

본 문서는 RC 슬래브 검토에 필요한 KDS 조항과 적용 값을 정리한다. 코드 작성 규칙은 별도 `rules/kds_code.md`.

## 1. KDS 14 20 30 — 처짐 (사용성)

### 1.1 1방향 슬래브 ℓ/h 한계 (표 4.2-1)

처짐 계산 생략 시 최소 두께 h ≥ ℓ/k. 보통 콘크리트 + fy=400 MPa 기준:

| 경계조건 | k (1방향 슬래브) |
|---------|------------------|
| 단순지지(simply supported) | 20 |
| 1단 연속(one end continuous) | 24 |
| 양단 연속(both ends continuous) | 28 |
| 캔틸레버(cantilever) | 10 |

fy ≠ 400 MPa 보정: `k_corr = k × (0.43 + fy/700)`

### 1.2 2방향 슬래브 처짐

장단변비 β = ℓy/ℓx. 표 4.2-2 (또는 ACI 표 9.5(c)) 의 단부조건별 두께 한계.

판단 규칙:
- 단변(ℓx) 기준 ℓ/h ≤ 한계값 → 처짐 검토 생략 가능
- 초과 시 정밀 처짐 계산 필수 (사용하중 + 균열 단면 + 장기 처짐 계수 ξ)

### 1.3 적용 (rc-slab-reviewer)
1. 패널의 short_span / 두께 → ℓ/h 비
2. 패널 경계조건 (TYPE A~E) 매핑
3. 한계비 초과 시 N.G + "두께 증가" 또는 "정밀 처짐 계산 필요"

## 2. KDS 14 20 50 — 최소·최대 철근비 / 온도수축

### 2.1 휨 부재 최소 철근비 ρmin
```
ρmin = max(0.25 × √fck / fy, 1.4 / fy)
```
fy=400 MPa, fck=24 MPa → ρmin ≈ 0.0035

### 2.2 최대 철근비 ρmax (취성파괴 방지)
```
ρmax = 0.75 × ρb (ρb = 균형철근비, KDS 14 20 20)
```

### 2.3 슬래브 온도수축 철근 (4.6)
```
As_min = 0.002 × b × h         (fy ≤ 400 MPa)
As_min = 0.0018 × b × h        (fy = 400 MPa, 표준)
As_min = 0.0018 × 400/fy × b × h (fy > 400 MPa)
```
- 간격: ≤ 5h 또는 ≤ 450mm (둘 중 작은 값)

### 2.4 적용 (rc-slab-reviewer)
- 상부근/하부근 각각 ρ = As/(b·d) 계산 → ρmin ≤ ρ ≤ ρmax
- 온도수축 철근은 단변 방향 별도 검토

## 3. KDS 14 20 70 부록 — 양방향 슬래브 근사 휨 (계수법)

### 3.1 1방향 vs 2방향 분류
- **β = ℓy / ℓx ≥ 2.0 → 1방향** (단변 방향만 휨 검토)
- **β < 2.0 → 2방향** (양 방향 휨 검토)

(slab_span.py 가 자동 분류 — `Slab.way_type` 필드)

### 3.2 정사각형 또는 직사각형 패널 — 모멘트 계수표

단변 방향 모멘트:
```
Mx = α_x · Wu · ℓx²
```
장변 방향 모멘트:
```
My = α_y · Wu · ℓx²        (ℓx 사용 — KDS 표기 주의)
```

α_x, α_y 는 패널 경계조건(8 종)과 β 에 따른 표값 (KDS 14 20 70 부록 또는 ACI Table 13.6.4.1)

### 3.3 적용 (rc-slab-reviewer)
1. Wu = 1.2D + 1.6L (이미 Load Map 에서 계산됨)
2. 경계조건별 α_x, α_y 조회
3. 소요 As = Mu / (φ · fy · jd) 근사 (jd ≈ 0.9d)
4. 시공된 As 와 비교 → DCR

> **주의**: Phase 1 의 근사값. Phase 2 에서 MIDAS Plate 해석 + Wood-Armer 로 정밀화.

## 4. KDS 14 20 22 — 뚫림전단 (Punching Shear)

### 4.1 위험단면
기둥 면에서 d/2 떨어진 지점의 사변형 (사각기둥 가정).

### 4.2 공칭 전단강도 Vc (작은 값 적용)
```
Vc = min(
    (1 + 2/βc) · √fck/6 · bo · d,
    (αs · d/bo + 2) · √fck/12 · bo · d,
    √fck/3 · bo · d
)
```
- βc = 기둥 장변/단변 비
- αs = 40 (내부), 30 (외부), 20 (모서리)
- bo = 위험단면 둘레
- d = 슬래브 유효깊이

### 4.3 소요 전단력 Vu
```
Vu = Wu × (위험단면 외부 면적)
```
실내/외/모서리 기둥별로 면적 계산 차이.

### 4.4 적용 (rc-slab-reviewer)
- `/db/ELEM` 의 TYPE=COLUMN 위치 검출
- 각 기둥 주변 위험단면 → Vu vs φVc
- φ = 0.75
- DCR > 1.0 → "전단보강근 필요" 또는 "기둥 머리(drop panel) 도입"

## 5. 부속 조항 (참고만, 본 에이전트 직접 검토 X)

- KDS 14 20 20 — 휨 부재 일반 (ρb 계산)
- KDS 14 20 24 — 전단 (단방향)
- KDS 14 20 60 — 사용성 — 균열 (Wcr ≤ 0.3 mm 노출 환경)

## 6. 단위 / 기호 규약

`_shared/output-contract.md` §2 따름. 보충:
- ℓ, h, d : mm
- ρ, β : 무차원
- fck, fy : MPa
- Wu : kN/m²
- Mx, My : kN·m/m (단위 폭당)
- Vc, Vu : kN

## 7. 검증 체크리스트 (rc-slab-reviewer 자체)

- [ ] short_span/long_span 분류와 way_type 일치
- [ ] 경계조건이 도면/모델과 일치
- [ ] Wu 가 Load Map(FBLA+FBLD) 와 일치
- [ ] ρmin/ρmax 검토 누락 없음
- [ ] 뚫림전단 — 기둥 위치 모두 검토
- [ ] DCR 색상 코딩 (≤1.0 녹색, >1.0 적색)
