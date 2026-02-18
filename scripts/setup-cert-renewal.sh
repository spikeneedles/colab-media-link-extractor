#!/bin/bash
# SSL Certificate Renewal Setup Script
# Sets up automatic renewal for Let's Encrypt certificates

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CERTBOT_DIR="./certbot"
SSL_DIR="./ssl"
CONFIG_FILE="$CERTBOT_DIR/certbot-config.env"

echo -e "${BLUE}🔄 SSL Certificate Auto-Renewal Setup${NC}"
echo ""

# Check if Let's Encrypt is configured
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Let's Encrypt not configured!${NC}"
    echo -e "${YELLOW}Please run ./scripts/setup-letsencrypt.sh first${NC}"
    exit 1
fi

source "$CONFIG_FILE"

# Create renewal script
RENEWAL_SCRIPT="$CERTBOT_DIR/renew-certs.sh"
cat > "$RENEWAL_SCRIPT" <<'EOF'
#!/bin/bash
# Automatic certificate renewal script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/ssl"
CERTBOT_DIR="$PROJECT_DIR/certbot"

cd "$PROJECT_DIR"

# Source configuration
source "$CERTBOT_DIR/certbot-config.env"

echo "=========================================="
echo "Certificate Renewal - $(date)"
echo "Domain: $DOMAIN"
echo "=========================================="

# Try to renew certificate
docker run --rm \
    -v "$CERTBOT_DIR/conf:/etc/letsencrypt" \
    -v "$CERTBOT_DIR/www:/var/www/certbot" \
    certbot/certbot renew \
    --quiet

# Check if renewal happened
if [ $? -eq 0 ]; then
    echo "✅ Certificate renewal check complete"
    
    # Copy renewed certificates
    if [ -f "$CERTBOT_DIR/conf/live/$DOMAIN/fullchain.pem" ]; then
        cp "$CERTBOT_DIR/conf/live/$DOMAIN/fullchain.pem" "$SSL_DIR/cert.pem"
        cp "$CERTBOT_DIR/conf/live/$DOMAIN/privkey.pem" "$SSL_DIR/key.pem"
        cp "$CERTBOT_DIR/conf/live/$DOMAIN/chain.pem" "$SSL_DIR/chain.pem"
        
        # Set permissions
        chmod 600 "$SSL_DIR/key.pem"
        chmod 644 "$SSL_DIR/cert.pem"
        chmod 644 "$SSL_DIR/chain.pem"
        
        echo "✅ Certificates updated"
        
        # Reload Nginx
        docker-compose -f docker-compose.ssl.yml exec nginx-lb nginx -s reload 2>/dev/null || {
            echo "⚠️  Could not reload Nginx automatically"
            echo "   Run: docker-compose -f docker-compose.ssl.yml restart nginx-lb"
        }
    fi
else
    echo "❌ Certificate renewal failed"
    exit 1
fi

echo "=========================================="
EOF

chmod +x "$RENEWAL_SCRIPT"

echo -e "${GREEN}✅ Renewal script created at $RENEWAL_SCRIPT${NC}"
echo ""

# Setup method selection
echo -e "${YELLOW}Select auto-renewal method:${NC}"
echo ""
echo "1) Cron job (traditional, runs on schedule)"
echo "2) Systemd timer (modern Linux systems)"
echo "3) Docker container (runs in Docker)"
echo "4) Manual (you'll run renewal script yourself)"
echo ""
read -p "Select option (1-4): " RENEWAL_METHOD

case $RENEWAL_METHOD in
    1)
        # Cron job setup
        echo -e "${YELLOW}Setting up cron job...${NC}"
        
        # Create cron job that runs twice daily
        CRON_CMD="0 0,12 * * * $PWD/$RENEWAL_SCRIPT >> $PWD/certbot/renewal.log 2>&1"
        
        # Check if cron job already exists
        if crontab -l 2>/dev/null | grep -q "$RENEWAL_SCRIPT"; then
            echo -e "${YELLOW}⚠️  Cron job already exists${NC}"
        else
            (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
            echo -e "${GREEN}✅ Cron job added${NC}"
        fi
        
        echo ""
        echo -e "${BLUE}Cron job will run at midnight and noon daily${NC}"
        echo -e "${BLUE}Logs: $PWD/certbot/renewal.log${NC}"
        ;;
        
    2)
        # Systemd timer setup
        echo -e "${YELLOW}Setting up systemd timer...${NC}"
        
        # Create systemd service
        sudo tee /etc/systemd/system/media-scanner-cert-renewal.service > /dev/null <<EOF
[Unit]
Description=Media Link Scanner Certificate Renewal
After=network.target

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$PWD
ExecStart=$PWD/$RENEWAL_SCRIPT

[Install]
WantedBy=multi-user.target
EOF

        # Create systemd timer
        sudo tee /etc/systemd/system/media-scanner-cert-renewal.timer > /dev/null <<EOF
[Unit]
Description=Media Link Scanner Certificate Renewal Timer
After=network.target

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 12:00:00
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

        # Enable and start timer
        sudo systemctl daemon-reload
        sudo systemctl enable media-scanner-cert-renewal.timer
        sudo systemctl start media-scanner-cert-renewal.timer
        
        echo -e "${GREEN}✅ Systemd timer enabled${NC}"
        echo ""
        echo -e "${BLUE}Check timer status:${NC}"
        echo -e "  ${YELLOW}sudo systemctl status media-scanner-cert-renewal.timer${NC}"
        echo ""
        echo -e "${BLUE}View logs:${NC}"
        echo -e "  ${YELLOW}sudo journalctl -u media-scanner-cert-renewal.service${NC}"
        ;;
        
    3)
        # Docker container setup
        echo -e "${YELLOW}Setting up Docker renewal container...${NC}"
        
        cat >> docker-compose.ssl.yml <<EOF

  # Certificate renewal container
  certbot-renew:
    image: certbot/certbot
    container_name: certbot-renew
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew --quiet; sleep 12h & wait \$\${!}; done;'"
    restart: unless-stopped
    networks:
      - app-network
EOF

        echo -e "${GREEN}✅ Certbot renewal container added to docker-compose.ssl.yml${NC}"
        echo ""
        echo -e "${BLUE}Restart Docker Compose to apply changes:${NC}"
        echo -e "  ${YELLOW}docker-compose -f docker-compose.ssl.yml up -d${NC}"
        ;;
        
    4)
        # Manual
        echo -e "${YELLOW}Manual renewal selected${NC}"
        echo ""
        echo -e "${BLUE}To manually renew certificates, run:${NC}"
        echo -e "  ${YELLOW}$RENEWAL_SCRIPT${NC}"
        echo ""
        echo -e "${YELLOW}Remember to renew before expiration (every 60-80 days)${NC}"
        ;;
        
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Auto-renewal setup complete!${NC}"
echo ""
echo -e "${BLUE}Certificate renewal will happen automatically${NC}"
echo -e "${BLUE}Certbot checks twice daily and renews when needed${NC}"
echo ""
