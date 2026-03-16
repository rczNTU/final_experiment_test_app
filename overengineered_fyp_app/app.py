from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
from datetime import datetime
import sqlite3

# ---------------------------
# Paths (Fly persistent storage)
# ---------------------------

DB_FILE = "data/leaderboard.db"
DATA_DIR = "data/experiments"

os.makedirs("data", exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# ---------------------------
# Flask setup
# ---------------------------

app = Flask(__name__)
app.secret_key = "eeg_experiment_secret"


# ---------------------------
# Database initialization
# ---------------------------

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        best_rt REAL,
        avg_rt REAL,
        timestamp TEXT
    )
    """)

    conn.commit()
    conn.close()


init_db()


# ---------------------------
# Helper: get leaderboard
# ---------------------------

def get_leaderboard():

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("""
    SELECT username, best_rt, avg_rt
    FROM leaderboard
    ORDER BY best_rt ASC
    LIMIT 30
    """)

    rows = cur.fetchall()
    conn.close()

    board = []

    for r in rows:
        board.append({
            "username": r[0],
            "best_rt": r[1],
            "avg_rt": r[2]
        })

    return board


# ---------------------------
# Routes
# ---------------------------

@app.route("/")
def menu():
    return render_template("menu.html")


@app.route("/leaderboard")
def leaderboard():
    return jsonify(get_leaderboard())


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

    # ---------------------------
    # DUPLICATE CHECK
    # ---------------------------

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute(
        "SELECT 1 FROM leaderboard WHERE username=? LIMIT 1",
        (username,)
    )

    exists = cur.fetchone()

    conn.close()

    if exists:
        return """
        <h2>Participant ID already used</h2>
        Please go back and choose another nickname.
        """

    # ---------------------------
    # continue experiment
    # ---------------------------

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

    best_rt = data.get("bestRT")
    username = data.get("username", "anon")

    all_rts = data.get("allRTs", [])

    if all_rts:
        avg_rt = sum(all_rts) / len(all_rts)
    else:
        avg_rt = best_rt

    best_rt = round(best_rt, 2) if best_rt else None
    avg_rt = round(avg_rt, 2) if avg_rt else None

    username = "".join(c for c in username if c.isalnum() or c == "_")[:15]

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # ---------------------------
    # Save full experiment JSON
    # ---------------------------

    filename = f"{username}_{timestamp}.json"
    path = os.path.join(DATA_DIR, filename)

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    # ---------------------------
    # Save leaderboard entry
    # ---------------------------

    if best_rt is not None:

        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()

        cur.execute("""
        INSERT INTO leaderboard (username, best_rt, avg_rt, timestamp)
        VALUES (?, ?, ?, ?)
        """, (
            username,
            best_rt,
            avg_rt,
            datetime.utcnow().isoformat()
        ))

        conn.commit()
        conn.close()

    return jsonify(get_leaderboard())


# ---------------------------
# Run server
# ---------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)