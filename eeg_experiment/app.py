from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
from datetime import datetime
LEADERBOARD_FILE = "leaderboard.json"
app = Flask(__name__)

# Needed for session storage
app.secret_key = "eeg_experiment_secret"

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)


@app.route("/")
def menu():
    return render_template("menu.html")

@app.route("/leaderboard")
def leaderboard():

    if not os.path.exists(LEADERBOARD_FILE):
        return jsonify([])

    try:
        with open(LEADERBOARD_FILE) as f:
            board = json.load(f)

            if not isinstance(board, list):
                board = []

    except Exception:
        board = []

    return jsonify(board)
@app.route("/start", methods=["POST"])
def start():

    patterns = request.form.getlist("patterns")
    username = request.form.get("username", "anonymous")

    if not patterns:
        return redirect(url_for("menu"))

    # sanitize username
    username = "".join(c for c in username if c.isalnum() or c == "_")[:15]
    if username == "":
        username = "anonymous"

    session["pattern_order"] = patterns
    session["username"] = username

    return redirect(url_for("experiment"))


@app.route("/experiment")
def experiment():

    pattern_order = session.get("pattern_order", ["1"])
    username = session.get("username", "anonymous")

    return render_template(
        "experiment.html",
        pattern_order=pattern_order,
        username=username
    )


@app.route("/save", methods=["POST"])
def save():

    data = request.json

    # Save session file
    filename = datetime.now().strftime("session_%Y%m%d_%H%M%S.json")
    path = os.path.join(DATA_DIR, filename)

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    username = data.get("username", "anon")
    best_rt = data.get("bestRT")

    leaderboard = []

    if os.path.exists(LEADERBOARD_FILE):
        try:
            with open(LEADERBOARD_FILE) as f:
                leaderboard = json.load(f)

                if not isinstance(leaderboard, list):
                    leaderboard = []

        except Exception:
            leaderboard = []

    leaderboard.append({
    "username": username,
    "best_rt": best_rt
})

    # Remove invalid RTs
    leaderboard = [x for x in leaderboard if x["best_rt"] is not None]

    # Sort
    leaderboard = sorted(leaderboard, key=lambda x: x["best_rt"])[:10]

    with open(LEADERBOARD_FILE, "w") as f:
        json.dump(leaderboard, f, indent=2)

    return jsonify(leaderboard)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)