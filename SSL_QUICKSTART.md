# SSL/HTTPS Configuration - Quick Reference

## 🚀 Quick Start

### One-Command Setup

```bash
chmod +x ssl-setup.sh
./ssl-setup.sh
```

This interactive script will guide you through:
- Self-signed certificates (development)
- Let's Encrypt certificates (production)
- Certificate status checking

### Manual Setup

#### Development (Self-Signed)

```bash
chmod +x scripts/generate-ssl-certs.sh
./scripts/generate-ssl-certs.sh
docker-compose -f docker-compose.ssl.yml up -d
```

Access: https://localhost

#### Production (Let's Encrypt)

```bash
# 1. Generate initial certificates
./scripts/generate-ssl-certs.sh
# Select option 2, enter domain and email

# 2. Start containers
docker-compose -f docker-compose.ssl.yml up -d

# 3. Get Let's Encrypt certificate
chmod +x scripts/setup-letsencrypt.sh
./scripts/setup-letsencrypt.sh

# 4. Setup auto-renewal
chmod +x scripts/setup-cert-renewal.sh
./scripts/setup-cert-renewal.sh
```

Access: https://yourdomain.com

## 📁 Files Created

```
ssl/                           # SSL certificates
├── cert.pem                  # Certificate
├── key.pem                   # Private key
├── chain.pem                 # Certificate chain
└── dhparam.pem              # DH parameters

certbot/                      # Let's Encrypt files
├── conf/                     # Certbot config
├── www/                      # ACME challenges
└── certbot-config.env       # Your domain config

scripts/
├── generate-ssl-certs.sh    # Certificate generation
├── setup-letsencrypt.sh     # Let's Encrypt setup
└── setup-cert-renewal.sh    # Auto-renewal

nginx-ssl.conf               # SSL Nginx config
docker-compose.ssl.yml       # Docker with SSL
ssl-setup.sh                 # Interactive setup
```

## 🔐 Security Features

- ✅ TLS 1.2 and 1.3 only
- ✅ Modern cipher suites
- ✅ HSTS with preload
- ✅ OCSP stapling
- ✅ Perfect forward secrecy
- ✅ Security headers
- ✅ A+ SSL Labs rating

## 🔄 Certificate Renewal

### Automatic (Recommended)

After setup with `./scripts/setup-cert-renewal.sh`, choose:
1. Cron job (runs twice daily)
2. Systemd timer (modern Linux)
3. Docker container (always running)

### Manual

```bash
# Renew certificate
./certbot/renew-certs.sh

# Or use Docker directly
docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot renew

# Reload Nginx
docker-compose -f docker-compose.ssl.yml restart nginx-lb
```

## 🛠️ Common Commands

```bash
# Check certificate expiration
openssl x509 -enddate -noout -in ssl/cert.pem

# View certificate details
openssl x509 -text -noout -in ssl/cert.pem

# Test SSL connection
openssl s_client -connect yourdomain.com:443

# View container logs
docker-compose -f docker-compose.ssl.yml logs -f nginx-lb

# Restart Nginx
docker-compose -f docker-compose.ssl.yml restart nginx-lb

# Stop all containers
docker-compose -f docker-compose.ssl.yml down
```

## ❗ Troubleshooting

### Browser Shows "Not Secure"

**For self-signed certificates:**
- This is expected
- Click "Advanced" → "Proceed to localhost"

**For Let's Encrypt:**
- Verify domain points to your server: `dig +short yourdomain.com`
- Check certificate hasn't expired: `openssl x509 -enddate -noout -in ssl/cert.pem`
- View Nginx logs: `docker-compose -f docker-compose.ssl.yml logs nginx-lb`

### Port 443 Already in Use

```bash
# Find what's using the port
sudo lsof -i :443

# Stop competing service (e.g., Apache)
sudo systemctl stop apache2

# Allow port in firewall
sudo ufw allow 443/tcp
```

### Let's Encrypt Rate Limit

- Wait 7 days or use staging environment
- Staging flag: `--staging` in certbot command

### ACME Challenge Failed

```bash
# Verify domain resolves
dig +short yourdomain.com

# Test HTTP access
curl http://yourdomain.com/.well-known/acme-challenge/test

# Check Nginx is running
docker ps | grep nginx
```

## 📊 Monitoring

### Check Certificate Status

```bash
# Days until expiration
openssl x509 -enddate -noout -in ssl/cert.pem

# View renewal logs
tail -f certbot/renewal.log
```

### Test SSL Configuration

Visit: https://www.ssllabs.com/ssltest/
Enter your domain and analyze

## 📚 Full Documentation

See **SSL_SETUP.md** for complete guide including:
- Detailed step-by-step instructions
- Multiple domain setup
- Wildcard certificates
- Advanced configuration
- Complete troubleshooting guide

## 🔄 Switching Certificate Types

### Self-Signed → Let's Encrypt

```bash
docker-compose -f docker-compose.ssl.yml down
mv ssl ssl-backup
./scripts/generate-ssl-certs.sh  # Option 2
docker-compose -f docker-compose.ssl.yml up -d
./scripts/setup-letsencrypt.sh
```

### Let's Encrypt → Self-Signed

```bash
docker-compose -f docker-compose.ssl.yml down
mv ssl ssl-backup
./scripts/generate-ssl-certs.sh  # Option 1
docker-compose -f docker-compose.ssl.yml up -d
```

## 🎯 Production Checklist

- [ ] Domain points to server
- [ ] Ports 80 and 443 open
- [ ] Firewall configured
- [ ] Let's Encrypt certificate obtained
- [ ] Auto-renewal configured
- [ ] SSL Labs test passed (A+ rating)
- [ ] Backup certificates stored securely
- [ ] Monitoring alerts setup

## 🆘 Support

Having issues? Check:
1. **SSL_SETUP.md** - Complete documentation
2. **Docker logs** - `docker-compose -f docker-compose.ssl.yml logs`
3. **Certificate status** - Run `./ssl-setup.sh` and select option 3
4. **GitHub issues** - Search or create new issue

---

**Security Note:** Never commit SSL certificates or private keys to version control!
