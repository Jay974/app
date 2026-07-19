#!/usr/bin/env python3
"""
TiMétis V10 Backend Testing Suite
Tests NEW V10 features ONLY (do NOT retest V2/V9/V9.1)
"""

import requests
import json
from datetime import datetime

# Backend URL from .env
BASE_URL = "https://tikreol-demo.preview.emergentagent.com/api"

# Demo accounts
ACCOUNTS = {
    "marie": {"email": "admin@demo.re", "password": "demo1234"},  # Admin with 2 crèches
    "pro": {"email": "pro@demo.re", "password": "demo1234"},  # Pro Aurélie
    "parent": {"email": "parent@demo.re", "password": "demo1234"},  # Parent Jean
}

# Store tokens and user data
tokens = {}
users = {}
test_resources = {
    "employe_id": None,
    "devis_ids": [],
    "facture_ids": [],
    "tag_id": None,
    "rappel_id": None,
    "news_id": None,
    "enfant_id": None,
}

def login(account_key):
    """Login and store token"""
    try:
        account = ACCOUNTS[account_key]
        resp = requests.post(f"{BASE_URL}/auth/login", json=account, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            tokens[account_key] = data.get("token")
            users[account_key] = data.get("user")
            print(f"✓ Login {account_key}: {users[account_key].get('prenom')} {users[account_key].get('nom')}")
            return True
        else:
            print(f"✗ Login {account_key} FAILED: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"✗ Login {account_key} EXCEPTION: {e}")
        return False

def get_headers(account_key):
    """Get auth headers for account"""
    return {"Authorization": f"Bearer {tokens[account_key]}"}

def test_a_delete_employe():
    """Test A: DELETE /api/employes/:id (V10)"""
    print("\n" + "="*80)
    print("TEST A: DELETE /api/employes/:id (V10)")
    print("="*80)
    
    try:
        # A1: Login as admin
        if not login("marie"):
            print("✗ A1 FAILED: Cannot login as admin")
            return False
        print("✓ A1: Admin login successful")
        
        # A2: Create new employé
        creche_id = users["marie"]["creche_ids"][0]
        new_employe = {
            "prenom": "Test",
            "nom": "Delete",
            "email": "testdel@x.re",
            "password": "test1234",
            "creche_id": creche_id
        }
        
        resp = requests.post(f"{BASE_URL}/employes", 
                           headers=get_headers("marie"),
                           json=new_employe,
                           timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ A2 FAILED: Cannot create employé - {resp.status_code} - {resp.text}")
            return False
        
        employe_data = resp.json().get("employe", {})
        employe_id = employe_data.get("id")
        test_resources["employe_id"] = employe_id
        print(f"✓ A2: Created employé Test Delete (id: {employe_id})")
        
        # A3: DELETE /api/employes/:id
        resp = requests.delete(f"{BASE_URL}/employes/{employe_id}", 
                             headers=get_headers("marie"),
                             timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ A3 FAILED: DELETE returned {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if data.get("ok") != True:
            print(f"✗ A3 FAILED: Expected {{ok: true}}, got {data}")
            return False
        
        print(f"✓ A3: DELETE /api/employes/{employe_id} returned {{ok: true}}")
        
        # A4: Verify employé is gone
        resp = requests.get(f"{BASE_URL}/employes", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ A4 FAILED: GET /employes returned {resp.status_code}")
            return False
        
        employes = resp.json().get("employes", [])
        if any(e.get("id") == employe_id for e in employes):
            print(f"✗ A4 FAILED: Employé still exists in list")
            return False
        
        print(f"✓ A4: Verified employé is deleted from list")
        
        # A5: Try DELETE as pro role (should fail)
        if not login("pro"):
            print("✗ A5 FAILED: Cannot login as pro")
            return False
        
        # Create another employé to test pro deletion
        resp = requests.post(f"{BASE_URL}/employes", 
                           headers=get_headers("marie"),
                           json={
                               "prenom": "Test2",
                               "nom": "Delete2",
                               "email": "testdel2@x.re",
                               "password": "test1234",
                               "creche_id": creche_id
                           },
                           timeout=10)
        
        if resp.status_code == 200:
            employe2_id = resp.json().get("employe", {}).get("id")
            
            # Try to delete as pro
            resp = requests.delete(f"{BASE_URL}/employes/{employe2_id}", 
                                 headers=get_headers("pro"),
                                 timeout=10)
            
            if resp.status_code in [404, 403]:
                print(f"✓ A5: Pro DELETE correctly denied ({resp.status_code})")
            else:
                print(f"✗ A5 FAILED: Pro should be denied, got {resp.status_code}")
                return False
            
            # Cleanup: delete as admin
            requests.delete(f"{BASE_URL}/employes/{employe2_id}", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        print("✓ TEST A PASSED: DELETE /employes/:id working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST A EXCEPTION: {e}")
        return False

def test_b_devis_status_delete():
    """Test B: DEVIS status & delete (V10)"""
    print("\n" + "="*80)
    print("TEST B: DEVIS status & delete (V10)")
    print("="*80)
    
    try:
        # B1: Login admin
        if not login("marie"):
            print("✗ B1 FAILED: Cannot login as admin")
            return False
        print("✓ B1: Admin login successful")
        
        # B2: Get a famille_id
        resp = requests.get(f"{BASE_URL}/familles", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ B2 FAILED: Cannot get familles - {resp.status_code}")
            return False
        
        familles = resp.json().get("familles", [])
        if not familles:
            print("✗ B2 FAILED: No familles found")
            return False
        
        famille_id = familles[0].get("id")
        print(f"✓ B2: Got famille_id: {famille_id}")
        
        # B3: POST /api/devis
        creche_id = users["marie"]["creche_ids"][0]
        new_devis = {
            "famille_id": famille_id,
            "articles": [
                {
                    "description": "test",
                    "quantite": 1,
                    "prix_unit": 100,
                    "tva": 0
                }
            ],
            "statut": "en_cours",
            "date_debut": "2026-07-01",
            "valide_jusqu": "2026-07-31",
            "creche_id": creche_id
        }
        
        resp = requests.post(f"{BASE_URL}/devis", 
                           headers=get_headers("marie"),
                           json=new_devis,
                           timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ B3 FAILED: Cannot create devis - {resp.status_code} - {resp.text}")
            return False
        
        devis_data = resp.json().get("devis", {})
        devis_id = devis_data.get("id")
        test_resources["devis_ids"].append(devis_id)
        print(f"✓ B3: Created devis (id: {devis_id}, statut: {devis_data.get('statut')})")
        
        # B4: PUT /api/devis/:id with statut='en_attente'
        resp = requests.put(f"{BASE_URL}/devis/{devis_id}", 
                          headers=get_headers("marie"),
                          json={"statut": "en_attente"},
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ B4 FAILED: PUT devis returned {resp.status_code} - {resp.text}")
            return False
        
        print(f"✓ B4: PUT /api/devis/{devis_id} with statut='en_attente' returned 200")
        
        # B5: GET /api/devis and verify statut
        resp = requests.get(f"{BASE_URL}/devis", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ B5 FAILED: GET devis returned {resp.status_code}")
            return False
        
        devis_list = resp.json().get("devis", [])
        found_devis = next((d for d in devis_list if d.get("id") == devis_id), None)
        
        if not found_devis:
            print(f"✗ B5 FAILED: Devis not found in list")
            return False
        
        if found_devis.get("statut") != "en_attente":
            print(f"✗ B5 FAILED: Expected statut='en_attente', got '{found_devis.get('statut')}'")
            return False
        
        print(f"✓ B5: Verified devis statut='en_attente'")
        
        # B6: PUT /api/devis/:id with statut='envoye'
        resp = requests.put(f"{BASE_URL}/devis/{devis_id}", 
                          headers=get_headers("marie"),
                          json={"statut": "envoye"},
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ B6 FAILED: PUT devis statut='envoye' returned {resp.status_code}")
            return False
        
        print(f"✓ B6: PUT /api/devis/{devis_id} with statut='envoye' returned 200")
        
        # B7: DELETE /api/devis/:id
        resp = requests.delete(f"{BASE_URL}/devis/{devis_id}", 
                             headers=get_headers("marie"),
                             timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ B7 FAILED: DELETE devis returned {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if data.get("ok") != True:
            print(f"✗ B7 FAILED: Expected {{ok: true}}, got {data}")
            return False
        
        print(f"✓ B7: DELETE /api/devis/{devis_id} returned {{ok: true}}")
        
        # B8: Verify devis is gone
        resp = requests.get(f"{BASE_URL}/devis", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code == 200:
            devis_list = resp.json().get("devis", [])
            if any(d.get("id") == devis_id for d in devis_list):
                print(f"✗ B8 FAILED: Devis still exists in list")
                return False
            
            print(f"✓ B8: Verified devis is deleted")
        
        print("✓ TEST B PASSED: DEVIS status & delete working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST B EXCEPTION: {e}")
        return False

def test_c_factures_status_delete():
    """Test C: FACTURES status & delete (V10)"""
    print("\n" + "="*80)
    print("TEST C: FACTURES status & delete (V10)")
    print("="*80)
    
    try:
        # C1: Login admin
        if not login("marie"):
            print("✗ C1 FAILED: Cannot login as admin")
            return False
        print("✓ C1: Admin login successful")
        
        # C2: Get a famille_id
        resp = requests.get(f"{BASE_URL}/familles", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ C2 FAILED: Cannot get familles")
            return False
        
        familles = resp.json().get("familles", [])
        if not familles:
            print("✗ C2 FAILED: No familles found")
            return False
        
        famille_id = familles[0].get("id")
        print(f"✓ C2: Got famille_id: {famille_id}")
        
        # C3: POST /api/factures
        creche_id = users["marie"]["creche_ids"][0]
        new_facture = {
            "famille_id": famille_id,
            "articles": [
                {
                    "description": "facture test",
                    "quantite": 1,
                    "prix_unit": 200,
                    "tva": 0
                }
            ],
            "statut": "en_cours",
            "echeance": "2026-08-01",
            "creche_id": creche_id
        }
        
        resp = requests.post(f"{BASE_URL}/factures", 
                           headers=get_headers("marie"),
                           json=new_facture,
                           timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ C3 FAILED: Cannot create facture - {resp.status_code} - {resp.text}")
            return False
        
        facture_data = resp.json().get("facture", {})
        facture_id = facture_data.get("id")
        test_resources["facture_ids"].append(facture_id)
        print(f"✓ C3: Created facture (id: {facture_id})")
        
        # C4: PUT /api/factures/:id with statut='en_attente'
        resp = requests.put(f"{BASE_URL}/factures/{facture_id}", 
                          headers=get_headers("marie"),
                          json={"statut": "en_attente"},
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ C4 FAILED: PUT facture returned {resp.status_code} - {resp.text}")
            return False
        
        print(f"✓ C4: PUT /api/factures/{facture_id} with statut='en_attente' returned 200")
        
        # C5: PUT /api/factures/:id with statut='payee'
        resp = requests.put(f"{BASE_URL}/factures/{facture_id}", 
                          headers=get_headers("marie"),
                          json={"statut": "payee"},
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ C5 FAILED: PUT facture statut='payee' returned {resp.status_code}")
            return False
        
        print(f"✓ C5: PUT /api/factures/{facture_id} with statut='payee' returned 200")
        
        # C6: DELETE /api/factures/:id
        resp = requests.delete(f"{BASE_URL}/factures/{facture_id}", 
                             headers=get_headers("marie"),
                             timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ C6 FAILED: DELETE facture returned {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if data.get("ok") != True:
            print(f"✗ C6 FAILED: Expected {{ok: true}}, got {data}")
            return False
        
        print(f"✓ C6: DELETE /api/factures/{facture_id} returned {{ok: true}}")
        
        print("✓ TEST C PASSED: FACTURES status & delete working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST C EXCEPTION: {e}")
        return False

def test_d_tags_crud():
    """Test D: TAGS CRUD (V10)"""
    print("\n" + "="*80)
    print("TEST D: TAGS CRUD (V10)")
    print("="*80)
    
    try:
        # D1: Login admin
        if not login("marie"):
            print("✗ D1 FAILED: Cannot login as admin")
            return False
        print("✓ D1: Admin login successful")
        
        # D2: POST /api/tags
        creche_id = users["marie"]["creche_ids"][0]
        new_tag = {
            "nom": "Test-tag",
            "couleur": "#FF6B6B",
            "categorie": "Allergies",
            "creche_id": creche_id
        }
        
        resp = requests.post(f"{BASE_URL}/tags", 
                           headers=get_headers("marie"),
                           json=new_tag,
                           timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ D2 FAILED: Cannot create tag - {resp.status_code} - {resp.text}")
            return False
        
        tag_data = resp.json().get("tag", {})
        tag_id = tag_data.get("id")
        test_resources["tag_id"] = tag_id
        print(f"✓ D2: Created tag 'Test-tag' (id: {tag_id})")
        
        # D3: PUT /api/tags/:id
        resp = requests.put(f"{BASE_URL}/tags/{tag_id}", 
                          headers=get_headers("marie"),
                          json={
                              "nom": "Test-tag-renamed",
                              "categorie": "Régime alimentaire"
                          },
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ D3 FAILED: PUT tag returned {resp.status_code} - {resp.text}")
            return False
        
        updated_tag = resp.json().get("tag", {})
        if updated_tag.get("nom") != "Test-tag-renamed":
            print(f"✗ D3 FAILED: Tag name not updated, got '{updated_tag.get('nom')}'")
            return False
        
        print(f"✓ D3: PUT /api/tags/{tag_id} updated name to 'Test-tag-renamed'")
        
        # D4: Get an enfant and add tag
        resp = requests.get(f"{BASE_URL}/enfants", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ D4 FAILED: Cannot get enfants")
            return False
        
        enfants = resp.json().get("enfants", [])
        if not enfants:
            print("✗ D4 FAILED: No enfants found")
            return False
        
        enfant_id = enfants[0].get("id")
        test_resources["enfant_id"] = enfant_id
        
        # Add tag to enfant
        resp = requests.put(f"{BASE_URL}/enfants/{enfant_id}", 
                          headers=get_headers("marie"),
                          json={"tags": [tag_id]},
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ D4 FAILED: Cannot add tag to enfant - {resp.status_code}")
            return False
        
        enfant_data = resp.json().get("enfant", {})
        if tag_id not in enfant_data.get("tags", []):
            print(f"✗ D4 FAILED: Tag not added to enfant")
            return False
        
        print(f"✓ D4: Added tag to enfant {enfant_id}")
        
        # D5: DELETE /api/tags/:id
        resp = requests.delete(f"{BASE_URL}/tags/{tag_id}", 
                             headers=get_headers("marie"),
                             timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ D5 FAILED: DELETE tag returned {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if data.get("ok") != True:
            print(f"✗ D5 FAILED: Expected {{ok: true}}, got {data}")
            return False
        
        print(f"✓ D5: DELETE /api/tags/{tag_id} returned {{ok: true}}")
        
        # D6: Verify tag was removed from enfant
        resp = requests.get(f"{BASE_URL}/enfants/{enfant_id}", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code == 200:
            enfant_data = resp.json().get("enfant", {})
            if tag_id in enfant_data.get("tags", []):
                print(f"✗ D6 FAILED: Tag still in enfant's tags array")
                return False
            
            print(f"✓ D6: Verified tag was removed from enfant")
        
        print("✓ TEST D PASSED: TAGS CRUD working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST D EXCEPTION: {e}")
        return False

def test_e_rappels_pin_edit_delete():
    """Test E: RAPPELS pin/edit/delete (V10)"""
    print("\n" + "="*80)
    print("TEST E: RAPPELS pin/edit/delete (V10)")
    print("="*80)
    
    try:
        # E1: Login admin
        if not login("marie"):
            print("✗ E1 FAILED: Cannot login as admin")
            return False
        print("✓ E1: Admin login successful")
        
        # E2: POST /api/rappels
        creche_id = users["marie"]["creche_ids"][0]
        new_rappel = {
            "titre": "Test rappel",
            "echeance": "2026-08-15",
            "cible": "parents",
            "priorite": "moyenne",
            "creche_id": creche_id
        }
        
        resp = requests.post(f"{BASE_URL}/rappels", 
                           headers=get_headers("marie"),
                           json=new_rappel,
                           timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ E2 FAILED: Cannot create rappel - {resp.status_code} - {resp.text}")
            return False
        
        rappel_data = resp.json().get("rappel", {})
        rappel_id = rappel_data.get("id")
        test_resources["rappel_id"] = rappel_id
        print(f"✓ E2: Created rappel 'Test rappel' (id: {rappel_id})")
        
        # E3: PUT /api/rappels/:id with pinned=true
        resp = requests.put(f"{BASE_URL}/rappels/{rappel_id}", 
                          headers=get_headers("marie"),
                          json={
                              "pinned": True,
                              "titre": "Test rappel PINNED"
                          },
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ E3 FAILED: PUT rappel returned {resp.status_code} - {resp.text}")
            return False
        
        print(f"✓ E3: PUT /api/rappels/{rappel_id} with pinned=true returned 200")
        
        # E4: GET /api/rappels and verify
        resp = requests.get(f"{BASE_URL}/rappels", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ E4 FAILED: GET rappels returned {resp.status_code}")
            return False
        
        rappels = resp.json().get("rappels", [])
        found_rappel = next((r for r in rappels if r.get("id") == rappel_id), None)
        
        if not found_rappel:
            print(f"✗ E4 FAILED: Rappel not found in list")
            return False
        
        if found_rappel.get("pinned") != True:
            print(f"✗ E4 FAILED: Expected pinned=true, got {found_rappel.get('pinned')}")
            return False
        
        if found_rappel.get("titre") != "Test rappel PINNED":
            print(f"✗ E4 FAILED: Expected titre='Test rappel PINNED', got '{found_rappel.get('titre')}'")
            return False
        
        print(f"✓ E4: Verified rappel pinned=true and titre updated")
        
        # E5: DELETE /api/rappels/:id
        resp = requests.delete(f"{BASE_URL}/rappels/{rappel_id}", 
                             headers=get_headers("marie"),
                             timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ E5 FAILED: DELETE rappel returned {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if data.get("ok") != True:
            print(f"✗ E5 FAILED: Expected {{ok: true}}, got {data}")
            return False
        
        print(f"✓ E5: DELETE /api/rappels/{rappel_id} returned {{ok: true}}")
        
        print("✓ TEST E PASSED: RAPPELS pin/edit/delete working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST E EXCEPTION: {e}")
        return False

def test_f_news_pin_edit_delete():
    """Test F: NEWS pin/edit/delete (V10)"""
    print("\n" + "="*80)
    print("TEST F: NEWS pin/edit/delete (V10)")
    print("="*80)
    
    try:
        # F1: Login admin
        if not login("marie"):
            print("✗ F1 FAILED: Cannot login as admin")
            return False
        print("✓ F1: Admin login successful")
        
        # F2: POST /api/news
        creche_id = users["marie"]["creche_ids"][0]
        new_news = {
            "titre": "Test news",
            "contenu": "contenu",
            "cible": "parents",
            "creche_id": creche_id
        }
        
        resp = requests.post(f"{BASE_URL}/news", 
                           headers=get_headers("marie"),
                           json=new_news,
                           timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ F2 FAILED: Cannot create news - {resp.status_code} - {resp.text}")
            return False
        
        news_data = resp.json().get("news", {})
        news_id = news_data.get("id")
        test_resources["news_id"] = news_id
        print(f"✓ F2: Created news 'Test news' (id: {news_id})")
        
        # F3: PUT /api/news/:id with pinned=true
        resp = requests.put(f"{BASE_URL}/news/{news_id}", 
                          headers=get_headers("marie"),
                          json={
                              "pinned": True,
                              "titre": "Pinned news"
                          },
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ F3 FAILED: PUT news returned {resp.status_code} - {resp.text}")
            return False
        
        print(f"✓ F3: PUT /api/news/{news_id} with pinned=true returned 200")
        
        # F4: DELETE /api/news/:id
        resp = requests.delete(f"{BASE_URL}/news/{news_id}", 
                             headers=get_headers("marie"),
                             timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ F4 FAILED: DELETE news returned {resp.status_code} - {resp.text}")
            return False
        
        data = resp.json()
        if data.get("ok") != True:
            print(f"✗ F4 FAILED: Expected {{ok: true}}, got {data}")
            return False
        
        print(f"✓ F4: DELETE /api/news/{news_id} returned {{ok: true}}")
        
        print("✓ TEST F PASSED: NEWS pin/edit/delete working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST F EXCEPTION: {e}")
        return False

def test_g_enfant_presences_hebdo():
    """Test G: ENFANT presences_hebdo persistence (V10)"""
    print("\n" + "="*80)
    print("TEST G: ENFANT presences_hebdo persistence (V10)")
    print("="*80)
    
    try:
        # G1: Login admin
        if not login("marie"):
            print("✗ G1 FAILED: Cannot login as admin")
            return False
        print("✓ G1: Admin login successful")
        
        # G2: GET /api/enfants
        resp = requests.get(f"{BASE_URL}/enfants", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ G2 FAILED: Cannot get enfants - {resp.status_code}")
            return False
        
        enfants = resp.json().get("enfants", [])
        if not enfants:
            print("✗ G2 FAILED: No enfants found")
            return False
        
        enfant_id = enfants[0].get("id")
        print(f"✓ G2: Got enfant id: {enfant_id}")
        
        # G3: PUT /api/enfants/:id with presences_hebdo
        presences_hebdo = {
            "lundi": {
                "present": True,
                "arrivee": "08:00",
                "depart": "17:00"
            },
            "mardi": {
                "present": False,
                "arrivee": "08:00",
                "depart": "17:00"
            }
        }
        
        resp = requests.put(f"{BASE_URL}/enfants/{enfant_id}", 
                          headers=get_headers("marie"),
                          json={"presences_hebdo": presences_hebdo},
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ G3 FAILED: PUT enfant returned {resp.status_code} - {resp.text}")
            return False
        
        print(f"✓ G3: PUT /api/enfants/{enfant_id} with presences_hebdo returned 200")
        
        # G4: GET /api/enfants/:id and verify presences_hebdo
        resp = requests.get(f"{BASE_URL}/enfants/{enfant_id}", 
                          headers=get_headers("marie"),
                          timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ G4 FAILED: GET enfant returned {resp.status_code}")
            return False
        
        enfant_data = resp.json().get("enfant", {})
        saved_presences = enfant_data.get("presences_hebdo", {})
        
        if not saved_presences:
            print(f"✗ G4 FAILED: presences_hebdo not saved")
            return False
        
        # Verify lundi
        if saved_presences.get("lundi", {}).get("present") != True:
            print(f"✗ G4 FAILED: lundi.present should be true")
            return False
        
        if saved_presences.get("lundi", {}).get("arrivee") != "08:00":
            print(f"✗ G4 FAILED: lundi.arrivee should be '08:00'")
            return False
        
        # Verify mardi
        if saved_presences.get("mardi", {}).get("present") != False:
            print(f"✗ G4 FAILED: mardi.present should be false")
            return False
        
        print(f"✓ G4: Verified presences_hebdo persisted correctly")
        print(f"  - lundi: present={saved_presences.get('lundi', {}).get('present')}, arrivee={saved_presences.get('lundi', {}).get('arrivee')}")
        print(f"  - mardi: present={saved_presences.get('mardi', {}).get('present')}")
        
        print("✓ TEST G PASSED: ENFANT presences_hebdo persistence working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST G EXCEPTION: {e}")
        return False

def test_h_security():
    """Test H: SECURITY - Pro/Parent cannot access admin endpoints (V10)"""
    print("\n" + "="*80)
    print("TEST H: SECURITY - Pro/Parent cannot access admin endpoints (V10)")
    print("="*80)
    
    try:
        # H1: Login as pro
        if not login("pro"):
            print("✗ H1 FAILED: Cannot login as pro")
            return False
        print("✓ H1: Pro login successful")
        
        # H2: Pro cannot DELETE /devis
        resp = requests.delete(f"{BASE_URL}/devis/fake-id", 
                             headers=get_headers("pro"),
                             timeout=10)
        
        if resp.status_code in [404, 403]:
            print(f"✓ H2: Pro DELETE /devis correctly denied ({resp.status_code})")
        else:
            print(f"✗ H2 FAILED: Pro should be denied, got {resp.status_code}")
            return False
        
        # H3: Pro cannot DELETE /factures
        resp = requests.delete(f"{BASE_URL}/factures/fake-id", 
                             headers=get_headers("pro"),
                             timeout=10)
        
        if resp.status_code in [404, 403]:
            print(f"✓ H3: Pro DELETE /factures correctly denied ({resp.status_code})")
        else:
            print(f"✗ H3 FAILED: Pro should be denied, got {resp.status_code}")
            return False
        
        # H4: Pro cannot DELETE /tags
        resp = requests.delete(f"{BASE_URL}/tags/fake-id", 
                             headers=get_headers("pro"),
                             timeout=10)
        
        if resp.status_code in [404, 403]:
            print(f"✓ H4: Pro DELETE /tags correctly denied ({resp.status_code})")
        else:
            print(f"✗ H4 FAILED: Pro should be denied, got {resp.status_code}")
            return False
        
        # H5: Pro cannot DELETE /rappels
        resp = requests.delete(f"{BASE_URL}/rappels/fake-id", 
                             headers=get_headers("pro"),
                             timeout=10)
        
        if resp.status_code in [404, 403]:
            print(f"✓ H5: Pro DELETE /rappels correctly denied ({resp.status_code})")
        else:
            print(f"✗ H5 FAILED: Pro should be denied, got {resp.status_code}")
            return False
        
        # H6: Pro cannot DELETE /news
        resp = requests.delete(f"{BASE_URL}/news/fake-id", 
                             headers=get_headers("pro"),
                             timeout=10)
        
        if resp.status_code in [404, 403]:
            print(f"✓ H6: Pro DELETE /news correctly denied ({resp.status_code})")
        else:
            print(f"✗ H6 FAILED: Pro should be denied, got {resp.status_code}")
            return False
        
        # H7: Pro cannot DELETE /employes
        resp = requests.delete(f"{BASE_URL}/employes/fake-id", 
                             headers=get_headers("pro"),
                             timeout=10)
        
        if resp.status_code in [404, 403]:
            print(f"✓ H7: Pro DELETE /employes correctly denied ({resp.status_code})")
        else:
            print(f"✗ H7 FAILED: Pro should be denied, got {resp.status_code}")
            return False
        
        # H8: Login as parent
        if not login("parent"):
            print("✗ H8 FAILED: Cannot login as parent")
            return False
        print("✓ H8: Parent login successful")
        
        # H9: Parent cannot DELETE /devis
        resp = requests.delete(f"{BASE_URL}/devis/fake-id", 
                             headers=get_headers("parent"),
                             timeout=10)
        
        if resp.status_code in [404, 403, 401]:
            print(f"✓ H9: Parent DELETE /devis correctly denied ({resp.status_code})")
        else:
            print(f"✗ H9 FAILED: Parent should be denied, got {resp.status_code}")
            return False
        
        print("✓ TEST H PASSED: Security checks working correctly")
        return True
        
    except Exception as e:
        print(f"✗ TEST H EXCEPTION: {e}")
        return False

def cleanup():
    """Cleanup: Delete all created test resources"""
    print("\n" + "="*80)
    print("CLEANUP: Deleting test resources")
    print("="*80)
    
    try:
        # Login as admin
        if not login("marie"):
            print("✗ Cannot login for cleanup")
            return
        
        # Delete remaining devis
        for devis_id in test_resources["devis_ids"]:
            try:
                resp = requests.delete(f"{BASE_URL}/devis/{devis_id}", 
                                     headers=get_headers("marie"),
                                     timeout=10)
                if resp.status_code == 200:
                    print(f"✓ Deleted devis {devis_id}")
            except:
                pass
        
        # Delete remaining factures
        for facture_id in test_resources["facture_ids"]:
            try:
                resp = requests.delete(f"{BASE_URL}/factures/{facture_id}", 
                                     headers=get_headers("marie"),
                                     timeout=10)
                if resp.status_code == 200:
                    print(f"✓ Deleted facture {facture_id}")
            except:
                pass
        
        print("✓ Cleanup completed")
        
    except Exception as e:
        print(f"✗ Cleanup exception: {e}")

def main():
    """Run all V10 tests"""
    print("\n" + "="*80)
    print("TiMétis V10 Backend Testing Suite")
    print("Testing NEW V10 features ONLY")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {}
    
    # Run all tests
    results["A_DELETE_EMPLOYE"] = test_a_delete_employe()
    results["B_DEVIS_STATUS_DELETE"] = test_b_devis_status_delete()
    results["C_FACTURES_STATUS_DELETE"] = test_c_factures_status_delete()
    results["D_TAGS_CRUD"] = test_d_tags_crud()
    results["E_RAPPELS_PIN_EDIT_DELETE"] = test_e_rappels_pin_edit_delete()
    results["F_NEWS_PIN_EDIT_DELETE"] = test_f_news_pin_edit_delete()
    results["G_ENFANT_PRESENCES_HEBDO"] = test_g_enfant_presences_hebdo()
    results["H_SECURITY"] = test_h_security()
    
    # Cleanup
    cleanup()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    print(f"Test finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
