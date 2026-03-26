import os
import csv
import json
import io
from copy import copy
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import MIDAS_API as MIDAS

from models.floorload import (
    KdsLiveLoadItem,
    FloorLoadEntry,
    FloorLoadSaveResponse,
    ImportedFloorLoadItem,
    ImportMidasResponse,
    SyncMidasResponse,
)

router = APIRouter()

_DATA_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_FILE: str = os.path.join(_DATA_DIR, "floor_loads.json")
_CSV_FILE: str = os.path.join(_DATA_DIR, "kds_live_loads.csv")


def _read() -> list[dict]:
    if not os.path.isfile(_FILE):
        return []
    with open(_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write(data: list[dict]) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/kds-live-loads")
def get_kds_live_loads() -> list[KdsLiveLoadItem]:
    """KDS 기준 활하중 데이터 반환 (CSV에서 읽기)"""
    if not os.path.isfile(_CSV_FILE):
        return []
    rows: list[KdsLiveLoadItem] = []
    with open(_CSV_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(KdsLiveLoadItem(
                category=row["대분류"],
                detail=row["소분류"],
                load=row["활하중"],
            ))
    return rows


@router.get("/floor-loads")
def get_floor_loads() -> list[dict]:
    """저장된 Floor Load 목록 반환"""
    return _read()


@router.put("/floor-loads")
def save_floor_loads(body: list[FloorLoadEntry]) -> FloorLoadSaveResponse:
    """Floor Load 목록 전체 저장"""
    raw_list: list[dict] = [entry.model_dump() for entry in body]
    _write(raw_list)
    return FloorLoadSaveResponse(status="saved", count=len(body))


def _find_dead_lc() -> str:
    """Static Load Case에서 Dead Load(TYPE=D) 이름 찾기"""
    try:
        raw: dict = MIDAS.loadCaseDB.get()
        stld: dict = raw.get("STLD", {})
        for val in stld.values():
            if isinstance(val, dict) and val.get("TYPE") == "D":
                return val.get("NAME", "Dead Load")
    except Exception:
        pass
    return "Dead Load"


def _find_live_lc() -> str:
    """Static Load Case에서 Live Load(TYPE=L) 이름 찾기"""
    try:
        raw: dict = MIDAS.loadCaseDB.get()
        stld: dict = raw.get("STLD", {})
        for val in stld.values():
            if isinstance(val, dict) and val.get("TYPE") == "L":
                return val.get("NAME", "Live Load")
    except Exception:
        pass
    return "Live Load"


def _build_fbld_entry(entry: dict, dead_lc: str, live_lc: str, idx: int) -> dict:
    """단일 Floor Load 엔트리를 FBLD 형식으로 변환"""
    floor: str = entry.get("floor", "")
    room: str = entry.get("roomName", "")
    name: str = f"{floor}_{room}" if floor and room else f"FloorLoad_{idx}"

    finish_total: float = 0.0
    for f in entry.get("finishes", []):
        v = f.get("load", "")
        if v:
            try:
                finish_total += float(v)
            except ValueError:
                pass
    slab_load: float = 0.0
    try:
        slab_load = float(entry.get("slabLoad", "0"))
    except ValueError:
        pass
    dead_load: float = finish_total + slab_load

    live_load: float = 0.0
    try:
        live_load = float(entry.get("liveLoad", "0"))
    except ValueError:
        pass

    items: list[dict] = []
    if dead_load > 0:
        items.append({"LCNAME": dead_lc, "FLOOR_LOAD": -dead_load, "OPT_SUB_BEAM_WEIGHT": False})
    if live_load > 0:
        items.append({"LCNAME": live_lc, "FLOOR_LOAD": -live_load, "OPT_SUB_BEAM_WEIGHT": False})

    return {"NAME": name, "DESC": entry.get("usageDetail", ""), "ITEM": items}


@router.post("/floor-loads/sync-midas")
def sync_floor_loads_to_midas() -> SyncMidasResponse:
    """저장된 Floor Load 데이터를 MIDAS FBLD로 동기화 (NAME 기준 매칭, 없으면 신규)"""
    entries: list[dict] = _read()
    if not entries:
        raise HTTPException(status_code=400, detail="동기화할 데이터가 없습니다.")

    dead_lc: str = _find_dead_lc()
    live_lc: str = _find_live_lc()

    try:
        existing_raw: dict = MIDAS.floorLoadDB.get()
    except Exception:
        existing_raw = {}
    existing_fbld: dict = existing_raw.get("FBLD", {})

    name_to_key: dict[str, str] = {}
    for key, val in existing_fbld.items():
        if isinstance(val, dict) and "NAME" in val:
            name_to_key[val["NAME"]] = key

    max_key: int = max((int(k) for k in existing_fbld if k.isdigit()), default=0)

    updated_fbld: dict[str, dict] = {}
    for idx, entry in enumerate(entries, start=1):
        fbld_entry: dict = _build_fbld_entry(entry, dead_lc, live_lc, idx)
        name: str = fbld_entry["NAME"]

        if name in name_to_key:
            updated_fbld[name_to_key[name]] = fbld_entry
        else:
            max_key += 1
            updated_fbld[str(max_key)] = fbld_entry

    try:
        MIDAS.floorLoadDB._data = {"FBLD": updated_fbld}
        MIDAS.floorLoadDB.sync()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    return SyncMidasResponse(status="synced", count=len(updated_fbld))


@router.get("/floor-loads/import-midas")
def import_from_midas() -> ImportMidasResponse:
    """MIDAS FBLD에서 현재 등록목록에 없는 항목을 가져오기"""
    try:
        raw: dict = MIDAS.floorLoadDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    fbld: dict = raw.get("FBLD", {})

    imported: list[ImportedFloorLoadItem] = []
    max_id: int = 0
    dead_lc_name: str = _find_dead_lc()
    live_lc_name: str = _find_live_lc()

    for val in fbld.values():
        if not isinstance(val, dict):
            continue
        name: str = val.get("NAME", "")

        if "_" in name:
            parts: list[str] = name.split("_", 1)
            floor: str = parts[0]
            room: str = parts[1]
        else:
            floor = ""
            room = name

        dead_load: str = ""
        live_load: str = ""
        for item in val.get("ITEM", []):
            load_val: float = abs(item.get("FLOOR_LOAD", 0))
            lc: str = item.get("LCNAME", "")
            if lc == dead_lc_name:
                dead_load = str(round(load_val, 2))
            elif lc == live_lc_name:
                live_load = str(round(load_val, 2))
            elif not dead_load:
                dead_load = str(round(load_val, 2))
            elif not live_load:
                live_load = str(round(load_val, 2))

        max_id += 1
        imported.append(ImportedFloorLoadItem(
            id=max_id,
            floor=floor,
            roomName=room,
            desc="",
            finishes=[
                {"material": "MIDAS 불러오기", "density": "", "thickness": "", "load": dead_load},
                {"material": "", "density": "", "thickness": "", "load": ""},
                {"material": "", "density": "", "thickness": "", "load": ""},
                {"material": "", "density": "", "thickness": "", "load": ""},
                {"material": "", "density": "", "thickness": "", "load": ""},
                {"material": "", "density": "", "thickness": "", "load": ""},
            ],
            slabType="없음",
            slabThickness="",
            slabLoad="",
            usageCategory="",
            usageDetail=val.get("DESC", ""),
            liveLoad=live_load,
        ))

    return ImportMidasResponse(imported=imported, count=len(imported))


@router.get("/floor-loads/export-excel")
def export_excel() -> StreamingResponse:
    """등록 목록을 동양구조 양식 Excel로 내보내기"""
    import openpyxl
    from openpyxl.styles import Font, Border, Side, Alignment, PatternFill

    entries: list[dict] = _read()
    if not entries:
        raise HTTPException(status_code=400, detail="내보낼 데이터가 없습니다.")

    template_path: str = os.path.join(_DATA_DIR, "floor_load_template.xlsx")
    if not os.path.isfile(template_path):
        raise HTTPException(status_code=500, detail="템플릿 파일이 없습니다.")

    wb = openpyxl.load_workbook(template_path)
    ws = wb.active

    ref_fonts: dict[int, Font] = {}
    ref_aligns: dict[int, Alignment] = {}
    ref_numfmts: dict[int, str] = {}
    for col in range(2, 11):  # B~J
        cell = ws.cell(8, col)
        ref_fonts[col] = copy(cell.font)
        ref_aligns[col] = copy(cell.alignment)
        ref_numfmts[col] = cell.number_format

    merges_to_remove = [m for m in ws.merged_cells.ranges if m.min_row >= 8]
    for m in merges_to_remove:
        ws.unmerge_cells(str(m))
    ws.delete_rows(8, ws.max_row - 7)

    try:
        proj_raw: dict = MIDAS.projectDB.get()
        pjcf: dict = proj_raw.get("PJCF", {})
        proj_data: dict = next(iter(pjcf.values()), {})
        project_name: str = proj_data.get("PROJECT", "")
        if project_name:
            ws.cell(4, 2).value = f"Project : {project_name}"
    except Exception:
        pass

    thin = Side(style='thin')
    dotted = Side(style='dotted')
    no_side = Side(style=None)

    col_sides: dict[int, tuple[Side, Side]] = {
        2: (thin, dotted),
        3: (dotted, thin),
        4: (thin, dotted),
        5: (dotted, dotted),
        6: (dotted, dotted),
        7: (dotted, thin),
        8: (thin, thin),
        9: (thin, thin),
        10: (thin, thin),
    }

    subtotal_fill = PatternFill(patternType='solid', fgColor='BFBFBF')

    def make_border(col: int, is_first: bool, is_last: bool) -> Border:
        """실명 블록 내 위치에 따라 테두리 생성 (내부 수평 테두리 없음)"""
        left, right = col_sides.get(col, (thin, thin))
        top = thin if is_first else no_side
        bottom = thin if is_last else no_side
        return Border(left=left, right=right, top=top, bottom=bottom)

    def style_cell(cell, col: int, is_first: bool = False, is_last: bool = False,
                   bold: bool = False, fill=None) -> None:
        """셀 스타일 적용"""
        ref_font = ref_fonts.get(col)
        if bold and ref_font:
            cell.font = Font(name=ref_font.name, size=ref_font.size, bold=True)
        elif ref_font:
            cell.font = copy(ref_font)
        cell.border = make_border(col, is_first, is_last)
        cell.alignment = copy(ref_aligns.get(col, Alignment()))
        cell.number_format = ref_numfmts.get(col, "General")
        if fill:
            cell.fill = fill

    row: int = 8

    for entry in entries:
        floor: str = entry.get("floor", "")
        room_name: str = entry.get("roomName", "")
        usage_detail: str = entry.get("usageDetail", "")
        finishes: list[dict] = entry.get("finishes", [])
        slab_type: str = entry.get("slabType", "없음")
        slab_thickness: str = entry.get("slabThickness", "")
        slab_load_str: str = entry.get("slabLoad", "")
        live_load_str: str = entry.get("liveLoad", "")

        active_finishes: list[dict] = [f for f in finishes if f.get("material") or f.get("load")]
        if not active_finishes:
            active_finishes = [{"material": "", "density": "", "thickness": "", "load": ""}]

        has_slab: bool = slab_type != "없음" and bool(slab_load_str)
        total_rows: int = len(active_finishes) + 1 + (1 if has_slab else 0) + 1
        start_row: int = row
        end_row: int = start_row + total_rows - 1

        finish_total: float = 0.0
        for f in active_finishes:
            v = f.get("load", "")
            try:
                finish_total += float(v)
            except (ValueError, TypeError):
                pass

        slab_load: float = 0.0
        try:
            slab_load = float(slab_load_str)
        except (ValueError, TypeError):
            pass

        dead_load: float = finish_total + slab_load
        live_load: float = 0.0
        try:
            live_load = float(live_load_str)
        except (ValueError, TypeError):
            pass

        for i, f in enumerate(active_finishes):
            is_first: bool = (row == start_row)
            is_last: bool = (row == end_row)
            for col in range(2, 11):
                style_cell(ws.cell(row, col), col, is_first=is_first, is_last=is_last)

            if i == 0:
                ws.cell(row, 2).value = floor
                ws.cell(row, 3).value = room_name
                h_cell = ws.cell(row, 8)
                h_cell.value = f"[{usage_detail}]" if usage_detail else ""
                h_cell.font = Font(name=ref_fonts[8].name, size=7)

            ws.cell(row, 4).value = f.get("material", "")
            thick: str = f.get("thickness", "")
            dens: str = f.get("density", "")
            load: str = f.get("load", "")
            if thick:
                try:
                    ws.cell(row, 5).value = float(thick)
                except ValueError:
                    ws.cell(row, 5).value = thick
            if dens:
                try:
                    ws.cell(row, 6).value = float(dens)
                except ValueError:
                    ws.cell(row, 6).value = dens
            if load:
                try:
                    ws.cell(row, 7).value = float(load)
                except ValueError:
                    ws.cell(row, 7).value = load
            row += 1

        is_first = (row == start_row)
        is_last = (row == end_row)
        for col in range(2, 11):
            fill = subtotal_fill if 4 <= col <= 7 else None
            bold: bool = (col == 7)
            style_cell(ws.cell(row, col), col, is_first=is_first, is_last=is_last,
                       bold=bold, fill=fill)
        ws.cell(row, 4).value = "마감하중 소계"
        ws.cell(row, 7).value = round(finish_total, 2)
        row += 1

        if has_slab:
            is_first = (row == start_row)
            is_last = (row == end_row)
            for col in range(2, 11):
                style_cell(ws.cell(row, col), col, is_first=is_first, is_last=is_last)
            ws.cell(row, 4).value = slab_type
            if slab_thickness:
                try:
                    ws.cell(row, 5).value = float(slab_thickness)
                except ValueError:
                    pass
            density_map: dict[str, int] = {
                "철근콘크리트 슬래브": 24,
                "트러스형 데크슬래브": 23,
                "골형 데크슬래브": 18,
            }
            d: int | None = density_map.get(slab_type)
            if d:
                ws.cell(row, 6).value = d
            ws.cell(row, 7).value = round(slab_load, 2)
            row += 1

        for col in range(2, 11):
            bold = (col >= 7)
            style_cell(ws.cell(row, col), col, is_first=(row == start_row),
                       is_last=True, bold=bold)
        ws.cell(row, 4).value = "고정하중 계"
        ws.cell(row, 7).value = round(dead_load, 2)
        ws.cell(row, 8).value = round(live_load, 2) if live_load else None
        ws.cell(row, 9).value = round(dead_load + live_load, 2)
        ws.cell(row, 10).value = round(1.2 * dead_load + 1.6 * live_load, 2)
        row += 1

        if end_row > start_row:
            for merge_col in ["B", "C"]:
                ws.merge_cells(f"{merge_col}{start_row}:{merge_col}{end_row}")
            h_end: int = end_row - 1
            if h_end > start_row:
                ws.merge_cells(f"H{start_row}:H{h_end}")
                ws.merge_cells(f"I{start_row}:I{h_end}")
                ws.merge_cells(f"J{start_row}:J{h_end}")

    buf: io.BytesIO = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    import zipfile
    import re

    template_zip = zipfile.ZipFile(template_path, 'r')
    out_buf: io.BytesIO = io.BytesIO()

    with zipfile.ZipFile(buf, 'r') as saved_zip, \
         zipfile.ZipFile(out_buf, 'w', zipfile.ZIP_DEFLATED) as out_zip:

        saved_names: set[str] = set(saved_zip.namelist())
        tmpl_names: set[str] = set(template_zip.namelist())

        restore_prefixes: tuple[str, ...] = ('xl/drawings/', 'xl/media/', 'xl/richData/')
        restore_files: set[str] = {
            n for n in tmpl_names
            if any(n.startswith(p) for p in restore_prefixes)
            or n == 'xl/metadata.xml'
        }

        for item in saved_zip.namelist():
            data: bytes = saved_zip.read(item)

            if item == '[Content_Types].xml':
                data = template_zip.read(item)

            elif item == 'xl/worksheets/sheet1.xml':
                content: str = data.decode('utf-8')
                if 'xmlns:r=' not in content:
                    content = content.replace(
                        'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
                        'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')
                if '<drawing' not in content:
                    content = content.replace(
                        '</worksheet>',
                        '<drawing r:id="rId2"/></worksheet>')
                content = re.sub(
                    r'(<c r="I2" [^>]*)(t="e")',
                    r'\1\2 vm="1"',
                    content)
                data = content.encode('utf-8')

            elif item == 'xl/_rels/workbook.xml.rels':
                content = data.decode('utf-8')
                tmpl_rels: str = template_zip.read(item).decode('utf-8')
                extra_rels: list[str] = re.findall(
                    r'<Relationship [^>]*(?:richdata|richvalue|rdRich|metadata)[^>]*/?>',
                    tmpl_rels, re.IGNORECASE)
                if extra_rels:
                    existing_ids: list[int] = [int(x) for x in re.findall(r'Id="rId(\d+)"', content)]
                    next_id: int = max(existing_ids) + 1 if existing_ids else 10
                    for rel in extra_rels:
                        new_rel: str = re.sub(r'Id="rId\d+"', f'Id="rId{next_id}"', rel)
                        new_rel = new_rel.replace('Target="/xl/', 'Target="')
                        content = content.replace(
                            '</Relationships>',
                            new_rel + '</Relationships>')
                        next_id += 1
                data = content.encode('utf-8')

            out_zip.writestr(item, data)

        for tf in tmpl_names:
            if tf not in saved_names:
                out_zip.writestr(tf, template_zip.read(tf))

    template_zip.close()
    out_buf.seek(0)

    return StreamingResponse(
        out_buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=floor_load_table.xlsx"},
    )
