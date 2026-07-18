# deployment/terraform/github-oidc.tf
#
# GitHub Actions authenticates to AWS via OIDC federation — same pattern
# used throughout this stack for the ALB controller and EBS CSI driver.
# No long-lived AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY stored in GitHub at all.
#
# Two SEPARATE roles, not one broad one — least privilege, matching the
# actual blast radius of each workflow:
#   1. github-actions-ecr-push   -> ci-cd.yml (build/push images only)
#   2. github-actions-terraform  -> terraform.yml (full infra changes)
# A compromised or buggy build workflow should never be able to touch RDS,
# IAM, or VPC resources — only push container images.

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

# ── Trust policy shared shape, scoped per-role below ─────────────────────────
# IMPORTANT: the "sub" condition restricts which repo/branch can assume each
# role. Without this, ANY GitHub Actions workflow anywhere with your OIDC
# provider's ARN could assume it. Replace "wasim0028/ElectionPulse-WB" if
# your repo path differs.

data "aws_iam_policy_document" "github_actions_ecr_push_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:wasim0028/ElectionPulse-WB:ref:refs/heads/main"]
    }

    principals {
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
      type        = "Federated"
    }
  }
}

resource "aws_iam_role" "github_actions_ecr_push" {
  name               = "github-actions-ecr-push"
  assume_role_policy = data.aws_iam_policy_document.github_actions_ecr_push_trust.json
}

# Narrow policy: push/pull to exactly the 3 repos this project uses, nothing
# else. No EC2, no IAM, no RDS, no ability to touch cluster infra.
data "aws_iam_policy_document" "ecr_push_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]   # this specific action does not support resource scoping
  }

  statement {
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [
      "arn:aws:ecr:ap-south-1:326334468168:repository/electionpulse-wb/frontend",
      "arn:aws:ecr:ap-south-1:326334468168:repository/electionpulse-wb/backend",
      "arn:aws:ecr:ap-south-1:326334468168:repository/electionpulse-wb/migration",
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_ecr_push" {
  name   = "ecr-push-scoped"
  role   = aws_iam_role.github_actions_ecr_push.id
  policy = data.aws_iam_policy_document.ecr_push_permissions.json
}

# ── Terraform role — broader, since it manages the actual infra ─────────────
data "aws_iam_policy_document" "github_actions_terraform_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [
        "repo:wasim0028/ElectionPulse-WB:ref:refs/heads/main",
        "repo:wasim0028/ElectionPulse-WB:pull_request",   # allows `terraform plan` on PRs
      ]
    }

    principals {
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
      type        = "Federated"
    }
  }
}

resource "aws_iam_role" "github_actions_terraform" {
  name               = "github-actions-terraform"
  assume_role_policy = data.aws_iam_policy_document.github_actions_terraform_trust.json
}

# NOTE: Terraform in this project manages VPC, EKS, RDS, IAM roles, and ECR —
# a genuinely broad surface. Scoping a policy tightly enough to cover every
# resource type Terraform touches, without drifting out of sync every time
# you add a new resource, is real ongoing work. Starting point below uses
# AWS managed policies covering each service Terraform provisions; tighten
# to customer-managed policies with specific resource ARNs once the
# infrastructure stops changing shape as often.
resource "aws_iam_role_policy_attachment" "tf_ec2" {
  role       = aws_iam_role.github_actions_terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
}
resource "aws_iam_role_policy_attachment" "tf_eks" {
  role       = aws_iam_role.github_actions_terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}
resource "aws_iam_role_policy_attachment" "tf_rds" {
  role       = aws_iam_role.github_actions_terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
}
resource "aws_iam_role_policy_attachment" "tf_ecr" {
  role       = aws_iam_role.github_actions_terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
}
resource "aws_iam_role_policy_attachment" "tf_iam" {
  role       = aws_iam_role.github_actions_terraform.name
  policy_arn = "arn:aws:iam::aws:policy/IAMFullAccess"
}

output "github_actions_ecr_push_role_arn" { value = aws_iam_role.github_actions_ecr_push.arn }
output "github_actions_terraform_role_arn" { value = aws_iam_role.github_actions_terraform.arn }
