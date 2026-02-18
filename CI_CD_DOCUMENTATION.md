# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for continuous integration and continuous deployment (CI/CD). The pipeline automates testing, building, security scanning, and deployment processes.

## Pipeline Components

### 1. **CI Pipeline** (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

#### Jobs:

- **Lint Code**: Runs ESLint to check code quality
- **Type Check**: Validates TypeScript types
- **Build Application**: Compiles the main web application
- **Build Extension**: Packages Chrome and Firefox browser extensions
- **Security Scan**: Checks for vulnerabilities using npm audit
- **Test Compatibility**: Tests across Node versions (18, 20, 22) and OS platforms
- **Bundle Size Check**: Analyzes and reports bundle sizes
- **Code Quality Analysis**: Runs SonarCloud scan (requires setup)

### 2. **CD Pipeline** (`.github/workflows/deploy.yml`)

Handles deployment to various platforms.

#### Jobs:

- **Deploy Preview (Staging)**: Deploys to staging on push to main
  - Platform: Netlify (configurable)
  - Automatic preview URLs
  
- **Deploy Production**: Deploys on version tags (v*.*.*)
  - Platform: Netlify, Vercel, or GitHub Pages
  - Creates GitHub releases
  
- **Publish Docker**: Builds and pushes Docker images
  - Docker Hub
  - GitHub Container Registry (ghcr.io)
  
- **Publish Extension**: Publishes to browser extension stores
  - Chrome Web Store
  - Firefox Add-ons

### 3. **Test Pipeline** (`.github/workflows/test.yml`)

Comprehensive testing suite.

#### Test Types:

- **Unit Tests**: Component-level testing
- **Integration Tests**: Module interaction testing
- **E2E Tests**: End-to-end user flow testing (Playwright)
- **Accessibility Tests**: Lighthouse CI for a11y compliance
- **Browser Compatibility**: Tests on Chromium, Firefox, and WebKit
- **Performance Tests**: Bundle analysis and performance metrics
- **Security Tests**: OWASP dependency checking

### 4. **Release Management** (`.github/workflows/release.yml`)

Automates release processes.

#### Features:

- Automatic changelog generation
- Multi-platform build artifacts (Linux, Windows, macOS)
- Documentation updates
- Release notifications (Slack, Discord, Twitter)

### 5. **Dependency Updates** (`.github/workflows/dependency-update.yml`)

Automatically updates dependencies weekly.

#### Features:

- Updates npm packages
- Applies security fixes
- Creates pull requests for review

## Required Secrets

Configure these in GitHub repository settings under `Settings > Secrets and variables > Actions`:

### Deployment Secrets

```
NETLIFY_AUTH_TOKEN          # Netlify deployment token
NETLIFY_STAGING_SITE_ID     # Staging site ID
NETLIFY_PRODUCTION_SITE_ID  # Production site ID

VERCEL_TOKEN                # Vercel deployment token
VERCEL_ORG_ID              # Vercel organization ID
VERCEL_PROJECT_ID          # Vercel project ID

DOCKER_USERNAME            # Docker Hub username
DOCKER_PASSWORD            # Docker Hub password
```

### Extension Publishing Secrets

```
CHROME_EXTENSION_ID        # Chrome Web Store extension ID
CHROME_CLIENT_ID           # Chrome Web Store OAuth client ID
CHROME_CLIENT_SECRET       # Chrome Web Store OAuth client secret
CHROME_REFRESH_TOKEN       # Chrome Web Store refresh token

FIREFOX_EXTENSION_UUID     # Firefox add-on UUID
FIREFOX_API_KEY           # Firefox add-on API key
FIREFOX_API_SECRET        # Firefox add-on API secret
```

### Notification Secrets

```
SLACK_WEBHOOK             # Slack webhook URL for notifications
DISCORD_WEBHOOK           # Discord webhook URL for notifications

TWITTER_API_KEY           # Twitter API key for announcements
TWITTER_API_SECRET        # Twitter API secret
TWITTER_ACCESS_TOKEN      # Twitter access token
TWITTER_ACCESS_TOKEN_SECRET # Twitter access token secret
```

### Code Quality Secrets

```
SONAR_TOKEN              # SonarCloud authentication token
```

## Workflow Triggers

### Automatic Triggers

- **Push to main/develop**: Runs CI pipeline
- **Pull Request**: Runs CI and test pipelines
- **Version Tag (v*.*.*)**: Triggers release and production deployment
- **Schedule**: Dependency updates (Mondays at 9 AM UTC), tests (daily at 2 AM UTC)

### Manual Triggers

All workflows support manual triggering via GitHub UI:

1. Go to `Actions` tab
2. Select workflow
3. Click `Run workflow`
4. Choose branch and options

## Deployment Environments

### Staging

- **Trigger**: Push to `main` branch
- **URL**: Automatically generated preview URL
- **Purpose**: Testing before production

### Production

- **Trigger**: Git tag matching `v*.*.*` pattern
- **URL**: Configured production domain
- **Purpose**: Live application

## Docker Deployment

### Build Docker Image

```bash
docker build -t media-link-scanner .
```

### Run Container

```bash
docker run -d -p 80:80 media-link-scanner
```

### Using Docker Compose

```bash
docker-compose up -d
```

### Pull from Registry

```bash
# Docker Hub
docker pull username/media-link-scanner:latest

# GitHub Container Registry
docker pull ghcr.io/username/media-link-scanner:latest
```

## Release Process

### Creating a New Release

1. **Update version** in `package.json`
2. **Commit changes**:
   ```bash
   git commit -am "chore: bump version to 1.2.3"
   ```
3. **Create and push tag**:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```
4. **Pipeline automatically**:
   - Builds release artifacts
   - Creates GitHub release
   - Deploys to production
   - Publishes Docker images
   - Publishes browser extensions
   - Updates documentation

### Semantic Versioning

Follow [SemVer](https://semver.org/):

- **Major** (v1.0.0 → v2.0.0): Breaking changes
- **Minor** (v1.0.0 → v1.1.0): New features, backwards compatible
- **Patch** (v1.0.0 → v1.0.1): Bug fixes

## Monitoring and Notifications

### Build Status

- Check workflow status in `Actions` tab
- Status badges available for README

### Notifications

Configure webhooks for:
- Slack: Deployment notifications
- Discord: Release announcements
- Twitter: Version release tweets

## Troubleshooting

### Pipeline Failures

1. **Lint Errors**: Check ESLint output, fix code style issues
2. **Type Errors**: Review TypeScript errors in logs
3. **Build Failures**: Check dependencies and build configuration
4. **Test Failures**: Review test logs and fix failing tests

### Deployment Issues

1. **Authentication Errors**: Verify secrets are correctly configured
2. **Build Timeouts**: Optimize build process or increase timeout
3. **Missing Artifacts**: Check artifact upload/download steps

### Getting Help

- Review workflow logs in GitHub Actions
- Check workflow YAML syntax
- Consult GitHub Actions documentation
- Review this documentation

## Best Practices

### Code Quality

- Write tests for new features
- Keep dependencies updated
- Follow linting rules
- Maintain type safety

### Security

- Never commit secrets
- Use GitHub secrets for sensitive data
- Keep dependencies patched
- Review security scan results

### Performance

- Monitor bundle sizes
- Optimize images and assets
- Use code splitting
- Enable compression

## Local Development

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
```

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Continuous Improvement

The CI/CD pipeline is designed to be:

- **Extensible**: Add new jobs as needed
- **Maintainable**: Clear structure and documentation
- **Reliable**: Comprehensive testing and validation
- **Fast**: Parallel execution and caching
- **Secure**: Automated security scanning

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Netlify CLI Documentation](https://docs.netlify.com/cli/get-started/)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Chrome Web Store Publishing](https://developer.chrome.com/docs/webstore/publish/)
- [Firefox Add-ons Publishing](https://extensionworkshop.com/documentation/publish/)
