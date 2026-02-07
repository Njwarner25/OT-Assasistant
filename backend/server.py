from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class Officer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    last_name: str
    first_name: str
    star: str
    seniority_date: str  # MM/DD/YYYY format
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
    assignment_slot: str
    bumped_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    notified: bool = False

class SheetRow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team: str
    officer_number: Optional[str] = None
    deployment_location: Optional[str] = None
    assignment_a: Optional[Assignment] = None
    assignment_b: Optional[Assignment] = None
    assignment_c: Optional[Assignment] = None
    assignment_d: Optional[Assignment] = None
    assignment_e: Optional[Assignment] = None
    assignment_f: Optional[Assignment] = None

class OTSheet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sheet_type: str  # "rdo", "days_ext", "nights_ext"
    sergeant_name: Optional[str] = None
    sergeant_star: Optional[str] = None
    rows: List[SheetRow] = []
    locked: bool = False
    locked_at: Optional[str] = None
    locked_by: Optional[str] = None
    auto_lock_time: Optional[str] = None  # ISO format datetime for auto-lock
    auto_lock_enabled: bool = False
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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
    if request.username == "Admin" and request.password == "123456":
        return LoginResponse(success=True, message="Login successful", is_admin=True)
    return LoginResponse(success=False, message="Invalid credentials", is_admin=False)

# ==================== OFFICERS CRUD ====================

@api_router.get("/officers", response_model=List[Officer])
async def get_officers():
    officers = await db.officers.find({}, {"_id": 0}).to_list(1000)
    # Sort by seniority date (oldest first = most senior)
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
    doc = officer_obj.model_dump()
    await db.officers.insert_one(doc)
    # Log version change
    await log_version_change("Officer added", f"Added {officer.last_name}, {officer.first_name}")
    return officer_obj

@api_router.put("/officers/{officer_id}", response_model=Officer)
async def update_officer(officer_id: str, officer: OfficerUpdate):
    update_data = {k: v for k, v in officer.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.officers.find_one_and_update(
        {"id": officer_id},
        {"$set": update_data},
        return_document=True
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

@api_router.get("/sheets/{day}/{sheet_type}", response_model=OTSheet)
async def get_sheet(day: str, sheet_type: str):
    sheet_id = f"{day}_{sheet_type}"
    sheet = await db.sheets.find_one({"sheet_id": sheet_id}, {"_id": 0})
    if not sheet:
        # Create default sheet structure - all sheets have same team structure
        teams = ['AA', 'AA', 'BB', 'BB', 'CC', 'CC', 'DD', 'DD', 'EE', 'EE']
        rows = []
        for team in teams:
            rows.append(SheetRow(team=team).model_dump())
        
        sheet = OTSheet(sheet_type=sheet_type, rows=rows).model_dump()
        sheet['sheet_id'] = sheet_id
        sheet['day'] = day
        await db.sheets.insert_one(sheet)
    return sheet

@api_router.put("/sheets/{day}/{sheet_type}", response_model=OTSheet)
async def update_sheet(day: str, sheet_type: str, sheet: OTSheet):
    sheet_id = f"{day}_{sheet_type}"
    sheet_dict = sheet.model_dump()
    sheet_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    sheet_dict['sheet_id'] = sheet_id
    sheet_dict['day'] = day
    
    await db.sheets.update_one(
        {"sheet_id": sheet_id},
        {"$set": sheet_dict},
        upsert=True
    )
    return sheet

# Keep old endpoints for backward compatibility
@api_router.get("/sheets/{sheet_type}")
async def get_sheet_legacy(sheet_type: str):
    return await get_sheet("friday", sheet_type)

@api_router.put("/sheets/{sheet_type}")
async def update_sheet_legacy(sheet_type: str, sheet: OTSheet):
    return await update_sheet("friday", sheet_type, sheet)

@api_router.post("/sheets/reset")
async def reset_all_sheets():
    days = ["friday", "saturday", "sunday"]
    sheet_types = ["rdo", "days_ext", "nights_ext"]
    
    for day in days:
        for sheet_type in sheet_types:
            sheet_id = f"{day}_{sheet_type}"
            rows = []
            if sheet_type == "rdo":
                teams = ["A", "A", "B", "B", "C", "C"]
            elif sheet_type == "days_ext":
                teams = ["A", "A", "B", "B"]
            else:
                teams = ["A", "A", "B", "B", "C", "C"]
            
            for team in teams:
                rows.append(SheetRow(team=team).model_dump())
            
            sheet = OTSheet(sheet_type=sheet_type, rows=rows).model_dump()
            sheet['sheet_id'] = sheet_id
            sheet['day'] = day
            await db.sheets.update_one(
                {"sheet_id": sheet_id},
                {"$set": sheet},
                upsert=True
            )
    
    await log_version_change("Reset", "All sheets reset to default")
    return {"message": "All sheets reset successfully"}

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
    doc = bumped.model_dump()
    await db.bumped_officers.insert_one(doc)
    return bumped

@api_router.put("/bumped-officers/{bumped_id}/notified")
async def mark_bumped_notified(bumped_id: str):
    result = await db.bumped_officers.update_one(
        {"id": bumped_id},
        {"$set": {"notified": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bumped officer record not found")
    return {"message": "Marked as notified"}

@api_router.delete("/bumped-officers/{bumped_id}")
async def delete_bumped_record(bumped_id: str):
    result = await db.bumped_officers.delete_one({"id": bumped_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bumped officer record not found")
    return {"message": "Record deleted"}

@api_router.delete("/bumped-officers")
async def clear_all_bumped():
    await db.bumped_officers.delete_many({})
    return {"message": "All bumped officer records cleared"}

# ==================== LOCK SHEET ====================

@api_router.post("/sheets/{day}/{sheet_type}/lock")
async def lock_sheet(day: str, sheet_type: str):
    sheet_id = f"{day}_{sheet_type}"
    result = await db.sheets.update_one(
        {"sheet_id": sheet_id},
        {"$set": {
            "locked": True,
            "locked_at": datetime.now(timezone.utc).isoformat(),
            "locked_by": "Admin"
        }}
    )
    await log_version_change("Lock", f"Locked {day} {sheet_type} sheet")
    return {"message": f"Sheet {day}/{sheet_type} locked"}

@api_router.post("/sheets/{day}/{sheet_type}/unlock")
async def unlock_sheet(day: str, sheet_type: str):
    sheet_id = f"{day}_{sheet_type}"
    result = await db.sheets.update_one(
        {"sheet_id": sheet_id},
        {"$set": {
            "locked": False,
            "locked_at": None,
            "locked_by": None
        }}
    )
    await log_version_change("Unlock", f"Unlocked {day} {sheet_type} sheet")
    return {"message": f"Sheet {day}/{sheet_type} unlocked"}

class AutoLockRequest(BaseModel):
    auto_lock_time: Optional[str] = None  # ISO format or None to disable
    auto_lock_enabled: bool = False

@api_router.post("/sheets/{day}/{sheet_type}/set-auto-lock")
async def set_auto_lock(day: str, sheet_type: str, request: AutoLockRequest):
    sheet_id = f"{day}_{sheet_type}"
    result = await db.sheets.update_one(
        {"sheet_id": sheet_id},
        {"$set": {
            "auto_lock_time": request.auto_lock_time,
            "auto_lock_enabled": request.auto_lock_enabled
        }}
    )
    if request.auto_lock_enabled and request.auto_lock_time:
        await log_version_change("Auto-Lock Set", f"Set auto-lock for {day} {sheet_type} at {request.auto_lock_time}")
    else:
        await log_version_change("Auto-Lock Disabled", f"Disabled auto-lock for {day} {sheet_type}")
    return {"message": f"Auto-lock settings updated for {day}/{sheet_type}"}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_officers():
    # Check if officers already exist by looking for at least one unique star
    existing = await db.officers.find_one({"star": "10594"})
    if existing:
        count = await db.officers.count_documents({})
        return {"message": "Officers already seeded", "count": count}
    
    # Clear any existing data to prevent duplicates
    await db.officers.delete_many({})
    await db.version_logs.delete_many({})
    
    # Unit 214 Officer Roster - Sorted by seniority (oldest first)
    roster_officers = [
        {"last_name": "PARHAM", "first_name": "ANDRE", "star": "30", "seniority_date": "12/02/1996"},
        {"last_name": "SABELLA", "first_name": "ANTHONY", "star": "487", "seniority_date": "08/27/2001"},
        {"last_name": "LEPINE", "first_name": "WILLIAM", "star": "2568", "seniority_date": "01/27/2003"},
        {"last_name": "REYES", "first_name": "SANTOS", "star": "954", "seniority_date": "09/27/2004"},
        {"last_name": "TIM", "first_name": "JERAD", "star": "2009", "seniority_date": "09/01/2010"},
        {"last_name": "WARNER", "first_name": "NATHANIEL", "star": "1595", "seniority_date": "09/01/2010"},
        {"last_name": "KATSANTONES", "first_name": "MICHAEL", "star": "1201", "seniority_date": "10/31/2012"},
        {"last_name": "RODRIGUEZ", "first_name": "SYLVIA", "star": "10594", "seniority_date": "04/01/2013"},
        {"last_name": "YANEZ", "first_name": "ARNULFO", "star": "17142", "seniority_date": "06/03/2013"},
        {"last_name": "CURET", "first_name": "RAMON", "star": "11035", "seniority_date": "05/16/2017"},
        {"last_name": "ESSEX", "first_name": "DARRELL", "star": "9229", "seniority_date": "06/16/2017"},
        {"last_name": "BUKALO", "first_name": "AMRA", "star": "7811", "seniority_date": "07/17/2017"},
        {"last_name": "BOYD", "first_name": "ARIEL", "star": "8132", "seniority_date": "07/17/2017"},
        {"last_name": "WALSH", "first_name": "MICHAEL", "star": "19921", "seniority_date": "02/20/2018"},
        {"last_name": "MIRANDA", "first_name": "JESUS", "star": "15029", "seniority_date": "03/16/2018"},
        {"last_name": "BABILONIA", "first_name": "HECTOR", "star": "12321", "seniority_date": "03/16/2018"},
        {"last_name": "OWENS", "first_name": "MONTY", "star": "11975", "seniority_date": "03/16/2018"},
        {"last_name": "CARREON", "first_name": "ALEXANDER", "star": "4968", "seniority_date": "06/25/2018"},
        {"last_name": "CRAWFORD", "first_name": "ROBERT", "star": "18606", "seniority_date": "08/27/2018"},
        {"last_name": "BERG", "first_name": "JAMES", "star": "8462", "seniority_date": "08/27/2018"},
        {"last_name": "GRASZ", "first_name": "COURTNEY", "star": "5835", "seniority_date": "09/27/2018"},
        {"last_name": "IRIZARRY", "first_name": "CHRISTOPHER", "star": "18202", "seniority_date": "11/27/2018"},
        {"last_name": "KRAWIEC", "first_name": "SCOTT", "star": "4465", "seniority_date": "11/27/2018"},
        {"last_name": "RUIZ", "first_name": "MARI MAR", "star": "17604", "seniority_date": "11/27/2018"},
        {"last_name": "REWERS", "first_name": "DANIEL", "star": "15270", "seniority_date": "11/27/2018"},
        {"last_name": "TURBYVILLE", "first_name": "EMMA", "star": "15952", "seniority_date": "11/27/2018"},
        {"last_name": "PERRY", "first_name": "SAMANTHA", "star": "18052", "seniority_date": "02/19/2019"},
        {"last_name": "HINOJOSA", "first_name": "RICARDO", "star": "18773", "seniority_date": "04/16/2019"},
        {"last_name": "GONZALEZ", "first_name": "CHRISTOPHER", "star": "18195", "seniority_date": "07/16/2019"},
        {"last_name": "REYES", "first_name": "CHRISTIAN", "star": "19663", "seniority_date": "11/18/2019"},
        {"last_name": "OMACHI", "first_name": "GRACE", "star": "10629", "seniority_date": "12/19/2019"},
        {"last_name": "BENAMON", "first_name": "CARMON", "star": "8276", "seniority_date": "02/18/2020"},
        {"last_name": "PRADO", "first_name": "HENRY", "star": "18187", "seniority_date": "02/18/2020"},
        {"last_name": "AZIZ", "first_name": "PATRICK", "star": "16188", "seniority_date": "02/16/2021"},
        {"last_name": "CHAMBERLAIN", "first_name": "ELON", "star": "19670", "seniority_date": "04/16/2021"},
        {"last_name": "ARNOLD", "first_name": "NICOLE", "star": "19611", "seniority_date": "04/16/2021"},
        {"last_name": "CURTIS", "first_name": "CORDELL", "star": "7722", "seniority_date": "06/16/2021"},
        {"last_name": "PROZANSKI", "first_name": "NICHOLAS", "star": "11179", "seniority_date": "10/25/2021"},
        {"last_name": "SANCHEZ", "first_name": "GIOVANNI", "star": "18462", "seniority_date": "04/25/2022"},
        {"last_name": "SANABRIA", "first_name": "YVETTE", "star": "5307", "seniority_date": "06/01/2022"},
        {"last_name": "ALLEN", "first_name": "JORDAN", "star": "19248", "seniority_date": "06/01/2022"},
        {"last_name": "WILSON", "first_name": "STEFAN", "star": "18360", "seniority_date": "06/01/2022"},
        {"last_name": "BJORKLAND", "first_name": "CHRISTOPHER", "star": "18423", "seniority_date": "06/30/2022"},
        {"last_name": "RAMOS", "first_name": "PERLA", "star": "3050", "seniority_date": "08/31/2022"},
        {"last_name": "LEMEK", "first_name": "ALEKSANDER", "star": "3269", "seniority_date": "08/31/2022"},
        {"last_name": "LOPEZ", "first_name": "CHRISTINA", "star": "3295", "seniority_date": "08/31/2022"},
        {"last_name": "BISHOP", "first_name": "SAMANTHA", "star": "5574", "seniority_date": "12/02/2022"},
        {"last_name": "LUNA ARCE", "first_name": "ALEXIS", "star": "11680", "seniority_date": "12/02/2022"},
        {"last_name": "AVILA", "first_name": "JOSHUA", "star": "17883", "seniority_date": "02/27/2023"},
        {"last_name": "MUNOZ", "first_name": "DANIEL", "star": "17879", "seniority_date": "04/03/2023"},
    ]
    
    for officer_data in roster_officers:
        officer = Officer(**officer_data)
        await db.officers.insert_one(officer.model_dump())
    
    await log_version_change("Seed", f"Seeded {len(roster_officers)} officers from Unit 214 roster")
    return {"message": f"Seeded {len(roster_officers)} officers"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
