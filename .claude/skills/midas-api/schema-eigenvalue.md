---
name: eigenvalue-schema
description: /post/TABLE 고유치 결과 조회 요청 스키마 예시. TABLE_TYPE, UNIT, STYLES, MODES 설정 시 참조.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/33016922742937
---

## 목적

고유치 해석 결과를 `/post/TABLE`로 조회할 때 사용하는 요청 JSON 구조 예시를 제공한다.

## 엔드포인트

- `POST /post/TABLE`

## 요청 스키마 예시

```json
{
    "TABLE": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "VibrationModeShape",
        "type": "object",
        "properties": {
            "Argument": {
                "type": "object",
                "properties": {
                    "TABLE_NAME": {
                        "type": "string",
                        "description": "ResponseTableTitle"
                    },
                    "TABLE_TYPE": {
                        "type": "string",
                        "description": "ResultTableType",
                        "enum": [
                            "EIGENVALUEMODE",
                            "PARTICIPATIONVECTORMODE"
                        ]
                    },
                    "EXPORT_PATH": {
                        "type": "string",
                        "description": "ResultTableSavePath"
                    },
                    "UNIT": {
                        "type": "object",
                        "description": "ResponseUnitSetting",
                        "properties": {
                            "FORCE": {
                                "type": "string",
                                "description": "Force"
                            },
                            "DIST": {
                                "type": "string",
                                "description": "Length"
                            },
                            "HEAT": {
                                "type": "string",
                                "description": "Heat"
                            },
                            "TEMP": {
                                "type": "string",
                                "description": "Temperature"
                            }
                        }
                    },
                    "STYLES": {
                        "type": "object",
                        "description": "ResponseNumberFormat",
                        "properties": {
                            "FORMAT": {
                                "type": "string",
                                "description": "Numberformat",
                                "enum": [
                                    "Default",
                                    "Fixed",
                                    "Scientific",
                                    "General"
                                ]
                            },
                            "PLACE": {
                                "type": "integer",
                                "description": "Digitplace",
                                "minimum": 0,
                                "maximum": 15
                            }
                        }
                    },
                    "COMPONENTS": {
                        "type": "array",
                        "description": "ComponentsofResultTable",
                        "items": {
                            "type": "string"
                        }
                    },
                    "NODE_ELEMS": {
                        "type": "object",
                        "description": "Node/ElementNo.Input",
                        "properties": {
                            "KEYS": {
                                "type": "array",
                                "description": "SpecifyEachID",
                                "items": {
                                    "type": "integer"
                                }
                            },
                            "TO": {
                                "type": "string",
                                "description": "SpecifyIDRange"
                            },
                            "STRUCTURE_GROUP_NAME": {
                                "type": "string",
                                "description": "SpecifyStructureGroupName"
                            }
                        }
                    },
                    "MODES": {
                        "type": "array",
                        "description": "ModeNumber",
                        "items": {
                            "type": "string"
                        }
                    }
                }
            }
        }
    }
}
```

## 사용 메모

- `TABLE_TYPE`은 고유치 관련 조회 시 `EIGENVALUEMODE` 또는 `PARTICIPATIONVECTORMODE`를 사용한다.
- 문서와 실제 API 동작이 다를 경우 공식 문서를 우선한다.