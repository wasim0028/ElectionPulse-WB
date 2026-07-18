# GitOps Bootstrap — GitHub Actions + ArgoCD

This is the one-time setup, in order. After this, the daily workflow is
just: commit, push, merge. No manual kubectl, no manual terraform apply.

## Step 0 — File placement

```
deployment/terraform/github-oidc.tf                        (new)
deployment/kubernetes/base/kustomization.yaml               (new)
deployment/kubernetes/base/00-namespace.yaml                (replace)
deployment/kubernetes/base/01-backend.yaml                  (replace)
deployment/kubernetes/base/02-frontend.yaml                 (replace)
deployment/kubernetes/base/04-migration-job.yaml            (replace)
deployment/kubernetes/base/external-secret.yaml             (new, optional)
argocd/root-app.yaml                                        (new)
argocd/apps/electionpulse-wb.yaml                           (new)
.github/workflows/ci-cd.yml                                 (new)
.github/workflows/terraform.yml                             (new)
```

## Step 1 — Apply the GitHub OIDC roles

This has to happen before either GitHub Actions workflow can authenticate
to AWS at all.

```bash
cd deployment/terraform
terraform apply
terraform output github_actions_ecr_push_role_arn
terraform output github_actions_terraform_role_arn
```

## Step 2 — Set GitHub repo variables (not secrets — these are ARNs, not credentials)

In GitHub: **Settings → Secrets and variables → Actions → Variables tab**

| Name | Value |
|---|---|
| `AWS_ECR_PUSH_ROLE_ARN` | output from `github_actions_ecr_push_role_arn` above |
| `AWS_TERRAFORM_ROLE_ARN` | output from `github_actions_terraform_role_arn` above |

Also set one **secret** (Secrets tab, not Variables):

| Name | Value |
|---|---|
| `DB_PASSWORD` | your RDS master password (used by terraform.yml's `TF_VAR_db_password`) |

## Step 3 — Set up branch protection + environment approval gate

`terraform.yml`'s `apply` job references `environment: production`. Create it:
**Settings → Environments → New environment → "production" → add yourself as a required reviewer.**
This is what makes infra changes require a manual approval click before
`terraform apply` runs on merge — the safety net replacing "I'll just run
it myself and watch closely."

## Step 4 — Install ArgoCD in the cluster (one-time, imperative — this is the
one legitimate exception to "no manual kubectl," since ArgoCD is what makes
everything after this GitOps-managed)

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for it to come up
kubectl get pods -n argocd -w
```

Get the initial admin password and log in (via port-forward, or expose via
Ingress later if you want the UI reachable without a tunnel):
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
Open `https://localhost:8080`, log in as `admin` with that password.

## Step 5 — Bootstrap the database secret (one-time, imperative — same reasoning as Step 4)

If you're NOT using the `external-secret.yaml`/ESO path yet:
```bash
kubectl create secret generic election-db-secret \
  --from-literal=DB_HOST=electionpulse-wb-sqlserver.c9os04k0moam.ap-south-1.rds.amazonaws.com \
  --from-literal=DB_USER=sa \
  --from-literal=DB_PASS='<your-actual-password>' \
  -n election --dry-run=client -o yaml | kubectl apply -f -
```
(`--dry-run=client -o yaml | kubectl apply -f -` instead of plain `create`
so this is safely re-runnable without an "already exists" error.)

## Step 6 — Apply the ArgoCD root Application (one-time, imperative — this is
the LAST manual kubectl command you should ever need to run for this project)

```bash
kubectl apply -f argocd/root-app.yaml
```
From this point forward, ArgoCD watches `argocd/apps/` in git. Adding
`argocd/apps/electionpulse-wb.yaml` to the repo (already done in this
commit) means ArgoCD picks it up on its next sync automatically — you
don't `kubectl apply` the child Application separately.

## Step 7 — Verify

```bash
kubectl get applications -n argocd
argocd app get electionpulse-wb   # if you have the argocd CLI installed
```
You should see `electionpulse-wb` sync automatically, run the migration
Job as a PreSync hook, then bring up backend/frontend/ingress.

## Step 8 — Confirm the actual GitOps loop end-to-end

Make a trivial change (bump a resource limit, tweak a replica count),
commit, push to `main`. Watch:
1. `ci-cd.yml` builds + pushes images, bumps `kustomization.yaml`'s tags, commits back
2. ArgoCD detects the new commit (default poll interval: 3 minutes, or configure a webhook for instant sync)
3. ArgoCD reconciles the cluster to match

That commit-to-cluster loop, with no human running `kubectl apply` at any
point, is the actual deliverable here.

## What's still manual, and why that's fine for now

- Terraform infra changes require a human clicking "approve" in the
  `production` environment gate (Step 3) — intentional, not a gap.
- The database Secret's initial creation (Step 5) is imperative unless you
  adopt ESO — also intentional, since committing real credentials to git
  is worse than one manual bootstrap command.
- ArgoCD's own installation (Step 4) and the root Application (Step 6) are
  the literal bootstrap of the GitOps system itself — you can't GitOps your
  way into having GitOps; something has to apply the first Application.
