# Each Instance depicts only its own Host

The source code is public, but every deployed Instance renders the Card for exactly one Subject, set in that Instance's configuration, and that Subject is normally the Host. Anyone else who wants a Card forks the repository, changes the configuration and deploys their own Instance. A shared Public Instance (ADR-0001) would have pooled every Subject onto one GitHub rate limit and one Vercel Hobby allowance, and it needed a private-data boundary between strangers. A single-Subject Instance needs none of that, and the Host still gets their own Card.

## Considered Options

- **Public Instance for any Subject** (ADR-0001): the github-readme-stats model. People can embed a Card without deploying anything, but the Host has to run a shared service for them.

## Consequences

- There is no `username` URL parameter. The Subject comes from the Instance's configuration.
- Private Activity only ever uses the Host's own token, so the two-token split from ADR-0001 is no longer needed.
- Other people's onboarding is the fork-and-deploy guide, which makes that guide part of the product.
