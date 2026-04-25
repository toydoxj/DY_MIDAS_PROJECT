# .claude/ 자산 체계화 — 작업 노트

브랜치: `chore/claude-restructure`
시작일: 2026-04-25
근거: ROADMAP + Codex 자문 + Shrimp Task Manager 분해 (T1~T10)

## 목표 구조

```
.claude/
  registry.yaml                     # T10
  agents/
    reviewers/
      rc-beam.md                    # T2 이전, T6 슬림화
      rc-slab.md                    # T7 신규
    authors/
      seismic-cert.md               # T8 신규
      design-report.md              # T9 신규
    _shared/
      agent-memory-howto.md         # T4 추출
      output-contract.md            # T4 추출
  skills/
    domains/
      kds-rc-beam.md                # 향후
      kds-rc-slab.md                # T7 신규
      kds-seismic-load.md           # T2 이전 (현 seismic.md)
    midas-api/
      index.md                      # T2 이전(498→T5 슬림 60줄)
      db-{node,elem,sect,stld,stor,fbla}.md  # T5 분할
      schema-eigenvalue.md          # T2 이전
    conventions/
      member-naming.md              # T2 이전
  rules/
    kds_code.md                     # 변경 없음
  commands/
    midas-pipeline/                 # T2 (검증 결과에 따라)
      validate-config.md, convert-api.md, run-workflow.md, sort-data.md, export-results.md
docs/
  api_specs/                        # T2 이전 (현 .claude/mcp_specs/)
```

## T1 검증 결과

### 디렉토리 골격
- ✅ `.claude/agents/{reviewers,authors,_shared}` 생성
- ✅ `.claude/skills/{domains,midas-api,conventions}` 생성
- ✅ `docs/api_specs/` 생성
- 빈 디렉토리 git 트래킹용 `.gitkeep` 추가

### 슬래시 커맨드 서브폴더 인식 검증

**검증 파일:** `.claude/commands/_test_subfolder/probe.md`

**확인 결과:** ✅ **(b) `<폴더명>:<파일명>` namespace 형식 인식 확정**

- [x] (b) `_test_subfolder:probe` 형식으로 시스템 스킬 목록에 자동 등록됨 (2026-04-25 검증)
- [ ] (a) 평면 인식 — 해당 없음
- [ ] (c) 경로 형식 — 해당 없음
- [ ] (d) 인식 안 됨 — 해당 없음

**검증 근거:** `.claude/commands/_test_subfolder/probe.md` 작성 직후 Claude Code 가 갱신한 user-invocable skills 목록에 `_test_subfolder:probe` 항목 표시됨. 기존 평면 스킬(`convert-api`, `export-results`, `run-workflow`, `sort-data`, `validate-config`)은 평면 그대로 인식.

**T2 commands 그룹화 영향:**
- `.claude/commands/midas-pipeline/validate-config.md` 로 이동 시 호출 경로가 `/validate-config` → `/midas-pipeline:validate-config` 로 **변경됨**
- 사용자 결정 필요: 그룹화의 명확성 vs 기존 호출 경로 안정성

## 결정 사항

### agent name 호환성 (보수적 안)
- 기존 `beam-design-reviewer` 의 frontmatter `name` 필드 유지
- 파일명만 `rc-beam.md` 로 변경
- 이유: 외부에서 `name` 으로 호출하던 사용자 경로 보호

### 명명 컨벤션
- 모든 자산 파일/디렉토리: kebab-case
- 예외: `_shared/` (정렬 용도 underscore prefix)

### Stage 분리
| Stage | Task | 핵심 |
|-------|------|------|
| 0 | T1 | 안전망 + 골격 |
| 1 | T2-T3 | 이동 + 명명 + 메타데이터 |
| 2 | T4-T6 | 분할 + 보일러플레이트 추출 + 슬림화 |
| 3 | T7-T9 | 신규 에이전트 3개 |
| 4 | T10 | registry + lint |

각 Stage 종료 시 독립 commit, 사용자 요청 시에만 commit.

## 미결 항목

- [ ] T1 슬래시 커맨드 서브폴더 인식 결과 (위)
- [ ] agent name 호환성 (a)/(b) 최종 확정 — 현재 (a) 유지로 진행
