terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "football-backend-tf-state"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "football-backend-tf-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "football-backend"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
