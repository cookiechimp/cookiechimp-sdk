# Search documentation

Search the SDK reference, package guides and examples. Results link directly to
matching sections. The index is generated from these docs at build time and
searched in your browser. Queries are not sent to a search provider or recorded
as SDK telemetry. The URL preserves the query for sharing and reloads; a host
may log that URL like any other page request.

The search page loads a same-origin script and JSON index. The other documentation
pages continue to render without scripts. If JavaScript is unavailable, open
[the full docs](llms-full.txt) and use your browser's Find command, or read
`llms-full.txt`. Hosting still requires only the static build artifact.
