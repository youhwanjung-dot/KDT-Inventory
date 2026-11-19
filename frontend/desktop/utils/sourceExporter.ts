import { APP_VERSION } from '../constants';

/**
 * Generates a lightweight installer helper script for KDT-Inventory.
 * The legacy Asan self-extracting template was removed during migration cleanup.
 */
export const generateInstallerScript = (): string => `# KDT Inventory helper installer
# Version: ${APP_VERSION}
#
# This script is intentionally lightweight.
# Use the repository files directly and run the standard project scripts below.

import os
import webbrowser

README = """KDT Inventory helper

Recommended commands (Windows, project root):
1. _Local_run_KDT.bat   -> local clean build + run
2. _Cloud_run_KDT.bat   -> clean build + Firebase deploy

GitHub:
https://github.com/youhwanjung-dot/KDT-Inventory
"""

def main():
    root = os.getcwd()
    readme_path = os.path.join(root, "KDT_INSTALLER_README.txt")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(README)

    print("KDT installer helper created:")
    print(readme_path)
    print("")
    print(README)

    try:
        webbrowser.open("https://github.com/youhwanjung-dot/KDT-Inventory")
    except Exception:
        pass

if __name__ == "__main__":
    main()
`;
