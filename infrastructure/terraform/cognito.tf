# Cognito User Pool for API Authentication
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-user-pool"

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # User attributes
  alias_attributes = ["email"]
  
  # Auto-verified attributes
  auto_verified_attributes = ["email"]

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  # Schema for custom attributes
  schema {
    attribute_data_type = "String"
    name               = "email"
    required           = true
    mutable            = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type = "String"
    name               = "given_name"
    required           = false
    mutable            = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type = "String"
    name               = "family_name"
    required           = false
    mutable            = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Custom attribute for user role
  schema {
    attribute_data_type = "String"
    name               = "user_role"
    required           = false
    mutable            = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 50
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-user-pool"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-${var.environment}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # Client settings
  generate_secret                      = false
  prevent_user_existence_errors       = "ENABLED"
  enable_token_revocation             = true
  enable_propagate_additional_user_context_data = false

  # Auth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH", 
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_ADMIN_USER_PASSWORD_AUTH"
  ]

  # Token validity
  access_token_validity  = 60    # 1 hour
  id_token_validity     = 60    # 1 hour
  refresh_token_validity = 30   # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "given_name",
    "family_name",
    "custom:user_role"
  ]

  write_attributes = [
    "email",
    "given_name",
    "family_name"
  ]
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${var.environment}-auth"
  user_pool_id = aws_cognito_user_pool.main.id
}

# API Gateway Authorizer
resource "aws_api_gateway_authorizer" "cognito" {
  name            = "${var.project_name}-${var.environment}-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.main.id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = [aws_cognito_user_pool.main.arn]
  identity_source = "method.request.header.Authorization"
  # Remove authorizer_credentials - not needed for COGNITO_USER_POOLS type
}

# IAM role for API Gateway to invoke Cognito
resource "aws_iam_role" "api_gateway_cognito_role" {
  name = "${var.project_name}-${var.environment}-api-gateway-cognito-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-gateway-cognito-role"
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for API Gateway Cognito integration
resource "aws_iam_role_policy" "api_gateway_cognito_policy" {
  name = "${var.project_name}-${var.environment}-api-gateway-cognito-policy"
  role = aws_iam_role.api_gateway_cognito_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:GetUser",
          "cognito-idp:ListUsers"
        ]
        Resource = aws_cognito_user_pool.main.arn
      }
    ]
  })
}

# Create admin user
resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "admin"  # Use a simple username instead of email

  attributes = {
    email          = var.admin_email
    email_verified = true
    given_name     = "Admin"
    family_name    = "User"
    "custom:user_role" = "admin"
  }

  temporary_password = var.admin_temp_password
  message_action     = "SUPPRESS" # Don't send welcome email

  lifecycle {
    ignore_changes = [
      temporary_password,
      password
    ]
  }
}

# Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "Cognito User Pool Domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "cognito_hosted_ui_url" {
  description = "Cognito Hosted UI URL"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "admin_user_info" {
  description = "Admin user information"
  value = {
    username = aws_cognito_user.admin.username
    user_pool_id = aws_cognito_user_pool.main.id
    temp_password = var.admin_temp_password
  }
  sensitive = true
}

# Data source for current region
data "aws_region" "current" {}