#!/usr/bin/env bash
# One-time setup for WSL Ubuntu: installs tools, builds the compiler, installs
# the Python and Node dependencies, and runs the test suite.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/5  System packages (flex, bison, gcc, make, python venv)"
sudo apt update
sudo apt install -y flex bison build-essential python3 python3-venv python3-pip

echo "==> 2/5  Node.js check"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 18 ]; then
  echo "Node.js 18 or newer is required (found: $(node -v 2>/dev/null || echo none))."
  echo "Install it with nvm, then run this script again:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "  source ~/.bashrc && nvm install --lts"
  exit 1
fi
echo "Node $(node -v), npm $(npm -v)"

echo "==> 3/5  Building the compiler (Flex + Bison + gcc)"
make -C backend/compiler clean
make -C backend/compiler

echo "==> 4/5  Python virtual environment"
python3 -m venv backend/.venv
backend/.venv/bin/pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements.txt

echo "==> 5/5  Frontend packages"
(cd frontend && npm install)

echo
echo "Running the compiler test suite..."
(cd backend && .venv/bin/python tests/run_tests.py)

echo
echo "Setup complete. Start the app with:  ./scripts/dev.sh"
