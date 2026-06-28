# ═══════════════════════════════════════════════════════════════════════════════
# Variables
# ═══════════════════════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"   # Mumbai — closest to West Bengal
}

variable "environment" {
  description = "Deployment environment (prod / dev)"
  type        = string
  default     = "prod"
}

# ── Network ────────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (EKS nodes + RDS)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

# ── EKS ────────────────────────────────────────────────────────────────────────
variable "kubernetes_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.34"
}

variable "node_group_config" {
  description = "EKS managed node group configuration"
  type = object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
    disk_size_gb   = number
  })
  default = {
    instance_types = ["t3.medium"]
    min_size       = 2
    max_size       = 5
    desired_size   = 2
    disk_size_gb   = 50
  }
}

# ── RDS ────────────────────────────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.m5.large"
}

variable "db_username" {
  description = "SQL Server master username"
  type        = string
  default     = "sa"
  sensitive   = true
}

variable "db_password" {
  description = "SQL Server master password"
  type        = string
  sensitive   = true
  # Pass via TF_VAR_db_password env variable — never hardcode!
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "ElectionWB"
}
