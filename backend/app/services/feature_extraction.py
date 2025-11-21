"""Feature extraction service for network packets"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FeatureExtractionService:
    """Service for extracting features from network packets"""
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.packet_buffer = []
        self.flow_stats = defaultdict(lambda: {
            'packet_count': 0,
            'byte_count': 0,
            'start_time': None,
            'last_time': None,
            'packets': []
        })
    
    def extract_basic_features(self, packet: Dict) -> Dict:
        """Extract basic features from a single packet"""
        features = {
            'packet_size': packet.get('packet_size', 0),
            'src_port': packet.get('src_port', 0),
            'dst_port': packet.get('dst_port', 0),
            'protocol': self._encode_protocol(packet.get('protocol', 'unknown')),
        }
        
        # IP layer features
        if 'ip_ttl' in packet:
            features['ip_ttl'] = packet['ip_ttl']
        if 'ip_len' in packet:
            features['ip_len'] = packet['ip_len']
        
        # TCP features
        if 'tcp_flags' in packet:
            features['tcp_flags'] = self._encode_tcp_flags(packet['tcp_flags'])
        if 'tcp_window' in packet:
            features['tcp_window'] = packet['tcp_window']
        
        return features
    
    def extract_statistical_features(self, packet_window: List[Dict]) -> Dict:
        """Extract statistical features from a window of packets"""
        if not packet_window:
            return {}
        
        sizes = [p.get('packet_size', 0) for p in packet_window]
        ports = [p.get('dst_port', 0) for p in packet_window if p.get('dst_port')]
        
        features = {
            'mean_packet_size': float(np.mean(sizes)) if sizes else 0.0,
            'std_packet_size': float(np.std(sizes)) if sizes else 0.0,
            'min_packet_size': float(np.min(sizes)) if sizes else 0.0,
            'max_packet_size': float(np.max(sizes)) if sizes else 0.0,
            'packet_count': len(packet_window),
            'unique_dst_ports': len(set(ports)) if ports else 0,
            'port_entropy': self._calculate_entropy(ports) if ports else 0.0,
        }
        
        return features
    
    def extract_flow_features(self, packet: Dict) -> Dict:
        """Extract flow-based features"""
        # Create flow key
        flow_key = (
            packet.get('src_ip', ''),
            packet.get('dst_ip', ''),
            packet.get('protocol', ''),
            packet.get('dst_port', 0)
        )
        
        flow = self.flow_stats[flow_key]
        current_time = packet.get('timestamp', datetime.now())
        
        if flow['start_time'] is None:
            flow['start_time'] = current_time
        flow['last_time'] = current_time
        
        flow['packet_count'] += 1
        flow['byte_count'] += packet.get('packet_size', 0)
        flow['packets'].append(packet)
        
        # Calculate flow features
        duration = (flow['last_time'] - flow['start_time']).total_seconds()
        if duration == 0:
            duration = 0.001  # Avoid division by zero
        
        features = {
            'flow_duration': duration,
            'flow_packet_count': flow['packet_count'],
            'flow_byte_count': flow['byte_count'],
            'flow_packets_per_second': flow['packet_count'] / duration,
            'flow_bytes_per_second': flow['byte_count'] / duration,
        }
        
        # Clean old flows (older than 1 hour)
        self._cleanup_old_flows(hours=1)
        
        return features
    
    def extract_all_features(self, packet: Dict) -> np.ndarray:
        """Extract all features and return as numpy array"""
        # Basic features
        basic_features = self.extract_basic_features(packet)
        
        # Add packet to buffer
        self.packet_buffer.append(packet)
        if len(self.packet_buffer) > self.window_size:
            self.packet_buffer.pop(0)
        
        # Statistical features from window
        statistical_features = self.extract_statistical_features(self.packet_buffer)
        
        # Flow features
        flow_features = self.extract_flow_features(packet)
        
        # Combine all features
        all_features = {
            **basic_features,
            **statistical_features,
            **flow_features
        }
        
        # Convert to numpy array (numerical values only)
        feature_values = []
        for key in sorted(all_features.keys()):
            value = all_features[key]
            if isinstance(value, (int, float)):
                feature_values.append(float(value))
        
        return np.array(feature_values)
    
    def _encode_protocol(self, protocol: str) -> int:
        """Encode protocol as integer"""
        protocol_map = {
            'TCP': 1,
            'UDP': 2,
            'ICMP': 3,
            'unknown': 0
        }
        return protocol_map.get(protocol.upper(), 0)
    
    def _encode_tcp_flags(self, flags: str) -> int:
        """Encode TCP flags as integer"""
        flag_map = {
            'S': 1,  # SYN
            'A': 2,  # ACK
            'F': 4,  # FIN
            'R': 8,  # RST
            'P': 16, # PSH
            'U': 32, # URG
        }
        
        if isinstance(flags, str):
            encoded = 0
            for flag in flags:
                encoded |= flag_map.get(flag, 0)
            return encoded
        return 0
    
    def _calculate_entropy(self, values: List) -> float:
        """Calculate entropy of a list of values"""
        if not values:
            return 0.0
        
        value_counts = {}
        for value in values:
            value_counts[value] = value_counts.get(value, 0) + 1
        
        total = len(values)
        entropy = 0.0
        for count in value_counts.values():
            p = count / total
            if p > 0:
                entropy -= p * np.log2(p)
        
        return entropy
    
    def _cleanup_old_flows(self, hours: int = 1):
        """Remove flows older than specified hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        flows_to_remove = []
        for flow_key, flow in self.flow_stats.items():
            if flow['last_time'] and flow['last_time'] < cutoff_time:
                flows_to_remove.append(flow_key)
        
        for flow_key in flows_to_remove:
            del self.flow_stats[flow_key]
    
    def reset(self):
        """Reset feature extraction state"""
        self.packet_buffer = []
        self.flow_stats.clear()

