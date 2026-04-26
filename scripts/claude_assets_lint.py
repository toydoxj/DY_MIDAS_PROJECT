"""`.claude/` 자산 lint.

검증 항목:
1. registry.yaml 의 모든 path 가 실재 파일
2. 모든 .md 자산에 frontmatter 표준 필드 존재 (name, description, status, last_reviewed, owner)
3. agent 추가 필드 (model, memory)
4. registry 의 depends_on 이 같은 registry 의 다른 id 를 가리키는지

종료 코드:
    0 — 모든 검증 통과
    1 — 경고 있음 (frontmatter 비표준 필드 등)
    2 — 오류 있음 (path 부재 / 끊긴 참조)

사용:
    python scripts/claude_assets_lint.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML 미설치. `pip install pyyaml` 실행", file=sys.stderr)
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = REPO_ROOT / ".claude" / "registry.yaml"

REQUIRED_FIELDS = {"name", "description", "status", "last_reviewed", "owner"}
AGENT_EXTRA_FIELDS = {"model", "memory"}
VALID_STATUS = {"stable", "experimental", "deprecated"}
VALID_TYPE = {"agent", "skill", "rule", "command", "shared"}


def parse_frontmatter(md_text: str) -> dict | None:
    """파일 첫 ---...--- 블록을 YAML 로 파싱. 없으면 None."""
    if not md_text.startswith("---"):
        return None
    end = md_text.find("\n---", 3)
    if end == -1:
        return None
    fm_text = md_text[3:end].strip()
    try:
        return yaml.safe_load(fm_text) or {}
    except yaml.YAMLError as e:
        return {"_parse_error": str(e)}


def lint() -> tuple[int, int]:
    errors: list[str] = []
    warnings: list[str] = []

    # 1. registry.yaml 로드
    if not REGISTRY_PATH.exists():
        errors.append(f"registry.yaml 부재: {REGISTRY_PATH}")
        return _report(errors, warnings)

    with REGISTRY_PATH.open(encoding="utf-8") as f:
        registry = yaml.safe_load(f)

    if not registry or "assets" not in registry:
        errors.append("registry.yaml 에 'assets' 키 없음")
        return _report(errors, warnings)

    assets = registry["assets"]
    ids = {a.get("id") for a in assets if a.get("id")}

    # 2. 각 자산 검증
    for a in assets:
        aid = a.get("id", "<no-id>")
        atype = a.get("type")
        path_str = a.get("path")

        if atype not in VALID_TYPE:
            errors.append(f"[{aid}] type 이 {VALID_TYPE} 중 하나여야 함: {atype}")
            continue

        if a.get("status") not in VALID_STATUS:
            warnings.append(f"[{aid}] status 가 {VALID_STATUS} 중 하나여야 함: {a.get('status')}")

        if not path_str:
            errors.append(f"[{aid}] path 누락")
            continue

        full_path = REPO_ROOT / path_str
        if not full_path.exists():
            errors.append(f"[{aid}] path 실재하지 않음: {path_str}")
            continue

        # depends_on 검증
        for dep in a.get("depends_on") or []:
            if dep not in ids:
                errors.append(f"[{aid}] depends_on '{dep}' 가 registry 에 없음")

        # 3. frontmatter 검증
        try:
            text = full_path.read_text(encoding="utf-8")
        except UnicodeDecodeError as e:
            errors.append(f"[{aid}] UTF-8 디코드 실패: {e}")
            continue

        fm = parse_frontmatter(text)
        if fm is None:
            warnings.append(f"[{aid}] frontmatter 부재: {path_str}")
            continue
        if "_parse_error" in fm:
            errors.append(f"[{aid}] frontmatter 파싱 실패: {fm['_parse_error']}")
            continue

        missing = REQUIRED_FIELDS - set(fm.keys())
        if missing:
            errors.append(f"[{aid}] 필수 필드 누락: {sorted(missing)} ({path_str})")

        if atype == "agent":
            agent_missing = AGENT_EXTRA_FIELDS - set(fm.keys())
            if agent_missing:
                errors.append(f"[{aid}] agent 추가 필드 누락: {sorted(agent_missing)}")

        # registry 의 status 와 frontmatter 의 status 일치 검증
        fm_status = fm.get("status")
        if fm_status and fm_status != a.get("status"):
            warnings.append(
                f"[{aid}] registry status='{a.get('status')}' vs frontmatter status='{fm_status}' 불일치"
            )

    return _report(errors, warnings)


def _report(errors: list[str], warnings: list[str]) -> tuple[int, int]:
    if warnings:
        print(f"\n[WARN] WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print(f"\n[ERROR] ERRORS ({len(errors)}):")
        for e in errors:
            print(f"  - {e}")
    if not errors and not warnings:
        print("[OK] 모든 검증 통과")
    return len(errors), len(warnings)


def main() -> int:
    err_count, warn_count = lint()
    print(f"\n총 - errors: {err_count}, warnings: {warn_count}")
    if err_count > 0:
        return 2
    if warn_count > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
