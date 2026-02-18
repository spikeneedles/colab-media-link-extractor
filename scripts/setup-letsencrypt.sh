#!/bin/bash
# Let's Encrypt Certificate Setup Script
# Obtains and configures SSL certificates from Let's Encrypt

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directories
SSL_DIR="./ssl"
CERTBOT_DIR="./certbot"
CONFIG_FILE="$CERTBOT_DIR/certbot-config.env"

echo -e "${BLUE}🔐 Let's Encrypt Certificate Setup${NC}"
echo ""

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found!${NC}"
    echo -e "${YELLOW}Please run ./scripts/generate-ssl-certs.sh first${NC}"
    exit 1
fi

# Load configuration
source "$CONFIG_FILE"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Domain or email not configured!${NC}"
    exit 1
fi

echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Email: ${EMAIL}${NC}"
echo ""

# Check if containers are running
if ! docker ps | grep -q nginx; then
    echo -e "${RED}❌ Nginx container is not running!${NC}"
    echo -e "${YELLOW}Start containers first: docker-compose -f docker-compose.ssl.yml up -d${NC}"
    exit 1
fi

# Test domain accessibility
echo -e "${YELLOW}Testing domain accessibility...${NC}"
if curl -f -s -o /dev/null "http://$DOMAIN/.well-known/acme-challenge/test" 2>/dev/null; then
    echo -e "${GREEN}✅ Domain is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify domain accessibility${NC}"
    echo -e "${YELLOW}   Make sure your domain points to this server${NC}"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

# Staging or production
echo ""
echo -e "${YELLOW}Select Let's Encrypt environment:${NC}"
echo "1) Staging (for testing, doesn't count towards rate limits)"
echo "2) Production (real certificates)"
echo ""
read -p "Select (1-2): " ENV_CHOICE

STAGING_FLAG=""
if [ "$ENV_CHOICE" == "1" ]; then
    STAGING_FLAG="--staging"
    echo -e "${YELLOW}Using Let's Encrypt staging environment${NC}"
else
    echo -e "${GREEN}Using Let's Encrypt production environment${NC}"
fi

# Request certificate using Certbot
echo ""
echo -e "${YELLOW}Requesting certificate from Let's Encrypt...${NC}"

docker run --rm \
    -v "$PWD/certbot/conf:/etc/letsencrypt" \
    -v "$PWD/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    $STAGING_FLAG \
    -d "$DOMAIN"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Certificate obtained successfully!${NC}"
    
    # Copy certificates to SSL directory
    echo -e "${YELLOW}Copying certificates to SSL directory...${NC}"
    
    cp "$CERTBOT_DIR/conf/live/$DOMAIN/fullchain.pem" "$SSL_DIR/cert.pem"
    cp "$CERTBOT_DIR/conf/live/$DOMAIN/privkey.pem" "$SSL_DIR/key.pem"
    cp "$CERTBOT_DIR/conf/live/$DOMAIN/chain.pem" "$SSL_DIR/chain.pem"
    
    # Set permissions
    chmod 600 "$SSL_DIR/key.pem"
    chmod 644 "$SSL_DIR/cert.pem"
    chmod 644 "$SSL_DIR/chain.pem"
    
    echo -e "${GREEN}✅ Certificates copied to $SSL_DIR${NC}"
    
    # Reload Nginx
    echo -e "${YELLOW}Reloading Nginx...${NC}"
    docker-compose -f docker-compose.ssl.yml exec nginx-lb nginx -s reload || true
    
    echo ""
    echo -e "${GREEN}🎉 Let's Encrypt setup complete!${NC}"
    echo ""
    echo -e "${BLUE}Your site is now secured with HTTPS${NC}"
    echo -e "${BLUE}Certificate expires in 90 days${NC}"
    echo ""
    echo -e "${YELLOW}To setup automatic renewal, run:${NC}"
    echo -e "  ${YELLOW}./scripts/setup-cert-renewal.sh${NC}"
    echo ""
else
    echo -e "${RED}❌ Failed to obtain certificate${NC}"
    echo -e "${YELLOW}Common issues:${NC}"
    echo -e "  • Domain doesn't point to this server"
    echo -e "  • Firewall blocking port 80"
    echo -e "  • Rate limit exceeded (try staging first)"
    exit 1
fi
