# Lambda function to initialize database schema
# This is a one-time function that can be invoked manually

resource "aws_lambda_function" "db_init" {
  filename      = "../../lambda/db_init/db_init_lambda.zip"
  function_name = "${var.project_name}-${var.environment}-db-init"
  role          = aws_iam_role.lambda.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.11"
  timeout       = 60
  memory_size   = 256

  source_code_hash = fileexists("../../lambda/db_init/db_init_lambda.zip") ? filebase64sha256("../../lambda/db_init/db_init_lambda.zip") : null

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-init"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy.lambda_secrets
  ]
}

# CloudWatch Log Group for DB Init Lambda
resource "aws_cloudwatch_log_group" "db_init_lambda" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-db-init"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-init-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}

output "db_init_lambda_name" {
  description = "Name of the database initialization Lambda function"
  value       = aws_lambda_function.db_init.function_name
}
