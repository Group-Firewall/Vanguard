"""
Demo Attack Simulator for Vanguard NIDS
========================================
This script generates safe, controlled network traffic to demonstrate
the detection capabilities of the system.

IMPORTANT: Only run this against your own machine (localhost).
Run as Administrator for raw socket access.

Usage:
    python demo_attacks.py brute_force
    python demo_attacks.py port_scan
    python demo_attacks.py syn_flood
    python demo_attacks.py anomaly
    python demo_attacks.py all
"""

import sys
import time
import random
from scapy.all import IP, TCP, UDP, ICMP, send, RandShort

# Target is always localhost for safety
TARGET = "127.0.0.1"


def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║         VANGUARD NIDS - Attack Demonstration Tool            ║
║                                                              ║
║  WARNING: Educational purposes only. Only use on YOUR system ║
╚══════════════════════════════════════════════════════════════╝
    """)


def brute_force_simulation():
    """
    Simulate brute force attack - rapid connection attempts to SSH port.
    
    What the NIDS detects:
    - Multiple TCP SYN packets to port 22 from same source
    - Pattern matches 'Brute Force Attempt' in ML classifier
    """
    print("\n[*] Simulating BRUTE FORCE attack on SSH (port 22)...")
    print("[*] Sending 40 rapid connection attempts...")
    
    packets_sent = 0
    for i in range(40):
        # TCP SYN packet to SSH port
        pkt = IP(dst=TARGET) / TCP(
            sport=RandShort(),  # Random source port
            dport=22,           # SSH port
            flags="S"           # SYN flag
        )
        send(pkt, verbose=False)
        packets_sent += 1
        
        # Small delay to make it visible in capture
        if i % 10 == 0:
            print(f"    Sent {packets_sent} packets...")
        time.sleep(0.1)
    
    print(f"[+] Brute force simulation complete. {packets_sent} packets sent.")
    print("[+] Check Alert Center for 'Brute Force Attempt' alerts.")


def port_scan_simulation():
    """
    Simulate port scan attack - SYN scan across multiple ports.
    
    What the NIDS detects:
    - Multiple SYN packets to different ports
    - Pattern matches 'Port Scan' or 'SYN Scan' signature
    """
    print("\n[*] Simulating PORT SCAN attack...")
    print("[*] Scanning common ports...")
    
    # Common ports to scan
    ports = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 
             443, 445, 993, 995, 1433, 3306, 3389, 5432, 8080, 8443]
    
    packets_sent = 0
    for port in ports:
        # TCP SYN packet (scan probe)
        pkt = IP(dst=TARGET) / TCP(
            sport=RandShort(),
            dport=port,
            flags="S"
        )
        send(pkt, verbose=False)
        packets_sent += 1
        print(f"    Scanning port {port}...")
        time.sleep(0.2)
    
    print(f"[+] Port scan simulation complete. {packets_sent} ports scanned.")
    print("[+] Check Alert Center for 'Port Scan' or 'SYN Scan' alerts.")


def syn_flood_simulation():
    """
    Simulate SYN flood DoS attack - rapid SYN packets.
    
    What the NIDS detects:
    - High volume of small TCP SYN packets
    - Pattern matches 'SYN Flood' signature
    """
    print("\n[*] Simulating SYN FLOOD attack...")
    print("[*] Sending 50 rapid SYN packets to port 80...")
    
    packets_sent = 0
    for i in range(50):
        pkt = IP(dst=TARGET) / TCP(
            sport=RandShort(),
            dport=80,
            flags="S"
        )
        send(pkt, verbose=False)
        packets_sent += 1
        
        if i % 10 == 0:
            print(f"    Sent {packets_sent} packets...")
        time.sleep(0.05)  # Very fast
    
    print(f"[+] SYN flood simulation complete. {packets_sent} packets sent.")
    print("[+] Check Alert Center for 'SYN Flood' alerts.")


def anomaly_simulation():
    """
    Simulate anomalous traffic - unusual packets that don't match known patterns.
    
    What the NIDS detects:
    - Isolation Forest flags unusual behavior
    - May trigger 'Zero-Day/Novel Attack' classification
    """
    print("\n[*] Simulating ANOMALOUS traffic...")
    print("[*] Sending unusual packets to uncommon ports...")
    
    packets_sent = 0
    
    # Unusual port numbers
    weird_ports = [9999, 12345, 31337, 54321, 6666]
    
    for port in weird_ports:
        # TCP with unusual flags
        pkt = IP(dst=TARGET) / TCP(
            sport=RandShort(),
            dport=port,
            flags="SFPU"  # Unusual flag combination
        )
        send(pkt, verbose=False)
        packets_sent += 1
        print(f"    Sent anomaly packet to port {port}...")
        time.sleep(0.3)
    
    # Large UDP packets (potential tunneling)
    print("[*] Sending oversized UDP packets...")
    for i in range(5):
        pkt = IP(dst=TARGET) / UDP(
            sport=RandShort(),
            dport=53  # DNS port
        ) / ("X" * 600)  # Large payload
        send(pkt, verbose=False)
        packets_sent += 1
        time.sleep(0.2)
    
    print(f"[+] Anomaly simulation complete. {packets_sent} packets sent.")
    print("[+] Check Alert Center for 'Zero-Day/Novel Attack' alerts.")


def database_attack_simulation():
    """
    Simulate database attack - connections to database ports.
    
    What the NIDS detects:
    - Traffic to MySQL (3306), PostgreSQL (5432), MSSQL (1433)
    - Classified as 'Database Attack'
    """
    print("\n[*] Simulating DATABASE attack probes...")
    
    db_ports = {
        3306: "MySQL",
        5432: "PostgreSQL", 
        1433: "MSSQL",
        27017: "MongoDB"
    }
    
    packets_sent = 0
    for port, name in db_ports.items():
        for i in range(5):
            pkt = IP(dst=TARGET) / TCP(
                sport=RandShort(),
                dport=port,
                flags="S"
            )
            send(pkt, verbose=False)
            packets_sent += 1
        print(f"    Probed {name} (port {port})")
        time.sleep(0.3)
    
    print(f"[+] Database attack simulation complete. {packets_sent} packets sent.")
    print("[+] Check Alert Center for 'Database Attack' alerts.")


def run_all_demos():
    """Run all attack simulations in sequence."""
    print("\n[*] Running ALL attack demonstrations...")
    print("[*] This will take about 30-45 seconds.\n")
    
    brute_force_simulation()
    time.sleep(2)
    
    port_scan_simulation()
    time.sleep(2)
    
    syn_flood_simulation()
    time.sleep(2)
    
    anomaly_simulation()
    time.sleep(2)
    
    database_attack_simulation()
    
    print("\n" + "="*60)
    print("[+] ALL DEMONSTRATIONS COMPLETE!")
    print("="*60)
    print("""
Check your Vanguard dashboard:
  1. Traffic Monitoring - See captured packets
  2. Alert Center - See generated alerts
  3. Dashboard - See attack statistics update
    """)


def main():
    print_banner()
    
    if len(sys.argv) < 2:
        print("Usage: python demo_attacks.py <attack_type>")
        print("\nAvailable attack types:")
        print("  brute_force  - SSH brute force simulation")
        print("  port_scan    - Port scanning simulation")
        print("  syn_flood    - SYN flood DoS simulation")
        print("  anomaly      - Anomalous traffic simulation")
        print("  database     - Database attack simulation")
        print("  all          - Run all demonstrations")
        sys.exit(1)
    
    attack_type = sys.argv[1].lower()
    
    print(f"[*] Target: {TARGET} (localhost only for safety)")
    print("[*] Make sure Vanguard capture is RUNNING before starting!")
    input("\nPress ENTER to start the demonstration...")
    
    if attack_type == "brute_force":
        brute_force_simulation()
    elif attack_type == "port_scan":
        port_scan_simulation()
    elif attack_type == "syn_flood":
        syn_flood_simulation()
    elif attack_type == "anomaly":
        anomaly_simulation()
    elif attack_type == "database":
        database_attack_simulation()
    elif attack_type == "all":
        run_all_demos()
    else:
        print(f"[!] Unknown attack type: {attack_type}")
        sys.exit(1)
    
    print("\n[*] Demo complete. Review alerts in your Vanguard dashboard.")


if __name__ == "__main__":
    main()
