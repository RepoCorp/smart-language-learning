# Low-Cost Deployment Option

This document adds a lower-cost deployment path for personal use. It does **not** replace the existing AWS ECS Fargate documentation in [`aws-deploy/README.md`](../aws-deploy/README.md).

## When this option makes sense

Use this option if:

- the app is used by only one person or a very small number of users
- you want a much lower monthly cost than ECS + ALB + RDS
- you are comfortable with a single-server setup and simpler operational guarantees

Do **not** use this as the main documented production path for a larger public app.

## Recommended low-cost architecture

Use a lighter managed AWS setup:

- frontend: **Amplify Hosting** backed by an S3 deploy bucket
- backend: **Amazon Lightsail container service**
- persistence:
  - keep the current shared PostgreSQL database
  - keep audio/image storage on S3 for now

This keeps the application structure close to the current project:

- `frontend`
- `backend`

That means the cost reduction comes mostly from simplifying hosting, not from changing the app architecture.

## Why this is much cheaper

The current AWS blueprint uses several paid building blocks:

- ECS Fargate for backend
- ECS Fargate for frontend
- Application Load Balancer
- RDS PostgreSQL
- ECR
- CloudWatch logs

For a one-user app, the biggest savings usually come from collapsing:

- two always-on containers -> one small VM
- ALB -> reverse proxy on that VM

You can still keep:

- your domain
- HTTPS
- the current shared PostgreSQL database
- S3 media storage

## Current app fit

This repository already fits a single-server deployment fairly well:

- local/dev already uses Docker Compose
- the backend can point to an external PostgreSQL database with env vars
- the backend supports local media storage by default

Important caveat:

- with `DEBUG=0`, Django is **not** currently serving `/media/` directly in production
- because of that, the simplest low-cost setup is to **keep S3 for audio and images**
- if you later want to remove S3 too, add explicit production media serving through Caddy/Nginx or another dedicated static/media path

## Suggested provider shapes

Three reasonable directions:

1. Stay on AWS with lighter managed services:
   - Amplify Hosting + Lightsail Containers
   - best fit for the current chosen path

2. Stay on AWS, but move to a single VM:
   - Amazon Lightsail instance
   - often the cheapest AWS-flavored option if you want full control

3. Use a simple third-party platform:
   - Railway or Render
   - easier operationally, but often not as cheap as the smallest AWS setup once the app is always on

## Practical recommendation

For this project today, the best low-cost option is:

- **Amplify Hosting** for the frontend
- **Amazon Lightsail container service** for the backend
- **keep the current PostgreSQL database exactly where it is**
- **keep S3 for audio and image files**

That gives the biggest cost reduction with the smallest code and deployment change.

## Current chosen path

- Frontend:
  - S3 bucket for manual deploy source
  - Amplify Hosting app backed by that bucket
- Backend:
  - Lightsail container service
- Database:
  - existing shared RDS PostgreSQL
- Media:
  - existing S3 audio and image storage

## Deploy script

This path now has its own deployment script:

```bash
low-cost-deploy/build_and_deploy.sh
```

Setup files:

- Copy [low-cost-deploy/deploy.env.example](./deploy.env.example) to `low-cost-deploy/deploy.env`
- Copy [low-cost-deploy/backend.env.example](./backend.env.example) to `low-cost-deploy/backend.env`

The script can deploy:

- both frontend and backend
- frontend only: `low-cost-deploy/build_and_deploy.sh --frontend-only`
- backend only: `low-cost-deploy/build_and_deploy.sh --backend-only`

What it does:

- builds the frontend with `VITE_API_URL`
- syncs `frontend/dist/` to the frontend S3 bucket
- starts an Amplify manual deployment from that bucket
- builds the backend image using [`aws-deploy/backend.Dockerfile.prod`](../aws-deploy/backend.Dockerfile.prod)
- pushes the backend image to the Lightsail container service
- creates a new Lightsail deployment using the env vars from `low-cost-deploy/backend.env`

## CloudWatch Logs

Lightsail container services keep only a short rolling window of their own container logs. The deploy script also sends Django application logs to CloudWatch Logs through the backend's AWS credentials.

By default, a backend deploy creates the log group `/welearnsmart/lightsail/backend`, retains entries for 30 days, and uses separate streams per container process. Override these settings in `low-cost-deploy/deploy.env` if needed:

```bash
CLOUDWATCH_LOG_GROUP=/welearnsmart/lightsail/backend
CLOUDWATCH_LOG_RETENTION_DAYS=30
CLOUDWATCH_LOG_STREAM_NAME={machine_name}/{process_id}
```

The AWS identity configured in `low-cost-deploy/backend.env` also needs permission to write to that group. Add this policy to the backend IAM user, replacing the account ID if needed:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
    "Resource": "arn:aws:logs:us-east-1:330056673401:log-group:/welearnsmart/lightsail/backend:*"
  }]
}
```

The local AWS CLI identity that runs the deploy script needs `logs:CreateLogGroup` and `logs:PutRetentionPolicy` for the same log group. After the next backend deploy, open **CloudWatch -> Logs -> Log groups -> `/welearnsmart/lightsail/backend`**.

## Error Email Alerts

Set up an inbox alert after CloudWatch logging has been deployed:

```bash
low-cost-deploy/configure_error_email_alerts.sh --email you@example.com
```

The script creates or updates an SNS topic, a CloudWatch Logs metric filter for `ERROR` entries, and an alarm. The default alarm emails once an error is detected during a five-minute window, then remains quiet until the alarm returns to normal. Use `--period-seconds 60` if you prefer faster alerts.

AWS sends a confirmation message to the selected email address. Open that message and confirm the subscription; no alerts can be delivered until it is confirmed. The script is safe to run again to update the alarm configuration.

## Rough migration shape

1. Create the S3 bucket for frontend deploy artifacts.
2. Create the Amplify app backed by that S3 bucket.
3. Create the Lightsail container service.
4. Configure the frontend and backend custom domains.
5. Create:
   - `low-cost-deploy/deploy.env`
   - `low-cost-deploy/backend.env`
6. Run:

```bash
low-cost-deploy/build_and_deploy.sh
```

## Operational tradeoffs

What you gain:

- much lower monthly cost
- much simpler deployment
- fewer AWS services to maintain

What you give up:

- lower resilience than managed RDS + ECS
- a single server becomes a single point of failure
- app server backups and redeployability become more important
- upgrades need a bit more care

## Minimum safety checklist

If you choose this path, do at least this:

- enable automatic OS security updates
- keep database credentials and access locked down
- back up any VM-local app data you decide to store later
- use HTTPS
- restrict admin access
- monitor disk usage
- monitor container restarts

## Recommended next step

If cost still matters later, a follow-up improvement can:

- move RDS to private access
- add bastion / Session Manager or VPN access for admin DB inspection
