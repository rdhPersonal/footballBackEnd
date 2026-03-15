# ------------------------------------------------------------------------------
# IAM Role for Lambda execution
# ------------------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "lambda_exec" {
  name               = "${var.project_name}-${var.environment}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = { Name = "${var.project_name}-${var.environment}-lambda-exec" }
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

locals {
  lambda_db_secret_resource = try(
    aws_db_instance.main.master_user_secret[0].secret_arn,
    "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:*",
  )
}

data "aws_iam_policy_document" "lambda_db_secret_access" {
  statement {
    effect = "Allow"
    actions = [
      "rds:DescribeDBInstances",
    ]
    # DescribeDBInstances does not support resource-level restrictions.
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [
      local.lambda_db_secret_resource,
    ]
  }
}

resource "aws_iam_role_policy" "lambda_db_secret_access" {
  name   = "${var.project_name}-${var.environment}-lambda-db-secret-access"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.lambda_db_secret_access.json
}
