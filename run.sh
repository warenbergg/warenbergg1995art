#!/bin/bash
#chmod +x run.sh
# masuk ke folder script (aman kalau double click)
cd "$(dirname "$0")"

# aktifkan venv
source venv/bin/activate

# set flask env
export FLASK_APP=app.py
export FLASK_ENV=development

# jalankan flask
flask run
