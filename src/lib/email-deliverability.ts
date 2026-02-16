import { resolve } from "dns";
import { promisify } from "util";

const resolveTxt = promisify(resolve) as (
  hostname: string,
  rrtype: "TXT"
) => Promise<string[][]>;

const resolveMx = promisify(resolve) as (
  hostname: string,
  rrtype: "MX"
) => Promise<Array<{ exchange: string; priority: number }>>;

interface DnsCheckResult {
  exists: boolean;
  records: string[];
}

interface DeliverabilityReport {
  domain: string;
  spf: DnsCheckResult & { valid: boolean };
  dkim: DnsCheckResult & { selector: string };
  mx: { exists: boolean; records: string[] };
  summary: "pass" | "warn" | "fail";
  recommendations: string[];
}

/**
 * Check SPF records for a domain
 */
async function checkSpf(domain: string): Promise<DnsCheckResult & { valid: boolean }> {
  try {
    const records = await resolveTxt(domain, "TXT");
    const flat = records.flat();
    const spfRecords = flat.filter((r) => r.startsWith("v=spf1"));
    const valid = spfRecords.length === 1;
    return { exists: spfRecords.length > 0, records: spfRecords, valid };
  } catch {
    return { exists: false, records: [], valid: false };
  }
}

/**
 * Check DKIM records for a domain with given selector
 */
async function checkDkim(
  domain: string,
  selector: string
): Promise<DnsCheckResult & { selector: string }> {
  try {
    const dkimDomain = `${selector}._domainkey.${domain}`;
    const records = await resolveTxt(dkimDomain, "TXT");
    const flat = records.flat();
    const dkimRecords = flat.filter((r) => r.includes("v=DKIM1"));
    return { exists: dkimRecords.length > 0, records: dkimRecords, selector };
  } catch {
    return { exists: false, records: [], selector };
  }
}

/**
 * Check MX records for a domain
 */
async function checkMx(
  domain: string
): Promise<{ exists: boolean; records: string[] }> {
  try {
    const records = (await resolveMx(domain, "MX")) as Array<{
      exchange: string;
      priority: number;
    }>;
    return {
      exists: records.length > 0,
      records: records.map((r) => `${r.priority} ${r.exchange}`),
    };
  } catch {
    return { exists: false, records: [] };
  }
}

/**
 * Run a full email deliverability check for a domain.
 * Verifies SPF, DKIM (with common selectors), and MX records.
 *
 * @param domain - The email sending domain (e.g., "surcod.ro")
 * @param dkimSelector - DKIM selector to check (default: "default")
 * @returns Full deliverability report with recommendations
 */
export async function checkDeliverability(
  domain: string,
  dkimSelector = "default"
): Promise<DeliverabilityReport> {
  const [spf, dkim, mx] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain, dkimSelector),
    checkMx(domain),
  ]);

  const recommendations: string[] = [];

  if (!spf.exists) {
    recommendations.push(
      `Add SPF record: ${domain} TXT "v=spf1 include:_spf.smtp2go.com ~all"`
    );
  } else if (!spf.valid) {
    recommendations.push(
      "Multiple SPF records found. Merge into a single record."
    );
  }

  if (!dkim.exists) {
    recommendations.push(
      `Add DKIM record: ${dkimSelector}._domainkey.${domain} TXT "v=DKIM1; k=rsa; p=<your-public-key>"`
    );
    recommendations.push(
      "Get your DKIM public key from your SMTP provider's dashboard."
    );
  }

  if (!mx.exists) {
    recommendations.push(`Add MX record for ${domain} pointing to your mail server.`);
  }

  let summary: "pass" | "warn" | "fail" = "pass";
  if (!spf.exists || !dkim.exists) {
    summary = "fail";
  } else if (!spf.valid || !mx.exists) {
    summary = "warn";
  }

  return { domain, spf, dkim, mx, summary, recommendations };
}
