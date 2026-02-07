"""
Police OT Roster API Tests
Tests all backend endpoints for:
- Authentication
- Officers CRUD
- Sheets CRUD (3 days x 3 types = 9 sheets)
- Lock/Unlock functionality
- Bumped officers tracking
"""

import pytest
import requests
import os
from datetime import datetime

# Use the production URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://police-ot-sheet.preview.emergentagent.com')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAuthentication:
    """Test admin authentication endpoint"""
    
    def test_login_success(self, api_client):
        """Test successful admin login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "Admin",
            "password": "123456"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["is_admin"] == True
        assert "message" in data
        print("✓ Admin login successful")
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with wrong credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "WrongUser",
            "password": "wrongpass"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert data["is_admin"] == False
        print("✓ Invalid login properly rejected")


class TestOfficersAPI:
    """Test officers CRUD operations"""
    
    def test_get_officers_returns_list(self, api_client):
        """Test fetching all officers"""
        response = api_client.get(f"{BASE_URL}/api/officers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Retrieved {len(data)} officers")
    
    def test_officers_sorted_by_seniority(self, api_client):
        """Test that officers are sorted by seniority date (oldest first)"""
        response = api_client.get(f"{BASE_URL}/api/officers")
        assert response.status_code == 200
        data = response.json()
        
        # Verify sorted order - parse dates and compare
        def parse_date(date_str):
            parts = date_str.split('/')
            return datetime(int(parts[2]), int(parts[0]), int(parts[1]))
        
        dates = [parse_date(officer["seniority_date"]) for officer in data[:5]]
        assert dates == sorted(dates), "Officers not sorted by seniority"
        print("✓ Officers correctly sorted by seniority (oldest first)")
    
    def test_officer_has_required_fields(self, api_client):
        """Test officer data structure"""
        response = api_client.get(f"{BASE_URL}/api/officers")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["id", "last_name", "first_name", "star", "seniority_date"]
        first_officer = data[0]
        for field in required_fields:
            assert field in first_officer, f"Missing field: {field}"
        print("✓ Officer data has all required fields")
    
    def test_create_officer_and_verify(self, api_client):
        """Test creating a new officer and verifying persistence"""
        test_officer = {
            "last_name": "TEST_OFFICER",
            "first_name": "AUTOMATED",
            "star": "99999",
            "seniority_date": "01/01/2025"
        }
        
        # Create officer
        response = api_client.post(f"{BASE_URL}/api/officers", json=test_officer)
        assert response.status_code == 200
        created = response.json()
        assert created["last_name"] == test_officer["last_name"]
        assert created["star"] == test_officer["star"]
        assert "id" in created
        
        officer_id = created["id"]
        print(f"✓ Created test officer with ID: {officer_id}")
        
        # Verify in list
        response = api_client.get(f"{BASE_URL}/api/officers")
        officers = response.json()
        officer_ids = [o["id"] for o in officers]
        assert officer_id in officer_ids
        print("✓ Officer persisted in database")
        
        # Cleanup - delete test officer
        delete_response = api_client.delete(f"{BASE_URL}/api/officers/{officer_id}")
        assert delete_response.status_code == 200
        print("✓ Test officer cleaned up")
    
    def test_update_officer(self, api_client):
        """Test updating an officer"""
        # First create an officer
        test_officer = {
            "last_name": "TEST_UPDATE",
            "first_name": "BEFORE",
            "star": "88888",
            "seniority_date": "02/02/2024"
        }
        create_response = api_client.post(f"{BASE_URL}/api/officers", json=test_officer)
        officer_id = create_response.json()["id"]
        
        # Update the officer
        update_response = api_client.put(f"{BASE_URL}/api/officers/{officer_id}", json={
            "first_name": "AFTER"
        })
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["first_name"] == "AFTER"
        assert updated["last_name"] == "TEST_UPDATE"  # Unchanged
        print("✓ Officer updated successfully")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/officers/{officer_id}")
    
    def test_delete_officer(self, api_client):
        """Test deleting an officer"""
        # First create an officer to delete
        test_officer = {
            "last_name": "TEST_DELETE",
            "first_name": "TEMPORARY",
            "star": "77777",
            "seniority_date": "03/03/2023"
        }
        create_response = api_client.post(f"{BASE_URL}/api/officers", json=test_officer)
        officer_id = create_response.json()["id"]
        
        # Delete the officer
        delete_response = api_client.delete(f"{BASE_URL}/api/officers/{officer_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion - should get 404 on update
        verify_response = api_client.put(f"{BASE_URL}/api/officers/{officer_id}", json={"first_name": "TEST"})
        assert verify_response.status_code == 404
        print("✓ Officer deleted successfully")


class TestSheetsAPI:
    """Test sheets CRUD operations for all day/type combinations"""
    
    @pytest.mark.parametrize("day", ["friday", "saturday", "sunday"])
    def test_get_sheet_by_day_rdo(self, api_client, day):
        """Test fetching RDO sheets for each day"""
        response = api_client.get(f"{BASE_URL}/api/sheets/{day}/rdo")
        assert response.status_code == 200
        data = response.json()
        
        # Verify sheet structure
        assert "id" in data
        assert data["sheet_type"] == "rdo"
        assert "rows" in data
        assert len(data["rows"]) == 10, f"Expected 10 rows, got {len(data['rows'])}"
        print(f"✓ {day.upper()} RDO sheet has 10 rows")
    
    @pytest.mark.parametrize("sheet_type", ["rdo", "days_ext", "nights_ext"])
    def test_sheet_types_for_friday(self, api_client, sheet_type):
        """Test all sheet types for Friday"""
        response = api_client.get(f"{BASE_URL}/api/sheets/friday/{sheet_type}")
        assert response.status_code == 200
        data = response.json()
        assert data["sheet_type"] == sheet_type
        assert len(data["rows"]) == 10
        print(f"✓ Friday {sheet_type} sheet has correct structure")
    
    def test_sheet_has_correct_team_structure(self, api_client):
        """Test that sheets have correct team pattern: AA,AA,BB,BB,CC,CC,DD,DD,EE,EE"""
        response = api_client.get(f"{BASE_URL}/api/sheets/friday/rdo")
        data = response.json()
        
        expected_teams = ['AA', 'AA', 'BB', 'BB', 'CC', 'CC', 'DD', 'DD', 'EE', 'EE']
        actual_teams = [row["team"] for row in data["rows"]]
        assert actual_teams == expected_teams, f"Team pattern mismatch: {actual_teams}"
        print("✓ Sheet has correct team pattern: AA,AA,BB,BB,CC,CC,DD,DD,EE,EE")
    
    def test_sheet_row_structure(self, api_client):
        """Test that each sheet row has required fields"""
        response = api_client.get(f"{BASE_URL}/api/sheets/friday/rdo")
        data = response.json()
        
        required_row_fields = ["id", "team"]
        for row in data["rows"]:
            for field in required_row_fields:
                assert field in row, f"Row missing field: {field}"
        print("✓ Sheet rows have required fields")
    
    def test_update_sheet(self, api_client):
        """Test updating a sheet (sergeant name)"""
        # Get current sheet
        response = api_client.get(f"{BASE_URL}/api/sheets/friday/rdo")
        sheet = response.json()
        original_sergeant = sheet.get("sergeant_name")
        
        # Update sergeant name
        sheet["sergeant_name"] = "TEST_SERGEANT"
        update_response = api_client.put(f"{BASE_URL}/api/sheets/friday/rdo", json=sheet)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["sergeant_name"] == "TEST_SERGEANT"
        print("✓ Sheet update successful")
        
        # Restore original
        sheet["sergeant_name"] = original_sergeant
        api_client.put(f"{BASE_URL}/api/sheets/friday/rdo", json=sheet)


class TestLockUnlock:
    """Test lock/unlock sheet functionality"""
    
    def test_lock_sheet(self, api_client):
        """Test locking a sheet"""
        response = api_client.post(f"{BASE_URL}/api/sheets/friday/rdo/lock")
        assert response.status_code == 200
        
        # Verify locked
        sheet_response = api_client.get(f"{BASE_URL}/api/sheets/friday/rdo")
        sheet = sheet_response.json()
        assert sheet["locked"] == True
        print("✓ Sheet locked successfully")
    
    def test_unlock_sheet(self, api_client):
        """Test unlocking a sheet"""
        response = api_client.post(f"{BASE_URL}/api/sheets/friday/rdo/unlock")
        assert response.status_code == 200
        
        # Verify unlocked
        sheet_response = api_client.get(f"{BASE_URL}/api/sheets/friday/rdo")
        sheet = sheet_response.json()
        assert sheet["locked"] == False
        print("✓ Sheet unlocked successfully")
    
    def test_set_auto_lock(self, api_client):
        """Test setting auto-lock time"""
        from datetime import datetime, timedelta
        
        future_time = (datetime.utcnow() + timedelta(hours=24)).isoformat() + "Z"
        
        response = api_client.post(f"{BASE_URL}/api/sheets/friday/rdo/set-auto-lock", json={
            "auto_lock_time": future_time,
            "auto_lock_enabled": True
        })
        assert response.status_code == 200
        
        # Verify auto-lock settings
        sheet_response = api_client.get(f"{BASE_URL}/api/sheets/friday/rdo")
        sheet = sheet_response.json()
        assert sheet["auto_lock_enabled"] == True
        print("✓ Auto-lock set successfully")
        
        # Disable auto-lock for cleanup
        api_client.post(f"{BASE_URL}/api/sheets/friday/rdo/set-auto-lock", json={
            "auto_lock_time": None,
            "auto_lock_enabled": False
        })


class TestBumpedOfficers:
    """Test bumped officers tracking functionality"""
    
    def test_get_bumped_officers(self, api_client):
        """Test fetching bumped officers list"""
        response = api_client.get(f"{BASE_URL}/api/bumped-officers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved bumped officers list ({len(data)} records)")
    
    def test_add_and_delete_bumped_officer(self, api_client):
        """Test adding and deleting a bumped officer record"""
        test_bumped = {
            "officer_id": "test-officer-id",
            "officer_name": "TEST BUMPED",
            "officer_star": "12345",
            "officer_seniority": "01/01/2020",
            "bumped_by_name": "SENIOR OFFICER",
            "bumped_by_star": "11111",
            "bumped_by_seniority": "01/01/2010",
            "day": "friday",
            "sheet_type": "rdo",
            "assignment_slot": "Row 1, Team AA"
        }
        
        # Add bumped officer
        add_response = api_client.post(f"{BASE_URL}/api/bumped-officers", json=test_bumped)
        assert add_response.status_code == 200
        added = add_response.json()
        assert "id" in added
        bumped_id = added["id"]
        print(f"✓ Added bumped officer record with ID: {bumped_id}")
        
        # Delete bumped officer
        delete_response = api_client.delete(f"{BASE_URL}/api/bumped-officers/{bumped_id}")
        assert delete_response.status_code == 200
        print("✓ Deleted bumped officer record")


class TestVersionLogs:
    """Test version logging functionality"""
    
    def test_get_version_logs(self, api_client):
        """Test fetching version logs"""
        response = api_client.get(f"{BASE_URL}/api/version-logs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} version log entries")


class TestSheetReset:
    """Test sheet reset functionality"""
    
    def test_reset_all_sheets(self, api_client):
        """Test resetting all sheets"""
        # Note: This is a destructive operation, so we'll just verify the endpoint works
        # In production testing, we'd want to be more careful
        response = api_client.post(f"{BASE_URL}/api/sheets/reset")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Sheet reset endpoint works")
        
        # Verify sheets were reset
        for day in ["friday", "saturday", "sunday"]:
            for sheet_type in ["rdo", "days_ext", "nights_ext"]:
                sheet_response = api_client.get(f"{BASE_URL}/api/sheets/{day}/{sheet_type}")
                sheet = sheet_response.json()
                assert len(sheet["rows"]) == 10
        print("✓ All 9 sheets reset with 10 rows each")
