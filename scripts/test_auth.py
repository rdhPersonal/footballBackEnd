#!/usr/bin/env python3
"""
Script to test Cognito authentication and make authenticated API calls.

Usage:
    python scripts/test_auth.py --login --email user@example.com --password password
    python scripts/test_auth.py --test-api --token your_jwt_token
    python scripts/test_auth.py --refresh --refresh-token your_refresh_token
"""
import argparse
import boto3
import requests
import json
import sys
from botocore.exceptions import ClientError

# Configuration - these will be populated from Terraform outputs
USER_POOL_ID = None
CLIENT_ID = None
API_URL = None

def get_config():
    """Get configuration from Terraform outputs."""
    global USER_POOL_ID, CLIENT_ID, API_URL
    
    try:
        import subprocess
        result = subprocess.run(
            ['terraform', 'output', '-json'],
            cwd='infrastructure/terraform',
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            outputs = json.loads(result.stdout)
            USER_POOL_ID = outputs.get('cognito_user_pool_id', {}).get('value')
            CLIENT_ID = outputs.get('cognito_client_id', {}).get('value')
            API_URL = outputs.get('api_url', {}).get('value')
            
        if not all([USER_POOL_ID, CLIENT_ID, API_URL]):
            print("Error: Could not get configuration from Terraform outputs")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error getting configuration: {e}")
        sys.exit(1)


def authenticate_user(email, password):
    """Authenticate user and get JWT tokens."""
    cognito = boto3.client('cognito-idp', region_name='us-east-1')
    
    # If email is 'admin', use username 'admin', otherwise use email as username
    username = 'admin' if email == 'admin' else email
    
    try:
        response = cognito.admin_initiate_auth(
            UserPoolId=USER_POOL_ID,
            ClientId=CLIENT_ID,
            AuthFlow='ADMIN_USER_PASSWORD_AUTH',  # Changed from ADMIN_NO_SRP_AUTH
            AuthParameters={
                'USERNAME': username,
                'PASSWORD': password
            }
        )
        
        # Check if password change is required
        if 'ChallengeName' in response:
            if response['ChallengeName'] == 'NEW_PASSWORD_REQUIRED':
                print("❌ Password change required. Please set a new password first.")
                print("Use: python scripts/manage_users.py --set-password --email {} --password NewPass123!".format(email))
                return None
        
        # Extract tokens
        auth_result = response['AuthenticationResult']
        tokens = {
            'access_token': auth_result['AccessToken'],
            'id_token': auth_result['IdToken'],
            'refresh_token': auth_result['RefreshToken'],
            'expires_in': auth_result['ExpiresIn']
        }
        
        print("✅ Authentication successful!")
        print(f"Access Token: {tokens['access_token'][:50]}...")
        print(f"ID Token: {tokens['id_token'][:50]}...")
        print(f"Expires in: {tokens['expires_in']} seconds")
        
        return tokens
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NotAuthorizedException':
            print("❌ Invalid email or password")
        elif error_code == 'UserNotFoundException':
            print("❌ User not found")
        elif error_code == 'UserNotConfirmedException':
            print("❌ User account not confirmed")
        else:
            print(f"❌ Authentication error: {e}")
        return None


def refresh_tokens(refresh_token):
    """Refresh access and ID tokens using refresh token."""
    cognito = boto3.client('cognito-idp', region_name='us-east-1')
    
    try:
        response = cognito.admin_initiate_auth(
            UserPoolId=USER_POOL_ID,
            ClientId=CLIENT_ID,
            AuthFlow='REFRESH_TOKEN_AUTH',
            AuthParameters={
                'REFRESH_TOKEN': refresh_token
            }
        )
        
        auth_result = response['AuthenticationResult']
        tokens = {
            'access_token': auth_result['AccessToken'],
            'id_token': auth_result['IdToken'],
            'expires_in': auth_result['ExpiresIn']
        }
        
        print("✅ Tokens refreshed successfully!")
        print(f"New Access Token: {tokens['access_token'][:50]}...")
        print(f"New ID Token: {tokens['id_token'][:50]}...")
        
        return tokens
        
    except ClientError as e:
        print(f"❌ Token refresh error: {e}")
        return None


def test_api_endpoints(access_token):
    """Test various API endpoints with authentication."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    # Test endpoints
    endpoints = [
        '/api/nfl/teams',
        '/api/nfl/players?limit=5',
        '/api/fantasy/leagues',
        '/api/fantasy/teams'
    ]
    
    print(f"\n🧪 Testing API endpoints with authentication...")
    print(f"Base URL: {API_URL}")
    
    for endpoint in endpoints:
        url = f"{API_URL}{endpoint}"
        try:
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 1
                print(f"✅ {endpoint} - {response.status_code} - {count} items")
            else:
                print(f"❌ {endpoint} - {response.status_code} - {response.text[:100]}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ {endpoint} - Request failed: {e}")
    
    # Test public endpoint (should work without auth)
    print(f"\n🌐 Testing public endpoint (no auth required)...")
    try:
        response = requests.get(f"{API_URL}/public/docs", timeout=10)
        if response.status_code == 200:
            print(f"✅ /public/docs - {response.status_code} - Public access working")
        else:
            print(f"❌ /public/docs - {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ /public/docs - Request failed: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='Test Cognito authentication for Fantasy Football API'
    )
    
    # Actions
    parser.add_argument('--login', action='store_true', help='Login and get tokens')
    parser.add_argument('--test-api', action='store_true', help='Test API endpoints')
    parser.add_argument('--refresh', action='store_true', help='Refresh tokens')
    
    # Credentials
    parser.add_argument('--email', help='User email')
    parser.add_argument('--password', help='User password')
    parser.add_argument('--token', help='Access token for API testing')
    parser.add_argument('--refresh-token', help='Refresh token')
    
    args = parser.parse_args()
    
    # Get configuration
    get_config()
    
    if args.login:
        if not args.email or not args.password:
            print("❌ --email and --password are required for login")
            return 1
        
        tokens = authenticate_user(args.email, args.password)
        if tokens:
            # Optionally test API with the new token
            if input("\n🤔 Test API endpoints with this token? (y/n): ").lower() == 'y':
                test_api_endpoints(tokens['access_token'])
        return 0 if tokens else 1
    
    if args.test_api:
        if not args.token:
            print("❌ --token is required for API testing")
            return 1
        
        test_api_endpoints(args.token)
        return 0
    
    if args.refresh:
        if not args.refresh_token:
            print("❌ --refresh-token is required for token refresh")
            return 1
        
        tokens = refresh_tokens(args.refresh_token)
        return 0 if tokens else 1
    
    parser.print_help()
    return 1


if __name__ == '__main__':
    sys.exit(main())