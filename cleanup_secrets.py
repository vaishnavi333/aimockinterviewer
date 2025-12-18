import os
import re
import json

# === Secret patterns to remove ===
SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9]{32,}",                         # OpenAI API keys
    r"hf_[A-Za-z0-9]{30,}",                         # Hugging Face tokens
    r"aws_secret_access_key\s*=\s*['\"]([^'\"]+)['\"]",
    r"aws_access_key_id\s*=\s*['\"]([^'\"]+)['\"]",
    r"AIza[0-9A-Za-z_-]{35}",                      # Google API keys
    r"(?i)api[_-]?key\s*[:=]\s*['\"]([^'\"]+)['\"]",
]

def clean_text(text):
    """Replace all matching secret patterns with REDACTED."""
    for pattern in SECRET_PATTERNS:
        text = re.sub(pattern, "REDACTED", text)
    return text

def clean_notebook(path):
    """Clean secrets from Jupyter notebook cells."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            nb = json.load(f)

        cleaned = False

        for cell in nb.get("cells", []):
            if "source" in cell:
                original = "".join(cell["source"])
                cleaned_text = clean_text(original)
                if cleaned_text != original:
                    cleaned = True
                    cell["source"] = [cleaned_text]

        if cleaned:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(nb, f, indent=2)
            print(f"Cleaned secrets → {path}")

    except Exception as e:
        print(f"⚠️ Error cleaning {path}: {e}")

def clean_file(path):
    """Clean secrets from text-based files."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        cleaned_content = clean_text(content)

        if cleaned_content != content:
            with open(path, "w", encoding="utf-8") as f:
                f.write(cleaned_content)
            print(f"Cleaned secrets → {path}")

    except Exception:
        # ignore non-text files
        pass

def scan_and_clean():
    print("\n=== 🔍 Scanning project for secrets... ===\n")
    
    for root, dirs, files in os.walk("."):
        # skip git directory
        if ".git" in dirs:
            dirs.remove(".git")

        for file in files:
            path = os.path.join(root, file)

            if file.endswith(".ipynb"):
                clean_notebook(path)
            elif file.endswith((".py", ".txt", ".json", ".md", ".yaml", ".yml", ".env")):
                clean_file(path)

    print("\n===  Secret cleanup complete! ===")
    print("You can now safely recommit and push your repository.\n")

if __name__ == "__main__":
    scan_and_clean()
