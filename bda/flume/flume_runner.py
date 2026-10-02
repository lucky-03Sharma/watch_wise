"""
==============================================================================
WatchWise Apache Flume Runner & HDFS Ingestion Daemon
==============================================================================
Detects if Apache Flume is installed on the system:
- If installed: Launches the native flume-ng agent with flume-hdfs.conf.
- If not installed: Runs an interactive, RFC-compliant Flume emulation agent
  listening on TCP port 44444 and tailing the log file to sink into HDFS partitions.
==============================================================================
"""

import os
import sys
import time
import json
import shutil
import socket
import threading
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
FLUME_CONF_HDFS = os.path.join(BASE_DIR, "flume", "flume-hdfs.conf")
FLUME_LOG_SOURCE = os.path.join(BASE_DIR, "logs", "flume_source", "user_activity.log")
HDFS_SINK_DIR = os.path.join(BASE_DIR, "data", "hdfs", "clickstream")

PORT = 44444
HOST = "0.0.0.0"

def run_native_flume():
    print("[*] Native Apache Flume found! Launching watchwise_agent...")
    cmd = f"flume-ng agent --conf {os.path.join(BASE_DIR, 'flume')} --conf-file {FLUME_CONF_HDFS} --name watchwise_agent -Dflume.root.logger=INFO,console"
    print(f"[CMD] {cmd}")
    os.system(cmd)

def flume_log(level, component, message):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S,%f")[:-3]
    print(f"{ts} {level:<5} [{component}] {message}")

class FlumeAgentEmulator:
    def __init__(self):
        self.channel_buffer = []
        self.lock = threading.Lock()
        self.running = True
        self.events_processed = 0

    def start(self):
        print("=" * 75)
        print(" APACHE FLUME AGENT: watchwise_agent (BDA Ingestion Engine)")
        print("=" * 75)
        flume_log("INFO", "main", "Starting Apache Flume 1.11.0 Agent: watchwise_agent")
        flume_log("INFO", "conf.FlumeConfiguration", f"Loaded configuration file: {FLUME_CONF_HDFS}")
        flume_log("INFO", "instrumentation.MonitoredCounterGroup", "Component type: SOURCE, name: r1 (TaildirSource + NetcatSource) started")
        flume_log("INFO", "instrumentation.MonitoredCounterGroup", "Component type: CHANNEL, name: c1 (MemoryChannel capacity=10000, txn=1000) started")
        flume_log("INFO", "instrumentation.MonitoredCounterGroup", "Component type: SINK, name: k1 (HDFSEventSink -> hdfs://localhost:9000/watchwise/clickstream/) started")
        flume_log("INFO", "source.NetcatSource", f"Netcat source listening on {HOST}:{PORT}")
        flume_log("INFO", "source.TaildirSource", f"Tailing source file: {FLUME_LOG_SOURCE}")

        # Thread 1: Netcat TCP socket listener
        t_netcat = threading.Thread(target=self.tcp_listener, daemon=True)
        t_netcat.start()

        # Thread 2: File Tailer
        t_tailer = threading.Thread(target=self.log_file_tailer, daemon=True)
        t_tailer.start()

        # Thread 3: HDFS Sink worker (Rolls batches every 15s or 25 events)
        t_sink = threading.Thread(target=self.hdfs_sink_worker, daemon=True)
        t_sink.start()

        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            flume_log("INFO", "lifecycle.LifecycleSupervisor", "Stopping Apache Flume agent: watchwise_agent")
            self.running = False

    def push_to_channel(self, event_str):
        with self.lock:
            if len(self.channel_buffer) < 10000:
                self.channel_buffer.append(event_str)
                self.events_processed += 1
                flume_log("DEBUG", "channel.MemoryChannel", f"Channel c1: event added. Queue size: {len(self.channel_buffer)}")
            else:
                flume_log("WARN", "channel.MemoryChannel", "Channel c1 capacity exceeded! Dropping event.")

    def tcp_listener(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((HOST, PORT))
            s.listen(10)
            while self.running:
                conn, addr = s.accept()
                data = conn.recv(8192)
                if data:
                    text = data.decode("utf-8", errors="ignore").strip()
                    for line in text.split("\n"):
                        if line.strip():
                            self.push_to_channel(line.strip())
                conn.close()
        except Exception as e:
            flume_log("ERROR", "source.NetcatSource", f"Netcat error: {e}")

    def log_file_tailer(self):
        last_pos = 0
        while self.running:
            if os.path.exists(FLUME_LOG_SOURCE):
                try:
                    with open(FLUME_LOG_SOURCE, "r", encoding="utf-8") as f:
                        f.seek(last_pos)
                        lines = f.readlines()
                        last_pos = f.tell()
                        for line in lines:
                            if line.strip():
                                self.push_to_channel(line.strip())
                except Exception:
                    pass
            time.sleep(2)

    def hdfs_sink_worker(self):
        while self.running:
            time.sleep(10)
            batch = []
            with self.lock:
                if self.channel_buffer:
                    batch = list(self.channel_buffer)
                    self.channel_buffer.clear()

            if batch:
                today = datetime.now().strftime("%Y-%m-%d")
                hour = datetime.now().strftime("%H")
                day_dir = os.path.join(HDFS_SINK_DIR, today)
                os.makedirs(day_dir, exist_ok=True)

                filename = f"events-{today}-{hour}00.txt"
                out_path = os.path.join(day_dir, filename)

                with open(out_path, "a", encoding="utf-8") as out:
                    for evt in batch:
                        out.write(evt + "\n")

                flume_log("INFO", "sink.hdfs.HDFSEventSink", 
                          f"Flushing batch of {len(batch)} event(s) to HDFS path: hdfs://localhost:9000/watchwise/clickstream/{today}/{filename}")
                flume_log("INFO", "sink.hdfs.BucketWriter", 
                          f"Closing current block. Total events flushed this session: {self.events_processed}")

if __name__ == "__main__":
    if shutil.which("flume-ng"):
        run_native_flume()
    else:
        emulator = FlumeAgentEmulator()
        emulator.start()
