// Ticket references in Linear and GitLab tabs, used to name tab groups. Loaded by the service
// worker with importScripts and by the unit tests through module.exports.

// Ticket IDs such as EXE-311: an uppercase team key and a number.
const TICKET_PATTERN = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]{1,9}-\d{1,6})(?![A-Za-z0-9])/g;

// Branch names in GitLab titles may use a lowercase key, as in "exe-311/fix" or "exe-311-fix".
const BRANCH_TICKET_PATTERN = /(?<![A-Za-z0-9])([a-z][a-z0-9]{1,9}-\d{1,6})(?=[/-])/g;

// Standard names that look like ticket IDs in free text, such as UTF-8 or SHA-256.
const NOT_TICKET_KEYS = new Set(["AES", "CVE", "HTTP", "ISO", "MD", "RFC", "RSA", "SHA", "SSL", "TLS", "UTF"]);

const LINEAR_ISSUE_PATH = /^\/[^/]+\/issue\/([A-Za-z][A-Za-z0-9]*-\d+)(?:\/|$)/;

function firstTicket(text, pattern) {
  for (const [, id] of (text ?? "").matchAll(pattern)) {
    const ticket = id.toUpperCase();
    if (!NOT_TICKET_KEYS.has(ticket.split("-")[0])) return ticket;
  }
  return undefined;
}

function tabUrl(tab) {
  try {
    return new URL(tab.pendingUrl || tab.url || "");
  } catch {
    return undefined;
  }
}

function linearTicket(tab) {
  const url = tabUrl(tab);
  if (url?.hostname !== "linear.app") return undefined;

  const fromPath = url.pathname.match(LINEAR_ISSUE_PATH)?.[1];
  if (fromPath) return fromPath.toUpperCase();
  return firstTicket(tab.title, TICKET_PATTERN);
}

// GitLab page titles end with "· GitLab" on gitlab.com and self-managed instances.
function gitLabTicket(tab) {
  const title = tab.title ?? "";
  const isGitLab = /·\s*GitLab$/.test(title) || /(^|\.)gitlab\./.test(tabUrl(tab)?.hostname ?? "");
  if (!isGitLab) return undefined;

  return firstTicket(title, TICKET_PATTERN) ?? firstTicket(title, BRANCH_TICKET_PATTERN);
}

// Linear is the source of truth: its first ticket in strip order wins over GitLab's.
function groupTicket(tabs) {
  for (const ticketOf of [linearTicket, gitLabTicket]) {
    for (const tab of tabs) {
      const ticket = ticketOf(tab);
      if (ticket) return ticket;
    }
  }
  return undefined;
}

if (typeof module !== "undefined") {
  module.exports = { linearTicket, gitLabTicket, groupTicket };
}
