"""
Data Preprocessing and Feature Engineering Module
Handles data cleaning, feature extraction, and transformation for NIDS
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.feature_selection import SelectKBest, f_classif
import hashlib
import joblib
import os


class DataPreprocessor:
    """Preprocesses network log data for ML models"""
    
    def __init__(self, feature_selection_k=20):
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_selector = SelectKBest(f_classif, k=feature_selection_k)
        self.selected_features = None
        self.is_fitted = False
        
    def extract_temporal_features(self, df):
        """Extract temporal features from timestamp"""
        df = df.copy()
        df['Timestamp'] = pd.to_datetime(df['Timestamp'])
        df['Hour'] = df['Timestamp'].dt.hour
        df['Minute'] = df['Timestamp'].dt.minute
        df['Day'] = df['Timestamp'].dt.day
        df['Weekday'] = df['Timestamp'].dt.weekday
        df['DayOfYear'] = df['Timestamp'].dt.dayofyear
        df['IsWeekend'] = (df['Weekday'] >= 5).astype(int)
        df['IsBusinessHours'] = ((df['Hour'] >= 9) & (df['Hour'] <= 17)).astype(int)
        return df
    
    def hash_ip(self, ip):
        """Hash IP addresses to numeric values"""
        return int(hashlib.md5(str(ip).encode()).hexdigest(), 16) % (10**8)
    
    def encode_ips(self, df):
        """Encode IP addresses"""
        df = df.copy()
        df['Source_IP'] = df['Source_IP'].apply(self.hash_ip)
        df['Destination_IP'] = df['Destination_IP'].apply(self.hash_ip)
        return df
    
    def encode_categorical(self, df, columns, fit=False):
        """Encode categorical variables"""
        df = df.copy()
        for col in columns:
            if col in df.columns:
                if fit:
                    self.label_encoders[col] = LabelEncoder()
                    df[col] = self.label_encoders[col].fit_transform(df[col].astype(str))
                else:
                    if col in self.label_encoders:
                        # Handle unseen categories
                        unique_vals = set(df[col].astype(str).unique())
                        known_vals = set(self.label_encoders[col].classes_)
                        for val in unique_vals - known_vals:
                            # Add new category
                            self.label_encoders[col].classes_ = np.append(
                                self.label_encoders[col].classes_, val
                            )
                        df[col] = df[col].astype(str).apply(
                            lambda x: self.label_encoders[col].transform([x])[0] 
                            if x in self.label_encoders[col].classes_ 
                            else len(self.label_encoders[col].classes_) - 1
                        )
        return df
    
    def create_network_features(self, df):
        """Create network-specific features"""
        df = df.copy()
        
        # Port categories
        df['IsWellKnownPort'] = df['Port'].apply(lambda x: 1 if x < 1024 else 0)
        df['IsHighPort'] = df['Port'].apply(lambda x: 1 if x > 49152 else 0)
        
        # Payload size features
        df['Payload_Size_Log'] = np.log1p(df['Payload_Size'])
        df['IsLargePayload'] = (df['Payload_Size'] > df['Payload_Size'].quantile(0.95)).astype(int)
        
        # Request type suspicious patterns
        suspicious_combos = [
            ('SSH', 'ICMP'), ('FTP', 'UDP'), ('HTTP', 'ICMP'),
            ('HTTPS', 'UDP'), ('Telnet', 'ICMP')
        ]
        df['SuspiciousCombo'] = df.apply(
            lambda row: 1 if (row['Request_Type'], row['Protocol']) in suspicious_combos else 0,
            axis=1
        )
        
        return df
    
    def fit_transform(self, df, target_col='Intrusion'):
        """Fit preprocessor and transform data"""
        df = df.copy()
        
        # Extract temporal features
        df = self.extract_temporal_features(df)
        
        # Encode IPs
        df = self.encode_ips(df)
        
        # Encode categorical variables
        categorical_cols = ['Request_Type', 'Protocol', 'User_Agent', 'Status', 'Scan_Type']
        df = self.encode_categorical(df, categorical_cols, fit=True)
        
        # Create network features
        df = self.create_network_features(df)
        
        # Drop timestamp (already extracted features)
        if 'Timestamp' in df.columns:
            df = df.drop('Timestamp', axis=1)
        
        # Separate features and target
        if target_col in df.columns:
            X = df.drop(target_col, axis=1)
            y = df[target_col]
        else:
            X = df
            y = None
        
        # Feature selection
        if y is not None:
            X_selected = self.feature_selector.fit_transform(X, y)
            self.selected_features = X.columns[self.feature_selector.get_support()].tolist()
        else:
            X_selected = X[self.selected_features] if self.selected_features else X
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X_selected)
        
        self.is_fitted = True
        
        return pd.DataFrame(X_scaled, columns=self.selected_features if self.selected_features else X.columns), y
    
    def transform(self, df):
        """Transform new data using fitted preprocessor"""
        if not self.is_fitted:
            raise ValueError("Preprocessor must be fitted before transform")
        
        df = df.copy()
        
        # Extract temporal features
        df = self.extract_temporal_features(df)
        
        # Encode IPs
        df = self.encode_ips(df)
        
        # Encode categorical variables
        categorical_cols = ['Request_Type', 'Protocol', 'User_Agent', 'Status', 'Scan_Type']
        df = self.encode_categorical(df, categorical_cols, fit=False)
        
        # Create network features
        df = self.create_network_features(df)
        
        # Drop timestamp
        if 'Timestamp' in df.columns:
            df = df.drop('Timestamp', axis=1)
        
        # Select features
        if self.selected_features:
            X = df[self.selected_features]
        else:
            X = df
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        return pd.DataFrame(X_scaled, columns=self.selected_features if self.selected_features else X.columns)
    
    def save(self, filepath):
        """Save preprocessor to disk"""
        joblib.dump({
            'scaler': self.scaler,
            'label_encoders': self.label_encoders,
            'feature_selector': self.feature_selector,
            'selected_features': self.selected_features,
            'is_fitted': self.is_fitted
        }, filepath)
    
    def load(self, filepath):
        """Load preprocessor from disk"""
        data = joblib.load(filepath)
        self.scaler = data['scaler']
        self.label_encoders = data['label_encoders']
        self.feature_selector = data['feature_selector']
        self.selected_features = data['selected_features']
        self.is_fitted = data['is_fitted']
        return self

