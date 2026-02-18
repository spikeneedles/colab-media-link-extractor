#!/bin/bash
# Quick SSL Setup Script
# One-command setup for SSL certificates

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

cat << "EOF"
  __  __          _ _         _      _       _      
 |  \/  | ___  __| (_) __ _  | |    (_)_ __ | | __  
 | |\/| |/ _ \/ _` | |/ _` | | |    | | '_ \| |/ /  
 | |  | |  __/ (_| | | (_| | | |___ | | | | |   <   
 |_|  |_|\___|\__,_|_|\__,_| |_____||_|_| |_|_|\_\  
                                                     
  ____                                               
 / ___|  ___ __ _ _ __  _ __   ___ _ __             
 \___ \ / __/ _` | '_ \| '_ \ / _ \ '__|            
  ___) | (_| (_| | | | | | | |  __/ |               
 |____/ \___\__,_|_| |_|_| |_|\___|_|               
                                                     
 🔐 SSL/HTTPS Quick Setup
EOF

echo ""
echo -e "${BLUE}Welcome to the SSL Quick Setup!${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "   Install from: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "   Install from: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose found${NC}"

# Check OpenSSL
if ! command -v openssl &> /dev/null; then
    echo -e "${YELLOW}⚠️  OpenSSL not found (needed for self-signed certs)${NC}"
else
    echo -e "${GREEN}✅ OpenSSL found${NC}"
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Select Your SSL Setup Type${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}1) Development Setup${NC}"
echo "   → Self-signed certificates"
echo "   → Quick and easy"
echo "   → localhost only"
echo "   → Browser will show warnings"
echo ""
echo -e "${GREEN}2) Production Setup${NC}"
echo "   → Let's Encrypt certificates"
echo "   → Trusted by browsers"
echo "   → Requires domain name"
echo "   → Auto-renewal included"
echo ""
echo -e "${GREEN}3) View Existing Certificates${NC}"
echo "   → Check current SSL status"
echo ""
echo -e "${GREEN}4) Exit${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Select option [1-4]:${NC} )" SETUP_TYPE

case $SETUP_TYPE in
    1)
        # Development setup
        echo ""
        echo -e "${CYAN}════════════════════════════════════════${NC}"
        echo -e "${CYAN}  Development SSL Setup${NC}"
        echo -e "${CYAN}════════════════════════════════════════${NC}"
        echo ""
        
        if [ ! -f "scripts/generate-ssl-certs.sh" ]; then
            echo -e "${RED}❌ SSL scripts not found!${NC}"
            exit 1
        fi
        
        chmod +x scripts/generate-ssl-certs.sh
        
        # Generate self-signed cert automatically
        mkdir -p ssl
        
        echo -e "${YELLOW}Generating self-signed certificates...${NC}"
        openssl genrsa -out ssl/key.pem 2048 2>/dev/null
        openssl req -new -key ssl/key.pem -out ssl/csr.pem \
            -subj "/C=US/ST=Dev/L=Local/O=MediaScanner/CN=localhost" 2>/dev/null
        openssl x509 -req -days 365 -in ssl/csr.pem \
            -signkey ssl/key.pem -out ssl/cert.pem 2>/dev/null
        touch ssl/chain.pem
        openssl dhparam -out ssl/dhparam.pem 2048 2>/dev/null
        
        chmod 600 ssl/key.pem
        chmod 644 ssl/cert.pem ssl/dhparam.pem
        
        echo -e "${GREEN}✅ Certificates generated${NC}"
        echo ""
        
        echo -e "${YELLOW}Starting Docker containers...${NC}"
        docker-compose -f docker-compose.ssl.yml up -d
        
        echo ""
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        echo -e "${GREEN}  🎉 Development Setup Complete!${NC}"
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        echo ""
        echo -e "${BLUE}Access your application:${NC}"
        echo -e "  🌐 ${CYAN}https://localhost${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Browser Warning:${NC}"
        echo "   Your browser will show a security warning."
        echo "   This is normal for self-signed certificates."
        echo ""
        echo -e "${BLUE}To proceed:${NC}"
        echo "   1. Click 'Advanced'"
        echo "   2. Click 'Proceed to localhost'"
        echo ""
        ;;
        
    2)
        # Production setup
        echo ""
        echo -e "${CYAN}════════════════════════════════════════${NC}"
        echo -e "${CYAN}  Production SSL Setup${NC}"
        echo -e "${CYAN}════════════════════════════════════════${NC}"
        echo ""
        
        echo -e "${YELLOW}Prerequisites:${NC}"
        echo "  ✓ Domain name pointing to this server"
        echo "  ✓ Ports 80 and 443 open"
        echo "  ✓ Email address for Let's Encrypt"
        echo ""
        
        read -p "$(echo -e ${BLUE}Enter your domain name:${NC} )" DOMAIN
        read -p "$(echo -e ${BLUE}Enter your email address:${NC} )" EMAIL
        
        if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
            echo -e "${RED}❌ Domain and email are required!${NC}"
            exit 1
        fi
        
        echo ""
        echo -e "${BLUE}Domain:${NC} $DOMAIN"
        echo -e "${BLUE}Email:${NC} $EMAIL"
        echo ""
        
        read -p "$(echo -e ${YELLOW}Continue? [y/N]:${NC} )" CONFIRM
        if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
            echo -e "${RED}Cancelled${NC}"
            exit 1
        fi
        
        # Create directories
        mkdir -p ssl certbot/conf certbot/www
        
        # Save configuration
        cat > certbot/certbot-config.env <<EOF
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF
        
        # Generate temporary self-signed cert
        echo ""
        echo -e "${YELLOW}Generating temporary certificates...${NC}"
        openssl genrsa -out ssl/key.pem 2048 2>/dev/null
        openssl req -new -key ssl/key.pem -out ssl/csr.pem \
            -subj "/C=US/ST=State/L=City/O=MediaScanner/CN=$DOMAIN" 2>/dev/null
        openssl x509 -req -days 1 -in ssl/csr.pem \
            -signkey ssl/key.pem -out ssl/cert.pem 2>/dev/null
        touch ssl/chain.pem
        openssl dhparam -out ssl/dhparam.pem 2048 2>/dev/null
        
        chmod 600 ssl/key.pem
        chmod 644 ssl/cert.pem ssl/dhparam.pem
        
        # Start containers
        echo -e "${YELLOW}Starting Docker containers...${NC}"
        docker-compose -f docker-compose.ssl.yml up -d
        
        # Wait for containers
        sleep 5
        
        # Get Let's Encrypt certificate
        echo ""
        echo -e "${YELLOW}Requesting Let's Encrypt certificate...${NC}"
        echo -e "${BLUE}This may take a minute...${NC}"
        echo ""
        
        docker run --rm \
            -v "$PWD/certbot/conf:/etc/letsencrypt" \
            -v "$PWD/certbot/www:/var/www/certbot" \
            certbot/certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN"
        
        if [ $? -eq 0 ]; then
            # Copy certificates
            cp "certbot/conf/live/$DOMAIN/fullchain.pem" ssl/cert.pem
            cp "certbot/conf/live/$DOMAIN/privkey.pem" ssl/key.pem
            cp "certbot/conf/live/$DOMAIN/chain.pem" ssl/chain.pem
            
            chmod 600 ssl/key.pem
            chmod 644 ssl/cert.pem ssl/chain.pem
            
            # Reload Nginx
            docker-compose -f docker-compose.ssl.yml exec nginx-lb nginx -s reload 2>/dev/null || true
            
            echo ""
            echo -e "${GREEN}════════════════════════════════════════${NC}"
            echo -e "${GREEN}  🎉 Production Setup Complete!${NC}"
            echo -e "${GREEN}════════════════════════════════════════${NC}"
            echo ""
            echo -e "${BLUE}Your site is now secured with HTTPS:${NC}"
            echo -e "  🌐 ${CYAN}https://$DOMAIN${NC}"
            echo ""
            echo -e "${BLUE}Certificate Info:${NC}"
            echo "  • Issued by: Let's Encrypt"
            echo "  • Valid for: 90 days"
            echo "  • Trusted by all browsers"
            echo ""
            echo -e "${YELLOW}Next Steps:${NC}"
            echo "  1. Setup auto-renewal:"
            echo "     ${CYAN}./scripts/setup-cert-renewal.sh${NC}"
            echo ""
            echo "  2. Test your SSL configuration:"
            echo "     ${CYAN}https://www.ssllabs.com/ssltest/${NC}"
            echo ""
        else
            echo ""
            echo -e "${RED}❌ Failed to obtain certificate${NC}"
            echo ""
            echo -e "${YELLOW}Common issues:${NC}"
            echo "  • Domain doesn't point to this server"
            echo "  • Firewall blocking port 80"
            echo "  • Rate limit exceeded"
            echo ""
            echo -e "${BLUE}Check logs:${NC}"
            echo "  ${CYAN}docker-compose -f docker-compose.ssl.yml logs nginx-lb${NC}"
            echo ""
            exit 1
        fi
        ;;
        
    3)
        # View certificates
        echo ""
        echo -e "${CYAN}════════════════════════════════════════${NC}"
        echo -e "${CYAN}  Certificate Status${NC}"
        echo -e "${CYAN}════════════════════════════════════════${NC}"
        echo ""
        
        if [ ! -f "ssl/cert.pem" ]; then
            echo -e "${YELLOW}⚠️  No certificates found${NC}"
            echo ""
            echo "Run this script again to generate certificates."
            exit 0
        fi
        
        echo -e "${GREEN}✅ Certificates found${NC}"
        echo ""
        
        # Certificate details
        echo -e "${BLUE}Certificate Details:${NC}"
        openssl x509 -text -noout -in ssl/cert.pem | grep -A 2 "Subject:"
        echo ""
        
        # Expiration
        EXPIRY=$(openssl x509 -enddate -noout -in ssl/cert.pem | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null)
        NOW_EPOCH=$(date +%s)
        DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
        
        echo -e "${BLUE}Expiration:${NC}"
        echo "  Date: $EXPIRY"
        echo "  Days remaining: $DAYS_LEFT"
        
        if [ $DAYS_LEFT -lt 30 ]; then
            echo -e "  ${RED}⚠️  Certificate expires soon!${NC}"
        else
            echo -e "  ${GREEN}✅ Certificate valid${NC}"
        fi
        echo ""
        
        # Type
        ISSUER=$(openssl x509 -issuer -noout -in ssl/cert.pem)
        if [[ $ISSUER == *"Let's Encrypt"* ]]; then
            echo -e "${BLUE}Type:${NC} ${GREEN}Let's Encrypt (Trusted)${NC}"
        else
            echo -e "${BLUE}Type:${NC} ${YELLOW}Self-signed (Development)${NC}"
        fi
        echo ""
        ;;
        
    4|*)
        echo ""
        echo -e "${BLUE}Exited${NC}"
        exit 0
        ;;
esac

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  Useful Commands${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "  docker-compose -f docker-compose.ssl.yml logs -f"
echo ""
echo -e "${YELLOW}Restart Nginx:${NC}"
echo "  docker-compose -f docker-compose.ssl.yml restart nginx-lb"
echo ""
echo -e "${YELLOW}Stop containers:${NC}"
echo "  docker-compose -f docker-compose.ssl.yml down"
echo ""
echo -e "${YELLOW}Check certificate:${NC}"
echo "  openssl x509 -text -noout -in ssl/cert.pem"
echo ""
