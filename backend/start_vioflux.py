#!/usr/bin/env python3
"""
VioFlux Startup Script
Starts the Flask API server and opens the frontend in your browser.
"""

import subprocess
import sys
import time
import webbrowser
import threading
from pathlib import Path

def start_api_server():
    """Start the Flask API server"""
    print("Starting VioFlux API server...")
    try:
        # Run the API server
        subprocess.run([sys.executable, "api_server.py"], check=True)
    except KeyboardInterrupt:
        print("\nAPI server stopped.")
    except Exception as e:
        print(f"Error starting API server: {e}")

def open_frontend():
    """Open the frontend in the default web browser"""
    # Wait a moment for the server to start
    time.sleep(2)
    
    frontend_path = Path("web-interface/index.html")
    if frontend_path.exists():
        frontend_url = f"file://{frontend_path.absolute()}"
        print(f"Opening frontend: {frontend_url}")
        webbrowser.open(frontend_url)
    else:
        print("Frontend file not found at web-interface/index.html")

def main():
    print("=" * 50)
    print("VioFlux - Epigenetic Tuning Simulator")
    print("=" * 50)
    print()
    
    # Check if required files exist
    required_files = [
        "api_server.py",
        "data_io.py", 
        "sim_core.py",
        "data/violacein_pathway.tsv",
        "data/epigenetic_modules.csv",
        "web-interface/index.html"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print("ERROR: Missing required files:")
        for file_path in missing_files:
            print(f"  - {file_path}")
        print("\nPlease ensure all files are in the correct locations.")
        return
    
    print("All required files found. Starting VioFlux...")
    print()
    print("Instructions:")
    print("1. The API server will start on http://127.0.0.1:5000")
    print("2. Your browser will open the frontend automatically")
    print("3. Press Ctrl+C to stop the server")
    print()
    
    # Start the frontend opener in a separate thread
    frontend_thread = threading.Thread(target=open_frontend)
    frontend_thread.daemon = True
    frontend_thread.start()
    
    # Start the API server (this will block)
    try:
        start_api_server()
    except KeyboardInterrupt:
        print("\nShutting down VioFlux...")
        print("Goodbye!")

if __name__ == "__main__":
    main()