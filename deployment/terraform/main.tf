# ═══════════════════════════════════════════════════════════════════════════════
# ElectionPulse WB — AWS Infrastructure
# Terraform ≥ 1.6  |  Provider: AWS ~> 5.0
# Architecture: VPC → EKS → RDS SQL Server → ECR → ALB → Route53
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  # Remote state — S3 backend
  backend "s3" {
    bucket         = "electionpulse-wb-tfstate"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "electionpulse-tfstate-lock"
  }
}

# ── Provider ───────────────────────────────────────────────────────────────────
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ElectionPulseWB"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
    }
  }
}

# ── Data sources ───────────────────────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ── Local values ───────────────────────────────────────────────────────────────
locals {
  name        = "electionpulse-wb"
  account_id  = data.aws_caller_identity.current.account_id
  azs         = slice(data.aws_availability_zones.available.names, 0, 3)
}

# ═══════════════════════════════════════════════════════════════════════════════
# MODULE: VPC
# ═══════════════════════════════════════════════════════════════════════════════
module "vpc" {
  source = "./modules/vpc"

  name        = local.name
  environment = var.environment
  azs         = local.azs

  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# ═══════════════════════════════════════════════════════════════════════════════
# MODULE: ECR — Container Registries
# ═══════════════════════════════════════════════════════════════════════════════
module "ecr" {
  source = "./modules/ecr"

  name        = local.name
  environment = var.environment
  account_id  = local.account_id
}

# ═══════════════════════════════════════════════════════════════════════════════
# MODULE: EKS — Kubernetes Cluster
# ═══════════════════════════════════════════════════════════════════════════════
module "eks" {
  source = "./modules/eks"

  name               = local.name
  environment        = var.environment
  kubernetes_version = var.kubernetes_version

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids

  node_group_config = var.node_group_config
  account_id        = local.account_id
  aws_region        = var.aws_region
}

# ═══════════════════════════════════════════════════════════════════════════════
# MODULE: RDS — SQL Server
# ═══════════════════════════════════════════════════════════════════════════════
module "rds" {
  source = "./modules/rds"

  name               = local.name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  eks_security_group = module.eks.node_security_group_id

  db_instance_class  = var.db_instance_class
  db_username        = var.db_username
  db_password        = var.db_password
  db_name            = var.db_name
}

# ── Outputs ────────────────────────────────────────────────────────────────────
output "eks_cluster_name"     { value = module.eks.cluster_name }
output "eks_cluster_endpoint" { value = module.eks.cluster_endpoint }
output "ecr_frontend_url"     { value = module.ecr.frontend_repository_url }
output "ecr_backend_url"      { value = module.ecr.backend_repository_url }
output "endpoint"             { value = module.rds.endpoint }
output "vpc_id"               { value = module.vpc.vpc_id }
