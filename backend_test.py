#!/usr/bin/env python3
"""
TiMétis V2 Backend Testing Suite
Tests multi-tenant SaaS architecture with 6 demo accounts
"""

import requests
import json
import random
import string
from datetime import datetime

# Backend URL from .env
BASE_URL = "https://tikreol-demo.preview.emergentagent.com/api"

# Demo accounts
ACCOUNTS = {
    "super_admin": {"email": "jeanchrisoulia@gmail.com", "password": "TiMetis974!"},
    "marie": {"email": "admin@demo.re", "password": "demo1234"},  # 2 crèches
    "sophie": {"email": "admin2@demo.re", "password": "demo1234"},  # 1 crèche
    "pro": {"email": "pro@demo.re", "password": "demo1234"},
    "parent": {"email": "parent@demo.re", "password": "demo1234"},  # Jean Bègue
    "parent2": {"email": "parent2@demo.re", "password": "demo1234"},  # Élodie Técher
}

# Store tokens and user data
tokens = {}
users = {}
creches = {}

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

def test_auth():
    """Test 1: Auth - all 6 demo accounts"""
    print("\n" + "="*80)
    print("TEST 1: AUTH - All 6 demo accounts")
    print("="*80)
    
    results = []
    for key in ACCOUNTS.keys():
        success = login(key)
        results.append(success)
    
    # Verify super_admin
    if users.get("super_admin", {}).get("role") == "super_admin":
        print("✓ Super admin role verified")
        if users["super_admin"].get("creche_ids") == []:
            print("✓ Super admin has empty creche_ids")
        else:
            print(f"✗ Super admin creche_ids should be empty, got: {users['super_admin'].get('creche_ids')}")
    
    # Verify Marie (2 crèches)
    if users.get("marie", {}).get("role") == "admin":
        marie_creches = users["marie"].get("creche_ids", [])
        if len(marie_creches) == 2:
            print(f"✓ Marie has 2 crèches: {marie_creches}")
        else:
            print(f"✗ Marie should have 2 crèches, got {len(marie_creches)}")
    
    # Verify Sophie (1 crèche)
    if users.get("sophie", {}).get("role") == "admin":
        sophie_creches = users["sophie"].get("creche_ids", [])
        if len(sophie_creches) == 1:
            print(f"✓ Sophie has 1 crèche: {sophie_creches}")
        else:
            print(f"✗ Sophie should have 1 crèche, got {len(sophie_creches)}")
    
    # Verify parent/pro have creche_id (not creche_ids)
    if users.get("parent", {}).get("creche_id"):
        print(f"✓ Parent has creche_id: {users['parent'].get('creche_id')}")
    if users.get("pro", {}).get("creche_id"):
        print(f"✓ Pro has creche_id: {users['pro'].get('creche_id')}")
    
    # Test wrong password
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"email": "admin@demo.re", "password": "wrongpass"}, 
                           timeout=10)
        if resp.status_code == 401:
            print("✓ Wrong password returns 401")
        else:
            print(f"✗ Wrong password should return 401, got {resp.status_code}")
    except Exception as e:
        print(f"✗ Wrong password test exception: {e}")
    
    return all(results)

def test_super_admin():
    """Test 2: Super admin endpoints"""
    print("\n" + "="*80)
    print("TEST 2: SUPER ADMIN ENDPOINTS")
    print("="*80)
    
    # GET /super/stats
    try:
        resp = requests.get(f"{BASE_URL}/super/stats", 
                          headers=get_headers("super_admin"), 
                          timeout=10)
        print(f"✓ GET /super/stats: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            stats = data.get("stats", {})
            print(f"  Stats: {json.dumps(stats, indent=2)}")
            
            # Verify counts
            if stats.get("clients") == 2:
                print("  ✓ clients = 2")
            else:
                print(f"  ✗ clients should be 2, got {stats.get('clients')}")
            
            if stats.get("creches") == 3:
                print("  ✓ creches = 3")
            else:
                print(f"  ✗ creches should be 3, got {stats.get('creches')}")
            
            if stats.get("enfants") == 5:
                print("  ✓ enfants = 5")
            else:
                print(f"  ✗ enfants should be 5, got {stats.get('enfants')}")
            
            # MRR should be 79 * active subscriptions (Sophie is active)
            expected_mrr = 79 * stats.get("actifs", 0)
            if stats.get("mrr") == expected_mrr:
                print(f"  ✓ MRR = {stats.get('mrr')} (79 * {stats.get('actifs')} active)")
            else:
                print(f"  ✗ MRR should be {expected_mrr}, got {stats.get('mrr')}")
    except Exception as e:
        print(f"✗ GET /super/stats exception: {e}")
    
    # GET /super/clients
    try:
        resp = requests.get(f"{BASE_URL}/super/clients", 
                          headers=get_headers("super_admin"), 
                          timeout=10)
        print(f"✓ GET /super/clients: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            clients = data.get("clients", [])
            print(f"  Clients count: {len(clients)}")
            
            if len(clients) == 2:
                print("  ✓ 2 clients returned")
                for client in clients:
                    print(f"    - {client.get('prenom')} {client.get('nom')}: {len(client.get('creches', []))} crèches, {client.get('nb_enfants')} enfants")
            else:
                print(f"  ✗ Should have 2 clients, got {len(clients)}")
    except Exception as e:
        print(f"✗ GET /super/clients exception: {e}")
    
    # Test that Marie (admin) CANNOT access super endpoints
    try:
        resp = requests.get(f"{BASE_URL}/super/stats", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie accessing /super/stats: {resp.status_code}")
        
        if resp.status_code in [404, 403]:
            print("  ✓ Marie correctly denied access to super endpoint")
        else:
            print(f"  ✗ Marie should be denied (404/403), got {resp.status_code}")
    except Exception as e:
        print(f"✗ Marie super access test exception: {e}")

def test_multi_tenant_isolation():
    """Test 3: Multi-tenant crèche isolation (CRITICAL)"""
    print("\n" + "="*80)
    print("TEST 3: MULTI-TENANT CRÈCHE ISOLATION (CRITICAL)")
    print("="*80)
    
    # Marie: GET /creches (should return 2)
    try:
        resp = requests.get(f"{BASE_URL}/creches", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /creches: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            marie_creches = data.get("creches", [])
            print(f"  Marie's crèches: {len(marie_creches)}")
            
            if len(marie_creches) == 2:
                print("  ✓ Marie sees exactly 2 crèches")
                for c in marie_creches:
                    if c.get("owner_id") == users["marie"]["id"]:
                        print(f"    ✓ {c.get('nom')} - {c.get('ville')} (owner verified)")
                        creches[f"marie_{c.get('ville')}"] = c.get("id")
                    else:
                        print(f"    ✗ Crèche owner_id mismatch!")
            else:
                print(f"  ✗ Marie should see 2 crèches, got {len(marie_creches)}")
    except Exception as e:
        print(f"✗ Marie GET /creches exception: {e}")
    
    # Sophie: GET /creches (should return 1)
    try:
        resp = requests.get(f"{BASE_URL}/creches", 
                          headers=get_headers("sophie"), 
                          timeout=10)
        print(f"✓ Sophie GET /creches: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            sophie_creches = data.get("creches", [])
            print(f"  Sophie's crèches: {len(sophie_creches)}")
            
            if len(sophie_creches) == 1:
                print("  ✓ Sophie sees exactly 1 crèche")
                creches["sophie"] = sophie_creches[0].get("id")
                print(f"    {sophie_creches[0].get('nom')} - {sophie_creches[0].get('ville')}")
            else:
                print(f"  ✗ Sophie should see 1 crèche, got {len(sophie_creches)}")
    except Exception as e:
        print(f"✗ Sophie GET /creches exception: {e}")
    
    # Marie: GET /enfants for her Saint-Denis crèche
    marie_sd_id = creches.get("marie_Saint-Denis")
    if marie_sd_id:
        try:
            resp = requests.get(f"{BASE_URL}/enfants?creche_id={marie_sd_id}", 
                              headers=get_headers("marie"), 
                              timeout=10)
            print(f"✓ Marie GET /enfants (Saint-Denis): {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                enfants = data.get("enfants", [])
                print(f"  Enfants in Saint-Denis: {len(enfants)}")
                
                if len(enfants) == 5:
                    print("  ✓ Marie sees 5 children in Saint-Denis")
                else:
                    print(f"  ✗ Expected 5 children, got {len(enfants)}")
        except Exception as e:
            print(f"✗ Marie GET /enfants exception: {e}")
    
    # Marie: GET /enfants for Sophie's crèche (should return 0 - RLS check)
    sophie_id = creches.get("sophie")
    if sophie_id:
        try:
            resp = requests.get(f"{BASE_URL}/enfants?creche_id={sophie_id}", 
                              headers=get_headers("marie"), 
                              timeout=10)
            print(f"✓ Marie GET /enfants (Sophie's crèche): {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                enfants = data.get("enfants", [])
                print(f"  Enfants in Sophie's crèche: {len(enfants)}")
                
                if len(enfants) == 0:
                    print("  ✓ CRITICAL: Marie cannot see Sophie's data (RLS working)")
                else:
                    print(f"  ✗ CRITICAL: Marie should NOT see Sophie's children! Got {len(enfants)}")
        except Exception as e:
            print(f"✗ Marie accessing Sophie's data exception: {e}")
    
    # Sophie: GET /enfants (should return 0 - no children seeded)
    try:
        resp = requests.get(f"{BASE_URL}/enfants", 
                          headers=get_headers("sophie"), 
                          timeout=10)
        print(f"✓ Sophie GET /enfants: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            enfants = data.get("enfants", [])
            print(f"  Sophie's enfants: {len(enfants)}")
            
            if len(enfants) == 0:
                print("  ✓ Sophie has 0 children (none seeded)")
            else:
                print(f"  ✗ Sophie should have 0 children, got {len(enfants)}")
    except Exception as e:
        print(f"✗ Sophie GET /enfants exception: {e}")

def test_creche_switcher():
    """Test 4: Crèche switcher (?creche_id=)"""
    print("\n" + "="*80)
    print("TEST 4: CRÈCHE SWITCHER (?creche_id=)")
    print("="*80)
    
    marie_sd_id = creches.get("marie_Saint-Denis")
    marie_sp_id = creches.get("marie_Saint-Paul")
    
    # Marie: dashboard stats for Saint-Denis
    if marie_sd_id:
        try:
            resp = requests.get(f"{BASE_URL}/dashboard/stats?creche_id={marie_sd_id}", 
                              headers=get_headers("marie"), 
                              timeout=10)
            print(f"✓ Marie dashboard/stats (Saint-Denis): {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                stats = data.get("stats", {})
                print(f"  Saint-Denis stats: enfants_total={stats.get('enfants_total')}")
                
                if stats.get("enfants_total") == 5:
                    print("  ✓ Saint-Denis has 5 enfants")
                else:
                    print(f"  ✗ Expected 5 enfants, got {stats.get('enfants_total')}")
        except Exception as e:
            print(f"✗ Marie dashboard Saint-Denis exception: {e}")
    
    # Marie: dashboard stats for Saint-Paul
    if marie_sp_id:
        try:
            resp = requests.get(f"{BASE_URL}/dashboard/stats?creche_id={marie_sp_id}", 
                              headers=get_headers("marie"), 
                              timeout=10)
            print(f"✓ Marie dashboard/stats (Saint-Paul): {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                stats = data.get("stats", {})
                print(f"  Saint-Paul stats: enfants_total={stats.get('enfants_total')}")
                
                if stats.get("enfants_total") == 0:
                    print("  ✓ Saint-Paul has 0 enfants")
                else:
                    print(f"  ✗ Expected 0 enfants, got {stats.get('enfants_total')}")
        except Exception as e:
            print(f"✗ Marie dashboard Saint-Paul exception: {e}")
    
    # Marie: dashboard without ?creche_id (aggregated)
    try:
        resp = requests.get(f"{BASE_URL}/dashboard/stats", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie dashboard/stats (no creche_id): {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            stats = data.get("stats", {})
            print(f"  Aggregated stats: enfants_total={stats.get('enfants_total')}")
    except Exception as e:
        print(f"✗ Marie dashboard aggregated exception: {e}")

def test_crud_operations():
    """Test 5: Enfants, Familles, Groupes, Tags CRUD"""
    print("\n" + "="*80)
    print("TEST 5: ENFANTS, FAMILLES, GROUPES, TAGS CRUD")
    print("="*80)
    
    marie_sd_id = creches.get("marie_Saint-Denis")
    
    # GET /familles
    try:
        resp = requests.get(f"{BASE_URL}/familles", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /familles: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            familles = data.get("familles", [])
            print(f"  Familles count: {len(familles)}")
            
            if len(familles) == 2:
                print("  ✓ Marie has 2 familles (Bègue + Técher)")
            else:
                print(f"  ✗ Expected 2 familles, got {len(familles)}")
    except Exception as e:
        print(f"✗ GET /familles exception: {e}")
    
    # GET /groupes
    try:
        resp = requests.get(f"{BASE_URL}/groupes", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /groupes: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            groupes = data.get("groupes", [])
            print(f"  Groupes count: {len(groupes)}")
            
            if len(groupes) == 3:
                print("  ✓ Marie has 3 groupes (Tournesol, Coquelicot, Marguerite)")
            else:
                print(f"  ✗ Expected 3 groupes, got {len(groupes)}")
    except Exception as e:
        print(f"✗ GET /groupes exception: {e}")
    
    # GET /tags
    try:
        resp = requests.get(f"{BASE_URL}/tags", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /tags: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            tags = data.get("tags", [])
            print(f"  Tags count: {len(tags)}")
            
            if len(tags) == 6:
                print("  ✓ Marie has 6 tags")
            else:
                print(f"  ✗ Expected 6 tags, got {len(tags)}")
    except Exception as e:
        print(f"✗ GET /tags exception: {e}")
    
    # POST /groupes
    if marie_sd_id:
        try:
            resp = requests.post(f"{BASE_URL}/groupes", 
                               headers=get_headers("marie"),
                               json={
                                   "nom": "Test Groupe",
                                   "couleur": "#FF0000",
                                   "capacite": 5,
                                   "creche_id": marie_sd_id
                               },
                               timeout=10)
            print(f"✓ Marie POST /groupes: {resp.status_code}")
            
            if resp.status_code == 200:
                print("  ✓ Groupe created successfully")
            else:
                print(f"  ✗ Failed to create groupe: {resp.text}")
        except Exception as e:
            print(f"✗ POST /groupes exception: {e}")
    
    # POST /tags
    if marie_sd_id:
        try:
            resp = requests.post(f"{BASE_URL}/tags", 
                               headers=get_headers("marie"),
                               json={
                                   "nom": "TestTag",
                                   "couleur": "#00FF00",
                                   "creche_id": marie_sd_id
                               },
                               timeout=10)
            print(f"✓ Marie POST /tags: {resp.status_code}")
            
            if resp.status_code == 200:
                print("  ✓ Tag created successfully")
            else:
                print(f"  ✗ Failed to create tag: {resp.text}")
        except Exception as e:
            print(f"✗ POST /tags exception: {e}")

def test_devis():
    """Test 6: Devis"""
    print("\n" + "="*80)
    print("TEST 6: DEVIS")
    print("="*80)
    
    # GET /devis
    try:
        resp = requests.get(f"{BASE_URL}/devis", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /devis: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            devis_list = data.get("devis", [])
            print(f"  Devis count: {len(devis_list)}")
            
            if len(devis_list) >= 1:
                devis = devis_list[0]
                print(f"  ✓ Found devis: {devis.get('numero')} - {devis.get('famille')}")
                print(f"    Statut: {devis.get('statut')}, Total TTC: {devis.get('total_ttc')}")
                
                if devis.get("numero") == "D-2401" and devis.get("total_ttc") == 730:
                    print("  ✓ Seeded devis verified (D-2401, 730€)")
    except Exception as e:
        print(f"✗ GET /devis exception: {e}")
    
    # POST /devis
    marie_sd_id = creches.get("marie_Saint-Denis")
    if marie_sd_id:
        try:
            resp = requests.post(f"{BASE_URL}/devis", 
                               headers=get_headers("marie"),
                               json={
                                   "famille": "Famille Test",
                                   "articles": [
                                       {
                                           "description": "Test Article",
                                           "quantite": 2,
                                           "prix_unit": 100,
                                           "tva": 0
                                       }
                                   ],
                                   "creche_id": marie_sd_id
                               },
                               timeout=10)
            print(f"✓ Marie POST /devis: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                devis = data.get("devis", {})
                print(f"  ✓ Devis created: {devis.get('numero')}")
                print(f"    Total HT: {devis.get('total_ht')}, Total TTC: {devis.get('total_ttc')}")
                
                if devis.get("total_ht") == 200 and devis.get("total_ttc") == 200:
                    print("  ✓ Totals calculated correctly (200€)")
                else:
                    print(f"  ✗ Expected totals 200, got HT={devis.get('total_ht')}, TTC={devis.get('total_ttc')}")
                
                # Test PUT /devis/:id
                devis_id = devis.get("id")
                if devis_id:
                    try:
                        resp = requests.put(f"{BASE_URL}/devis/{devis_id}", 
                                          headers=get_headers("marie"),
                                          json={
                                              "articles": [
                                                  {
                                                      "description": "Updated Article",
                                                      "quantite": 3,
                                                      "prix_unit": 150,
                                                      "tva": 0
                                                  }
                                              ]
                                          },
                                          timeout=10)
                        print(f"✓ Marie PUT /devis/{devis_id}: {resp.status_code}")
                        
                        if resp.status_code == 200:
                            print("  ✓ Devis updated successfully (totals should be recalculated)")
                    except Exception as e:
                        print(f"✗ PUT /devis exception: {e}")
        except Exception as e:
            print(f"✗ POST /devis exception: {e}")

def test_factures():
    """Test 7: Factures extended"""
    print("\n" + "="*80)
    print("TEST 7: FACTURES EXTENDED")
    print("="*80)
    
    # Marie: GET /factures
    try:
        resp = requests.get(f"{BASE_URL}/factures", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /factures: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            factures = data.get("factures", [])
            print(f"  Factures count: {len(factures)}")
            
            if len(factures) == 5:
                print("  ✓ Marie has 5 factures")
                # Check first facture structure
                if factures:
                    f = factures[0]
                    if f.get("numero", "").startswith("F-"):
                        print(f"  ✓ Facture numero format correct: {f.get('numero')}")
                    if "articles" in f:
                        print(f"  ✓ Facture has articles array")
            else:
                print(f"  ✗ Expected 5 factures, got {len(factures)}")
    except Exception as e:
        print(f"✗ Marie GET /factures exception: {e}")
    
    # Parent: GET /factures (should only see their children's invoices)
    try:
        resp = requests.get(f"{BASE_URL}/factures", 
                          headers=get_headers("parent"), 
                          timeout=10)
        print(f"✓ Parent GET /factures: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            factures = data.get("factures", [])
            print(f"  Parent's factures: {len(factures)}")
            
            if len(factures) == 2:
                print("  ✓ Parent sees 2 factures (Lucas + Noah)")
            else:
                print(f"  ✗ Expected 2 factures for parent, got {len(factures)}")
    except Exception as e:
        print(f"✗ Parent GET /factures exception: {e}")
    
    # Marie: POST /factures
    marie_sd_id = creches.get("marie_Saint-Denis")
    if marie_sd_id:
        try:
            resp = requests.post(f"{BASE_URL}/factures", 
                               headers=get_headers("marie"),
                               json={
                                   "famille": "Famille Test Facture",
                                   "articles": [
                                       {
                                           "description": "Test Service",
                                           "quantite": 1,
                                           "prix_unit": 500,
                                           "tva": 0
                                       }
                                   ],
                                   "creche_id": marie_sd_id
                               },
                               timeout=10)
            print(f"✓ Marie POST /factures: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                facture = data.get("facture", {})
                facture_id = facture.get("id")
                print(f"  ✓ Facture created: {facture.get('numero')}")
                print(f"    Total HT: {facture.get('total_ht')}, Total TTC: {facture.get('total_ttc')}")
                
                # Test POST /factures/:id/send
                if facture_id:
                    try:
                        resp = requests.post(f"{BASE_URL}/factures/{facture_id}/send", 
                                           headers=get_headers("marie"),
                                           timeout=10)
                        print(f"✓ Marie POST /factures/{facture_id}/send: {resp.status_code}")
                        
                        if resp.status_code == 200:
                            print("  ✓ Facture marked as sent")
                    except Exception as e:
                        print(f"✗ POST /factures/send exception: {e}")
                    
                    # Test POST /factures/:id/pay
                    try:
                        resp = requests.post(f"{BASE_URL}/factures/{facture_id}/pay", 
                                           headers=get_headers("marie"),
                                           timeout=10)
                        print(f"✓ Marie POST /factures/{facture_id}/pay: {resp.status_code}")
                        
                        if resp.status_code == 200:
                            print("  ✓ Facture marked as paid")
                    except Exception as e:
                        print(f"✗ POST /factures/pay exception: {e}")
        except Exception as e:
            print(f"✗ POST /factures exception: {e}")

def test_threads():
    """Test 8: Threads Pro↔Parent 1-to-1"""
    print("\n" + "="*80)
    print("TEST 8: THREADS PRO↔PARENT 1-TO-1")
    print("="*80)
    
    # Pro: GET /threads
    try:
        resp = requests.get(f"{BASE_URL}/threads", 
                          headers=get_headers("pro"), 
                          timeout=10)
        print(f"✓ Pro GET /threads: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            threads = data.get("threads", [])
            print(f"  Pro's threads: {len(threads)}")
            
            if len(threads) >= 1:
                print("  ✓ Pro has at least 1 thread")
                thread = threads[0]
                thread_id = thread.get("id")
                print(f"    Thread with: {thread.get('others', [])}")
                print(f"    Enfant: {thread.get('enfant', {}).get('prenom')}")
                
                if "others" in thread and "enfant" in thread:
                    print("  ✓ Thread has 'others' array and 'enfant' object")
                
                # GET /threads/:id/messages
                if thread_id:
                    try:
                        resp = requests.get(f"{BASE_URL}/threads/{thread_id}/messages", 
                                          headers=get_headers("pro"), 
                                          timeout=10)
                        print(f"✓ Pro GET /threads/{thread_id}/messages: {resp.status_code}")
                        
                        if resp.status_code == 200:
                            data = resp.json()
                            messages = data.get("messages", [])
                            print(f"  Messages count: {len(messages)}")
                            
                            if len(messages) == 2:
                                print("  ✓ Thread has 2 seeded messages")
                            
                            # POST /threads/:id/messages
                            try:
                                resp = requests.post(f"{BASE_URL}/threads/{thread_id}/messages", 
                                                   headers=get_headers("pro"),
                                                   json={"contenu": "Test message from pro"},
                                                   timeout=10)
                                print(f"✓ Pro POST /threads/{thread_id}/messages: {resp.status_code}")
                                
                                if resp.status_code == 200:
                                    print("  ✓ Message posted successfully")
                                    
                                    # Verify message count increased
                                    resp = requests.get(f"{BASE_URL}/threads/{thread_id}/messages", 
                                                      headers=get_headers("pro"), 
                                                      timeout=10)
                                    if resp.status_code == 200:
                                        new_messages = resp.json().get("messages", [])
                                        if len(new_messages) == 3:
                                            print("  ✓ Message count increased to 3")
                            except Exception as e:
                                print(f"✗ POST message exception: {e}")
                            
                            # POST message with media
                            try:
                                resp = requests.post(f"{BASE_URL}/threads/{thread_id}/messages", 
                                                   headers=get_headers("pro"),
                                                   json={
                                                       "contenu": "Message with media",
                                                       "media": "https://cloudinary.example/img.jpg",
                                                       "media_type": "image"
                                                   },
                                                   timeout=10)
                                print(f"✓ Pro POST message with media: {resp.status_code}")
                                
                                if resp.status_code == 200:
                                    print("  ✓ Message with media posted successfully")
                            except Exception as e:
                                print(f"✗ POST message with media exception: {e}")
                    except Exception as e:
                        print(f"✗ GET messages exception: {e}")
    except Exception as e:
        print(f"✗ GET /threads exception: {e}")
    
    # Pro: POST /threads (create new thread)
    try:
        # Get parent2 id and an enfant
        parent2_id = users.get("parent2", {}).get("id")
        
        # Get enfants to find Emma (parent2's child)
        resp = requests.get(f"{BASE_URL}/enfants", 
                          headers=get_headers("marie"), 
                          timeout=10)
        if resp.status_code == 200:
            enfants = resp.json().get("enfants", [])
            emma = next((e for e in enfants if e.get("prenom") == "Emma"), None)
            
            if emma and parent2_id:
                try:
                    resp = requests.post(f"{BASE_URL}/threads", 
                                       headers=get_headers("pro"),
                                       json={
                                           "parent_id": parent2_id,
                                           "enfant_id": emma.get("id")
                                       },
                                       timeout=10)
                    print(f"✓ Pro POST /threads (new): {resp.status_code}")
                    
                    if resp.status_code == 200:
                        print("  ✓ New thread created (or existing returned)")
                except Exception as e:
                    print(f"✗ POST /threads exception: {e}")
    except Exception as e:
        print(f"✗ Create thread test exception: {e}")

def test_other_modules():
    """Test 9: Nourriture / Rappels / News / Documents / Feedbacks / Alarme"""
    print("\n" + "="*80)
    print("TEST 9: OTHER MODULES")
    print("="*80)
    
    marie_sd_id = creches.get("marie_Saint-Denis")
    
    # GET /nourriture
    try:
        resp = requests.get(f"{BASE_URL}/nourriture", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /nourriture: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            menus = data.get("menus", [])
            print(f"  Menus count: {len(menus)}")
            
            if len(menus) >= 1:
                menu = menus[0]
                repas = menu.get("repas", [])
                print(f"  ✓ Menu has {len(repas)} jours")
                
                if len(repas) == 5:
                    print("  ✓ Menu has 5 days (Lundi-Vendredi)")
    except Exception as e:
        print(f"✗ GET /nourriture exception: {e}")
    
    # GET /rappels
    try:
        resp = requests.get(f"{BASE_URL}/rappels", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /rappels: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            rappels = data.get("rappels", [])
            print(f"  Rappels count: {len(rappels)}")
            
            if len(rappels) == 3:
                print("  ✓ Marie has 3 rappels")
    except Exception as e:
        print(f"✗ GET /rappels exception: {e}")
    
    # POST /rappels
    if marie_sd_id:
        try:
            resp = requests.post(f"{BASE_URL}/rappels", 
                               headers=get_headers("marie"),
                               json={
                                   "titre": "Test Rappel",
                                   "echeance": "2025-01-01",
                                   "priorite": "haute",
                                   "creche_id": marie_sd_id
                               },
                               timeout=10)
            print(f"✓ Marie POST /rappels: {resp.status_code}")
            
            if resp.status_code == 200:
                print("  ✓ Rappel created successfully")
        except Exception as e:
            print(f"✗ POST /rappels exception: {e}")
    
    # GET /news
    try:
        resp = requests.get(f"{BASE_URL}/news", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /news: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            news = data.get("news", [])
            print(f"  News count: {len(news)}")
            
            if len(news) == 2:
                print("  ✓ Marie has 2 news")
                # Check if first is pinned
                if news[0].get("pinned"):
                    print("  ✓ First news is pinned (correct order)")
    except Exception as e:
        print(f"✗ GET /news exception: {e}")
    
    # GET /documents
    try:
        resp = requests.get(f"{BASE_URL}/documents", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /documents: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            documents = data.get("documents", [])
            print(f"  Documents count: {len(documents)}")
            
            if len(documents) == 2:
                print("  ✓ Marie has 2 documents")
    except Exception as e:
        print(f"✗ GET /documents exception: {e}")
    
    # POST /feedbacks (as parent)
    try:
        resp = requests.post(f"{BASE_URL}/feedbacks", 
                           headers=get_headers("parent"),
                           json={
                               "rating": 5,
                               "message": "Super app!",
                               "category": "compliment"
                           },
                           timeout=10)
        print(f"✓ Parent POST /feedbacks: {resp.status_code}")
        
        if resp.status_code == 200:
            print("  ✓ Feedback created successfully")
    except Exception as e:
        print(f"✗ POST /feedbacks exception: {e}")
    
    # GET /feedbacks (as super_admin)
    try:
        resp = requests.get(f"{BASE_URL}/feedbacks", 
                          headers=get_headers("super_admin"), 
                          timeout=10)
        print(f"✓ Super admin GET /feedbacks: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            feedbacks = data.get("feedbacks", [])
            print(f"  Feedbacks count: {len(feedbacks)}")
            
            if len(feedbacks) >= 1:
                print("  ✓ Super admin can see feedbacks")
    except Exception as e:
        print(f"✗ Super admin GET /feedbacks exception: {e}")
    
    # GET /feedbacks (as parent - should fail)
    try:
        resp = requests.get(f"{BASE_URL}/feedbacks", 
                          headers=get_headers("parent"), 
                          timeout=10)
        print(f"✓ Parent GET /feedbacks: {resp.status_code}")
        
        if resp.status_code in [404, 403]:
            print("  ✓ Parent correctly denied access to feedbacks list")
        else:
            print(f"  ✗ Parent should be denied, got {resp.status_code}")
    except Exception as e:
        print(f"✗ Parent GET /feedbacks exception: {e}")
    
    # GET /alarme/evacuation
    if marie_sd_id:
        try:
            resp = requests.get(f"{BASE_URL}/alarme/evacuation?creche_id={marie_sd_id}", 
                              headers=get_headers("marie"), 
                              timeout=10)
            print(f"✓ Marie GET /alarme/evacuation: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                print(f"  Creche: {data.get('creche', {}).get('nom')}")
                print(f"  Date: {data.get('date')}")
                print(f"  Enfants présents: {len(data.get('enfants_presents', []))}")
                print(f"  Employés présents: {len(data.get('employes_presents', []))}")
                
                # Should have Lucas + Noah (they have 'arrivee' transmissions)
                enfants_presents = data.get('enfants_presents', [])
                if len(enfants_presents) >= 2:
                    print("  ✓ Enfants with 'arrivee' transmissions listed")
                
                # Should have 2 pros (Aurélie + Sandra with pointages)
                employes_presents = data.get('employes_presents', [])
                if len(employes_presents) == 2:
                    print("  ✓ 2 employés with pointages listed")
        except Exception as e:
            print(f"✗ GET /alarme/evacuation exception: {e}")

def test_stripe_fallback():
    """Test 10: Stripe fallback mode"""
    print("\n" + "="*80)
    print("TEST 10: STRIPE FALLBACK MODE")
    print("="*80)
    
    # GET /stripe/status
    try:
        resp = requests.get(f"{BASE_URL}/stripe/status", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /stripe/status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            configured = data.get("configured")
            subscription = data.get("subscription")
            
            print(f"  Configured: {configured}")
            print(f"  Subscription: {subscription}")
            
            if configured == False:
                print("  ✓ Stripe not configured (fallback mode)")
    except Exception as e:
        print(f"✗ GET /stripe/status exception: {e}")
    
    # POST /stripe/checkout (should activate in demo mode)
    try:
        resp = requests.post(f"{BASE_URL}/stripe/checkout", 
                           headers=get_headers("marie"),
                           json={},
                           timeout=10)
        print(f"✓ Marie POST /stripe/checkout: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            
            if data.get("demo_mode"):
                print("  ✓ Demo mode activated (Stripe keys empty)")
                print(f"  Message: {data.get('message')}")
                
                # Verify subscription updated
                resp = requests.get(f"{BASE_URL}/stripe/status", 
                                  headers=get_headers("marie"), 
                                  timeout=10)
                if resp.status_code == 200:
                    sub = resp.json().get("subscription", {})
                    if sub.get("status") == "active":
                        print("  ✓ Marie's subscription now active")
    except Exception as e:
        print(f"✗ POST /stripe/checkout exception: {e}")

def test_cloudinary_fallback():
    """Test 11: Cloudinary fallback mode"""
    print("\n" + "="*80)
    print("TEST 11: CLOUDINARY FALLBACK MODE")
    print("="*80)
    
    # POST /media/sign
    try:
        resp = requests.post(f"{BASE_URL}/media/sign", 
                           headers=get_headers("marie"),
                           json={"folder": "test"},
                           timeout=10)
        print(f"✓ Marie POST /media/sign: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            
            if data.get("configured") == False:
                print("  ✓ Cloudinary not configured (fallback mode)")
                print(f"  Error: {data.get('error')}")
    except Exception as e:
        print(f"✗ POST /media/sign exception: {e}")

def test_employes_parents():
    """Test 12: Employes + Parents"""
    print("\n" + "="*80)
    print("TEST 12: EMPLOYES + PARENTS")
    print("="*80)
    
    marie_sd_id = creches.get("marie_Saint-Denis")
    
    # GET /employes
    try:
        resp = requests.get(f"{BASE_URL}/employes", 
                          headers=get_headers("marie"), 
                          timeout=10)
        print(f"✓ Marie GET /employes: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            employes = data.get("employes", [])
            print(f"  Employes count: {len(employes)}")
            
            if len(employes) == 2:
                print("  ✓ Marie has 2 employes (pros)")
    except Exception as e:
        print(f"✗ GET /employes exception: {e}")
    
    # GET /parents (as pro)
    try:
        resp = requests.get(f"{BASE_URL}/parents", 
                          headers=get_headers("pro"), 
                          timeout=10)
        print(f"✓ Pro GET /parents: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            parents = data.get("parents", [])
            print(f"  Parents count: {len(parents)}")
            
            if len(parents) >= 2:
                print("  ✓ Pro can see parents list with their children")
                for p in parents[:2]:
                    print(f"    - {p.get('prenom')} {p.get('nom')}: {len(p.get('enfants', []))} enfants")
    except Exception as e:
        print(f"✗ Pro GET /parents exception: {e}")
    
    # POST /employes
    if marie_sd_id:
        rand_email = f"newpro{random.randint(1000,9999)}@demo.re"
        try:
            resp = requests.post(f"{BASE_URL}/employes", 
                               headers=get_headers("marie"),
                               json={
                                   "email": rand_email,
                                   "password": "test123",
                                   "prenom": "Test",
                                   "nom": "Pro",
                                   "creche_id": marie_sd_id
                               },
                               timeout=10)
            print(f"✓ Marie POST /employes: {resp.status_code}")
            
            if resp.status_code == 200:
                print(f"  ✓ New employe created: {rand_email}")
        except Exception as e:
            print(f"✗ POST /employes exception: {e}")

def test_register_admin():
    """Test 13: Register new admin"""
    print("\n" + "="*80)
    print("TEST 13: REGISTER NEW ADMIN")
    print("="*80)
    
    # Generate random email
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    new_email = f"newadmin{rand}@test.re"
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", 
                           json={
                               "email": new_email,
                               "password": "test123",
                               "prenom": "New",
                               "nom": "Admin",
                               "role": "admin",
                               "creche_nom": "Nouvelle Crèche",
                               "creche_ville": "Le Tampon"
                           },
                           timeout=10)
        print(f"✓ POST /auth/register (new admin): {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            user = data.get("user")
            
            print(f"  ✓ New admin registered: {new_email}")
            print(f"  User: {user.get('prenom')} {user.get('nom')}")
            print(f"  Creche IDs: {user.get('creche_ids')}")
            
            if len(user.get("creche_ids", [])) == 1:
                print("  ✓ New admin has 1 crèche")
                
                # Verify the crèche is owned by this admin
                headers = {"Authorization": f"Bearer {token}"}
                resp = requests.get(f"{BASE_URL}/creches", headers=headers, timeout=10)
                if resp.status_code == 200:
                    creches_data = resp.json().get("creches", [])
                    if len(creches_data) == 1:
                        creche = creches_data[0]
                        if creche.get("owner_id") == user.get("id"):
                            print(f"  ✓ Crèche '{creche.get('nom')}' owned by new admin")
        else:
            print(f"  ✗ Registration failed: {resp.text}")
    except Exception as e:
        print(f"✗ POST /auth/register exception: {e}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("TiMétis V2 Backend Testing Suite")
    print("Multi-tenant SaaS Architecture")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    test_auth()
    test_super_admin()
    test_multi_tenant_isolation()
    test_creche_switcher()
    test_crud_operations()
    test_devis()
    test_factures()
    test_threads()
    test_other_modules()
    test_stripe_fallback()
    test_cloudinary_fallback()
    test_employes_parents()
    test_register_admin()
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETED")
    print("="*80)
    print(f"Test finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
