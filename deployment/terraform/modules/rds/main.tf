# ── Variables ──────────────────────────────────────────────────────────────────
variable "name"               {}
variable "environment"        {}
variable "vpc_id"             {}
variable "private_subnet_ids" {}
variable "eks_security_group" {}
variable "db_instance_class"  {}
variable "db_username"        { sensitive = true }
variable "db_password"        { sensitive = true }
variable "db_name"            {}

# ── Subnet Group ───────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.name}-rds-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = { Name = "${var.name}-rds-subnet-group" }
}

# ── Security Group ─────────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "${var.name}-rds-sg"
  description = "Allow SQL Server from EKS nodes"
  vpc_id      = var.vpc_id

  # SQL Server port from EKS nodes only
  ingress {
    from_port       = 1433
    to_port         = 1433
    protocol        = "tcp"
    security_groups = [var.eks_security_group]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-rds-sg" }
}

# ── Parameter Group ────────────────────────────────────────────────────────────
resource "aws_db_parameter_group" "sqlserver" {
  # FIXED: Ensured strict alignment with your chosen engine edition family
  family = var.environment == "prod" ? "sqlserver-se-15.0" : "sqlserver-ex-15.0"
  name   = "${var.name}-sqlserver-params"

  tags = { Name = "${var.name}-sqlserver-params" }
}

# ── Option Group ───────────────────────────────────────────────────────────────
resource "aws_db_option_group" "sqlserver" {
  name                     = "${var.name}-sqlserver-og"
  option_group_description = "Option group for SQL Server backup/restore"
  engine_name              = var.environment == "prod" ? "sqlserver-se" : "sqlserver-ex"
  major_engine_version     = "15.00"

  option {
    option_name = "SQLSERVER_BACKUP_RESTORE"

    option_settings {
      name  = "IAM_ROLE_ARN"
      value = aws_iam_role.rds_s3_backup_restore.arn
    }
  }

  tags = { Name = "${var.name}-sqlserver-og" }
}

# ── Data Sources for Trust Policies ────────────────────────────────────────────
data "aws_iam_policy_document" "rds_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"

    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

# ── Data Source for S3 Permissions ─────────────────────────────────────────────
data "aws_iam_policy_document" "rds_s3_backup_restore_permissions" {
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation"
    ]
    resources = ["arn:aws:s3:::*"] 
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListMultipartUploadParts",
      "s3:AbortMultipartUpload"
    ]
    resources = ["arn:aws:s3:::*/*"]
  }
}

# ── RDS SQL Server Instance ────────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier = "${var.name}-sqlserver"

  engine               = var.environment == "prod" ? "sqlserver-se" : "sqlserver-ex"
  engine_version       = "15.00.4355.3.v1"
  instance_class       = var.environment == "prod" ? var.db_instance_class : "db.t3.small"
  license_model        = "license-included"

  username = var.db_username
  password = var.db_password

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.sqlserver.name
  option_group_name      = aws_db_option_group.sqlserver.name

  # Applies modifications without waiting for the maintenance window
  apply_immediately      = true

  multi_az               = var.environment == "prod" ? true : false
  deletion_protection    = var.environment == "prod" ? true : false
  skip_final_snapshot    = var.environment == "prod" ? false : true
  final_snapshot_identifier = var.environment == "prod" ? "${var.name}-final-snapshot" : null

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  publicly_accessible    = true

  performance_insights_enabled = false
  monitoring_interval          = 0

  tags = { Name = "${var.name}-sqlserver" }
}

# ── IAM: RDS S3 Backup & Restore ───────────────────────────────────────────────
resource "aws_iam_role" "rds_s3_backup_restore" {
  name               = "${var.name}-rds-s3-restore-role"
  assume_role_policy = data.aws_iam_policy_document.rds_trust.json
}

# Custom Inline Policy replacing the broken managed policy block
resource "aws_iam_role_policy" "rds_s3_backup_restore_policy" {
  name   = "${var.name}-rds-s3-policy"
  role   = aws_iam_role.rds_s3_backup_restore.id
  policy = data.aws_iam_policy_document.rds_s3_backup_restore_permissions.json
}

# ── Outputs ────────────────────────────────────────────────────────────────────
output "endpoint"        { value = aws_db_instance.main.endpoint }
output "port"            { value = aws_db_instance.main.port }
output "security_group"  { value = aws_security_group.rds.id }
