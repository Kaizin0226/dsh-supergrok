# Fixed-source provenance

## Plugin baseline

- repository: `https://github.com/wangyaominde/dsh-llm-grok-oauth.git`
- commit: `108cc76224d1845b5c88602f7c7a24bb1ced0497`
- Git tree: `41074aba06cea2af69c4c35c12992c8be21457e9`
- upstream version: `0.2.10`
- baseline `package-lock.json` SHA-256:
  `6E9D3B851D2BF00DB8CFBA8A5B66098D4B511912ACE1564AF1492E810E2B9C93`
- baseline `package.json` SHA-256:
  `1064C8CEB03D15006B3DB7FD76BA8071099CF5C7DC72E7CF8C324350A1263850`
- baseline `cordis.patch.yml` SHA-256:
  `E1FDF5387431A048A6E64D629C03B463C3032CA70FCFAB932FF30FE3A58212F9`

The hardened source was produced from a detached checkout of that exact
commit. No moving branch is an input.

## Protocol snapshot

- repository: `https://github.com/xai-org/grok-build.git`
- commit: `bc7f02eddd3d84085849dc19ed216f11c23b0571`
- Git tree: `1f9266ee49f4f1d82450b45f10f68a7dd58b23ef`
- snapshot package version: `1.0.12`
- snapshot `SOURCE_REV`: `d5a0335a47221e8c9519936cb693e9b6450227ec`

The protocol snapshot is provenance only. This plugin identifies itself as
`dsh-supergrok-oauth-hardened/0.3.0-hardened.5`; it does not claim to be an
official Grok CLI binary.

## Hash rules

- `npm run source-hash` recursively hashes the complete source, documentation,
  tests, scripts, manifest, patch and lock using sorted UTF-8 slash-separated
  paths and records `path + NUL + bytes + NUL`. It rejects symbolic links and
  excludes only `.git`, `.npm-cache`, `node_modules`, and `*.tgz`. Add `--
  --list` to print the exact ordered source file set used for the digest.
- `npm run canonical-hash` applies the Bridge runtime rule to
  `package.json`, `npm-shrinkwrap.json`, `cordis.patch.yml`,
  `supergrok-hardening.json`, and `lib/**/*.js`, also rejecting missing files
  and symbolic links.

`npm-shrinkwrap.json` is the publishable lock contract. It is derived from the
hardened dependency lock and must be present as a regular file in both the npm
tarball and installed plugin root. `package-lock.json` is intentionally absent
because npm excludes it from published packages.
