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

@api_router.get("/sheets/{sheet_type}", response_model=OTSheet)
async def get_sheet(sheet_type: str):
    sheet = await db.sheets.find_one({"sheet_type": sheet_type}, {"_id": 0})
    if not sheet:
        # Create default sheet structure
        rows = []
        if sheet_type == "rdo":
            teams = ["A", "A", "B", "B", "C", "C"]
        elif sheet_type == "days_ext":
            teams = ["A", "A", "B", "B"]
        else:  # nights_ext
            teams = ["A", "A", "B", "B", "C", "C"]
        
        for team in teams:
            rows.append(SheetRow(team=team).model_dump())
        
        sheet = OTSheet(sheet_type=sheet_type, rows=rows).model_dump()
        await db.sheets.insert_one(sheet)
    return sheet

@api_router.put("/sheets/{sheet_type}", response_model=OTSheet)
async def update_sheet(sheet_type: str, sheet: OTSheet):
    sheet_dict = sheet.model_dump()
    sheet_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.sheets.update_one(
        {"sheet_type": sheet_type},
        {"$set": sheet_dict},
        upsert=True
    )
    return sheet

@api_router.post("/sheets/reset")
async def reset_all_sheets():
    sheet_types = ["rdo", "days_ext", "nights_ext"]
    for sheet_type in sheet_types:
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
        await db.sheets.update_one(
            {"sheet_type": sheet_type},
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

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_officers():
    # Check if officers already exist
    count = await db.officers.count_documents({})
    if count > 0:
        return {"message": "Officers already seeded", "count": count}
    
    # Sample officer data sorted by seniority (oldest first)
    sample_officers = [
        {"last_name": "RODRIGUEZ", "first_name": "SYLVIA", "star": "10594", "seniority_date": "04/01/2013"},
        {"last_name": "YANEZ", "first_name": "ARNULFO", "star": "17142", "seniority_date": "06/03/2013"},
        {"last_name": "THOMPSON", "first_name": "MICHAEL", "star": "15823", "seniority_date": "08/15/2014"},
        {"last_name": "JOHNSON", "first_name": "DAVID", "star": "12456", "seniority_date": "01/22/2015"},
        {"last_name": "MARTINEZ", "first_name": "MARIA", "star": "18934", "seniority_date": "03/10/2015"},
        {"last_name": "WILLIAMS", "first_name": "JAMES", "star": "14567", "seniority_date": "07/04/2016"},
        {"last_name": "CURET", "first_name": "RAMON", "star": "11035", "seniority_date": "05/16/2017"},
        {"last_name": "BROWN", "first_name": "ROBERT", "star": "16789", "seniority_date": "09/20/2017"},
        {"last_name": "DAVIS", "first_name": "PATRICIA", "star": "13245", "seniority_date": "02/14/2018"},
        {"last_name": "MILLER", "first_name": "JENNIFER", "star": "19876", "seniority_date": "06/30/2018"},
        {"last_name": "WILSON", "first_name": "LINDA", "star": "11234", "seniority_date": "11/11/2018"},
        {"last_name": "MOORE", "first_name": "ELIZABETH", "star": "15678", "seniority_date": "04/25/2019"},
        {"last_name": "TAYLOR", "first_name": "BARBARA", "star": "12890", "seniority_date": "08/08/2019"},
        {"last_name": "ANDERSON", "first_name": "SUSAN", "star": "17456", "seniority_date": "12/01/2019"},
        {"last_name": "THOMAS", "first_name": "JESSICA", "star": "14321", "seniority_date": "03/15/2020"},
        {"last_name": "JACKSON", "first_name": "SARAH", "star": "18765", "seniority_date": "07/22/2020"},
        {"last_name": "WHITE", "first_name": "KAREN", "star": "11567", "seniority_date": "10/30/2020"},
        {"last_name": "HARRIS", "first_name": "NANCY", "star": "16234", "seniority_date": "02/18/2021"},
        {"last_name": "MARTIN", "first_name": "BETTY", "star": "13789", "seniority_date": "05/05/2021"},
        {"last_name": "GARCIA", "first_name": "MARGARET", "star": "19012", "seniority_date": "09/12/2021"},
        {"last_name": "CLARK", "first_name": "SANDRA", "star": "12345", "seniority_date": "01/28/2022"},
        {"last_name": "LEWIS", "first_name": "ASHLEY", "star": "15890", "seniority_date": "04/14/2022"},
        {"last_name": "ROBINSON", "first_name": "KIMBERLY", "star": "17890", "seniority_date": "08/21/2022"},
        {"last_name": "WALKER", "first_name": "EMILY", "star": "14098", "seniority_date": "11/09/2022"},
        {"last_name": "PEREZ", "first_name": "DONNA", "star": "18234", "seniority_date": "03/03/2023"},
    ]
    
    for officer_data in sample_officers:
        officer = Officer(**officer_data)
        await db.officers.insert_one(officer.model_dump())
    
    await log_version_change("Seed", f"Seeded {len(sample_officers)} officers")
    return {"message": f"Seeded {len(sample_officers)} officers"}

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
