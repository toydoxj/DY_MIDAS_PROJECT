---
name: midas-api-json
description: MIDAS GEN NX REST API 엔드포인트 인덱스/링크 허브. 상세 요청 스키마는 하위 schema 문서에서 다룬다.
last_reviewed: 2026-04-13
source: https://support.midasuser.com/hc/ko/articles/33016922742937
---

# MIDAS API JSON Manual

출처: https://support.midasuser.com/hc/ko/articles/33016922742937

## 문서 역할

- 이 문서는 엔드포인트 목록과 공식 링크를 빠르게 찾기 위한 인덱스다.
- 상세 JSON 요청/응답 스키마는 `.claude/skills/midas_api_json/` 하위 문서를 우선 참조한다.
- 구조 해석 규정 검토(예: 내진 설계 검토)는 `seismic.md`를 참조한다.

## 섹션 구조

| 섹션 | 설명 | Method |
|------|------|--------|
| DOC | 문서 관리 (열기/저장/해석) | POST |
| DB | 데이터베이스 (모델 데이터) | GET/POST/PUT/DELETE |
| OPE | 운영/계산 | POST |
| VIEW | 뷰/화면 제어 | POST |
| POST | 후처리 결과 조회 | POST |

## DOC (11개)

| No | Endpoint | Name | URL |
|----|----------|------|-----|
| 1 | /doc/NEW | New Project | [Link](https://support.midasuser.com/hc/ko/articles/35994078198681) |
| 2 | /doc/OPEN | Open Project | [Link](https://support.midasuser.com/hc/ko/articles/35994112560793) |
| 3 | /doc/CLOSE | Close Project | [Link](https://support.midasuser.com/hc/ko/articles/35994162529305) |
| 4 | /doc/SAVE | Save | [Link](https://support.midasuser.com/hc/ko/articles/35994210207513) |
| 5 | /doc/SAVEAS | Save As | [Link](https://support.midasuser.com/hc/ko/articles/35994277012377) |
| 6 | /doc/STAGAS | Save Current Stage As | [Link](https://support.midasuser.com/hc/ko/articles/50707525717401) |
| 7 | /doc/IMPORT | Import to Json | [Link](https://support.midasuser.com/hc/ko/articles/35994338816793) |
| 8 | /doc/IMPORTMXT | Import to mct/mgt | [Link](https://support.midasuser.com/hc/ko/articles/35994365225113) |
| 9 | /doc/EXPORT | Export to Json | [Link](https://support.midasuser.com/hc/ko/articles/35994422273305) |
| 10 | /doc/EXPORTMXT | Export to mct/mgt | [Link](https://support.midasuser.com/hc/ko/articles/35994462805017) |
| 11 | /doc/ANAL | Perform Analysis | [Link](https://support.midasuser.com/hc/ko/articles/35685160815897) |

## DB (246개)

| No | Endpoint | Name | URL |
|----|----------|------|-----|
| 1 | /db/PJCF | Project Information | [Link](https://support.midasuser.com/hc/ko/articles/35801869341337) |
| 2 | /db/UNIT | Unit System | [Link](https://support.midasuser.com/hc/ko/articles/35802155483801) |
| 3 | /db/STYP | Structure Type | [Link](https://support.midasuser.com/hc/ko/articles/35802404495257) |
| 4 | /db/GRUP | Structure Group | [Link](https://support.midasuser.com/hc/ko/articles/35802441712921) |
| 5 | /db/BNGR | Boundary Group | [Link](https://support.midasuser.com/hc/ko/articles/35804937452313) |
| 6 | /db/LDGR | Load Group | [Link](https://support.midasuser.com/hc/ko/articles/35804975346841) |
| 7 | /db/TDGR | Tendon Group | [Link](https://support.midasuser.com/hc/ko/articles/35805198736793) |
| 8 | /db/NPLN | Named Plane | [Link](https://support.midasuser.com/hc/ko/articles/35805287066649) |
| 9 | /db/CO_M | Material Color | [Link](https://support.midasuser.com/hc/ko/articles/35805703171353) |
| 10 | /db/CO_S | Section Color | [Link](https://support.midasuser.com/hc/ko/articles/35805763514393) |
| 11 | /db/CO_T | Thickness Color | [Link](https://support.midasuser.com/hc/ko/articles/35805833925785) |
| 12 | /db/CO_F | Floor Load Color | [Link](https://support.midasuser.com/hc/ko/articles/35805846236441) |
| 13 | /db/SPAN | Span Information | [Link](https://support.midasuser.com/hc/ko/articles/35805957502233) |
| 14 | /db/STOR | Story Data | [Link](https://support.midasuser.com/hc/ko/articles/49513466793113) |
| 15 | /db/NODE | Node | [Link](https://support.midasuser.com/hc/ko/articles/35806845654169) |
| 16 | /db/ELEM | Element | [Link](https://support.midasuser.com/hc/ko/articles/35806934300825) |
| 17 | /db/SKEW | Node Local Axis | [Link](https://support.midasuser.com/hc/ko/articles/35807178748569) |
| 18 | /db/MADO | Define Domain | [Link](https://support.midasuser.com/hc/ko/articles/35807228332825) |
| 19 | /db/SBDO | Define Sub-Domain | [Link](https://support.midasuser.com/hc/ko/articles/35807304820761) |
| 20 | /db/DOEL | Domain-Element | [Link](https://support.midasuser.com/hc/ko/articles/35807341514393) |
| 21 | /db/MATL | Material Properties | [Link](https://support.midasuser.com/hc/ko/articles/35807411331993) |
| 22 | /db/IMFM | Inelastic Material Properties for Fiber Model | [Link](https://support.midasuser.com/hc/ko/articles/35807475893401) |
| 23 | /db/TDMF | Time Dependent Material Properties - User Defined | [Link](https://support.midasuser.com/hc/ko/articles/35807665049369) |
| 24 | /db/TDMT | Time Dependent Material Properties - Creep/Shrinkage | [Link](https://support.midasuser.com/hc/ko/articles/35808006330009) |
| 25 | /db/TDME | Time Dependent Material Properties - Compressive Strength | [Link](https://support.midasuser.com/hc/ko/articles/35808102389401) |
| 26 | /db/EDMP | Change Property | [Link](https://support.midasuser.com/hc/ko/articles/35808245801881) |
| 27 | /db/TMAT | Time Dependent Material Link | [Link](https://support.midasuser.com/hc/ko/articles/35808280891033) |
| 28 | /db/EPMT | Plastic Material | [Link](https://support.midasuser.com/hc/ko/articles/35808376517913) |
| 29 | /db/SECT | Section Properties - Common | [Link](https://support.midasuser.com/hc/ko/articles/35808653964185) |
| 30 | /db/SECT | Section Properties - DB/User | [Link](https://support.midasuser.com/hc/ko/articles/35809067039513) |
| 31 | /db/SECT | Section Properties - Value | [Link](https://support.midasuser.com/hc/ko/articles/35839753881497) |
| 32 | /db/SECT | Section Properties - SRC | [Link](https://support.midasuser.com/hc/ko/articles/35845378225689) |
| 33 | /db/SECT | Section Properties - Combined | [Link](https://support.midasuser.com/hc/ko/articles/35851350827801) |
| 34 | /db/SECT | Section Properties - PSC | [Link](https://support.midasuser.com/hc/ko/articles/35851688190105) |
| 35 | /db/SECT | Section Properties - PSC Value | [Link](https://support.midasuser.com/hc/ko/articles/39233604772633) |
| 36 | /db/SECT | Section Properties - Composite - PSC | [Link](https://support.midasuser.com/hc/ko/articles/35938998724377) |
| 37 | /db/SECT | Section Properties - Composite - Steel | [Link](https://support.midasuser.com/hc/ko/articles/35939122737689) |
| 38 | /db/SECT | Section Properties - Steel Girder | [Link](https://support.midasuser.com/hc/ko/articles/35939506348697) |
| 39 | /db/SECT | Section Properties - Tapered - DB/User | [Link](https://support.midasuser.com/hc/ko/articles/35852806893593) |
| 40 | /db/SECT | Section Properties - Tapered - Value | [Link](https://support.midasuser.com/hc/ko/articles/35938685208089) |
| 41 | /db/SECT | Section Properties - Tapered - PSC | [Link](https://support.midasuser.com/hc/ko/articles/35941360898713) |
| 42 | /db/SECT | Section Properties - Tapered - PSC Value | [Link](https://support.midasuser.com/hc/ko/articles/39233752695321) |
| 43 | /db/SECT | Section Properties - Tapered - Composite PSC | [Link](https://support.midasuser.com/hc/ko/articles/35941514067225) |
| 44 | /db/SECT | Section Properties - Tapered - Composite Steel | [Link](https://support.midasuser.com/hc/ko/articles/35941644806553) |
| 45 | /db/SECT | Section Properties - Tapered - Steel Girder | [Link](https://support.midasuser.com/hc/ko/articles/35941809011225) |
| 46 | /db/THIK | Thickness - Value | [Link](https://support.midasuser.com/hc/ko/articles/35942236652697) |
| 47 | /db/THIK | Thickness - Stiffened DB | [Link](https://support.midasuser.com/hc/ko/articles/35942342783769) |
| 48 | /db/THIK | Thickness - Stiffened User | [Link](https://support.midasuser.com/hc/ko/articles/35942603029401) |
| 49 | /db/THIK | Thickness - Stiffened Value | [Link](https://support.midasuser.com/hc/ko/articles/35942739673369) |
| 50 | /db/TSGR | Tapered Group | [Link](https://support.midasuser.com/hc/ko/articles/35942955627673) |
| 51 | /db/SECF | Section Manager - Stiffness | [Link](https://support.midasuser.com/hc/ko/articles/35943174833177) |
| 52 | /db/RPSC | Section Manager - Reinforcements | [Link](https://support.midasuser.com/hc/ko/articles/35943227821465) |
| 53 | /db/STRPSSM | Section Manager - Stress Points | [Link](https://support.midasuser.com/hc/ko/articles/35943448721177) |
| 54 | /db/PSSF | Section Manager - Plate Stiffness Scale Factor | [Link](https://support.midasuser.com/hc/ko/articles/35943557337753) |
| 55 | /db/VBEM | Section Manager - Section for Resultant Forces - Virtual Beam | [Link](https://support.midasuser.com/hc/ko/articles/35943802727065) |
| 56 | /db/VSEC | Section Manager - Section for Resultant Forces - Virtual Section | [Link](https://support.midasuser.com/hc/ko/articles/35943859944729) |
| 57 | /db/EWSF | Effective Width Scale Factor | [Link](https://support.midasuser.com/hc/ko/articles/35943954272281) |
| 58 | /db/IEHC | Inelastic Hinge Control Data | [Link](https://support.midasuser.com/hc/ko/articles/35944093809689) |
| 59 | /db/IEHG | Assign Inelastic Hinge Properties | [Link](https://support.midasuser.com/hc/ko/articles/35944228031001) |
| 60 | /db/FIMP | Inelastic Material Properties | [Link](https://support.midasuser.com/hc/ko/articles/35944335180569) |
| 61 | /db/FIBR | Fiber Division of Section | [Link](https://support.midasuser.com/hc/ko/articles/35944476555801) |
| 62 | /db/GRDP | Group Damping | [Link](https://support.midasuser.com/hc/ko/articles/35944577940633) |
| 63 | /db/ESSF | Element Stiffness Scale Factor | [Link](https://support.midasuser.com/hc/ko/articles/44613910309401-Element-Stiffness-Scale-Factor) |
| 64 | /db/CONS | Constraint Support | [Link](https://support.midasuser.com/hc/ko/articles/35944759597337) |
| 65 | /db/NSPR | Point Spring | [Link](https://support.midasuser.com/hc/ko/articles/35945908301081) |
| 66 | /db/GSTP | Define General Spring Type | [Link](https://support.midasuser.com/hc/ko/articles/35946004118169) |
| 67 | /db/GSPR | Assign General Spring Supports | [Link](https://support.midasuser.com/hc/ko/articles/35946151002393) |
| 68 | /db/SSPS | Surface Spring | [Link](https://support.midasuser.com/hc/ko/articles/35946218805785) |
| 69 | /db/ELNK | Elastic Link | [Link](https://support.midasuser.com/hc/ko/articles/35946439146649) |
| 70 | /db/RIGD | Rigid Link | [Link](https://support.midasuser.com/hc/ko/articles/35946584247193) |
| 71 | /db/NLLP | General Link Properties | [Link](https://support.midasuser.com/hc/ko/articles/35946764618905) |
| 72 | /db/NLNK | General Link | [Link](https://support.midasuser.com/hc/ko/articles/35946942651289) |
| 73 | /db/CGLP | Change General Link Property | [Link](https://support.midasuser.com/hc/ko/articles/35947087784217) |
| 74 | /db/FRLS | Beam End Release | [Link](https://support.midasuser.com/hc/ko/articles/35947184258585) |
| 75 | /db/OFFS | Beam End Offsets | [Link](https://support.midasuser.com/hc/ko/articles/35947465569049) |
| 76 | /db/PRLS | Plate End Release | [Link](https://support.midasuser.com/hc/ko/articles/35947668757017) |
| 77 | /db/MLFC | Force-Deformation Function | [Link](https://support.midasuser.com/hc/ko/articles/35947795463705) |
| 78 | /db/SDVI | Seismic Device - Viscous Damper/Oil Damper | [Link](https://support.midasuser.com/hc/ko/articles/35947995586713) |
| 79 | /db/SDVE | Seismic Device - Viscoelastic Damper | [Link](https://support.midasuser.com/hc/ko/articles/35948062417049) |
| 80 | /db/SDST | Seismic Device - Steel Damper | [Link](https://support.midasuser.com/hc/ko/articles/35948150053529) |
| 81 | /db/SDHY | Seismic Device - Hysteretic Isolator(MSS) | [Link](https://support.midasuser.com/hc/ko/articles/35948292269977) |
| 82 | /db/SDIS | Seismic Device - Isolator(MSS) | [Link](https://support.midasuser.com/hc/ko/articles/35948330042649) |
| 83 | /db/MCON | Linear Constraints | [Link](https://support.midasuser.com/hc/ko/articles/35948507217689) |
| 84 | /db/PZEF | Panel Zone Effects | [Link](https://support.midasuser.com/hc/ko/articles/35950231812505) |
| 85 | /db/CLDR | Define Constraints Label Direction | [Link](https://support.midasuser.com/hc/ko/articles/35952465579417) |
| 86 | /db/DRLS | Diaphragm Disconnect | [Link](https://support.midasuser.com/hc/ko/articles/51740138178969) |
| 87 | /db/STLD | Static Load Cases | [Link](https://support.midasuser.com/hc/ko/articles/35952651947801) |
| 88 | /db/BODF | Self-Weight | [Link](https://support.midasuser.com/hc/ko/articles/35952708909337) |
| 89 | /db/CNLD | Nodal Loads | [Link](https://support.midasuser.com/hc/ko/articles/35952812160281) |
| 90 | /db/BMLD | Beam Loads | [Link](https://support.midasuser.com/hc/ko/articles/35952826746521) |
| 91 | /db/SDSP | Specified Displacements of Support | [Link](https://support.midasuser.com/hc/ko/articles/35952933108761) |
| 92 | /db/NMAS | Nodal Masses | [Link](https://support.midasuser.com/hc/ko/articles/35952994344985) |
| 93 | /db/LTOM | Loads to Masses | [Link](https://support.midasuser.com/hc/ko/articles/35953062761881) |
| 94 | /db/NBOF | Nodal Body Force | [Link](https://support.midasuser.com/hc/ko/articles/35953117115545) |
| 95 | /db/PSLT | Define Pressure Load Type | [Link](https://support.midasuser.com/hc/ko/articles/35953165879833) |
| 96 | /db/PRES | Assign Pressure Loads | [Link](https://support.midasuser.com/hc/ko/articles/35953322434457) |
| 97 | /db/PNLD | Define Plane Load Type | [Link](https://support.midasuser.com/hc/ko/articles/35953492119321) |
| 98 | /db/PNLA | Assign Plane Loads | [Link](https://support.midasuser.com/hc/ko/articles/35953557411993) |
| 99 | /db/FBLD | Define Floor Load Type | [Link](https://support.midasuser.com/hc/ko/articles/35953604106137) |
| 100 | /db/FBLA | Assign Floor Loads | [Link](https://support.midasuser.com/hc/ko/articles/35953653792665) |
| 101 | /db/FMLD | Finishing Material Loads | [Link](https://support.midasuser.com/hc/ko/articles/35953690148121) |
| 102 | /db/POSP | Parameter of Soil Properties | [Link](https://support.midasuser.com/hc/ko/articles/49510865840537) |
| 103 | /db/EPST | Static Earth Pressure | [Link](https://support.midasuser.com/hc/ko/articles/49511059178521) |
| 104 | /db/EPSE | Seismic Earth Pressure | [Link](https://support.midasuser.com/hc/ko/articles/49511153905177) |
| 105 | /db/POSL | Parameter of Seismic Loads | [Link](https://support.midasuser.com/hc/ko/articles/49511410691609) |
| 106 | /db/ETMP | Element Temperature | [Link](https://support.midasuser.com/hc/ko/articles/35954097233561) |
| 107 | /db/GTMP | Temperature Gradient | [Link](https://support.midasuser.com/hc/ko/articles/35954163821593) |
| 108 | /db/BTMP | Beam Section Temperature | [Link](https://support.midasuser.com/hc/ko/articles/35954186047897) |
| 109 | /db/STMP | System Temperature | [Link](https://support.midasuser.com/hc/ko/articles/35954219102233) |
| 110 | /db/NTMP | Nodal Temperature | [Link](https://support.midasuser.com/hc/ko/articles/35954302641177) |
| 111 | /db/TDNT | Tendon Property | [Link](https://support.midasuser.com/hc/ko/articles/35954451663513) |
| 112 | /db/TDNA | Tendon Profile | [Link](https://support.midasuser.com/hc/ko/articles/35954555962137) |
| 113 | /db/TDCS | Tendon Location for Composite Section | [Link](https://support.midasuser.com/hc/ko/articles/35954649371545) |
| 114 | /db/TDPL | Tendon Prestress | [Link](https://support.midasuser.com/hc/ko/articles/35954702397209) |
| 115 | /db/PRST | Prestress Beam Loads | [Link](https://support.midasuser.com/hc/ko/articles/35954744402713) |
| 116 | /db/PTNS | Pretension Loads | [Link](https://support.midasuser.com/hc/ko/articles/35954793469593) |
| 117 | /db/EXLD | External Type Load Case for Pretension | [Link](https://support.midasuser.com/hc/ko/articles/35954841849753) |
| 118 | /db/MVCD | Moving Load Code | [Link](https://support.midasuser.com/hc/ko/articles/35955076795929) |
| 119 | /db/LLAN | Traffic Line Lanes | [Link](https://support.midasuser.com/hc/ko/articles/35955170613273) |
| 120 | /db/LLANch | Traffic Line Lanes - China | [Link](https://support.midasuser.com/hc/ko/articles/35955208713241) |
| 121 | /db/LLANid | Traffic Line Lanes - India | [Link](https://support.midasuser.com/hc/ko/articles/35955251576089) |
| 122 | /db/LLANtr | Traffic Line Lanes - Transverse | [Link](https://support.midasuser.com/hc/ko/articles/35955355080217) |
| 123 | /db/LLANop | Traffic Line Lanes - Moving Load Optimizaion | [Link](https://support.midasuser.com/hc/ko/articles/35955410961689) |
| 124 | /db/SLAN | Traffic Surface Lanes | [Link](https://support.midasuser.com/hc/ko/articles/35956862556313) |
| 125 | /db/SLANch | Traffic Surface Lanes - China | [Link](https://support.midasuser.com/hc/ko/articles/35956917206425) |
| 126 | /db/SLANop | Traffic Surface Lanes - Moving Load Optimization | [Link](https://support.midasuser.com/hc/ko/articles/35956982840473) |
| 127 | /db/MVHL | Vehicles - AASHTO Standard | [Link](https://support.midasuser.com/hc/ko/articles/35957125531545) |
| 128 | /db/MVHL | Vehicles - AASHTO LRFD | [Link](https://support.midasuser.com/hc/ko/articles/35957229130521) |
| 129 | /db/MVHL | Vehicles - PENNDOT | [Link](https://support.midasuser.com/hc/ko/articles/35957369367321) |
| 130 | /db/MVHL | Vehicles - Canada | [Link](https://support.midasuser.com/hc/ko/articles/35957455014041) |
| 131 | /db/MVHL | Vehicles - BS | [Link](https://support.midasuser.com/hc/ko/articles/35957522468889) |
| 132 | /db/MVHL | Vehicles - Eurocode | [Link](https://support.midasuser.com/hc/ko/articles/35957725805977) |
| 133 | /db/MVHL | Vehicles - Australia | [Link](https://support.midasuser.com/hc/ko/articles/35957830747033) |
| 134 | /db/MVHL | Vehicles - Poland | [Link](https://support.midasuser.com/hc/ko/articles/35957893970457) |
| 135 | /db/MVHL | Vehicles - Russia | [Link](https://support.midasuser.com/hc/ko/articles/35958016039577) |
| 136 | /db/MVHL | Vehicles - South Africa | [Link](https://support.midasuser.com/hc/ko/articles/35958066812057) |
| 137 | /db/MVHL | Vehicles - Korea | [Link](https://support.midasuser.com/hc/ko/articles/35958302958745) |
| 138 | /db/MVHL | Vehicles - KSCE-LSD15 | [Link](https://support.midasuser.com/hc/ko/articles/35958367637273) |
| 139 | /db/MVHL | Vehicles - China | [Link](https://support.midasuser.com/hc/ko/articles/35958523379353) |
| 140 | /db/MVHL | Vehicles - India | [Link](https://support.midasuser.com/hc/ko/articles/35958578983065) |
| 141 | /db/MVHL | Vehicles - Taiwan | [Link](https://support.midasuser.com/hc/ko/articles/35958804436633) |
| 142 | /db/MVHLtr | Vehicles - Transverse | [Link](https://support.midasuser.com/hc/ko/articles/35958910039321) |
| 143 | /db/MVLD | Moving Load Cases | [Link](https://support.midasuser.com/hc/ko/articles/35959068573209) |
| 144 | /db/MVLDch | Moving Load Cases - China | [Link](https://support.midasuser.com/hc/ko/articles/35960417354649) |
| 145 | /db/MVLDid | Moving Load Cases - India | [Link](https://support.midasuser.com/hc/ko/articles/35961164029593) |
| 146 | /db/MVLDbs | Moving Load Cases - BS | [Link](https://support.midasuser.com/hc/ko/articles/35961459443737) |
| 147 | /db/MVLDeu | Moving Load Cases - Eurocode | [Link](https://support.midasuser.com/hc/ko/articles/35961579883929) |
| 148 | /db/MVLDpl | Moving Load Cases - Poland | [Link](https://support.midasuser.com/hc/ko/articles/35961922701209) |
| 149 | /db/MVLDtr | Moving Load Cases - Transverse | [Link](https://support.midasuser.com/hc/ko/articles/35961950207129) |
| 150 | /db/CRGR | Concurrent Reaction Group | [Link](https://support.midasuser.com/hc/ko/articles/35962261902745) |
| 151 | /db/CJFG | Concurrent Joint Force Group | [Link](https://support.midasuser.com/hc/ko/articles/35962376351769) |
| 152 | /db/MVHC | Vehicle Classes | [Link](https://support.midasuser.com/hc/ko/articles/35962463156761) |
| 153 | /db/SINF | Plate Element for Influence Surface | [Link](https://support.midasuser.com/hc/ko/articles/35962659347481) |
| 154 | /db/MLSP | Lane Support - Negative Moments at Interior Piers | [Link](https://support.midasuser.com/hc/ko/articles/35962967211545) |
| 155 | /db/MLSR | Lane Support - Reactions at Interior Piers | [Link](https://support.midasuser.com/hc/ko/articles/35963167875225) |
| 156 | /db/DYLA | Dynamic Load Allowance | [Link](https://support.midasuser.com/hc/ko/articles/35963288573849) |
| 157 | /db/IMPF | Additional Impact Factor | [Link](https://support.midasuser.com/hc/ko/articles/35963359844889) |
| 158 | /db/DYFG | Railway Dynamic Factor | [Link](https://support.midasuser.com/hc/ko/articles/35963474883097) |
| 159 | /db/DYNF | Railway Dynamic Factor by Element | [Link](https://support.midasuser.com/hc/ko/articles/35963520535577) |
| 160 | /db/SPFC | Response Spectrum Functions - User Type | [Link](https://support.midasuser.com/hc/ko/articles/35963686253593) |
| 161 | /db/SPFC | Response Spectrum Functions - Korea | [Link](https://support.midasuser.com/hc/ko/articles/39235144118297) |
| 162 | /db/SPFC | Response Spectrum Functions - US | [Link](https://support.midasuser.com/hc/ko/articles/39235469691033) |
| 163 | /db/SPFC | Response Spectrum Functions - Eurocode | [Link](https://support.midasuser.com/hc/ko/articles/39235490544281) |
| 164 | /db/SPFC | Response Spectrum Functions - China | [Link](https://support.midasuser.com/hc/ko/articles/39473334759065) |
| 165 | /db/SPFC | Response Spectrum Functions - Japan | [Link](https://support.midasuser.com/hc/ko/articles/39473375938969) |
| 166 | /db/SPFC | Response Spectrum Functions - India | [Link](https://support.midasuser.com/hc/ko/articles/39508760179097) |
| 167 | /db/SPFC | Response Spectrum Functions - Taiwan | [Link](https://support.midasuser.com/hc/ko/articles/39473471043737) |
| 168 | /db/SPFC | Response Spectrum Functions - Other Countries | [Link](https://support.midasuser.com/hc/ko/articles/39508838720153) |
| 169 | /db/SPLC | Response Spectrum Load Cases | [Link](https://support.midasuser.com/hc/ko/articles/35963719599641) |
| 170 | /db/THGC | Time History Global Control | [Link](https://support.midasuser.com/hc/ko/articles/35963819140505) |
| 171 | /db/THIS | Time History Load Cases | [Link](https://support.midasuser.com/hc/ko/articles/35963903917593) |
| 172 | /db/THFC | Time History Functions | [Link](https://support.midasuser.com/hc/ko/articles/35964507702937) |
| 173 | /db/THGA | Ground Acceleration | [Link](https://support.midasuser.com/hc/ko/articles/35964590740633) |
| 174 | /db/THNL | Dynamic Nodal Loads | [Link](https://support.midasuser.com/hc/ko/articles/35964586306841) |
| 175 | /db/THSL | Time Varying Static Loads | [Link](https://support.midasuser.com/hc/ko/articles/35964656837785) |
| 176 | /db/THMS | Multiple Support Excitation | [Link](https://support.midasuser.com/hc/ko/articles/35964708397081) |
| 177 | /db/STAG | Define Construction Stage | [Link](https://support.midasuser.com/hc/ko/articles/35987578396697) |
| 178 | /db/CSCS | Composite Section for Construction Stage | [Link](https://support.midasuser.com/hc/ko/articles/35987625234201) |
| 179 | /db/TMLD | Time Loads for Construction Stage | [Link](https://support.midasuser.com/hc/ko/articles/35987743311385) |
| 180 | /db/STBK | Set-Back Loads for Nonlinear Construction Stage | [Link](https://support.midasuser.com/hc/ko/articles/35987833076505) |
| 181 | /db/CMCS | Camber for Construction Stage | [Link](https://support.midasuser.com/hc/ko/articles/35987807611161) |
| 182 | /db/CRPC | Creep Coefficient for Construction Stage | [Link](https://support.midasuser.com/hc/ko/articles/35987878971545) |
| 183 | /db/ETFC | Ambient Temperature Functions | [Link](https://support.midasuser.com/hc/ko/articles/35988049086489) |
| 184 | /db/CCFC | Convection Coefficient Functions | [Link](https://support.midasuser.com/hc/ko/articles/35988168533785) |
| 185 | /db/HECB | Element Convection Boundary | [Link](https://support.midasuser.com/hc/ko/articles/35988210740761) |
| 186 | /db/HSPT | Prescribed Temperature | [Link](https://support.midasuser.com/hc/ko/articles/35988262538521) |
| 187 | /db/HSFC | Heat Source Functions | [Link](https://support.midasuser.com/hc/ko/articles/35988291377305) |
| 188 | /db/HAHS | Assign Heat Source | [Link](https://support.midasuser.com/hc/ko/articles/35988378892441) |
| 189 | /db/HPCE | Pipe Cooling | [Link](https://support.midasuser.com/hc/ko/articles/35988420776345) |
| 190 | /db/HSTG | Define Construction Stage for Hydration | [Link](https://support.midasuser.com/hc/ko/articles/35988442589465) |
| 191 | /db/SMPT | Settlement Group | [Link](https://support.midasuser.com/hc/ko/articles/35988516836633) |
| 192 | /db/SMLC | Settlement Load Cases | [Link](https://support.midasuser.com/hc/ko/articles/35988560566425) |
| 193 | /db/PLCB | Pre-composite Section | [Link](https://support.midasuser.com/hc/ko/articles/35988644139673) |
| 194 | /db/LDSQ | Load Sequence for Nonlinear | [Link](https://support.midasuser.com/hc/ko/articles/35988663234329) |
| 195 | /db/WVLD | Wave Loads | [Link](https://support.midasuser.com/hc/ko/articles/35988728179097) |
| 196 | /db/IELC | Ignore Elements for Load Cases | [Link](https://support.midasuser.com/hc/ko/articles/35988790960921) |
| 197 | /db/IFGS | Large Displacement - Initial Forces for Geometric Stiffness | [Link](https://support.midasuser.com/hc/ko/articles/35988857497113) |
| 198 | /db/EFCT | Small Displacement - Initial Force Control Data | [Link](https://support.midasuser.com/hc/ko/articles/35988927684633) |
| 199 | /db/INMF | Small Displacement - Initial Element Force | [Link](https://support.midasuser.com/hc/ko/articles/35988975670937) |
| 200 | /db/GALD ᴶ⁾ | Grid Analysis Load | [Link](https://support.midasuser.com/hc/ko/articles/39236719728281) |
| 201 | /db/ACTL | Main Control Data | [Link](https://support.midasuser.com/hc/ko/articles/35409287717657) |
| 202 | /db/PDEL | P-Delta Analysis Control | [Link](https://support.midasuser.com/hc/ko/articles/35989163268249) |
| 203 | /db/BUCK | Buckling Analysis Control | [Link](https://support.midasuser.com/hc/ko/articles/35989190592537) |
| 204 | /db/EIGV | Eigenvalue Analysis Control | [Link](https://support.midasuser.com/hc/ko/articles/35989224565273) |
| 205 | /db/HHCT | Heat of Hydration Analysis Control | [Link](https://support.midasuser.com/hc/ko/articles/35989317531417) |
| 206 | /db/MVCT | Moving Load Analysis Control | [Link](https://support.midasuser.com/hc/ko/articles/35989483364633) |
| 207 | /db/MVCTch | Moving Load Analysis Control - China | [Link](https://support.midasuser.com/hc/ko/articles/35989644995609) |
| 208 | /db/MVCTid | Moving Load Analysis Control - India | [Link](https://support.midasuser.com/hc/ko/articles/35989643553305) |
| 209 | /db/MVCTbs | Moving Load Analysis Control - BS | [Link](https://support.midasuser.com/hc/ko/articles/35989838706969) |
| 210 | /db/MVCTtr | Moving Load Analysis Control - Transverse | [Link](https://support.midasuser.com/hc/ko/articles/35989924517401) |
| 211 | /db/SMCT | Settlement Analysis Control Data | [Link](https://support.midasuser.com/hc/ko/articles/35990184995481) |
| 212 | /db/NLCT | Nonlinear Analysis Control Data | [Link](https://support.midasuser.com/hc/ko/articles/35990229420441) |
| 213 | /db/STCT | Construction Stage Analysis Control Data | [Link](https://support.midasuser.com/hc/ko/articles/35990281053465) |
| 214 | /db/BCCT | Boundary Change Assignment | [Link](https://support.midasuser.com/hc/ko/articles/35736960800281) |
| 215 | /db/LCOM-GEN | Load Combinations - General | [Link](https://support.midasuser.com/hc/ko/articles/35990806887065) |
| 216 | /db/LCOM-CONC | Load Combinations - Concrete Design | [Link](https://support.midasuser.com/hc/ko/articles/35990864052249) |
| 217 | /db/LCOM-STEEL | Load Combinations - Steel Design | [Link](https://support.midasuser.com/hc/ko/articles/35990929861913) |
| 218 | /db/LCOM-SRC | Load Combinations - SRC Design | [Link](https://support.midasuser.com/hc/ko/articles/35991038731161) |
| 219 | /db/LCOM-STLCOMP | Load Combinations - Composite Steel Girder Design | [Link](https://support.midasuser.com/hc/ko/articles/35991080923033) |
| 220 | /db/LCOM-SEISMIC | Load Combinations - Seismic Design | [Link](https://support.midasuser.com/hc/ko/articles/35991142266265) |
| 221 | /db/CUTL | Cutting Line | [Link](https://support.midasuser.com/hc/ko/articles/35991257189017) |
| 222 | /db/CLWP | Plate Cutting Line Diagram | [Link](https://support.midasuser.com/hc/ko/articles/35991500289561) |
| 223 | /db/GSBG | Bridge Girder Diagrams | [Link](https://support.midasuser.com/hc/ko/articles/35991591178265) |
| 224 | /db/GCMB | General Camber Control | [Link](https://support.midasuser.com/hc/ko/articles/35991765204121) |
| 225 | /db/CAMB | FCM Camber Control | [Link](https://support.midasuser.com/hc/ko/articles/35991862460697) |
| 226 | /db/ULFC | Cable Control - Unknown Load Factor Constraints | [Link](https://support.midasuser.com/hc/ko/articles/35991960319897) |
| 227 | /db/THRE | Time History Graph - Element Force Smart Graph | [Link](https://support.midasuser.com/hc/ko/articles/39236753314073) |
| 228 | /db/THRG | Time History Graph - General Link Smart Graph | [Link](https://support.midasuser.com/hc/ko/articles/35992341376025) |
| 229 | /db/THRI | Time History Graph - Inelastic Hinge Smart Graph | [Link](https://support.midasuser.com/hc/ko/articles/35992399685017) |
| 230 | /db/THRS | Time History Graph - Seismic Devices Smart Graph | [Link](https://support.midasuser.com/hc/ko/articles/35992460196121) |
| 231 | /db/HHND | Heat of Hydaration Result Graph | [Link](https://support.midasuser.com/hc/ko/articles/35992577650841) |
| 232 | /db/POGD | Pushover Analysis Control Data | [Link](https://support.midasuser.com/hc/ko/articles/35992664632601) |
| 233 | /db/IEPI | Ignore Elements for Pushover Intial Load | [Link](https://support.midasuser.com/hc/ko/articles/35992797619097) |
| 234 | /db/PHGE | Assign Pushover Hinge Properties | [Link](https://support.midasuser.com/hc/ko/articles/35992838417049) |
| 235 | /db/POLC | Pushover Load Cases | [Link](https://support.midasuser.com/hc/ko/articles/35993449470489) |
| 236 | /db/DCON | RC Design Code | [Link](https://support.midasuser.com/hc/ko/articles/35993633394969) |
| 237 | /db/MATD | Modify Concrete Materials | [Link](https://support.midasuser.com/hc/ko/articles/35993732216985) |
| 238 | /db/RCHK | Rebar Input for Checking - Beam/Column | [Link](https://support.midasuser.com/hc/ko/articles/35993850335897) |
| 239 | /db/LENG | Unbraced Length | [Link](https://support.midasuser.com/hc/ko/articles/49513511154329) |
| 240 | /db/MEMB | Member Assignment | [Link](https://support.midasuser.com/hc/ko/articles/49513603328793) |
| 241 | /db/DCTL | Definition of Frame | [Link](https://support.midasuser.com/hc/ko/articles/49513652948377) |
| 242 | /db/LTSR | Limiting Slenderness Ratio↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513681377689) |
| 243 | /db/ULCT | Underground Load Combination Type↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513792356505) |
| 244 | /db/MBTP | Modify Member Type↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513816193689) |
| 245 | /db/WMAK | Modify Wall Mark Design↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513846785817) |
| 246 | /db/DSTL | Steel Design Code↗ | [Link](https://support.midasuser.com/hc/ko/articles/52149417728665) |

## OPE (13개)

| No | Endpoint | Name | URL |
|----|----------|------|-----|
| 1 | /ope/PROJECTSTATUS | Project Status | [Link](https://support.midasuser.com/hc/ko/articles/35994678976281) |
| 2 | /ope/DIVIDEELEM | Divide Elements | [Link](https://support.midasuser.com/hc/ko/articles/35994694310937) |
| 3 | /ope/SECTPROP | Section Properties Calculation Results | [Link](https://support.midasuser.com/hc/ko/articles/35994769341081) |
| 4 | /ope/USLC | Using Load Combinations | [Link](https://support.midasuser.com/hc/ko/articles/35994827741465) |
| 5 | /ope/LINEBMLD | Line Beam Load | [Link](https://support.midasuser.com/hc/ko/articles/35994879160857) |
| 6 | /ope/AUTOMESH | Auto-Mesh Planar Area | [Link](https://support.midasuser.com/hc/ko/articles/35736427971225) |
| 7 | /ope/SSPS | Surface Spring | [Link](https://support.midasuser.com/hc/ko/articles/39772183634329) |
| 8 | /ope/EDMP | Change Property | [Link](https://support.midasuser.com/hc/ko/articles/39772649347865) |
| 9 | /ope/STOR | Story Calculation | [Link](https://support.midasuser.com/hc/ko/articles/49514653408793) |
| 10 | /ope/STORY_PARAM | Story Check Parameter | [Link](https://support.midasuser.com/hc/ko/articles/49514705474457) |
| 11 | /ope/STORY_IRR_PARAM | Story Irregularity Check Parameter | [Link](https://support.midasuser.com/hc/ko/articles/49514751862425) |
| 12 | /ope/STORPROP | Story Properties | [Link](https://support.midasuser.com/hc/ko/articles/49514773501721) |
| 13 | /ope/MEMB | Member Assignment | [Link](https://support.midasuser.com/hc/ko/articles/49514964272665) |

## VIEW (40개)

| No | Endpoint | Name | URL |
|----|----------|------|-----|
| 1 | /view/SELECT | Select | [Link](https://support.midasuser.com/hc/ko/articles/35995942911257) |
| 2 | /view/CAPTURE | Capture | [Link](https://support.midasuser.com/hc/ko/articles/35996023805337) |
| 3 | /view/PRECAPTURE | Dialog Capture | [Link](https://support.midasuser.com/hc/ko/articles/39236964850329) |
| 4 | /view/ANGLE | Viewpoint | [Link](https://support.midasuser.com/hc/ko/articles/35736247981209) |
| 5 | /view/ACTIVE | Active | [Link](https://support.midasuser.com/hc/ko/articles/35523395368985) |
| 6 | /view/DISPLAY | Display | [Link](https://support.midasuser.com/hc/ko/articles/35996157533977) |
| 7 | /view/RESULTGRAPHIC | Type of Display | [Link](https://support.midasuser.com/hc/ko/articles/35996812786841) |
| 8 | /view/RESULTGRAPHIC | Reaction Forces/Moments - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997222326937) |
| 9 | /view/RESULTGRAPHIC | Soil Pressure - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997247818393) |
| 10 | /view/RESULTGRAPHIC | Deformed Shape - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997589496089) |
| 11 | /view/RESULTGRAPHIC | Displacement Contour - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997611572505) |
| 12 | /view/RESULTGRAPHIC | Truss Forces - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997661413785) |
| 13 | /view/RESULTGRAPHIC | Beam Forces/Moments - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997711810969) |
| 14 | /view/RESULTGRAPHIC | Beam Diagrams - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997754209817) |
| 15 | /view/RESULTGRAPHIC | Plate Forces/Moments - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/35997813329177) |
| 16 | /view/RESULTGRAPHIC | Plate Cutting Line Diagram - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36000934415257) |
| 17 | /view/RESULTGRAPHIC | Resultant Force Diagram | [Link](https://support.midasuser.com/hc/ko/articles/50694881913241) |
| 18 | /view/RESULTGRAPHIC | Truss Stresses - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36001099992985) |
| 19 | /view/RESULTGRAPHIC | Beam Stresses - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36001119330969) |
| 20 | /view/RESULTGRAPHIC | Beam Stresses Diagram - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36001679829785) |
| 21 | /view/RESULTGRAPHIC | Beam Stresses (Equivalent) - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36002326176665) |
| 22 | /view/RESULTGRAPHIC | Beam Stresses Diagram (Equivalent) - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36002496760217) |
| 23 | /view/RESULTGRAPHIC | Beam Stresses (PSC) - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36002716977817) |
| 24 | /view/RESULTGRAPHIC | Plane-Stress/Plate Stresses - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36002978639641) |
| 25 | /view/RESULTGRAPHIC | Plane Strain Stresses - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36003113196441) |
| 26 | /view/RESULTGRAPHIC | Axisymmetric Stresses - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36003190685209) |
| 27 | /view/RESULTGRAPHIC | Solid Stresses - Result Display | [Link](https://support.midasuser.com/hc/ko/articles/36004183629209) |
| 28 | /view/RESULTGRAPHIC | Reactions - Moving Tracer Display | [Link](https://support.midasuser.com/hc/ko/articles/36004234384665) |
| 29 | /view/RESULTGRAPHIC | Displacements - Moving Tracer Display | [Link](https://support.midasuser.com/hc/ko/articles/36004334029593) |
| 30 | /view/RESULTGRAPHIC | Truss Forces - Moving Tracer Display | [Link](https://support.midasuser.com/hc/ko/articles/36004378825497) |
| 31 | /view/RESULTGRAPHIC | Beam Forces/Moments - Moving Tracer Display | [Link](https://support.midasuser.com/hc/ko/articles/36004453575193) |
| 32 | /view/RESULTGRAPHIC | Plate Forces/Moments - Moving Tracer Display | [Link](https://support.midasuser.com/hc/ko/articles/36004497508505) |
| 33 | /view/RESULTGRAPHIC | Beam Stresses - Moving Tracer Display | [Link](https://support.midasuser.com/hc/ko/articles/36005757391385) |
| 34 | /view/RESULTGRAPHIC | Vibration Mode Shapes - Mode Shapes Display | [Link](https://support.midasuser.com/hc/ko/articles/36005864558617) |
| 35 | /view/RESULTGRAPHIC | Buckling Mode Shapes - Mode Shapes Display | [Link](https://support.midasuser.com/hc/ko/articles/36005908557465) |
| 36 | /view/RESULTGRAPHIC | Stress - Heat of Hydration Display | [Link](https://support.midasuser.com/hc/ko/articles/36006059687449) |
| 37 | /view/RESULTGRAPHIC | Temperature - Heat of Hydration Display | [Link](https://support.midasuser.com/hc/ko/articles/36006173505433) |
| 38 | /view/RESULTGRAPHIC | Displacements - Heat of Hydration Display | [Link](https://support.midasuser.com/hc/ko/articles/36006239859225) |
| 39 | /view/RESULTGRAPHIC | Allowable Tensile Stress - Heat of Hydration Display | [Link](https://support.midasuser.com/hc/ko/articles/36006326138521) |
| 40 | /view/RESULTGRAPHIC | Crack Ratio - Heat of Hydration Display | [Link](https://support.midasuser.com/hc/ko/articles/36006358418713) |

## POST (10개)

| No | Endpoint | Name | URL |
|----|----------|------|-----|
| 1 | /post/PM | P-M Interaction Diagram | [Link](https://support.midasuser.com/hc/ko/articles/36021337973017) |
| 2 | /post/STEELCODECHECK | Steel Code Check | [Link](https://support.midasuser.com/hc/ko/articles/44662732910233-Steel-Code-Check) |
| 3 | /post/BEAMDESIGNFORCES | Concrete Design - Beam Design Force | [Link](https://support.midasuser.com/hc/ko/articles/49514295460889) |
| 4 | /post/COLUMNDESIGNFORCES | Concrete Design - Column Design Forces | [Link](https://support.midasuser.com/hc/ko/articles/49514320078489) |
| 5 | /post/BRACEDESIGNFORCES | Concrete Design - Brace Design Forces | [Link](https://support.midasuser.com/hc/ko/articles/49514395318041) |
| 6 | /post/WALLDESIGNFORCES | Concrete Design - Wall Design Forces | [Link](https://support.midasuser.com/hc/ko/articles/49514433321881) |
| 7 | /post/STEELMEMBERDESIGNFORCES | Steel Design - Steel Member Design Forces | [Link](https://support.midasuser.com/hc/ko/articles/49514496461593) |
| 8 | /post/SRCBEAMDESIGNFORCES | SRC Design - SRC Beam Design Forces | [Link](https://support.midasuser.com/hc/ko/articles/49514560567961) |
| 9 | /post/SRCCOLUMNDESIGNFORCES SRC | SRC Design - SRC Column Design Forces | [Link](https://support.midasuser.com/hc/ko/articles/49514609393049) |
| 10 | /post/COLDFORMEDSTEELMEMBERDESIGNFORCES | Cold Formed Design - Cold Formed Steel Member Design Forces | [Link](https://support.midasuser.com/hc/ko/articles/49514621265305) |

## POST/TABLE 결과 테이블 (121개)

| No | Name | URL |
|----|------|-----|
| 1 | Designing with Intent: The Vision Behind POST/TABLE | [Link](https://support.midasuser.com/hc/ko/articles/45171987915929-Designing-with-Intent-The-Vision-Behind-POST-TABLE) |
| 2 | Element Weight Table | [Link](https://support.midasuser.com/hc/ko/articles/36007474964249) |
| 3 | Nodal Body Force Table | [Link](https://support.midasuser.com/hc/ko/articles/36007518091289) |
| 4 | Mass Summary Table | [Link](https://support.midasuser.com/hc/ko/articles/36007577052441) |
| 5 | Load Summary Table | [Link](https://support.midasuser.com/hc/ko/articles/36007640088857) |
| 6 | Material Table | [Link](https://support.midasuser.com/hc/ko/articles/43835303404825) |
| 7 | Section Table | [Link](https://support.midasuser.com/hc/ko/articles/43835398107801) |
| 8 | Restraint Support Table | [Link](https://support.midasuser.com/hc/ko/articles/43835481307161) |
| 9 | Story Mass Summary Table | [Link](https://support.midasuser.com/hc/ko/articles/49514136996889) |
| 10 | Story Load Summary Table | [Link](https://support.midasuser.com/hc/ko/articles/49514148775705) |
| 11 | Story Weight Table | [Link](https://support.midasuser.com/hc/ko/articles/49514231584921) |
| 12 | Reaction - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36009349748249) |
| 13 | Displacements - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36009638400281) |
| 14 | Truss Force - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36009739012249) |
| 15 | Truss Stress - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36010188199833) |
| 16 | Cable Force - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36010315199001) |
| 17 | Cable Configuration - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36011013418905) |
| 18 | Cable Efficiency - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36011176175385) |
| 19 | Beam Force - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36011262919705) |
| 20 | Beam Force (Static Prestress) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36011373070745) |
| 21 | Beam Stress - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36011455813273) |
| 22 | Beam Stress (Equivalent) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36011572000153) |
| 23 | Beam Stress (PSC) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36011704177561) |
| 24 | Plate Force (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36012451576985) |
| 25 | Plate Force (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36012742430873) |
| 26 | Plate Force (Unit Length) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36012822385817) |
| 27 | Plate Stress (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013026785433) |
| 28 | Plate Stress (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013101276697) |
| 29 | Plate Strain (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013201499417) |
| 30 | Plate Strain (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013319302809) |
| 31 | Plane Force (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013533471769) |
| 32 | Plane Force (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013633381913) |
| 33 | Plane Stress (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013761320601) |
| 34 | Plane Stress (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013846930969) |
| 35 | Plane Strain Force (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36013937993881) |
| 36 | Plane Strain Force (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36014002581273) |
| 37 | Plane Strain Stress (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36014055094297) |
| 38 | Plane Strain Stress (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36014149296409) |
| 39 | Axisymmetric Force (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36014348032409) |
| 40 | Axisymmetric Force (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36014441528985) |
| 41 | Axisymmetric Stress (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36014896433945) |
| 42 | Axisymmetric Stress (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36014957537433) |
| 43 | Solid Force (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36015113863449) |
| 44 | Solid Force (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36015175530137) |
| 45 | Solid Stress (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36015236608281) |
| 46 | Solid Stress (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36015348343833) |
| 47 | Solid Strain (Local) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017264069017) |
| 48 | Solid Strain (Global) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017308083481) |
| 49 | Elastic Link - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017416195737) |
| 50 | General Link - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017500761369) |
| 51 | Resultant Forces - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017614482201) |
| 52 | Vibration Mode Shape - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017669319321) |
| 53 | Buckling Mode Shape - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017712087065) |
| 54 | Effective Span Length - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017771824281) |
| 55 | Nodal Results of RS - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017837129241) |
| 56 | Tendon Coordinates - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36017935058713) |
| 57 | Tendon Elongation - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018016568345) |
| 58 | Tendon Arrangement - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018062664857) |
| 59 | Tendon Loss - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018150905881) |
| 60 | Tendon Weight - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018235852569) |
| 61 | Tendon Stress Limit Check - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018322624281) |
| 62 | Tendon Approximate Loss - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018411935129) |
| 63 | Composite Section for C.S. (Force and Stress) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018521410457) |
| 64 | Composite Section for C.S. (Self-Constraint Force and Stress) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018582743705) |
| 65 | Element Properties at Each Stage - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018688503065) |
| 66 | Beam Section Properties at Last Stage - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018718339353) |
| 67 | Lack of Fit Force (Truss) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018798699161) |
| 68 | Lack of Fit Force (Beam) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018843180057) |
| 69 | Lack of Fit Force (Plate) - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018883915289) |
| 70 | Equilibrium Element Nodal Force - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018955537177) |
| 71 | Initial Element Force - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36018962493721) |
| 72 | Wall Force/Moment - Analysis Result Table | [Link](https://support.midasuser.com/hc/ko/articles/49513398732953) |
| 73 | Story Drift  - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49511531295257) |
| 74 | Story Displacement  - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49511597474713) |
| 75 | Story Shear(R.S Analysis)  - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49511717907097) |
| 76 | Story Shear Force Coefficient(R.S.Analysis) - Story Result Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49511816211737) |
| 77 | Story Mode Shape - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49511927443481-Story-Mode-Shape-Story-Result-Table) |
| 78 | Story Shear Force Ratio - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49512411760665) |
| 79 | Story Eccentricity - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49511990423833) |
| 80 | Overturning Moment - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49512035391641) |
| 81 | Story Axial Force Sum - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49512116327065) |
| 82 | Story Stability Coefficient - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49512818237849) |
| 83 | Torsional Irregularity Check - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49512900149017) |
| 84 | Torsional Amplification Factor - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513005384089) |
| 85 | Stiffness Irregularity Check (Soft Story) - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513107644057) |
| 86 | Capacity Irregularity Check(Weak Story) - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513198751385) |
| 87 | Criteria for Regularity in Plan - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513284077721) |
| 88 | Ultimate Story Shear For Check - Analysis Story Table↗ | [Link](https://support.midasuser.com/hc/ko/articles/49513305580569) |
| 89 | Displacement/Velocity/Acceleration - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36019076720921) |
| 90 | Beam Force - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020023438361) |
| 91 | Truss Force - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020089749913) |
| 92 | General Link - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020136483353) |
| 93 | Inelastic Hinge Event Time - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020215503257) |
| 94 | Inelastic Hinge Beam Summary - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020290127513) |
| 95 | Inelastic Hinge Truss Summary - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020311969305) |
| 96 | Inelastic Hinge General Link Summary - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020391511961) |
| 97 | Inelastic Hinge Force - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020436094105) |
| 98 | Inelastic Hinge Deformation - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020548520601) |
| 99 | Inelastic Hinge Element Rotation - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020688077209) |
| 100 | Inelastic Hinge Ductility Factor(D/D1) - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020795064089) |
| 101 | Inelastic Hinge Ductility Factor(D/D2) - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020877017497) |
| 102 | Fiber Section Estimate Yield Strength - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/39237582598937) |
| 103 | Fiber Section Elastic Modulus Retention Rate - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/39237678441497) |
| 104 | Fiber Section Maximum Strain of The Cell - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/39237774129433) |
| 105 | Fiber Section Event Step - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/39237785220505) |
| 106 | Fiber Section Average Compression Strain - TH Result Table | [Link](https://support.midasuser.com/hc/ko/articles/39237854424601) |
| 107 | Stress - HY Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020924196249) |
| 108 | Temperature - HY Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36020983264793) |
| 109 | Displacement - HY Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36021071108377) |
| 110 | Tensile Stress - HY Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36021119165081) |
| 111 | Pipe Cooling Nodal Temperature - HY Result Table | [Link](https://support.midasuser.com/hc/ko/articles/36021224509977) |
| 112 | Time History Text - Node Results | [Link](https://support.midasuser.com/hc/ko/articles/36704969941913) |
| 113 | Time History Text - Element Result(Truss, Beam, Plane Stress/Strain, Solid) | [Link](https://support.midasuser.com/hc/ko/articles/36705161290649) |
| 114 | Time History Text - Element Result(Plate) | [Link](https://support.midasuser.com/hc/ko/articles/36705400674585) |
| 115 | Time History Text - Element Result(Wall) | [Link](https://support.midasuser.com/hc/ko/articles/36705611314585) |
| 116 | Time History Text - General Link Result | [Link](https://support.midasuser.com/hc/ko/articles/36705822943257) |
| 117 | Pushover Text - Displacement Result | [Link](https://support.midasuser.com/hc/ko/articles/36705962238873) |
| 118 | Pushover Text - Element Result(Beam, Truss) | [Link](https://support.midasuser.com/hc/ko/articles/36706062373657) |
| 119 | Pushover Text - Element Result(Wall) | [Link](https://support.midasuser.com/hc/ko/articles/36706217576217) |
| 120 | Pushover Text - General Link Result | [Link](https://support.midasuser.com/hc/ko/articles/36706344369049) |
| 121 | Pushover Text - Elastic Link Result | [Link](https://support.midasuser.com/hc/ko/articles/36706383777817) |

