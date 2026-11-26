#!/usr/bin/env bash
set -euo pipefail

domain=fourstar.phirmy.com
ip=4.240.114.186
webroot=/var/www/fourstar-acme
certificate="/etc/letsencrypt/live/$domain/fullchain.pem"
site=/etc/nginx/sites-enabled/fourstar-tls

if [[ -f "$webroot/.https-enabled" ]]; then
    exit 0
fi

if [[ ! -s "$certificate" ]]; then
    current=$(getent ahostsv4 "$domain" | awk 'NR == 1 { print $1 }' || true)
    if [[ "$current" != "$ip" ]]; then
        echo "Waiting for DNS-only A record $domain -> $ip"
        exit 0
    fi
    account_args=()
    parent_renewal="/etc/letsencrypt/renewal/${domain#*.}.conf"
    if [[ -r "$parent_renewal" ]]; then
        account=$(awk -F= '/^[[:space:]]*account[[:space:]]*=/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$parent_renewal")
        if [[ -n "$account" ]]; then account_args=(--account "$account"); fi
    fi
    certbot certonly "${account_args[@]}" --webroot -w "$webroot" --cert-name "$domain" -d "$domain" \
        --keep-until-expiring --agree-tos --non-interactive --register-unsafely-without-email \
        --deploy-hook 'systemctl reload nginx'
fi

if [[ ! -e "$site" ]]; then
    ln -s /etc/nginx/sites-available/fourstar-tls "$site"
fi
nginx -t
systemctl reload nginx
install -m 644 /dev/null "$webroot/.https-enabled"
echo "HTTPS enabled for $domain"
