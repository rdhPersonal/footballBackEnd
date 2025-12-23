#!/usr/bin/env python3
"""
Script to manage Cognito users for the Fantasy Football API.

Usage:
    python scripts/manage_users.py --list
    python scripts/manage_users.py --create --email user@example.com --role user
    python scripts/manage_users.py --delete --email user@example.com
    python scripts/manage_users.py --set-password --email user@example.com --password NewPass123!
"""
import argparse
import boto3
import sys
import json
from botocore.exceptions import ClientError

# Configuration - these will be populated from Terraform outputs
USER_POOL_ID = None  # Will be set from terraform output
CLIENT_ID = None     # Will be set from terraform output

def get_cognito_config():
    """Get Cognito configuration from Terraform outputs."""
    global USER_POOL_ID, CLIENT_ID
    
    try:
        # Try to get from terraform outputs
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
            
        if not USER_POOL_ID or not CLIENT_ID:
            print("Error: Could not get Cognito configuration from Terraform outputs")
            print("Make sure Terraform has been applied and outputs are available")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error getting Cognito configuration: {e}")
        sys.exit(1)


def create_cognito_client():
    """Create Cognito Identity Provider client."""
    return boto3.client('cognito-idp', region_name='us-east-1')


def list_users():
    """List all users in the user pool."""
    cognito = create_cognito_client()
    
    try:
        response = cognito.list_users(UserPoolId=USER_POOL_ID)
        
        print(f"\nUsers in pool {USER_POOL_ID}:")
        print("-" * 80)
        
        for user in response['Users']:
            username = user['Username']
            status = user['UserStatus']
            enabled = user['Enabled']
            created = user['UserCreateDate'].strftime('%Y-%m-%d %H:%M:%S')
            
            # Get attributes
            email = None
            role = None
            name = None
            
            for attr in user.get('Attributes', []):
                if attr['Name'] == 'email':
                    email = attr['Value']
                elif attr['Name'] == 'custom:user_role':
                    role = attr['Value']
                elif attr['Name'] == 'given_name':
                    name = attr['Value']
            
            print(f"Username: {username}")
            print(f"  Email: {email}")
            print(f"  Name: {name}")
            print(f"  Role: {role}")
            print(f"  Status: {status}")
            print(f"  Enabled: {enabled}")
            print(f"  Created: {created}")
            print()
            
    except ClientError as e:
        print(f"Error listing users: {e}")
        return False
    
    return True


def create_user(email, role='user', given_name=None, family_name=None):
    """Create a new user in the user pool."""
    cognito = create_cognito_client()
    
    # Generate temporary password
    temp_password = "TempPass123!"
    
    attributes = [
        {'Name': 'email', 'Value': email},
        {'Name': 'email_verified', 'Value': 'true'},
        {'Name': 'custom:user_role', 'Value': role}
    ]
    
    if given_name:
        attributes.append({'Name': 'given_name', 'Value': given_name})
    if family_name:
        attributes.append({'Name': 'family_name', 'Value': family_name})
    
    try:
        response = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=attributes,
            TemporaryPassword=temp_password,
            MessageAction='SUPPRESS'  # Don't send welcome email
        )
        
        print(f"✅ User created successfully!")
        print(f"   Email: {email}")
        print(f"   Role: {role}")
        print(f"   Temporary Password: {temp_password}")
        print(f"   Status: {response['User']['UserStatus']}")
        print("\n⚠️  The user will need to change their password on first login.")
        
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UsernameExistsException':
            print(f"❌ User with email {email} already exists")
        else:
            print(f"❌ Error creating user: {e}")
        return False


def delete_user(email):
    """Delete a user from the user pool."""
    cognito = create_cognito_client()
    
    try:
        cognito.admin_delete_user(
            UserPoolId=USER_POOL_ID,
            Username=email
        )
        
        print(f"✅ User {email} deleted successfully!")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UserNotFoundException':
            print(f"❌ User {email} not found")
        else:
            print(f"❌ Error deleting user: {e}")
        return False


def set_password(email, password):
    """Set a permanent password for a user."""
    cognito = create_cognito_client()
    
    try:
        cognito.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=email,
            Password=password,
            Permanent=True
        )
        
        print(f"✅ Password set successfully for {email}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UserNotFoundException':
            print(f"❌ User {email} not found")
        elif error_code == 'InvalidPasswordException':
            print(f"❌ Invalid password. Must meet password policy requirements.")
        else:
            print(f"❌ Error setting password: {e}")
        return False


def enable_user(email):
    """Enable a user account."""
    cognito = create_cognito_client()
    
    try:
        cognito.admin_enable_user(
            UserPoolId=USER_POOL_ID,
            Username=email
        )
        
        print(f"✅ User {email} enabled successfully!")
        return True
        
    except ClientError as e:
        print(f"❌ Error enabling user: {e}")
        return False


def disable_user(email):
    """Disable a user account."""
    cognito = create_cognito_client()
    
    try:
        cognito.admin_disable_user(
            UserPoolId=USER_POOL_ID,
            Username=email
        )
        
        print(f"✅ User {email} disabled successfully!")
        return True
        
    except ClientError as e:
        print(f"❌ Error disabling user: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Manage Cognito users for Fantasy Football API'
    )
    
    # Actions
    parser.add_argument('--list', action='store_true', help='List all users')
    parser.add_argument('--create', action='store_true', help='Create a new user')
    parser.add_argument('--delete', action='store_true', help='Delete a user')
    parser.add_argument('--set-password', action='store_true', help='Set user password')
    parser.add_argument('--enable', action='store_true', help='Enable user account')
    parser.add_argument('--disable', action='store_true', help='Disable user account')
    
    # User details
    parser.add_argument('--email', help='User email address')
    parser.add_argument('--password', help='User password')
    parser.add_argument('--role', default='user', choices=['admin', 'user'], 
                       help='User role (admin or user)')
    parser.add_argument('--given-name', help='User first name')
    parser.add_argument('--family-name', help='User last name')
    
    args = parser.parse_args()
    
    # Get Cognito configuration
    get_cognito_config()
    
    # Validate arguments
    if not any([args.list, args.create, args.delete, args.set_password, 
                args.enable, args.disable]):
        parser.print_help()
        print("\n❌ Please specify an action (--list, --create, --delete, etc.)")
        return 1
    
    # Execute actions
    if args.list:
        return 0 if list_users() else 1
    
    if args.create:
        if not args.email:
            print("❌ --email is required for creating users")
            return 1
        return 0 if create_user(args.email, args.role, args.given_name, args.family_name) else 1
    
    if args.delete:
        if not args.email:
            print("❌ --email is required for deleting users")
            return 1
        return 0 if delete_user(args.email) else 1
    
    if args.set_password:
        if not args.email or not args.password:
            print("❌ --email and --password are required for setting passwords")
            return 1
        return 0 if set_password(args.email, args.password) else 1
    
    if args.enable:
        if not args.email:
            print("❌ --email is required for enabling users")
            return 1
        return 0 if enable_user(args.email) else 1
    
    if args.disable:
        if not args.email:
            print("❌ --email is required for disabling users")
            return 1
        return 0 if disable_user(args.email) else 1
    
    return 0


if __name__ == '__main__':
    sys.exit(main())