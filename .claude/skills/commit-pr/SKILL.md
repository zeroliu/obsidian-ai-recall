---
name: commit-pr
description: Commit current changes to GitHub by creating a new branch, committing changes, pushing to remote, and creating a pull request. Use when the user asks to commit changes, create a PR, push to GitHub, or submit their work.
---

# Commit and Create PR

Commit current changes to GitHub with a new branch and pull request.

## Instructions

Follow these steps in order:

### 1. Analyze Changes

Run these commands in parallel to understand the current state:

```bash
git status
git diff
git diff --staged
git log --oneline -5
```

### 2. Create a New Branch

Based on the changes, create a descriptive branch name:
- Use prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`
- Use kebab-case for the description
- Keep it concise but descriptive

```bash
git checkout -b <branch-name>
```

### 3. Stage and Commit

Stage all relevant changes and create a commit:

```bash
git add -A
git commit -m "$(cat <<'EOF'
<type>: <short summary>

<detailed description of what changed and why>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

Commit message guidelines:
- First line: type and short summary (50 chars max)
- Blank line
- Detailed description of what changed and why
- Types: feat, fix, refactor, docs, chore, test, style

### 4. Push to Remote

```bash
git push -u origin <branch-name>
```

### 5. Create Pull Request

Create a PR with a clear title and description:

```bash
gh pr create --title "<PR title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points summarizing the changes>

## Changes
<detailed list of what was changed>

## Why
<explanation of why these changes were made>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 6. Share the PR URL

After creating the PR, share the URL with the user so they can review it.

## Important Notes

- Never force push or use destructive git commands
- Never skip git hooks unless explicitly requested
- Do not commit files that may contain secrets (.env, credentials, etc.)
- Always verify the changes before committing
- If there are no changes to commit, inform the user instead of creating an empty commit
