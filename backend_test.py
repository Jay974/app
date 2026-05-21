#!/usr/bin/env python3
"""
TiKréol Backend API Test Suite
Tests all backend endpoints with role-based access control
"""

import requests
import json
import random
import string
from datetime import datetime

# Base URL from environment
BASE_URL = "https://tikreol-demo.preview.emergentagent.com/api"

# Demo accounts (all with password "demo1234")
DEMO_ACCOUNTS = {
    "admin": {"email": "admin@demo.re", "password": "demo1234"},
    "pro": {"email": "pro@demo.re", "password": "demo1234"},
    "parent": {"email": "parent@demo.re", "password": "demo1234"},
    "parent2": {"email": "parent2@demo.re", "password": "demo1234"},
}

# Store tokens and user data
tokens = {}
users = {}
enfants_data = {}

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def print_info(msg):
    print(f"ℹ️  {msg}")


# ============================================================================
# TEST 1: Auth Login
# ============================================================================
def test_auth_login():
    print_test("1. Auth Login - POST /api/auth/login")
    
    all_passed = True
    
    # Test each demo account
    for role, creds in DEMO_ACCOUNTS.items():
        try:
            print_info(f"Testing login for {role}: {creds['email']}")
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=creds,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    user = data["user"]
                    required_fields = ["id", "email", "role", "prenom", "nom", "creche_id"]
                    if all(field in user for field in required_fields):
                        tokens[role] = data["token"]
                        users[role] = user
                        print_success(f"{role} login successful - token received, user: {user['prenom']} {user['nom']} (role: {user['role']})")
                    else:
                        print_error(f"{role} login missing required user fields: {user}")
                        all_passed = False
                else:
                    print_error(f"{role} login response missing token or user: {data}")
                    all_passed = False
            else:
                print_error(f"{role} login failed with status {response.status_code}: {response.text}")
                all_passed = False
        except Exception as e:
            print_error(f"{role} login exception: {str(e)}")
            all_passed = False
    
    # Test wrong password
    try:
        print_info("Testing wrong password")
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "admin@demo.re", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print_success("Wrong password correctly returns 401")
        else:
            print_error(f"Wrong password should return 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_error(f"Wrong password test exception: {str(e)}")
        all_passed = False
    
    # Test unknown email
    try:
        print_info("Testing unknown email")
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "unknown@demo.re", "password": "demo1234"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print_success("Unknown email correctly returns 401")
        else:
            print_error(f"Unknown email should return 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_error(f"Unknown email test exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 2: Auth Register
# ============================================================================
def test_auth_register():
    print_test("2. Auth Register - POST /api/auth/register")
    
    all_passed = True
    
    # Test new user registration
    try:
        rand_suffix = ''.join(random.choices(string.digits, k=6))
        new_email = f"test+{rand_suffix}@demo.re"
        print_info(f"Testing registration with new email: {new_email}")
        
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": new_email,
                "password": "testpass123",
                "prenom": "Test",
                "nom": "User",
                "role": "parent"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                print_success(f"Registration successful - token received for {new_email}")
            else:
                print_error(f"Registration response missing token: {data}")
                all_passed = False
        else:
            print_error(f"Registration failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Registration test exception: {str(e)}")
        all_passed = False
    
    # Test duplicate email
    try:
        print_info("Testing duplicate email registration")
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": "admin@demo.re",
                "password": "testpass123",
                "prenom": "Duplicate",
                "nom": "User",
                "role": "parent"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 409:
            print_success("Duplicate email correctly returns 409")
        else:
            print_error(f"Duplicate email should return 409, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_error(f"Duplicate email test exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 3: Auth Me
# ============================================================================
def test_auth_me():
    print_test("3. Auth Me - GET /api/auth/me")
    
    all_passed = True
    
    for role in ["admin", "pro", "parent"]:
        try:
            if role not in tokens:
                print_error(f"No token available for {role}")
                all_passed = False
                continue
            
            print_info(f"Testing /auth/me for {role}")
            response = requests.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {tokens[role]}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data:
                    user = data["user"]
                    print_success(f"{role} /auth/me successful - user: {user.get('prenom')} {user.get('nom')} (role: {user.get('role')})")
                else:
                    print_error(f"{role} /auth/me response missing user: {data}")
                    all_passed = False
            else:
                print_error(f"{role} /auth/me failed with status {response.status_code}: {response.text}")
                all_passed = False
        except Exception as e:
            print_error(f"{role} /auth/me exception: {str(e)}")
            all_passed = False
    
    return all_passed


# ============================================================================
# TEST 4: Enfants Role-Based Filtering (CRITICAL)
# ============================================================================
def test_enfants_filtering():
    print_test("4. Enfants Role-Based Filtering - GET /api/enfants (CRITICAL)")
    
    all_passed = True
    
    # Test admin - should see all 5 children
    try:
        print_info("Testing admin access to /api/enfants")
        response = requests.get(
            f"{BASE_URL}/enfants",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            enfants = data.get("enfants", [])
            enfants_data["admin"] = enfants
            
            if len(enfants) == 5:
                names = [e["prenom"] for e in enfants]
                expected = ["Lucas", "Emma", "Chloé", "Noah", "Léa"]
                if all(name in names for name in expected):
                    print_success(f"Admin sees all 5 children: {', '.join(names)}")
                else:
                    print_error(f"Admin sees 5 children but names don't match. Expected: {expected}, Got: {names}")
                    all_passed = False
            else:
                print_error(f"Admin should see 5 children, got {len(enfants)}")
                all_passed = False
        else:
            print_error(f"Admin /api/enfants failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Admin enfants test exception: {str(e)}")
        all_passed = False
    
    # Test pro - should see all 5 children (same crèche)
    try:
        print_info("Testing pro access to /api/enfants")
        response = requests.get(
            f"{BASE_URL}/enfants",
            headers={"Authorization": f"Bearer {tokens['pro']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            enfants = data.get("enfants", [])
            enfants_data["pro"] = enfants
            
            if len(enfants) == 5:
                names = [e["prenom"] for e in enfants]
                print_success(f"Pro sees all 5 children: {', '.join(names)}")
            else:
                print_error(f"Pro should see 5 children, got {len(enfants)}")
                all_passed = False
        else:
            print_error(f"Pro /api/enfants failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Pro enfants test exception: {str(e)}")
        all_passed = False
    
    # Test parent@demo.re - should see ONLY Lucas + Noah (2 children)
    try:
        print_info("Testing parent@demo.re access to /api/enfants")
        response = requests.get(
            f"{BASE_URL}/enfants",
            headers={"Authorization": f"Bearer {tokens['parent']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            enfants = data.get("enfants", [])
            enfants_data["parent"] = enfants
            
            if len(enfants) == 2:
                names = [e["prenom"] for e in enfants]
                if "Lucas" in names and "Noah" in names:
                    print_success(f"parent@demo.re sees only their 2 children: {', '.join(names)}")
                else:
                    print_error(f"parent@demo.re should see Lucas and Noah, got: {names}")
                    all_passed = False
            else:
                print_error(f"parent@demo.re should see 2 children, got {len(enfants)}: {[e['prenom'] for e in enfants]}")
                all_passed = False
        else:
            print_error(f"parent@demo.re /api/enfants failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"parent@demo.re enfants test exception: {str(e)}")
        all_passed = False
    
    # Test parent2@demo.re - should see ONLY Emma + Chloé + Léa (3 children)
    try:
        print_info("Testing parent2@demo.re access to /api/enfants")
        response = requests.get(
            f"{BASE_URL}/enfants",
            headers={"Authorization": f"Bearer {tokens['parent2']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            enfants = data.get("enfants", [])
            enfants_data["parent2"] = enfants
            
            if len(enfants) == 3:
                names = [e["prenom"] for e in enfants]
                if "Emma" in names and "Chloé" in names and "Léa" in names:
                    print_success(f"parent2@demo.re sees only their 3 children: {', '.join(names)}")
                else:
                    print_error(f"parent2@demo.re should see Emma, Chloé, and Léa, got: {names}")
                    all_passed = False
            else:
                print_error(f"parent2@demo.re should see 3 children, got {len(enfants)}: {[e['prenom'] for e in enfants]}")
                all_passed = False
        else:
            print_error(f"parent2@demo.re /api/enfants failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"parent2@demo.re enfants test exception: {str(e)}")
        all_passed = False
    
    # Test parent accessing another parent's child by ID (should return 403)
    try:
        print_info("Testing parent@demo.re accessing parent2's child (should be 403)")
        # Get Emma's ID (belongs to parent2)
        if "parent2" in enfants_data and len(enfants_data["parent2"]) > 0:
            emma = next((e for e in enfants_data["parent2"] if e["prenom"] == "Emma"), None)
            if emma:
                response = requests.get(
                    f"{BASE_URL}/enfants/{emma['id']}",
                    headers={"Authorization": f"Bearer {tokens['parent']}"}
                )
                
                if response.status_code == 403:
                    print_success("parent@demo.re correctly denied access to parent2's child (403)")
                else:
                    print_error(f"parent@demo.re accessing parent2's child should return 403, got {response.status_code}")
                    all_passed = False
            else:
                print_info("Could not find Emma to test cross-parent access")
        else:
            print_info("Skipping cross-parent access test - no parent2 data")
    except Exception as e:
        print_error(f"Cross-parent access test exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 5: Enfants POST (Admin Only)
# ============================================================================
def test_enfants_post():
    print_test("5. Enfants POST - POST /api/enfants (Admin Only)")
    
    all_passed = True
    
    # Test admin can POST
    try:
        print_info("Testing admin POST /api/enfants")
        response = requests.post(
            f"{BASE_URL}/enfants",
            json={
                "prenom": "TestChild",
                "nom": "Demo",
                "groupe": "Tournesol",
                "contrat_heures": 35,
                "mensualite": 500,
                "avatar_color": "#FF6B6B"
            },
            headers={
                "Authorization": f"Bearer {tokens['admin']}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if "enfant" in data and "id" in data["enfant"]:
                print_success(f"Admin successfully created enfant with id: {data['enfant']['id']}")
            else:
                print_error(f"Admin POST response missing enfant or id: {data}")
                all_passed = False
        else:
            print_error(f"Admin POST /api/enfants failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Admin POST enfants exception: {str(e)}")
        all_passed = False
    
    # Test pro cannot POST (should fail)
    try:
        print_info("Testing pro POST /api/enfants (should be rejected)")
        response = requests.post(
            f"{BASE_URL}/enfants",
            json={
                "prenom": "TestChild2",
                "groupe": "Tournesol",
                "contrat_heures": 35,
                "mensualite": 500,
                "avatar_color": "#FF6B6B"
            },
            headers={
                "Authorization": f"Bearer {tokens['pro']}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code != 200:
            print_success(f"Pro correctly denied POST /api/enfants (status {response.status_code})")
        else:
            print_error(f"Pro should not be able to POST /api/enfants, but got 200")
            all_passed = False
    except Exception as e:
        print_error(f"Pro POST enfants exception: {str(e)}")
        all_passed = False
    
    # Test parent cannot POST (should fail)
    try:
        print_info("Testing parent POST /api/enfants (should be rejected)")
        response = requests.post(
            f"{BASE_URL}/enfants",
            json={
                "prenom": "TestChild3",
                "groupe": "Tournesol",
                "contrat_heures": 35,
                "mensualite": 500,
                "avatar_color": "#FF6B6B"
            },
            headers={
                "Authorization": f"Bearer {tokens['parent']}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code != 200:
            print_success(f"Parent correctly denied POST /api/enfants (status {response.status_code})")
        else:
            print_error(f"Parent should not be able to POST /api/enfants, but got 200")
            all_passed = False
    except Exception as e:
        print_error(f"Parent POST enfants exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 6: Transmissions (CRITICAL)
# ============================================================================
def test_transmissions():
    print_test("6. Transmissions - GET/POST/DELETE /api/transmissions (CRITICAL)")
    
    all_passed = True
    
    # Get today's date
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Test admin GET all transmissions for today
    try:
        print_info(f"Testing admin GET /api/transmissions?date={today}")
        response = requests.get(
            f"{BASE_URL}/transmissions?date={today}",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            transmissions = data.get("transmissions", [])
            if len(transmissions) == 9:
                print_success(f"Admin sees 9 sample transmissions for today")
            else:
                print_error(f"Admin should see 9 transmissions, got {len(transmissions)}")
                all_passed = False
        else:
            print_error(f"Admin GET transmissions failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Admin GET transmissions exception: {str(e)}")
        all_passed = False
    
    # Test admin GET transmissions for Lucas
    try:
        if "admin" in enfants_data:
            lucas = next((e for e in enfants_data["admin"] if e["prenom"] == "Lucas"), None)
            if lucas:
                print_info(f"Testing admin GET /api/transmissions?enfant_id={lucas['id']}&date={today}")
                response = requests.get(
                    f"{BASE_URL}/transmissions?enfant_id={lucas['id']}&date={today}",
                    headers={"Authorization": f"Bearer {tokens['admin']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    transmissions = data.get("transmissions", [])
                    if len(transmissions) == 6:
                        print_success(f"Admin sees 6 transmissions for Lucas")
                    else:
                        print_error(f"Admin should see 6 transmissions for Lucas, got {len(transmissions)}")
                        all_passed = False
                else:
                    print_error(f"Admin GET Lucas transmissions failed with status {response.status_code}: {response.text}")
                    all_passed = False
            else:
                print_info("Could not find Lucas to test transmissions")
        else:
            print_info("Skipping Lucas transmissions test - no admin enfants data")
    except Exception as e:
        print_error(f"Admin GET Lucas transmissions exception: {str(e)}")
        all_passed = False
    
    # Test parent@demo.re GET transmissions (should only see their children's, visible_parents=true)
    try:
        print_info("Testing parent@demo.re GET /api/transmissions")
        response = requests.get(
            f"{BASE_URL}/transmissions",
            headers={"Authorization": f"Bearer {tokens['parent']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            transmissions = data.get("transmissions", [])
            # All should have visible_parents=true
            all_visible = all(t.get("visible_parents", False) for t in transmissions)
            if all_visible:
                print_success(f"parent@demo.re sees {len(transmissions)} transmissions, all with visible_parents=true")
            else:
                print_error(f"parent@demo.re transmissions should all have visible_parents=true")
                all_passed = False
            
            # Check that all transmissions are for their children
            if "parent" in enfants_data:
                parent_child_ids = [e["id"] for e in enfants_data["parent"]]
                all_own_children = all(t.get("enfant_id") in parent_child_ids for t in transmissions)
                if all_own_children:
                    print_success(f"parent@demo.re transmissions are all for their own children")
                else:
                    print_error(f"parent@demo.re sees transmissions for other children")
                    all_passed = False
        else:
            print_error(f"parent@demo.re GET transmissions failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"parent@demo.re GET transmissions exception: {str(e)}")
        all_passed = False
    
    # Test pro POST transmission
    transmission_id = None
    try:
        if "admin" in enfants_data and len(enfants_data["admin"]) > 0:
            lucas = next((e for e in enfants_data["admin"] if e["prenom"] == "Lucas"), None)
            if lucas:
                print_info("Testing pro POST /api/transmissions")
                response = requests.post(
                    f"{BASE_URL}/transmissions",
                    json={
                        "enfant_id": lucas["id"],
                        "type": "biberon",
                        "titre": "Test biberon",
                        "detail": "150ml"
                    },
                    headers={
                        "Authorization": f"Bearer {tokens['pro']}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "transmission" in data:
                        trans = data["transmission"]
                        transmission_id = trans.get("id")
                        if trans.get("color") == "#FF6B6B":
                            print_success(f"Pro successfully created transmission with auto color #FF6B6B")
                        else:
                            print_error(f"Pro transmission should have color #FF6B6B, got {trans.get('color')}")
                            all_passed = False
                    else:
                        print_error(f"Pro POST transmission response missing transmission: {data}")
                        all_passed = False
                else:
                    print_error(f"Pro POST transmission failed with status {response.status_code}: {response.text}")
                    all_passed = False
            else:
                print_info("Could not find Lucas to test POST transmission")
        else:
            print_info("Skipping POST transmission test - no enfants data")
    except Exception as e:
        print_error(f"Pro POST transmission exception: {str(e)}")
        all_passed = False
    
    # Test parent POST transmission (should be rejected)
    try:
        if "parent" in enfants_data and len(enfants_data["parent"]) > 0:
            lucas = next((e for e in enfants_data["parent"] if e["prenom"] == "Lucas"), None)
            if lucas:
                print_info("Testing parent POST /api/transmissions (should be rejected)")
                response = requests.post(
                    f"{BASE_URL}/transmissions",
                    json={
                        "enfant_id": lucas["id"],
                        "type": "note",
                        "titre": "Test note",
                        "detail": "Should not work"
                    },
                    headers={
                        "Authorization": f"Bearer {tokens['parent']}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code != 200:
                    print_success(f"Parent correctly denied POST /api/transmissions (status {response.status_code})")
                else:
                    print_error(f"Parent should not be able to POST /api/transmissions, but got 200")
                    all_passed = False
            else:
                print_info("Could not find Lucas to test parent POST transmission")
        else:
            print_info("Skipping parent POST transmission test - no parent enfants data")
    except Exception as e:
        print_error(f"Parent POST transmission exception: {str(e)}")
        all_passed = False
    
    # Test pro DELETE transmission
    try:
        if transmission_id:
            print_info(f"Testing pro DELETE /api/transmissions/{transmission_id}")
            response = requests.delete(
                f"{BASE_URL}/transmissions/{transmission_id}",
                headers={"Authorization": f"Bearer {tokens['pro']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    print_success(f"Pro successfully deleted transmission")
                else:
                    print_error(f"Pro DELETE transmission response unexpected: {data}")
                    all_passed = False
            else:
                print_error(f"Pro DELETE transmission failed with status {response.status_code}: {response.text}")
                all_passed = False
        else:
            print_info("Skipping DELETE transmission test - no transmission_id")
    except Exception as e:
        print_error(f"Pro DELETE transmission exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 7: Dashboard Stats
# ============================================================================
def test_dashboard_stats():
    print_test("7. Dashboard Stats - GET /api/dashboard/stats")
    
    all_passed = True
    
    try:
        print_info("Testing admin GET /api/dashboard/stats")
        response = requests.get(
            f"{BASE_URL}/dashboard/stats",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if "stats" in data:
                stats = data["stats"]
                required_fields = [
                    "siestes", "biberons", "changes", "repas", "activites",
                    "enfants_total", "employes_total", "employes_presents",
                    "ca_mensuel", "taux_occupation", "ca_attendu"
                ]
                
                if all(field in stats for field in required_fields):
                    print_success(f"Dashboard stats has all required fields")
                    
                    # Verify enfants_total=5 (or 6 if we added one in test 5)
                    if stats["enfants_total"] >= 5:
                        print_success(f"enfants_total = {stats['enfants_total']} (expected 5 or more)")
                    else:
                        print_error(f"enfants_total should be at least 5, got {stats['enfants_total']}")
                        all_passed = False
                    
                    # Verify employes_total=2
                    if stats["employes_total"] == 2:
                        print_success(f"employes_total = 2")
                    else:
                        print_error(f"employes_total should be 2, got {stats['employes_total']}")
                        all_passed = False
                    
                    print_info(f"Stats: siestes={stats['siestes']}, biberons={stats['biberons']}, changes={stats['changes']}, repas={stats['repas']}, activites={stats['activites']}")
                else:
                    missing = [f for f in required_fields if f not in stats]
                    print_error(f"Dashboard stats missing fields: {missing}")
                    all_passed = False
            else:
                print_error(f"Dashboard response missing stats: {data}")
                all_passed = False
        else:
            print_error(f"Dashboard stats failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Dashboard stats exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 8: Pointages
# ============================================================================
def test_pointages():
    print_test("8. Pointages - POST/GET /api/pointage(s)")
    
    all_passed = True
    
    # Test pro POST pointage
    try:
        print_info("Testing pro POST /api/pointage (type: arrivee)")
        response = requests.post(
            f"{BASE_URL}/pointage",
            json={"type": "arrivee"},
            headers={
                "Authorization": f"Bearer {tokens['pro']}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if "pointage" in data:
                print_success(f"Pro successfully created pointage")
            else:
                print_error(f"Pro POST pointage response missing pointage: {data}")
                all_passed = False
        else:
            print_error(f"Pro POST pointage failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Pro POST pointage exception: {str(e)}")
        all_passed = False
    
    # Test parent POST pointage (should be rejected)
    try:
        print_info("Testing parent POST /api/pointage (should be rejected)")
        response = requests.post(
            f"{BASE_URL}/pointage",
            json={"type": "arrivee"},
            headers={
                "Authorization": f"Bearer {tokens['parent']}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code != 200:
            print_success(f"Parent correctly denied POST /api/pointage (status {response.status_code})")
        else:
            print_error(f"Parent should not be able to POST /api/pointage, but got 200")
            all_passed = False
    except Exception as e:
        print_error(f"Parent POST pointage exception: {str(e)}")
        all_passed = False
    
    # Test pro GET pointages (should see only own)
    try:
        print_info("Testing pro GET /api/pointages")
        response = requests.get(
            f"{BASE_URL}/pointages",
            headers={"Authorization": f"Bearer {tokens['pro']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            pointages = data.get("pointages", [])
            # Should see at least the one we just created
            if len(pointages) > 0:
                # Check all are for this pro
                pro_id = users["pro"]["id"]
                all_own = all(p.get("employe_id") == pro_id for p in pointages)
                if all_own:
                    print_success(f"Pro sees {len(pointages)} pointages, all their own")
                else:
                    print_error(f"Pro sees pointages from other employees")
                    all_passed = False
            else:
                print_error(f"Pro should see at least 1 pointage")
                all_passed = False
        else:
            print_error(f"Pro GET pointages failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Pro GET pointages exception: {str(e)}")
        all_passed = False
    
    # Test admin GET pointages (should see all)
    try:
        print_info("Testing admin GET /api/pointages")
        response = requests.get(
            f"{BASE_URL}/pointages",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            pointages = data.get("pointages", [])
            # Should see more than just one pro's pointages
            if len(pointages) >= 2:
                print_success(f"Admin sees {len(pointages)} pointages (all employees)")
            else:
                print_error(f"Admin should see at least 2 pointages, got {len(pointages)}")
                all_passed = False
        else:
            print_error(f"Admin GET pointages failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Admin GET pointages exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 9: Factures
# ============================================================================
def test_factures():
    print_test("9. Factures - GET /api/factures")
    
    all_passed = True
    
    # Test admin GET all factures
    try:
        print_info("Testing admin GET /api/factures")
        response = requests.get(
            f"{BASE_URL}/factures",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            factures = data.get("factures", [])
            # Should see 5 factures (one per child) or 6 if we added a child
            if len(factures) >= 5:
                print_success(f"Admin sees {len(factures)} factures")
            else:
                print_error(f"Admin should see at least 5 factures, got {len(factures)}")
                all_passed = False
        else:
            print_error(f"Admin GET factures failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Admin GET factures exception: {str(e)}")
        all_passed = False
    
    # Test parent@demo.re GET factures (should see only for Lucas + Noah = 2)
    try:
        print_info("Testing parent@demo.re GET /api/factures")
        response = requests.get(
            f"{BASE_URL}/factures",
            headers={"Authorization": f"Bearer {tokens['parent']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            factures = data.get("factures", [])
            if len(factures) == 2:
                print_success(f"parent@demo.re sees 2 factures (Lucas + Noah)")
            else:
                print_error(f"parent@demo.re should see 2 factures, got {len(factures)}")
                all_passed = False
        else:
            print_error(f"parent@demo.re GET factures failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"parent@demo.re GET factures exception: {str(e)}")
        all_passed = False
    
    # Test parent2@demo.re GET factures (should see 3 for Emma + Chloé + Léa)
    try:
        print_info("Testing parent2@demo.re GET /api/factures")
        response = requests.get(
            f"{BASE_URL}/factures",
            headers={"Authorization": f"Bearer {tokens['parent2']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            factures = data.get("factures", [])
            if len(factures) == 3:
                print_success(f"parent2@demo.re sees 3 factures (Emma + Chloé + Léa)")
            else:
                print_error(f"parent2@demo.re should see 3 factures, got {len(factures)}")
                all_passed = False
        else:
            print_error(f"parent2@demo.re GET factures failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"parent2@demo.re GET factures exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 10: Messages
# ============================================================================
def test_messages():
    print_test("10. Messages - GET/POST /api/messages")
    
    all_passed = True
    
    # Test parent@demo.re GET messages
    try:
        print_info("Testing parent@demo.re GET /api/messages")
        response = requests.get(
            f"{BASE_URL}/messages",
            headers={"Authorization": f"Bearer {tokens['parent']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get("messages", [])
            # Should see at least 2 seeded messages
            if len(messages) >= 2:
                print_success(f"parent@demo.re sees {len(messages)} messages")
            else:
                print_error(f"parent@demo.re should see at least 2 messages, got {len(messages)}")
                all_passed = False
        else:
            print_error(f"parent@demo.re GET messages failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"parent@demo.re GET messages exception: {str(e)}")
        all_passed = False
    
    # Test parent POST message
    try:
        print_info("Testing parent@demo.re POST /api/messages")
        response = requests.post(
            f"{BASE_URL}/messages",
            json={"contenu": "Bonjour, test message from parent"},
            headers={
                "Authorization": f"Bearer {tokens['parent']}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data:
                msg = data["message"]
                # Should auto-route to admin
                if msg.get("to_role") == "admin":
                    print_success(f"Parent message auto-routed to admin")
                else:
                    print_error(f"Parent message should auto-route to admin, got to_role={msg.get('to_role')}")
                    all_passed = False
            else:
                print_error(f"Parent POST message response missing message: {data}")
                all_passed = False
        else:
            print_error(f"Parent POST message failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Parent POST message exception: {str(e)}")
        all_passed = False
    
    # Test admin POST message to parent
    try:
        print_info("Testing admin POST /api/messages to parent")
        parent_id = users["parent"]["id"]
        response = requests.post(
            f"{BASE_URL}/messages",
            json={
                "contenu": "Hello from admin",
                "to_role": "parent",
                "to_id": parent_id
            },
            headers={
                "Authorization": f"Bearer {tokens['admin']}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data:
                print_success(f"Admin successfully sent message to parent")
            else:
                print_error(f"Admin POST message response missing message: {data}")
                all_passed = False
        else:
            print_error(f"Admin POST message failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Admin POST message exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 11: Employes
# ============================================================================
def test_employes():
    print_test("11. Employes - GET /api/employes (Admin Only)")
    
    all_passed = True
    
    # Test admin GET employes
    try:
        print_info("Testing admin GET /api/employes")
        response = requests.get(
            f"{BASE_URL}/employes",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            employes = data.get("employes", [])
            if len(employes) == 2:
                print_success(f"Admin sees 2 employes (pros)")
                # Verify password is stripped
                has_password = any("password" in e for e in employes)
                if not has_password:
                    print_success(f"Employes data has password stripped")
                else:
                    print_error(f"Employes data should not include password field")
                    all_passed = False
            else:
                print_error(f"Admin should see 2 employes, got {len(employes)}")
                all_passed = False
        else:
            print_error(f"Admin GET employes failed with status {response.status_code}: {response.text}")
            all_passed = False
    except Exception as e:
        print_error(f"Admin GET employes exception: {str(e)}")
        all_passed = False
    
    # Test parent GET employes (should be rejected)
    try:
        print_info("Testing parent GET /api/employes (should be rejected)")
        response = requests.get(
            f"{BASE_URL}/employes",
            headers={"Authorization": f"Bearer {tokens['parent']}"}
        )
        
        if response.status_code != 200:
            print_success(f"Parent correctly denied GET /api/employes (status {response.status_code})")
        else:
            print_error(f"Parent should not be able to GET /api/employes, but got 200")
            all_passed = False
    except Exception as e:
        print_error(f"Parent GET employes exception: {str(e)}")
        all_passed = False
    
    return all_passed


# ============================================================================
# TEST 12: Unauthenticated Access
# ============================================================================
def test_unauthenticated():
    print_test("12. Unauthenticated Access - Protected Routes Without Token")
    
    all_passed = True
    
    protected_routes = [
        "/enfants",
        "/transmissions",
        "/dashboard/stats",
        "/pointages",
        "/factures",
        "/employes",
        "/messages"
    ]
    
    for route in protected_routes:
        try:
            print_info(f"Testing unauthenticated GET {route}")
            response = requests.get(f"{BASE_URL}{route}")
            
            if response.status_code == 401:
                print_success(f"{route} correctly returns 401 without token")
            else:
                print_error(f"{route} should return 401 without token, got {response.status_code}")
                all_passed = False
        except Exception as e:
            print_error(f"Unauthenticated {route} exception: {str(e)}")
            all_passed = False
    
    return all_passed


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("TiKréol Backend API Test Suite")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {}
    
    # Run all tests in priority order
    results["1. Auth Login"] = test_auth_login()
    results["2. Auth Register"] = test_auth_register()
    results["3. Auth Me"] = test_auth_me()
    results["4. Enfants Filtering (CRITICAL)"] = test_enfants_filtering()
    results["5. Enfants POST (Admin Only)"] = test_enfants_post()
    results["6. Transmissions (CRITICAL)"] = test_transmissions()
    results["7. Dashboard Stats"] = test_dashboard_stats()
    results["8. Pointages"] = test_pointages()
    results["9. Factures"] = test_factures()
    results["10. Messages"] = test_messages()
    results["11. Employes (Admin Only)"] = test_employes()
    results["12. Unauthenticated Access"] = test_unauthenticated()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASSED" if passed_flag else "❌ FAILED"
        print(f"{status} - {test_name}")
    
    print("="*80)
    print(f"Total: {passed}/{total} tests passed")
    print("="*80)
    
    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
