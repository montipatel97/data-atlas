const a=[{id:"py-lab-two-sum-voucher",title:"Two orders that add up to a voucher",difficulty:"easy",topic:"py-hashmaps-counting",tags:["hash map","two-sum","lookup"],askedAt:["Amazon","Google"],prompt:"Write `two_sum(amounts, target)` that returns the indices `[i, j]` (with `i < j`) of two different orders whose amounts add up to `target`.\n\n**Tie-break:** if several pairs work, return the one with the smallest `j`; among those, the smallest `i`. Return `[]` if no pair exists. An order cannot be paired with itself.\n\nExample: `two_sum([20, 70, 30, 50], 100)` returns `[1, 2]` (70 + 30).\n\nConstraints: up to 10^5 amounts; values can be negative, zero or repeated. Aim for O(n).",starter:`def two_sum(amounts, target):
    # your code here
    pass
`,solution:`def two_sum(amounts, target):
    first_seen = {}  # amount -> first index where it appeared
    for j, x in enumerate(amounts):
        need = target - x
        if need in first_seen:
            return [first_seen[need], j]
        if x not in first_seen:
            first_seen[x] = j
    return []
`,tests:[{call:"two_sum([20, 70, 30, 50], 100)"},{call:"two_sum([5, 5], 10)"},{call:"two_sum([5], 10)"},{call:"two_sum([], 0)"},{call:"two_sum([3, 3, 3], 6)"},{call:"two_sum([-4, 10, 4, 0], 0)"},{call:"two_sum([1, 4, 7, 6, 3], 10)",hidden:!0},{call:"two_sum(list(range(100000)), 199997)",hidden:!0}],hints:['For each amount `x` the partner you need is `target - x`. Which structure answers "have I seen this value?" in O(1)?',"Scan left to right with a dict `amount -> first index`. Check for the partner before you store `x`, so an order never pairs with itself."],explanation:"One pass with a dict from amount to the first index it appeared at. At position `j`, if `target - x` is already in the dict the pair is complete. Scanning left to right gives the smallest `j`; keeping only the first index of each amount gives the smallest `i`.\n\nTime O(n), space O(n).\n\nTraps: storing `x` before checking (pairs an order with itself when `2 * x == target`), and overwriting the stored index with a later duplicate, which breaks the tie-break. The O(n^2) double loop is the answer the interviewer wants you to move past."},{id:"py-lab-first-unique-user",title:"First user who visited exactly once",difficulty:"easy",topic:"py-hashmaps-counting",tags:["hash map","counting","Counter"],askedAt:["Amazon"],prompt:'Write `first_unique(user_ids)` that returns the first id (in input order) that appears exactly once in the list. Return `None` if every id repeats or the list is empty.\n\nExample: `first_unique(["u3", "u1", "u3", "u2", "u1"])` returns `"u2"`.\n\nConstraints: up to 10^5 ids, any hashable values. Aim for O(n).',starter:`def first_unique(user_ids):
    # your code here
    pass
`,solution:`from collections import Counter

def first_unique(user_ids):
    counts = Counter(user_ids)
    for uid in user_ids:
        if counts[uid] == 1:
            return uid
    return None
`,tests:[{call:'first_unique(["u3", "u1", "u3", "u2", "u1"])'},{call:'first_unique(["a", "a"])'},{call:"first_unique([])"},{call:'first_unique(["x"])'},{call:"first_unique([7, 3, 7, 3, 9, 4])"},{call:'first_unique(["b", "a", "b", "c", "a", "c", "d"])',hidden:!0},{call:"first_unique([1] * 50000 + [2, 3])",hidden:!0}],hints:["You cannot know an id is unique until you have seen the whole list. Count first.","Pass 1: `Counter(user_ids)`. Pass 2: walk the list in order and return the first id whose count is 1."],explanation:'Two passes: count every id with `Counter`, then walk the original list and return the first id with count 1. Walking the list (not the Counter) is what preserves input order.\n\nTime O(n), space O(d) for d distinct ids.\n\nTraps: calling `user_ids.count(x)` inside the loop (O(n^2)), and a single-pass "seen" set that returns an id before you know it repeats later.'},{id:"py-lab-dedupe-keep-first",title:"Deduplicate ids, keep first-seen order",difficulty:"easy",topic:"py-hashmaps-counting",tags:["set","dedup","order preserving"],prompt:'Write `dedupe(ids)` that returns a new list with duplicates removed, keeping the first occurrence of each value and the original order.\n\nExample: `dedupe([3, 1, 3, 2, 1])` returns `[3, 1, 2]`.\n\nConstraints: up to 10^5 hashable values. Comparison is exact (`"a"` and `"A"` are different). Aim for O(n).',starter:`def dedupe(ids):
    # your code here
    pass
`,solution:`def dedupe(ids):
    seen = set()
    out = []
    for x in ids:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
`,tests:[{call:"dedupe([3, 1, 3, 2, 1])"},{call:"dedupe([])"},{call:'dedupe(["a", "A", "a"])'},{call:"dedupe([5, 5, 5])"},{call:'dedupe(["x", "y", "z", "y", "x", "w"])'},{call:"dedupe(list(range(1000)) * 3) == list(range(1000))",hidden:!0},{call:"dedupe([0, -1, 0, -1, 2])",hidden:!0}],hints:["`list(set(ids))` removes duplicates but loses the order. Keep a set for membership and a list for the output.","A one-liner also works: dicts keep insertion order, so `list(dict.fromkeys(ids))`."],explanation:'A set answers "seen before?" in O(1) and a list keeps first-seen order. `list(dict.fromkeys(ids))` does the same in one line because dicts preserve insertion order (Python 3.7+).\n\nTime O(n), space O(n).\n\nTraps: `list(set(ids))` scrambles order, and `if x not in out` on a list makes it O(n^2). This is the in-memory version of `ROW_NUMBER() ... = 1` dedup.'},{id:"py-lab-distinct-pages-per-user",title:"COUNT(DISTINCT page) per user",difficulty:"easy",topic:"py-hashmaps-counting",tags:["defaultdict","set","group by"],prompt:'Write `distinct_pages(events)` where `events` is a list of `(user, page)` tuples. Return a dict mapping each user to the number of distinct pages they viewed, like `SELECT user, COUNT(DISTINCT page) ... GROUP BY user`.\n\nExample: `distinct_pages([("u1", "/home"), ("u1", "/cart"), ("u1", "/home"), ("u2", "/home")])` returns `{"u1": 2, "u2": 1}`.\n\nConstraints: up to 10^5 events. Users with no events do not appear. Return `{}` for no events.',starter:`def distinct_pages(events):
    # your code here
    pass
`,solution:`from collections import defaultdict

def distinct_pages(events):
    pages = defaultdict(set)
    for user, page in events:
        pages[user].add(page)
    return {user: len(s) for user, s in pages.items()}
`,tests:[{call:'distinct_pages([("u1", "/home"), ("u1", "/cart"), ("u1", "/home"), ("u2", "/home")])'},{call:"distinct_pages([])"},{call:'distinct_pages([("a", "/x")] * 4)'},{call:'distinct_pages([("a", "/x"), ("b", "/x"), ("c", "/y"), ("a", "/y")])'},{call:'distinct_pages([("u", "/A"), ("u", "/a")])'},{call:'distinct_pages([("u%d" % (i % 3), "/p%d" % (i % 7)) for i in range(100)])',hidden:!0}],hints:["Group pages by user in a `defaultdict(set)`; a set ignores repeat views.","Finish with a dict comprehension of `len()` per user."],explanation:"`defaultdict(set)` is a hash aggregate: one pass adds each page to its user's set, then the answer is the size of each set.\n\nTime O(n), space O(number of distinct (user, page) pairs).\n\nTrap: counting events instead of distinct pages (a `Counter` of users). At Spark scale the same query is `countDistinct` or `approx_count_distinct` (HyperLogLog) when exact distinct counts are too expensive."},{id:"py-lab-group-anagrams",title:"Group anagrams",difficulty:"medium",topic:"py-hashmaps-counting",tags:["hash map","grouping","canonical key"],askedAt:["Amazon","Microsoft"],prompt:'Write `group_anagrams(words)` that groups words that are anagrams of each other (same letters, same counts).\n\n**Output format:** a list of groups. Each group is sorted alphabetically (duplicates kept), and the groups are ordered by their first word.\n\nExample: `group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"])` returns `[["ate", "eat", "tea"], ["bat"], ["nat", "tan"]]`.\n\nConstraints: up to 10^4 words of lowercase letters, each up to 100 characters. The empty string is a valid word.',starter:`def group_anagrams(words):
    # your code here
    pass
`,solution:`from collections import defaultdict

def group_anagrams(words):
    groups = defaultdict(list)
    for w in words:
        groups["".join(sorted(w))].append(w)
    return sorted(sorted(g) for g in groups.values())
`,tests:[{call:'group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"])'},{call:"group_anagrams([])"},{call:'group_anagrams([""])'},{call:'group_anagrams(["a"])'},{call:'group_anagrams(["abc", "bca", "cab", "abc"])'},{call:'group_anagrams(["listen", "silent", "enlist", "google", "gogole", "x"])',hidden:!0},{call:'group_anagrams(["ab", "ba", "abc", "a", "b"])',hidden:!0}],hints:["Two words are anagrams exactly when they have the same canonical form. What canonical form can you compute from a word?",'Use `"".join(sorted(w))` (or a 26-letter count tuple) as a dict key, append each word to its key\'s list, then sort for the output format.'],explanation:"Map every word to a canonical key (its sorted letters) and group by that key in a `defaultdict(list)`. Sorting each group and then the list of groups gives the required deterministic order.\n\nTime O(n * L log L) for n words of length L (a letter-count tuple key makes it O(n * L)), space O(n * L).\n\nTraps: using a `set` per group (drops duplicate words), and returning `groups.values()` unsorted, which depends on insertion order and fails the format rule."},{id:"py-lab-subarray-sum-k",title:"Count windows that sum to exactly k",difficulty:"medium",topic:"py-hashmaps-counting",tags:["prefix sum","hash map","counting"],askedAt:["Amazon","Microsoft"],prompt:"Write `count_windows(values, k)` that returns how many contiguous, non-empty sub-lists of `values` sum to exactly `k`. Think of `values` as daily net balance changes and `k` as a target movement.\n\nExample: `count_windows([1, 1, 1], 2)` returns `2` (positions 0-1 and 1-2).\n\nConstraints: up to 2 * 10^4 values; values may be negative or zero, so a shrinking sliding window does not work. Aim for O(n).",starter:`def count_windows(values, k):
    # your code here
    pass
`,solution:`from collections import defaultdict

def count_windows(values, k):
    seen = defaultdict(int)  # prefix sum -> how many times it occurred
    seen[0] = 1
    running = 0
    total = 0
    for v in values:
        running += v
        total += seen[running - k]
        seen[running] += 1
    return total
`,tests:[{call:"count_windows([1, 1, 1], 2)"},{call:"count_windows([1, 2, 3], 3)"},{call:"count_windows([], 0)"},{call:"count_windows([0, 0, 0], 0)"},{call:"count_windows([3, 4, 7, 2, -3, 1, 4, 2], 7)"},{call:"count_windows([1, -1, 1, -1], 0)",hidden:!0},{call:"count_windows([1] * 2000, 1000)",hidden:!0}],hints:["The sum of `values[i:j]` equals `prefix[j] - prefix[i]`. So you want pairs of prefix sums that differ by `k`.","Keep a dict counting how often each prefix sum has occurred. At each step, add `seen[running - k]` to the answer, then record `running`.","Seed the dict with `{0: 1}` so windows starting at index 0 are counted."],explanation:'Prefix sums turn "window sums to k" into "two prefix sums differ by k". Walking left to right, the number of windows ending here is the number of earlier prefixes equal to `running - k`, which a dict of counts answers in O(1).\n\nTime O(n), space O(n).\n\nTraps: a two-pointer window (only correct for non-negative values), forgetting the `{0: 1}` seed, and recording the current prefix before looking it up (over-counts when k == 0).'},{id:"py-lab-longest-login-streak",title:"Longest streak of consecutive active days",difficulty:"medium",topic:"py-hashmaps-counting",tags:["set","consecutive sequence","O(n)"],askedAt:["Amazon","Google"],prompt:"Write `longest_streak(days)` where `days` is an unsorted list of day numbers (ints, possibly repeated) on which a user was active. Return the length of the longest run of consecutive day numbers.\n\nExample: `longest_streak([100, 4, 200, 1, 3, 2])` returns `4` (days 1, 2, 3, 4).\n\nConstraints: up to 10^5 days, values may be negative. Return `0` for an empty list. Aim for O(n) without sorting.",starter:`def longest_streak(days):
    # your code here
    pass
`,solution:`def longest_streak(days):
    active = set(days)
    best = 0
    for d in active:
        if d - 1 not in active:  # d starts a streak
            end = d
            while end + 1 in active:
                end += 1
            best = max(best, end - d + 1)
    return best
`,tests:[{call:"longest_streak([100, 4, 200, 1, 3, 2])"},{call:"longest_streak([])"},{call:"longest_streak([5, 5, 5])"},{call:"longest_streak([0, 3, 7, 2, 5, 8, 4, 6, 0, 1])"},{call:"longest_streak([-2, -1, 0, 10])"},{call:"longest_streak([10, 9, 8, 1, 2])",hidden:!0},{call:"longest_streak(list(range(0, 100000, 2)) + [1])",hidden:!0}],hints:['Put the days in a set so "is day x active?" is O(1). Duplicates disappear too.',"Only start counting from a day `d` when `d - 1` is not in the set: that day is the start of a streak. Then walk forward."],explanation:`Build a set, and only expand from streak starts (\`d - 1\` not present). Each day is visited once as a start check and at most once while walking a streak, so the total work is linear.

Time O(n), space O(n). Sorting first is a fine O(n log n) answer to mention, but the interviewer usually asks for O(n).

Traps: expanding from every day (O(n^2) on one long streak), and counting duplicate days twice.`},{id:"py-lab-co-purchase-pair",title:"Most frequently co-purchased pair",difficulty:"medium",topic:"py-hashmaps-counting",tags:["Counter","combinations","market basket"],prompt:'Write `top_pair(baskets)` where each basket is a list of item names. For every unordered pair of distinct items, count the number of baskets that contain both (an item repeated inside one basket counts once). Return the pair with the highest count as a tuple `(a, b)` with `a < b`.\n\n**Tie-break:** among pairs with the same count, return the smallest tuple (compare `a`, then `b`). Return `None` if no basket has two distinct items.\n\nExample: `top_pair([["milk", "bread"], ["bread", "milk", "eggs"], ["eggs", "milk"]])` returns `("bread", "milk")`: both (bread, milk) and (eggs, milk) appear twice, and "bread" < "eggs".\n\nConstraints: up to 10^4 baskets with at most 20 items each.',starter:`def top_pair(baskets):
    # your code here
    pass
`,solution:`from collections import Counter
from itertools import combinations

def top_pair(baskets):
    counts = Counter()
    for basket in baskets:
        for pair in combinations(sorted(set(basket)), 2):
            counts[pair] += 1
    if not counts:
        return None
    return min(counts, key=lambda p: (-counts[p], p))
`,tests:[{call:'top_pair([["milk", "bread"], ["bread", "milk", "eggs"], ["eggs", "milk"]])'},{call:"top_pair([])"},{call:'top_pair([["a"], ["a", "a"]])'},{call:'top_pair([["x", "y", "x"]])'},{call:'top_pair([["c", "b", "a"]])'},{call:'top_pair([["p", "q"], ["r", "s"], ["r", "s"], ["p", "q", "r"]])',hidden:!0},{call:'top_pair([["b", "c"], ["a", "c"], ["c", "b"]])',hidden:!0}],hints:["Deduplicate and sort each basket first, so every pair comes out once and already in `(a, b)` with `a < b` order.","`itertools.combinations(sorted_items, 2)` yields the pairs; count them in a `Counter`.","Pick the answer with `min(counts, key=lambda p: (-counts[p], p))` to apply the tie-break in one step."],explanation:"For each basket, `combinations(sorted(set(basket)), 2)` emits each unordered pair once in canonical order, and a `Counter` tallies them. A single `min` with key `(-count, pair)` returns the highest count with the smallest tuple.\n\nTime O(B * m^2) for B baskets of up to m items, space O(number of distinct pairs).\n\nTraps: not deduplicating inside a basket (inflates counts), counting `(a, b)` and `(b, a)` separately, and `Counter.most_common(1)`, whose tie order is insertion order rather than the required tie-break."},{id:"py-lab-lru-cache",title:"Simulate an LRU cache",difficulty:"medium",topic:"py-hashmaps-counting",tags:["OrderedDict","LRU","design"],askedAt:["Amazon","Microsoft","Flipkart"],prompt:'Write `lru_run(capacity, ops)` that simulates a least-recently-used cache and returns the results of the `get` operations in order.\n\n- `("put", key, value)` inserts or updates `key`. If inserting a new key would exceed `capacity`, first evict the least recently used key.\n- `("get", key)` returns the value, or `-1` if the key is not cached.\n- Both a successful `get` and any `put` make that key the most recently used.\n\nExample: `lru_run(2, [("put", 1, 1), ("put", 2, 2), ("get", 1), ("put", 3, 3), ("get", 2)])` returns `[1, -1]`: the `get` of 1 made key 2 the least recent, so `put 3` evicted it.\n\nConstraints: `capacity >= 1`, up to 10^5 operations. Each operation should be O(1).',starter:`def lru_run(capacity, ops):
    # your code here
    pass
`,solution:`from collections import OrderedDict

def lru_run(capacity, ops):
    cache = OrderedDict()
    out = []
    for op in ops:
        if op[0] == "get":
            key = op[1]
            if key in cache:
                cache.move_to_end(key)
                out.append(cache[key])
            else:
                out.append(-1)
        else:
            _, key, value = op
            if key in cache:
                cache.move_to_end(key)
            elif len(cache) == capacity:
                cache.popitem(last=False)
            cache[key] = value
    return out
`,tests:[{call:'lru_run(2, [("put", 1, 1), ("put", 2, 2), ("get", 1), ("put", 3, 3), ("get", 2), ("put", 4, 4), ("get", 1), ("get", 3), ("get", 4)])'},{call:'lru_run(1, [("put", "a", 1), ("put", "b", 2), ("get", "a"), ("get", "b")])'},{call:'lru_run(2, [("put", "a", 1), ("put", "b", 2), ("put", "a", 10), ("put", "c", 3), ("get", "a"), ("get", "b"), ("get", "c")])'},{call:"lru_run(3, [])"},{call:'lru_run(2, [("get", "x")])'},{call:'lru_run(2, [("put", "a", 1), ("put", "b", 2), ("get", "a"), ("put", "c", 3), ("get", "b"), ("get", "a"), ("get", "c")])',hidden:!0},{call:'lru_run(3, [("put", i, i) for i in range(1000)] + [("get", i) for i in range(995, 1000)])',hidden:!0}],hints:['You need O(1) lookup and O(1) "move to most recent" plus "remove least recent". A dict alone gives the first; what keeps order?',"`collections.OrderedDict` has `move_to_end(key)` and `popitem(last=False)`. Treat the front as least recent.","Updating an existing key must not evict anything; only a brand-new key at full capacity does."],explanation:"An `OrderedDict` is a hash map plus a doubly linked list: `move_to_end` marks a key as most recent and `popitem(last=False)` evicts the least recent, both O(1). In an interview you may be asked to build the linked list yourself; the logic is identical.\n\nTime O(1) per operation, space O(capacity).\n\nTraps: evicting when updating an existing key, forgetting that `get` refreshes recency, and using a list for recency order (O(n) removals)."}],s=Object.freeze(Object.defineProperty({__proto__:null,default:a},Symbol.toStringTag,{value:"Module"})),i=[{id:"py-lab-clean-palindrome",title:"Palindrome check on a messy id",difficulty:"easy",topic:"py-two-pointers-sliding-window",tags:["two pointers","strings"],prompt:'Write `is_palindrome(s)` that returns `True` if `s` reads the same forwards and backwards after ignoring case and every character that is not a letter or digit (`str.isalnum()` is False).\n\nExample: `is_palindrome("A man, a plan, a canal: Panama")` returns `True`; `is_palindrome("race a car")` returns `False`.\n\nConstraints: up to 2 * 10^5 characters. A string with no letters or digits counts as a palindrome. Try to use O(1) extra space.',starter:`def is_palindrome(s):
    # your code here
    pass
`,solution:`def is_palindrome(s):
    i, j = 0, len(s) - 1
    while i < j:
        if not s[i].isalnum():
            i += 1
        elif not s[j].isalnum():
            j -= 1
        elif s[i].lower() != s[j].lower():
            return False
        else:
            i += 1
            j -= 1
    return True
`,tests:[{call:'is_palindrome("A man, a plan, a canal: Panama")'},{call:'is_palindrome("race a car")'},{call:'is_palindrome("")'},{call:'is_palindrome("  !! ")'},{call:'is_palindrome("ab_a")'},{call:'is_palindrome("0P")',hidden:!0},{call:'is_palindrome("Was it a car or a cat I saw?")',hidden:!0}],hints:["Put one pointer at each end and move them towards each other.","Skip characters that are not alphanumeric on either side, then compare lowercased characters."],explanation:'Two pointers from both ends skip non-alphanumeric characters and compare case-insensitively; the first mismatch proves it is not a palindrome.\n\nTime O(n), space O(1). The one-liner `t = [c.lower() for c in s if c.isalnum()]; t == t[::-1]` is also O(n) but uses O(n) memory, which is fine to mention as the first version.\n\nTraps: treating `_` as a letter (it is not alphanumeric), and comparing digits with letters after lowercasing (`"0P"` is not a palindrome).'},{id:"py-lab-busiest-window",title:"Busiest k-minute window",difficulty:"easy",topic:"py-two-pointers-sliding-window",tags:["fixed window","running sum"],prompt:"Write `busiest_window(counts, k)` where `counts[i]` is the number of requests in minute `i`. Return the largest total over any `k` consecutive minutes.\n\nExample: `busiest_window([3, 1, 4, 1, 5, 9, 2], 3)` returns `16` (minutes 4-6: 5 + 9 + 2).\n\nConstraints: `k >= 1`; up to 10^5 minutes; counts may be negative (they are corrections). Return `None` if there are fewer than `k` minutes. Aim for O(n).",starter:`def busiest_window(counts, k):
    # your code here
    pass
`,solution:`def busiest_window(counts, k):
    if len(counts) < k:
        return None
    window = sum(counts[:k])
    best = window
    for i in range(k, len(counts)):
        window += counts[i] - counts[i - k]
        best = max(best, window)
    return best
`,tests:[{call:"busiest_window([3, 1, 4, 1, 5, 9, 2], 3)"},{call:"busiest_window([5], 1)"},{call:"busiest_window([1, 2], 3)"},{call:"busiest_window([], 1)"},{call:"busiest_window([-1, -2, -3], 2)"},{call:"busiest_window([0, 0, 0, 0], 4)"},{call:"busiest_window([1, 3, 2, 6, -1, 4, 1, 8, 2], 5)",hidden:!0},{call:"busiest_window([2] * 100000, 1000)",hidden:!0}],hints:["Recomputing `sum(counts[i:i + k])` for every window is O(n * k). What changes between two neighbouring windows?","Slide: add the minute entering the window and subtract the one leaving it. Start `best` from the first window, not from 0."],explanation:"A fixed-size sliding window keeps a running sum: each step adds `counts[i]` and removes `counts[i - k]`, so every window costs O(1).\n\nTime O(n), space O(1).\n\nTraps: initialising `best = 0` (wrong when all totals are negative), off-by-one on the first window, and the O(n * k) re-summing version."},{id:"py-lab-moving-average",title:"Moving average of a metric",difficulty:"easy",topic:"py-two-pointers-sliding-window",tags:["fixed window","rolling metric"],prompt:"Write `moving_average(values, k)` that returns the average of every window of `k` consecutive values, starting with the window that ends at index `k - 1`. Round each average to 2 decimal places with `round(x, 2)`.\n\nExample: `moving_average([1, 2, 3, 4, 5], 2)` returns `[1.5, 2.5, 3.5, 4.5]`.\n\nConstraints: `k >= 1`; up to 10^5 integer values. Return `[]` if there are fewer than `k` values. Aim for O(n), not O(n * k).",starter:`def moving_average(values, k):
    # your code here
    pass
`,solution:`def moving_average(values, k):
    if len(values) < k:
        return []
    window = sum(values[:k])
    out = [round(window / k, 2)]
    for i in range(k, len(values)):
        window += values[i] - values[i - k]
        out.append(round(window / k, 2))
    return out
`,tests:[{call:"moving_average([1, 2, 3, 4, 5], 2)"},{call:"moving_average([10, 20, 30], 3)"},{call:"moving_average([1, 2], 3)"},{call:"moving_average([], 1)"},{call:"moving_average([3, 0, 0, 1], 3)"},{call:"moving_average([1, 1, 2], 1)"},{call:"moving_average([1, 2, 2, 1, 0, 7], 3)",hidden:!0},{call:"moving_average([100, 200, 300, 400, 500, 600], 4)",hidden:!0}],hints:["Keep a running window sum instead of summing each slice.","Divide by `k` and round only when you output, never inside the running sum."],explanation:"The same running-sum window as the busiest-window problem; the average is `window / k` for each position. This is `AVG(x) OVER (ORDER BY t ROWS BETWEEN k-1 PRECEDING AND CURRENT ROW)` in SQL, or `Series.rolling(k).mean()` in pandas.\n\nTime O(n), space O(n) for the output.\n\nTraps: rounding the running sum (errors accumulate), emitting partial windows at the start, and with float inputs a running sum slowly drifts; for long float streams recompute the sum periodically or use `math.fsum`."},{id:"py-lab-longest-unique-substring",title:"Longest substring without repeats",difficulty:"medium",topic:"py-two-pointers-sliding-window",tags:["variable window","hash map"],askedAt:["Amazon","Microsoft"],prompt:'Write `longest_unique(s)` that returns the length of the longest substring of `s` with no repeated character.\n\nExample: `longest_unique("abcabcbb")` returns `3` ("abc"); `longest_unique("pwwkew")` returns `3` ("wke").\n\nConstraints: up to 10^5 characters of any kind. Return `0` for the empty string. Aim for O(n).',starter:`def longest_unique(s):
    # your code here
    pass
`,solution:`def longest_unique(s):
    last = {}  # char -> last index seen
    left = 0
    best = 0
    for right, ch in enumerate(s):
        if ch in last and last[ch] >= left:
            left = last[ch] + 1
        last[ch] = right
        best = max(best, right - left + 1)
    return best
`,tests:[{call:'longest_unique("abcabcbb")'},{call:'longest_unique("bbbbb")'},{call:'longest_unique("pwwkew")'},{call:'longest_unique("")'},{call:'longest_unique("abba")'},{call:'longest_unique("tmmzuxt")'},{call:'longest_unique("dvdf")',hidden:!0},{call:'longest_unique("ab" * 50000)',hidden:!0}],hints:["Grow a window to the right; when the new character already appears inside the window, move the left edge past its previous position.","Store the last index of each character. Only jump `left` forward if that last index is inside the current window (`>= left`)."],explanation:'A variable window `[left, right]` with a dict of last positions. When `s[right]` was last seen inside the window, the window restarts just after that position; `left` never moves backwards.\n\nTime O(n), space O(alphabet).\n\nTrap: `left = last[ch] + 1` without the `>= left` check moves the window backwards ("abba" would give 3). Checking every substring is O(n^3).'},{id:"py-lab-longest-k-distinct",title:"Longest run with at most k distinct pages",difficulty:"medium",topic:"py-two-pointers-sliding-window",tags:["variable window","Counter"],prompt:'Write `longest_k_distinct(pages, k)` where `pages` is a user\'s page-view sequence. Return the length of the longest contiguous run that contains at most `k` distinct pages.\n\nExample: `longest_k_distinct(list("eceba"), 2)` returns `3` ("ece").\n\nConstraints: `k >= 0`; up to 10^5 views. Return `0` for an empty list or `k == 0`. Aim for O(n).',starter:`def longest_k_distinct(pages, k):
    # your code here
    pass
`,solution:`from collections import defaultdict

def longest_k_distinct(pages, k):
    counts = defaultdict(int)
    left = 0
    best = 0
    for right, page in enumerate(pages):
        counts[page] += 1
        while len(counts) > k:
            old = pages[left]
            counts[old] -= 1
            if counts[old] == 0:
                del counts[old]
            left += 1
        best = max(best, right - left + 1)
    return best
`,tests:[{call:'longest_k_distinct(list("eceba"), 2)'},{call:'longest_k_distinct(list("aa"), 1)'},{call:"longest_k_distinct([], 2)"},{call:'longest_k_distinct(["x", "y"], 0)'},{call:'longest_k_distinct(list("aabbcc"), 2)'},{call:'longest_k_distinct(list("abc"), 5)'},{call:'longest_k_distinct(list("abaccc"), 2)',hidden:!0},{call:"longest_k_distinct([i % 3 for i in range(30000)], 2)",hidden:!0}],hints:["Expand the right edge one view at a time and keep a count of each page inside the window.","While the window has more than `k` distinct pages, shrink from the left. Delete a page from the dict when its count hits 0 so `len(counts)` stays the distinct count."],explanation:"A variable sliding window with a page-count dict. Each view enters once and leaves at most once, so the inner `while` is amortised O(1).\n\nTime O(n), space O(k).\n\nTrap: decrementing counts but never deleting zero entries, so `len(counts)` over-reports distinct pages and the window shrinks too far."},{id:"py-lab-shortest-burst",title:"Shortest burst that reaches a byte target",difficulty:"medium",topic:"py-two-pointers-sliding-window",tags:["variable window","positive values"],prompt:"Write `shortest_burst(sizes, target)` where `sizes` are positive batch sizes in arrival order. Return the length of the shortest contiguous run whose total is at least `target`, or `0` if no run reaches it.\n\nExample: `shortest_burst([2, 3, 1, 2, 4, 3], 7)` returns `2` (4 + 3).\n\nConstraints: all sizes are positive ints; `target >= 1`; up to 10^5 sizes. Aim for O(n).",starter:`def shortest_burst(sizes, target):
    # your code here
    pass
`,solution:`def shortest_burst(sizes, target):
    left = 0
    window = 0
    best = len(sizes) + 1
    for right, size in enumerate(sizes):
        window += size
        while window >= target:
            best = min(best, right - left + 1)
            window -= sizes[left]
            left += 1
    return 0 if best == len(sizes) + 1 else best
`,tests:[{call:"shortest_burst([2, 3, 1, 2, 4, 3], 7)"},{call:"shortest_burst([1, 4, 4], 4)"},{call:"shortest_burst([1, 1, 1, 1, 1, 1, 1, 1], 11)"},{call:"shortest_burst([], 5)"},{call:"shortest_burst([5, 1, 3, 5, 10, 7, 4, 9, 2, 8], 15)"},{call:"shortest_burst([1, 2, 3, 4, 5], 15)",hidden:!0},{call:"shortest_burst([1] * 50000 + [100000], 100000)",hidden:!0}],hints:["Because every size is positive, growing the window only increases the sum and shrinking only decreases it.","Expand right; while the sum is at least `target`, record the length and shrink from the left."],explanation:`With positive values the window sum is monotonic in both edges, so a two-pointer window works: expand until the target is met, then shrink as far as possible while it still holds. Each element enters and leaves once.

Time O(n), space O(1).

Traps: this only works because values are positive (with negatives you need prefix sums plus a monotonic deque), and returning the sentinel instead of \`0\` when nothing qualifies.`},{id:"py-lab-three-sum",title:"Three amounts that net to zero",difficulty:"medium",topic:"py-two-pointers-sliding-window",tags:["two pointers","sorting","dedup"],askedAt:["Amazon","Microsoft"],prompt:"Write `three_sum(nums)` that returns every unique triplet of values `[a, b, c]` from `nums` (three different positions) with `a + b + c == 0`. Think of ledger adjustments that cancel out.\n\n**Output format:** each triplet sorted ascending (`a <= b <= c`), the list of triplets sorted ascending, no duplicate triplets.\n\nExample: `three_sum([-1, 0, 1, 2, -1, -4])` returns `[[-1, -1, 2], [-1, 0, 1]]`.\n\nConstraints: up to 3000 values in the range -10^5..10^5. Aim for O(n^2).",starter:`def three_sum(nums):
    # your code here
    pass
`,solution:`def three_sum(nums):
    nums = sorted(nums)
    n = len(nums)
    out = []
    for i in range(n - 2):
        if nums[i] > 0:
            break
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        lo, hi = i + 1, n - 1
        while lo < hi:
            total = nums[i] + nums[lo] + nums[hi]
            if total < 0:
                lo += 1
            elif total > 0:
                hi -= 1
            else:
                out.append([nums[i], nums[lo], nums[hi]])
                lo += 1
                hi -= 1
                while lo < hi and nums[lo] == nums[lo - 1]:
                    lo += 1
    return out
`,tests:[{call:"three_sum([-1, 0, 1, 2, -1, -4])"},{call:"three_sum([0, 1, 1])"},{call:"three_sum([0, 0, 0])"},{call:"three_sum([])"},{call:"three_sum([0, 0, 0, 0])"},{call:"three_sum([-2, 0, 1, 1, 2])",hidden:!0},{call:"three_sum([-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6])",hidden:!0}],hints:["Sort first. Fix the smallest value `nums[i]`, then the problem becomes a two-sum on the sorted suffix.","On the suffix use two pointers: move `lo` right if the sum is too small, `hi` left if too large.","Skip equal values for `i`, and after a match skip equal values for `lo`, so no triplet repeats."],explanation:"Sorting enables both the two-pointer scan and cheap dedup: equal neighbours produce the same triplets, so they are skipped. Because the outer loop and the pointer scan run in ascending order, triplets come out already sorted.\n\nTime O(n^2), space O(1) beyond the sorted copy and output.\n\nTraps: deduplicating with a set of tuples after an O(n^3) search, and forgetting to skip duplicates for `lo` after a match (yields repeated triplets such as `[-2, 0, 2]` twice)."},{id:"py-lab-min-window-substring",title:"Minimum window containing all required chars",difficulty:"hard",topic:"py-two-pointers-sliding-window",tags:["variable window","Counter","need/have"],askedAt:["Amazon","Meta"],prompt:'Write `min_window(s, t)` that returns the shortest substring of `s` containing every character of `t`, including repeats (if `t` has two `a`s the window needs two `a`s).\n\n**Tie-break:** if several windows have the same minimum length, return the leftmost. Return `""` if no window exists or `t` is empty.\n\nExample: `min_window("ADOBECODEBANC", "ABC")` returns `"BANC"`.\n\nConstraints: up to 10^5 characters; matching is case-sensitive. Aim for O(len(s) + len(t)).',starter:`def min_window(s, t):
    # your code here
    pass
`,solution:`from collections import Counter

def min_window(s, t):
    if not t:
        return ""
    need = Counter(t)
    missing = len(t)  # characters still needed, counting repeats
    left = 0
    best = (0, 0)  # (start, end) of the best window, end exclusive
    for right, ch in enumerate(s, 1):
        if need[ch] > 0:
            missing -= 1
        need[ch] -= 1
        if missing == 0:
            while need[s[left]] < 0:  # drop characters we have in surplus
                need[s[left]] += 1
                left += 1
            if best == (0, 0) or right - left < best[1] - best[0]:
                best = (left, right)
            need[s[left]] += 1  # give up the leftmost required char and keep searching
            missing += 1
            left += 1
    return s[best[0]:best[1]]
`,tests:[{call:'min_window("ADOBECODEBANC", "ABC")'},{call:'min_window("a", "a")'},{call:'min_window("a", "aa")'},{call:'min_window("", "a")'},{call:'min_window("abc", "")'},{call:'min_window("aaflslflsldkalskaaa", "aaa")'},{call:'min_window("abzzba", "ab")',hidden:!0},{call:'min_window("cabwefgewcwaefgcf", "cae")',hidden:!0}],hints:["Expand the right edge until the window covers `t`, then shrink from the left while it still covers `t`.","Track one integer `missing` (how many characters of `t` are still uncovered, counting repeats) instead of comparing two Counters every step.","Update the best window only on a strictly shorter length; scanning left to right then keeps the leftmost on ties."],explanation:"The classic need/have window. `need[c]` is how many more `c` the window requires (negative means surplus) and `missing` counts uncovered characters. Once `missing == 0`, shrink past surplus characters to get the shortest window ending at `right`, record it, then release the leftmost required character to continue.\n\nTime O(len(s) + len(t)): each index enters and leaves the window once. Space O(alphabet).\n\nTraps: ignoring repeats in `t` (using a set), comparing full Counters on every step (O(n * alphabet)), and updating on `<=` which picks the rightmost of equal-length windows."},{id:"py-lab-sliding-window-max",title:"Max of every sliding window",difficulty:"hard",topic:"py-two-pointers-sliding-window",tags:["monotonic deque","sliding window"],askedAt:["Amazon","Google"],prompt:"Write `sliding_max(values, k)` that returns the maximum of each window of `k` consecutive values, starting with the window that ends at index `k - 1`. For example, peak CPU per rolling k-second window.\n\nExample: `sliding_max([1, 3, -1, -3, 5, 3, 6, 7], 3)` returns `[3, 3, 5, 5, 6, 7]`.\n\nConstraints: `k >= 1`; up to 10^5 values. Return `[]` if there are fewer than `k` values. Aim for O(n), not O(n * k).",starter:`def sliding_max(values, k):
    # your code here
    pass
`,solution:`from collections import deque

def sliding_max(values, k):
    dq = deque()  # indexes, values strictly decreasing front to back
    out = []
    for i, v in enumerate(values):
        while dq and values[dq[-1]] <= v:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()
        if i >= k - 1:
            out.append(values[dq[0]])
    return out
`,tests:[{call:"sliding_max([1, 3, -1, -3, 5, 3, 6, 7], 3)"},{call:"sliding_max([1], 1)"},{call:"sliding_max([4, 2], 3)"},{call:"sliding_max([9, 8, 7, 6], 2)"},{call:"sliding_max([2, 2, 2], 2)"},{call:"sliding_max([1, 3, 1, 2, 0, 5], 3)",hidden:!0},{call:"sliding_max(list(range(5000)), 100) == list(range(99, 5000))",hidden:!0}],hints:["A value that is smaller than a newer value can never be a window maximum again. You can throw it away.","Keep a deque of indexes whose values decrease from front to back. Pop smaller values from the back before appending; pop the front when it falls out of the window."],explanation:`A monotonic deque holds candidate indexes in decreasing value order. The front is always the current window's max; it is dropped when its index leaves the window. Each index is pushed and popped at most once.

Time O(n), space O(k).

Traps: storing values instead of indexes (you cannot tell when the front expires), and \`max(values[i:i + k])\` per window, which is O(n * k). A heap with lazy deletion is O(n log n) and also acceptable to mention.`}],r=Object.freeze(Object.defineProperty({__proto__:null,default:i},Symbol.toStringTag,{value:"Module"})),o=[{id:"py-lab-rank-employees",title:"Sort by several keys, mixed directions",difficulty:"easy",topic:"py-sorting-intervals",tags:["sorting","custom key","stable sort"],prompt:'Write `rank_employees(rows)` where each row is a tuple `(name, dept, salary)`. Return the names ordered like `ORDER BY dept ASC, salary DESC, name ASC`.\n\nExample: `rank_employees([("asha", "eng", 120), ("ravi", "eng", 150), ("meena", "ops", 90), ("bala", "eng", 150)])` returns `["bala", "ravi", "asha", "meena"]`.\n\nConstraints: up to 10^5 rows; salaries are ints (may be 0 or negative after adjustments). Return `[]` for no rows.',starter:`def rank_employees(rows):
    # your code here
    pass
`,solution:`def rank_employees(rows):
    ordered = sorted(rows, key=lambda r: (r[1], -r[2], r[0]))
    return [name for name, _, _ in ordered]
`,tests:[{call:'rank_employees([("asha", "eng", 120), ("ravi", "eng", 150), ("meena", "ops", 90), ("bala", "eng", 150)])'},{call:"rank_employees([])"},{call:'rank_employees([("z", "a", 1)])'},{call:'rank_employees([("c", "d", 5), ("a", "d", 5), ("b", "d", 5)])'},{call:'rank_employees([("x", "b", 10), ("y", "a", 1)])'},{call:'rank_employees([("p", "hr", 0), ("q", "hr", -5), ("r", "hr", 7)])',hidden:!0},{call:'rank_employees([("n1", "ops", 50), ("n2", "eng", 50), ("n0", "ops", 60), ("n3", "eng", 40)])',hidden:!0}],hints:["`sorted` with a tuple key compares element by element, exactly like a multi-column ORDER BY.","For a numeric descending column, negate it inside the key: `(dept, -salary, name)`."],explanation:"One sort with a composite key `(dept, -salary, name)`. Negating a number flips its direction while the other columns stay ascending.\n\nTime O(n log n), space O(n).\n\nTrap: you cannot negate a string. For a descending string column, sort twice using stability: first by the secondary key, then by the primary key (Python's sort is stable), or use `functools.cmp_to_key`."},{id:"py-lab-can-attend-all",title:"Can one person attend every meeting?",difficulty:"easy",topic:"py-sorting-intervals",tags:["intervals","sorting","overlap"],prompt:"Write `can_attend(meetings)` where each meeting is `[start, end]` with `start < end`. Return `True` if no two meetings overlap.\n\n**Boundary rule:** meetings are half-open `[start, end)`, so one ending at 10 and another starting at 10 do not overlap.\n\nExample: `can_attend([[0, 30], [5, 10], [15, 20]])` returns `False`.\n\nConstraints: up to 10^4 meetings in any order. Return `True` for none.",starter:`def can_attend(meetings):
    # your code here
    pass
`,solution:`def can_attend(meetings):
    ordered = sorted(meetings)
    for prev, cur in zip(ordered, ordered[1:]):
        if cur[0] < prev[1]:
            return False
    return True
`,tests:[{call:"can_attend([[0, 30], [5, 10], [15, 20]])"},{call:"can_attend([[7, 10], [2, 4]])"},{call:"can_attend([])"},{call:"can_attend([[1, 5], [5, 8]])"},{call:"can_attend([[1, 5], [4, 6]])"},{call:"can_attend([[5, 8], [1, 5], [8, 9], [2, 3]])",hidden:!0},{call:"can_attend([[1, 2], [3, 4], [2, 3]])",hidden:!0}],hints:["After sorting by start time, any overlap must be between neighbours.","Compare each meeting's start with the previous meeting's end; use `<` so touching meetings are allowed."],explanation:`Sort by start, then check adjacent pairs: if a meeting starts before the previous one ends, they overlap. Non-adjacent pairs cannot overlap without an adjacent pair also overlapping.

Time O(n log n), space O(n) for the sorted copy.

Traps: comparing every pair (O(n^2)), and using \`<=\`, which wrongly rejects back-to-back meetings.`},{id:"py-lab-merge-intervals",title:"Merge overlapping intervals",difficulty:"medium",topic:"py-sorting-intervals",tags:["intervals","merge","sorting"],askedAt:["Amazon","Google","Microsoft"],prompt:"Write `merge_intervals(intervals)` that merges all overlapping intervals and returns the result sorted by start, each as `[start, end]`.\n\n**Boundary rule:** closed intervals; touching intervals merge, so `[1, 3]` and `[3, 5]` become `[1, 5]`.\n\nExample: `merge_intervals([[1, 3], [2, 6], [8, 10], [15, 18]])` returns `[[1, 6], [8, 10], [15, 18]]`.\n\nConstraints: up to 10^4 intervals in any order, `start <= end`. Return `[]` for none.",starter:`def merge_intervals(intervals):
    # your code here
    pass
`,solution:`def merge_intervals(intervals):
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
`,tests:[{call:"merge_intervals([[1, 3], [2, 6], [8, 10], [15, 18]])"},{call:"merge_intervals([[1, 4], [4, 5]])"},{call:"merge_intervals([])"},{call:"merge_intervals([[5, 7]])"},{call:"merge_intervals([[1, 10], [2, 3], [4, 5]])"},{call:"merge_intervals([[6, 8], [1, 9], [2, 4], [4, 7]])"},{call:"merge_intervals([[3, 3], [1, 2], [2, 2]])",hidden:!0},{call:"merge_intervals([[i, i + 1] for i in range(1000)])",hidden:!0}],hints:["Sort by start. Then an interval can only overlap the last merged interval, never an earlier one.","If the next start is `<=` the current end, extend the end with `max` (the next interval might be contained); otherwise start a new interval."],explanation:"Sort by start and sweep once, keeping the last merged interval open. Overlap or touch means extend its end with `max(end, new_end)`; a gap means close it and start a new one.\n\nTime O(n log n) for the sort, O(n) for the sweep; space O(n).\n\nTraps: `merged[-1][1] = end` instead of `max(...)` (breaks on containment like `[1, 10], [2, 3]`), and forgetting to sort first."},{id:"py-lab-insert-interval",title:"Insert into a merged interval list",difficulty:"medium",topic:"py-sorting-intervals",tags:["intervals","linear scan"],prompt:"Write `insert_interval(intervals, new)` where `intervals` is already merged: sorted by start, no two overlapping or touching. Insert `new = [start, end]`, merging where needed, and return the new list.\n\n**Boundary rule:** closed intervals; touching intervals merge (same as merge-intervals).\n\nExample: `insert_interval([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8])` returns `[[1, 2], [3, 10], [12, 16]]`.\n\nConstraints: up to 10^4 intervals. Aim for O(n) with no re-sort.",starter:`def insert_interval(intervals, new):
    # your code here
    pass
`,solution:`def insert_interval(intervals, new):
    start, end = new
    out = []
    i, n = 0, len(intervals)
    while i < n and intervals[i][1] < start:  # entirely before
        out.append(list(intervals[i]))
        i += 1
    while i < n and intervals[i][0] <= end:  # overlaps or touches
        start = min(start, intervals[i][0])
        end = max(end, intervals[i][1])
        i += 1
    out.append([start, end])
    while i < n:  # entirely after
        out.append(list(intervals[i]))
        i += 1
    return out
`,tests:[{call:"insert_interval([[1, 3], [6, 9]], [2, 5])"},{call:"insert_interval([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8])"},{call:"insert_interval([], [5, 7])"},{call:"insert_interval([[1, 5]], [6, 8])"},{call:"insert_interval([[3, 5]], [1, 2])"},{call:"insert_interval([[1, 2], [4, 5]], [2, 4])"},{call:"insert_interval([[1, 5]], [2, 3])",hidden:!0},{call:"insert_interval([[1, 2], [10, 12]], [0, 20])",hidden:!0}],hints:["The list splits into three parts: intervals entirely before `new`, intervals that overlap it, and intervals entirely after.",'"Entirely before" means `end < new_start`. While the next interval starts at or before the (growing) `new_end`, absorb it with `min`/`max`.'],explanation:"Because the input is sorted and merged, one left-to-right pass is enough: copy what ends before `new`, fold every overlapping interval into `new`, append it, then copy the rest.\n\nTime O(n), space O(n) for the output.\n\nTraps: appending then calling a full merge (O(n log n), fine but not what is asked), and using `<=` in the first loop, which skips merging a touching interval."},{id:"py-lab-min-meeting-rooms",title:"Minimum meeting rooms",difficulty:"medium",topic:"py-sorting-intervals",tags:["intervals","heap","sweep line"],askedAt:["Amazon","Google","Uber"],prompt:"Write `min_rooms(meetings)` that returns the minimum number of rooms needed to host all meetings, each `[start, end]` with `start < end`.\n\n**Boundary rule:** half-open `[start, end)`: a room freed at 10 can host a meeting starting at 10.\n\nExample: `min_rooms([[0, 30], [5, 10], [15, 20]])` returns `2`.\n\nConstraints: up to 10^4 meetings in any order. Return `0` for none.",starter:`def min_rooms(meetings):
    # your code here
    pass
`,solution:`import heapq

def min_rooms(meetings):
    ends = []  # min-heap of end times of rooms in use
    for start, end in sorted(meetings):
        if ends and ends[0] <= start:
            heapq.heapreplace(ends, end)  # reuse the room that frees up first
        else:
            heapq.heappush(ends, end)
    return len(ends)
`,tests:[{call:"min_rooms([[0, 30], [5, 10], [15, 20]])"},{call:"min_rooms([[7, 10], [2, 4]])"},{call:"min_rooms([])"},{call:"min_rooms([[1, 5], [5, 10], [10, 15]])"},{call:"min_rooms([[1, 10], [1, 10], [1, 10]])"},{call:"min_rooms([[9, 10], [4, 9], [4, 17]])",hidden:!0},{call:"min_rooms([[i, i + 10] for i in range(100)])",hidden:!0}],hints:["Process meetings by start time. When a meeting starts, can it reuse the room that frees up earliest?","Keep a min-heap of end times. If the smallest end is `<= start`, replace it; otherwise push a new room. The heap size is the answer."],explanation:"Sort by start; a min-heap holds the end times of occupied rooms. The earliest-ending room is the only one worth reusing. The answer is the heap's final size, which equals the peak number of simultaneous meetings.\n\nTime O(n log n), space O(n). An equivalent sweep sorts all starts and ends separately and walks them with two pointers.\n\nTraps: using `<` instead of `<=` (back-to-back meetings then need an extra room), and sorting only by end time."},{id:"py-lab-peak-concurrency",title:"Peak concurrent sessions and when it first happened",difficulty:"medium",topic:"py-sorting-intervals",tags:["sweep line","events","concurrency"],prompt:"Write `peak_concurrency(sessions)` where each session is `[start, end)` (half-open, `start < end`), for example video streams. Return `[peak, t]`: the maximum number of sessions active at the same time and the earliest time `t` at which that maximum is reached.\n\n**Boundary rule:** a session ending at `t` is no longer active at `t`. Return `[0, None]` for no sessions.\n\nExample: `peak_concurrency([[1, 4], [2, 5], [7, 9]])` returns `[2, 2]`.\n\nConstraints: up to 10^5 sessions in any order, integer times.",starter:`def peak_concurrency(sessions):
    # your code here
    pass
`,solution:`def peak_concurrency(sessions):
    events = []
    for start, end in sessions:
        events.append((start, 1))
        events.append((end, -1))
    events.sort()  # at equal times, -1 (end) sorts before +1 (start)
    active = 0
    peak, when = 0, None
    for t, delta in events:
        active += delta
        if active > peak:
            peak, when = active, t
    return [peak, when]
`,tests:[{call:"peak_concurrency([[1, 4], [2, 5], [7, 9]])"},{call:"peak_concurrency([])"},{call:"peak_concurrency([[1, 3], [3, 5]])"},{call:"peak_concurrency([[5, 6]])"},{call:"peak_concurrency([[1, 10], [2, 3], [2, 4], [9, 12], [9, 11]])"},{call:"peak_concurrency([[0, 5], [5, 10], [5, 7], [6, 8]])",hidden:!0},{call:"peak_concurrency([[t, t + 3] for t in range(30)])",hidden:!0}],hints:["Turn each session into two events: `(start, +1)` and `(end, -1)`. Sort them and keep a running count.","At the same timestamp, process ends before starts (that is what half-open means). Sorting tuples does this for free because -1 < +1.","Record the time only when the count strictly exceeds the best so far, so you keep the earliest."],explanation:`A sweep line: sort the +1/-1 events and walk them with a running counter. With ends ordered before starts at equal times, the counter after each event never overstates the true concurrency, so its maximum is the peak and the first time it is reached is the answer.

Time O(n log n), space O(n).

Traps: processing starts before ends at the same time (over-counts back-to-back sessions), and updating on \`>=\`, which reports the last time the peak was reached instead of the first.`},{id:"py-lab-interval-intersection",title:"Overlap of two people's free slots",difficulty:"medium",topic:"py-sorting-intervals",tags:["intervals","two pointers"],prompt:"Write `intersect_schedules(a, b)`. Each argument is a list of closed intervals `[start, end]`, sorted and pairwise disjoint. Return their intersection as a sorted list of intervals.\n\n**Boundary rule:** closed intervals, so `[1, 2]` and `[2, 3]` intersect in `[2, 2]`.\n\nExample: `intersect_schedules([[0, 2], [5, 10]], [[1, 5], [8, 12]])` returns `[[1, 2], [5, 5], [8, 10]]`.\n\nConstraints: up to 10^4 intervals per list. Aim for O(len(a) + len(b)).",starter:`def intersect_schedules(a, b):
    # your code here
    pass
`,solution:`def intersect_schedules(a, b):
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        lo = max(a[i][0], b[j][0])
        hi = min(a[i][1], b[j][1])
        if lo <= hi:
            out.append([lo, hi])
        if a[i][1] < b[j][1]:  # advance whichever ends first
            i += 1
        else:
            j += 1
    return out
`,tests:[{call:"intersect_schedules([[0, 2], [5, 10], [13, 23], [24, 25]], [[1, 5], [8, 12], [15, 24], [25, 26]])"},{call:"intersect_schedules([[1, 3], [5, 9]], [])"},{call:"intersect_schedules([], [])"},{call:"intersect_schedules([[1, 7]], [[3, 10]])"},{call:"intersect_schedules([[1, 2]], [[3, 4]])"},{call:"intersect_schedules([[0, 10]], [[1, 2], [4, 5], [9, 12]])",hidden:!0},{call:"intersect_schedules([[1, 1], [3, 3]], [[1, 3]])",hidden:!0}],hints:["Two intervals intersect in `[max(starts), min(ends)]` when that is non-empty.","Walk both lists with two pointers. After comparing, the interval that ends first cannot intersect anything else, so advance it."],explanation:"Two pointers, like merging two sorted lists. The candidate overlap is `[max(start), min(end)]`; keep it if `lo <= hi`. Then drop whichever interval ends first, because every later interval in the other list starts after it.\n\nTime O(len(a) + len(b)), space O(output).\n\nTraps: comparing every pair (O(n * m)), using `lo < hi` (loses single-point overlaps for closed intervals), and advancing both pointers at once."},{id:"py-lab-largest-number",title:"Arrange numbers into the largest number",difficulty:"medium",topic:"py-sorting-intervals",tags:["custom comparator","cmp_to_key","sorting"],prompt:'Write `largest_number(nums)` that arranges non-negative integers so their concatenation is as large as possible, and returns it as a string.\n\nThe result must not have leading zeros: return `"0"` if every number is zero.\n\nExample: `largest_number([3, 30, 34, 5, 9])` returns `"9534330"`.\n\nConstraints: 1 to 100 numbers, each between 0 and 10^9.',starter:`def largest_number(nums):
    # your code here
    pass
`,solution:`from functools import cmp_to_key

def largest_number(nums):
    strs = [str(n) for n in nums]
    # a goes first if a + b is the bigger concatenation
    strs.sort(key=cmp_to_key(lambda a, b: (b + a > a + b) - (b + a < a + b)))
    result = "".join(strs)
    return "0" if result[0] == "0" else result
`,tests:[{call:"largest_number([10, 2])"},{call:"largest_number([3, 30, 34, 5, 9])"},{call:"largest_number([0, 0])"},{call:"largest_number([1])"},{call:"largest_number([0])"},{call:"largest_number([121, 12])"},{call:"largest_number([432, 43243])",hidden:!0},{call:"largest_number([999999998, 999999997, 999999999])",hidden:!0}],hints:['Sorting the numbers or their strings in plain descending order fails: `[3, 30]` should give "330", but `"30" > "3"`.',"Compare two strings `a` and `b` by which concatenation is bigger, `a + b` or `b + a`. Wrap that comparator with `functools.cmp_to_key`."],explanation:'The pairwise rule "put `a` before `b` if `a + b > b + a`" is a valid total order (it is transitive), so a comparator sort produces the optimal concatenation. `cmp_to_key` adapts an old-style comparator to `sort(key=...)`.\n\nTime O(n log n * L) for numbers of up to L digits, space O(n * L).\n\nTraps: descending string sort (fails `[3, 30]` and `[121, 12]`), and returning `"00"` for all zeros.'},{id:"py-lab-common-free-time",title:"Common free time across a team",difficulty:"hard",topic:"py-sorting-intervals",tags:["intervals","merge","gaps"],prompt:"Write `common_free_time(schedules)`. `schedules[p]` is person `p`'s busy intervals `[start, end]`, sorted and disjoint. Return the intervals of positive length when **everyone** is free, between the earliest busy start and the latest busy end, sorted.\n\n**Boundary rule:** busy intervals that touch leave no gap (`[1, 2]` and `[2, 3]` give no free time).\n\nExample: `common_free_time([[[1, 2], [5, 6]], [[1, 3]], [[4, 10]]])` returns `[[3, 4]]`.\n\nConstraints: up to 50 people with up to 50 intervals each, every busy interval has `start < end`. Return `[]` if nobody has any busy interval.",starter:`def common_free_time(schedules):
    # your code here
    pass
`,solution:`def common_free_time(schedules):
    busy = sorted(iv for person in schedules for iv in person)
    free = []
    if not busy:
        return free
    end = busy[0][1]
    for start, stop in busy[1:]:
        if start > end:
            free.append([end, start])
        end = max(end, stop)
    return free
`,tests:[{call:"common_free_time([[[1, 2], [5, 6]], [[1, 3]], [[4, 10]]])"},{call:"common_free_time([[[1, 3], [6, 7]], [[2, 4]], [[2, 5], [9, 12]]])"},{call:"common_free_time([])"},{call:"common_free_time([[]])"},{call:"common_free_time([[[1, 2]], [[2, 3]]])"},{call:"common_free_time([[[0, 1], [3, 4]]])"},{call:"common_free_time([[[1, 5]], [[2, 3]], [[7, 8]], [[6, 7]]])",hidden:!0},{call:"common_free_time([[[10, 12]], [[1, 2], [20, 21]]])",hidden:!0}],hints:["Free for everyone means not busy for anyone. Pool every busy interval into one list.","Merge the pooled intervals; the gaps between consecutive merged intervals are the answer.","For a k-way version, a heap over each person's next interval gives O(N log k) without a full sort."],explanation:`Union of all busy time, then its complement. Sort all busy intervals by start and sweep with the running max end; whenever the next start is strictly greater than that end, the gap \`[end, start]\` is common free time.

Time O(N log N) for N total intervals (or O(N log k) with a heap over the k already-sorted lists), space O(N).

Traps: intersecting each person's free time pairwise (complicated and error-prone), emitting zero-length gaps for touching intervals, and tracking only the previous interval's end instead of the running max (a long interval can cover several later ones).`}],l=Object.freeze(Object.defineProperty({__proto__:null,default:o},Symbol.toStringTag,{value:"Module"})),d=[{id:"py-lab-kth-largest-file",title:"K-th largest file size",difficulty:"easy",topic:"py-heaps-top-k",tags:["heapq","top-k","min-heap"],askedAt:["Amazon","Microsoft"],prompt:"Write `kth_largest(sizes, k)` that returns the `k`-th largest value in `sizes`. Duplicates count separately: in `[3, 3, 2]` the 2nd largest is `3`.\n\nExample: `kth_largest([3, 2, 1, 5, 6, 4], 2)` returns `5`.\n\nConstraints: `1 <= k <= len(sizes) <= 10^5`. Aim for O(n log k) with a heap rather than sorting everything.",starter:`def kth_largest(sizes, k):
    # your code here
    pass
`,solution:`import heapq

def kth_largest(sizes, k):
    heap = []  # min-heap holding the k largest values seen so far
    for s in sizes:
        if len(heap) < k:
            heapq.heappush(heap, s)
        elif s > heap[0]:
            heapq.heapreplace(heap, s)
    return heap[0]
`,tests:[{call:"kth_largest([3, 2, 1, 5, 6, 4], 2)"},{call:"kth_largest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4)"},{call:"kth_largest([7], 1)"},{call:"kth_largest([3, 3, 2], 2)"},{call:"kth_largest([-1, -5, -3], 3)"},{call:"kth_largest([5, 5, 5, 5], 4)",hidden:!0},{call:"kth_largest(list(range(100000)), 10)",hidden:!0}],hints:["Keep only the `k` largest values seen so far. Which of those `k` do you need to compare new values against?","A min-heap of size `k`: its root is the smallest of the top `k`, which is exactly the k-th largest."],explanation:`A size-k min-heap is a running "top k" buffer. A new value only matters if it beats the root; then it replaces the root. After the scan, the root is the k-th largest. \`heapq.nlargest(k, sizes)[-1]\` does the same in one line.

Time O(n log k), space O(k). Quickselect is O(n) on average if the interviewer pushes.

Traps: using a max-heap of all n values (O(n) memory, fine for small inputs, wrong for a stream), and deduplicating values, which the problem does not ask for.`},{id:"py-lab-file-compaction-cost",title:"Cheapest way to compact small files",difficulty:"easy",topic:"py-heaps-top-k",tags:["heapq","greedy","small files"],askedAt:["Amazon"],prompt:"A table has many small files. Merging two files of sizes `a` and `b` costs `a + b` and produces one file of size `a + b`. Write `merge_cost(sizes)` that returns the minimum total cost to merge all files into one.\n\nExample: `merge_cost([4, 3, 2, 6])` returns `29`: merge 2+3 (cost 5), then 4+5 (cost 9), then 6+9 (cost 15).\n\nConstraints: up to 10^5 files, sizes are positive ints. Zero or one file costs `0`.",starter:`def merge_cost(sizes):
    # your code here
    pass
`,solution:`import heapq

def merge_cost(sizes):
    heap = list(sizes)
    heapq.heapify(heap)
    total = 0
    while len(heap) > 1:
        merged = heapq.heappop(heap) + heapq.heappop(heap)
        total += merged
        heapq.heappush(heap, merged)
    return total
`,tests:[{call:"merge_cost([4, 3, 2, 6])"},{call:"merge_cost([1, 2, 3, 4, 5])"},{call:"merge_cost([])"},{call:"merge_cost([10])"},{call:"merge_cost([5, 5])"},{call:"merge_cost([1, 1, 1, 1])",hidden:!0},{call:"merge_cost([100] * 1000)",hidden:!0}],hints:["Every merge's output is merged again later, so big intermediate files get paid for repeatedly. Which two files should go first?","Always merge the two smallest files. A min-heap gives you them in O(log n)."],explanation:`This is Huffman coding: greedily merging the two smallest files is optimal because the smallest sizes should be the ones re-counted the most times. A min-heap makes each step O(log n).

Time O(n log n), space O(n).

Traps: sorting once and merging left to right (the merged file may no longer be the smallest), and re-sorting the list after each merge (O(n^2 log n)). In practice this is why compaction jobs bin-pack small files towards a target size instead of merging pairwise.`},{id:"py-lab-top-k-words",title:"Top K words, case-insensitive",difficulty:"medium",topic:"py-heaps-top-k",tags:["Counter","heapq","tie-break"],askedAt:["Amazon","Uber"],prompt:'Write `top_k_words(words, k)` that counts words case-insensitively (lowercase them) and returns the `k` most frequent as `(word, count)` tuples.\n\n**Order:** count descending, then word ascending. If there are fewer than `k` distinct words, return all of them. `k` may be 0.\n\nExample: `top_k_words(["Error", "error", "WARN"], 1)` returns `[("error", 2)]`.\n\nConstraints: up to 10^5 words. Aim for O(n + d log k) for d distinct words.',starter:`def top_k_words(words, k):
    # your code here
    pass
`,solution:`import heapq
from collections import Counter

def top_k_words(words, k):
    counts = Counter(w.lower() for w in words)
    return heapq.nsmallest(k, counts.items(), key=lambda kv: (-kv[1], kv[0]))
`,tests:[{call:'top_k_words(["i", "love", "leetcode", "i", "love", "coding"], 2)'},{call:'top_k_words(["the", "day", "is", "sunny", "the", "the", "the", "sunny", "is", "is"], 4)'},{call:"top_k_words([], 3)"},{call:'top_k_words(["Error", "error", "WARN"], 1)'},{call:'top_k_words(["b", "a", "c"], 5)'},{call:'top_k_words(["x"] * 3 + ["y"] * 3 + ["z"] * 3, 2)',hidden:!0},{call:'top_k_words(["Kafka", "spark", "SPARK", "kafka", "airflow"], 0)',hidden:!0}],hints:["Normalise first: `Counter(w.lower() for w in words)`.","The ordering key is `(-count, word)`. `heapq.nsmallest(k, items, key=...)` returns the k best already in order."],explanation:"Count with a `Counter`, then select the k smallest by key `(-count, word)`. `heapq.nsmallest` keeps a heap of size k, so it is O(d log k) and returns results sorted by the key.\n\nTime O(n + d log k), space O(d).\n\nTraps: `Counter.most_common(k)` breaks ties by first appearance, not alphabetically; forgetting to lowercase; and a max-heap with `(-count, word)` pushes is fine but `heapq` is a min-heap, so the sign matters."},{id:"py-lab-nearest-riders",title:"K nearest delivery partners",difficulty:"medium",topic:"py-heaps-top-k",tags:["heapq","k closest","geo"],askedAt:["Amazon"],prompt:'Write `nearest_riders(riders, k)` where each rider is `(rider_id, x, y)`, with coordinates relative to the restaurant at `(0, 0)`. Return the ids of the `k` riders closest by straight-line distance.\n\n**Order:** distance ascending, ties by `rider_id` ascending. If there are fewer than `k` riders, return all of them.\n\nExample: `nearest_riders([("a", 3, 3), ("b", 5, -1), ("c", -2, 4)], 2)` returns `["a", "c"]`.\n\nConstraints: up to 10^5 riders, integer coordinates up to 10^4 in absolute value.',starter:`def nearest_riders(riders, k):
    # your code here
    pass
`,solution:`import heapq

def nearest_riders(riders, k):
    # squared distance keeps everything in exact integers
    best = heapq.nsmallest(k, riders, key=lambda r: (r[1] * r[1] + r[2] * r[2], r[0]))
    return [rider_id for rider_id, _, _ in best]
`,tests:[{call:'nearest_riders([("r1", 1, 3), ("r2", -2, 2)], 1)'},{call:'nearest_riders([("a", 3, 3), ("b", 5, -1), ("c", -2, 4)], 2)'},{call:"nearest_riders([], 2)"},{call:'nearest_riders([("z", 1, 0), ("y", 0, 1), ("x", -1, 0)], 2)'},{call:'nearest_riders([("a", 0, 0)], 3)'},{call:'nearest_riders([("p", 3, 4), ("q", 5, 0), ("s", 0, -5), ("t", 1, 1)], 3)',hidden:!0},{call:'nearest_riders([("r%03d" % i, i, -i) for i in range(500)], 3)',hidden:!0}],hints:["You never need the actual distance, only the order: compare `x*x + y*y` and skip the square root.","Select with key `(squared_distance, rider_id)` using `heapq.nsmallest`, or a size-k max-heap of negated keys."],explanation:"Squared Euclidean distance preserves order and stays in exact integers, so ties are real ties and the id tie-break applies cleanly. `heapq.nsmallest(k, ...)` keeps a size-k heap.\n\nTime O(n log k), space O(k).\n\nTraps: `math.sqrt` floats (harmless here, but exact ties can become near-ties with other formulas), forgetting the id tie-break, and sorting all n riders when k is tiny. At real scale you would pre-filter with a geohash or H3 cell before ranking."},{id:"py-lab-merge-k-sorted",title:"Merge k sorted lists",difficulty:"medium",topic:"py-heaps-top-k",tags:["heapq","k-way merge"],askedAt:["Amazon","Microsoft"],prompt:"Write `merge_sorted(lists)` that merges `k` individually sorted lists of ints into one sorted list, like merging sorted part-files from a shuffle.\n\nExample: `merge_sorted([[1, 4, 5], [1, 3, 4], [2, 6]])` returns `[1, 1, 2, 3, 4, 4, 5, 6]`.\n\nConstraints: up to 10^3 lists, up to 10^5 values in total; lists may be empty. Aim for O(N log k) by using a heap, without concatenating and re-sorting.",starter:`def merge_sorted(lists):
    # your code here
    pass
`,solution:`import heapq

def merge_sorted(lists):
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]
    heapq.heapify(heap)
    out = []
    while heap:
        value, i, j = heapq.heappop(heap)
        out.append(value)
        if j + 1 < len(lists[i]):
            heapq.heappush(heap, (lists[i][j + 1], i, j + 1))
    return out
`,tests:[{call:"merge_sorted([[1, 4, 5], [1, 3, 4], [2, 6]])"},{call:"merge_sorted([])"},{call:"merge_sorted([[]])"},{call:"merge_sorted([[], [1], []])"},{call:"merge_sorted([[5, 5], [5]])"},{call:"merge_sorted([[-3, 0, 7], [2], [-5, -4, 10]])",hidden:!0},{call:"merge_sorted([list(range(i, 3000, 3)) for i in range(3)]) == list(range(3000))",hidden:!0}],hints:["At any moment the next output value is the smallest among the current heads of the k lists.","Keep one `(value, list_index, position)` entry per list in a min-heap. Pop the smallest, then push that list's next element."],explanation:"A k-way merge: the heap holds one head per list, so it never exceeds k entries. Each of the N values is pushed and popped once. Putting `list_index` in the tuple makes ties compare on ints instead of on whatever payload follows. `heapq.merge(*lists)` is the standard-library version and works lazily on iterators, which is how you merge files that do not fit in memory.\n\nTime O(N log k), space O(k) plus the output.\n\nTraps: `sorted(sum(lists, []))` (O(N log N) and quadratic concatenation), pushing all N values into the heap at once, and skipping empty lists incorrectly."},{id:"py-lab-task-cooldown",title:"Task scheduler with cooldown",difficulty:"medium",topic:"py-heaps-top-k",tags:["greedy","counting","heap"],askedAt:["Amazon"],prompt:'A worker runs one task per time slot. `tasks` is a list of task-type letters; two tasks of the same type must be separated by at least `n` slots (other tasks or idle slots). Write `least_slots(tasks, n)` that returns the minimum number of slots needed to run all tasks in any order.\n\nExample: `least_slots(["A", "A", "A", "B", "B", "B"], 2)` returns `8` (A B idle A B idle A B).\n\nConstraints: up to 10^4 tasks of uppercase letters, `0 <= n <= 100`. Return `0` for no tasks.',starter:`def least_slots(tasks, n):
    # your code here
    pass
`,solution:`from collections import Counter

def least_slots(tasks, n):
    if not tasks:
        return 0
    counts = Counter(tasks)
    top = max(counts.values())
    num_top = sum(1 for c in counts.values() if c == top)
    # (top - 1) full frames of size n + 1, then a last frame with the most frequent types
    return max(len(tasks), (top - 1) * (n + 1) + num_top)
`,tests:[{call:'least_slots(["A", "A", "A", "B", "B", "B"], 2)'},{call:'least_slots(["A", "A", "A", "B", "B", "B"], 0)'},{call:'least_slots(["A", "A", "A", "A", "A", "A", "B", "C", "D", "E", "F", "G"], 2)'},{call:"least_slots([], 3)"},{call:'least_slots(["A"], 5)'},{call:'least_slots(["A", "B", "C", "A"], 3)'},{call:'least_slots(["A", "A", "B", "B", "C", "C", "D", "D"], 1)',hidden:!0},{call:'least_slots(["X"] * 100, 1)',hidden:!0}],hints:["The most frequent task type decides the skeleton: its copies need `n` slots between them.","With max count `m` there are `m - 1` gaps of size `n`. Other tasks fill gaps; if they overflow, no idle slot is needed at all.","Answer: `max(len(tasks), (m - 1) * (n + 1) + number_of_types_with_count_m)`."],explanation:"Arrange the most frequent type into `m - 1` frames of length `n + 1`, plus a last frame holding every type that ties for the max count. If there are enough other tasks to fill all idle slots, the schedule has no idle time and the answer is just `len(tasks)`. A max-heap simulation (always run the available type with most remaining copies) gives the same number and is the version to code if the interviewer wants the actual schedule.\n\nTime O(n_tasks), space O(26).\n\nTraps: forgetting the `max(len(tasks), ...)` (under-counts when n is small), and not counting all types that tie for the max."},{id:"py-lab-k-smallest-pairs",title:"K cheapest combinations from two sorted lists",difficulty:"medium",topic:"py-heaps-top-k",tags:["heapq","frontier","sorted inputs"],prompt:"Write `k_smallest_pairs(a, b, k)` where `a` and `b` are sorted ascending (think flight prices and hotel prices). Return the `k` pairs `(a[i], b[j])` with the smallest sums.\n\n**Order:** sum ascending, then index `i` ascending, then index `j` ascending. Return all pairs if there are fewer than `k`.\n\nExample: `k_smallest_pairs([1, 7, 11], [2, 4, 6], 3)` returns `[(1, 2), (1, 4), (1, 6)]`.\n\nConstraints: lists up to 10^5 long, `0 <= k <= 10^4`. Do not generate all `len(a) * len(b)` pairs.",starter:`def k_smallest_pairs(a, b, k):
    # your code here
    pass
`,solution:`import heapq

def k_smallest_pairs(a, b, k):
    if not a or not b or k <= 0:
        return []
    heap = [(a[i] + b[0], i, 0) for i in range(min(k, len(a)))]
    heapq.heapify(heap)
    out = []
    while heap and len(out) < k:
        _, i, j = heapq.heappop(heap)
        out.append((a[i], b[j]))
        if j + 1 < len(b):
            heapq.heappush(heap, (a[i] + b[j + 1], i, j + 1))
    return out
`,tests:[{call:"k_smallest_pairs([1, 7, 11], [2, 4, 6], 3)"},{call:"k_smallest_pairs([1, 1, 2], [1, 2, 3], 2)"},{call:"k_smallest_pairs([1, 2], [3], 3)"},{call:"k_smallest_pairs([], [1, 2], 2)"},{call:"k_smallest_pairs([1, 2], [1, 2], 0)"},{call:"k_smallest_pairs([1, 2, 3], [1, 2, 3], 5)",hidden:!0},{call:"k_smallest_pairs([-10, 0, 10], [-5, 5, 15], 4)",hidden:!0}],hints:["The smallest pair is `(a[0], b[0])`. After popping `(i, j)`, the next candidates from that row are `(i, j + 1)`.","Seed the heap with `(a[i] + b[0], i, 0)` for the first `min(k, len(a))` rows. Each pop pushes at most one new entry. The tuple order `(sum, i, j)` is exactly the required tie-break."],explanation:"Treat the pairs as a sorted matrix: row `i` is `a[i] + b[0], a[i] + b[1], ...`, each row ascending. The heap holds the frontier, one candidate per row, and always pops the global next by `(sum, i, j)`. Rows beyond the first k can never be needed.\n\nTime O(k log k), space O(k).\n\nTraps: generating all pairs (O(n * m log(n * m))), pushing both `(i + 1, j)` and `(i, j + 1)` without a visited set (duplicates), and a tie-break that compares values instead of indexes."},{id:"py-lab-running-median",title:"Running median of a latency stream",difficulty:"hard",topic:"py-heaps-top-k",tags:["two heaps","streaming","median"],askedAt:["Amazon","Google","Microsoft"],prompt:"Write `running_median(stream)` that returns the median after each new latency value arrives, as a list of floats. With an even count the median is the mean of the two middle values.\n\nExample: `running_median([2, 1, 5, 7])` returns `[2.0, 1.5, 2.0, 3.5]`.\n\nConstraints: up to 10^5 integer values. Each update should be O(log n); re-sorting after every value is too slow.",starter:`def running_median(stream):
    # your code here
    pass
`,solution:`import heapq

def running_median(stream):
    low = []   # max-heap (negated) for the smaller half
    high = []  # min-heap for the larger half
    out = []
    for x in stream:
        if low and x > -low[0]:
            heapq.heappush(high, x)
        else:
            heapq.heappush(low, -x)
        # rebalance so len(low) == len(high) or len(low) == len(high) + 1
        if len(low) > len(high) + 1:
            heapq.heappush(high, -heapq.heappop(low))
        elif len(high) > len(low):
            heapq.heappush(low, -heapq.heappop(high))
        if len(low) > len(high):
            out.append(float(-low[0]))
        else:
            out.append((-low[0] + high[0]) / 2)
    return out
`,tests:[{call:"running_median([2, 1, 5, 7, 2, 0, 5])"},{call:"running_median([])"},{call:"running_median([5])"},{call:"running_median([1, 2])"},{call:"running_median([3, 3, 3])"},{call:"running_median([-1, -2, -3, -4])"},{call:"running_median([10, 1, 9, 2, 8, 3])",hidden:!0},{call:"running_median(list(range(2000, 0, -1)))[-3:]",hidden:!0}],hints:["Split the values seen so far into a lower half and an upper half. The median only depends on the top of the lower half and the bottom of the upper half.","Use a max-heap for the lower half (push negated values into `heapq`) and a min-heap for the upper half. Keep their sizes equal or the lower one bigger by one."],explanation:"Two heaps: `low` (max-heap via negation) and `high` (min-heap). Insert into the correct side, then move one element across if the sizes drift by more than one. The median is the top of `low` (odd count) or the mean of both tops (even count).\n\nTime O(log n) per value, O(n log n) total; space O(n).\n\nTraps: forgetting to negate when using `heapq` as a max-heap, rebalancing before inserting, and integer division `//` for the even case. For p95/p99 latency at scale, use approximate sketches (t-digest, `percentile_approx` in Spark) instead."},{id:"py-lab-smallest-range",title:"Smallest range covering every list",difficulty:"hard",topic:"py-heaps-top-k",tags:["heapq","k-way merge","sliding range"],prompt:"Write `smallest_range(lists)` where each of the `k` lists is sorted ascending and non-empty (for example, event times from k data centres). Return `[lo, hi]`, the smallest range that contains at least one value from every list.\n\n**Tie-break:** a range is smaller if `hi - lo` is smaller; for equal widths, the one with the smaller `lo` wins.\n\nExample: `smallest_range([[4, 10, 15, 24, 26], [0, 9, 12, 20], [5, 18, 22, 30]])` returns `[20, 24]`.\n\nConstraints: `1 <= k <= 3500`, up to 50 values per list. Aim for O(N log k) for N total values.",starter:`def smallest_range(lists):
    # your code here
    pass
`,solution:`import heapq

def smallest_range(lists):
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists)]
    heapq.heapify(heap)
    hi = max(lst[0] for lst in lists)
    best = [heap[0][0], hi]
    while True:
        lo, i, j = heapq.heappop(heap)
        if hi - lo < best[1] - best[0]:
            best = [lo, hi]
        if j + 1 == len(lists[i]):
            return best  # this list is exhausted; lo can never move further
        nxt = lists[i][j + 1]
        hi = max(hi, nxt)
        heapq.heappush(heap, (nxt, i, j + 1))
`,tests:[{call:"smallest_range([[4, 10, 15, 24, 26], [0, 9, 12, 20], [5, 18, 22, 30]])"},{call:"smallest_range([[1, 2, 3], [1, 2, 3], [1, 2, 3]])"},{call:"smallest_range([[5]])"},{call:"smallest_range([[1], [10]])"},{call:"smallest_range([[1, 5], [3, 7]])"},{call:"smallest_range([[1, 10, 20], [2, 11, 21], [3, 12, 22]])",hidden:!0},{call:"smallest_range([[-5, 0, 5], [4, 8], [6, 9]])",hidden:!0}],hints:["Take one pointer per list. The current range is `[min of heads, max of heads]`. To shrink it you can only move the minimum forward.","Keep the heads in a min-heap and track the max separately. Pop the min, record the range, push that list's next value and update the max.","Stop as soon as the list that owned the minimum runs out: no later range can include it."],explanation:"A k-way merge with a moving window. The heap gives the current minimum head, `hi` tracks the maximum head, so `[min, hi]` always covers every list. Advancing anything other than the minimum can only widen the range, so advancing the minimum is the only useful move. Since the popped minimum never decreases, updating only on strictly smaller widths keeps the smallest `lo` on ties.\n\nTime O(N log k), space O(k).\n\nTraps: recomputing `max` over all heads each step (O(N * k)), continuing after one list is exhausted, and updating on `<=`, which breaks the tie-break."}],c=Object.freeze(Object.defineProperty({__proto__:null,default:d},Symbol.toStringTag,{value:"Module"})),u=[{id:"py-lab-balanced-brackets",title:"Balanced brackets in a query or config",difficulty:"easy",topic:"py-stacks-queues",tags:["stack","parsing","validation"],askedAt:["Amazon","Flipkart"],prompt:'Write `is_balanced(s)` that returns `True` if every `(`, `[` and `{` in `s` is closed by the matching bracket in the right order. All other characters are ignored, so you can run it on a SQL snippet or a JSON string.\n\nExample: `is_balanced("([]{})")` returns `True`; `is_balanced("([)]")` returns `False`.\n\nConstraints: up to 10^5 characters. The empty string is balanced. Brackets inside quotes are not special (no string-literal handling).',starter:`def is_balanced(s):
    # your code here
    pass
`,solution:`def is_balanced(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack
`,tests:[{call:'is_balanced("()[]{}")'},{call:'is_balanced("(]")'},{call:'is_balanced("([)]")'},{call:'is_balanced("")'},{call:`is_balanced('{"a": [1, (2)]}')`},{call:'is_balanced("((")'},{call:'is_balanced("SELECT COUNT(*) FROM t WHERE (a IN (1, 2)")',hidden:!0},{call:'is_balanced("]")',hidden:!0}],hints:['The most recently opened bracket must be the first one closed. Which data structure gives you "most recent"?',"Push openers; on a closer, pop and check it matches. At the end the stack must be empty."],explanation:'A stack mirrors nesting: push on open, pop and compare on close. A closer with an empty stack or a mismatched top fails immediately; leftover openers at the end fail too.\n\nTime O(n), space O(n).\n\nTraps: counting brackets per type (accepts `"([)]"`), popping an empty list (IndexError on `"]"`), and forgetting the final `not stack` check (accepts `"(("`).'},{id:"py-lab-normalize-path",title:"Normalise an object-store path",difficulty:"medium",topic:"py-stacks-queues",tags:["stack","strings","paths"],prompt:'Write `normalize_path(path)` for an absolute Unix-style path (as used for HDFS or a mounted S3 prefix). Return the canonical path:\n\n- collapse repeated slashes into one\n- drop `.` segments\n- `..` removes the previous segment (at the root it does nothing)\n- no trailing slash, except the root `"/"` itself\n- any other segment, including `...`, is a normal name\n\nExample: `normalize_path("/a/./b/../../c/")` returns `"/c"`.\n\nConstraints: the path starts with `/` and is up to 3000 characters.',starter:`def normalize_path(path):
    # your code here
    pass
`,solution:`def normalize_path(path):
    parts = []
    for seg in path.split("/"):
        if seg == "" or seg == ".":
            continue
        if seg == "..":
            if parts:
                parts.pop()
        else:
            parts.append(seg)
    return "/" + "/".join(parts)
`,tests:[{call:'normalize_path("/home/")'},{call:'normalize_path("/../")'},{call:'normalize_path("/home//foo/")'},{call:'normalize_path("/a/./b/../../c/")'},{call:'normalize_path("/")'},{call:'normalize_path("/.../a/../b")'},{call:'normalize_path("/data/raw/../../curated/./2024//")',hidden:!0},{call:'normalize_path("/a/b/c/../../../..")',hidden:!0}],hints:["Split on `/`. Empty strings (from `//` or the leading slash) and `.` contribute nothing.","Keep a stack of directory names: push a name, pop on `..` if the stack is not empty. Join with `/` and prefix one `/`."],explanation:'Splitting on `/` turns the path into segments; a stack of names applies `..` as a pop. Joining the stack gives the canonical path with no trailing slash, and an empty stack gives `"/"`.\n\nTime O(n), space O(n).\n\nTraps: popping from an empty stack on `/..`, treating `...` as a parent reference, and string-replace approaches (`replace("//", "/")`) that miss cases like `///`.'},{id:"py-lab-days-until-higher",title:"Days until a higher price",difficulty:"medium",topic:"py-stacks-queues",tags:["monotonic stack","next greater element"],askedAt:["Amazon"],prompt:"Write `days_until_higher(prices)` that returns, for each day, how many days you must wait for a strictly higher price. Use `0` when no later day is higher.\n\nExample: `days_until_higher([73, 74, 75, 71, 69, 72, 76, 73])` returns `[1, 1, 4, 2, 1, 1, 0, 0]`.\n\nConstraints: up to 10^5 days. Aim for O(n); checking every later day is O(n^2).",starter:`def days_until_higher(prices):
    # your code here
    pass
`,solution:`def days_until_higher(prices):
    out = [0] * len(prices)
    stack = []  # indexes still waiting for a higher price; prices non-increasing
    for i, p in enumerate(prices):
        while stack and prices[stack[-1]] < p:
            j = stack.pop()
            out[j] = i - j
        stack.append(i)
    return out
`,tests:[{call:"days_until_higher([73, 74, 75, 71, 69, 72, 76, 73])"},{call:"days_until_higher([30, 40, 50, 60])"},{call:"days_until_higher([])"},{call:"days_until_higher([5, 5, 5])"},{call:"days_until_higher([3, 1, 2, 4])"},{call:"days_until_higher([9, 8, 7, 6, 5])",hidden:!0},{call:"days_until_higher(list(range(3000, 0, -1)) + [3001]) == [3000 - i for i in range(3000)] + [0]",hidden:!0}],hints:["Keep the days that have not yet found a higher price. When a new price arrives, which of those days does it resolve?","Keep their indexes on a stack. While the new price is higher than the price at the top index, pop it and record `i - j`."],explanation:`A monotonic stack of unresolved indexes, with prices non-increasing from bottom to top. A new higher price resolves every smaller price on top of the stack at once. Each index is pushed and popped once.

Time O(n), space O(n).

Traps: using \`<=\` when popping (equal prices are not higher), and storing prices instead of indexes (you need the distance).`},{id:"py-lab-decode-string",title:"Decode a run-length encoded string",difficulty:"medium",topic:"py-stacks-queues",tags:["stack","parsing","nesting"],prompt:'Write `decode(s)` for strings encoded as `k[text]`, meaning `text` repeated `k` times. Encodings can nest, `k` can have several digits, and letters can appear outside brackets.\n\nExample: `decode("3[a2[c]]")` returns `"accaccacc"`; `decode("2[abc]3[cd]ef")` returns `"abcabccdcdcdef"`.\n\nConstraints: the input is always valid; letters are lowercase; the output is at most 10^5 characters.',starter:`def decode(s):
    # your code here
    pass
`,solution:`def decode(s):
    stack = []  # (text_before_bracket, repeat_count)
    current = []
    num = 0
    for ch in s:
        if ch.isdigit():
            num = num * 10 + int(ch)
        elif ch == "[":
            stack.append(("".join(current), num))
            current, num = [], 0
        elif ch == "]":
            before, k = stack.pop()
            current = [before + "".join(current) * k]
        else:
            current.append(ch)
    return "".join(current)
`,tests:[{call:'decode("3[a]2[bc]")'},{call:'decode("3[a2[c]]")'},{call:'decode("2[abc]3[cd]ef")'},{call:'decode("")'},{call:'decode("abc")'},{call:'decode("10[x]")'},{call:'decode("2[a2[b3[c]]]d")',hidden:!0},{call:'decode("ab2[x]1[yz]")',hidden:!0}],hints:["Digits can come in runs: build the number with `num = num * 10 + digit`.","On `[`, push the text built so far and the count, then start fresh. On `]`, pop them and set `current = before + current * k`."],explanation:"A stack saves the outer context at every `[`: the text before it and the repeat count. At `]` the inner text is complete, so it is repeated and appended to the saved prefix. Building text in a list and joining avoids quadratic string concatenation.\n\nTime O(output length), space O(output length).\n\nTraps: reading only one digit (`10[x]` becomes `0[x]`), and a recursive solution that does not return the index it stopped at."},{id:"py-lab-count-islands",title:"Count connected regions in a grid",difficulty:"medium",topic:"py-graphs-topological-sort",tags:["BFS","grid","connected components"],askedAt:["Amazon","Microsoft"],prompt:'Write `count_islands(grid)` where `grid` is a list of equal-length strings of `"1"` (land) and `"0"` (water). Return the number of islands: groups of land cells connected up, down, left or right (not diagonally).\n\nExample: `count_islands(["11000", "11000", "00100", "00011"])` returns `3`.\n\nConstraints: up to 300 x 300 cells. Return `0` for an empty grid. Recursion depth can exceed Python\'s default limit on large islands.',starter:`def count_islands(grid):
    # your code here
    pass
`,solution:`from collections import deque

def count_islands(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    seen = set()
    islands = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != "1" or (r, c) in seen:
                continue
            islands += 1
            seen.add((r, c))
            queue = deque([(r, c)])
            while queue:
                y, x = queue.popleft()
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == "1" and (ny, nx) not in seen:
                        seen.add((ny, nx))
                        queue.append((ny, nx))
    return islands
`,tests:[{call:'count_islands(["11110", "11010", "11000", "00000"])'},{call:'count_islands(["11000", "11000", "00100", "00011"])'},{call:"count_islands([])"},{call:'count_islands(["0"])'},{call:'count_islands(["1"])'},{call:'count_islands(["101", "010", "101"])'},{call:'count_islands(["1" * 60] * 60)',hidden:!0},{call:'count_islands(["10" * 20, "01" * 20] * 10)',hidden:!0}],hints:["Each time you find an unvisited land cell, you have found a new island. Then mark its whole island as visited.","Flood-fill with BFS using `collections.deque` (or an explicit stack). Mark a cell visited when you enqueue it, not when you dequeue it."],explanation:`Scan every cell; an unvisited land cell starts a BFS that marks its whole connected component. The number of BFS starts is the number of islands. An iterative queue avoids \`RecursionError\` on big islands (Python's default limit is about 1000 frames).

Time O(rows * cols), space O(rows * cols) for the visited set.

Traps: recursive DFS on a 60 x 60 island hits the recursion limit, marking visited on dequeue (cells get enqueued many times), and counting diagonal neighbours.`},{id:"py-lab-dag-run-order",title:"Run order for a pipeline DAG",difficulty:"medium",topic:"py-graphs-topological-sort",tags:["topological sort","Kahn","heap","cycle detection"],prompt:'Write `run_order(tasks, deps)` where `deps` is a list of `(before, after)` pairs meaning `before` must finish before `after` starts (like an Airflow DAG). Return a valid execution order of all tasks.\n\n**Tie-break:** whenever several tasks are ready, run the alphabetically smallest first. Return `[]` if the dependencies contain a cycle.\n\nExample: `run_order(["a", "b", "c", "d"], [("a", "d"), ("b", "d"), ("d", "c")])` returns `["a", "b", "d", "c"]`.\n\nConstraints: up to 10^4 tasks with unique names; deps only mention listed tasks and may repeat.',starter:`def run_order(tasks, deps):
    # your code here
    pass
`,solution:`import heapq
from collections import defaultdict

def run_order(tasks, deps):
    indegree = {t: 0 for t in tasks}
    children = defaultdict(list)
    for before, after in deps:
        children[before].append(after)
        indegree[after] += 1
    ready = [t for t in tasks if indegree[t] == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        t = heapq.heappop(ready)
        order.append(t)
        for c in children[t]:
            indegree[c] -= 1
            if indegree[c] == 0:
                heapq.heappush(ready, c)
    return order if len(order) == len(tasks) else []
`,tests:[{call:'run_order(["extract", "transform", "load"], [("extract", "transform"), ("transform", "load")])'},{call:'run_order(["c", "b", "a"], [])'},{call:'run_order(["a", "b"], [("a", "b"), ("b", "a")])'},{call:"run_order([], [])"},{call:'run_order(["a", "b", "c", "d"], [("a", "d"), ("b", "d"), ("d", "c")])'},{call:'run_order(["a", "b"], [("a", "b"), ("a", "b")])'},{call:'run_order(["x", "y", "z"], [("x", "y"), ("y", "z"), ("z", "y")])',hidden:!0},{call:'run_order(["a"], [("a", "a")])',hidden:!0}],hints:["Count each task's unfinished prerequisites (its in-degree). Tasks with in-degree 0 can run now.","Kahn's algorithm: repeatedly take a ready task, then decrement its children's in-degree. Use a min-heap for the ready set to get the alphabetical tie-break.","If fewer tasks come out than went in, the leftovers are stuck in a cycle."],explanation:`Kahn's algorithm with a heap as the ready queue. Each edge is relaxed once; the heap makes the choice among ready tasks deterministic (smallest name). Tasks on a cycle never reach in-degree 0, so the output is short exactly when a cycle exists.

Time O((V + E) log V), space O(V + E).

Traps: a plain FIFO queue (valid order, wrong tie-break), deduplicating edges in only one place (in-degree never reaches 0), and recursive DFS cycle detection that misses self-loops.`},{id:"py-lab-lineage-hops",title:"Shortest lineage path between two tables",difficulty:"medium",topic:"py-graphs-topological-sort",tags:["BFS","shortest path","lineage"],prompt:'Write `lineage_hops(edges, src, dst)` where `edges` is a list of directed `(upstream, downstream)` table dependencies. Return the minimum number of edges on a path from `src` to `dst`.\n\nReturn `0` if `src == dst` and `-1` if `dst` is unreachable. The graph can contain cycles.\n\nExample: `lineage_hops([("raw", "clean"), ("clean", "agg"), ("agg", "report"), ("raw", "agg2"), ("agg2", "report")], "raw", "report")` returns `2`.\n\nConstraints: up to 10^5 edges.',starter:`def lineage_hops(edges, src, dst):
    # your code here
    pass
`,solution:`from collections import defaultdict, deque

def lineage_hops(edges, src, dst):
    if src == dst:
        return 0
    graph = defaultdict(list)
    for a, b in edges:
        graph[a].append(b)
    dist = {src: 0}
    queue = deque([src])
    while queue:
        node = queue.popleft()
        for nxt in graph[node]:
            if nxt not in dist:
                dist[nxt] = dist[node] + 1
                if nxt == dst:
                    return dist[nxt]
                queue.append(nxt)
    return -1
`,tests:[{call:'lineage_hops([("raw", "clean"), ("clean", "agg"), ("agg", "report"), ("raw", "agg2"), ("agg2", "report")], "raw", "report")'},{call:'lineage_hops([("a", "b")], "b", "a")'},{call:'lineage_hops([], "a", "a")'},{call:'lineage_hops([], "a", "b")'},{call:'lineage_hops([("a", "b"), ("b", "c"), ("c", "a")], "a", "c")'},{call:'lineage_hops([("a", "b"), ("a", "c"), ("c", "d"), ("b", "d"), ("d", "e")], "a", "e")',hidden:!0},{call:"lineage_hops([(i, i + 1) for i in range(5000)] + [(0, 4999)], 0, 5000)",hidden:!0}],hints:["In an unweighted graph, breadth-first search visits nodes in order of distance from the start.","BFS from `src` with a `deque`, recording each node's distance when you first discover it. A dict of distances doubles as the visited set, which also stops cycles."],explanation:"BFS explores level by level, so the first time `dst` is discovered its distance is minimal. Marking nodes when they are enqueued prevents revisits and infinite loops on cycles.\n\nTime O(V + E), space O(V + E).\n\nTraps: DFS (finds a path, not the shortest), `list.pop(0)` as a queue (O(n) per pop), and forgetting the `src == dst` case."},{id:"py-lab-dag-stages",title:"Group DAG tasks into parallel stages",difficulty:"hard",topic:"py-graphs-topological-sort",tags:["topological sort","levels","longest path"],prompt:'Write `dag_stages(tasks, deps)` where `deps` are `(before, after)` pairs. Tasks with no prerequisites are in stage 1; every other task\'s stage is 1 + the largest stage among its prerequisites, so each stage can run fully in parallel. Return the stages in order, each sorted alphabetically.\n\nReturn `[]` if the dependencies contain a cycle.\n\nExample: `dag_stages(["a", "b", "c", "d"], [("a", "c"), ("b", "c"), ("c", "d")])` returns `[["a", "b"], ["c"], ["d"]]`.\n\nConstraints: up to 10^4 unique tasks; deps only mention listed tasks.',starter:`def dag_stages(tasks, deps):
    # your code here
    pass
`,solution:`from collections import defaultdict

def dag_stages(tasks, deps):
    indegree = {t: 0 for t in tasks}
    children = defaultdict(list)
    for before, after in deps:
        children[before].append(after)
        indegree[after] += 1
    level = sorted(t for t in tasks if indegree[t] == 0)
    stages = []
    placed = 0
    while level:
        stages.append(level)
        placed += len(level)
        nxt = []
        for t in level:
            for c in children[t]:
                indegree[c] -= 1
                if indegree[c] == 0:  # its last prerequisite was in this stage
                    nxt.append(c)
        level = sorted(nxt)
    return stages if placed == len(tasks) else []
`,tests:[{call:'dag_stages(["a", "b", "c", "d"], [("a", "c"), ("b", "c"), ("c", "d")])'},{call:'dag_stages(["y", "x"], [])'},{call:"dag_stages([], [])"},{call:'dag_stages(["a", "b"], [("a", "b"), ("b", "a")])'},{call:'dag_stages(["a", "b", "c"], [("a", "b"), ("b", "c"), ("a", "c")])'},{call:'dag_stages(["ingest", "dq", "dim", "fact", "report"], [("ingest", "dq"), ("dq", "dim"), ("dq", "fact"), ("dim", "fact"), ("fact", "report"), ("dim", "report")])',hidden:!0},{call:'dag_stages(["a", "b", "c", "d", "e"], [("a", "b"), ("c", "d"), ("d", "e"), ("e", "d")])',hidden:!0}],hints:["Run Kahn's algorithm one whole level at a time instead of one task at a time.","Take every task with in-degree 0 as a stage. Removing them may free new tasks; those form the next stage. A task is freed only after its last prerequisite, which gives the longest-path stage.","If some tasks are never freed, there is a cycle."],explanation:"Level-order Kahn: the current frontier (in-degree 0) is one stage; decrementing children yields the next frontier. A task joins a frontier only when its last remaining prerequisite has been placed, so its stage is 1 + the max stage of its prerequisites, which is the longest path from a source. The number of stages is the DAG's critical path length, the minimum wall-clock steps with unlimited workers.\n\nTime O(V log V + E) with the per-stage sorts, space O(V + E).\n\nTraps: BFS shortest distance from sources (puts `c` in stage 2 when there is also a path `a -> b -> c`), and forgetting cycle detection."},{id:"py-lab-largest-rectangle",title:"Largest rectangle in a histogram",difficulty:"hard",topic:"py-stacks-queues",tags:["monotonic stack","histogram"],askedAt:["Amazon"],prompt:"Write `largest_rectangle(heights)` where `heights[i]` is the height of bar `i` (all bars width 1), for example hourly throughput. Return the area of the largest rectangle that fits under the histogram.\n\nExample: `largest_rectangle([2, 1, 5, 6, 2, 3])` returns `10` (bars 5 and 6, height 5, width 2).\n\nConstraints: up to 10^5 bars, heights from 0 to 10^4. Return `0` for no bars. Aim for O(n).",starter:`def largest_rectangle(heights):
    # your code here
    pass
`,solution:`def largest_rectangle(heights):
    stack = []  # indexes with increasing heights
    best = 0
    for i, h in enumerate(heights + [0]):  # the sentinel 0 flushes the stack
        while stack and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            left = stack[-1] + 1 if stack else 0
            best = max(best, height * (i - left))
        stack.append(i)
    return best
`,tests:[{call:"largest_rectangle([2, 1, 5, 6, 2, 3])"},{call:"largest_rectangle([2, 4])"},{call:"largest_rectangle([])"},{call:"largest_rectangle([0, 0])"},{call:"largest_rectangle([5])"},{call:"largest_rectangle([1, 1, 1, 1])"},{call:"largest_rectangle([6, 2, 5, 4, 5, 1, 6])",hidden:!0},{call:"largest_rectangle([3] * 2000 + [1])",hidden:!0}],hints:["For each bar, the widest rectangle using its full height extends left and right until a shorter bar. You need the nearest shorter bar on both sides.","Keep a stack of indexes with increasing heights. When a shorter bar arrives, pop: the popped bar's rectangle ends here, and starts just after the new stack top.","Append a 0-height sentinel so every bar gets popped at the end."],explanation:"A monotonic increasing stack. When bar `i` is lower than the top, the top bar can extend no further right; its left limit is the element below it on the stack. Each bar is pushed and popped once, and each pop computes one candidate area.\n\nTime O(n), space O(n).\n\nTraps: forgetting the sentinel (bars left on the stack are never measured), getting the width wrong when the stack becomes empty (`left = 0`), and the O(n^2) expand-from-every-bar approach."}],p=Object.freeze(Object.defineProperty({__proto__:null,default:u},Symbol.toStringTag,{value:"Module"})),h=[{id:"py-lab-summarize-access-log",title:"Summarise an access log per endpoint",difficulty:"medium",topic:"py-parsing-logs-json",tags:["regex","log parsing","aggregation"],prompt:'Write `summarize_log(lines)` for access-log lines of the form `<timestamp> <METHOD> <path> <status> <latency>ms`, for example `2024-05-01T10:00:00Z GET /orders 200 123ms`. Fields are separated by one or more spaces or tabs; leading and trailing whitespace is ignored.\n\nA line is valid only if it has exactly those 5 fields, the method is uppercase letters, the path starts with `/`, the status is exactly 3 digits and the latency is digits followed by `ms`. **Skip invalid lines silently.**\n\nReturn a dict `path -> [requests, errors, max_latency_ms]`, where `errors` counts statuses `>= 500`.\n\nExample: `summarize_log(["t1 GET /orders 200 120ms", "t2 POST /orders 503 900ms", "bad line"])` returns `{"/orders": [2, 1, 900]}`.\n\nConstraints: up to 10^5 lines.',starter:`def summarize_log(lines):
    # your code here
    pass
`,solution:`import re

LINE = re.compile(r"(\\S+)\\s+([A-Z]+)\\s+(/\\S*)\\s+(\\d{3})\\s+(\\d+)ms")

def summarize_log(lines):
    out = {}
    for line in lines:
        m = LINE.fullmatch(line.strip())
        if not m:
            continue
        _, _, path, status, ms = m.groups()
        row = out.setdefault(path, [0, 0, 0])
        row[0] += 1
        if int(status) >= 500:
            row[1] += 1
        row[2] = max(row[2], int(ms))
    return out
`,tests:[{call:'summarize_log(["2024-05-01T10:00:00Z GET /orders 200 120ms", "2024-05-01T10:00:01Z POST /orders 503 900ms", "2024-05-01T10:00:02Z GET /health 200 3ms"])'},{call:"summarize_log([])"},{call:'summarize_log(["garbage", "t GET /a 200", "t GET /a 20x 5ms", "t GET /a 200 5s", "t GET a 200 5ms", "t GET /a 200 5ms extra"])'},{call:'summarize_log(["  2024-05-01T10:00:00Z GET /a 404 7ms\\n"])'},{call:'summarize_log(["t GET /x 499 1ms", "t GET /x 500 2ms", "t GET /x 599 3ms"])'},{call:'summarize_log(["t get /a 200 1ms", "t GET /a 200 1ms"])',hidden:!0},{call:'summarize_log(["t\\tGET  /b 502   40ms", "t GET /b 200 0ms"])',hidden:!0}],hints:["Write one regex for a whole valid line and use `re.fullmatch` on the stripped line, so partial matches and extra fields are rejected.","Something like `(\\S+)\\s+([A-Z]+)\\s+(/\\S*)\\s+(\\d{3})\\s+(\\d+)ms`. Compile it once outside the loop.","Accumulate with `dict.setdefault(path, [0, 0, 0])` and update the three counters."],explanation:'One compiled regex with `fullmatch` both validates and extracts fields; anything that does not match is skipped, which is what a production parser does with a dead-letter counter. A dict of small lists accumulates the per-path metrics in one pass.\n\nTime O(total characters), space O(distinct paths).\n\nTraps: `line.split(" ")` (breaks on double spaces and tabs; `split()` with no argument is fine), `re.match` without an end anchor (accepts trailing junk), crashing on a malformed line instead of skipping it, and treating 4xx as server errors.'},{id:"py-lab-dedup-latest-event",title:"Deduplicate events, keep the latest per key",difficulty:"easy",topic:"py-hashmaps-counting",tags:["dedup","last write wins","CDC"],prompt:'Write `latest_per_key(events)` where each event is a dict with an `"id"` and an integer `"ts"` (plus any other fields). Keep exactly one event per id: the one with the largest `ts`. If two events for an id share the largest `ts`, keep the one that appears **later** in the input (last write wins).\n\nReturn the kept events (the original dicts, unchanged) sorted by `id` ascending.\n\nExample: `latest_per_key([{"id": "o1", "ts": 1, "status": "created"}, {"id": "o1", "ts": 3, "status": "paid"}])` returns `[{"id": "o1", "ts": 3, "status": "paid"}]`.\n\nConstraints: up to 10^5 events, arriving out of order; within one call all ids have the same type.',starter:`def latest_per_key(events):
    # your code here
    pass
`,solution:`def latest_per_key(events):
    best = {}
    for e in events:
        cur = best.get(e["id"])
        if cur is None or e["ts"] >= cur["ts"]:  # >= : later duplicates win ties
            best[e["id"]] = e
    return [best[k] for k in sorted(best)]
`,tests:[{call:'latest_per_key([{"id": "o1", "ts": 1, "status": "created"}, {"id": "o2", "ts": 5, "status": "created"}, {"id": "o1", "ts": 3, "status": "paid"}])'},{call:"latest_per_key([])"},{call:'latest_per_key([{"id": "a", "ts": 9, "v": 1}, {"id": "a", "ts": 2, "v": 2}])'},{call:'latest_per_key([{"id": "a", "ts": 5, "v": "first"}, {"id": "a", "ts": 5, "v": "second"}])'},{call:'latest_per_key([{"id": 10, "ts": 1}, {"id": 2, "ts": 1}, {"id": 10, "ts": 0}])'},{call:'latest_per_key([{"id": "x", "ts": 3, "v": 1}, {"id": "x", "ts": 7, "v": 2}, {"id": "x", "ts": 7, "v": 3}, {"id": "x", "ts": 4, "v": 4}])',hidden:!0},{call:'latest_per_key([{"id": i % 50, "ts": i} for i in range(1000)]) == [{"id": k, "ts": 950 + k} for k in range(50)]',hidden:!0}],hints:["One pass with a dict `id -> best event so far`.","Replace the stored event when the new `ts` is greater **or equal**; `>=` is what makes later duplicates win ties."],explanation:"A hash map keyed by id holds the current winner; each event replaces it if its `ts` is at least as large. This is the in-memory version of `ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts DESC, arrival DESC) = 1`, or `MERGE ... WHEN MATCHED AND src.ts >= tgt.ts` in an upsert.\n\nTime O(n + d log d) for the final sort of d ids, space O(d).\n\nTraps: assuming input is ordered by ts (late events then overwrite newer ones), using `>` (keeps the first of equal timestamps), and sorting ids as strings when they are numbers."},{id:"py-lab-sessionize-clicks",title:"Sessionize clicks by inactivity gap",difficulty:"medium",topic:"py-sorting-intervals",tags:["sessionization","sorting","gaps and islands"],prompt:'Write `sessionize(clicks, gap)` where `clicks` is a list of `(user, ts)` tuples in any order (ts in seconds). For each user, sort their clicks by time; a new session starts when the time since that user\'s previous click is **strictly greater** than `gap`.\n\nReturn a list of tuples `(user, start_ts, end_ts, clicks)`, sorted by user, then by start time. Duplicate timestamps belong to the same session.\n\nExample: `sessionize([("u1", 0), ("u1", 100), ("u1", 2000), ("u2", 50)], 1800)` returns `[("u1", 0, 100, 2), ("u1", 2000, 2000, 1), ("u2", 50, 50, 1)]`.\n\nConstraints: up to 10^5 clicks; users are strings.',starter:`def sessionize(clicks, gap):
    # your code here
    pass
`,solution:`def sessionize(clicks, gap):
    out = []
    for user, ts in sorted(clicks):  # by user, then time
        if out and out[-1][0] == user and ts - out[-1][2] <= gap:
            _, start, _, n = out[-1]
            out[-1] = (user, start, ts, n + 1)
        else:
            out.append((user, ts, ts, 1))
    return out
`,tests:[{call:'sessionize([("u1", 0), ("u1", 100), ("u1", 2000), ("u2", 50)], 1800)'},{call:"sessionize([], 30)"},{call:'sessionize([("a", 0), ("a", 30), ("a", 61)], 30)'},{call:'sessionize([("b", 50), ("a", 10), ("b", 10), ("a", 5)], 10)'},{call:'sessionize([("u", 7), ("u", 7)], 0)'},{call:'sessionize([("u", t) for t in range(0, 1000, 10)], 9) == [("u", t, t, 1) for t in range(0, 1000, 10)]',hidden:!0},{call:'sessionize([("u", t) for t in range(990, -1, -10)], 10)',hidden:!0}],hints:["Sort the clicks by `(user, ts)`; then every user's clicks are contiguous and in time order.","Walk once. Extend the current session if it is the same user and `ts - last_end <= gap`; otherwise open a new session."],explanation:"Sort by `(user, ts)` and sweep, comparing each click with the end of the open session. This is the gaps-and-islands pattern; in SQL or Spark it is `LAG(ts) OVER (PARTITION BY user ORDER BY ts)`, a `new_session` flag when the gap is exceeded, and a running `SUM` of that flag as the session id.\n\nTime O(n log n), space O(n).\n\nTraps: comparing with the session start instead of the previous click (that is a fixed window, not an inactivity gap), using `>=` instead of `>` for the boundary, and not sorting (input arrives out of order)."},{id:"py-lab-flatten-json",title:"Flatten nested JSON into columns",difficulty:"medium",topic:"py-parsing-logs-json",tags:["recursion","JSON","schema"],prompt:'Write `flatten(doc, sep=".")` that turns a nested dict (parsed JSON) into a flat dict of column names to values.\n\n- nested dict keys are joined with `sep`: `{"user": {"id": 7}}` gives `"user.id"`\n- list elements use their index: `{"tags": ["a"]}` gives `"tags.0"`\n- an empty dict or empty list is kept as the value at its path\n- everything else (str, int, float, bool, None) is a leaf, including falsy values\n\nExample: `flatten({"user": {"id": 7, "geo": {"city": "Pune"}}, "tags": ["a", "b"]})` returns `{"user.id": 7, "user.geo.city": "Pune", "tags.0": "a", "tags.1": "b"}`.\n\nConstraints: the top level is a dict with string keys; nesting depth up to 50. `flatten({})` is `{}`.',starter:`def flatten(doc, sep="."):
    # your code here
    pass
`,solution:`def flatten(doc, sep="."):
    out = {}

    def walk(value, path):
        if isinstance(value, dict) and value:
            for k, v in value.items():
                walk(v, f"{path}{sep}{k}")
        elif isinstance(value, list) and value:
            for i, v in enumerate(value):
                walk(v, f"{path}{sep}{i}")
        else:
            out[path] = value

    for k, v in doc.items():
        walk(v, str(k))
    return out
`,tests:[{call:'flatten({"user": {"id": 7, "geo": {"city": "Pune"}}, "tags": ["a", "b"]})'},{call:"flatten({})"},{call:'flatten({"a": {}, "b": [], "c": None})'},{call:'flatten({"items": [{"sku": "x", "qty": 2}, {"sku": "y", "qty": 1}]})'},{call:'flatten({"a": {"b": 1}}, "_")'},{call:'flatten({"flag": False, "n": 0, "s": ""})'},{call:'flatten({"m": [[1, 2], [3]]})',hidden:!0},{call:'flatten({"a": {"b": {"c": {"d": {"e": [None]}}}}})',hidden:!0}],hints:["Write a helper `walk(value, path)` that either recurses (non-empty dict or list) or writes a leaf.","Start the recursion from each top-level key, so you never produce a leading separator.",'Check `isinstance(value, dict) and value`, not just truthiness of the value, or you will drop `0`, `False` and `""`.'],explanation:'A depth-first walk that carries the path so far. Non-empty containers recurse with the key or index appended; everything else is written as a leaf. Starting from the top-level keys avoids special-casing an empty prefix. This is what `pandas.json_normalize` does for dicts, and in Spark you would select `col("user.geo.city")` or `explode` the arrays instead.\n\nTime O(total number of values), space O(depth) for the recursion plus the output.\n\nTraps: `if not value` to detect leaves (drops falsy scalars), a leading separator like `".user"`, and losing empty containers entirely, which silently drops columns from the schema.'},{id:"py-lab-merge-sorted-logs",title:"Merge sorted log files by timestamp",difficulty:"medium",topic:"py-heaps-top-k",tags:["heapq.merge","k-way merge","stable"],prompt:'Write `merge_logs(files)` where each file is a list of `(ts, record)` tuples already sorted by `ts`. Merge them into one list sorted by `ts`.\n\n**Tie-break:** equal timestamps keep file order (file 0 before file 1), and within a file keep the original order. Never compare the records themselves: they may be dicts.\n\nExample: `merge_logs([[(1, "zeta"), (2, "q")], [(1, "alpha")]])` returns `[(1, "zeta"), (1, "alpha"), (2, "q")]`.\n\nConstraints: up to 100 files, up to 10^5 records in total. Aim for O(N log k).',starter:`def merge_logs(files):
    # your code here
    pass
`,solution:`import heapq

def merge_logs(files):
    # heapq.merge is lazy and stable: ties go to the earlier iterable
    return list(heapq.merge(*files, key=lambda rec: rec[0]))
`,tests:[{call:'merge_logs([[(1, "a"), (4, "d")], [(2, "b"), (3, "c")]])'},{call:"merge_logs([])"},{call:'merge_logs([[], [(5, "x")], []])'},{call:'merge_logs([[(1, "zeta"), (2, "q")], [(1, "alpha")]])'},{call:'merge_logs([[(3, "b"), (3, "a")], [(3, "c")]])'},{call:'merge_logs([[(1, {"k": 1})], [(1, {"k": 2})]])',hidden:!0},{call:'merge_logs([[(t, "f%d" % f) for t in range(f, 300, 3)] for f in range(3)]) == [(t, "f%d" % (t % 3)) for t in range(300)]',hidden:!0}],hints:["Pushing `(ts, record)` tuples into a heap compares `record` on equal timestamps: wrong order for strings, `TypeError` for dicts.","Push `(ts, file_index, position, record)` instead, or use `heapq.merge(*files, key=lambda r: r[0])`, which is stable across files."],explanation:"A k-way merge with a heap of one head per file. The tie-break must come from `(file_index, position)`, never from the payload. `heapq.merge` implements exactly this, keeps only k items in memory and accepts iterators, so it can merge files that are far larger than RAM when you pass it generators that read lines.\n\nTime O(N log k), space O(k) for the merge itself.\n\nTraps: `sorted(sum(files, []))` (compares records on ties, O(N log N)), and a manual heap of `(ts, record)` tuples that crashes on dict payloads."},{id:"py-lab-running-totals-per-key",title:"Running total per key",difficulty:"easy",topic:"py-hashmaps-counting",tags:["running sum","window function","defaultdict"],prompt:'Write `running_totals(rows)` where `rows` is a list of `(key, amount)` tuples in event order. Return a list of the same length where each element is `(key, running_total)`: the sum of all amounts for that key up to and including this row.\n\nIt is `SUM(amount) OVER (PARTITION BY key ORDER BY row ROWS UNBOUNDED PRECEDING)`.\n\nExample: `running_totals([("a", 10), ("b", 5), ("a", -3)])` returns `[("a", 10), ("b", 5), ("a", 7)]`.\n\nConstraints: up to 10^5 rows; amounts are ints or floats.',starter:`def running_totals(rows):
    # your code here
    pass
`,solution:`from collections import defaultdict

def running_totals(rows):
    totals = defaultdict(int)
    out = []
    for key, amount in rows:
        totals[key] += amount
        out.append((key, totals[key]))
    return out
`,tests:[{call:'running_totals([("a", 10), ("b", 5), ("a", -3), ("b", 5), ("c", 1)])'},{call:"running_totals([])"},{call:'running_totals([("x", 0), ("x", 0)])'},{call:'running_totals([("k", 1)] * 5)'},{call:'running_totals([("a", 0.5), ("a", 0.25)])'},{call:'running_totals([("u%d" % (i % 2), i) for i in range(10)])',hidden:!0},{call:'running_totals([("a", 10 ** 12), ("a", 10 ** 12)])',hidden:!0}],hints:["Keep one running sum per key in a dict, updated as you go.",'`defaultdict(int)` saves the "first time I see this key" branch.'],explanation:"One pass with a dict of running sums: add the row's amount to its key's total and emit the new total. Rows of other keys are untouched, which is exactly what `PARTITION BY` means.\n\nTime O(n), space O(distinct keys + n output).\n\nTraps: re-summing earlier rows for every row (O(n^2)), one global running total instead of one per key, and in Spark forgetting the explicit `ROWS` frame: with `ORDER BY` and duplicate sort values, the default `RANGE` frame adds all tied rows at once."},{id:"py-lab-validate-records",title:"Validate records against a schema",difficulty:"medium",topic:"py-testable-pipeline-code",tags:["validation","data contracts","types"],prompt:'Write `validate(records, schema)` where `schema` maps field name to one of `"int"`, `"float"`, `"str"`, `"bool"`, optionally followed by `?` for nullable (for example `"str?"`). Report every problem as an `(index, error)` tuple, where `index` is the record\'s position:\n\n- `"missing:<field>"` for each schema field absent from the record (nullable fields must still be present)\n- `"extra:<field>"` for each key not in the schema\n- `"type:<field>"` when the value has the wrong type, or is `None` for a non-nullable field\n\n**Type rules:** `bool` accepts only `True`/`False`; `int` accepts ints but **not** bools; `float` accepts ints and floats but not bools; `str` accepts strings. Return the errors sorted by index, then by error string; valid records produce nothing.\n\nExample: `validate([{"id": 1, "name": "a"}, {"id": "2"}], {"id": "int", "name": "str"})` returns `[(1, "missing:name"), (1, "type:id")]`.',starter:`def validate(records, schema):
    # your code here
    pass
`,solution:`TYPES = {"int": (int,), "float": (int, float), "str": (str,), "bool": (bool,)}

def validate(records, schema):
    errors = []
    for i, rec in enumerate(records):
        for field, tname in schema.items():
            base, nullable = tname.rstrip("?"), tname.endswith("?")
            if field not in rec:
                errors.append((i, "missing:" + field))
                continue
            v = rec[field]
            if v is None:
                ok = nullable
            elif isinstance(v, bool):  # bool is a subclass of int, check it first
                ok = base == "bool"
            else:
                ok = isinstance(v, TYPES[base])
            if not ok:
                errors.append((i, "type:" + field))
        for field in rec:
            if field not in schema:
                errors.append((i, "extra:" + field))
    return sorted(errors)
`,tests:[{call:'validate([{"id": 1, "name": "a", "score": 9.5}, {"id": "2", "name": "b", "score": None}, {"id": 3, "score": 1}], {"id": "int", "name": "str", "score": "float?"})'},{call:'validate([], {"id": "int"})'},{call:'validate([{"id": True}], {"id": "int"})'},{call:'validate([{"id": None, "debug": 1}], {"id": "int"})'},{call:'validate([{"ok": False, "ratio": 1}], {"ok": "bool", "ratio": "float"})'},{call:'validate([{}], {"a": "str", "b": "int?"})'},{call:'validate([{"x": 1.0}, {"x": 0}], {"x": "int"})',hidden:!0},{call:'validate([{"a": "x"}, {"a": 1, "z": 0, "b": 2}], {"a": "str"})',hidden:!0}],hints:["Handle each record in three steps: missing fields, then types of present fields, then extra keys.","`isinstance(True, int)` is `True` in Python because `bool` subclasses `int`. Check for `bool` before anything else.","Collect `(index, error)` tuples and return `sorted(errors)`; tuples sort by index, then by string."],explanation:"Per record, compare its keys with the schema (missing and extra) and check each present value's type. The only subtle rule is `bool`: it subclasses `int`, so it must be checked first or `True` passes as an int. Sorting the tuples gives the required order for free.\n\nTime O(total fields), space O(errors).\n\nTraps: `type(v) == int` style checks that reject ints for float columns, `isinstance(True, int)`, and stopping at the first error per record (pipelines want all errors so one bad batch is fixed in one go). In production this is a data contract enforced with pydantic, Great Expectations or a schema registry."},{id:"py-lab-aggregate-in-chunks",title:"Aggregate a stream in fixed-size chunks",difficulty:"medium",topic:"py-generators-large-files",tags:["generators","islice","streaming aggregation"],prompt:'Write `aggregate_chunks(rows, chunk_size)`. `rows` is any iterable of `(key, value)` pairs, possibly a generator over a file that does not fit in memory: you may iterate it only once and cannot call `len()` or index it. Read it `chunk_size` rows at a time and maintain per-key aggregates.\n\nReturn `{"chunks": number_of_chunks_read, "stats": {key: [count, total, min, max]}}`. The last chunk may be shorter; empty input reads 0 chunks.\n\nExample: `aggregate_chunks([("a", 3), ("b", 1), ("a", 5), ("a", -2), ("b", 4)], 2)` returns `{"chunks": 3, "stats": {"a": [3, 6, -2, 5], "b": [2, 5, 1, 4]}}`.\n\nConstraints: `chunk_size >= 1`; values are ints; memory use should be O(chunk_size + distinct keys).',starter:`def aggregate_chunks(rows, chunk_size):
    # your code here
    pass
`,solution:`from itertools import islice

def aggregate_chunks(rows, chunk_size):
    it = iter(rows)
    stats = {}
    chunks = 0
    while True:
        chunk = list(islice(it, chunk_size))
        if not chunk:
            break
        chunks += 1
        for key, value in chunk:
            s = stats.get(key)
            if s is None:
                stats[key] = [1, value, value, value]
            else:
                s[0] += 1
                s[1] += value
                s[2] = min(s[2], value)
                s[3] = max(s[3], value)
    return {"chunks": chunks, "stats": stats}
`,tests:[{call:'aggregate_chunks([("a", 3), ("b", 1), ("a", 5), ("a", -2), ("b", 4)], 2)'},{call:"aggregate_chunks([], 10)"},{call:'aggregate_chunks((("k", i) for i in range(10)), 3)'},{call:'aggregate_chunks([("x", 1)] * 6, 3)'},{call:'aggregate_chunks(iter([("z", 7)]), 100)'},{call:'aggregate_chunks(map(lambda i: ("a", i * i), range(5)), 1)',hidden:!0},{call:'aggregate_chunks((("u%d" % (i % 4), i) for i in range(1000)), 64)',hidden:!0}],hints:["`len(rows)` and `rows[i:j]` fail on a generator. Call `iter(rows)` once and pull from it.","`list(itertools.islice(it, chunk_size))` takes the next chunk; an empty list means the stream is finished.","Keep `[count, total, min, max]` per key and fold each chunk into it."],explanation:"`iter()` plus `islice` reads a bounded chunk at a time from any iterable, so memory is O(chunk_size) for the buffer plus O(keys) for the aggregates. Count, sum, min and max are all mergeable (associative) aggregates, which is why they can be computed chunk by chunk, and why Spark can compute them with partial aggregation before the shuffle. A mean is derived from sum and count; a median is not mergeable this way.\n\nTime O(n), space O(chunk_size + distinct keys).\n\nTraps: `len()` or slicing on a generator, `list(rows)` up front (defeats streaming), losing the last partial chunk, and initialising min/max with 0 instead of the first value."},{id:"py-lab-top-pages-per-user",title:"Top N pages per user",difficulty:"medium",topic:"py-heaps-top-k",tags:["Counter","top-k per group","heapq"],prompt:'Write `top_pages(events, n)` where `events` is a list of `(user, page)` views. For each user, return their `n` most viewed pages.\n\n**Order:** view count descending, then page ascending (plain string comparison, so `"/p10" < "/p9"`). A user with fewer than `n` distinct pages gets all of them. Return a dict `user -> list of pages`.\n\nExample: `top_pages([("u1", "/home"), ("u1", "/cart"), ("u1", "/home"), ("u2", "/search")], 1)` returns `{"u1": ["/home"], "u2": ["/search"]}`.\n\nConstraints: up to 10^5 events, `n >= 1`.',starter:`def top_pages(events, n):
    # your code here
    pass
`,solution:`import heapq
from collections import Counter, defaultdict

def top_pages(events, n):
    views = defaultdict(Counter)
    for user, page in events:
        views[user][page] += 1
    return {
        user: [page for page, _ in heapq.nsmallest(n, counts.items(), key=lambda kv: (-kv[1], kv[0]))]
        for user, counts in views.items()
    }
`,tests:[{call:'top_pages([("u1", "/home"), ("u1", "/cart"), ("u1", "/home"), ("u2", "/search"), ("u1", "/pay"), ("u2", "/home")], 2)'},{call:"top_pages([], 3)"},{call:'top_pages([("a", "/x")], 5)'},{call:'top_pages([("u", "/b"), ("u", "/a"), ("u", "/c"), ("u", "/b"), ("u", "/c")], 1)'},{call:'top_pages([("u", "/z")] * 3 + [("u", "/a")] * 3 + [("v", "/a")], 2)'},{call:'top_pages([("a", "/p10"), ("a", "/p9")], 1)',hidden:!0},{call:'top_pages([("u%d" % (i % 3), "/p%d" % (i % 5)) for i in range(60)], 2)',hidden:!0}],hints:["Group first: a `defaultdict(Counter)` gives `user -> page -> views` in one pass.","For each user pick the top n with key `(-count, page)`; `heapq.nsmallest` does it in O(d log n)."],explanation:'A two-level hash aggregate followed by a per-group top-n. The key `(-count, page)` encodes "most views first, then alphabetical". In SQL or Spark this is `ROW_NUMBER() OVER (PARTITION BY user ORDER BY views DESC, page ASC) <= n` after a `GROUP BY user, page`.\n\nTime O(E + sum over users of d_u log n), space O(distinct (user, page) pairs).\n\nTraps: `Counter.most_common(n)` (ties come out in first-seen order), using `RANK()` semantics and returning more than n pages on ties, and sorting page names numerically when the rule says plain string order.'},{id:"py-lab-retry-backoff-schedule",title:"Retry a flaky API with capped exponential backoff",difficulty:"medium",topic:"py-concurrency-ingestion",tags:["retries","exponential backoff","simulation"],prompt:"Write `retry_schedule(outcomes, base, factor, cap, max_attempts)` that simulates calling a flaky API. `outcomes[i]` is `True` if attempt `i` (0-based) succeeds; attempts beyond the end of `outcomes` fail. Stop at the first success or after `max_attempts` attempts.\n\nAfter a failed attempt `i`, if another attempt is allowed, wait `min(cap, base * factor ** i)` seconds before retrying. There is no wait after the final attempt.\n\nReturn a tuple `(succeeded, attempts_made, waits)` where `waits` is the list of waits actually performed.\n\nExample: `retry_schedule([False, False, True], 1, 2, 30, 5)` returns `(True, 3, [1, 2])`.\n\nConstraints: `max_attempts >= 1`; `base`, `factor` and `cap` are positive numbers. No randomness: this models backoff without jitter.",starter:`def retry_schedule(outcomes, base, factor, cap, max_attempts):
    # your code here
    pass
`,solution:`def retry_schedule(outcomes, base, factor, cap, max_attempts):
    waits = []
    for attempt in range(max_attempts):
        if attempt < len(outcomes) and outcomes[attempt]:
            return (True, attempt + 1, waits)
        if attempt + 1 < max_attempts:
            waits.append(min(cap, base * factor ** attempt))
    return (False, max_attempts, waits)
`,tests:[{call:"retry_schedule([False, False, True], 1, 2, 30, 5)"},{call:"retry_schedule([True], 1, 2, 30, 5)"},{call:"retry_schedule([], 1, 2, 30, 4)"},{call:"retry_schedule([False] * 10, 1, 3, 20, 6)"},{call:"retry_schedule([False, True], 0.5, 2, 10, 1)"},{call:"retry_schedule([False, False, False, True], 0.25, 2, 1, 10)"},{call:"retry_schedule([False, False, True], 2, 2, 100, 2)",hidden:!0},{call:"retry_schedule([False] * 3, 1, 10, 60, 40)",hidden:!0}],hints:["Loop over attempt numbers `0 .. max_attempts - 1`. Check success first, then decide whether a wait happens.","Only wait if another attempt is still allowed (`attempt + 1 < max_attempts`). The delay is `min(cap, base * factor ** attempt)`."],explanation:'A plain simulation: each failed attempt that will be retried adds one capped exponential delay. Capping keeps the worst-case wait bounded while still backing off quickly from a struggling service.\n\nTime O(max_attempts), space O(max_attempts).\n\nTraps: waiting after the last attempt, off-by-one in the exponent (the first retry waits `base`, not `base * factor`), and an uncapped delay that grows to hours. In production add jitter (for example `random.uniform(0, delay)`, "full jitter") so many clients do not retry in lockstep, retry only retryable errors (timeouts, 429, 5xx), and honour a `Retry-After` header when the API sends one.'}],m=Object.freeze(Object.defineProperty({__proto__:null,default:h},Symbol.toStringTag,{value:"Module"})),g=Object.assign({"./pylab/01-hashing-counting.ts":s,"./pylab/02-two-pointers-windows.ts":r,"./pylab/03-sorting-intervals.ts":l,"./pylab/04-heaps-top-k.ts":c,"./pylab/05-stacks-graphs.ts":p,"./pylab/06-data-tasks.ts":m}),f={"hashing-counting":"Hash maps & counting","two-pointers-windows":"Two pointers & sliding windows","sorting-intervals":"Sorting & intervals","heaps-top-k":"Heaps & top-K","stacks-graphs":"Stacks, queues & graphs","data-tasks":"Data engineering tasks"},y=e=>f[e]??e.replace(/-/g," ").replace(/^\w/,t=>t.toUpperCase()),w=Object.entries(g).sort(([e],[t])=>e.localeCompare(t)).map(([e,t])=>{const n=e.split("/").pop().replace(/\.ts$/,"").replace(/^\d+-/,"");return{id:n,title:y(n),problems:t.default}}),k=w.flatMap(e=>e.problems.map(t=>({...t,group:e.id}))),b=new Map(k.map(e=>[e.id,e]));export{b as P,k as a,w as b};
