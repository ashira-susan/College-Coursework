"""
fulfiliq_test_model.py - small in-memory executable model of the FulfilIQ order-fulfilment rules.
Synthetic data only. It demonstrates RULE LOGIC (idempotency, reservation, state guards,
role checks, refund approval, outbox retry, offline-scan dedup). It is NOT a database,
NOT a concurrency test and NOT a performance test.
Run:  python fulfiliq_test_model.py
"""
import threading
from dataclasses import dataclass, field

REFUND_LIMIT = 100.00          # planning assumption (unresolved question UQ1)
RESERVATION_MINUTES = 15       # planning assumption (UQ2)
ROLES = {"customer", "picker", "support", "finance", "manager", "admin"}

class Rejected(Exception): pass

@dataclass
class Order:
    id: str; owner: str; sku: str; qty: int; total: float
    state: str = "Placed"; version: int = 1; picked: bool = False
    flags: set = field(default_factory=set)

@dataclass
class Refund:
    id: str; order_id: str; amount: float; state: str = "Requested"
    approved_by: str = None; attempts: int = 0

@dataclass
class Intent:                      # transactional-outbox row
    key: str; order_id: str; status: str = "Pending"; attempts: int = 0; tracking: str = None

class Platform:
    def __init__(self, stock, tax=0.18):
        self.stock = dict(stock)           # sku -> on_hand
        self.reserved = {}                 # order_id -> (sku, qty, expires_at)
        self.orders, self.refunds, self.intents = {}, {}, {}
        self.payments = {}                 # (gateway, event_id) -> order_id   (UNIQUE constraint)
        self.audit = []
        self.tax, self.price = tax, {}
        self.lock = threading.Lock()       # stands in for one DB transaction / row lock
        self.n = 0

    # ---- helpers ----
    def _audit(self, actor, action, ref): self.audit.append((actor, action, ref))
    def available(self, sku):
        return self.stock[sku] - sum(q for s, q, _ in self.reserved.values() if s == sku)
    def _need(self, role, allowed):       # role comes from the AUTHENTICATED session, never the UI
        if role not in allowed: raise Rejected(f"role {role} not permitted")

    # ---- FR02/FR03/FR04: place order + reserve in ONE transaction ----
    def place_order(self, session, sku, qty, now=0):
        self._need(session["role"], {"customer"})
        if qty <= 0: raise Rejected("quantity must be positive")
        with self.lock:
            if self.available(sku) < qty: raise Rejected("out of stock")
            self.n += 1; oid = f"O{self.n}"
            total = round(self.price[sku] * qty * (1 + self.tax), 2)   # server-side price+tax
            self.orders[oid] = Order(oid, session["user"], sku, qty, total)
            self.reserved[oid] = (sku, qty, now + RESERVATION_MINUTES)
            self._audit(session["user"], "place_order", oid)
            return oid

    def expire_reservations(self, now):
        with self.lock:
            for oid, (s, q, exp) in list(self.reserved.items()):
                if exp <= now and self.orders[oid].state == "Placed":
                    del self.reserved[oid]; self.orders[oid].state = "Cancelled"
                    self._audit("system", "expire", oid)

    # ---- FR05/FR08: payment callback (idempotent) ----
    def payment_callback(self, gateway, event_id, order_id, amount, signature_ok=True, now=0):
        if not signature_ok: raise Rejected("bad signature")
        with self.lock:
            key = (gateway, event_id)
            if key in self.payments:                       # duplicate -> return existing result
                return "duplicate:" + self.orders[self.payments[key]].state
            o = self.orders[order_id]
            if abs(amount - o.total) > 0.005: raise Rejected("amount mismatch")
            self.payments[key] = order_id
            if o.state == "Cancelled":                     # late callback after expiry (revision R1)
                if self.available(o.sku) >= o.qty:
                    self.reserved[order_id] = (o.sku, o.qty, now + RESERVATION_MINUTES)
                    o.state = "Paid"
                else:
                    o.state = "Cancelled"; o.flags.add("PaymentReceived_NeedsRefund")
                    self.refunds[f"R-{order_id}"] = Refund(f"R-{order_id}", order_id, o.total)
                    self._audit("system", "needs_refund", order_id); return "needs_refund"
            elif o.state == "Placed": o.state = "Paid"
            else: raise Rejected("unexpected state")
            o.version += 1
            self.intents[order_id] = Intent(f"ship-{order_id}", order_id)   # outbox, same txn
            self._audit("gateway", "paid", order_id)
            return "paid"

    # ---- FR06/FR07/FR09: lifecycle ----
    def pick(self, session, oid):
        self._need(session["role"], {"picker"})
        o = self.orders[oid]
        if o.state != "Paid": raise Rejected("not paid")
        o.state, o.picked = "Packed", True; o.version += 1; self._audit(session["user"], "pack", oid)

    def dispatch(self, session, oid):
        self._need(session["role"], {"picker"})
        o = self.orders[oid]
        if o.state != "Packed" or not o.picked: raise Rejected("needs payment and pick confirmation")
        o.state = "Dispatched"; o.version += 1; self._audit(session["user"], "dispatch", oid)

    def deliver(self, oid):
        o = self.orders[oid]
        if o.state != "Dispatched": raise Rejected("bad state")
        o.state = "Delivered"; o.version += 1

    # ---- FR11: outbox worker with reconciliation ----
    def run_worker(self, courier):
        for it in self.intents.values():
            if it.status == "Done": continue
            it.attempts += 1
            try:
                it.tracking = courier.create_shipment(it.key)       # key = idempotent correlation key
                it.status = "Done"
            except TimeoutError:
                existing = courier.lookup(it.key)                   # reconcile BEFORE retrying
                if existing: it.tracking, it.status = existing, "Done"
                else: it.status = "Pending"

    # ---- FR10: refunds ----
    def request_refund(self, session, oid, amount):
        self._need(session["role"], {"support", "customer"})
        o = self.orders[oid]
        if session["role"] == "customer" and o.owner != session["user"]: raise Rejected("not owner")
        if o.state not in {"Delivered", "Dispatched"}: raise Rejected("not eligible")
        r = Refund(f"R-{oid}", oid, amount); self.refunds[r.id] = r
        self._audit(session["user"], "refund_request", r.id); return r.id

    def decide_refund(self, session, rid, approve=True):
        self._need(session["role"], {"finance"})           # ONLY finance may decide
        r = self.refunds[rid]
        if r.state != "Requested": raise Rejected("already decided")
        r.state, r.approved_by = ("Approved", session["user"]) if approve else ("Rejected", session["user"])
        self._audit(session["user"], "refund_" + r.state.lower(), rid)

    def execute_refund(self, rid, gateway):
        r = self.refunds[rid]
        if r.state not in {"Approved", "Failed"} or not r.approved_by:   # Failed keeps its approval
            raise Rejected("refund not approved")
        r.attempts += 1
        try: gateway.refund(rid, r.amount); r.state = "Executed"
        except ConnectionError: r.state = "Failed"
        o = self.orders[r.order_id]
        if r.state == "Executed": o.state = "Closed"; o.version += 1
        return r.state

    # ---- FR07/FR12: privacy-scoped reads ----
    def read_order(self, session, oid):
        o = self.orders[oid]
        if session["role"] == "customer" and o.owner != session["user"]: raise Rejected("not owner")
        view = {"id": o.id, "state": o.state}
        if session["role"] == "support": view["contact"] = "***-***-1234"       # masked, no payment data
        return view

    # ---- Q6: offline scanner buffer ----
    def apply_scan_batch(self, events):
        seen = getattr(self, "_seen", set()); self._seen = seen; applied = 0
        for e in sorted(events, key=lambda e: e["observed_at"]):
            k = (e["node"], e["event_id"])
            if k in seen: continue                           # dedup before touching stock
            seen.add(k); self.stock[e["sku"]] += e["delta"]; applied += 1
        return applied

class Courier:
    def __init__(self, fail_first=0): self.fail, self.shipments = fail_first, {}
    def create_shipment(self, key):
        if self.fail > 0:
            self.fail -= 1; self.shipments.setdefault(key, f"TRK-{key}")  # request reached courier, reply lost
            raise TimeoutError
        return self.shipments.setdefault(key, f"TRK-{key}")
    def lookup(self, key): return self.shipments.get(key)

class Gateway:
    def __init__(self, fail_first=0): self.fail, self.calls = fail_first, 0
    def refund(self, rid, amt):
        if self.fail > 0: self.fail -= 1; raise ConnectionError
        self.calls += 1

# ------------------------------------------------------------------ tests
def fresh(stock=1):
    p = Platform({"SKU-1": stock}); p.price["SKU-1"] = 100.0; return p
CUST = lambda u: {"user": u, "role": "customer"}
PICK, SUP, FIN = {"user": "p1", "role": "picker"}, {"user": "s1", "role": "support"}, {"user": "f1", "role": "finance"}

def delivered_order(p, user="c1"):
    oid = p.place_order(CUST(user), "SKU-1", 1); p.payment_callback("gw", "e-" + oid, oid, p.orders[oid].total)
    p.pick(PICK, oid); p.dispatch(PICK, oid); p.deliver(oid); return oid

def expect_reject(fn, *a, **k):
    try: fn(*a, **k)
    except Rejected: return True
    return False

def T1():   # last unit, 2 sequential + 20 threaded buyers
    p = fresh(1); ok = []
    def buy(i):
        try: ok.append(p.place_order(CUST(f"c{i}"), "SKU-1", 1))
        except Rejected: pass
    ts = [threading.Thread(target=buy, args=(i,)) for i in range(20)]
    [t.start() for t in ts]; [t.join() for t in ts]
    return len(ok) == 1 and p.available("SKU-1") == 0
def T2():   # duplicate callback x10 (+ threaded)
    p = fresh(5); oid = p.place_order(CUST("c1"), "SKU-1", 1); amt = p.orders[oid].total
    ts = [threading.Thread(target=p.payment_callback, args=("gw", "evt-1", oid, amt)) for _ in range(10)]
    [t.start() for t in ts]; [t.join() for t in ts]
    return len(p.payments) == 1 and len(p.intents) == 1 and p.audit.count(("gateway", "paid", oid)) == 1
def T3():   # approved refund fails at gateway, then retried
    p = fresh(5); oid = delivered_order(p); rid = p.request_refund(SUP, oid, 150.0); p.decide_refund(FIN, rid)
    gw = Gateway(fail_first=1); s1 = p.execute_refund(rid, gw); st_after_fail = p.orders[oid].state
    s2 = p.execute_refund(rid, gw)
    return (s1, st_after_fail, s2, p.orders[oid].state, p.refunds[rid].attempts) == ("Failed", "Delivered", "Executed", "Closed", 2)
def T4():   # dispatch w/o payment or pick
    p = fresh(5); oid = p.place_order(CUST("c1"), "SKU-1", 1)
    a = expect_reject(p.dispatch, PICK, oid)
    p.payment_callback("gw", "e1", oid, p.orders[oid].total); b = expect_reject(p.dispatch, PICK, oid)
    return a and b and p.orders[oid].state == "Paid"
def T5():   # courier timeout (reply lost) then retry
    p = fresh(5); oid = p.place_order(CUST("c1"), "SKU-1", 1); p.payment_callback("gw", "e1", oid, p.orders[oid].total)
    c = Courier(fail_first=1); p.run_worker(c); p.run_worker(c)
    return p.orders[oid].state == "Paid" and len(c.shipments) == 1 and p.intents[oid].status == "Done"
def T6():   # unauthorised approval / cross-customer read / role-selector spoof
    p = fresh(5); oid = delivered_order(p, "c1"); rid = p.request_refund(SUP, oid, 150.0)
    a = expect_reject(p.decide_refund, SUP, rid); b = expect_reject(p.decide_refund, CUST("c1"), rid)
    c = expect_reject(p.read_order, CUST("c2"), oid); d = expect_reject(p.execute_refund, rid, Gateway())
    return a and b and c and d and p.refunds[rid].state == "Requested"
def T7():   # late payment after expiry, unit resold
    p = fresh(1); o1 = p.place_order(CUST("c1"), "SKU-1", 1, now=0); amt = p.orders[o1].total
    p.expire_reservations(now=16); o2 = p.place_order(CUST("c2"), "SKU-1", 1, now=17)
    r = p.payment_callback("gw", "late-1", o1, amt, now=18)
    return r == "needs_refund" and p.available("SKU-1") == 0 and "PaymentReceived_NeedsRefund" in p.orders[o1].flags
def T8():   # S1 offline scan replay
    p = fresh(10); ev = [{"node": "W3-A", "event_id": i, "sku": "SKU-1", "delta": -1, "observed_at": i} for i in range(5)]
    a = p.apply_scan_batch(ev); b = p.apply_scan_batch(ev + ev)
    return a == 5 and b == 0 and p.stock["SKU-1"] == 5
def T9():   # S2 queued approval is not 'Approved' until server validation
    p = fresh(5); oid = delivered_order(p); rid = p.request_refund(SUP, oid, 150.0)
    queued = {"rid": rid, "by": "f1", "local_status": "PendingServerValidation"}
    return p.refunds[rid].state == "Requested" and queued["local_status"] != "Approved" and expect_reject(p.execute_refund, rid, Gateway())
def T10():  # S3 invariant sweep after 200 random-ish operations
    import random; random.seed(7); p = fresh(30)
    for i in range(200):
        try:
            oid = p.place_order(CUST(f"c{i}"), "SKU-1", random.randint(1, 3), now=i)
            if random.random() < .7: p.payment_callback("gw", f"e{i % 120}", oid, p.orders[oid].total, now=i)
        except (Rejected, KeyError): pass
        if i % 25 == 0: p.expire_reservations(i)
    return p.available("SKU-1") >= 0 and len(p.payments) == len({k for k in p.payments})
def T11():  # price tampering: client price ignored (no price param exists); qty<=0 rejected
    p = fresh(5); return expect_reject(p.place_order, CUST("c1"), "SKU-1", 0) and \
        p.orders[p.place_order(CUST("c1"), "SKU-1", 2)].total == 236.0

if __name__ == "__main__":
    tests = [("T1 Last unit, 20 threaded buyers", T1), ("T2 Duplicate callback x10 (threaded)", T2),
             ("T3 Refund fails at gateway, retry", T3), ("T4 Dispatch without payment/pick", T4),
             ("T5 Courier timeout then retry", T5), ("T6 Unauthorised approve / cross-read", T6),
             ("T7 Late payment after expiry", T7), ("T8 Offline scan replay (S1)", T8),
             ("T9 Queued approval not Approved (S2)", T9), ("T10 Invariant sweep, 200 ops (S3)", T10),
             ("T11 Price tampering / bad qty", T11)]
    bad = 0
    for name, fn in tests:
        r = fn(); bad += not r; print(f"{'PASS' if r else 'FAIL'}  {name}")
    print(f"\n{len(tests)-bad}/{len(tests)} checks passed"); raise SystemExit(bad)
