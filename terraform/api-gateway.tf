# ------------------------------------------------------------------------------
# API Gateway v2 (HTTP API)
# ------------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-${var.environment}-api"
  protocol_type = "HTTP"
  description   = "NFL player statistics API"

  cors_configuration {
    allow_origins = var.frontend_urls
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 3600
  }

  tags = { Name = "${var.project_name}-${var.environment}-api" }
}

# ------------------------------------------------------------------------------
# Default stage (auto-deploy)
# ------------------------------------------------------------------------------

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = { Name = "${var.project_name}-${var.environment}-api-default" }
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = 14

  tags = { Name = "${var.project_name}-${var.environment}-api-logs" }
}

# ------------------------------------------------------------------------------
# JWT Authorizer (Cognito)
# ------------------------------------------------------------------------------

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.frontend.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# ------------------------------------------------------------------------------
# Route -> Integration mappings
# ------------------------------------------------------------------------------

locals {
  api_routes = {
    "GET /players"                    = "getPlayers"
    "GET /players/{id}"               = "getPlayer"
    "GET /players/{id}/stats"         = "getPlayerStats"
    "GET /players/{id}/roster-history" = "getPlayerRosterHistory"
    "GET /players/{id}/scores"        = "getPlayerScores"
    "GET /scoring-configs"            = "getScoringConfigs"
    "GET /teams"                      = "getTeams"
    "GET /seasons"                    = "getSeasons"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each = local.api_routes

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions[each.value].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.key

  target             = "integrations/${aws_apigatewayv2_integration.lambda[each.key].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ------------------------------------------------------------------------------
# Lambda permissions for API Gateway invocation
# ------------------------------------------------------------------------------

resource "aws_lambda_permission" "api_gw" {
  for_each = local.api_routes

  statement_id  = "AllowAPIGateway-${replace(each.value, "/", "-")}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.value].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
