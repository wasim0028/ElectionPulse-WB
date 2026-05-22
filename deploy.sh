#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy.sh — Full deployment pipeline for ElectionPulse WB
#
# Usage:
#   ./deploy.sh [plan|apply|destroy|build|push|k8s|all]
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Terraform >= 1.6
#   - kubectl
#   - Docker
#   - helm
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME="electionpulse-wb-eks"
ECR_FRONTEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/electionpulse-wb/frontend"
ECR_BACKEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/electionpulse-wb/backend"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
TF_DIR="./terraform"
K8S_DIR="./kubernetes/base"
FRONTEND_DIR="../election-frontend-wb"
BACKEND_DIR="../ElectionAPI_WB"

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()     { echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠ $1${NC}"; }
error()   { echo -e "${RED}[$(date +'%H:%M:%S')] ✗ $1${NC}"; exit 1; }
section() { echo -e "\n${CYAN}══════════════════════════════════════${NC}"; \
            echo -e "${BLUE} $1${NC}"; \
            echo -e "${CYAN}══════════════════════════════════════${NC}\n"; }

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Terraform — provision AWS infrastructure
# ═══════════════════════════════════════════════════════════════════════════════
tf_init() {
  section "Terraform Init"
  cd "${TF_DIR}"
  terraform init -upgrade
  log "Terraform initialized"
  cd -
}

tf_plan() {
  section "Terraform Plan"
  cd "${TF_DIR}"
  terraform plan \
    -var="aws_region=${AWS_REGION}" \
    -var="db_password=${TF_VAR_db_password:?'Set TF_VAR_db_password env variable'}" \
    -out=tfplan
  log "Plan saved to tfplan"
  cd -
}

tf_apply() {
  section "Terraform Apply"
  cd "${TF_DIR}"
  terraform apply tfplan
  log "Infrastructure provisioned"

  # Export outputs
  export RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
  export EKS_CLUSTER=$(terraform output -raw eks_cluster_name)
  log "RDS: ${RDS_ENDPOINT}"
  log "EKS: ${EKS_CLUSTER}"
  cd -
}

tf_destroy() {
  section "Terraform Destroy"
  warn "This will DELETE all AWS resources!"
  read -p "Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || error "Aborted"
  cd "${TF_DIR}"
  terraform destroy \
    -var="aws_region=${AWS_REGION}" \
    -var="db_password=${TF_VAR_db_password:-placeholder}"
  cd -
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Build Docker images
# ═══════════════════════════════════════════════════════════════════════════════
build_images() {
  section "Building Docker Images (tag: ${IMAGE_TAG})"

  # Frontend
  log "Building frontend..."
  docker build \
    -f ./docker/Dockerfile.frontend \
    -t "${ECR_FRONTEND}:${IMAGE_TAG}" \
    -t "${ECR_FRONTEND}:latest" \
    "${FRONTEND_DIR}"

  # Backend
  log "Building backend..."
  docker build \
    -f ./docker/Dockerfile.backend \
    -t "${ECR_BACKEND}:${IMAGE_TAG}" \
    -t "${ECR_BACKEND}:latest" \
    "${BACKEND_DIR}"

  log "Images built successfully"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Push to ECR
# ═══════════════════════════════════════════════════════════════════════════════
push_images() {
  section "Pushing Images to ECR"

  # Authenticate with ECR
  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  log "ECR login successful"

  # Push frontend
  docker push "${ECR_FRONTEND}:${IMAGE_TAG}"
  docker push "${ECR_FRONTEND}:latest"
  log "Frontend pushed: ${ECR_FRONTEND}:${IMAGE_TAG}"

  # Push backend
  docker push "${ECR_BACKEND}:${IMAGE_TAG}"
  docker push "${ECR_BACKEND}:latest"
  log "Backend pushed: ${ECR_BACKEND}:${IMAGE_TAG}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Configure kubectl
# ═══════════════════════════════════════════════════════════════════════════════
setup_kubectl() {
  section "Configuring kubectl"
  aws eks update-kubeconfig \
    --region "${AWS_REGION}" \
    --name "${CLUSTER_NAME}"
  kubectl cluster-info
  log "kubectl configured"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Install AWS Load Balancer Controller via Helm
# ═══════════════════════════════════════════════════════════════════════════════
install_alb_controller() {
  section "Installing AWS Load Balancer Controller"

  # Add EKS Helm repo
  helm repo add eks https://aws.github.io/eks-charts
  helm repo update

  # Download IAM policy
  curl -fsSL \
    https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json \
    -o /tmp/alb-iam-policy.json

  # Create IAM policy (ignore if exists)
  aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file:///tmp/alb-iam-policy.json 2>/dev/null || true

  # Install controller
  helm upgrade --install aws-load-balancer-controller \
    eks/aws-load-balancer-controller \
    --namespace kube-system \
    --set clusterName="${CLUSTER_NAME}" \
    --set serviceAccount.create=true \
    --set region="${AWS_REGION}" \
    --set vpcId="$(aws eks describe-cluster --name ${CLUSTER_NAME} \
                   --query 'cluster.resourcesVpcConfig.vpcId' --output text)"

  log "ALB Controller installed"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Deploy Kubernetes manifests
# ═══════════════════════════════════════════════════════════════════════════════
deploy_k8s() {
  section "Deploying to Kubernetes"

  # Update image tags in manifests
  sed -i "s|:latest|:${IMAGE_TAG}|g" "${K8S_DIR}"/01-backend.yaml
  sed -i "s|:latest|:${IMAGE_TAG}|g" "${K8S_DIR}"/02-frontend.yaml

  # Update ECR URLs
  sed -i "s|123456789012.dkr.ecr.ap-south-1.amazonaws.com|${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com|g" \
    "${K8S_DIR}"/01-backend.yaml "${K8S_DIR}"/02-frontend.yaml

  # Apply all manifests
  kubectl apply -f "${K8S_DIR}/00-namespace.yaml"
  kubectl apply -f "${K8S_DIR}/01-backend.yaml"
  kubectl apply -f "${K8S_DIR}/02-frontend.yaml"
  kubectl apply -f "${K8S_DIR}/03-ingress.yaml"

  # Wait for rollout
  log "Waiting for backend rollout..."
  kubectl rollout status deployment/election-backend -n election --timeout=5m

  log "Waiting for frontend rollout..."
  kubectl rollout status deployment/election-frontend -n election --timeout=5m

  # Show status
  section "Deployment Status"
  kubectl get pods,svc,ingress -n election

  # Get ALB URL
  log "Getting load balancer URL..."
  sleep 20
  LB_URL=$(kubectl get ingress election-ingress -n election \
           -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending...")
  echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  🗳  ElectionPulse WB is LIVE!               ║${NC}"
  echo -e "${GREEN}║  URL: http://${LB_URL}   ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}\n"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Full status check
# ═══════════════════════════════════════════════════════════════════════════════
status() {
  section "Cluster Status"
  kubectl get nodes -o wide
  echo ""
  kubectl get pods,svc,hpa,ingress -n election -o wide
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main — parse argument
# ═══════════════════════════════════════════════════════════════════════════════
case "${1:-all}" in
  plan)    tf_init && tf_plan ;;
  apply)   tf_init && tf_plan && tf_apply ;;
  destroy) tf_destroy ;;
  build)   build_images ;;
  push)    push_images ;;
  k8s)     setup_kubectl && install_alb_controller && deploy_k8s ;;
  status)  setup_kubectl && status ;;
  all)
    tf_init
    tf_plan
    tf_apply
    build_images
    push_images
    setup_kubectl
    install_alb_controller
    deploy_k8s
    ;;
  *)
    echo "Usage: $0 [plan|apply|destroy|build|push|k8s|status|all]"
    exit 1
    ;;
esac
