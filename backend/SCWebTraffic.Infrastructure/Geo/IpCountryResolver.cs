using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace SCWebTraffic.Infrastructure.Geo;

public interface IIpCountryResolver
{
    /// <summary>ISO-like label for Session.Country (e.g. US, GB, Local, Unknown).</summary>
    Task<string> ResolveAsync(
        string ipAddress,
        string? cdnCountryHint,
        string? metadataCountryCode,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Uses optional CDN headers / collect metadata first, then a lightweight public IP API (cached).
/// </summary>
public sealed class IpCountryResolver(
    IHttpClientFactory httpClientFactory,
    IMemoryCache cache,
    ILogger<IpCountryResolver> logger) : IIpCountryResolver
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(6);

    public async Task<string> ResolveAsync(
        string ipAddress,
        string? cdnCountryHint,
        string? metadataCountryCode,
        CancellationToken cancellationToken = default)
    {
        var fromMeta = NormalizeCountryCode(metadataCountryCode);
        if (fromMeta is not null) return fromMeta;

        var fromCdn = NormalizeCountryCode(cdnCountryHint);
        if (fromCdn is not null) return fromCdn;

        if (string.IsNullOrWhiteSpace(ipAddress) || IsPrivateOrLocalIp(ipAddress))
            return "Local";

        var cacheKey = "country:" + ipAddress;
        if (cache.TryGetValue(cacheKey, out string? cached) && !string.IsNullOrEmpty(cached))
            return cached!;

        var code = await LookupIpWhoAsync(ipAddress, cancellationToken).ConfigureAwait(false);
        cache.Set(cacheKey, code, CacheDuration);
        return code;
    }

    private static string? NormalizeCountryCode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim().ToUpperInvariant();
        if (v.Length != 2 || v == "XX" || v == "T1") return null;
        if (v[0] is < 'A' or > 'Z' || v[1] is < 'A' or > 'Z') return null;
        return v;
    }

    private async Task<string> LookupIpWhoAsync(string ip, CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient(nameof(IpCountryResolver));
            using var resp = await client
                .GetAsync("https://ipwho.is/" + Uri.EscapeDataString(ip), cancellationToken)
                .ConfigureAwait(false);
            if (!resp.IsSuccessStatusCode) return "Unknown";

            await using var stream = await resp.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            var root = doc.RootElement;
            if (root.TryGetProperty("success", out var ok) && ok.ValueKind == JsonValueKind.False)
                return "Unknown";
            if (!root.TryGetProperty("country_code", out var cc) || cc.ValueKind != JsonValueKind.String)
                return "Unknown";
            var code = cc.GetString();
            return NormalizeCountryCode(code) ?? "Unknown";
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Geo lookup failed for {Ip}", ip);
            return "Unknown";
        }
    }

    private static bool IsPrivateOrLocalIp(string ip)
    {
        if (!IPAddress.TryParse(ip, out var addr)) return true;
        if (IPAddress.IsLoopback(addr)) return true;
        if (addr.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = addr.GetAddressBytes();
            if (b[0] == 10) return true;
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;
            if (b[0] == 192 && b[1] == 168) return true;
            if (b[0] == 169 && b[1] == 254) return true;
        }

        if (addr.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (addr.IsIPv6LinkLocal || addr.IsIPv6SiteLocal) return true;
        }

        return false;
    }
}
