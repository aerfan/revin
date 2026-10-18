# Revin

Welcome to the **Revin** repository.

---

## 📁 Repository Structure

```text
Revin/
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI workflow
├── Inspirations/           # UI/UX reference designs & inspirations
├── .gitignore              # Git ignore rules for OS, node, build artifacts
├── GEMINI.md               # Antigravity agent instructions & context
└── README.md               # Repository documentation
```

---

## 🚀 Getting Started

### 1. Connect to GitHub Remote

Once you create a repository on GitHub (e.g. `https://github.com/<your-username>/revin.git`), connect it using:

```bash
git remote add origin https://github.com/<your-username>/revin.git
git branch -M main
git push -u origin main
```

*(Or via SSH)*:
```bash
git remote add origin git@github.com:<your-username>/revin.git
git branch -M main
git push -u origin main
```

---

## ⚙️ GitHub Workflow

A GitHub Actions workflow is pre-configured in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
- Runs automatically on pushes to `main` and all Pull Requests to `main`.
- Verifies workspace structure and will automatically install dependencies, run linter, tests, and build steps once a `package.json` is added to the project.
