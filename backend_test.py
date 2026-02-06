import requests
import sys
from datetime import datetime
import json

class OvertimeRosterAPITester:
    def __init__(self, base_url="https://data-grid-9.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    self.test_results.append({
                        "test": name,
                        "status": "PASS",
                        "response_code": response.status_code,
                        "response_data": response_data
                    })
                    return True, response_data
                except:
                    self.test_results.append({
                        "test": name,
                        "status": "PASS",
                        "response_code": response.status_code,
                        "response_data": response.text
                    })
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                self.test_results.append({
                    "test": name,
                    "status": "FAIL",
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "test": name,
                "status": "ERROR",
                "error": str(e)
            })
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n=== TESTING AUTHENTICATION ===")
        
        # Test valid login
        success, response = self.run_test(
            "Valid Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "Admin", "password": "123456"}
        )
        
        if success:
            assert response.get('success') == True
            assert response.get('is_admin') == True
            print(f"✅ Login response valid: {response}")
        
        # Test invalid login
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            200,
            data={"username": "wrong", "password": "wrong"}
        )
        
        if success:
            assert response.get('success') == False
            print(f"✅ Invalid login correctly rejected: {response}")

    def test_officer_endpoints(self):
        """Test officer CRUD operations"""
        print("\n=== TESTING OFFICER MANAGEMENT ===")
        
        # Seed officers first
        success, response = self.run_test(
            "Seed Officers",
            "POST",
            "seed",
            200
        )
        
        # Get officers list
        success, officers = self.run_test(
            "Get Officers List",
            "GET",
            "officers",
            200
        )
        
        if success and officers:
            print(f"✅ Found {len(officers)} officers")
            # Check if sorted by seniority (oldest first)
            if len(officers) > 1:
                first_officer = officers[0]
                print(f"✅ First officer (most senior): {first_officer['last_name']}, {first_officer['first_name']} - {first_officer['seniority_date']}")
        
        # Test creating new officer
        new_officer_data = {
            "last_name": "TEST",
            "first_name": "OFFICER",
            "star": "99999",
            "seniority_date": "01/01/2024"
        }
        
        success, new_officer = self.run_test(
            "Create New Officer",
            "POST",
            "officers",
            200,
            data=new_officer_data
        )
        
        officer_id = None
        if success and new_officer:
            officer_id = new_officer.get('id')
            print(f"✅ Created officer with ID: {officer_id}")
        
        # Test updating officer
        if officer_id:
            update_data = {"last_name": "UPDATED"}
            success, updated_officer = self.run_test(
                "Update Officer",
                "PUT",
                f"officers/{officer_id}",
                200,
                data=update_data
            )
            
            if success:
                print(f"✅ Updated officer: {updated_officer}")
        
        # Test deleting officer
        if officer_id:
            success, response = self.run_test(
                "Delete Officer",
                "DELETE",
                f"officers/{officer_id}",
                200
            )
            
            if success:
                print(f"✅ Deleted officer: {response}")

    def test_sheet_endpoints(self):
        """Test overtime sheet operations"""
        print("\n=== TESTING OVERTIME SHEETS ===")
        
        sheet_types = ["rdo", "days_ext", "nights_ext"]
        
        for sheet_type in sheet_types:
            # Get sheet
            success, sheet = self.run_test(
                f"Get {sheet_type.upper()} Sheet",
                "GET",
                f"sheets/{sheet_type}",
                200
            )
            
            if success and sheet:
                print(f"✅ {sheet_type.upper()} sheet has {len(sheet.get('rows', []))} rows")
                
                # Verify row structure based on sheet type
                expected_rows = 6 if sheet_type in ["rdo", "nights_ext"] else 4
                actual_rows = len(sheet.get('rows', []))
                
                if actual_rows == expected_rows:
                    print(f"✅ Correct number of rows for {sheet_type}: {actual_rows}")
                else:
                    print(f"❌ Wrong number of rows for {sheet_type}: expected {expected_rows}, got {actual_rows}")
                
                # Check team pattern
                rows = sheet.get('rows', [])
                if rows:
                    teams = [row.get('team') for row in rows]
                    if sheet_type == "days_ext":
                        expected_pattern = ["A", "A", "B", "B"]
                    else:  # rdo and nights_ext
                        expected_pattern = ["A", "A", "B", "B", "C", "C"]
                    
                    if teams == expected_pattern:
                        print(f"✅ Correct team pattern for {sheet_type}: {teams}")
                    else:
                        print(f"❌ Wrong team pattern for {sheet_type}: expected {expected_pattern}, got {teams}")
        
        # Test reset all sheets
        success, response = self.run_test(
            "Reset All Sheets",
            "POST",
            "sheets/reset",
            200
        )
        
        if success:
            print(f"✅ Reset all sheets: {response}")

    def test_version_logs(self):
        """Test version logging"""
        print("\n=== TESTING VERSION LOGS ===")
        
        success, logs = self.run_test(
            "Get Version Logs",
            "GET",
            "version-logs",
            200
        )
        
        if success and logs:
            print(f"✅ Found {len(logs)} version log entries")
            if logs:
                latest_log = logs[0]
                print(f"✅ Latest log: {latest_log.get('notes', 'N/A')}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Overtime Roster API Tests")
        print(f"Testing against: {self.base_url}")
        
        try:
            self.test_auth_endpoints()
            self.test_officer_endpoints()
            self.test_sheet_endpoints()
            self.test_version_logs()
        except Exception as e:
            print(f"❌ Test suite error: {str(e)}")
        
        # Print final results
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run, self.test_results

def main():
    tester = OvertimeRosterAPITester()
    success, results = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
            "results": results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())