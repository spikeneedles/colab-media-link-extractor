# SSL/HTTPS Configuration Guide for Media Link Scanner

## 🔐 Overview

This guide covers setting up SSL/HTTPS certificates for the Media Link Scanner in production. We support both **self-signed certificates** (for development/testing) and **Let's Encrypt** (for production).

---

## 📋 Prerequisites

- Docker and Docker Compose installed
- Domain name pointing to your server (for Let's Encrypt)
- Ports 80 and 443 open in firewall
- OpenSSL installed (for self-signed certificates)

---

## 🚀 Quick Start

### Option 1: Self-Signed Certificates (Development)

Perfect for local development or testing environments.

```bash
# Generate self-signed certificates
chmod +x scripts/generate-ssl-certs.sh
./scripts/generate-ssl-certs.sh

# Select option 1 (Self-signed)

# Start containers with SSL
docker-compose -f docker-compose.ssl.yml up -d

# Access your app
# https://localhost (you'll see a browser warning - that's normal)
```

### Option 2: Let's Encrypt (Production)

Free, trusted SSL certificates from Let's Encrypt.

```bash
# Step 1: Prepare for Let's Encrypt
chmod +x scripts/generate-ssl-certs.sh
./scripts/generate-ssl-certs.sh

# Select option 2 (Let's Encrypt)
# Enter your domain and email

# Step 2: Start containers
docker-compose -f docker-compose.ssl.yml up -d

# Step 3: Obtain certificate
chmod +x scripts/setup-letsencrypt.sh
./scripts/setup-letsencrypt.sh

# Step 4: Setup auto-renewal
chmod +x scripts/setup-cert-renewal.sh
./scripts/setup-cert-renewal.sh
```

---

## 📁 Directory Structure

```
.
├── ssl/                          # SSL certificates directory
│   ├── cert.pem                 # SSL certificate
│   ├── key.pem                  # Private key
│   ├── chain.pem                # Certificate chain
│   └── dhparam.pem              # Diffie-Hellman parameters
├── certbot/                      # Let's Encrypt files
│   ├── conf/                    # Certbot configuration
│   ├── www/                     # ACME challenge directory
│   └── certbot-config.env       # Domain configuration
├── scripts/
│   ├── generate-ssl-certs.sh   # Certificate generation
│   ├── setup-letsencrypt.sh    # Let's Encrypt setup
│   └── setup-cert-renewal.sh   # Auto-renewal setup
├── nginx-ssl.conf               # Nginx SSL configuration
└── docker-compose.ssl.yml       # Docker Compose with SSL
```

---

## 🔧 Detailed Setup

### Self-Signed Certificates

Self-signed certificates are useful for:
- Local development
- Testing HTTPS functionality
- Internal networks

**Generate Certificates:**

```bash
./scripts/generate-ssl-certs.sh
```

The script will:
1. Generate a 2048-bit RSA private key
2. Create a certificate signing request (CSR)
3. Generate a self-signed certificate (valid for 365 days)
4. Create Diffie-Hellman parameters for enhanced security

**Browser Warning:**
- Browsers will show "Your connection is not private"
- This is expected for self-signed certificates
- Click "Advanced" → "Proceed to localhost"

### Let's Encrypt Certificates

Let's Encrypt provides free, automated, and trusted SSL certificates.

**Step-by-Step Process:**

#### 1. Prerequisites Check

```bash
# Verify domain points to your server
dig +short yourdomain.com

# Verify ports are accessible
curl -I http://yourdomain.com
```

#### 2. Initial Setup

```bash
./scripts/generate-ssl-certs.sh
# Select option 2 (Let's Encrypt)
# Enter your domain: example.com
# Enter your email: admin@example.com
```

#### 3. Start Application

```bash
docker-compose -f docker-compose.ssl.yml up -d
```

#### 4. Obtain Certificate

```bash
./scripts/setup-letsencrypt.sh
```

**Staging vs Production:**
- **Staging**: For testing, doesn't count towards rate limits
- **Production**: Real certificates, subject to rate limits

Let's Encrypt Rate Limits:
- 50 certificates per domain per week
- 5 duplicate certificates per week

**Tip:** Always test with staging first!

#### 5. Setup Auto-Renewal

Certificates expire after 90 days. Setup automatic renewal:

```bash
./scripts/setup-cert-renewal.sh
```

Choose renewal method:
1. **Cron Job**: Traditional, runs twice daily
2. **Systemd Timer**: Modern Linux systems
3. **Docker Container**: Runs alongside your app
4. **Manual**: You handle renewal yourself

---

## 🔄 Certificate Renewal

### Automatic Renewal

Once setup, certificates renew automatically:
- Certbot checks for renewal twice daily
- Certificates renew when 30 days before expiration
- Nginx automatically reloads with new certificates

### Manual Renewal

To manually renew:

```bash
# Using the renewal script
./certbot/renew-certs.sh

# Or directly with Docker
docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot renew

# Reload Nginx
docker-compose -f docker-compose.ssl.yml exec nginx-lb nginx -s reload
```

### Check Certificate Status

```bash
# View expiration date
openssl x509 -enddate -noout -in ssl/cert.pem

# View full certificate details
openssl x509 -text -noout -in ssl/cert.pem

# Test SSL configuration
openssl s_client -connect yourdomain.com:443
```

---

## 🔒 Security Features

### SSL/TLS Configuration

Our Nginx configuration includes:

- **TLS 1.2 and 1.3** only (no outdated protocols)
- **Modern cipher suites** (no weak ciphers)
- **OCSP Stapling** for faster certificate validation
- **HTTP Strict Transport Security (HSTS)** with preload
- **Perfect Forward Secrecy** with DHE/ECDHE
- **Session resumption** with tickets disabled

### Security Headers

Automatically applied:
- `Strict-Transport-Security`: Forces HTTPS
- `X-Frame-Options`: Prevents clickjacking
- `X-Content-Type-Options`: Prevents MIME sniffing
- `X-XSS-Protection`: XSS filter
- `Content-Security-Policy`: Controls resource loading
- `Referrer-Policy`: Controls referrer information
- `Permissions-Policy`: Controls browser features

### SSL Labs Grade

Our configuration targets **A+ rating** on SSL Labs.

Test your configuration:
```bash
# Visit https://www.ssllabs.com/ssltest/
# Enter your domain and analyze
```

---

## 🐳 Docker Configuration

### SSL-Enabled Compose File

`docker-compose.ssl.yml` includes:

- Nginx with SSL termination
- Certificate volume mounts
- Port 443 exposure
- Health checks
- Auto-restart policies

### Environment Variables

Set in `.env` file:

```env
# Redis password
REDIS_PASSWORD=your_secure_password_here

# Domain (for Let's Encrypt)
DOMAIN=yourdomain.com
EMAIL=admin@yourdomain.com
```

### Container Management

```bash
# Start with SSL
docker-compose -f docker-compose.ssl.yml up -d

# View logs
docker-compose -f docker-compose.ssl.yml logs -f nginx-lb

# Restart Nginx
docker-compose -f docker-compose.ssl.yml restart nginx-lb

# Stop all
docker-compose -f docker-compose.ssl.yml down

# View certificate volumes
docker volume ls | grep ssl
```

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. Certificate Not Trusted

**Problem:** Browser shows "Not Secure" warning

**Solutions:**
- For self-signed: This is normal, click "Advanced" → "Proceed"
- For Let's Encrypt: Verify domain points to server
- Check certificate hasn't expired: `openssl x509 -enddate -noout -in ssl/cert.pem`

#### 2. Port 443 Access Denied

**Problem:** Can't bind to port 443

**Solutions:**
```bash
# Check if port is in use
sudo lsof -i :443

# Stop other services using port 443
sudo systemctl stop apache2  # if Apache is running

# Verify firewall allows HTTPS
sudo ufw allow 443/tcp
```

#### 3. Let's Encrypt Rate Limit

**Problem:** "too many certificates already issued"

**Solutions:**
- Wait 7 days for rate limit to reset
- Use staging environment for testing
- Use wildcard certificate if available

#### 4. ACME Challenge Failed

**Problem:** Let's Encrypt can't verify domain

**Solutions:**
```bash
# Verify domain resolves
dig +short yourdomain.com

# Check ACME challenge directory
ls -la certbot/www/.well-known/acme-challenge/

# Test HTTP access
curl http://yourdomain.com/.well-known/acme-challenge/test

# Check Nginx logs
docker-compose -f docker-compose.ssl.yml logs nginx-lb
```

#### 5. Certificate Not Updating

**Problem:** Renewal succeeded but site still shows old certificate

**Solutions:**
```bash
# Check certificate dates
openssl x509 -enddate -noout -in ssl/cert.pem
openssl x509 -enddate -noout -in certbot/conf/live/DOMAIN/cert.pem

# Manually copy certificates
cp certbot/conf/live/DOMAIN/fullchain.pem ssl/cert.pem
cp certbot/conf/live/DOMAIN/privkey.pem ssl/key.pem
cp certbot/conf/live/DOMAIN/chain.pem ssl/chain.pem

# Reload Nginx
docker-compose -f docker-compose.ssl.yml restart nginx-lb
```

### Debug Commands

```bash
# Test SSL handshake
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check certificate chain
openssl s_client -connect yourdomain.com:443 -showcerts

# Verify certificate matches private key
openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
# Both should output the same hash

# Test Nginx configuration
docker-compose -f docker-compose.ssl.yml exec nginx-lb nginx -t

# View detailed Nginx logs
docker-compose -f docker-compose.ssl.yml logs --tail=100 nginx-lb
```

---

## 📊 Monitoring

### Certificate Expiration Monitoring

```bash
# Check days until expiration
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Get expiration date
openssl x509 -enddate -noout -in ssl/cert.pem
```

### Health Checks

```bash
# Test HTTPS endpoint
curl -k https://localhost/health

# Test with proper certificate validation
curl https://yourdomain.com/health
```

### Renewal Logs

```bash
# View cron job logs
tail -f certbot/renewal.log

# View systemd logs
sudo journalctl -u media-scanner-cert-renewal.service -f

# View Docker container logs
docker logs certbot-renew -f
```

---

## 🔄 Switching Certificates

### From Self-Signed to Let's Encrypt

```bash
# 1. Stop containers
docker-compose -f docker-compose.ssl.yml down

# 2. Backup self-signed certificates
mv ssl ssl-backup-self-signed

# 3. Setup Let's Encrypt
./scripts/generate-ssl-certs.sh  # Option 2
docker-compose -f docker-compose.ssl.yml up -d
./scripts/setup-letsencrypt.sh

# 4. Setup renewal
./scripts/setup-cert-renewal.sh
```

### From Let's Encrypt to Self-Signed

```bash
# 1. Stop containers
docker-compose -f docker-compose.ssl.yml down

# 2. Backup Let's Encrypt certificates
mv ssl ssl-backup-letsencrypt
mv certbot certbot-backup

# 3. Generate self-signed
./scripts/generate-ssl-certs.sh  # Option 1

# 4. Start containers
docker-compose -f docker-compose.ssl.yml up -d
```

---

## 🌐 Advanced Configuration

### Custom SSL Configuration

Edit `nginx-ssl.conf` to customize:

```nginx
# Modify SSL protocols
ssl_protocols TLSv1.3;

# Change cipher suites
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';

# Adjust HSTS duration
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### Multiple Domains

To support multiple domains:

1. **Obtain certificates for each domain:**
```bash
# Domain 1
DOMAIN=example.com EMAIL=admin@example.com ./scripts/setup-letsencrypt.sh

# Domain 2
DOMAIN=app.example.com EMAIL=admin@example.com ./scripts/setup-letsencrypt.sh
```

2. **Update Nginx configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    ssl_certificate /etc/nginx/ssl/example.com/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/example.com/key.pem;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;
    ssl_certificate /etc/nginx/ssl/app.example.com/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/app.example.com/key.pem;
}
```

### Wildcard Certificates

For subdomains (e.g., *.example.com):

```bash
docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email admin@example.com \
  --agree-tos \
  -d "*.example.com"
```

---

## 📚 Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://eff-certbot.readthedocs.io/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/)
- [Nginx SSL Documentation](https://nginx.org/en/docs/http/configuring_https_servers.html)

---

## 🎉 Success!

Your Media Link Scanner is now secured with SSL/HTTPS! 🔒

**What's Next?**
- Test your SSL configuration at SSL Labs
- Setup monitoring for certificate expiration
- Configure your firewall for production
- Setup backup for SSL certificates

**Need Help?**
- Check troubleshooting section above
- Review Docker logs: `docker-compose -f docker-compose.ssl.yml logs`
- Open an issue on GitHub with error details
