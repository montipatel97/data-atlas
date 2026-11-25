import{j as e,L as r}from"./vendor-BwPWkUcW.js";import{h as t,F as q,i as d,k as s,n as J,C as a,H as u,P as v,A as I,l as j,K as _,o as N,j as H}from"./core-CqLoy1yP.js";import{P as c,c as h}from"./editors-9SnHsbga.js";const P={pool:String.raw`
import heapq
import random

random.seed(7)
PAGES = 200
latency = [random.uniform(0.15, 0.45) for _ in range(PAGES)]   # seconds each HTTP call waits on the network

def makespan(workers, max_rps=None):
    """Wall time to fetch every page with a pool of 'workers' threads, optionally capped at max_rps starts/s."""
    free = [0.0] * workers                  # when each worker is next free (a min-heap)
    last_start = float("-inf")
    for lat in latency:
        start = heapq.heappop(free)          # the earliest free worker takes the next page
        if max_rps:
            start = max(start, last_start + 1 / max_rps)
        last_start = start
        heapq.heappush(free, start + lat)
    return max(free)

avg = sum(latency) / PAGES
print(f"{PAGES} pages, average latency {avg * 1000:.0f} ms")
print(f"{'workers':>8} {'no limit':>10} {'20 req/s':>10}")
for w in [1, 2, 4, 8, 16, 32, 64]:
    print(f"{w:>8} {makespan(w):>9.1f}s {makespan(w, 20):>9.1f}s")

print()
print(f"Little's law: concurrency needed = rate x latency = 20 x {avg:.2f} = {20 * avg:.1f} workers.")
print("Past that, more threads only queue behind the rate limit.")
print()
cpu_ms = 4
print(f"If each page also needs {cpu_ms} ms of pure-Python parsing, that part holds the GIL:")
print(f"threads cannot overlap it, so it costs at least {PAGES * cpu_ms / 1000:.1f} s however many threads you add.")
`,pagination:String.raw`
# A source table that an API returns newest first.
def fresh_table():
    return [{"id": i} for i in range(10, 0, -1)]          # ids 10..1

def scan_offset(table, limit, on_page=None):
    seen, offset, page_no = [], 0, 0
    while True:
        page = table[offset:offset + limit]                 # GET /orders?offset=..&limit=..
        if not page:
            return seen
        seen += [r["id"] for r in page]
        offset += limit
        page_no += 1
        if on_page:
            on_page(page_no, table)                         # the world changes between requests

def scan_keyset(table, limit, on_page=None):
    seen, last_id, page_no = [], None, 0
    while True:
        rows = [r for r in table if last_id is None or r["id"] < last_id]
        page = sorted(rows, key=lambda r: -r["id"])[:limit]  # GET /orders?before_id=..&limit=..
        if not page:
            return seen
        seen += [r["id"] for r in page]
        last_id = page[-1]["id"]
        page_no += 1
        if on_page:
            on_page(page_no, table)

def insert_after_first_page(page_no, table):
    if page_no == 1:
        table.insert(0, {"id": 11})                         # a new order arrives during the scan

def delete_after_first_page(page_no, table):
    if page_no == 1:
        table[:] = [r for r in table if r["id"] != 9]       # an order we already read is deleted

for name, change in [("insert", insert_after_first_page), ("delete", delete_after_first_page)]:
    off = scan_offset(fresh_table(), 3, change)
    key = scan_keyset(fresh_table(), 3, change)
    print(f"{name} during scan")
    print(f"  offset pagination: {off}  duplicates={sorted({x for x in off if off.count(x) > 1})}  missing={sorted(set(range(1, 11)) - set(off) - {9})}")
    print(f"  keyset pagination: {key}")

# The idiomatic consumer: a generator that hides pagination from the caller.
def iter_records(fetch_page):
    cursor = None
    while True:
        records, cursor = fetch_page(cursor)
        yield from records
        if cursor is None:
            return

pages = {None: ([1, 2], "c1"), "c1": ([3, 4], "c2"), "c2": ([5], None)}
print()
print("generator over a cursor API:", list(iter_records(lambda c: pages[c])))
`,jitter:String.raw`
import random

random.seed(42)
CLIENTS, BASE, CAP, ATTEMPTS = 1000, 1.0, 32.0, 5

def retry_times(strategy):
    """Times at which every client retries, if the API stays down for the whole period."""
    times = []
    for _ in range(CLIENTS):
        t, sleep = 0.0, BASE
        for attempt in range(ATTEMPTS):
            backoff = min(CAP, BASE * 2 ** attempt)
            if strategy == "no jitter":
                wait = backoff
            elif strategy == "full jitter":
                wait = random.uniform(0, backoff)
            elif strategy == "equal jitter":
                wait = backoff / 2 + random.uniform(0, backoff / 2)
            else:                                            # decorrelated jitter
                sleep = min(CAP, random.uniform(BASE, sleep * 3))
                wait = sleep
            t += wait
            times.append(t)
    return times

for strategy in ["no jitter", "full jitter", "equal jitter", "decorrelated"]:
    times = retry_times(strategy)
    per_100ms, per_s = {}, {}
    for t in times:
        per_100ms[int(t * 10)] = per_100ms.get(int(t * 10), 0) + 1
        per_s[int(t)] = per_s.get(int(t), 0) + 1
    peak = max(per_100ms.values())
    print(f"{strategy:13} busiest 100 ms: {peak:5} requests   last retry at {max(times):5.1f}s")
    top = max(per_s.values())
    line = "".join(" .:-=+*#%@"[min(9, per_s.get(s, 0) * 9 // top)] for s in range(32))
    print(f"{'':13} |{line}|  load per second, 0-31 s")
`,throttle:String.raw`
# Client-side throttling with a token bucket: wait for a token instead of getting a 429.
RATE = 5.0       # tokens added per second (the API quota)
BURST = 10       # bucket size: how many requests may go out back to back

def send_times(n, rate, burst):
    tokens, last, now, out = float(burst), 0.0, 0.0, []
    for _ in range(n):
        tokens = min(burst, tokens + (now - last) * rate)    # refill for the time that passed
        last = now
        if tokens < 1:                                       # not enough: sleep until one token exists
            wait = (1 - tokens) / rate
            now += wait
            tokens += wait * rate
            last = now
        tokens -= 1
        out.append(round(now, 3))
    return out

times = send_times(25, RATE, BURST)
print("send times:", times)
print(f"first {BURST} go immediately (the burst), then one every {1 / RATE:.1f}s (the rate)")
sent = [t for t in times if t <= 2.0]
print(f"sent by t = 2 s: {len(sent)} = burst {BURST} + rate {RATE:.0f}/s x 2 s")

# A semaphore caps how many requests are in flight, not how many start per second.
# With 8 in flight and 50 ms responses you would start up to 160 requests per second.
in_flight, latency = 8, 0.05
print(f"\nsemaphore({in_flight}) with {latency * 1000:.0f} ms latency allows up to {in_flight / latency:.0f} req/s: you still need a rate limiter")
`},A=[{id:"py-concurrency-ingestion-cursor-pages",title:"Follow API cursors safely",prompt:'A REST API returns pages linked by cursors. Model it as a dict `api` that maps a cursor (`None` for the first page) to `(records, next_cursor)`; `next_cursor` is `None` on the last page. Each record is a dict with an `"id"`.\n\nWrite `fetch_all(api, max_pages)` that starts at cursor `None` and follows the cursors. **Before fetching each cursor**, check in this order:\n\n1. the cursor was already fetched: stop with status `"cycle"` (a buggy API looping forever)\n2. `max_pages` pages were already fetched: stop with status `"max_pages"`\n3. the cursor is not in `api`: stop with status `"expired"` (cursors often expire after a few minutes)\n\nAfter fetching a page whose `next_cursor` is `None`, stop with status `"done"`.\n\nPages can overlap (the API re-sends records after a retry), so keep only the **first** occurrence of each id. Return a tuple `(ids, pages_fetched, status)` where `ids` lists the kept ids in the order first seen.\n\nExample: `fetch_all({None: ([{"id": 1}, {"id": 2}], "c1"), "c1": ([{"id": 2}, {"id": 3}], None)}, 10)` returns `([1, 2, 3], 2, "done")`. `max_pages >= 1`.',starter:`def fetch_all(api, max_pages):
    # your code here
    pass
`,solution:`def fetch_all(api, max_pages):
    ids, seen_ids, fetched = [], set(), set()
    cursor, pages = None, 0
    while True:
        if cursor in fetched:
            return (ids, pages, "cycle")
        if pages == max_pages:
            return (ids, pages, "max_pages")
        if cursor not in api:
            return (ids, pages, "expired")
        fetched.add(cursor)
        records, next_cursor = api[cursor]
        pages += 1
        for r in records:
            if r["id"] not in seen_ids:
                seen_ids.add(r["id"])
                ids.append(r["id"])
        if next_cursor is None:
            return (ids, pages, "done")
        cursor = next_cursor
`,tests:[{call:'fetch_all({None: ([{"id": 1}, {"id": 2}], "c1"), "c1": ([{"id": 2}, {"id": 3}], None)}, 10)'},{call:"fetch_all({None: ([], None)}, 5)"},{call:"fetch_all({}, 3)"},{call:'fetch_all({None: ([{"id": "a"}], "c1"), "c1": ([{"id": "b"}], "c2"), "c2": ([{"id": "c"}], "c1")}, 10)'},{call:'fetch_all({None: ([{"id": 1}], "c1"), "c1": ([{"id": 2}], "c2"), "c2": ([{"id": 3}], None)}, 2)'},{call:'fetch_all({None: ([{"id": 1}], "c1"), "c1": ([{"id": 2}], "gone")}, 10)'},{call:'fetch_all({None: ([{"id": 1}], "c1"), "c1": ([{"id": 2}], None)}, 2)',hidden:!0},{call:'fetch_all({None: ([{"id": 5}, {"id": 5}, {"id": 4}], "x"), "x": ([{"id": 4}, {"id": 6}], "x")}, 1)',hidden:!0},{call:'fetch_all({None: ([{"id": 0}], "p1"), "p1": ([{"id": 1}], None)}, 1)',hidden:!0}],hints:["Keep three pieces of state: the cursors already fetched (a set), the ids already kept (a set) and the output list.","Write the loop exactly as the prompt orders it: three checks before the fetch, then fetch, then dedup, then check for `None`.",'A page with `next_cursor is None` ends the scan as `"done"` even if `max_pages` was just reached.'],explanation:"Every real ingestion loop needs these guards. Without the cycle check a buggy API that returns the same cursor spins forever; without `max_pages` one bad run can burn the whole API quota; and an expired cursor must stop cleanly so the job can restart from its last checkpoint rather than crash halfway with nothing written.\n\nDedup by id with a set is O(1) per record, so the loop is O(total records) time and O(distinct ids + pages) space.\n\nIn production you would also persist the last good cursor (or the max `updated_at` seen) after each page is safely written, so a restart resumes instead of re-reading everything, and write each page under a deterministic key so retries overwrite instead of duplicating.\n\nTraps: deduplicating within a page only, checking `max_pages` after fetching (one page too many), and treating an empty page as the end when `next_cursor` is not `None`."},{id:"py-concurrency-ingestion-token-bucket",title:"Token bucket rate limiter",prompt:"An API allows a sustained `rate` requests per second with bursts of up to `capacity`. Model the limiter as a **token bucket** and write `allow(times, rate, capacity)`.\n\n- At time `0` the bucket holds `capacity` tokens.\n- Tokens refill **continuously** at `rate` per second and never exceed `capacity`.\n- `times` is a non-decreasing list of request times in seconds (all `>= 0`). A request is allowed if the bucket holds at least 1 token at that moment; it then takes 1 token. A rejected request takes nothing.\n\nReturn a list of booleans, one per request.\n\nExample: `allow([0, 0, 0, 0.5, 1, 1], 2, 2)` returns `[True, True, False, True, True, False]`: the burst of 2 is used at t=0, half a second refills 1 token, and so does the next half second.\n\nConstraints: up to 10^5 requests; `rate > 0`, `capacity >= 1`. O(n) time and O(1) extra space.",starter:`def allow(times, rate, capacity):
    # your code here
    pass
`,solution:`def allow(times, rate, capacity):
    tokens, last, out = float(capacity), 0.0, []
    for t in times:
        tokens = min(capacity, tokens + (t - last) * rate)
        last = t
        if tokens >= 1:
            tokens -= 1
            out.append(True)
        else:
            out.append(False)
    return out
`,tests:[{call:"allow([0, 0, 0, 0.5, 1, 1], 2, 2)"},{call:"allow([], 1, 5)"},{call:"allow([0, 0, 0, 0, 0], 1, 3)"},{call:"allow([0, 1, 2, 3, 4], 1, 1)"},{call:"allow([10, 10, 10, 10], 1, 3)"},{call:"allow([0, 0.25, 0.5, 0.75, 1.0, 1.25], 2, 1)"},{call:"allow([0, 0, 1, 1, 2, 2, 2], 0.5, 2)",hidden:!0},{call:"sum(allow([i * 0.125 for i in range(800)], 4, 10))",hidden:!0}],hints:["Keep two numbers: `tokens` and the time of the last update. On each request, add `(t - last) * rate` tokens and cap at `capacity`.","Update `last` on every request, allowed or not; only allowed requests subtract a token."],explanation:"Storing just `tokens` and `last` makes the limiter O(1) memory however many requests pass through, unlike a sliding log that keeps every timestamp. Refill is computed lazily on each request, so no background timer is needed. That is how most API gateways, including Amazon API Gateway throttling (rate plus burst), describe their limits.\n\nThe burst lets a client that was idle send `capacity` requests at once; over a long period the allowed rate converges to `rate`. In the hidden test, 800 requests at 8 per second over 100 seconds are allowed about `10 + 4 x 100` times.\n\nTime O(n), space O(1) beyond the output.\n\nTraps: forgetting the cap (an idle hour then allows thousands of requests), refilling in whole tokens per integer second (that is a fixed window, which allows 2x bursts at window edges), and charging rejected requests."},{id:"py-concurrency-ingestion-pool-schedule",title:"Worker pool with a start-rate limit",prompt:"You fetch pages with a thread pool of `workers` threads, and the API also requires at least `min_gap` seconds between the **starts** of consecutive requests. All requests are queued at time 0 in order; `latencies[i]` is how long request `i` takes once started.\n\nRequests start in queue order (FIFO). Request `i` starts at the later of:\n\n- the earliest time any worker is free, and\n- the start time of request `i - 1` plus `min_gap` (request 0 has no such constraint).\n\nIt then occupies that worker until `start + latencies[i]`.\n\nWrite `pool_schedule(latencies, workers, min_gap)` that returns `(makespan, starts)`: the time the last request finishes (`0` if there are none) and the list of start times.\n\nExample: `pool_schedule([3, 3, 3, 3], 2, 0)` returns `(6, [0, 0, 3, 3])`.\n\nConstraints: `workers >= 1`, `min_gap >= 0`, up to 10^5 requests.",starter:`import heapq

def pool_schedule(latencies, workers, min_gap):
    # your code here
    pass
`,solution:`import heapq

def pool_schedule(latencies, workers, min_gap):
    free = [0] * workers                 # min-heap of times at which each worker is free
    starts, makespan, prev = [], 0, None
    for lat in latencies:
        start = heapq.heappop(free)
        if prev is not None:
            start = max(start, prev + min_gap)
        starts.append(start)
        heapq.heappush(free, start + lat)
        makespan = max(makespan, start + lat)
        prev = start
    return (makespan, starts)
`,tests:[{call:"pool_schedule([3, 3, 3, 3], 2, 0)"},{call:"pool_schedule([], 3, 1)"},{call:"pool_schedule([2, 2, 2], 1, 0)"},{call:"pool_schedule([5, 1, 1, 1], 2, 0)"},{call:"pool_schedule([3, 3, 3, 3], 4, 1)"},{call:"pool_schedule([1, 1, 1, 1, 1, 1], 10, 0.5)"},{call:"pool_schedule([1, 1, 1, 1], 1, 2)",hidden:!0},{call:"pool_schedule([4, 1, 1, 1, 1, 1], 2, 0.25)",hidden:!0},{call:"pool_schedule([2] * 1000, 8, 0.25)[0]",hidden:!0}],hints:["Keep a min-heap with one entry per worker: the time it becomes free. `heappop` gives the earliest free worker.","Push the worker back with `start + latency`. Track the previous start time for the `min_gap` rule."],explanation:"This is the model behind sizing `max_workers`. With no rate limit, makespan is roughly `total_latency / workers`. With a start-rate limit, the floor is about `n x min_gap`, and adding workers beyond `latency / min_gap` (Little's law: concurrency = rate x latency) changes nothing: the hidden test with 1,000 requests, 2 s latency and 0.25 s gap needs only 8 workers to hit the floor.\n\nEach request costs one heap pop and one push: O(n log w) time, O(w + n) space.\n\nTraps: assigning requests round-robin instead of to the earliest free worker (one slow request then blocks a whole lane), applying the gap to finish times instead of start times, and forgetting that a single worker makes everything sequential."}],G={fill:"var(--text)",font:"600 11.5px Inter, sans-serif"},x={fill:"var(--text-3)",font:"500 10px JetBrains Mono, monospace"};function Y(){const w=[];let g=0;for(let l=0;l<4;l++)w.push({x:g,w:.2,kind:"send"},{x:g+.2,w:3,kind:"wait"},{x:g+.2+3,w:.6,kind:"parse"}),g+=.2+3+.6;const k=[];let S=0;for(let l=0;l<4;l++){const p=l*.2,b=Math.max(p+.2+3,S);S=b+.6,k.push([{x:p,w:.2,kind:"send"},{x:p+.2,w:b-p-.2,kind:"wait"},{x:b,w:.6,kind:"parse"}])}const W={send:"var(--cyan)",wait:"var(--amber)",parse:"var(--violet)"},U=(l,p,b)=>e.jsx("rect",{x:150+l.x*38,y:p,width:Math.max(2,l.w*38-1),height:14,rx:3,style:{fill:W[l.kind],opacity:l.kind==="wait"?.45:.9}},b);return e.jsx(N,{caption:"Top: one worker, each request waits on the network before the next starts (15.2 time units). Bottom: four threads or four asyncio tasks overlap the waits (about 5.6 units). The violet parsing slices never overlap: under the GIL only one thread runs Python code at a time, so CPU-heavy work needs processes.",children:e.jsx("div",{className:"sim-stage grid-bg",children:e.jsxs("svg",{viewBox:"0 0 820 230",style:{width:"100%",display:"block"},children:[e.jsx("text",{x:16,y:30,style:G,children:"1 worker"}),e.jsx("text",{x:16,y:44,style:x,children:"sequential"}),w.map((l,p)=>U(l,24,`s${p}`)),e.jsx("text",{x:150+g*38+6,y:36,style:x,children:g.toFixed(1)}),e.jsx("text",{x:16,y:92,style:G,children:"4 workers"}),e.jsx("text",{x:16,y:106,style:x,children:"threads / asyncio"}),k.map((l,p)=>l.map((b,V)=>U(b,78+p*20,`l${p}-${V}`))),e.jsx("text",{x:150+S*38+6,y:150,style:x,children:S.toFixed(1)}),[{k:"send",l:"send request"},{k:"wait",l:"waiting on network (GIL released)"},{k:"parse",l:"parse JSON in Python (holds GIL)"}].map((l,p)=>e.jsxs("g",{children:[e.jsx("rect",{x:150+p*210,y:196,width:14,height:12,rx:3,style:{fill:W[l.k],opacity:l.k==="wait"?.45:.9}}),e.jsx("text",{x:150+p*210+20,y:206,style:x,children:l.l})]},l.k))]})})})}const K=`
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from requests.adapters import HTTPAdapter

session = requests.Session()                                   # one pooled session, shared
session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=16))   # default pool is 10 per host

def fetch(page: int) -> list[dict]:
    r = session.get(URL, params={"page": page, "per_page": 1000}, timeout=(3.05, 30))  # ALWAYS a timeout
    r.raise_for_status()
    return r.json()["items"]

with ThreadPoolExecutor(max_workers=16) as pool:
    futures = {pool.submit(fetch, p): p for p in range(1, 501)}
    for fut in as_completed(futures):                          # handle results as they finish
        page = futures[fut]
        write_page(page, fut.result())                         # .result() re-raises the worker's exception`,$=`
from concurrent.futures import ProcessPoolExecutor
import gzip, json

def parse_file(path: str) -> dict:                 # CPU-bound: decompress + parse + aggregate
    counts = {}
    with gzip.open(path, "rt") as f:
        for line in f:
            e = json.loads(line)
            counts[e["type"]] = counts.get(e["type"], 0) + 1
    return counts                                  # return small results: they are pickled back

if __name__ == "__main__":                         # required with the spawn start method (macOS, Windows)
    with ProcessPoolExecutor(max_workers=8) as pool:
        for counts in pool.map(parse_file, paths, chunksize=4):
            merge(totals, counts)`,X=`
import asyncio
import aiohttp

async def fetch(session: aiohttp.ClientSession, sem: asyncio.Semaphore, page: int) -> list[dict]:
    async with sem:                                            # cap requests in flight
        async with session.get(URL, params={"page": page}) as r:
            r.raise_for_status()
            return (await r.json())["items"]

async def main(pages: range) -> None:
    sem = asyncio.Semaphore(32)
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with asyncio.TaskGroup() as tg:                  # Python 3.11+: cancels siblings on failure
            tasks = [tg.create_task(fetch(session, sem, p)) for p in pages]
    for t in tasks:
        write_page(t.result())

asyncio.run(main(range(1, 501)))
# Never call requests.get() or time.sleep() in here: they block the whole event loop.
# Use await asyncio.sleep(), an async client, or await asyncio.to_thread(blocking_fn, ...).`,Q=`
# 1. requests + urllib3 Retry: transparent retries on a Session
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

retry = Retry(total=5, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504],
              allowed_methods=["GET"], respect_retry_after_header=True)
session.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=16))

# 2. tenacity: explicit and testable
from tenacity import retry, stop_after_attempt, wait_random_exponential, retry_if_exception_type

@retry(stop=stop_after_attempt(6), wait=wait_random_exponential(multiplier=0.5, max=30),
       retry=retry_if_exception_type((TimeoutError, ConnectionError, ThrottledError)))
def get_page(cursor): ...

# 3. boto3: built-in retry modes for AWS APIs
from botocore.config import Config
s3 = boto3.client("s3", config=Config(retries={"max_attempts": 10, "mode": "adaptive"}))`,Z=`
import asyncio, time

class TokenBucket:
    """Shared async rate limiter: at most 'rate' acquisitions per second, bursts up to 'capacity'."""
    def __init__(self, rate: float, capacity: int):
        self.rate, self.capacity = rate, capacity
        self.tokens, self.last = float(capacity), time.monotonic()
        self.lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self.lock:
            while True:
                now = time.monotonic()
                self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
                self.last = now
                if self.tokens >= 1:
                    self.tokens -= 1
                    return
                await asyncio.sleep((1 - self.tokens) / self.rate)

bucket = TokenBucket(rate=18, capacity=5)          # API limit 20/s: keep headroom for retries

async def fetch(session, sem, page):
    async with sem:                                # concurrency cap
        await bucket.acquire()                     # rate cap
        async with session.get(URL, params={"page": page}) as r:
            ...`,ee=`
async def ingest_slice(session, bucket, store, slice_id: str, start_cursor: str | None) -> int:
    """Follow one cursor chain to the end, checkpointing after every durable write."""
    cursor = store.load_checkpoint(slice_id) or start_cursor     # resume where we stopped
    page_no = store.load_page_no(slice_id)
    seen = set()
    while True:
        if cursor in seen:
            raise RuntimeError(f"{slice_id}: cursor cycle at {cursor}")
        seen.add(cursor)
        await bucket.acquire()
        body = await get_with_retries(session, {"slice": slice_id, "cursor": cursor})   # backoff + jitter
        key = f"raw/partner/dt={RUN_DATE}/slice={slice_id}/page={page_no:06}.json.gz"
        await write_s3(key, body["records"])                     # deterministic key: a retry overwrites
        store.save_checkpoint(slice_id, body.get("next_cursor"), page_no + 1)   # only after the write
        page_no += 1
        cursor = body.get("next_cursor")
        if cursor is None:
            return page_no

async def ingest(slices):
    sem = asyncio.Semaphore(24)                                   # Little's law: rate x latency, + headroom
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
        async def run(s):
            async with sem:
                return await ingest_slice(session, BUCKET, STORE, s.id, s.cursor)
        results = await asyncio.gather(*(run(s) for s in slices), return_exceptions=True)
    failed = [s.id for s, r in zip(slices, results) if isinstance(r, Exception)]
    emit_metrics(pages=sum(r for r in results if isinstance(r, int)), failed_slices=len(failed))
    if failed:
        raise RuntimeError(f"slices failed, rerun resumes from checkpoints: {failed}")`;function te(){return e.jsxs(e.Fragment,{children:[e.jsxs(t,{num:1,title:"The ingestion problem",children:[e.jsxs("p",{children:["A partner API holds the data you need: orders, payments, ad spend, CRM contacts. It returns ",e.jsx("strong",{children:"pages"})," of, say, 1,000 records, each call takes a few hundred milliseconds, it allows a fixed number of requests per second, and it fails now and then. Your job pulls everything new every day into S3. Done naively, in a loop, the job spends almost all of its time waiting."]}),e.jsx(q,{note:"Sequential time is pages x latency. With enough concurrency the floor becomes pages / rate limit, so the rate limit, not your code, sets the minimum runtime.",children:"sequential ≈ pages × latency       concurrent ≈ max( pages × latency ÷ workers ,  pages ÷ rate limit )"}),e.jsx("p",{children:"20,000 pages at 300 ms is 6,000 s (1 hour 40 minutes) one at a time. With 8 requests in flight it is about 750 s, and if the API allows 25 requests per second the floor is 800 s, so about 8 workers is all you need. That arithmetic, plus pagination, retries and rate limiting done right, is what interviewers want to hear."}),e.jsx(d,{type:"interview",title:"The 30-second answer",children:`"API ingestion is I/O-bound, so I use a thread pool or asyncio, not processes; the GIL is released while waiting on the network. I size concurrency with Little's law, rate times latency, and put a shared token bucket just under the API's limit, because a semaphore only caps requests in flight, not per second. I paginate with cursors or keyset, never shifting offsets, and dedup by id. Every call has a timeout; I retry only timeouts, 429s and 5xx with capped exponential backoff and jitter, honouring Retry-After. Each page lands in S3 under a deterministic key and I checkpoint the cursor after the write, so retries and restarts are idempotent."`})]}),e.jsxs(t,{num:2,title:"Threads, processes, asyncio and the GIL",children:[e.jsxs("p",{children:["CPython has a ",e.jsx("strong",{children:"Global Interpreter Lock"}),": only one thread executes Python bytecode at a time. That sounds fatal for concurrency, but blocking I/O releases the lock. While thread A waits for a socket, threads B, C and D run. For network-bound work, threads (or asyncio tasks) overlap the waiting almost perfectly. For CPU-bound work, they take turns, and you need separate processes."]}),e.jsx(Y,{}),e.jsx(s,{columns:["","Threads","asyncio","Processes"],rows:[["Best for","I/O with blocking libraries (requests, boto3, JDBC drivers)","many concurrent I/O tasks; async libraries (aiohttp, httpx)","CPU-bound Python: parsing, compression, scoring"],["GIL","released during I/O; Python code takes turns","one thread, so the GIL is irrelevant; switches at await","one GIL per process: real parallelism"],["Scale","tens to a few hundred threads","thousands of tasks cheaply","about one per core"],["Cost","shared memory: guard mutable state with locks or queues","every call must be async; one blocking call stalls the loop","start-up, pickling of arguments and results"],["API",e.jsx("code",{children:"ThreadPoolExecutor"}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"asyncio.gather"}),", ",e.jsx("code",{children:"TaskGroup"})," (3.11+), ",e.jsx("code",{children:"Semaphore"})]}),e.jsx("code",{children:"ProcessPoolExecutor"})]]}),e.jsx(J,{tabs:[{label:"Threads",content:e.jsx(a,{lang:"py",title:"ingest_threads.py",code:K})},{label:"asyncio",content:e.jsx(a,{lang:"py",title:"ingest_async.py",code:X})},{label:"Processes",content:e.jsx(a,{lang:"py",title:"parse_processes.py",code:$})}]}),e.jsx(d,{type:"info",title:"Free-threaded Python",children:"PEP 703 added an optional free-threaded CPython build (experimental in 3.13, officially supported but still optional in 3.14) without the GIL. Most production images, Glue and EMR included, run the default build, so design for the GIL and treat free-threading as a bonus."}),e.jsx(u,{children:"Sizing the pool: Little's law"}),e.jsxs("p",{children:["In a stable system, ",e.jsx("em",{children:"requests in flight = request rate × latency"}),". To use a 20 req/s quota at 300 ms you need about 6 in flight; more workers only queue behind the limit (or earn 429s). The playground models a pool of threads fetching 200 pages with and without a 20 req/s cap. It simulates time instead of sleeping, so it shows the scheduling logic directly."]}),e.jsx(c,{title:"Pool size vs rate limit",code:P.pool,minRows:22}),e.jsx(h,{spec:A[2]})]}),e.jsxs(t,{num:3,title:"Pagination that does not lose or repeat records",children:[e.jsx(s,{columns:["Style","Request","Under concurrent writes","Parallel?","Use when"],rows:[["Offset / limit",e.jsx("code",{children:"?offset=2000&limit=1000"}),e.jsx("span",{style:{color:"var(--red)"},children:"inserts duplicate rows, deletes skip rows"}),"yes (any offset)","static data only"],["Page number",e.jsx("code",{children:"?page=3&per_page=1000"}),"same as offset","yes","static data only"],["Cursor / next token",e.jsx("code",{children:"?cursor=eyJpZCI6..."}),"stable: the server encodes the position","no: each page gives the next cursor","the API offers it (most do)"],["Keyset",e.jsx("code",{children:"?after_id=98123&limit=1000"}),"stable if the key is unique and ordered","yes, by splitting key ranges","you control the query or the API exposes a sort key"],["Time window",e.jsx("code",{children:"?updated_from=..&updated_to=.."}),"stable for closed windows; overlap the open one","yes, one chain per window","incremental daily loads"]]}),e.jsx(c,{title:"Offset vs keyset pagination while the data changes",code:P.pagination,minRows:22}),e.jsx("p",{children:"A cursor chain is inherently sequential: you only learn the next cursor from the current page. To parallelise, split the scan into independent slices (time windows, id ranges, accounts) and run one chain per slice. Whatever the style, real APIs misbehave: cursors expire, buggy servers loop, retries re-send pages. The exercise below adds the guards every production loop needs."}),e.jsx(h,{spec:A[0]})]}),e.jsxs(t,{num:4,title:"Retries, backoff and jitter",children:[e.jsx(s,{columns:["Response","Retry?","Why"],rows:[["Timeout, connection reset, DNS blip","yes","transient network failure"],["429 Too Many Requests","yes, after Retry-After","you are over the limit: slow the whole client down"],["500, 502, 503, 504","yes","server or gateway trouble, usually transient"],["400, 422","no","the request is wrong; it will fail the same way every time"],["401 / 403","refresh the token once, then fail","credentials or permissions, not transient"],["404 for an expected resource","no: report it","a bug or a data problem, not a blip"]]}),e.jsx(q,{note:"Capped exponential backoff with full jitter (from the AWS Architecture Blog post 'Exponential Backoff And Jitter'). Cap the attempts too, then fail loudly.",children:"wait(attempt) = uniform( 0 , min( cap , base × 2^attempt ) )"}),e.jsxs("p",{children:["Exponential backoff gives a struggling service room to recover. ",e.jsx("strong",{children:"Jitter"})," matters as much: without it, every client that failed at the same moment retries at the same moments, in waves. The playground puts 1,000 clients against an API that stays down and compares strategies. The deterministic arithmetic of a capped schedule is a Python Lab problem:"," ",e.jsx(r,{to:"/python-lab/py-lab-retry-backoff-schedule",children:"Retry a flaky API with capped exponential backoff"}),"."]}),e.jsx(c,{title:"Retry storms: no jitter vs full, equal and decorrelated jitter",code:P.jitter,minRows:22}),e.jsx(a,{lang:"py",title:"retries_in_practice.py",code:Q}),e.jsxs(d,{type:"warning",title:"Retries need idempotency",children:["A timed-out POST may have succeeded on the server. Retrying it creates a second order unless the API accepts an idempotency key. On the writing side, the same rule: land each page under a deterministic key, so a retried page overwrites itself instead of duplicating (see"," ",e.jsx(r,{to:"/topics/idempotency-and-backfills",children:"Idempotency and backfills"}),")."]})]}),e.jsxs(t,{num:5,title:"Rate limiting with a token bucket",children:[e.jsxs("p",{children:["A ",e.jsx("strong",{children:"token bucket"})," holds up to ",e.jsx("em",{children:"capacity"})," tokens and refills at ",e.jsx("em",{children:"rate"})," tokens per second. A request spends one token; with none left it waits (client-side throttling) or is rejected (server-side limiting). The capacity allows short bursts; over time throughput converges to the rate. It needs only two numbers of state, the tokens and the time of the last refill, whatever the traffic."]}),e.jsx(c,{title:"Client-side throttling: send times under a token bucket",code:P.throttle,minRows:20}),e.jsx(v,{prosTitle:"A semaphore (or max_workers) controls",consTitle:"A token bucket controls",pros:["how many requests are in flight at once","memory and connections used","pressure on a slow server"],cons:["how many requests start per second","staying under a documented quota","burst size after idle periods"]}),e.jsx("p",{children:"Production clients use both: a concurrency cap and a shared rate limiter. Here is the server-side view, as an API gateway applies it."}),e.jsx(h,{spec:A[1]}),e.jsx(a,{lang:"py",title:"async_limiter.py",code:Z})]}),e.jsxs(t,{num:6,title:"Putting it together: a production ingester",children:[e.jsx(I,{width:900,height:320,nodes:[{id:"orch",label:"Orchestrator",sub:"Airflow / Step Functions",x:110,y:60,kind:"service"},{id:"ing",label:"Ingester",sub:"asyncio + token bucket",x:360,y:160,kind:"worker"},{id:"api",label:"Partner API",sub:"25 req/s, cursors",x:650,y:60,kind:"external"},{id:"ckpt",label:"Checkpoints",sub:"DynamoDB: slice -> cursor",x:110,y:260,kind:"db"},{id:"raw",label:"Raw landing",sub:"s3://raw/.../page=000042",x:650,y:260,kind:"storage"},{id:"spark",label:"Spark job",sub:"dedup + MERGE",x:820,y:160,kind:"service",w:120}],edges:[{from:"orch",to:"ing",label:"run(date, slices)"},{from:"ing",to:"api",label:"GET page",animated:!0,both:!0,color:"#22d3ee"},{from:"ing",to:"raw",label:"write page",animated:!0},{from:"ing",to:"ckpt",label:"cursor after write",dashed:!0},{from:"raw",to:"spark",animated:!0}],caption:"The ingester only fetches and lands raw pages; Spark does the heavy transform. Checkpoints are written after the S3 write succeeds, so a crash resumes each slice from its last durable page."}),e.jsx(a,{lang:"py",title:"ingester.py (core loop)",code:ee}),e.jsx(s,{columns:["Concern","Decision","Why"],rows:[["Concurrency","one cursor chain per slice, semaphore across slices","cursor chains are sequential; slices are not"],["Rate","one shared token bucket at ~90% of the quota","headroom for retries; never trip the limit"],["Retries","timeouts, 429, 5xx; full jitter; Retry-After; ~6 attempts","transient only; bounded worst case"],["Idempotency","deterministic S3 key per page; checkpoint after write","retries and restarts overwrite, never duplicate"],["Failure","a failed slice fails the run, others keep their progress","rerun resumes from checkpoints"],["Downstream","Spark dedups by id and MERGEs","the landing is at-least-once by design"],["Observability","pages, records, retries, 429s, slice failures, duration","a rising 429 or retry rate is the early warning"]]})]}),e.jsxs(t,{num:7,title:"Where to run it",children:[e.jsx(s,{columns:["Option","Good for","Watch out for"],rows:[["AWS Lambda","small or sliced pulls, event-driven triggers","15-minute maximum, memory caps, many concurrent Lambdas can blow the partner's rate limit"],["Step Functions (Distributed) Map + Lambda","fan-out over many slices with retries per item","set MaxConcurrency to respect the shared rate limit"],["ECS Fargate task","long-running ingesters, hours if needed","you own the container image and scheduling"],["Glue Python shell","cheap single-node Python jobs inside a Glue workflow","single node; not for heavy transforms"],["Spark (mapPartitions)","many independent ids to look up, data already in Spark","divide the rate limit across partitions; task retries re-call the API"]]}),e.jsx(a,{lang:"py",title:"api_from_spark.py (only when it fits)",code:`
def enrich_partition(rows):
    session = requests.Session()                      # one session per partition, not per row
    limiter = SyncTokenBucket(rate=GLOBAL_RATE / NUM_PARTITIONS, capacity=2)
    for row in rows:
        limiter.acquire()
        r = session.get(f"{URL}/{row.customer_id}", timeout=(3.05, 10))
        yield (row.customer_id, r.status_code, r.text if r.ok else None)

out = (ids.repartition(NUM_PARTITIONS)                # NUM_PARTITIONS = max concurrent callers
          .rdd.mapPartitions(enrich_partition)
          .toDF(["customer_id", "status", "body"]))`}),e.jsx(j,{items:[{platform:"aws",body:e.jsxs("p",{children:["For AWS APIs themselves, configure boto3's ",e.jsx("code",{children:"standard"})," or ",e.jsx("code",{children:"adaptive"})," retry mode instead of hand-rolled retries; use paginators (",e.jsx("code",{children:'client.get_paginator("list_objects_v2")'}),") instead of manual continuation tokens. Amazon AppFlow covers some SaaS sources (Salesforce, Zendesk and others) without custom code."]})},{platform:"glue",body:e.jsx("p",{children:"Glue Python shell jobs are a cheap home for an ingester (1/16 or 1 DPU); the Glue Spark job then reads the landed raw pages. Keep the API client out of Spark unless the work is a per-id lookup."})},{platform:"k8s",body:e.jsx("p",{children:"On Kubernetes, run the ingester as a Job or CronJob with resource limits; if several replicas share one partner quota, the token bucket must be shared too (for example in Redis), or the quota split statically per replica."})}]}),e.jsxs("p",{children:["Orchestration-level retries (Airflow task retries, Step Functions Retry blocks) sit on top of these request-level retries. Keep request retries short and the task idempotent so a task retry is safe: ",e.jsx(r,{to:"/topics/airflow-idempotent-tasks-retries",children:"Idempotent tasks and retries"}),"."]})]}),e.jsxs(t,{num:8,title:"Pitfalls and what interviewers probe",children:[e.jsx(s,{columns:["Pitfall","Symptom","Fix"],rows:[["No timeout","job hangs for hours, never fails","timeout=(connect, read) on every call, plus a job deadline"],["More workers than the quota","429 storms, slower than before","Little's law sizing + shared token bucket"],["Semaphore as a rate limiter","bursts far above the limit with fast responses","token bucket for rate, semaphore for concurrency"],["Retrying everything","quota burned on 400s; bugs retried","retry timeouts, 429, 5xx only; explicit exception list"],["No jitter","synchronised retry waves","full or decorrelated jitter"],["Offset pagination on live data","duplicates and missing records","cursor / keyset / closed windows + dedup by id"],["Blocking call inside asyncio","concurrency silently drops to one","async client or asyncio.to_thread"],["Checkpoint before write","crash loses a page forever","write durably, then checkpoint"],["Threads for CPU-bound parsing","no speedup past one core","ProcessPoolExecutor, or land raw and parse in Spark"]]}),e.jsx(d,{type:"interview",title:"What interviewers probe",children:e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"The arithmetic"}),": pages, latency, rate limit, runtime floor and how many workers that implies."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"The GIL"}),": why threads still help for I/O, and what you would do for CPU-heavy parsing."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Failure handling"}),": which errors you retry, how you back off, and what happens when the job dies halfway."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Correctness"}),": how pagination and retries avoid both gaps and duplicates, and how you would prove it (counts, reconciliation)."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Testing"}),": the scheduling logic is pure, so test it without the network; see ",e.jsx(r,{to:"/topics/py-testable-pipeline-code",children:"Testable pipeline code"}),"."]})]})})]}),e.jsx(t,{num:9,title:"Key takeaways",children:e.jsx(_,{items:[e.jsx(e.Fragment,{children:"API ingestion is I/O-bound: threads or asyncio overlap the waits; the GIL is released during I/O. Use processes for CPU-bound parsing."}),e.jsx(e.Fragment,{children:"Runtime floor = pages ÷ rate limit. Concurrency needed = rate × latency (Little's law). Past that, more workers only add 429s."}),e.jsx(e.Fragment,{children:"A semaphore caps requests in flight; a token bucket caps requests per second. You usually need both."}),e.jsx(e.Fragment,{children:"Paginate with cursors, keyset or closed time windows, not shifting offsets; split the scan into slices to parallelise cursor chains; dedup by id."}),e.jsx(e.Fragment,{children:"Timeouts on every call. Retry only timeouts, 429 and 5xx, with capped exponential backoff, jitter and Retry-After, and a maximum number of attempts."}),e.jsx(e.Fragment,{children:"Land each page under a deterministic key and checkpoint after the write, so retries and restarts are idempotent and resumable."})]})})]})}const Le=Object.freeze(Object.defineProperty({__proto__:null,default:te},Symbol.toStringTag,{value:"Module"})),T={lazy:`import sys

# A list materialises every element now. A generator produces them one at a time, on demand.
squares_list = [n * n for n in range(1_000_000)]
squares_gen = (n * n for n in range(1_000_000))
print(f"list object: {sys.getsizeof(squares_list):>10,} bytes (plus the int objects it points to)")
print(f"generator  : {sys.getsizeof(squares_gen):>10,} bytes, whatever the length")

# A pipeline of generators processes ONE record at a time through every stage.
def read(lines):
    for line in lines:
        print(f"  read   {line!r}")
        yield line

def parse(rows):
    for row in rows:
        user, amount = row.split(",")
        print(f"  parse  {user}")
        yield user, int(amount)

def big_only(rows, threshold):
    for user, amount in rows:
        if amount >= threshold:
            yield user, amount

pipeline = big_only(parse(read(["u1,50", "u2,500", "u3,900"])), 100)
print("nothing has run yet:", pipeline)
for rec in pipeline:                # each record flows through all stages before the next is read
    print("got", rec)

# Generators are single-use: a second pass sees nothing.
gen = (x for x in [1, 2, 3])
print(sum(gen), sum(gen))
`,chunks:`import io

# Pretend this is a 50 GB file. io.StringIO behaves like an open text file.
data = "order_id,amount\\n" + "".join(f"o{i},{i * 10}\\n" for i in range(1, 8))
f = io.StringIO(data)

# 1) Line iteration: the file object buffers internally and yields one line at a time.
for line in f:
    pass
print("line iteration is lazy and memory-flat; last line was", repr(line))

# 2) Fixed-size chunks (for bytes you will decompress, upload or hash): a chunk can end mid-line!
f.seek(0)
print([chunk for chunk in iter(lambda: f.read(20), "")][:3])

# 3) Chunks -> complete lines: carry the partial last line over to the next chunk.
def lines_from_chunks(f, size):
    tail = ""
    for chunk in iter(lambda: f.read(size), ""):   # iter(callable, sentinel): call until it returns ""
        chunk = tail + chunk
        *complete, tail = chunk.split("\\n")        # the last piece may be incomplete
        print(f"chunk -> {len(complete)} complete line(s), carry {tail!r}")
        yield from complete
    if tail:                                       # file did not end with a newline
        yield tail

f.seek(0)
rows = list(lines_from_chunks(f, 20))
print(rows)
assert rows == data.rstrip("\\n").split("\\n")
`,stream:`import csv, io, json, itertools, random
from collections import defaultdict

random.seed(1)
CITIES = ["Bengaluru", "Delhi, NCR", "Mumbai", "Pune"]

def fake_csv_lines(n):
    """Yields the lines of a CSV 'file' lazily: nothing is held in memory."""
    yield "order_id,city,amount\\n"
    for i in range(n):
        city = random.choice(CITIES)
        amount = "oops" if i % 997 == 0 else f"{random.uniform(50, 2000):.2f}"
        yield f'{i},"{city}",{amount}\\n'        # quoted, because one city contains a comma

# csv.reader accepts ANY iterable of lines: a file, a generator, an S3 body's iter_lines()...
rows = csv.DictReader(fake_csv_lines(100_000))
totals, bad = defaultdict(float), 0
for row in rows:
    try:
        totals[row["city"]] += float(row["amount"])
    except ValueError:
        bad += 1                                # count and skip, never crash the whole file
print({k: round(v) for k, v in sorted(totals.items())}, "bad rows:", bad)

# JSON Lines: one JSON document per line. Parse lazily, skip the broken ones.
jsonl = io.StringIO('{"event": "click", "ms": 12}\\n\\n{"event": "view", "ms": 40}\\n{broken\\n{"event": "click", "ms": 7}\\n')
def records(f):
    for n, line in enumerate(f, 1):
        if not line.strip():
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError as e:
            print(f"line {n}: skipped ({e.msg})")
print([r["ms"] for r in records(jsonl) if r["event"] == "click"])

# Write in batches (e.g. 500 rows per INSERT or per S3 multipart part) without building a big list.
for batch in itertools.batched(range(1, 1201), 500):      # Python 3.12+
    print("flush batch of", len(batch), "starting at", batch[0])
`,itertools:`import itertools as it

events = [("u1", "view"), ("u1", "click"), ("u2", "view"), ("u1", "buy")]

# islice: take the first N of ANY iterable (head -n), lazily
print("head:", list(it.islice(it.count(start=100, step=5), 4)))

# chain: concatenate many iterables (e.g. several part files) into one stream
part1, part2 = ["a", "b"], ["c"]
print("chain:", list(it.chain(part1, part2)), list(it.chain.from_iterable([part1, part2])))

# groupby groups only CONSECUTIVE equal keys. It is not SQL GROUP BY:
print("unsorted:", [(k, len(list(g))) for k, g in it.groupby(events, key=lambda e: e[0])])
srt = sorted(events, key=lambda e: e[0])
print("sorted  :", [(k, len(list(g))) for k, g in it.groupby(srt, key=lambda e: e[0])])

# accumulate: running totals; pairwise (3.10+): consecutive pairs, e.g. gaps between timestamps
ts = [0, 4, 5, 30, 31]
print("running:", list(it.accumulate([3, 1, 4, 1])), " gaps:", [b - a for a, b in it.pairwise(ts)])

# tee clones an iterator, but buffers everything one copy has seen and the other has not.
a, b = it.tee(iter(range(5)))
print("tee:", list(a), list(b))

# The exhausted-iterator trap: zip / any / in all CONSUME what they read.
nums = iter([1, 2, 3, 4])
print(3 in nums, list(nums))      # True [4]: 1, 2, 3 were consumed by the search
`},ae={id:"py-generators-large-files-csv-revenue",title:"Revenue per region from a CSV stream",prompt:'Write `revenue_by_region(lines)`. `lines` is an iterable of CSV text lines (a file object, a generator, an S3 body\'s `iter_lines()`); the file can be bigger than memory, so iterate it once and never build a list of all rows.\n\nThe first line is a header. It contains (at least) the columns `region` and `amount`, in any order. For every data row:\n\n- **blank lines** are ignored completely,\n- a row is **bad** if it has a different number of fields than the header, an empty or whitespace-only region, or an `amount` that `float()` cannot parse,\n- otherwise add `float(amount)` to `region.strip()`.\n\nFields may be quoted and contain commas (`"Delhi, NCR"`). Return `(totals, bad)` where `totals` maps region to its total **rounded to 2 decimals** and `bad` is the number of bad rows. With no header at all, return `({}, 0)`.\n\nExample: `revenue_by_region(["region,amount\\n", "south,100.5\\n", "north,20\\n", "south,abc\\n", "south,9.5\\n"])` returns `({"south": 110.0, "north": 20.0}, 1)`.',starter:`import csv

def revenue_by_region(lines):
    # your code here
    pass
`,solution:`import csv

def revenue_by_region(lines):
    reader = csv.reader(lines)          # lazy: pulls one line at a time from \`lines\`
    header = next(reader, None)
    if header is None:
        return {}, 0
    r_i, a_i = header.index("region"), header.index("amount")
    totals, bad = {}, 0
    for row in reader:
        if not row:                     # blank line
            continue
        if len(row) != len(header):
            bad += 1
            continue
        region = row[r_i].strip()
        try:
            amount = float(row[a_i])
        except ValueError:
            bad += 1
            continue
        if not region:
            bad += 1
            continue
        totals[region] = totals.get(region, 0.0) + amount
    return {k: round(v, 2) for k, v in totals.items()}, bad
`,tests:[{call:'revenue_by_region(["region,amount\\n", "south,100.5\\n", "north,20\\n", "south,abc\\n", "south,9.5\\n"])'},{call:'revenue_by_region(["id,region,amount\\n", "1,\\"Delhi, NCR\\",250\\n", "2,west,50\\n", "3,west\\n"])'},{call:'revenue_by_region(["amount,region\\n", "5,east\\n", "\\n", "7.25,east\\n"])'},{call:'revenue_by_region(["region,amount\\n"])'},{call:"revenue_by_region([])"},{call:'revenue_by_region(("region,amount\\n" if i == 0 else "r%d,%d\\n" % (i % 3, i) for i in range(10001)))',hidden:!0},{call:'revenue_by_region(iter(["region,amount\\n", "  ,5\\n", "x,1\\n", "x,2,3\\n", "x,0.1\\n", "x,0.2\\n"]))',hidden:!0}],hints:['`csv.reader` accepts any iterable of strings, not just files, and handles quoting. `line.split(",")` breaks on `"Delhi, NCR"`.',"Get the header with `next(reader, None)` and look up the column positions with `header.index(...)`; then loop over the rest of the same reader.","Wrap only `float(...)` in `try/except ValueError`, count bad rows instead of crashing, and round once at the end."],explanation:'`csv.reader` is itself an iterator over any iterable of lines, so the whole function streams: memory is O(number of regions), not O(file size). `next(reader, None)` consumes just the header and the `for` loop continues from the second line.\n\nCounting and skipping bad rows (instead of raising) is what production loaders do; in a real pipeline you would also write the bad rows to a quarantine file with their line numbers. Rounding once at the end avoids accumulating rounding error.\n\nTraps: `str.split(",")` (breaks on quoted commas), `list(lines)` or `readlines()` (loads the whole file), assuming column order, and letting one bad row kill a 50 GB load.'},se={id:"py-generators-large-files-first-errors",title:"First N errors from a JSON Lines log, lazily",prompt:'Write `first_errors(lines, n)`. `lines` is an iterable of JSON Lines strings (one JSON object per line), possibly an endless stream. Skip blank lines, lines that are not valid JSON, and lines whose JSON is not an object (dict).\n\nReturn a list of the `msg` values (use `None` if a record has no `msg`) of the **first `n` records whose `level` is `"ERROR"`**, in order.\n\n**Read no more lines than necessary:** stop as soon as you have `n` errors (and read nothing when `n == 0`). The hidden tests use generators that blow up if you read one line too many.\n\nExample: `first_errors([\'{"level": "INFO", "msg": "start"}\', \'{"level": "ERROR", "msg": "disk full"}\', \'not json\', \'\', \'{"level": "ERROR", "msg": "timeout"}\', \'{"level": "ERROR", "msg": "late"}\'], 2)` returns `["disk full", "timeout"]`.',starter:`import json
from itertools import islice

def first_errors(lines, n):
    # your code here
    pass
`,solution:`import json
from itertools import islice

def parse_jsonl(lines):
    for line in lines:
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(rec, dict):
            yield rec

def first_errors(lines, n):
    errors = (r for r in parse_jsonl(lines) if r.get("level") == "ERROR")
    return [r.get("msg") for r in islice(errors, n)]   # islice stops pulling after n
`,tests:[{call:`first_errors(['{"level": "INFO", "msg": "start"}', '{"level": "ERROR", "msg": "disk full"}', 'not json', '', '{"level": "ERROR", "msg": "timeout"}', '{"level": "ERROR", "msg": "late"}'], 2)`},{call:`first_errors(['{"level": "ERROR", "msg": "a"}', '[1, 2]', '"ERROR"', '{"level": "ERROR"}'], 5)`},{call:`first_errors(['{"level": "WARN", "msg": "x"}', '   ', '{"level": "error", "msg": "lowercase"}'], 3)`},{call:`first_errors(['{"level": "ERROR", "msg": "a"}'], 0)`},{call:`first_errors(('{"level": "ERROR", "msg": "e%d"}' % i if i < 3 else str(1 // 0) for i in range(10)), 3)`,hidden:!0},{call:"first_errors((str(1 // 0) for _ in range(1)), 0)",hidden:!0},{call:`first_errors(('{"level": "%s", "msg": %d}' % ("ERROR" if i % 1000 == 999 else "INFO", i) for i in range(100000)), 3)`,hidden:!0}],hints:['Split it into two generators: one that turns lines into dicts (skipping junk), and a filter for `level == "ERROR"`.',"`itertools.islice(gen, n)` takes the first `n` items and stops pulling from the source after the n-th.","If you write the loop by hand, check `len(found) == n` right after appending, not at the top of the next iteration (that reads one line too many)."],explanation:'Chaining generators gives a lazy pipeline: `islice` asks the filter for one record, the filter asks the parser, the parser reads one line. Nothing upstream runs until something downstream asks, so the function reads exactly as many lines as it needs, even from an infinite stream. Time O(lines read), memory O(n).\n\n`json.loads` raises `json.JSONDecodeError` (a subclass of `ValueError`) on bad input; valid JSON that is not an object (`[1, 2]`, `"ERROR"`) has to be filtered separately because `.get` would fail on it.\n\nTraps: `list(lines)` or a list comprehension over all lines (never finishes on a stream), checking the count at the top of the loop (one extra read), and `except Exception: pass` around the whole loop body, which hides real bugs.'},re={id:"py-generators-large-files-state-runs",title:"Collapse heartbeats into state runs",prompt:'A service sends a heartbeat every second. `heartbeats` is an iterable of `(ts, status)` tuples **already sorted by `ts`** (it may be a generator over a huge file).\n\nWrite `state_runs(heartbeats)` that collapses each run of **consecutive** heartbeats with the same status into one tuple `(status, first_ts, last_ts, count)`, and returns the list of runs in order.\n\nExample: `state_runs([(1, "UP"), (2, "UP"), (3, "DOWN"), (4, "UP"), (5, "UP"), (6, "UP")])` returns `[("UP", 1, 2, 2), ("DOWN", 3, 3, 1), ("UP", 4, 6, 3)]`. Note that `UP` appears as two separate runs.\n\nConstraints: up to 10^6 heartbeats; keep memory per run constant (do not build a list of a run\'s heartbeats).',starter:`from itertools import groupby

def state_runs(heartbeats):
    # your code here
    pass
`,solution:`from itertools import groupby
from operator import itemgetter

def state_runs(heartbeats):
    runs = []
    for status, group in groupby(heartbeats, key=itemgetter(1)):
        first_ts, _ = next(group)
        last_ts, count = first_ts, 1
        for ts, _ in group:          # stream through the run, O(1) memory
            last_ts = ts
            count += 1
        runs.append((status, first_ts, last_ts, count))
    return runs
`,tests:[{call:'state_runs([(1, "UP"), (2, "UP"), (3, "DOWN"), (4, "UP"), (5, "UP"), (6, "UP")])'},{call:"state_runs([])"},{call:'state_runs([(42, "DEGRADED")])'},{call:'state_runs([(1, "A"), (2, "B"), (3, "A"), (4, "B")])'},{call:'state_runs(((t, "UP" if (t // 10) % 2 == 0 else "DOWN") for t in range(35)))',hidden:!0},{call:"len(state_runs((t, t % 2) for t in range(200000)))",hidden:!0},{call:'state_runs(iter([(5, "X"), (6, "X"), (9, "X")]))',hidden:!0}],hints:["`itertools.groupby` yields `(key, group)` for each run of consecutive items with the same key, which is exactly a run of one status.","Use `key=lambda hb: hb[1]` (or `operator.itemgetter(1)`). The first item of the group gives `first_ts`; iterate the rest to count and find `last_ts`.","Each group is a lazy iterator that is invalidated when groupby moves on, so finish using it inside the loop."],explanation:"`groupby` is a streaming run-length encoder: it groups **consecutive** equal keys, which is the desired behaviour here (unlike SQL `GROUP BY`, which would merge the two `UP` runs). Each group is consumed as it streams past, so memory is O(1) per run plus the output. Time O(n).\n\nThis is the Python version of the SQL gaps-and-islands pattern and of building state intervals (uptime, session states, SCD2 validity ranges) from event streams.\n\nTraps: expecting `groupby` to group across the whole input (it needs sorted input for that), `len(list(group))` (fine for small runs, but materialises a long run), and keeping a reference to `group` after the loop has advanced (it is then empty)."},O={csvrevenue:ae,firsterrors:se,runs:re},n={violet:"#a78bfa",cyan:"#22d3ee",green:"#34d399",amber:"#fbbf24",blue:"#60a5fa",text:"#e8eaf2",dim:"#a4a9bb",bg:"#121522"},M='"JetBrains Mono", monospace';function ne(){const y=[{x:20,label:"orders.csv",sub:"50 GB on disk / S3",color:n.blue},{x:185,label:"read_lines()",sub:"yields 1 line",color:n.violet},{x:350,label:"parse()",sub:"yields 1 dict",color:n.violet},{x:515,label:"big_only()",sub:"yields if amount >= 100",color:n.violet}];return e.jsx(N,{caption:"A generator pipeline is pull-based. The consumer (sum, a for loop, a writer) asks the last stage for one record; each stage asks the stage before it; one line is read from the file. Only one record is in flight at a time, so memory does not depend on the file size.",children:e.jsxs("svg",{viewBox:"0 0 760 190",style:{width:"100%",display:"block"},role:"img","aria-label":"Lazy generator pipeline",children:[y.map((o,i)=>e.jsxs("g",{children:[e.jsx("rect",{x:o.x,y:50,width:145,height:56,rx:9,fill:n.bg,stroke:o.color,strokeWidth:1.6}),e.jsx("text",{x:o.x+72,y:74,textAnchor:"middle",fill:n.text,style:{font:`700 12px ${M}`},children:o.label}),e.jsx("text",{x:o.x+72,y:93,textAnchor:"middle",fill:n.dim,style:{font:"500 10px Inter"},children:o.sub}),i<y.length-1&&e.jsxs("g",{children:[e.jsx("line",{x1:o.x+147,y1:70,x2:o.x+183,y2:70,stroke:n.cyan,strokeWidth:1.8}),e.jsx("polygon",{points:`${o.x+183},65 ${o.x+183},75 ${o.x+165+26},70`,fill:n.cyan}),e.jsx("line",{x1:o.x+183,y1:90,x2:o.x+149,y2:90,stroke:n.amber,strokeWidth:1.2,strokeDasharray:"4 3"})]})]},o.label)),e.jsx("rect",{x:680,y:50,width:70,height:56,rx:9,fill:"rgba(52,211,153,.10)",stroke:n.green,strokeWidth:1.6}),e.jsx("text",{x:715,y:76,textAnchor:"middle",fill:n.green,style:{font:`700 12px ${M}`},children:"sum()"}),e.jsx("text",{x:715,y:93,textAnchor:"middle",fill:n.dim,style:{font:"500 9px Inter"},children:"consumer"}),e.jsx("line",{x1:662,y1:70,x2:678,y2:70,stroke:n.cyan,strokeWidth:1.8}),e.jsx("line",{x1:678,y1:90,x2:662,y2:90,stroke:n.amber,strokeWidth:1.2,strokeDasharray:"4 3"}),e.jsx("text",{x:20,y:140,fill:n.cyan,style:{font:"600 10px Inter"},children:"solid cyan: one record flows right when asked"}),e.jsx("text",{x:20,y:158,fill:n.amber,style:{font:"600 10px Inter"},children:"dashed amber: next() requests flow left"}),e.jsx("text",{x:20,y:176,fill:n.dim,style:{font:"500 10px Inter"},children:"memory in flight: ~1 line + the running total. A list at each stage would hold the whole file, three times."})]})})}function oe({caption:y,head:o,rows:i,colors:m}){return e.jsx(N,{caption:y,children:e.jsx("div",{className:"table-wrap",children:e.jsxs("table",{children:[e.jsx("thead",{children:e.jsx("tr",{children:o.map(f=>e.jsx("th",{children:f},f))})}),e.jsx("tbody",{children:i.map((f,w)=>e.jsx("tr",{children:f.map((g,k)=>e.jsx("td",{className:"mono",style:m[k]?{color:m[k]}:void 0,children:g},k))},w))})]})})})}function ie(){return e.jsxs(e.Fragment,{children:[e.jsxs(t,{num:1,title:"The problem: a 50 GB file and 16 GB of RAM",children:[e.jsxs("p",{children:[`The classic data-engineering coding prompt: "here's a huge CSV / log / JSON export, compute X". The naive solution,`," ",e.jsx("code",{children:"f.read()"}),", ",e.jsx("code",{children:"f.readlines()"})," or ",e.jsx("code",{children:"pd.read_csv(path)"}),", loads the whole file into memory and dies with",e.jsx("code",{children:" MemoryError"})," or an OOM kill, often after minutes of work. On AWS Lambda (max 10,240 MB of memory) or a small Glue Python shell job, the ceiling is even lower."]}),e.jsxs("p",{children:["The fix is ",e.jsx("strong",{children:"streaming"}),": hold one record at a time, plus whatever small state you aggregate into. Python's tool for this is the",e.jsx("strong",{children:" iterator"})," protocol and its friendly form, the ",e.jsx("strong",{children:"generator"}),". Files, ",e.jsx("code",{children:"csv.reader"}),", ",e.jsx("code",{children:"map"}),",",e.jsx("code",{children:" zip"}),", dict views and S3 response bodies already speak it."]}),e.jsx(q,{note:"State is what you aggregate into: a running total is O(1), a dict of per-key totals is O(distinct keys), a set for dedup is O(distinct records).",children:"memory = O(one record) + O(state)        not  O(file size)"}),e.jsx(d,{type:"interview",title:"The 30-second answer",children:`"I'd never materialise the file. I iterate it lazily, line by line for text or in fixed-size chunks for bytes, and push each record through a chain of generators: parse, validate, filter, then aggregate into a small dict or write out in batches. Memory is one record plus the aggregation state, and it's one pass, so it works on a stream from S3 as well as a local file. Bad rows get counted and quarantined, not allowed to crash the run. If the state itself gets too big, say exact distinct counts over billions of keys, that's my signal to move to Spark or an external sort rather than fight it in one process."`})]}),e.jsxs(t,{num:2,title:"Recognising the pattern in a prompt",children:[e.jsx(s,{columns:["The prompt says...","What they want to see"],rows:[['"the file does not fit in memory", "10 GB / 1 TB", "a laptop"',"Line iteration or chunked reads, generator pipeline, O(1) memory per record"],['"stream", "one pass", "you cannot re-read it"',"Single-pass algorithms; no len(), no indexing, no sorting the whole input"],['"log file", "JSON Lines", "CSV export"',"csv / json modules over an iterator, bad-row handling"],['"first N", "stop early", "as soon as"',"islice / break: laziness means you read only what you need"],['"write in batches of 500", "bulk insert", "multipart upload"',"itertools.batched / islice chunking"],['"consecutive", "runs", "state changes"',"itertools.groupby on sorted or naturally ordered input"],['"top K", "merge sorted files"',"Generators feeding a heap: see heaps and top-K"]]}),e.jsxs(d,{type:"tip",title:"Ask the size questions out loud",children:["How big is the file? Is it sorted by anything? Is it compressed (gzip is not seekable or splittable)? Is it local or on S3? How big is the output or the state? Interviewers reward the candidate who asks before writing ",e.jsx("code",{children:"readlines()"}),"."]})]}),e.jsxs(t,{num:3,title:"Iterators and generators from zero",children:[e.jsx(u,{children:"The iterator protocol"}),e.jsxs("p",{children:["An ",e.jsx("strong",{children:"iterable"})," is anything ",e.jsx("code",{children:"for"})," can loop over. ",e.jsx("code",{children:"iter(x)"})," gives an ",e.jsx("strong",{children:"iterator"}),", an object whose ",e.jsx("code",{children:"next()"})," returns one item at a time and raises ",e.jsx("code",{children:"StopIteration"})," when it's done. A ",e.jsx("code",{children:"for"})," loop is just that:"]}),e.jsx(a,{lang:"py",title:"what a for loop really does",code:`
it = iter(["a", "b"])     # lists are iterables; iter() gives a fresh iterator
print(next(it))           # 'a'
print(next(it))           # 'b'
print(next(it, None))     # None: the default instead of StopIteration

f = open("events.log")    # a file object IS its own iterator
next(f)                   # reads just the first line`}),e.jsx(u,{children:"Generators: iterators you write with yield"}),e.jsxs("p",{children:["A function containing ",e.jsx("code",{children:"yield"})," doesn't run when called; it returns a generator. Each ",e.jsx("code",{children:"next()"})," runs the body until the next ",e.jsx("code",{children:"yield"}),", hands the value out and ",e.jsx("em",{children:"pauses"})," there with all local variables intact. A generator expression,",e.jsx("code",{children:" (f(x) for x in xs)"}),", is the one-line form. ",e.jsx("code",{children:"yield from other"})," delegates to another iterable."]}),e.jsx(a,{lang:"py",title:"three ways to write the same lazy stage",code:`
def amounts(rows):                 # generator function
    for row in rows:
        if row["status"] == "paid":
            yield float(row["amount"])

amounts2 = (float(r["amount"]) for r in rows if r["status"] == "paid")   # generator expression

def all_parts(paths):              # yield from: flatten several files into one stream
    for p in paths:
        with open(p) as f:
            yield from f`}),e.jsx(ne,{}),e.jsx(c,{title:"Lazy pipelines: who runs when, and how small a generator is",code:T.lazy,minRows:14}),e.jsx(v,{prosTitle:"Generators give you",consTitle:"Generators cost you",pros:["Constant memory per record, whatever the input size","Start producing output immediately (first record in milliseconds)","Composable stages that are easy to test with a list as input","Early exit: stop reading as soon as you have the answer"],cons:["Single use: a second loop sees nothing","No len(), no indexing, no slicing","Errors surface when consumed, far from where the generator was created","Slightly slower per item than a C-level list comprehension"]})]}),e.jsxs(t,{num:4,title:"Reading files bigger than RAM",children:[e.jsx(u,{children:"Text: iterate lines"}),e.jsxs("p",{children:[e.jsx("code",{children:"for line in f"})," is the default answer. The file object reads a buffer at a time (typically a few KB to 1 MB internally) and hands out one line per iteration, so memory stays flat. Open text with an explicit ",e.jsx("code",{children:'encoding="utf-8"'}),", and pass",e.jsx("code",{children:' newline=""'})," when the file goes to the ",e.jsx("code",{children:"csv"})," module so quoted newlines inside fields survive."]}),e.jsx(u,{children:"Bytes: fixed-size chunks, and the boundary problem"}),e.jsxs("p",{children:["For binary data you will hash, decompress, upload or re-split, read fixed-size chunks:"," ",e.jsx("code",{children:'for chunk in iter(lambda: f.read(1 << 20), b"")'}),". The two-argument ",e.jsx("code",{children:"iter(callable, sentinel)"})," calls the function until it returns the sentinel. If you then need ",e.jsx("em",{children:"records"}),", a chunk can end in the middle of a line, so you carry the partial last line into the next chunk:"]}),e.jsx(oe,{caption:"Chunks of 20 characters over a small CSV. Chunk 1 ends in the middle of 'o1,10'; the partial 'o1,1' is carried over and completed by chunk 2. Without the carry you would emit 'o1,1' and '0' as two corrupt rows.",head:["chunk","raw chunk (\\n shown)","carry in","complete lines out","carry out"],colors:[n.dim,n.cyan,n.amber,n.green,n.amber],rows:[["1","order_id,amount\\no1,1","''","order_id,amount","'o1,1'"],["2","0\\no2,20\\no3,30\\no4,40\\n","'o1,1'","o1,10  o2,20  o3,30  o4,40","''"],["3","o5,50\\no6,60\\no7,70\\n","''","o5,50  o6,60  o7,70","''"],["end",'(read returns "")',"''","flush the carry if not empty","-"]]}),e.jsx(c,{title:"Line iteration, raw chunks, and chunks turned back into lines",code:T.chunks,minRows:14}),e.jsx(s,{columns:["Approach","Peak memory","Use it for"],rows:[[e.jsx("code",{children:"f.read()"}),"whole file (more for str)","Small files only"],[e.jsx("code",{children:"f.readlines()"}),"whole file + a list of line objects","Never for big files"],[e.jsx("code",{children:"for line in f"}),"one line + buffer","Text records: logs, CSV, JSON Lines"],[e.jsx("code",{children:'iter(lambda: f.read(n), b"")'}),"n bytes","Binary: hashing, upload parts, decompression"],[e.jsx("code",{children:"pd.read_csv(path, chunksize=100_000)"}),"one DataFrame chunk","pandas transforms on chunks (state must be merged by you)"],[e.jsx("code",{children:"pq.ParquetFile(path).iter_batches()"}),"one record batch","Parquet: never read a big Parquet file row by row"]]}),e.jsx(u,{children:"Compressed and remote files"}),e.jsx(a,{lang:"py",title:"streaming gzip from S3 with boto3",code:`
import gzip, io, boto3

def s3_lines(bucket, key):
    body = boto3.client("s3").get_object(Bucket=bucket, Key=key)["Body"]   # a StreamingBody, not bytes
    with gzip.GzipFile(fileobj=body) as gz:                                # decompresses as you read
        for raw in io.TextIOWrapper(gz, encoding="utf-8", newline=""):
            yield raw

# Uncompressed objects: body.iter_lines() streams lines; body.iter_chunks() streams bytes.
# Never body.read() on a multi-GB object.`})]}),e.jsxs(t,{num:5,title:"Walkthrough: streaming CSV and JSON Lines",children:[e.jsx(d,{type:"info",title:"The prompt",children:'"We get a daily orders export, around 40 GB of CSV, with a few malformed rows. Compute revenue per city. Then: the click log is JSON Lines; find the first 100 errors quickly."'}),e.jsxs("ol",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Read lazily:"})," iterate the file; never build a list of rows."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Parse with the right tool:"})," ",e.jsx("code",{children:"csv.reader"})," / ",e.jsx("code",{children:"csv.DictReader"})," accept any iterable of lines and handle quoting (",e.jsx("code",{children:'"Delhi, NCR"'}),") and escaped quotes. ",e.jsx("code",{children:'line.split(",")'})," does not."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Validate per row:"})," wrong field count, unparseable numbers, missing keys. Count them, log the line number, write them to a quarantine file. One bad row must not kill a 40 GB run."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Aggregate into small state:"})," a dict of per-city totals is O(distinct cities)."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Stop early when you can:"}),' "first 100 errors" should read only as far as the 100th error.']})]}),e.jsx(c,{title:"100k-row CSV and a JSON Lines stream, processed lazily",code:T.stream,minRows:16}),e.jsx(h,{spec:O.csvrevenue}),e.jsx(h,{spec:O.firsterrors}),e.jsxs("p",{children:["Related Lab problem: ",e.jsx(r,{to:"/python-lab/py-lab-aggregate-in-chunks",children:"aggregate a stream in fixed-size chunks"}),". Deeper parsing (regex log lines, nested JSON flattening, CSV edge cases) is in ",e.jsx(r,{to:"/topics/py-parsing-logs-json",children:"parsing logs and JSON"}),"."]})]}),e.jsxs(t,{num:6,title:"The itertools you actually use",children:[e.jsx(s,{columns:["Tool","What it does","Data-engineering use"],rows:[[e.jsx("code",{children:"islice(it, n)"}),"First n items (or a slice) of any iterator, lazily","head -n, sampling the start, chunking with a loop"],[e.jsx("code",{children:"batched(it, n)"}),"Tuples of n items; last may be shorter (3.12+)","Bulk inserts, API batch calls, multipart uploads"],[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"chain(a, b)"})," / ",e.jsx("code",{children:"chain.from_iterable"})]}),"Concatenate iterables","Read part-00000 ... part-00199 as one stream"],[e.jsx("code",{children:"groupby(it, key)"}),"Runs of consecutive equal keys","State intervals, per-key processing of sorted files"],[e.jsx("code",{children:"accumulate(it)"}),"Running totals (or any binary function)","Cumulative revenue, running max"],[e.jsx("code",{children:"pairwise(it)"}),"Consecutive pairs (3.10+)","Gaps between timestamps, sessionisation"],[e.jsx("code",{children:"tee(it, n)"}),"n independent iterators over one","Rarely: it buffers what one copy has seen and another has not"],[e.jsx("code",{children:"count()"}),"Infinite counter","Line numbers, ids; always pair with islice or zip"]]}),e.jsx(c,{title:"itertools tour, including the groupby and exhausted-iterator traps",code:T.itertools,minRows:14}),e.jsx(h,{spec:O.runs})]}),e.jsxs(t,{num:7,title:"Complexity, and when one process is not enough",children:[e.jsx(s,{columns:["Task over n records","Time","Memory","Streams?"],rows:[["Sum / count / min / max","O(n)","O(1)","Yes"],["Group-by totals","O(n)","O(distinct keys)","Yes, while keys fit in memory"],["Exact distinct count / dedup","O(n)","O(distinct records)","Only if the set fits; else hash-partition to disk or use Spark"],["Top-K","O(n log k)","O(k)","Yes (bounded heap)"],["Exact median / full sort","O(n log n)","O(n)","No: external sort (sorted runs + k-way merge)"],["Approximate distinct / quantiles","O(n)","O(sketch) (KB)","Yes: HyperLogLog, t-digest"]]}),e.jsxs(d,{type:"realworld",title:"Where the single-process approach stops",children:["Streaming fixes memory, not throughput. One Python process parsing CSV manages very roughly tens of MB per second, so 1 TB is many hours. When the deadline matters, parallelise across files (a process pool, one file each), or hand it to Spark, whose",e.jsx("code",{children:" mapPartitions"}),' and readers apply exactly the same "iterator over records" idea across a cluster. See'," ",e.jsx(r,{to:"/topics/py-pandas-vs-pyspark",children:"pandas vs PySpark"})," and ",e.jsx(r,{to:"/topics/py-concurrency-ingestion",children:"concurrency for ingestion"}),"."]})]}),e.jsxs(t,{num:8,title:"Common bugs and what interviewers probe",children:[e.jsxs(d,{type:"danger",title:"Returning a generator from inside a with block",children:["The version on the left closes the file the moment the function returns, so the first ",e.jsx("code",{children:"next()"})," raises",e.jsx("code",{children:" ValueError: I/O operation on closed file"}),". Put the ",e.jsx("code",{children:"yield"})," inside the ",e.jsx("code",{children:"with"})," so the file stays open while the generator is being consumed, and is closed when it finishes.",e.jsx(a,{lang:"py",title:"broken vs fixed",code:`
def rows_broken(path):
    with open(path) as f:
        return (line for line in f)   # file closes on return

def rows_fixed(path):
    with open(path) as f:
        yield from f                  # file stays open while the caller iterates`})]}),e.jsxs(d,{type:"warning",title:"The silently empty second pass",children:[e.jsx("code",{children:"total = sum(gen); count = sum(1 for _ in gen)"})," gives ",e.jsx("code",{children:"count == 0"})," with no error. Compute everything in one pass, or re-open the source. Same trap: ",e.jsx("code",{children:"x in gen"}),", ",e.jsx("code",{children:"any()"})," and ",e.jsx("code",{children:"zip()"})," consume what they read."]}),e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsxs("strong",{children:[e.jsx("code",{children:"list(gen)"}),' "just to debug"']}),", then leaving it in: the whole stream is now in memory. Debug with ",e.jsx("code",{children:"islice(gen, 5)"}),"."]}),e.jsxs("li",{children:[e.jsxs("strong",{children:[e.jsx("code",{children:"groupby"})," on unsorted data"]})," gives repeated groups. It's a run-length grouper, not SQL ",e.jsx("code",{children:"GROUP BY"}),"."]}),e.jsxs("li",{children:[e.jsxs("strong",{children:[e.jsx("code",{children:'line.split(",")'})," on CSV"]})," breaks on quoted commas and embedded newlines. Use the ",e.jsx("code",{children:"csv"})," module with ",e.jsx("code",{children:'newline=""'}),"."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Losing the last record"}),": a chunk reader that never flushes the final partial line, or a batcher that drops the last short batch."]}),e.jsxs("li",{children:[e.jsxs("strong",{children:[e.jsx("code",{children:"except Exception: pass"})," around a whole loop body"]})," hides bugs and silently drops data. Catch the specific error (",e.jsx("code",{children:"ValueError"}),", ",e.jsx("code",{children:"json.JSONDecodeError"}),") and count it."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Assuming gzip is seekable or splittable:"})," you can stream it, but not jump to the middle, so you can't split one big .gz across workers."]})]}),e.jsx(s,{columns:["What they probe","Strong answer"],rows:[['"What is the memory complexity of your solution?"',"O(1) per record + O(state); name the state and its size."],['"The file is on S3."',"Stream the StreamingBody (iter_lines / GzipFile), never .read(); retries on connection resets."],['"Some rows are bad."',"Count, log line numbers, quarantine; decide a threshold that fails the run (e.g. > 1% bad)."],['"How would you test this?"',"The core function takes an iterable of lines, so tests pass a list; no files, no S3. See testable pipeline code."],['"Make it faster."',"Profile first; then parallelise across files with processes, use pyarrow for CSV/Parquet, or move to Spark."],['"Generator vs list comprehension?"',"List when small and reused or indexed; generator when large, streamed or consumed once."]]}),e.jsx(j,{items:[{platform:"aws",body:e.jsxs("p",{children:["Lambda tops out at 10,240 MB of memory and 15 minutes, so a multi-GB object must be streamed from the ",e.jsx("code",{children:"get_object"})," body, never read whole. Use ",e.jsx("code",{children:"/tmp"})," (configurable ephemeral storage) only for spill files. See ",e.jsx(r,{to:"/topics/aws-lambda-for-data",children:"Lambda for data"}),"."]})},{platform:"glue",body:e.jsxs("p",{children:["Glue Python shell jobs are single-process with modest memory, so the same streaming rules apply. Glue Spark jobs parallelise for you, but code inside ",e.jsx("code",{children:"mapPartitions"})," receives an iterator: keep it lazy and yield results instead of building a list per partition."]})},{platform:"oss",body:e.jsxs("p",{children:["In PySpark, ",e.jsx("code",{children:"rdd.mapPartitions(f)"})," and ",e.jsx("code",{children:"DataFrame.mapInPandas"})," hand your function an iterator (of rows, or of pandas batches). Calling ",e.jsx("code",{children:"list()"})," on it pulls the whole partition into Python memory, a common cause of Python worker OOMs."]})}]}),e.jsx(_,{items:[e.jsxs(e.Fragment,{children:["Never materialise a big file: iterate lines (",e.jsx("code",{children:"for line in f"}),") or fixed-size chunks (",e.jsx("code",{children:'iter(lambda: f.read(n), b"")'}),")."]}),e.jsx(e.Fragment,{children:"Generators are lazy and single-use; chain them into read, parse, validate, aggregate stages. Memory = one record + your state."}),e.jsx(e.Fragment,{children:"Chunked reads split records: carry the partial last line to the next chunk and flush it at the end."}),e.jsxs(e.Fragment,{children:["Use ",e.jsx("code",{children:"csv"})," and ",e.jsx("code",{children:"json"})," on the stream; count and quarantine bad rows instead of crashing."]}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"islice"})," for early exit, ",e.jsx("code",{children:"batched"})," for bulk writes, ",e.jsx("code",{children:"groupby"})," for consecutive runs (not SQL GROUP BY), ",e.jsx("code",{children:"chain"})," for many files."]}),e.jsxs(e.Fragment,{children:["Yield inside the ",e.jsx("code",{children:"with"})," block; don't loop a generator twice; when the state or throughput outgrows one process, move to Spark."]})]})]})]})}const We=Object.freeze(Object.defineProperty({__proto__:null,default:ie},Symbol.toStringTag,{value:"Module"})),F={groupby:String.raw`
from collections import defaultdict

orders = [
    # (city, day, amount)
    ("Pune", "2024-05-01", 250.0), ("Delhi", "2024-05-01", 900.0), ("Pune", "2024-05-01", 150.0),
    ("Delhi", "2024-05-02", 300.0), ("Mumbai", "2024-05-02", 1200.0), ("Pune", "2024-05-02", 100.0),
    ("Delhi", "2024-05-02", 30.0), ("Mumbai", "2024-05-01", 400.0), ("Pune", "2024-05-02", 500.0),
]

# 1. What df.groupby("city")["amount"].agg(["count", "sum", "mean"]) does on ONE machine:
#    one pass, one hash table keyed by city.
acc = defaultdict(lambda: [0, 0.0])          # city -> [count, sum]
for city, _, amount in orders:
    acc[city][0] += 1
    acc[city][1] += amount
print("single machine (pandas-style):")
for city in sorted(acc):
    n, s = acc[city]
    print(f"  {city:7} count={n} sum={s:7.1f} mean={s / n:6.1f}")

# 2. What Spark does: each partition pre-aggregates (partial_sum, partial_count) per key,
#    the partials are shuffled by key, then merged. The plan shows HashAggregate -> Exchange -> HashAggregate.
partitions = [orders[0:3], orders[3:6], orders[6:9]]
partials = []
for pid, part in enumerate(partitions):
    p = defaultdict(lambda: [0, 0.0])
    for city, _, amount in part:
        p[city][0] += 1
        p[city][1] += amount
    partials.append(dict(p))
    print(f"partition {pid} partials:", {k: (c, s) for k, (c, s) in sorted(p.items())})

merged = defaultdict(lambda: [0, 0.0])
for p in partials:                            # after the shuffle, all partials of a key meet in one task
    for city, (c, s) in p.items():
        merged[city][0] += c
        merged[city][1] += s
print("merged (same answer):", {k: round(s / c, 1) for k, (c, s) in sorted(merged.items())})

# 3. Why partials carry (sum, count) and not an average:
avg_of_avgs = sum(s / c for p in partials for k, (c, s) in p.items() if k == "Pune") / sum(1 for p in partials if "Pune" in p)
print(f"Pune: true mean {merged['Pune'][1] / merged['Pune'][0]:.1f} vs average of partition averages {avg_of_avgs:.1f}")
`,join:String.raw`
from collections import Counter, defaultdict

orders = [  # (order_id, customer_id, amount)
    (1, "c1", 100), (2, "c2", 250), (3, "c1", 75), (4, None, 60), (5, "c9", 10),
]
customers = [  # (customer_id, city) -- c1 appears twice: a bad dimension load
    ("c1", "Pune"), ("c2", "Delhi"), ("c1", "Pune (old)"), (None, "UNKNOWN"),
]

def hash_join(left, right, how="inner", nulls_match=False):
    # Build a hash table on the smaller side (the "build" side), then stream the other side ("probe").
    index = defaultdict(list)
    for cid, city in right:
        if cid is None and not nulls_match:
            continue                       # SQL and Spark: NULL never equals NULL
        index[cid].append(city)
    out = []
    for oid, cid, amount in left:
        matches = index.get(cid, []) if (cid is not None or nulls_match) else []
        for city in matches:
            out.append((oid, cid, amount, city))
        if not matches and how == "left":
            out.append((oid, cid, amount, None))
    return out

print("inner join (SQL / Spark semantics):")
for row in hash_join(orders, customers):
    print("  ", row)

left = hash_join(orders, customers, how="left")
print(f"\nleft join: {len(orders)} orders in, {len(left)} rows out  <- duplicate key c1 fanned out")
print("revenue before join:", sum(a for _, _, a in orders), " after join:", sum(r[2] for r in left))

print("\nleft join where NULL keys match each other (what pandas.merge does with NaN/None keys):")
for row in hash_join(orders, customers, how="left", nulls_match=True):
    if row[1] is None:
        print("  ", row)

# The guard you want in a pipeline: assert the dimension key is unique before joining.
dupes = [k for k, n in Counter(c for c, _ in customers).items() if n > 1]
print("\nduplicate dimension keys:", dupes)
`,memory:String.raw`
import sys
from array import array

n = 50_000
cities = ["Pune", "Delhi", "Mumbai", "Chennai", "Kolkata"]

def deep_size(obj, seen=None):
    """Approximate memory of an object graph, counting each object once."""
    seen = set() if seen is None else seen
    if id(obj) in seen:
        return 0
    seen.add(id(obj))
    size = sys.getsizeof(obj)
    if isinstance(obj, dict):
        size += sum(deep_size(k, seen) + deep_size(v, seen) for k, v in obj.items())
    elif isinstance(obj, (list, tuple)):
        size += sum(deep_size(x, seen) for x in obj)
    return size

# Row-oriented: a list of dicts (what json.load or csv.DictReader gives you)
# (.encode().decode() makes a new string object per row, as json.loads or csv.reader would)
rows = [{"order_id": i, "city": cities[i % 5].encode().decode(), "amount": i * 1.5} for i in range(n)]

# Column-oriented Python lists (closer to a DataFrame, but still boxed Python objects)
cols = {"order_id": [r["order_id"] for r in rows], "city": [r["city"] for r in rows], "amount": [r["amount"] for r in rows]}

# Column-oriented typed buffers + dictionary-encoded strings (what numpy, Arrow and Parquet do)
city_codes = {c: i for i, c in enumerate(cities)}
typed = {
    "order_id": array("q", (r["order_id"] for r in rows)),       # 8 bytes per value
    "city": array("b", (city_codes[r["city"]] for r in rows)),   # 1 byte per value + a 5-entry dictionary
    "amount": array("d", (r["amount"] for r in rows)),           # 8 bytes per value
}

raw_bytes = sum(len(f"{r['order_id']},{r['city']},{r['amount']}\n") for r in rows)
print(f"{n:,} rows, as CSV text          : {raw_bytes / 1e6:6.2f} MB")
print(f"list of dicts (row objects)       : {deep_size(rows) / 1e6:6.2f} MB")
print(f"dict of Python lists (columns)    : {deep_size(cols) / 1e6:6.2f} MB")
print(f"typed arrays + dictionary encoding: {sum(sys.getsizeof(a) for a in typed.values()) / 1e6:6.2f} MB")
print()
print(f"list of dicts is {deep_size(rows) / raw_bytes:.0f}x the CSV size: every value is a boxed Python object,")
print("and every row repeats its keys. Typed, dictionary-encoded columns are smaller than the CSV text.")
`},R=[{id:"py-pandas-vs-pyspark-group-agg",title:"Implement groupBy().agg() with SQL null rules",prompt:'Write `group_agg(rows, by, aggs)`: the plain-Python core of `df.groupBy(*by).agg(...)`.\n\n- `rows` is a list of dicts, all with the same keys. `by` is a list of column names.\n- `aggs` maps an output name to a tuple `(column, func)`, where `func` is one of `"sum"`, `"count"`, `"mean"`, `"min"`, `"max"`.\n\n**Null rules (Spark / SQL):**\n- `None` values are ignored by every function. `count` counts non-`None` values; the special column `"*"` with `"count"` counts rows, like `COUNT(*)`.\n- If a group has no non-`None` values, `sum`, `mean`, `min` and `max` give `None` and `count` gives `0`.\n- `None` in a `by` column is a group of its own (pandas would drop it by default; Spark keeps it).\n- `mean` is rounded with `round(x, 2)`.\n\nReturn a list of dicts, each with the `by` columns and the output names, sorted by the group key; `None` sorts **before** any other value (Spark\'s default `NULLS FIRST` for ascending order).\n\nExample: `group_agg([{"city": "Pune", "amt": 10}, {"city": "Pune", "amt": None}, {"city": "Delhi", "amt": 5}], ["city"], {"n": ("*", "count"), "total": ("amt", "sum")})` returns `[{"city": "Delhi", "n": 1, "total": 5}, {"city": "Pune", "n": 2, "total": 10}]`.',starter:`def group_agg(rows, by, aggs):
    # your code here
    pass
`,solution:`def group_agg(rows, by, aggs):
    groups = {}
    for row in rows:
        key = tuple(row[c] for c in by)
        groups.setdefault(key, []).append(row)

    def compute(func, values):
        if func == "count":
            return len(values)
        if not values:
            return None
        if func == "sum":
            return sum(values)
        if func == "mean":
            return round(sum(values) / len(values), 2)
        return min(values) if func == "min" else max(values)

    out = []
    for key in sorted(groups, key=lambda k: tuple((v is not None, v) if v is not None else (False, 0) for v in k)):
        members = groups[key]
        rec = dict(zip(by, key))
        for name, (col, func) in aggs.items():
            if col == "*":
                values = members
            else:
                values = [m[col] for m in members if m[col] is not None]
            rec[name] = compute(func, values)
        out.append(rec)
    return out
`,tests:[{call:'group_agg([{"city": "Pune", "amt": 10}, {"city": "Pune", "amt": None}, {"city": "Delhi", "amt": 5}], ["city"], {"n": ("*", "count"), "total": ("amt", "sum")})'},{call:'group_agg([], ["city"], {"n": ("*", "count")})'},{call:'group_agg([{"c": "a", "v": None}, {"c": "a", "v": None}], ["c"], {"s": ("v", "sum"), "m": ("v", "mean"), "lo": ("v", "min"), "k": ("v", "count"), "rows": ("*", "count")})'},{call:'group_agg([{"c": None, "v": 1}, {"c": "b", "v": 2}, {"c": None, "v": 3}, {"c": "a", "v": 4}], ["c"], {"s": ("v", "sum")})'},{call:'group_agg([{"d": "05-01", "c": "Pune", "v": 1}, {"d": "05-01", "c": "Pune", "v": 2}, {"d": "05-01", "c": "Agra", "v": 4}, {"d": "04-30", "c": "Pune", "v": 8}], ["d", "c"], {"avg": ("v", "mean"), "hi": ("v", "max")})'},{call:'group_agg([{"k": 1, "v": 1}, {"k": 1, "v": 2}, {"k": 1, "v": 2}], ["k"], {"mean": ("v", "mean")})'},{call:'group_agg([{"a": None, "b": 2, "v": 0}, {"a": None, "b": None, "v": 5}, {"a": 1, "b": None, "v": None}], ["a", "b"], {"s": ("v", "sum"), "n": ("v", "count")})',hidden:!0},{call:'group_agg([{"k": "x", "v": -3}, {"k": "x", "v": 0}, {"k": "x", "v": 7}], ["k"], {"lo": ("v", "min"), "hi": ("v", "max"), "s": ("v", "sum")})',hidden:!0}],hints:["Build `groups = {}` keyed by `tuple(row[c] for c in by)`. Tuples are hashable and `None` is a fine key.",'For each aggregation, first collect the non-`None` values of the column (or all rows for `"*"`). Then `count` is `len(values)`, and every other function returns `None` when `values` is empty.',"Sorting tuples that contain `None` raises `TypeError`. Sort with a key that maps each part to `(False, 0)` for `None` and `(True, value)` otherwise."],explanation:"Grouping is one pass that fills a hash table: O(n) time and O(n) space for the grouped rows (a streaming version would keep only running `[count, sum, min, max]` per key, which is what Spark's partial aggregation does). Sorting the g groups adds O(g log g).\n\nThe null rules are where pandas and Spark disagree, and interviewers love them:\n\n- `sum` of only nulls is `NULL` in SQL/Spark but `0` in pandas.\n- pandas `groupby` drops `NaN` keys unless you pass `dropna=False`; Spark keeps a `null` group.\n- `COUNT(col)` ignores nulls, `COUNT(*)` does not; pandas `count()` vs `size()` is the same split.\n\nTraps: sorting keys with `None` in them (TypeError in Python 3), treating `0` as missing, and averaging per-partition averages instead of carrying sum and count."},{id:"py-pandas-vs-pyspark-left-join",title:"Left join without the pandas surprises",prompt:'Write `left_join(left, right, on)`: a hash left join of two tables given as lists of dicts.\n\n- Every row in `left` has the same keys, and so does every row in `right` (each is a table with a fixed schema). Both contain the column `on`.\n- For each left row, in order, emit one merged row per matching right row, in right order. If nothing matches, emit the left row once with every right column set to `None`.\n- **Null keys never match** (SQL and Spark semantics), even `None` with `None`.\n- A right column with the same name as a left column (other than `on`) is renamed with the suffix `_right`. The `on` column appears once, with the left value.\n- If `right` is empty there are no right columns: return copies of the left rows.\n\nReturn a list of new dicts; do not modify the inputs.\n\nExample: `left_join([{"id": 1, "v": "a"}, {"id": 2, "v": "b"}], [{"id": 1, "v": "x", "w": 9}], "id")` returns `[{"id": 1, "v": "a", "v_right": "x", "w": 9}, {"id": 2, "v": "b", "v_right": None, "w": None}]`.',starter:`def left_join(left, right, on):
    # your code here
    pass
`,solution:`def left_join(left, right, on):
    if not left:
        return []
    left_cols = set(left[0])
    right_cols = [c for c in right[0] if c != on] if right else []
    rename = {c: (c + "_right" if c in left_cols else c) for c in right_cols}

    index = {}
    for r in right:
        if r[on] is not None:
            index.setdefault(r[on], []).append(r)

    out = []
    for l in left:
        matches = index.get(l[on], []) if l[on] is not None else []
        if not matches:
            row = dict(l)
            for c in right_cols:
                row[rename[c]] = None
            out.append(row)
        for r in matches:
            row = dict(l)
            for c in right_cols:
                row[rename[c]] = r[c]
            out.append(row)
    return out
`,tests:[{call:'left_join([{"id": 1, "v": "a"}, {"id": 2, "v": "b"}], [{"id": 1, "v": "x", "w": 9}], "id")'},{call:'left_join([], [{"id": 1, "x": 1}], "id")'},{call:'left_join([{"id": 1, "amt": 10}], [], "id")'},{call:'left_join([{"cid": "c1", "amt": 100}, {"cid": "c2", "amt": 50}], [{"cid": "c1", "city": "Pune"}, {"cid": "c1", "city": "Pune (old)"}], "cid")'},{call:'left_join([{"k": None, "a": 1}, {"k": 2, "a": 2}], [{"k": None, "b": "null-row"}, {"k": 2, "b": "two"}], "k")'},{call:'(lambda L, R: (left_join(L, R, "id"), L, R))([{"id": 1, "x": 0}], [{"id": 1, "y": 5}])'},{call:'left_join([{"id": 3, "v": 0}], [{"id": 3, "v": None}, {"id": 4, "v": 1}], "id")',hidden:!0},{call:'len(left_join([{"k": 1}] * 30, [{"k": 1, "z": i} for i in range(40)], "k"))',hidden:!0}],hints:["Build `index = {}` from the right side: key to list of right rows. Skip rows whose key is `None`, so a `None` lookup can never find anything.",'Work out the right columns and their output names once, from `right[0]`: rename a column to `name + "_right"` if the left schema already has it.',"For each left row start from `dict(l)` (a copy), then fill in the right columns from each match, or with `None` when there is no match."],explanation:'This is a hash join: build a hash table on one side in O(m), then probe it once per left row. Total O(n + m + output) time and O(m) extra space. Spark does the same thing per partition in a shuffled hash join, or once per executor in a broadcast hash join.\n\nTwo things in the spec are exactly where pandas `merge` surprises people:\n\n- `pandas.merge` matches `NaN`/`None` keys to each other, unlike SQL and Spark. Filter null keys first or you join every unknown customer to every unknown row.\n- Duplicate keys on the right fan out rows (30 x 40 = 1,200 rows in the hidden test), which silently inflates revenue. In pandas, `merge(..., validate="many_to_one")` raises instead.\n\nTraps: mutating the left dicts in place (`l.update(r)`), letting a right column overwrite a left column with the same name, and dropping unmatched left rows.'},{id:"py-pandas-vs-pyspark-pivot",title:"Pivot daily revenue by city",prompt:'Write `pivot_sum(rows, index, columns, values)`: the core of `pivot_table(index=..., columns=..., values=..., aggfunc="sum", fill_value=0)`, or `groupBy(index).pivot(columns).sum(values)` in Spark.\n\n`rows` is a list of dicts. Return a dict with two keys:\n\n- `"columns"`: the distinct values of the `columns` field, sorted ascending\n- `"rows"`: one list per distinct `index` value, sorted ascending by that value: `[index_value, total_for_col1, total_for_col2, ...]`, in the order of `"columns"`\n\nCombinations with no rows get `0`. All index values have the same type, and so do all column values (no `None`s). Values are numbers.\n\nExample: `pivot_sum([{"day": "d1", "city": "Pune", "amt": 5}, {"day": "d1", "city": "Agra", "amt": 2}, {"day": "d2", "city": "Pune", "amt": 1}], "day", "city", "amt")` returns `{"columns": ["Agra", "Pune"], "rows": [["d1", 2, 5], ["d2", 0, 1]]}`.',starter:`def pivot_sum(rows, index, columns, values):
    # your code here
    pass
`,solution:`def pivot_sum(rows, index, columns, values):
    totals = {}
    col_values = set()
    for r in rows:
        i, c = r[index], r[columns]
        col_values.add(c)
        cell = totals.setdefault(i, {})
        cell[c] = cell.get(c, 0) + r[values]
    cols = sorted(col_values)
    return {
        "columns": cols,
        "rows": [[i] + [totals[i].get(c, 0) for c in cols] for i in sorted(totals)],
    }
`,tests:[{call:'pivot_sum([{"day": "d1", "city": "Pune", "amt": 5}, {"day": "d1", "city": "Agra", "amt": 2}, {"day": "d2", "city": "Pune", "amt": 1}], "day", "city", "amt")'},{call:'pivot_sum([], "day", "city", "amt")'},{call:'pivot_sum([{"d": 2, "c": "x", "v": 1}, {"d": 2, "c": "x", "v": 4}, {"d": 1, "c": "y", "v": 3}], "d", "c", "v")'},{call:'pivot_sum([{"m": "2024-02", "ch": "upi", "n": 10}, {"m": "2024-01", "ch": "card", "n": 5}, {"m": "2024-01", "ch": "upi", "n": 7}, {"m": "2024-02", "ch": "cod", "n": 1}], "m", "ch", "n")'},{call:'pivot_sum([{"k": "a", "c": 10, "v": 1}, {"k": "a", "c": 9, "v": 1}, {"k": "a", "c": 10, "v": -1}], "k", "c", "v")',hidden:!0},{call:'pivot_sum([{"k": "z", "c": "p", "v": 2.5}, {"k": "y", "c": "p", "v": 0.5}], "k", "c", "v")',hidden:!0}],hints:["One pass: accumulate `totals[index_value][column_value] += value` with nested dicts, and collect the set of column values as you go.","Sort the column values and the index values at the end, and use `.get(c, 0)` to fill holes."],explanation:'A pivot is a group-by on `(index, column)` followed by reshaping. One pass builds the nested totals in O(n); sorting costs O(r log r + c log c) for r index values and c column values; the output is r x c.\n\nThe columns depend on the data, which is why Spark\'s `pivot()` without an explicit list of values first runs an extra job to collect the distinct values (and caps them at `spark.sql.pivotMaxValues`, default 10,000). Passing the list, as in `.pivot("city", ["Agra", "Pune"])`, skips that job and keeps the output schema stable when a new city appears.\n\nTraps: holes left as missing instead of `0`, column order that changes between runs, and numeric column labels sorted as strings (`10` before `9`).'}],le=`
import pandas as pd

orders = pd.read_parquet("orders/", columns=["order_id", "store_id", "ts", "amount"])
stores = pd.read_parquet("stores.parquet", columns=["store_id", "city"])

daily = (orders
         .query("amount > 0")
         .merge(stores, on="store_id", how="inner", validate="many_to_one")
         .assign(day=lambda d: d["ts"].dt.date)
         .groupby(["day", "city"], as_index=False)
         .agg(orders=("order_id", "count"), revenue=("amount", "sum")))

top3 = (daily.sort_values(["day", "revenue", "city"], ascending=[True, False, True])
             .groupby("day")
             .head(3))

top3.to_parquet("out/top_cities.parquet", index=False)   # runs line by line, all in RAM`,de=`
from pyspark.sql import functions as F, Window

orders = spark.read.parquet("s3://lake/orders/")          # lazy: nothing read yet
stores = spark.read.parquet("s3://lake/stores/")

daily = (orders
         .where(F.col("amount") > 0)                      # pushed into the Parquet scan
         .join(F.broadcast(stores.select("store_id", "city")), "store_id")
         .groupBy(F.to_date("ts").alias("day"), "city")
         .agg(F.count("order_id").alias("orders"), F.sum("amount").alias("revenue")))

w = Window.partitionBy("day").orderBy(F.desc("revenue"), F.asc("city"))
top3 = daily.withColumn("rn", F.row_number().over(w)).where("rn <= 3").drop("rn")

top3.write.mode("overwrite").parquet("s3://lake/marts/top_cities/")   # the action: now it runs`;function ce(){return e.jsxs(e.Fragment,{children:[e.jsxs(t,{num:1,title:"Two libraries, two machines",children:[e.jsxs("p",{children:[e.jsx("strong",{children:"pandas"})," is a DataFrame library for one process: the table lives in that process's memory, and each line of code runs the moment you execute it. ",e.jsx("strong",{children:"PySpark"})," is the Python API of a distributed engine: the table is split into partitions on many executors, your code only builds a plan, and the plan runs when an action asks for a result (see"," ",e.jsx(r,{to:"/topics/lazy-evaluation-dag",children:"Lazy evaluation and the DAG"}),"). The method names overlap a lot. The behaviour does not."]}),e.jsx(s,{columns:["","pandas","PySpark DataFrame"],rows:[["Where data lives","one process, all in RAM","partitions spread over executors; the driver holds the plan"],["When work happens","eagerly, line by line","lazily, at an action (count, show, collect, write)"],["Optimiser","none: you get exactly what you wrote","Catalyst: pushdown, pruning, join selection, AQE"],["Row order and index","has an index; order is stable and meaningful","no index; no order unless you orderBy"],["Mutability",e.jsxs(e.Fragment,{children:["assign in place: ",e.jsx("code",{children:'df["x"] = ...'})]}),"immutable: every transformation returns a new DataFrame"],["Missing values","NaN / None / pd.NA, dtype-dependent","SQL NULL with three-valued logic"],["Comfortable size","up to a few GB (RAM / 5-10)","GB to PB"],["Fixed overhead","milliseconds","seconds to minutes (scheduling, cluster start)"]]}),e.jsxs(d,{type:"interview",title:"The 30-second answer",children:['"pandas is eager, single-machine and in-memory, with an index and row order; PySpark is lazy, distributed and immutable, with an optimiser and no row order. pandas typically needs 5 to 10 times the data size in RAM, so it is great up to a few GB and for small results. Past that, or when the data already lives in the lake, I use Spark. The traps when moving between them are nulls (pandas drops NaN group keys and matches NaN keys in merges), ordering, and ',e.jsx("code",{children:"toPandas()"}),', which collects everything to the driver. In between, DuckDB or Polars on one box, and pandas UDFs or pandas API on Spark when I want pandas logic on a cluster."']})]}),e.jsxs(t,{num:2,title:"pandas essentials, with the PySpark translation",children:[e.jsx("p",{children:"You need about fifteen operations for 90% of pipeline work. Learn them as pairs; most interview questions are one of these rows plus a twist."}),e.jsx(s,{columns:["Operation","pandas","PySpark"],rows:[["Read Parquet, some columns",e.jsx("code",{children:"pd.read_parquet(p, columns=[...])"}),e.jsx("code",{children:"spark.read.parquet(p).select(...)"})],["Filter rows",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"df[df.amount > 0]"})," or ",e.jsx("code",{children:'df.query("amount > 0")'})]}),e.jsx("code",{children:'df.where(F.col("amount") > 0)'})],["New column",e.jsx("code",{children:"df.assign(total=df.qty * df.price)"}),e.jsx("code",{children:'df.withColumn("total", F.col("qty") * F.col("price"))'})],["Conditional",e.jsx("code",{children:"np.where(cond, a, b)"}),e.jsx("code",{children:"F.when(cond, a).otherwise(b)"})],["Group and aggregate",e.jsx("code",{children:'df.groupby("k", as_index=False).agg(n=("id", "count"))'}),e.jsx("code",{children:'df.groupBy("k").agg(F.count("id").alias("n"))'})],["Join",e.jsx("code",{children:'a.merge(b, on="k", how="left")'}),e.jsx("code",{children:'a.join(b, "k", "left")'})],["Sort",e.jsx("code",{children:'df.sort_values(["a", "b"], ascending=[True, False])'}),e.jsx("code",{children:'df.orderBy("a", F.desc("b"))'})],["Distinct / dedup",e.jsx("code",{children:'df.drop_duplicates(["id"], keep="last")'}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:'dropDuplicates(["id"])'}),' (keeps an arbitrary row; use a window for "latest")']})],["Top N per group",e.jsx("code",{children:'df.sort_values(...).groupby("k").head(n)'}),e.jsx("code",{children:'row_number().over(Window.partitionBy("k").orderBy(...))'})],["Running total",e.jsx("code",{children:'df.groupby("k")["v"].cumsum()'}),e.jsx("code",{children:'F.sum("v").over(w.rowsBetween(Window.unboundedPreceding, 0))'})],["Pivot",e.jsx("code",{children:'df.pivot_table(index="i", columns="c", values="v", aggfunc="sum")'}),e.jsx("code",{children:'df.groupBy("i").pivot("c", [...]).sum("v")'})],["Unpivot",e.jsx("code",{children:"df.melt(id_vars=[...])"}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"df.unpivot(...)"})," (Spark 3.4+) or ",e.jsx("code",{children:"stack()"})]})],["Missing values",e.jsx("code",{children:"df.fillna(0)"}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"df.fillna(0)"})," / ",e.jsx("code",{children:"F.coalesce"})]})],["Look at it",e.jsx("code",{children:"df.head()"}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"df.show()"})," (an action), ",e.jsx("code",{children:"df.limit(5).toPandas()"})]})]]}),e.jsxs(d,{type:"warning",title:"Vectorise or pay 100x",children:[e.jsx("code",{children:"df.apply(lambda r: ..., axis=1)"})," calls Python once per row; column arithmetic, ",e.jsx("code",{children:"np.where"})," and ",e.jsx("code",{children:"groupby"}),"aggregations run as C loops over whole columns. It is the same lesson as built-in Spark functions versus Python UDFs (",e.jsx(r,{to:"/topics/python-udfs-arrow",children:"Python UDFs and Arrow"}),")."]})]}),e.jsxs(t,{num:3,title:"The same task in both",children:[e.jsx("p",{children:"Daily orders and revenue per city, keep the top 3 cities per day. Read the two versions side by side: the shape is identical, and every difference is one of the semantics above."}),e.jsxs("div",{className:"grid cols-2",children:[e.jsx(a,{lang:"py",title:"pandas",code:le}),e.jsx(a,{lang:"py",title:"PySpark",code:de})]}),e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Laziness"}),": in Spark the ",e.jsx("code",{children:"where"})," is pushed into the Parquet scan, so filtered row groups are never read. pandas reads everything, then filters."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Join"}),": ",e.jsx("code",{children:'validate="many_to_one"'})," makes pandas raise on duplicate store ids; Spark has no such switch, so check uniqueness as a data-quality step."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Ranking"}),": pandas uses sort order; Spark needs a window with an explicit tie-break, because there is no inherent order."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Dates"}),": ",e.jsx("code",{children:"to_date"})," uses ",e.jsx("code",{children:"spark.sql.session.timeZone"}),"; ",e.jsx("code",{children:"dt.date"})," uses whatever the pandas timestamps hold. Agree on UTC."]})]}),e.jsx(u,{children:"What a group-by really does"}),e.jsxs("p",{children:["Underneath both is a hash aggregate: one pass that keeps a running state per key. pandas does it once, on one machine. Spark does it twice: each partition builds ",e.jsx("em",{children:"partial"})," states, the partials are shuffled by key, and a second pass merges them. That is why Spark's plan shows ",e.jsx("code",{children:"HashAggregate"})," → ",e.jsx("code",{children:"Exchange"})," → ",e.jsx("code",{children:"HashAggregate"}),", and why partial states must be mergeable: a mean travels as (sum, count), never as an average."]}),e.jsx(c,{title:"Group-by: one machine vs partial aggregation",code:F.groupby,minRows:22}),e.jsx(h,{spec:R[0]})]}),e.jsxs(t,{num:4,title:"Joins: merge vs join",children:[e.jsxs("p",{children:["A join builds a hash table on one side and probes it with the other. pandas' ",e.jsx("code",{children:"merge"})," does that in one process; Spark either broadcasts the small side to every executor or shuffles both sides by key (see ",e.jsx(r,{to:"/topics/join-strategies",children:"Join strategies"}),"). The algorithm is the same. Three semantic differences are not."]}),e.jsx(s,{columns:["Behaviour","pandas merge","Spark join"],rows:[["NULL / NaN keys",e.jsx("span",{style:{color:"var(--red)"},children:"match each other"}),"never match (SQL semantics); use eqNullSafe / <=> to match them"],["Duplicate keys",'fan out rows; validate="1:1" / "m:1" raises instead',"fan out rows silently"],["Same column on both sides","suffixes _x / _y","both kept, ambiguous until you alias or drop one"],["Join on index","df.join(other) aligns on the index","no index: always name the columns"],["Which rows matched?","indicator=True adds _merge","left_semi / left_anti joins, or a flag column"]]}),e.jsx(c,{title:"Hash join, fan-out and null keys",code:F.join,minRows:22}),e.jsx(h,{spec:R[1]})]}),e.jsxs(t,{num:5,title:"Reshaping: pivot and melt",children:[e.jsxs("p",{children:["Reports want wide tables (one column per city); storage wants long tables (one row per day and city). ",e.jsx("code",{children:"pivot_table"})," goes long to wide, ",e.jsx("code",{children:"melt"})," goes back. In Spark, ",e.jsx("code",{children:"groupBy(...).pivot(col)"})," needs the distinct values of ",e.jsx("code",{children:"col"})," to build the schema: without an explicit list it runs an extra job to collect them, capped by ",e.jsx("code",{children:"spark.sql.pivotMaxValues"})," (10,000). Pass the list to skip that job and keep the schema stable."]}),e.jsx(J,{tabs:[{label:"pandas",content:e.jsx(a,{lang:"py",code:`
wide = daily.pivot_table(index="day", columns="city", values="revenue",
                         aggfunc="sum", fill_value=0)
long = wide.reset_index().melt(id_vars="day", var_name="city", value_name="revenue")`})},{label:"PySpark",content:e.jsx(a,{lang:"py",code:`
cities = ["Bengaluru", "Delhi", "Mumbai", "Pune"]          # explicit: no extra job, stable schema
wide = daily.groupBy("day").pivot("city", cities).agg(F.sum("revenue")).fillna(0)
long = wide.unpivot("day", cities, "city", "revenue")       # Spark 3.4+; older: selectExpr("stack(...)")`})}]}),e.jsx(h,{spec:R[2]})]}),e.jsxs(t,{num:6,title:"Why pandas stops scaling",children:[e.jsx(q,{note:"Rule of thumb from pandas' creator: have 5 to 10 times as much RAM as the size of your dataset. Strings in object columns push it higher.",children:"RAM needed ≈ (5 to 10) × data size on disk"}),e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Boxed objects"}),": an ",e.jsx("code",{children:"object"})," column stores a pointer to a separate Python string per value, roughly 50 bytes of overhead each."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Wide types"}),": numbers default to 64-bit even when 8 or 32 bits would do."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Copies"}),": many operations return new frames; a chain of five steps can briefly hold several copies."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"One core"}),": most pandas operations are single-threaded, so a 64-core box does not help much."]})]}),e.jsx(c,{title:"Same 50,000 rows, three memory layouts",code:F.memory,minRows:20}),e.jsxs("p",{children:["The typed, dictionary-encoded layout is what numpy, Arrow, Parquet and Spark's Tungsten use, and why ",e.jsx("code",{children:"category"})," dtypes and pyarrow-backed strings (pandas 2.x) shrink frames so much. In order of effort, before leaving pandas:"]}),e.jsx(a,{lang:"py",title:"shrink_pandas.py",code:`
df = pd.read_parquet("events/", columns=["user_id", "city", "amount", "ts"],
                     filters=[("dt", ">=", "2024-05-01")])           # column + partition pruning on disk
df = df.astype({"city": "category", "amount": "float32"})
df.info(memory_usage="deep")                                          # measure, do not guess

# Stream a CSV in chunks; keep only mergeable partial state
totals = {}
for chunk in pd.read_csv("big.csv", usecols=["city", "amount"], dtype={"city": "category"}, chunksize=1_000_000):
    part = chunk.groupby("city", observed=True)["amount"].agg(["sum", "count"])
    for city, row in part.iterrows():
        s, c = totals.get(city, (0.0, 0))
        totals[city] = (s + row["sum"], c + row["count"])
means = {city: s / c for city, (s, c) in totals.items()}`}),e.jsx(I,{width:900,height:260,nodes:[{id:"ex1",label:"Executor 1",sub:"partitions 0-99",x:140,y:60,kind:"worker"},{id:"ex2",label:"Executor 2",sub:"partitions 100-199",x:140,y:140,kind:"worker"},{id:"ex3",label:"Executor N",sub:"... 20 GB in total",x:140,y:220,kind:"worker"},{id:"driver",label:"Driver",sub:"one JVM + one Python",x:470,y:140,kind:"service",color:"#f87171"},{id:"pd",label:"pandas DataFrame",sub:"50-150 GB of objects",x:760,y:140,kind:"db",color:"#f87171"}],edges:[{from:"ex1",to:"driver",label:"collect",animated:!0,color:"#22d3ee"},{from:"ex2",to:"driver",animated:!0,color:"#22d3ee"},{from:"ex3",to:"driver",animated:!0,color:"#22d3ee"},{from:"driver",to:"pd",label:"toPandas()",color:"#f87171"}],caption:"toPandas() is a collect: every partition travels to the single driver, which then builds one pandas frame. Arrow makes the transfer faster, not smaller. spark.driver.maxResultSize (default 1g) is the safety net."})]}),e.jsxs(t,{num:7,title:"Choosing the tool, and bridging them",children:[e.jsx(s,{columns:["Data and need","Good choice","Why"],rows:[["Under ~1-2 GB, exploration, small dims, test fixtures","pandas","fastest to write, huge ecosystem, no cluster"],["A few GB to tens of GB on one box","DuckDB or Polars","columnar, multi-threaded, lazy/streaming, can spill to disk"],["Tens of GB and growing, or joins with lake tables","PySpark DataFrame / Spark SQL","distributed, optimiser, fault tolerance"],["pandas code that must run on big data with few rewrites","pandas API on Spark","pandas syntax, Spark execution; watch index and ordering costs"],["pandas logic per group (a model per store, resampling per device)","applyInPandas / pandas UDFs","real pandas per group on executors, via Arrow"],["Small final result for a plot or an email","Spark, then toPandas() on the aggregate","only the small result crosses to the driver"]]}),e.jsx(a,{lang:"py",title:"bridges.py",code:`
# 1. pandas API on Spark (formerly Koalas, in Spark since 3.2)
import pyspark.pandas as ps
psdf = ps.read_parquet("s3://lake/orders/", index_col="order_id")   # give it a real index
by_city = psdf.groupby("city")["amount"].sum().sort_values(ascending=False)
sdf = psdf.to_spark()                     # and back: sdf.pandas_api()

# 2. Real pandas per group on the executors (each group must fit in one worker)
def detrend(pdf: pd.DataFrame) -> pd.DataFrame:
    pdf = pdf.sort_values("ts")
    pdf["delta"] = pdf["reading"].diff().fillna(0.0)
    return pdf[["device_id", "ts", "delta"]]

out = readings.groupBy("device_id").applyInPandas(detrend, schema="device_id string, ts timestamp, delta double")

# 3. Collect only small results, with Arrow on (off by default in Spark 3.x)
spark.conf.set("spark.sql.execution.arrow.pyspark.enabled", "true")
summary_pdf = daily.groupBy("city").agg(F.sum("revenue").alias("revenue")).toPandas()`}),e.jsx(v,{prosTitle:"pandas API on Spark: good for",consTitle:"pandas API on Spark: watch out for",pros:["Migrating pandas code with few changes","Data scientists already fluent in pandas","Quick distributed exploration in notebooks"],cons:["A default index is generated when you do not give one","Order-dependent ops (iloc, shift, cumsum) can force sorts or single-partition work","Not every pandas function exists or behaves identically"]})]}),e.jsxs(t,{num:8,title:"Pitfalls and what interviewers probe",children:[e.jsx(s,{columns:["Pitfall","What goes wrong","Fix"],rows:[["groupby drops NaN keys","pandas totals are lower than Spark totals by exactly the null rows","groupby(..., dropna=False), or fill keys explicitly"],["merge matches NaN keys","unknown customers join each other, rows multiply","filter null keys before merging"],["int column with NaN","becomes float64; ids print as 1.0e+06","nullable Int64 dtype, or pyarrow dtypes"],["count() vs size()","count ignores NaN, size counts rows","say which you mean (COUNT(col) vs COUNT(*))"],["Chained assignment",'df[df.a > 0]["b"] = 1 may not change df (SettingWithCopyWarning)','df.loc[df.a > 0, "b"] = 1; Copy-on-Write in pandas 3.0'],["Spark row order",'limit/first/dropDuplicates pick "random" rows',"orderBy with a unique tie-breaker, or a window"],["toPandas on big data","driver OOM or maxResultSize error","aggregate first, applyInPandas, or write and read in chunks"],["Average of averages","wrong when groups differ in size","carry sum and count, divide at the end"]]}),e.jsx(d,{type:"interview",title:"What interviewers probe",children:e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Can you translate"})," a pandas snippet to PySpark and say what changes (laziness, order, nulls)?"]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Where is the memory?"})," Why does a 4 GB CSV not fit in 16 GB, and what do you do about it before reaching for a cluster?"]}),e.jsxs("li",{children:[e.jsx("strong",{children:"When is Spark the wrong answer?"})," Small data, tight latency, or a cluster you would have to start for a 2-minute job."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Bridges"}),": toPandas vs applyInPandas vs pandas API on Spark, and what each costs. Deeper Spark side: ",e.jsx(r,{to:"/topics/rdd-dataframe-dataset",children:"RDD, DataFrame and Dataset"})," and the ",e.jsx(r,{to:"/scenarios/driver-oom-collect",children:"driver OOM after collect"})," scenario."]})]})}),e.jsx(j,{items:[{platform:"glue",body:e.jsxs("p",{children:["For small pandas-sized jobs a Glue ",e.jsx("strong",{children:"Python shell"})," job (fractions of a DPU) is far cheaper than a Spark job; the AWS SDK for pandas (awswrangler) reads and writes S3, the Glue catalog, Athena and Redshift as pandas frames. Glue Spark jobs support pandas API on Spark and pandas UDFs on recent Glue versions."]})},{platform:"databricks",body:e.jsxs("p",{children:["pandas API on Spark is available on every runtime; ",e.jsx("code",{children:"spark.sql.execution.arrow.pyspark.enabled"})," and the Arrow batch size control ",e.jsx("code",{children:"toPandas()"})," and ",e.jsx("code",{children:"createDataFrame(pdf)"})," conversion."]})},{platform:"emr",body:e.jsxs("p",{children:["On EMR or EMR Serverless the same APIs apply; ship pandas and pyarrow to executors with a packed virtualenv (",e.jsx("code",{children:"spark.archives"}),") so ",e.jsx("code",{children:"applyInPandas"})," uses the versions you tested with."]})}]})]}),e.jsx(t,{num:9,title:"Key takeaways",children:e.jsx(_,{items:[e.jsx(e.Fragment,{children:"pandas: eager, one machine, in RAM, index and order. PySpark: lazy, distributed, immutable, optimised, unordered."}),e.jsx(e.Fragment,{children:"Learn the operations as pairs (filter, assign/withColumn, groupby/agg, merge/join, top-N via sort/head vs window)."}),e.jsx(e.Fragment,{children:"Null semantics differ: pandas drops NaN group keys and matches NaN join keys; Spark keeps a null group and never joins null to null."}),e.jsx(e.Fragment,{children:"A group-by is a hash aggregate; Spark does it twice (partial, shuffle, final), so partial states must be mergeable: sum and count, not mean."}),e.jsx(e.Fragment,{children:"pandas needs 5-10x the data size in RAM. Prune columns, set dtypes (category, pyarrow strings), read in chunks, or switch to DuckDB/Polars."}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"toPandas()"})," collects to the driver. Use it on small aggregates; use applyInPandas or pandas API on Spark to run pandas logic at scale."]})]})})]})}const Ue=Object.freeze(Object.defineProperty({__proto__:null,default:ce},Symbol.toStringTag,{value:"Module"})),E={regex:String.raw`
import re
from datetime import datetime, timezone

# nginx / Apache "combined" format. Compile once, outside the loop.
LINE = re.compile(
    r'(?P<ip>\S+) \S+ (?P<user>\S+) \[(?P<ts>[^\]]+)\] '
    r'"(?P<method>[A-Z]+) (?P<path>\S+) (?P<proto>[^"]+)" '
    r'(?P<status>\d{3}) (?P<bytes>\d+|-) '
    r'"(?P<referer>[^"]*)" "(?P<agent>[^"]*)"'
)

lines = [
    '203.0.113.9 - - [01/May/2024:10:00:01 +0530] "GET /orders?id=7 HTTP/1.1" 200 512 "-" "curl/8.4"',
    '198.51.100.2 - alice [01/May/2024:10:00:02 +0530] "POST /pay HTTP/2.0" 503 - "https://shop.example/cart" "Mozilla/5.0 (X11; Linux)"',
    'this is not an access log line',
    '203.0.113.9 - - [01/May/2024:10:00:03 +0530] "GET /health HTTP/1.1" 200 2 "-" "kube-probe/1.29"',
]

parsed, bad = [], []
for n, line in enumerate(lines, 1):
    m = LINE.fullmatch(line)
    if m is None:
        bad.append(n)                      # in production: count it and send it to a dead-letter path
        continue
    rec = m.groupdict()
    rec["status"] = int(rec["status"])
    rec["bytes"] = 0 if rec["bytes"] == "-" else int(rec["bytes"])
    # Log time has an offset: convert to UTC once, at parse time
    ts = datetime.strptime(rec["ts"], "%d/%b/%Y:%H:%M:%S %z")
    rec["ts_utc"] = ts.astimezone(timezone.utc).isoformat()
    parsed.append(rec)

for rec in parsed:
    print(rec["ts_utc"], rec["method"], rec["path"], rec["status"], rec["bytes"], "|", rec["agent"])
print("bad line numbers:", bad)

print()
print("match vs search vs fullmatch for r'\\d{3}':")
p = re.compile(r"\d{3}")
for s in ["200", "200 OK", "HTTP 200", "2000"]:
    print(f"  {s!r:12} match={bool(p.match(s))!s:5}  search={bool(p.search(s))!s:5}  fullmatch={bool(p.fullmatch(s))}")

print()
print("greedy vs lazy on a quoted field:")
s = '"GET /a HTTP/1.1" 200 "curl"'
print("  greedy  .*  ->", re.search(r'"(.*)"', s).group(1))
print("  lazy    .*? ->", re.search(r'"(.*?)"', s).group(1))
print("  negated [^\"]* ->", re.search(r'"([^"]*)"', s).group(1))
`,json:String.raw`
import json
from decimal import Decimal

raw = [
    '{"order_id": 1, "amount": 499.90, "user": {"id": 7, "city": "Pune"}}',
    '{"order_id": 2, "amount": 0.1, "tags": ["new", "upi"]}',
    '{"order_id": 3, "amount": 12.5,',                     # truncated by a crashed writer
    '{"order_id": 4, "amount": NaN}',                      # not valid JSON, Python accepts it by default
    '{"order_id": 5, "order_id": 6, "amount": 0.2}',       # duplicate key: the last one silently wins
    '{"order_id": 9007199254740993, "amount": 1}',         # 2**53 + 1: exact in Python, not in JavaScript
    '',                                                    # blank line at the end of the file
]

def reject_constant(name):
    raise ValueError(f"non-standard JSON constant {name}")

good, dead_letter = [], []
for i, line in enumerate(raw):
    try:
        # parse_float=Decimal keeps money exact; parse_constant rejects NaN / Infinity
        doc = json.loads(line, parse_float=Decimal, parse_constant=reject_constant)
    except ValueError as e:                                 # JSONDecodeError is a subclass of ValueError
        dead_letter.append((i, str(e)))
        continue
    good.append(doc)

for d in good:
    print(d)
print()
for i, err in dead_letter:
    print(f"dead letter line {i}: {err}")

print()
print("float sum  :", 0.1 + 0.2)
print("Decimal sum:", sum(d["amount"] for d in good if d["order_id"] in (2, 6)))

# Safe access into nested, optional fields
for d in good:
    city = (d.get("user") or {}).get("city", "unknown")
    print(d["order_id"], "->", city)

# Write JSON Lines back out: one object per line, no pretty printing
print()
note = "café in Bengalūru"                      # non-ASCII text
print(json.dumps({"order_id": 1, "note": note}, separators=(",", ":")))   # default: \u escapes, pure ASCII
print(json.dumps({"order_id": 1, "note": note}, ensure_ascii=False))     # real UTF-8 characters
`,csv:String.raw`
import csv
import io

# A real-world export: BOM, a comma inside quotes, doubled quotes, an embedded newline,
# an empty value and a ragged row.
data = (
    "\ufeffid,name,city,amount\r\n"
    '1,"Sharma, Priya",Pune,100.50\r\n'
    '2,"Rao ""RK"" Kumar",Chennai,\r\n'
    '3,"Line one\nline two",Delhi,75\r\n'
    "4,Ali,Mumbai,20,EXTRA\r\n"
)

print("naive line.split(','):")
for line in data.splitlines()[:4]:
    print("  ", line.split(","))

print()
print("csv module:")
f = io.StringIO(data, newline="")          # with real files: open(path, newline="", encoding="utf-8-sig")
reader = csv.reader(f)
header = next(reader)
print("  header as read:", header)          # note the BOM glued to 'id'
header[0] = header[0].lstrip("\ufeff")      # utf-8-sig does this for you when reading a file

good, bad = [], []
for row in reader:
    if len(row) != len(header):
        bad.append((reader.line_num, row))
        continue
    rec = dict(zip(header, row))
    rec["amount"] = float(rec["amount"]) if rec["amount"] != "" else None   # empty string is not 0
    good.append(rec)

for rec in good:
    print("  ", rec)
print("  ragged rows:", bad)
`},C=[{id:"py-parsing-logs-json-logfmt",title:"Parse a logfmt line",prompt:'Many services log in **logfmt**: `level=error msg="disk full" host=web-1`. Write `parse_logfmt(line)` that returns a dict of key to string value.\n\n- The line is zero or more pairs separated by one or more spaces or tabs. Leading and trailing whitespace is ignored.\n- A pair is `key=value`. A key is one or more letters, digits, `_`, `.` or `-`.\n- A value is either **bare**: zero or more characters that are not whitespace and not `"`, or **quoted**: `"..."`, where inside the quotes a backslash escapes the next character. When unquoting, turn `\\"` into `"` and `\\\\` into `\\`; leave any other backslash as it is.\n- If a key repeats, the last value wins.\n- If the line contains anything that is not a valid pair (a bare word, an unterminated quote, text glued to a closing quote, `=x`), return `None`.\n\nExample: `parse_logfmt(\'level=error msg="disk full" host=web-1\')` returns `{"level": "error", "msg": "disk full", "host": "web-1"}`, and `parse_logfmt("")` returns `{}`.',starter:`import re

def parse_logfmt(line):
    # your code here
    pass
`,solution:String.raw`import re

PAIR = r'[\w.-]+=(?:"(?:[^"\\]|\\.)*"|[^\s"]*)'
WHOLE = re.compile(rf'\s*(?:{PAIR}(?:\s+{PAIR})*)?\s*')
TOKEN = re.compile(r'([\w.-]+)=(?:"((?:[^"\\]|\\.)*)"|([^\s"]*))')

def parse_logfmt(line):
    if not WHOLE.fullmatch(line):
        return None
    out = {}
    for m in TOKEN.finditer(line):
        key, quoted, bare = m.groups()
        if quoted is not None:
            out[key] = re.sub(r'\\(["\\])', r'\1', quoted)
        else:
            out[key] = bare
    return out
`,tests:[{call:String.raw`parse_logfmt('level=error msg="disk full" host=web-1')`},{call:String.raw`parse_logfmt('')`},{call:String.raw`parse_logfmt('  ts=2024-05-01T10:00:00Z\tlevel=info   dur_ms=42  ')`},{call:String.raw`parse_logfmt(r'msg="say \"hi\"" path="C:\\temp\\x" re="a\d"')`},{call:String.raw`parse_logfmt('a= b="" c=1')`},{call:String.raw`parse_logfmt('level=info verbose')`},{call:String.raw`parse_logfmt('msg="unterminated level=info')`},{call:String.raw`parse_logfmt('a="x"b=1')`,hidden:!0},{call:String.raw`parse_logfmt('k=1 k=2 url=/p?a=b&c=d app.version=1.2-rc')`,hidden:!0},{call:String.raw`parse_logfmt('=x a=1')`,hidden:!0}],hints:["Split the job in two: first check that the whole line is valid with one `fullmatch`, then pull the pairs out with `finditer`.",'A quoted value is `"(?:[^"\\\\]|\\\\.)*"`: any run of non-quote, non-backslash characters, or a backslash followed by any character.',"Unescape with `re.sub(r'\\\\([\"\\\\])', r'\\1', value)`, which turns only `\\\"` and `\\\\` back into single characters."],explanation:'Validating the whole line with `fullmatch` first means junk such as a bare word or an unterminated quote can never slip through as a half-parsed record. `finditer` then walks the pairs; because the line is already known to be well formed, every match starts at a real key.\n\nThe quoted-value pattern `"(?:[^"\\\\]|\\\\.)*"` is the standard way to match a string with escapes. It cannot backtrack catastrophically because the two alternatives never match the same character.\n\nTime O(len(line)), space O(number of pairs).\n\nTraps: `line.split(" ")` (breaks on quoted values with spaces), `split("=")` (breaks on values that contain `=`, like URLs), and `re.findall` on the raw line without validating it, which silently accepts `level=info verbose`.'},{id:"py-parsing-logs-json-multiline",title:"Group multi-line log records",prompt:'Application logs often span several lines: a Java stack trace or a pretty-printed payload follows the line that logged it. Write `group_records(lines)` that groups raw lines into records.\n\n- First strip any trailing `\\r` and `\\n` characters from each line (nothing else).\n- A **header** line is exactly: a timestamp `YYYY-MM-DD HH:MM:SS` (digits), one space, a level that is one of `DEBUG`, `INFO`, `WARN`, `ERROR`, one space, then the message (the rest of the line, possibly empty).\n- Every other line, including blank lines, is a **continuation** of the most recent header. Continuation lines before the first header are dropped.\n\nReturn a list of tuples `(timestamp, level, message, extra_lines)` in input order, where `extra_lines` is the list of continuation lines (after stripping the line endings).\n\nExample: `group_records(["2024-05-01 10:00:00 ERROR boom", "  at Foo.bar(Foo.java:3)", "2024-05-01 10:00:01 INFO ok"])` returns `[("2024-05-01 10:00:00", "ERROR", "boom", ["  at Foo.bar(Foo.java:3)"]), ("2024-05-01 10:00:01", "INFO", "ok", [])]`.',starter:`import re

def group_records(lines):
    # your code here
    pass
`,solution:String.raw`import re

HEADER = re.compile(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (DEBUG|INFO|WARN|ERROR) (.*)")

def group_records(lines):
    records = []
    for raw in lines:
        line = raw.rstrip("\r\n")
        m = HEADER.fullmatch(line)
        if m:
            records.append((m.group(1), m.group(2), m.group(3), []))
        elif records:
            records[-1][3].append(line)
    return records
`,tests:[{call:'group_records(["2024-05-01 10:00:00 ERROR boom", "  at Foo.bar(Foo.java:3)", "2024-05-01 10:00:01 INFO ok"])'},{call:"group_records([])"},{call:'group_records(["Traceback (most recent call last):", "  File x", "2024-05-01 10:00:00 WARN slow"])'},{call:String.raw`group_records(["2024-05-01 10:00:00 ERROR failed\r\n", "java.lang.NullPointerException\n", "\tat A.b(A.java:1)\n", "\n", "Caused by: X\n"])`},{call:'group_records(["2024-05-01 10:00:00 FATAL oops", "2024-05-01 10:00:00 INFO "])'},{call:'group_records(["2024-05-01 10:00:00 INFO first", "2024-05-01 10:00:00  INFO double space", "2024-05-01 10:00:00 info lower"])',hidden:!0},{call:'group_records(["2024-5-1 10:00:00 INFO short date", "2024-05-01 10:00:00 DEBUG a=1  b=2  "])',hidden:!0}],hints:["Write one regex for a header line and use `fullmatch`. Everything that does not match is a continuation.","Keep the list of records you are building; a continuation line appends to `records[-1]`. If `records` is empty, drop the line.",'Strip with `rstrip("\\r\\n")`, not `strip()`: leading spaces and tabs in a stack trace are part of the line.'],explanation:"This is a tiny state machine with one piece of state: the record currently open. A header closes the previous record and opens a new one; anything else attaches to the open record. It is O(total characters) time and O(output) space, and it streams: you could yield each record as soon as the next header arrives.\n\nThe same rule is what log shippers call a multiline pattern (Fluent Bit `multiline.parser`, CloudWatch agent `multi_line_start_pattern`, Logstash `multiline` codec). Get it wrong at the shipper and every stack-trace line becomes its own event, which breaks error counts and search.\n\nTraps: `strip()` (destroys indentation), a header regex without `fullmatch` (accepts `FATAL` or a lowercase level), and crashing on orphan lines before the first header."},{id:"py-parsing-logs-json-explode-orders",title:"Explode nested JSON orders into rows",prompt:'Order events arrive as **JSON Lines** (one JSON object per line). Write `explode_orders(lines)` that turns them into flat rows, one per order item, like Spark\'s `explode_outer`.\n\n- Skip a line that is not valid JSON or does not decode to an object (blank lines, `null`, a list, a bare string).\n- For each order, emit one tuple `(order_id, customer_id, sku, qty)` per element of `items`, in order.\n- `order_id` is the order\'s `order_id`; `customer_id` is `customer.id`. Either is `None` if missing or null (including when `customer` itself is missing or null).\n- `sku` and `qty` come from the item; `None` if missing. Keep falsy values such as `0` and `""` as they are.\n- If `items` is missing, null or an empty list, emit **one** row with `sku` and `qty` set to `None`, so the order is not lost.\n\nEvery item is an object, and `customer` is an object or null.\n\nExample: `explode_orders([\'{"order_id": 1, "customer": {"id": 7}, "items": [{"sku": "A", "qty": 2}, {"sku": "B", "qty": 1}]}\'])` returns `[(1, 7, "A", 2), (1, 7, "B", 1)]`.',starter:`import json

def explode_orders(lines):
    # your code here
    pass
`,solution:`import json

def explode_orders(lines):
    rows = []
    for line in lines:
        try:
            doc = json.loads(line)
        except ValueError:              # json.JSONDecodeError subclasses ValueError
            continue
        if not isinstance(doc, dict):
            continue
        order_id = doc.get("order_id")
        customer = doc.get("customer")
        customer_id = customer.get("id") if isinstance(customer, dict) else None
        items = doc.get("items") or []
        if not items:
            rows.append((order_id, customer_id, None, None))
        for item in items:
            rows.append((order_id, customer_id, item.get("sku"), item.get("qty")))
    return rows
`,tests:[{call:`explode_orders(['{"order_id": 1, "customer": {"id": 7}, "items": [{"sku": "A", "qty": 2}, {"sku": "B", "qty": 1}]}'])`},{call:"explode_orders([])"},{call:`explode_orders(['{"order_id": 2, "customer": {"id": 8}, "items": []}', '{"order_id": 3, "customer": null}', '{"order_id": 4, "items": null}'])`},{call:`explode_orders(["", "null", "[1, 2]", '"just a string"', '{"order_id": 5, "items": [{"sku": "C"}]}', '{"order_id": 6,'])`},{call:`explode_orders(['{"order_id": 0, "customer": {"id": 0}, "items": [{"sku": "", "qty": 0}]}'])`},{call:`explode_orders(['{"customer": {"name": "x"}, "items": [{"qty": 3}, {"sku": "D", "qty": 1, "price": 9.5}]}'])`,hidden:!0},{call:`explode_orders(['  {"order_id": 7, "items": [{"sku": "E", "qty": 1}]}  ', '{"order_id": 7, "items": [{"sku": "E", "qty": 1}]}'])`,hidden:!0}],hints:["Wrap `json.loads(line)` in `try/except ValueError` and `continue` on failure. Then check `isinstance(doc, dict)`.",'Read nested optional fields defensively: `customer = doc.get("customer")`, then `customer.get("id") if isinstance(customer, dict) else None`.','`items = doc.get("items") or []` handles missing, null and empty in one go. If it is empty, emit one row with `None` for the item fields.'],explanation:'Each line is parsed independently, so one bad line costs one record, not the file. That is the whole point of JSON Lines over one big JSON array. `dict.get` with an `isinstance` check handles missing and null parents without a chain of `if`s.\n\nEmitting one row with `None` item fields for an order without items is the difference between Spark\'s `explode` (drops the order) and `explode_outer` (keeps it). Choosing the wrong one silently shrinks order counts.\n\nTime O(total characters), space O(rows). Duplicate lines are kept on purpose: deduplication is a separate, explicit step keyed on `order_id`.\n\nTraps: `item.get("qty") or None` (turns `0` into `None`), `doc["customer"]["id"]` (crashes on null), and letting one malformed line raise and fail the whole batch.'}],D={fill:"var(--text)",font:"600 12px Inter, sans-serif"},z={fill:"var(--text-2)",font:"500 11px JetBrains Mono, monospace"};function he(){const y=[{text:"  at Pool.run(Pool.java:88)",header:!1,rec:-1},{text:"2024-05-01 10:00:00 ERROR payment failed",header:!0,rec:0},{text:"java.net.SocketTimeoutException: Read timed out",header:!1,rec:0},{text:"  at Http.read(Http.java:120)",header:!1,rec:0},{text:"2024-05-01 10:00:01 INFO retry ok",header:!0,rec:1},{text:"2024-05-01 10:00:02 WARN slow call 2300ms",header:!0,rec:2},{text:'  {"orderId": 77, "psp": "upi"}',header:!1,rec:2}],o=["var(--violet)","var(--cyan)","var(--pink)"];return e.jsx(N,{caption:"A header line (timestamp + level) opens a record; every other line attaches to the record that is open. The orphan line at the top arrived before any header (the previous file's tail) and is dropped or counted.",children:e.jsx("div",{className:"sim-stage grid-bg",children:e.jsxs("svg",{viewBox:"0 0 820 250",style:{width:"100%",display:"block"},children:[e.jsx("text",{x:16,y:20,style:D,children:"raw lines"}),e.jsx("text",{x:560,y:20,style:D,children:"records"}),y.map((i,m)=>{const f=34+m*30,w=i.rec<0?"var(--red)":o[i.rec];return e.jsxs("g",{children:[e.jsx("rect",{x:16,y:f,width:440,height:24,rx:5,style:{fill:i.header?"rgba(139,92,246,.14)":"rgba(255,255,255,.03)",stroke:w,strokeOpacity:.6}}),e.jsx("text",{x:26,y:f+16,style:{...z,fill:i.header?"var(--text)":"var(--text-2)"},children:i.text}),e.jsx("text",{x:466,y:f+16,style:{...z,fill:w},children:i.rec<0?"orphan":i.header?"header":"continuation"})]},m)}),[{y:64,h:84,label:"ERROR payment failed",extra:"+2 lines"},{y:154,h:24,label:"INFO retry ok",extra:"+0 lines"},{y:184,h:54,label:"WARN slow call 2300ms",extra:"+1 line"}].map((i,m)=>e.jsxs("g",{children:[e.jsx("rect",{x:560,y:i.y,width:244,height:i.h,rx:7,style:{fill:"rgba(52,211,153,.08)",stroke:o[m],strokeWidth:1.4}}),e.jsx("text",{x:572,y:i.y+16,style:{...D,font:"600 11.5px Inter, sans-serif"},children:i.label}),e.jsx("text",{x:572,y:i.y+(i.h>30?34:16),dx:i.h>30?0:160,style:{...z,fill:o[m]},children:i.extra})]},m))]})})})}function pe(){return e.jsxs(e.Fragment,{children:[e.jsxs(t,{num:1,title:"Parsing is where pipelines quietly lose data",children:[e.jsxs("p",{children:["Almost every pipeline starts with text someone else wrote: web server logs, application logs, JSON events from a mobile app, a CSV export from a vendor. ",e.jsx("strong",{children:"Parsing"})," turns each piece of text into a record with named, typed fields. It sounds trivial, and it is where most silent data loss happens: a regex that half-matches, a comma inside a quoted name, a JSON field that is sometimes missing, a time zone nobody converted."]}),e.jsxs("p",{children:["The professional version of parsing has three outputs, not one: ",e.jsx("strong",{children:"good records"}),", ",e.jsx("strong",{children:"rejected records with a reason"}),", and ",e.jsx("strong",{children:"counts"})," that prove nothing was lost (read = accepted + rejected)."]}),e.jsx(I,{width:900,height:290,nodes:[{id:"src",label:"Raw text",sub:"logs, JSONL, CSV",x:100,y:140,kind:"storage"},{id:"parse",label:"Parser",sub:"regex / json / csv",x:330,y:140,kind:"service"},{id:"valid",label:"Validate + type",sub:"schema, UTC, enums",x:540,y:140,kind:"worker"},{id:"good",label:"Clean table",sub:"Parquet / Iceberg",x:780,y:70,kind:"storage"},{id:"dlq",label:"Dead letter",sub:"_rejected/dt=...",x:780,y:160,kind:"storage",color:"#f87171"},{id:"metrics",label:"Metrics",sub:"read / ok / rejected",x:780,y:245,kind:"external"}],edges:[{from:"src",to:"parse",label:"line by line",animated:!0},{from:"parse",to:"valid",animated:!0},{from:"valid",to:"good",label:"ok",animated:!0},{from:"valid",to:"dlq",label:"reason + raw",dashed:!0,color:"#f87171"},{from:"parse",to:"dlq",dashed:!0,color:"#f87171"},{from:"valid",to:"metrics",dashed:!0}],caption:"Every record ends up in exactly one place, and the counts reconcile. A parser that raises on the first bad line, or drops it silently, fails one of those two rules."}),e.jsxs(d,{type:"interview",title:"The 30-second answer",children:['"I parse each record independently with a strict pattern or an explicit schema: a compiled regex with ',e.jsx("code",{children:"fullmatch"})," for log lines,",e.jsx("code",{children:" json.loads"})," per line for JSON Lines, the ",e.jsx("code",{children:"csv"})," module (never ",e.jsx("code",{children:'split(",")'}),") for CSV. I convert types and time zones at the edge, flatten structs and explode arrays deliberately, and route anything that does not fit to a dead-letter location with the reason. I emit read/accepted/rejected counts and alert when the reject rate jumps, because that means the upstream format changed. In Spark I do the same with built-in functions, ",e.jsx("code",{children:"from_json"})," with a schema and ",e.jsx("code",{children:"_corrupt_record"}),', not Python UDFs."']})]}),e.jsxs(t,{num:2,title:"Regex for log lines",children:[e.jsxs("p",{children:["A ",e.jsx("strong",{children:"regular expression"})," describes the shape of a line. For log parsing you need a small subset, and the habits matter more than the syntax: always use raw strings (",e.jsx("code",{children:'r"..."'}),") so backslashes reach the regex engine, compile once outside the loop, name your groups, and validate the whole line."]}),e.jsx(s,{columns:["Piece","Meaning","Log-parsing use"],rows:[[e.jsx("code",{children:"\\S+"}),"one or more non-whitespace characters","a field in a space-separated log: IP, user, path"],[e.jsxs("code",{children:["\\d","{3}"]}),"exactly three digits","HTTP status"],[e.jsx("code",{children:'[^"]*'}),"anything except a quote (negated class)","a quoted field: user agent, referer, message"],[e.jsx("code",{children:"(?P<name>...)"}),"named capture group",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:'m["status"]'})," or ",e.jsx("code",{children:"m.groupdict()"})," instead of positional indexes"]})],[e.jsx("code",{children:"(?:...)"}),"group without capturing",'alternatives such as (?:\\d+|-) for "bytes or dash"'],[e.jsx("code",{children:"a|b"}),"alternation","level names: (DEBUG|INFO|WARN|ERROR)"],[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:".*"})," vs ",e.jsx("code",{children:".*?"})]}),'greedy vs lazy "anything"',"avoid both when a negated class works"],[e.jsx("code",{children:"re.fullmatch"}),"the pattern must cover the whole string","validation: rejects trailing junk and extra fields"]]}),e.jsx(c,{title:"Parse an nginx combined log line",code:E.regex,minRows:20}),e.jsx(u,{children:"match, search, fullmatch"}),e.jsxs("p",{children:[e.jsx("code",{children:"re.match"})," anchors at the start only, ",e.jsx("code",{children:"re.search"})," finds the pattern anywhere, ",e.jsx("code",{children:"re.fullmatch"})," must consume the whole string. The playground shows ",e.jsxs("code",{children:['match(r"\\d',"{3}",'", "2000")']}),' succeeding, which is how a "validated" status column ends up holding ',e.jsx("code",{children:"2000"}),". Use ",e.jsx("code",{children:"fullmatch"})," when validating, ",e.jsx("code",{children:"search"})," when extracting one field from free text."]}),e.jsxs(d,{type:"danger",title:"Catastrophic backtracking",children:["Python's ",e.jsx("code",{children:"re"})," is a backtracking engine. A nested quantifier whose pieces can match the same characters, such as",e.jsx("code",{children:" (\\w+\\s?)+$"}),", has exponentially many ways to split a long line; when the match finally fails, the engine tries them all, and one task sits at 100% CPU with no error. Prefer negated classes (",e.jsx("code",{children:'[^"]*'}),") over ",e.jsx("code",{children:".*"}),", make alternatives mutually exclusive, anchor patterns, cap line length, and on Python 3.11+ use atomic groups ",e.jsx("code",{children:"(?>...)"})," or possessive quantifiers (",e.jsx("code",{children:"++"}),", ",e.jsx("code",{children:"*+"}),"). Spark's Java regex backtracks too."]}),e.jsx(u,{children:"Exercise: logfmt"}),e.jsxs("p",{children:["Many Go and Ruby services log as ",e.jsx("code",{children:"key=value"})," pairs with quoted values. The trick is a two-step parse: validate the whole line, then extract pairs. For the classic space-separated access log, try"," ",e.jsx(r,{to:"/python-lab/py-lab-summarize-access-log",children:"Summarise an access log per endpoint"})," in the Python Lab."]}),e.jsx(h,{spec:C[0]})]}),e.jsxs(t,{num:3,title:"Multi-line records",children:[e.jsxs("p",{children:['A stack trace, a pretty-printed payload or a SQL statement spans several physical lines but is one logical event. Read line by line and you get one "event" per stack frame, which wrecks error counts and search. The fix is a tiny ',e.jsx("strong",{children:"state machine"}),": a line that matches the header pattern opens a new record; any other line is appended to the record that is open."]}),e.jsx(he,{}),e.jsxs("p",{children:[`It streams: a record is complete the moment the next header arrives, so memory is bounded by the largest record, not the file. Log shippers implement exactly this with a "multiline start pattern" (Fluent Bit, the CloudWatch agent's`," ",e.jsx("code",{children:"multi_line_start_pattern"}),", Logstash's multiline codec). Getting the pattern wrong there is a common production incident."]}),e.jsx(h,{spec:C[1]})]}),e.jsxs(t,{num:4,title:"JSON and JSON Lines",children:[e.jsxs("p",{children:[e.jsx("code",{children:"json.loads"})," turns text into dicts, lists, strings, numbers, booleans and ",e.jsx("code",{children:"None"}),". Real event data adds four problems: optional and null fields, nesting, arrays, and type edge cases. And it usually arrives as ",e.jsx("strong",{children:"JSON Lines"})," (also called NDJSON): one object per line, so each line parses independently, a file can be streamed or split across workers, and one corrupt line costs one record."]}),e.jsx(s,{columns:["JSON","Python","Watch out for"],rows:[["object","dict","Duplicate keys: the last one silently wins. Detect with object_pairs_hook."],["array","list","Empty vs missing vs null are three different things to downstream code."],["number with . or e","float","Money: 0.1 + 0.2 != 0.3. Use parse_float=Decimal, or integer paise/cents."],["integer","int (arbitrary precision)","Exact in Python; JavaScript consumers lose precision above 2**53. Spark LongType caps at 2**63 - 1."],["null","None",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:'d.get("x")'})," cannot tell missing from null; use ",e.jsx("code",{children:'"x" in d'})," when it matters."]})],["NaN, Infinity","float (accepted by default!)","Not valid JSON. Reject with parse_constant; json.dumps writes them unless allow_nan=False."]]}),e.jsx(c,{title:"JSON Lines with bad lines, money and big ints",code:E.json,minRows:22}),e.jsx(u,{children:"Flatten structs, explode arrays"}),e.jsxs("p",{children:["Nested ",e.jsx("em",{children:"objects"})," become columns: ",e.jsx("code",{children:"user.geo.city"}),". Nested ",e.jsx("em",{children:"arrays"})," usually become ",e.jsx("em",{children:"rows"}),": one row per order item, with the order's fields repeated. Flattening arrays into ",e.jsx("code",{children:"items.0.sku"}),", ",e.jsx("code",{children:"items.1.sku"})," gives a different schema for every order size, so do it only for small fixed-size arrays. The recursive flattener is a Lab problem:"," ",e.jsx(r,{to:"/python-lab/py-lab-flatten-json",children:"Flatten nested JSON into columns"}),". Here, practise the explode side."]}),e.jsx(h,{spec:C[2]}),e.jsx(u,{children:"The same in PySpark"}),e.jsx(a,{lang:"py",title:"parse_orders.py",code:`
from pyspark.sql import functions as F, types as T

item = T.StructType([T.StructField("sku", T.StringType()), T.StructField("qty", T.IntegerType())])
schema = T.StructType([
    T.StructField("order_id", T.LongType()),
    T.StructField("customer", T.StructType([T.StructField("id", T.LongType())])),
    T.StructField("items", T.ArrayType(item)),
    T.StructField("_corrupt_record", T.StringType()),       # malformed lines land here
])

raw = (spark.read.schema(schema)                            # explicit schema: no inference pass
            .option("mode", "PERMISSIVE")                  # default; FAILFAST / DROPMALFORMED also exist
            .option("columnNameOfCorruptRecord", "_corrupt_record")
            .json("s3://lake/raw/orders/dt=2024-05-01/"))
raw = raw.cache()                                          # Spark refuses queries on only the corrupt column of an uncached raw read

bad = raw.where(F.col("_corrupt_record").isNotNull())
rows = (raw.where(F.col("_corrupt_record").isNull())
           .select("order_id", F.col("customer.id").alias("customer_id"),
                   F.explode_outer("items").alias("item"))  # explode would DROP orders with no items
           .select("order_id", "customer_id", "item.sku", "item.qty"))

# JSON stored as a string column inside another table:
events = events.withColumn("payload", F.from_json("payload_json", schema))
one_field = events.select(F.get_json_object("payload_json", "$.customer.id").alias("cid"))`})]}),e.jsxs(t,{num:5,title:"CSV edge cases",children:[e.jsxs("p",{children:['CSV looks like "split on commas" until the first customer named ',e.jsx("code",{children:"Sharma, Priya"}),". RFC 4180 rules: a field may be quoted; inside quotes a comma or a line break is data; a quote inside quotes is written twice (",e.jsx("code",{children:'""'}),"). Add the real-world extras: a byte-order mark (BOM) at the start of Excel exports, ",e.jsx("code",{children:"\\r\\n"}),' line endings, ragged rows, and empty strings that mean "unknown" rather than zero.']}),e.jsx(c,{title:"Naive split vs the csv module",code:E.csv,minRows:20}),e.jsx(s,{columns:["Problem","Python","Spark CSV reader"],rows:[["Comma inside quotes",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"csv.reader"})," handles it"]}),'handled (quote defaults to ")'],['Doubled quote ""',"handled (doublequote=True)",e.jsxs(e.Fragment,{children:["default escape is backslash: set ",e.jsx("code",{children:`.option("escape", '"')`})]})],["Newline inside a quoted field",e.jsxs(e.Fragment,{children:["open with ",e.jsx("code",{children:'newline=""'})]}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"multiLine=true"})," (each file becomes one split)"]})],["BOM at the start",e.jsx(e.Fragment,{children:e.jsx("code",{children:'encoding="utf-8-sig"'})}),"check the first column name; strip \\ufeff"],["Ragged rows","compare len(row) with the header","mode PERMISSIVE + _corrupt_record, or FAILFAST"],["Huge field (over 128 KB)",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"csv.field_size_limit()"})," raises the 131,072 default"]}),"maxCharsPerColumn (default -1, unlimited)"],["Types","everything is a str: convert explicitly",e.jsxs(e.Fragment,{children:["explicit schema; never ",e.jsx("code",{children:"inferSchema"})," in production"]})]]}),e.jsx(v,{prosTitle:"Good habits",consTitle:"Habits that lose rows",pros:[e.jsxs(e.Fragment,{children:["Open files with ",e.jsx("code",{children:'newline=""'})," and an explicit encoding."]}),e.jsxs(e.Fragment,{children:["Treat ",e.jsx("code",{children:'""'})," as NULL deliberately, per column, and document it."]}),e.jsx(e.Fragment,{children:"Reconcile row counts against the producer's manifest or trailer record."})],cons:[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:'line.split(",")'})," or reading line by line before CSV parsing."]}),e.jsxs(e.Fragment,{children:["Letting ",e.jsx("code",{children:"inferSchema"})," decide that an id column is an int until the day it is not."]}),e.jsxs(e.Fragment,{children:["Converting ",e.jsx("code",{children:'""'})," to ",e.jsx("code",{children:"0"})," in an amount column."]})]})]}),e.jsxs(t,{num:6,title:"Bad records: validate, quarantine, count",children:[e.jsxs("p",{children:['Parsing and validation are different steps. Parsing answers "can I read it?"; validation answers "is it a record I accept?": required fields present, types right, enums known, timestamps in a sane range and converted to UTC. Both feed the same dead-letter path. A small, pure function makes this testable (see ',e.jsx(r,{to:"/topics/py-testable-pipeline-code",children:"Testable pipeline code"}),"), and the Lab has a full schema validator: ",e.jsx(r,{to:"/python-lab/py-lab-validate-records",children:"Validate records against a schema"}),"."]}),e.jsx(a,{lang:"py",title:"parse_with_dead_letter.py",code:`
import json
from datetime import datetime, timezone

LEVELS = {"DEBUG", "INFO", "WARN", "ERROR"}

def parse_event(line: str):
    """Return ("ok", record) or ("rejected", reason). Never raises."""
    try:
        doc = json.loads(line)
    except ValueError as e:
        return "rejected", f"json: {e.msg}"
    if not isinstance(doc, dict):
        return "rejected", "not an object"
    if doc.get("level") not in LEVELS:
        return "rejected", f"level: {doc.get('level')!r}"
    try:
        ts = datetime.fromisoformat(doc["ts"])          # accepts 'Z' since Python 3.11
    except (KeyError, TypeError, ValueError):
        return "rejected", "ts: missing or not ISO 8601"
    if ts.tzinfo is None:
        return "rejected", "ts: no UTC offset"
    doc["ts"] = ts.astimezone(timezone.utc).isoformat()
    return "ok", doc

def run(lines, write_ok, write_rejected, max_reject_rate=0.01):
    read = ok = rejected = 0
    for n, line in enumerate(lines, 1):
        read += 1
        status, value = parse_event(line)
        if status == "ok":
            ok += 1
            write_ok(value)
        else:
            rejected += 1
            write_rejected({"line_no": n, "reason": value, "raw": line[:10_000]})
    assert read == ok + rejected
    if read and rejected / read > max_reject_rate:
        raise RuntimeError(f"reject rate {rejected / read:.2%} above {max_reject_rate:.0%}: upstream format change?")
    return {"read": read, "ok": ok, "rejected": rejected}`}),e.jsx(H,{steps:[{title:"Never crash on one record",body:e.jsx("p",{children:"Return a rejection instead of raising. One bad line out of 200 million should cost one line."})},{title:"Keep the evidence",body:e.jsx("p",{children:"Store the raw text (truncated), the reason, the source file and line number, partitioned like the good data so you can replay a day."})},{title:"Count and threshold",body:e.jsx("p",{children:"read = ok + rejected, every run. Warn above the usual baseline; block publishing above a hard limit, because a jump means the format changed."})},{title:"Replay idempotently",body:e.jsx("p",{children:"After fixing the parser, re-parse the rejected partitions and merge by event id, so a replay never creates duplicates."})}]})]}),e.jsxs(t,{num:7,title:"Performance and scale",children:[e.jsx(s,{columns:["Task","Fast path in Python","Cost","In Spark"],rows:[["Fixed-position or simple fields",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"line.split()"}),", ",e.jsx("code",{children:"str.partition"})]}),"O(len) and very fast, cannot backtrack",e.jsx("code",{children:"split"})],["Structured log line","one compiled regex, fullmatch","O(len) for a well-formed pattern",e.jsx("code",{children:"regexp_extract"})],["JSON Lines",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"json.loads"})," per line (orjson, third-party, is often several times faster)"]}),"O(len); allocates many small objects",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"spark.read.json"})," with a schema, ",e.jsx("code",{children:"from_json"})]})],["One field from a big JSON string",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"json.loads"})," then index"]}),"parses everything anyway",e.jsx(e.Fragment,{children:e.jsx("code",{children:"get_json_object"})})],["CSV",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"csv.reader"})," (C implementation)"]}),"O(len)",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"spark.read.csv"})," with a schema"]})],["Huge file","iterate the file object line by line; never read() it all","O(1) memory per line","splittable files of ~128 MB-1 GB"]]}),e.jsxs("p",{children:["Two rules carry most of the speed. First, ",e.jsx("strong",{children:"stream"}),": iterate lines lazily so memory stays flat however big the file is (",e.jsx(r,{to:"/topics/py-generators-large-files",children:"Generators and large files"}),"). Second, ",e.jsx("strong",{children:"parse once"}),": land the typed result as Parquet or Iceberg partitioned by date, and point every downstream job at that, not at the raw text."]}),e.jsxs(d,{type:"warning",title:"Do not parse with Python UDFs in Spark",children:[e.jsx("code",{children:"json.loads"})," or ",e.jsx("code",{children:"re"})," inside a Python UDF serialises every row to a Python worker and back. ",e.jsx("code",{children:"from_json"}),",",e.jsx("code",{children:" get_json_object"}),", ",e.jsx("code",{children:"regexp_extract"})," and ",e.jsx("code",{children:"split"})," run inside the JVM. If you really need Python, use a pandas UDF with Arrow; see ",e.jsx(r,{to:"/topics/python-udfs-arrow",children:"Python UDFs and Arrow"}),". Also remember a single ",e.jsx("code",{children:".gz"})," file is not splittable: one 10 GB gzip file is one task."]})]}),e.jsxs(t,{num:8,title:"Pitfalls and what interviewers probe",children:[e.jsx(s,{columns:["Pitfall","Why it bites","Fix"],rows:[[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"re.match"})," for validation"]}),'accepts trailing junk ("2000" as a status)',e.jsx("code",{children:"re.fullmatch"})],[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"if not value"})," to detect missing"]}),e.jsxs(e.Fragment,{children:["drops ",e.jsx("code",{children:"0"}),", ",e.jsx("code",{children:"False"}),", ",e.jsx("code",{children:'""'})]}),e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"is None"})," or ",e.jsx("code",{children:'"key" in d'})]})],[e.jsx(e.Fragment,{children:e.jsx("code",{children:'doc["a"]["b"]'})}),"KeyError / TypeError on missing or null parents",e.jsx(e.Fragment,{children:e.jsxs("code",{children:['(doc.get("a") or ',"{}",').get("b")']})})],["Floats for money","0.1 + 0.2 = 0.30000000000000004","parse_float=Decimal or integer paise"],["Naive timestamps","local time of whichever machine parsed it","require an offset; convert to UTC at parse time"],[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"explode"})," instead of ",e.jsx("code",{children:"explode_outer"})]}),"orders with empty items vanish","explode_outer, then count parents before and after"],[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"regexp_extract"})," no-match"]}),'returns "" not NULL, so null checks pass','nullif / when(x == "", None)'],["try / except: pass","silent loss; counts no longer reconcile","dead letter + metrics"]]}),e.jsx(d,{type:"interview",title:"What interviewers probe",children:e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Edge cases first"}),': before coding, ask about quoting, missing fields, encodings and what to do with bad rows. Saying "skip and count" unprompted is a strong signal.']}),e.jsxs("li",{children:[e.jsx("strong",{children:"Complexity"}),": one pass, O(total characters), memory O(distinct keys) or O(1) when streaming."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Scale-up"}),': "now it is 2 TB": built-in Spark functions, explicit schema, splittable files, parse once to Parquet.']}),e.jsxs("li",{children:[e.jsx("strong",{children:"Correctness under change"}),": what happens when a field is added, renamed or changes type, and how you would notice."]})]})}),e.jsx(j,{items:[{platform:"aws",body:e.jsxs("p",{children:["Athena reads logs in place with the Regex SerDe or the OpenX JSON SerDe; CloudWatch Logs Insights has a ",e.jsx("code",{children:"parse"})," command with glob or regex patterns for ad-hoc work. For heavy, repeated queries, convert to Parquet once."]})},{platform:"glue",body:e.jsxs("p",{children:["Glue crawlers support custom ",e.jsx("strong",{children:"grok"})," classifiers for log formats. In Glue ETL, ",e.jsx("code",{children:"DynamicFrame"})," keeps records it cannot parse as error records you can inspect with ",e.jsx("code",{children:"errorsAsDynamicFrame()"}),"."]})},{platform:"databricks",body:e.jsxs("p",{children:["Besides ",e.jsx("code",{children:"_corrupt_record"}),", Databricks offers a ",e.jsx("code",{children:"badRecordsPath"})," option for file sources that writes unparseable records and files to a path as JSON, and Auto Loader adds a ",e.jsx("code",{children:"_rescued_data"})," column for fields that do not match the schema."]})}]})]}),e.jsx(t,{num:9,title:"Key takeaways",children:e.jsx(_,{items:[e.jsx(e.Fragment,{children:"Every record ends in exactly one place, good table or dead letter with a reason, and read = accepted + rejected every run."}),e.jsxs(e.Fragment,{children:["Regex: raw strings, compile once, named groups, ",e.jsx("code",{children:"fullmatch"})," for validation, negated classes instead of ",e.jsx("code",{children:".*"})," to avoid catastrophic backtracking."]}),e.jsx(e.Fragment,{children:"Multi-line logs need a header pattern and a tiny state machine; the same pattern configures your log shipper."}),e.jsx(e.Fragment,{children:"JSON Lines parse per line. Read optional nested fields defensively, keep money exact, reject NaN, and know missing vs null."}),e.jsxs(e.Fragment,{children:["Structs flatten into columns; arrays explode into rows. ",e.jsx("code",{children:"explode_outer"})," keeps parents with empty arrays."]}),e.jsxs(e.Fragment,{children:["CSV: use the ",e.jsx("code",{children:"csv"})," module with ",e.jsx("code",{children:'newline=""'}),"; in Spark set ",e.jsx("code",{children:"escape"})," and ",e.jsx("code",{children:"multiLine"})," for RFC 4180 files and always pass a schema."]}),e.jsx(e.Fragment,{children:"At scale: built-in Spark functions, not Python UDFs; splittable files; parse once to Parquet."})]})})]})}const Ge=Object.freeze(Object.defineProperty({__proto__:null,default:pe},Symbol.toStringTag,{value:"Module"})),B={runner:String.raw`
# A pure transformation: data in, data out. No S3, no Spark, no clock, no globals.
def clean_orders(rows):
    out = []
    for r in rows:
        if r.get("order_id") is None:
            continue                                   # quarantine in real life
        status = (r.get("status") or "").strip().lower()
        amount = r.get("amount")
        out.append({
            "order_id": int(r["order_id"]),
            "status": status or "unknown",
            "amount_paise": round(float(amount) * 100) if amount not in (None, "") else None,
        })
    return out

# Tests are just functions that assert. This is all pytest needs too.
def test_drops_rows_without_id():
    assert clean_orders([{"order_id": None}, {"order_id": "7"}])[0]["order_id"] == 7

def test_normalises_status():
    assert clean_orders([{"order_id": 1, "status": "  PAID "}])[0]["status"] == "paid"

def test_blank_amount_is_null_not_zero():
    assert clean_orders([{"order_id": 1, "amount": ""}])[0]["amount_paise"] is None

def test_money_is_exact_in_paise():
    # 0.29 * 100 == 28.999999999999996 in floating point; round() saves us
    assert clean_orders([{"order_id": 1, "amount": "0.29"}])[0]["amount_paise"] == 29

def test_empty_status_becomes_unknown():
    got = clean_orders([{"order_id": 1, "status": None}])
    assert got == [{"order_id": 1, "status": "unknown", "amount_paise": None}], got

def test_non_numeric_id_is_quarantined():
    # This test FAILS: it found a real bug, int("x1") crashes the whole batch.
    # Fix clean_orders (skip ids that are not digits) and run again.
    assert clean_orders([{"order_id": "x1"}]) == [], "ids like 'x1' should be quarantined"

# A 15-line test runner: discover test_* functions, run each, report.
def run_tests(namespace):
    passed = failed = 0
    for name, fn in sorted(namespace.items()):
        if not (name.startswith("test_") and callable(fn)):
            continue
        try:
            fn()
            passed += 1
            print(f"PASS {name}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {name}: {e}")
        except Exception as e:                         # an unexpected exception also fails the test
            failed += 1
            print(f"FAIL {name}: raised {type(e).__name__}: {e}")
    print(f"\n{passed} passed, {failed} failed")

run_tests(dict(globals()))
`,fakes:String.raw`
from datetime import datetime, timezone

# Production code depends on an interface, not on boto3 directly.
def new_object_keys(s3, bucket, prefix, since):
    """Keys under prefix modified after 'since', following continuation tokens."""
    keys, token = [], None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []):
            if obj["LastModified"] > since:
                keys.append(obj["Key"])
        if not resp.get("IsTruncated"):
            return sorted(keys)
        token = resp["NextContinuationToken"]

# A hand-written fake: same method name and response shape as boto3's S3 client.
class FakeS3:
    def __init__(self, objects, page_size=2):
        self.objects = sorted(objects, key=lambda o: o["Key"])
        self.page_size = page_size
        self.calls = []                                 # record calls so tests can assert on them

    def list_objects_v2(self, Bucket, Prefix, ContinuationToken=None):
        self.calls.append((Bucket, Prefix, ContinuationToken))
        matching = [o for o in self.objects if o["Key"].startswith(Prefix)]
        start = int(ContinuationToken or 0)
        page = matching[start:start + self.page_size]
        resp = {"Contents": page, "IsTruncated": start + self.page_size < len(matching)}
        if resp["IsTruncated"]:
            resp["NextContinuationToken"] = str(start + self.page_size)
        return resp

def ts(day):
    return datetime(2024, 5, day, tzinfo=timezone.utc)

fake = FakeS3([
    {"Key": "raw/orders/a.json", "LastModified": ts(1)},
    {"Key": "raw/orders/b.json", "LastModified": ts(3)},
    {"Key": "raw/orders/c.json", "LastModified": ts(4)},
    {"Key": "raw/users/u.json", "LastModified": ts(5)},
    {"Key": "raw/orders/d.json", "LastModified": ts(2)},
])

got = new_object_keys(fake, "lake", "raw/orders/", since=ts(2))
print("new keys:", got)
print("calls   :", fake.calls)
assert got == ["raw/orders/b.json", "raw/orders/c.json"]
assert len(fake.calls) == 2, "4 matching objects with page size 2 means exactly 2 calls"
print("both assertions passed: pagination and the time filter are tested without AWS")
`,types:String.raw`
from dataclasses import dataclass, field
from typing import Protocol

@dataclass(frozen=True)
class Order:
    order_id: int
    city: str
    amount_paise: int
    tags: tuple[str, ...] = field(default=())

    def __post_init__(self):
        # Type hints are NOT checked at runtime. Validate what matters yourself.
        if not isinstance(self.order_id, int) or self.order_id <= 0:
            raise ValueError(f"bad order_id {self.order_id!r}")
        if self.amount_paise < 0:
            raise ValueError("amount must be >= 0")

class Sink(Protocol):
    def write(self, rows: list[Order]) -> int: ...

class ListSink:                       # satisfies Sink structurally, no inheritance needed
    def __init__(self) -> None:
        self.rows: list[Order] = []
    def write(self, rows: list[Order]) -> int:
        self.rows.extend(rows)
        return len(rows)

def load(rows: list[Order], sink: Sink) -> int:
    return sink.write(rows)

sink = ListSink()
print("written:", load([Order(1, "Pune", 49900), Order(2, "Delhi", 100, ("upi",))], sink))
print(sink.rows[1])

# Hints are documentation for humans and tools (mypy, pyright), not runtime checks:
o = Order(3, city=42, amount_paise=10)          # city should be str; Python does not care
print("city is", type(o.city).__name__, "<- mypy would flag this line, the interpreter does not")

for bad in [dict(order_id=0, city="Pune", amount_paise=1), dict(order_id=4, city="Pune", amount_paise=-5)]:
    try:
        Order(**bad)
    except ValueError as e:
        print("rejected:", e)

try:
    sink.rows[0].city = "Mumbai"
except Exception as e:
    print("frozen dataclass:", type(e).__name__)
`},L=[{id:"py-testable-pipeline-code-normalize-phone",title:"Normalise Indian mobile numbers",prompt:'A customer table has phone numbers typed by humans. Write a small, pure, well-tested helper `normalize_phone(raw)` that returns the number in E.164 form `+91XXXXXXXXXX`, or `None` if it is not a valid Indian mobile number.\n\n- `raw` is a string or `None` (`None` gives `None`).\n- First remove all whitespace, hyphens `-`, dots `.` and parentheses `(` `)`.\n- What is left must be an optional prefix `+91`, `91` or `0`, followed by exactly **10 digits** (`0-9`) whose first digit is `6`, `7`, `8` or `9`.\n- Anything else (letters, a different country code, the wrong length, a first digit of 0-5) gives `None`.\n\nExamples: `normalize_phone("98765 43210")` and `normalize_phone("+91-98765-43210")` both return `"+919876543210"`; `normalize_phone("12345 67890")` returns `None`.',starter:`import re

def normalize_phone(raw):
    # your code here
    pass
`,solution:String.raw`import re

STRIP = re.compile(r"[\s\-.()]")
VALID = re.compile(r"(?:\+91|91|0)?([6-9][0-9]{9})")

def normalize_phone(raw):
    if raw is None:
        return None
    m = VALID.fullmatch(STRIP.sub("", raw))
    return "+91" + m.group(1) if m else None
`,tests:[{call:'normalize_phone("98765 43210")'},{call:'normalize_phone("+91-98765-43210")'},{call:'normalize_phone("098765 43210")'},{call:'normalize_phone("(+91) 98765.43210")'},{call:'normalize_phone("12345 67890")'},{call:"normalize_phone(None)"},{call:'normalize_phone("")'},{call:'normalize_phone("+91 98765 4321O")'},{call:'normalize_phone("+1 415 555 0100")'},{call:'normalize_phone("9123456789")',hidden:!0},{call:'normalize_phone("91 91234 56789")',hidden:!0},{call:'normalize_phone("+9198765432100")',hidden:!0},{call:'normalize_phone("\\t+91 70000 00000\\n")',hidden:!0}],hints:['Two steps: strip the separators with `re.sub(r"[\\s\\-.()]", "", raw)`, then validate what is left with one `fullmatch`.',"The pattern is an optional prefix then the 10 digits: `(?:\\+91|91|0)?([6-9][0-9]{9})`. Capture the 10 digits and prepend `+91`.","Watch `9123456789`: it is 10 digits starting with 9, not the prefix `91` plus 8 digits. `fullmatch` backtracks and gets this right."],explanation:"Normalising to one canonical form (E.164) at ingestion is what makes joins and dedup on phone numbers work later. Because the function is pure, every rule is one line in a pytest `parametrize` table: input, expected output. Edge cases like `9123456789` are exactly what that table is for.\n\nTime O(len(raw)), space O(len(raw)).\n\nTraps: using `\\d` (also matches non-ASCII digits such as Devanagari numerals, so prefer `[0-9]` for validation), `re.match` without an end anchor (accepts trailing junk), and stripping the leading `91` from every number, which corrupts real numbers that begin with 91."},{id:"py-testable-pipeline-code-partition-path",title:"UTC partition path from an event timestamp",prompt:'Write `partition_path(base, table, event_time)` that returns the S3 prefix an event belongs to, partitioned by **UTC** date and hour: `<base>/<table>/dt=YYYY-MM-DD/hr=HH/`.\n\n- `event_time` is an ISO 8601 string such as `"2024-05-01T02:30:00+05:30"` or `"2024-05-01T10:00:00Z"`. Parse it with `datetime.fromisoformat`.\n- Convert to UTC before taking the date and hour.\n- Return `None` if `event_time` is not a string `fromisoformat` can parse, or if it has **no UTC offset** (a naive time is ambiguous; never guess).\n- `base` may or may not end with `/`; the result has exactly one `/` between parts and ends with `/`.\n\nExample: `partition_path("s3://lake/raw", "orders", "2024-05-01T02:30:00+05:30")` returns `"s3://lake/raw/orders/dt=2024-04-30/hr=21/"`.',starter:`from datetime import datetime, timezone

def partition_path(base, table, event_time):
    # your code here
    pass
`,solution:`from datetime import datetime, timezone

def partition_path(base, table, event_time):
    try:
        ts = datetime.fromisoformat(event_time)
    except (TypeError, ValueError):
        return None
    if ts.tzinfo is None or ts.utcoffset() is None:
        return None
    u = ts.astimezone(timezone.utc)
    return f"{base.rstrip('/')}/{table}/dt={u:%Y-%m-%d}/hr={u:%H}/"
`,tests:[{call:'partition_path("s3://lake/raw", "orders", "2024-05-01T02:30:00+05:30")'},{call:'partition_path("s3://lake/raw/", "orders", "2024-05-01T10:00:00Z")'},{call:'partition_path("s3://lake/raw", "orders", "2025-01-01T03:00:00+05:30")'},{call:'partition_path("s3://lake/raw", "clicks", "2024-03-10T01:30:00-08:00")'},{call:'partition_path("s3://lake/raw", "orders", "2024-05-01T10:00:00")'},{call:'partition_path("s3://lake/raw", "orders", "yesterday")'},{call:'partition_path("s3://lake/raw", "orders", "2024-02-29T23:00:00-02:00")'},{call:'partition_path("s3://lake/raw", "orders", None)',hidden:!0},{call:'partition_path("s3://lake/raw//", "orders", "2024-05-01T23:59:59.999999+00:00")',hidden:!0},{call:'partition_path("s3://lake/raw", "orders", "2024-13-01T00:00:00Z")',hidden:!0}],hints:["Wrap `datetime.fromisoformat(event_time)` in `try/except (TypeError, ValueError)`: `None` raises `TypeError`, a bad string raises `ValueError`.","A parsed datetime with `tzinfo is None` is naive: return `None`. Otherwise `ts.astimezone(timezone.utc)`.",'Format with `f"{u:%Y-%m-%d}"` and `f"{u:%H}"`, and join with `base.rstrip("/")`.'],explanation:'Partitioning by the **UTC** hour of the event, not the local hour and not the processing time, is what makes reruns and backfills land in the same place. An event at 02:30 IST belongs to the previous UTC day; getting this wrong splits a day across two partitions and breaks daily reconciliation.\n\nBecause the function takes the timestamp as an argument instead of calling `datetime.now()`, every edge case (year boundary, leap day, negative offsets) is a one-line test with no clock mocking.\n\nTime and space O(1).\n\nTraps: treating naive timestamps as local time of the machine (it differs between your laptop and the Glue worker), `ts.replace(tzinfo=timezone.utc)` (relabels instead of converting), and `strftime("%Y-%m-%d")` on the original, unconverted time.'},{id:"py-testable-pipeline-code-idempotent-upsert",title:"An idempotent, side-effect-free upsert",prompt:'Write `upsert(target, batch, key)`, the in-memory model of a `MERGE` into a table:\n\n- `target` is a list of dicts with unique values in the `key` field. `batch` is a list of dicts that may repeat keys.\n- A batch row **replaces** the whole target row with the same key; a new key is inserted. If a key repeats inside the batch, the **last** occurrence wins.\n- Batch rows whose key is missing or `None` are skipped.\n- Return a **new** list of **new** dicts (copies), sorted by key. Do not modify `target`, `batch` or any dict in them, and make sure that changing a returned dict later cannot change the inputs either.\n\nThe tests check two properties a pipeline needs: running the same batch twice gives the same result as running it once (**idempotency**), and the inputs are unchanged afterwards.\n\nExample: `upsert([{"id": 1, "v": "a"}, {"id": 2, "v": "b"}], [{"id": 2, "v": "B"}, {"id": 3, "v": "c"}], "id")` returns `[{"id": 1, "v": "a"}, {"id": 2, "v": "B"}, {"id": 3, "v": "c"}]`.',starter:`def upsert(target, batch, key):
    # your code here
    pass
`,solution:`def upsert(target, batch, key):
    merged = {row[key]: row for row in target}
    for row in batch:
        k = row.get(key)
        if k is None:
            continue
        merged[k] = row
    return [dict(merged[k]) for k in sorted(merged)]
`,tests:[{call:'upsert([{"id": 1, "v": "a"}, {"id": 2, "v": "b"}], [{"id": 2, "v": "B"}, {"id": 3, "v": "c"}], "id")'},{call:'upsert([], [], "id")'},{call:'upsert([{"id": 5, "v": 0}], [], "id")'},{call:'upsert([], [{"id": 1, "v": "x"}, {"id": 1, "v": "y"}, {"id": 1, "v": "z"}], "id")'},{call:'upsert([{"id": 1, "v": "a", "extra": True}], [{"id": 1, "v": "b"}], "id")'},{call:'upsert([{"k": "b"}], [{"k": None, "v": 1}, {"v": 2}, {"k": "a"}], "k")'},{call:'(lambda T, B: upsert(upsert(T, B, "id"), B, "id") == upsert(T, B, "id"))([{"id": 1, "v": "a"}, {"id": 3, "v": "c"}], [{"id": 3, "v": "C"}, {"id": 2, "v": "b"}, {"id": 2, "v": "b2"}])'},{call:'(lambda T, B: (upsert(T, B, "id"), T, B))([{"id": 1, "v": "a"}], [{"id": 1, "v": "b"}, {"id": 2, "v": "c"}])'},{call:'(lambda T, B: (lambda out: (out[0].update(v="changed"), T, B)[1:])(upsert(T, B, "id")))([{"id": 1, "v": "a"}], [{"id": 2, "v": "b"}])',hidden:!0},{call:'upsert([{"id": i, "v": 0} for i in range(0, 1000, 2)], [{"id": i, "v": 1} for i in range(0, 1000, 3)], "id")[:7]',hidden:!0}],hints:["Index the target by key with a dict comprehension. Then walk the batch in order and assign `merged[k] = row`: later rows overwrite earlier ones.","Skip batch rows where `row.get(key) is None`.","Return copies, `[dict(merged[k]) for k in sorted(merged)]`, so a caller that mutates the result cannot corrupt `target` or `batch`."],explanation:"Keying by the primary key makes the result a function of the final state only, so replaying a batch is harmless: that is idempotency, the property that makes retries and backfills safe. Last-wins inside the batch mirrors how CDC streams are applied in order; a `MERGE` in Delta or Iceberg would instead fail on multiple source rows matching one target row, so you deduplicate the batch first, which is exactly what the dict does.\n\nTime O((n + m) log(n + m)) for the sort, space O(n + m).\n\nTraps: `target.append(...)` or `row.update(...)` on the inputs (side effects make tests order-dependent and reruns non-idempotent), first-wins instead of last-wins, and appending duplicates instead of replacing, which doubles rows on every rerun."}],ue=`
# daily_orders.py : the script everyone has written once
import boto3, json, datetime
from awsglue.utils import getResolvedOptions
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.getOrCreate()
cfg = json.loads(boto3.client("s3").get_object(Bucket="cfg", Key="orders.json")["Body"].read())  # I/O at import

today = datetime.date.today()                                    # hidden input: the clock
df = spark.read.json(f"s3://raw/orders/dt={today - datetime.timedelta(days=1)}/")
df = df.filter(F.col("status") != "TEST")
df = df.withColumn("amount", F.col("amount") * cfg["fx"]["USD"])  # business rule buried mid-script
df = df.dropDuplicates(["order_id"])                             # keeps an arbitrary row
df.groupBy("city").sum("amount").write.mode("overwrite").parquet("s3://marts/daily/")  # path from nowhere`,me=`
# src/etl/orders.py : the functional core, no I/O
from datetime import date
from pyspark.sql import DataFrame, Window, functions as F

def clean_orders(orders: DataFrame, fx_to_inr: dict[str, float]) -> DataFrame:
    rates = F.create_map(*[x for k, v in fx_to_inr.items() for x in (F.lit(k), F.lit(v))])
    return (orders.where(F.col("status") != "TEST")
                  .withColumn("amount_inr", F.col("amount") * F.element_at(rates, F.col("currency"))))

def latest_per_order(orders: DataFrame) -> DataFrame:
    w = Window.partitionBy("order_id").orderBy(F.col("updated_at").desc(), F.col("ingest_seq").desc())
    return orders.withColumn("_rn", F.row_number().over(w)).where("_rn = 1").drop("_rn")

def daily_city_revenue(orders: DataFrame, run_date: date) -> DataFrame:
    return (orders.groupBy("city").agg(F.sum("amount_inr").alias("revenue_inr"))
                  .withColumn("dt", F.lit(run_date.isoformat())))

# jobs/daily_orders/main.py : the imperative shell, no logic
from etl.orders import clean_orders, latest_per_order, daily_city_revenue
from etl.schemas import ORDER_SCHEMA

def main(spark, run_date: date, raw_path: str, out_path: str, fx: dict[str, float]) -> None:
    raw = spark.read.schema(ORDER_SCHEMA).json(f"{raw_path}/dt={run_date}/")
    result = daily_city_revenue(latest_per_order(clean_orders(raw, fx)), run_date)
    result.write.mode("overwrite").parquet(f"{out_path}/dt={run_date}/")   # partition overwrite: rerun-safe`,fe=`
# tests/test_clean.py
import pytest
from etl.clean import normalize_phone, parse_amount

@pytest.mark.parametrize("raw, expected", [
    ("98765 43210", "+919876543210"),
    ("+91-98765-43210", "+919876543210"),
    ("12345 67890", None),
    (None, None),
], ids=["spaces", "dashes", "bad-prefix", "null"])
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected

@pytest.fixture
def raw_rows():                       # function scope: a fresh copy for every test
    return [{"id": "1", "amount": "100.50"}, {"id": "2", "amount": ""}]

def test_blank_amount_is_none(raw_rows):
    assert parse_amount(raw_rows[1]["amount"]) is None

def test_rejects_negative_amounts():
    with pytest.raises(ValueError, match="negative"):
        parse_amount("-5")

def test_writes_jsonl(tmp_path):      # built-in fixture: a unique temp directory
    from etl.io import write_jsonl
    out = tmp_path / "out.jsonl"
    write_jsonl([{"a": 1}, {"a": 2}], out)
    assert out.read_text().splitlines() == ['{"a": 1}', '{"a": 2}']

def test_reads_region_from_env(monkeypatch):
    monkeypatch.setenv("AWS_REGION", "ap-south-1")   # undone automatically after the test
    from etl.config import region
    assert region() == "ap-south-1"`,ge=`
# tests/conftest.py : fixtures shared by every test file
import os
import pytest
from pyspark.sql import SparkSession

@pytest.fixture(scope="session")
def spark():
    s = (SparkSession.builder.master("local[2]").appName("unit-tests")
         .config("spark.sql.shuffle.partitions", "2")
         .config("spark.ui.enabled", "false")
         .config("spark.sql.session.timeZone", "UTC")
         .getOrCreate())
    yield s                                     # everything after yield is teardown
    s.stop()

@pytest.fixture(autouse=True)
def no_real_aws(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-south-1")

# tests/test_orders.py
from datetime import date
from pyspark.testing import assertDataFrameEqual          # Spark 3.5+
from etl.orders import clean_orders, latest_per_order

SCHEMA = "order_id string, updated_at int, ingest_seq int, status string, amount double, currency string"

def test_latest_per_order_breaks_ties_by_ingest_seq(spark):
    df = spark.createDataFrame([("o1", 5, 1, "new", 10.0, "INR"), ("o1", 5, 2, "paid", 10.0, "INR")], SCHEMA)
    got = latest_per_order(df).select("order_id", "status")
    assertDataFrameEqual(got, spark.createDataFrame([("o1", "paid")], "order_id string, status string"))

def test_clean_orders_drops_test_orders_and_converts(spark):
    df = spark.createDataFrame([("o1", 1, 1, "TEST", 1.0, "USD"), ("o2", 1, 1, "paid", 2.0, "USD")], SCHEMA)
    got = clean_orders(df, {"USD": 83.0}).select("order_id", "amount_inr")
    assertDataFrameEqual(got, spark.createDataFrame([("o2", 166.0)], "order_id string, amount_inr double"))`,ye=`
# 1. Dependency injection + moto: real boto3 calls, in-memory AWS (moto 5)
from datetime import datetime, timezone
import boto3
from moto import mock_aws
from etl.discover import new_object_keys

EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)

@mock_aws
def test_new_object_keys_follows_pagination():
    s3 = boto3.client("s3", region_name="ap-south-1")
    s3.create_bucket(Bucket="lake", CreateBucketConfiguration={"LocationConstraint": "ap-south-1"})
    for i in range(1500):                                  # > 1000 forces a second page
        s3.put_object(Bucket="lake", Key=f"raw/orders/{i:05}.json", Body=b"{}")
    keys = new_object_keys(s3, "lake", "raw/orders/", since=EPOCH)
    assert len(keys) == 1500

# 2. mock.patch when you cannot change the code: patch where the name is LOOKED UP
from unittest import mock

def test_load_uses_client():
    with mock.patch("etl.load.get_s3", autospec=True) as get_s3:   # not "etl.clients.get_s3"
        get_s3.return_value.list_objects_v2.return_value = {"Contents": [], "IsTruncated": False}
        from etl.load import run
        assert run("lake") == 0

# 3. Time: pass it in. If you cannot, freeze it.
def is_late(event_ts, now):                               # testable: now is an argument
    return (now - event_ts).total_seconds() > 3600`,we=`
# pyproject.toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "acme-etl"
version = "1.14.0"
requires-python = ">=3.10"
dependencies = ["pyarrow==16.1.0", "requests==2.32.3"]   # pin: what CI tested is what runs

[project.optional-dependencies]
dev = ["pytest", "pytest-xdist", "moto[s3]", "mypy", "ruff", "pyspark==3.5.1"]

[tool.pytest.ini_options]
testpaths = ["tests"]
markers = ["slow: integration tests that need Spark or moto"]

[tool.mypy]
strict = true
packages = ["etl"]`,be=`
acme-etl/
  pyproject.toml
  src/etl/              # importable package: the functional core
    __init__.py
    clean.py
    orders.py
    io.py               # thin readers / writers
  jobs/daily_orders/
    main.py             # entry point: parse args, wire I/O, call etl.*
  tests/
    conftest.py         # spark fixture, fake AWS credentials
    unit/               # pure Python, milliseconds
    integration/        # local SparkSession, moto: marked slow
  .github/workflows/ci.yml`,ke=`
# .github/workflows/ci.yml
name: ci
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: "17" }
      - run: pip install -e ".[dev]"
      - run: ruff check . && ruff format --check .
      - run: mypy
      - run: pytest -m "not slow" -n auto --durations=10
      - run: pytest -m slow
      - run: python -m build                 # the wheel that gets deployed, tagged with the version`;function xe(){return e.jsxs(e.Fragment,{children:[e.jsxs(t,{num:1,title:"Why pipeline code ends up untested",children:[e.jsxs("p",{children:["Most ETL code starts as a script: read from S3, transform, write, all at the top level of one file. It works, so it ships. Then a rule changes, someone edits line 140, and the only way to check it is to run the whole job against real data and eyeball the output. The script is not untested because people are lazy; it is untested because it is ",e.jsx("strong",{children:"untestable"}),": logic is tangled with I/O, the clock and configuration."]}),e.jsx(a,{lang:"py",title:"before.py: everything at module level",code:ue}),e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"I/O at import time"}),": importing the file in a test already calls S3."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Hidden inputs"}),": ",e.jsx("code",{children:"date.today()"})," means the output depends on when it runs, so backfills need code edits."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Buried rules"}),": the FX conversion and the TEST filter can only be checked by running everything."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Non-determinism"}),": ",e.jsx("code",{children:"dropDuplicates"})," keeps an arbitrary row per key, so two runs can disagree."]})]}),e.jsxs(d,{type:"interview",title:"The 30-second answer",children:['"I keep a functional core and an imperative shell: transformations are pure, typed functions that take DataFrames or rows plus plain parameters and return new ones; reading, writing, config and the clock live in a thin ',e.jsx("code",{children:"main"}),' that passes them in. That makes most tests fast pytest unit tests on five-row inputs, with parametrize for edge cases and a session-scoped local SparkSession for Spark code. For I/O I inject clients and use fakes or moto instead of patching everything. I test properties that matter for pipelines, idempotency, nulls, duplicates, empty input, and ship one pinned, versioned package through CI to Glue or EMR."']})]}),e.jsxs(t,{num:2,title:"Functional core, imperative shell",children:[e.jsx(I,{width:900,height:300,groups:[{label:"imperative shell (thin, few tests)",x:20,y:20,w:250,h:260,color:"#fbbf24"},{label:"functional core (pure, many tests)",x:310,y:20,w:330,h:260,color:"#a78bfa"},{label:"shell",x:680,y:20,w:200,h:260,color:"#fbbf24"}],nodes:[{id:"args",label:"Args + config",sub:"run_date, paths, fx",x:145,y:80,kind:"client"},{id:"read",label:"Readers",sub:"spark.read, boto3",x:145,y:160,kind:"storage"},{id:"clock",label:"Clock",sub:"now() passed in",x:145,y:240,kind:"external"},{id:"clean",label:"clean_orders",sub:"df, fx -> df",x:475,y:80,kind:"service"},{id:"dedup",label:"latest_per_order",sub:"df -> df",x:475,y:160,kind:"service"},{id:"agg",label:"daily_city_revenue",sub:"df, date -> df",x:475,y:240,kind:"service"},{id:"write",label:"Writer",sub:"overwrite dt=...",x:780,y:160,kind:"storage"}],edges:[{from:"args",to:"clean",dashed:!0},{from:"read",to:"clean",animated:!0},{from:"clean",to:"dedup",animated:!0},{from:"dedup",to:"agg",animated:!0},{from:"clock",to:"agg",dashed:!0},{from:"agg",to:"write",animated:!0}],caption:"Everything that touches the outside world (amber) sits at the edges and is passed in. The violet functions only map data to data, so a test can call them with tiny inputs and check the output."}),e.jsx(a,{lang:"py",title:"after.py: the same job, testable",code:me}),e.jsxs("p",{children:["The refactored job has the same behaviour plus two fixes that fall out of the structure: the run date is an argument (so a backfill is",e.jsx("code",{children:" main(run_date=date(2024, 5, 1), ...)"}),"), and dedup is deterministic. A test does not need to know pytest yet; the idea is just functions that assert. Run the box below: it has a pure transform, six tests and a 15-line runner. One test fails on purpose, because it found a real bug. Fix ",e.jsx("code",{children:"clean_orders"})," and run it again."]}),e.jsx(c,{title:"Pure function + tests + a tiny runner",code:B.runner,minRows:24})]}),e.jsxs(t,{num:3,title:"pytest essentials",children:[e.jsxs("p",{children:["pytest finds files named ",e.jsx("code",{children:"test_*.py"})," (or ",e.jsx("code",{children:"*_test.py"}),"), runs every function named ",e.jsx("code",{children:"test_*"}),", and rewrites plain ",e.jsx("code",{children:"assert"})," statements so a failure prints both sides. Everything else is conveniences around that."]}),e.jsx(a,{lang:"py",title:"tests/test_clean.py",code:fe}),e.jsx(s,{columns:["Feature","What it does","Use it for"],rows:[[e.jsx("code",{children:"@pytest.mark.parametrize"}),"one test per tuple of arguments, each reported separately","edge-case tables for pure functions"],[e.jsx("code",{children:"@pytest.fixture"}),"reusable setup injected by argument name; yield for teardown","sample data, SparkSession, fake clients"],["fixture scope","function (default), class, module, package, session","session for expensive things like a SparkSession"],[e.jsx("code",{children:"conftest.py"}),"fixtures visible to every test in that directory tree","shared spark fixture, fake AWS credentials"],[e.jsx("code",{children:"tmp_path"}),"a unique temporary directory (pathlib.Path)","testing file writers without cleanup code"],[e.jsx("code",{children:"monkeypatch"}),"set env vars, attributes, dict items; undone after the test","config from environment, swapping a function"],[e.jsx("code",{children:"pytest.raises"}),"asserts that a block raises, optionally matching the message","validation errors"],[e.jsx("code",{children:"pytest.approx"}),"tolerant float comparison","metrics computed with floats"],["markers, -m, -k, -x, --lf","select, stop early, rerun failures","fast local loops, slow suites in CI"]]}),e.jsx("p",{children:"Pure helpers are where parametrize shines: the whole spec of the function becomes a table. Write one now; the auto-checker plays the role of your parametrize table."}),e.jsx(h,{spec:L[0]})]}),e.jsxs(t,{num:4,title:"Testing PySpark transformations",children:[e.jsxs("p",{children:["A Spark transform written as ",e.jsx("code",{children:"DataFrame -> DataFrame"})," is tested like any other function: build a tiny input with",e.jsx("code",{children:" createDataFrame"}),", call it, compare with an expected DataFrame. The only Spark-specific parts are a shared session and order-insensitive comparison."]}),e.jsx(a,{lang:"py",title:"tests/conftest.py + tests/test_orders.py",code:ge}),e.jsxs("ul",{children:[e.jsxs("li",{children:[e.jsx("strong",{children:"One session for the run"}),": JVM start-up costs seconds; a session-scoped fixture pays it once."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Small, deterministic config"}),": ",e.jsx("code",{children:"local[2]"}),", 2 shuffle partitions (not 200), UI off, session time zone UTC."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Compare without order"}),": ",e.jsx("code",{children:"assertDataFrameEqual"})," (Spark 3.5+) ignores row order by default and checks schemas; on older versions compare ",e.jsx("code",{children:"sorted(df.collect())"}),"."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Test the tie"}),": the most valuable dedup test is two rows with the same timestamp."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Prefer built-ins over UDFs"}),": they are faster and need no Python worker in tests either (",e.jsx(r,{to:"/topics/python-udfs-arrow",children:"Python UDFs and Arrow"}),")."]})]})]}),e.jsxs(t,{num:5,title:"Faking I/O: inject, fake, moto, patch",children:[e.jsx("p",{children:"Code that calls S3, an API or a database is tested by replacing that dependency. There are three ways, and the order of preference matters."}),e.jsx(s,{columns:["Approach","How","Strength","Weakness"],rows:[["Inject a fake","the function takes a client argument; tests pass a small class with the same methods","fast, explicit, no magic","only models what you wrote"],["moto",e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"@mock_aws"}),": real boto3 calls, in-memory AWS"]}),"catches wrong parameters and pagination bugs","AWS only; slower than a fake"],[e.jsx("code",{children:"mock.patch"}),"replace a name at runtime","works on code you cannot change","patch-where-looked-up trap; accepts any call without autospec"],["Real sandbox account","end-to-end run on a small sample","tests IAM, networking, real limits","slow, needs credentials: a few tests only"]]}),e.jsx(c,{title:"Inject a fake S3 client and test pagination",code:B.fakes,minRows:24}),e.jsx(a,{lang:"py",title:"tests/test_io.py",code:ye}),e.jsxs(d,{type:"warning",title:"Time is an I/O dependency too",children:[e.jsx("code",{children:"datetime.now()"})," inside a function is a hidden input. Pass ",e.jsx("code",{children:"now"})," or ",e.jsx("code",{children:"run_date"})," in, derive partitions from the event's own timestamp, and convert to UTC explicitly. The exercise below is exactly that kind of function: pure, so every time-zone edge case is a one-line test."]}),e.jsx(h,{spec:L[1]})]}),e.jsxs(t,{num:6,title:"Type hints and data contracts",children:[e.jsxs("p",{children:["Type hints (",e.jsx("code",{children:"def load(rows: list[Order]) -> int"}),") do nothing at runtime. Their value is that mypy or pyright check every call site in CI, and that readers know what a function expects. For data that comes from outside, add runtime validation at the boundary."]}),e.jsx(s,{columns:["Tool","Checked when","Use it for"],rows:[["Type hints + mypy / pyright","CI, before running","function signatures, return types, Optional handling"],[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"@dataclass(frozen=True)"})," + ",e.jsx("code",{children:"__post_init__"})]}),"runtime, on construction","small internal records with a few invariants"],[e.jsx("code",{children:"TypedDict"}),"CI only","typing dict-shaped records such as JSON payloads"],[e.jsx("code",{children:"Protocol"}),"CI only",'"anything with a write() method": fakes satisfy it without inheritance'],["pydantic models","runtime, with coercion and clear errors","API payloads, config files, event validation"],["Spark StructType / schema registry","read time / produce time","the data contract of a table or topic"]]}),e.jsx(c,{title:"Dataclasses, Protocols, and what hints do not do",code:B.types,minRows:22})]}),e.jsxs(t,{num:7,title:"What to test in a data pipeline",children:[e.jsx("p",{children:"Unit tests for business rules are the base, but pipelines fail in ways application code rarely does. These are the properties worth an explicit test, and the layer each belongs to."}),e.jsx(s,{columns:["Property","Example test","Layer"],rows:[["Idempotency","run the same date twice; output identical","unit (pure merge) + integration (overwrite)"],["Determinism","two rows with the same timestamp; same winner every time","unit"],["Nulls and empties","empty input -> empty output; null keys handled as specified","unit"],["Duplicates","replayed batch does not double counts","unit"],["Schema","output columns and types equal the contract","unit (assertSchemaEqual) + CI"],["Time zones","event at 02:30 IST lands in the previous UTC day","unit"],["Volume and freshness","today's row count within 30% of the 7-day average","production data-quality check, not CI"]]}),e.jsxs("p",{children:["Idempotency is the property that makes retries and backfills safe (",e.jsx(r,{to:"/topics/idempotency-and-backfills",children:"Idempotency and backfills"}),"). Model it as a pure function and you can test it with plain asserts."]}),e.jsx(h,{spec:L[2]}),e.jsxs("p",{children:["Production data-quality checks (Great Expectations, Deequ, dbt tests, or plain SQL assertions) cover what tests cannot know: upstream volume drops, new enum values, late partitions. See ",e.jsx(r,{to:"/topics/data-quality-and-slas",children:"Data quality and SLAs"}),", and for record-level validation practice, ",e.jsx(r,{to:"/python-lab/py-lab-validate-records",children:"Validate records against a schema"})," in the Python Lab."]})]}),e.jsxs(t,{num:8,title:"Packaging, CI and shipping to Glue and EMR",children:[e.jsx("p",{children:"Tests only protect production if production runs the code that was tested. That means a real package, pinned dependencies, one build in CI, and the same artifact deployed everywhere."}),e.jsxs("div",{className:"grid cols-2",children:[e.jsx(a,{lang:"text",title:"repo layout",code:be}),e.jsx(a,{lang:"bash",title:"pyproject.toml",code:we})]}),e.jsx(a,{lang:"yaml",title:".github/workflows/ci.yml",code:ke}),e.jsx(H,{steps:[{title:"Lint and type-check",body:e.jsxs("p",{children:[e.jsx("code",{children:"ruff"})," for lint and formatting, ",e.jsx("code",{children:"mypy"})," or pyright on the package. Cheap, and catches a class of bugs before any test runs."]})},{title:"Unit, then integration",body:e.jsxs("p",{children:["Fast unit tests on every push; local-Spark and moto tests marked ",e.jsx("code",{children:"slow"})," before merge."]})},{title:"Build once",body:e.jsx("p",{children:"A wheel (and, for EMR Serverless, a packed virtualenv) tagged with the version, uploaded to an artifacts bucket."})},{title:"Deploy by reference",body:e.jsxs("p",{children:["Infrastructure as code points jobs at ",e.jsx("code",{children:"s3://artifacts/<version>/"}),". Rollback is pointing back at the previous version."]})}]}),e.jsx(j,{items:[{platform:"glue",body:e.jsxs("p",{children:["Ship your package with ",e.jsx("code",{children:"--extra-py-files"})," (S3 paths to ",e.jsx("code",{children:".py"})," or ",e.jsx("code",{children:".zip"}),") and third-party or wheel dependencies with ",e.jsx("code",{children:"--additional-python-modules"})," (for example ",e.jsx("code",{children:"acme-etl==1.14.0"})," or an S3 wheel path). Glue publishes Docker images of its runtime, so CI can run pytest against the same Spark and library versions."]})},{platform:"emr",body:e.jsxs("p",{children:["EMR Serverless: build a virtualenv with your package on a matching Amazon Linux image, pack it with ",e.jsx("code",{children:"venv-pack"}),", and pass ",e.jsx("code",{children:"spark.archives=s3://.../env.tar.gz#environment"})," with ",e.jsx("code",{children:"PYSPARK_PYTHON=./environment/bin/python"})," for driver and executors. On EMR on EC2, ",e.jsx("code",{children:"spark-submit --py-files deps.zip"})," or the same archive approach."]})},{platform:"databricks",body:e.jsx("p",{children:"Databricks Asset Bundles deploy jobs and wheel tasks from the repo; wheels attach as job libraries. Run unit tests locally or in CI with open-source PySpark, and reserve cluster runs for integration tests."})}]})]}),e.jsxs(t,{num:9,title:"Pitfalls, interview probes and takeaways",children:[e.jsx(s,{columns:["Pitfall","Symptom","Fix"],rows:[["Logic at import time","importing the module in a test calls AWS",'move it into functions; main() under if __name__ == "__main__"'],[e.jsxs(e.Fragment,{children:[e.jsx("code",{children:"datetime.now()"})," inside logic"]}),"tests pass today, fail at midnight; backfills need edits","pass now / run_date as a parameter"],["Patching the wrong name",'the "mock" is never used, the test calls real code',"patch where looked up, autospec=True, or inject"],["Asserting Spark row order","flaky tests on more cores","assertDataFrameEqual or compare sorted rows"],["One SparkSession per test","a 20-minute suite nobody runs","session-scoped fixture, 2 shuffle partitions"],["Unpinned dependencies","CI green, Glue run different","lock file, pinned versions, runtime image in CI"],["Testing only the happy path","nulls, duplicates and ties break production","parametrize edge cases; property tests (hypothesis) for invariants"]]}),e.jsx(v,{prosTitle:"Signals of a strong answer",consTitle:"Signals of a weak one",pros:["Separates pure transforms from I/O without being asked","Mentions idempotency, determinism and null handling as things to test","Knows the session-scoped SparkSession fixture and patch-where-looked-up","Talks about pinned versions and one artifact through environments"],cons:['"We validate by looking at the dashboard"',"Only end-to-end tests against real AWS","Mocks everything, asserts on calls instead of outputs","No answer for how the tested code reaches Glue or EMR"]}),e.jsxs(d,{type:"interview",title:"What interviewers probe",children:['Expect "how would you test this?" right after any coding answer. A good reply names two or three concrete test cases (an edge case, an empty input, a tie or duplicate), says how dependencies are replaced, and mentions how it runs in CI. For orchestration-level testing (DAG integrity, local runs) see ',e.jsx(r,{to:"/topics/airflow-testing-ci",children:"Airflow testing and CI"}),"."]}),e.jsx(_,{items:[e.jsx(e.Fragment,{children:"Untestable code is code that mixes logic with I/O, the clock and config. Split it: functional core, imperative shell."}),e.jsx(e.Fragment,{children:"Transforms are pure functions (DataFrame or rows in, DataFrame or rows out) with dates, config and clients passed in."}),e.jsx(e.Fragment,{children:"pytest: plain asserts, parametrize for edge-case tables, fixtures (session scope for SparkSession), tmp_path, monkeypatch, raises."}),e.jsx(e.Fragment,{children:"Spark tests: local[2], 2 shuffle partitions, UTC, assertDataFrameEqual ignoring order, and a test for ties."}),e.jsx(e.Fragment,{children:"Replace I/O by injection and fakes first, moto for boto3 code, mock.patch last (and where the name is looked up)."}),e.jsx(e.Fragment,{children:"Test pipeline properties: idempotency, determinism, nulls, duplicates, schema, time zones. Volume and freshness belong to production checks."}),e.jsx(e.Fragment,{children:"Ship one pinned, versioned artifact through CI to Glue (extra-py-files, additional-python-modules) or EMR (packed venv)."})]})]})]})}const Me=Object.freeze(Object.defineProperty({__proto__:null,default:xe},Symbol.toStringTag,{value:"Module"})),ve=[{id:"pcin-q-gil",kind:"mcq",prompt:"You fetch 10,000 pages from an API (about 200 ms each, almost all network wait) and then compute a heavy pure-Python score per record. Which combination fits best?",options:["Processes for the fetching, threads for the scoring","Threads or asyncio for the fetching, processes for the scoring","Threads for both: the GIL does not apply to network code or to scoring","A single thread for both: concurrency never helps in Python"],answer:[1],explanation:"Blocking socket I/O releases the GIL, so threads (or one asyncio loop) overlap the waits nicely. Pure-Python CPU work holds the GIL, so threads run it one at a time; processes (ProcessPoolExecutor) give real parallelism, at the cost of pickling data between processes."},{id:"pcin-q-littles-law",kind:"mcq",prompt:"An API allows 50 requests per second, and each request takes 0.4 s. Roughly how many concurrent workers do you need to use the full quota?",options:["5","20","50","125"],answer:[1],explanation:"Little's law: requests in flight = arrival rate x time in system = 50/s x 0.4 s = 20. Fewer workers leave quota unused; more workers just queue behind the rate limiter (or trigger 429s if you have none)."},{id:"pcin-q-semaphore",kind:"mcq",prompt:"You wrap calls in `asyncio.Semaphore(10)`. The API limit is 20 requests per second and responses take 50 ms. What happens?",options:["You stay under 20 requests per second because only 10 run at once","You can start up to about 200 requests per second and get throttled with 429s","The semaphore makes requests sequential","asyncio ignores semaphores for network calls"],answer:[1],explanation:"A semaphore limits concurrency (in flight), not rate. With 10 in flight and 50 ms each, you start about 10 / 0.05 = 200 requests per second. You need a rate limiter, such as a token bucket, in addition to the concurrency cap."},{id:"pcin-q-offset",kind:"mcq",prompt:"You page through `/orders?offset=..&limit=100` sorted newest first while new orders keep arriving. What goes wrong?",options:["Nothing: offsets are stable","New rows shift every later page, so you read some rows twice; deletes shift them the other way, so you skip rows","The API returns pages out of order","Offset pagination is always slower but always correct"],answer:[1],explanation:"An offset counts positions, and positions move when rows are inserted or deleted ahead of you. Prefer cursor or keyset pagination (`?after_id=..` or `updated_at > watermark` with a stable tie-breaker), which resumes from a value rather than a position, and dedup by id anyway."},{id:"pcin-q-retryable",kind:"multi",prompt:"Which responses should a GET ingestion client normally retry with backoff?",options:["429 Too Many Requests","503 Service Unavailable","400 Bad Request","401 Unauthorized","A connection timeout","404 Not Found for a page that should exist"],answer:[0,1,4],explanation:"429, 5xx such as 502/503/504, timeouts and connection resets are usually transient. 400 and 401 will fail the same way every time; retrying wastes quota (refresh the token for a 401 once, then fail). A 404 for a resource that must exist is a bug or a data problem to report, not to retry blindly."},{id:"pcin-q-jitter",kind:"mcq",prompt:"Why add jitter to exponential backoff?",options:["To make the total wait shorter in every case","So many clients that failed at the same moment do not retry in synchronised waves that hit the recovering service again","Because the HTTP spec requires it","To avoid needing a maximum number of attempts"],answer:[1],explanation:"Without jitter, every client that failed at t=0 retries at exactly 1 s, 3 s, 7 s... and each wave can knock the service over again. Randomising the wait (for example full jitter: `uniform(0, min(cap, base * 2**attempt))`) spreads the retries out."},{id:"pcin-q-retry-after",kind:"mcq",prompt:"A 429 response carries `Retry-After: 30`, but your backoff schedule says wait 2 s. What should the client do?",options:["Wait 2 s: the client schedule wins","Wait at least 30 s before retrying (and usually slow the whole client down)","Retry immediately with a new connection","Ignore 429s, they are informational"],answer:[1],explanation:"Retry-After is the server telling you when it will accept requests again (in seconds or as an HTTP date). Honour it, and treat it as a signal to lower your request rate across all workers, not only for that one call."},{id:"pcin-q-timeout",kind:"mcq",prompt:"A nightly ingestion job using `requests.get(url)` sometimes hangs for hours and never fails. What is the most likely cause?",options:["The GIL deadlocked","No timeout: requests has no default timeout, so a stalled connection waits forever","The thread pool is too small","JSON parsing is too slow"],answer:[1],explanation:"`requests` waits indefinitely unless you pass `timeout=` (connect and read timeouts, for example `timeout=(3.05, 30)`). Every network call in a pipeline needs a timeout, and the job itself needs an overall deadline."},{id:"pcin-q-open-design",kind:"open",prompt:"Design a daily job that pulls about 20 million records from a partner REST API (cursor pagination, 1,000 records per page, limit 25 requests per second, ~300 ms per call) into S3. Give numbers.",explanation:"20M / 1,000 = 20,000 pages. At 25 req/s that is at least 800 s, about 13-14 minutes, whatever the concurrency. Little's law: 25/s x 0.3 s = about 8 requests in flight, so 8-10 workers with a shared token bucket at ~22/s (headroom for retries). But a single cursor chain is sequential: if the API only offers one cursor, you cannot parallelise it, so ask for a way to split the scan (date ranges, id ranges, or per-account cursors) and run one cursor chain per slice. Each page is written to S3 under a deterministic key (slice/page number or cursor hash) so retries overwrite instead of duplicating; the last committed cursor per slice is checkpointed (DynamoDB or S3) after the write, so a crash resumes. Retries: timeouts, 429 (honour Retry-After) and 5xx with capped exponential backoff and full jitter, max ~6 attempts. A downstream Spark job dedups by record id and builds the table. Run it on ECS Fargate or Glue Python shell (Lambda's 15-minute limit is too tight), orchestrated by Airflow or Step Functions, with metrics on pages, records, retries and 429s."}],Je=Object.freeze(Object.defineProperty({__proto__:null,default:ve},Symbol.toStringTag,{value:"Module"})),je=[{id:"gen-1",kind:"mcq",prompt:"Which of these reads a 30 GB text file with flat memory use?",options:["for line in f.readlines(): ...","data = f.read().splitlines()","for line in f: ...","lines = list(f)"],answer:[2],explanation:"Iterating the file object yields one line at a time from an internal buffer. readlines(), read() and list(f) all materialise the whole file."},{id:"gen-2",kind:"mcq",prompt:"gen = (x * 2 for x in range(3)); a = sum(gen); b = sum(gen). What are a and b?",options:["a = 6, b = 6","a = 6, b = 0","a = 6, then TypeError","a = 0, b = 6"],answer:[1],explanation:"A generator is single-use. The first sum consumes it; the second sees an exhausted iterator and sums nothing, with no error. Compute everything in one pass or recreate the generator."},{id:"gen-3",kind:"mcq",prompt:'rows(path) opens the file in a with block and returns the generator expression (line for line in f) from inside it. What happens on the first next(rows("a.csv"))?',options:["It returns the first line","ValueError: I/O operation on closed file","StopIteration immediately","It loads the whole file"],answer:[1],explanation:"The with block exits when the function returns, closing the file before the generator expression reads anything. Write a generator function that yields inside the with block instead."},{id:"gen-4",kind:"mcq",prompt:"You read a file in 1 MB chunks with f.read(1 << 20) and split each chunk on newlines. What bug must you handle?",options:["Chunks are always aligned to lines, so nothing","A record can be split across two chunks: carry the partial last line into the next chunk and flush it at the end","read() may return more than 1 MB","Chunks arrive out of order"],answer:[1],explanation:"Fixed-size chunks ignore record boundaries. Keep the trailing partial piece, prepend it to the next chunk, and emit whatever is left after the final read returns empty."},{id:"gen-5",kind:"mcq",prompt:'list(itertools.groupby("AABAA")) produces how many groups?',options:["2 (A and B)","3 (AA, B, AA)","5","1"],answer:[1],explanation:"groupby groups consecutive equal keys only, so A appears as two separate runs. To group all A together, sort first (or use a dict); for state intervals the run behaviour is exactly what you want."},{id:"gen-6",kind:"multi",prompt:"Which of these stop reading the source as soon as they have their answer (lazy early exit)?",options:['next(x for x in lines if "ERROR" in x)',"list(itertools.islice(records, 10))",'[x for x in lines if "ERROR" in x][0]','any("ERROR" in x for x in lines)'],answer:[0,1,3],explanation:"next() on a generator, islice and any() stop as soon as they can. The list comprehension builds the full filtered list before taking [0]."},{id:"gen-7",kind:"mcq",prompt:'Why is line.split(",") a bug for parsing an exported CSV file?',options:["It is slower than csv.reader",'It breaks on quoted fields containing commas or newlines, such as "Delhi, NCR"',"It cannot handle a header row","It only works on files under 2 GB"],answer:[1],explanation:'CSV quoting allows commas, quotes and even newlines inside a field. The csv module (opened with newline="") handles them; naive splitting silently shifts columns.'},{id:"gen-8",kind:"mcq",prompt:"A PySpark job uses rdd.mapPartitions(f) where f starts with rows = list(iterator). Python workers get OOM-killed on large partitions. Why?",options:["mapPartitions always loads the whole dataset on the driver","list() pulls the entire partition into Python memory; f should iterate lazily and yield results","mapPartitions does not support generators","The iterator is re-read for every row"],answer:[1],explanation:'mapPartitions passes an iterator so you can stream a partition. Materialising it turns a streaming operation into "whole partition in memory". Yield outputs as you go.'},{id:"gen-9",kind:"open",prompt:"You must count distinct user_ids in a 2 TB set of log files on one machine with 32 GB of RAM. A Python set of all ids does not fit. What are your options?",explanation:"Streaming fixes per-record memory, but the state (the set of distinct ids) is the problem. Options: (1) approximate with HyperLogLog (KBs of memory, ~1-2% error), often fine for analytics; (2) exact with hash partitioning: stream once, write each id to one of, say, 256 bucket files by hash(id) % 256, then count distinct per bucket with a set that now fits, and sum; (3) external sort and count changes between consecutive ids; (4) move it to Spark or a warehouse (COUNT(DISTINCT) or approx_count_distinct). State the trade-off: exact vs approximate, one pass vs two passes, and disk space for the buckets."}],He=Object.freeze(Object.defineProperty({__proto__:null,default:je},Symbol.toStringTag,{value:"Module"})),_e=[{id:"ppvp-q-lazy",kind:"mcq",prompt:'In PySpark, `df2 = df.filter(F.col("amount") > 100).withColumn("x", F.lit(1))` runs on a 1 TB table. How long does this line take?',options:["Roughly as long as scanning 1 TB","Almost no time: it only adds steps to the logical plan","It depends on spark.sql.shuffle.partitions","It fails because withColumn needs an action first"],answer:[1],explanation:"Transformations are lazy: Spark records them in a plan and returns immediately. Work happens at an action such as `count()`, `show()`, `collect()` or `write`. The pandas equivalent would execute both steps immediately and hold the result in RAM."},{id:"ppvp-q-groupby-nan",kind:"mcq",prompt:'A `city` column has 1,000 rows with a missing value. What do pandas `df.groupby("city").size()` and Spark `df.groupBy("city").count()` do with them by default?',options:["Both drop them","Both keep them as one null group","pandas drops them; Spark keeps one null group","pandas keeps them; Spark drops them"],answer:[2],explanation:'pandas `groupby` has `dropna=True` by default, so NaN keys silently disappear from the result (pass `dropna=False` to keep them). Spark, like SQL, groups all nulls together into one group. A "same" report can therefore differ by exactly the null rows.'},{id:"ppvp-q-merge-nan",kind:"mcq",prompt:"You `pd.merge` orders with customers on `customer_id`. Both sides have rows where `customer_id` is NaN. What happens?",options:["NaN keys never match, as in SQL","NaN keys match each other, so every NaN order joins every NaN customer","pandas raises an error on NaN keys","NaN keys are dropped from both sides first"],answer:[1],explanation:"pandas documents that null keys match each other in `merge`, unlike SQL and Spark, where `NULL = NULL` is not true. With many null keys this can multiply rows. Filter null keys first, or use `validate=` to catch unexpected fan-out."},{id:"ppvp-q-memory",kind:"mcq",prompt:"A 4 GB CSV with many string columns must be loaded with pandas on a 16 GB laptop. What is the most likely outcome with default `read_csv` settings?",options:["Fine: it needs about 4 GB","Likely to run out of memory or swap: pandas commonly needs 5-10x the file size, more with object strings","pandas streams it from disk automatically","It is always smaller in memory because pandas compresses columns"],answer:[1],explanation:"Each string in an `object` column is a separate Python object with tens of bytes of overhead, numbers default to 64-bit, and many operations make copies. Load fewer columns (`usecols`), set `dtype` (`category`, `int32`, `float32`, pyarrow strings), read in `chunksize` pieces, or use DuckDB, Polars or Spark."},{id:"ppvp-q-topandas",kind:"multi",prompt:"Which statements about `spark_df.toPandas()` are true?",options:["It collects every row to the driver process","It can fail with a driver OOM or a spark.driver.maxResultSize error on large data","It runs the pandas code in parallel on the executors","Enabling spark.sql.execution.arrow.pyspark.enabled makes the transfer much faster"],answer:[0,1,3],explanation:"`toPandas()` is an action that brings the whole result to the driver and builds one pandas DataFrame there, so it is only for small results. `spark.driver.maxResultSize` (default 1g) guards against huge collects. Arrow speeds up the conversion a lot but does not change where the data ends up. To run pandas code on executors, use `applyInPandas`, `mapInPandas` or pandas UDFs."},{id:"ppvp-q-order",kind:"mcq",prompt:"You call `sdf.limit(10).show()` twice on an unsorted Spark DataFrame read from 500 Parquet files. Are you guaranteed the same 10 rows?",options:["Yes, Spark preserves file order","No: without an orderBy, row order is not defined and can change between runs","Yes, because Spark DataFrames have an index like pandas","Only if the files are partitioned"],answer:[1],explanation:"A Spark DataFrame is an unordered, distributed collection. Which tasks finish first, how files are split and how AQE coalesces partitions can all change the output order. pandas keeps insertion order and an index; Spark needs an explicit `orderBy` (and a unique tie-breaker) for deterministic results."},{id:"ppvp-q-apply",kind:"mcq",prompt:"Which pandas pattern is typically 10-100x slower than the alternatives on a million rows?",options:['`df["total"] = df["qty"] * df["price"]`','`df["total"] = df.apply(lambda r: r["qty"] * r["price"], axis=1)`','`df.groupby("city")["amount"].sum()`','`np.where(df["amount"] > 100, "big", "small")`'],answer:[1],explanation:"`apply(axis=1)` calls a Python function once per row and builds a Series for every row. Column arithmetic, `groupby` aggregations and `np.where` run as vectorised loops in C. The Spark parallel: built-in column functions beat Python UDFs for the same reason."},{id:"ppvp-q-choose",kind:"multi",prompt:"Your daily job processes 30 GB of Parquet on a single 64 GB machine in pandas and is getting slow. Which are reasonable next steps?",options:["Try DuckDB or Polars, which are columnar, multi-threaded and can process larger-than-memory data on one machine","Read only the needed columns and filter early (Parquet column and row-group pruning)","Move to PySpark if data keeps growing or the SLA needs more than one machine","Convert the Parquet to CSV so pandas reads it faster"],answer:[0,1,2],explanation:"Column pruning and filtering at read time often cut memory several-fold. DuckDB and Polars handle tens of GB on one box well. Spark is right once data or concurrency outgrow a single machine. CSV is slower to parse and larger than Parquet."},{id:"ppvp-q-open-migrate",kind:"open",prompt:'A teammate wants to rewrite a 200-line pandas script in PySpark "for speed". Data is 2 GB and grows 10% a year. What do you say?',explanation:"At 2 GB and modest growth, Spark would likely be slower end to end (cluster startup, scheduling, shuffles) and more expensive, and the rewrite has a cost and risk. I would first profile the pandas script: vectorise `apply` calls, set dtypes, read only needed columns from Parquet, and consider DuckDB or Polars for the heavy group-bys. I would move to Spark when the data approaches the memory of one machine (a few tens of GB), when the job must join with large lake tables that already live in Spark, or when one machine cannot meet the SLA. If we do move, pandas API on Spark or `applyInPandas` can keep some pandas logic while the heavy lifting runs in native Spark."}],Ve=Object.freeze(Object.defineProperty({__proto__:null,default:_e},Symbol.toStringTag,{value:"Module"})),Se=[{id:"pplj-q-fullmatch",kind:"mcq",prompt:'You validate status codes with `re.match(r"\\d{3}", s)`. Which input is wrongly accepted?',options:['`"200"`','`"2000"`','`"20"`','`"HTTP 200"`'],answer:[1],explanation:'`re.match` anchors only at the start, so `"2000"` matches its first three digits. `"HTTP 200"` is rejected because `match` must start at position 0 (`search` would accept it). Use `re.fullmatch`, or end the pattern with `\\Z`.'},{id:"pplj-q-greedy",kind:"mcq",prompt:'On the text `"GET /a" 200 "curl"`, what does `re.search(r\'"(.*)"\', text).group(1)` return?',options:["`GET /a`",'`GET /a" 200 "curl`',"`curl`","Nothing: the pattern does not match"],answer:[1],explanation:'`.*` is greedy: it runs to the end of the line, then backtracks only as far as the **last** quote. Use the lazy `.*?` or, better, a negated class `"([^"]*)"`, which cannot cross a quote and never backtracks.'},{id:"pplj-q-json-python",kind:"multi",prompt:"Which statements about Python's `json` module are true?",options:["`json.loads` accepts `NaN` and `Infinity` by default, although they are not valid JSON","If a key appears twice in an object, `json.loads` keeps the last value","JSON numbers with a decimal point become `Decimal` by default","`json.JSONDecodeError` is a subclass of `ValueError`","Integers larger than 2**53 lose precision when parsed"],answer:[0,1,3],explanation:"Python accepts the non-standard constants unless you pass `parse_constant`, and duplicate keys silently keep the last value (use `object_pairs_hook` to detect them). Decimal numbers become `float` unless you pass `parse_float=Decimal`. Python ints are arbitrary precision, so big ints are exact in Python; it is JavaScript consumers that lose precision above 2**53."},{id:"pplj-q-jsonl",kind:"mcq",prompt:"Why do pipelines prefer JSON Lines over one big JSON array per file?",options:["JSON Lines files are always smaller","Each line parses independently: you can stream it, split it across workers, and one bad line costs one record","JSON Lines supports comments and trailing commas","Only JSON Lines can hold nested objects"],answer:[1],explanation:"With one object per line, a reader can process the file line by line in constant memory, Spark can split it at newlines across tasks, and a truncated or malformed line is isolated. A single JSON array must be parsed as one document (Spark needs `multiLine=true`, which makes the file unsplittable)."},{id:"pplj-q-csv-split",kind:"multi",prompt:'Which CSV rows break a naive `line.split(",")` parser but are valid CSV (RFC 4180)?',options:['`1,"Sharma, Priya",Pune`','`2,"Rao ""RK"" Kumar",Chennai`',"A quoted field that contains a newline","`3,Ali,Mumbai`"],answer:[0,1,2],explanation:'A quoted field may contain commas, doubled quotes (`""` means one `"`) and line breaks. Splitting on commas, or reading line by line, breaks all three. The `csv` module handles them, provided you open the file with `newline=""`.'},{id:"pplj-q-spark-csv-escape",kind:"mcq",prompt:'A vendor CSV uses RFC 4180 doubled quotes (`"Rao ""RK"" Kumar"`). Spark reads some rows with shifted columns. What is the usual fix?',options:['Set `.option("escape", \'"\')` so Spark treats a doubled quote as an escaped quote',"Increase `spark.sql.files.maxPartitionBytes`","Set `inferSchema` to true","Read the file with `spark.read.text` and split on commas"],answer:[0],explanation:"Spark's CSV reader uses `\\` as the default escape character, not the RFC 4180 doubled quote. Setting `escape` to `\"` fixes doubled quotes; add `multiLine=true` if quoted fields contain newlines."},{id:"pplj-q-regexp-extract",kind:"mcq",prompt:'In PySpark, what does `F.regexp_extract(col, r"user=(\\w+)", 1)` return for a row where the pattern does not match?',options:["`null`","An empty string","The whole input string","It raises an error and fails the task"],answer:[1],explanation:'`regexp_extract` returns an empty string when there is no match (or the group did not participate), not `null`. Convert with `F.when(x == "", None).otherwise(x)` or `F.nullif` if downstream logic counts nulls as missing.'},{id:"pplj-q-backtracking",kind:"mcq",prompt:"Which pattern risks catastrophic backtracking on a long line that almost matches?",options:["`^(\\w+\\s?)+$`","`^\\S+ \\S+ \\d{3}$`",'`"[^"]*"`',"`^[A-Z]+$`"],answer:[0],explanation:"A nested quantifier where the inner part can match the same text in many ways (`(\\w+\\s?)+`, the space is optional) gives an exponential number of ways to split the input. When the final `$` fails, the engine tries all of them. Use patterns whose alternatives cannot overlap, negated classes, or (Python 3.11+) atomic groups `(?>...)` and possessive quantifiers like `++`."},{id:"pplj-q-explode",kind:"mcq",prompt:"You explode `items` into one row per item to count orders per day. Orders with an empty `items` array disappear from the count. What should you use instead of `explode`?",options:["`explode_outer`","`posexplode`","`flatten`","`collect_list`"],answer:[0],explanation:"`explode` produces no rows for a null or empty array, so those parent rows vanish. `explode_outer` emits one row with a null element instead, keeping the parent."},{id:"pplj-q-open-bad-records",kind:"open",prompt:"A daily job parses 200 million JSON events. About 0.1% are malformed. How do you handle them, and when should the job fail?",explanation:"Parse each record independently and never let one bad record fail the batch. Route failures to a dead-letter location (for example `s3://lake/_rejected/<table>/dt=.../`) with the raw text, the error, the source file and offset, so they can be inspected and replayed. In Spark, read with an explicit schema plus `_corrupt_record` (PERMISSIVE mode) and split good from bad rows.\n\nEmit metrics: total, parsed, rejected and the rejected rate per source. Fail (or hold publishing) when the rate crosses a threshold well above the normal baseline, say 1% or 10x the 7-day average, because that means a format change upstream, not noise. Below it, publish and alert softly. Reconcile counts end to end so rows are never silently lost."}],Ye=Object.freeze(Object.defineProperty({__proto__:null,default:Se},Symbol.toStringTag,{value:"Module"})),Pe=[{id:"ptpc-q-pure",kind:"multi",prompt:"Which of these make a function hard to unit test?",options:["It calls `datetime.now()` inside","It reads `s3://bucket/config.json` at import time","It takes a list of dicts and returns a new list of dicts","It mutates a module-level dict that other functions also read"],answer:[0,1,3],explanation:"Hidden inputs (the clock), I/O at import time and shared mutable state all make results depend on things the test does not control. A function that maps input data to output data is the easiest thing in the world to test. Pass the time and the config in as arguments."},{id:"ptpc-q-parametrize",kind:"mcq",prompt:'What does `@pytest.mark.parametrize("raw, expected", [("98765 43210", "+919876543210"), ("123", None)])` do?',options:["Runs the test once with both cases in a list","Generates two separate test cases, each reported on its own","Skips the test unless both inputs are valid","Runs the cases in parallel processes"],answer:[1],explanation:"Each tuple becomes its own test with its own id in the report, so one failing case does not hide the others. It is the cleanest way to cover many edge cases of a pure function."},{id:"ptpc-q-fixture-scope",kind:"mcq",prompt:"Your PySpark test suite takes 10 minutes, mostly creating SparkSessions. What is the standard fix?",options:['A `spark` fixture with `scope="session"` that builds one local SparkSession for the whole run',"Create a new SparkSession inside every test so tests stay isolated","Mock SparkSession entirely with unittest.mock","Run the tests against the production EMR cluster"],answer:[0],explanation:"Starting a JVM and SparkSession takes seconds. A session-scoped fixture (usually in `conftest.py`) creates it once, with `local[2]`, a small `spark.sql.shuffle.partitions` and the UI off, and stops it at the end. Mocking Spark would test nothing useful."},{id:"ptpc-q-patch-where",kind:"mcq",prompt:"`etl/load.py` does `from etl.clients import get_s3` and calls `get_s3()`. Where must `mock.patch` point to replace it in a test of `etl.load`?",options:["`etl.clients.get_s3`","`etl.load.get_s3`","`boto3.client`","`get_s3`"],answer:[1],explanation:"Patch where the name is **looked up**, not where it is defined. `from ... import get_s3` copies the reference into `etl.load`, so patching `etl.clients.get_s3` leaves `etl.load.get_s3` pointing at the real one. This is the most common mocking bug, and one reason to prefer passing dependencies in as arguments."},{id:"ptpc-q-moto",kind:"mcq",prompt:"What does moto give you that a hand-written fake does not?",options:["Real AWS calls at a discount","An in-memory implementation of many AWS APIs, so real boto3 code runs unchanged against it","Automatic generation of unit tests","Type checking of boto3 calls"],answer:[1],explanation:"With moto (`@mock_aws` in moto 5) your code still calls boto3, and moto intercepts the requests and keeps state in memory: create a bucket, put objects, list them with pagination. It is great for integration-style tests of the I/O shell. A hand-written fake is smaller and faster but only models what you wrote."},{id:"ptpc-q-type-hints",kind:"mcq",prompt:'A function is declared `def load(rows: list[Order]) -> int`. You call `load("oops")`. What happens at runtime?',options:["Python raises TypeError before the call","Nothing special: hints are not enforced at runtime; the function runs and may fail later inside","The call is silently skipped","Python converts the string to a list of Order"],answer:[1],explanation:"Type hints are metadata. mypy or pyright flag the bad call before you run anything, which is why they belong in CI. Runtime validation needs explicit checks, a dataclass `__post_init__`, or a library such as pydantic."},{id:"ptpc-q-what-to-test",kind:"multi",prompt:"Which properties are worth an explicit test for a daily partition-overwrite job?",options:["Running it twice for the same date gives the same output (idempotency)","An empty input produces an empty output, not a crash","NULL and missing values in keys are handled as specified","The output order of rows written to Parquet"],answer:[0,1,2],explanation:"Idempotency makes retries and backfills safe; empty and null inputs are the edge cases that break at 2 a.m. Row order in Parquet files is not a contract in Spark and should not be asserted; compare DataFrames ignoring order, as `assertDataFrameEqual` does by default."},{id:"ptpc-q-ship",kind:"mcq",prompt:"You need a pure-Python dependency from PyPI in an AWS Glue 4.0 Spark job. What is the usual way?",options:["pip install it inside the script with subprocess","The `--additional-python-modules` job parameter (a PyPI name with version, or a wheel on S3)","Copy the package source into the script","It is impossible in Glue"],answer:[1],explanation:"`--additional-python-modules` installs packages (pinned versions or S3 wheels) before the job starts; `--extra-py-files` adds your own `.py` or `.zip` modules to the path. On EMR Serverless, ship a packed virtualenv with `spark.archives`. Pin versions so the job runs exactly what CI tested."},{id:"ptpc-q-open-refactor",kind:"open",prompt:"You inherit a 600-line Glue script with no functions and no tests. It runs daily and occasionally produces wrong totals. How do you make it testable without breaking production?",explanation:"First add a safety net: capture a few days of real input (or a representative sample) and the current outputs, and write a characterization test that runs the job logic on them and compares outputs (counts, sums per key). Then refactor in small steps behind that test: extract the transformations into pure functions that take and return DataFrames (or rows), move reads, writes, `datetime.now()` and config lookups to a thin `main()` that passes them in, and add focused unit tests with tiny inputs for the tricky rules, especially the totals bug, nulls, duplicates and time zones. Package the functions as a module shipped with `--extra-py-files` or a wheel, run pytest with a local SparkSession in CI, and deploy the same artifact. Fix the wrong-totals bug only once a test reproduces it."}],Ke=Object.freeze(Object.defineProperty({__proto__:null,default:Pe},Symbol.toStringTag,{value:"Module"})),Te=[{id:"pcin-threads-processes-async",level:"mid",kind:"concept",q:"Threads, processes or asyncio: which do you use to ingest from a REST API, and what does the GIL have to do with it?",a:"**API ingestion is I/O-bound, so threads or asyncio; processes are for CPU-bound work.**\n\n- **The GIL**: in standard CPython only one thread executes Python bytecode at a time. But blocking I/O (sockets, files) and many C extensions release it, so while one thread waits for a response, others run. For a workload that is 95% waiting, threads scale almost linearly up to the API's limits.\n- **Threads** (`ThreadPoolExecutor`): simplest with blocking libraries like `requests` and boto3. Each thread costs some memory, so tens to a few hundred is fine, thousands is not.\n- **asyncio** (with `aiohttp` or `httpx`): one thread, an event loop switching tasks at each `await`. Thousands of concurrent requests are cheap, and timeouts and cancellation are first-class (`asyncio.timeout`, `TaskGroup` in 3.11+). The cost: every library in the path must be async, and one blocking call stalls the whole loop.\n- **Processes** (`ProcessPoolExecutor`): real parallelism for CPU-heavy parsing or scoring, at the price of start-up and pickling data between processes.\n\nA common shape is asyncio or threads for fetching, writing raw pages to S3, and Spark or a process pool for heavy transformation.\n\nFree-threaded CPython builds (experimental in 3.13, officially supported but optional in 3.14) remove the GIL, but most production stacks still run the default build, so I design as if the GIL is there.",followUps:[{q:"Are threads ever faster than asyncio here?",a:"For tens of concurrent requests the difference is small, and threads let you keep using requests and boto3. asyncio wins when you need thousands of concurrent connections or tight control over cancellation."},{q:"What happens if you call requests.get inside an async function?",a:"It blocks the event loop: no other task runs until it returns, so concurrency silently drops to one. Use an async client or `await asyncio.to_thread(requests.get, ...)`."}],redFlags:['"Python cannot do concurrency because of the GIL"',"Using processes for network-bound work","Blocking calls inside async code"]},{id:"pcin-async-fetcher-coding",level:"senior",kind:"coding",q:"Write an async fetcher that downloads a list of pages with at most N requests in flight, a per-request timeout, and retries on 429/5xx.",a:`**A semaphore caps concurrency, aiohttp gives timeouts, and a small retry loop with capped exponential backoff and full jitter handles transient errors.**

\`\`\`
import asyncio, random
import aiohttp

RETRYABLE = {429, 500, 502, 503, 504}

async def fetch_page(session, sem, url, params, attempts=6, base=0.5, cap=30.0):
    for attempt in range(attempts):
        async with sem:                                   # at most N in flight
            try:
                async with session.get(url, params=params) as r:
                    if r.status == 200:
                        return await r.json()
                    if r.status not in RETRYABLE:
                        r.raise_for_status()              # 4xx: fail fast
                    retry_after = r.headers.get("Retry-After")
            except (aiohttp.ClientConnectionError, asyncio.TimeoutError):
                retry_after = None
        if attempt == attempts - 1:
            raise RuntimeError(f"giving up on {params} after {attempts} attempts")
        delay = random.uniform(0, min(cap, base * 2 ** attempt))      # full jitter
        if retry_after and retry_after.isdigit():
            delay = max(delay, float(retry_after))
        await asyncio.sleep(delay)                        # sleep OUTSIDE the semaphore

async def fetch_all(url, pages, concurrency=10):
    sem = asyncio.Semaphore(concurrency)
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:   # one pooled session
        return await asyncio.gather(*(fetch_page(session, sem, url, {"page": p}) for p in pages))
\`\`\`

Points I would make: one \`ClientSession\` reuses connections; the sleep happens outside the semaphore so a backing-off request does not hold a slot; non-retryable 4xx fail fast; Retry-After overrides the schedule. \`gather\` keeps result order. For very large page lists I would feed a bounded \`asyncio.Queue\` from a producer instead of creating every task up front, add a token-bucket rate limiter if the API has a requests-per-second limit (the semaphore only caps concurrency), and write each page to S3 as it arrives rather than holding everything in memory.`,followUps:[{q:"gather vs TaskGroup?",a:"With `gather`, one exception propagates while other tasks keep running unless you cancel them. `asyncio.TaskGroup` (3.11+) cancels the siblings when one fails and raises an ExceptionGroup, which is usually the safer default for a batch."},{q:"How would you make it resumable?",a:"Write each page under a deterministic S3 key and record completed pages (or the last cursor) in a checkpoint table; on restart skip completed pages. Retries and restarts then overwrite instead of duplicating."}],redFlags:["A new session per request","No timeout","Retrying 400s","Sleeping while holding the semaphore"]},{id:"pcin-retry-decorator-coding",level:"mid",kind:"coding",q:"Write a retry decorator with capped exponential backoff and jitter that only retries specific exceptions.",a:`**Loop over attempts, catch only retryable exceptions, sleep a jittered capped delay, re-raise after the last attempt.**

\`\`\`
import functools, random, time

def retry(on=(TimeoutError, ConnectionError), attempts=5, base=0.5, cap=20.0, sleep=time.sleep):
    def decorate(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(attempts):
                try:
                    return fn(*args, **kwargs)
                except on:
                    if attempt == attempts - 1:
                        raise                                    # keep the original traceback
                    sleep(random.uniform(0, min(cap, base * 2 ** attempt)))
        return wrapper
    return decorate

@retry(on=(TimeoutError,), attempts=4)
def get_page(n):
    ...
\`\`\`

Design choices: \`on\` is an explicit tuple so a \`KeyError\` from a bug is never retried; the cap bounds the worst wait; full jitter spreads synchronised clients; the final failure re-raises the real exception instead of swallowing it; \`sleep\` is injectable so a unit test can pass a fake and assert the delays without waiting (the same reason the backoff schedule is a pure function).

In production I rarely hand-roll this: \`tenacity\` (\`@retry(wait=wait_random_exponential(multiplier=0.5, max=20), stop=stop_after_attempt(5), retry=retry_if_exception_type(TimeoutError))\`), urllib3's \`Retry\` mounted on a requests \`Session\`, or boto3's built-in \`standard\`/\`adaptive\` retry modes. But I want to understand exactly what they do, and the Lab problem on retry schedules covers the arithmetic.`,followUps:[{q:"Is it safe to retry a POST?",a:"Only if the operation is idempotent, for example the API accepts an idempotency key so a repeated request does not create a second order. Otherwise a timeout after the server processed the request causes a duplicate."},{q:"What metrics would you emit?",a:"Attempts per call, retries by error type, give-ups, and total time spent sleeping. A rising retry rate is often the first sign the partner API is degrading."}],redFlags:["`except Exception:` retries everything","No cap or no attempt limit","Swallowing the final exception","Fixed delay with no jitter"]},{id:"pcin-more-workers-slower-debugging",level:"senior",kind:"debugging",q:"You raised the ingestion thread pool from 8 to 64 workers and the job got slower, with lots of 429s. Why, and how do you fix it?",a:`**You went past the API's rate limit, and synchronised retries turned throttling into a retry storm.**

What happens: the API allows, say, 20 requests per second. With ~300 ms latency, Little's law says about 6 requests in flight already saturate it. At 64 workers, most requests are rejected with 429; each rejected worker backs off on the same schedule, so they come back in waves, get rejected again, and the useful throughput falls below what 8 workers achieved. If the client ignores \`Retry-After\`, the API may also penalise it with longer lockouts.

Other symptoms worth checking: \`Connection pool is full, discarding connection\` warnings from urllib3 (requests' default pool size is 10 per host, so 64 threads churn connections), more timeouts as the partner slows down, and higher memory from buffered responses.

Fix:
- **Rate-limit explicitly** with a shared token bucket at slightly below the quota (for example 18/s for a 20/s limit), across all workers.
- **Size concurrency by Little's law**: rate x latency, plus a little headroom: 8 workers here.
- **Backoff with jitter** and honour \`Retry-After\`; on 429, slow the shared limiter down (adaptive), not just the one request.
- **Match the connection pool** to the worker count (\`HTTPAdapter(pool_maxsize=...)\`) and reuse one session.

Then verify with metrics: requests per second, 429 rate, p95 latency and pages per minute before and after.`,followUps:[{q:"The API limit is per account, and three jobs share it. Now what?",a:"A local token bucket is not enough. Either schedule the jobs so they do not overlap, split the quota statically between them, or use a shared limiter (for example a Redis-based token bucket) that all three consult."},{q:"How does boto3 handle this for AWS APIs?",a:"Its retry modes back off on throttling errors; the `adaptive` mode additionally rate-limits the client when it sees throttling. You still need sane concurrency."}],redFlags:['"Add more workers" as the default fix',"Treating 429 like any other error","Ignoring Retry-After","No rate metrics"]},{id:"pcin-pool-sizing-tuning",level:"senior",kind:"tuning",q:"How do you choose max_workers, connection pool size and timeouts for a threaded ingestion client?",a:"**Start from the API's limits and Little's law, then measure.**\n\n- **max_workers**: concurrency needed = target rate x latency. 40 req/s at 250 ms needs about 10 in flight; add 20-50% headroom for slow responses, so 12-15. If the API has no explicit limit, raise workers until throughput stops improving or p95 latency and error rate start rising; that knee is the partner's real capacity. `ThreadPoolExecutor`'s default is `min(32, os.cpu_count() + 4)`, which has nothing to do with your API.\n- **Rate limiter**: a token bucket at 90-95% of the documented limit, shared by all workers, with a burst no larger than the API allows.\n- **Connection pool**: one `requests.Session` per process with `HTTPAdapter(pool_connections=..., pool_maxsize=max_workers)`; the default `pool_maxsize` of 10 per host throttles or churns connections when you run more threads. For aiohttp, `TCPConnector(limit=...)` (default 100) and `limit_per_host`.\n- **Timeouts**: a connect timeout of a few seconds and a read timeout just above the API's p99 (for example `timeout=(3.05, 30)`), plus an overall deadline for the job. No call without a timeout.\n- **Memory**: in-flight responses x page size. 15 workers x 5 MB pages is fine; 500 is not. Stream large responses to S3 instead of loading them.\n\nThen I watch requests/s, p50/p95 latency, 429 and 5xx rates, retries and pages per minute in a dashboard, and tune one knob at a time.",followUps:[{q:"Why can more workers increase latency?",a:"Beyond the server's capacity requests queue on the server side, so each one takes longer while throughput stays flat. Latency rising with flat throughput is the sign you passed the knee."}],redFlags:['Picking 100 workers "to be safe"',"Never setting timeouts","One session per request"]},{id:"pcin-ingest-design",level:"senior",kind:"design",q:"Design the daily ingestion of ~50 million records from a partner API with a 100 requests/second limit and 1,000 records per page into your S3 lake.",a:`**Back-of-envelope first: 50M / 1,000 = 50,000 pages; at 100 req/s that is at least 500 s, about 8-9 minutes, if the scan can be parallelised.**

- **Make the scan parallelisable**: a single cursor chain is inherently sequential (each page gives the next cursor), so at 300 ms per call it would take over 4 hours. Ask for a way to split: date or \`updated_at\` windows, id ranges or per-account endpoints. Run one cursor chain per slice; 96 fifteen-minute windows give plenty of parallelism.
- **Concurrency and rate**: Little's law, 100/s x 0.3 s = 30 in flight. Use about 30-35 workers (asyncio or threads) behind one shared token bucket at ~90 req/s.
- **Landing**: each page is written raw (gzip JSON Lines) to \`s3://lake/raw/partner/dt=.../slice=.../page=00042.json.gz\`. Deterministic keys mean a retried page overwrites itself.
- **Checkpoints**: after each successful write, record the slice's last cursor or page in DynamoDB. A crashed run resumes per slice instead of restarting.
- **Retries**: timeouts, 429 (honour Retry-After) and 5xx with capped exponential backoff and full jitter, ~6 attempts; then mark the slice failed and alert, rather than failing everything.
- **Incremental**: the next run requests \`updated_at >= last_watermark - overlap\` (say 1 hour) to catch late updates, and the downstream Spark job dedups by \`(record_id, updated_at)\` and MERGEs into the silver table.
- **Compute and orchestration**: ECS Fargate task or Glue Python shell (Lambda's 15-minute limit is too tight for a full run, though Step Functions Distributed Map with one Lambda per slice also works). Airflow or Step Functions triggers, then the Spark job.
- **Observability**: pages, records, retries, 429s, slices failed, and a reconciliation of record counts against the API's total if it exposes one.`,followUps:[{q:"Why not call the API from Spark executors?",a:"You can (`mapPartitions` with a session per partition), but a cluster is expensive for waiting on HTTP, retries are tied to task retries, and the rate limit has to be divided across partitions by hand. A small concurrent client plus Spark for the transform is usually simpler and cheaper."},{q:"How do you guarantee no records are lost between runs?",a:"Overlapping watermarks plus dedup downstream, a count reconciliation per day, and keeping the raw pages, so any day can be re-derived without calling the API again."}],redFlags:["No arithmetic on pages and rate","Assuming one cursor chain can be parallelised","Non-deterministic output keys","No checkpoint or resume"]},{id:"pcin-consistent-snapshot-staff",level:"staff",kind:"design",q:"The partner API only offers offset pagination over a table that changes while you read it. How do you get a correct dataset?",a:`**You cannot get a consistent snapshot from moving offsets, so design for "at least once, then dedup and reconcile".**

- **Understand the failure**: offsets are positions. Inserts ahead of your position shift rows forward (duplicates); deletes shift them back (skips). Sorting by something stable helps but does not cure it.
- **Narrow the window**: filter each scan to a slice that is not changing, if the API allows it: \`created_at < run_start\` and a time range per slice. Closed historical windows are stable; only the most recent window churns.
- **Overlap and rescan**: page with a small overlap (re-read the last page of each step) and read the open window twice, a few minutes apart. Duplicates are fine; skips are not.
- **Dedup by key** downstream: keep the latest version per id by \`updated_at\` with a tie-breaker. The ingest is then at-least-once with idempotent consolidation.
- **Reconcile**: compare distinct ids per day with any total the API reports, and with yesterday's counts. Missing ids trigger a targeted re-fetch by id if the API supports it.
- **Handle deletes explicitly**: offset scans cannot tell you what disappeared. Ask for a deletes or changes feed, soft-delete flags, or do a periodic full id reconciliation (anti-join yesterday's ids against today's).
- **Push for a better contract**: cursor or keyset pagination (\`?updated_after=..&after_id=..\`), or a bulk export (files on S3), which is almost always cheaper for both sides at tens of millions of rows.

The trade-off to state: more overlap and rescans cost quota and time but reduce the chance of a miss; the reconciliation step is what turns "probably complete" into a number you can alert on.`,followUps:[{q:"How is this related to CDC?",a:"It is the same problem as incremental loads from a source table with a watermark column: late commits and clock skew mean you need overlap plus idempotent merges. Log-based CDC (Debezium) avoids it by reading the change log instead of the table."}],redFlags:["Believing offset pagination is consistent","No dedup step","Ignoring deletes","No reconciliation metric"]}],$e=Object.freeze(Object.defineProperty({__proto__:null,default:Te},Symbol.toStringTag,{value:"Module"})),qe=[{id:"gen-iter-vs-gen",level:"mid",kind:"concept",q:"What is the difference between an iterable, an iterator and a generator, and why do data engineers care?",a:'**An iterable can produce an iterator; an iterator hands out one item per next() and remembers its position; a generator is an iterator you write with yield. They let you process data one record at a time, so memory doesn\'t grow with the input.**\n\n- **Iterable**: anything with `__iter__`: lists, dicts, files, `range`. You can loop over a list many times because each loop calls `iter()` and gets a fresh iterator.\n- **Iterator**: has `__next__` and raises `StopIteration` at the end. It is single-pass. A file object is its own iterator, which is why a second `for line in f` yields nothing until you `seek(0)`.\n- **Generator**: a function with `yield` (or a `(... for ...)` expression). Calling it runs nothing; each `next()` resumes the body until the next `yield` and pauses there with its local state.\n\nWhy it matters: a pipeline of generators (read lines, parse, validate, filter) moves one record through all stages before reading the next, so a 50 GB file needs a few KB of working memory plus whatever you aggregate. It also starts producing output immediately and can stop early, e.g. "first 100 errors" reads only until the 100th.\n\nIn practice I make the core of a job a function over an iterable of lines, so production feeds it an S3 stream and tests feed it a list.',followUps:[{q:"What does yield from do?",a:"Delegates to another iterable (or sub-generator): `yield from f` re-yields every line of f, and it also forwards send() and throw() to a sub-generator."},{q:"When would you still use a list?",a:"When the data is small and you need len(), indexing, sorting or several passes. Generators are for large, streamed or consume-once data."}],redFlags:['Saying a generator is "a faster list"',"Not knowing generators are single-use",'Calling list() on a stream "to be safe"']},{id:"gen-csv-quarantine",level:"senior",kind:"coding",q:"Write Python that computes revenue per customer from a 50 GB orders CSV on a 16 GB machine, and writes bad rows to a quarantine file with their line numbers.",a:`**Stream the file through csv.DictReader, aggregate into a dict keyed by customer, and write rejects to a second CSV as you go.**

\`\`\`
import csv
from collections import defaultdict
def revenue_per_customer(path, bad_path):
    totals = defaultdict(float)
    bad = 0
    with open(path, encoding="utf-8", newline="") as f, \\
         open(bad_path, "w", encoding="utf-8", newline="") as qf:
        reader = csv.DictReader(f)               # lazy: one row at a time
        quarantine = csv.writer(qf)
        for row in reader:
            try:
                amount = float(row["amount"])    # None (short row) -> TypeError
            except (TypeError, ValueError):
                bad += 1
                quarantine.writerow([reader.line_num, *row.values()])
                continue
            totals[row["customer_id"]] += amount
    return dict(totals), bad
\`\`\`

What I'd point out:

- Memory is O(distinct customers). 10 million customers at roughly 100 bytes per dict entry is about 1 GB: fine. If it were billions, I'd hash-partition customers into bucket files first, or use Spark.
- \`newline=""\` lets the csv module handle quoted newlines; \`reader.line_num\` is the physical line, which is what someone debugging the file needs.
- I parse **before** touching the dict: \`totals[k] += float(x)\` would create the key with 0.0 even when the float fails, a subtle bug with defaultdict.
- I'd add a threshold: if more than, say, 1% of rows are bad, fail the run loudly instead of publishing numbers from a broken export.
- For money, \`decimal.Decimal\` instead of float if the totals feed finance.`,followUps:[{q:"How would you make it faster?",a:"Profile first. Then pyarrow.csv (multi-threaded C++ parsing, streaming via open_csv), split the file by byte ranges aligned to newlines across processes, or run it in Spark/DuckDB."},{q:"How would you test it?",a:"Refactor the loop to take any iterable of lines and a writer, then test with a list containing a quoted comma, a short row, a bad number and a blank line."}],redFlags:["pd.read_csv(path) with no chunksize",'line.split(",")',"Crashing on the first bad row, or silently dropping bad rows without counting them"]},{id:"gen-batched-load",level:"senior",kind:"coding",q:"You must insert 200 million records from a generator into a database in batches of 5,000. Write the batching, and explain how you make the load safe to re-run.",a:`**Chunk the stream lazily with itertools.batched (or islice before 3.12), send each batch in one round trip, and make every batch idempotent so a retry or a re-run never duplicates rows.**

\`\`\`
from itertools import islice
def batched(iterable, n):                # itertools.batched in Python 3.12+
    it = iter(iterable)
    while batch := tuple(islice(it, n)):
        yield batch
def load(records, conn, n=5000):
    sql = ("INSERT INTO orders (order_id, amount, updated_at) VALUES (%s, %s, %s) "
           "ON CONFLICT (order_id) DO UPDATE SET amount = EXCLUDED.amount, "
           "updated_at = EXCLUDED.updated_at")
    for i, batch in enumerate(batched(records, n)):
        with conn:                       # one transaction per batch (psycopg2-style)
            with conn.cursor() as cur:
                cur.executemany(sql, batch)
        if i % 100 == 0:
            print(f"loaded {(i + 1) * n:,} rows")
\`\`\`

Safety:

- **Idempotent writes**: an upsert keyed on the business key (\`ON CONFLICT ... DO UPDATE\`, or \`MERGE\`) means a batch replayed after a timeout produces the same table.
- **One transaction per batch**: a failure rolls back only that batch; the checkpoint is "last committed batch", which lets you resume with \`islice(records, start, None)\` if the source is deterministic.
- **Memory**: one batch of 5,000 tuples at a time, never the 200 million.

Batch size is a trade-off: bigger batches mean fewer round trips but longer transactions, more lock time and larger retries. I'd measure rows per second at 1k, 5k and 20k. For real bulk loads I'd skip INSERTs entirely and use the database's bulk path: \`COPY\` in PostgreSQL, or write Parquet to S3 and \`COPY\` into Redshift.`,followUps:[{q:"What is the difference between islice-based batching and batched?",a:"Same behaviour; batched is the built-in from 3.12 and gained a strict flag in 3.13 that raises if the last batch is short."},{q:"Is executemany fast?",a:"In psycopg2 it is a loop of statements; psycopg2.extras.execute_values or COPY is much faster. psycopg 3 improved executemany considerably."}],redFlags:["Building a list of all 200 million records first","Plain INSERT with retries (duplicates on replay)","One giant transaction"]},{id:"gen-oom-anyway",level:"senior",kind:"debugging",q:'A "streaming" Python job that reads a 20 GB file still gets OOM-killed after 40 minutes. How do you find the cause?',a:'**Streaming per record doesn\'t help if something else grows. I\'d measure where memory goes, then look for the usual hidden materialisations and unbounded state.**\n\nMeasure first:\n\n- Watch RSS over time (`psutil.Process().memory_info().rss` logged every million records). Steady growth means unbounded state; a sudden spike means one huge record or a materialisation.\n- `tracemalloc`: take snapshots a few minutes apart and compare with `snapshot.compare_to(old, "lineno")` to see which lines allocate the growth.\n\nUsual culprits:\n\n- **A hidden list**: `list(gen)`, `sorted(gen)`, `len(list(...))`, a list comprehension where a generator was intended, `readlines()`, `pd.read_csv` without `chunksize`.\n- **Unbounded state**: a dict of per-key aggregates or a dedup `set` that grows with distinct keys, which looks fine in testing and explodes on production cardinality.\n- **itertools.tee** or a `groupby` group kept around: tee buffers everything one copy has seen and the other has not.\n- **One enormous "line"**: a file without newlines, or a multi-GB JSON array rather than JSON Lines. `for line in f` then reads it all; you need `f.read(n)` chunks or a streaming JSON parser (ijson).\n- **Accumulating output** in memory instead of writing it as you go.\n\nFixes follow from the cause: replace the materialisation, bound the state (approximate structures, or hash-partition keys to disk and process one bucket at a time), or switch to chunked reads.',followUps:[{q:"Why might memory not drop after a big list is freed?",a:"CPython returns memory to the OS only when whole arenas become empty; fragmentation can keep RSS high. Measure allocations with tracemalloc rather than RSS alone."},{q:"How do you stream a 10 GB JSON array?",a:'Use an incremental parser such as ijson (ijson.items(f, "item")) or convert it once to JSON Lines; json.load needs the whole document.'}],redFlags:['"Just give it a bigger instance"',"Not measuring before changing code","Assuming a for loop over a file is always line-sized"]},{id:"gen-external-sort",level:"senior",kind:"design",q:"Sort a 100 GB file of keys on a machine with 8 GB of RAM, in Python.",a:`**External merge sort: stream the file into runs that fit in memory, sort each run and write it to a temp file, then k-way merge the sorted runs with a heap.**

\`\`\`
import heapq, tempfile
from itertools import islice
def external_sort(in_path, out_path, run_lines=5_000_000):
    runs = []
    try:
        with open(in_path, encoding="utf-8") as f:
            while chunk := list(islice(f, run_lines)):   # one run fits in memory
                chunk.sort()
                run = tempfile.TemporaryFile("w+", encoding="utf-8")
                run.writelines(chunk)
                run.seek(0)
                runs.append(run)
        with open(out_path, "w", encoding="utf-8") as out:
            out.writelines(heapq.merge(*runs))             # lazy k-way merge
    finally:
        for run in runs:
            run.close()
\`\`\`

Sizing: Python strings carry about 50 bytes of overhead each, so 8 GB holds far fewer lines than 8 GB of file. I'd size runs to use about half the RAM, e.g. 1-2 GB of input per run, giving 50-100 runs. A 100-way merge is one pass with O(100) memory plus read buffers.

Details that matter:

- Ensure every line ends with \`\\n\` (the file's last line may not), or merged lines glue together.
- If there are thousands of runs (more than open-file limits), merge in multiple passes.
- Disk needs about 2x the input: the runs plus the output.
- Total I/O: read 100 GB, write 100 GB of runs, read them, write 100 GB of output.

In practice I'd mention that \`sort -S 4G\` on Linux, DuckDB or Spark do this already and better; the interview wants to see the runs + merge idea and the memory reasoning.`,followUps:[{q:"How does this relate to Spark?",a:"Spark's sort-based shuffle and sort-merge join spill sorted runs to disk and merge them the same way when data exceeds execution memory."},{q:"How would you sort by a field instead of the whole line?",a:"Sort each run with key=..., and pass the same key to heapq.merge(*runs, key=...)."}],redFlags:["sorted(open(path))","Not sizing runs against Python object overhead","Forgetting temp disk space"]},{id:"gen-chunk-size",level:"mid",kind:"tuning",q:"You stream files from S3 in fixed-size chunks to compute checksums and upload them elsewhere. How do you choose the chunk size?",a:`**Big enough that per-call overhead is negligible, small enough that memory is bounded and that one retry doesn't cost much. In practice that lands between about 1 MB and 64 MB, and I measure.**

The trade-offs:

- **Too small** (4 KB): millions of Python-level loop iterations and system calls; the job becomes CPU-bound in the interpreter.
- **Too large** (1 GB): memory spikes per worker, and with N parallel workers it multiplies; a failed read retries a lot of data.
- **Downstream constraints**: S3 multipart uploads need parts of at least 5 MiB (except the last) and at most 10,000 parts, so a 100 GB upload needs parts of at least ~10 MiB.
- **Compression**: gzip decompression works on whatever you feed it, but the output can be 5-10x the input chunk, so size against the decompressed side.

How I'd tune it: hold everything else fixed and measure MB/s at 1, 8, 32 and 64 MB chunks while watching peak RSS. Usually throughput plateaus early; pick the smallest size on the plateau. Then the real speed-up comes from concurrency (several objects or byte ranges in parallel), not from bigger chunks.

The code shape stays the same whatever the size: \`for chunk in iter(lambda: body.read(size), b"")\`, or \`body.iter_chunks(chunk_size=size)\`.`,followUps:[{q:"How do you compute an MD5 of a file without loading it?",a:"`h = hashlib.md5()` then `h.update(chunk)` per chunk, `h.hexdigest()` at the end. Note an S3 ETag of a multipart upload is not the MD5 of the whole object."},{q:"Where does parallelism come from?",a:"Ranged GETs (the Range header) on parts of one object, or several objects at once with a thread pool, since the work is I/O-bound."}],redFlags:["body.read() of a whole multi-GB object","Ignoring the 5 MiB multipart minimum","Tuning chunk size without measuring"]}],Xe=Object.freeze(Object.defineProperty({__proto__:null,default:qe},Symbol.toStringTag,{value:"Module"})),Ie=[{id:"ppvp-differences-concept",level:"mid",kind:"concept",q:"What are the real differences between a pandas DataFrame and a Spark DataFrame, and when do you use each?",a:`**pandas is eager, in-memory and single-machine; Spark is lazy, distributed and immutable.** The APIs look alike, the execution models do not.

- **Where data lives**: pandas holds the whole table in one process's RAM. Spark splits it into partitions across executors, and the driver only holds the plan.
- **Execution**: pandas runs each line immediately. Spark builds a logical plan, Catalyst optimises it (predicate pushdown, column pruning, join selection), and nothing runs until an action.
- **Order and index**: pandas has an index and a stable row order; alignment on the index is implicit in arithmetic. Spark has no index and no row order without \`orderBy\`.
- **Mutability**: pandas lets you assign into a frame. Spark DataFrames are immutable; every transformation returns a new plan.
- **Nulls**: pandas uses NaN/None/NA with dtype-dependent behaviour, drops NaN group keys by default and matches NaN keys in \`merge\`. Spark follows SQL three-valued logic.

I use pandas for data that fits comfortably in memory (a rule of thumb is 5-10x the data size in RAM): exploration, small dimension files, unit-test fixtures, model features after aggregation. I use Spark when the data or the SLA outgrow one machine, or when the data already lives in the lake next to other large tables. In between, DuckDB or Polars on one big machine are often the cheapest answer.`,followUps:[{q:"Is Spark always faster than pandas?",a:"No. For a few hundred MB, Spark pays for scheduling, serialization and shuffles, and pandas finishes first. Spark wins when parallelism over many cores and machines outweighs that fixed overhead."},{q:'What does "lazy" buy you concretely?',a:"Whole-plan optimisation: a filter written after a join can be pushed below it and into the Parquet scan, unused columns are never read, and Spark can pick a broadcast join from table statistics."}],redFlags:['"PySpark is just pandas on many machines"',"Not knowing Spark has no row order","Calling toPandas() on big data as a normal step"]},{id:"ppvp-top3-coding",level:"senior",kind:"coding",q:"Daily revenue per city, keep the top 3 cities per day. Write it in pandas and in PySpark.",a:'**Join, group by (day, city), then rank within each day with a deterministic tie-break.**\n\n```\n# pandas\ndaily = (orders\n         .merge(stores[["store_id", "city"]], on="store_id", how="inner", validate="many_to_one")\n         .assign(day=lambda d: d["ts"].dt.date)\n         .groupby(["day", "city"], as_index=False)["amount"].sum())\ntop3 = (daily.sort_values(["day", "amount", "city"], ascending=[True, False, True])\n             .groupby("day").head(3))\n```\n\n```\n# PySpark\nfrom pyspark.sql import functions as F, Window\n\ndaily = (orders\n         .join(F.broadcast(stores.select("store_id", "city")), "store_id")\n         .groupBy(F.to_date("ts").alias("day"), "city")\n         .agg(F.sum("amount").alias("amount")))\nw = Window.partitionBy("day").orderBy(F.desc("amount"), F.asc("city"))\ntop3 = daily.withColumn("rn", F.row_number().over(w)).where("rn <= 3").drop("rn")\n```\n\nPoints I would call out:\n- `validate="many_to_one"` makes pandas raise if `stores` has duplicate `store_id`s, instead of silently doubling revenue. In Spark I check `stores.groupBy("store_id").count().where("count > 1")` in a data-quality step.\n- The tie-break on `city` makes both outputs deterministic. `row_number` gives exactly 3; `dense_rank` would keep ties.\n- `broadcast` is right because stores is a small dimension; the plan then has one shuffle, for the group-by, plus the window\'s shuffle by `day`, which is cheap because `daily` is small.\n- `to_date` uses the session time zone (`spark.sql.session.timeZone`); `dt.date` uses the timestamps as stored. Make both UTC or both local explicitly.',followUps:[{q:"How would you do the top-3 without a window in pandas?",a:'`daily.groupby("day", group_keys=False).apply(lambda g: g.nlargest(3, "amount"))` works but is slower; sort plus `groupby().head(3)` is vectorised and keeps the tie-break explicit.'},{q:"What if one day has 90% of the orders?",a:"The group-by is fine because Spark pre-aggregates per partition. The window by `day` sees only the small aggregated `daily` table, so skew is not a problem here. It would be if you ranked raw orders by day."}],redFlags:["No tie-break, so results change between runs","Using collect() or toPandas() to rank","Forgetting duplicates in the dimension inflate revenue"]},{id:"ppvp-topandas-oom-debugging",level:"senior",kind:"debugging",q:"A notebook calls toPandas() on a 20 GB Spark DataFrame and the driver dies. Walk me through the cause and the fix.",a:'**`toPandas()` is a collect: every row is shipped to the single driver process and materialised as one pandas DataFrame. 20 GB of Parquet can be 50-150 GB as pandas objects.**\n\nWhat happens: executors serialise their partitions and send them to the driver. Without Arrow, rows are pickled and rebuilt row by row in Python, which is slow and memory-hungry. With `spark.sql.execution.arrow.pyspark.enabled=true` it is columnar and much faster, but still all on one machine. You hit either `spark.driver.maxResultSize` (default 1g, the job fails cleanly) or, if someone raised that limit, a driver OOM or a container kill.\n\nFixes, in order of preference:\n- **Do not collect.** Express the logic in Spark (`groupBy`, windows, joins) and only collect the small final result.\n- **Aggregate or sample first**: `df.groupBy(...).agg(...)` or `df.sample(0.01)` before `toPandas()` for exploration and plots.\n- **Run pandas on the executors**: `df.groupBy("key").applyInPandas(fn, schema)` runs `fn` per group in parallel; `mapInPandas` per batch of a partition. Each group must still fit in one executor\'s memory.\n- **Write, then read in chunks**: write Parquet to S3 and process files one by one with pandas, DuckDB or Polars if a downstream tool truly needs pandas.\n- **pandas API on Spark** (`import pyspark.pandas as ps`) if the team wants pandas syntax with distributed execution.\n\nRaising `maxResultSize` and driver memory is a last resort for results that are big but bounded, say 2-3 GB, not a fix for collecting a table.',followUps:[{q:"Does Arrow fix the OOM?",a:"No. Arrow makes the transfer and conversion faster and leaner, but the full dataset still lands in one process. It helps a 2 GB collect, not a 20 GB one."},{q:"What is the risk with applyInPandas?",a:"Each group is loaded entirely into one Python worker. A skewed key (one customer with 30% of rows) can OOM that worker; salt the key or pre-aggregate."}],redFlags:['"Just increase driver memory"',"Thinking toPandas runs in parallel","Not knowing spark.driver.maxResultSize"]},{id:"ppvp-pandas-memory-tuning",level:"senior",kind:"tuning",q:"A pandas job that loads a 6 GB CSV on a 32 GB machine now runs out of memory. How do you fix it without moving to Spark?",a:'**Cut what you load, shrink how you store it, and stop holding everything at once.**\n\n- **Measure first**: `df.info(memory_usage="deep")` shows the real footprint per column. Object string columns are usually the culprit: each value is a separate Python string with roughly 50 bytes of overhead.\n- **Load less**: `usecols=[...]` for only the needed columns, and filter early. If the source can be Parquet, read it with `columns=` and `filters=` so pruning happens on disk.\n- **Right dtypes at read time**: `dtype={"city": "category", "qty": "int32", "price": "float32"}`. Low-cardinality strings as `category` often shrink 10x or more. On pandas 2.x, `dtype_backend="pyarrow"` or `string[pyarrow]` store strings in Arrow buffers instead of Python objects. Parse dates explicitly.\n- **Stream it**: `pd.read_csv(path, chunksize=1_000_000)` yields frames; aggregate each chunk into a small running result (sum and count, not means) and combine at the end. Memory becomes O(chunk + result).\n- **Avoid copies**: chained operations that create intermediate frames, `apply(axis=1)`, and keeping references to old frames. Copy-on-Write (opt-in in pandas 2.x, default in pandas 3.0) removes many defensive copies.\n- **Change engine on the same box**: DuckDB or Polars can scan the CSV or Parquet directly, use all cores and spill to disk, which often turns an OOM into a minute-long job.\n\nI move to Spark when the data is tens of GB and growing, when it must join with big lake tables, or when one machine cannot meet the SLA.',followUps:[{q:"Why does the CSV take more memory than its size?",a:'Text "12" is 2 bytes; an int64 is 8, and a Python string object is ~50 bytes plus its characters. Parsing also holds intermediate buffers, and many pandas operations return copies.'},{q:"When is category a bad idea?",a:"For high-cardinality columns such as ids: the categories table is as big as the data, and operations that add new values are slower."}],redFlags:["Only suggesting a bigger machine","Never heard of usecols, dtype or chunksize","Averaging chunk averages"]},{id:"ppvp-pandas-on-spark-concept",level:"senior",kind:"concept",q:"What is pandas API on Spark, and what are its gotchas?",a:"**`pyspark.pandas` (formerly Koalas, part of Spark since 3.2) gives a pandas-like API whose operations compile to Spark plans.** `import pyspark.pandas as ps; psdf = ps.read_parquet(path)`, then `groupby`, `merge`, `pivot_table` look like pandas but run distributed. Convert with `psdf.to_spark()` and `sdf.pandas_api()`.\n\nWhen it fits: migrating existing pandas code with minimal rewrites, data scientists who know pandas, and quick distributed exploration.\n\nThe gotchas all come from pandas semantics that are expensive to emulate on an unordered, distributed engine:\n- **The index**: pandas needs one, so pandas-on-Spark attaches a default index (configurable with `compute.default_index_type`), which costs extra work; set `index_col` when reading if you have a natural key.\n- **Order-dependent operations**: `head`, `iloc`, `shift`, `cumsum`, `diff` need a global order. Some trigger a sort or move data to a single partition, which is slow or fails at scale.\n- **Combining two frames** aligns on the index, which means a join under the hood; that is why it is gated by the `compute.ops_on_diff_frames` option.\n- **Some functions are not implemented or behave slightly differently**, so tests that compare with real pandas are worth having.\n- **`to_pandas()`** still collects to the driver.\n\nIn practice I use it for migration and exploration, and write performance-critical jobs in the native DataFrame API, where the plan is explicit and the optimiser has full freedom.",followUps:[{q:"How is that different from applyInPandas?",a:"applyInPandas runs real pandas code on each group inside a Python worker, so you get exact pandas semantics but per-group memory limits. pandas API on Spark never runs pandas per row: it translates your calls into Spark operations."},{q:"How do you check what it actually runs?",a:"`psdf.spark.explain()` prints the underlying Spark plan, so you can spot unexpected sorts, single-partition exchanges or joins."}],redFlags:["Assuming it is pandas running on each executor","Ignoring the default index cost","Using iloc/shift on huge frames without thinking about global order"]},{id:"ppvp-migration-design",level:"staff",kind:"design",q:"Your team runs 200 pandas scripts on one large EC2 box. Data grows 3x a year and the box is at 80% memory. What is your plan?",a:"**Triage by size and value, fix the cheap ones in place, move the heavy ones to a distributed or out-of-core engine, and stop the box being a single point of failure.**\n\n- **Inventory**: for each script, input size, peak memory (`tracemalloc` or `/usr/bin/time -v`), runtime, schedule, owner and downstream consumers. Usually 10-20% of scripts use 80% of the memory.\n- **Quick wins in place** for the long tail: Parquet instead of CSV with column pruning, explicit dtypes, chunked aggregation, removing `apply(axis=1)`. This often buys a year.\n- **Heavy hitters**: if they are SQL-shaped (joins, group-bys), rewrite as Spark SQL or DataFrame jobs on Glue or EMR Serverless, or as DuckDB if they still fit one machine after pruning. Logic that is genuinely pandas-specific (time-series resampling per device, a model per store) moves to `applyInPandas` keyed by the natural grouping.\n- **Shared foundations**: tests that compare old and new outputs on a fixed snapshot (row counts, sums per key, sample diffs), a common I/O layer so scripts stop hard-coding paths, and orchestration (Airflow or Step Functions) instead of cron on the box.\n- **Sequencing**: migrate by dependency order and by risk, run old and new in parallel for a few cycles, and decommission the box last.\n\nTrade-offs to state: Spark adds cluster cost and a learning curve, and is slower for small jobs; DuckDB or Polars are cheap but still one machine; pandas API on Spark lowers rewrite cost but hides performance traps. Pick per workload, not one tool for all 200.",followUps:[{q:"How do you prove the new pipeline is correct?",a:"Run both on the same frozen inputs and compare: row counts, null counts, sums and distinct counts per key, and a full diff on a sample. Differences usually trace back to null handling, time zones or float rounding, so check those first."},{q:"What would you not migrate?",a:"Small, stable scripts that finish in seconds and have no growth. Rewriting them adds risk and cost for no benefit."}],redFlags:['"Rewrite everything in Spark"',"No validation plan for migrated outputs","Ignoring the single-machine failure risk"]}],Qe=Object.freeze(Object.defineProperty({__proto__:null,default:Ie},Symbol.toStringTag,{value:"Module"})),Ne=[{id:"pplj-parse-access-log-coding",level:"mid",kind:"coding",q:"Write a function that parses web access-log lines and returns requests and 5xx error counts per path. Bad lines must not crash it.",a:`**One compiled regex with \`fullmatch\` validates and extracts in one step; a dict accumulates per path; bad lines are counted, not raised.**

\`\`\`
import re
from collections import defaultdict

LINE = re.compile(
    r'(?P<ip>\\S+) \\S+ \\S+ \\[(?P<ts>[^\\]]+)\\] '
    r'"(?P<method>[A-Z]+) (?P<path>[^ ?"]+)[^"]*" '
    r'(?P<status>\\d{3}) (?:\\d+|-)'
)

def summarize(lines):
    stats = defaultdict(lambda: [0, 0])   # path -> [requests, errors]
    bad = 0
    for line in lines:
        m = LINE.match(line.rstrip("\\n"))
        if not m:
            bad += 1
            continue
        row = stats[m["path"]]
        row[0] += 1
        if m["status"].startswith("5"):
            row[1] += 1
    return dict(stats), bad
\`\`\`

Here I use \`match\` rather than \`fullmatch\` on purpose: the combined format has trailing referer and user-agent fields I do not need, and the pattern is anchored at the start. I strip the query string out of the path group so \`/orders?id=7\` and \`/orders?id=8\` aggregate together, which is almost always what the dashboard wants.

It is O(total characters) and O(distinct paths) memory, and it streams, so \`lines\` can be a generator over a 20 GB file. In practice I would also return the bad-line count as a metric and sample a few bad lines into the log, because a sudden jump means the log format changed.`,followUps:[{q:"Why compile the regex outside the function?",a:"Compiling is the expensive part. `re` does cache recently used patterns, but an explicit module-level compiled pattern avoids the cache lookup per line, documents intent and makes it easy to unit test."},{q:"How would you do this on 2 TB of logs in Spark?",a:'Read with `spark.read.text`, extract fields with `F.regexp_extract` (built-in, runs in the JVM, no Python UDF), filter rows where the extracted status is the empty string into a rejected table, then `groupBy("path").agg(count, sum(when(status >= 500)))`. Write the parsed data as Parquet once so later queries do not re-parse text.'},{q:"What changes if lines can contain quotes inside the user agent?",a:'Nginx escapes them as `\\x22`, so `[^"]*` still works. If a format allows escaped quotes, use `"(?:[^"\\\\]|\\\\.)*"`, the standard pattern for a quoted string with backslash escapes.'}],redFlags:['`line.split(" ")` on a format with quoted fields',"Letting one malformed line raise and kill the job","Counting 4xx as server errors","Re-compiling the regex inside the loop"]},{id:"pplj-flatten-json-coding",level:"senior",kind:"coding",q:"Flatten arbitrarily nested JSON into a dict of column paths to values. Then tell me how you would do the same in Spark.",a:`**A depth-first walk that carries the path; containers recurse, everything else is a leaf.**

\`\`\`
def flatten(doc, sep="."):
    out = {}
    def walk(value, path):
        if isinstance(value, dict) and value:
            for k, v in value.items():
                walk(v, f"{path}{sep}{k}" if path else str(k))
        elif isinstance(value, list) and value:
            for i, v in enumerate(value):
                walk(v, f"{path}{sep}{i}")
        else:
            out[path] = value        # includes 0, False, "", None, {} and []
    walk(doc, "")
    return out
\`\`\`

Decisions I would state out loud: empty containers are kept as values so a column does not vanish from the schema; falsy scalars are leaves (checking \`if not value\` is the classic bug); arrays get index paths here, but for analytics I usually **explode** arrays into rows instead, because \`items.0.sku\`, \`items.1.sku\` makes a different schema for every order size.

It is O(total values) time and O(depth) recursion. For untrusted input I would cap depth (Python's default recursion limit is about 1000) or use an explicit stack.

In Spark I never flatten with a Python UDF. I read with an explicit \`StructType\`, then select nested fields directly: \`col("user.geo.city").alias("user_geo_city")\`, \`explode_outer("items")\` for arrays, and a small helper that walks \`df.schema\` to generate the select list for wide structs. That stays in the JVM and keeps column pruning in Parquet.`,followUps:[{q:"What if keys can contain the separator?",a:'Then paths are ambiguous: `{"a.b": 1}` and `{"a": {"b": 1}}` collide. Either choose a separator that cannot occur, escape it, or return tuples of path parts instead of joined strings.'},{q:"How do you handle schema drift, a new nested field appearing?",a:"With an explicit schema new fields are ignored until you add them, which is safe. I also run a cheap `schema_of_json` or a key-set diff on a sample daily and alert on unknown keys, so drift is a ticket, not a silent data loss."}],redFlags:["Using `if not value` to detect leaves","Flattening arrays into `items.0`, `items.1` columns for analytics","Writing a Python UDF in Spark for this","No answer for recursion depth or key collisions"]},{id:"pplj-csv-count-drop-debugging",level:"senior",kind:"debugging",q:"After a vendor changed their CSV export, your daily row count dropped 3% and some columns look shifted. How do you debug it?",a:'**Classic quoting problem. I confirm it from the data, then fix the reader options, then add a guard so it cannot happen silently again.**\n\n- **Reproduce on raw bytes**: pull a few bad rows with `aws s3 cp` and look with `head -c` or a hex dump. I look for quoted fields with embedded commas, embedded newlines, doubled quotes `""`, a BOM at the start, or a delimiter change.\n- **Count records two ways**: physical lines (`wc -l`) versus rows parsed by Python\'s `csv` module. If `csv` gives fewer rows than lines, quoted fields contain newlines, and any line-based reader splits those records.\n- **Check the Spark options**: Spark\'s CSV reader defaults to `escape="\\\\"`, `multiLine=false`. RFC 4180 doubled quotes need `.option("escape", \'"\')`; embedded newlines need `multiLine=true`, which makes each file a single split, so the vendor\'s files should stay small or be split upstream.\n- **Find the lost rows**: read with an explicit schema plus a `_corrupt_record` column in PERMISSIVE mode. Rows that do not fit land there instead of being shifted or dropped.\n\nOnce fixed, I reconcile against the vendor\'s control total (row count in a manifest or trailer) and backfill the affected days by overwriting those partitions.\n\nTo prevent recurrence: an explicit schema (never `inferSchema` in production), a data-quality check comparing row count to the manifest and to the 7-day average, a non-zero corrupt-record check that alerts, and a contract with the vendor on dialect and encoding.',followUps:[{q:"Why not just use inferSchema?",a:'It reads the data an extra time, and the inferred types change when the data changes, so a column of ids can flip from int to string on the day someone types "N/A". An explicit schema fails loudly instead.'},{q:"The file starts with a BOM. What breaks?",a:'The first header becomes `\\ufeffid`, so `row["id"]` raises KeyError or a column goes missing. In Python open with `encoding="utf-8-sig"`; in Spark check the first column name and strip it.'}],redFlags:['Jumping to "increase memory"',"Not counting physical lines vs records","Fixing it by splitting lines on commas","No backfill or prevention step"]},{id:"pplj-regex-safety-concept",level:"mid",kind:"concept",q:"What is the difference between re.match, re.search and re.fullmatch, and what makes a regex dangerous on production logs?",a:'**`match` anchors at the start, `search` finds the pattern anywhere, `fullmatch` must consume the whole string.** For validation I use `fullmatch`, because `match(r"\\d{3}", "2000")` succeeds on the first three digits.\n\nThe danger is **catastrophic backtracking**. Python\'s `re` is a backtracking engine: when a match fails it tries every other way the quantifiers could have split the input. A nested quantifier whose pieces can match the same text, such as `(\\w+\\s?)+$` or `(a|aa)+`, has exponentially many splits, so one long, almost-matching line can pin a CPU for minutes. In a pipeline that looks like a stuck task with no error.\n\nHow I keep patterns safe:\n- Prefer **negated classes** (`[^"]*`, `\\S+`) over `.*`; they cannot cross a delimiter, so there is nothing to backtrack into.\n- Make alternatives **mutually exclusive**, as in `(?:[^"\\\\]|\\\\.)*`.\n- **Anchor** patterns and use `fullmatch`, so failure is detected early.\n- On Python 3.11+, use **atomic groups** `(?>...)` or possessive quantifiers `*+`, `++` to forbid backtracking.\n- Cap line length before matching, and test the pattern against a long adversarial string in unit tests.\n\nFor simple fixed formats, `str.split` or `str.partition` is faster and cannot backtrack at all.',followUps:[{q:"Greedy vs lazy quantifiers?",a:'Greedy `.*` takes as much as possible and gives back; lazy `.*?` takes as little as possible. On `"a" "b"`, `"(.*)"` captures `a" "b`, `"(.*?)"` captures `a`. A negated class `"([^"]*)"` is usually the clearest and fastest.'},{q:"Does Spark have the same risk?",a:"Spark uses Java regex, which is also backtracking, so yes: a bad `regexp_extract` or `rlike` pattern can make one task run for a very long time."}],redFlags:["Thinking `match` checks the whole string","Never having heard of catastrophic backtracking","Using `.*` everywhere"]},{id:"pplj-bad-records-design",level:"staff",kind:"design",q:"Design how malformed records are handled across an ingestion platform with 300 sources.",a:"**Make bad data a first-class, observable output, never an exception and never a silent drop.**\n\n- **Parse per record, at the edge.** Every source has an explicit schema or pattern. A parser returns either a typed record or a rejection with `reason`, `source`, `file`, `offset` and the raw text.\n- **Dead-letter storage, same layout as good data.** Rejections go to `s3://lake/_rejected/<source>/dt=.../` as JSON Lines, partitioned like the main table, with the same retention and access controls (raw text may contain PII). In Spark this is the `_corrupt_record` column split off after reading; in Kafka, a DLQ topic per source.\n- **Metrics and thresholds.** Every run emits total, accepted, rejected and rejection rate per source and reason. Policy per source: warn above the 7-day baseline, block publishing above a hard limit (say 1%), because a jump almost always means an upstream format change. Counts reconcile: accepted + rejected = read.\n- **Replay.** Once the parser is fixed, rejected partitions are re-parsed and merged idempotently into the main table, keyed by event id, so replays never duplicate.\n- **Contracts and ownership.** Each source has an owner and a schema in a registry or repo; breaking changes fail in the producer's CI rather than in our pipeline at 2 a.m.\n\nTrade-offs: strict parsing catches drift early but rejects more; lenient parsing keeps data flowing but hides problems. I default strict on types and keys, lenient on unknown extra fields, which are logged as drift.",followUps:[{q:"Should the job fail on the first bad record?",a:"Not for high-volume sources: a single bad line should not block a whole day. FAILFAST is right for small, critical reference files such as an FX rates file, where one bad row means the whole file is suspect."},{q:"How do you stop the dead-letter area from becoming a graveyard?",a:"Alert on it, show it on the source owner's dashboard, put a ticket per new reason, and expire it with a lifecycle policy after the replay window, for example 30 days."}],redFlags:["`try/except: pass`","Dropping bad rows without counting them","No replay path","Ignoring that raw rejected text may contain PII"]},{id:"pplj-slow-json-tuning",level:"senior",kind:"tuning",q:"A PySpark job that parses raw JSON events is slow. What do you look at and change?",a:"**Usually it is schema inference, Python-side parsing, or re-parsing text every run.**\n\n- **Schema inference**: `spark.read.json(path)` without a schema scans the data to infer types before the real read. Pass an explicit `StructType` (or a DDL string). On large inputs that alone can cut a large share of the runtime, and it makes types stable.\n- **Python UDFs**: `json.loads` inside a UDF ships every row to a Python worker and back. Replace with `F.from_json(col, schema)`, `get_json_object` for one or two fields, and `explode_outer` for arrays; these run in the JVM. If Python is unavoidable, use a pandas UDF with Arrow (see python-udfs-arrow).\n- **multiLine**: `multiLine=true` makes each file one task. Only use it for real multi-line JSON, and ask producers for JSON Lines.\n- **Compression and file layout**: a gzipped JSON file is not splittable, so one 10 GB `.json.gz` is one task. Prefer many files of roughly 128 MB to 1 GB, or bzip2/zstd in splittable containers, or fix the producer.\n- **Parse once**: land the parsed result as Parquet or Delta/Iceberg partitioned by date, and point every downstream job at that. Reading text JSON every time pays the parse cost repeatedly and gets no column pruning.\n\nIn practice I check the Spark UI first: an extra job at the start is inference; a stage with few huge tasks is unsplittable files; long Python worker time is a UDF.",followUps:[{q:"How do you get a schema without inference in production?",a:"Infer once on a representative sample with `schema_of_json` or `df.schema.json()`, review it, commit it to the repo as JSON or DDL, and load it in the job. Changes become code reviews."},{q:"What does from_json do with a malformed string?",a:"In the default PERMISSIVE mode it does not fail the task: the fields come back null. Keep the raw column next to the parsed struct so you can filter and quarantine rows whose required fields are null."}],redFlags:["Using a Python UDF with json.loads","Never having heard of schema inference cost","Re-reading raw JSON in every downstream job","Ignoring gzip splittability"]}],Ze=Object.freeze(Object.defineProperty({__proto__:null,default:Ne},Symbol.toStringTag,{value:"Module"})),Ae=[{id:"ptpc-make-job-testable",level:"mid",kind:"concept",q:"How do you structure a Spark or Glue job so that it is testable?",a:"**Functional core, imperative shell: pure transformation functions in the middle, all I/O in a thin `main`.**\n\n- **Transforms** take DataFrames (or rows) and plain parameters and return DataFrames: `def daily_revenue(orders, stores, run_date): ...`. No `spark.read`, no `write`, no `datetime.now()`, no `os.environ` inside.\n- **The shell** parses arguments (`getResolvedOptions` in Glue, `argparse` elsewhere), builds the SparkSession, reads inputs, calls the transforms in order, writes outputs. It has almost no logic, so it barely needs tests.\n- **Dependencies are parameters**: the run date, config, S3 client, API client and clock are passed in, so a test can pass fixed values or fakes.\n- **Code lives in a package** (`src/etl/...`), not in one script, so tests can import it and CI can build one artifact.\n\nThen the test pyramid follows naturally: many fast pytest unit tests on tiny inputs for the transforms (milliseconds for pure Python, a second or so with a shared local SparkSession), a few integration tests for the shell with moto or a temp directory, and data-quality checks in production for what tests cannot know, such as upstream volume drops.\n\nIn practice the first refactor I do on an untested job is to pull `datetime.now()` and the hard-coded paths out into arguments. That alone makes backfills and tests possible.",followUps:[{q:"What do you not unit test?",a:"Spark itself, boto3 itself, and the thin shell's wiring. I test my logic and my assumptions about the data, and cover the wiring with one end-to-end test on a small sample."},{q:"How small should a transform function be?",a:"One business rule or step that you could name in a code review: dedup latest per key, join to dimensions, compute metrics. Small enough that a five-row test explains it."}],redFlags:['"We test in production"',"Logic at module import time","`datetime.now()` inside transforms","Only end-to-end tests that need AWS"]},{id:"ptpc-pytest-coding",level:"mid",kind:"coding",q:"Write pytest tests for a function that normalises phone numbers, including edge cases and a fixture.",a:`**Parametrize the edge cases so each is its own test; use a fixture for shared data.**

\`\`\`
# tests/test_phone.py
import pytest
from etl.clean import normalize_phone, clean_customers

@pytest.mark.parametrize("raw, expected", [
    ("98765 43210", "+919876543210"),
    ("+91-98765-43210", "+919876543210"),
    ("098765 43210", "+919876543210"),
    ("9123456789", "+919123456789"),      # starts with 91 but is 10 digits
    ("12345 67890", None),                # Indian mobiles start with 6-9
    ("+1 415 555 0100", None),
    ("", None),
    (None, None),
])
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected

@pytest.fixture
def customers():
    return [{"id": 1, "phone": "98765 43210"}, {"id": 2, "phone": "bad"}]

def test_clean_customers_flags_bad_phones(customers):
    good, bad = clean_customers(customers)
    assert [c["id"] for c in good] == [1]
    assert bad == [{"id": 2, "phone": "bad", "reason": "phone"}]

def test_clean_customers_does_not_mutate_input(customers):
    before = [dict(c) for c in customers]
    clean_customers(customers)
    assert customers == before
\`\`\`

Things I point out: pytest rewrites \`assert\` so a failure shows both sides; parametrize ids make the failing case obvious; a function-scoped fixture gives every test a fresh copy, so one test cannot leak state into another; and the non-mutation test catches a class of bugs that only show up when the same data is used twice. I would run this with \`pytest -q\`, and in CI with \`--maxfail\` low and coverage on.`,followUps:[{q:"How do you test that a function raises?",a:'`with pytest.raises(ValueError, match="bad order_id"): parse(...)`. The `match` regex stops the test passing on the wrong error.'},{q:"How do you compare floats?",a:"`assert total == pytest.approx(118.0)`, or better, keep money as integer paise or Decimal so exact comparison is valid."}],redFlags:["One giant test with many asserts and no parametrize","Fixtures that return shared mutable globals","Comparing floats with =="]},{id:"ptpc-spark-test-coding",level:"senior",kind:"coding",q:'Write a pytest setup for PySpark and a test for a "keep the latest record per key" transform.',a:`**One session-scoped local SparkSession in conftest.py; tiny DataFrames built inline; order-insensitive comparison.**

\`\`\`
# tests/conftest.py
import pytest
from pyspark.sql import SparkSession

@pytest.fixture(scope="session")
def spark():
    s = (SparkSession.builder.master("local[2]").appName("tests")
         .config("spark.sql.shuffle.partitions", "2")      # 200 tiny tasks would dominate runtime
         .config("spark.ui.enabled", "false")
         .config("spark.sql.session.timeZone", "UTC")      # same answer on every laptop
         .getOrCreate())
    yield s
    s.stop()

# src/etl/dedup.py
from pyspark.sql import DataFrame, Window, functions as F

def latest_per_key(df: DataFrame, key: str, ts: str, tiebreak: str) -> DataFrame:
    w = Window.partitionBy(key).orderBy(F.col(ts).desc(), F.col(tiebreak).desc())
    return (df.withColumn("_rn", F.row_number().over(w))
              .where("_rn = 1").drop("_rn"))

# tests/test_dedup.py
from pyspark.testing import assertDataFrameEqual     # Spark 3.5+
from etl.dedup import latest_per_key

def test_latest_per_key_keeps_newest(spark):
    df = spark.createDataFrame(
        [("o1", 1, 0, "new"), ("o1", 3, 1, "paid"), ("o2", 2, 2, "new")],
        "order_id string, ts int, _seq int, status string")
    got = latest_per_key(df, "order_id", "ts", tiebreak="_seq")
    expected = spark.createDataFrame(
        [("o1", 3, 1, "paid"), ("o2", 2, 2, "new")], "order_id string, ts int, _seq int, status string")
    assertDataFrameEqual(got, expected)              # ignores row order by default
\`\`\`

Design points: the transform is a pure function from DataFrame to DataFrame, so the test needs no files. The tie-breaker column (an ingestion sequence number) makes the result deterministic when two rows share a timestamp, and there should be a test for exactly that tie. Fixing the session time zone and shuffle partitions makes tests fast and identical across machines. Before Spark 3.5 I would compare \`sorted(df.collect())\` and the schema.`,followUps:[{q:'Why not use dropDuplicates(["order_id"])?',a:"It keeps an arbitrary row per key, not the latest, and which one can change between runs. A window with an explicit order (and tie-breaker) is deterministic."},{q:"How do you keep the suite fast as it grows?",a:"Session fixture, tiny inputs, no Parquet I/O in unit tests, `pytest -n auto` with pytest-xdist (one SparkSession per worker), and marking slow integration tests to run separately."}],redFlags:["A new SparkSession per test","Asserting on row order of a Spark result","Tests that read from real S3"]},{id:"ptpc-mock-vs-fake-concept",level:"senior",kind:"concept",q:"When do you use mock.patch, a hand-written fake, or moto to test code that talks to S3?",a:"**Prefer dependency injection with a small fake for logic, moto for the boto3 shell, and `mock.patch` only when you cannot change the code.**\n\n- **Fake via injection**: the function takes an `s3` argument; the test passes a 20-line class with the same method (`list_objects_v2`) and response shape. Fast, explicit, no patching magic. It only models what you wrote, so keep it close to the real API shape (pagination, `IsTruncated`, `NextContinuationToken`).\n- **moto** (`from moto import mock_aws` in moto 5): real boto3 calls against an in-memory AWS. Best for the I/O layer: create a bucket, upload test files, run the real reader, assert on what was written. Catches mistakes in parameter names and pagination that a fake would happily accept.\n- **`unittest.mock.patch`**: replaces a name at runtime. Useful for legacy code, but brittle: you must patch where the name is **looked up** (`etl.load.boto3`, not `boto3`), and mocks accept any call, so a typo in a method name still passes unless you use `autospec=True`.\n\nAlso, isolate tests from real AWS: set dummy credentials (`AWS_ACCESS_KEY_ID=testing`) and a region in a fixture, so a test can never touch a real account by accident.\n\nIn practice: unit tests use fakes or no I/O at all, a handful of moto tests cover each reader and writer, and one end-to-end test runs in a sandbox account before release.",followUps:[{q:"What is the risk of mocking too much?",a:"Tests start asserting how the code calls things rather than what it produces, so every refactor breaks them while real bugs slip through. Mock at the boundary, assert on outputs."},{q:"How do you test time-dependent code?",a:"Pass `now` or a clock function as a parameter. If that is impossible, `freezegun` or `monkeypatch` on the module that calls `datetime.now`."}],redFlags:["Patching `boto3.client` globally and hoping","Tests that need real AWS credentials","Mocks without autospec that accept any method name"]},{id:"ptpc-works-locally-debugging",level:"senior",kind:"debugging",q:"Tests pass on your laptop and in CI, but the job produces different numbers in Glue. What do you check?",a:"**Environment differences that tests silently fixed: time zone, versions, data shape and ordering.**\n\n- **Time zone**: tests set `spark.sql.session.timeZone=UTC`; the job does not, or the cluster default differs, so `to_date(ts)` shifts events across midnight. Python `datetime.now()` and naive timestamps depend on the machine's zone too.\n- **Library versions**: Glue's bundled PySpark, pandas, pyarrow and boto3 differ from your lock file. Behaviour changes between versions (for example pandas null handling, Spark ANSI mode defaults in Spark 4.0). Pin and install the same versions, or run CI inside the Glue Docker image.\n- **Ordering assumptions**: a test with three rows on `local[2]` returns a stable order; on a cluster `first()`, `dropDuplicates` and `limit` pick different rows. Make ordering explicit.\n- **Data the tests never had**: nulls in keys, duplicates, late events, a new enum value, a schema change upstream. Compare null and distinct counts between test fixtures and a production sample.\n- **Config and paths**: a job parameter defaulting to a different date, a dev path, or job bookmarks in Glue skipping files you expected.\n\nHow I narrow it down: run the same package version against a small production sample locally and in Glue with debug logging of counts after each transform; the first step where counts or sums diverge points to the cause. Then I add that case as a test so it stays fixed.",followUps:[{q:"How do you run tests against Glue's exact runtime?",a:"AWS publishes Glue Docker images (for example `public.ecr.aws/glue/aws-glue-libs`) with the Glue libraries; run pytest inside the matching image in CI."},{q:"What about Python hash randomisation?",a:"String hashes vary per process, so iterating a set of strings can change order between runs. Sort before output, and never depend on set order."}],redFlags:['"It works on my machine"',"Not considering session time zone","Unpinned dependencies"]},{id:"ptpc-slow-suite-tuning",level:"mid",kind:"tuning",q:"Your pipeline test suite takes 25 minutes, so people skip it. How do you make it fast?",a:'**Find where the time goes, then remove fixed costs and I/O.**\n\n- **Measure**: `pytest --durations=20` lists the slowest tests and fixtures. Usually a few fixtures or tests dominate.\n- **One SparkSession**: a `scope="session"` fixture instead of one per test or per module. JVM start-up is seconds each time.\n- **Tiny shuffles**: `spark.sql.shuffle.partitions=1` or `2` for tests; the default 200 means 200 tasks for a five-row DataFrame. Turn off the UI.\n- **No real I/O in unit tests**: build DataFrames with `createDataFrame`, use pure functions for logic, keep Parquet and moto tests to a small integration set.\n- **Split by marker**: `@pytest.mark.slow` for integration tests; run unit tests on every push (`-m "not slow"`) and the full set before merge or nightly.\n- **Parallelise**: `pytest -n auto` with pytest-xdist; each worker gets its own process and SparkSession, so give each a smaller local master.\n- **Fail fast while developing**: `-x`, `--lf` (last failed), `-k pattern`.\n\nA good target is unit tests under a minute locally. In practice the biggest win is almost always moving logic out of Spark-heavy tests into pure-Python functions, which run in microseconds and need no session at all.',followUps:[{q:"Is it OK for tests to share a SparkSession?",a:"Yes, as long as tests do not change global state: if a test sets a conf or registers a temp view, reset it or use unique names."}],redFlags:["Accepting a 25-minute suite as normal","shuffle.partitions left at 200 in tests","Running every test against real AWS"]},{id:"ptpc-ci-cd-design",level:"staff",kind:"design",q:"Design the CI/CD setup for a repo of 40 Spark and Python pipelines that deploy to Glue and EMR Serverless.",a:"**One repo layout, one build that produces versioned artifacts, the same artifact promoted through environments.**\n\n- **Layout**: `src/<package>/` for shared libraries and job modules, `jobs/<name>/main.py` as thin entry points, `tests/unit`, `tests/integration`, `pyproject.toml` with pinned dependencies (a lock file via uv, pip-tools or Poetry).\n- **On every pull request**: `ruff` (lint and format), `mypy` or pyright on the package, unit tests with coverage, then integration tests with a local SparkSession and moto. DAG or workflow definitions get integrity tests (they import, no cycles).\n- **Build once**: a wheel of the package (`python -m build`) tagged with the version or commit SHA, entry scripts, and for EMR Serverless a packed virtualenv (`venv-pack`) built on a matching Amazon Linux image. Upload to an artifacts bucket under the version.\n- **Deploy by reference**: infrastructure as code (Terraform, CDK) points each Glue job at `s3://artifacts/<version>/...` via `--additional-python-modules` or `--extra-py-files`, and EMR Serverless jobs at `spark.archives=...#environment`. Dev on merge, staging automatically, prod with an approval.\n- **Staging gate**: run each changed job on a fixed sample and compare outputs (counts, sums per key) with the current prod version.\n- **Rollback** is redeploying the previous version reference, since artifacts are immutable.\n\nTrade-offs: a monorepo keeps shared code consistent but needs path filters so a change to one job does not rebuild and redeploy all 40; per-job versioning is more flexible but lets shared libraries drift.",followUps:[{q:'How do you avoid "works in CI, fails in Glue" for dependencies?',a:"Pin everything, build wheels for the target platform, and run integration tests inside the Glue or EMR runtime image so the Python, Spark and native library versions match."},{q:"Where do data-quality checks run?",a:"Not in CI, which has no production data: as steps in the pipeline after each write (row counts, freshness, uniqueness, nulls), failing or alerting per the dataset's SLA."}],redFlags:["Copying scripts to S3 by hand","Rebuilding artifacts per environment","No way to roll back","Unpinned dependencies in production"]}],et=Object.freeze(Object.defineProperty({__proto__:null,default:Ae},Symbol.toStringTag,{value:"Module"})),Oe={simple:"Pulling data from a web API means making thousands of requests, and each one mostly **waits** for the network. Doing them one at a time wastes that waiting. Concurrency means having many requests in flight at once, while staying under the API's rate limit and retrying the ones that fail.",analogy:"A restaurant waiter does not stand at the kitchen door until one dish is ready. They take several orders, and pick each dish up when it is done. But the kitchen can only cook so many dishes per minute, so sending more waiters does not help past that point, and shouting the same order again every second makes things worse.",keyPoints:["Network calls are **I/O-bound**: threads or `asyncio` overlap the waiting and give big speedups.","Python's **GIL** lets only one thread run Python code at a time, so CPU-heavy work needs **processes** instead.","APIs return data in **pages**; follow the cursor or a stable key, not a shifting offset, or you skip or repeat records.","Retry only temporary errors (timeouts, 429, 5xx), with **exponential backoff and jitter**, and give up after a few tries.","A **rate limiter** (token bucket) controls requests per second; a pool size or semaphore only controls how many are in flight."],example:{lang:"python",code:`from concurrent.futures import ThreadPoolExecutor
import requests

def fetch(page):
    r = requests.get(URL, params={"page": page}, timeout=10)
    r.raise_for_status()
    return r.json()["items"]

with ThreadPoolExecutor(max_workers=8) as pool:
    pages = list(pool.map(fetch, range(1, 101)))   # 8 requests in flight at once`,note:"Eight threads overlap their network waits, so 100 pages finish roughly eight times faster than a plain loop."},jargon:[{term:"I/O-bound",meaning:"Slow because it waits for the network or disk, not because it computes a lot."},{term:"GIL",meaning:"The Global Interpreter Lock: in standard CPython only one thread runs Python code at any moment."},{term:"asyncio",meaning:"Python's way to run many waiting tasks on one thread by switching between them at each await."},{term:"Backoff",meaning:"Waiting longer after each failed attempt before trying again."},{term:"Rate limit",meaning:"The maximum number of requests an API accepts per second or minute."}],sayThis:"API ingestion is I/O-bound, so I use a thread pool or asyncio with bounded concurrency sized by Little's law, a token bucket to stay under the rate limit, cursor or keyset pagination with checkpoints, and retries with capped exponential backoff and jitter on timeouts, 429s and 5xx only.",prerequisites:["py-generators-large-files"]},tt=Object.freeze(Object.defineProperty({__proto__:null,default:Oe},Symbol.toStringTag,{value:"Module"})),Fe={simple:"A **generator** produces values one at a time, only when you ask for the next one, instead of building a whole list first. That lets a small machine process a file far bigger than its memory: read a line, handle it, forget it, read the next.",analogy:"A list is a buffet: every dish is cooked and laid out before you start, and it needs a big table. A generator is a sushi conveyor: one plate arrives, you take it, the next one comes. The kitchen only ever has a few plates out, however much you eat.",keyPoints:["A function with `yield` returns a **generator**; its body runs only when you loop over it.","Looping over an open file (`for line in f`) already reads **one line at a time**, never the whole file.","Chain generators into a **pipeline** (read, parse, filter, aggregate) and memory stays flat whatever the file size.","A generator is **single-use**: once you have looped through it, it is empty.","`itertools` gives lazy building blocks: `islice` (first N), `chain`, `groupby` (runs), `batched` (chunks)."],example:{lang:"python",code:`def read_amounts(lines):
    for line in lines:
        yield float(line.split(",")[1])    # one value at a time

with open("orders.csv") as f:
    next(f)                                 # skip the header
    total = sum(read_amounts(f))            # flat memory, any file size
print(total)`,note:"Nothing is stored except the running total, so a 50 GB file works the same as a 5 KB one."},jargon:[{term:"Iterable",meaning:"Anything you can loop over: a list, a file, a dict, a generator."},{term:"Iterator",meaning:"The object that hands out the next item each time you call `next()` on it."},{term:"Generator",meaning:"An iterator written as a function with `yield`, or as `(x for x in ...)`."},{term:"Lazy",meaning:"Work happens only when a value is actually needed."},{term:"JSON Lines",meaning:"A file with one JSON object per line, easy to stream."}],sayThis:"I would stream it: iterate the file line by line through a chain of generators that parse, filter and aggregate, so memory is O(1) per record plus whatever state I aggregate into, not O(file size).",prerequisites:["py-complexity-and-data-structures"]},at=Object.freeze(Object.defineProperty({__proto__:null,default:Fe},Symbol.toStringTag,{value:"Module"})),Re={simple:"**pandas** works on a table that sits in the memory of one computer, and does each step the moment you ask. **PySpark** splits a table across many computers and only runs the work when you ask for a result. The code looks similar, but they behave differently once data gets big.",analogy:"pandas is cooking dinner in your own kitchen: quick, flexible, everything within reach, but the fridge only holds so much. PySpark is a catering company: it takes planning and a team, but it can feed ten thousand people because the work is split across many kitchens.",keyPoints:["pandas keeps all data in one machine's RAM and usually needs **5 to 10 times** the file size in memory.","PySpark is **lazy**: transformations only build a plan; an action like `count()` or `write` runs it on the cluster.","A pandas DataFrame has an **index** and a row order; a Spark DataFrame has neither unless you sort.","They treat missing values differently: pandas `groupby` drops NaN keys by default and `merge` matches NaN to NaN; Spark keeps null groups and never joins null to null.","`toPandas()` pulls the whole Spark table into one machine, so only use it on small results."],example:{lang:"python",code:`# pandas: runs immediately, on this machine
daily = df.groupby("city", as_index=False)["amount"].sum()

# PySpark: builds a plan; .show() runs it on the cluster
from pyspark.sql import functions as F
daily = sdf.groupBy("city").agg(F.sum("amount").alias("amount"))
daily.show()`,note:"The same aggregation in both libraries. Only the PySpark version scales past one machine's memory."},jargon:[{term:"DataFrame",meaning:"A table with named columns, in memory (pandas) or spread across a cluster (Spark)."},{term:"Index",meaning:"pandas' row labels, used for alignment and lookups. Spark has no equivalent."},{term:"Lazy evaluation",meaning:"Recording the steps first and running them only when a result is needed."},{term:"Driver",meaning:"The single Spark process that runs your script; toPandas() brings data back to it."},{term:"Arrow",meaning:"A columnar memory format that lets Spark and pandas swap data quickly."}],sayThis:"pandas is an eager, single-machine, in-memory DataFrame library, great up to a few GB; PySpark is a lazy, distributed engine for data that does not fit on one machine. I prototype in pandas, and when the data or the SLA outgrows one box I move to Spark or use pandas UDFs to run pandas logic per group on the cluster.",prerequisites:["py-hashmaps-counting","rdd-dataframe-dataset"]},st=Object.freeze(Object.defineProperty({__proto__:null,default:Re},Symbol.toStringTag,{value:"Module"})),Ee={simple:"Data rarely arrives as neat tables. It arrives as **log lines**, **JSON** documents and **CSV** files written by other people. Parsing means turning that text into records with known fields and types, and putting the lines you cannot read somewhere safe instead of crashing.",analogy:'A post-office sorter reads every envelope. Most addresses are clear and go into the right bin. A smudged one is not thrown away and does not stop the line: it goes into a "check by hand" tray, and someone counts how full that tray gets each day.',keyPoints:["Use a **regular expression** with `fullmatch` to check that a log line has exactly the shape you expect, and named groups to pull out its fields.","**JSON Lines** means one JSON object per line, so one broken line costs one record, not the whole file.","Nested JSON is **flattened** into columns, and arrays are **exploded** into one row per element.","Never split CSV on commas yourself: quoted fields can contain commas, quotes and even newlines. Use the `csv` module.","Bad lines go to a **dead-letter** place with the reason, and you alert when their share grows."],example:{lang:"python",code:`import re, json

LINE = re.compile(r"(?P<method>[A-Z]+) (?P<path>/\\S*) (?P<status>\\d{3})")
m = LINE.fullmatch("GET /orders 200")
print(m.groupdict())          # {'method': 'GET', 'path': '/orders', 'status': '200'}

doc = json.loads('{"user": {"id": 7}, "items": []}')
print(doc["user"]["id"], doc.get("coupon"))   # 7 None`,note:"A regex checks and splits one log line; json.loads turns a JSON string into dicts and lists."},jargon:[{term:"Regex",meaning:'A small pattern language for matching text, such as "three digits" or "anything up to a quote".'},{term:"JSON Lines",meaning:"A file with one complete JSON object on each line."},{term:"Flatten",meaning:"Turn nested fields like user.geo.city into plain column names."},{term:"Explode",meaning:"Turn one record with a list of items into one row per item."},{term:"Dead-letter queue",meaning:"A place where records that failed to parse are kept, with the error, for later review."}],sayThis:"I parse each record independently with a strict pattern or schema, convert types and time zones at the edge, and route anything that does not fit to a dead-letter location with the reason, so one bad line never fails the batch and I can alert on the bad-record rate.",prerequisites:["py-generators-large-files"]},rt=Object.freeze(Object.defineProperty({__proto__:null,default:Ee},Symbol.toStringTag,{value:"Module"})),Ce={simple:"Pipeline code is testable when the logic that changes data lives in small functions that take data in and return data out, without touching S3, databases or the clock. Then a test can call the function with five rows and check the answer in milliseconds, instead of running the whole job.",analogy:"A car factory tests the brakes on a test bench before they are fitted to a car. Bolting every part on first and then taking the whole car for a drive is slower, and when it fails you do not know which part broke.",keyPoints:["Keep **I/O at the edges** (read, write, call APIs) and the **logic in the middle** as pure functions.","A **pytest** test is just a function named `test_...` that uses `assert`.","**Fixtures** give tests ready-made things they need, such as a temporary folder or a local Spark session.","Replace real services with **fakes** passed in as arguments, so tests never need AWS credentials or the network.","Package the code as a proper Python project so the same tested version runs in CI, Glue and EMR."],example:{lang:"python",code:`def add_tax(rows, rate):              # pure: no I/O, no globals
    return [{**r, "total": round(r["amount"] * (1 + rate), 2)} for r in rows]

def test_add_tax():                    # pytest finds and runs this
    got = add_tax([{"amount": 100.0}], 0.18)
    assert got == [{"amount": 100.0, "total": 118.0}]`,note:"The function never touches files or the network, so the test needs no setup and runs instantly."},jargon:[{term:"Pure function",meaning:"A function whose output depends only on its inputs and which changes nothing outside itself."},{term:"pytest",meaning:"The most common Python test runner: it finds test functions and reports which assertions failed."},{term:"Fixture",meaning:"Reusable setup for tests, such as sample data or a temporary directory."},{term:"Mock / fake",meaning:"A stand-in for a real service (S3, an API) that behaves predictably in tests."},{term:"Type hint",meaning:"A note like `rows: list[dict]` that tools check; Python itself does not enforce it."}],sayThis:"I keep transformations as pure, typed functions and push I/O to a thin shell, so most tests are fast pytest unit tests on small inputs. I inject clients and clocks so I can pass fakes, run a few integration tests with a local SparkSession and moto, and ship the code as a versioned package through CI.",prerequisites:["py-parsing-logs-json"]},nt=Object.freeze(Object.defineProperty({__proto__:null,default:Ce},Symbol.toStringTag,{value:"Module"}));export{Le as P,We as a,Ue as b,Ge as c,Me as d,He as e,Ve as f,Ye as g,Ke as h,$e as i,Xe as j,Qe as k,Ze as l,et as m,tt as n,at as o,st as p,Je as q,rt as r,nt as s};
