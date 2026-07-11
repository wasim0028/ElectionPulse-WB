variable "name"               {}
variable "environment"        {}
variable "kubernetes_version" {}
variable "vpc_id"             {}
variable "private_subnet_ids" {}
variable "public_subnet_ids"  {}
variable "node_group_config"  {}
variable "account_id"         {}
variable "aws_region"         {}

# NEW VARIABLE: Required to link the RDS return traffic rule safely
#variable "rds_security_group_id" {
#  type        = string
#  description = "The security group ID of the RDS SQL Server instance"
#}


# ── Cluster Control Plane IAM Setup ───────────────────────────────────────────
resource "aws_iam_role" "cluster" {
  name = "${var.name}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "vpc_resource_controller" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
}

# ── Control Plane Security Group ──────────────────────────────────────────────
resource "aws_security_group" "cluster" {
  name        = "${var.name}-eks-cluster-sg"
  description = "EKS cluster security group"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-eks-cluster-sg" }
}

# ── EKS Cluster Resource ──────────────────────────────────────────────────────
resource "aws_eks_cluster" "main" {
  name     = "${var.name}-eks"
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = concat(var.private_subnet_ids, var.public_subnet_ids)
    security_group_ids      = [aws_security_group.cluster.id]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [
    aws_iam_role_policy_attachment.cluster_policy,
    aws_iam_role_policy_attachment.vpc_resource_controller,
  ]

  tags = { Name = "${var.name}-eks" }
}

# ── OpenID Connect (OIDC) Provider Infrastructure ─────────────────────────────
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# ── Worker Node IAM Configuration ─────────────────────────────────────────────
resource "aws_iam_role" "nodes" {
  name = "${var.name}-eks-nodes-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "nodes_worker_policy" {
  role       = aws_iam_role.nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "nodes_cni_policy" {
  role       = aws_iam_role.nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "nodes_ecr_policy" {
  role       = aws_iam_role.nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "nodes_ebs_csi_policy" {
  role       = aws_iam_role.nodes.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

# ── NEW: Dedicated IAM Role for EBS CSI Driver IRSA (Fixes 20m timeout) ───────
data "aws_iam_policy_document" "ebs_csi_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    condition {
      test     = "StringEquals"
      variable = "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub"
      values   = ["system:serviceaccount:kube-system:ebs-csi-controller-sa"]
    }

    principals {
      identifiers = [aws_iam_openid_connect_provider.eks.arn]
      type        = "Federated"
    }
  }
}

resource "aws_iam_role" "ebs_csi_irsa" {
  name               = "${var.name}-eks-ebs-csi-irsa-role"
  assume_role_policy = data.aws_iam_policy_document.ebs_csi_assume_role_policy.json
}

resource "aws_iam_role_policy_attachment" "ebs_csi_irsa_attachment" {
  role       = aws_iam_role.ebs_csi_irsa.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

# ── NEW: Dedicated IAM Role for AWS Load Balancer Controller IRSA ────────────
# FIXED: The ALB controller pod was previously running under the EC2 node's
# own IAM role (electionpulse-wb-eks-nodes-role), which has no ELB
# permissions at all. This caused:
#   AccessDenied: ... is not authorized to perform: elasticloadbalancing:
#   DescribeLoadBalancers
# on every Ingress reconciliation attempt, so no ALB was ever created and
# the Ingress's ADDRESS field stayed empty. This mirrors the exact IRSA
# pattern already used above for the EBS CSI driver.
data "aws_iam_policy_document" "alb_controller_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    condition {
      test     = "StringEquals"
      variable = "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub"
      values   = ["system:serviceaccount:kube-system:aws-load-balancer-controller"]
    }

    condition {
      test     = "StringEquals"
      variable = "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:aud"
      values   = ["sts.amazonaws.com"]
    }

    principals {
      identifiers = [aws_iam_openid_connect_provider.eks.arn]
      type        = "Federated"
    }
  }
}

resource "aws_iam_role" "alb_controller_irsa" {
  name               = "${var.name}-eks-alb-controller-irsa-role"
  assume_role_policy = data.aws_iam_policy_document.alb_controller_assume_role_policy.json
}

# NOTE: This uses the official AWS Load Balancer Controller IAM policy JSON.
# Download it once and commit it alongside this module:
#   curl -o modules/eks/files/alb-iam-policy.json \
#     https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
# This replaces the redundant "aws iam create-policy" CLI call that used to
# live inside deploy.sh's install_alb_controller() — the policy is now
# managed by Terraform instead of being created imperatively on every run.
resource "aws_iam_policy" "alb_controller" {
  name   = "${var.name}-alb-controller-policy"
  policy = file("${path.module}/files/alb-iam-policy.json")
}

resource "aws_iam_role_policy_attachment" "alb_controller_irsa_attachment" {
  role       = aws_iam_role.alb_controller_irsa.name
  policy_arn = aws_iam_policy.alb_controller.arn
}

# ── Worker Node Security Group ────────────────────────────────────────────────
resource "aws_security_group" "nodes" {
  name        = "${var.name}-eks-nodes-sg"
  description = "EKS worker node security group"
  vpc_id      = var.vpc_id

  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
  }

  ingress {
    from_port       = 1025
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.cluster.id]
  }

  # NEW: Required when using a custom launch template. Without a launch
  # template, EKS auto-attaches its own internal cluster security group
  # (aws_eks_cluster.main.vpc_config[0].cluster_security_group_id) to nodes,
  # which already has the correct bidirectional rules for kubelet <-> API
  # server communication. A custom launch template disables that
  # auto-attachment, so we must explicitly allow it here, and also attach
  # that SG directly in the launch template below — otherwise nodes launch
  # as EC2 instances but never successfully register with the cluster,
  # and `terraform apply` hangs at "Still creating..." until it times out.
  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }

  ingress {
    from_port       = 1025
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }

  # NEW: Required for the ALB (target-type: ip) to actually reach pods.
  # With target-type: ip, the ALB sends traffic directly to pod IPs, which
  # live on the worker node's ENI and are filtered by this security group.
  # The AWS Load Balancer Controller is *supposed* to auto-manage a shared
  # "backend security group" and attach it to node ENIs automatically, but
  # that didn't take effect here (likely because IAM permissions were only
  # fixed after the ALB/target group already existed) — resulting in
  # "Target.Timeout" on every health check. This rule allows inbound traffic
  # on the frontend's containerPort from anywhere in the VPC as a reliable,
  # explicit fallback instead of depending on that automatic mechanism.
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # adjust to match your actual vpc_cidr variable
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name                                          = "${var.name}-eks-nodes-sg"
    "kubernetes.io/cluster/${var.name}-eks"        = "owned"
  }
}

# ── NEW: Launch Template — this is what actually attaches aws_security_group.nodes
#         to the real EC2 instances. Without this, EKS silently uses its own
#         auto-generated SG on the node ENIs instead of the one defined above,
#         which is why RDS ingress rules referencing this SG were never matched.
resource "aws_launch_template" "nodes" {
  name_prefix = "${var.name}-node-lt-"

  # Both SGs are attached: our custom nodes SG (for node<->node and RDS-facing
  # rules) AND the real auto-generated EKS cluster SG (for control-plane
  # communication, which is otherwise lost once a launch template is used).
  vpc_security_group_ids = [
    aws_security_group.nodes.id,
    aws_eks_cluster.main.vpc_config[0].cluster_security_group_id,
  ]

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.node_group_config.disk_size_gb
      volume_type            = "gp3"
      delete_on_termination  = true
      encrypted              = true
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${var.name}-eks-node" }
  }

  tag_specifications {
    resource_type = "volume"
    tags          = { Name = "${var.name}-eks-node-volume" }
  }

  tags = { Name = "${var.name}-node-lt" }

  lifecycle { create_before_destroy = true }
}

# ── Managed EKS Node Group ────────────────────────────────────────────────────
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.name}-node-group"
  node_role_arn   = aws_iam_role.nodes.arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = var.node_group_config.instance_types

  launch_template {
    id      = aws_launch_template.nodes.id
    version = aws_launch_template.nodes.latest_version
  }

  scaling_config {
    min_size     = var.node_group_config.min_size
    max_size     = var.node_group_config.max_size
    desired_size = var.node_group_config.desired_size
  }

  update_config { max_unavailable = 1 }

  # NOTE: disk_size is intentionally removed from here — it now lives in the
  # launch template's block_device_mappings above. Terraform/AWS will error
  # ("Cannot specify disk_size when launch_template is used") if both are set.

  labels = { role = "worker", environment = var.environment }

  depends_on = [
    aws_iam_role_policy_attachment.nodes_worker_policy,
    aws_iam_role_policy_attachment.nodes_cni_policy,
    aws_iam_role_policy_attachment.nodes_ecr_policy,
    aws_iam_role_policy_attachment.nodes_ebs_csi_policy,
  ]

  tags = { Name = "${var.name}-node-group" }

  lifecycle { ignore_changes = [scaling_config[0].desired_size] }
}

# ── EKS Native Managed Add-Ons ────────────────────────────────────────────────
resource "aws_eks_addon" "coredns" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "coredns"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  depends_on                  = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "kube-proxy"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
}

resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "vpc-cni"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "aws-ebs-csi-driver"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  service_account_role_arn    = aws_iam_role.ebs_csi_irsa.arn # <── FIXED: Mounts dedicated OIDC Identity
  depends_on                  = [aws_eks_node_group.main]
}

# ── NEW: Inbound Firewall Modification Rule ────────────────────────────────────
# Allows the RDS database engine instance to send verification tokens and data 
# handshakes back to your listening worker nodes on dynamic ephemeral channels.
#
# NOTE: This rule is NOT actually required. AWS security groups are stateful —
# return traffic for a connection the node initiated outbound is automatically
# allowed back in, regardless of the RDS-side ingress rule. This block is left
# here (commented, as it already was) as a historical note rather than a fix.
#resource "aws_security_group_rule" "rds_to_eks_nodes_handshake" {
#  type                     = "ingress"
#  description              = "Allow return network handshakes from RDS SQL Server"
#  from_port                = 1024
#  to_port                  = 65535
#  protocol                 = "tcp"
#  security_group_id        = aws_security_group.nodes.id
#  source_security_group_id = var.rds_security_group_id
#}

# ── Module Infrastructure Outputs ─────────────────────────────────────────────
output "cluster_name"            { value = aws_eks_cluster.main.name }
output "cluster_endpoint"        { value = aws_eks_cluster.main.endpoint }
output "cluster_ca"              { value = aws_eks_cluster.main.certificate_authority[0].data }
output "oidc_provider_arn"       { value = aws_iam_openid_connect_provider.eks.arn }
output "oidc_issuer"             { value = aws_eks_cluster.main.identity[0].oidc[0].issuer }
output "node_security_group_id"  { value = aws_security_group.nodes.id }
output "alb_controller_role_arn" { value = aws_iam_role.alb_controller_irsa.arn }
