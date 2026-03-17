"""Packet capture service.

Responsibility
--------------
Capture raw packets from a network interface as fast as possible and
push minimal representations onto the in-memory stream.

Design decisions
----------------
* Capture = raw producer only.  No database writes, no ML calls, no locks
    beyond the simple packet counter.
* Uses Scapy's AsyncSniffer so capture runs off the asyncio event loop and
    can be stopped explicitly on Windows.
* Captured packets are converted to a lightweight PacketData dataclass and
    pushed onto the shared asyncio.Queue via put_nowait().  If the queue is
    full, the packet is discarded with a warning rather than blocking.
"""
import asyncio
import logging
import os
import threading
import warnings
from datetime import datetime
from typing import Optional

warnings.filterwarnings(
    "ignore",
    message=r".*TripleDES has been moved.*",
    category=Warning,
)

from scapy.all import AsyncSniffer, get_if_list
from scapy.config import conf
from scapy.layers.inet import IP, TCP, UDP

from app.core.stream import PacketData, packet_stream
from app.config import settings

logger = logging.getLogger(__name__)


class PacketCaptureService:
    """Captures live network packets and enqueues them for processing."""

    def __init__(self) -> None:
        self.is_capturing: bool = False
        self._sniffer: Optional[AsyncSniffer] = None
        self._packet_count: int = 0
        self._dropped_count: int = 0
        self._start_time: Optional[datetime] = None
        self._interface: Optional[str] = None
        self._filter_str: Optional[str] = None
        self._lock = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None  # Store event loop for thread-safe queue access

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def start_capture(
        self,
        interface: Optional[str] = None,
        filter_str: Optional[str] = None,
    ) -> None:
        """Start live packet capture on *interface* with *filter_str*.

        Raises
        ------
        ValueError
            If capture is already running or no usable interface is found.
        """
        if self.is_capturing:
            raise ValueError("Capture is already in progress")

        self._interface = interface or self._default_interface()
        if not self._interface:
            raise ValueError("No network interface available")

        self._filter_str = filter_str or settings.CAPTURE_FILTER
        self._packet_count = 0
        self._dropped_count = 0
        self._start_time = datetime.now()
        self.is_capturing = True

        # Capture the running event loop BEFORE starting thread
        # This is critical for thread-safe queue operations
        self._loop = asyncio.get_running_loop()

        self._sniffer = AsyncSniffer(
            iface=self._interface,
            filter=self._filter_str,
            prn=self.enqueue_packet,
            store=False,
        )
        self._sniffer.start()
        logger.info(
            "Packet capture started — interface=%s filter='%s'",
            self._interface,
            self._filter_str,
        )

    def stop_capture(self) -> None:
        """Signal the capture loop to stop and wait for the thread."""
        if not self.is_capturing:
            return

        self.is_capturing = False
        if self._sniffer is not None:
            try:
                self._sniffer.stop()
            except Exception as exc:
                logger.warning("Error while stopping sniffer: %s", exc)

        self._sniffer = None
        self._loop = None
        self._filter_str = None
        self._interface = None
        self._start_time = None

        logger.info(
            "Packet capture stopped — captured=%d dropped=%d",
            self._packet_count,
            self._dropped_count,
        )

    # ------------------------------------------------------------------
    # Status accessors
    # ------------------------------------------------------------------

    def get_packet_count(self) -> int:
        with self._lock:
            return self._packet_count

    def get_start_time(self) -> Optional[datetime]:
        return self._start_time

    def get_interface(self) -> Optional[str]:
        return self._interface

    def enqueue_packet(self, raw_packet) -> None:
        """Convert a raw Scapy packet to PacketData and push to the stream.

        This method is called from the capture OS thread.  It must be fast
        and must never block — no I/O, no DB, no ML inference.
        """
        try:
            if not self.is_capturing or self._loop is None:
                return

            if IP not in raw_packet:
                return  # Skip non-IP frames

            ip_layer = raw_packet[IP]
            protocol = "unknown"
            src_port: Optional[int] = None
            dst_port: Optional[int] = None

            if TCP in raw_packet:
                protocol = "TCP"
                src_port = raw_packet[TCP].sport
                dst_port = raw_packet[TCP].dport
            elif UDP in raw_packet:
                protocol = "UDP"
                src_port = raw_packet[UDP].sport
                dst_port = raw_packet[UDP].dport
            else:
                protocol = str(ip_layer.proto)

            packet_data = PacketData(
                timestamp=datetime.now(),
                src_ip=ip_layer.src,
                dst_ip=ip_layer.dst,
                protocol=protocol,
                packet_size=len(raw_packet),
                src_port=src_port,
                dst_port=dst_port,
                ip_ttl=ip_layer.ttl,
                ip_len=ip_layer.len,
                ip_flags=str(ip_layer.flags),
                raw_summary=raw_packet.summary(),
            )

            try:
                # Use the stored event loop reference for thread-safe queue access
                # asyncio.Queue is NOT thread-safe, so we must schedule the put
                # operation onto the event loop thread
                self._loop.call_soon_threadsafe(packet_stream.put_nowait, packet_data)
                with self._lock:
                    self._packet_count += 1
            except Exception:
                # Queue is full — drop the packet and count it
                with self._lock:
                    self._dropped_count += 1
                if self._dropped_count == 1 or self._dropped_count % 500 == 0:
                    logger.warning(
                        "Packet queue full — total dropped=%d", self._dropped_count
                    )

        except Exception as exc:
            logger.error("Error in enqueue_packet: %s", exc)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _default_interface(self) -> Optional[str]:
        """Return a robust default interface for host and Docker runtimes."""
        try:
            # Highest priority: explicit environment/config override
            configured_iface = os.getenv("CAPTURE_INTERFACE") or settings.INTERFACE
            if configured_iface:
                return str(configured_iface)

            # Scapy's default interface is usually the safest choice first
            if conf.iface:
                return str(conf.iface)

            interfaces = get_if_list()
            if not interfaces:
                return None

            # In Docker, "eth0" is typically the active interface
            if "eth0" in interfaces:
                return "eth0"

            # Generic fallback: first non-loopback/non-virtual-like interface
            skip_tokens = ("lo", "loopback", "docker", "br-", "veth")
            for iface in interfaces:
                name_lower = iface.lower()
                if not any(token in name_lower for token in skip_tokens):
                    return iface

            return interfaces[0]
        except Exception as exc:
            logger.warning("Error detecting interface: %s", exc)
            return None
