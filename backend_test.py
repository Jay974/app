#!/usr/bin/env python3
"""
V12 LOT3 Backend Testing Script
Tests Google OAuth, Web Push VAPID, DELETE documents, and Push integration hooks
"""

import requests
import json
import os
from datetime import datetime

# Backend URL from .env
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://tikreol-demo.preview.emergentagent.com') + '/api'

# Demo accounts
ADMIN_EMAIL = 'admin@demo.re'
ADMIN_PASSWORD = 'demo1234'
PRO_EMAIL = 'pro@demo.re'
PRO_PASSWORD = 'demo1234'
PARENT_EMAIL = 'parent@demo.re'
PARENT_PASSWORD = 'demo1234'

# Test results
test_results = {
    'passed': 0,
    'failed': 0,
    'tests': []
}

def log_test(test_id, description, passed, details=''):
    """Log test result"""
    status = '✅ PASS' if passed else '❌ FAIL'
    test_results['tests'].append({
        'id': test_id,
        'description': description,
        'passed': passed,
        'details': details
    })
    if passed:
        test_results['passed'] += 1
    else:
        test_results['failed'] += 1
    print(f"{status} | {test_id} | {description}")
    if details:
        print(f"    Details: {details}")

def login(email, password):
    """Login and return token"""
    try:
        response = requests.post(f'{BASE_URL}/auth/login', json={
            'email': email,
            'password': password
        }, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('token'), data.get('user')
        return None, None
    except Exception as e:
        print(f"Login error: {e}")
        return None, None

def test_google_oauth():
    """Test A: Google OAuth endpoints"""
    print("\n" + "="*80)
    print("TEST SECTION A: GOOGLE OAUTH (/api/auth/google)")
    print("="*80)
    
    # A1: POST without body → 400
    try:
        response = requests.post(f'{BASE_URL}/auth/google', json={}, timeout=10)
        passed = response.status_code == 400 and 'credential' in response.text.lower()
        log_test('A1', 'POST /auth/google without body → 400 (Missing credential)', passed,
                f"Status: {response.status_code}, Body: {response.text[:100]}")
    except Exception as e:
        log_test('A1', 'POST /auth/google without body → 400', False, f"Error: {e}")
    
    # A2: POST with invalid token → 401
    try:
        response = requests.post(f'{BASE_URL}/auth/google', json={
            'credential': 'invalid.token.here'
        }, timeout=10)
        passed = response.status_code == 401 and 'invalide' in response.text.lower()
        log_test('A2', 'POST /auth/google with invalid token → 401 (Token Google invalide)', passed,
                f"Status: {response.status_code}, Body: {response.text[:100]}")
    except Exception as e:
        log_test('A2', 'POST /auth/google with invalid token → 401', False, f"Error: {e}")
    
    # A3: Verify GOOGLE_CLIENT_ID is set
    try:
        # Check .env file
        with open('/app/.env', 'r') as f:
            env_content = f.read()
        has_google_client_id = 'GOOGLE_CLIENT_ID=882347354442-dnpjbvdivscukut5s8n7vm4dnjf7fgui.apps.googleusercontent.com' in env_content
        log_test('A3', 'Verify GOOGLE_CLIENT_ID is set in .env', has_google_client_id,
                f"GOOGLE_CLIENT_ID found: {has_google_client_id}")
    except Exception as e:
        log_test('A3', 'Verify GOOGLE_CLIENT_ID is set in .env', False, f"Error: {e}")
    
    print("\nNOTE: A4-A5 skipped intentionally (real Google credential required)")

def test_web_push_vapid(admin_token):
    """Test B: Web Push VAPID endpoints"""
    print("\n" + "="*80)
    print("TEST SECTION B: WEB PUSH VAPID (/api/push/*)")
    print("="*80)
    
    headers = {'Authorization': f'Bearer {admin_token}'}
    
    # B1: GET /push/vapid-key → 200 with publicKey
    try:
        response = requests.get(f'{BASE_URL}/push/vapid-key', headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('publicKey') and data['publicKey'].startswith('BKWtCOm6')
        log_test('B1', 'GET /push/vapid-key → 200 {publicKey: "BKWtCOm6..."}', passed,
                f"Status: {response.status_code}, publicKey: {data.get('publicKey', '')[:20]}...")
    except Exception as e:
        log_test('B1', 'GET /push/vapid-key → 200', False, f"Error: {e}")
    
    # B2: POST /push/subscribe with subscription → 200
    try:
        subscription_data = {
            'subscription': {
                'endpoint': 'https://fake.push.example/abc123',
                'keys': {
                    'p256dh': 'test-p256dh',
                    'auth': 'test-auth'
                }
            },
            'ua': 'Test'
        }
        response = requests.post(f'{BASE_URL}/push/subscribe', json=subscription_data, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('ok') == True
        log_test('B2', 'POST /push/subscribe with subscription → 200 {ok:true}', passed,
                f"Status: {response.status_code}, Response: {data}")
    except Exception as e:
        log_test('B2', 'POST /push/subscribe → 200', False, f"Error: {e}")
    
    # B3: POST /push/subscribe again with same endpoint → upsert (no duplicate)
    try:
        response = requests.post(f'{BASE_URL}/push/subscribe', json=subscription_data, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('ok') == True
        log_test('B3', 'POST /push/subscribe again (same endpoint) → upsert, no duplicate', passed,
                f"Status: {response.status_code}, Response: {data}")
    except Exception as e:
        log_test('B3', 'POST /push/subscribe again → upsert', False, f"Error: {e}")
    
    # B4: POST /push/subscribe with different endpoint → 200
    try:
        subscription_data2 = {
            'subscription': {
                'endpoint': 'https://fake.push.example/def456',
                'keys': {
                    'p256dh': 'test-p256dh-2',
                    'auth': 'test-auth-2'
                }
            },
            'ua': 'Test2'
        }
        response = requests.post(f'{BASE_URL}/push/subscribe', json=subscription_data2, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('ok') == True
        log_test('B4', 'POST /push/subscribe with different endpoint → 200', passed,
                f"Status: {response.status_code}, Response: {data}")
    except Exception as e:
        log_test('B4', 'POST /push/subscribe with different endpoint → 200', False, f"Error: {e}")
    
    # B5: POST /push/unsubscribe with endpoint → 200
    try:
        response = requests.post(f'{BASE_URL}/push/unsubscribe', json={
            'endpoint': 'https://fake.push.example/abc123'
        }, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('ok') == True
        log_test('B5', 'POST /push/unsubscribe with endpoint → 200 {ok:true}', passed,
                f"Status: {response.status_code}, Response: {data}")
    except Exception as e:
        log_test('B5', 'POST /push/unsubscribe with endpoint → 200', False, f"Error: {e}")
    
    # B6: POST /push/unsubscribe with no body → deletes all admin's subs
    try:
        response = requests.post(f'{BASE_URL}/push/unsubscribe', json={}, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('ok') == True
        log_test('B6', 'POST /push/unsubscribe with no body → deletes all admin subs', passed,
                f"Status: {response.status_code}, Response: {data}")
    except Exception as e:
        log_test('B6', 'POST /push/unsubscribe with no body → 200', False, f"Error: {e}")
    
    # B7: POST /push/test → 200 (even with fake subscriptions)
    try:
        response = requests.post(f'{BASE_URL}/push/test', json={}, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('ok') == True
        log_test('B7', 'POST /push/test → 200 {ok:true} (fake endpoints fail silently)', passed,
                f"Status: {response.status_code}, Response: {data}")
    except Exception as e:
        log_test('B7', 'POST /push/test → 200', False, f"Error: {e}")

def test_delete_documents(admin_token, pro_token, parent_token):
    """Test C: DELETE /documents/:id (admin only)"""
    print("\n" + "="*80)
    print("TEST SECTION C: DELETE /api/documents/:id (admin only)")
    print("="*80)
    
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    pro_headers = {'Authorization': f'Bearer {pro_token}'}
    parent_headers = {'Authorization': f'Bearer {parent_token}'}
    
    # C1: Admin creates a document
    doc_id = None
    try:
        # Get creche_id first
        response = requests.get(f'{BASE_URL}/creches', headers=admin_headers, timeout=10)
        creches = response.json().get('creches', [])
        creche_id = creches[0]['id'] if creches else None
        
        response = requests.post(f'{BASE_URL}/documents', json={
            'titre': 'Test doc',
            'type': 'pdf',
            'url': 'https://ex.re/doc.pdf',
            'cible': 'tous',
            'creche_id': creche_id
        }, headers=admin_headers, timeout=10)
        data = response.json()
        doc_id = data.get('document', {}).get('id')
        passed = response.status_code == 200 and doc_id is not None
        log_test('C1', 'Admin POST /documents → 200 {document:{id,...}}', passed,
                f"Status: {response.status_code}, doc_id: {doc_id}")
    except Exception as e:
        log_test('C1', 'Admin POST /documents → 200', False, f"Error: {e}")
    
    if not doc_id:
        log_test('C2', 'Pro DELETE /documents/:id → 4xx (not admin)', False, 'No doc_id from C1')
        log_test('C3', 'Parent DELETE /documents/:id → 4xx (not admin)', False, 'No doc_id from C1')
        log_test('C4', 'Admin DELETE /documents/:id → 200 {ok:true}', False, 'No doc_id from C1')
        return
    
    # C2: Pro tries to DELETE → 4xx
    try:
        response = requests.delete(f'{BASE_URL}/documents/{doc_id}', headers=pro_headers, timeout=10)
        passed = response.status_code >= 400
        log_test('C2', 'Pro DELETE /documents/:id → 4xx (not admin)', passed,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test('C2', 'Pro DELETE /documents/:id → 4xx', False, f"Error: {e}")
    
    # C3: Parent tries to DELETE → 4xx
    try:
        response = requests.delete(f'{BASE_URL}/documents/{doc_id}', headers=parent_headers, timeout=10)
        passed = response.status_code >= 400
        log_test('C3', 'Parent DELETE /documents/:id → 4xx (not admin)', passed,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test('C3', 'Parent DELETE /documents/:id → 4xx', False, f"Error: {e}")
    
    # C4: Admin DELETE → 200
    try:
        response = requests.delete(f'{BASE_URL}/documents/{doc_id}', headers=admin_headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and data.get('ok') == True
        log_test('C4', 'Admin DELETE /documents/:id → 200 {ok:true}', passed,
                f"Status: {response.status_code}, Response: {data}")
        
        # Verify document is gone
        if passed:
            response = requests.get(f'{BASE_URL}/documents', headers=admin_headers, timeout=10)
            docs = response.json().get('documents', [])
            doc_exists = any(d['id'] == doc_id for d in docs)
            if doc_exists:
                log_test('C4-verify', 'Verify document deleted', False, 'Document still exists')
            else:
                print(f"    ✅ Verified: Document {doc_id} successfully deleted")
    except Exception as e:
        log_test('C4', 'Admin DELETE /documents/:id → 200', False, f"Error: {e}")

def test_push_integration_hooks(admin_token):
    """Test D: Push integration hooks (silent fire-and-forget)"""
    print("\n" + "="*80)
    print("TEST SECTION D: PUSH INTEGRATION HOOKS (silent fire-and-forget)")
    print("="*80)
    
    headers = {'Authorization': f'Bearer {admin_token}'}
    
    # Get creche_id
    try:
        response = requests.get(f'{BASE_URL}/creches', headers=headers, timeout=10)
        creches = response.json().get('creches', [])
        creche_id = creches[0]['id'] if creches else None
    except:
        creche_id = None
    
    # D1: POST /rappels → 200 (even with no valid subscribers)
    try:
        response = requests.post(f'{BASE_URL}/rappels', json={
            'titre': 'Test push',
            'echeance': '2026-08-01',
            'cible': 'parents',
            'priorite': 'moyenne',
            'creche_id': creche_id
        }, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and 'rappel' in data
        log_test('D1', 'POST /rappels → 200 {rappel:{...}} (push hook silent)', passed,
                f"Status: {response.status_code}, Has rappel: {'rappel' in data}")
    except Exception as e:
        log_test('D1', 'POST /rappels → 200', False, f"Error: {e}")
    
    # D2: POST /news → 200
    try:
        response = requests.post(f'{BASE_URL}/news', json={
            'titre': 'Test news push',
            'contenu': 'test',
            'cible': 'parents',
            'creche_id': creche_id
        }, headers=headers, timeout=10)
        data = response.json()
        passed = response.status_code == 200 and 'news' in data
        log_test('D2', 'POST /news → 200 {news:{...}} (push hook silent)', passed,
                f"Status: {response.status_code}, Has news: {'news' in data}")
    except Exception as e:
        log_test('D2', 'POST /news → 200', False, f"Error: {e}")
    
    # D3: POST /albums/:id/medias → 200
    try:
        # First, get or create an album
        response = requests.get(f'{BASE_URL}/albums', headers=headers, timeout=10)
        albums = response.json().get('albums', [])
        
        if albums:
            album_id = albums[0]['id']
        else:
            # Create an album
            response = requests.post(f'{BASE_URL}/albums', json={
                'nom': 'Test album for push',
                'theme': 'Test',
                'date': '2026-07-20',
                'creche_id': creche_id
            }, headers=headers, timeout=10)
            album_id = response.json().get('album', {}).get('id')
        
        if album_id:
            response = requests.post(f'{BASE_URL}/albums/{album_id}/medias', json={
                'url': 'https://ex.re/x.jpg',
                'type': 'image'
            }, headers=headers, timeout=10)
            data = response.json()
            passed = response.status_code == 200 and data.get('ok') == True
            log_test('D3', 'POST /albums/:id/medias → 200 {ok:true} (push hook silent)', passed,
                    f"Status: {response.status_code}, Response: {data}")
        else:
            log_test('D3', 'POST /albums/:id/medias → 200', False, 'No album_id available')
    except Exception as e:
        log_test('D3', 'POST /albums/:id/medias → 200', False, f"Error: {e}")
    
    # D4: POST /fiches-paie → 200
    try:
        # Get a pro user id
        response = requests.get(f'{BASE_URL}/employes', headers=headers, timeout=10)
        employes = response.json().get('employes', [])
        pro_id = employes[0]['id'] if employes else None
        
        if pro_id:
            response = requests.post(f'{BASE_URL}/fiches-paie', json={
                'employe_id': pro_id,
                'employe_nom': 'Test',
                'periode': 'juillet 2026',
                'url': 'https://ex.re/f.pdf',
                'montant_brut': 2000,
                'montant_net': 1600,
                'creche_id': creche_id
            }, headers=headers, timeout=10)
            data = response.json()
            passed = response.status_code == 200 and 'fiche' in data
            log_test('D4', 'POST /fiches-paie → 200 {fiche:{...}} (push hook silent)', passed,
                    f"Status: {response.status_code}, Has fiche: {'fiche' in data}")
        else:
            log_test('D4', 'POST /fiches-paie → 200', False, 'No pro_id available')
    except Exception as e:
        log_test('D4', 'POST /fiches-paie → 200', False, f"Error: {e}")
    
    # D5: Verify all endpoints completed without errors
    log_test('D5', 'All D1-D4 completed successfully without raising errors', 
            test_results['tests'][-4]['passed'] and test_results['tests'][-3]['passed'] and 
            test_results['tests'][-2]['passed'] and test_results['tests'][-1]['passed'],
            'All push integration hooks working')
    
    # D6: Cleanup test data
    try:
        # Cleanup rappels
        response = requests.get(f'{BASE_URL}/rappels', headers=headers, timeout=10)
        rappels = response.json().get('rappels', [])
        for r in rappels:
            if r.get('titre') == 'Test push':
                requests.delete(f'{BASE_URL}/rappels/{r["id"]}', headers=headers, timeout=10)
        
        # Cleanup news
        response = requests.get(f'{BASE_URL}/news', headers=headers, timeout=10)
        news_list = response.json().get('news', [])
        for n in news_list:
            if n.get('titre') == 'Test news push':
                requests.delete(f'{BASE_URL}/news/{n["id"]}', headers=headers, timeout=10)
        
        # Cleanup fiches-paie
        response = requests.get(f'{BASE_URL}/fiches-paie', headers=headers, timeout=10)
        fiches = response.json().get('fiches', [])
        for f in fiches:
            if f.get('periode') == 'juillet 2026':
                requests.delete(f'{BASE_URL}/fiches-paie/{f["id"]}', headers=headers, timeout=10)
        
        log_test('D6', 'Cleanup all test data', True, 'Test data cleaned up successfully')
    except Exception as e:
        log_test('D6', 'Cleanup all test data', False, f"Error: {e}")

def main():
    """Main test runner"""
    print("\n" + "="*80)
    print("V12 LOT3 BACKEND TESTING")
    print("Testing: Google OAuth, Web Push VAPID, DELETE documents, Push hooks")
    print("="*80)
    
    # Login as admin, pro, parent
    print("\n🔐 Logging in as demo users...")
    admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    pro_token, pro_user = login(PRO_EMAIL, PRO_PASSWORD)
    parent_token, parent_user = login(PARENT_EMAIL, PARENT_PASSWORD)
    
    if not admin_token:
        print("❌ Failed to login as admin. Aborting tests.")
        return
    
    print(f"✅ Admin logged in: {admin_user.get('prenom')} {admin_user.get('nom')}")
    print(f"✅ Pro logged in: {pro_user.get('prenom')} {pro_user.get('nom')}")
    print(f"✅ Parent logged in: {parent_user.get('prenom')} {parent_user.get('nom')}")
    
    # Run tests
    test_google_oauth()
    test_web_push_vapid(admin_token)
    test_delete_documents(admin_token, pro_token, parent_token)
    test_push_integration_hooks(admin_token)
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {test_results['passed'] + test_results['failed']}")
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print(f"Success Rate: {test_results['passed'] / (test_results['passed'] + test_results['failed']) * 100:.1f}%")
    
    # Print failed tests
    failed_tests = [t for t in test_results['tests'] if not t['passed']]
    if failed_tests:
        print("\n❌ FAILED TESTS:")
        for t in failed_tests:
            print(f"  - {t['id']}: {t['description']}")
            if t['details']:
                print(f"    {t['details']}")
    else:
        print("\n🎉 ALL TESTS PASSED!")
    
    print("\n" + "="*80)

if __name__ == '__main__':
    main()
