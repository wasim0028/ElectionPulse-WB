# ═══════════════════════════════════════════════════════════════════════════════
# Module: RDS — SQL Server Express / Standard Edition
# ═══════════════════════════════════════════════════════════════════════════════

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
  family = "sqlserver-se-15.0"
  name   = "${var.name}-sqlserver-params"

  tags = { Name = "${var.name}-sqlserver-params" }
}

# ── RDS SQL Server Instance ────────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier = "${var.name}-sqlserver"

  engine               = "sqlserver-se"
  engine_version       = "15.00.4355.3.v1"
  instance_class       = var.db_instance_class
  license_model        = "license-included"

  username = var.db_username
  password = var.db_password

  # SQL Server doesn't support db_name at creation — created via migration
  # db_name = var.db_name

  allocated_storage     = 50
  max_allocated_storage = 200
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.sqlserver.name

  multi_az               = var.environment == "prod" ? true : false
  publicly_accessible    = false
  deletion_protection    = var.environment == "prod" ? true : false
  skip_final_snapshot    = var.environment == "prod" ? false : true
  final_snapshot_identifier = var.environment == "prod" ? "${var.name}-final-snapshot" : null

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  performance_insights_enabled = true
  monitoring_interval          = 60

  tags = { Name = "${var.name}-sqlserver" }
}

# ── Outputs ────────────────────────────────────────────────────────────────────
output "endpoint"        { value = aws_db_instance.main.endpoint }
output "port"            { value = aws_db_instance.main.port }
output "security_group"  { value = aws_security_group.rds.id }
