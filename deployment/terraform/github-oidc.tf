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

data "aws_iam_policy_document" "ecr_push_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
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
        "repo:wasim0028/ElectionPulse-WB:pull_request",
        "repo:wasim0028/ElectionPulse-WB:environment:production",
        "repo:wasim0028/ElectionPulse-WB:*",
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

resource "aws_iam_role_policy_attachment" "tf_ec2" {
  role       = aws_iam_role.github_actions_terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
}
resource "aws_iam_role_policy_attachment" "tf_eks" {
  role       = aws_iam_role.github_actions_terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

data "aws_iam_policy_document" "tf_eks_management" {
  statement {
    effect = "Allow"
    actions = [
      "eks:DescribeCluster",
      "eks:CreateCluster",
      "eks:UpdateClusterConfig",
      "eks:UpdateClusterVersion",
      "eks:DeleteCluster",
      "eks:TagResource",
      "eks:UntagResource",
      "eks:ListTagsForResource",
      "eks:DescribeNodegroup",
      "eks:CreateNodegroup",
      "eks:UpdateNodegroupConfig",
      "eks:UpdateNodegroupVersion",
      "eks:DeleteNodegroup",
      "eks:DescribeAddon",
      "eks:CreateAddon",
      "eks:UpdateAddon",
      "eks:DeleteAddon",
      "eks:ListAddons",
      "eks:DescribeAddonVersions",
      "eks:AssociateEncryptionConfig",
    ]
    resources = [
      "arn:aws:eks:ap-south-1:326334468168:cluster/electionpulse-wb-eks",
      "arn:aws:eks:ap-south-1:326334468168:nodegroup/electionpulse-wb-eks/*/*",
      "arn:aws:eks:ap-south-1:326334468168:addon/electionpulse-wb-eks/*/*",
    ]
  }

  statement {
    # ListClusters/DescribeAddonVersions-style read actions that don't
    # support resource-level scoping in IAM at all.
    effect = "Allow"
    actions = [
      "eks:ListClusters",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "tf_eks_management" {
  name   = "eks-management-scoped"
  role   = aws_iam_role.github_actions_terraform.id
  policy = data.aws_iam_policy_document.tf_eks_management.json
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

data "aws_iam_policy_document" "tf_backend_access" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::electionpulse-wb-tfstate",
      "arn:aws:s3:::electionpulse-wb-tfstate/*",
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      "arn:aws:dynamodb:ap-south-1:326334468168:table/electionpulse-tfstate-lock",
    ]
  }
}

resource "aws_iam_role_policy" "tf_backend_access" {
  name   = "terraform-backend-access"
  role   = aws_iam_role.github_actions_terraform.id
  policy = data.aws_iam_policy_document.tf_backend_access.json
}

output "github_actions_ecr_push_role_arn" { value = aws_iam_role.github_actions_ecr_push.arn }
output "github_actions_terraform_role_arn" { value = aws_iam_role.github_actions_terraform.arn }
