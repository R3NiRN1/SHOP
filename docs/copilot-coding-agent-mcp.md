# Copilot coding agent MCP setup

Use this guide to configure the GitHub web Copilot coding agent with the repository's MCP settings.

## Where to configure it on GitHub

In GitHub, go to:

**Settings → Copilot → Coding agent → MCP configuration**

Paste the JSON from [`docs/mcp/github-coding-agent.mcp.json`](./mcp/github-coding-agent.mcp.json), then click **Save**.

## Notes

- This MCP configuration is stored in the GitHub UI.
- It is **not** a tracked repository file after you paste it into GitHub.

## Optional wider GitHub access

If you need broader GitHub access for the coding agent, create an environment named `copilot` and add the secret `COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN`.
