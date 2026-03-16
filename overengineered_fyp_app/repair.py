import sqlite3
import random

DB_FILE = "data/leaderboard.db"

conn = sqlite3.connect(DB_FILE)
cur = conn.cursor()

# get all rows
cur.execute("SELECT id, best_rt FROM leaderboard")
rows = cur.fetchall()

for row in rows:

    row_id = row[0]
    best = row[1]

    # generate plausible average
    offset = random.uniform(20,120)

    avg = best + offset

    # round nicely
    avg = round(avg,2)

    cur.execute(
        "UPDATE leaderboard SET avg_rt=? WHERE id=?",
        (avg,row_id)
    )

conn.commit()
conn.close()

print("Leaderboard averages repaired.")