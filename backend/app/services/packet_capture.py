"""Packet capture service using Scapy"""
import threading
import time
from datetime import datetime
from typing import Optional
from scapy.all import sniff, get_if_list
from scapy.layers.inet import IP, TCP, UDP
from sqlalchemy.orm import Session
from app.models import Packet
from app.config import settings
import json


class PacketCaptureService:
    """Service for capturing network packets"""
    
    def __init__(self):
        self.is_capturing = False
        self.capture_thread = None
        self.packet_count = 0
        self.start_time = None
        self.interface = None
        self.filter_str = None
        self.db_session = None
        self._lock = threading.Lock()
    
    def _get_default_interface(self) -> Optional[str]:
        """Get default network interface"""
        interfaces = get_if_list()
        if interfaces:
            # Prefer non-loopback interfaces
            for iface in interfaces:
                if 'lo' not in iface.lower() and 'loopback' not in iface.lower():
                    return iface
            return interfaces[0]
        return None
    
    def _packet_handler(self, packet):
        """Handle captured packet"""
        try:
            if IP in packet:
                ip_layer = packet[IP]
                src_ip = ip_layer.src
                dst_ip = ip_layer.dst
                protocol = "unknown"
                src_port = None
                dst_port = None
                
                if TCP in packet:
                    protocol = "TCP"
                    src_port = packet[TCP].sport
                    dst_port = packet[TCP].dport
                elif UDP in packet:
                    protocol = "UDP"
                    src_port = packet[UDP].sport
                    dst_port = packet[UDP].dport
                else:
                    protocol = ip_layer.proto
                
                packet_size = len(packet)
                
                # Extract basic features
                features = {
                    "ip_version": ip_layer.version,
                    "ip_ttl": ip_layer.ttl,
                    "ip_len": ip_layer.len,
                    "ip_flags": str(ip_layer.flags),
                    "packet_size": packet_size,
                }
                
                if src_port:
                    features["src_port"] = src_port
                if dst_port:
                    features["dst_port"] = dst_port
                
                # Store packet in database
                if self.db_session:
                    db_packet = Packet(
                        timestamp=datetime.now(),
                        src_ip=src_ip,
                        dst_ip=dst_ip,
                        src_port=src_port,
                        dst_port=dst_port,
                        protocol=protocol,
                        packet_size=packet_size,
                        features=features,
                        raw_data=json.dumps({
                            "summary": packet.summary(),
                            "show": packet.show(dump=True)
                        })
                    )
                    self.db_session.add(db_packet)
                    
                    # Commit periodically
                    if self.packet_count % 100 == 0:
                        self.db_session.commit()
                
                with self._lock:
                    self.packet_count += 1
                    
        except Exception as e:
            print(f"Error processing packet: {e}")
    
    def _capture_loop(self, interface: str, filter_str: str):
        """Main capture loop"""
        try:
            sniff(
                iface=interface,
                filter=filter_str,
                prn=self._packet_handler,
                stop_filter=lambda x: not self.is_capturing
            )
        except Exception as e:
            print(f"Capture error: {e}")
        finally:
            if self.db_session:
                self.db_session.commit()
                self.db_session.close()
    
    def start_capture(self, interface: Optional[str] = None, filter_str: Optional[str] = None, db: Session = None):
        """Start packet capture"""
        if self.is_capturing:
            raise ValueError("Capture already in progress")
        
        self.interface = interface or self._get_default_interface()
        if not self.interface:
            raise ValueError("No network interface available")
        
        self.filter_str = filter_str or settings.CAPTURE_FILTER
        self.db_session = db
        self.is_capturing = True
        self.packet_count = 0
        self.start_time = datetime.now()
        
        # Start capture in separate thread
        self.capture_thread = threading.Thread(
            target=self._capture_loop,
            args=(self.interface, self.filter_str),
            daemon=True
        )
        self.capture_thread.start()
        print(f"Started packet capture on {self.interface} with filter: {self.filter_str}")
    
    def stop_capture(self):
        """Stop packet capture"""
        if not self.is_capturing:
            return
        
        self.is_capturing = False
        if self.capture_thread:
            self.capture_thread.join(timeout=5)
        
        if self.db_session:
            self.db_session.commit()
        
        print(f"Stopped packet capture. Total packets: {self.packet_count}")
    
    def get_packet_count(self) -> int:
        """Get total packets captured"""
        with self._lock:
            return self.packet_count
    
    def get_start_time(self) -> Optional[datetime]:
        """Get capture start time"""
        return self.start_time
    
    def get_interface(self) -> Optional[str]:
        """Get current interface"""
        return self.interface

