"""
Signature-Based Detection Module
Pattern matching against known attack signatures for fast, deterministic detection
"""

import re
from typing import Dict, Tuple, Optional, List
import pandas as pd


class SignatureDetector:
    """
    Signature-based intrusion detector using pattern matching
    
    This provides fast, deterministic detection for known attack patterns.
    Used as the first layer in the hybrid detection system.
    """
    
    def __init__(self):
        # Known attack signatures organized by category
        self.signatures = self._load_signatures()
        
    def _load_signatures(self) -> Dict[str, List[Dict]]:
        """Load known attack signatures"""
        return {
            # Port Scan Signatures
            'port_scan': [
                {
                    'name': 'Sequential Port Scan',
                    'pattern': lambda row: self._check_port_scan(row),
                    'confidence': 0.85,
                    'severity': 'medium'
                },
                {
                    'name': 'SYN Scan',
                    'pattern': lambda row: (
                        row.get('Protocol', '').upper() == 'TCP' and
                        'S' in str(row.get('ip_flags', row.get('tcp_flags', '')))
                    ),
                    'confidence': 0.75,
                    'severity': 'medium'
                },
            ],
            
            # DoS Attack Signatures
            'dos': [
                {
                    'name': 'ICMP Flood',
                    'pattern': lambda row: (
                        row.get('Protocol', '').upper() == 'ICMP' and
                        row.get('Payload_Size', row.get('packet_size', 0)) > 1000
                    ),
                    'confidence': 0.80,
                    'severity': 'high'
                },
                {
                    'name': 'SYN Flood',
                    'pattern': lambda row: (
                        row.get('Protocol', '').upper() == 'TCP' and
                        row.get('Payload_Size', row.get('packet_size', 0)) < 100 and
                        'S' in str(row.get('ip_flags', row.get('tcp_flags', '')))
                    ),
                    'confidence': 0.85,
                    'severity': 'critical'
                },
                {
                    'name': 'UDP Flood',
                    'pattern': lambda row: (
                        row.get('Protocol', '').upper() == 'UDP' and
                        row.get('Payload_Size', row.get('packet_size', 0)) > 1400
                    ),
                    'confidence': 0.70,
                    'severity': 'high'
                },
            ],
            
            # Suspicious Port Access
            'suspicious_port': [
                {
                    'name': 'Telnet Access',
                    'pattern': lambda row: row.get('Port', row.get('dst_port', 0)) == 23,
                    'confidence': 0.65,
                    'severity': 'medium'
                },
                {
                    'name': 'SSH Brute Force Port',
                    'pattern': lambda row: row.get('Port', row.get('dst_port', 0)) == 22,
                    'confidence': 0.50,
                    'severity': 'low'
                },
                {
                    'name': 'Database Port Access',
                    'pattern': lambda row: row.get('Port', row.get('dst_port', 0)) in [3306, 5432, 1433, 27017],
                    'confidence': 0.60,
                    'severity': 'medium'
                },
            ],
            
            # Protocol Anomalies
            'protocol_anomaly': [
                {
                    'name': 'HTTP on Non-Standard Port',
                    'pattern': lambda row: (
                        row.get('Request_Type', row.get('request_type', '')).upper() == 'HTTP' and
                        row.get('Port', row.get('dst_port', 0)) not in [80, 8080, 8000, 8443, 443]
                    ),
                    'confidence': 0.55,
                    'severity': 'low'
                },
                {
                    'name': 'DNS Tunneling Suspect',
                    'pattern': lambda row: (
                        row.get('Port', row.get('dst_port', 0)) == 53 and
                        row.get('Payload_Size', row.get('packet_size', 0)) > 512
                    ),
                    'confidence': 0.70,
                    'severity': 'high'
                },
            ],
            
            # Malicious Request Patterns
            'malicious_request': [
                {
                    'name': 'SQL Injection Pattern',
                    'pattern': lambda row: self._check_sql_injection(row),
                    'confidence': 0.90,
                    'severity': 'critical'
                },
                {
                    'name': 'XSS Pattern',
                    'pattern': lambda row: self._check_xss(row),
                    'confidence': 0.85,
                    'severity': 'high'
                },
            ],
        }
    
    def _check_port_scan(self, row) -> bool:
        """Check for port scan indicators"""
        # Low payload with many different destination ports
        payload_size = row.get('Payload_Size', row.get('packet_size', 0))
        port = row.get('Port', row.get('dst_port', 0))
        
        # Heuristic: small packets to well-known ports are often scans
        if payload_size < 100 and port < 1024:
            return True
        return False
    
    def _check_sql_injection(self, row) -> bool:
        """Check for SQL injection patterns in payload/user agent"""
        suspicious_patterns = [
            r"(?i)(union\s+select)",
            r"(?i)(or\s+1\s*=\s*1)",
            r"(?i)(drop\s+table)",
            r"(?i)(;\s*delete)",
            r"(?i)(--\s*$)",
            r"(?i)('\s*or\s*')",
        ]
        
        user_agent = str(row.get('User_Agent', row.get('user_agent', '')))
        for pattern in suspicious_patterns:
            if re.search(pattern, user_agent):
                return True
        return False
    
    def _check_xss(self, row) -> bool:
        """Check for XSS patterns"""
        suspicious_patterns = [
            r"(?i)(<script)",
            r"(?i)(javascript:)",
            r"(?i)(onerror\s*=)",
            r"(?i)(onload\s*=)",
            r"(?i)(alert\s*\()",
        ]
        
        user_agent = str(row.get('User_Agent', row.get('user_agent', '')))
        for pattern in suspicious_patterns:
            if re.search(pattern, user_agent):
                return True
        return False
    
    def detect(self, row: pd.Series) -> Tuple[bool, float, str]:
        """
        Detect known attack signatures in a single packet/row
        
        Args:
            row: Packet data as pandas Series or dict-like object
            
        Returns:
            Tuple of (is_attack, confidence, signature_name)
        """
        best_match = (False, 0.0, 'Normal')
        
        # Convert Series to dict if needed
        if isinstance(row, pd.Series):
            row_dict = row.to_dict()
        else:
            row_dict = row
        
        for category, signatures in self.signatures.items():
            for sig in signatures:
                try:
                    if sig['pattern'](row_dict):
                        # Found a match - track highest confidence
                        if sig['confidence'] > best_match[1]:
                            best_match = (True, sig['confidence'], sig['name'])
                except Exception:
                    # Skip signatures that fail to match
                    continue
        
        return best_match
    
    def detect_batch(self, df: pd.DataFrame) -> List[Dict]:
        """
        Detect attacks in a batch of packets
        
        Args:
            df: DataFrame of packet data
            
        Returns:
            List of detection results
        """
        results = []
        for _, row in df.iterrows():
            is_attack, confidence, name = self.detect(row)
            results.append({
                'signature_detected': is_attack,
                'signature_confidence': confidence,
                'signature_name': name
            })
        return results
    
    def get_signature_info(self, signature_name: str) -> Optional[Dict]:
        """Get information about a specific signature"""
        for category, signatures in self.signatures.items():
            for sig in signatures:
                if sig['name'] == signature_name:
                    return {
                        'name': sig['name'],
                        'category': category,
                        'confidence': sig['confidence'],
                        'severity': sig['severity']
                    }
        return None
    
    def list_signatures(self) -> List[Dict]:
        """List all available signatures"""
        sig_list = []
        for category, signatures in self.signatures.items():
            for sig in signatures:
                sig_list.append({
                    'name': sig['name'],
                    'category': category,
                    'confidence': sig['confidence'],
                    'severity': sig['severity']
                })
        return sig_list
