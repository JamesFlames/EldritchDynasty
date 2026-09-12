# CatDesk Dev Container

This container gives CatDesk read/write access to the host directory that
contains this repository. Every sibling repository in that directory appears
inside the container under `/workspaces/repos`.

The install is pinned to the tested CatDesk 0.8.0 release. Update that version
in `devcontainer.json` deliberately rather than installing an unreviewed latest
release whenever the container is rebuilt.

## Start CatDesk

1. In VS Code, run **Dev Containers: Reopen in Container**.
2. Open a terminal in the container and run `catdesk`.
3. For coding, choose CatDesk's computer/workspace mode. Browser control would
   control a browser installed in the container, not the normal host browser.
4. On first launch, enter the ngrok authtoken and static domain requested by
   CatDesk. They are saved in the `catdesk-state` Docker volume, not this repo.
5. Add the HTTPS MCP URL displayed by CatDesk as a custom app/connector in
   ChatGPT and scan its tools.

Port forwarding alone is not enough: ChatGPT connects to a remote MCP endpoint,
so CatDesk's ngrok tunnel must be running while the connector is in use.

## Repository instructions

CatDesk has one workspace root. Because that root is `/workspaces/repos`, a
repository's own `AGENTS.md` is below the root and is not selected automatically.
On first creation, the container seeds `~/.catdesk/AGENTS.md` with a rule to read
the target repository's instructions before changing it. That copy lives in the
`catdesk-state` volume, so you can customize it without committing personal
instructions or losing them during a rebuild.

All sibling repositories are mounted read/write. To reduce the trust boundary,
replace `workspaceMount` with explicit bind mounts for only the repositories
CatDesk should be allowed to modify.
