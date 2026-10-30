#!/usr/bin/env python3
"""TikTok video stats for the War Room marketing loop (official Display API v2, read-only).

Commands
  auth-url            print the one-time login URL (open it, click Allow, copy the `code` from the redirect URL)
  exchange CODE       turn that code into tokens; prints the refresh token to store as the TIKTOK_REFRESH_TOKEN secret
  fetch [out.json]    refresh the access token and write every video's views/likes/comments/shares (default: stats.json)

Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI (auth/exchange), TIKTOK_REFRESH_TOKEN (fetch).
Scopes used: user.info.basic, video.list. Nothing here can post, edit or delete.
"""
import json, os, sys, time, urllib.parse, urllib.request

API = "https://open.tiktokapis.com/v2"
AUTH = "https://www.tiktok.com/v2/auth/authorize/"
SCOPES = "user.info.basic,video.list"
FIELDS = "id,title,video_description,create_time,share_url,duration,view_count,like_count,comment_count,share_count"


def env(k):
    v = os.environ.get(k)
    if not v:
        sys.exit(f"missing env {k}")
    return v


def post(url, data=None, form=None, token=None):
    headers = {"Content-Type": "application/json" if data is not None else "application/x-www-form-urlencoded"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"{url} -> HTTP {e.code}: {e.read().decode()[:400]}")


def token_call(form):
    out = post(f"{API}/oauth/token/", form=form)
    if "access_token" not in out:
        sys.exit(f"token error: {out}")
    return out


def cmd_auth_url():
    q = {"client_key": env("TIKTOK_CLIENT_KEY"), "response_type": "code", "scope": SCOPES,
         "redirect_uri": env("TIKTOK_REDIRECT_URI"), "state": str(int(time.time()))}
    print(AUTH + "?" + urllib.parse.urlencode(q))


def cmd_exchange(code):
    t = token_call({"client_key": env("TIKTOK_CLIENT_KEY"), "client_secret": env("TIKTOK_CLIENT_SECRET"),
                    "code": urllib.parse.unquote(code), "grant_type": "authorization_code",
                    "redirect_uri": env("TIKTOK_REDIRECT_URI")})
    print("open_id:", t.get("open_id"))
    print("scopes:", t.get("scope"))
    print("\nStore this as the GitHub secret TIKTOK_REFRESH_TOKEN (valid ~1 year, renewed on every fetch):\n")
    print(t["refresh_token"])


def cmd_fetch(out_path="stats.json"):
    t = token_call({"client_key": env("TIKTOK_CLIENT_KEY"), "client_secret": env("TIKTOK_CLIENT_SECRET"),
                    "grant_type": "refresh_token", "refresh_token": env("TIKTOK_REFRESH_TOKEN")})
    access = t["access_token"]
    # The refresh token rotates; print the new one on stderr so the workflow can store it.
    if t.get("refresh_token") and t["refresh_token"] != os.environ["TIKTOK_REFRESH_TOKEN"]:
        print(f"::add-mask::{t['refresh_token']}", file=sys.stderr)
        print(f"NEW_REFRESH_TOKEN={t['refresh_token']}", file=sys.stderr)

    videos, cursor = [], None
    while True:
        body = {"max_count": 20}
        if cursor:
            body["cursor"] = cursor
        r = post(f"{API}/video/list/?fields={FIELDS}", data=body, token=access)
        if r.get("error", {}).get("code", "ok") != "ok":
            sys.exit(f"video.list error: {r['error']}")
        d = r.get("data", {})
        videos += d.get("videos", [])
        if not d.get("has_more"):
            break
        cursor = d.get("cursor")

    now = int(time.time())
    rows = []
    for v in videos:
        age_h = max(1, (now - int(v.get("create_time", now))) / 3600)
        views = int(v.get("view_count", 0))
        rows.append({
            "id": v.get("id"), "posted": time.strftime("%Y-%m-%d %H:%M", time.gmtime(int(v.get("create_time", now)))) + "Z",
            "age_hours": round(age_h, 1), "title": v.get("title") or v.get("video_description", ""),
            "duration_s": v.get("duration"), "url": v.get("share_url"),
            "views": views, "likes": int(v.get("like_count", 0)), "comments": int(v.get("comment_count", 0)),
            "shares": int(v.get("share_count", 0)),
            "views_per_hour": round(views / age_h, 2),
            "engagement_pct": round(100 * (int(v.get("like_count", 0)) + int(v.get("comment_count", 0)) + int(v.get("share_count", 0))) / views, 2) if views else 0.0,
        })
    rows.sort(key=lambda r: r["posted"], reverse=True)
    summary = {
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
        "video_count": len(rows),
        "total_views": sum(r["views"] for r in rows),
        "median_views": sorted(r["views"] for r in rows)[len(rows) // 2] if rows else 0,
        "top_by_views": [r["id"] for r in sorted(rows, key=lambda r: -r["views"])[:3]],
        "top_by_engagement": [r["id"] for r in sorted(rows, key=lambda r: -r["engagement_pct"])[:3]],
        "videos": rows,
    }
    with open(out_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"wrote {out_path}: {len(rows)} videos, {summary['total_views']} views")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "auth-url":
        cmd_auth_url()
    elif a[0] == "exchange" and len(a) > 1:
        cmd_exchange(a[1])
    elif a[0] == "fetch":
        cmd_fetch(*a[1:2])
    else:
        sys.exit(__doc__)
