# ElectionPulse WB — AWS Deployment Guide
## Stack: Terraform + EKS + RDS + ECR + ALB

```
┌─────────────────────────────────────────────────────────┐
│                    ARCHITECTURE                         │
│                                                         │
│  Internet                                               │
│     │                                                   │
│     ▼                                                   │
│  Route 53 (DNS)                                         │
│     │                                                   │
│     ▼                                                   │
│  AWS ALB (Application Load Balancer)                    │
│     │  HTTPS:443 → HTTP:80                              │
│     ▼                                                   │
│  ┌──────────────────────────────┐                       │
│  │  EKS Cluster (ap-south-1)    │                       │
│  │  ┌────────────────────────┐  │                       │
│  │  │ Namespace: election    │  │                       │
│  │  │                        │  │                       │
│  │  │  [Frontend Pod x2]     │  │                       │
│  │  │   nginx + React        │  │                       │
│  │  │   /api/* → backend     │  │                       │
│  │  │        │               │  │                       │
│  │  │  [Backend Pod x2]      │  │                       │
│  │  │   ASP.NET Core 8       │  │                       │
│  │  │        │               │  │                       │
│  │  └────────┼───────────────┘  │                       │
│  └───────────┼──────────────────┘                       │
│              │                                          │
│              ▼                                          │
│  RDS SQL Server (private subnet)                        │
│  Database: ElectionWB                                   │
│  Table:    Election_WB_2026                             │
│                                                         │
│  ECR Repositories:                                      │
│    electionpulse-wb/frontend                            │
│    electionpulse-wb/backend                             │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Install these tools on your machine:

```bash
# 1. AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install

# 2. Terraform >= 1.6
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip && sudo mv terraform /usr/local/bin/

# 3. kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# 4. Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 5. Docker Desktop or Docker Engine
# https://docs.docker.com/get-docker/
```

---

## Step-by-Step Deployment

### Step 1 — Configure AWS

```bash
aws configure
# AWS Access Key ID:     <your-access-key>
# AWS Secret Access Key: <your-secret-key>
# Default region:        ap-south-1
# Default output format: json
```

### Step 2 — Create Terraform backend (S3 + DynamoDB for state locking)

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://electionpulse-wb-tfstate --region ap-south-1
aws s3api put-bucket-versioning \
  --bucket electionpulse-wb-tfstate \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket electionpulse-wb-tfstate \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name electionpulse-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

### Step 3 — Set secrets as environment variables

```bash
export TF_VAR_db_password="YourStrongPassword123!"
# Never commit passwords to git
```

### Step 4 — Deploy infrastructure with Terraform

```bash
cd deployment/

# Option A: Run all steps automatically
chmod +x scripts/deploy.sh
./scripts/deploy.sh all

# Option B: Step by step
./scripts/deploy.sh plan     # Review changes
./scripts/deploy.sh apply    # Create AWS resources (~15-20 minutes)
./scripts/deploy.sh build    # Build Docker images
./scripts/deploy.sh push     # Push to ECR
./scripts/deploy.sh k8s      # Deploy to Kubernetes
```

### Step 5 — Verify deployment

```bash
# Check all pods are running
kubectl get pods -n election

# Expected output:
# NAME                                  READY   STATUS    RESTARTS
# election-backend-7d8f9b6c5-abc12      1/1     Running   0
# election-backend-7d8f9b6c5-def34      1/1     Running   0
# election-frontend-6c4d8e9f7-ghi56     1/1     Running   0
# election-frontend-6c4d8e9f7-jkl78     1/1     Running   0

# Get load balancer URL
kubectl get ingress -n election
```

### Step 6 — Import existing database

```bash
# Get RDS endpoint
RDS_ENDPOINT=$(cd terraform && terraform output -raw rds_endpoint)

# Connect and restore your Test_Wasim database
# Use SQL Server Management Studio or sqlcmd:
sqlcmd -S "${RDS_ENDPOINT}" -U sa -P "YourPassword" \
  -Q "RESTORE DATABASE [ElectionWB] FROM DISK='s3://your-backup-bucket/Election_WB_2026.bak'"
```

---

## File Structure

```
deployment/
├── scripts/
│   └── deploy.sh              ← Main deployment script
├── docker/
│   ├── Dockerfile.frontend    ← React + nginx image
│   ├── Dockerfile.backend     ← ASP.NET Core 8 image
│   ├── nginx.conf             ← nginx config with /api proxy
│   └── docker-compose.yml     ← Local testing
├── terraform/
│   ├── main.tf                ← Root module (VPC+EKS+ECR+RDS)
│   ├── variables.tf           ← All input variables
│   └── modules/
│       ├── vpc/main.tf        ← VPC, subnets, NAT, IGW
│       ├── eks/main.tf        ← EKS cluster, node group, OIDC
│       ├── ecr/main.tf        ← Container registries
│       └── rds/main.tf        ← SQL Server on RDS
└── kubernetes/
    └── base/
        ├── 00-namespace.yaml  ← Namespace + ConfigMap + Secret
        ├── 01-backend.yaml    ← Backend Deployment + Service + HPA
        ├── 02-frontend.yaml   ← Frontend Deployment + Service + HPA
        └── 03-ingress.yaml    ← ALB Ingress + NetworkPolicy
```

---

## Cost Estimate (ap-south-1 / Mumbai)

| Resource | Spec | Monthly Cost (USD) |
|---|---|---|
| EKS Cluster | Control plane | ~$72 |
| EC2 Nodes | 2× t3.medium | ~$60 |
| RDS SQL Server | db.t3.medium SE | ~$180 |
| NAT Gateway | 1× | ~$45 |
| ALB | Per hour + data | ~$25 |
| ECR | Storage + transfer | ~$5 |
| **Total** | | **~$387/month** |

To reduce cost in dev: use `db.t3.small`, 1 node, no Multi-AZ.

---

## Teardown

```bash
# Delete Kubernetes resources first
kubectl delete namespace election

# Then destroy AWS infrastructure
./scripts/deploy.sh destroy
```
