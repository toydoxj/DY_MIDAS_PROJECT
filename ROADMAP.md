# MIDAS Dashboard 확장 로드맵

`/member-check/slab-span` 을 시작으로 `/loadcase/load-map`, `/project-settings` 까지
이어진 흐름의 다음 단계를 **순서 중심**으로 정리한다. 구체적 일정·기한은 두지 않으며,
실행 단위로 쪼개지면 `.claude/plans/*.md` 또는 GitHub Issue 로 승격한다.

단기 운영/보안 개선은 [BACKLOG.md](./BACKLOG.md), 배포는 GitHub Releases 참조.

## 범례
- **★ 핵심** — 슬래브/하중 설계 업무의 핵심 흐름. 없으면 반쪽짜리.
- **◆ 부가** — 실무 편의/품질 향상.
- **◇ 탐색** — 수요·타당성 불확실. 도입 전 PoC 권장.

---

## ✅ 완성된 토대 (v1.1.0 기준 — 2026-04-25)

### 데이터/엔진
- MIDAS API 연계: `/db/NODE`, `/db/ELEM`, `/db/STOR`, `/db/FBLA`, `/db/FBLD`, `/db/SECT`, `/db/UNIT`
- 패널 탐색: 평면 그래프 face detection + OMBB (회전 사각형 + 삼각형/오각형 인식)
- 사선 보(SKEW) merge + polyline chain — 끊김 없는 시각화
- Floor Load 매칭: point-in-polygon, Wu = 1.2D + 1.6L, DL/LL fallback 분류
- 그리드 자동 탐지: 직교쌍 + 적응 클러스터링 (codex 검토)
- 모델 캐시 리셋 ("모델 다시 읽기")

### UI/UX
- `/member-check/slab-span` — 분류(S) 단위 두께/TYPE(A~E)/X1~X5/Y1~Y5 배근표 + 색상 그룹 + 스냅샷
- `/loadcase/load-map` — FBLA 다각형 + Wu, 등간격 inset 슬라이더, 다중 하중 popover
- `/project-settings` — X/Y 축렬 + 회전 그룹(extra_groups), mm 통일, 기준점(origin) 입력
- 공용 `GridAxesOverlay` (Slab Span / Load Map 양쪽 활용)
- SVG pan/zoom, 양방향 하이라이트, 영속화(JSON)

### 출력
- **Load Map PDF** — 현재 zoom/pan A3 가로, 흰 배경 + 15mm 보더, 한글 헤더 (jsPDF + html-to-image)
- **Load Map DXF** — FBLA 영역 + 솔리드 해치(50% 투명) + fbld 별 컬러 레이어 + 한글 STYLE, mm 고정, shrink 반영 (ezdxf)

---

## Phase 1 — 배근 파싱과 설계 검토 엔진 (가장 자연스러운 다음 단계)

> 이미 입력받고 있는 배근 문자열·경간·두께를 실제 설계 지표로 전환.
> MIDAS 해석 결과 없이 얻을 수 있는 값부터 우선.

| # | 우선 | 항목 | 내용 | 근거 |
|---|------|------|------|------|
| 1.1 | ★ | **배근 문자열 파서** | `HD13@200` → `{dia:13, spacing:200, As_per_m}` 변환 유틸. 모든 검토의 입력 | `kds_rc_beam.py::REBAR_AREA` 재사용 |
| 1.2 | ★ | **처짐 검토** | `short_span / thk` 로 ℓ/h 자동 판정. 경계조건(TYPE A~E)별 허용비 | KDS 14 20 30 표 4.2-1 |
| 1.3 | ★ | **최소·최대 철근비** | ρmin/ρmax + 온도수축 0.002bh | KDS 14 20 50 |
| 1.4 | ◆ | **간단 휨검토 (해석 없이)** | Wu·Lx² 기반 근사 소요 As (양방향 슬래브 계수법) | KDS 14 20 70 부록 |
| 1.5 | ◆ | **뚫림전단 검토** | 기둥 주변 2방향 전단. `/db/ELEM` TYPE=COLUMN 위치 활용 | KDS 14 20 22 |

**Done 기준 후보**: `pytest backend/tests/test_kds_slab.py` ≥ 10 케이스 통과 + 슬래브 페이지에 DCR 색상 코딩.

---

## Phase 2 — MIDAS Plate 해석 결과 연계

> 정밀도 필요한 공정에서 본격 활용. Phase 1 의 근사값을 실측 모멘트로 교체.

| # | 우선 | 항목 | 내용 |
|---|------|------|------|
| 2.1 | ★ | **Plate 부재력 조회** | MIDAS Plate element force API → 패널별 Mx/My/Mxy 집계 |
| 2.2 | ★ | **Wood-Armer 휨철근 산정** | 비틀림모멘트 포함 2방향 소요 철근량. 상/하부 분리 |
| 2.3 | ★ | **DCR 자동 산출** | `As_req / As_prov` → 테이블·SVG 색상 코딩 (≥1.0 적색). 4축 분리(ULS_flex, ULS_shear, SLS_defl, SLS_crack) 검토 |
| 2.4 | ◆ | **슬래브→보 하중 분배** | 2방향 분배선(45° or 강성 비율) Tributary → 기존 `rc-beam` 페이지 연결 |
| 2.5 | ◆ | **층별 고정하중 집계** | 내진하중/자중 검증용 Σ(Wi·Ai) per story |

**선결 ADR**: Plate force 소스 결정 (열린 항목 참조).

---

## Phase 3 — 보고서·도면 출력 확장

> Load Map 에 PDF/DXF 가 들어왔으니 **슬래브/다른 페이지로 확장** + 부가 데이터.

### 3-A. 슬래브 페이지 PDF/DXF (Load Map 패턴 재사용)
| # | 우선 | 항목 | 내용 |
|---|------|------|------|
| 3.1 | ★ | **슬래브 PDF 출력** | `LoadMapView` 의 export 패턴을 `SlabPlanView` 로 이식. 분류/Wu/DCR 라벨 포함 |
| 3.2 | ★ | **슬래브 DXF 출력** | 패널 폴리곤 + 분류/두께/배근 텍스트 + OMBB 와이어. 외곽선 + solid hatch |
| 3.3 | ◆ | **다중 층 멀티페이지 PDF** | 분석된 모든 층을 한 PDF (각 층 1페이지). 헤더에 페이지 번호 |

### 3-B. Load Map DXF 확장
| # | 우선 | 항목 | 내용 |
|---|------|------|------|
| 3.4 | ◆ | **DXF 에 보 라인 포함** | layer "BEAM" 분리 (옵션 토글). 영역과 보의 겹침 확인용 |
| 3.5 | ◆ | **DXF 에 축렬 grid 포함** | layer "GRID" + 버블/라벨. 도면 정합용 |
| 3.6 | ◆ | **DXF 부가 텍스트** | DL/LL/Wu 값을 도형 옆에 작은 텍스트로 (옵션) |

### 3-C. Excel 리포트
| # | 우선 | 항목 | 내용 | 기존 자산 |
|---|------|------|------|----------|
| 3.7 | ★ | **Excel 배근표 리포트** | 층별 패널/경간/TYPE/두께/배근/Wu/DCR | `floorload.py::export_excel` 템플릿 |
| 3.8 | ★ | **설계 요약 PDF** | KDS 근거 명시 + 층별 요약 + SVG 캡처 | `seismic_cert` 패턴 + jsPDF |

---

## Phase 4 — UX·협업

| # | 우선 | 항목 | 내용 |
|---|------|------|------|
| 4.1 | ★ | **다중 패널 일괄 편집** | Shift-클릭 다중선택 → 분류·TYPE·THK 일괄 할당 |
| 4.2 | ★ | **배근표 Excel 가져오기** | 기존 설계서 분류표 복붙 import |
| 4.3 | ◆ | **스냅샷 diff 뷰** | 이전 vs 현재 스냅샷의 분류/배근/Wu 변경점 강조 |
| 4.4 | ◆ | **경고 배지** | DCR>1.0, 미지정 분류, 배근 누락 등 헤더 요약 배지 |
| 4.5 | ◇ | **팀 공유 저장** | 로컬 JSON → Neon/SQLite. ACL + 감사로그 우선 설계 |
| 4.6 | ◇ | **단축키** | 다음 패널(→), 이전(←), 복사(Ctrl+D) |

---

## 병렬 — 지속 개선

언제든 필요 시 손댈 수 있는 상시 개선 항목. Phase 와 독립.

- ◆ **성능** — 수천 패널 모델 대응. 패널 탐색 알고리즘 최적화, virtual scrolling
- ◆ **L자/ㄷ자 오목 다각형** — 현재 OMBB 가 외측 사각형이라 short span 과대평가 가능. 분할 또는 minimum-rotated-rectangle of inscribed
- ◆ **사선 슬래브/캔틸레버** — 면적 기준 미세 검출 + 계수 조정
- ◆ **배근 TYPE 별 시각 심볼** — 상부(실선) / 하부(점선) bar 를 SVG 오버레이
- ◇ **MIDAS 뷰 캡처 연동** — 특정 패널 위치를 MIDAS 화면 포커스
- ◇ **색상 접근성** — 분류 색 자동 생성 시 WCAG 대비비 보장
- ◇ **DXF SHX 한글 fallback** — `malgun.ttf` 미설치 환경에서 SHX bigfont (`whgtxt.shx`) 또는 MTEXT 전환

---

## 인접 도메인 (스코프 확장)

> 슬래브가 아닌 부재로 동일 패턴 확장. 우선순위 낮지만 큰 그림.

| # | 우선 | 항목 | 내용 |
|---|------|------|------|
| A.1 | ◆ | **벽체 검토 페이지** | RC 전단벽 — `/db/WALL` + 부재력 → KDS 14 20 80 |
| A.2 | ◆ | **기둥 P-M 검토** | RC 기둥 P-M 상관도. 기존 `rc-beam` 모델 확장 |
| A.3 | ◇ | **기초 검토** | 매트/말뚝, 지반반력 |

---

## 의사결정이 필요한 열린 항목

실행 전 사용자/팀과 결정해야 하는 사항. 이 목록이 비어야 해당 Phase 시작 가능.

- [ ] Phase 1 **착수 순서** — 처짐(1.2) / 파서(1.1) / 최소철근비(1.3) 중 어느 것부터
- [ ] **배근 표기법 고정** — `HD13@200` vs `D13@200` vs `HD13@200 CTC` (파서 EBNF 선결)
- [ ] Phase 2 **Plate 부재력 소스** — `/post/PLATEFORCES` vs `/post/PLATESTRESS` vs 시공단계 결과
- [ ] Phase 2 **단위/부호 규약** — kN, m, MPa 고정 + sign convention 명문화 (codex 지적)
- [ ] **Done 기준 KPI** — 각 Phase 항목별 정확도/성능/회귀테스트 통과율
- [ ] Phase 4 **팀 공유 백엔드** — 현재 로컬 JSON, 후보: Neon Postgres / SQLite + ACL
- [ ] **KDS 개정판 고정** — 어느 연도 개정을 SSOT 로 (재현성)

---

## 변경 이력

- **v1.1.0 (2026-04-25)** — Load Map PDF/DXF + 슬래브 face/OMBB + Project Settings 그리드 자동 탐지
- **v1.0.13 (없음)** — v1.0.12 → v1.1.0 직행 (대규모 기능 묶음)
- **v1.0.12 이전** — RC 보 검토, 내진확인서, 슬래브 경간 1차 (Union-Find)
