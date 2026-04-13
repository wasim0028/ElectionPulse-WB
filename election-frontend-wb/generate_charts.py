"""
generate_charts.py
──────────────────
Run this script to regenerate all 4 3D matplotlib charts
from your live SQL Server database (Test_Wasim.Election_WB_2026).

Usage:
    pip install pyodbc matplotlib numpy
    python generate_charts.py

Output: 4 PNG files in election-frontend-wb/public/charts/
"""

import os
import sys

# ── Try to connect to DB; fall back to hardcoded data if pyodbc not available ─
try:
    import pyodbc
    SERVER   = "172.16.202.79"
    DATABASE = "Test_Wasim"
    USERNAME = "sa"
    PASSWORD = "Republic@2017"
    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={SERVER};DATABASE={DATABASE};"
        f"UID={USERNAME};PWD={PASSWORD};TrustServerCertificate=yes;"
    )
    cursor = conn.cursor()

    # Pull seats won per party
    cursor.execute("""
        SELECT PARTY_NAME,
               COUNT(*)                                     AS seats_won,
               SUM(VOTES_TOTAL)                             AS total_votes,
               SUM(VOTES_TOTAL)*100.0/SUM(SUM(VOTES_TOTAL)) OVER() AS vote_share
        FROM   Election_WB_2026
        WHERE  RANK = 1 AND PARTY_NAME IS NOT NULL
        GROUP  BY PARTY_NAME
        ORDER  BY seats_won DESC
    """)
    rows = cursor.fetchall()
    parties    = [r[0] for r in rows]
    seats      = [r[1] for r in rows]
    votes_cr   = [r[2]/10_000_000 for r in rows]
    vote_share = [round(float(r[3]),2) for r in rows]
    conn.close()
    print(f"✓ Connected to DB — {len(parties)} parties loaded")

except Exception as e:
    print(f"⚠  DB connection failed ({e}), using sample data")
    parties    = ["AITC/TMC","BJP","ISF","Others"]
    seats      = [215,       77,     1,    1]
    votes_cr   = [2.8,       0.77,   0.01,  0.005]
    vote_share = [73.0,      25.7,   0.36,  0.19]

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from mpl_toolkits.mplot3d import Axes3D
import numpy as np

COLORS = ["#20C997","#FF6B35","#2563EB","#E63946","#06D6A0","#9D4EDD",
          "#F59E0B","#ADB5BD","#7B2D8B","#C1121F","#4CC9F0","#F472B6"]
colors = [COLORS[i % len(COLORS)] for i in range(len(parties))]

OUT = os.path.join(os.path.dirname(__file__),
                   "election-frontend-wb", "public", "charts")
os.makedirs(OUT, exist_ok=True)

BG = "#0f172a"

def setup_ax(ax):
    ax.set_facecolor(BG)
    ax.xaxis.pane.fill = ax.yaxis.pane.fill = ax.zaxis.pane.fill = False
    for pane in [ax.xaxis.pane, ax.yaxis.pane, ax.zaxis.pane]:
        pane.set_edgecolor("#1e293b")
    ax.grid(True, color="#1e293b", linestyle="--", linewidth=0.5, alpha=0.5)

# ════════════════════════════════════════════════════════════════════════════════
# CHART 1 — 3D Bar: Seats Won
# ════════════════════════════════════════════════════════════════════════════════
fig = plt.figure(figsize=(13, 7), facecolor=BG)
ax  = fig.add_subplot(111, projection="3d")
setup_ax(ax)

xs = np.arange(len(parties))
dx = dy = 0.6
for i, (x, z, c) in enumerate(zip(xs, seats, colors)):
    ax.bar3d(x-dx/2, -dy/2, 0, dx, dy, z, color=c, alpha=0.92,
             shade=True, edgecolor="white", linewidth=0.3)
    if z > 0:
        ax.text(x, 0, z+2, str(z), ha="center", va="bottom",
                color="white", fontsize=10, fontweight="bold")

ax.set_xticks(xs)
ax.set_xticklabels(parties, rotation=15, ha="right", color="#94a3b8", fontsize=9)
ax.set_yticks([])
ax.set_zlabel("Seats Won", color="#94a3b8", labelpad=8)
ax.tick_params(axis="z", colors="#94a3b8", labelsize=8)
ax.set_title("3D Party-wise Seats Won — WB 2026",
             color="white", fontsize=13, fontweight="bold", pad=15)
ax.view_init(elev=22, azim=-55)
plt.tight_layout()
plt.savefig(os.path.join(OUT,"chart_seats_3d.png"), dpi=150, facecolor=BG, bbox_inches="tight")
plt.close(); print("✓ Chart 1 saved")

# ════════════════════════════════════════════════════════════════════════════════
# CHART 2 — 3D Scatter: Votes × Seats × Vote Share
# ════════════════════════════════════════════════════════════════════════════════
fig = plt.figure(figsize=(13, 7), facecolor=BG)
ax  = fig.add_subplot(111, projection="3d")
setup_ax(ax)

ax.scatter(votes_cr, seats, vote_share,
           c=colors, s=[max(s*8,80) for s in seats],
           alpha=0.9, edgecolors="white", linewidth=0.6, depthshade=True)
for i, p in enumerate(parties):
    ax.text(votes_cr[i], seats[i], vote_share[i]+1.2,
            p, color="white", fontsize=8, fontweight="bold", ha="center")

ax.set_xlabel("Total Votes (Cr)", color="#94a3b8", labelpad=8)
ax.set_ylabel("Seats Won",        color="#94a3b8", labelpad=8)
ax.set_zlabel("Vote Share %",     color="#94a3b8", labelpad=8)
ax.tick_params(colors="#94a3b8", labelsize=8)
ax.set_title("3D Scatter: Votes · Seats · Vote Share",
             color="white", fontsize=13, fontweight="bold", pad=15)
ax.view_init(elev=18, azim=-50)
plt.tight_layout()
plt.savefig(os.path.join(OUT,"chart_scatter_3d.png"), dpi=150, facecolor=BG, bbox_inches="tight")
plt.close(); print("✓ Chart 2 saved")

# ════════════════════════════════════════════════════════════════════════════════
# CHART 3 — 3D Grouped: Seats vs Vote Share side by side
# ════════════════════════════════════════════════════════════════════════════════
fig = plt.figure(figsize=(13, 7), facecolor=BG)
ax  = fig.add_subplot(111, projection="3d")
setup_ax(ax)

xs = np.arange(len(parties))
w  = 0.25
for i, (x, s, vs, c) in enumerate(zip(xs, seats, vote_share, colors)):
    ax.bar3d(x-w,   -w/2, 0, w*0.9, w*0.9, s,  color=c, alpha=0.9, shade=True, edgecolor="white", linewidth=0.3)
    ax.bar3d(x+0.05,-w/2, 0, w*0.9, w*0.9, vs, color=c, alpha=0.45, shade=True, edgecolor="white", linewidth=0.3)
    if s > 0:
        ax.text(x-w+0.1, 0, s+1.5, str(s), color="white", fontsize=8, fontweight="bold", ha="center")

ax.set_xticks(xs)
ax.set_xticklabels(parties, rotation=15, ha="right", color="#94a3b8", fontsize=9)
ax.set_yticks([])
ax.set_zlabel("Value", color="#94a3b8", labelpad=8)
ax.tick_params(axis="z", colors="#94a3b8", labelsize=8)
ax.set_title("3D: Seats Won (solid) vs Vote Share % (transparent)",
             color="white", fontsize=11, fontweight="bold", pad=15)
ax.view_init(elev=22, azim=-50)
plt.tight_layout()
plt.savefig(os.path.join(OUT,"chart_grouped_3d.png"), dpi=150, facecolor=BG, bbox_inches="tight")
plt.close(); print("✓ Chart 3 saved")

# ════════════════════════════════════════════════════════════════════════════════
# CHART 4 — 3D Vote Surface
# ════════════════════════════════════════════════════════════════════════════════
fig = plt.figure(figsize=(13, 7), facecolor=BG)
ax  = fig.add_subplot(111, projection="3d")
setup_ax(ax)

for i, (p, r, c) in enumerate(zip(parties, vote_share, colors)):
    start = sum(vote_share[:i]) / 100 * 2 * np.pi
    end   = sum(vote_share[:i+1]) / 100 * 2 * np.pi
    t = np.linspace(start, end, 80)
    x = np.concatenate([[0], np.cos(t), [0]])
    y = np.concatenate([[0], np.sin(t), [0]])
    ax.plot_surface(np.array([x,x]), np.array([y,y]),
                    np.array([[0]*len(x),[r/10]*len(x)]),
                    color=c, alpha=0.85)

ax.set_title("3D Vote Share Distribution", color="white", fontsize=13, fontweight="bold", pad=15)
ax.set_axis_off()
ax.view_init(elev=35, azim=-60)
handles = [mpatches.Patch(color=c, label=f"{p} ({vs}%)")
           for p, c, vs in zip(parties, colors, vote_share)]
ax.legend(handles=handles, loc="upper left", framealpha=0.2,
          labelcolor="white", fontsize=8, facecolor=BG, edgecolor="#334155")
plt.tight_layout()
plt.savefig(os.path.join(OUT,"chart_surface_3d.png"), dpi=150, facecolor=BG, bbox_inches="tight")
plt.close(); print("✓ Chart 4 saved")

print(f"\n✅ All charts saved to: {OUT}")
print("   Refresh your browser to see updated charts.")
