---
status: superseded by ADR-0002
---

# Public Instance with a hard private-data boundary

We run a Public Instance that renders a Card for any Subject (`?username=`), the way github-readme-stats does, instead of limiting each Instance to an allowlist. A Host's token can read private repositories the Host merely collaborates on, so Private Activity is included only when the Subject is the Host and the Host has opted in. Every other Subject's Card is built from public repositories only. The boundary is structural, not a filter: public data is fetched with a token that has no private scopes, and a separate repo-scoped token is used only for the Host's own Card. That way a filtering bug cannot publish anyone's private work.

## Considered Options

- **Allowlisted self-deploy template only**: avoids sharing one rate limit, but the goal is a Card anyone can embed without deploying anything.
- **One repo-scoped token plus filtering out private repositories**: simpler, but a single missed visibility check would publish other people's Private Activity.

## Consequences

- Every Subject draws on the Host's GitHub rate limit, so caching and Fallback Cards are required, not optional.
- A Self-Hosted Instance is the only way for anyone other than the Host to include their own Private Activity.
- Both tokens are issued from the Host's own GitHub account, so the Public Instance shares the Host's personal API rate limit. That is how other public card services work too, and the separation is enough for the privacy boundary because the public token has no private scopes. If the shared limit ever becomes contended, moving the public token to a dedicated machine account is a configuration change, not a redesign.
