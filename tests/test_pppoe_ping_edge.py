"""Regression tests for RouterOS ping ingest, no network or credentials required."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

# The production dependencies are not needed for pure decoding/snapshot tests.
sys.modules.setdefault("requests", types.ModuleType("requests"))
sys.modules.setdefault("routeros_api", types.ModuleType("routeros_api"))
SCRIPT=Path(__file__).resolve().parents[1]/"ops"/"mikrotik-pppoe-ping-edge.py"
spec=importlib.util.spec_from_file_location("ping_edge",SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class FakeBinaryResource:
    def __init__(self,path,events):self.path=path;self.events=events
    def call(self,command,args):
        self.events.append((self.path,command,args))
        if self.path=="/ppp/active":
            return [{b"name":b"TGPHSATR0562",b"address":b"104.98.10.20"}]
        return [{b"name":b"TGPHSATR0562",b"remote-address":b"104.98.10.20",
                 b"comment":b"legacy_\xf1"}]

class FakeAPI:
    def __init__(self,events):self.events=events
    def get_binary_resource(self,path):return FakeBinaryResource(path,self.events)

class FakePool:
    def __init__(self,events):self.events=events;self.disconnected=False
    def get_api(self):return FakeAPI(self.events)
    def disconnect(self):self.disconnected=True

class PingEdgeRegressionTests(unittest.TestCase):
    def test_ping_duration_formats(self):
        for value,expected in [
            ("14ms612us",14.612),("1s23ms",1023),("00:00:00.014",14),
            ("151us",0.151),("0ms",0),("2.5ms",2.5),
            ("1ms200ns",1.0002),("1mss",None),("",None)
        ]:
            with self.subTest(value=value):
                result=module.ms(value)
                if expected is None:self.assertIsNone(result)
                else:self.assertAlmostEqual(result,expected,places=5)

    def test_invalid_routeros_utf8_does_not_abort_snapshot(self):
        events=[]
        fake=FakePool(events)
        with patch.object(module,"pool",return_value=fake):
            active,secrets=module.snapshot()
        self.assertTrue(fake.disconnected)
        self.assertEqual(active[0]["address"],"104.98.10.20")
        self.assertEqual(secrets[0]["name"],"TGPHSATR0562")
        self.assertEqual(secrets[0]["comment"],"legacy_ñ")
        self.assertEqual(events,[
            ("/ppp/active","print",{".proplist":b"name,address"}),
            ("/ppp/secret","print",{".proplist":b"name,remote-address"})
        ])

if __name__=="__main__":unittest.main()
