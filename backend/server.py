from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'ot_tracker')
if mongo_url:
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
else:
    logging.warning("MONGO_URL not set — database features disabled. Set MONGO_URL in Railway env vars.")
    client = None
    db = None

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== CPD 2026 PERIODS ====================

CPD_PERIODS = {
    "ADJ":  {"label": "Adj. Week",  "start": "01/01/2026", "end": "01/07/2026"},
    "P1":   {"label": "Period 1",   "start": "01/08/2026", "end": "02/04/2026"},
    "P2":   {"label": "Period 2",   "start": "02/05/2026", "end": "03/04/2026"},
    "P3":   {"label": "Period 3",   "start": "03/05/2026", "end": "04/01/2026"},
    "P4":   {"label": "Period 4",   "start": "04/02/2026", "end": "04/29/2026"},
    "P5":   {"label": "Period 5",   "start": "04/30/2026", "end": "05/27/2026"},
    "P6":   {"label": "Period 6",   "start": "05/28/2026", "end": "06/24/2026"},
    "P7":   {"label": "Period 7",   "start": "06/25/2026", "end": "07/22/2026"},
    "P8":   {"label": "Period 8",   "start": "07/23/2026", "end": "08/19/2026"},
    "P9":   {"label": "Period 9",   "start": "08/20/2026", "end": "09/16/2026"},
    "P10":  {"label": "Period 10",  "start": "09/17/2026", "end": "10/14/2026"},
    "P11":  {"label": "Period 11",  "start": "10/15/2026", "end": "11/11/2026"},
    "P12":  {"label": "Period 12",  "start": "11/12/2026", "end": "12/09/2026"},
    "P13":  {"label": "Period 13",  "start": "12/10/2026", "end": "01/06/2027"},
}

OT_DAYS = ["thursday", "friday", "saturday", "sunday"]
SHEET_TYPES = ["rdo", "days_ext", "nights_ext"]
OT_HOURS = {"rdo": 9, "days_ext": 4, "nights_ext": 4}
TEAMS = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E']

def get_current_period() -> str:
    today = datetime.now(timezone.utc)
    for pid, info in CPD_PERIODS.items():
        try:
            start = datetime.strptime(info["start"], "%m/%d/%Y").replace(tzinfo=timezone.utc)
            end = datetime.strptime(info["end"], "%m/%d/%Y").replace(tzinfo=timezone.utc)
            if start <= today <= end:
                return pid
        except:
            pass
    return "P1"

# ==================== MODELS ====================

class Officer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    last_name: str
    first_name: str
    star: str
    seniority_date: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OfficerCreate(BaseModel):
    last_name: str
    first_name: str
    star: str
    seniority_date: str

class OfficerUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    star: Optional[str] = None
    seniority_date: Optional[str] = None

class Assignment(BaseModel):
    officer_id: Optional[str] = None
    officer_display: Optional[str] = None
    star: Optional[str] = None
    seniority: Optional[str] = None
    timestamp: Optional[str] = None
    isManual: Optional[bool] = False

class BumpedOfficer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    officer_name: str
    officer_star: str
    officer_seniority: str
    bumped_by_name: str
    bumped_by_star: str
    bumped_by_seniority: str
    day: str
    sheet_type: str
    period: Optional[str] = None
    assignment_slot: str
    bumped_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    notified: bool = False

class SheetRow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team: str
    officer_number: Optional[str] = None
    deployment_location: Optional[str] = None
    assignment_a: Optional[Assignment] = None
    voided: Optional[bool] = False
    voided_by: Optional[str] = None
    voided_at: Optional[str] = None

class OTSheet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sheet_type: str
    period: Optional[str] = None
    day: Optional[str] = None
    sergeant_name: Optional[str] = None
    sergeant_star: Optional[str] = None
    rows: List[SheetRow] = []
    locked: bool = False
    locked_at: Optional[str] = None
    locked_by: Optional[str] = None
    auto_lock_time: Optional[str] = None
    auto_lock_enabled: bool = False
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ── Accumulation Models ──────────────────────────────────────

class OfficerAccumulation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    officer_display: str
    star: str
    period: str
    rdo_hours: float = 0
    days_ext_hours: float = 0
    nights_ext_hours: float = 0
    total_hours: float = 0
    shifts_worked: int = 0
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PeriodSummary(BaseModel):
    period: str
    period_label: str
    officers: List[Dict]
    total_rdo_hours: float
    total_days_ext_hours: float
    total_nights_ext_hours: float
    total_hours: float
    total_shifts: int

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    message: str
    is_admin: bool = False

class VersionLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version: str
    updated_by: str
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    notes: str

# ==================== AUTH ====================

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    if request.username == "Admin214" and request.password == "Chicago214":
        return LoginResponse(success=True, message="Login successful", is_admin=True)
    return LoginResponse(success=False, message="Invalid credentials", is_admin=False)

# ==================== PERIODS ====================

@api_router.get("/periods")
async def get_periods():
    current = get_current_period()
    return {
        "periods": CPD_PERIODS,
        "current_period": current,
        "days": OT_DAYS,
        "sheet_types": SHEET_TYPES,
        "ot_hours": OT_HOURS,
    }

# ==================== OFFICERS ====================

@api_router.get("/officers", response_model=List[Officer])
async def get_officers():
    officers = await db.officers.find({}, {"_id": 0}).to_list(1000)
    def parse_date(date_str):
        try:
            parts = date_str.split('/')
            return datetime(int(parts[2]), int(parts[0]), int(parts[1]))
        except:
            return datetime.max
    officers.sort(key=lambda x: parse_date(x.get('seniority_date', '')))
    return officers

@api_router.post("/officers", response_model=Officer)
async def create_officer(officer: OfficerCreate):
    officer_obj = Officer(**officer.model_dump())
    await db.officers.insert_one(officer_obj.model_dump())
    await log_version_change("Officer added", f"Added {officer.last_name}, {officer.first_name}")
    return officer_obj

@api_router.put("/officers/{officer_id}", response_model=Officer)
async def update_officer(officer_id: str, officer: OfficerUpdate):
    update_data = {k: v for k, v in officer.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.officers.find_one_and_update(
        {"id": officer_id}, {"$set": update_data}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Officer not found")
    result.pop('_id', None)
    await log_version_change("Officer updated", f"Updated officer {officer_id}")
    return Officer(**result)

@api_router.delete("/officers/{officer_id}")
async def delete_officer(officer_id: str):
    result = await db.officers.delete_one({"id": officer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Officer not found")
    await log_version_change("Officer removed", f"Removed officer {officer_id}")
    return {"message": "Officer deleted"}

# ==================== OT SHEETS ====================

def make_sheet_id(period: str, day: str, sheet_type: str) -> str:
    return f"{period}_{day}_{sheet_type}"

def make_default_sheet(period: str, day: str, sheet_type: str) -> dict:
    rows = [SheetRow(team=t).model_dump() for t in TEAMS]
    sheet = OTSheet(sheet_type=sheet_type, period=period, day=day, rows=rows).model_dump()
    sheet['sheet_id'] = make_sheet_id(period, day, sheet_type)
    return sheet

@api_router.get("/sheets/{period}/{day}/{sheet_type}", response_model=OTSheet)
async def get_sheet(period: str, day: str, sheet_type: str):
    sheet_id = make_sheet_id(period, day, sheet_type)
    sheet = await db.sheets.find_one({"sheet_id": sheet_id}, {"_id": 0})
    if not sheet:
        sheet = make_default_sheet(period, day, sheet_type)
        await db.sheets.insert_one(sheet)
    return sheet

@api_router.put("/sheets/{period}/{day}/{sheet_type}", response_model=OTSheet)
async def update_sheet(period: str, day: str, sheet_type: str, sheet: OTSheet):
    sheet_id = make_sheet_id(period, day, sheet_type)
    sheet_dict = sheet.model_dump()
    sheet_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    sheet_dict['sheet_id'] = sheet_id
    sheet_dict['period'] = period
    sheet_dict['day'] = day

    # Update accumulation when sheet is saved
    await _recalc_accumulation_for_sheet(period, sheet_dict)

    await db.sheets.update_one({"sheet_id": sheet_id}, {"$set": sheet_dict}, upsert=True)
    await log_version_change("Sheet updated", f"Updated {period} {day} {sheet_type}")
    return sheet

# Legacy endpoints for backward compatibility
@api_router.get("/sheets/{day}/{sheet_type}", response_model=OTSheet)
async def get_sheet_legacy(day: str, sheet_type: str):
    period = get_current_period()
    return await get_sheet(period, day, sheet_type)

@api_router.put("/sheets/{day}/{sheet_type}", response_model=OTSheet)
async def update_sheet_legacy(day: str, sheet_type: str, sheet: OTSheet):
    period = get_current_period()
    return await update_sheet(period, day, sheet_type, sheet)

@api_router.post("/sheets/reset")
async def reset_all_sheets(period: Optional[str] = None):
    target_period = period or get_current_period()
    for day in OT_DAYS:
        for sheet_type in SHEET_TYPES:
            sheet_id = make_sheet_id(target_period, day, sheet_type)
            sheet = make_default_sheet(target_period, day, sheet_type)
            await db.sheets.update_one({"sheet_id": sheet_id}, {"$set": sheet}, upsert=True)
    # Reset accumulation for this period
    await db.accumulation.delete_many({"period": target_period})
    await log_version_change("Reset", f"All sheets reset for {target_period}")
    return {"message": f"All sheets reset for {target_period}"}

# ==================== ACCUMULATION ====================

async def _recalc_accumulation_for_sheet(period: str, sheet_dict: dict):
    """Recalculate accumulation totals from scratch for all sheets in a period."""
    sheet_type = sheet_dict.get('sheet_type', '')
    hours_per_shift = OT_HOURS.get(sheet_type, 0)

    # Get all officers assigned in this sheet
    for row in sheet_dict.get('rows', []):
        assignment = row.get('assignment_a') or {}
        officer_id = assignment.get('officer_id')
        if not officer_id:
            continue

        officer_display = assignment.get('officer_display', '')
        star = assignment.get('star', '')

        # Get or init accumulation record
        accum_id = f"{period}_{officer_id}"
        existing = await db.accumulation.find_one({"accum_id": accum_id}, {"_id": 0})

        if not existing:
            # Full recalc from all sheets for this period + officer
            await _full_recalc_officer_period(officer_id, officer_display, star, period)
        else:
            # Just recalc this sheet_type column
            await _full_recalc_officer_period(officer_id, officer_display, star, period)

async def _full_recalc_officer_period(officer_id: str, officer_display: str, star: str, period: str):
    """Recalculate all accumulation for one officer + one period from raw sheet data."""
    rdo = days = nights = shifts = 0

    for day in OT_DAYS:
        for sheet_type in SHEET_TYPES:
            sheet_id = make_sheet_id(period, day, sheet_type)
            sheet = await db.sheets.find_one({"sheet_id": sheet_id}, {"_id": 0})
            if not sheet:
                continue
            for row in sheet.get('rows', []):
                a = row.get('assignment_a') or {}
                if a.get('officer_id') == officer_id:
                    h = OT_HOURS.get(sheet_type, 0)
                    if sheet_type == 'rdo':
                        rdo += h
                    elif sheet_type == 'days_ext':
                        days += h
                    elif sheet_type == 'nights_ext':
                        nights += h
                    shifts += 1

    accum_id = f"{period}_{officer_id}"
    doc = {
        "accum_id": accum_id,
        "officer_id": officer_id,
        "officer_display": officer_display,
        "star": star,
        "period": period,
        "rdo_hours": rdo,
        "days_ext_hours": days,
        "nights_ext_hours": nights,
        "total_hours": rdo + days + nights,
        "shifts_worked": shifts,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
    await db.accumulation.update_one({"accum_id": accum_id}, {"$set": doc}, upsert=True)

@api_router.get("/accumulation/{period}")
async def get_period_accumulation(period: str):
    records = await db.accumulation.find({"period": period}, {"_id": 0}).to_list(200)
    records.sort(key=lambda x: x.get('total_hours', 0), reverse=True)
    return records

@api_router.get("/accumulation/{period}/{officer_id}")
async def get_officer_period_accumulation(period: str, officer_id: str):
    accum_id = f"{period}_{officer_id}"
    record = await db.accumulation.find_one({"accum_id": accum_id}, {"_id": 0})
    if not record:
        return {"officer_id": officer_id, "period": period, "rdo_hours": 0,
                "days_ext_hours": 0, "nights_ext_hours": 0, "total_hours": 0, "shifts_worked": 0}
    return record

@api_router.get("/accumulation/officer/{officer_id}/ytd")
async def get_officer_ytd(officer_id: str):
    records = await db.accumulation.find({"officer_id": officer_id}, {"_id": 0}).to_list(20)
    ytd_rdo = sum(r.get('rdo_hours', 0) for r in records)
    ytd_days = sum(r.get('days_ext_hours', 0) for r in records)
    ytd_nights = sum(r.get('nights_ext_hours', 0) for r in records)
    ytd_total = sum(r.get('total_hours', 0) for r in records)
    ytd_shifts = sum(r.get('shifts_worked', 0) for r in records)
    return {
        "officer_id": officer_id,
        "ytd_rdo_hours": ytd_rdo,
        "ytd_days_ext_hours": ytd_days,
        "ytd_nights_ext_hours": ytd_nights,
        "ytd_total_hours": ytd_total,
        "ytd_shifts": ytd_shifts,
        "by_period": sorted(records, key=lambda x: x.get('period', '')),
    }

@api_router.post("/accumulation/{period}/recalculate")
async def recalculate_period(period: str):
    """Full recalculation of all accumulation for a period — run after bulk imports."""
    officers = await db.officers.find({}, {"_id": 0}).to_list(200)
    for officer in officers:
        await _full_recalc_officer_period(
            officer['id'],
            f"{officer['last_name']}, {officer['first_name']}",
            officer['star'],
            period
        )
    return {"message": f"Recalculated accumulation for {period}", "officers_processed": len(officers)}

@api_router.get("/period-summary/{period}")
async def get_period_summary(period: str):
    records = await db.accumulation.find({"period": period}, {"_id": 0}).to_list(200)
    records.sort(key=lambda x: x.get('total_hours', 0), reverse=True)
    return {
        "period": period,
        "period_label": CPD_PERIODS.get(period, {}).get('label', period),
        "period_dates": CPD_PERIODS.get(period, {}),
        "officers": records,
        "totals": {
            "rdo_hours": sum(r.get('rdo_hours', 0) for r in records),
            "days_ext_hours": sum(r.get('days_ext_hours', 0) for r in records),
            "nights_ext_hours": sum(r.get('nights_ext_hours', 0) for r in records),
            "total_hours": sum(r.get('total_hours', 0) for r in records),
            "shifts": sum(r.get('shifts_worked', 0) for r in records),
        }
    }

@api_router.get("/ytd-summary")
async def get_ytd_summary():
    """All officers year-to-date totals."""
    pipeline = [
        {"$group": {
            "_id": "$officer_id",
            "officer_display": {"$first": "$officer_display"},
            "star": {"$first": "$star"},
            "ytd_rdo": {"$sum": "$rdo_hours"},
            "ytd_days": {"$sum": "$days_ext_hours"},
            "ytd_nights": {"$sum": "$nights_ext_hours"},
            "ytd_total": {"$sum": "$total_hours"},
            "ytd_shifts": {"$sum": "$shifts_worked"},
        }},
        {"$sort": {"ytd_total": -1}}
    ]
    results = await db.accumulation.aggregate(pipeline).to_list(200)
    for r in results:
        r.pop('_id', None)
    return results

# ==================== VERSION LOG ====================

async def log_version_change(action: str, notes: str):
    log = VersionLog(
        version=datetime.now(timezone.utc).strftime("%Y.%m.%d.%H%M"),
        updated_by="Admin",
        notes=f"{action}: {notes}"
    )
    await db.version_logs.insert_one(log.model_dump())

@api_router.get("/version-logs", response_model=List[VersionLog])
async def get_version_logs():
    logs = await db.version_logs.find({}, {"_id": 0}).to_list(100)
    logs.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
    return logs

# ==================== BUMPED OFFICERS ====================

@api_router.get("/bumped-officers")
async def get_bumped_officers():
    bumped = await db.bumped_officers.find({}, {"_id": 0}).to_list(100)
    bumped.sort(key=lambda x: x.get('bumped_at', ''), reverse=True)
    return bumped

@api_router.post("/bumped-officers")
async def add_bumped_officer(bumped: BumpedOfficer):
    await db.bumped_officers.insert_one(bumped.model_dump())
    return bumped

@api_router.put("/bumped-officers/{bumped_id}/notified")
async def mark_bumped_notified(bumped_id: str):
    result = await db.bumped_officers.update_one({"id": bumped_id}, {"$set": {"notified": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Marked as notified"}

@api_router.delete("/bumped-officers/{bumped_id}")
async def delete_bumped_record(bumped_id: str):
    result = await db.bumped_officers.delete_one({"id": bumped_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Record deleted"}

@api_router.delete("/bumped-officers")
async def clear_all_bumped():
    await db.bumped_officers.delete_many({})
    return {"message": "Cleared"}

# ==================== LOCK / AUTO-LOCK ====================

@api_router.post("/sheets/{period}/{day}/{sheet_type}/void-row/{row_index}")
async def void_row(period: str, day: str, sheet_type: str, row_index: int, voided_by: str = "Admin"):
    sheet_id = make_sheet_id(period, day, sheet_type)
    sheet = await db.sheets.find_one({"sheet_id": sheet_id}, {"_id": 0})
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    rows = sheet.get("rows", [])
    if row_index < 0 or row_index >= len(rows):
        raise HTTPException(status_code=400, detail="Invalid row index")
    rows[row_index]["voided"] = True
    rows[row_index]["voided_by"] = voided_by
    rows[row_index]["voided_at"] = datetime.now(timezone.utc).isoformat()
    # Clear any existing assignment if voiding
    rows[row_index]["assignment_a"] = None
    await db.sheets.update_one({"sheet_id": sheet_id}, {"$set": {"rows": rows, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await log_version_change("Void Row", f"Voided row {row_index} on {period} {day} {sheet_type}")
    return {"message": f"Row {row_index} voided"}

@api_router.post("/sheets/{period}/{day}/{sheet_type}/unvoid-row/{row_index}")
async def unvoid_row(period: str, day: str, sheet_type: str, row_index: int):
    sheet_id = make_sheet_id(period, day, sheet_type)
    sheet = await db.sheets.find_one({"sheet_id": sheet_id}, {"_id": 0})
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    rows = sheet.get("rows", [])
    if row_index < 0 or row_index >= len(rows):
        raise HTTPException(status_code=400, detail="Invalid row index")
    rows[row_index]["voided"] = False
    rows[row_index]["voided_by"] = None
    rows[row_index]["voided_at"] = None
    await db.sheets.update_one({"sheet_id": sheet_id}, {"$set": {"rows": rows, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await log_version_change("Unvoid Row", f"Unvoided row {row_index} on {period} {day} {sheet_type}")
    return {"message": f"Row {row_index} restored"}


@api_router.post("/sheets/{period}/{day}/{sheet_type}/lock")
async def lock_sheet(period: str, day: str, sheet_type: str):
    sheet_id = make_sheet_id(period, day, sheet_type)
    await db.sheets.update_one({"sheet_id": sheet_id}, {"$set": {
        "locked": True,
        "locked_at": datetime.now(timezone.utc).isoformat(),
        "locked_by": "Admin"
    }})
    await log_version_change("Lock", f"Locked {period} {day} {sheet_type}")
    return {"message": "Sheet locked"}

@api_router.post("/sheets/{period}/{day}/{sheet_type}/unlock")
async def unlock_sheet(period: str, day: str, sheet_type: str):
    sheet_id = make_sheet_id(period, day, sheet_type)
    await db.sheets.update_one({"sheet_id": sheet_id}, {"$set": {
        "locked": False, "locked_at": None, "locked_by": None
    }})
    await log_version_change("Unlock", f"Unlocked {period} {day} {sheet_type}")
    return {"message": "Sheet unlocked"}

class AutoLockRequest(BaseModel):
    auto_lock_time: Optional[str] = None
    auto_lock_enabled: bool = False

@api_router.post("/sheets/{period}/{day}/{sheet_type}/set-auto-lock")
async def set_auto_lock(period: str, day: str, sheet_type: str, request: AutoLockRequest):
    sheet_id = make_sheet_id(period, day, sheet_type)
    await db.sheets.update_one({"sheet_id": sheet_id}, {"$set": {
        "auto_lock_time": request.auto_lock_time,
        "auto_lock_enabled": request.auto_lock_enabled
    }})
    return {"message": "Auto-lock updated"}

# Legacy lock endpoints
@api_router.post("/sheets/{day}/{sheet_type}/lock")
async def lock_sheet_legacy(day: str, sheet_type: str):
    return await lock_sheet(get_current_period(), day, sheet_type)

@api_router.post("/sheets/{day}/{sheet_type}/unlock")
async def unlock_sheet_legacy(day: str, sheet_type: str):
    return await unlock_sheet(get_current_period(), day, sheet_type)

# ==================== PDF EXPORT ====================

@api_router.get("/sheets/{period}/{day}/{sheet_type}/export-pdf")
async def export_sheet_pdf(period: str, day: str, sheet_type: str):
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch

    sheet_id = make_sheet_id(period, day, sheet_type)
    sheet = await db.sheets.find_one({"sheet_id": sheet_id}, {"_id": 0})
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    day_labels = {d: d.upper() for d in OT_DAYS}
    type_labels = {
        "rdo": "RDO 2000-0500",
        "days_ext": "4HR EXT TOUR (2000-2100 DAYS EXT)",
        "nights_ext": "4HR EXT TOUR (1600-2000 NIGHTS EXT)"
    }
    period_label = CPD_PERIODS.get(period, {}).get('label', period)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter),
                            leftMargin=0.5*inch, rightMargin=0.5*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(
        f"<b>CPD UNIT 214 — {period_label} — {day_labels.get(day, day.upper())} — {type_labels.get(sheet_type, sheet_type.upper())}</b>",
        styles['Title']
    ))
    elements.append(Paragraph(
        f"Sergeant: {sheet.get('sergeant_name','___________')} &nbsp;&nbsp; Star#: {sheet.get('sergeant_star','_____')}",
        styles['Normal']
    ))
    elements.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%m/%d/%Y %H:%M')} UTC",
        styles['Normal']
    ))
    elements.append(Spacer(1, 12))

    data = [['Team', 'BT#', 'Location', 'Officer', 'Star', 'Seniority', 'Date/Time']]
    for row in sheet.get('rows', []):
        a = row.get('assignment_a') or {}
        name = (a.get('officer_display') or '').split(' — ')[0] if a.get('officer_display') else ''
        data.append([
            row.get('team', ''), row.get('officer_number', ''),
            row.get('deployment_location', ''), name,
            a.get('star', ''), a.get('seniority', ''), a.get('timestamp', '')
        ])

    col_widths = [0.5*inch, 0.8*inch, 1.2*inch, 3*inch, 0.7*inch, 1*inch, 0.8*inch]
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
    ]))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)

    filename = f"OT_{period}_{day}_{sheet_type}_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})

@api_router.get("/period-summary/{period}/export-pdf")
async def export_period_summary_pdf(period: str):
    from reportlab.lib.pagesizes import portrait, letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch

    records = await db.accumulation.find({"period": period}, {"_id": 0}).to_list(200)
    records.sort(key=lambda x: x.get('total_hours', 0), reverse=True)

    period_label = CPD_PERIODS.get(period, {}).get('label', period)
    period_dates = CPD_PERIODS.get(period, {})

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=portrait(letter),
                            leftMargin=0.5*inch, rightMargin=0.5*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(f"<b>CPD UNIT 214 — OT ACCUMULATION — {period_label}</b>", styles['Title']))
    elements.append(Paragraph(
        f"{period_dates.get('start','')} — {period_dates.get('end','')} &nbsp;&nbsp; "
        f"Generated: {datetime.now(timezone.utc).strftime('%m/%d/%Y %H:%M')} UTC",
        styles['Normal']
    ))
    elements.append(Spacer(1, 12))

    data = [['Officer', 'Star', 'RDO Hrs', 'Days Ext', 'Nights Ext', 'Total Hrs', 'Shifts']]
    for r in records:
        data.append([
            r.get('officer_display',''), r.get('star',''),
            str(r.get('rdo_hours',0)), str(r.get('days_ext_hours',0)),
            str(r.get('nights_ext_hours',0)), str(r.get('total_hours',0)),
            str(r.get('shifts_worked',0))
        ])
    # Totals row
    data.append([
        'TOTALS', '',
        str(sum(r.get('rdo_hours',0) for r in records)),
        str(sum(r.get('days_ext_hours',0) for r in records)),
        str(sum(r.get('nights_ext_hours',0) for r in records)),
        str(sum(r.get('total_hours',0) for r in records)),
        str(sum(r.get('shifts_worked',0) for r in records)),
    ])

    col_widths = [2.8*inch, 0.7*inch, 0.8*inch, 0.8*inch, 0.9*inch, 0.8*inch, 0.6*inch]
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8fafc')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)

    filename = f"OT_Summary_{period}_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})

# ==================== SEED ====================

@api_router.post("/seed")
async def seed_officers():
    existing = await db.officers.find_one({"star": "10594"})
    if existing:
        count = await db.officers.count_documents({})
        return {"message": "Officers already seeded", "count": count}

    await db.officers.delete_many({})
    await db.version_logs.delete_many({})

    roster = [
        {"last_name": "PARHAM",      "first_name": "ANDRE",       "star": "30",    "seniority_date": "12/02/1996"},
        {"last_name": "SABELLA",     "first_name": "ANTHONY",     "star": "487",   "seniority_date": "08/27/2001"},
        {"last_name": "LEPINE",      "first_name": "WILLIAM",     "star": "2568",  "seniority_date": "01/27/2003"},
        {"last_name": "REYES",       "first_name": "SANTOS",      "star": "954",   "seniority_date": "09/27/2004"},
        {"last_name": "TIM",         "first_name": "JERAD",       "star": "2009",  "seniority_date": "09/01/2010"},
        {"last_name": "WARNER",      "first_name": "NATHANIEL",   "star": "1595",  "seniority_date": "09/01/2010"},
        {"last_name": "KATSANTONES", "first_name": "MICHAEL",     "star": "1201",  "seniority_date": "10/31/2012"},
        {"last_name": "RODRIGUEZ",   "first_name": "SYLVIA",      "star": "10594", "seniority_date": "04/01/2013"},
        {"last_name": "YANEZ",       "first_name": "ARNULFO",     "star": "17142", "seniority_date": "06/03/2013"},
        {"last_name": "CURET",       "first_name": "RAMON",       "star": "11035", "seniority_date": "05/16/2017"},
        {"last_name": "ESSEX",       "first_name": "DARRELL",     "star": "9229",  "seniority_date": "06/16/2017"},
        {"last_name": "BUKALO",      "first_name": "AMRA",        "star": "7811",  "seniority_date": "07/17/2017"},
        {"last_name": "BOYD",        "first_name": "ARIEL",       "star": "8132",  "seniority_date": "07/17/2017"},
        {"last_name": "WALSH",       "first_name": "MICHAEL",     "star": "19921", "seniority_date": "02/20/2018"},
        {"last_name": "MIRANDA",     "first_name": "JESUS",       "star": "15029", "seniority_date": "03/16/2018"},
        {"last_name": "BABILONIA",   "first_name": "HECTOR",      "star": "12321", "seniority_date": "03/16/2018"},
        {"last_name": "OWENS",       "first_name": "MONTY",       "star": "11975", "seniority_date": "03/16/2018"},
        {"last_name": "CARREON",     "first_name": "ALEXANDER",   "star": "4968",  "seniority_date": "06/25/2018"},
        {"last_name": "CRAWFORD",    "first_name": "ROBERT",      "star": "18606", "seniority_date": "08/27/2018"},
        {"last_name": "BERG",        "first_name": "JAMES",       "star": "8462",  "seniority_date": "08/27/2018"},
        {"last_name": "GRASZ",       "first_name": "COURTNEY",    "star": "5835",  "seniority_date": "09/27/2018"},
        {"last_name": "IRIZARRY",    "first_name": "CHRISTOPHER", "star": "18202", "seniority_date": "11/27/2018"},
        {"last_name": "KRAWIEC",     "first_name": "SCOTT",       "star": "4465",  "seniority_date": "11/27/2018"},
        {"last_name": "RUIZ",        "first_name": "MARI MAR",    "star": "17604", "seniority_date": "11/27/2018"},
        {"last_name": "REWERS",      "first_name": "DANIEL",      "star": "15270", "seniority_date": "11/27/2018"},
        {"last_name": "TURBYVILLE",  "first_name": "EMMA",        "star": "15952", "seniority_date": "11/27/2018"},
        {"last_name": "PERRY",       "first_name": "SAMANTHA",    "star": "18052", "seniority_date": "02/19/2019"},
        {"last_name": "HINOJOSA",    "first_name": "RICARDO",     "star": "18773", "seniority_date": "04/16/2019"},
        {"last_name": "GONZALEZ",    "first_name": "CHRISTOPHER", "star": "18195", "seniority_date": "07/16/2019"},
        {"last_name": "REYES",       "first_name": "CHRISTIAN",   "star": "19663", "seniority_date": "11/18/2019"},
        {"last_name": "OMACHI",      "first_name": "GRACE",       "star": "10629", "seniority_date": "12/19/2019"},
        {"last_name": "BENAMON",     "first_name": "CARMON",      "star": "8276",  "seniority_date": "02/18/2020"},
        {"last_name": "PRADO",       "first_name": "HENRY",       "star": "18187", "seniority_date": "02/18/2020"},
        {"last_name": "AZIZ",        "first_name": "PATRICK",     "star": "16188", "seniority_date": "02/16/2021"},
        {"last_name": "CHAMBERLAIN", "first_name": "ELON",        "star": "19670", "seniority_date": "04/16/2021"},
        {"last_name": "ARNOLD",      "first_name": "NICOLE",      "star": "19611", "seniority_date": "04/16/2021"},
        {"last_name": "CURTIS",      "first_name": "CORDELL",     "star": "7722",  "seniority_date": "06/16/2021"},
        {"last_name": "PROZANSKI",   "first_name": "NICHOLAS",    "star": "11179", "seniority_date": "10/25/2021"},
        {"last_name": "SANCHEZ",     "first_name": "GIOVANNI",    "star": "18462", "seniority_date": "04/25/2022"},
        {"last_name": "SANABRIA",    "first_name": "YVETTE",      "star": "5307",  "seniority_date": "06/01/2022"},
        {"last_name": "ALLEN",       "first_name": "JORDAN",      "star": "19248", "seniority_date": "06/01/2022"},
        {"last_name": "WILSON",      "first_name": "STEFAN",      "star": "18360", "seniority_date": "06/01/2022"},
        {"last_name": "BJORKLAND",   "first_name": "CHRISTOPHER", "star": "18423", "seniority_date": "06/30/2022"},
        {"last_name": "RAMOS",       "first_name": "PERLA",       "star": "3050",  "seniority_date": "08/31/2022"},
        {"last_name": "LEMEK",       "first_name": "ALEKSANDER",  "star": "3269",  "seniority_date": "08/31/2022"},
        {"last_name": "LOPEZ",       "first_name": "CHRISTINA",   "star": "3295",  "seniority_date": "08/31/2022"},
        {"last_name": "BISHOP",      "first_name": "SAMANTHA",    "star": "5574",  "seniority_date": "12/02/2022"},
        {"last_name": "LUNA ARCE",   "first_name": "ALEXIS",      "star": "11680", "seniority_date": "12/02/2022"},
        {"last_name": "AVILA",       "first_name": "JOSHUA",      "star": "17883", "seniority_date": "02/27/2023"},
        {"last_name": "MUNOZ",       "first_name": "DANIEL",      "star": "17879", "seniority_date": "04/03/2023"},
    ]

    for o in roster:
        officer = Officer(**o)
        await db.officers.insert_one(officer.model_dump())

    await log_version_change("Seed", f"Seeded {len(roster)} officers")
    return {"message": f"Seeded {len(roster)} officers"}
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve React frontend static files if built
STATIC_DIR = Path(__file__).parent / "frontend" / "build"
if not STATIC_DIR.exists():
    STATIC_DIR = Path(__file__).parent.parent / "frontend" / "build"
if not STATIC_DIR.exists():
    STATIC_DIR = Path("frontend") / "build"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR / "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        index = STATIC_DIR / "index.html"
        return FileResponse(str(index))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
