#!/bin/bash
# SSL Certificate Generation Script
# Generates self-signed certificates for development or prepares for Let's Encrypt in production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SSL_DIR="./ssl"
CERTBOT_DIR="./certbot"

# Create directories
mkdir -p "$SSL_DIR"
mkdir -p "$CERTBOT_DIR/conf"
mkdir -p "$CERTBOT_DIR/www"

echo -e "${BLUE}🔐 SSL Certificate Setup for Media Link Scanner${NC}"
echo ""

# Function to generate self-signed certificates
generate_self_signed() {
    echo -e "${YELLOW}Generating self-signed SSL certificates for development...${NC}"
    
    # Generate private key
    openssl genrsa -out "$SSL_DIR/key.pem" 2048
    
    # Generate certificate signing request
    openssl req -new -key "$SSL_DIR/key.pem" -out "$SSL_DIR/csr.pem" \
        -subj "/C=US/ST=State/L=City/O=MediaLinkScanner/OU=Development/CN=localhost"
    
    # Generate self-signed certificate (valid for 365 days)
    openssl x509 -req -days 365 -in "$SSL_DIR/csr.pem" \
        -signkey "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem"
    
    # Create empty chain file
    touch "$SSL_DIR/chain.pem"
    
    # Generate DH parameters
    echo -e "${YELLOW}Generating Diffie-Hellman parameters (this may take a while)...${NC}"
    openssl dhparam -out "$SSL_DIR/dhparam.pem" 2048
    
    # Set permissions
    chmod 600 "$SSL_DIR/key.pem"
    chmod 644 "$SSL_DIR/cert.pem"
    chmod 644 "$SSL_DIR/dhparam.pem"
    
    echo -e "${GREEN}✅ Self-signed certificates generated successfully!${NC}"
    echo -e "${YELLOW}⚠️  Note: These certificates are for development only.${NC}"
    echo -e "${YELLOW}    Browsers will show security warnings.${NC}"
}

# Function to prepare for Let's Encrypt
prepare_letsencrypt() {
    echo -e "${YELLOW}Preparing for Let's Encrypt certificates...${NC}"
    
    read -p "Enter your domain name (e.g., example.com): " DOMAIN
    read -p "Enter your email address: " EMAIL
    
    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        echo -e "${RED}❌ Domain and email are required!${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
    echo -e "${BLUE}Email: ${EMAIL}${NC}"
    echo ""
    
    read -p "Is this correct? (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ]; then
        echo -e "${RED}Cancelled.${NC}"
        exit 1
    fi
    
    # Create temporary self-signed cert for initial setup
    generate_self_signed
    
    # Create certbot configuration
    cat > "$CERTBOT_DIR/certbot-config.env" <<EOF
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF
    
    echo ""
    echo -e "${GREEN}✅ Let's Encrypt preparation complete!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Ensure your domain points to this server"
    echo -e "2. Start the Docker containers: ${YELLOW}docker-compose -f docker-compose.ssl.yml up -d${NC}"
    echo -e "3. Run the certificate script: ${YELLOW}./scripts/setup-letsencrypt.sh${NC}"
}

# Function to check existing certificates
check_certificates() {
    if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ]; then
        echo -e "${GREEN}✅ Certificates found in $SSL_DIR${NC}"
        
        # Check expiration
        EXPIRY=$(openssl x509 -enddate -noout -in "$SSL_DIR/cert.pem" | cut -d= -f2)
        echo -e "${BLUE}Certificate expires: ${EXPIRY}${NC}"
        
        # Check if it's self-signed
        ISSUER=$(openssl x509 -issuer -noout -in "$SSL_DIR/cert.pem")
        if [[ $ISSUER == *"MediaLinkScanner"* ]] || [[ $ISSUER == *"localhost"* ]]; then
            echo -e "${YELLOW}⚠️  Self-signed certificate detected${NC}"
        else
            echo -e "${GREEN}✅ CA-signed certificate${NC}"
        fi
        
        return 0
    else
        echo -e "${YELLOW}⚠️  No certificates found${NC}"
        return 1
    fi
}

# Main menu
echo ""
if check_certificates; then
    echo ""
    echo -e "${YELLOW}Certificates already exist. What would you like to do?${NC}"
    echo ""
    echo "1) Keep existing certificates"
    echo "2) Regenerate self-signed certificates"
    echo "3) Setup Let's Encrypt"
    echo "4) Exit"
    echo ""
    read -p "Select option (1-4): " OPTION
else
    echo ""
    echo "Select certificate type:"
    echo ""
    echo "1) Self-signed (for development/testing)"
    echo "2) Let's Encrypt (for production)"
    echo "3) Exit"
    echo ""
    read -p "Select option (1-3): " OPTION
fi

case $OPTION in
    1)
        if check_certificates; then
            echo -e "${GREEN}✅ Using existing certificates${NC}"
        else
            generate_self_signed
        fi
        ;;
    2)
        generate_self_signed
        ;;
    3)
        prepare_letsencrypt
        ;;
    4|*)
        echo -e "${BLUE}Exited.${NC}"
        exit 0
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${BLUE}Certificate files:${NC}"
echo -e "  📄 Certificate: ${SSL_DIR}/cert.pem"
echo -e "  🔑 Private Key: ${SSL_DIR}/key.pem"
echo -e "  🔗 Chain: ${SSL_DIR}/chain.pem"
echo -e "  🔐 DH Params: ${SSL_DIR}/dhparam.pem"
echo ""
echo -e "${BLUE}To start the application with HTTPS:${NC}"
echo -e "  ${YELLOW}docker-compose -f docker-compose.ssl.yml up -d${NC}"
echo ""
