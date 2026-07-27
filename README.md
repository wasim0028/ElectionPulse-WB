# ElectionPulse WB — AWS Deployment Guide

## Stack: Terraform + EKS + RDS + ECR + ALB + ArgoCD (GitOps) + GitHub Actions (CI/CD)

```
┌───────────────────────────────────────────────────────────────────┐
│                          ARCHITECTURE                              │
│                                                                     │
│  Internet                                                          │
│     │                                                              │
│     ▼                                                              │
│  AWS ALB (Application Load Balancer, HTTP-only currently)          │
│     │  :80                                                         │
│     ▼                                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  EKS Cluster (ap-south-1)                                  │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Namespace: election                                  │  │    │
│  │  │                                                       │  │    │
│  │  │  [Frontend Pod x2]  nginx + React, uid 101 (non-root) │  │    │
│  │  │        │ /api/* → backend-svc                        │  │    │
│  │  │  [Backend Pod x2]   ASP.NET Core 8                    │  │    │
│  │  └──────────────────────┬────────────────────────────────┘  │    │
│  │  Namespace: argocd                                         │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ ArgoCD — watches this git repo, auto-syncs on push    │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │  Namespace: kube-system                                    │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ AWS Load Balancer Controller — IRSA-scoped IAM role   │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └──────────────────────┼───────────────────────────────────────┘    │
│                         ▼                                          │
│  RDS SQL Server (private subnet)                                   │
│  Database: ElectionDB, restored from S3 via native RDS restore     │
│                                                                     │
│  ECR: electionpulse-wb/{frontend,backend,migration}                │
│                                                                     │
│  GitHub Actions:                                                   │
│    ci-cd.yml       → build/push images, bump Kustomize image tags  │
│    terraform.yml   → plan on PR, apply on push (manual approval)   │
│  Both authenticate via OIDC — no long-lived AWS keys in GitHub.    │
└───────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

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

# 5. Docker Engine
sudo wget https://raw.githubusercontent.com/lerndevops/labs/master/scripts/installDocker.sh -P /tmp
sudo chmod 755 /tmp/installDocker.sh
sudo bash /tmp/installDocker.sh

# 6. kustomize (standalone binary — NOT snap, snap's sandbox blocks
#    access to paths outside $HOME and will fail with confusing
#    "permission denied" errors on a non-standard home directory)
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/

# 7. ArgoCD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64
```

---

## Repo Structure

```
.
├── ElectionAPI_WB/              ← ASP.NET Core backend source
├── election-frontend-wb/        ← React frontend source
├── argocd/
│   ├── root-app.yaml            ← app-of-apps, applied ONCE manually
│   └── apps/
│       └── electionpulse-wb-app.yaml
├── .github/workflows/
│   ├── ci-cd.yml                ← build/push images, bump image tags
│   └── terraform.yml            ← plan (PR) / apply (push), manual approval gate
├── GITOPS_BOOTSTRAP.md          ← one-time GitOps setup, step by step
└── deployment/
    ├── docker/
    │   ├── Dockerfile.frontend  ← multi-stage, runs as uid 101 (non-root)
    │   ├── Dockerfile.backend
    │   ├── Dockerfile.migration ← python + pyodbc, idempotent restore
    │   ├── migrate.py
    │   ├── nginx.conf           ← proxies /api/ → election-backend-svc
    │   └── docker-compose.yml
    ├── kubernetes/base/
    │   ├── kustomization.yaml   ← image tag management, ArgoCD entrypoint
    │   ├── 00-namespace.yaml    ← ConfigMap ONLY (Secret deliberately not here)
    │   ├── 01-backend.yaml
    │   ├── 02-frontend.yaml
    │   ├── 03-ingress.yaml      ← HTTP-only until a real ACM cert exists
    │   ├── 04-migration-job.yaml← PreSync hook, pinned to :latest
    │   └── external-secret.yaml← optional ESO + Secrets Manager path
    ├── scripts/
    │   └── deploy.sh            ← legacy CLI pipeline + pre-destroy ALB cleanup
    └── terraform/
        ├── main.tf              ← root: VPC, EKS, RDS, ECR modules
        ├── github-oidc.tf       ← GitHub Actions OIDC roles (2, least-privilege)
        └── modules/{vpc,ecr,eks,rds}/
```

---

## Step-by-Step Deployment (Fresh Bring-Up)

### Step 1 — AWS credentials & Terraform backend (one-time, first machine setup only)

```bash
aws configure
# Region: ap-south-1

aws s3 mb s3://electionpulse-wb-tfstate --region ap-south-1
aws s3api put-bucket-versioning --bucket electionpulse-wb-tfstate --versioning-configuration Status=Enabled
aws dynamodb create-table \
  --table-name electionpulse-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region ap-south-1
```

### Step 2 — Set your DB password for this session

```bash
export TF_VAR_db_password='<choose-a-strong-password>'
```
You will re-export this every time you open a new terminal session — it does not persist automatically. **Forgetting this is the #1 cause of a blank `DB_PASS` in the Kubernetes Secret**, which silently produces `Missing required database configuration values` inside the migration pod.

### Step 3 — Terraform (via CLI — see note on GitHub Actions below)

```bash
cd deployment
./scripts/deploy.sh init
./scripts/deploy.sh plan
./scripts/deploy.sh apply
```
Takes ~15-20 minutes, mostly the EKS node group. **Let it run to full completion — do not Ctrl+C or close the terminal mid-run.** Interrupting it is the #1 cause of a stuck DynamoDB state lock (see Troubleshooting).

### Step 4 — kubectl + ALB Controller

```bash
aws eks update-kubeconfig --region ap-south-1 --name electionpulse-wb-eks
kubectl get nodes -w        # wait for Ready, then Ctrl+C
./scripts/deploy.sh alb
```

### Step 5 — Build & push images

```bash
./scripts/deploy.sh build
./scripts/deploy.sh push
```

### Step 6 — Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml \
  --server-side --force-conflicts
kubectl get pods -n argocd -w    # wait for all Running, then Ctrl+C
```
`--server-side --force-conflicts` avoids a known ArgoCD CRD install error
(`metadata.annotations: Too long`) caused by the size of the `ApplicationSet` CRD.

### Step 7 — Apply the root Application (the only manual `kubectl apply` you should ever need)

```bash
cd ..
kubectl apply -f argocd/root-app.yaml
kubectl get applications -n argocd
```

### Step 8 — Let the first sync fail once on the missing Secret — this is expected

```bash
kubectl get pods -n election
```
Wait for `CreateContainerConfigError` mentioning `election-db-secret`. This
is not a bug — the Secret is deliberately excluded from git (see
Architecture Decisions below) and must be bootstrapped once per fresh
cluster.

### Step 9 — Bootstrap the Secret (required every time you get a NEW RDS endpoint)

```bash
kubectl create secret generic election-db-secret \
  --from-literal=DB_HOST="$(cd deployment/terraform && terraform output -raw endpoint | cut -d':' -f1)" \
  --from-literal=DB_USER=sa \
  --from-literal=DB_PASS="${TF_VAR_db_password}" \
  -n election --dry-run=client -o yaml | kubectl apply -f -

# VERIFY it's non-empty before continuing
kubectl get secret election-db-secret -n election -o jsonpath='{.data}'
echo ""
```

### Step 10 — Resync

```bash
kubectl delete job rds-data-migration -n election --ignore-not-found=true
kubectl annotate application electionpulse-wb -n argocd argocd.argoproj.io/refresh=hard --overwrite
sleep 90
kubectl get pods -n election
```

**If this doesn't progress after 90 seconds, see "ArgoCD login / stuck sync" in Troubleshooting below — this is the single most common snag in the whole bring-up.**

### Step 11 — Get the URL

```bash
kubectl get ingress election-ingress -n election -o jsonpath='{.status.loadBalancer.ingress.hostname}'
```
Open `http://<hostname>` (plain HTTP — no TLS cert configured yet).

---

## Troubleshooting

### ArgoCD shows `OutOfSync` forever and `kubectl annotate refresh=hard` doesn't help

This is the single most common stall point in this whole pipeline. ArgoCD's
background reconciliation loop occasionally doesn't notice that a `PreSync`
hook (the migration Job) actually finished, and just sits there. A hard
refresh re-compares state but does **not** always force a genuinely new
sync attempt.

**Fix — use the ArgoCD CLI directly, it's more forceful than the annotation:**

```bash
# Port-forward to the ArgoCD API server
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
sleep 3

# Get the admin password (only needed once per cluster — same password
# persists across logins unless you change it)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
echo ""

# Log in
argocd login localhost:8080 --username admin --password '<paste-password>' --insecure

# Force a real sync
argocd app sync electionpulse-wb
```

**If `argocd app sync` errors with `another operation is already in progress`:**
```bash
argocd app terminate-op electionpulse-wb
argocd app sync electionpulse-wb
```

**If `terminate-op` says `No operation is in progress` but pods are still stale/unchanged:**
```bash
kubectl patch application electionpulse-wb -n argocd --type merge -p '{"operation": null}'
kubectl annotate application electionpulse-wb -n argocd argocd.argoproj.io/refresh=hard --overwrite
```

**If `kubectl port-forward` fails with `address already in use`:** a prior
port-forward from an earlier session is probably still alive and usable —
just skip straight to the `argocd login` step; you likely don't need a new one.

### Migration Job stuck `Terminating` forever after `kubectl delete job`

The Job has an orphaned `argocd.argoproj.io/hook-finalizer` that nothing is
currently clearing (usually because the ArgoCD `Application` object was
deleted/recreated while the hook was mid-lifecycle). Force-clear it directly:

```bash
kubectl patch job rds-data-migration -n election -p '{"metadata":{"finalizers":[]}}' --type=merge
kubectl get job rds-data-migration -n election   # should now be NotFound
```

### Migration pod: `Database 'ElectionDB' already exists`

A previous run already restored successfully — this isn't a new failure,
it means the data is already there. Drop it and let the next sync redo a
clean restore. The migration script has since been made idempotent (checks
for existing DB and skips cleanly), so this should no longer block anything
going forward.

### `Error acquiring the state lock` (Terraform)

Almost always caused by an interrupted `apply`/`destroy`/`plan`, or by
running Terraform from **two places at once** (local CLI + the GitHub
Actions `terraform.yml` workflow, both pointing at the same state). Force-
unlock using the **exact** ID shown in the error (case-sensitive `yes` required):

```bash
terraform force-unlock <lock-id-from-error>
```
Then check `terraform show | head -20` before retrying, to confirm state
wasn't left in a half-applied condition. **Going forward: don't run local
CLI Terraform and the GitHub Actions Terraform workflow concurrently.**

### `terraform destroy` leaves a stuck VPC / ALB behind

The AWS Load Balancer Controller creates real ALBs dynamically, entirely
outside Terraform's state. Always use `./scripts/deploy.sh destroy` (not
raw `terraform destroy`) — it runs a `pre_destroy_cleanup` step first that
deletes the Ingress and waits for the ALB to actually disappear from AWS
before Terraform ever touches the VPC/subnets.

### GitHub Actions Terraform workflow: various `AccessDenied`/`Forbidden` errors

The `github-actions-terraform` IAM role is deliberately least-privilege
(see `github-oidc.tf`), not blanket admin access. If you add new resource
types to Terraform, you will likely need to add a matching scoped policy
statement for that service — this already happened for S3/DynamoDB
(backend state access) and EKS (control-plane API calls), each caught only
once the workflow actually tried that specific action for the first time.

### `sed`/copy-paste corrupting `04-migration-job.yaml` with a stray trailing quote

Historical bug, now fixed — `ci-cd.yml`'s old auto-tagging step used a
fragile `sed` pattern that assumed the image line was already quoted. It
wasn't, so every automated run appended a literal `"` character, producing
an invalid image reference (`InvalidImageName`). Fixed by removing that
`sed` entirely and pinning the migration job permanently to `:latest`
instead of a commit-hash tag. If you ever see a stray `"` in an image
string again, it means an old cached copy of `ci-cd.yml` or a stale
runbook is being followed instead of the current committed version —
always trust `git show HEAD:<file>`, never a saved local reference.

---

## Architecture Decisions Worth Knowing

- **The database Secret is deliberately excluded from git**, unlike
  everything else in `deployment/kubernetes/base/`. ArgoCD re-applies
  every git-tracked resource on every sync using a 3-way merge — a Secret
  manifest with no `data`/`stringData` fields would get re-applied *empty*
  on every single sync, silently stripping out whatever credentials were
  bootstrapped manually. This was the root cause of a full day of
  "the secret keeps vanishing" incidents before being tracked down.
- **The Namespace is managed via `syncOptions: [CreateNamespace=true]`**,
  not as an explicit git-tracked `Namespace` resource. Declaring it
  explicitly as a `PreSync` hook caused ArgoCD to fully delete and
  recreate the namespace on every single sync (not just the first),
  cascading a full wipe of anything inside it, including the bootstrapped
  Secret.
- **The migration Job uses `hook-delete-policy: HookSucceeded,BeforeHookCreation`.**
  Kubernetes Jobs are immutable — you cannot update an existing Job's pod
  template in place. Without `BeforeHookCreation`, a failed Job is never
  cleaned up automatically, and every subsequent sync tries (and silently
  fails) to apply a corrected manifest onto that same stale, immutable
  object.
- **Two separate GitHub OIDC IAM roles**, not one broad one:
  `github-actions-ecr-push` (image build/push only) and
  `github-actions-terraform` (infra changes, gated behind a
  `production` environment approval). A compromised or buggy CI run
  should never be able to touch RDS, IAM, or the VPC.

---

## Cost Estimate (ap-south-1 / Mumbai)

| Resource | Spec | Monthly Cost (USD) |
|---|---|---|
| EKS Cluster | Control plane | ~$72 |
| EC2 Nodes | 2× (per `node_group_config`) | ~$60 |
| RDS SQL Server | db.t3.small, single-AZ (dev) | ~$90–180 |
| NAT Gateway | 1× | ~$45 |
| ALB | Per hour + data | ~$25 |
| ECR | Storage + transfer | ~$5 |
| **Total (dev)** | | **~$300–390/month** |

---

## Teardown

```bash
cd deployment
./scripts/deploy.sh destroy
```
**Always use this, not raw `terraform destroy`** — see Troubleshooting
above for why. Type `yes` when prompted; let it run to full completion.
