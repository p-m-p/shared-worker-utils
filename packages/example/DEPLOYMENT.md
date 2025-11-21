# Deployment Guide

This guide explains how to deploy the SharedWorker example application to GitHub Pages (frontend) and Cloudflare Workers (backend).

## Prerequisites

### For GitHub Pages Deployment
- GitHub repository with Pages enabled
- GitHub Actions enabled in the repository

### For Cloudflare Workers Deployment
- Cloudflare account (free tier works)
- Cloudflare API token with Workers permissions
- Cloudflare Account ID

## Setup Instructions

### 1. Configure GitHub Repository Secrets

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
  - Create one at: https://dash.cloudflare.com/profile/api-tokens
  - Use the "Edit Cloudflare Workers" template
  - Permissions needed: Account.Workers Scripts (Edit)

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID
  - Find it at: https://dash.cloudflare.com (right sidebar)

### 2. Enable GitHub Pages

1. Go to repository Settings → Pages
2. Under "Build and deployment", set Source to "GitHub Actions"

### 3. Update WebSocket URL

After deploying the Cloudflare Worker for the first time, you'll get a worker URL like:
```
https://shared-worker-example.YOUR_SUBDOMAIN.workers.dev
```

Update the `VITE_WS_URL` in `.github/workflows/pages.yml`:
```yaml
VITE_WS_URL: wss://shared-worker-example.YOUR_SUBDOMAIN.workers.dev
```

Replace `YOUR_SUBDOMAIN` with your actual Cloudflare subdomain.

### 4. Update Base Path (if needed)

If your repository name is not `shared-worker-utils`, update the `VITE_BASE_PATH` in `.github/workflows/pages.yml`:
```yaml
VITE_BASE_PATH: /YOUR_REPO_NAME/
```

## Deployment

### Automatic Deployment

Both the frontend and backend deploy automatically when you push to the `main` branch:
- Frontend deploys to: `https://YOUR_USERNAME.github.io/shared-worker-utils/`
- Backend deploys to: `https://shared-worker-example.YOUR_SUBDOMAIN.workers.dev`

### Manual Deployment

You can also trigger deployments manually from GitHub Actions:
1. Go to Actions tab
2. Select "Deploy to GitHub Pages" or "Deploy to Cloudflare Workers"
3. Click "Run workflow"

## Local Development

### Running with Cloudflare Worker Locally

```bash
# Terminal 1 - Start Cloudflare Worker locally
cd packages/example
pnpm worker:dev

# Terminal 2 - Start Vite dev server
cd packages/example
pnpm dev
```

The WebSocket will connect to `ws://localhost:8787` by default when running locally.

## Troubleshooting

### WebSocket Connection Fails

- Check that the `VITE_WS_URL` in the GitHub Pages workflow matches your Cloudflare Worker URL
- Make sure you're using `wss://` (secure WebSocket) for HTTPS sites
- Verify the Cloudflare Worker deployed successfully

### GitHub Pages Shows 404

- Ensure the `VITE_BASE_PATH` matches your repository name
- Check that GitHub Pages is enabled in repository settings
- Verify the build artifact was uploaded successfully in Actions logs

### Cloudflare Deployment Fails

- Verify `CLOUDFLARE_API_TOKEN` has Workers permissions
- Check that `CLOUDFLARE_ACCOUNT_ID` is correct
- Review the deployment logs in GitHub Actions

## Security Considerations

### API Tokens

- **Never commit** `CLOUDFLARE_API_TOKEN` or other secrets to your repository
- Always use GitHub Secrets for sensitive credentials
- Regularly rotate API tokens for better security
- Use the minimum required permissions for API tokens

### CORS Configuration

The Cloudflare Worker includes CORS headers (`Access-Control-Allow-Origin: *`) to allow connections from any origin. For production deployments, consider:
- Restricting CORS to your specific GitHub Pages domain
- Implementing authentication if needed
- Adding rate limiting to prevent abuse

## Architecture

### Frontend (GitHub Pages)
- Static HTML/CSS/JS built with Vite
- Uses SharedWorker to manage WebSocket connection
- Connects to Cloudflare Worker via WebSocket

### Backend (Cloudflare Workers)
- Cloudflare Durable Object manages WebSocket connections
- Broadcasts stock price updates to all connected clients
- Automatically scales with number of clients

## Cost

- **GitHub Pages**: Free for public repositories
- **Cloudflare Workers**: Free tier includes:
  - 100,000 requests/day
  - 10ms CPU time per request
  - Sufficient for development and small-scale demos
