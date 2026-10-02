"""
==============================================================================
WatchWise Big Data Analytics (BDA) - Clickstream Processing Engine
==============================================================================
Simulates a MapReduce / PySpark batch processing job over logs ingested via
Apache Flume into Hadoop HDFS partition directories.
==============================================================================
"""

import os
import json
import glob
from collections import Counter
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HDFS_DATA_DIR = os.path.join(BASE_DIR, "data", "hdfs", "clickstream")
OUTPUT_REPORT = os.path.join(BASE_DIR, "analytics", "bda_summary_report.txt")

def map_reduce_clickstream():
    print("=" * 70)
    print(" WATCHWISE BIG DATA ANALYTICS (BDA) — HDFS LOG PROCESSING JOB")
    print("=" * 70)
    print(f"[*] HDFS Partition Root: {HDFS_DATA_DIR}")
    print(f"[*] Scanning HDFS partitioned data blocks...")

    pattern = os.path.join(HDFS_DATA_DIR, "**", "*.txt")
    log_files = glob.glob(pattern, recursive=True)
    
    # Also check .log files
    log_files += glob.glob(os.path.join(HDFS_DATA_DIR, "**", "*.log"), recursive=True)

    if not log_files:
        print("[!] No HDFS partition blocks found yet.")
        print("[*] Generating live events from WatchWise or run traffic simulation.")
        return

    print(f"[OK] Found {len(log_files)} HDFS log block(s). Starting Mapper stage...")

    total_events = 0
    event_types = Counter()
    movie_views = Counter()
    search_queries = Counter()
    genre_views = Counter()
    hourly_distribution = Counter()

    # MAPPER: Extract key-value pairs
    for file_path in log_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                        total_events += 1
                        
                        evt_type = record.get("eventType", "UNKNOWN")
                        event_types[evt_type] += 1
                        
                        ts_str = record.get("timestamp")
                        if ts_str:
                            try:
                                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                                hourly_distribution[dt.hour] += 1
                            except Exception:
                                pass

                        payload = record.get("payload", {})
                        
                        # Movie tracking
                        title = payload.get("title")
                        if title:
                            movie_views[title] += 1
                            
                        # Genre tracking
                        genre = payload.get("genre")
                        if isinstance(genre, list):
                            for g in genre:
                                genre_views[g] += 1
                        elif isinstance(genre, str):
                            genre_views[genre] += 1
                            
                        # Search query tracking
                        query = payload.get("query")
                        if query:
                            search_queries[query.lower().strip()] += 1

                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            print(f"[WARN] Error reading {file_path}: {e}")

    # REDUCER: Aggregation
    print(f"[OK] Mapper finished: Processed {total_events:,} events.")
    print("[*] Reducer stage: Aggregating statistics...\n")

    report_lines = []
    report_lines.append("=" * 70)
    report_lines.append(f" BDA CLICKSTREAM ANALYTICS REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append("=" * 70)
    report_lines.append(f"Total Clickstream Records Ingested via Flume: {total_events:,}")
    report_lines.append(f"HDFS Partitions Analyzed: {len(log_files)}")
    report_lines.append("")

    report_lines.append("--- [1] EVENT TYPE DISTRIBUTION ---")
    for evt, count in event_types.most_common():
        pct = (count / total_events * 100) if total_events > 0 else 0
        report_lines.append(f"  {evt:<20} : {count:>6} ({pct:>5.1f}%)")
    report_lines.append("")

    report_lines.append("--- [2] TOP 5 MOST VIEWED MOVIES ---")
    for title, count in movie_views.most_common(5):
        report_lines.append(f"  {title:<35} : {count:>5} views")
    report_lines.append("")

    report_lines.append("--- [3] TOP 5 SEARCH QUERIES ---")
    for q, count in search_queries.most_common(5):
        report_lines.append(f"  '{q}'{'' :<30} : {count:>5} searches")
    report_lines.append("")

    report_lines.append("--- [4] TOP GENRE ENGAGEMENT ---")
    for g, count in genre_views.most_common(5):
        report_lines.append(f"  {g:<25} : {count:>5} interactions")
    report_lines.append("")
    report_lines.append("=" * 70)

    report_content = "\n".join(report_lines)
    print(report_content)

    os.makedirs(os.path.dirname(OUTPUT_REPORT), exist_ok=True)
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as out:
        out.write(report_content)

    print(f"\n[OK] Full BDA summary written to: {OUTPUT_REPORT}")

if __name__ == "__main__":
    map_reduce_clickstream()
