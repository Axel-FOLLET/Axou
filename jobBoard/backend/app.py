import os
from pathlib import Path

from flask import Flask, abort, send_from_directory

from routes.ads import bp as ads_bp
from routes.auth import auth
from routes.admin import bp as admin_bp
from routes.verification import verification
from auth_utils import init_security
from routes.recruiter import recruiter

# Build React (npm run build), servi par Flask quand il existe : une seule origine
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

app = Flask(__name__, static_folder=None)
init_security(app)
app.register_blueprint(ads_bp, url_prefix="/api")
app.register_blueprint(auth, url_prefix="/api/auth")
app.register_blueprint(verification, url_prefix="/api/auth")
app.register_blueprint(admin_bp, url_prefix="/api")
app.register_blueprint(recruiter, url_prefix="/api")

if os.environ.get("DEMO_MODE") == "1":
    from demo import demo, ensure_demo_accounts

    app.register_blueprint(demo, url_prefix="/api/demo")
    ensure_demo_accounts()


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path):
    """Fichiers du build ; toute autre adresse reçoit index.html (routes React)."""
    if path.startswith("api/") or not DIST.is_dir():
        abort(404)
    if path and (DIST / path).is_file():
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")


#------ lance un serveur--------
if __name__ == "__main__":
    app.run(port=5000, debug=True)
