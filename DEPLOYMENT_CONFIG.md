# Deployment Configuration Guide

This guide explains how to configure various deployment platforms for the Media Link Scanner.

## Netlify

### Setup Steps

1. **Create Netlify Account**: Sign up at [netlify.com](https://netlify.com)

2. **Create Sites**:
   - Create a staging site
   - Create a production site

3. **Get Authentication Token**:
   - Go to User Settings → Applications → Personal Access Tokens
   - Create new token and save it

4. **Get Site IDs**:
   - Navigate to each site
   - Go to Site Settings → General
   - Copy Site ID

5. **Add GitHub Secrets**:
   ```
   NETLIFY_AUTH_TOKEN: <your-token>
   NETLIFY_STAGING_SITE_ID: <staging-site-id>
   NETLIFY_PRODUCTION_SITE_ID: <production-site-id>
   ```

### netlify.toml Configuration

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer-when-downgrade"
```

## Vercel

### Setup Steps

1. **Create Vercel Account**: Sign up at [vercel.com](https://vercel.com)

2. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

3. **Link Project**:
   ```bash
   vercel link
   ```

4. **Get Token**:
   - Go to Account Settings → Tokens
   - Create new token

5. **Add GitHub Secrets**:
   ```
   VERCEL_TOKEN: <your-token>
   VERCEL_ORG_ID: <from .vercel/project.json>
   VERCEL_PROJECT_ID: <from .vercel/project.json>
   ```

### vercel.json Configuration

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

## GitHub Pages

### Setup Steps

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Select "GitHub Actions" as source

2. **Configure Base Path** (if using project pages):
   - Update `vite.config.ts`:
   ```typescript
   export default defineConfig({
     base: '/your-repo-name/',
   })
   ```

3. **Deploy**:
   - Push tag matching `v*.*.*`
   - GitHub Actions will automatically deploy

## Docker Hub

### Setup Steps

1. **Create Docker Hub Account**: Sign up at [hub.docker.com](https://hub.docker.com)

2. **Create Access Token**:
   - Go to Account Settings → Security
   - Create new Access Token

3. **Add GitHub Secrets**:
   ```
   DOCKER_USERNAME: <your-username>
   DOCKER_PASSWORD: <access-token>
   ```

4. **Pull and Run**:
   ```bash
   docker pull your-username/media-link-scanner:latest
   docker run -d -p 80:80 your-username/media-link-scanner:latest
   ```

## GitHub Container Registry

### Setup Steps

1. **Authenticate**:
   ```bash
   echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
   ```

2. **Pull and Run**:
   ```bash
   docker pull ghcr.io/username/media-link-scanner:latest
   docker run -d -p 80:80 ghcr.io/username/media-link-scanner:latest
   ```

## Chrome Web Store

### Setup Steps

1. **Create Chrome Web Store Account**: Sign up at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)

2. **Create Extension**:
   - Upload extension ZIP
   - Get Extension ID

3. **Create OAuth Credentials**:
   - Go to Google Cloud Console
   - Create OAuth 2.0 Client ID
   - Get Client ID, Client Secret, and Refresh Token

4. **Add GitHub Secrets**:
   ```
   CHROME_EXTENSION_ID: <extension-id>
   CHROME_CLIENT_ID: <oauth-client-id>
   CHROME_CLIENT_SECRET: <oauth-client-secret>
   CHROME_REFRESH_TOKEN: <refresh-token>
   ```

## Firefox Add-ons

### Setup Steps

1. **Create Firefox Account**: Sign up at [addons.mozilla.org](https://addons.mozilla.org/developers/)

2. **Submit Extension**:
   - Upload extension XPI
   - Get Extension UUID

3. **Create API Credentials**:
   - Go to Developer Hub → API Credentials
   - Generate JWT issuer and secret

4. **Add GitHub Secrets**:
   ```
   FIREFOX_EXTENSION_UUID: <extension-uuid>
   FIREFOX_API_KEY: <jwt-issuer>
   FIREFOX_API_SECRET: <jwt-secret>
   ```

## SonarCloud

### Setup Steps

1. **Create SonarCloud Account**: Sign up at [sonarcloud.io](https://sonarcloud.io)

2. **Import GitHub Repository**:
   - Link GitHub account
   - Import repository

3. **Get Token**:
   - Go to My Account → Security
   - Generate token

4. **Add GitHub Secret**:
   ```
   SONAR_TOKEN: <your-token>
   ```

5. **Update sonar-project.properties**:
   ```properties
   sonar.organization=your-organization
   sonar.projectKey=your-project-key
   ```

## Slack Notifications

### Setup Steps

1. **Create Slack Webhook**:
   - Go to [api.slack.com/messaging/webhooks](https://api.slack.com/messaging/webhooks)
   - Create Incoming Webhook

2. **Add GitHub Secret**:
   ```
   SLACK_WEBHOOK: <webhook-url>
   ```

## Discord Notifications

### Setup Steps

1. **Create Discord Webhook**:
   - Go to Server Settings → Integrations → Webhooks
   - Create webhook

2. **Add GitHub Secret**:
   ```
   DISCORD_WEBHOOK: <webhook-url>
   ```

## Twitter Announcements

### Setup Steps

1. **Create Twitter Developer Account**: Sign up at [developer.twitter.com](https://developer.twitter.com)

2. **Create App and Get Credentials**:
   - API Key and Secret
   - Access Token and Secret

3. **Add GitHub Secrets**:
   ```
   TWITTER_API_KEY: <api-key>
   TWITTER_API_SECRET: <api-secret>
   TWITTER_ACCESS_TOKEN: <access-token>
   TWITTER_ACCESS_TOKEN_SECRET: <access-token-secret>
   ```

## Environment Variables

### Production

```bash
NODE_ENV=production
VITE_APP_ENV=production
```

### Staging

```bash
NODE_ENV=production
VITE_APP_ENV=staging
```

## Testing Deployments Locally

### Build and Test

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Test with Docker
docker build -t media-link-scanner-test .
docker run -p 8080:80 media-link-scanner-test
```

### Access

- Preview server: http://localhost:4173
- Docker container: http://localhost:8080

## Troubleshooting

### Common Issues

1. **Build Fails**:
   - Check Node version compatibility
   - Verify all dependencies are installed
   - Review build logs for errors

2. **Deployment Fails**:
   - Verify secrets are correctly set
   - Check authentication tokens
   - Review deployment logs

3. **Extension Publishing Fails**:
   - Verify manifest.json is valid
   - Check OAuth credentials
   - Review extension store guidelines

## Best Practices

1. **Security**:
   - Never commit secrets to repository
   - Use GitHub Secrets for sensitive data
   - Rotate tokens regularly

2. **Testing**:
   - Test builds locally before deployment
   - Use staging environment for validation
   - Monitor production deployments

3. **Monitoring**:
   - Set up notifications for failures
   - Monitor deployment logs
   - Track performance metrics

## Support

For deployment issues:
- Check GitHub Actions logs
- Review platform-specific documentation
- Consult CI/CD documentation
- Create issue in repository
