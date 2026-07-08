#!/usr/bin/env bash

set -euo pipefail

AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME="electionpulse-wb-eks"
ECR_FRONTEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/electionpulse-wb/frontend"
ECR_BACKEND="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/electionpulse-wb/backend"
ECR_MIGRATION="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/electionpulse-wb/migration"

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
TF_DIR="./terraform"
K8S_DIR="/home/ubuntu/ElectionPulse-WB/deployment/kubernetes/base"
FRONTEND_DIR="../election-frontend-wb"
BACKEND_DIR="../ElectionAPI_WB"

# Database variables extracted from your configurations
DB_USER="sa"
DB_PASS="${TF_VAR_db_password}"
DB_NAME="ElectionDB"
S3_BUCKET="biryani-bucket-0027"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()     { echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠ $1${NC}"; }
error()   { echo -e "${RED}[$(date +'%H:%M:%S')] ✗ $1${NC}"; exit 1; }
section() { echo -e "\n${CYAN}══════════════════════════════════════${NC}"; \
            echo -e "${BLUE} $1${NC}"; \
            echo -e "${CYAN}══════════════════════════════════════${NC}\n"; }

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

  RAW_ENDPOINT=$(terraform output -raw endpoint)
  export RDS_ENDPOINT=$(echo "${RAW_ENDPOINT}" | cut -d':' -f1)
  export EKS_CLUSTER=$(terraform output -raw eks_cluster_name)
  log "RDS Host: ${RDS_ENDPOINT}"
  log "EKS Cluster: ${EKS_CLUSTER}"
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

build_images() {
  section "Building Docker Images (tag: ${IMAGE_TAG})"
  
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
  
  cd "${PROJECT_ROOT}"
  log "Locked context to project root directory: $(pwd)" 

  log "Building frontend..."
  docker build \
    -f deployment/docker/Dockerfile.frontend \
    -t "${ECR_FRONTEND}:${IMAGE_TAG}" \
    -t "${ECR_FRONTEND}:latest" \
    .

  log "Building backend..."
  docker build \
    -f deployment/docker/Dockerfile.backend \
    -t "${ECR_BACKEND}:${IMAGE_TAG}" \
    -t "${ECR_BACKEND}:latest" \
    .

  log "Building database migration sandbox..."
  docker build \
    -f deployment/docker/Dockerfile.migration \
    -t "${ECR_MIGRATION}:${IMAGE_TAG}" \
    -t "${ECR_MIGRATION}:latest" \
    .

  log "Images built successfully"
}

push_images() {
  section "Pushing Images to ECR"

  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  log "ECR login successful"

  docker push "${ECR_FRONTEND}:${IMAGE_TAG}"
  docker push "${ECR_FRONTEND}:latest"
  log "Frontend pushed: ${ECR_FRONTEND}:${IMAGE_TAG}"

  docker push "${ECR_BACKEND}:${IMAGE_TAG}"
  docker push "${ECR_BACKEND}:latest"
  log "Backend pushed: ${ECR_BACKEND}:${IMAGE_TAG}"

  docker push "${ECR_MIGRATION}:${IMAGE_TAG}"
  docker push "${ECR_MIGRATION}:latest"
  log "Migration worker pushed: ${ECR_MIGRATION}:${IMAGE_TAG}"
}

setup_kubectl() {
  section "Configuring kubectl"
  aws eks update-kubeconfig \
    --region "${AWS_REGION}" \
    --name "${CLUSTER_NAME}"
  kubectl cluster-info
  log "kubectl configured"
}


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


run_db_migration() {
  section "Executing S3 Native Database Restore via EKS"

  if [ -z "${RDS_ENDPOINT:-}" ]; then
    cd "${TF_DIR}"
    RAW_ENDPOINT=$(terraform output -raw endpoint)
    export RDS_ENDPOINT=$(echo "${RAW_ENDPOINT}" | cut -d':' -f1)
    cd - > /dev/null
  fi

  log "Configuring namespace and database configuration dependencies..."
  # Explicitly export everything envsubst needs
  export AWS_ACCOUNT_ID AWS_REGION RDS_ENDPOINT DB_USER DB_PASS DB_NAME S3_BUCKET IMAGE_TAG ECR_MIGRATION
  
  envsubst < "${K8S_DIR}/00-namespace.yaml" | kubectl apply -f -

  log "Cleaning up old migration runs..."
  kubectl delete job rds-data-migration -n election --ignore-not-found=true

  log "Deploying migration task runner onto EKS cluster..."
  
  # Catch any hidden validation or parsing errors during deployment
  if ! envsubst < "${K8S_DIR}/04-migration-job.yaml" | kubectl apply -f -; then
    error "Kubernetes rejected the generated 04-migration-job.yaml file! Check variable substitutions."
  fi

  log "Waiting for SQL Server database backup restoration to finish..."
  # Bumped timeout to 600s since SQL Server S3 native restore operations are slow
  if ! kubectl wait --for=condition=complete job/rds-data-migration --timeout=600s -n election; then
    warn "Job did not complete cleanly or timed out. Fetching pod logs before failure handling..."
    kubectl describe job rds-data-migration -n election || true
    kubectl logs -n election -l job-name=rds-data-migration --tail=100 || true
    error "Database migration failed or timed out! Halting application rollout."
  fi

  log "Database migration and validation loop finished cleanly!"
}


deploy_k8s() {
  section "Deploying to Kubernetes"

  if [ -z "${RDS_ENDPOINT:-}" ]; then
    cd "${TF_DIR}"
    RAW_ENDPOINT=$(terraform output -raw endpoint)
    export RDS_ENDPOINT=$(echo "${RAW_ENDPOINT}" | cut -d':' -f1)
    cd -
  fi

  export ENVIRONMENT="${ENVIRONMENT:-dev}"
  export ASPNETCORE_ENV=$(if [ "${ENVIRONMENT}" == "prod" ]; then echo "Production"; else echo "Development"; fi)
  export AWS_ACCOUNT_ID AWS_REGION IMAGE_TAG RDS_ENDPOINT DB_USER DB_PASS DB_NAME

  envsubst < "${K8S_DIR}/00-namespace.yaml" | kubectl apply -f -
  envsubst < "${K8S_DIR}/01-backend.yaml"   | kubectl apply -f -
  envsubst < "${K8S_DIR}/02-frontend.yaml"  | kubectl apply -f -
  envsubst < "${K8S_DIR}/03-ingress.yaml"   | kubectl apply -f -

  log "Waiting for backend rollout..."
  kubectl rollout status deployment/election-backend -n election --timeout=5m

  log "Waiting for frontend rollout..."
  kubectl rollout status deployment/election-frontend -n election --timeout=5m

  section "Deployment Status"
  kubectl get pods,svc,ingress -n election

  log "Getting load balancer URL..."
  sleep 20
  LB_URL=$(kubectl get ingress election-ingress -n election \
           -o jsonpath='{.status.loadBalancer.ingress.hostname}' 2>/dev/null || echo "pending...")
  echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  🗳  ElectionPulse WB is LIVE!               ║${NC}"
  echo -e "${GREEN}║  URL: http://${LB_URL}   ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}\n"
}

status() {
  section "Cluster Status"
  kubectl get nodes -o wide
  echo ""
  kubectl get pods,svc,hpa,ingress -n election -o wide
}

case "${1:-all}" in
  init)        tf_init ;;
  plan)        tf_plan ;;
  apply)       tf_apply ;;
  destroy)     tf_destroy ;;
  build)       build_images ;;
  push)        push_images ;;
  alb)         install_alb_controller ;;
  migrate)     run_db_migration ;;
  deploy)      deploy_k8s ;;
  status)      status ;;
  all)         tf_init; tf_plan; tf_apply; setup_kubectl; build_images; push_images; install_alb_controller; run_db_migration; deploy_k8s ;;
  *)           echo "Usage: $0 {init|plan|apply|destroy|build|push|alb|migrate|deploy|status|all}" ;;
esac
