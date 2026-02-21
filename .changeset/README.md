# Changesets

This folder manages versioning and changelog generation for the typesugar monorepo.

## For Contributors

When making changes that affect published packages, create a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the bump type (patch/minor/major)
3. Write a summary of the change

The changeset file will be committed with your PR.

## For Maintainers

### Manual Release

```bash
pnpm version    # Apply changesets, bump versions, update changelogs
pnpm release    # Build and publish to npm
```

### Automated Release (via GitHub Actions)

When PRs with changesets are merged to `main`, the release workflow:
1. Creates a "Version Packages" PR that batches pending changesets
2. When that PR is merged, publishes to npm automatically

### Skipping Releases

For changes that don't need a release:
```bash
pnpm changeset --empty
```

## Resources

- [Changesets documentation](https://github.com/changesets/changesets)
- [Common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md)
