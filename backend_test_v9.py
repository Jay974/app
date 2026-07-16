#!/usr/bin/env python3
"""
TiMétis V9 Backend Testing Suite
Tests NEW Super Admin Devis/Factures SaaS, Client Editor, and Familles Enfants
"""

import requests
import json
from datetime import datetime

# Backend URL from .env
BASE_URL = "https://tikreol-demo.preview.emergentagent.com/api"

# Demo accounts
ACCOUNTS = {
    "super_admin": {"email": "jeanchrisoulia@gmail.com", "password": "TiMetis974!"},
    "marie": {"email": "admin@demo.re", "password": "demo1234"},  # 2 crèches
    "sophie": {"email": "admin2@demo.re", "password": "demo1234"},  # 1 crèche
}

# Store tokens and user data
tokens = {}
users = {}
marie_id = None
marie_creche_id = None

def login(account_key):
    """Login and store token"""
    try:
        account = ACCOUNTS[account_key]
        resp = requests.post(f"{BASE_URL}/auth/login", json=account, timeout=10)
        print(f"✓ Login {account_key} ({account['email']}): {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            tokens[account_key] = data.get("token")
            users[account_key] = data.get("user")
            print(f"  User: {users[account_key].get('prenom')} {users[account_key].get('nom')} (role: {users[account_key].get('role')})")
            return True
        else:
            print(f"  ✗ FAILED: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ EXCEPTION: {e}")
        return False

def get_headers(account_key):
    """Get auth headers for account"""
    return {"Authorization": f"Bearer {tokens[account_key]}"}

def test_a_super_admin_devis_saas():
    """Test A: SUPER ADMIN DEVIS SAAS"""
    print("\n" + "="*80)
    print("TEST A: SUPER ADMIN DEVIS SAAS")
    print("="*80)
    
    global marie_id
    
    # A1: Login as super_admin
    print("\n[A1] Login as super_admin")
    if not login("super_admin"):
        print("✗ A1 FAILED: Cannot login as super_admin")
        return False
    print("✓ A1 PASSED: Super admin logged in")
    
    # A2: GET /api/super/devis (should return empty or existing list)
    print("\n[A2] GET /api/super/devis")
    try:
        resp = requests.get(f"{BASE_URL}/super/devis", 
                          headers=get_headers("super_admin"), 
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            devis_list = data.get("devis", [])
            print(f"  ✓ A2 PASSED: GET /super/devis returned {len(devis_list)} devis")
        else:
            print(f"  ✗ A2 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ A2 FAILED: Exception: {e}")
        return False
    
    # A3: GET /api/super/clients to obtain Marie's user id
    print("\n[A3] GET /api/super/clients to obtain Marie's user id")
    try:
        resp = requests.get(f"{BASE_URL}/super/clients", 
                          headers=get_headers("super_admin"), 
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            clients = data.get("clients", [])
            marie = next((c for c in clients if c.get("email") == "admin@demo.re"), None)
            
            if marie:
                marie_id = marie.get("id")
                print(f"  ✓ A3 PASSED: Found Marie's id: {marie_id}")
                print(f"    Marie: {marie.get('prenom')} {marie.get('nom')}, {len(marie.get('creches', []))} crèches")
            else:
                print(f"  ✗ A3 FAILED: Marie not found in clients list")
                return False
        else:
            print(f"  ✗ A3 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ A3 FAILED: Exception: {e}")
        return False
    
    # A4: POST /api/super/devis with specific payload
    print("\n[A4] POST /api/super/devis")
    devis_id = None
    try:
        payload = {
            "client_id": marie_id,
            "description": "Abonnement TiMétis test",
            "periode": "juillet 2026",
            "echeance": "2026-08-15",
            "lignes": [
                {"label": "1ʳᵉ crèche", "qte": 1, "pu": 79, "total": 79},
                {"label": "Crèche supp x1", "qte": 1, "pu": 40, "total": 40}
            ],
            "montant_ht": 119,
            "tva": 0,
            "montant_ttc": 119,
            "notes": "IBAN FR76…"
        }
        
        resp = requests.post(f"{BASE_URL}/super/devis", 
                           headers=get_headers("super_admin"),
                           json=payload,
                           timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            devis = data.get("devis", {})
            devis_id = devis.get("id")
            numero = devis.get("numero")
            
            print(f"  ✓ A4 PASSED: Devis created")
            print(f"    ID: {devis_id}")
            print(f"    Numero: {numero}")
            print(f"    Type: {devis.get('type')}")
            print(f"    Client ID: {devis.get('client_id')}")
            print(f"    Client Email: {devis.get('client_email')}")
            print(f"    Client Nom: {devis.get('client_nom')}")
            print(f"    Montant TTC: {devis.get('montant_ttc')}")
            print(f"    Statut: {devis.get('statut')}")
            print(f"    Envoye: {devis.get('envoye')}")
            
            # Verify fields
            checks = []
            checks.append(("numero starts with DEV-", numero and numero.startswith("DEV-")))
            checks.append(("type is 'devis'", devis.get("type") == "devis"))
            checks.append(("client_id matches", devis.get("client_id") == marie_id))
            checks.append(("client_email is admin@demo.re", devis.get("client_email") == "admin@demo.re"))
            checks.append(("montant_ttc is 119", devis.get("montant_ttc") == 119))
            checks.append(("statut is 'brouillon'", devis.get("statut") == "brouillon"))
            checks.append(("envoye is False", devis.get("envoye") == False))
            
            for check_name, check_result in checks:
                if check_result:
                    print(f"    ✓ {check_name}")
                else:
                    print(f"    ✗ {check_name}")
                    return False
        else:
            print(f"  ✗ A4 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ A4 FAILED: Exception: {e}")
        return False
    
    # A5: GET /api/super/devis (should now contain the created devis)
    print("\n[A5] GET /api/super/devis (verify created devis)")
    try:
        resp = requests.get(f"{BASE_URL}/super/devis", 
                          headers=get_headers("super_admin"), 
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            devis_list = data.get("devis", [])
            found = next((d for d in devis_list if d.get("id") == devis_id), None)
            
            if found:
                print(f"  ✓ A5 PASSED: Created devis found in list")
                print(f"    Enriched with client: {found.get('client', {}).get('prenom')} {found.get('client', {}).get('nom')}")
            else:
                print(f"  ✗ A5 FAILED: Created devis not found in list")
                return False
        else:
            print(f"  ✗ A5 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ A5 FAILED: Exception: {e}")
        return False
    
    # A6: POST /api/super/devis/:id/send
    print("\n[A6] POST /api/super/devis/:id/send")
    try:
        resp = requests.post(f"{BASE_URL}/super/devis/{devis_id}/send", 
                           headers=get_headers("super_admin"),
                           timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            
            print(f"  ✓ A6 PASSED: Devis send endpoint returned successfully")
            print(f"    OK: {data.get('ok')}")
            print(f"    Email: {data.get('email')}")
            print(f"    Subject: {data.get('subject')}")
            print(f"    Mailto starts with: {data.get('mailto', '')[:50]}...")
            
            # Verify fields
            checks = []
            checks.append(("ok is True", data.get("ok") == True))
            checks.append(("mailto starts with 'mailto:admin%40demo.re'", data.get("mailto", "").startswith("mailto:admin%40demo.re")))
            checks.append(("subject contains 'Devis TiMétis DEV-'", "Devis TiMétis DEV-" in data.get("subject", "")))
            checks.append(("body is string", isinstance(data.get("body"), str)))
            checks.append(("email is admin@demo.re", data.get("email") == "admin@demo.re"))
            
            for check_name, check_result in checks:
                if check_result:
                    print(f"    ✓ {check_name}")
                else:
                    print(f"    ✗ {check_name}")
                    return False
            
            # Verify envoye=true in database
            resp2 = requests.get(f"{BASE_URL}/super/devis", 
                              headers=get_headers("super_admin"), 
                              timeout=10)
            if resp2.status_code == 200:
                devis_list = resp2.json().get("devis", [])
                updated = next((d for d in devis_list if d.get("id") == devis_id), None)
                if updated and updated.get("envoye") == True and updated.get("statut") == "envoye":
                    print(f"    ✓ Devis marked as envoye=true, statut='envoye'")
                else:
                    print(f"    ✗ Devis not properly updated: envoye={updated.get('envoye')}, statut={updated.get('statut')}")
                    return False
        else:
            print(f"  ✗ A6 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ A6 FAILED: Exception: {e}")
        return False
    
    # A7: PUT /api/super/devis/:id (update)
    print("\n[A7] PUT /api/super/devis/:id")
    try:
        resp = requests.put(f"{BASE_URL}/super/devis/{devis_id}", 
                          headers=get_headers("super_admin"),
                          json={"notes": "updated notes test"},
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"  ✓ A7 PASSED: Devis updated successfully")
        else:
            print(f"  ✗ A7 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ A7 FAILED: Exception: {e}")
        return False
    
    # A8: DELETE /api/super/devis/:id
    print("\n[A8] DELETE /api/super/devis/:id")
    try:
        resp = requests.delete(f"{BASE_URL}/super/devis/{devis_id}", 
                             headers=get_headers("super_admin"),
                             timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True:
                print(f"  ✓ A8 PASSED: Devis deleted successfully")
                
                # Verify it's gone
                resp2 = requests.get(f"{BASE_URL}/super/devis", 
                                  headers=get_headers("super_admin"), 
                                  timeout=10)
                if resp2.status_code == 200:
                    devis_list = resp2.json().get("devis", [])
                    found = next((d for d in devis_list if d.get("id") == devis_id), None)
                    if not found:
                        print(f"    ✓ Devis no longer in list")
                    else:
                        print(f"    ✗ Devis still in list after delete")
                        return False
            else:
                print(f"  ✗ A8 FAILED: Response ok is not True")
                return False
        else:
            print(f"  ✗ A8 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ A8 FAILED: Exception: {e}")
        return False
    
    print("\n✓✓✓ TEST A: ALL PASSED (A1-A8) ✓✓✓")
    return True

def test_b_super_admin_factures_saas():
    """Test B: SUPER ADMIN FACTURES SAAS"""
    print("\n" + "="*80)
    print("TEST B: SUPER ADMIN FACTURES SAAS")
    print("="*80)
    
    global marie_id
    
    if not marie_id:
        print("✗ TEST B SKIPPED: marie_id not set (run test A first)")
        return False
    
    # B1: POST /api/super/factures
    print("\n[B1] POST /api/super/factures")
    facture_id = None
    try:
        payload = {
            "client_id": marie_id,
            "description": "Facture TiMétis test",
            "periode": "août 2026",
            "echeance": "2026-09-15",
            "lignes": [
                {"label": "1ʳᵉ crèche", "qte": 1, "pu": 79, "total": 79},
                {"label": "Crèche supp x1", "qte": 1, "pu": 40, "total": 40}
            ],
            "montant_ht": 119,
            "tva": 0,
            "montant_ttc": 119,
            "notes": "Règlement par virement"
        }
        
        resp = requests.post(f"{BASE_URL}/super/factures", 
                           headers=get_headers("super_admin"),
                           json=payload,
                           timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            facture = data.get("facture", {})
            facture_id = facture.get("id")
            numero = facture.get("numero")
            
            print(f"  ✓ B1 PASSED: Facture created")
            print(f"    ID: {facture_id}")
            print(f"    Numero: {numero}")
            print(f"    Type: {facture.get('type')}")
            print(f"    Statut: {facture.get('statut')}")
            
            # Verify fields
            checks = []
            checks.append(("numero starts with FAC-", numero and numero.startswith("FAC-")))
            checks.append(("type is 'facture'", facture.get("type") == "facture"))
            checks.append(("statut is 'en_attente'", facture.get("statut") == "en_attente"))
            
            for check_name, check_result in checks:
                if check_result:
                    print(f"    ✓ {check_name}")
                else:
                    print(f"    ✗ {check_name}")
                    return False
        else:
            print(f"  ✗ B1 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ B1 FAILED: Exception: {e}")
        return False
    
    # B2: POST /api/super/factures/:id/send
    print("\n[B2] POST /api/super/factures/:id/send")
    try:
        resp = requests.post(f"{BASE_URL}/super/factures/{facture_id}/send", 
                           headers=get_headers("super_admin"),
                           timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            
            print(f"  ✓ B2 PASSED: Facture send endpoint returned successfully")
            print(f"    Subject: {data.get('subject')}")
            
            # Verify subject contains "Facture TiMétis FAC-"
            if "Facture TiMétis FAC-" in data.get("subject", ""):
                print(f"    ✓ Subject contains 'Facture TiMétis FAC-'")
            else:
                print(f"    ✗ Subject should contain 'Facture TiMétis FAC-'")
                return False
        else:
            print(f"  ✗ B2 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ B2 FAILED: Exception: {e}")
        return False
    
    # B3: DELETE /api/super/factures/:id
    print("\n[B3] DELETE /api/super/factures/:id")
    try:
        resp = requests.delete(f"{BASE_URL}/super/factures/{facture_id}", 
                             headers=get_headers("super_admin"),
                             timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True:
                print(f"  ✓ B3 PASSED: Facture deleted successfully")
            else:
                print(f"  ✗ B3 FAILED: Response ok is not True")
                return False
        else:
            print(f"  ✗ B3 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ B3 FAILED: Exception: {e}")
        return False
    
    print("\n✓✓✓ TEST B: ALL PASSED (B1-B3) ✓✓✓")
    return True

def test_c_security():
    """Test C: SECURITY - Admin cannot access super endpoints"""
    print("\n" + "="*80)
    print("TEST C: SECURITY - Admin cannot access super endpoints")
    print("="*80)
    
    # Login as Marie (admin)
    print("\n[C1] Login as Marie (admin)")
    if not login("marie"):
        print("✗ C1 FAILED: Cannot login as Marie")
        return False
    print("✓ C1 PASSED: Marie logged in")
    
    # Try GET /api/super/devis
    print("\n[C2] Marie tries GET /api/super/devis")
    try:
        resp = requests.get(f"{BASE_URL}/super/devis", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code in [403, 404]:
            print(f"  ✓ C2 PASSED: Marie correctly denied access (status {resp.status_code})")
        else:
            print(f"  ✗ C2 FAILED: Expected 403/404, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ C2 FAILED: Exception: {e}")
        return False
    
    # Try POST /api/super/devis
    print("\n[C3] Marie tries POST /api/super/devis")
    try:
        resp = requests.post(f"{BASE_URL}/super/devis", 
                           headers=get_headers("marie"),
                           json={"client_id": "test", "description": "test"},
                           timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code in [403, 404]:
            print(f"  ✓ C3 PASSED: Marie correctly denied access (status {resp.status_code})")
        else:
            print(f"  ✗ C3 FAILED: Expected 403/404, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ C3 FAILED: Exception: {e}")
        return False
    
    print("\n✓✓✓ TEST C: ALL PASSED (C1-C3) ✓✓✓")
    return True

def test_d_super_admin_client_edit():
    """Test D: SUPER ADMIN CLIENT EDIT via PUT /api/users/:id"""
    print("\n" + "="*80)
    print("TEST D: SUPER ADMIN CLIENT EDIT via PUT /api/users/:id")
    print("="*80)
    
    global marie_id
    
    if not marie_id:
        print("✗ TEST D SKIPPED: marie_id not set")
        return False
    
    # D1: Login as super_admin
    print("\n[D1] Login as super_admin")
    if "super_admin" not in tokens:
        if not login("super_admin"):
            print("✗ D1 FAILED: Cannot login as super_admin")
            return False
    print("✓ D1 PASSED: Super admin logged in")
    
    # D2: PUT /api/users/:id with new data
    print("\n[D2] PUT /api/users/:id (update Marie)")
    try:
        payload = {
            "prenom": "Marie",
            "nom": "Hoarau-TEST",
            "email": "admin@demo.re",
            "tel": "0692 99 99 99",
            "plan_prix": 99,
            "notes_admin": "Note interne test",
            "subscription": {"status": "active", "plan": "custom"},
            "password": "newpass123"
        }
        
        resp = requests.put(f"{BASE_URL}/users/{marie_id}", 
                          headers=get_headers("super_admin"),
                          json=payload,
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            
            print(f"  ✓ D2 PASSED: User updated")
            print(f"    Prenom: {user.get('prenom')}")
            print(f"    Nom: {user.get('nom')}")
            print(f"    Tel: {user.get('tel')}")
            print(f"    Plan Prix: {user.get('plan_prix')}")
            print(f"    Notes Admin: {user.get('notes_admin')}")
            
            # Verify fields
            checks = []
            checks.append(("prenom is Marie", user.get("prenom") == "Marie"))
            checks.append(("nom is Hoarau-TEST", user.get("nom") == "Hoarau-TEST"))
            checks.append(("tel is 0692 99 99 99", user.get("tel") == "0692 99 99 99"))
            checks.append(("plan_prix is 99", user.get("plan_prix") == 99))
            checks.append(("notes_admin is set", user.get("notes_admin") == "Note interne test"))
            checks.append(("password NOT in response", "password" not in user))
            
            for check_name, check_result in checks:
                if check_result:
                    print(f"    ✓ {check_name}")
                else:
                    print(f"    ✗ {check_name}")
                    return False
        else:
            print(f"  ✗ D2 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ D2 FAILED: Exception: {e}")
        return False
    
    # D3: Verify login with new password
    print("\n[D3] Verify login with new password")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"email": "admin@demo.re", "password": "newpass123"},
                           timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("token"):
                print(f"  ✓ D3 PASSED: Login successful with new password")
                # Update token for Marie
                tokens["marie"] = data.get("token")
            else:
                print(f"  ✗ D3 FAILED: No token in response")
                return False
        else:
            print(f"  ✗ D3 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ D3 FAILED: Exception: {e}")
        return False
    
    # D4: Restore original data
    print("\n[D4] Restore original data")
    try:
        payload = {
            "nom": "Hoarau",
            "password": "demo1234"
        }
        
        resp = requests.put(f"{BASE_URL}/users/{marie_id}", 
                          headers=get_headers("super_admin"),
                          json=payload,
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"  ✓ D4 PASSED: Original data restored")
            
            # Verify login with original password
            resp2 = requests.post(f"{BASE_URL}/auth/login", 
                               json={"email": "admin@demo.re", "password": "demo1234"},
                               timeout=10)
            if resp2.status_code == 200:
                print(f"    ✓ Login works with original password")
                tokens["marie"] = resp2.json().get("token")
            else:
                print(f"    ✗ Login failed with original password")
                return False
        else:
            print(f"  ✗ D4 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ D4 FAILED: Exception: {e}")
        return False
    
    print("\n✓✓✓ TEST D: ALL PASSED (D1-D4) ✓✓✓")
    return True

def test_e_familles_enfants_rattaches():
    """Test E: FAMILLES ENFANTS RATTACHÉS"""
    print("\n" + "="*80)
    print("TEST E: FAMILLES ENFANTS RATTACHÉS")
    print("="*80)
    
    global marie_creche_id
    
    # E1: Login as Marie
    print("\n[E1] Login as Marie")
    if "marie" not in tokens:
        if not login("marie"):
            print("✗ E1 FAILED: Cannot login as Marie")
            return False
    print("✓ E1 PASSED: Marie logged in")
    
    # Get Marie's first creche_id
    if not marie_creche_id:
        try:
            resp = requests.get(f"{BASE_URL}/creches", 
                              headers=get_headers("marie"), 
                              timeout=10)
            if resp.status_code == 200:
                creches = resp.json().get("creches", [])
                if creches:
                    marie_creche_id = creches[0].get("id")
                    print(f"  Marie's creche_id: {marie_creche_id}")
        except Exception as e:
            print(f"  ✗ Failed to get creche_id: {e}")
            return False
    
    # E2: GET /api/enfants?creche_id=X
    print("\n[E2] GET /api/enfants?creche_id=X")
    enfants_list = []
    try:
        resp = requests.get(f"{BASE_URL}/enfants?creche_id={marie_creche_id}", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            enfants_list = data.get("enfants", [])
            print(f"  ✓ E2 PASSED: Got {len(enfants_list)} enfants")
            for e in enfants_list[:3]:
                print(f"    - {e.get('prenom')} {e.get('nom')} (id: {e.get('id')})")
        else:
            print(f"  ✗ E2 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ E2 FAILED: Exception: {e}")
        return False
    
    # E3: GET /api/familles?creche_id=X
    print("\n[E3] GET /api/familles?creche_id=X")
    familles_list = []
    famille_id = None
    try:
        resp = requests.get(f"{BASE_URL}/familles?creche_id={marie_creche_id}", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            familles_list = data.get("familles", [])
            print(f"  ✓ E3 PASSED: Got {len(familles_list)} familles")
            
            if familles_list:
                famille_id = familles_list[0].get("id")
                print(f"    Using famille: {familles_list[0].get('nom')} (id: {famille_id})")
        else:
            print(f"  ✗ E3 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ E3 FAILED: Exception: {e}")
        return False
    
    if not famille_id or len(enfants_list) < 2:
        print("  ✗ E3 FAILED: Need at least 1 famille and 2 enfants for test")
        return False
    
    # E4: PUT /api/familles/:id with enfants array
    print("\n[E4] PUT /api/familles/:id with enfants array")
    enfant_ids = [enfants_list[0].get("id"), enfants_list[1].get("id")]
    try:
        resp = requests.put(f"{BASE_URL}/familles/{famille_id}", 
                          headers=get_headers("marie"),
                          json={"enfants": enfant_ids},
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            famille = data.get("famille", {})
            
            print(f"  ✓ E4 PASSED: Famille updated")
            print(f"    Enfants: {famille.get('enfants')}")
            
            # Verify enfants array matches
            if famille.get("enfants") == enfant_ids:
                print(f"    ✓ Enfants array matches")
            else:
                print(f"    ✗ Enfants array mismatch: expected {enfant_ids}, got {famille.get('enfants')}")
                return False
        else:
            print(f"  ✗ E4 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ E4 FAILED: Exception: {e}")
        return False
    
    # E5: GET /api/familles to verify persisted
    print("\n[E5] GET /api/familles to verify persisted")
    try:
        resp = requests.get(f"{BASE_URL}/familles?creche_id={marie_creche_id}", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            familles = data.get("familles", [])
            famille = next((f for f in familles if f.get("id") == famille_id), None)
            
            if famille and famille.get("enfants") == enfant_ids:
                print(f"  ✓ E5 PASSED: Enfants persisted correctly")
            else:
                print(f"  ✗ E5 FAILED: Enfants not persisted correctly")
                return False
        else:
            print(f"  ✗ E5 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ E5 FAILED: Exception: {e}")
        return False
    
    # E6: PUT again with empty enfants array
    print("\n[E6] PUT /api/familles/:id with empty enfants array")
    try:
        resp = requests.put(f"{BASE_URL}/familles/{famille_id}", 
                          headers=get_headers("marie"),
                          json={"enfants": []},
                          timeout=10)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            famille = data.get("famille", {})
            
            if famille.get("enfants") == []:
                print(f"  ✓ E6 PASSED: Enfants array cleared")
            else:
                print(f"  ✗ E6 FAILED: Enfants array not cleared: {famille.get('enfants')}")
                return False
        else:
            print(f"  ✗ E6 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"  ✗ E6 FAILED: Exception: {e}")
        return False
    
    print("\n✓✓✓ TEST E: ALL PASSED (E1-E6) ✓✓✓")
    return True

def main():
    """Run all V9 tests"""
    print("\n" + "="*80)
    print("TiMétis V9 Backend Testing Suite")
    print("NEW Super Admin Devis/Factures SaaS + Client Editor + Familles Enfants")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {}
    
    # Run all tests
    results["A"] = test_a_super_admin_devis_saas()
    results["B"] = test_b_super_admin_factures_saas()
    results["C"] = test_c_security()
    results["D"] = test_d_super_admin_client_edit()
    results["E"] = test_e_familles_enfants_rattaches()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"Test {test_name}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*80)
    if all_passed:
        print("✓✓✓ ALL V9 TESTS PASSED ✓✓✓")
    else:
        print("✗✗✗ SOME V9 TESTS FAILED ✗✗✗")
    print("="*80)
    print(f"Test finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
