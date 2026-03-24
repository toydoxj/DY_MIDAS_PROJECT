config.yaml의 DY_Form 데이터를 MIDAS GEN NX REST API 요청 포맷으로 변환한다.

## 변환 규칙

### geometry -> modelingInfo
- `origin`, `grid` 값을 그대로 매핑

### section -> sections[]
- `name` -> `sectionId` (공백을 _로 치환)
- `type`, `b`, `h` 등 치수 -> `dimensions` 객체

### material -> materials[]
- `name` -> `materialId` (공백을 _로 치환)
- `fc`, `fy` 등 물성 -> `properties` 객체

### load -> loads{}
- 같은 `name`의 하중은 하나의 loadCase로 합산
- `PointLoad` -> `forces.pointLoad`
- `DistributedLoad` -> `forces.distributedLoad`

### boundary -> boundary[]
- 노드 ID -> `nodeId` (문자열), 6자유도 구속 `constraints`

## 실행 방법

1. config.yaml을 읽는다
2. `dyForm` 섹션을 위 규칙에 따라 변환한다
3. 변환된 JSON을 보기 좋게 출력한다
4. MIDAS API로 바로 전송 가능한 형태인지 확인한다
