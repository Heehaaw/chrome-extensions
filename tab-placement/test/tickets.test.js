// Unit tests for ticket parsing, using title and URL formats seen in Linear and GitLab tabs.

import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const { linearTicket, gitLabTicket, groupTicket } = createRequire(import.meta.url)("../extension/tickets.js");

const MR_SUFFIX = " · Merge requests · acme / platform / service-api · GitLab";
const linear = (path, title = "") => ({ url: `https://linear.app/acme${path}`, title });
const gitLab = (title) => ({ url: "https://gitlab.com/acme/platform/service-api/-/merge_requests/1", title: `${title}${MR_SUFFIX}` });

describe("linearTicket", () => {
  test("reads the issue ID from the URL", () => {
    expect(linearTicket(linear("/issue/EXE-311/tests-flaky-nats-test"))).toBe("EXE-311");
    expect(linearTicket(linear("/issue/EXE-311"))).toBe("EXE-311");
    expect(linearTicket({ pendingUrl: "https://linear.app/acme/issue/exe-12/x", url: "" })).toBe("EXE-12");
  });

  test("falls back to the title on other Linear pages", () => {
    expect(linearTicket(linear("/team/DFX/all", "EXE-311 Tests :: Flaky NATS test"))).toBe("EXE-311");
    expect(linearTicket(linear("/view/board-30cb1ad9b1e7", "Board"))).toBeUndefined();
  });

  test("ignores other sites", () => {
    expect(linearTicket({ url: "https://www.google.com/search?q=GS-101", title: "GS-101 glove - Google Search" })).toBeUndefined();
  });
});

describe("gitLabTicket", () => {
  test("reads the ticket from merge request titles", () => {
    expect(gitLabTicket(gitLab("EXE-257: Wire scenario replay through the measurement feed (!1852)"))).toBe("EXE-257");
    expect(gitLabTicket(gitLab("DFX-720 Add FCR delivery monitoring (!1836)"))).toBe("DFX-720");
    expect(gitLabTicket(gitLab("EXE-291, EXE-305: Require a stated purpose (!1856)"))).toBe("EXE-291");
  });

  test("reads lowercase tickets from branch names", () => {
    expect(gitLabTicket(gitLab("Commits · feat/exe-311-nats-timeout"))).toBe("EXE-311");
    expect(gitLabTicket(gitLab("exe-311/nats-timeout"))).toBe("EXE-311");
  });

  test("recognises self-managed GitLab by its title", () => {
    expect(gitLabTicket({ url: "https://git.example.com/a/b/-/merge_requests/2", title: `SGP-482: Add logging (!2)${MR_SUFFIX}` })).toBe("SGP-482");
  });

  test("ignores titles without a ticket and pages outside GitLab", () => {
    expect(gitLabTicket(gitLab("project update - enable auto-deploy to DEV (!1835)"))).toBeUndefined();
    expect(gitLabTicket(gitLab("Use UTF-8 everywhere (!3)"))).toBeUndefined();
    expect(gitLabTicket({ url: "https://second-foundation.atlassian.net/browse/SGP-482", title: "[SGP-482] Log pollution - Jira" })).toBeUndefined();
  });
});

describe("groupTicket", () => {
  test("prefers Linear when Linear and GitLab differ", () => {
    const tabs = [gitLab("EXE-291: Require a stated purpose (!1856)"), linear("/issue/EXE-305/e2e-scenarios")];
    expect(groupTicket(tabs)).toBe("EXE-305");
  });

  test("uses GitLab when no Linear tab has a ticket, and the first tab in strip order", () => {
    const tabs = [linear("/view/board"), gitLab("EXE-307: add PL manifests (!9242)"), gitLab("EXE-311: start NATS earlier (!1866)")];
    expect(groupTicket(tabs)).toBe("EXE-307");
  });

  test("returns nothing without Linear or GitLab tickets", () => {
    expect(groupTicket([{ url: "https://example.com", title: "ABC-1 elsewhere" }])).toBeUndefined();
  });
});
