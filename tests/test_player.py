import os
import sys
import time
import psutil
import subprocess
import signal
import webbrowser
from datetime import datetime

class MemoryMonitor:
    def __init__(self, pid):
        self.process = psutil.Process(pid)
        self.max_memory = 0
        self.memory_samples = []
    
    def sample(self):
        try:
            mem_info = self.process.memory_info()
            rss_mb = mem_info.rss / (1024 * 1024)  # Convert to MB
            self.memory_samples.append((datetime.now(), rss_mb))
            self.max_memory = max(self.max_memory, rss_mb)
            return rss_mb
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return 0
    
    def get_max_memory(self):
        return self.max_memory
    
    def get_memory_history(self):
        return self.memory_samples

class JukeboxTester:
    def __init__(self):
        self.server_process = None
        self.monitor = None
        self.start_time = None
    
    def start_server(self):
        """Start the development server"""
        print("Starting development server...")
        self.server_process = subprocess.Popen(
            ["npm", "run", "dev", "--", "--port", "5173"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        # Wait for server to start
        time.sleep(5)
        self.monitor = MemoryMonitor(self.server_process.pid)
    
    def log_memory(self):
        """Log current memory usage"""
        if self.monitor:
            mem_usage = self.monitor.sample()
            elapsed = (datetime.now() - self.start_time).total_seconds()
            print("[{0:.1f}s] Memory usage: {1:.2f} MB".format(elapsed, mem_usage))
            return mem_usage
        return 0
    
    def open_browser(self):
        """Open the browser to the application"""
        print("Opening browser to application...")
        webbrowser.open("http://localhost:5173")
        print("Please interact with the application to test memory usage.")
        print("Press Ctrl+C to stop monitoring and clean up.")
    
    def run_tests(self):
        """Run all tests"""
        self.start_time = datetime.now()
        
        try:
            self.start_server()
            self.open_browser()
            
            # Monitor memory while the application is running
            while True:
                self.log_memory()
                time.sleep(5)
                
        except KeyboardInterrupt:
            print("\nStopping tests...")
            final_mem = self.log_memory()
            print("\nTest completed. Max memory usage: {0:.2f} MB".format(self.monitor.get_max_memory()))
            return True
            
        except Exception as e:
            print("\nTest failed: {0}".format(str(e)))
            import traceback
            traceback.print_exc()
            return False
            
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Clean up resources"""
        print("\nCleaning up...")
        
        # Stop server
        if hasattr(self, 'server_process') and self.server_process:
            try:
                os.killpg(os.getpgid(self.server_process.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        
        # Print memory history
        if hasattr(self, 'monitor') and self.monitor:
            print("\nMemory usage history:")
            for timestamp, mem in self.monitor.get_memory_history():
                elapsed = (timestamp - self.start_time).total_seconds()
                print("  [{0:6.1f}s] {1:8.2f} MB".format(elapsed, mem))

if __name__ == "__main__":
    # Create and run the tester
    tester = JukeboxTester()
    success = tester.run_tests()
    
    # Exit with appropriate status code
    sys.exit(0 if success else 1)
