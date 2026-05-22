# ═══════════════════════════════════════════════════════════════════════════════
# Module: ECR (Elastic Container Registry)
# Creates two private repositories: frontend (nginx) + backend (.NET)
# ═══════════════════════════════════════════════════════════════════════════════

variable "name"        {}
variable "environment" {}
variable "account_id"  {}

# ── Frontend repository ────────────────────────────────────────────────────────
resource "aws_ecr_repository" "frontend" {
  name                 = "${var.name}/frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration { scan_on_push = true }
  encryption_configuration     { encryption_type = "AES256" }

  tags = { Name = "${var.name}-frontend-ecr" }
}

# ── Backend repository ─────────────────────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "${var.name}/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration { scan_on_push = true }
  encryption_configuration     { encryption_type = "AES256" }

  tags = { Name = "${var.name}-backend-ecr" }
}

# ── Lifecycle policies — keep last 10 tagged images ───────────────────────────
resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy     = aws_ecr_lifecycle_policy.frontend.policy
}

# ── Outputs ────────────────────────────────────────────────────────────────────
output "frontend_repository_url" { value = aws_ecr_repository.frontend.repository_url }
output "backend_repository_url"  { value = aws_ecr_repository.backend.repository_url }
output "registry_id"             { value = aws_ecr_repository.frontend.registry_id }
