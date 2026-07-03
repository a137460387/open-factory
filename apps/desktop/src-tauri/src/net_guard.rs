use std::net::IpAddr;

/// Check if an IP address is private/reserved (loopback, RFC 1918, link-local, etc.)
pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_unspecified()
                || v4.octets()[0] == 10
                || (v4.octets()[0] == 172 && (v4.octets()[1] & 0xF0) == 16)
                || (v4.octets()[0] == 192 && v4.octets()[1] == 168)
                || v4.octets()[0] == 169 && v4.octets()[1] == 254
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || {
                    let segments = v6.segments();
                    (segments[0] & 0xFE00) == 0xFC00 // fc00::/7 unique local
                }
        }
    }
}

/// Parse a URL, resolve its host, and block private/reserved IP addresses.
/// Returns the parsed URL on success, or an error if SSRF would occur.
pub async fn ensure_not_private(url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|error| error.to_string())?;
    match parsed.scheme() {
        "https" | "http" => {}
        _ => return Err("URL must use http or https.".to_string()),
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "URL has no host.".to_string())?;
    let port = parsed.port_or_known_default().unwrap_or(80);
    let addrs: Vec<IpAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|error| format!("Failed to resolve host: {}", error))?
        .map(|addr| addr.ip())
        .collect();
    if addrs.is_empty() {
        return Err("Host resolved to no addresses.".to_string());
    }
    for ip in &addrs {
        if is_private_ip(*ip) {
            return Err(format!(
                "URL resolves to a private/reserved IP address ({}). SSRF blocked.",
                ip
            ));
        }
    }
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    #[test]
    fn detects_private_ipv4() {
        assert!(is_private_ip(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))));
        assert!(is_private_ip(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))));
        assert!(is_private_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1))));
        assert!(is_private_ip(IpAddr::V4(Ipv4Addr::new(172, 16, 0, 1))));
        assert!(is_private_ip(IpAddr::V4(Ipv4Addr::new(169, 254, 0, 1))));
    }

    #[test]
    fn allows_public_ipv4() {
        assert!(!is_private_ip(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
        assert!(!is_private_ip(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1))));
    }

    #[test]
    fn detects_private_ipv6() {
        assert!(is_private_ip(IpAddr::V6(Ipv6Addr::LOCALHOST)));
        assert!(is_private_ip(IpAddr::V6(Ipv6Addr::UNSPECIFIED)));
        // fc00::/7
        assert!(is_private_ip(IpAddr::V6(Ipv6Addr::new(0xfc00, 0, 0, 0, 0, 0, 0, 1))));
    }

    #[tokio::test]
    async fn blocks_private_ip_urls() {
        assert!(ensure_not_private("http://127.0.0.1:8080/api").await.is_err());
        assert!(ensure_not_private("http://10.0.0.1/api").await.is_err());
        assert!(ensure_not_private("http://192.168.1.1/api").await.is_err());
    }

    #[tokio::test]
    async fn rejects_non_http_schemes() {
        assert!(ensure_not_private("file:///tmp/test").await.is_err());
        assert!(ensure_not_private("ftp://example.com/test").await.is_err());
    }
}
