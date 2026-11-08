"""No-network regression checks for the production PPPoE sync RTT parser."""
import importlib.util
from pathlib import Path
from unittest import TestCase, mock
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "ops" / "mikrotik-pppoe-sync.py"
spec = importlib.util.spec_from_file_location("pppoe_sync_under_test", SCRIPT)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class FakeConnection:
    def __enter__(self): return self
    def __exit__(self, exc_type, exc_value, traceback): return False

class PingRttParsing(TestCase):
    def test_routeros_combined_units(self):
        examples = [
            ("2ms830us", 2.830),
            ("3ms656us", 3.656),
            ("1ms134us", 1.134),
            ("698us", 0.698),
            ("492us", 0.492),
            ("14ms612us", 14.612),
            ("1s23ms", 1023.0),
            ("1ms200ns", 1.000),
            ("2.5ms", 2.500),
            ("00:00:00.014", 14.0),
            ("1:02:03.500", 3723500.0),
        ]
        for raw, expected in examples:
            with self.subTest(raw=raw):
                self.assertAlmostEqual(sync.parse_ping_ms(raw), expected, places=3)

    def test_invalid_values_not_reported_as_replies(self):
        for raw in ("", None, "timeout", "1mss", "2msBAD"):
            with self.subTest(raw=raw):
                self.assertIsNone(sync.parse_ping_ms(raw))

    def test_complete_ping_run_reports_success(self):
        rows=[
            {"time": "2ms830us"},
            {"time": "2ms726us"},
            {"time": "2ms675us"},
            {"time": "2ms785us"},
            {"time": "2ms692us"},
        ]
        with mock.patch.object(sync,"router_connection",return_value=FakeConnection()),\
             mock.patch.object(sync,"command",side_effect=[[],rows]) as cmd:
            result=sync.router_ping("SATR0562","104.98.10.20")
        self.assertEqual(cmd.call_count,2)
        self.assertTrue(result["reachable"])
        self.assertEqual(result["packet_loss"],0.0)
        self.assertEqual(len(result["ping_samples"]),5)
        self.assertEqual(result["connection_health"],"GOOD")
        self.assertIsNone(result["error"])

if __name__=="__main__":
    unittest.main()
