# FastAPI Lambda Function for CRUD API

# Lambda function for API
resource "aws_lambda_function" "api" {
  filename      = "../../lambda_api.zip"
  function_name = "${var.project_name}-${var.environment}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "src.api.main.handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 512

  source_code_hash = fileexists("../../lambda_api.zip") ? filebase64sha256("../../lambda_api.zip") : null

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      DB_HOST       = aws_db_instance.main.address
      DB_PORT       = tostring(aws_db_instance.main.port)
      DB_NAME       = var.db_name
      DB_USER       = var.db_username
      DB_PASSWORD   = var.db_password
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-api"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy.lambda_secrets
  ]
}

# CloudWatch Log Group for API Lambda
resource "aws_cloudwatch_log_group" "api_lambda" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-api"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# API Gateway Integration with Cognito Authorization

# Public endpoints (no auth required)
resource "aws_api_gateway_resource" "public" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "public"
}

resource "aws_api_gateway_resource" "public_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.public.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "public_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.public_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "public_lambda" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_method.public_proxy.resource_id
  http_method = aws_api_gateway_method.public_proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# Protected endpoints (Cognito auth required)
resource "aws_api_gateway_resource" "api" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "api"
}

resource "aws_api_gateway_resource" "api_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "api_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.api_proxy.id
  http_method   = "ANY"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id

  request_parameters = {
    "method.request.header.Authorization" = true
  }
}

resource "aws_api_gateway_integration" "api_lambda" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_method.api_proxy.resource_id
  http_method = aws_api_gateway_method.api_proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# Root path (redirect to docs)
resource "aws_api_gateway_method" "proxy_root" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_rest_api.main.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_method.proxy_root.resource_id
  http_method = aws_api_gateway_method.proxy_root.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# CORS support for all endpoints
resource "aws_api_gateway_method" "options_api" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.api_proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_api" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_method.options_api.resource_id
  http_method = aws_api_gateway_method.options_api.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "options_api" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.api_proxy.id
  http_method = aws_api_gateway_method.options_api.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_api" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.api_proxy.id
  http_method = aws_api_gateway_method.options_api.http_method
  status_code = aws_api_gateway_method_response.options_api.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "api" {
  depends_on = [
    aws_api_gateway_integration.public_lambda,
    aws_api_gateway_integration.api_lambda,
    aws_api_gateway_integration.lambda_root,
    aws_api_gateway_integration.options_api,
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = var.environment

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.public.id,
      aws_api_gateway_resource.public_proxy.id,
      aws_api_gateway_method.public_proxy.id,
      aws_api_gateway_integration.public_lambda.id,
      aws_api_gateway_resource.api.id,
      aws_api_gateway_resource.api_proxy.id,
      aws_api_gateway_method.api_proxy.id,
      aws_api_gateway_integration.api_lambda.id,
      aws_api_gateway_method.proxy_root.id,
      aws_api_gateway_integration.lambda_root.id,
      aws_api_gateway_authorizer.cognito.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Outputs
output "api_lambda_name" {
  description = "Name of the API Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "api_url" {
  description = "API Gateway URL"
  value       = "${aws_api_gateway_deployment.api.invoke_url}"
}

output "api_docs_url" {
  description = "API Documentation URL"
  value       = "${aws_api_gateway_deployment.api.invoke_url}/docs"
}
