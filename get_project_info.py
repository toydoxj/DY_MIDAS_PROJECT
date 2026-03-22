import os
from dotenv import load_dotenv
import MIDAS_API as MIDAS

load_dotenv()

base_url = os.getenv("MIDAS_BASE_URL")
api_key = os.getenv("MIDAS_API_KEY")
if not base_url:
    raise EnvironmentError("환경 변수 MIDAS_BASE_URL이 설정되지 않았습니다. .env 파일을 확인하세요.")
if not api_key:
    raise EnvironmentError("환경 변수 MIDAS_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

MIDAS.MIDAS_API_BASEURL(base_url)
MIDAS.MIDAS_API_KEY(api_key)

LABEL_MAP = {
    "PROJECT":  "프로젝트명",
    "REVISION": "개정 정보",
    "USER":     "사용자",
    "EMAIL":    "이메일",
    "ADDRESS":  "주소",
    "TEL":      "전화번호",
    "FAX":      "팩스",
    "CLIENT":   "발주처",
    "TITLE":    "제목",
    "ENGINEER": "검토자",
    "EDATE":    "검토일",
    "CHECK1":   "확인자 1",
    "CDATE1":   "확인일 1",
    "CHECK2":   "확인자 2",
    "CDATE2":   "확인일 2",
    "CHECK3":   "확인자 3",
    "CDATE3":   "확인일 3",
    "APPROVE":  "승인자",
    "ADATE":    "승인일",
    "COMMENT":  "비고",
}

data = MIDAS.projectDB.get()

# API 응답에서 PJCF 키 추출 (구조: {"PJCF": {"1": {...}}})
pjcf_raw = data.get("PJCF", data)
pjcf = next(iter(pjcf_raw.values())) if pjcf_raw else {}

print("=" * 40)
print("       프로젝트 정보 (PJCF)")
print("=" * 40)
for key, label in LABEL_MAP.items():
    value = pjcf.get(key, "")
    if value:
        print(f"{label:<12}: {value}")
print("=" * 40)
