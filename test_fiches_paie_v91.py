#!/usr/bin/env python3
"""
TiMétis V9.1 - Fiches de Paie Backend Testing
Tests NEW V9.1 endpoints for employee payslips (fiches de paie)
DO NOT retest previous V2/V9 features
"""

import requests
import json
from datetime import datetime

# Backend URL from .env
BASE_URL = "https://tikreol-demo.preview.emergentagent.com/api"

# Demo accounts for V9.1 testing
ACCOUNTS = {
    "admin": {"email": "admin@demo.re", "password": "demo1234"},  # Marie (2 crèches)
    "pro_aurelie": {"email": "pro@demo.re", "password": "demo1234"},  # Aurélie
    "pro_sandra": {"email": "pro2@demo.re", "password": "demo1234"},  # Sandra
    "parent": {"email": "parent@demo.re", "password": "demo1234"},
}

# Store tokens and user data
tokens = {}
users = {}
test_data = {}

def login(account_key):
    """Login and store token"""
    try:
        account = ACCOUNTS[account_key]
        resp = requests.post(f"{BASE_URL}/auth/login", json=account, timeout=10)
        print(f"  Login {account_key} ({account['email']}): {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            tokens[account_key] = data.get("token")
            users[account_key] = data.get("user")
            return True
        else:
            print(f"    ✗ FAILED: {resp.text}")
            return False
    except Exception as e:
        print(f"    ✗ EXCEPTION: {e}")
        return False

def get_headers(account_key):
    """Get auth headers for account"""
    return {"Authorization": f"Bearer {tokens[account_key]}"}

def test_a_depot_par_employe():
    """
    A) FICHES DE PAIE — DÉPÔT PAR EMPLOYÉ (admin)
    Tests admin creating payslips for employees
    """
    print("\n" + "="*80)
    print("TEST A: FICHES DE PAIE — DÉPÔT PAR EMPLOYÉ (admin)")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # A1: Login as admin
    print("\n[A1] Login as admin@demo.re")
    try:
        if login("admin"):
            print("  ✅ A1 PASS: Admin login successful")
            results["passed"] += 1
        else:
            print("  ❌ A1 FAIL: Admin login failed")
            results["failed"] += 1
            return results
    except Exception as e:
        print(f"  ❌ A1 FAIL: Exception - {e}")
        results["failed"] += 1
        return results
    
    # A2: GET /api/employes?creche_id=<crecheA_id> → note Aurélie's and Sandra's user ids
    print("\n[A2] GET /api/employes to get Aurélie and Sandra user ids")
    try:
        # Get Marie's first creche_id
        creche_ids = users["admin"].get("creche_ids", [])
        if not creche_ids:
            print("  ❌ A2 FAIL: Admin has no creche_ids")
            results["failed"] += 1
            return results
        
        crecheA_id = creche_ids[0]
        test_data["crecheA_id"] = crecheA_id
        print(f"  Marie's first crèche ID: {crecheA_id}")
        
        resp = requests.get(f"{BASE_URL}/employes?creche_id={crecheA_id}", 
                          headers=get_headers("admin"), 
                          timeout=10)
        print(f"  GET /employes: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            employes = data.get("employes", [])
            print(f"  Found {len(employes)} employes")
            
            # Find Aurélie and Sandra
            aurelie = next((e for e in employes if e.get("prenom") == "Aurélie"), None)
            sandra = next((e for e in employes if e.get("prenom") == "Sandra"), None)
            
            if aurelie and sandra:
                test_data["aurelie_id"] = aurelie.get("id")
                test_data["sandra_id"] = sandra.get("id")
                print(f"  Aurélie ID: {test_data['aurelie_id']}")
                print(f"  Sandra ID: {test_data['sandra_id']}")
                print("  ✅ A2 PASS: Got Aurélie and Sandra user ids")
                results["passed"] += 1
            else:
                print(f"  ❌ A2 FAIL: Could not find Aurélie or Sandra in employes")
                results["failed"] += 1
                return results
        else:
            print(f"  ❌ A2 FAIL: GET /employes returned {resp.status_code}")
            results["failed"] += 1
            return results
    except Exception as e:
        print(f"  ❌ A2 FAIL: Exception - {e}")
        results["failed"] += 1
        return results
    
    # A3: POST /api/fiches-paie for Aurélie (juin 2026)
    print("\n[A3] POST /api/fiches-paie for Aurélie (juin 2026)")
    try:
        payload = {
            "employe_id": test_data["aurelie_id"],
            "employe_nom": "Aurélie Payet",
            "periode": "juin 2026",
            "url": "https://example.test/aurelie-juin.pdf",
            "montant_brut": 2100,
            "montant_net": 1680,
            "note": "Prime rentrée",
            "creche_id": test_data["crecheA_id"]
        }
        
        resp = requests.post(f"{BASE_URL}/fiches-paie", 
                           headers=get_headers("admin"),
                           json=payload,
                           timeout=10)
        print(f"  POST /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiche = data.get("fiche", {})
            test_data["aurelie_juin_id"] = fiche.get("id")
            
            # Verify fields
            checks = [
                (fiche.get("employe_id") == test_data["aurelie_id"], "employe_id matches"),
                (fiche.get("periode") == "juin 2026", "periode is 'juin 2026'"),
                (fiche.get("url") == "https://example.test/aurelie-juin.pdf", "url matches"),
                (fiche.get("montant_brut") == 2100, "montant_brut is 2100"),
                (fiche.get("montant_net") == 1680, "montant_net is 1680"),
                (fiche.get("note") == "Prime rentrée", "note matches"),
            ]
            
            all_pass = all(check[0] for check in checks)
            for check, desc in checks:
                status = "✓" if check else "✗"
                print(f"    {status} {desc}")
            
            if all_pass:
                print("  ✅ A3 PASS: Fiche created with correct fields")
                results["passed"] += 1
            else:
                print("  ❌ A3 FAIL: Some fields incorrect")
                results["failed"] += 1
        else:
            print(f"  ❌ A3 FAIL: POST returned {resp.status_code} - {resp.text}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ A3 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # A4: POST /api/fiches-paie for Sandra (juin 2026)
    print("\n[A4] POST /api/fiches-paie for Sandra (juin 2026)")
    try:
        payload = {
            "employe_id": test_data["sandra_id"],
            "employe_nom": "Sandra Grondin",
            "periode": "juin 2026",
            "url": "https://example.test/sandra-juin.pdf",
            "montant_brut": 1900,
            "montant_net": 1500,
            "creche_id": test_data["crecheA_id"]
        }
        
        resp = requests.post(f"{BASE_URL}/fiches-paie", 
                           headers=get_headers("admin"),
                           json=payload,
                           timeout=10)
        print(f"  POST /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiche = data.get("fiche", {})
            test_data["sandra_juin_id"] = fiche.get("id")
            print(f"  Sandra juin fiche ID: {test_data['sandra_juin_id']}")
            print("  ✅ A4 PASS: Sandra's fiche created successfully")
            results["passed"] += 1
        else:
            print(f"  ❌ A4 FAIL: POST returned {resp.status_code} - {resp.text}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ A4 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # A5: POST second fiche for Aurélie (juillet 2026)
    print("\n[A5] POST second fiche for Aurélie (juillet 2026)")
    try:
        payload = {
            "employe_id": test_data["aurelie_id"],
            "employe_nom": "Aurélie Payet",
            "periode": "juillet 2026",
            "url": "https://example.test/aurelie-juillet.pdf",
            "montant_brut": 2100,
            "montant_net": 1680,
            "creche_id": test_data["crecheA_id"]
        }
        
        resp = requests.post(f"{BASE_URL}/fiches-paie", 
                           headers=get_headers("admin"),
                           json=payload,
                           timeout=10)
        print(f"  POST /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiche = data.get("fiche", {})
            test_data["aurelie_juillet_id"] = fiche.get("id")
            print(f"  Aurélie juillet fiche ID: {test_data['aurelie_juillet_id']}")
            print("  ✅ A5 PASS: Aurélie's juillet fiche created successfully")
            results["passed"] += 1
        else:
            print(f"  ❌ A5 FAIL: POST returned {resp.status_code} - {resp.text}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ A5 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # A6: GET /api/fiches-paie as admin → should return 3 fiches
    print("\n[A6] GET /api/fiches-paie as admin (should return 3 fiches)")
    try:
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("admin"), 
                          timeout=10)
        print(f"  GET /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiches = data.get("fiches", [])
            print(f"  Found {len(fiches)} fiches")
            
            if len(fiches) == 3:
                print("  ✅ A6 PASS: Admin sees exactly 3 fiches")
                results["passed"] += 1
            else:
                print(f"  ❌ A6 FAIL: Expected 3 fiches, got {len(fiches)}")
                results["failed"] += 1
        else:
            print(f"  ❌ A6 FAIL: GET returned {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ A6 FAIL: Exception - {e}")
        results["failed"] += 1
    
    print(f"\n[TEST A SUMMARY] Passed: {results['passed']}/6, Failed: {results['failed']}/6")
    return results

def test_b_filtrage_par_employe():
    """
    B) FILTRAGE PAR EMPLOYÉ (Pro voit UNIQUEMENT ses propres fiches)
    Tests role-based filtering for pros
    """
    print("\n" + "="*80)
    print("TEST B: FILTRAGE PAR EMPLOYÉ (Pro voit UNIQUEMENT ses propres fiches)")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # B1: Login as pro@demo.re (Aurélie)
    print("\n[B1] Login as pro@demo.re (Aurélie)")
    try:
        if login("pro_aurelie"):
            print("  ✅ B1 PASS: Aurélie login successful")
            results["passed"] += 1
        else:
            print("  ❌ B1 FAIL: Aurélie login failed")
            results["failed"] += 1
            return results
    except Exception as e:
        print(f"  ❌ B1 FAIL: Exception - {e}")
        results["failed"] += 1
        return results
    
    # B2: GET /api/fiches-paie → should return exactly 2 fiches (Aurélie's juin + juillet)
    print("\n[B2] GET /api/fiches-paie as Aurélie (should return 2 fiches)")
    try:
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("pro_aurelie"), 
                          timeout=10)
        print(f"  GET /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiches = data.get("fiches", [])
            print(f"  Found {len(fiches)} fiches")
            
            if len(fiches) == 2:
                # Verify all fiches belong to Aurélie
                aurelie_id = users["pro_aurelie"].get("id")
                all_aurelie = all(f.get("employe_id") == aurelie_id for f in fiches)
                
                if all_aurelie:
                    print(f"  ✓ All fiches have employe_id = {aurelie_id}")
                    
                    # Check Sandra's fiche is NOT present
                    sandra_present = any(f.get("employe_nom") == "Sandra Grondin" for f in fiches)
                    if not sandra_present:
                        print("  ✓ Sandra's fiche NOT present (correct)")
                        print("  ✅ B2 PASS: Aurélie sees only her 2 fiches")
                        results["passed"] += 1
                    else:
                        print("  ❌ B2 FAIL: Sandra's fiche incorrectly visible to Aurélie")
                        results["failed"] += 1
                else:
                    print("  ❌ B2 FAIL: Some fiches don't belong to Aurélie")
                    results["failed"] += 1
            else:
                print(f"  ❌ B2 FAIL: Expected 2 fiches, got {len(fiches)}")
                results["failed"] += 1
        else:
            print(f"  ❌ B2 FAIL: GET returned {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ B2 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # B3: Login as pro2@demo.re (Sandra)
    print("\n[B3] Login as pro2@demo.re (Sandra)")
    try:
        if login("pro_sandra"):
            print("  ✅ B3 PASS: Sandra login successful")
            results["passed"] += 1
        else:
            print("  ❌ B3 FAIL: Sandra login failed")
            results["failed"] += 1
            return results
    except Exception as e:
        print(f"  ❌ B3 FAIL: Exception - {e}")
        results["failed"] += 1
        return results
    
    # B4: GET /api/fiches-paie → should return exactly 1 fiche (Sandra juin)
    print("\n[B4] GET /api/fiches-paie as Sandra (should return 1 fiche)")
    try:
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("pro_sandra"), 
                          timeout=10)
        print(f"  GET /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiches = data.get("fiches", [])
            print(f"  Found {len(fiches)} fiches")
            
            if len(fiches) == 1:
                # Verify fiche belongs to Sandra
                sandra_id = users["pro_sandra"].get("id")
                fiche = fiches[0]
                
                if fiche.get("employe_id") == sandra_id:
                    print(f"  ✓ Fiche has employe_id = {sandra_id}")
                    print("  ✅ B4 PASS: Sandra sees only her 1 fiche")
                    results["passed"] += 1
                else:
                    print(f"  ❌ B4 FAIL: Fiche employe_id doesn't match Sandra's id")
                    results["failed"] += 1
            else:
                print(f"  ❌ B4 FAIL: Expected 1 fiche, got {len(fiches)}")
                results["failed"] += 1
        else:
            print(f"  ❌ B4 FAIL: GET returned {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ B4 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # B5: Login as parent@demo.re. Try GET /api/fiches-paie → should get 403
    print("\n[B5] Login as parent and try GET /api/fiches-paie (should get 403)")
    try:
        if not login("parent"):
            print("  ❌ B5 FAIL: Parent login failed")
            results["failed"] += 1
            return results
        
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("parent"), 
                          timeout=10)
        print(f"  GET /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 403:
            print("  ✅ B5 PASS: Parent correctly denied access (403)")
            results["passed"] += 1
        else:
            print(f"  ❌ B5 FAIL: Expected 403, got {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ B5 FAIL: Exception - {e}")
        results["failed"] += 1
    
    print(f"\n[TEST B SUMMARY] Passed: {results['passed']}/5, Failed: {results['failed']}/5")
    return results

def test_c_put_delete_fiches():
    """
    C) PUT / DELETE FICHES (admin only)
    Tests admin updating and deleting payslips
    """
    print("\n" + "="*80)
    print("TEST C: PUT / DELETE FICHES (admin only)")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # C1: Login back as admin
    print("\n[C1] Login back as admin")
    try:
        if login("admin"):
            print("  ✅ C1 PASS: Admin login successful")
            results["passed"] += 1
        else:
            print("  ❌ C1 FAIL: Admin login failed")
            results["failed"] += 1
            return results
    except Exception as e:
        print(f"  ❌ C1 FAIL: Exception - {e}")
        results["failed"] += 1
        return results
    
    # C2: GET /api/fiches-paie → get id of Aurélie juin fiche
    print("\n[C2] GET /api/fiches-paie to get Aurélie juin fiche id")
    try:
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("admin"), 
                          timeout=10)
        print(f"  GET /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiches = data.get("fiches", [])
            
            # Find Aurélie juin fiche
            aurelie_juin = next((f for f in fiches if f.get("periode") == "juin 2026" and "Aurélie" in f.get("employe_nom", "")), None)
            
            if aurelie_juin:
                test_data["aurelie_juin_id"] = aurelie_juin.get("id")
                print(f"  Aurélie juin fiche ID: {test_data['aurelie_juin_id']}")
                print("  ✅ C2 PASS: Got Aurélie juin fiche id")
                results["passed"] += 1
            else:
                print("  ❌ C2 FAIL: Could not find Aurélie juin fiche")
                results["failed"] += 1
                return results
        else:
            print(f"  ❌ C2 FAIL: GET returned {resp.status_code}")
            results["failed"] += 1
            return results
    except Exception as e:
        print(f"  ❌ C2 FAIL: Exception - {e}")
        results["failed"] += 1
        return results
    
    # C3: PUT /api/fiches-paie/<id> with body {montant_net: 1750, note: "Note modifiée"}
    print("\n[C3] PUT /api/fiches-paie/<id> to update montant_net and note")
    try:
        fiche_id = test_data.get("aurelie_juin_id")
        payload = {
            "montant_net": 1750,
            "note": "Note modifiée"
        }
        
        resp = requests.put(f"{BASE_URL}/fiches-paie/{fiche_id}", 
                          headers=get_headers("admin"),
                          json=payload,
                          timeout=10)
        print(f"  PUT /fiches-paie/{fiche_id}: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiche = data.get("fiche", {})
            
            # Verify updates
            if fiche.get("montant_net") == 1750 and fiche.get("note") == "Note modifiée":
                print(f"  ✓ montant_net updated to 1750")
                print(f"  ✓ note updated to 'Note modifiée'")
                print("  ✅ C3 PASS: Fiche updated successfully")
                results["passed"] += 1
            else:
                print(f"  ❌ C3 FAIL: Fields not updated correctly")
                print(f"    montant_net: {fiche.get('montant_net')}, note: {fiche.get('note')}")
                results["failed"] += 1
        else:
            print(f"  ❌ C3 FAIL: PUT returned {resp.status_code} - {resp.text}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ C3 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # C4: DELETE /api/fiches-paie/<id> → expect {ok: true}
    print("\n[C4] DELETE /api/fiches-paie/<id>")
    try:
        fiche_id = test_data.get("aurelie_juin_id")
        
        resp = requests.delete(f"{BASE_URL}/fiches-paie/{fiche_id}", 
                             headers=get_headers("admin"),
                             timeout=10)
        print(f"  DELETE /fiches-paie/{fiche_id}: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True:
                print("  ✅ C4 PASS: Fiche deleted successfully")
                results["passed"] += 1
            else:
                print(f"  ❌ C4 FAIL: Response doesn't contain ok:true - {data}")
                results["failed"] += 1
        else:
            print(f"  ❌ C4 FAIL: DELETE returned {resp.status_code} - {resp.text}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ C4 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # C5: GET /api/fiches-paie as admin → should now show 2 fiches
    print("\n[C5] GET /api/fiches-paie as admin (should now show 2 fiches)")
    try:
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("admin"), 
                          timeout=10)
        print(f"  GET /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiches = data.get("fiches", [])
            print(f"  Found {len(fiches)} fiches")
            
            if len(fiches) == 2:
                print("  ✅ C5 PASS: Admin now sees 2 fiches (Sandra juin + Aurélie juillet)")
                results["passed"] += 1
            else:
                print(f"  ❌ C5 FAIL: Expected 2 fiches, got {len(fiches)}")
                results["failed"] += 1
        else:
            print(f"  ❌ C5 FAIL: GET returned {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ C5 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # C6: Login as pro Aurélie. GET /api/fiches-paie → should return exactly 1 fiche (juillet only)
    print("\n[C6] Login as Aurélie and GET /api/fiches-paie (should return 1 fiche)")
    try:
        if not login("pro_aurelie"):
            print("  ❌ C6 FAIL: Aurélie login failed")
            results["failed"] += 1
            return results
        
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("pro_aurelie"), 
                          timeout=10)
        print(f"  GET /fiches-paie: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            fiches = data.get("fiches", [])
            print(f"  Found {len(fiches)} fiches")
            
            if len(fiches) == 1:
                fiche = fiches[0]
                if fiche.get("periode") == "juillet 2026":
                    print("  ✓ Fiche is juillet 2026 (correct)")
                    print("  ✅ C6 PASS: Aurélie sees only 1 fiche (juillet)")
                    results["passed"] += 1
                else:
                    print(f"  ❌ C6 FAIL: Fiche periode is {fiche.get('periode')}, expected juillet 2026")
                    results["failed"] += 1
            else:
                print(f"  ❌ C6 FAIL: Expected 1 fiche, got {len(fiches)}")
                results["failed"] += 1
        else:
            print(f"  ❌ C6 FAIL: GET returned {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ C6 FAIL: Exception - {e}")
        results["failed"] += 1
    
    print(f"\n[TEST C SUMMARY] Passed: {results['passed']}/6, Failed: {results['failed']}/6")
    return results

def test_d_security():
    """
    D) SECURITY (Pro cannot POST/PUT/DELETE)
    Tests that pros cannot create, update, or delete payslips
    """
    print("\n" + "="*80)
    print("TEST D: SECURITY (Pro cannot POST/PUT/DELETE)")
    print("="*80)
    
    results = {"passed": 0, "failed": 0}
    
    # D1: Login as pro@demo.re. Try POST /api/fiches-paie → expect 4xx
    print("\n[D1] Login as Aurélie and try POST /api/fiches-paie (should fail)")
    try:
        if not login("pro_aurelie"):
            print("  ❌ D1 FAIL: Aurélie login failed")
            results["failed"] += 1
            return results
        
        payload = {
            "employe_id": users["pro_aurelie"].get("id"),
            "employe_nom": "Aurélie Payet",
            "periode": "août 2026",
            "url": "https://example.test/test.pdf",
            "montant_brut": 2100,
            "montant_net": 1680,
            "creche_id": test_data.get("crecheA_id")
        }
        
        resp = requests.post(f"{BASE_URL}/fiches-paie", 
                           headers=get_headers("pro_aurelie"),
                           json=payload,
                           timeout=10)
        print(f"  POST /fiches-paie: {resp.status_code}")
        
        if resp.status_code >= 400 and resp.status_code < 500:
            print(f"  ✅ D1 PASS: Pro correctly denied POST access ({resp.status_code})")
            results["passed"] += 1
        else:
            print(f"  ❌ D1 FAIL: Expected 4xx, got {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ D1 FAIL: Exception - {e}")
        results["failed"] += 1
    
    # D2: Try DELETE /api/fiches-paie/<any_id> → expect 4xx
    print("\n[D2] Try DELETE /api/fiches-paie/<any_id> as pro (should fail)")
    try:
        # Use Aurélie's juillet fiche id
        fiche_id = test_data.get("aurelie_juillet_id", "dummy-id")
        
        resp = requests.delete(f"{BASE_URL}/fiches-paie/{fiche_id}", 
                             headers=get_headers("pro_aurelie"),
                             timeout=10)
        print(f"  DELETE /fiches-paie/{fiche_id}: {resp.status_code}")
        
        if resp.status_code >= 400 and resp.status_code < 500:
            print(f"  ✅ D2 PASS: Pro correctly denied DELETE access ({resp.status_code})")
            results["passed"] += 1
        else:
            print(f"  ❌ D2 FAIL: Expected 4xx, got {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print(f"  ❌ D2 FAIL: Exception - {e}")
        results["failed"] += 1
    
    print(f"\n[TEST D SUMMARY] Passed: {results['passed']}/2, Failed: {results['failed']}/2")
    return results

def cleanup_test_fiches():
    """
    Cleanup: Delete all remaining test fiches
    """
    print("\n" + "="*80)
    print("CLEANUP: Delete all remaining test fiches")
    print("="*80)
    
    try:
        # Login as admin
        if not login("admin"):
            print("  ✗ Cleanup failed: Admin login failed")
            return
        
        # Get all fiches
        resp = requests.get(f"{BASE_URL}/fiches-paie", 
                          headers=get_headers("admin"), 
                          timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            fiches = data.get("fiches", [])
            print(f"  Found {len(fiches)} fiches to delete")
            
            deleted = 0
            for fiche in fiches:
                fiche_id = fiche.get("id")
                try:
                    del_resp = requests.delete(f"{BASE_URL}/fiches-paie/{fiche_id}", 
                                             headers=get_headers("admin"),
                                             timeout=10)
                    if del_resp.status_code == 200:
                        deleted += 1
                except Exception as e:
                    print(f"    ✗ Failed to delete {fiche_id}: {e}")
            
            print(f"  ✓ Deleted {deleted}/{len(fiches)} fiches")
            print("  ✅ Cleanup complete - DB is clean")
        else:
            print(f"  ✗ Cleanup failed: GET /fiches-paie returned {resp.status_code}")
    except Exception as e:
        print(f"  ✗ Cleanup exception: {e}")

def main():
    """Run all V9.1 Fiches de Paie tests"""
    print("\n" + "="*80)
    print("TiMétis V9.1 - Fiches de Paie Backend Testing")
    print("Testing NEW V9.1 endpoints ONLY")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    results_a = test_a_depot_par_employe()
    results_b = test_b_filtrage_par_employe()
    results_c = test_c_put_delete_fiches()
    results_d = test_d_security()
    
    # Cleanup
    cleanup_test_fiches()
    
    # Final summary
    total_passed = results_a["passed"] + results_b["passed"] + results_c["passed"] + results_d["passed"]
    total_failed = results_a["failed"] + results_b["failed"] + results_c["failed"] + results_d["failed"]
    total_tests = total_passed + total_failed
    
    print("\n" + "="*80)
    print("FINAL SUMMARY - V9.1 FICHES DE PAIE")
    print("="*80)
    print(f"Test A (Dépôt par employé):     {results_a['passed']}/6 passed")
    print(f"Test B (Filtrage par employé):  {results_b['passed']}/5 passed")
    print(f"Test C (PUT/DELETE):             {results_c['passed']}/6 passed")
    print(f"Test D (Security):               {results_d['passed']}/2 passed")
    print("-" * 80)
    print(f"TOTAL: {total_passed}/{total_tests} tests passed")
    
    if total_failed == 0:
        print("\n✅ ALL TESTS PASSED - V9.1 Fiches de Paie endpoints working correctly!")
    else:
        print(f"\n❌ {total_failed} tests failed - Review failures above")
    
    print("="*80)
    print(f"Test finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
