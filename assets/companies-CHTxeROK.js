const e={id:"analytics",title:"Analytics firms & banks",blurb:"Heavy SQL, business-scenario rounds and bank-style questions on reconciliation, history and auditability, as often reported at analytics firms, Big-4 consulting and global banks in India.",companies:[{name:"Fractal",process:"Usually starts with an online test or recruiter screen covering SQL and Python, followed by two or three technical rounds and a final HR or leadership chat. Candidates often report a business-scenario or case discussion where you turn a vague client problem into tables, metrics and a pipeline.",focus:["SQL window functions","PySpark transformations","business case framing","Databricks and cloud projects"],experience:"2-8 yrs"},{name:"Tiger Analytics",process:"Often begins with an online assessment on SQL and Python, then technical rounds that go deep on SQL and PySpark, plus a project walkthrough. Some candidates report a scenario or guesstimate-style question and a managerial round at the end.",focus:["complex SQL","PySpark and Spark optimization","project deep dive","scenario questions"],experience:"2-10 yrs"},{name:"Mu Sigma",process:"Known for large campus and early-career hiring, usually with an aptitude and reasoning test, then case-style problem solving and an interview. For data roles the technical part is often SQL-heavy, with questions on joins, aggregations and logical thinking.",focus:["SQL fundamentals","aptitude and logic","case-style problem solving","communication"],experience:"0-5 yrs"},{name:"Deloitte",process:"Usually one or two technical rounds built around your resume and projects, often on SQL, PySpark, Databricks and Azure Data Factory, followed by a managerial or partner fit round. Questions are frequently framed as client scenarios: incremental loads, upserts and failure handling.",focus:["SQL and PySpark","Azure Data Factory and Databricks","incremental loads and MERGE","client scenarios"],experience:"3-12 yrs"},{name:"JPMorgan",process:"Often starts with an online coding test (commonly reported on HackerRank) with programming and SQL, then several technical rounds and a behavioural round. Data engineering interviews often lean on data quality, reconciliation, history tracking and how a pipeline proves its numbers are right.",focus:["SQL windows and joins","reconciliation and data quality","SCD and history","Spark at scale","behavioural"],experience:"2-12 yrs"},{name:"Goldman Sachs",process:"Usually an online test with coding and sometimes SQL, followed by multiple technical rounds that are often reported as rigorous on problem solving. Data roles often add modeling and design questions around trades, positions and point-in-time history.",focus:["problem solving and coding","advanced SQL","data modeling","point-in-time and history"],experience:"1-10 yrs"}],questions:[{id:"an-running-balance",companies:["JPMorgan","Goldman Sachs"],topic:"sql",round:"coding",difficulty:"easy",q:"Compute a running balance per account from a transactions table (credits positive, debits negative).",a:"Use `SUM(amount) OVER (PARTITION BY account_id ORDER BY txn_ts, txn_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`.\n\n`PARTITION BY` restarts the total for each account, `ORDER BY` defines which rows come first, and the frame says: add up everything from the first row to this one. The result keeps every transaction row, unlike `GROUP BY`, which would collapse them.\n\n**Gotcha:** if you leave out the frame, the default is `RANGE`, which treats rows with the same timestamp as one peer group. Two transactions at the same second would then show the same, already combined, balance. Use `ROWS` and add a tie-breaker like `txn_id` so the order is deterministic and re-runs give identical results.",code:{lang:"sql",code:`SELECT account_id,
       txn_id,
       txn_ts,
       amount,
       SUM(amount) OVER (
         PARTITION BY account_id
         ORDER BY txn_ts, txn_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_balance
FROM transactions
ORDER BY account_id, txn_ts, txn_id;`},checking:"Whether you understand window frames and deterministic ordering, not just the SUM syntax.",related:["window-frames","window-functions"]},{id:"an-duplicate-txn-within-minutes",companies:["JPMorgan","Goldman Sachs","Fractal"],topic:"sql",round:"coding",difficulty:"medium",q:"Find possible duplicate transactions: same account, same amount and same merchant within 5 minutes of the previous one.",a:"Partition by the fields that define a duplicate, order by time, and compare each row with the previous one using `LAG`.\n\n`LAG(txn_ts)` gives the timestamp of the previous matching transaction. If the gap is 5 minutes or less, flag the current row. This is one pass over the data, with no self-join, so it scales well on large tables.\n\n**Gotcha:** `LAG` only looks one row back, so a chain like 10:00, 10:04, 10:08 flags both later rows even though 10:08 is 8 minutes after the first. That is usually what fraud teams want (each one is close to its neighbour). If the rule is 'within 5 minutes of the first in the group', you need a self-join or sessionization instead. Also add `txn_id` to the `ORDER BY` so rows at the same second are handled deterministically.",code:{lang:"sql",code:`SELECT txn_id, account_id, merchant_id, amount, txn_ts, prev_ts
FROM (
  SELECT t.*,
         LAG(txn_ts) OVER (
           PARTITION BY account_id, merchant_id, amount
           ORDER BY txn_ts, txn_id
         ) AS prev_ts
  FROM transactions t
) x
WHERE prev_ts IS NOT NULL
  AND txn_ts - prev_ts <= INTERVAL '5 minutes';`},checking:"Whether you can turn a business rule into a window function and reason about its edge cases.",related:["window-functions","sessionization"]},{id:"an-reconciliation-full-outer-join",companies:["JPMorgan","Goldman Sachs","Deloitte"],topic:"sql",round:"technical",difficulty:"medium",q:"Reconcile a source and a target table: list rows missing on either side and rows whose amount does not match.",a:"Use a `FULL OUTER JOIN` on the business key, then classify each row by which side is NULL and whether the values differ.\n\nA full outer join keeps unmatched rows from both tables. If the target key is NULL, the row is missing in the target; if the source key is NULL, it is extra in the target; if both exist but amounts differ, it is a mismatch.\n\n**Gotchas:**\n- Compare with `IS DISTINCT FROM`, not `<>`. `100 <> NULL` is unknown, so a NULL amount on one side would silently be treated as matching.\n- Put the mismatch filter in `WHERE`, not in `ON`, or you will create fake missing rows.\n- Check the key is unique on both sides first; duplicates make the join fan out and the counts lie.",code:{lang:"sql",code:`SELECT COALESCE(s.txn_id, t.txn_id) AS txn_id,
       CASE
         WHEN t.txn_id IS NULL THEN 'missing_in_target'
         WHEN s.txn_id IS NULL THEN 'missing_in_source'
         ELSE 'amount_mismatch'
       END AS recon_status,
       s.amount AS source_amount,
       t.amount AS target_amount
FROM source_txn s
FULL OUTER JOIN target_txn t
  ON s.txn_id = t.txn_id
WHERE s.txn_id IS NULL
   OR t.txn_id IS NULL
   OR s.amount IS DISTINCT FROM t.amount;`},checking:"Whether you know outer join semantics and NULL comparison well enough to trust a reconciliation report.",related:["joins","null-semantics","data-quality-tests"]},{id:"an-cohort-retention",companies:["Fractal","Tiger Analytics","Mu Sigma"],topic:"sql",round:"coding",difficulty:"hard",q:"Build a monthly cohort retention table: for each first-purchase month, what percent of customers bought again in month 1, 2, 3 and so on?",a:"Find each customer's first month (the cohort), find every month they were active, compute the month offset, then divide active customers by cohort size.\n\nSteps:\n- `firsts`: `MIN(order_date)` per customer, truncated to month.\n- `activity`: distinct customer and month pairs, with the number of months since the cohort.\n- `sizes`: customers per cohort.\n- Final: count active customers per cohort and offset, divide by cohort size.\n\nMonth 0 is always 100 percent, which is a quick sanity check.\n\n**Gotcha:** use `DISTINCT` on customer and month, otherwise a customer with five orders in one month counts five times. Also use `100.0` so the division is not integer division, which would round everything to 0.",code:{lang:"sql",code:`WITH firsts AS (
  SELECT customer_id, DATE_TRUNC('month', MIN(order_date)) AS cohort
  FROM orders GROUP BY customer_id
), activity AS (
  SELECT DISTINCT o.customer_id, f.cohort,
         (EXTRACT(YEAR FROM o.order_date) * 12 + EXTRACT(MONTH FROM o.order_date))
       - (EXTRACT(YEAR FROM f.cohort) * 12 + EXTRACT(MONTH FROM f.cohort)) AS month_no
  FROM orders o JOIN firsts f ON f.customer_id = o.customer_id
), sizes AS (
  SELECT cohort, COUNT(*) AS cohort_size FROM firsts GROUP BY cohort
)
SELECT a.cohort, a.month_no,
       COUNT(*) AS active_customers,
       ROUND(100.0 * COUNT(*) / s.cohort_size, 1) AS retention_pct
FROM activity a
JOIN sizes s ON s.cohort = a.cohort
GROUP BY a.cohort, a.month_no, s.cohort_size
ORDER BY a.cohort, a.month_no;`},checking:"Whether you can break a business metric into clean CTE steps and avoid double counting.",related:["funnels-and-retention","ctes-recursive","design-product-analytics"]},{id:"an-declining-spend-three-months",companies:["Tiger Analytics","Fractal"],topic:"sql",round:"coding",difficulty:"hard",q:"Find customers whose monthly spend declined for 3 consecutive months.",a:"Aggregate spend per customer per month, then use `LAG` to compare each month with the one and two months before it.\n\nHere 'declined for 3 consecutive months' is read as three months in a row, each lower than the one before (month m-2 > m-1 > m). State your interpretation out loud: some interviewers mean three declines, which needs four months and one more `LAG`.\n\n**Gotcha:** `LAG` looks at the previous row, not the previous calendar month. If a customer had no spend in August, July would sit next to September and look consecutive. Check that the month two rows back really is exactly two months earlier, or first build a full month calendar per customer with zero-spend months filled in, depending on whether a gap should count as a decline.",code:{lang:"sql",code:`WITH monthly AS (
  SELECT customer_id, DATE_TRUNC('month', txn_date) AS m, SUM(amount) AS spend
  FROM transactions
  GROUP BY customer_id, DATE_TRUNC('month', txn_date)
), lagged AS (
  SELECT customer_id, m, spend,
         LAG(spend, 1) OVER w AS spend_1,
         LAG(spend, 2) OVER w AS spend_2,
         LAG(m, 2)     OVER w AS m_2
  FROM monthly
  WINDOW w AS (PARTITION BY customer_id ORDER BY m)
)
SELECT DISTINCT customer_id
FROM lagged
WHERE spend < spend_1
  AND spend_1 < spend_2
  AND m_2 = m - INTERVAL '2 months';`},checking:"Whether you clarify an ambiguous requirement and notice that row order is not the same as calendar order.",related:["window-functions","gaps-and-islands"]},{id:"an-percent-of-total",companies:["Fractal","Tiger Analytics","Mu Sigma"],topic:"sql",round:"coding",difficulty:"easy",q:"Show each product's sales and its percent share of its region's total sales.",a:"Group by region and product, then divide by `SUM(SUM(sales)) OVER (PARTITION BY region)`.\n\nThe inner `SUM` is the normal group aggregate (sales per product). The outer `SUM ... OVER` runs after grouping and adds those group totals within each region, giving the regional total on every row. No second query or self-join is needed.\n\n**Gotchas:**\n- Multiply by `100.0`, not `100`. If `sales` is an integer, integer division turns most shares into 0.\n- Wrap the denominator in `NULLIF(..., 0)` if a region can total zero, to avoid a divide-by-zero error.\n- Use `OVER ()` with nothing inside for share of the grand total.",code:{lang:"sql",code:`SELECT region,
       product,
       SUM(sales) AS sales,
       ROUND(
         100.0 * SUM(sales)
         / NULLIF(SUM(SUM(sales)) OVER (PARTITION BY region), 0),
       2) AS pct_of_region
FROM sales
GROUP BY region, product
ORDER BY region, pct_of_region DESC;`},checking:"Whether you know that window functions run after GROUP BY and can be nested over aggregates.",related:["window-functions","logical-query-order"]},{id:"an-median-percentile",companies:["Mu Sigma","Tiger Analytics","Goldman Sachs"],topic:"sql",round:"technical",difficulty:"medium",q:"How do you compute the median and the 90th percentile of transaction amount per segment?",a:"Use the ordered-set aggregates `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount)` for the median and `PERCENTILE_CONT(0.9)` or `PERCENTILE_DISC(0.9)` for the 90th percentile.\n\nThe difference matters:\n- `PERCENTILE_CONT` interpolates between the two middle values, so the median of 10 and 20 is 15, which may not exist in the data.\n- `PERCENTILE_DISC` returns an actual value from the data, the first one at or above that percentile.\n\nAverages are pulled by a few very large transactions; medians and percentiles are what risk and pricing teams usually ask for.\n\n**Gotcha:** in PostgreSQL these are aggregates, not window functions, so you cannot add `OVER (...)`. In Spark, exact percentiles are expensive on big data; use `percentile_approx`, and say it is approximate.",code:{lang:"sql",code:`SELECT segment,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) AS median_amount,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY amount) AS p90_interpolated,
       PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY amount) AS p90_actual_value,
       AVG(amount) AS mean_amount
FROM transactions
GROUP BY segment;`},checking:"Whether you know the robust statistics functions and the difference between interpolated and discrete percentiles.",related:["aggregation-grouping-sets"]},{id:"an-pivot-by-channel",companies:["Deloitte","Fractal"],topic:"sql",round:"coding",difficulty:"easy",q:"Pivot transactions so each customer is one row with total amount by channel (UPI, CARD, NETBANKING) as columns.",a:"Use conditional aggregation: `SUM(CASE WHEN channel = 'UPI' THEN amount ELSE 0 END)` for each channel, grouped by customer.\n\nThis is portable across almost every database, while `PIVOT` syntax differs between engines (SQL Server, Snowflake and Spark have it, PostgreSQL does not). PostgreSQL also supports the neater `SUM(amount) FILTER (WHERE channel = 'UPI')`.\n\n**Gotchas:**\n- `ELSE 0` versus no `ELSE` changes the output: without it, a customer with no UPI spend gets NULL instead of 0. Pick the one the report needs.\n- The column list is fixed. A new channel such as 'WALLET' will not appear until someone edits the query, so mention dynamic SQL or Spark's `groupBy().pivot()` for changing categories.",code:{lang:"sql",code:`SELECT customer_id,
       SUM(CASE WHEN channel = 'UPI'        THEN amount ELSE 0 END) AS upi_amount,
       SUM(CASE WHEN channel = 'CARD'       THEN amount ELSE 0 END) AS card_amount,
       SUM(CASE WHEN channel = 'NETBANKING' THEN amount ELSE 0 END) AS netbanking_amount,
       SUM(amount) AS total_amount
FROM transactions
GROUP BY customer_id;`},checking:"Whether you can reshape data with portable SQL instead of relying on vendor-specific syntax.",related:["aggregation-grouping-sets"]},{id:"an-latest-record-per-key",companies:["JPMorgan","Deloitte","Tiger Analytics"],topic:"sql",round:"coding",difficulty:"easy",q:"A customer table receives a new row on every update. Return only the latest row per customer.",a:"Number the rows per customer with `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC)` and keep row number 1.\n\nThis returns the whole latest row, all columns, which `GROUP BY` with `MAX(updated_at)` cannot do without joining back to the table. It is also the standard dedup step before a MERGE.\n\n**Gotchas:**\n- If two rows share the same `updated_at`, `ROW_NUMBER` picks one arbitrarily, and re-runs might pick differently. Add a tie-breaker such as a sequence number or ingestion time.\n- `RANK` would return both tied rows; use it only when you want ties.\n- If `updated_at` can be NULL, remember PostgreSQL sorts NULLs first under `DESC`; add `NULLS LAST`.",code:{lang:"sql",code:`SELECT *
FROM (
  SELECT c.*,
         ROW_NUMBER() OVER (
           PARTITION BY customer_id
           ORDER BY updated_at DESC NULLS LAST, ingest_seq DESC
         ) AS rn
  FROM customer_updates c
) x
WHERE rn = 1;`},checking:"Whether you know the go-to dedup pattern and handle ties so results are deterministic.",related:["top-n-and-dedup","window-functions"]},{id:"an-scd2-as-of-join",companies:["JPMorgan","Goldman Sachs","Deloitte"],topic:"sql",round:"technical",difficulty:"hard",q:"For each transaction, show the customer's risk rating that was valid at the time of the transaction, using an SCD2 history table.",a:"Join on the customer key and on the time range: `txn_ts >= valid_from AND txn_ts < valid_to`, treating an open `valid_to` as far future.\n\nAn SCD2 table has one row per version of a customer, each with a validity window. A point-in-time (as-of) join picks the version whose window contains the transaction time. Regulators and auditors often ask 'what did we know at that time', so banks care a lot about this.\n\n**Gotchas:**\n- Use half-open ranges (`>=` start, `<` end). With `BETWEEN` on both ends, a transaction exactly on a boundary matches two versions and the row doubles.\n- Overlapping versions in the history also cause fan-out; test that windows never overlap per key.\n- Use a `LEFT JOIN` so transactions before the first version still show up, with a NULL rating you can flag.",code:{lang:"sql",code:`SELECT t.txn_id,
       t.customer_id,
       t.txn_ts,
       t.amount,
       c.risk_rating
FROM transactions t
LEFT JOIN customer_dim_hist c
  ON c.customer_id = t.customer_id
 AND t.txn_ts >= c.valid_from
 AND t.txn_ts <  COALESCE(c.valid_to, TIMESTAMP '9999-12-31 00:00:00');`},checking:"Whether you understand history tables well enough to get point-in-time answers without duplicates.",related:["slowly-changing-dimensions","design-scd2-pipeline"]},{id:"an-not-in-null-trap",companies:["Deloitte","Mu Sigma","JPMorgan"],topic:"sql",round:"technical",difficulty:"medium",q:"`SELECT * FROM accounts WHERE account_id NOT IN (SELECT account_id FROM closed_accounts)` returns zero rows. Why?",a:"Because `closed_accounts.account_id` contains at least one NULL, and `NOT IN` against a list with a NULL can never be true.\n\n`x NOT IN (1, 2, NULL)` expands to `x <> 1 AND x <> 2 AND x <> NULL`. The last part is unknown, and `true AND unknown` is unknown, so `WHERE` drops every row. No error, just an empty result, which is why it is dangerous.\n\nFix: use `NOT EXISTS`, which only checks whether a matching row exists and is not affected by NULLs. A `LEFT JOIN ... WHERE right.key IS NULL` anti-join also works.\n\n**Gotcha:** adding `WHERE account_id IS NOT NULL` inside the subquery fixes it too, but the next person may remove it. `NOT EXISTS` is safe by design and usually plans as an efficient anti-join.",code:{lang:"sql",code:`-- Safe version
SELECT a.*
FROM accounts a
WHERE NOT EXISTS (
  SELECT 1
  FROM closed_accounts c
  WHERE c.account_id = a.account_id
);`},checking:"Whether you understand SQL's three-valued logic and choose NULL-safe patterns by habit.",related:["null-semantics","not-in-null-empty-result","subqueries-vs-joins"]},{id:"an-second-highest-per-customer",companies:["Mu Sigma","Deloitte"],topic:"sql",round:"coding",difficulty:"easy",q:"Find the second-highest transaction amount for each customer.",a:"Rank amounts per customer with `DENSE_RANK() OVER (PARTITION BY customer_id ORDER BY amount DESC)` and keep rank 2.\n\nThe choice of ranking function is the real question:\n- `DENSE_RANK`: amounts 500, 500, 300 give ranks 1, 1, 2, so the second-highest distinct amount is 300.\n- `ROW_NUMBER`: gives 1, 2, 3, so 'second' would be the other 500.\n- `RANK`: gives 1, 1, 3, so there is no rank 2 at all and the customer disappears.\n\nAsk the interviewer which meaning they want; usually it is the second-highest distinct value, which is `DENSE_RANK`.\n\n**Gotcha:** customers with only one distinct amount have no rank 2 and drop out. If the report must list every customer, left join this result back to the customer list.",code:{lang:"sql",code:`SELECT customer_id, amount AS second_highest
FROM (
  SELECT customer_id,
         amount,
         DENSE_RANK() OVER (
           PARTITION BY customer_id
           ORDER BY amount DESC
         ) AS rnk
  FROM transactions
) x
WHERE rnk = 2
GROUP BY customer_id, amount;`},checking:"Whether you know how ROW_NUMBER, RANK and DENSE_RANK treat ties.",related:["top-n-and-dedup","window-functions"]},{id:"an-consecutive-active-days",companies:["Goldman Sachs","Tiger Analytics"],topic:"sql",round:"coding",difficulty:"medium",q:"Find customers who transacted on at least 3 consecutive days, with the start and end date of each streak.",a:"Use the gaps-and-islands trick: subtract a row number from the date, and consecutive dates end up with the same group value.\n\nFor dates 1, 2, 3, 7 with row numbers 1, 2, 3, 4, `date - row_number` gives 0, 0, 0, 3. The first three share a group, so they are one streak. Group by customer and that value, and keep groups with 3 or more days.\n\n**Gotcha:** deduplicate to one row per customer per day first. A customer with two transactions on the same day would get two row numbers for one date, which breaks the trick and splits the streak. Also make sure `txn_date` is a `date`, not a timestamp, before subtracting.",code:{lang:"sql",code:`WITH days AS (
  SELECT DISTINCT customer_id, CAST(txn_ts AS date) AS txn_date
  FROM transactions
), grouped AS (
  SELECT customer_id, txn_date,
         txn_date - CAST(ROW_NUMBER() OVER (
           PARTITION BY customer_id ORDER BY txn_date) AS int) AS grp
  FROM days
)
SELECT customer_id,
       MIN(txn_date) AS streak_start,
       MAX(txn_date) AS streak_end,
       COUNT(*) AS streak_days
FROM grouped
GROUP BY customer_id, grp
HAVING COUNT(*) >= 3;`},checking:"Whether you know the gaps-and-islands pattern and the dedup step it depends on.",related:["gaps-and-islands","window-functions"]},{id:"an-month-over-month-growth",companies:["Fractal","Tiger Analytics"],topic:"sql",round:"coding",difficulty:"easy",q:"Calculate month-over-month revenue growth percentage.",a:"Aggregate revenue per month, then compare each month with the previous one using `LAG(revenue) OVER (ORDER BY month)`.\n\nGrowth percent is `(current - previous) / previous * 100`. The first month has no previous value, so `LAG` returns NULL and the growth is NULL, which is correct: there is nothing to compare against.\n\n**Gotchas:**\n- Wrap the previous value in `NULLIF(..., 0)` so a zero month does not throw a divide-by-zero error.\n- If a month has no sales at all, it is missing from the grouped result, and `LAG` will compare against two months ago. For a strict report, generate a calendar of months (for example with `generate_series`) and left join revenue onto it.\n- Keep money as `numeric`, not float, so rounding is exact.",code:{lang:"sql",code:`WITH monthly AS (
  SELECT DATE_TRUNC('month', order_date) AS month,
         SUM(amount) AS revenue
  FROM orders
  GROUP BY DATE_TRUNC('month', order_date)
)
SELECT month,
       revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev_revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 2) AS mom_growth_pct
FROM monthly
ORDER BY month;`},checking:"Whether you handle the first period, zero values and missing months in a basic trend metric.",related:["window-functions"]},{id:"an-join-fanout-revenue",companies:["Deloitte","Fractal"],topic:"sql",round:"technical",difficulty:"medium",q:"After joining orders to payments, total revenue suddenly looks double what finance reports. What happened and how do you fix it?",a:`The join fanned out: an order with two payment rows appears twice, so \`SUM(order_total)\` counts it twice.

A join returns one row per matching pair. If the relationship is one-to-many (one order, many payments or many shipments), every column from the 'one' side is repeated. Summing those repeated values inflates totals. Joining two child tables at once is even worse, because rows multiply.

Fix: aggregate the child table to the parent's grain first, then join. Each order then matches at most one row.

**Gotcha:** \`SUM(DISTINCT order_total)\` is a tempting shortcut but is wrong: two different orders with the same total would be counted once. Always check the grain of each table (what one row means) before joining, and compare row counts before and after.`,code:{lang:"sql",code:`WITH paid AS (
  SELECT order_id, SUM(amount) AS paid_amount
  FROM payments
  GROUP BY order_id
)
SELECT SUM(o.order_total)               AS revenue,
       SUM(COALESCE(p.paid_amount, 0))  AS collected
FROM orders o
LEFT JOIN paid p ON p.order_id = o.order_id;`},checking:"Whether you think in terms of table grain and can explain where inflated numbers come from.",related:["joins","join-fanout-inflated-revenue","query-anti-patterns"]},{id:"an-where-vs-having-alias",companies:["Mu Sigma","Deloitte"],topic:"sql",round:"technical",difficulty:"easy",q:"Why does `WHERE total_spend > 1000` fail when `total_spend` is a `SUM` alias in the SELECT? What is the difference between WHERE and HAVING?",a:"Because SQL runs `WHERE` before `GROUP BY` and `SELECT`, so the alias and the aggregate do not exist yet when `WHERE` is evaluated. Use `HAVING` to filter on aggregates.\n\nThe logical order is roughly: `FROM` and joins, `WHERE`, `GROUP BY`, `HAVING`, window functions, `SELECT`, `DISTINCT`, `ORDER BY`, `LIMIT`. So:\n- `WHERE` filters individual rows before grouping.\n- `HAVING` filters groups after aggregation.\n\nPut row-level conditions in `WHERE` whenever you can: it reduces the rows that need grouping, which is faster.\n\n**Gotcha:** some engines (PostgreSQL, Spark) let you use a SELECT alias in `GROUP BY` or `ORDER BY`, but not in `WHERE`, and standard SQL does not allow it in `HAVING` either. Repeat the expression or wrap the query in a CTE to be portable.",code:{lang:"sql",code:`SELECT customer_id, SUM(amount) AS total_spend
FROM transactions
WHERE txn_date >= DATE '2026-01-01'   -- row filter, before grouping
GROUP BY customer_id
HAVING SUM(amount) > 1000              -- group filter, after grouping
ORDER BY total_spend DESC;             -- alias is fine here`},checking:"Whether you know the logical order of SQL clauses, which explains many common errors.",related:["logical-query-order"]},{id:"an-incremental-load-watermark",companies:["Deloitte","Tiger Analytics"],topic:"spark",round:"technical",difficulty:"medium",q:"How do you load only new or changed rows from a source table every day using a watermark column?",a:`Store the highest \`updated_at\` you have successfully loaded in a control table, read only rows above it next time, and move the watermark forward only after the write succeeds.

This avoids re-reading the full source every day. The control table makes the job restartable: if the write fails, the watermark has not moved, so the next run picks up the same rows.

**Gotchas:**
- Set the new watermark from \`MAX(updated_at)\` in the data you loaded, not from the current clock, or rows committed late in the source can be skipped.
- Long-running source transactions can commit rows with an older \`updated_at\`. A safe pattern is to re-read a small overlap (for example the last hour) and let a MERGE on the key absorb duplicates.
- Handle the empty batch: if no rows arrive, keep the old watermark.`,code:{lang:"python",code:`from pyspark.sql import functions as F

last_wm = (spark.table("etl_control")
           .filter(F.col("table_name") == "transactions")
           .agg(F.max("watermark")).first()[0])

batch = (spark.table("raw.transactions")
         .filter(F.col("updated_at") > F.lit(last_wm)))

new_wm = batch.agg(F.max("updated_at")).first()[0]
if new_wm is not None:
    batch.write.format("delta").mode("append").saveAsTable("bronze.transactions")
    spark.sql(f"""UPDATE etl_control SET watermark = '{new_wm}'
                  WHERE table_name = 'transactions'""")`},checking:"Whether your incremental design is restartable and does not silently drop late-committed rows.",related:["design-cdc-merge","delta-lake-iceberg","design-lakehouse-etl"]},{id:"an-delta-merge-upsert",companies:["Deloitte","JPMorgan","Fractal"],topic:"spark",round:"coding",difficulty:"medium",q:"Write a PySpark Delta Lake MERGE that upserts daily customer updates into a silver table.",a:"Deduplicate the incoming batch to one row per key, then `merge` on the key: update when matched and newer, insert when not matched.\n\nDelta `MERGE` rewrites only the files that contain matched rows and commits atomically, so readers never see a half-applied batch. The condition on `updated_at` stops an older record, replayed by a re-run, from overwriting a newer one.\n\n**Gotcha:** if the source has two rows for the same `customer_id`, MERGE fails with an error saying multiple source rows matched the same target row. That is why the `row_number` dedup comes first. Also, include partition columns in the join condition when the target is partitioned, so Delta can prune files instead of scanning the whole table.",code:{lang:"python",code:`from delta.tables import DeltaTable
from pyspark.sql import Window, functions as F

w = Window.partitionBy("customer_id").orderBy(F.col("updated_at").desc())
src = (updates.withColumn("rn", F.row_number().over(w))
              .filter("rn = 1").drop("rn"))

target = DeltaTable.forName(spark, "silver.customers")
(target.alias("t")
   .merge(src.alias("s"), "t.customer_id = s.customer_id")
   .whenMatchedUpdateAll(condition="s.updated_at > t.updated_at")
   .whenNotMatchedInsertAll()
   .execute())`},checking:"Whether you can write a correct, re-runnable upsert and know why MERGE fails on duplicate keys.",related:["delta-lake-iceberg","design-cdc-merge"]},{id:"an-schema-evolution",companies:["Deloitte","Tiger Analytics"],topic:"spark",round:"technical",difficulty:"medium",q:"The source system added two new columns to a daily file. How do you handle schema evolution in a Delta pipeline?",a:"For new columns, write with `mergeSchema` (or enable auto-merge for MERGE) so Delta adds them to the table; old rows get NULL. For type changes or dropped columns, plan an explicit migration.\n\nBy default Delta enforces the table schema and rejects a write with unknown columns, which protects you from bad files. Adding nullable columns is a safe change. Changing `amount` from int to string, or renaming a column, is not safe and usually needs `overwriteSchema` with a full rewrite, or a new column plus backfill.\n\n**Gotcha:** turning on auto-merge everywhere means a typo upstream (`custmer_id`) silently becomes a new column full of data while the real column goes NULL. Banks usually prefer a schema contract: compare the incoming schema with the expected one, alert on differences, and evolve on purpose.",code:{lang:"python",code:`# Append that is allowed to add new nullable columns
(df.write.format("delta")
   .mode("append")
   .option("mergeSchema", "true")
   .saveAsTable("silver.transactions"))

# For MERGE statements, schema evolution is a session setting
spark.conf.set("spark.databricks.delta.schema.autoMerge.enabled", "true")

# Simple contract check before writing
expected = set(spark.table("silver.transactions").columns)
extra = set(df.columns) - expected
if extra:
    print(f"New columns detected: {sorted(extra)}")`},checking:"Whether you balance flexibility with protection against silent schema drift.",related:["delta-lake-iceberg","writing-data"]},{id:"an-skewed-customer-keys",companies:["JPMorgan","Goldman Sachs","Tiger Analytics"],topic:"spark",round:"technical",difficulty:"hard",q:"A join on customer_id takes hours because a few corporate customers have millions of transactions. How do you fix it?",a:`It is data skew: all rows for a hot key go to one task. First enable AQE skew join handling; if that is not enough, salt the hot keys.

In a shuffle join, every row with the same key lands in the same partition, so one task gets millions of rows while hundreds finish in seconds. The Spark UI shows this as one task far slower than the median in the stage.

Options, simplest first:
- If the customer table is small, **broadcast** it: no shuffle, no skew.
- **AQE** (\`spark.sql.adaptive.skewJoin.enabled\`) splits oversized partitions automatically in Spark 3.
- **Salting**: add a random number 0 to N-1 to the big side, replicate the small side N times, join on key plus salt.

**Gotcha:** salting multiplies the small side by N. Salt only the known hot keys if the dimension is large.`,code:{lang:"python",code:`from pyspark.sql import functions as F

spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")

N = 16
txn_salted = txns.withColumn("salt", (F.rand() * N).cast("int"))
cust_salted = customers.withColumn(
    "salt", F.explode(F.array([F.lit(i) for i in range(N)])))

joined = (txn_salted
          .join(cust_salted, ["customer_id", "salt"])
          .drop("salt"))`},checking:"Whether you can diagnose skew from symptoms and pick the cheapest fix before reaching for salting.",related:["data-skew","skewed-join-straggler","adaptive-query-execution"]},{id:"an-optimize-slow-join",companies:["Fractal","Deloitte"],topic:"spark",round:"technical",difficulty:"medium",q:"A PySpark job joining a large transactions table to a branch lookup table is slow. Walk through how you would speed it up.",a:`Start with \`explain()\` and the Spark UI, then reduce data before the join and broadcast the small table.

A practical checklist:
- **Filter and select early.** Read only the dates and columns you need, so partition pruning and column pruning cut the input.
- **Broadcast the small side.** If the lookup is a few MB, \`broadcast()\` sends it to every executor and avoids shuffling the big table. The plan should show \`BroadcastHashJoin\` instead of \`SortMergeJoin\`.
- **Check for skew** in the stage's task times.
- **Check join keys** have the same data type; a string to int join can block optimizations and even give wrong matches.
- Enable **AQE** so Spark can switch strategy at runtime.

**Gotcha:** do not broadcast something that is only small after a filter you have not applied yet, or a table that grows over time. Broadcasting a large table can crash the driver or executors with out-of-memory errors.`,code:{lang:"python",code:`from pyspark.sql import functions as F
from pyspark.sql.functions import broadcast

txn = (spark.table("silver.transactions")
       .filter(F.col("txn_date") == "2026-11-01")      # partition pruning
       .select("txn_id", "branch_id", "amount"))        # column pruning

branches = spark.table("ref.branches").select("branch_id", "region")

result = txn.join(broadcast(branches), "branch_id")
result.explain()   # expect BroadcastHashJoin`},checking:"Whether you have a structured tuning approach backed by the plan, not random config changes.",related:["join-strategies","reading-explain-plans","broadcast-join-failure"]},{id:"an-partition-daily-transactions",companies:["JPMorgan","Goldman Sachs"],topic:"spark",round:"design",difficulty:"medium",q:"How would you partition a table that receives about 50 million transactions per day and is queried mostly by date range and account?",a:`Partition by \`txn_date\`, and inside each partition cluster or Z-order by \`account_id\`.

Most queries filter on a date range, so date partitions let Spark skip whole folders (partition pruning). Accounts have far too many distinct values to be a partition column: you would get millions of tiny folders. Clustering by account inside each day keeps similar account IDs in the same files, so file-level statistics let the reader skip files for account lookups.

Aim for partitions of a few GB with files of roughly 128 MB to 1 GB.

**Gotchas:**
- Never partition by a raw timestamp; that creates one folder per second.
- Filter on the partition column itself. \`WHERE to_date(txn_ts) = ...\` on a different column will not prune.
- Streaming or frequent small appends create many small files, so schedule compaction (\`OPTIMIZE\`).`,code:{lang:"python",code:`(df.withColumn("txn_date", df.txn_ts.cast("date"))
   .write.format("delta")
   .partitionBy("txn_date")
   .mode("append")
   .saveAsTable("silver.transactions"))

# Periodic maintenance on Delta
spark.sql("""
  OPTIMIZE silver.transactions
  WHERE txn_date >= current_date() - INTERVAL 7 DAYS
  ZORDER BY (account_id)
""")`},checking:"Whether you pick partition columns by query pattern and cardinality, and know the small-files trade-off.",related:["partitioning","partition-pruning-pushdown","small-files-compaction"]},{id:"an-data-quality-checks-pyspark",companies:["JPMorgan","Deloitte"],topic:"spark",round:"coding",difficulty:"medium",q:"Write data quality checks in PySpark for a transactions batch before it is published: nulls in keys, duplicate IDs and future dates.",a:`Compute all the checks in one aggregation pass, compare them with thresholds, and fail the job (or quarantine the batch) before writing to the published table.

Doing every check in a single \`agg\` means Spark scans the data once instead of once per check. Failing loudly is important in banking: a report built on a bad batch is worse than a late report.

Typical checks: not-null keys, unique keys, valid ranges (no future dates), allowed values (currency codes), and row counts compared with the source or with yesterday.

**Gotcha:** \`countDistinct\` ignores NULLs, so compare it with the count of non-null IDs, not with the total, or one problem shows up as two. Log the check results to a table as well, so auditors can see each run passed.`,code:{lang:"python",code:`from pyspark.sql import functions as F

r = batch.agg(
    F.count("*").alias("rows"),
    F.sum(F.col("txn_id").isNull().cast("int")).alias("null_ids"),
    F.countDistinct("txn_id").alias("distinct_ids"),
    F.sum((F.col("txn_date") > F.current_date()).cast("int")).alias("future_dates"),
).first()

errors = []
if r["null_ids"] > 0:
    errors.append(f"{r['null_ids']} null txn_id")
if r["distinct_ids"] != r["rows"] - r["null_ids"]:
    errors.append("duplicate txn_id values")
if (r["future_dates"] or 0) > 0:
    errors.append(f"{r['future_dates']} future-dated rows")
if errors:
    raise ValueError("DQ failed: " + "; ".join(errors))`},checking:"Whether you treat data quality as a gate in the pipeline and write checks that are efficient and correct.",related:["data-quality-tests","design-lakehouse-etl"]},{id:"an-caching-tradeoffs",companies:["Tiger Analytics","Fractal"],topic:"spark",round:"technical",difficulty:"easy",q:"When should you cache a DataFrame in Spark, and when does caching hurt?",a:`Cache when the same expensive DataFrame is reused by two or more actions; do not cache data used once or data too large to fit in memory.

Spark is lazy, so without caching every action recomputes the full lineage from the source. If you read and clean a table once, then write three different aggregates from it, caching the cleaned DataFrame saves two full recomputations.

Caching costs memory that execution (joins, sorts) also needs. Over-caching causes spill, eviction and sometimes out-of-memory errors, and the job can end up slower.

**Gotchas:**
- \`cache()\` is lazy too; nothing is stored until an action runs.
- Call \`unpersist()\` when you are done.
- \`persist(StorageLevel.MEMORY_AND_DISK)\` is safer for large data than memory-only.
- Caching a DataFrame before a filter caches more than you need; filter and select first.`,checking:"Whether you understand lazy evaluation and the memory trade-off instead of caching everything by reflex.",related:["caching-persistence","lazy-evaluation-dag","unified-memory-model"]},{id:"an-pandas-vs-pyspark",companies:["Fractal","Mu Sigma","Tiger Analytics"],topic:"spark",round:"technical",difficulty:"easy",q:"When would you use Pandas instead of PySpark, and what goes wrong when people mix them?",a:"Use Pandas when the data fits comfortably in one machine's memory (roughly up to a few GB); use PySpark when it does not, or when the job must scale and run on a cluster.\n\nPandas runs on one machine, eagerly, and is fast and convenient for small data, exploration and quick analysis. PySpark splits data across executors, is lazy and optimizes the whole plan, but has overhead: for a 10 MB file, starting a cluster job is slower than Pandas.\n\n**Gotchas:**\n- `df.toPandas()` pulls the entire DataFrame to the driver. On a large table this is the classic driver out-of-memory crash. Aggregate or sample in Spark first.\n- Row-by-row Python loops over Spark data defeat the point of Spark.\n- If you need Pandas logic at scale, use `pandas_udf` or `applyInPandas`, which run Pandas code on each partition with Arrow, or the pandas API on Spark (`pyspark.pandas`).",checking:"Whether you understand single-node versus distributed execution and the driver memory risk.",related:["spark-architecture","driver-oom-collect","python-udfs-arrow"]},{id:"an-udf-performance",companies:["Tiger Analytics","Fractal"],topic:"spark",round:"technical",difficulty:"medium",q:"Why is a Python UDF slow in PySpark, and what do you use instead?",a:"A regular Python UDF is slow because every row is serialized from the JVM to a Python worker and back, and Spark cannot optimize what happens inside it. Prefer built-in functions; if you must use Python, use a vectorized `pandas_udf`.\n\nBuilt-in functions such as `when`, `regexp_replace` and `date_format` run inside the JVM, use whole-stage code generation and are visible to the optimizer. A Python UDF is a black box: no predicate pushdown through it and a serialization cost per row.\n\n`pandas_udf` uses Apache Arrow to send whole batches of rows as columns, so the overhead is paid once per batch, and your function works on Pandas Series with vectorized maths.\n\n**Gotcha:** UDFs also need explicit NULL handling. A built-in like `when` handles NULLs predictably; a Python function may crash on `None` and fail the whole stage.",code:{lang:"python",code:`import pandas as pd
from pyspark.sql import functions as F

# Slow: row-at-a-time Python UDF
@F.udf("string")
def band_udf(amount):
    return "HIGH" if amount is not None and amount > 100000 else "LOW"

# Fast: built-in expression, stays in the JVM
df = df.withColumn(
    "band", F.when(F.col("amount") > 100000, "HIGH").otherwise("LOW"))

# If Python is unavoidable: vectorized pandas UDF
@F.pandas_udf("double")
def to_inr(amount: pd.Series, fx_rate: pd.Series) -> pd.Series:
    return amount * fx_rate`},checking:"Whether you know where Python overhead comes from in PySpark and the ladder of better options.",related:["python-udfs-arrow","slow-python-udf","tungsten-codegen"]},{id:"an-daily-risk-mart",companies:["JPMorgan","Goldman Sachs"],topic:"pipeline",round:"design",difficulty:"hard",q:"Design a daily pipeline that builds a risk and transactions mart for regulatory reporting.",a:`Use a layered lakehouse: raw landing, cleaned and conformed history, then a reporting mart keyed by business date, with controls at every hop.

- **Bronze:** land source extracts as-is (trades, transactions, accounts, FX rates), with \`batch_id\`, file name and load time.
- **Silver:** typed, deduplicated, MERGEd by key; customer and account dimensions kept as SCD2 so you can answer 'as of' questions.
- **Gold:** facts at a clear grain (one row per account per business date, one row per transaction), joined to the dimension version valid on that date.
- **Controls:** row counts and amount totals reconciled with the source, DQ checks that block publishing, and a run log.
- **Re-runs:** every step writes by \`business_date\` partition with overwrite or MERGE, so re-running a date is safe.

**Gotcha:** regulators often ask you to reproduce a report exactly as it was submitted. Keep the published snapshot (or use Delta time travel with a retention policy long enough), and do not let corrections silently change past numbers.`,checking:"Whether you design for correctness, auditability and safe re-runs, not just for moving data.",related:["design-lakehouse-etl","dimensional-modeling","design-scd2-pipeline"]},{id:"an-audit-columns-lineage",companies:["JPMorgan","Deloitte"],topic:"pipeline",round:"technical",difficulty:"medium",q:"What audit columns do you add to tables in a banking data pipeline, and how do they help with lineage?",a:"Add columns that say where each row came from and when: `batch_id`, `source_system`, `source_file`, `load_ts`, `updated_ts` and a `row_hash` of the business columns.\n\nWith these, you can answer audit questions quickly: which file produced this row, which run changed it, and what else came in the same batch. `batch_id` links rows to a run log table holding counts, status and code version. `row_hash` lets MERGE detect real changes cheaply and helps reconciliation.\n\nFor table-level lineage, use your catalog (for example Unity Catalog or Purview) and Delta's table history, which records every write operation.\n\n**Gotcha:** `concat_ws` skips NULLs, so ('A', NULL) and (NULL, 'A') produce the same string and the same hash. Replace NULLs with a marker before hashing.",code:{lang:"python",code:`from pyspark.sql import functions as F

business_cols = ["txn_id", "account_id", "amount", "currency", "txn_ts"]
hash_input = F.concat_ws("||", *[
    F.coalesce(F.col(c).cast("string"), F.lit("<NULL>")) for c in business_cols])

out = (df
       .withColumn("batch_id", F.lit(batch_id))
       .withColumn("source_system", F.lit("core_banking"))
       .withColumn("source_file", F.col("_metadata.file_path"))
       .withColumn("load_ts", F.current_timestamp())
       .withColumn("row_hash", F.sha2(hash_input, 256)))`},checking:"Whether you build traceability into the data itself, which regulated environments require.",related:["design-lakehouse-etl","data-quality-tests"]},{id:"an-idempotent-reruns-backfills",companies:["Goldman Sachs","Deloitte"],topic:"pipeline",round:"design",difficulty:"medium",q:"Your daily job failed halfway and must be re-run, and next week you must backfill the last 90 days. How do you make this safe?",a:`Make every run idempotent: a run for a given date fully replaces that date's output (or MERGEs by key), so running it once or five times gives the same result.

The common mistake is plain \`append\`: re-running after a partial failure doubles the rows. Instead:
- Parameterize the job by \`run_date\`, never by 'today'.
- Write with Delta \`replaceWhere\` for that date, or dynamic partition overwrite, so only that slice is atomically replaced.
- For key-based tables, MERGE on the business key.
- A backfill is then just a loop over dates, run in order if later days depend on earlier ones.

**Gotcha:** idempotent writes are not enough if the inputs move. A backfill should read the source data as of each date (snapshot, time travel or SCD2 as-of joins), otherwise old dates get recomputed with today's dimension values and the history changes.`,code:{lang:"python",code:`def run(run_date: str):
    daily = build_daily_summary(spark, run_date)   # reads only that date
    (daily.write.format("delta")
          .mode("overwrite")
          .option("replaceWhere", f"business_date = '{run_date}'")
          .saveAsTable("gold.daily_txn_summary"))

# Backfill: same code, many dates
import datetime as dt
start = dt.date(2026, 8, 1)
for i in range(90):
    run((start + dt.timedelta(days=i)).isoformat())`},checking:"Whether you understand idempotency and the difference between re-running code and reproducing history.",related:["writing-data","design-lakehouse-etl","delta-lake-iceberg"]},{id:"an-control-totals-reconciliation",companies:["JPMorgan","Goldman Sachs","Deloitte"],topic:"pipeline",round:"technical",difficulty:"medium",q:"How do you prove that every transaction from the source system made it into the warehouse correctly each day?",a:`Reconcile control totals: compare row counts and amount sums per business date (and per currency or branch) between the source extract and the target, and fail or alert on any difference.

The source usually sends a control file or you query it directly for count and sum per date. The pipeline computes the same figures from the loaded table and stores both in a reconciliation table with the \`batch_id\`. This is cheap, runs every day and catches dropped files, partial loads and duplicate loads.

When totals differ, drill down with a key-level FULL OUTER JOIN to find exactly which rows are missing or different.

**Gotcha:** sums can hide errors that cancel out (one row missing, one duplicated with the same amount). Use count, sum and a hash total or count of distinct keys together, and compare per currency because summing INR and USD together means nothing.`,code:{lang:"sql",code:`WITH src AS (
  SELECT business_date, currency, COUNT(*) AS cnt, SUM(amount) AS total
  FROM source_control GROUP BY business_date, currency
), tgt AS (
  SELECT business_date, currency, COUNT(*) AS cnt, SUM(amount) AS total
  FROM silver_transactions GROUP BY business_date, currency
)
SELECT COALESCE(s.business_date, t.business_date) AS business_date,
       COALESCE(s.currency, t.currency) AS currency,
       s.cnt AS src_cnt, t.cnt AS tgt_cnt,
       s.total AS src_total, t.total AS tgt_total
FROM src s
FULL OUTER JOIN tgt t
  ON s.business_date = t.business_date AND s.currency = t.currency
WHERE s.cnt IS DISTINCT FROM t.cnt
   OR s.total IS DISTINCT FROM t.total;`},checking:"Whether you know the standard reconciliation controls banks rely on to trust their data.",related:["data-quality-tests","joins","design-lakehouse-etl"]},{id:"an-bad-records-quarantine",companies:["Deloitte","Tiger Analytics"],topic:"pipeline",round:"technical",difficulty:"medium",q:"A daily CSV from a client sometimes has malformed rows. How do you load the good rows without losing the bad ones?",a:"Read in `PERMISSIVE` mode with a `_corrupt_record` column, split good and bad rows, load the good ones and write the bad ones to a quarantine table for review.\n\nThe three read modes are:\n- `PERMISSIVE` (default): bad rows are kept, with fields NULL and the raw line in the corrupt-record column.\n- `DROPMALFORMED`: bad rows silently disappear, which hides problems.\n- `FAILFAST`: the whole read fails on the first bad row.\n\nQuarantining keeps the pipeline running while keeping evidence. Add a threshold: if more than, say, 1 percent of rows are bad, fail the job, because that usually means the file format changed.\n\n**Gotchas:** the corrupt-record column must be in the schema you pass in. Spark also refuses queries that reference only that column on raw files, so cache the DataFrame (or write it out) before filtering on it.",code:{lang:"python",code:`from pyspark.sql import functions as F

raw = (spark.read
       .schema(schema_with_corrupt)          # includes _corrupt_record STRING
       .option("header", "true")
       .option("mode", "PERMISSIVE")
       .option("columnNameOfCorruptRecord", "_corrupt_record")
       .csv(path)
       .cache())

bad = raw.filter(F.col("_corrupt_record").isNotNull())
good = raw.filter(F.col("_corrupt_record").isNull()).drop("_corrupt_record")

bad.withColumn("load_ts", F.current_timestamp()) \\
   .write.mode("append").saveAsTable("quarantine.client_txn")
good.write.mode("append").saveAsTable("bronze.client_txn")`},checking:"Whether you handle dirty input deliberately instead of silently dropping or crashing.",related:["data-quality-tests","writing-data"]},{id:"an-cdc-pipeline-deletes",companies:["JPMorgan","Deloitte"],topic:"pipeline",round:"design",difficulty:"hard",q:"A core system sends a daily CDC feed with insert, update and delete operations. How do you apply it to a Delta table?",a:`Keep only the latest change per key in the batch, then MERGE: delete when the latest operation is a delete, update when matched otherwise, insert when not matched.

A key can change several times in one day (insert, update, update). Applying all of them in one MERGE is not possible, because MERGE does not allow several source rows for one target row. Order changes by the source sequence number or commit timestamp, keep the last, and apply that.

Keep the raw CDC feed in bronze unchanged, so you can rebuild the table or audit any change later.

**Gotchas:**
- Order by the source log sequence, not by load time; two changes in the same second are common.
- A delete for a key that is not in the target should be ignored, not inserted.
- Banks often prefer soft deletes (\`is_deleted = true\`, \`deleted_ts\`) over physical deletes, so history stays queryable.`,code:{lang:"python",code:`from delta.tables import DeltaTable
from pyspark.sql import Window, functions as F

w = Window.partitionBy("account_id").orderBy(F.col("source_seq").desc())
latest = cdc.withColumn("rn", F.row_number().over(w)).filter("rn = 1").drop("rn")

(DeltaTable.forName(spark, "silver.accounts").alias("t")
   .merge(latest.alias("s"), "t.account_id = s.account_id")
   .whenMatchedDelete(condition="s.op = 'D'")
   .whenMatchedUpdateAll(condition="s.op <> 'D'")
   .whenNotMatchedInsertAll(condition="s.op <> 'D'")
   .execute())`},checking:"Whether you can apply change data correctly, including ordering and deletes.",related:["design-cdc-merge","delta-lake-iceberg"]},{id:"an-star-schema-retail",companies:["Fractal","Tiger Analytics","Deloitte"],topic:"modeling",round:"design",difficulty:"medium",q:"A retail client wants dashboards on sales by store, product, customer segment and promotion. Design the star schema.",a:"Put one fact table at the grain of one row per sales line item, surrounded by dimension tables for date, store, product, customer and promotion.\n\n- **fact_sales:** `date_key`, `store_key`, `product_key`, `customer_key`, `promotion_key`, plus measures `quantity`, `gross_amount`, `discount_amount`, `net_amount`.\n- **dim_date:** day, week, month, quarter, fiscal period, holiday and festival flags (Diwali sales matter in India).\n- **dim_product:** SKU, brand, category, sub-category.\n- **dim_store:** city, state, region, format.\n- **dim_customer:** segment, loyalty tier, often SCD2 so old sales keep the old segment.\n- **dim_promotion:** with a 'No promotion' row so the key is never NULL.\n\nDeclare the grain first; everything else follows from it.\n\n**Gotcha:** do not store ratios such as margin percent in the fact. Store additive amounts and compute ratios in the report, otherwise summing them across stores gives nonsense.",checking:"Whether you start from the grain and know additive measures and conformed dimensions.",related:["dimensional-modeling","design-ecommerce-star-schema"]},{id:"an-scd-types-kyc",companies:["JPMorgan","Goldman Sachs","Deloitte"],topic:"modeling",round:"technical",difficulty:"medium",q:"Which SCD type would you use for customer KYC attributes such as address, risk rating and a misspelt name?",a:`Use Type 2 for attributes where history matters to the business or regulator (risk rating, address, KYC status), and Type 1 for corrections that should not create history (fixing a typo in the name).

- **Type 1:** overwrite the value. No history. Good for fixing mistakes.
- **Type 2:** close the old row (\`valid_to\`, \`is_current = false\`) and insert a new version. Full history, so you can tell what the risk rating was when a transaction happened.
- **Type 3:** keep a \`previous_value\` column. Only one step of history; rarely enough for audit.

It is normal to mix types in one dimension: Type 2 for some columns, Type 1 for others.

**Gotcha:** if a Type 1 correction is applied only to the current row, older Type 2 rows still have the typo. Decide whether corrections should update all versions of that customer, and document it.`,checking:"Whether you choose SCD types from business and audit needs instead of applying one type everywhere.",related:["slowly-changing-dimensions","design-scd2-pipeline"]},{id:"an-scd2-sql-implementation",companies:["JPMorgan","Goldman Sachs"],topic:"modeling",round:"coding",difficulty:"hard",q:"Write SQL that applies a staging table of customer changes to an SCD2 dimension.",a:"Do it in two steps inside one transaction: expire the current rows whose attributes changed, then insert a new current row for every staged customer that no longer has a current row.\n\nStep 1 compares a hash of the tracked attributes. If it differs, set `valid_to` to the change time and `is_current` to false. Step 2 then finds staged customers with no current row: these are both the changed customers (just expired) and brand-new customers. Unchanged customers still have a current row, so they are skipped.\n\n**Gotchas:**\n- The staging table must have one row per customer; dedup it first.\n- Run both statements in a single transaction, or a failure between them leaves customers with no current row.\n- Compare with a hash or `IS DISTINCT FROM`, because `<>` misses changes to or from NULL.",code:{lang:"sql",code:`BEGIN;

UPDATE dim_customer d
SET valid_to = s.change_ts, is_current = FALSE
FROM stg_customer s
WHERE d.customer_id = s.customer_id
  AND d.is_current
  AND d.attr_hash IS DISTINCT FROM s.attr_hash;

INSERT INTO dim_customer
  (customer_id, risk_rating, address, attr_hash, valid_from, valid_to, is_current)
SELECT s.customer_id, s.risk_rating, s.address, s.attr_hash, s.change_ts, NULL, TRUE
FROM stg_customer s
LEFT JOIN dim_customer d
  ON d.customer_id = s.customer_id AND d.is_current
WHERE d.customer_id IS NULL;

COMMIT;`},checking:"Whether you can implement SCD2 correctly, including new keys, unchanged keys and atomicity.",related:["slowly-changing-dimensions","design-scd2-pipeline","isolation-levels"]},{id:"an-late-arriving-facts",companies:["Deloitte","JPMorgan"],topic:"modeling",round:"design",difficulty:"hard",q:"How do you handle late-arriving data: a transaction arrives for a customer not yet in the dimension, or a transaction from last week arrives today?",a:`For a missing dimension row, insert an inferred (placeholder) member and fill it in when the real record arrives. For late facts, load them into the correct past date partition and look up the dimension version valid at the transaction time.

**Early fact, late dimension:** do not drop the transaction or map it to a generic 'Unknown' key you can never fix. Create a dimension row with the business key and \`is_inferred = true\`; when the customer record arrives, update that row in place (Type 1 style) so facts already pointing to it get the right attributes.

**Late fact:** use event time, not load time, to choose the partition and the SCD2 version. Then rebuild any aggregates for the affected past dates.

**Gotcha:** downstream aggregates and reports for those past dates are now stale. Track which dates changed in each run and recompute only those, and tell consumers if submitted numbers moved.`,checking:"Whether you handle real-world timing problems without losing rows or corrupting history.",related:["dimensional-modeling","slowly-changing-dimensions","watermarks-late-data"]},{id:"an-fact-grain-semi-additive",companies:["Goldman Sachs","JPMorgan"],topic:"modeling",round:"technical",difficulty:"medium",q:"You have a daily account balance fact table. Why is summing balance over a month wrong, and how should it be modeled?",a:`Balance is a semi-additive measure: you can add it across accounts on one day, but not across days. Use the end-of-period balance or an average instead of a sum over time.

If an account holds 1,000 every day in a 30-day month, summing gives 30,000, which means nothing. Transactions are fully additive (sum them freely), balances are snapshots, and ratios are non-additive.

Model it as a **periodic snapshot fact**: one row per account per business date, with \`closing_balance\`. For month reports, pick the last business day of the month, or \`AVG(closing_balance)\` for average balance. Keep a separate **transaction fact** for movements.

**Gotcha:** for missing days (weekends, holidays) the snapshot must still have a row, carrying the previous balance forward. Otherwise an average balance over the month is computed over fewer days and comes out wrong.`,checking:"Whether you understand fact table types and additivity, a core banking modeling idea.",related:["dimensional-modeling"]},{id:"an-normalization-vs-denormalization",companies:["Mu Sigma","Deloitte"],topic:"modeling",round:"technical",difficulty:"easy",q:"When do you normalize a schema and when do you denormalize it?",a:`Normalize for transactional (OLTP) systems where data is written often; denormalize for analytical (OLAP) systems where data is read and aggregated often.

Normalization (3NF) stores each fact once, for example customer address only in the customer table. Updates touch one place, and anomalies such as two different addresses for one customer are avoided. That suits a banking core system processing many small writes.

Denormalization, such as a star schema or a wide reporting table, repeats some data so queries need fewer joins. Analytical engines scan many rows with few writes, so fewer joins usually means faster, simpler queries for analysts.

**Gotcha:** denormalized copies can drift. If the region of a store is copied into a wide table and later changes, old rows keep the old value. Decide whether that is history you want (like SCD2) or a bug, and rebuild denormalized tables from the normalized source of truth.`,checking:"Whether you can match the schema design to the workload instead of reciting normal forms.",related:["normalization","dimensional-modeling"]},{id:"an-python-duplicate-transactions",companies:["JPMorgan","Goldman Sachs"],topic:"python",round:"coding",difficulty:"medium",q:"In plain Python, given a list of transactions as dicts with id, account, amount and ts (epoch seconds), return the IDs that repeat the same account and amount within 300 seconds.",a:`Sort by timestamp, then walk the list once while remembering the last time each (account, amount) pair was seen in a dictionary.

For each transaction, look up its key. If the previous timestamp exists and the gap is 300 seconds or less, it is a duplicate. Then update the dictionary with the current time. Sorting is O(n log n) and the scan is O(n), with a dictionary lookup in constant time, which is much better than comparing every pair (O(n squared)).

**Gotchas:**
- Amounts as floats can differ by tiny rounding errors (100.1 versus 100.10000001). Use \`Decimal\` or integer paise for money.
- Ask whether 'within 300 seconds' compares with the previous transaction or the first in a burst; this version compares with the previous one.
- Tie on the same \`ts\`: sort by \`(ts, id)\` to make the output deterministic.`,code:{lang:"python",code:`def find_duplicates(txns, window_sec=300):
    last_seen = {}
    dups = []
    for t in sorted(txns, key=lambda x: (x["ts"], x["id"])):
        key = (t["account"], t["amount"])
        prev_ts = last_seen.get(key)
        if prev_ts is not None and t["ts"] - prev_ts <= window_sec:
            dups.append(t["id"])
        last_seen[key] = t["ts"]
    return dups

txns = [
    {"id": 1, "account": "A1", "amount": 500, "ts": 1000},
    {"id": 2, "account": "A1", "amount": 500, "ts": 1200},
    {"id": 3, "account": "A1", "amount": 500, "ts": 2000},
]
print(find_duplicates(txns))   # [2]`},checking:"Whether you pick the right data structure and reason about time complexity and money types.",related:["sessionization"]},{id:"an-python-flatten-json",companies:["Tiger Analytics","Fractal"],topic:"python",round:"coding",difficulty:"medium",q:"Write a Python function that flattens a nested JSON object into a single-level dict with dotted keys.",a:"Use recursion: for a dict, recurse into each value with the key added to the prefix; for a list, use the index as the key; for anything else, store the value under the prefix built so far.\n\nFor `{'a': {'b': 1, 'c': [10, 20]}}` the result is `{'a.b': 1, 'a.c.0': 10, 'a.c.1': 20}`. This is the kind of preprocessing used before loading API responses into a table.\n\n**Gotchas:**\n- Never use a mutable default argument like `out={}`; it is shared between calls and leaks results. Use `None` and create a new dict.\n- Empty dicts and lists disappear in this version; say so, or store them as `None`.\n- Very deep nesting can hit Python's recursion limit.\n- In PySpark, do this with the schema instead: select `col('a.b')` for structs and `explode` for arrays, rather than a Python function per row.",code:{lang:"python",code:`def flatten(obj, prefix="", out=None):
    if out is None:
        out = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            flatten(value, f"{prefix}{key}.", out)
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            flatten(value, f"{prefix}{i}.", out)
    else:
        out[prefix[:-1]] = obj
    return out

print(flatten({"a": {"b": 1, "c": [10, 20]}, "d": "x"}))
# {'a.b': 1, 'a.c.0': 10, 'a.c.1': 20, 'd': 'x'}`},checking:"Whether you write clean recursive code and know the common Python traps.",related:["semi-structured-json"]},{id:"an-aws-athena-cost",companies:["Fractal","Tiger Analytics","Deloitte"],topic:"aws",round:"technical",difficulty:"medium",q:"Analysts' Athena queries on a 20 TB raw JSON table are slow and expensive. How do you reduce both?",a:`Athena bills by data scanned (approx. $5 per TB, us-east-1, 2026, with a 10 MB minimum per query), so cut the bytes each query reads: convert JSON to partitioned, compressed Parquet, make queries prune partitions, select only the columns needed, and serve repeated dashboard questions from small aggregate tables.

**Steps:**
- **Columnar format:** CTAS or a Glue job to Parquet with ZSTD or Snappy. Columnar files let Athena read only the referenced columns, and they are much smaller than JSON.
- **Partitioning:** by date (and maybe region) to match common filters; partition projection avoids slow catalog lookups when there are thousands of partitions.
- **File sizes:** roughly 128 MB to 1 GB; thousands of tiny files slow every query.
- **Workgroups:** per-query scan limits, per-team cost reporting, and query result reuse for repeated queries.
- **Habits:** no \`SELECT *\`, always filter on the partition column.

**Example:** a query scanning the full 2 TB of one month of raw JSON costs about $10; on Parquet, reading one day and five columns might scan a few GB and cost a few cents.`,code:{lang:"sql",code:`-- CTAS writes at most 100 partitions per query: load history in chunks
CREATE TABLE analytics.transactions_pq
WITH (
  format = 'PARQUET',
  write_compression = 'ZSTD',
  external_location = 's3://lake/silver/transactions_pq/',
  partitioned_by = ARRAY['txn_date']
) AS
SELECT txn_id, account_id, amount, channel, merchant_id,
       CAST(date(from_iso8601_timestamp(txn_ts)) AS varchar) AS txn_date
FROM raw.transactions_json
WHERE txn_ts >= '2026-10-01' AND txn_ts < '2026-11-01';`},checking:"Whether you know how Athena pricing works and the levers that reduce scanned bytes.",related:["aws-athena","parquet-columnar","partition-pruning-pushdown","warehouse-full-scan-bill"]},{id:"an-aws-redshift-mart-design",companies:["Deloitte","Tiger Analytics","Fractal"],topic:"aws",round:"technical",difficulty:"medium",q:"You are building a sales mart in Redshift for about 200 dashboard users. How do you choose distribution styles and sort keys, and when do you use materialized views?",a:`Distribute the large fact on the key it joins most (or leave it AUTO/EVEN if there is no dominant join), use DISTSTYLE ALL for small dimensions, sort the fact by the date column dashboards filter on, and precompute heavy repeated aggregates as materialized views with auto refresh.

**Details:**
- **Small dimensions** (stores, products, calendar) as ALL, so joins never move data. A large dimension that joins the fact should share the fact's DISTKEY.
- **Sort key:** the date first, because almost every dashboard filters by date; zone maps then skip blocks outside the range.
- **Materialized views** for the same group-by that dashboards run every few minutes; \`AUTO REFRESH YES\` keeps them current, and Redshift can rewrite matching queries to use them automatically.
- **Concurrency:** WLM queues and query priorities, plus concurrency scaling for bursts; Redshift Serverless scales capacity instead.
- **Result cache** answers identical repeated queries without recomputation.

**Gotcha:** check \`svv_table_info.skew_rows\` after loading; a DISTKEY with a dominant value creates one hot slice and slows everything.`,code:{lang:"sql",code:`CREATE TABLE mart.fact_sales (
  sale_date   date          NOT NULL,
  store_id    int           NOT NULL,
  product_id  int           NOT NULL,
  customer_id bigint,
  qty         int,
  net_amount  decimal(14,2)
)
DISTKEY (product_id)
SORTKEY (sale_date);

CREATE TABLE mart.dim_store (store_id int, region varchar(40), city varchar(60))
DISTSTYLE ALL;

CREATE MATERIALIZED VIEW mart.mv_daily_region_sales
AUTO REFRESH YES AS
SELECT f.sale_date, s.region, SUM(f.net_amount) AS net_sales
FROM mart.fact_sales f
JOIN mart.dim_store s ON f.store_id = s.store_id
GROUP BY f.sale_date, s.region;`},checking:"Whether you can turn a star schema into a well-performing Redshift physical design.",related:["aws-redshift","redshift-internals","dimensional-modeling","clustering-and-sort-keys"]},{id:"an-aws-lake-formation-pii",companies:["JPMorgan","Goldman Sachs","Deloitte"],topic:"aws",round:"technical",difficulty:"hard",q:"Analysts must query a customer table in the lake, but only the risk team may see PAN (tax ID) and phone numbers. How do you enforce this on AWS?",a:`Use Lake Formation fine-grained permissions on the Glue Catalog table: grant analysts SELECT on every column except the PII ones, or tag PII columns with an LF-tag (for example \`classification=pii\`) and grant that tag only to the risk role. Athena, Redshift Spectrum, EMR and Glue then enforce it.

**Details:**
- Register the S3 location with Lake Formation and remove broad \`s3:GetObject\` from analyst roles; otherwise they can bypass the catalog and read files directly.
- **Data filters** add row-level security, for example analysts see only their region.
- **LF-tag based access control** scales far better than per-table grants across hundreds of tables.
- Encrypt with KMS, and tokenize or hash PAN at ingestion so most datasets never hold the raw value.
- CloudTrail records who accessed what, which auditors will ask for.

**Gotcha:** column grants only protect the governed table. A copy written by someone's notebook to an unregistered bucket is unprotected, so restrict where roles can write.`,code:{lang:"python",code:`import boto3

lf = boto3.client("lakeformation", region_name="ap-south-1")
lf.grant_permissions(
    Principal={"DataLakePrincipalIdentifier":
               "arn:aws:iam::111122223333:role/analyst"},
    Resource={"TableWithColumns": {
        "DatabaseName": "silver",
        "Name": "customers",
        "ColumnWildcard": {"ExcludedColumnNames": ["pan", "phone"]},
    }},
    Permissions=["SELECT"],
)`},checking:"Whether you know how column-level security is really enforced in an AWS lake, including the S3 bypass.",related:["aws-iam-lake-formation","case-gdpr-deletion"]},{id:"an-aws-dms-cdc-core-banking",companies:["JPMorgan","Deloitte"],topic:"aws",round:"technical",difficulty:"hard",q:"How would you replicate an on-prem Oracle core-banking database into an S3 data lake with ongoing changes, and what are the pitfalls?",a:`Use AWS DMS with a full load plus CDC task writing Parquet to S3, then a Glue or EMR job that takes the latest change per key and MERGEs it into Iceberg or Delta tables in the silver layer.

**How:**
- Oracle needs supplemental logging and access to redo/archive logs (LogMiner or Binary Reader).
- DMS adds an \`Op\` column (I, U, D) to CDC rows; a configured timestamp column gives commit time for ordering.
- The merge job keeps the last change per primary key, deletes on D and upserts the rest.

**Pitfalls:**
- **LOBs:** limited LOB mode truncates values above the size you set; full LOB mode is much slower.
- **Tables without primary keys** cannot be merged reliably downstream.
- **Lag:** large transactions or a busy source grow latency; alarm on \`CDCLatencySource\` and \`CDCLatencyTarget\` in CloudWatch.
- **DDL changes** are handled differently per target; test schema drift before go-live.
- **Sizing and HA:** size the replication instance for the full load, and use Multi-AZ for long-running CDC.`,code:{lang:"python",code:`from pyspark.sql import Window, functions as F

cdc = spark.read.parquet("s3://lake/raw/dms/CORE/ACCOUNTS/2026/11/23/")
w = Window.partitionBy("account_id").orderBy(F.col("commit_ts").desc())
latest = (cdc.withColumn("rn", F.row_number().over(w))
             .filter("rn = 1").drop("rn"))
latest.createOrReplaceTempView("changes")

# target has the same columns plus op/commit_ts, or list columns explicitly
spark.sql("""
MERGE INTO lake.silver.accounts t
USING changes s ON t.account_id = s.account_id
WHEN MATCHED AND s.Op = 'D' THEN DELETE
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED AND s.Op <> 'D' THEN INSERT *
""")`},checking:"Whether you have run DMS-based CDC and know where it hurts in practice.",related:["aws-dms-cdc","cdc-and-incremental-loads","design-cdc-merge"]},{id:"an-aws-cost-leaks",companies:["Tiger Analytics","Fractal","Mu Sigma"],topic:"aws",round:"technical",difficulty:"medium",q:"The AWS bill for a client's analytics platform doubled in three months. How do you find and fix the cost leaks?",a:`Break the bill down by service and by pipeline with Cost Explorer and cost allocation tags, go after the few biggest line items (usually idle compute, full scans, S3 sprawl and data transfer), then add budgets and alarms so it cannot drift again.

**Common leaks:**
- **Idle compute:** long-running EMR clusters, a provisioned Redshift cluster running 24x7 for daytime use (pause and resume, or Serverless), notebooks left on.
- **Scans:** Athena or Spectrum over raw JSON or CSV, dashboards without partition filters.
- **Glue:** too many workers for small data; use Auto Scaling or Flex for non-urgent jobs.
- **S3:** no lifecycle rules, millions of tiny objects (request charges), old versions kept forever, incomplete multipart uploads.
- **Data transfer:** jobs in private subnets reaching S3 through a NAT gateway instead of a free S3 gateway endpoint; cross-AZ or cross-region traffic.
- **CloudWatch Logs** with retention set to never expire.

**Guardrails:** AWS Budgets alerts, mandatory tags (team, pipeline), Athena workgroup limits, and a weekly review of cost per pipeline run.`,checking:"Whether you can investigate cost systematically and know where data platforms usually leak money.",related:["aws-cost-monitoring","aws-athena","aws-s3-data-lake"]},{id:"an-aws-cross-account-kms",companies:["Goldman Sachs","JPMorgan"],topic:"aws",round:"technical",difficulty:"hard",q:"A producer account must share an S3 dataset encrypted with a customer-managed KMS key with a consumer account's Glue jobs. What has to be configured?",a:`Three policies must all allow it: the bucket policy in the producer account grants the consumer role access, the consumer role's own IAM policy allows those S3 actions on that bucket, and the KMS key policy in the producer account allows the consumer role \`kms:Decrypt\` (plus \`kms:GenerateDataKey\` if it writes). The consumer's IAM policy must also allow the KMS actions on that key ARN.

**Why:** cross-account access needs a yes from both accounts. With SSE-KMS objects the classic symptom is AccessDenied on GetObject even though the bucket policy looks right, because the key policy was never updated.

**Alternatives:**
- Lake Formation cross-account sharing of catalog tables, for table and column level governance.
- The consumer assumes a role in the producer account, so all access is governed in one place.

**Also:** set S3 Object Ownership to 'bucket owner enforced' so objects written by other accounts belong to the bucket owner, and log access with CloudTrail data events.`,code:{lang:"python",code:`consumer = "arn:aws:iam::222233334444:role/consumer-glue"

bucket_policy = {"Version": "2012-10-17", "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": consumer},
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::producer-curated",
                 "arn:aws:s3:::producer-curated/risk/*"]}]}

key_policy_statement = {          # added to the KMS key policy in the producer account
    "Sid": "AllowConsumerDecrypt",
    "Effect": "Allow",
    "Principal": {"AWS": consumer},
    "Action": ["kms:Decrypt", "kms:DescribeKey"],
    "Resource": "*"}              # in a key policy, '*' means this key`},checking:"Whether you understand cross-account access on AWS, especially the KMS key policy that people forget.",related:["aws-iam-lake-formation","aws-s3-data-lake"]},{id:"an-airflow-upstream-dependencies",companies:["JPMorgan","Goldman Sachs","Deloitte"],topic:"airflow",round:"technical",difficulty:"medium",q:"Your risk mart DAG must start only after three upstream DAGs (trades, positions, market data) owned by other teams have finished for the same business date. How do you model that dependency?",a:`Prefer data-aware scheduling: upstream tasks declare the tables they update as Datasets (called Assets in Airflow 3), and your DAG is scheduled on all three, so it runs once every upstream has produced new data. When you need an exact business-date match, add a check task, or use an ExternalTaskSensor per upstream in deferrable mode.

**Trade-offs:**
- **Datasets/Assets:** decoupled, no polling, but they fire on 'updated', not on 'updated for business date X', so verify the dates inside the run.
- **ExternalTaskSensor:** exact date matching, but it couples you to other teams' DAG ids and schedules, and needs a timeout.
- **Control table:** each upstream writes a row (feed, business_date, status, counts) when done, and you sense that. Common in banks because it doubles as an audit trail.

**Gotcha:** whichever you choose, set a deadline alert, because a dependency that never arrives should page someone before the regulatory cut-off, not after.`,code:{lang:"python",code:`import pendulum
from airflow import DAG
from airflow.datasets import Dataset      # Airflow 3: from airflow.sdk import Asset

trades    = Dataset("s3://lake/silver/trades/")
positions = Dataset("s3://lake/silver/positions/")
market    = Dataset("s3://lake/silver/market_data/")
# each upstream task declares outlets=[trades] (and so on) when it writes

with DAG("risk_mart", schedule=[trades, positions, market], catchup=False,
         start_date=pendulum.datetime(2026, 11, 1, tz="Asia/Kolkata")):
    check = check_same_business_date()    # fail if the three dates differ
    build = build_risk_mart()
    check >> build`},checking:"Whether you know the options for cross-DAG dependencies and their coupling trade-offs.",related:["airflow-scheduling-data-intervals","airflow-operators-sensors-hooks"]},{id:"an-airflow-business-day-schedule",companies:["Goldman Sachs","JPMorgan"],topic:"airflow",round:"technical",difficulty:"hard",q:"A regulatory report must run at 7 PM on Indian business days only (no weekends or bank holidays), and month-end needs an extra step. How do you schedule this in Airflow?",a:`Schedule on weekdays with a cron expression in the Asia/Kolkata timezone, skip bank holidays with a short-circuit task that checks a holiday calendar, and branch to the month-end step only on the last business day. For complex calendars, write a custom Timetable so holiday runs are never created at all.

**Pieces:**
- \`schedule="0 19 * * 1-5"\` with a timezone-aware \`start_date\`, or it fires at 7 PM UTC.
- \`@task.short_circuit\` returning False on a holiday skips everything downstream, and the run shows as skipped, not failed.
- \`@task.branch\` returns the month-end task plus the publish task on the last business day, and only publish otherwise.
- A custom Timetable is cleaner in the UI but has to be registered as a plugin.

**Gotcha:** know which date a run represents. In Airflow 2 a cron schedule uses data intervals, so the run that fires on Tuesday at 7 PM has Monday 7 PM as its logical date, and Friday's interval runs on Monday. Airflow 3 defaults cron schedules to a trigger timetable, where the logical date is the fire time.`,code:{lang:"python",code:`@task.short_circuit
def is_business_day(ds=None) -> bool:
    return not is_bank_holiday(ds)               # lookup in a calendar table

@task.branch
def month_end_or_not(ds=None):
    if is_last_business_day(ds):
        return ["month_end_adjustments", "publish_report"]
    return "publish_report"

@task(trigger_rule="none_failed_min_one_success")
def publish_report(): ...

with DAG("reg_report", schedule="0 19 * * 1-5", catchup=False,
         start_date=pendulum.datetime(2026, 11, 1, tz="Asia/Kolkata")):
    adj, pub = month_end_adjustments(), publish_report()
    is_business_day() >> build_report() >> month_end_or_not() >> [adj, pub]
    adj >> pub`},checking:"Whether you can implement real business calendars in Airflow and know the logical date trap.",related:["airflow-scheduling-data-intervals","airflow-xcom-dynamic-mapping"]},{id:"an-airflow-recon-gate",companies:["JPMorgan","Deloitte","Goldman Sachs"],topic:"airflow",round:"technical",difficulty:"medium",q:"How do you stop a DAG from publishing a mart to downstream users when that day's reconciliation fails?",a:`Make reconciliation a blocking task between build and publish: build into a staging table or partition, run the checks (counts and sums against control totals, nulls in keys, duplicates), fail the task if any hard check breaks, and publish only after it passes, so consumers never see bad data.

**Patterns:**
- **Write-audit-publish:** write to staging, audit, then publish atomically (a Redshift \`ALTER TABLE APPEND\` or table swap, an Iceberg branch, or switching a view to the new partition).
- **Hard versus soft checks:** raise \`AirflowFailException\` on hard breaks so retries do not hide them; log soft warnings and continue.
- **Evidence:** store every recon result (source and target figures, breaks, run id) in a recon table for auditors.
- **Alerts:** send the actual numbers in the alert, not just 'task failed', so the on-call person can act straight away.`,code:{lang:"python",code:`from airflow.exceptions import AirflowFailException

@task
def reconcile(ds=None):
    src = control_totals(ds)            # from the source control file
    tgt = staged_totals(ds)             # from the staging table
    breaks = {k: (src[k], tgt.get(k)) for k in src if src[k] != tgt.get(k)}
    save_recon_result(ds, src, tgt, breaks)
    if breaks:
        raise AirflowFailException(f"Recon breaks for {ds}: {breaks}")

build_staging() >> reconcile() >> publish()   # publish runs only if reconcile passes`},checking:"Whether you put data quality gates into orchestration so bad data never reaches users.",related:["data-quality-and-slas","data-quality-tests","airflow-idempotent-tasks-retries"]},{id:"an-airflow-depends-on-past",companies:["JPMorgan","Goldman Sachs"],topic:"airflow",round:"technical",difficulty:"medium",q:"A daily account-balance job computes today's closing balance from yesterday's. How do you configure the DAG so days never run out of order, including during backfills?",a:"Set `depends_on_past=True` on the balance task, so each day waits for the previous day's instance of that task to succeed, and `max_active_runs=1` on the DAG, so runs execute one at a time in date order. Keep the task idempotent so recomputing a day gives the same result.\n\n**Details:**\n- `depends_on_past` alone still lets other tasks of later runs start; `max_active_runs=1` serialises whole runs.\n- `wait_for_downstream=True` also waits for the previous day's downstream tasks, for example the publish step.\n- The very first run has no previous instance and is allowed to start.\n- If day 10 was wrong, every later day is wrong too: clear day 10 with the Future option so days 11 onwards rerun in order.\n\n**Trade-off:** serial runs make long backfills slow. If possible, remove the dependency: compute the balance as an opening snapshot plus a cumulative sum of transactions, so any day can be computed independently and in parallel.",code:{lang:"python",code:`with DAG("account_balances", schedule="@daily", catchup=True,
         max_active_runs=1,
         start_date=pendulum.datetime(2026, 1, 1, tz="Asia/Kolkata"),
         default_args={"depends_on_past": True,
                       "wait_for_downstream": True}):
    balances = compute_closing_balances()   # reads yesterday's closing balance
    publish = publish_balances()
    balances >> publish`},checking:"Whether you know how to enforce ordering between runs and the cost of doing so.",related:["airflow-backfills-catchup","fact-table-types"]},{id:"an-airflow-testing-ci",companies:["Deloitte","Tiger Analytics","Fractal"],topic:"airflow",round:"technical",difficulty:"medium",q:"How do you test Airflow DAGs before deploying them to production, for example on MWAA?",a:`Use three layers: DAG integrity tests in CI (every DAG imports without errors and has the required settings such as owner, retries and tags), unit tests for the Python logic behind each task with mocked S3 and databases, and a run in a dev or staging environment with \`dag.test()\` or a small date range before promotion.

**Details:**
- Loading the DagBag in a test catches syntax errors, missing imports, cycles and slow top-level code.
- Keep business logic in importable modules outside the DAG file, so pytest can test it without Airflow.
- \`dag.test()\` (Airflow 2.5+) runs a whole DAG run in one process for local debugging.
- **CI/CD for MWAA:** lint, test, then sync \`dags/\` (and plugins and requirements) to the environment's S3 bucket. DAG changes are picked up from S3; requirements changes update the environment, which is slow, so pin versions with the Airflow constraints file.

**Gotcha:** test against the same Airflow and provider versions as production, because operator arguments change between versions.`,code:{lang:"python",code:`from airflow.models import DagBag

def _bag():
    return DagBag(dag_folder="dags/", include_examples=False)

def test_dags_import_cleanly():
    bag = _bag()
    assert bag.import_errors == {}, bag.import_errors

def test_every_dag_has_owner_and_retries():
    for dag_id, dag in _bag().dags.items():
        assert dag.default_args.get("owner"), f"{dag_id} has no owner"
        assert dag.default_args.get("retries", 0) >= 1, f"{dag_id} has no retries"`},checking:"Whether you treat DAGs as tested, versioned code rather than scripts edited in production.",related:["airflow-testing-ci","aws-step-functions-mwaa-eventbridge"]},{id:"an-design-recon-framework",companies:["JPMorgan","Deloitte","Goldman Sachs"],topic:"design",round:"design",difficulty:"hard",q:"Design a reusable reconciliation framework that compares about 150 source-to-warehouse feeds every day and produces a breaks dashboard for operations.",a:`Make it config-driven: one generic Spark job reads a recon definition per feed (source, target, keys, compare columns, tolerances), computes control totals and key-level differences, and writes standard recon tables that a dashboard and alerts read.

**Requirements:** all feeds reconciled by 8 AM; three levels (control totals, missing or extra keys, attribute mismatches within tolerance); an audit trail per run; safe reruns; a new feed onboarded by config, not code.

**Estimates:** the largest feed has about 200 million rows a day; most are far smaller. Key-level joins total a few hundred GB a day, which a handful of Spark jobs on EMR or Glue finish within an hour.

**Architecture:**
- Recon definitions in git, loaded into a config table.
- Airflow maps one task per feed group (dynamic task mapping).
- The job compares counts and sums per business date, then runs a FULL OUTER JOIN on keys comparing a hash of the compare columns, and diffs individual columns only for mismatched rows.
- Outputs \`recon_summary\` and \`recon_breaks\` (key, break type, column, source and target values), with ageing, feeding the dashboard and alerts.

**Trade-offs:** hashing is cheap but hides which column differs, hence the second pass. Normalise types and NULLs before hashing, and make amount tolerances explicit.`,code:{lang:"sql",code:`SELECT COALESCE(s.txn_id, t.txn_id) AS txn_id,
       CASE WHEN t.txn_id IS NULL THEN 'MISSING_IN_TARGET'
            WHEN s.txn_id IS NULL THEN 'EXTRA_IN_TARGET'
            ELSE 'ATTRIBUTE_MISMATCH' END AS break_type
FROM (SELECT txn_id,
             MD5(CONCAT_WS('|', account_id, amount, currency, status)) AS h
      FROM src_txn WHERE business_date = DATE '2026-11-23') s
FULL OUTER JOIN
     (SELECT txn_id,
             MD5(CONCAT_WS('|', account_id, amount, currency, status)) AS h
      FROM dw_txn WHERE business_date = DATE '2026-11-23') t
  ON s.txn_id = t.txn_id
WHERE s.txn_id IS NULL OR t.txn_id IS NULL OR s.h <> t.h;
-- CONCAT_WS skips NULLs: COALESCE them to a marker first in real use`},checking:"Whether you can generalise one-off reconciliation queries into a configurable, auditable platform.",related:["case-payments-reconciliation","data-quality-and-slas","airflow-xcom-dynamic-mapping"]},{id:"an-design-customer-360-mart",companies:["Fractal","Tiger Analytics","Mu Sigma"],topic:"design",round:"design",difficulty:"hard",q:"Design a customer 360 mart that combines transactions, digital events, campaign responses and service tickets for analysts and ML models.",a:"Resolve identities first, then build a conformed customer dimension and subject-area facts at clear grains, and derive a wide daily customer feature snapshot for analysts and models from that star.\n\n**Requirements:** refreshed daily by 9 AM; about 10 million customers; two years of history for modelling; PII governed; definitions such as 'active' and 'churned' agreed with the business.\n\n**Estimates:** 10 million customers x 300 features x about 8 bytes is about 24 GB per snapshot before compression, a few GB in Parquet. Two years of daily snapshots is about 700 copies, so keep daily snapshots for 90 days and month-end snapshots after that.\n\n**Architecture:**\n- Sources (core system or POS, web and app events, CRM, ticketing) land in S3 raw, then per-source silver tables.\n- **Identity resolution:** deterministic matching on customer id and hashed phone or email into a crosswalk (`source_id -> master_customer_id`).\n- **Gold:** `dim_customer` (SCD2 for segment and KYC fields), `fact_transactions`, `fact_digital_sessions`, `fact_campaign_response`, `fact_tickets`.\n- `customer_features_daily` partitioned by snapshot date, served through Redshift or Athena, with tests on every model.\n\n**Trade-offs:** the star is the source of truth and the wide table is derived for convenience. Snapshot dates give point-in-time features for training. Loose identity matching merges different people; strict matching misses links.",checking:"Whether you handle identity resolution, grain and point-in-time history, not just a big join.",related:["conformed-dimensions-bus-matrix","slowly-changing-dimensions","case-feature-store","semantic-layer-metrics"]},{id:"an-design-demand-forecast-pipeline",companies:["Mu Sigma","Tiger Analytics","Fractal"],topic:"design",round:"design",difficulty:"medium",q:"A consumer goods client wants weekly demand forecasts per SKU per store. Design the data pipeline that feeds the model and publishes the forecasts.",a:`Build a weekly batch pipeline: ingest sales, prices, promotions, inventory and calendar data; build a clean SKU-store-week training table with point-in-time features; train and score in scheduled jobs; and publish forecasts as a versioned fact table with accuracy tracking.

**Requirements:** 5,000 SKUs x 2,000 stores = 10 million series; forecasts for the next 12 weeks published every Monday by 6 AM; any week reproducible; accuracy (WAPE) monitored per category.

**Estimates:** 10 million series x 156 weeks is about 1.6 billion history rows, tens of GB in Parquet. Scoring writes 10 million x 12 = 120 million rows a week.

**Architecture:**
- S3 raw (POS, distributor feeds, promo calendar), then silver: unit conversion, SKU and store mapping, explicit flags for missing weeks.
- Gold feature table partitioned by week.
- Airflow DAG: sensors for feeds, feature build on EMR or Glue, training (SageMaker or Spark), scoring, publish to \`fact_forecast(forecast_week, target_week, sku, store, model_version, qty)\`.
- An accuracy job joins last week's actuals to earlier forecasts.

**Trade-offs:** stockouts look like zero demand, so flag out-of-stock weeks instead of training on false zeros. Keep every forecast version so you can compare models, and backfill features by week with partition overwrite.`,checking:"Whether you design for reproducibility, correct history and data traps like stockouts, not just model training.",related:["fact-table-types","airflow-backfills-catchup","case-feature-store"]},{id:"an-design-aml-monitoring",companies:["JPMorgan","Goldman Sachs","Deloitte"],topic:"design",round:"design",difficulty:"hard",q:"Design the data platform for anti-money-laundering (AML) transaction monitoring: rules such as 'many cash deposits just under a reporting threshold within 7 days', alerts for investigators, and a full audit trail.",a:`Mostly batch, with a small near real-time path: land all transactions and KYC data, compute per-customer daily aggregates, derive rolling windows from them, evaluate versioned rules, and write alerts with full provenance to a case-management system.

**Requirements:** daily alerts by morning (intraday for high-risk rules); rules versioned and explainable; any alert reproducible years later with the same data and rule version; one view of a customer across accounts.

**Estimates:** 30 million transactions a day; 7, 30 and 90-day windows per customer. Summing 7 daily rows per customer is far cheaper than rescanning 7 days of raw data.

**Architecture:**
- CDC from core banking via DMS or Kafka into Iceberg tables, whose snapshots make past runs reproducible.
- A daily Spark job builds \`customer_day\` aggregates, then rolling windows.
- Rules read thresholds from a versioned config table and write alerts with rule version, table snapshot id and contributing transaction ids.
- Investigator outcomes flow back to tune thresholds by backtesting.

**Trade-offs:** daily aggregates lose intraday timing; add streaming only for rules that need it. Too many false positives overwhelm investigators, so tune with labelled outcomes.`,code:{lang:"sql",code:`WITH daily AS (
  SELECT customer_id, txn_date,
         COUNT(*) FILTER (WHERE channel = 'CASH'
                          AND amount BETWEEN 45000 AND 49999) AS near_cnt
  FROM transactions
  GROUP BY customer_id, txn_date
), rolling AS (
  SELECT customer_id, txn_date,
         SUM(near_cnt) OVER (PARTITION BY customer_id ORDER BY txn_date
                             RANGE BETWEEN INTERVAL '6 days' PRECEDING
                                       AND CURRENT ROW) AS near_cnt_7d
  FROM daily
)
SELECT customer_id, txn_date, near_cnt_7d
FROM rolling
WHERE near_cnt_7d >= 5;          -- illustrative threshold and amounts`},checking:"Whether you design for explainability and reproducibility, which regulators care about most.",related:["window-frames","delta-lake-iceberg","data-quality-and-slas"]},{id:"an-kafka-account-events-exactly-once",companies:["JPMorgan","Goldman Sachs"],topic:"kafka",round:"technical",difficulty:"hard",q:"Account transactions are published to Kafka, and a consumer maintains running balances in a database. How do you guarantee no lost, duplicated or out-of-order updates?",a:`Key by \`account_id\` so each account's events stay ordered in one partition, use an idempotent producer with \`acks=all\`, and make the consumer apply each event exactly once by storing the last applied sequence per account in the same database transaction as the balance update, ignoring anything at or below it.

**Details:**
- Commit Kafka offsets only after the database transaction commits. After a crash, replayed events are filtered by the stored sequence: an idempotent consumer.
- Alternatively store the Kafka offsets in the same database transaction and seek to them on startup.
- Source sequence numbers from the core system also reveal gaps (a missed event), not just duplicates; park the account and alert on a gap instead of applying out of order.
- On partition revocation during a rebalance, finish or abandon in-flight work before giving up the partition; cooperative-sticky assignment shortens the pauses.

**Gotcha:** Kafka transactions give exactly-once only from Kafka to Kafka. A database sink needs this idempotency on its own.`,code:{lang:"sql",code:`-- inside one database transaction per event (or per batch)
INSERT INTO account_ledger (account_id, seq, amount, event_ts)
VALUES (:account_id, :seq, :amount, :event_ts)
ON CONFLICT (account_id, seq) DO NOTHING;        -- duplicate: no row inserted

UPDATE account_balance
SET    balance = balance + :amount,
       last_seq = :seq,
       updated_at = now()
WHERE  account_id = :account_id
  AND  last_seq = :seq - 1;     -- 0 rows: duplicate or gap, handle before commit`},checking:"Whether you know that end-to-end exactly-once into a database needs ordering, idempotency and gap detection.",related:["kafka-delivery-semantics","kafka-partitions-ordering","kafka-consumer-groups"]},{id:"an-beh-numbers-dont-match",companies:["Fractal","Tiger Analytics","Mu Sigma","Deloitte"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"A client stakeholder says your dashboard's revenue does not match their finance report. How do you handle it?",a:`Acknowledge it quickly, reproduce the gap with numbers, decide whether it is a definition difference or a data defect, fix or align, and explain in the client's language. A model STAR answer:

- **Situation:** two days after launching a sales dashboard for a retail client, the regional finance head said our revenue was 6% higher than their ledger.
- **Task:** I owned the data model and had to explain or fix the gap before the monthly review three days later.
- **Action:** I replied the same day with a timeline, then reconciled by month, region and channel. The whole gap was in online orders: we counted revenue when an order was placed, finance counted it on delivery and net of cancellations. It was a definition gap, not a bug, but we had never documented it. I wrote a one-page metric definition, got the finance head and the business sponsor to agree, added 'delivered net revenue' next to 'booked revenue' with clear labels, and added a daily reconciliation against the ledger.
- **Result:** the numbers matched within 0.2% (timing only), and a definitions page became standard for every later dashboard.`,checking:"Whether you handle data disputes calmly, with evidence, and fix the root cause in definitions.",related:["semantic-layer-metrics","join-fanout-inflated-revenue"]},{id:"an-beh-explain-to-non-technical",companies:["Deloitte","Fractal","Mu Sigma"],topic:"behavioural",round:"managerial",difficulty:"easy",q:"Tell me about a time you had to explain a technical problem or trade-off to a non-technical stakeholder.",a:`Show that you translate technology into business impact and options, without jargon. A model STAR answer:

- **Situation:** a marketing director wanted campaign dashboards refreshed every 5 minutes instead of daily.
- **Task:** I had to explain the cost and effort so they could make an informed decision.
- **Action:** instead of talking about streaming and Spark, I asked which decision they would make during the day. The answer was pausing underperforming campaigns by noon. I showed three options in a simple table: daily (today, no extra cost), hourly (about two weeks of work, a small cost increase) and real-time (about two months, several times the running cost, plus on-call support). I used one concrete example: with hourly data, a bad campaign could still be paused before lunch.
- **Result:** they chose hourly, we delivered it in two weeks, and they later said it covered every decision they needed.

**What they look for:** asking about the decision behind the request, options with cost and time, and plain language.`,checking:"Whether you can communicate trade-offs to business stakeholders, a core skill in consulting and analytics firms.",related:["batch-vs-streaming"]}]},o=Object.freeze(Object.defineProperty({__proto__:null,default:e},Symbol.toStringTag,{value:"Module"})),t={id:"bigtech",title:"Big tech (India offices)",blurb:"Questions often reported from data engineering loops at Amazon, Microsoft, Google, Walmart Global Tech and Uber in India, where strong SQL, Spark internals, data system design and some DSA coding all get tested.",companies:[{name:"Amazon",process:"Usually starts with an online assessment or phone screen heavy on SQL, followed by a loop of several interviews covering SQL, data modeling, ETL design and some coding. Every round usually includes behavioural questions on the Leadership Principles, and one interviewer is often a bar raiser from outside the hiring team who can veto the hire.",focus:["Advanced SQL","Data modeling and ETL design","Leadership Principles (STAR stories)","Scale and cost trade-offs on AWS"],experience:"1-10 yrs"},{name:"Microsoft",process:"Candidates often report a screening round followed by several technical interviews mixing DSA coding, SQL and data pipeline design, frequently on Azure services such as Data Factory, Synapse or Databricks. A final round with a senior manager (often called the 'as appropriate' round) usually focuses on design depth and behaviour.",focus:["DSA coding","SQL","Azure data stack (ADF, Synapse, Databricks)","Pipeline design"],experience:"2-12 yrs"},{name:"Google",process:"Usually a recruiter call and a technical phone screen, then a set of interviews on coding (often Python), SQL and data processing, data system design, and a 'Googleyness and leadership' behavioural round. Feedback is often reported to go to a hiring committee rather than being decided by one interviewer, so the process can take several weeks.",focus:["Coding and algorithms","SQL on large datasets","Data system design","Clear communication of trade-offs"],experience:"3-12 yrs"},{name:"Walmart Global Tech",process:"Hiring in Bengaluru and Chennai is often through an online test or a hiring drive, followed by two or three technical rounds and a hiring manager round. Technical rounds are commonly reported to dig into Spark optimization, SQL, Hive or BigQuery, and some DSA in Python or Scala.",focus:["Spark tuning (skew, joins, partitions)","SQL window functions","Retail sales data modeling","DSA basics"],experience:"2-10 yrs"},{name:"Uber",process:"Often starts with an online coding test, then a phone screen, then a loop covering coding, SQL, data modeling, data system design and a hiring manager or behavioural round. Questions are usually framed around trips, drivers, riders and marketplace metrics, with interest in streaming (Kafka, Flink, Spark) and very large Hive tables.",focus:["SQL on trip data","Data modeling","Streaming and real-time pipelines","Coding (DSA)"],experience:"2-10 yrs"}],questions:[{id:"bt-second-highest-salary-per-dept",companies:["Amazon","Walmart Global Tech"],topic:"sql",round:"technical",difficulty:"easy",q:"Find the employees with the second highest salary in each department.",a:"Rank salaries inside each department with `DENSE_RANK()` and keep rank 2.\n\n**Why:** `PARTITION BY dept_id` restarts the ranking for every department, and `ORDER BY salary DESC` puts the top salary at rank 1. `DENSE_RANK` gives tied salaries the same rank with no gaps, so if two people share the top salary, the next distinct salary is still rank 2. That matches what 'second highest salary' usually means.\n\n- `ROW_NUMBER` would pick one arbitrary person among ties.\n- `RANK` leaves gaps (1, 1, 3), so rank 2 may not exist.\n\n**Gotcha:** a department where everyone earns the same returns no rows. Say this out loud and ask whether the interviewer wants a NULL row for such departments instead.",code:{lang:"sql",code:`SELECT dept_id, emp_id, salary
FROM (
  SELECT dept_id, emp_id, salary,
         DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE salary IS NOT NULL
) ranked
WHERE rnk = 2;`},checking:"Whether you know the difference between ROW_NUMBER, RANK and DENSE_RANK and think about ties before writing code.",related:["top-n-and-dedup","window-functions"]},{id:"bt-running-total-per-customer",companies:["Amazon"],topic:"sql",round:"technical",difficulty:"easy",q:"Compute a running total of order amount per customer by date.",a:"Use `SUM(...) OVER (PARTITION BY customer_id ORDER BY order_date)` on daily totals.\n\n**Why:** a window function keeps every row and adds a column, unlike `GROUP BY`, which collapses rows. The frame `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` means 'everything from the first row up to this one' for each customer.\n\nI first aggregate to one row per customer per day, because a customer can place several orders on the same day.\n\n**Gotcha:** if you skip the pre-aggregation and only write `ORDER BY order_date`, the default frame is `RANGE`, which treats all rows with the same date as peers. Every order on that day then shows the full day's total, not a row-by-row running sum. Being explicit about `ROWS` vs `RANGE` is what interviewers look for.",code:{lang:"sql",code:`SELECT customer_id, order_date, daily_amount,
       SUM(daily_amount) OVER (
         PARTITION BY customer_id
         ORDER BY order_date
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_total
FROM (
  SELECT customer_id, order_date, SUM(amount) AS daily_amount
  FROM orders
  GROUP BY customer_id, order_date
) d
ORDER BY customer_id, order_date;`},checking:"Whether you understand window frames and the ROWS vs RANGE default, not just the SUM OVER syntax.",related:["window-frames","window-functions"]},{id:"bt-rolling-7-day-average",companies:["Amazon","Uber"],topic:"sql",round:"technical",difficulty:"medium",q:"Show the 7-day rolling average of daily trips. Some days have no trips at all.",a:"Build a calendar of all days, left join daily counts onto it with `COALESCE(..., 0)`, then average over `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`.\n\n**Why:** `ROWS 6 PRECEDING` counts rows, not days. If a day with zero trips has no row, the window silently stretches back 8 or 9 calendar days and the average is wrong. A date spine (here `generate_series`) gives exactly one row per day, so 7 rows really means 7 days, and zero-trip days pull the average down as they should.\n\nIn PostgreSQL you can also use `RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW` on a date column, but missing days are then simply not counted, which is a different answer.\n\n**Gotcha:** the first six days average fewer than 7 values. Either filter them out or show them with a note.",code:{lang:"sql",code:`WITH days AS (
  SELECT d::date AS day
  FROM generate_series(DATE '2024-01-01', DATE '2024-03-31', INTERVAL '1 day') AS g(d)
),
daily AS (
  SELECT trip_date AS day, COUNT(*) AS trips
  FROM trips
  GROUP BY trip_date
)
SELECT days.day,
       COALESCE(daily.trips, 0) AS trips,
       AVG(COALESCE(daily.trips, 0)) OVER (
         ORDER BY days.day
         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) AS rolling_7d_avg
FROM days
LEFT JOIN daily ON daily.day = days.day
ORDER BY days.day;`},checking:"Whether you notice that missing days break a row-based window and fix it with a date spine.",related:["window-frames","gaps-and-islands","window-functions"]},{id:"bt-month-1-retention-cohort",companies:["Amazon","Google"],topic:"sql",round:"technical",difficulty:"hard",q:"For each signup month cohort, what percentage of users were active again in the following month?",a:"Find each user's first active month (the cohort), then left join their activity in cohort month + 1 and divide the distinct counts.\n\n**Why:**\n- `firsts` gives one row per user with their cohort month.\n- `activity` gives distinct (user, month) pairs so a user active 50 times counts once.\n- The `LEFT JOIN` keeps every cohort user; `COUNT(DISTINCT a.user_id)` only counts those who matched in the next month.\n\n`100.0` forces decimal division so you do not get 0 from integer maths.\n\n**Gotcha:** keep the 'next month' condition in the `ON` clause. If you move it to `WHERE`, the left join turns into an inner join, every cohort user is a match, and retention looks like 100%. Also mention that the latest cohort has no next month yet, so its number is not final.",code:{lang:"sql",code:`WITH firsts AS (
  SELECT user_id, DATE_TRUNC('month', MIN(event_date)) AS cohort_month
  FROM events
  GROUP BY user_id
),
activity AS (
  SELECT DISTINCT user_id, DATE_TRUNC('month', event_date) AS active_month
  FROM events
)
SELECT f.cohort_month,
       COUNT(DISTINCT f.user_id) AS cohort_size,
       COUNT(DISTINCT a.user_id) AS retained_m1,
       ROUND(100.0 * COUNT(DISTINCT a.user_id) / COUNT(DISTINCT f.user_id), 1) AS pct_m1
FROM firsts f
LEFT JOIN activity a
  ON a.user_id = f.user_id
 AND a.active_month = f.cohort_month + INTERVAL '1 month'
GROUP BY f.cohort_month
ORDER BY f.cohort_month;`},checking:"Whether you can turn a product metric into clean SQL steps and avoid the WHERE-on-left-join trap.",related:["funnels-and-retention","joins","design-product-analytics"]},{id:"bt-median-without-builtin",companies:["Google","Microsoft"],topic:"sql",round:"technical",difficulty:"medium",q:"Find the median delivery time per city. Then do it without a built-in median function.",a:"Use `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ...)`; without it, number the rows per city and average the middle one or two rows.\n\n**Why the manual version works:** `ROW_NUMBER` orders values inside each city and `COUNT(*) OVER` gives the city size. With integer division, `(cnt + 1) / 2` and `(cnt + 2) / 2` are the same row when the count is odd (5 gives 3 and 3) and the two middle rows when it is even (4 gives 2 and 3). Averaging them gives the median in both cases.\n\n**Gotcha:**\n- Filter out NULLs first, otherwise they are counted in `cnt` and shift the middle.\n- `PERCENTILE_CONT` interpolates between the two middle values; `PERCENTILE_DISC` returns an actual value from the data. Ask which one the business wants.",code:{lang:"sql",code:`-- Built-in (PostgreSQL)
SELECT city,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delivery_minutes) AS median_minutes
FROM deliveries
GROUP BY city;

-- Without the built-in
WITH r AS (
  SELECT city, delivery_minutes,
         ROW_NUMBER() OVER (PARTITION BY city ORDER BY delivery_minutes) AS rn,
         COUNT(*) OVER (PARTITION BY city) AS cnt
  FROM deliveries
  WHERE delivery_minutes IS NOT NULL
)
SELECT city, AVG(delivery_minutes) AS median_minutes
FROM r
WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2)
GROUP BY city;`},checking:"Whether you can reason about odd and even counts and NULLs instead of relying on one function.",related:["window-functions","null-semantics"]},{id:"bt-year-over-year-growth",companies:["Walmart Global Tech","Amazon"],topic:"sql",round:"technical",difficulty:"medium",q:"Calculate year-over-year revenue growth percentage from a sales table.",a:"Aggregate to one row per year, then compare each year with the previous one using `LAG(revenue) OVER (ORDER BY yr)`.\n\n**Why:** `LAG` reads the value from the previous row in the window order, so you can subtract without a self join. Growth is `(this year - last year) / last year * 100`. `NULLIF(..., 0)` avoids a divide-by-zero error if a year had zero revenue; the result is NULL instead.\n\nFor a Walmart-style question you often add `PARTITION BY store_id` to get growth per store.\n\n**Gotcha:** `LAG` takes the previous row, not the previous year. If a year is missing (a store closed for a year), you end up comparing 2024 with 2022. If gaps are possible, join on `yr - 1` instead, which returns NULL for a missing year.",code:{lang:"sql",code:`WITH yearly AS (
  SELECT EXTRACT(YEAR FROM sale_date) AS yr,
         SUM(amount) AS revenue
  FROM sales
  GROUP BY EXTRACT(YEAR FROM sale_date)
)
SELECT yr,
       revenue,
       LAG(revenue) OVER (ORDER BY yr) AS prev_revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY yr))
             / NULLIF(LAG(revenue) OVER (ORDER BY yr), 0), 2) AS yoy_pct
FROM yearly
ORDER BY yr;`},checking:"Whether you use LAG correctly and think about missing periods and division by zero.",related:["window-functions","null-semantics"]},{id:"bt-bought-x-not-y",companies:["Amazon"],topic:"sql",round:"technical",difficulty:"easy",q:"List customers who bought an iPhone but never bought AirPods.",a:"Filter iPhone buyers and exclude anyone with an AirPods order using `NOT EXISTS`.\n\n**Why:** `NOT EXISTS` checks, for each customer, whether at least one matching row exists in the subquery. It stops at the first match and handles NULLs safely. Another clean option is one pass with `GROUP BY customer_id HAVING SUM(CASE WHEN product_name = 'iPhone' THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN product_name = 'AirPods' THEN 1 ELSE 0 END) = 0`.\n\n**Gotcha:** `customer_id NOT IN (SELECT customer_id FROM orders WHERE product_name = 'AirPods')` returns **no rows at all** if that subquery contains even one NULL `customer_id`, because `x NOT IN (..., NULL)` is never true. This is a classic follow-up, so mention it before the interviewer does.",code:{lang:"sql",code:`SELECT DISTINCT o.customer_id
FROM orders o
WHERE o.product_name = 'iPhone'
  AND NOT EXISTS (
    SELECT 1
    FROM orders o2
    WHERE o2.customer_id = o.customer_id
      AND o2.product_name = 'AirPods'
  );`},checking:"Whether you know anti-join patterns and the NOT IN with NULL trap.",related:["subqueries-vs-joins","not-in-null-empty-result","null-semantics"]},{id:"bt-dedup-latest-record",companies:["Walmart Global Tech","Microsoft"],topic:"sql",round:"technical",difficulty:"easy",q:"A raw orders table has several versions of each order. Keep only the latest version per order_id.",a:"Number the rows per `order_id` with `ROW_NUMBER()` ordered by `updated_at DESC` and keep row 1.\n\n**Why:** `ROW_NUMBER` always gives unique numbers 1, 2, 3 inside each partition, so exactly one row survives per order. Here you want exactly one row, so `ROW_NUMBER` is the right choice over `RANK`.\n\nAdd a second sort key (like an ingestion id) so ties on `updated_at` are broken the same way on every run. Without it, a rerun can pick a different row, which makes the pipeline non-deterministic.\n\n**Gotcha:** in PostgreSQL, `DESC` sorts NULLs **first**. A row with a NULL `updated_at` would win and become the 'latest'. Write `NULLS LAST` explicitly. Also drop the helper `rn` column in the final select of a real job.",code:{lang:"sql",code:`WITH ranked AS (
  SELECT r.*,
         ROW_NUMBER() OVER (
           PARTITION BY order_id
           ORDER BY updated_at DESC NULLS LAST, ingest_id DESC
         ) AS rn
  FROM raw_orders r
)
SELECT *
FROM ranked
WHERE rn = 1;`},checking:"Whether your dedup is deterministic and safe with ties and NULLs.",related:["top-n-and-dedup","null-semantics"]},{id:"bt-consecutive-login-streaks",companies:["Amazon","Uber","Google"],topic:"sql",round:"technical",difficulty:"hard",q:"Find users who logged in on 3 or more consecutive days, with the start and end of each streak.",a:"This is gaps and islands: subtract a per-user row number from the date, and consecutive days get the same group value.\n\n**Why:** if dates go up by one day and the row number also goes up by one, then `login_date - row_number` stays constant inside a streak. When a day is skipped, the date jumps by 2 but the row number only by 1, so the value changes and a new island starts. Group by that value and keep groups with `COUNT(*) >= 3`.\n\n**Gotcha:** deduplicate first. A user who logs in twice on the same day gets two row numbers for one date, which breaks the trick. Also make sure the column is a `date`, not a timestamp; cast it if needed. For Uber, the same pattern finds drivers online on consecutive days.",code:{lang:"sql",code:`WITH days AS (
  SELECT DISTINCT user_id, login_date
  FROM logins
),
grp AS (
  SELECT user_id, login_date,
         login_date - (ROW_NUMBER() OVER (
           PARTITION BY user_id ORDER BY login_date))::int AS island
  FROM days
)
SELECT user_id,
       MIN(login_date) AS streak_start,
       MAX(login_date) AS streak_end,
       COUNT(*)        AS streak_days
FROM grp
GROUP BY user_id, island
HAVING COUNT(*) >= 3;`},checking:"Whether you know the gaps-and-islands trick and remember to dedupe same-day rows.",related:["gaps-and-islands","window-functions"]},{id:"bt-recursive-org-hierarchy",companies:["Microsoft","Amazon"],topic:"sql",round:"technical",difficulty:"medium",q:"Given an employees table with manager_id, list everyone who reports to manager 101, directly or indirectly, with their level.",a:"Use a recursive CTE: start with direct reports, then repeatedly join employees whose manager is already in the result.\n\n**Why:** a recursive CTE has two parts joined by `UNION ALL`.\n- The **anchor** query returns the first level (direct reports of 101).\n- The **recursive** query joins `employees` to the rows found so far and adds the next level, with `depth + 1`.\n\nThe database repeats the recursive part until it returns no new rows, so it works for any tree depth without knowing it in advance.\n\n**Gotcha:** bad data can contain a cycle (A manages B, B manages A), and the query would loop until it hits a limit or runs out of memory. Add a depth guard like `WHERE r.depth < 20`, or track the visited path in an array and stop when an id repeats.",code:{lang:"sql",code:`WITH RECURSIVE reports AS (
  SELECT emp_id, manager_id, name, 1 AS depth
  FROM employees
  WHERE manager_id = 101
  UNION ALL
  SELECT e.emp_id, e.manager_id, e.name, r.depth + 1
  FROM employees e
  JOIN reports r ON e.manager_id = r.emp_id
  WHERE r.depth < 20          -- cycle / runaway guard
)
SELECT emp_id, name, depth
FROM reports
ORDER BY depth, emp_id;`},checking:"Whether you can write a recursive CTE and think about cycles in real data.",related:["ctes-recursive"]},{id:"bt-driver-cancellation-rate",companies:["Uber"],topic:"sql",round:"technical",difficulty:"easy",q:"From a trips table, find the driver cancellation rate per city for the last 30 days, only for cities with at least 100 requests.",a:"Use conditional aggregation: count all requests and count driver cancellations in the same `GROUP BY`, then divide.\n\n**Why:** `COUNT(*) FILTER (WHERE status = 'cancelled_by_driver')` counts only matching rows inside the group, so you get both numbers in one scan. Engines without `FILTER` can use `SUM(CASE WHEN status = 'cancelled_by_driver' THEN 1 ELSE 0 END)`. The minimum-volume rule goes in `HAVING`, because it filters groups after aggregation, not rows.\n\n**Gotcha:** integer division. `5 / 100` is `0` in many engines, so multiply by `100.0` first. Also ask what counts as a request: should rider cancellations or duplicate requests from the same rider within a minute be excluded? Clarifying the metric definition is part of what Uber interviewers grade.",code:{lang:"sql",code:`SELECT city_id,
       COUNT(*) AS requests,
       COUNT(*) FILTER (WHERE status = 'cancelled_by_driver') AS driver_cancels,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'cancelled_by_driver')
             / COUNT(*), 2) AS cancel_pct
FROM trips
WHERE request_ts >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY city_id
HAVING COUNT(*) >= 100
ORDER BY cancel_pct DESC;`},checking:"Whether you can define a ratio metric cleanly and know WHERE vs HAVING and integer division.",related:["aggregation-grouping-sets","logical-query-order"]},{id:"bt-percent-of-total",companies:["Walmart Global Tech"],topic:"sql",round:"technical",difficulty:"medium",q:"Show each category's sales and its percentage of total sales in one query.",a:"Group by category, then divide by `SUM(SUM(amount)) OVER ()`, a window over the grouped result.\n\n**Why:** SQL runs `GROUP BY` before window functions. So after grouping there is one row per category, and `SUM(SUM(amount)) OVER ()` adds up those category totals across all rows (the empty `OVER ()` means 'the whole result'). The inner `SUM` is the group aggregate; the outer one is the window. No subquery or self join needed.\n\nFor 'percentage within each department', change it to `OVER (PARTITION BY department)`.\n\n**Gotcha:** rounded percentages may not add up to exactly 100. That is normal; mention it if the output is going to a finance dashboard. Also, with NULL categories you get a NULL group row, so decide whether to label it 'Unknown' with `COALESCE`.",code:{lang:"sql",code:`SELECT category,
       SUM(amount) AS category_sales,
       ROUND(100.0 * SUM(amount) / SUM(SUM(amount)) OVER (), 2) AS pct_of_total
FROM sales
GROUP BY category
ORDER BY pct_of_total DESC;`},checking:"Whether you understand the logical order of GROUP BY and window functions.",related:["logical-query-order","window-functions","aggregation-grouping-sets"]},{id:"bt-sessionize-clickstream",companies:["Google","Amazon"],topic:"sql",round:"technical",difficulty:"hard",q:"Assign a session number to each click event, where a new session starts after 30 minutes of inactivity.",a:"Flag a row as a new session when the gap from the previous event is over 30 minutes, then take a running sum of the flags.\n\n**Why:**\n- `LAG(event_ts)` gives the previous event time for the same user.\n- If the gap is 30 minutes or less, the flag is 0; otherwise it is 1.\n- A running `SUM` of the flags increases by 1 at each new session, so every event gets its session number.\n\nThe first event for a user has no previous event, so `LAG` returns NULL, the comparison is unknown, and the `CASE` falls into `ELSE 1`. That correctly starts session 1.\n\n**Gotcha:** events must be ordered by event time, not arrival time, and late events can change session boundaries. In a daily batch, sessions crossing midnight get split unless you read some events from the previous day too.",code:{lang:"sql",code:`WITH flagged AS (
  SELECT user_id, event_ts,
         CASE WHEN event_ts - LAG(event_ts) OVER (
                     PARTITION BY user_id ORDER BY event_ts)
                   <= INTERVAL '30 minutes'
              THEN 0 ELSE 1 END AS new_session
  FROM events
)
SELECT user_id, event_ts,
       SUM(new_session) OVER (
         PARTITION BY user_id ORDER BY event_ts
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS session_no
FROM flagged;`},checking:"Whether you can combine LAG and a running sum, and you handle the first-row NULL.",related:["sessionization","window-functions","design-streaming-sessionization"]},{id:"bt-left-join-where-filter",companies:["Amazon","Microsoft"],topic:"sql",round:"technical",difficulty:"easy",q:"You want every customer with their 2024 order count, including zero. Your LEFT JOIN query loses customers with no orders. Why?",a:"The date filter is in `WHERE`, which runs after the join and removes the NULL rows that the `LEFT JOIN` kept, so it behaves like an inner join.\n\n**Why:** for a customer with no 2024 orders, the left join produces one row with `o.order_date = NULL`. Then `WHERE o.order_date >= '2024-01-01'` is unknown for NULL, so that row is dropped. Moving the condition into the `ON` clause filters orders **before** matching, and customers without matches still survive with NULLs.\n\n**Gotcha:** count `COUNT(o.order_id)`, not `COUNT(*)`. With `COUNT(*)`, a customer with no orders still has one row (full of NULLs) and shows 1 instead of 0.",code:{lang:"sql",code:`-- Wrong: the WHERE drops customers with no 2024 orders
SELECT c.customer_id, COUNT(o.order_id) AS orders_2024
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_date >= DATE '2024-01-01'
GROUP BY c.customer_id;

-- Right: filter the right-hand table inside ON
SELECT c.customer_id, COUNT(o.order_id) AS orders_2024
FROM customers c
LEFT JOIN orders o
  ON o.customer_id = c.customer_id
 AND o.order_date >= DATE '2024-01-01'
 AND o.order_date <  DATE '2025-01-01'
GROUP BY c.customer_id;`},checking:"Whether you understand join semantics with NULLs and the logical order of ON and WHERE.",related:["joins","null-semantics","logical-query-order"]},{id:"bt-spark-vs-mapreduce",companies:["Walmart Global Tech","Microsoft"],topic:"spark",round:"technical",difficulty:"easy",q:"Why is Spark usually faster than Hadoop MapReduce?",a:`Spark keeps intermediate data in memory and plans the whole job as one DAG, while MapReduce writes to disk between every map and reduce step.

**Why, in plain words:**
- **Fewer disk round trips:** a MapReduce pipeline of 5 steps means 5 jobs, each reading and writing HDFS. Spark chains steps in memory and only writes shuffle files at stage boundaries.
- **Whole-job planning:** because Spark is lazy, it sees all transformations before running and can combine narrow steps (map, filter) into one stage.
- **Optimizer:** DataFrames go through Catalyst and Tungsten, which prune columns, push filters down and generate efficient code.
- **Reuse:** you can \`cache()\` a dataset used many times, which helps iterative work like ML.

**Gotcha:** do not say 'Spark does everything in memory'. Shuffles still write to local disk, and data that does not fit in memory spills. Spark is faster mainly because it avoids unnecessary disk writes, not because it never touches disk.`,checking:"Whether you understand the real reasons for Spark's speed instead of the 'in-memory' slogan.",related:["lazy-evaluation-dag","spark-architecture","narrow-wide-transformations"]},{id:"bt-what-causes-shuffle",companies:["Amazon","Walmart Global Tech"],topic:"spark",round:"technical",difficulty:"medium",q:"What is a shuffle in Spark, what triggers it, and how do you reduce it?",a:"A shuffle is when Spark moves rows across the network so that all rows with the same key end up in the same partition; wide operations like `groupBy`, `join`, `distinct`, `repartition` and window `partitionBy` trigger it.\n\n**Why it is expensive:** each task writes its output to local disk split by target partition, then tasks in the next stage fetch those pieces over the network. That is disk, network and serialization cost, and it creates a stage boundary (`Exchange` in the plan).\n\n**How to reduce it:**\n- Filter rows and select only needed columns **before** the wide operation.\n- Broadcast the small side of a join so the big side does not move.\n- Avoid repeated `repartition` calls; reuse the same partitioning for consecutive joins or use bucketing for tables joined often.\n- Tune `spark.sql.shuffle.partitions` or let AQE coalesce partitions.\n\n**Gotcha:** `coalesce(n)` to reduce partitions avoids a shuffle, but it can make the upstream stage run with fewer, larger tasks.",code:{lang:"python",code:`from pyspark.sql import functions as F

result = (orders
          .filter(F.col("order_date") >= "2024-01-01")   # shrink first
          .select("store_id", "amount")                  # prune columns
          .groupBy("store_id")                           # shuffle happens here
          .agg(F.sum("amount").alias("revenue")))

result.explain()   # look for 'Exchange hashpartitioning(store_id, ...)'`},checking:"Whether you can connect shuffles to stages, cost and concrete ways to avoid them.",related:["shuffle-internals","narrow-wide-transformations","jobs-stages-tasks"]},{id:"bt-skewed-join-fix",companies:["Walmart Global Tech","Uber","Amazon"],topic:"spark",round:"technical",difficulty:"hard",q:"A join between sales and stores finishes 199 tasks in 2 minutes but the last task runs for an hour. What is happening and how do you fix it?",a:`That is data skew: one join key (for example one huge store or a NULL key) holds most of the rows, so one task gets most of the work.

**How to confirm:** in the Spark UI, the stage's task metrics show one task with far larger shuffle read size than the median. A quick \`groupBy(key).count().orderBy(desc)\` finds the hot keys.

**Fixes, simplest first:**
- If the other side is small, **broadcast** it; no shuffle, no skew.
- Turn on **AQE skew join** in Spark 3.x; it splits oversized partitions automatically.
- Handle NULL or junk keys separately if they are the hot key.
- **Salt** the key: add a random number 0..N-1 on the big side and replicate the small side N times, so the hot key is spread over N tasks.

**Gotcha:** salting multiplies the small side by N, so pick N just large enough. And skew in a \`groupBy\` is different: there, do a two-step aggregation (aggregate on key + salt, then on key).`,code:{lang:"python",code:`from pyspark.sql import functions as F

# Option 1: AQE splits skewed partitions automatically (Spark 3.x)
spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")

# Option 2: manual salting
N = 16
sales_s = sales.withColumn("salt", (F.rand() * N).cast("int"))
stores_s = stores.crossJoin(
    spark.range(N).select(F.col("id").cast("int").alias("salt")))

joined = sales_s.join(stores_s, ["store_id", "salt"]).drop("salt")`},checking:"Whether you can diagnose skew from the UI and pick a fix in order of cost.",related:["data-skew","adaptive-query-execution","skewed-join-straggler"]},{id:"bt-join-strategies",companies:["Microsoft","Walmart Global Tech"],topic:"spark",round:"technical",difficulty:"medium",q:"Explain broadcast hash join, sort-merge join and shuffle hash join. When does Spark pick each?",a:`Broadcast hash join sends a small table to every executor; sort-merge join shuffles and sorts both sides by key; shuffle hash join shuffles both sides and builds a hash table on the smaller side per partition.

**When each is used:**
- **Broadcast hash join:** one side is below \`spark.sql.autoBroadcastJoinThreshold\` (10 MB by default) or you add a \`broadcast()\` hint. Fastest, because the big table never moves.
- **Sort-merge join:** the default for two large tables with an equi-join. It scales well because sorted data can spill to disk.
- **Shuffle hash join:** used when one side is much smaller but too big to broadcast, and is enabled or chosen by AQE. It skips the sort but needs each partition's hash table to fit in memory.
- Non-equi joins fall back to broadcast nested loop or cartesian joins, which are slow.

**Gotcha:** broadcasting a table that is 'small' on disk but huge after decompression can cause driver or executor OOM. Check size estimates in the plan.`,code:{lang:"python",code:`from pyspark.sql.functions import broadcast

joined = sales.join(broadcast(stores), "store_id")
joined.explain()   # expect BroadcastHashJoin

# raise the auto-broadcast limit to 50 MB (use with care)
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 50 * 1024 * 1024)`},checking:"Whether you know the trade-offs of each join and can read which one Spark chose.",related:["join-strategies","broadcast-join-failure","reading-explain-plans"]},{id:"bt-partitioning-on-write",companies:["Walmart Global Tech","Amazon"],topic:"spark",round:"technical",difficulty:"medium",q:"Your daily job writes thousands of tiny Parquet files per date partition. Why, and how do you fix it?",a:'Each task writes its own file for every partition value it holds, so 200 shuffle tasks times many dates gives thousands of small files; repartition by the partition column before writing.\n\n**Why it matters:** small files slow down reads (more file opens and metadata calls) and stress the metastore or object store listing. Readers often care more about file count than total size.\n\n**Fixes:**\n- `df.repartition("event_date")` before `partitionBy("event_date")` sends all rows for a date to one task, so you get about one file per date.\n- For big dates, use `repartition("event_date", salt)` or `maxRecordsPerFile` to cap file size around 128 MB to 1 GB.\n- On Delta or Iceberg, run compaction (`OPTIMIZE`) regularly.\n\n**Gotcha:** `repartition("event_date")` sends a huge date to a single task, which is slow or runs out of memory. Do not partition by high-cardinality columns like `user_id` either; that creates millions of folders.',code:{lang:"python",code:`(df.repartition("event_date")
   .write
   .mode("overwrite")
   .option("maxRecordsPerFile", 5_000_000)
   .partitionBy("event_date")
   .parquet("s3://lake/silver/events/"))`},checking:"Whether you understand how tasks map to output files and the cost of small files.",related:["writing-data","small-files-compaction","small-files-slow-read"]},{id:"bt-executor-oom",companies:["Walmart Global Tech","Uber"],topic:"spark",round:"technical",difficulty:"hard",q:"Your Spark job fails with executors lost due to out of memory. How do you debug and fix it?",a:"First find where memory is used up (driver or executor, which stage), then fix the cause, usually too much data per task, skew, a large broadcast or `collect()`, before adding memory.\n\n**Steps:**\n- **Driver or executor?** `collect()`, `toPandas()` or a huge broadcast kill the driver. 'Container killed by YARN for exceeding memory limits' points to executor overhead (off-heap, Python workers).\n- **Which stage?** In the Spark UI, look for one task with huge input or spill (skew), or all tasks big (too few partitions).\n- **Fix the data shape:** raise `spark.sql.shuffle.partitions` so each task holds less, fix skew, filter and select columns earlier, avoid caching what you do not reuse.\n- **Then tune memory:** `spark.executor.memory`, `spark.executor.memoryOverhead` (important for PySpark UDFs), and fewer cores per executor so fewer tasks share the heap.\n\n**Gotcha:** doubling executor memory may hide skew for a week until data grows again. Interviewers want the root cause, not only a bigger cluster.",checking:"Whether you debug memory issues systematically instead of just raising memory settings.",related:["spill-and-oom","unified-memory-model","executor-oom-killed"]},{id:"bt-catalyst-and-aqe",companies:["Microsoft","Google"],topic:"spark",round:"technical",difficulty:"medium",q:"What does the Catalyst optimizer do, and what does Adaptive Query Execution add?",a:`Catalyst turns your DataFrame or SQL code into an optimized physical plan before running; AQE re-optimizes that plan during the run using real statistics from completed stages.

**Catalyst, step by step:** it parses your query into a logical plan, resolves column names against the catalog, applies rules like predicate pushdown, column pruning and constant folding, then picks a physical plan (for example which join type). Tungsten then generates efficient JVM code.

**AQE adds (Spark 3.x):**
- **Coalescing shuffle partitions:** merges many tiny partitions after a shuffle.
- **Switching join strategy:** turns a sort-merge join into a broadcast join if one side turned out small.
- **Skew join handling:** splits oversized partitions.

**Gotcha:** Catalyst cannot see inside Python UDFs. A filter written as a UDF is not pushed down to Parquet, so prefer built-in functions. Also, AQE only kicks in at shuffle boundaries, so it cannot fix a bad plan with no shuffle.`,code:{lang:"python",code:`spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")

df = (spark.read.parquet("s3://lake/orders/")
      .filter("order_date = '2024-06-01'")
      .select("order_id", "amount"))

df.explain(mode="formatted")   # check PushedFilters and ReadSchema`},checking:"Whether you know what the optimizer does for you and where it cannot help.",related:["catalyst-optimizer","adaptive-query-execution","partition-pruning-pushdown"]},{id:"bt-idempotent-reruns",companies:["Amazon","Uber"],topic:"spark",round:"design",difficulty:"medium",q:"How do you make a daily Spark job safe to rerun without creating duplicates or deleting other days?",a:'Make each run overwrite exactly the partitions it owns, using dynamic partition overwrite or Delta\'s `replaceWhere`, instead of appending.\n\n**Why:** with `mode("append")`, a rerun after a partial failure writes the same rows twice. With plain `mode("overwrite")` and static mode, Spark deletes the **whole table** and writes only today\'s data. Setting `partitionOverwriteMode` to `dynamic` makes overwrite replace only the partitions present in the DataFrame, so rerunning 2024-06-01 replaces just that date.\n\nOther rules that keep a job idempotent:\n- Derive the date from a parameter, not `current_date()`, so a rerun next week processes the right day.\n- Dedupe the input on a business key.\n- For upserts, use `MERGE` on a key instead of insert.\n\n**Gotcha:** on plain Parquet in S3, overwrite is not atomic; readers can see a half-written partition. Table formats like Delta or Iceberg give atomic commits.',code:{lang:"python",code:`spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")

run_date = "2024-06-01"   # passed in by the scheduler
daily = orders_raw.filter(f"order_date = '{run_date}'").dropDuplicates(["order_id"])

(daily.write.mode("overwrite")
      .partitionBy("order_date")
      .parquet("s3://lake/silver/orders/"))

# Delta Lake: replace exactly one slice atomically
(daily.write.format("delta").mode("overwrite")
      .option("replaceWhere", f"order_date = '{run_date}'")
      .save("s3://lake/silver/orders_delta/"))`},checking:"Whether your pipelines survive retries and backfills without manual cleanup.",related:["writing-data","delta-lake-iceberg","fault-tolerance-lineage"]},{id:"bt-cache-vs-persist",companies:["Walmart Global Tech","Microsoft"],topic:"spark",round:"technical",difficulty:"easy",q:"What is the difference between cache() and persist(), and when should you use them?",a:"`cache()` is `persist()` with the default storage level; `persist()` lets you choose the level, such as memory only, memory and disk, or disk only.\n\n**When to use:** only when the same DataFrame is used by **two or more actions**. Spark is lazy, so without caching each action recomputes the whole lineage from the source. A cleaned and joined dataset that feeds several aggregations is the classic case.\n\nFor DataFrames the default level is memory and disk, so partitions that do not fit go to disk instead of being recomputed. For RDDs, `cache()` defaults to memory only.\n\n**Gotchas:**\n- Caching is lazy too; it fills only when an action runs.\n- Caching something used once just wastes memory and can cause spills or OOM elsewhere.\n- Call `unpersist()` when done, especially in long notebooks or loops.",code:{lang:"python",code:`from pyspark import StorageLevel

enriched = (orders.join(customers, "customer_id")
                  .filter("status = 'DELIVERED'"))
enriched.persist(StorageLevel.MEMORY_AND_DISK)

daily = enriched.groupBy("order_date").sum("amount")
by_city = enriched.groupBy("city").count()
daily.write.mode("overwrite").parquet("s3://lake/gold/daily/")    # fills cache
by_city.write.mode("overwrite").parquet("s3://lake/gold/city/")   # reuses it

enriched.unpersist()`},checking:"Whether you know caching is a trade-off tied to lazy evaluation, not a free speed-up.",related:["caching-persistence","lazy-evaluation-dag"]},{id:"bt-pyspark-top-n-per-group",companies:["Amazon","Walmart Global Tech"],topic:"spark",round:"coding",difficulty:"easy",q:"In PySpark, find the top 3 products by revenue in each category.",a:'Aggregate revenue per category and product, then apply `dense_rank()` over a window partitioned by category and ordered by revenue descending, and keep ranks 1 to 3.\n\n**Why:** this is the same pattern as SQL top-N per group. `Window.partitionBy("category")` restarts ranking per category, and `orderBy(F.col("revenue").desc())` makes the highest revenue rank 1. `dense_rank` keeps tied products together; use `row_number` if you need exactly three rows.\n\nThe aggregation comes first so the window works on one row per product, which keeps it small.\n\n**Gotcha:** a window with `partitionBy` shuffles all rows of a category to one task. If one category is huge, that task is slow. For plain \'top 1\', a `groupBy` with `max_by` (Spark 3.3+) or a `struct` max can be cheaper than a window.',code:{lang:"python",code:`from pyspark.sql import functions as F, Window

product_rev = (orders.groupBy("category", "product_id")
                     .agg(F.sum("amount").alias("revenue")))

w = Window.partitionBy("category").orderBy(F.col("revenue").desc())

top3 = (product_rev
        .withColumn("rnk", F.dense_rank().over(w))
        .filter(F.col("rnk") <= 3)
        .orderBy("category", "rnk"))`},checking:"Whether you can translate SQL window logic into the PySpark DataFrame API.",related:["aggregations-windows","top-n-and-dedup"]},{id:"bt-clickstream-pipeline",companies:["Amazon","Google"],topic:"pipeline",round:"design",difficulty:"hard",q:"Design a pipeline that ingests billions of clickstream events per day from a shopping website and powers hourly dashboards and daily reports.",a:`Collect events into Kafka (or Kinesis), land them raw in a data lake, clean and dedupe them into partitioned tables, and build aggregated tables for dashboards.

**Layers:**
- **Ingestion:** web and app clients send events to a collector, which writes to a partitioned topic keyed by user or session.
- **Raw (bronze):** a streaming job writes events to object storage as Parquet or Delta every few minutes, partitioned by event date and hour. Keep raw data so you can replay.
- **Clean (silver):** parse JSON against a schema, drop or quarantine bad rows, dedupe on \`event_id\`, attach user and product dimensions.
- **Serve (gold):** hourly aggregates (views, add-to-cart, conversions) for dashboards; daily batch jobs for heavier reports and sessions.

**Talk about:** late events (watermarks, reprocessing the last few hours), schema evolution, PII masking, and cost (partitioning by date so queries prune).

**Gotcha:** do not jump to tools first. Start by asking about latency needs, data volume and who the consumers are; that drives every choice.`,checking:"Whether you can lay out a layered, replayable design and justify choices by requirements.",related:["design-lakehouse-etl","design-product-analytics","structured-streaming-model"]},{id:"bt-lakehouse-layout",companies:["Microsoft","Walmart Global Tech"],topic:"pipeline",round:"design",difficulty:"medium",q:"How would you organize a data lake or lakehouse for a large company? Explain the bronze, silver and gold layers.",a:`Split the lake into raw (bronze), cleaned and conformed (silver), and business-ready (gold) layers, stored in an open table format like Delta Lake or Iceberg.

**What each layer holds:**
- **Bronze:** data exactly as it arrived, append-only, with load timestamp and source file. Lets you replay when logic changes.
- **Silver:** typed, deduplicated, validated tables at a clear grain, with CDC merged in. Joined to shared dimensions so different teams agree on ids.
- **Gold:** aggregates and star schemas for specific use cases such as a sales mart or a finance report.

**Practical rules:** partition by date for large tables, keep files 128 MB or larger with compaction, use a catalog (Unity Catalog, Glue, Hive metastore) with access control, and track lineage.

**Gotcha:** the layers are not about copying data three times for fun. Each layer must have a clear contract (schema, freshness, quality checks). For Microsoft roles, be ready to map this to ADLS, Data Factory and Databricks or Fabric.`,checking:"Whether you understand why lakehouse layers exist and what guarantees each provides.",related:["delta-lake-iceberg","design-lakehouse-etl","parquet-columnar"]},{id:"bt-exactly-once-streaming",companies:["Uber","Amazon"],topic:"pipeline",round:"design",difficulty:"hard",q:"How do you get exactly-once results when streaming trip events from Kafka into the lake with Spark Structured Streaming?",a:`Combine a replayable source (Kafka offsets), checkpointing, and an idempotent or transactional sink such as Delta Lake; then dedupe on an event id for duplicates produced upstream.

**How it works:**
- The **checkpoint** stores which Kafka offsets each micro-batch read and the state of aggregations.
- If the job crashes, it restarts from the checkpoint and re-reads the same offsets.
- A **transactional sink** like Delta records which batch ids were committed, so a replayed batch is not written twice.

This gives exactly-once from Kafka to the table. But producers (driver apps on flaky mobile networks) can still send the same event twice, so also \`dropDuplicates\` on \`event_id\` with a watermark to limit the state kept.

**Gotcha:** writing with \`foreachBatch\` to a plain database is only at-least-once unless you write idempotently (upsert by key). And never delete or share a checkpoint folder between queries.`,code:{lang:"python",code:`from pyspark.sql import functions as F

raw = (spark.readStream.format("kafka")
       .option("kafka.bootstrap.servers", "broker:9092")
       .option("subscribe", "trip-events")
       .load())

events = (raw.select(F.from_json(F.col("value").cast("string"), trip_schema).alias("e"))
             .select("e.*")
             .withWatermark("event_ts", "2 hours")
             .dropDuplicates(["event_id", "event_ts"]))

(events.writeStream.format("delta")
   .outputMode("append")
   .option("checkpointLocation", "s3://lake/_checkpoints/trip_events")
   .start("s3://lake/bronze/trip_events"))`},checking:"Whether you know exactly-once is end-to-end: source replay, checkpoint and sink together.",related:["exactly-once-checkpointing","watermarks-late-data","stateful-streaming"]},{id:"bt-backfill-two-years",companies:["Uber","Google"],topic:"pipeline",round:"design",difficulty:"medium",q:"A bug in a metric definition means you must backfill two years of a daily table. How do you do it safely?",a:`Run the fixed job partition by partition (or in small date ranges) into a separate table or version, validate it against the old data, then swap it in atomically.

**Plan:**
- **Idempotent job:** the job must take a date parameter and overwrite only that date, so each chunk can be retried.
- **Chunking:** run weeks or months in parallel within cluster limits, oldest first or newest first depending on what users need.
- **Isolation:** write to a shadow table or a new version so dashboards do not see half-fixed data.
- **Validation:** compare row counts and key metrics per day between old and new; differences should appear only where the bug applied.
- **Swap:** rename tables or switch a view; with Delta or Iceberg, a single commit.
- **Communicate:** tell consumers which numbers will change and why.

**Gotcha:** check that source data for two years ago still exists and has the same schema. Raw retention or schema changes often break backfills. Also watch downstream tables that must be rebuilt too.`,checking:"Whether you plan for safety, validation and downstream impact, not just rerunning a script.",related:["writing-data","delta-lake-iceberg","data-quality-tests"]},{id:"bt-data-quality-sla",companies:["Amazon","Microsoft"],topic:"pipeline",round:"design",difficulty:"medium",q:"How do you guarantee data quality and freshness SLAs for a table that many teams depend on?",a:`Define the contract (freshness time, completeness, key rules), check it automatically after every load, and block or alert before bad data reaches consumers.

**Typical checks:**
- **Freshness:** latest partition or \`MAX(loaded_at)\` is within the SLA (for example ready by 7 AM IST).
- **Volume:** row count within an expected range compared with the last few weeks.
- **Validity:** primary key not NULL and unique, amounts not negative, foreign keys found in dimensions.
- **Consistency:** totals match the source system within a tolerance.

**Process:** write to a staging location, run checks, and publish only if they pass (write-audit-publish). Page the owner on failure, and track SLA misses over time. Tools like Great Expectations, Deequ or dbt tests help, but simple SQL works too.

**Gotcha:** too many noisy alerts get ignored. Start with a few critical checks per table and add more after real incidents. At Amazon, link this to 'Insist on the Highest Standards' in behavioural answers.`,code:{lang:"sql",code:`SELECT COUNT(*)                                   AS row_count,
       COUNT(*) FILTER (WHERE order_id IS NULL)   AS null_ids,
       COUNT(order_id) - COUNT(DISTINCT order_id) AS duplicate_ids,
       COUNT(*) FILTER (WHERE amount < 0)         AS negative_amounts,
       MAX(loaded_at)                             AS last_loaded_at
FROM staging.orders
WHERE order_date = DATE '2024-06-01';`},checking:"Whether you treat data quality as an automated gate with clear owners, not manual spot checks.",related:["data-quality-tests","design-lakehouse-etl"]},{id:"bt-uber-ride-event-pipeline",companies:["Uber"],topic:"pipeline",round:"design",difficulty:"hard",q:"Design a pipeline for ride events (request, accept, pickup, drop, payment) that supports real-time city dashboards and accurate daily finance reports.",a:"Use one event stream with two paths: a streaming job for near real-time metrics and a batch job that rebuilds accurate daily tables from the same raw events.\n\n**Design:**\n- **Events:** each has `trip_id`, `event_type`, `event_ts` (device time), `server_ts` and an `event_id`. Publish to Kafka keyed by `trip_id` so a trip's events stay in order within a partition.\n- **Real-time path:** Flink or Spark Structured Streaming computes per-city counts (open requests, active trips, surge) in 1-minute windows with a watermark, written to a fast store for dashboards.\n- **Raw storage:** all events land in the lake, partitioned by date and hour.\n- **Batch path:** daily jobs build a trip-level fact table (one row per trip, with timestamps for each stage, fare and status) and reconcile with the payments system for finance.\n\n**Gotchas to raise:** events arrive late or out of order from phones with poor network; time zones (use city local date for reports); and finance numbers must come from the reconciled batch, not the streaming estimate.",checking:"Whether you can separate low-latency and high-accuracy needs and handle messy mobile event data.",related:["watermarks-late-data","stateful-streaming","timezone-day-boundary"]},{id:"bt-walmart-sales-mart",companies:["Walmart Global Tech"],topic:"pipeline",round:"design",difficulty:"medium",q:"Design a sales data mart that merchants use to see daily sales by store, product and region across thousands of stores.",a:`Load point-of-sale and online transactions daily into a line-item fact table, join it to store, product, date and customer dimensions in a star schema, and pre-aggregate the common views.

**Pieces:**
- **Sources:** POS transactions from stores, e-commerce orders, returns, and product and store master data.
- **Fact:** \`fact_sales_line\` at the grain of one product on one receipt, with quantity, net amount, discount and cost. Partition by sales date.
- **Dimensions:** \`dim_store\` (region, format), \`dim_product\` (category hierarchy, SCD Type 2 so category changes keep history), \`dim_date\` (fiscal calendar, holidays).
- **Aggregates:** daily store x category sales for fast dashboards.
- **Loads:** incremental by date; returns arrive days later, so reprocess a rolling window of recent days.

**Gotcha:** returns and price corrections change past numbers. Agree with the business whether a return reduces the original sale day or the return day, and document it.`,checking:"Whether you can translate a retail reporting need into grain, dimensions and incremental loads.",related:["design-ecommerce-star-schema","dimensional-modeling","partitioning-and-pruning"]},{id:"bt-cdc-into-lake",companies:["Amazon","Walmart Global Tech"],topic:"pipeline",round:"design",difficulty:"hard",q:"How would you keep a lake table in sync with an OLTP customers table using change data capture (CDC)?",a:"Stream inserts, updates and deletes from the database log (for example with Debezium or DMS) into a raw table, then `MERGE` the latest change per key into the target table each batch.\n\n**Why this design:**\n- Reading the database log does not load the source with heavy queries and captures deletes, which a 'select changed rows by updated_at' approach misses.\n- The raw change table keeps full history and allows replay.\n- Within one batch the same key can change several times, so keep only the latest change per key using `ROW_NUMBER` over a sequence number (log position), not a timestamp.\n- `MERGE` then deletes, updates or inserts in one atomic operation on Delta, Iceberg or a warehouse.\n\n**Gotcha:** if you skip the per-key dedup, `MERGE` fails or behaves unpredictably because several source rows match one target row. Also order by log sequence; two changes in the same millisecond have equal timestamps.",code:{lang:"sql",code:`MERGE INTO silver.customers AS t
USING (
  SELECT * FROM (
    SELECT c.*,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY change_seq DESC) AS rn
    FROM bronze.customer_changes c
    WHERE batch_id = 42
  ) x
  WHERE rn = 1
) AS s
ON t.customer_id = s.customer_id
WHEN MATCHED AND s.op = 'D' THEN DELETE
WHEN MATCHED THEN
  UPDATE SET name = s.name, city = s.city, updated_at = s.change_ts
WHEN NOT MATCHED AND s.op <> 'D' THEN
  INSERT (customer_id, name, city, updated_at)
  VALUES (s.customer_id, s.name, s.city, s.change_ts);`},checking:"Whether you understand log-based CDC and the per-key ordering needed for a correct MERGE.",related:["design-cdc-merge","delta-lake-iceberg","top-n-and-dedup"]},{id:"bt-star-schema-rides",companies:["Uber"],topic:"modeling",round:"design",difficulty:"medium",q:"Design a star schema for ride-hailing trips so analysts can study trips, fares and cancellations by city, product and time.",a:"Build one fact table at the grain of **one row per trip request**, surrounded by date, time, rider, driver, zone and product dimensions.\n\n**Why this grain:** a trip request is the natural event that every metric starts from: completed trips, cancellations, fares and wait times. Choosing the request (not only completed trips) means cancellation rate can be computed from the same table.\n\n**Fact columns:** foreign keys to dimensions, `status`, measures like `fare_amount`, `distance_km`, `duration_min`, `wait_time_sec`, `surge_multiplier`.\n\n**Dimensions:**\n- `dim_zone` used twice (pickup and dropoff) as a role-playing dimension, with city and region.\n- `dim_driver` and `dim_rider` with attributes like rating band, signup date, vehicle type.\n- `dim_product` (UberGo, Premier, Auto, Moto).\n- `dim_date` in city local time.\n\n**Gotcha:** lifecycle timestamps (accepted, picked up, dropped) update over time. Keep them as columns on the fact (an accumulating snapshot) or a separate event-level fact, and say which you pick.",code:{lang:"sql",code:`CREATE TABLE fact_trip (
  trip_id           BIGINT PRIMARY KEY,
  request_date_key  INT    REFERENCES dim_date (date_key),
  rider_key         BIGINT REFERENCES dim_rider (rider_key),
  driver_key        BIGINT REFERENCES dim_driver (driver_key),
  pickup_zone_key   INT    REFERENCES dim_zone (zone_key),
  dropoff_zone_key  INT    REFERENCES dim_zone (zone_key),
  product_key       INT    REFERENCES dim_product (product_key),
  status            VARCHAR(20),   -- completed, cancelled_by_rider, ...
  wait_time_sec     INT,
  distance_km       NUMERIC(8, 2),
  duration_min      NUMERIC(8, 2),
  fare_amount       NUMERIC(10, 2),
  surge_multiplier  NUMERIC(4, 2)
);`},checking:"Whether you start from the grain and can justify each dimension and measure.",related:["dimensional-modeling","design-ecommerce-star-schema"]},{id:"bt-scd-types",companies:["Amazon","Walmart Global Tech"],topic:"modeling",round:"technical",difficulty:"medium",q:"Explain SCD Type 1, 2 and 3, and show how you would load a Type 2 customer dimension.",a:`Type 1 overwrites the old value, Type 2 adds a new row for each change with validity dates, and Type 3 keeps only the previous value in an extra column.

**When to use:**
- **Type 1:** fixing typos or attributes where history does not matter.
- **Type 2:** when reports must show facts with the attribute value at that time, like a customer's city when the order was placed.
- **Type 3:** rare; when users only need 'current and previous'.

**Type 2 load in two steps:** close the current row for customers whose tracked columns changed, then insert a new current row for new and changed customers. Facts join through a surrogate key, so old orders keep pointing to the old version.

**Gotcha:** compare with \`IS DISTINCT FROM\`, not \`<>\`. With \`<>\`, a change from NULL to 'Pune' is not detected, because \`NULL <> 'Pune'\` is unknown.`,code:{lang:"sql",code:`-- 1. Close current rows whose tracked attributes changed
UPDATE dim_customer d
SET valid_to = s.change_date, is_current = FALSE
FROM stg_customer s
WHERE d.customer_id = s.customer_id
  AND d.is_current
  AND (d.city IS DISTINCT FROM s.city OR d.segment IS DISTINCT FROM s.segment);

-- 2. Insert a new current row for new or just-closed customers
INSERT INTO dim_customer (customer_id, city, segment, valid_from, valid_to, is_current)
SELECT s.customer_id, s.city, s.segment, s.change_date, DATE '9999-12-31', TRUE
FROM stg_customer s
LEFT JOIN dim_customer d
  ON d.customer_id = s.customer_id AND d.is_current
WHERE d.customer_id IS NULL;`},checking:"Whether you can pick the right SCD type and implement Type 2 correctly, including NULL changes.",related:["slowly-changing-dimensions","design-scd2-pipeline","null-semantics"]},{id:"bt-fact-grain-orders",companies:["Amazon"],topic:"modeling",round:"design",difficulty:"medium",q:"For an e-commerce orders fact table, would you choose order level or order line level as the grain? Why?",a:`Choose the **order line** (one product in one order) as the grain, because it is the most detailed level and every order-level number can be rolled up from it.

**Why:**
- Questions like 'revenue by category' or 'units sold per product' need product-level rows. An order-level fact cannot answer them.
- Order totals are just \`SUM\` over lines, so nothing is lost.
- Each row has one clear meaning, which keeps measures additive.

**Where it gets tricky:** some values exist only at order level, like shipping fee or an order-wide coupon. Either allocate them to lines (for example by line amount share) or keep a separate order-level fact. Do not copy the order shipping fee onto every line, or \`SUM\` will count it several times.

**Gotcha:** joining an order-level table to line-level data and then summing order amounts inflates revenue (a fan-out). State the grain of every table out loud in the interview; interviewers notice.`,checking:"Whether you think about grain first and know how mixed grains cause double counting.",related:["dimensional-modeling","join-fanout-inflated-revenue","design-ecommerce-star-schema"]},{id:"bt-star-vs-snowflake-normalization",companies:["Microsoft","Google"],topic:"modeling",round:"technical",difficulty:"easy",q:"Why do analytics warehouses use denormalized star schemas when OLTP databases are normalized? How is a snowflake schema different?",a:`OLTP systems normalize to make many small writes safe and consistent, while analytics systems denormalize into star schemas to make large reads simple and fast.

**Why:**
- **OLTP (normalized, 3NF):** each fact is stored once, so an update touches one row and there are no inconsistent copies. Good for thousands of small transactions per second.
- **Analytics (star):** queries scan millions of rows and group by many attributes. Fewer joins mean simpler SQL and faster queries, and columnar storage compresses repeated values well, so duplication is cheap.

A **snowflake schema** normalizes the dimensions further, for example product links to a separate category table which links to a department table. It saves a little storage and keeps hierarchies tidy, but adds joins for every query.

**Gotcha:** denormalized dimensions need a clear way to handle changes (SCD types), because the same attribute is copied on many rows. Most teams prefer star and only snowflake very large or shared hierarchies.`,checking:"Whether you understand that schema design follows the workload, not a fixed rule.",related:["normalization","dimensional-modeling","columnar-storage"]},{id:"bt-merge-intervals",companies:["Google","Microsoft"],topic:"python",round:"coding",difficulty:"medium",q:"Given a list of job run windows as (start, end) pairs, merge the overlapping ones so you can report total busy time on a cluster.",a:"Sort the intervals by start time, then walk through them once, extending the last merged interval when the next one overlaps and starting a new one when it does not.\n\n**Why it works:** after sorting, any interval that overlaps the current merged block must start before that block ends. So you only ever compare with the last merged interval. Sorting costs O(n log n) and the scan is O(n).\n\nTotal busy time is then `sum(end - start for start, end in merged)`.\n\n**Gotcha:** use `max(last_end, end)` when merging, because a later interval can be fully inside the current one, like (1, 10) and (2, 3). Also ask whether touching intervals such as (1, 3) and (3, 5) count as overlapping; this code uses `<=`, so they merge.",code:{lang:"python",code:`def merge_intervals(intervals):
    """intervals: list of (start, end) tuples, e.g. job run windows."""
    if not intervals:
        return []
    intervals = sorted(intervals, key=lambda x: x[0])
    merged = [list(intervals[0])]
    for start, end in intervals[1:]:
        last = merged[-1]
        if start <= last[1]:              # overlaps or touches
            last[1] = max(last[1], end)
        else:
            merged.append([start, end])
    return [tuple(m) for m in merged]


print(merge_intervals([(1, 3), (2, 6), (8, 10), (9, 12)]))
# [(1, 6), (8, 12)]`},checking:"Whether you spot that sorting turns the problem into one linear pass and handle nested intervals.",related:["gaps-and-islands"]},{id:"bt-top-k-frequent-heap",companies:["Amazon","Walmart Global Tech"],topic:"python",round:"coding",difficulty:"medium",q:"Given a list of product search terms, return the k most frequent terms. Do better than sorting everything.",a:`Count with a \`Counter\`, then keep a min-heap of size k; the heap holds the k largest counts seen so far.

**Why:** counting is O(n). Pushing each of the m distinct terms into a heap of size k and popping the smallest when it grows past k costs O(m log k), which beats sorting all m terms (O(m log m)) when k is small. \`heapq.nlargest(k, counts.items(), key=...)\` does the same thing in one line, and it is fine to mention it.

**Data-engineering link:** this is the same idea as a Spark job that counts per partition and merges counts, and approximate top-k sketches when data is too big for memory.

**Gotcha:** define tie-breaking. Here tuples compare by count and then by term, so ties are ordered by term. Ask the interviewer if they want ties broken alphabetically or by first appearance.`,code:{lang:"python",code:`import heapq
from collections import Counter


def top_k_terms(terms, k):
    counts = Counter(terms)                  # O(n)
    heap = []                                # min-heap of (count, term)
    for term, cnt in counts.items():
        heapq.heappush(heap, (cnt, term))
        if len(heap) > k:
            heapq.heappop(heap)              # drop the smallest
    return [term for cnt, term in sorted(heap, reverse=True)]


print(top_k_terms(["tv", "phone", "tv", "laptop", "phone", "tv"], 2))
# ['tv', 'phone']`},checking:"Whether you know heaps and can state time complexity and tie behaviour.",related:["top-n-and-dedup"]},{id:"bt-flatten-nested-json",companies:["Walmart Global Tech","Uber"],topic:"python",round:"coding",difficulty:"easy",q:"Write a function that flattens a nested JSON event (dicts and lists) into a single-level dict with dotted keys.",a:`Walk the structure recursively: for a dict, recurse into each value with \`parent.key\`; for a list, recurse with the index; for anything else, store the value under the built key.

**Why recursion:** you do not know how deep the event is, and recursion naturally follows the nesting. Each call returns a flat dict that the caller merges into its own result.

This is a common warm-up because raw app events (trip payloads, order payloads) arrive nested, and analytics tables want flat columns.

**Gotchas:**
- Empty dicts or lists disappear entirely; decide whether to keep them as NULL.
- Very deep payloads can hit Python's recursion limit; an explicit stack avoids that.
- In Spark you would not do this row by row in Python. Use the schema with \`col("trip.rider.city")\` or \`explode\` for arrays, which is far faster than a UDF.`,code:{lang:"python",code:`def flatten(obj, parent_key="", sep="."):
    items = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_key = parent_key + sep + k if parent_key else k
            items.update(flatten(v, new_key, sep))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            items.update(flatten(v, parent_key + sep + str(i), sep))
    else:
        items[parent_key] = obj
    return items


event = {"trip": {"id": 7, "rider": {"city": "BLR"}}, "tags": ["pool", "night"]}
print(flatten(event))
# {'trip.id': 7, 'trip.rider.city': 'BLR', 'tags.0': 'pool', 'tags.1': 'night'}`},checking:"Whether you write clean recursion and know when to use Spark's native nested-column support instead.",related:["semi-structured-json","python-udfs-arrow"]},{id:"bt-moving-average-stream",companies:["Uber","Microsoft"],topic:"python",round:"coding",difficulty:"easy",q:"Implement a class that returns the moving average of the last N values from a stream, for example fares per minute.",a:"Keep the last N values in a `deque` and a running total; on each new value, add it, and if the window is too big, subtract and remove the oldest.\n\n**Why:** recomputing `sum(window)` every time is O(N) per value. With a running total, each update is O(1): one addition and at most one subtraction. `deque.popleft()` is O(1), while `list.pop(0)` is O(N) because it shifts every element.\n\nThis is the same idea as a sliding window in stream processing: keep a small state and update it incrementally instead of rescanning.\n\n**Gotchas:**\n- Before the window is full, divide by the current length, not N.\n- With floats, a running total can drift slightly over millions of updates; recompute occasionally or use `decimal` for money.",code:{lang:"python",code:`from collections import deque


class MovingAverage:
    """Average of the last size values, e.g. trip fares per minute."""

    def __init__(self, size):
        self.size = size
        self.window = deque()
        self.total = 0.0

    def next(self, value):
        self.window.append(value)
        self.total += value
        if len(self.window) > self.size:
            self.total -= self.window.popleft()
        return self.total / len(self.window)


m = MovingAverage(3)
print([m.next(x) for x in [10, 20, 30, 40]])
# [10.0, 15.0, 20.0, 30.0]`},checking:"Whether you pick the right data structure and keep updates O(1).",related:["window-frames","stateful-streaming"]},{id:"bt-design-ad-attribution",companies:["Google","Amazon"],topic:"design",round:"design",difficulty:"hard",q:"Design a pipeline that counts ad impressions and clicks for billing and attributes app installs to the last click within a 7-day window.",a:`Produce two outputs with different contracts from the same raw events: a near real-time approximate count for budget pacing, and a billing-grade count that is deduplicated, filtered for invalid traffic, reproducible and allowed to take hours.

**Requirements:** dedup per \`impression_id\`; invalid traffic removed; last-click attribution within 7 days; any invoice can be recomputed; advertisers see spend within minutes.

**Estimates:** 2 billion impressions a day at about 200 bytes is about 400 GB a day, roughly 23,000 events/s on average; plan for 3x peaks. Clicks are around 1% of impressions.

**Architecture:**
- Ad servers publish to Kafka keyed by \`impression_id\`; raw events land in the lake untouched.
- A stream job dedups within a watermark and updates pacing counters in a key-value store.
- A daily batch dedups again over the full day, joins clicks to impressions and installs to the latest click per device inside 7 days, and writes billing facts with a \`batch_id\`.
- A reconciliation step compares stream and batch totals and alerts on drift.

**Trade-offs:** a Lambda-style split is justified because billing needs restatement; a pure streaming design would need exactly-once sinks and long replays. Late clicks keep attribution open for 7 days, so invoices are finalised only after the window closes.`,code:{lang:"sql",code:`SELECT i.install_id, lc.click_id, lc.campaign_id
FROM installs i
JOIN LATERAL (
  SELECT k.click_id, k.campaign_id
  FROM clicks k
  WHERE k.device_id = i.device_id
    AND k.click_ts <= i.install_ts
    AND k.click_ts >  i.install_ts - INTERVAL '7 days'
  ORDER BY k.click_ts DESC
  LIMIT 1
) lc ON TRUE;`},checking:"Whether you separate fast approximate numbers from auditable billing numbers and handle attribution windows.",related:["case-ad-impressions-attribution","batch-vs-streaming","top-n-and-dedup"]},{id:"bt-design-log-analytics",companies:["Microsoft","Google"],topic:"design",round:"design",difficulty:"hard",q:"Design a platform that ingests application logs from thousands of services, about 1 PB a month, for both fast search during incidents and long-term analytics.",a:`Separate hot search from cheap analytics: buffer logs in Kafka, index only recent data in a search engine for incidents, and store everything as compressed columnar files in object storage for analytics and long retention.

**Requirements:** search the last 7 days within seconds; analytics over 13 months; per-team access control; no log loss during spikes; PII scrubbed before indexing.

**Estimates:** 1 PB a month is about 33 TB a day, about 390 MB/s on average. Logs often compress 5-10x in Parquet, so roughly 4-7 TB a day lands in the lake. Indexing everything for 13 months would be very expensive, so index 7 days, and consider sampling DEBUG.

**Architecture:**
- Agents (Fluent Bit or OpenTelemetry collectors) send to Kafka, which absorbs bursts and outages downstream.
- Consumer 1 indexes into OpenSearch/Elasticsearch hot nodes with 7-day retention.
- Consumer 2 (Spark or Flink) writes Parquet/Iceberg partitioned by date, hour and service to S3 or ADLS; lifecycle rules move old data to cheaper tiers.
- Trino, Athena or Spark for analytics.

**Trade-offs:** promote common fields (timestamp, service, level, trace_id) to columns and keep the rest as a JSON string; sampling versus full fidelity; how long each tier keeps data is mostly a cost decision, so put numbers on it.`,checking:"Whether you tier storage by access pattern and size the system with real numbers.",related:["case-log-analytics","storage-and-serving-layers","back-of-envelope-estimation"]},{id:"bt-design-feature-store",companies:["Uber","Amazon"],topic:"design",round:"design",difficulty:"hard",q:"Design a feature store that serves the same features to models in training and at prediction time, for example a driver's acceptance rate over the last 7 days.",a:`One feature definition, two materialisations: an offline store (lake tables with full history keyed by entity and timestamp) for training, and an online store (low-latency key-value with the latest values) for serving, both written by the same pipelines.

**Requirements:** online reads under 10 ms at p99; point-in-time correct training sets; minutes of freshness for streaming features, daily for batch ones; ownership and lineage per feature.

**Estimates:** 5 million drivers x 200 features x 8 bytes is about 8 GB of latest values, small for Redis, DynamoDB or Cassandra. The offline history is far larger and partitioned by date.

**Architecture:**
- Batch features: daily Spark jobs write the offline table and bulk-load the online store.
- Streaming features: Flink reads Kafka, updates the online store and appends to the offline log.
- Training sets use an as-of join: for each label, the latest feature value with \`feature_ts <= label_ts\`.
- A registry holds definitions, owners and TTLs.

**Trade-offs:** the main risk is online/offline skew from two code paths, so compute once and write to both. Logging the values actually served is the safest training source. TTLs on online values make staleness visible instead of silent.`,code:{lang:"sql",code:`SELECT l.trip_id, l.driver_id, l.label_ts, f.acceptance_rate_7d
FROM labels l
LEFT JOIN LATERAL (
  SELECT x.acceptance_rate_7d
  FROM driver_features x
  WHERE x.driver_id = l.driver_id
    AND x.feature_ts <= l.label_ts       -- no peeking into the future
  ORDER BY x.feature_ts DESC
  LIMIT 1
) f ON TRUE;`},checking:"Whether you understand point-in-time correctness and online/offline consistency.",related:["case-feature-store","case-realtime-eta","storage-and-serving-layers"]},{id:"bt-design-store-inventory",companies:["Walmart Global Tech","Amazon"],topic:"design",round:"design",difficulty:"hard",q:"Design a system that shows near real-time inventory for every product in about 5,000 stores, both to online shoppers and to replenishment analytics.",a:`Treat inventory as state derived from events: stream sales, receipts, returns and adjustments keyed by (store, item), keep the on-hand count in a stateful stream processor that writes to a key-value store for the website, and land every event in the lake for analytics and nightly reconciliation against physical counts.

**Requirements:** website freshness under a minute; never promise stock that is not there; a daily snapshot for analytics; regular correction from cycle counts.

**Estimates:** 5,000 stores x 50,000 items is 250 million keys; at about 50 bytes each that is about 12.5 GB of state, fine for a partitioned state store or DynamoDB. 100 million sales lines a day is about 1,200 events/s on average, with peaks of 10x.

**Architecture:**
- POS and warehouse systems publish events (or CDC) to Kafka keyed by store and item, so updates per key stay ordered.
- Flink keeps the running count with exactly-once checkpoints and upserts changes to DynamoDB or Cassandra.
- The lake gets raw events plus a daily periodic-snapshot fact of on-hand by store and item.
- A nightly job compares computed stock with cycle counts and emits adjustment events.

**Trade-offs:** event-derived counts drift (missed scans, theft), so the resync is essential. Show 'only a few left' below a safety threshold instead of exact numbers.`,checking:"Whether you can model inventory as event-derived state and plan for drift and reconciliation.",related:["stateful-streaming","fact-table-types","kafka-partitions-ordering","storage-and-serving-layers"]},{id:"bt-design-deletion-requests",companies:["Google","Microsoft"],topic:"design",round:"design",difficulty:"hard",q:"Design how a company honours user deletion requests (GDPR or India's DPDP Act) across the data lake, warehouse, ML features and backups within its deletion SLA.",a:`Drive deletion from a central request log: find every dataset that holds the user's data through catalog tags, delete or anonymise by user key in each store with an auditable job, and let backups age out within a documented retention window.

**Requirements:** meet the policy SLA (for example 30 days); proof of deletion per system; no re-ingestion of deleted users; acceptable rewrite cost.

**Estimates:** 10,000 requests a day against 500 TB of tables. Rewriting files every day for a handful of users is wasteful, so batch requests weekly and use table formats that rewrite only the affected files.

**Architecture:**
- A request service writes to \`deletion_requests\`; the catalog tags PII columns and user-key columns per table.
- A weekly job per table runs DELETE by user key on Delta or Iceberg (deletion vectors or merge-on-read keep it cheap), then vacuums or expires snapshots so old files really disappear.
- Warehouse DELETE, feature store delete by key, tombstones on compacted Kafka topics.
- A suppression list stops deleted users coming back from replays.

**Trade-offs:** crypto-shredding (per-user keys, delete the key) versus physical deletes; pseudonymising at ingestion means most analytics tables hold no direct identifiers at all, which shrinks the problem.`,code:{lang:"sql",code:`DELETE FROM lake.silver.events
WHERE user_id IN (SELECT user_id
                  FROM privacy.deletion_requests
                  WHERE batch_id = '2026-W47');

-- time travel still holds the old files until they are removed
VACUUM lake.silver.events RETAIN 168 HOURS;`},checking:"Whether you think about every copy of the data, including time travel, Kafka and backups, and about proof.",related:["case-gdpr-deletion","delta-lake-iceberg","kafka-retention-compaction"]},{id:"bt-design-warehouse-migration",companies:["Walmart Global Tech","Microsoft"],topic:"design",round:"design",difficulty:"hard",q:"How would you migrate a 300 TB on-prem Teradata warehouse with 4,000 ETL jobs to the cloud without disrupting reporting?",a:`Migrate incrementally by subject area with a parallel run: copy history once, replicate changes continuously, rebuild the ETL on the new platform, and switch each set of consumers only after automated reconciliation proves the numbers match.

**Requirements:** no reporting downtime; identical numbers at cutover; a decommission date for the old system; a cost target.

**Estimates:** 300 TB over a dedicated 10 Gbps link is about 2.8 days at full speed, realistically one to two weeks; offline transfer devices are the alternative. For 4,000 jobs, build the inventory and lineage first: query logs usually show many jobs and tables nobody reads.

**Plan:**
- Inventory from query and job logs, grouped into waves by subject area.
- Target: lakehouse or a cloud warehouse (Redshift, Snowflake, BigQuery, Synapse).
- History by bulk export to object storage; ongoing changes by CDC until cutover.
- Convert SQL with tooling plus manual review; orchestrate in Airflow.
- Reconciliation framework: counts, sums and hashes per table per day, old versus new, during the parallel run.
- A rollback plan for each wave.

**Trade-offs:** lift-and-shift is fast but carries the debt over; re-architecting is better but slower. Phased migration costs double running for a while but limits blast radius compared with a big bang.`,checking:"Whether you plan a migration around risk, validation and rollback rather than just tools.",related:["case-warehouse-migration","aws-dms-cdc","data-quality-and-slas"]},{id:"bt-beh-customer-obsession",companies:["Amazon"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"Tell me about a time you went beyond the stated requirement to solve a real problem for your data consumers. (Customer Obsession)",a:`Your customer can be an internal team. Show that you started from their real need, not the ticket, and measured the outcome. A model STAR answer:

- **Situation:** analysts on the pricing team waited about two days for each ad-hoc extract of competitor price history, and I was asked to automate the CSV extract.
- **Task:** the ticket only asked for automation, but I noticed every analyst repeated the same cleaning steps after receiving the file.
- **Action:** I sat with two analysts for an afternoon and listed the six questions they asked most. I built a curated daily table with the cleaning applied, a saved view for each common question, and documented columns and freshness in the catalog.
- **Result:** extract tickets dropped from about 15 a week to 2, answers took minutes instead of days, and the table later became the source for the pricing dashboard.

**Tip:** prepare two stories per Leadership Principle. Follow-ups dig deep ('what data told you that?', 'what would you do differently?'), so real details matter more than polish.`,checking:"Whether you start from the customer's actual problem and can show measurable impact.",related:["semantic-layer-metrics","etl-elt-medallion"]},{id:"bt-beh-ownership",companies:["Amazon","Microsoft"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"Tell me about a time you took ownership of a problem that was not strictly yours. (Ownership)",a:`Show that you acted beyond your scope while respecting the real owners, and that you fixed the cause, not just your symptom. A model STAR answer:

- **Situation:** a shared events table owned by another team started landing about three hours late several times a week, breaking my team's 8 AM SLA and two other teams' reports.
- **Task:** it was not my table, and the owning team was busy with a launch, but our consumers were the ones hurt.
- **Action:** I pulled the run history from Airflow and found the delays came from one skewed join on a default 'unknown' device_id after a client release. I wrote a fix (filter the default key and handle it separately), tested it on a copy of the data, raised it as a pull request to their repo and walked their on-call through it. I also added a freshness alert on the table that all consumers subscribe to.
- **Result:** runtime went from about 3 h 40 min to 50 minutes, there were no SLA misses for the next two months, and the owning team adopted the alert pattern for their other tables.`,checking:"Whether you act like an owner across team boundaries and leave a lasting fix.",related:["data-skew","airflow-sla-monitoring"]},{id:"bt-beh-dive-deep-metric",companies:["Amazon","Google"],topic:"behavioural",round:"managerial",difficulty:"hard",q:"Tell me about a time a metric looked wrong and you had to dig into the data to find out why. (Dive Deep)",a:`Show that you decompose the metric, compare raw and processed data, quantify the gap and leave a permanent guard. A model STAR answer:

- **Situation:** weekly active sellers dropped 8% overnight on a leadership dashboard, and product believed a feature launch had hurt sellers.
- **Task:** I owned the metric pipeline and had to say whether the drop was real before the leadership review the next day.
- **Action:** I split the metric by platform, region and seller type: the whole drop was on Android, starting the day of an app release. Comparing raw events with the processed table showed the new app version sent seller_id with leading zeros, which failed the join to the seller dimension, so an inner join silently dropped those events. I fixed the parsing, backfilled three days with partition overwrite, and added a check that alerts when unmatched dimension keys exceed 0.5%.
- **Result:** the metric was restored before the review, the launch was not wrongly rolled back, and the same check later caught a similar issue in another event stream.`,checking:"Whether you investigate with data at the right level of detail instead of guessing.",related:["data-quality-tests","idempotency-and-backfills","joins"]},{id:"bt-beh-disagree-and-commit",companies:["Amazon","Uber"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"Tell me about a time you strongly disagreed with a decision. What did you do, and what happened? (Have Backbone; Disagree and Commit)",a:`Show that you disagreed respectfully with evidence, proposed an option, and then committed fully once the decision was made. A model STAR answer:

- **Situation:** to hit a deadline, my manager decided to load clickstream straight into the warehouse with no raw layer.
- **Task:** I believed that without raw data we could not reprocess when parsing bugs appeared, and our last two parsing bugs had each needed more than ten days of replay.
- **Action:** I raised it in the design review with those two incidents as evidence and a cheap compromise: also write raw events to S3 with a lifecycle rule to a cheaper tier after 30 days, about two days of extra work. My manager kept the deadline and the direct load but accepted the raw copy. I committed to the plan and built the deadline-critical part first.
- **Result:** we shipped on time. A month later a timezone bug was fixed by replaying two weeks of raw events in a few hours, instead of asking the source team to resend data.

**Tip:** it is fine if your view lost in the real story; show how you committed and what you learned.`,checking:"Whether you can challenge decisions with data and still commit as a team player.",related:["etl-elt-medallion","timezone-day-boundary"]},{id:"bt-beh-frugality-cost",companies:["Amazon","Walmart Global Tech"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"Tell me about a time you reduced the cost of a data platform or achieved more with fewer resources. (Frugality)",a:`Show that you found the cost drivers by measurement, fixed the biggest ones, and kept or improved quality. A model STAR answer:

- **Situation:** the monthly bill of our analytics platform grew 60% in six months, mostly Athena scans and an always-on EMR cluster.
- **Task:** my lead asked me to cut it by 30% without slowing any reports.
- **Action:** I enforced cost allocation tags and ranked spend by job in Cost Explorer. Three dashboards were scanning raw JSON every 15 minutes, and the EMR cluster sat idle about 16 hours a day. I converted the raw tables to partitioned Parquet, pointed the dashboards at a small daily aggregate, moved batch jobs to transient clusters with Spot task nodes, and set an Athena workgroup scan limit.
- **Result:** monthly cost fell about 45%, the dashboards got faster (about 40 seconds to 3 seconds), and the scan limit later stopped a runaway query before it cost anything.

**Tip:** quote before and after numbers, and mention what you chose not to cut.`,checking:"Whether you treat cost as an engineering problem solved by measurement, without hurting customers.",related:["aws-cost-monitoring","aws-athena","warehouse-full-scan-bill"]},{id:"bt-beh-learning-from-mistake",companies:["Microsoft","Google"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"Tell me about a mistake you made in production and what you learned from it.",a:`Show honesty, fast mitigation, a systemic fix and a change in how you work (Microsoft often frames this as growth mindset). A model STAR answer:

- **Situation:** I deployed a change to a daily Spark job that renamed an output column, after testing it only on sample data.
- **Task:** two downstream dashboards depended on the old name, and I had not checked lineage before the change.
- **Action:** when the alerts fired the next morning, I said in the incident channel that my change caused it, rolled back within 30 minutes and reran the job (it overwrites its partition, so the rerun was safe), and informed both dashboard owners. Then I added a contract test in CI that compares the output schema with a checked-in version and requires a version bump for breaking changes, and I began announcing schema changes a week ahead.
- **Result:** the dashboards were correct by 10 AM, and no breaking schema change has reached production since.

**Tip:** pick a real mistake with real impact. 'I work too hard' answers lose trust immediately.`,checking:"Whether you take responsibility openly and turn mistakes into process improvements.",related:["data-quality-and-slas","airflow-testing-ci"]},{id:"bt-aws-kinesis-shard-sizing",companies:["Amazon"],topic:"aws",round:"technical",difficulty:"medium",q:"Your app produces 8 MB/s of events at peak (about 6,000 records/s) into Kinesis Data Streams, read by 3 consumer applications. How many shards do you need, and what problems do you expect?",a:`Size by the tightest limit. Writes need ceil(8 MB/s / 1 MB/s) = 8 shards (records need only 6), so provision about 10-12 for headroom. Reads are the real constraint: 3 standard consumers sharing 2 MB/s per shard need 24 MB/s, which 8 shards (16 MB/s) cannot supply, so use enhanced fan-out (2 MB/s per consumer per shard) or more shards.

**Problems to expect:**
- **Hot shards:** a skewed partition key throws \`ProvisionedThroughputExceededException\` on one shard even when total capacity is fine. Use a high-cardinality key such as user_id.
- **Partial failures:** \`PutRecords\` can succeed for some records and fail for others; retry only the failed ones with backoff.
- **Read limits:** standard consumers also share 5 GetRecords calls per second per shard, so adding consumers adds latency.
- **Resharding:** splits and merges keep order per key only if consumers finish parent shards first (the KCL handles this).

**On-demand mode** removes manual sizing and adapts to traffic, usually at a higher price than well-sized provisioned capacity for steady load.`,code:{lang:"python",code:`import json
import boto3

kinesis = boto3.client("kinesis", region_name="ap-south-1")

def send(batch: list[dict]) -> list[dict]:
    resp = kinesis.put_records(
        StreamName="app-events",
        Records=[{"Data": json.dumps(e).encode(),
                  "PartitionKey": e["user_id"]} for e in batch],   # up to 500 per call
    )
    # partial failures are normal: return only the failed events for retry with backoff
    return [e for e, r in zip(batch, resp["Records"]) if "ErrorCode" in r]`},checking:"Whether you can do shard math for both writes and reads and know the operational traps.",related:["aws-kinesis-firehose","aws-msk-vs-kinesis","back-of-envelope-estimation"]},{id:"bt-aws-redshift-slow-join",companies:["Amazon","Walmart Global Tech"],topic:"aws",round:"technical",difficulty:"hard",q:"A Redshift query joining a 5-billion-row sales fact to a 50-million-row customer dimension has become slow. How do you diagnose it, and which distribution and sort keys would you choose?",a:"Look at EXPLAIN for data movement (`DS_BCAST_INNER` or `DS_DIST_BOTH`) and at table skew, stale stats and disk spill; then co-locate the join by distributing both tables on `customer_id` and sort the fact on the date column used in filters.\n\n**Why:** a join runs locally on each slice only when matching keys live on the same slice (`DS_DIST_NONE`). Otherwise Redshift ships rows across the network on every run. A 50-million-row dimension is too big for DISTSTYLE ALL.\n\n**Checks:**\n- `svv_table_info`: `skew_rows` (a 'guest' customer_id can make KEY distribution create a hot slice), `unsorted` and `stats_off`.\n- Run ANALYZE if stats are stale; automatic vacuum usually handles sorting, but check.\n- `SVL_QUERY_SUMMARY` shows steps that spilled to disk (`is_diskbased`).\n- WLM queue wait time: the query may be waiting, not slow.\n- With AUTO distribution, check what Redshift actually picked.\n\n**If the key is badly skewed,** keep the fact EVEN and accept a redistribution, or handle the hot key separately.",code:{lang:"sql",code:`EXPLAIN
SELECT c.segment, SUM(s.amount)
FROM sales s
JOIN customer c ON s.customer_id = c.customer_id
WHERE s.sale_date >= '2026-10-01'
GROUP BY c.segment;    -- want DS_DIST_NONE, not DS_BCAST_INNER / DS_DIST_BOTH

SELECT "table", diststyle, skew_rows, unsorted, stats_off
FROM svv_table_info
WHERE "table" IN ('sales', 'customer');

ALTER TABLE sales    ALTER DISTKEY customer_id;
ALTER TABLE customer ALTER DISTKEY customer_id;
ALTER TABLE sales    ALTER SORTKEY (sale_date);`},checking:"Whether you can read Redshift plans and pick distribution and sort keys from the workload.",related:["redshift-internals","aws-redshift","join-algorithms"]},{id:"bt-aws-s3-slowdown-errors",companies:["Amazon"],topic:"aws",round:"technical",difficulty:"medium",q:"A Spark job writing to S3 gets intermittent '503 Slow Down' errors and produces many small files. What causes this and how do you fix it?",a:`S3 throttles requests per prefix (at least 3,500 writes and 5,500 reads per second per partitioned prefix), and a job with thousands of tasks each writing many tiny files bursts past that. Write fewer, larger files, spread load across prefixes, and keep client retries with backoff on.

**Details:**
- S3 scales prefixes up automatically over time, so a burst against a brand-new prefix throttles more than steady load.
- Repartition before writing so each task produces files of roughly 128 MB to 1 GB; avoid \`partitionBy\` on a high-cardinality column, which makes every task write to thousands of folders.
- Iceberg's object storage layout hashes file paths across prefixes for very high write rates.
- Raise the S3A or EMRFS retry limits rather than failing the job on the first 503.
- Small files also cost money: S3 charges per request, and every later read pays for millions of GETs.

**Not the cause:** S3 has had strong read-after-write consistency since December 2020, so 'eventual consistency' no longer explains missing files.`,code:{lang:"python",code:`(df.repartition("dt")                              # one writer per day...
   .sortWithinPartitions("customer_id")
   .write
   .option("maxRecordsPerFile", 5_000_000)          # ...split into bounded files
   .partitionBy("dt")
   .mode("overwrite")
   .parquet("s3://lake/silver/orders/"))`},checking:"Whether you understand S3 request scaling and how Spark write patterns cause throttling.",related:["aws-s3-data-lake","small-files-compaction","small-files-slow-read"]},{id:"bt-kafka-leader-failure-isr",companies:["Uber","Microsoft"],topic:"kafka",round:"technical",difficulty:"hard",q:"What happens in Kafka when the leader broker of a partition dies? Explain ISR and the high watermark, and how data can still be lost.",a:"The controller elects a new leader from the in-sync replicas (ISR). Consumers only ever saw records below the high watermark, so writes acknowledged with `acks=all` survive, while records that existed only on the old leader are truncated.\n\n**Concepts:**\n- **ISR:** replicas that have caught up with the leader within `replica.lag.time.max.ms` (30 seconds by default).\n- **High watermark:** the offset up to which every ISR member has the data; consumers can read only below it.\n- **Controller:** in KRaft mode a quorum of controllers manages metadata and elections. ZooKeeper mode is removed in Kafka 4.0.\n\n**How data is lost anyway:**\n- `acks=1`: the leader acknowledged before any follower copied the record.\n- `min.insync.replicas=1`: the ISR shrinks to just the leader, so 'all' means one copy.\n- `unclean.leader.election.enable=true`: an out-of-sync replica becomes leader and acknowledged data disappears.\n\n**Trade-off:** with RF 3 and `min.insync.replicas=2`, losing two brokers makes writes fail. That is availability traded for durability on purpose. At large scale also spread replicas across availability zones with rack awareness.",checking:"Whether you understand Kafka's replication protocol well enough to reason about durability.",related:["kafka-replication-isr","kafka-fundamentals"]},{id:"bt-kafka-hot-partition",companies:["Uber","Walmart Global Tech"],topic:"kafka",round:"technical",difficulty:"medium",q:"You key ride events by city_id, and one partition (Bengaluru) is overloaded while others sit idle. How do you fix it without losing the ordering you need?",a:"Key at the granularity where ordering is actually needed, usually `trip_id` or `driver_id`, not `city_id`. City-level aggregation happens downstream anyway, and a high-cardinality key spreads load evenly.\n\n**If per-city order is truly required** (rare), split the hot key: use `city_id + bucket` where the bucket is a hash of driver_id modulo 8. Order holds per sub-key, and consumers that need a city view merge buckets by event time.\n\n**Things that do not help:**\n- Adding partitions: one key always maps to one partition, and adding partitions remaps existing keys.\n- The sticky partitioner: it only applies to records with no key.\n\n**How to confirm:** per-partition bytes-in on the brokers and consumer lag per partition. A single partition with high lag while others are near zero is the signature of a hot key.",code:{lang:"python",code:`import zlib

def partition_key(event: dict) -> bytes:
    # consumers need per-trip order; city is just an attribute
    return event["trip_id"].encode()

def salted_city_key(event: dict, buckets: int = 8) -> bytes:
    # only if per-city order is mandatory: spread a hot city over buckets
    bucket = zlib.crc32(event["driver_id"].encode()) % buckets
    return f"{event['city_id']}#{bucket}".encode()`},checking:"Whether you choose keys by ordering needs and know why more partitions do not fix a hot key.",related:["kafka-partitions-ordering","data-skew"]},{id:"bt-airflow-vs-step-functions",companies:["Amazon"],topic:"airflow",round:"technical",difficulty:"medium",q:"On AWS, when would you orchestrate pipelines with Step Functions instead of Airflow on MWAA?",a:`Use Step Functions for event-driven, AWS-native workflows with a modest number of steps and no idle cost; use Airflow when you run many scheduled DAGs that rely on data intervals, backfills and cross-system dependencies, and the team wants pipelines defined in Python.

**Compare:**
- **Scheduling model:** Airflow is built around schedules, data intervals, catchup and backfill. Step Functions runs when triggered (an EventBridge schedule or event) and has no backfill concept; you loop over dates yourself.
- **Integrations:** Step Functions calls Glue, EMR, Lambda, Athena and the Redshift Data API directly and can wait for completion with \`.sync\`. Airflow has providers for AWS and for many non-AWS systems.
- **Cost and ops:** Step Functions is serverless and Standard workflows are billed per state transition; MWAA has an environment cost even when idle.
- **Visibility:** Airflow's grid view of runs per date suits data teams doing reruns.

**Common pattern:** Airflow for the daily batch platform, and Step Functions or Lambda for event-driven ingestion started by S3 events.`,checking:"Whether you pick an orchestrator from the workload's scheduling model, not from habit.",related:["airflow-vs-alternatives","aws-step-functions-mwaa-eventbridge"]}]},s=Object.freeze(Object.defineProperty({__proto__:null,default:t},Symbol.toStringTag,{value:"Module"})),a={id:"product",title:"Product companies & startups",blurb:"Data engineering questions often reported at Indian product companies and startups, where SQL depth, Spark tuning and real business scenarios (orders, payments, deliveries) carry most of the loop.",companies:[{name:"Flipkart",process:"The loop usually starts with a recruiter or online screen, followed by two or three technical rounds covering SQL, Spark and big data concepts, and often some problem solving. Candidates often report a design or project deep-dive round for senior roles and a hiring manager round at the end.",focus:["SQL window functions","Spark optimization and skew","large-scale pipeline design","project deep-dives"],experience:"2-10 yrs"},{name:"Swiggy",process:"Candidates usually report a SQL-heavy first technical round, then rounds on Spark, data modeling and scenario questions built around orders and deliveries. A hiring manager or culture round usually closes the loop.",focus:["SQL on orders and delivery data","Spark internals","streaming and late data","data modeling"],experience:"2-8 yrs"},{name:"Zomato",process:"The process is often reported to include a SQL and Python screen, sometimes a take-home or live exercise, then technical rounds on pipelines and Spark. It usually ends with a discussion with the hiring manager about past projects.",focus:["SQL analytics queries","Python data handling","pipeline scenarios","metrics definitions"],experience:"1-7 yrs"},{name:"PhonePe",process:"Candidates often report a coding round with data structures questions even for data engineering roles, followed by SQL and Spark rounds. Senior candidates usually get a design round on high-volume transaction pipelines, then a hiring manager round.",focus:["DSA-style coding","SQL on transactions","Spark performance","exactly-once and dedup"],experience:"2-10 yrs"},{name:"Paytm",process:"The loop usually has two or three technical rounds that mix SQL, Spark, Hive and Kafka fundamentals, with questions drawn from your resume. A managerial or HR round usually follows.",focus:["SQL fundamentals","Spark and Hive basics","Kafka ingestion","resume-based questions"],experience:"1-8 yrs"},{name:"Meesho",process:"Candidates often report a SQL and problem-solving screen, then technical rounds on Spark and data platform work, and a design round for experienced hires. A hiring manager round usually closes it.",focus:["SQL on e-commerce data","Spark tuning","lakehouse and file layout","pipeline design"],experience:"2-8 yrs"},{name:"CRED",process:"The bar is often reported to be high, with technical rounds on SQL and Spark, a strong design or architecture discussion, and a culture-fit conversation. Rounds usually go deep on trade-offs rather than definitions.",focus:["design trade-offs","SQL for retention and engagement","Spark internals","ownership and culture fit"],experience:"3-10 yrs"},{name:"Razorpay",process:"Candidates usually report SQL and data modeling rounds framed around payments and merchants, plus a pipeline design discussion. Some candidates report a hands-on coding exercise and a final hiring manager round.",focus:["payments data modeling","SCD and CDC","SQL correctness","idempotent pipelines"],experience:"2-8 yrs"}],questions:[{id:"pr-second-highest-salary-per-dept",companies:["Flipkart","Paytm"],topic:"sql",round:"technical",difficulty:"easy",q:"Find the employee(s) with the second-highest salary in each department.",a:'Rank salaries inside each department with `DENSE_RANK()` and keep rank 2.\n\n**Why:** `PARTITION BY department_id` restarts the ranking for every department, and `ORDER BY salary DESC` puts the top salary at rank 1. `DENSE_RANK` gives equal salaries the same rank without leaving gaps, so if two people tie for first, the next salary is still rank 2. With `ROW_NUMBER` a tie at the top would wrongly make one of the top earners "second".\n\n**Gotcha:** a department with only one distinct salary returns no row at all. If the interviewer wants one row per department with NULL for "no second salary", start from the departments table and `LEFT JOIN` the ranked result. Also exclude NULL salaries, because they sort first in descending order in PostgreSQL.',code:{lang:"sql",code:`WITH ranked AS (
  SELECT department_id, employee_id, salary,
         DENSE_RANK() OVER (PARTITION BY department_id
                            ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE salary IS NOT NULL
)
SELECT department_id, employee_id, salary
FROM ranked
WHERE rnk = 2;`},checking:"Whether you know the difference between ROW_NUMBER, RANK and DENSE_RANK and think about ties.",related:["window-functions","top-n-and-dedup"]},{id:"pr-consecutive-order-days",companies:["Swiggy","Zomato"],topic:"sql",round:"coding",difficulty:"medium",q:"Given an orders table for a food-delivery app, find users who ordered on at least 3 consecutive days.",a:`Use the gaps-and-islands trick: subtract a row number from each distinct order date, and dates in the same streak get the same "island" value.

**Why:** if a user orders on Jan 1, 2, 3 their row numbers are 1, 2, 3, so date minus row number is the same date for all three. A missing day breaks the pattern and starts a new island. Group by user and island, then keep groups with 3 or more days.

**Gotcha:** take \`DISTINCT\` dates first. Two orders on the same day would get different row numbers and split the streak. Also convert timestamps to dates in the business time zone (IST), or late-night orders land on the wrong day.`,code:{lang:"sql",code:`WITH days AS (
  SELECT DISTINCT user_id, CAST(order_ts AS DATE) AS d
  FROM orders
),
grp AS (
  SELECT user_id, d,
         d - CAST(ROW_NUMBER() OVER (PARTITION BY user_id
                                     ORDER BY d) AS INT) AS island
  FROM days
)
SELECT user_id, MIN(d) AS streak_start, MAX(d) AS streak_end,
       COUNT(*) AS streak_days
FROM grp
GROUP BY user_id, island
HAVING COUNT(*) >= 3;`},checking:"Whether you can recognise a gaps-and-islands problem and handle duplicate dates.",related:["gaps-and-islands","window-functions","timezone-day-boundary"]},{id:"pr-month-over-month-gmv",companies:["Flipkart","Meesho"],topic:"sql",round:"technical",difficulty:"medium",q:"Compute month-over-month GMV growth (in %) from an orders table.",a:"Aggregate GMV per month first, then use `LAG()` to bring the previous month's value onto the same row and compute the percentage change.\n\n**Why:** window functions run after `GROUP BY`, so you first collapse orders to one row per month, then `LAG(gmv) OVER (ORDER BY month)` looks one row back. `NULLIF(prev, 0)` avoids a divide-by-zero error, and the first month naturally gets NULL growth.\n\n**Gotcha:** if a month has no orders at all, it has no row, so `LAG` silently compares with two months earlier. For sparse data, build a month calendar with `generate_series` and `LEFT JOIN` onto it. Also agree on what GMV means: usually delivered orders only, not cancelled ones.",code:{lang:"sql",code:`WITH monthly AS (
  SELECT DATE_TRUNC('month', order_ts) AS month,
         SUM(amount) AS gmv
  FROM orders
  WHERE status = 'DELIVERED'
  GROUP BY DATE_TRUNC('month', order_ts)
)
SELECT month, gmv,
       LAG(gmv) OVER (ORDER BY month) AS prev_gmv,
       100.0 * (gmv - LAG(gmv) OVER (ORDER BY month))
         / NULLIF(LAG(gmv) OVER (ORDER BY month), 0) AS mom_growth_pct
FROM monthly
ORDER BY month;`},checking:"Whether you can combine aggregation with LAG and handle the first month and division by zero.",related:["window-functions","logical-query-order"]},{id:"pr-top-3-dishes-per-city",companies:["Zomato","Swiggy"],topic:"sql",round:"coding",difficulty:"medium",q:"Find the top 3 most-ordered dishes in each city.",a:"Count orders per city and dish, rank them within each city with a window function, and keep ranks 1 to 3.\n\n**Why:** this is the classic top-N-per-group pattern. You cannot use `LIMIT 3` because that limits the whole result, not each city. `PARTITION BY city` gives each city its own ranking.\n\nPick the ranking function on purpose:\n- `ROW_NUMBER`: exactly 3 rows per city, ties broken arbitrarily.\n- `RANK` / `DENSE_RANK`: keeps all tied dishes, so you may get more than 3.\n\n**Gotcha:** count `DISTINCT order_id`, not item rows. If one order has the same dish on two lines, a plain `COUNT(*)` double counts it. Say which tie rule you chose out loud.",code:{lang:"sql",code:`WITH dish_counts AS (
  SELECT r.city, oi.dish_id,
         COUNT(DISTINCT oi.order_id) AS orders_cnt
  FROM order_items oi
  JOIN orders o      ON o.order_id = oi.order_id
  JOIN restaurants r ON r.restaurant_id = o.restaurant_id
  GROUP BY r.city, oi.dish_id
),
ranked AS (
  SELECT city, dish_id, orders_cnt,
         DENSE_RANK() OVER (PARTITION BY city
                            ORDER BY orders_cnt DESC) AS rnk
  FROM dish_counts
)
SELECT city, dish_id, orders_cnt
FROM ranked
WHERE rnk <= 3
ORDER BY city, rnk;`},checking:"Whether you know the top-N-per-group pattern and make a deliberate choice about ties.",related:["top-n-and-dedup","window-functions"]},{id:"pr-running-wallet-balance",companies:["PhonePe","Paytm"],topic:"sql",round:"technical",difficulty:"easy",q:"Given wallet transactions (credits and debits), show the running balance for each user after every transaction.",a:"Turn debits into negative amounts and take a cumulative `SUM()` over each user's transactions ordered by time.\n\n**Why:** `SUM(...) OVER (PARTITION BY user_id ORDER BY txn_ts ...)` adds up every earlier row plus the current one, which is exactly a running balance. The `CASE` expression gives credits a plus sign and debits a minus sign.\n\n**Gotcha:** when you write `ORDER BY` in a window without a frame, the default frame is `RANGE ... CURRENT ROW`, which treats rows with the same timestamp as peers. Two transactions at the same second would both show the combined balance. Write `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` and add a unique tie-breaker such as `txn_id` so the order is deterministic.",code:{lang:"sql",code:`SELECT user_id, txn_id, txn_ts, txn_type, amount,
       SUM(CASE WHEN txn_type = 'CREDIT' THEN amount ELSE -amount END)
         OVER (PARTITION BY user_id
               ORDER BY txn_ts, txn_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
         AS running_balance
FROM wallet_txns
ORDER BY user_id, txn_ts, txn_id;`},checking:"Whether you understand window frames and the ROWS vs RANGE difference with ties.",related:["window-frames","window-functions"]},{id:"pr-dedup-latest-payment-status",companies:["Razorpay","PhonePe"],topic:"sql",round:"coding",difficulty:"medium",q:"A payment_events table has many status updates per payment (created, authorized, captured, refunded) and some exact duplicates. Return only the latest event per payment.",a:'Number the rows per `payment_id` with `ROW_NUMBER()`, newest first, and keep row 1.\n\n**Why:** `ROW_NUMBER` always gives exactly one row number 1 per partition, even with duplicates, so it removes both the older statuses and the exact copies in one pass. In PostgreSQL, `DISTINCT ON (payment_id)` is a shorter alternative, but the window version works on every engine, including Spark SQL.\n\n**Gotcha:** two things break this in practice:\n- Ties on `updated_at`: add a tie-breaker like `event_id` so reruns give the same answer.\n- NULL timestamps: PostgreSQL sorts NULLs **first** in `DESC` order, so a broken row would "win". Use `NULLS LAST`.',code:{lang:"sql",code:`WITH ranked AS (
  SELECT pe.*,
         ROW_NUMBER() OVER (
           PARTITION BY payment_id
           ORDER BY updated_at DESC NULLS LAST, event_id DESC
         ) AS rn
  FROM payment_events pe
)
SELECT *
FROM ranked
WHERE rn = 1;`},checking:"Whether you can deduplicate deterministically and know how NULLs sort.",related:["top-n-and-dedup","null-semantics"]},{id:"pr-sessionize-clickstream",companies:["Flipkart","Meesho"],topic:"sql",round:"coding",difficulty:"hard",q:"Given app clickstream events (user_id, event_ts), split them into sessions where a gap of more than 30 minutes starts a new session. Return each session with start, end and event count.",a:'Flag each event that starts a new session using `LAG()`, then take a running sum of the flags to number the sessions.\n\n**Why:** step by step:\n- `LAG(event_ts)` gives the previous event time for the same user.\n- If there is no previous event, or the gap is over 30 minutes, the flag is 1, otherwise 0.\n- A cumulative `SUM` of the flags gives 1, 1, 1, 2, 2... which is the session number.\n- Group by user and session number for start, end and count.\n\n**Gotcha:** the flag needs the "first event" case (`LAG IS NULL`), otherwise the first session has number 0 and an off-by-one creeps into counts. Also sort with a tie-breaker if events can share the same timestamp.',code:{lang:"sql",code:`WITH flagged AS (
  SELECT user_id, event_ts,
         CASE WHEN LAG(event_ts) OVER w IS NULL
                OR event_ts - LAG(event_ts) OVER w > INTERVAL '30 minutes'
              THEN 1 ELSE 0 END AS new_session
  FROM clickstream
  WINDOW w AS (PARTITION BY user_id ORDER BY event_ts)
),
numbered AS (
  SELECT user_id, event_ts,
         SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_ts
                                ROWS UNBOUNDED PRECEDING) AS session_no
  FROM flagged
)
SELECT user_id, session_no,
       MIN(event_ts) AS session_start, MAX(event_ts) AS session_end,
       COUNT(*) AS events
FROM numbered
GROUP BY user_id, session_no;`},checking:"Whether you can chain window functions (LAG then running SUM) to build groups that do not exist in the data.",related:["sessionization","window-functions","design-streaming-sessionization"]},{id:"pr-earn-more-than-manager",companies:["Paytm","Flipkart"],topic:"sql",round:"online test",difficulty:"easy",q:"From an employees table with a manager_id column, list employees who earn more than their manager.",a:'Join the employees table to itself: one copy as the employee, one as the manager, and compare salaries.\n\n**Why:** the manager is just another row in the same table, so a self-join on `e.manager_id = m.employee_id` puts each employee next to their manager. After that, a simple `WHERE e.salary > m.salary` filters the result.\n\n**Gotcha:** an inner join drops employees with no manager (the CEO, `manager_id` is NULL). That is correct here, but if the question changes to "list everyone with their manager\'s name", you need a `LEFT JOIN`. Use clear aliases, since mixing up `e` and `m` is the most common mistake in this question.',code:{lang:"sql",code:`SELECT e.name   AS employee,
       e.salary AS employee_salary,
       m.name   AS manager,
       m.salary AS manager_salary
FROM employees e
JOIN employees m ON e.manager_id = m.employee_id
WHERE e.salary > m.salary;`},checking:"Whether you are comfortable with self-joins and how inner joins treat NULL keys.",related:["joins","null-semantics"]},{id:"pr-find-missing-invoice-numbers",companies:["Razorpay","Paytm"],topic:"sql",round:"coding",difficulty:"medium",q:"Invoice numbers for settlements should be continuous. Find every gap (missing range) in the sequence.",a:"Use `LEAD()` to look at the next invoice number; wherever the next number is more than current + 1, the numbers in between are missing.\n\n**Why:** after sorting, each row knows its successor. If invoice 105 is followed by 109, the gap is 106 to 108. This reports ranges instead of single rows, which is far cheaper than generating every possible number.\n\n**Gotcha:** this only finds gaps **between** existing numbers. Missing numbers before the first invoice or after the last one need an explicit start and end (for example a `generate_series` from the expected first number). If there are duplicate invoice numbers, the difference can be 0, which the `> 1` filter correctly ignores, but it is worth flagging as its own data quality issue.",code:{lang:"sql",code:`SELECT invoice_no + 1 AS gap_start,
       next_no - 1    AS gap_end
FROM (
  SELECT invoice_no,
         LEAD(invoice_no) OVER (ORDER BY invoice_no) AS next_no
  FROM settlements
) t
WHERE next_no - invoice_no > 1
ORDER BY gap_start;`},checking:"Whether you can use LEAD to detect gaps without brute-force generation.",related:["gaps-and-islands","data-quality-tests"]},{id:"pr-pivot-payment-methods",companies:["Razorpay","PhonePe"],topic:"sql",round:"technical",difficulty:"medium",q:"Show, per merchant per day, the successful amount by payment method (UPI, card, netbanking) as separate columns, plus the count of failed payments.",a:'Pivot with conditional aggregation: one `SUM(CASE WHEN ... THEN amount ELSE 0 END)` per method, grouped by merchant and day.\n\n**Why:** standard SQL has no portable `PIVOT` keyword, but `CASE` inside an aggregate works everywhere. Each `CASE` keeps only the rows for its column and the `SUM` adds them up. PostgreSQL\'s `FILTER (WHERE ...)` clause is a cleaner way to write the same thing.\n\n**Gotcha:** the columns are hard-coded. A new method like "wallet" silently falls out of every column, so add an "other" bucket or a total column to reconcile. Also use `ELSE 0` so a merchant with no UPI payments shows 0 instead of NULL.',code:{lang:"sql",code:`SELECT merchant_id,
       CAST(created_at AS DATE) AS txn_date,
       SUM(CASE WHEN status = 'SUCCESS' AND method = 'UPI'
                THEN amount ELSE 0 END) AS upi_amount,
       SUM(CASE WHEN status = 'SUCCESS' AND method = 'CARD'
                THEN amount ELSE 0 END) AS card_amount,
       SUM(CASE WHEN status = 'SUCCESS' AND method = 'NETBANKING'
                THEN amount ELSE 0 END) AS netbanking_amount,
       SUM(CASE WHEN status = 'SUCCESS'
                THEN amount ELSE 0 END) AS total_success_amount,
       COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count
FROM payments
GROUP BY merchant_id, CAST(created_at AS DATE);`},checking:"Whether you can pivot rows to columns with conditional aggregation.",related:["aggregation-grouping-sets","null-semantics"]},{id:"pr-new-vs-repeat-customers",companies:["Zomato","Swiggy"],topic:"sql",round:"technical",difficulty:"medium",q:"For each month, count new customers (first order ever in that month) and repeat customers (ordered that month but first ordered earlier).",a:`Find each customer's first order date once, join it back to orders, and classify each customer-month by comparing the order month with the first order month.

**Why:** "new" depends on the customer's whole history, not just the current month, so you need the first order computed over all time. Then:
- new: first order falls in the same month.
- repeat: first order is before the start of the month.

\`COUNT(DISTINCT ...)\` makes sure a customer with five orders in a month counts once.

**Gotcha:** do not compute the first order inside a filtered date range (for example only the last 6 months), or long-time customers look "new". Compute it over full history, then filter the output months.`,code:{lang:"sql",code:`WITH firsts AS (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM orders
  GROUP BY customer_id
)
SELECT DATE_TRUNC('month', o.order_ts) AS month,
       COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', f.first_order_ts)
                                = DATE_TRUNC('month', o.order_ts)
                           THEN o.customer_id END) AS new_customers,
       COUNT(DISTINCT CASE WHEN f.first_order_ts
                                < DATE_TRUNC('month', o.order_ts)
                           THEN o.customer_id END) AS repeat_customers
FROM orders o
JOIN firsts f ON f.customer_id = o.customer_id
GROUP BY DATE_TRUNC('month', o.order_ts)
ORDER BY month;`},checking:"Whether you can define a business metric precisely and avoid double counting.",related:["funnels-and-retention","aggregation-grouping-sets"]},{id:"pr-rolling-7-day-orders",companies:["Swiggy","Zomato"],topic:"sql",round:"technical",difficulty:"medium",q:"Compute a 7-day rolling average of daily orders.",a:"Aggregate to one row per day, then average over a window frame that covers the current day and the 6 days before it.\n\n**Why:** `RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW` is based on the date value, so it looks back 6 calendar days, not 6 rows. `ROWS BETWEEN 6 PRECEDING` would look back 6 rows, which is wrong whenever a day is missing.\n\n**Gotcha:** even with `RANGE`, days with zero orders have no row, so the average divides by the days that exist, not by 7. For a true 7-day average, generate a calendar with `generate_series`, `LEFT JOIN` the daily counts and use `COALESCE(orders_cnt, 0)`. Also mention the first 6 days have an incomplete window.",code:{lang:"sql",code:`WITH daily AS (
  SELECT CAST(order_ts AS DATE) AS d, COUNT(*) AS orders_cnt
  FROM orders
  GROUP BY CAST(order_ts AS DATE)
)
SELECT d, orders_cnt,
       AVG(orders_cnt) OVER (
         ORDER BY d
         RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
       ) AS avg_7d
FROM daily
ORDER BY d;`},checking:"Whether you understand window frames and the effect of missing days.",related:["window-frames","window-functions"]},{id:"pr-inactive-users-not-in-null",companies:["CRED","Razorpay"],topic:"sql",round:"technical",difficulty:"medium",q:"List users who made no transaction in the last 30 days. Why might a NOT IN version return zero rows?",a:'Use `NOT EXISTS` with a correlated subquery; it is correct with NULLs and usually just as fast.\n\n**Why:** `NOT IN (subquery)` turns into `user_id <> a AND user_id <> b AND ...`. If the subquery returns even one NULL `user_id`, one comparison becomes UNKNOWN, the whole condition is never TRUE, and you get an **empty result** with no error. `NOT EXISTS` only asks "is there a matching row?", so NULLs do not poison it. Most optimizers turn it into an anti-join.\n\n**Gotcha:** "last 30 days" needs a clear boundary. `CURRENT_DATE - INTERVAL \'30 days\'` includes part of today; say whether today counts, and which time zone the timestamps use.',code:{lang:"sql",code:`SELECT u.user_id
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM transactions t
  WHERE t.user_id = u.user_id
    AND t.txn_ts >= CURRENT_DATE - INTERVAL '30 days'
);`},checking:"Whether you know the NOT IN plus NULL trap and three-valued logic.",related:["null-semantics","not-in-null-empty-result","subqueries-vs-joins"]},{id:"pr-join-fanout-revenue",companies:["Flipkart","Meesho"],topic:"sql",round:"technical",difficulty:"medium",q:"A daily revenue report joins orders to order_items and to payments, and revenue suddenly looks 2-3x too high. What went wrong and how do you fix it?",a:"It is join fan-out: an order with 3 items and 2 payments produces 3 x 2 = 6 rows, so every sum is multiplied. Fix it by aggregating each child table to the order grain **before** joining.\n\n**Why:** a join repeats each row once per match. Joining two one-to-many tables to the same parent creates a cross product per order. Pre-aggregating items and payments to one row per `order_id` makes both joins one-to-one, so sums are correct.\n\n**Gotcha:** `SUM(DISTINCT amount)` is not a fix: two genuinely equal payments get merged. A quick check is to compare `COUNT(*)` with `COUNT(DISTINCT order_id)` after the join; if they differ, you have fan-out.",code:{lang:"sql",code:`WITH items AS (
  SELECT order_id, SUM(qty * unit_price) AS item_total
  FROM order_items
  GROUP BY order_id
),
pays AS (
  SELECT order_id, SUM(amount) AS paid_total
  FROM payments
  GROUP BY order_id
)
SELECT o.order_date,
       SUM(i.item_total) AS gmv,
       SUM(p.paid_total) AS collected
FROM orders o
LEFT JOIN items i ON i.order_id = o.order_id
LEFT JOIN pays  p ON p.order_id = o.order_id
GROUP BY o.order_date;`},checking:"Whether you think about the grain of each table before joining.",related:["join-fanout-inflated-revenue","joins","dimensional-modeling"]},{id:"pr-median-delivery-time",companies:["Zomato","Swiggy"],topic:"sql",round:"technical",difficulty:"medium",q:"Compute the median delivery time in minutes per city. Why median and not average?",a:"Use `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ...)` on the delivery duration, grouped by city.\n\n**Why median:** delivery times are skewed. A few orders stuck for 3 hours (rain, restaurant delays) pull the average up a lot, while the median shows what a typical customer experiences. Teams often track p50 and p90 together for exactly this reason.\n\n**Why this function:** `PERCENTILE_CONT` interpolates between the two middle values when the count is even; `PERCENTILE_DISC` returns an actual value from the data.\n\n**Gotcha:** filter out undelivered or cancelled orders (`delivered_at IS NULL`) and obviously broken rows (negative durations), and say so. On Spark, `percentile_approx` is the scalable version.",code:{lang:"sql",code:`SELECT city,
       PERCENTILE_CONT(0.5) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (delivered_at - placed_at)) / 60.0
       ) AS median_minutes,
       PERCENTILE_CONT(0.9) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (delivered_at - placed_at)) / 60.0
       ) AS p90_minutes
FROM orders
WHERE delivered_at IS NOT NULL
  AND delivered_at >= placed_at
GROUP BY city;`},checking:"Whether you pick the right statistic for skewed data and know ordered-set aggregates.",related:["aggregation-grouping-sets"]},{id:"pr-monthly-cohort-retention",companies:["CRED","Meesho"],topic:"sql",round:"coding",difficulty:"hard",q:"Build a monthly cohort retention table: for users grouped by their first transaction month, what % are active in month 0, 1, 2 and so on?",a:'Assign each user a cohort (first active month), list the distinct months they were active, then count active users per cohort and month offset and divide by the cohort size.\n\n**Why:** retention is "of the people who started in month X, how many came back in month X + n". Steps:\n- `firsts`: cohort month per user.\n- `activity`: one row per user per active month (`DISTINCT` stops double counting).\n- Count users per cohort and month, and divide by month 0\'s count, which is the cohort size, using `FIRST_VALUE`.\n\n**Gotcha:** compute month offsets with real month arithmetic (year x 12 + month), not by dividing day differences by 30. Also note that recent cohorts have fewer months of data, so the bottom-right of the table is empty, not zero.',code:{lang:"sql",code:`WITH firsts AS (
  SELECT user_id, DATE_TRUNC('month', MIN(txn_ts)) AS cohort
  FROM transactions GROUP BY user_id
),
activity AS (
  SELECT DISTINCT t.user_id, f.cohort,
         DATE_TRUNC('month', t.txn_ts) AS active_month
  FROM transactions t JOIN firsts f ON f.user_id = t.user_id
)
SELECT cohort,
       EXTRACT(YEAR FROM AGE(active_month, cohort)) * 12
         + EXTRACT(MONTH FROM AGE(active_month, cohort)) AS month_no,
       COUNT(*) AS active_users,
       ROUND(100.0 * COUNT(*) / FIRST_VALUE(COUNT(*)) OVER (
             PARTITION BY cohort ORDER BY active_month), 1) AS retention_pct
FROM activity
GROUP BY cohort, active_month
ORDER BY cohort, active_month;`},checking:"Whether you can turn a product metric into a multi-step query with correct grain at each step.",related:["funnels-and-retention","window-functions","ctes-recursive"]},{id:"pr-where-vs-having-alias",companies:["Paytm","Zomato"],topic:"sql",round:"online test",difficulty:"easy",q:"What is the difference between WHERE and HAVING, and why can you not use a SELECT alias like cnt inside WHERE?",a:'`WHERE` filters rows before grouping; `HAVING` filters groups after `GROUP BY`. A `SELECT` alias is not visible in `WHERE` because `SELECT` is evaluated later.\n\n**Why:** the logical order is `FROM` > `WHERE` > `GROUP BY` > `HAVING` > `SELECT` > `ORDER BY` > `LIMIT`. When `WHERE` runs, aggregates like `COUNT(*)` do not exist yet and neither does the alias. That is why "cities with more than 100 delivered orders" needs the row filter in `WHERE` and the count filter in `HAVING`.\n\n**Gotcha:** put row-level filters in `WHERE`, not `HAVING`. It works either way for a grouped column, but filtering early means less data to group. `ORDER BY` can use the alias because it runs after `SELECT`.',code:{lang:"sql",code:`-- Fails: cnt does not exist yet when WHERE runs
-- SELECT city, COUNT(*) AS cnt FROM orders WHERE cnt > 100 GROUP BY city;

SELECT city, COUNT(*) AS cnt
FROM orders
WHERE status = 'DELIVERED'      -- row filter, before grouping
GROUP BY city
HAVING COUNT(*) > 100           -- group filter, after grouping
ORDER BY cnt DESC;              -- alias is fine here`},checking:"Whether you know the logical order in which a SQL query is evaluated.",related:["logical-query-order","aggregation-grouping-sets"]},{id:"pr-repartition-vs-coalesce",companies:["Flipkart","Paytm"],topic:"spark",round:"technical",difficulty:"easy",q:"What is the difference between repartition() and coalesce()? When would you use each?",a:'`repartition(n)` does a full shuffle and can increase or decrease partitions evenly; `coalesce(n)` only merges existing partitions without a shuffle, so it can only reduce them.\n\n**Why:** a shuffle moves data across the network, which costs time but gives balanced partitions. `coalesce` is cheap because each new partition just glues together neighbouring old ones, but sizes can be uneven.\n\nUse:\n- `coalesce`: reducing output files at the end of a job after a big filter.\n- `repartition`: increasing parallelism, fixing skewed partitions, or partitioning by a column (`repartition("dt")`) before writing.\n\n**Gotcha:** `coalesce(1)` can collapse the **whole upstream stage** to one task, because there is no shuffle boundary, so the heavy work runs on a single core. If the upstream work is expensive, `repartition(1)` is often faster.',code:{lang:"python",code:`df = spark.read.parquet("s3://lake/orders/")
print(df.rdd.getNumPartitions())

small = df.filter("city = 'Pune'").coalesce(8)   # merge, no shuffle
balanced = df.repartition(200)                    # full shuffle
by_day = df.repartition("order_date")             # hash by column`},checking:"Whether you understand what a shuffle costs and the hidden effect of coalesce on upstream parallelism.",related:["partitioning","shuffle-internals","narrow-wide-transformations"]},{id:"pr-broadcast-join",companies:["Swiggy","PhonePe"],topic:"spark",round:"technical",difficulty:"medium",q:"You join a 2 TB orders table with a 50 MB restaurants dimension. How do you make the join fast, and when does broadcasting fail?",a:"Broadcast the small table so every executor gets a full copy and the big table is joined in place with no shuffle.\n\n**Why:** a sort-merge join shuffles **both** sides by the join key, which means moving 2 TB over the network. A broadcast hash join sends 50 MB to each executor once, and each task joins its slice of orders locally. Spark does this automatically below `spark.sql.autoBroadcastJoinThreshold` (10 MB by default), so here you either raise it or use `F.broadcast()`.\n\n**Gotcha:** broadcasting fails or hurts when:\n- The table is bigger in memory than on disk (Parquet compresses well), causing driver or executor OOM.\n- You try to broadcast the preserved side of an outer join: for `orders LEFT JOIN restaurants`, only the right side can be broadcast.\n\nCheck `explain()` for `BroadcastHashJoin`.",code:{lang:"python",code:`from pyspark.sql import functions as F

orders = spark.read.parquet("s3://lake/orders/")
restaurants = spark.read.parquet("s3://lake/dim_restaurant/")

joined = orders.join(F.broadcast(restaurants), "restaurant_id", "left")
joined.explain()   # expect BroadcastHashJoin

# or raise the automatic threshold (bytes); -1 disables auto broadcast
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 64 * 1024 * 1024)`},checking:"Whether you know join strategies and the memory limits of broadcasting.",related:["join-strategies","broadcast-join-failure"]},{id:"pr-skewed-join-salting",companies:["Flipkart","Meesho"],topic:"spark",round:"technical",difficulty:"hard",q:"A join on seller_id finishes 199 of 200 tasks in 2 minutes, but the last task runs for an hour. What is happening and how do you fix it?",a:`That is data skew: one key (a huge seller) has far more rows than others, so after the shuffle one task gets most of the data.

**Fixes, in the order I would try them:**
- Turn on AQE skew join (\`spark.sql.adaptive.skewJoin.enabled\`): Spark 3 splits oversized partitions automatically.
- Broadcast the other side if it is small enough, which removes the shuffle completely.
- **Salt** the key: add a random number 0..N-1 to the big side, replicate the small side N times with each salt, and join on (key, salt). The hot key is now spread over N tasks.
- Handle the hot keys separately and \`union\` the results.

**Gotcha:** first confirm it is skew. In the Spark UI stage page, compare max vs median task input and shuffle read. If they are similar, the problem is something else, like spill or a slow node.`,code:{lang:"python",code:`from pyspark.sql import functions as F

N = 16  # salt buckets
orders_s = orders.withColumn("salt", (F.rand() * N).cast("int"))
sellers_s = sellers.crossJoin(
    spark.range(N).select(F.col("id").cast("int").alias("salt")))

joined = orders_s.join(sellers_s, ["seller_id", "salt"]).drop("salt")

# simpler first step on Spark 3.x
spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")`},checking:"Whether you can diagnose skew from task metrics and know more than one remedy.",related:["data-skew","skewed-join-straggler","adaptive-query-execution"]},{id:"pr-cache-vs-persist",companies:["Paytm","Zomato"],topic:"spark",round:"technical",difficulty:"easy",q:"What is the difference between cache() and persist()? When should you cache a DataFrame?",a:"`cache()` is `persist()` with the default storage level (`MEMORY_AND_DISK` for DataFrames); `persist()` lets you choose the level, such as `DISK_ONLY` or `MEMORY_ONLY`.\n\n**Why it matters:** Spark is lazy and recomputes a DataFrame from its source every time an action uses it. If an expensive DataFrame (a big join or filter) is used by several actions, caching keeps the result so later actions skip the recomputation.\n\nCache when the data is reused **and** expensive to rebuild. Do not cache something used once, or something cheap to read from Parquet.\n\n**Gotcha:** caching is lazy too. Nothing is stored until an action runs, so the first action pays full cost. Call `unpersist()` when done, otherwise cached blocks take memory away from execution and can cause spill.",code:{lang:"python",code:`from pyspark import StorageLevel

delivered = orders.filter("status = 'DELIVERED'").join(users, "user_id")
delivered.cache()          # MEMORY_AND_DISK by default
delivered.count()          # action that actually fills the cache

by_city = delivered.groupBy("city").count()
by_hour = delivered.groupBy("order_hour").count()

big = events.persist(StorageLevel.DISK_ONLY)
delivered.unpersist()`},checking:"Whether you understand lazy evaluation and the memory cost of caching.",related:["caching-persistence","lazy-evaluation-dag","unified-memory-model"]},{id:"pr-executor-oom-troubleshooting",companies:["PhonePe","Flipkart"],topic:"spark",round:"technical",difficulty:"hard",q:'Your nightly Spark job fails with "Container killed by YARN for exceeding memory limits" (or executor OOM). How do you troubleshoot it?',a:`Find out **which** memory ran out and **why one task** needed so much, then fix the cause rather than only adding memory.

**Steps:**
- Spark UI: find the failing stage and compare max vs median task input. A huge max points to skew.
- Check spill metrics. Heavy spill means partitions are too large: raise \`spark.sql.shuffle.partitions\` or rely on AQE.
- "Exceeding memory limits" from YARN or Kubernetes is often **off-heap** memory (Python workers, Netty buffers). Raise \`spark.executor.memoryOverhead\`, especially with Python UDFs.
- Look for big broadcasts, \`collect_list\` on hot keys, or exploding arrays.

**Gotcha:** giving executors more cores without more memory makes it worse, because more tasks share the same heap. Fewer cores per executor (around 4-5) is often the quickest stabiliser.`,checking:"Whether you debug methodically from the Spark UI instead of just increasing memory.",related:["spill-and-oom","executor-oom-killed","executor-sizing"]},{id:"pr-narrow-vs-wide",companies:["Paytm","Swiggy"],topic:"spark",round:"technical",difficulty:"easy",q:"Explain narrow and wide transformations with examples. Why does the difference matter?",a:"A narrow transformation builds each output partition from one input partition (`filter`, `select`, `withColumn`); a wide transformation needs data from many input partitions, which forces a shuffle (`groupBy`, `join`, `distinct`, `repartition`).\n\n**Why it matters:**\n- Every wide transformation creates a **stage boundary**. Spark pipelines narrow steps together inside one stage, but must write and read shuffle files between stages.\n- Shuffles are usually the most expensive part of a job: disk, network and serialization.\n- On failure, a narrow partition is recomputed from its single parent, while a lost shuffle output can require re-running a whole earlier stage.\n\n**Gotcha:** a join is not always wide. A broadcast join, or a join between two tables already bucketed the same way, can avoid the shuffle. Check `explain()` for `Exchange` nodes.",checking:"Whether you connect transformations to stages, shuffles and cost.",related:["narrow-wide-transformations","jobs-stages-tasks","shuffle-internals"]},{id:"pr-small-files-problem",companies:["Meesho","CRED"],topic:"spark",round:"technical",difficulty:"medium",q:"A streaming job writes thousands of tiny Parquet files per hour and downstream reads are slow. Why, and how do you fix it?",a:"Many small files are slow because each file has fixed overhead (listing, opening, reading footers, scheduling a task), so the engine spends more time on metadata than on data. Fix it by writing fewer, larger files (roughly 128 MB to 1 GB) and compacting regularly.\n\n**Ways to fix:**\n- Before writing, `repartition` by the partition column or `coalesce` to a sensible count.\n- Use a longer trigger interval in streaming so each micro-batch writes more data.\n- Run a compaction job per partition, or `OPTIMIZE` on Delta Lake (Iceberg has `rewrite_data_files`).\n- Turn on AQE partition coalescing for batch jobs.\n\n**Gotcha:** compacting a partition while readers or writers are using it can break queries on plain Parquet. Table formats like Delta or Iceberg make compaction an atomic commit, which is why teams adopt them.",code:{lang:"python",code:`dt = "2024-06-01"
src = f"s3://lake/events/dt={dt}/"
df = spark.read.parquet(src)

target_files = max(1, len(df.inputFiles()) // 50)   # ~50 small -> 1
(df.repartition(target_files)
   .write.mode("overwrite")
   .parquet(f"s3://lake/events_compacted/dt={dt}/"))

# Delta Lake alternative:
# spark.sql("OPTIMIZE delta.\`s3://lake/events\` WHERE dt = '2024-06-01'")`},checking:"Whether you understand file-level overhead and practical compaction strategies.",related:["small-files-compaction","small-files-slow-read","delta-lake-iceberg"]},{id:"pr-adaptive-query-execution",companies:["Swiggy","CRED"],topic:"spark",round:"technical",difficulty:"medium",q:"What is Adaptive Query Execution (AQE) in Spark 3 and what problems does it solve?",a:`AQE re-optimizes the query plan **while it runs**, using real statistics from completed shuffle stages instead of estimates made before the job started.

**What it does:**
- **Coalesces shuffle partitions:** merges many tiny post-shuffle partitions, so 200 default partitions on small data do not mean 200 tiny tasks.
- **Switches join strategy:** if one side turns out small after filtering, it converts a sort-merge join to a broadcast join.
- **Splits skewed partitions** in joins so one hot key does not create a single straggler task.

**Why it helps:** before execution, Spark only has file-size guesses, which are often wrong after filters and joins.

**Gotcha:** AQE acts at shuffle boundaries, so it cannot fix a slow first stage that reads the source, and its skew handling covers joins, not every skewed \`groupBy\`. It is on by default from Spark 3.2.`,code:{lang:"python",code:`spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
spark.conf.set("spark.sql.adaptive.advisoryPartitionSizeInBytes", "128m")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")`},checking:"Whether you know what Spark 3 does automatically and where its limits are.",related:["adaptive-query-execution","data-skew","join-strategies"]},{id:"pr-reading-spark-ui",companies:["Flipkart","PhonePe"],topic:"spark",round:"technical",difficulty:"medium",q:"A job that used to take 20 minutes now takes 2 hours. Walk me through how you would use the Spark UI to find the problem.",a:`Go from the job to the slowest stage, then to the task distribution in that stage, and compare against a good run.

**Walkthrough:**
- **Jobs / Stages tab:** sort stages by duration and open the slowest one.
- **Task summary:** compare min, median and max for duration, input size and shuffle read. Max far above median means skew; all tasks slow means too little parallelism or too much data per task.
- **Spill (memory/disk):** large spill means partitions are too big.
- **GC time:** high GC suggests memory pressure.
- **SQL tab:** check the physical plan. Did a broadcast join turn into a sort-merge join? Are partition filters still pushed down?
- **Executors tab:** failed tasks or lost executors.

**Gotcha:** "it got slower" often means the data grew and a plan choice flipped, for example a dimension crossed the broadcast threshold. Comparing plans between runs is the fastest check.`,checking:"Whether you have real hands-on debugging experience rather than only theory.",related:["jobs-stages-tasks","reading-explain-plans","slow-after-data-growth"]},{id:"pr-groupbykey-vs-reducebykey",companies:["Paytm","Flipkart"],topic:"spark",round:"online test",difficulty:"easy",q:"Why is reduceByKey preferred over groupByKey for aggregations on RDDs?",a:'`reduceByKey` combines values on each partition **before** the shuffle (a map-side combine), so far less data crosses the network; `groupByKey` ships every single value and only then aggregates.\n\n**Why:** to count orders per city, `reduceByKey` first turns a million local ("blr", 1) pairs into one ("blr", 1000000) per partition, then shuffles those partial sums. `groupByKey` shuffles all million pairs and builds a list of values per key in memory, which can cause OOM for hot keys.\n\n**Gotcha:** in modern PySpark you rarely use RDDs. The DataFrame `groupBy().agg()` already does partial aggregation automatically. Mention that, and say `groupByKey` is only reasonable when you truly need all values together and cannot express it as a combine.',code:{lang:"python",code:`rdd = sc.parallelize([("blr", 1), ("del", 1), ("blr", 1)])

slow = rdd.groupByKey().mapValues(sum)          # shuffles every value
fast = rdd.reduceByKey(lambda a, b: a + b)      # combines before shuffle

# DataFrame equivalent (partial aggregation is automatic)
df.groupBy("city").count()`},checking:"Whether you understand map-side combine and shuffle volume.",related:["shuffle-internals","rdd-dataframe-dataset"]},{id:"pr-partition-by-on-write",companies:["Razorpay","Meesho"],topic:"spark",round:"technical",difficulty:"medium",q:"How would you choose a partition column when writing a payments table to the data lake? What goes wrong with a bad choice?",a:'Partition by a low-cardinality column that most queries filter on, usually the event date (`dt`), so readers can skip whole folders.\n\n**Why:** `partitionBy("dt")` creates one folder per date. A query with `WHERE dt = \'2024-06-01\'` reads only that folder (partition pruning). Payments queries are almost always time-bounded, so date is the natural choice.\n\n**Bad choices:**\n- High cardinality like `merchant_id` or `payment_id`: millions of folders and tiny files.\n- A column nobody filters on: no pruning benefit at all.\n\n**Gotcha:** `partitionBy` alone can write many files per folder, since every task writes to every date it holds. `repartition("dt")` first, and use dynamic partition overwrite so a rerun replaces only the dates it touches instead of wiping the table.',code:{lang:"python",code:`from pyspark.sql import functions as F

(payments
   .withColumn("dt", F.to_date("created_at"))
   .repartition("dt")
   .write
   .mode("overwrite")
   .option("partitionOverwriteMode", "dynamic")
   .partitionBy("dt")
   .parquet("s3://lake/payments/"))`},checking:"Whether you connect physical layout to query patterns and file counts.",related:["writing-data","partition-pruning-pushdown","partitioning"]},{id:"pr-driver-oom-collect",companies:["Zomato","Paytm"],topic:"spark",round:"technical",difficulty:"medium",q:"Your PySpark job fails with an OutOfMemoryError on the driver. What are the usual causes?",a:"The driver usually runs out of memory because too much data is pulled back to it, most often through `collect()` or `toPandas()` on a large DataFrame.\n\n**Common causes:**\n- `collect()` / `toPandas()` on millions of rows.\n- Broadcasting a table that is too big (the driver builds the broadcast first).\n- Huge numbers of files or partitions, so the driver holds too much metadata and task state.\n- Looping in Python over rows on the driver.\n\n**Fixes:** keep work distributed and write results to storage instead of collecting; use `take(n)` or `limit` for inspection; aggregate before `toPandas()`; compact small files.\n\n**Gotcha:** raising `spark.driver.memory` hides the problem until the data grows again. Also `spark.driver.maxResultSize` errors are a safety limit telling you the same thing; do not just set it to 0.",checking:"Whether you understand what runs on the driver versus the executors.",related:["driver-oom-collect","spark-architecture","spill-and-oom"]},{id:"pr-lazy-eval-jobs-stages",companies:["Swiggy","PhonePe"],topic:"spark",round:"technical",difficulty:"easy",q:"What is lazy evaluation in Spark? How do jobs, stages and tasks relate to each other?",a:"Transformations only build a plan; nothing runs until an **action** like `count()`, `write` or `show()` asks for a result.\n\n**Why lazy:** waiting lets Spark see the whole plan and optimize it, for example pushing filters into the Parquet scan and selecting only needed columns.\n\n**Hierarchy:**\n- **Job:** one per action.\n- **Stage:** a job is split at shuffle boundaries; each wide transformation starts a new stage.\n- **Task:** one per partition per stage, running on one executor core.\n\nSo a job that reads 400 partitions, filters, then does a `groupBy` has two stages: 400 tasks before the shuffle and `spark.sql.shuffle.partitions` tasks after (unless AQE coalesces them).\n\n**Gotcha:** calling several actions on the same uncached DataFrame re-runs the whole lineage each time. Debug `count()` calls left in production code are a common hidden cost.",checking:"Whether you have a correct mental model of how Spark turns code into work.",related:["lazy-evaluation-dag","jobs-stages-tasks","catalyst-optimizer"]},{id:"pr-design-quick-commerce-orders",companies:["Swiggy","Zomato","Flipkart"],topic:"pipeline",round:"design",difficulty:"hard",q:"Design the data pipeline for a quick-commerce app (10-minute delivery) that powers both live ops dashboards and daily finance reports from order events.",a:`Use one event stream as the source of truth, with a streaming path for live metrics and a batch lakehouse path for accurate daily reporting.

**Design:**
- **Ingest:** order service publishes events (placed, packed, picked, delivered, cancelled) to Kafka, keyed by \`order_id\`, with CDC from the orders database as a backup source.
- **Raw layer:** land events as-is in Delta/Iceberg, partitioned by event date.
- **Streaming path:** Structured Streaming with watermarks computes per-dark-store metrics (orders per minute, delays, stockouts) into a low-latency store for dashboards.
- **Batch path:** daily jobs dedupe, build \`fact_orders\` at one row per order with its latest status, and join dimensions (store, SKU, customer).
- **Quality:** row counts vs source, uniqueness of \`order_id\`, reconciliation with payments.

**Gotcha:** say up front that live numbers are approximate and finance uses the batch layer. Interviewers want to hear about late events, dedup and idempotent reruns, not a list of tools.`,checking:"Whether you can separate latency needs from correctness needs and design for both.",related:["design-lakehouse-etl","structured-streaming-model","design-ecommerce-star-schema"]},{id:"pr-realtime-delivery-eta-events",companies:["Swiggy","Zomato"],topic:"pipeline",round:"design",difficulty:"hard",q:"Delivery partners send GPS pings every few seconds. Design a pipeline that computes live ETA features per order (distance left, average speed over the last 5 minutes).",a:`Stream the pings through Kafka into a stateful streaming job that keeps a short sliding window per rider and order, and write the latest features to a fast key-value store that the ETA service reads.

**Design:**
- **Kafka topic** keyed by \`rider_id\`, so all pings of a rider land in one partition, in order.
- **Streaming job** (Spark Structured Streaming or Flink): event-time windows of 5 minutes sliding every 30 seconds, with a watermark of about 1-2 minutes for late pings.
- **Join** with the active assignment (rider to order) from a small, frequently refreshed state or a stream-stream join.
- **Sink:** upsert features into Redis or a similar store keyed by \`order_id\`; also land raw pings in the lake for model training.

**Gotcha:** GPS data is noisy and out of order: drop impossible jumps, use event time not arrival time, and clear state when an order is delivered so state does not grow forever.`,checking:"Whether you understand event time, windows, state size and serving latency.",related:["stateful-streaming","watermarks-late-data","streaming-joins"]},{id:"pr-dedup-payment-events-stream",companies:["PhonePe","Razorpay","Paytm"],topic:"pipeline",round:"design",difficulty:"hard",q:"Payment gateway callbacks are retried, so the same payment event can arrive several times. How do you make sure each payment is counted exactly once in the lake?",a:`Combine three things: a stable idempotency key, streaming deduplication within a watermark, and an idempotent upsert (MERGE) into the target table.

**Why each layer:**
- **Key:** use the gateway's \`event_id\` (or \`payment_id\` + status), never arrival time.
- **Stream dedup:** \`dropDuplicatesWithinWatermark\` (Spark 3.5+) drops repeats that arrive within the watermark window, while keeping state bounded.
- **MERGE on payment_id** in Delta/Iceberg: even if a duplicate slips past the watermark, or a micro-batch replays after a failure, the target row is updated rather than inserted twice.
- **Checkpointing** lets the stream resume from the right Kafka offsets.

**Gotcha:** Kafka plus Spark gives exactly-once **processing** only if the sink is idempotent or transactional. A plain append to Parquet can still duplicate rows after a retry.`,code:{lang:"python",code:`from pyspark.sql import functions as F

events = (spark.readStream.format("kafka")
          .option("kafka.bootstrap.servers", "broker:9092")
          .option("subscribe", "payment-events").load()
          .select(F.from_json(F.col("value").cast("string"), schema).alias("e"))
          .select("e.*"))

deduped = (events
           .withWatermark("event_ts", "2 hours")
           .dropDuplicatesWithinWatermark(["event_id"]))   # Spark 3.5+

(deduped.writeStream
   .foreachBatch(merge_into_payments)   # MERGE ON payment_id
   .option("checkpointLocation", "s3://chk/payment-events/")
   .start())`},checking:"Whether you know that exactly-once needs an idempotent sink, not just a streaming engine.",related:["exactly-once-checkpointing","watermarks-late-data","design-cdc-merge"]},{id:"pr-late-arriving-orders",companies:["Swiggy","Meesho"],topic:"pipeline",round:"technical",difficulty:"medium",q:"Some order events reach your pipeline hours late (offline phones, retries). How do you handle late-arriving data in streaming and in daily batch jobs?",a:`In streaming, use event time with a watermark that sets how late data may be and still count; in batch, reprocess a sliding window of recent partitions instead of only "yesterday".

**Streaming:** \`withWatermark("order_ts", "30 minutes")\` tells Spark to keep window state for 30 minutes past the latest event seen. Late events within that limit update the right window; older ones are dropped, so state stays bounded.

**Batch:** partition by **event date**, and each run rebuilds the last N days (for example 3) with dynamic partition overwrite or MERGE. Late rows land in the correct historical day.

**Gotcha:** watermark length is a trade-off between completeness and memory and latency. Measure the real lateness distribution (for example p99) and choose from that, and send events later than the watermark to a side table so nothing disappears silently.`,code:{lang:"python",code:`from pyspark.sql import functions as F

per_window = (orders_stream
    .withWatermark("order_ts", "30 minutes")
    .groupBy(F.window("order_ts", "15 minutes"), "city")
    .agg(F.count("*").alias("orders"),
         F.sum("amount").alias("gmv")))`},checking:"Whether you understand event time versus processing time and plan for reprocessing.",related:["watermarks-late-data","structured-streaming-model","timezone-day-boundary"]},{id:"pr-cdc-mysql-to-lake",companies:["Razorpay","CRED"],topic:"pipeline",round:"design",difficulty:"hard",q:"You need to replicate a MySQL merchants table (inserts, updates, deletes) into the data lake every 15 minutes. How would you build it?",a:"Capture changes from the MySQL binlog with a CDC tool (for example Debezium into Kafka), then apply each micro-batch to a Delta or Iceberg table with `MERGE`.\n\n**Steps:**\n- Debezium emits one event per row change with the operation (`c`, `u`, `d`) and a log position.\n- Land raw change events first, so you can replay.\n- For each batch, keep only the **latest change per key** (by log position), because MERGE fails or misbehaves if several source rows match one target row.\n- MERGE: delete on `d`, update when matched, insert when not matched.\n\n**Why not a full daily dump:** it is slow, loads the source database and loses intermediate history.\n\n**Gotcha:** take an initial snapshot first and make sure the CDC stream starts from the snapshot's log position, otherwise you miss or double-apply changes. Schema changes in MySQL also need a plan.",code:{lang:"python",code:`from pyspark.sql import functions as F, Window
from delta.tables import DeltaTable

w = Window.partitionBy("merchant_id").orderBy(F.col("log_pos").desc())
latest = (cdc_batch.withColumn("rn", F.row_number().over(w))
          .filter("rn = 1").drop("rn"))

target = DeltaTable.forPath(spark, "s3://lake/merchants/")
(target.alias("t")
   .merge(latest.alias("s"), "t.merchant_id = s.merchant_id")
   .whenMatchedDelete(condition="s.op = 'd'")
   .whenMatchedUpdateAll(condition="s.op <> 'd'")
   .whenNotMatchedInsertAll(condition="s.op <> 'd'")
   .execute())
# assumes target has the same columns as latest (including op, log_pos)`},checking:"Whether you understand CDC ordering, dedup before MERGE and snapshot handover.",related:["design-cdc-merge","delta-lake-iceberg","top-n-and-dedup"]},{id:"pr-idempotent-daily-backfill",companies:["Flipkart","Meesho"],topic:"pipeline",round:"technical",difficulty:"medium",q:"Your daily ETL failed halfway and was rerun, and now some days have duplicate rows. How do you make the job safe to rerun and to backfill?",a:'Make the job **idempotent**: each run fully replaces the output for the dates it owns, so running it once or five times gives the same result.\n\n**How:**\n- Parameterize the job by `run_date` instead of using "now".\n- Write with dynamic partition overwrite (only the touched `dt` partitions are replaced), or `MERGE` on a business key, never plain append.\n- Use a table format (Delta/Iceberg) so a failed write does not leave half-written files visible.\n- For backfills, loop over dates (or run them in parallel) with the same code.\n\n**Gotcha:** with `mode("overwrite")` and the default static mode, Spark deletes **all** partitions of the table, not just the ones you wrote. Set `partitionOverwriteMode` to `dynamic` and test on a copy first.',code:{lang:"python",code:`spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")

def run(run_date: str) -> None:
    daily = (spark.read.table("raw.orders")
             .filter(f"dt = '{run_date}'")
             .dropDuplicates(["order_id"]))
    (daily.write.mode("overwrite")
          .partitionBy("dt")
          .parquet("s3://lake/fact_orders/"))

for d in ["2024-06-01", "2024-06-02", "2024-06-03"]:
    run(d)`},checking:"Whether you design pipelines that are safe to retry, which is a core production skill.",related:["writing-data","design-lakehouse-etl","fault-tolerance-lineage"]},{id:"pr-scd2-merchant-dimension",companies:["Razorpay","PhonePe"],topic:"modeling",round:"design",difficulty:"hard",q:"Merchants change their pricing plan and business category over time, and finance needs reports using the values that were true on each transaction date. How do you model and load this?",a:"Use a Slowly Changing Dimension Type 2: keep one row per version of each merchant with `valid_from`, `valid_to` and an `is_current` flag, and join transactions on the version active at the transaction time.\n\n**Why:** Type 1 (overwrite) rewrites history, so last year's revenue would suddenly show under the new category. Type 2 keeps every version.\n\n**Load in two steps:**\n- Close the current row when a tracked column changed.\n- Insert a new current row for changed and new merchants.\n\nFact tables join with `txn_ts >= valid_from AND (txn_ts < valid_to OR valid_to IS NULL)`, or store the surrogate key of the version directly in the fact.\n\n**Gotcha:** dedupe the staging data to one row per merchant first, compare columns with `IS DISTINCT FROM` so NULL changes are caught, and run both steps in one transaction.",code:{lang:"sql",code:`-- 1) close current rows whose tracked attributes changed
UPDATE dim_merchant d
SET valid_to = s.updated_at, is_current = FALSE
FROM stg_merchant s
WHERE d.merchant_id = s.merchant_id
  AND d.is_current
  AND (d.pricing_plan, d.category)
      IS DISTINCT FROM (s.pricing_plan, s.category);

-- 2) insert new versions for changed and brand-new merchants
INSERT INTO dim_merchant
  (merchant_id, pricing_plan, category, valid_from, valid_to, is_current)
SELECT s.merchant_id, s.pricing_plan, s.category, s.updated_at, NULL, TRUE
FROM stg_merchant s
LEFT JOIN dim_merchant d
  ON d.merchant_id = s.merchant_id AND d.is_current
WHERE d.merchant_id IS NULL;`},checking:"Whether you understand SCD types and can load Type 2 correctly, including NULL comparisons.",related:["slowly-changing-dimensions","design-scd2-pipeline","dimensional-modeling"]},{id:"pr-food-delivery-star-schema",companies:["Zomato","Swiggy"],topic:"modeling",round:"design",difficulty:"medium",q:"Design a star schema for food-delivery analytics: orders, restaurants, customers, delivery partners and dishes.",a:"Start by fixing the **grain**, then build fact tables at that grain surrounded by dimensions.\n\n**Facts:**\n- `fact_order`: one row per order. Keys to customer, restaurant, rider, date, city; measures like order value, discount, delivery fee, delivery minutes.\n- `fact_order_item`: one row per dish per order, for menu analytics.\n\n**Dimensions:** `dim_customer`, `dim_restaurant` (cuisine, rating band, often SCD2), `dim_rider`, `dim_dish`, `dim_date`, `dim_city`.\n\n**Why a star:** analysts filter and group by dimension attributes with simple joins, and columnar warehouses handle the wide fact tables well.\n\n**Gotcha:** do not mix grains in one fact table. Putting item rows and order-level delivery fee in the same table makes `SUM(delivery_fee)` count the fee once per item. Keep order-level measures in the order-grain fact.",checking:"Whether you start from grain and avoid mixing levels of detail.",related:["dimensional-modeling","design-ecommerce-star-schema","join-fanout-inflated-revenue"]},{id:"pr-normalize-vs-denormalize",companies:["Flipkart","CRED"],topic:"modeling",round:"technical",difficulty:"medium",q:"When would you normalize data and when would you denormalize it? Answer for an app database versus an analytics lakehouse.",a:`Normalize in the app (OLTP) database, where many small writes must stay consistent; denormalize in the analytics layer, where large reads and scans matter more than write cost.

**OLTP:** normalized tables (3NF) store each fact once, so updating a user's address touches one row and there are no conflicting copies. Queries are small and use indexes.

**Analytics:** joins over billions of rows are expensive, so a star schema or wide denormalized tables give analysts fast, simple queries. Columnar formats like Parquet compress repeated values well, so duplication is cheap.

**Gotcha:** denormalizing copies attributes, so you must decide what happens when they change. A customer's city copied into the order fact means "city at order time", which may be exactly what the business wants, or a bug. Say which one you intend.`,checking:"Whether you match the modeling approach to the workload rather than reciting definitions.",related:["normalization","dimensional-modeling","columnar-storage"]},{id:"pr-slow-python-udf",companies:["CRED","Razorpay"],topic:"python",round:"coding",difficulty:"medium",q:"A PySpark job uses a Python UDF to mask UPI IDs and convert paise to rupees, and it is very slow. How do you speed it up?",a:"Replace the UDF with built-in Spark functions; if Python logic is truly needed, use a vectorized `pandas_udf`.\n\n**Why it is slow:** a regular Python UDF sends every row from the JVM to a Python worker and back, one row at a time, with serialization each way. Catalyst also cannot optimize inside it, so filter pushdown and code generation stop at the UDF.\n\n**Fixes:**\n- Built-ins like `substring`, `concat`, `regexp_replace` and arithmetic run inside the JVM and are fully optimized.\n- `pandas_udf` uses Apache Arrow to pass whole column batches, which is often many times faster than a row UDF.\n\n**Gotcha:** Python UDFs also use memory outside the JVM heap. Jobs with heavy UDFs often need more `spark.executor.memoryOverhead` (or `spark.executor.pyspark.memory`), otherwise containers get killed.",code:{lang:"python",code:`import pandas as pd
from pyspark.sql import functions as F

# slow: row-at-a-time Python UDF
# mask = F.udf(lambda s: s[:4] + "****" if s else None)

df = df.withColumn("masked_vpa",
                   F.concat(F.substring("vpa", 1, 4), F.lit("****")))
df = df.withColumn("amount_inr", F.col("amount_paise") / 100)

# if Python is unavoidable, vectorize it
@F.pandas_udf("double")
def risk_score(amount: pd.Series) -> pd.Series:
    return (amount.clip(upper=1e6) / 1e6).round(4)

df = df.withColumn("risk", risk_score("amount_inr"))`},checking:"Whether you know the cost of crossing the JVM and Python boundary.",related:["python-udfs-arrow","slow-python-udf","tungsten-codegen"]},{id:"pr-flatten-nested-json",companies:["Meesho","Flipkart"],topic:"python",round:"coding",difficulty:"medium",q:"Order events arrive as JSON with a nested user object and an items array. Flatten them in PySpark into one row per item.",a:"Parse with `from_json` using an explicit schema, select nested fields with dot notation, and `explode_outer` the items array to get one row per item.\n\n**Why an explicit schema:** schema inference reads the data an extra time and can guess types differently from day to day, which breaks downstream jobs. A declared schema is faster and stable; bad records become NULL instead of changing the table.\n\n**Why explode_outer:** `explode` drops orders with an empty or NULL items array. `explode_outer` keeps them with NULL item columns, so order counts still reconcile.\n\n**Gotcha:** after exploding, order-level amounts (delivery fee, discount) repeat on every item row. Do not sum them at this grain; keep them in a separate order-level table.",code:{lang:"python",code:`from pyspark.sql import functions as F
from pyspark.sql.types import (StructType, StructField, StringType,
                               ArrayType, DoubleType)

item = StructType([StructField("sku", StringType()),
                   StructField("price", DoubleType())])
schema = StructType([
    StructField("order_id", StringType()),
    StructField("user", StructType([StructField("id", StringType()),
                                    StructField("city", StringType())])),
    StructField("items", ArrayType(item)),
])

raw = spark.read.text("s3://raw/orders/")
orders = raw.select(F.from_json("value", schema).alias("o")).select("o.*")
flat = (orders.withColumn("item", F.explode_outer("items"))
        .select("order_id",
                F.col("user.id").alias("user_id"),
                F.col("user.city").alias("city"),
                F.col("item.sku").alias("sku"),
                F.col("item.price").alias("price")))`},checking:"Whether you can handle semi-structured data safely and know explode versus explode_outer.",related:["semi-structured-json","rdd-dataframe-dataset"]},{id:"pr-merge-delivery-slots",companies:["PhonePe","CRED"],topic:"python",round:"coding",difficulty:"medium",q:"Given a list of delivery time slots as (start, end) hours, merge the overlapping ones. Example: [(9, 11), (10, 12), (14, 15), (15, 16)] gives [(9, 12), (14, 16)].",a:"Sort the slots by start time, then walk through them once: if a slot starts before or at the end of the last merged slot, extend it; otherwise start a new one.\n\n**Why it works:** after sorting, any slot that overlaps the current merged slot must come right after it, so a single pass is enough. Time is O(n log n) for the sort and O(n) for the scan; extra space is O(n) for the output.\n\n**Gotcha:** decide whether touching slots like (14, 15) and (15, 16) should merge. Using `<=` merges them, `<` keeps them separate; ask the interviewer. Also handle the empty list, and do not sort the caller's list in place unless that is allowed.",code:{lang:"python",code:`def merge_slots(slots):
    if not slots:
        return []
    ordered = sorted(slots, key=lambda s: s[0])
    merged = [list(ordered[0])]
    for start, end in ordered[1:]:
        if start <= merged[-1][1]:          # overlaps or touches
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [tuple(s) for s in merged]


print(merge_slots([(9, 11), (10, 12), (14, 15), (15, 16)]))
# [(9, 12), (14, 16)]`},checking:"Whether you can solve a standard coding problem cleanly and clarify edge cases first.",related:["gaps-and-islands"]},{id:"pr-design-upi-reconciliation",companies:["PhonePe","Razorpay","Paytm"],topic:"design",round:"design",difficulty:"hard",q:"Design a daily reconciliation system that matches your payments ledger against bank and NPCI settlement files and reports breaks to operations by the next morning.",a:`Build it as a keyed, auditable batch match: the ledger of record and idempotently ingested settlement files are joined on the transaction reference, every row gets a status, and unmatched rows become breaks that age until someone resolves them.

**Requirements:** match on RRN/UTR and amount; classify matched, missing in bank, missing in ledger and amount mismatch; results by 8 AM; a full audit trail; reruns must never double-count.

**Estimates:** 50 million transactions a day at about 500 bytes is about 25 GB a day. The match is one keyed join, which a moderate Spark job on EMR or Glue finishes well inside an hour.

**Architecture:**
- Ledger changes arrive by CDC (Debezium or DMS) into a silver Iceberg or Delta table partitioned by business date.
- Bank files land in S3; the loader records file name, checksum and row count, so a resent file is skipped.
- A Spark job runs a FULL OUTER JOIN over a T to T+2 window, because settlement lags the transaction.
- A breaks table with status and ageing, plus control totals per bank per day.

**Trade-offs:** daily batch fits because settlement files are daily; intraday matching only helps if ops act intraday. Tolerances (rounding, fee netting) must be explicit rules, never fuzzy matching on amount alone.`,code:{lang:"sql",code:`WITH l AS (SELECT rrn, amount_paise FROM ledger_txn
           WHERE txn_date = DATE '2026-11-23'),
     b AS (SELECT rrn, amount_paise FROM bank_settlement
           WHERE settle_date BETWEEN DATE '2026-11-23' AND DATE '2026-11-25')
SELECT COALESCE(l.rrn, b.rrn) AS rrn,
       CASE WHEN b.rrn IS NULL THEN 'MISSING_IN_BANK'
            WHEN l.rrn IS NULL THEN 'MISSING_IN_LEDGER'
            WHEN l.amount_paise <> b.amount_paise THEN 'AMOUNT_MISMATCH'
            ELSE 'MATCHED' END AS recon_status
FROM l
FULL OUTER JOIN b ON l.rrn = b.rrn;
-- unmatched rows stay open and are retried on later runs before they age into breaks`},checking:"Whether you treat reconciliation as a keyed, auditable and rerunnable match rather than a comparison of sums.",related:["case-payments-reconciliation","idempotency-and-backfills","data-quality-and-slas"]},{id:"pr-design-trending-products",companies:["Flipkart","Meesho"],topic:"design",round:"design",difficulty:"hard",q:'Design a "trending now" widget: the top 50 products per category by views and add-to-carts over the last hour, refreshed every minute, that keeps working during a big festival sale.',a:`Use a streaming job that keeps per-minute counts per (category, product), rolls them into a one-hour score every minute, picks the top 50 per category and writes the result to a low-latency store that the app reads.

**Requirements:** 1-hour window, 1-minute refresh, approximate ranking is acceptable, bot traffic filtered out, must survive a 10x sale spike.

**Estimates:** 200,000 events/s at peak at about 300 bytes is about 60 MB/s into Kafka. With 5 million active products and 60 one-minute buckets each, naive state is up to 300 million counters, so pre-aggregate and drop products with no activity.

**Architecture:**
- Kafka topic keyed by product_id, spread over enough partitions for peak.
- Flink or Spark Structured Streaming: 1-minute tumbling counts, then a rolling sum of the last 60 buckets (far cheaper than 60 overlapping sliding windows).
- Per-category top-N with a heap; results written to Redis sorted sets or DynamoDB keyed by category.
- Raw events also land in S3 for the batch view and model training.

**Trade-offs:** exact counts versus Count-Min Sketch plus a heavy-hitters list; a viral product is a hot key, so aggregate in two stages (salted key, then merge). Weight add-to-cart above views and decay older minutes so yesterday's bestsellers do not dominate.`,checking:"Whether you can turn a vague product ask into windows, state size and a serving store, and handle hot keys at sale scale.",related:["case-trending-products","stateful-streaming","kafka-partitions-ordering"]},{id:"pr-design-fraud-scoring",companies:["CRED","Razorpay","Paytm"],topic:"design",round:"design",difficulty:"hard",q:'Design a pipeline that scores card and UPI transactions for fraud within 200 ms, using velocity features such as "transactions from this device in the last 10 minutes".',a:`Split it into an online path, where the payment service calls a scoring service that reads precomputed features from a key-value store, and an offline path that keeps the same features with full history for training, both fed by one feature definition.

**Requirements:** p99 under 200 ms end to end; features fresh within seconds; decisions explainable; labels (chargebacks) arrive weeks later.

**Estimates:** 5,000 transactions/s at peak with about 20 feature reads each is 100,000 reads/s, comfortable for Redis or DynamoDB.

**Architecture:**
- Transactions go to Kafka; Flink keeps sliding counts and sums per card, device, merchant and IP and writes the latest values to the online store with a TTL.
- Scoring service: cheap rules first (blocklists, limits), then the model on features read from the store.
- Every decision is logged with the exact feature values served, to Kafka and then S3, and later joined to chargeback labels for retraining.

**Trade-offs:** computing velocity inside the request is exact but slow; streamed features can be a few seconds stale. Logging served features gives point-in-time correct training data and avoids online/offline skew. Whether to fail open or fail closed when the feature store is down is a business decision, so ask.`,checking:"Whether you separate online serving from offline training and know why point-in-time correctness and feature logging matter.",related:["case-fraud-detection","case-feature-store","kafka-stream-processing"]},{id:"pr-design-experimentation-platform",companies:["Swiggy","Zomato","Flipkart"],topic:"design",round:"design",difficulty:"hard",q:"Design the data pipeline behind an A/B testing platform: assignment and exposure logs in, daily metric results per experiment and variant out.",a:`Log first exposures as events, join them to metric events by user and time in a daily batch, keep only activity after each user's first exposure, and aggregate per experiment and variant into sums that the stats service can turn into confidence intervals.

**Requirements:** hundreds of concurrent experiments; daily results plus a few hourly guardrail metrics; a sample ratio mismatch (SRM) check; reproducible results when a metric definition changes.

**Estimates:** 30 million daily users in about 20 experiments each could mean 600 million assignment rows a day if logged on every app open, so log exposures and keep one row per user per experiment.

**Architecture:**
- SDK emits exposure events to Kafka, landing in S3 bronze.
- Daily Spark job builds \`exposures(experiment_id, variant, user_id, first_exposure_ts)\`.
- Join to order and session facts where the event is after first exposure and inside the analysis window.
- Write per-user metrics, then per-variant count, sum and sum of squares, so means and variances need no rescan.

**Trade-offs:** deterministic hash assignment needs no lookup table but makes overrides harder; per-user pre-aggregation is cheap but fixes the metric grain. Run the SRM check before anyone reads results, because broken randomisation invalidates everything after it.`,code:{lang:"sql",code:`SELECT e.experiment_id, e.variant,
       COUNT(*)                  AS users,
       SUM(m.orders)             AS orders,
       SUM(m.orders * m.orders)  AS orders_sq      -- for the variance
FROM exposures e
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS orders
  FROM orders o
  WHERE o.user_id = e.user_id
    AND o.order_ts >= e.first_exposure_ts
    AND o.order_ts <  e.first_exposure_ts + INTERVAL '14 days'
) m ON TRUE
GROUP BY e.experiment_id, e.variant;`},checking:"Whether you know that only post-exposure activity counts and can design aggregates that make the statistics cheap.",related:["case-experimentation-platform","funnels-and-retention","fact-table-types"]},{id:"pr-design-surge-fee-geo-cells",companies:["Swiggy","Zomato"],topic:"design",round:"design",difficulty:"hard",q:"Design a near real-time system that computes demand (orders placed) and supply (idle delivery partners) per geo-cell every 30 seconds, so pricing can add a surge fee.",a:`Map every event to a geo-cell (H3 or geohash), aggregate demand and supply per cell in short windows in a stream processor, smooth the ratio with neighbouring cells, and publish it with a TTL to a key-value store the pricing service reads.

**Requirements:** 30-second freshness; about 50 cities; tolerate a few seconds of late GPS pings; every surge value auditable later; stale data must never keep surge on.

**Estimates:** 300,000 partners pinging every 5 seconds is 60,000 pings/s plus a few thousand order events/s. A city has a few thousand active cells, so state is small; the volume is in the pings.

**Architecture:**
- Kafka topics for partner pings and order events, keyed by cell id.
- Flink or Spark: convert lat/long to an H3 cell (resolution 8 is roughly 0.7 sq km), keep the latest status per partner, count idle partners and new orders per cell per 30-second window.
- Combine each cell with its ring of neighbours, compute the multiplier, write to Redis with a 2-minute TTL.
- Raw and computed values also land in S3 for offline analysis of pricing.

**Trade-offs:** a short watermark (about 10 seconds) favours freshness over completeness, which is fine for pricing. If values expire the safe default is no surge. A stadium cell is hot but still tiny in absolute volume.`,checking:"Whether you can pick a spatial key, a window and a safe failure default for a latency-sensitive pricing input.",related:["case-surge-pricing","watermarks-late-data","kafka-partitions-ordering"]},{id:"pr-kafka-order-event-ordering",companies:["Swiggy","Zomato","Flipkart"],topic:"kafka",round:"technical",difficulty:"medium",q:"Order status events (placed, accepted, picked up, delivered) must be processed in order for each order. How do you guarantee that with Kafka?",a:"Use `order_id` as the message key so every event of an order lands in the same partition, because Kafka only guarantees order within a partition, and use an idempotent producer so retries cannot reorder writes.\n\n**Why:** the partitioner hashes the key to pick a partition, and within a consumer group each partition is read by exactly one consumer, so that consumer sees an order's events in sequence.\n\n**Gotchas:**\n- Without idempotence, a retry with several in-flight requests can reorder records. `enable.idempotence=true` keeps order with up to 5 in-flight requests. It is the default in the Java client since Kafka 3.0, but set it explicitly in librdkafka-based clients such as `confluent_kafka`.\n- librdkafka's default partitioner is not the Java murmur2 one; set `partitioner=murmur2_random` if Java and Python producers write the same topic.\n- Adding partitions remaps keys, so in-flight orders can briefly split across partitions. Size partitions up front.\n- Processing one partition on many threads loses order unless threads are sharded by key.",code:{lang:"python",code:`import json
from confluent_kafka import Producer

p = Producer({
    "bootstrap.servers": "broker:9092",
    "enable.idempotence": True,        # implies acks=all and safe retries
    "partitioner": "murmur2_random",   # same key -> partition as Java clients
    "linger.ms": 10,
    "compression.type": "lz4",
})

def send(event: dict) -> None:
    p.produce("order-status", key=event["order_id"],
              value=json.dumps(event).encode())
    p.poll(0)                          # serve delivery callbacks`},checking:"Whether you know ordering is per partition only and what can still break it.",related:["kafka-partitions-ordering","kafka-producers"]},{id:"pr-kafka-consumer-lag-sale",companies:["Flipkart","Meesho","Swiggy"],topic:"kafka",round:"technical",difficulty:"medium",q:"During a sale, consumer lag on the orders topic grows from seconds to 40 minutes. How do you find the cause and fix it?",a:"First check whether lag is on all partitions (consumers too slow overall) or on a few (hot keys or one slow instance), then add consumers up to the partition count, speed up processing, or fix the skew.\n\n**How to diagnose:**\n- `kafka-consumer-groups.sh --describe --group <g>` shows lag and owner per partition.\n- **All partitions lag:** throughput problem. Add consumers (useless beyond the partition count), batch sink writes, remove per-message synchronous DB or API calls, raise `max.poll.records` and fetch sizes.\n- **A few partitions lag:** a hot key or a slow host; check key distribution and that host's metrics.\n- **Sawtooth lag with frequent rebalances:** a poll loop that exceeds `max.poll.interval.ms` (default 5 minutes) gets the consumer kicked out. Process smaller batches, and use cooperative-sticky assignment plus static membership (`group.instance.id`) to shorten rebalance pauses.\n\n**Prevention:** provision partitions for sale peak rather than normal days, autoscale consumers on lag, and alert on lag in seconds of delay rather than raw message counts.",code:{lang:"python",code:`from confluent_kafka import Consumer, TopicPartition

c = Consumer({"bootstrap.servers": "broker:9092", "group.id": "orders-sink"})
meta = c.list_topics("orders", timeout=10).topics["orders"]
parts = [TopicPartition("orders", p) for p in meta.partitions]

for tp in c.committed(parts, timeout=10):
    low, high = c.get_watermark_offsets(tp, timeout=10)
    lag = high - tp.offset if tp.offset >= 0 else high - low
    print(f"partition {tp.partition}: lag {lag}")
c.close()`},checking:"Whether you debug lag per partition and know that consumer parallelism is capped by partitions.",related:["kafka-consumer-groups","kafka-operations","streaming-falling-behind"]},{id:"pr-kafka-no-data-loss-config",companies:["PhonePe","Razorpay","Paytm"],topic:"kafka",round:"technical",difficulty:"medium",q:"Which producer, topic and broker settings make sure an acknowledged payment event is never lost in Kafka?",a:'Use replication factor 3, `min.insync.replicas=2`, producer `acks=all` with idempotence, and keep `unclean.leader.election.enable=false`.\n\n**Why each matters:**\n- `acks=all` makes the leader wait for every in-sync replica before acknowledging.\n- `min.insync.replicas=2` means "all" is at least two copies; if the ISR shrinks below that, the producer gets a NotEnoughReplicas error instead of a silent single-copy write. The broker default is 1, which is why this setting matters.\n- RF 3 lets you lose one broker and keep accepting writes.\n- Unclean election off (the default) stops an out-of-sync replica becoming leader and truncating acknowledged data.\n\n**Producer side:** retries are bounded by `delivery.timeout.ms` (default 2 minutes). The app must handle the final failure in the delivery callback, for example by keeping the event in a transactional outbox table and re-sending.\n\n**Gotcha:** durability starts only when `produce` is called. If the service crashes after updating its database but before producing, the event is gone; the outbox pattern closes that gap.',code:{lang:"python",code:`from confluent_kafka.admin import AdminClient, NewTopic

admin = AdminClient({"bootstrap.servers": "broker:9092"})
admin.create_topics([NewTopic(
    "payments", num_partitions=24, replication_factor=3,
    config={"min.insync.replicas": "2",
            "unclean.leader.election.enable": "false"})])

producer_conf = {
    "bootstrap.servers": "broker:9092",
    "acks": "all",
    "enable.idempotence": True,
    "delivery.timeout.ms": 120000,
}`},checking:"Whether you know that durability comes from acks, ISR and replication settings together, not one flag.",related:["kafka-replication-isr","kafka-producers","kafka-delivery-semantics"]},{id:"pr-kafka-exactly-once-transactions",companies:["PhonePe","CRED"],topic:"kafka",round:"technical",difficulty:"hard",q:"A service reads wallet debit events from one Kafka topic, enriches them and writes them to another topic. How do you make it exactly-once?",a:"Use Kafka transactions: a transactional producer writes the output records and the consumer's offsets in one atomic transaction, and downstream consumers read with `isolation.level=read_committed`.\n\n**How it works:** call `init_transactions` once. For each batch: begin a transaction, produce the outputs, add the consumed offsets with `send_offsets_to_transaction`, then commit. If anything fails, abort; the outputs are never visible to read_committed readers and the batch is reprocessed from the last committed offsets. Kafka Streams gives the same with `processing.guarantee=exactly_once_v2`.\n\n**Gotchas:**\n- Exactly-once covers Kafka to Kafka only. If the step calls an external API or writes to a database, those side effects can repeat, so make them idempotent (an idempotency key on payment_id, or an upsert).\n- Each producer instance needs a stable, unique `transactional.id`.\n- read_committed consumers cannot read past an open transaction, so long transactions add end-to-end latency.\n- After an abort, seek the consumer back to the committed offsets before retrying.",code:{lang:"python",code:`p = Producer({"bootstrap.servers": B, "transactional.id": "wallet-enricher-1"})
c = Consumer({"bootstrap.servers": B, "group.id": "wallet-enricher",
              "enable.auto.commit": False, "isolation.level": "read_committed"})
c.subscribe(["wallet-debits"])
p.init_transactions()

while True:
    msgs = c.consume(num_messages=500, timeout=1.0)
    if not msgs:
        continue
    p.begin_transaction()
    try:
        for m in msgs:
            p.produce("wallet-debits-enriched", key=m.key(), value=enrich(m.value()))
        p.send_offsets_to_transaction(c.position(c.assignment()),
                                      c.consumer_group_metadata())
        p.commit_transaction()
    except Exception:
        p.abort_transaction()
        rewind_to_committed(c)          # seek back before retrying the batch`},checking:"Whether you know how Kafka transactions work and where exactly-once stops.",related:["kafka-delivery-semantics","exactly-once-checkpointing"]},{id:"pr-kafka-compacted-topic",companies:["Razorpay","Meesho"],topic:"kafka",round:"technical",difficulty:"medium",q:"When would you use a log-compacted topic instead of time-based retention? Give a data engineering example.",a:`Use compaction when consumers need the latest value per key rather than every event, for example the current settings of every merchant, so a new consumer can rebuild the full state by reading the topic from the beginning.

**How it works:** with \`cleanup.policy=compact\`, the log cleaner keeps at least the last record for each key and removes older ones in the background, only in closed segments (the active segment is never compacted). A record with a null value is a tombstone: it deletes the key and is itself removed after \`delete.retention.ms\` (default 24 hours).

**Examples:** Debezium CDC of a merchants table, Kafka Streams KTable changelog topics, and lookup data that a stream job loads to enrich events.

**Gotchas:**
- Compaction is lazy, so consumers can still see several values for a key; treat it as eventually compacted.
- Every record needs a key, or the broker rejects it.
- \`cleanup.policy=compact,delete\` adds an age limit on top of compaction.
- A consumer that is offline longer than \`delete.retention.ms\` can miss tombstones and keep deleted keys.`,checking:"Whether you understand compaction semantics, tombstones and when latest-value topics fit.",related:["kafka-retention-compaction","kafka-connect-debezium"]},{id:"pr-kafka-schema-evolution",companies:["Flipkart","Meesho","Swiggy"],topic:"kafka",round:"technical",difficulty:"medium",q:"A producer team wants to rename a field and add a new required field in the order event schema. How do you stop this from breaking consumers?",a:`Register schemas in a Schema Registry with a compatibility mode enforced on every new version (BACKWARD, the Confluent default, or FULL), and allow only compatible changes: add fields with defaults, never rename or change a type in place.

**Why:** under BACKWARD, a consumer on the new schema must be able to read data written with the old one. Adding a field with a default passes; adding a required field without a default fails registration, which is exactly the guard you want.

**Renames:** a rename is a delete plus an add. Add the new field with a default, write both for a while, move consumers over, then drop the old one (Avro aliases can help readers). In Protobuf never reuse field numbers.

**Upgrade order:** BACKWARD means upgrade consumers first, FORWARD producers first, FULL either order.

**Process:** test compatibility in CI before deploy, so a breaking change fails the build rather than the 2 AM consumer.`,code:{lang:"python",code:`from confluent_kafka.schema_registry import SchemaRegistryClient, Schema

sr = SchemaRegistryClient({"url": "http://schema-registry:8081"})
with open("schemas/order_event.avsc") as f:
    new_schema = Schema(f.read(), schema_type="AVRO")

if not sr.test_compatibility("order-events-value", new_schema):
    raise SystemExit("Incompatible schema change: blocked in CI")

# compatible addition in the .avsc:
# {"name": "coupon_code", "type": ["null", "string"], "default": null}`},checking:"Whether you treat schemas as contracts with enforced compatibility rather than hoping consumers cope.",related:["kafka-schema-registry","data-quality-and-slas"]},{id:"pr-airflow-data-interval",companies:["Flipkart","Swiggy","Meesho"],topic:"airflow",round:"technical",difficulty:"medium",q:"In Airflow 2, a DAG scheduled @daily with start_date 2026-11-01 first runs just after midnight on 2 November, not on 1 November. Why, and which date should the task use to pick its input partition?",a:"Airflow 2 runs a DAG at the end of its data interval: the run covering 1 November (00:00 to 24:00) can only start once that day is over. Its logical date is 1 November, the start of the interval, and that is the date the task should process.\n\n**Rule:** read `data_interval_start` / `data_interval_end` (or `{{ ds }}` in templates), never `datetime.now()`, so a retry or backfill of an old run reads the same partition it did the first time.\n\n**Version notes:**\n- Airflow 2 called the logical date `execution_date`, which confused everyone; Airflow 3 removes that name in favour of `logical_date`.\n- `catchup` defaults to True in Airflow 2 and to False in Airflow 3. With catchup on, a past start_date creates one run per missed interval.\n- Airflow 3 changed the default for cron schedules (presets such as @daily included) to a trigger timetable: the run fires at the cron time and its logical date is that moment, with no data interval unless you configure one. Set `create_cron_data_intervals=True` to keep the Airflow 2 behaviour, and know which one you are on before relying on `ds`.\n- Always give `start_date` a timezone (for example Asia/Kolkata), or midnight means UTC.",code:{lang:"python",code:`import pendulum
from airflow.decorators import dag, task      # Airflow 3: from airflow.sdk import dag, task

@dag(schedule="@daily", catchup=False,
     start_date=pendulum.datetime(2026, 11, 1, tz="Asia/Kolkata"))
def orders_daily():
    @task
    def load(data_interval_start=None, data_interval_end=None):
        day = data_interval_start.to_date_string()
        path = f"s3://lake/raw/orders/dt={day}/"
        print("processing", path, "interval ends", data_interval_end)

    load()

orders_daily()`},checking:"Whether you understand data intervals and logical dates, the most common Airflow scheduling confusion.",related:["airflow-scheduling-data-intervals","airflow-backfills-catchup"]},{id:"pr-airflow-idempotent-partition-load",companies:["Meesho","Razorpay","PhonePe"],topic:"airflow",round:"technical",difficulty:"medium",q:"How do you write an Airflow task that loads one day of payments into the lake so that retries, clears and backfills never create duplicates?",a:`Make each run own exactly one partition, derived from its data interval, and replace that partition atomically (partition overwrite or MERGE by key); never append.

**Rules:**
- Input and output locations come from the run's \`ds\` / data interval, not the wall clock.
- Write with Delta \`replaceWhere\`, Iceberg partition overwrite, or Spark dynamic partition overwrite, so a rerun swaps the day in one commit.
- If a day can receive late updates, MERGE on the natural key (\`payment_id\`) instead.
- Deduplicate inside the batch on the business key, because the source may resend.
- Keep side effects (emails, API calls, file moves) in separate tasks with their own guards.
- Retries with exponential backoff handle transient errors; \`depends_on_past\` only when a day needs yesterday's output.

**Gotcha:** "delete the day, then insert" as two separate statements leaves a hole (or duplicates) if the task dies in between. Use one transaction or a table format with atomic commits. In production the Spark part usually runs on EMR or Glue via an operator; the logic is the same.`,code:{lang:"python",code:`from datetime import timedelta
from pyspark.sql import functions as F

@task(retries=3, retry_delay=timedelta(minutes=5), retry_exponential_backoff=True)
def load_payments(ds=None):
    df = (spark.read.json(f"s3://raw/payments/dt={ds}/")
              .dropDuplicates(["payment_id"])
              .withColumn("dt", F.lit(ds)))
    (df.write.format("delta")
       .mode("overwrite")
       .option("replaceWhere", f"dt = '{ds}'")    # only this day is replaced
       .save("s3://lake/silver/payments"))`},checking:"Whether you design tasks that are safe to rerun, which is what makes retries and backfills safe.",related:["airflow-idempotent-tasks-retries","idempotency-and-backfills"]},{id:"pr-airflow-sensors-slots",companies:["Flipkart","PhonePe"],topic:"airflow",round:"technical",difficulty:"medium",q:"Fifty DAGs each wait for an upstream file with an S3KeySensor, and suddenly no other tasks can run. What happened and how do you fix it?",a:`Sensors in the default \`poke\` mode hold a worker slot for the whole wait, so 50 waiting sensors can fill the worker slots and pool slots and starve real work. Make them deferrable (or \`mode="reschedule"\`), give them their own pool, and set a sensible timeout.

**The three modes:**
- **poke:** occupies a slot and checks every \`poke_interval\`; fine for waits of seconds.
- **reschedule:** frees the slot between checks; the task sits in up_for_reschedule.
- **deferrable:** hands the wait to the triggerer process, which runs many async waits cheaply. Needs a triggerer running.

**Also:**
- The default sensor timeout is 7 days; set hours instead and alert on timeout, so a missing file is noticed the same morning.
- A separate \`sensors\` pool caps how many waits can exist at once.
- Better still, avoid polling: schedule on datasets/assets, or let an S3 event trigger the DAG.`,code:{lang:"python",code:`from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor

wait_for_file = S3KeySensor(
    task_id="wait_for_settlement_file",
    bucket_name="bank-drop",
    bucket_key="settlements/{{ ds }}/_SUCCESS",
    deferrable=True,          # waits in the triggerer, frees the worker slot
    poke_interval=300,
    timeout=6 * 60 * 60,      # fail after 6 hours, not the 7-day default
    pool="sensors",
)`},checking:"Whether you understand how sensors consume worker capacity and the deferrable alternative.",related:["airflow-operators-sensors-hooks","airflow-sla-monitoring"]},{id:"pr-airflow-dynamic-task-mapping",companies:["Swiggy","Zomato"],topic:"airflow",round:"technical",difficulty:"medium",q:"You need to run the same aggregation for each of about 600 cities, and the city list changes every week. How do you build this in Airflow?",a:`Use dynamic task mapping: one task returns the city list at runtime and the aggregation task is expanded over it with \`.expand()\`, so Airflow creates one mapped task instance per city without anyone editing the DAG.

**Control the fan-out:** cap concurrency with \`max_active_tis_per_dag\` on the mapped task or a pool, so 600 tasks do not hit the cluster at once. Pass only small values (city ids) through XCom, never data.

**Trade-off:** 600 tiny tasks add scheduler and startup overhead (seconds each). Often it is better to map over chunks of 20-50 cities, or run one Spark job that groups by city. Choose per-city tasks when you need per-city retries and visibility.

**Anti-pattern:** querying a database at the top level of the DAG file to build tasks. The file is re-parsed regularly (every 30 seconds by default), so that query runs constantly and slows the scheduler.`,code:{lang:"python",code:`@task
def list_cities(ds=None) -> list[str]:
    return fetch_active_cities(ds)        # a small list: fine for XCom

@task(max_active_tis_per_dag=32)
def aggregate_city(city: str, ds=None):
    run_city_rollup(city, ds)

aggregate_city.expand(city=list_cities())`},checking:"Whether you know dynamic task mapping and its cost, instead of generating tasks in top-level code.",related:["airflow-xcom-dynamic-mapping","airflow-fundamentals"]},{id:"pr-aws-msk-vs-kinesis",companies:["Meesho","CRED","Swiggy"],topic:"aws",round:"technical",difficulty:"medium",q:"On AWS, would you pick Kinesis Data Streams or Amazon MSK as the event backbone for order and app events?",a:`Pick Kinesis for a fully managed, AWS-native stream with little ops and a few consumers; pick MSK when you need the Kafka ecosystem (Connect, Debezium, Kafka Streams, Schema Registry), many consumer groups, long retention or portability.

**How they differ:**
- **Capacity:** a Kinesis shard takes 1 MB/s or 1,000 records/s in and 2 MB/s out, shared by standard consumers (enhanced fan-out gives each consumer its own 2 MB/s per shard). Kafka partitions have no fixed limit; brokers are the limit.
- **Ordering:** both per shard or partition, by key.
- **Retention:** Kinesis 24 hours by default, extendable up to 365 days; Kafka is whatever you configure, and MSK offers tiered storage.
- **Ops:** Kinesis on-demand mode scales for you; MSK provisioned means sizing brokers and storage, MSK Serverless removes most of that.
- **Integrations:** Kinesis plugs straight into Lambda, Firehose and Managed Flink.

**Cost:** it depends on volume and shape. Steady high throughput often favours MSK provisioned; spiky low volume often favours Kinesis on-demand. Estimate both for your numbers rather than quoting a rule.`,checking:"Whether you choose between managed streaming options using throughput, fan-out, ecosystem and ops cost.",related:["aws-msk-vs-kinesis","aws-kinesis-firehose","kafka-fundamentals"]},{id:"pr-aws-emr-cost-spot",companies:["Meesho","Swiggy","Flipkart"],topic:"aws",round:"technical",difficulty:"medium",q:"Your nightly EMR on EC2 cluster costs too much. Which levers do you pull without slowing the job down much?",a:`Stop paying for idle time first, then buy capacity cheaper, then make the job do less work: transient clusters, Spot for task nodes, Graviton instances, managed scaling, and fixing pruning, file sizes and skew usually give the largest savings.

**Levers:**
- **Transient clusters** that terminate after their steps (or EMR Serverless) instead of a 24x7 cluster that idles most of the day. Keep data in S3, not HDFS, so terminating is safe.
- **Spot for task nodes** (they hold no HDFS data) with on-demand primary and core nodes; use instance fleets with several instance types to reduce interruptions.
- **Graviton** (for example r7g) usually costs less per unit of work.
- **Managed scaling** with sensible minimum and maximum.
- **Job fixes:** read only needed partitions and columns, compact small files, enable AQE, right-size executors.
- **Measure** cost per run with cost allocation tags so you know what each fix saved.

**Gotcha:** Spot on core nodes risks losing HDFS and shuffle data; Spark then reruns stages, which can cost more than the discount saved.`,code:{lang:"python",code:`import boto3

emr = boto3.client("emr", region_name="ap-south-1")
emr.run_job_flow(
    Name="nightly-orders",
    ReleaseLabel="emr-7.5.0",
    Applications=[{"Name": "Spark"}],
    Instances={
        "KeepJobFlowAliveWhenNoSteps": False,          # transient cluster
        "InstanceFleets": [
            {"InstanceFleetType": "MASTER", "TargetOnDemandCapacity": 1,
             "InstanceTypeConfigs": [{"InstanceType": "m7g.xlarge"}]},
            {"InstanceFleetType": "CORE", "TargetOnDemandCapacity": 4,
             "InstanceTypeConfigs": [{"InstanceType": "r7g.2xlarge"}]},
            {"InstanceFleetType": "TASK", "TargetSpotCapacity": 16,
             "InstanceTypeConfigs": [{"InstanceType": t}
                                     for t in ("r7g.2xlarge", "r6g.2xlarge", "m7g.4xlarge")]},
        ],
    },
    Steps=nightly_steps,
    JobFlowRole="EMR_EC2_DefaultRole", ServiceRole="EMR_DefaultRole",
)`},checking:"Whether you know the main EMR cost levers and the risks of Spot on the wrong node type.",related:["aws-emr","aws-cost-monitoring","executor-sizing"]},{id:"pr-beh-production-incident",companies:["CRED","Razorpay","Flipkart"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"Tell me about a time a pipeline you owned broke in production and affected users. What did you do?",a:`A strong answer shows ownership from detection to prevention: you limited the impact fast, communicated clearly, found the root cause and changed the system so it cannot recur. A model STAR answer:

- **Situation:** our daily merchant settlement report showed 3% lower totals for one day, and finance flagged it at 9 AM, before payouts.
- **Task:** I owned the pipeline, so I had to find the gap and give finance correct numbers before the 1 PM payout cut-off.
- **Action:** I paused the downstream publish, compared hourly row counts with the source and found two hours missing: the upstream team had started writing files in two batches and our job started after the first. I reran the day (the job overwrites its partition, so this was safe) and reconciled totals with finance. Then I switched the trigger to a \`_SUCCESS\` marker and added a completeness check that blocks publishing when counts differ from the source control total by more than 0.5%.
- **Result:** corrected report by 11:30 AM, no wrong payouts, and the check caught two similar issues the next quarter.

**Tip:** use your own story with real numbers, say "I" rather than "we", and end with the permanent fix.`,checking:"Whether you own incidents end to end and fix the system, not just the symptom.",related:["data-quality-and-slas","idempotency-and-backfills"]},{id:"pr-beh-disagree-design",companies:["CRED","Meesho","Swiggy"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"Tell me about a time you disagreed with your lead or another team on a technical decision.",a:`Show that you disagreed with data rather than ego, listened, and committed once the decision was made. A model STAR answer:

- **Situation:** my lead proposed moving all 40 analytics marts to streaming because the product team had asked for "real-time" data.
- **Task:** I believed only a few dashboards needed fresh data and that 40 streaming jobs would multiply our on-call load and cost.
- **Action:** I asked each product owner which decision depended on freshness and found three that needed under 15 minutes. I wrote a one-page comparison (freshness need, estimated cost, ops effort per option) and proposed streaming for those three ops dashboards and hourly batch for the rest, with a clear path to upgrade any mart later. I presented it in the design review and asked my lead to challenge the numbers.
- **Result:** the team adopted the hybrid; running cost came in about 40% below the all-streaming estimate, and when one more mart later needed real-time we moved it within a sprint.

**Tip:** if you were overruled in your real story, say how you committed and what you learned; interviewers value that as much as being right.`,checking:"Whether you handle technical disagreement with evidence, respect and commitment to the final decision.",related:["batch-vs-streaming","design-round-framework"]}]},r=Object.freeze(Object.defineProperty({__proto__:null,default:a},Symbol.toStringTag,{value:"Module"})),n={id:"services",title:"IT services & consulting",blurb:"Large Indian IT services and consulting firms usually test SQL and Spark fundamentals, definitions and hands-on project scenarios on Azure Data Factory, Databricks, Snowflake or AWS Glue.",companies:[{name:"TCS",process:"Usually an online or virtual technical round first, then a second technical round that often digs into your current project, then a managerial and HR discussion. Candidates often report a strong focus on definitions (lazy evaluation, RDD vs DataFrame) plus one or two SQL queries written live.",focus:["SQL basics and ranking queries","Spark fundamentals","project walkthrough","Azure Data Factory and Databricks"],experience:"2-10 yrs"},{name:"Infosys",process:"Often starts with an online assessment or a technical screen, followed by a technical round with SQL and PySpark questions and a final HR or managerial round. Project-based questions on ADF, Databricks and incremental loads are often reported for experienced hires.",focus:["SQL joins and window functions","PySpark DataFrame API","incremental loads","Delta Lake basics"],experience:"3-10 yrs"},{name:"Wipro",process:"Usually one or two technical rounds followed by a managerial or HR round. Candidates often report fundamentals questions (DELETE vs TRUNCATE, narrow vs wide transformations) and a few short SQL or Python coding tasks.",focus:["SQL fundamentals","Spark concepts","Python basics","ADF pipelines"],experience:"2-8 yrs"},{name:"Accenture",process:"Usually a technical round, then a second technical or client-facing round, then a managerial or HR discussion. Scenario questions about your project architecture, Databricks optimization and Delta Lake MERGE are often reported, and some roles add a client interview.",focus:["project architecture","Spark optimization and skew","Delta Lake MERGE and SCD","window functions"],experience:"3-12 yrs"},{name:"Cognizant",process:"Often an online assessment or technical screen, then a technical round and a managerial or HR round. Candidates often report SQL queries (self joins, nth highest salary), Spark basics and questions on Azure or AWS data services used in their project.",focus:["SQL queries and indexes","Spark basics","ADF and Databricks scenarios","stored procedures"],experience:"2-10 yrs"},{name:"LTIMindtree",process:"Usually one or two technical rounds followed by a managerial or HR round. Interviews are often project-driven, with questions on incremental loads, SCD handling in Databricks, Spark skew and join output counts.",focus:["SQL join logic","Spark performance","SCD and MERGE","incremental pipelines"],experience:"3-10 yrs"},{name:"Capgemini",process:"Often starts with an online assessment or technical screen, then a technical round and a managerial or HR round, with a client round for some projects. Candidates often report questions on Spark internals, Delta Lake, schema handling and data modeling basics.",focus:["Spark internals","Delta Lake features","data modeling","pipeline failure handling"],experience:"2-10 yrs"}],questions:[{id:"sv-second-highest-salary",companies:["TCS","Infosys","Wipro"],topic:"sql",round:"technical",difficulty:"easy",q:"Write a query to find the second highest salary from an employees table.",a:"Use `DENSE_RANK()` ordered by salary descending and keep rank 2, or use `MAX(salary)` below the overall maximum.\n\n`DENSE_RANK` gives tied salaries the same rank with no gaps, so if two people earn the top salary, the next distinct salary still gets rank 2. The `MAX` version is shorter and returns `NULL` when there is no second salary, which interviewers often like.\n\nIn SQL Server you may be asked for a `TOP` version: take `SELECT DISTINCT TOP 2 salary ... ORDER BY salary DESC` and then pick the smallest of those. In PostgreSQL, `ORDER BY salary DESC OFFSET 1 LIMIT 1` on distinct salaries also works.\n\n**Gotcha:** in PostgreSQL, `NULL` sorts first in a descending order, so a `NULL` salary would take rank 1. Filter `salary IS NOT NULL` first.",code:{lang:"sql",code:`-- Option 1: window function
SELECT DISTINCT salary
FROM (
  SELECT salary,
         DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE salary IS NOT NULL
) t
WHERE rnk = 2;

-- Option 2: subquery (returns NULL if no second salary)
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);`},checking:"Whether you handle ties and NULLs instead of just sorting and taking the second row.",related:["top-n-and-dedup","window-functions","null-semantics"]},{id:"sv-nth-highest-without-limit",companies:["Cognizant","Capgemini","Accenture"],topic:"sql",round:"technical",difficulty:"medium",q:"Find the Nth highest salary without using LIMIT, TOP or window functions.",a:"Use a correlated subquery: a salary is the Nth highest when exactly N-1 distinct salaries are greater than it.\n\nFor each row in the outer query, the inner query counts how many distinct salaries are bigger. If that count is N-1, that salary sits at position N. The example below finds the 3rd highest, so it checks for 2 bigger salaries. `DISTINCT` in the outer query removes repeats when several employees share that salary.\n\nThis is the classic 'old school' answer from before window functions were common. In practice you would use `DENSE_RANK()`, which is easier to read and usually faster.\n\n**Gotcha:** the correlated subquery runs once per row, so it is O(n squared) on large tables. Mention that you know it is slow and that `DENSE_RANK` is the production choice.",code:{lang:"sql",code:`-- 3rd highest salary (N = 3, so N - 1 = 2)
SELECT DISTINCT e1.salary
FROM employees e1
WHERE 2 = (
  SELECT COUNT(DISTINCT e2.salary)
  FROM employees e2
  WHERE e2.salary > e1.salary
);`},checking:"Whether you can reason about correlated subqueries and still know the modern, faster approach.",related:["subqueries-vs-joins","top-n-and-dedup"]},{id:"sv-delete-duplicates",companies:["TCS","Infosys","LTIMindtree"],topic:"sql",round:"technical",difficulty:"medium",q:"How do you delete duplicate rows from a table but keep one copy of each?",a:"Number the rows inside each duplicate group with `ROW_NUMBER()` and delete every row whose number is greater than 1.\n\n`PARTITION BY` lists the columns that define a duplicate (here `email`), and `ORDER BY` decides which copy survives (here the lowest `id`). The delete then targets only the extra copies by their unique `id`.\n\nIn SQL Server you can delete straight from the CTE: `WITH d AS (...) DELETE FROM d WHERE rn > 1`. PostgreSQL does not allow that, so you delete by key as shown.\n\n**Gotcha:** if the table has no unique column at all, you need a physical row id (`ctid` in PostgreSQL) or you rebuild the table with `SELECT DISTINCT` into a new table and swap it. Always say which copy you keep and why.",code:{lang:"sql",code:`DELETE FROM employees
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn
    FROM employees
  ) t
  WHERE rn > 1
);`},checking:"Whether you can define what a duplicate is and control which copy survives.",related:["top-n-and-dedup","window-functions"]},{id:"sv-earning-more-than-manager",companies:["Wipro","Cognizant"],topic:"sql",round:"technical",difficulty:"easy",q:"Find employees who earn more than their manager.",a:"Join the employees table to itself: one copy as the employee, one copy as the manager, matched on `e.manager_id = m.emp_id`, then compare salaries.\n\nThis is a **self join**. The table is used twice with different aliases so each employee row sits next to its manager's row, and the `WHERE` filter keeps only rows where the employee's salary is higher.\n\nAn inner join is correct here because employees without a manager (the CEO) have nothing to compare against, so dropping them is fine.\n\n**Gotcha:** if either salary is `NULL`, the comparison is unknown and the row is silently dropped. That is usually what you want, but say it out loud.",code:{lang:"sql",code:`SELECT e.emp_name,
       e.salary,
       m.emp_name AS manager_name,
       m.salary   AS manager_salary
FROM employees e
JOIN employees m
  ON e.manager_id = m.emp_id
WHERE e.salary > m.salary;`},checking:"Whether you are comfortable with self joins and aliasing the same table twice.",related:["joins","null-semantics"]},{id:"sv-delete-truncate-drop",companies:["TCS","Infosys","Wipro"],topic:"sql",round:"online test",difficulty:"easy",q:"What is the difference between DELETE, TRUNCATE and DROP?",a:"`DELETE` removes chosen rows, `TRUNCATE` removes all rows but keeps the table, and `DROP` removes the table itself.\n\n- **DELETE** is DML. It can have a `WHERE` clause, logs each row, fires row triggers and is slower on big tables.\n- **TRUNCATE** is DDL. No `WHERE`, it deallocates the data pages, is very fast and usually resets identity counters.\n- **DROP** is DDL. It removes the data, structure, indexes and permissions. The table no longer exists.\n\n**Gotcha:** people often say 'TRUNCATE cannot be rolled back'. That depends on the database: in SQL Server and PostgreSQL a `TRUNCATE` inside an explicit transaction can be rolled back, while Oracle and MySQL commit it implicitly. Also, `TRUNCATE` is blocked in SQL Server when a foreign key references the table.",checking:"Whether you know DML vs DDL behaviour, logging and rollback rather than a memorised one-liner.",related:["mvcc-and-locking"]},{id:"sv-where-vs-having",companies:["Accenture","Capgemini"],topic:"sql",round:"online test",difficulty:"easy",q:"What is the difference between WHERE and HAVING?",a:"`WHERE` filters rows before grouping, and `HAVING` filters groups after `GROUP BY` and aggregation.\n\nSQL runs the clauses in a logical order: `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`. Because `WHERE` runs before aggregation, it cannot use `SUM` or `COUNT`. `HAVING` runs after, so it can.\n\nThe query below keeps only 2025 orders (row filter) and then only customers whose total is above 10,000 (group filter).\n\n**Gotcha:** putting a plain row condition in `HAVING` often works but is wasteful, because the database groups rows it could have thrown away earlier. Filter in `WHERE` whenever the condition does not need an aggregate.",code:{lang:"sql",code:`SELECT customer_id, SUM(amount) AS total
FROM orders
WHERE order_date >= DATE '2025-01-01'
  AND order_date <  DATE '2026-01-01'
GROUP BY customer_id
HAVING SUM(amount) > 10000;`},checking:"Whether you understand the logical order in which SQL clauses run.",related:["logical-query-order","aggregation-grouping-sets"]},{id:"sv-rank-dense-rank-row-number",companies:["TCS","Accenture","Cognizant"],topic:"sql",round:"technical",difficulty:"easy",q:"Explain RANK, DENSE_RANK and ROW_NUMBER with an example.",a:"All three number rows in a window; they differ only in how they treat ties.\n\nFor salaries 100, 100, 90:\n- `ROW_NUMBER`: 1, 2, 3. Always unique, ties broken arbitrarily.\n- `RANK`: 1, 1, 3. Ties share a rank and the next rank is skipped.\n- `DENSE_RANK`: 1, 1, 2. Ties share a rank and there is no gap.\n\nUse `ROW_NUMBER` for deduplication (keep exactly one row), `DENSE_RANK` for 'Nth highest value' questions, and `RANK` when you want competition-style ranking.\n\n**Gotcha:** with ties, `ROW_NUMBER` is not deterministic, so two runs can pick different rows. Add a tie-breaker column such as `emp_id` to the `ORDER BY`.",code:{lang:"sql",code:`SELECT emp_name,
       salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC, emp_id) AS row_num,
       RANK()       OVER (ORDER BY salary DESC)         AS rnk,
       DENSE_RANK() OVER (ORDER BY salary DESC)         AS dense_rnk
FROM employees;`},checking:"Whether you can pick the right ranking function for dedup vs top-N problems.",related:["window-functions","top-n-and-dedup"]},{id:"sv-join-counts-duplicates-nulls",companies:["Infosys","LTIMindtree","Capgemini"],topic:"sql",round:"technical",difficulty:"medium",q:"Table A has keys 1, 1, 2, NULL and table B has keys 1, 1, 1, 3, NULL. How many rows does each join return?",a:`Inner join 6, left join 8, right join 8, full outer join 10, cross join 20.

- **Inner:** only key 1 matches. 2 rows in A times 3 rows in B gives 6. \`NULL\` never equals \`NULL\`, so the NULLs do not match.
- **Left:** the 6 matches plus unmatched A rows (2 and NULL) = 8.
- **Right:** the 6 matches plus unmatched B rows (3 and NULL) = 8.
- **Full:** 6 + 2 + 2 = 10.
- **Cross:** 4 times 5 = 20.

**Gotcha:** duplicate keys multiply rows. This is exactly how a join to a non-unique table inflates revenue totals in reports. Always check that the join key is unique on at least one side.`,code:{lang:"sql",code:`WITH a(k) AS (VALUES (1), (1), (2), (NULL)),
     b(k) AS (VALUES (1), (1), (1), (3), (NULL))
SELECT
  (SELECT COUNT(*) FROM a JOIN b ON a.k = b.k)            AS inner_cnt, -- 6
  (SELECT COUNT(*) FROM a LEFT JOIN b ON a.k = b.k)       AS left_cnt,  -- 8
  (SELECT COUNT(*) FROM a RIGHT JOIN b ON a.k = b.k)      AS right_cnt, -- 8
  (SELECT COUNT(*) FROM a FULL OUTER JOIN b ON a.k = b.k) AS full_cnt,  -- 10
  (SELECT COUNT(*) FROM a CROSS JOIN b)                   AS cross_cnt; -- 20`},checking:"Whether you understand that joins multiply duplicate keys and that NULL keys never match.",related:["joins","null-semantics","join-fanout-inflated-revenue"]},{id:"sv-union-vs-union-all",companies:["Wipro","TCS"],topic:"sql",round:"online test",difficulty:"easy",q:"What is the difference between UNION and UNION ALL?",a:"`UNION` combines results and removes duplicate rows, while `UNION ALL` keeps every row, duplicates included.\n\nTo remove duplicates, `UNION` must sort or hash the whole combined result, which costs time and memory. `UNION ALL` just appends one result to the other, so it is faster. Use `UNION ALL` when you know the inputs cannot overlap (for example, data from two different years) or when duplicates are meaningful.\n\nBoth require the same number of columns with compatible types, and column names come from the first query.\n\n**Gotcha:** `UNION` also removes duplicates that exist inside a single input, not just across the two. If one table already has two identical rows, `UNION` collapses them too.",code:{lang:"sql",code:`SELECT customer_id FROM orders_2024
UNION ALL          -- keeps repeats, fast
SELECT customer_id FROM orders_2025;

SELECT customer_id FROM orders_2024
UNION              -- distinct customers across both years
SELECT customer_id FROM orders_2025;`},checking:"Whether you know the performance cost of the implicit DISTINCT in UNION.",related:["query-anti-patterns"]},{id:"sv-cte-recursive-hierarchy",companies:["Accenture","LTIMindtree"],topic:"sql",round:"technical",difficulty:"medium",q:"What is a CTE? Write a recursive CTE to show the employee hierarchy under the CEO.",a:"A CTE (`WITH` clause) is a named, temporary result set that exists only for one query; a recursive CTE refers to itself to walk a hierarchy.\n\nCTEs make long queries readable by breaking them into named steps. A recursive CTE has two parts joined by `UNION ALL`:\n- **Anchor:** the starting rows (the CEO, whose `manager_id` is NULL).\n- **Recursive part:** joins the table to the CTE to find the next level of reports, and repeats until no new rows appear.\n\nSQL Server uses plain `WITH` without the `RECURSIVE` keyword; PostgreSQL requires `WITH RECURSIVE`.\n\n**Gotcha:** bad data with a cycle (A manages B, B manages A) makes the recursion loop forever. SQL Server stops at 100 levels by default (`MAXRECURSION`); in PostgreSQL add a depth limit such as `WHERE o.lvl < 20`.",code:{lang:"sql",code:`WITH RECURSIVE org AS (
  SELECT emp_id, emp_name, manager_id, 1 AS lvl
  FROM employees
  WHERE manager_id IS NULL            -- anchor: the CEO
  UNION ALL
  SELECT e.emp_id, e.emp_name, e.manager_id, o.lvl + 1
  FROM employees e
  JOIN org o ON e.manager_id = o.emp_id
  WHERE o.lvl < 20                    -- guard against cycles
)
SELECT * FROM org
ORDER BY lvl, emp_name;`},checking:"Whether you can structure a query in steps and handle hierarchical data.",related:["ctes-recursive","subqueries-vs-joins"]},{id:"sv-indexes",companies:["Cognizant","Infosys","TCS"],topic:"sql",round:"technical",difficulty:"medium",q:"What is an index? What is the difference between a clustered and a non-clustered index?",a:"An index is a separate sorted structure (usually a B-tree) that lets the database find rows without scanning the whole table.\n\n- **Clustered index** (SQL Server term): the table rows themselves are stored in the index order. Only one per table, often the primary key.\n- **Non-clustered index:** a separate structure holding the key plus a pointer to the row. You can have many.\n\nIndexes speed up `WHERE`, `JOIN` and `ORDER BY` on the indexed columns, but they slow down inserts, updates and deletes because every index must be maintained, and they use disk.\n\nPostgreSQL has no permanent clustered index; all indexes are secondary, and `CLUSTER` only reorders the table once.\n\n**Gotcha:** wrapping the column in a function, such as `WHERE UPPER(email) = 'X'`, usually stops a normal index on `email` from being used.",code:{lang:"sql",code:`-- Speeds up lookups and joins on customer_id
CREATE INDEX idx_orders_customer ON orders (customer_id);

-- Composite index: good for WHERE customer_id = ? AND order_date >= ?
CREATE INDEX idx_orders_cust_date ON orders (customer_id, order_date);`},checking:"Whether you know the read vs write trade-off of indexes, not just the definition.",related:["btree-indexes","slow-query-missing-index","explain-query-plans"]},{id:"sv-procedure-vs-function",companies:["Cognizant","Wipro"],topic:"sql",round:"technical",difficulty:"easy",q:"What is the difference between a stored procedure and a function?",a:"A function returns a value and can be used inside a query, while a stored procedure is a program you `EXEC` or `CALL` to perform actions.\n\nTypical differences (described in SQL Server terms, which these interviews usually assume):\n- A function must return a value (scalar or table); a procedure may return nothing, or use output parameters.\n- Functions can be used in `SELECT`, `WHERE` and `JOIN`; procedures cannot.\n- Procedures can run `INSERT`, `UPDATE`, `DELETE` and manage transactions; SQL Server functions cannot change data.\n- Procedures can call functions, but functions cannot call procedures.\n- Procedures support `TRY...CATCH` error handling.\n\n**Gotcha:** in PostgreSQL the line is blurrier: functions can modify data, and procedures (added in version 11) mainly add transaction control with `COMMIT` inside the body. Mention which database you mean.",checking:"Whether you know where each can be used and what each is allowed to do.",related:["query-anti-patterns"]},{id:"sv-view-vs-materialized-view",companies:["Capgemini","Accenture"],topic:"sql",round:"technical",difficulty:"easy",q:"What is a view? How is it different from a materialized view?",a:`A view is a saved query that runs every time you select from it, while a materialized view stores the query result physically and must be refreshed.

Views are used to hide complex joins, give users a simpler interface and restrict access to certain columns or rows. They store no data, so they are always up to date but are only as fast as the underlying query.

A materialized view trades freshness for speed: reads are fast because the result is precomputed, but the data is only as current as the last refresh. They suit heavy aggregations for dashboards.

**Gotcha:** a plain view does not make a slow query faster. If someone says 'we created a view to improve performance', that only helps if it is materialized or indexed (SQL Server calls these indexed views).`,code:{lang:"sql",code:`CREATE VIEW v_active_customers AS
SELECT customer_id, name, city
FROM customers
WHERE is_active = TRUE;

CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT order_date, SUM(amount) AS total
FROM orders
GROUP BY order_date;

REFRESH MATERIALIZED VIEW mv_daily_sales;`},checking:"Whether you understand that views store logic, not data, and when precomputing pays off.",related:["aggregation-grouping-sets"]},{id:"sv-highest-salary-per-department",companies:["TCS","Cognizant"],topic:"sql",round:"technical",difficulty:"medium",q:"Find the employee(s) with the highest salary in each department, showing their names.",a:"Rank employees within each department with `RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC)` and keep rank 1.\n\nA plain `GROUP BY dept_id` with `MAX(salary)` gives the top salary but not the name, because `emp_name` is not in the group. The window function keeps every column and computes the rank per department.\n\n`RANK` (or `DENSE_RANK`) returns all employees tied at the top. If the interviewer wants exactly one per department, switch to `ROW_NUMBER` with a tie-breaker.\n\nAn alternative is to join the table to a subquery of `dept_id, MAX(salary)`; it also returns ties.\n\n**Gotcha:** asking 'what if two people share the top salary?' is the follow-up almost every time. Decide and state the tie rule.",code:{lang:"sql",code:`SELECT dept_id, emp_name, salary
FROM (
  SELECT dept_id, emp_name, salary,
         RANK() OVER (PARTITION BY dept_id
                      ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE salary IS NOT NULL
) t
WHERE rnk = 1
ORDER BY dept_id;`},checking:"Whether you know why GROUP BY cannot return the name and how window functions solve it.",related:["top-n-and-dedup","window-functions"]},{id:"sv-running-total",companies:["Infosys","Accenture"],topic:"sql",round:"technical",difficulty:"medium",q:"Write a query to calculate a running total of daily sales.",a:"Use `SUM(amount) OVER (ORDER BY sale_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`.\n\nThe window function adds up every row from the first date to the current one without collapsing rows, so each day keeps its own amount plus the cumulative total. Add `PARTITION BY region` if the total should restart per region.\n\n**Gotcha:** if you write only `ORDER BY sale_date` with no frame, the default frame is `RANGE ... CURRENT ROW`, which treats rows with the same date as peers. If a date appears twice, both rows show the same total that already includes both amounts. Spell out `ROWS` and add a unique tie-breaker when dates can repeat.",code:{lang:"sql",code:`SELECT sale_date,
       amount,
       SUM(amount) OVER (
         ORDER BY sale_date, sale_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_total
FROM daily_sales
ORDER BY sale_date, sale_id;`},checking:"Whether you know window frames and the ROWS vs RANGE default trap.",related:["window-frames","window-functions"]},{id:"sv-count-star-vs-count-column",companies:["Wipro","Capgemini"],topic:"sql",round:"online test",difficulty:"easy",q:"What is the difference between COUNT(*), COUNT(column) and COUNT(DISTINCT column)?",a:"`COUNT(*)` counts all rows, `COUNT(column)` counts rows where that column is not NULL, and `COUNT(DISTINCT column)` counts unique non-NULL values.\n\nSo on an employees table where the CEO has no manager, `COUNT(*)` includes the CEO but `COUNT(manager_id)` does not. This difference is a quick way to count missing values: `COUNT(*) - COUNT(col)`.\n\nOther aggregates behave the same way: `SUM`, `AVG`, `MIN` and `MAX` all skip NULLs. That means `AVG(bonus)` is the average of people who have a bonus, not of everyone.\n\n**Gotcha:** `COUNT(1)` is not faster than `COUNT(*)` in modern databases; they produce the same plan. Interviewers sometimes ask this to see if you repeat the myth.",code:{lang:"sql",code:`SELECT COUNT(*)                 AS all_rows,
       COUNT(manager_id)        AS rows_with_manager,
       COUNT(*) - COUNT(bonus)  AS rows_missing_bonus,
       COUNT(DISTINCT dept_id)  AS departments
FROM employees;`},checking:"Whether you understand how aggregates treat NULLs.",related:["null-semantics","aggregation-grouping-sets"]},{id:"sv-customers-without-orders",companies:["LTIMindtree","Infosys"],topic:"sql",round:"technical",difficulty:"medium",q:"Find customers who have never placed an order. Why might NOT IN return no rows?",a:"Use `NOT EXISTS` (or a `LEFT JOIN ... WHERE o.customer_id IS NULL`); avoid `NOT IN` when the subquery column can contain NULL.\n\n`NOT EXISTS` checks, for each customer, whether any matching order exists. It handles NULLs safely and databases optimise it as an anti-join.\n\n`NOT IN (subquery)` is a trap: if even one `orders.customer_id` is NULL, the condition `x NOT IN (1, 2, NULL)` becomes `x <> 1 AND x <> 2 AND x <> NULL`. The last part is unknown, so the whole condition is never true and the query returns zero rows.\n\n**Gotcha:** the `LEFT JOIN` version must test a column from the right table that is never NULL in real matches, typically its key. Testing some optional column gives wrong results.",code:{lang:"sql",code:`-- Safe: NOT EXISTS
SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o
  WHERE o.customer_id = c.customer_id
);

-- Also safe: anti-join with LEFT JOIN
SELECT c.customer_id, c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.customer_id IS NULL;`},checking:"Whether you know three-valued logic and the NOT IN with NULL trap.",related:["not-in-null-empty-result","null-semantics","subqueries-vs-joins"]},{id:"sv-lazy-evaluation",companies:["TCS","Infosys","Wipro"],topic:"spark",round:"technical",difficulty:"easy",q:"What is lazy evaluation in Spark and why is it useful?",a:"Lazy evaluation means Spark does not run transformations when you write them; it only records them in a plan and executes everything when an action is called.\n\nCalls like `filter`, `select` and `join` build a logical plan (a DAG). When you call an action such as `count()`, `show()` or `write`, the Catalyst optimizer sees the whole plan at once and can improve it: push filters down to the file scan, read only the needed columns, combine steps into one stage and pick a join strategy.\n\nIt also helps fault tolerance: because Spark knows the lineage, it can recompute a lost partition.\n\n**Gotcha:** errors show up late. A wrong column name in a transformation may only fail when the action runs, and calling several actions on the same DataFrame recomputes the whole chain each time unless you cache it.",code:{lang:"python",code:`from pyspark.sql import functions as F

df = spark.read.parquet("/lake/sales")          # nothing read yet
big = df.filter(F.col("amount") > 1000)         # still nothing
by_city = big.groupBy("city").count()           # still nothing

by_city.explain()   # shows the optimized plan
by_city.show()      # action: now Spark actually runs the job`},checking:"Whether you understand that Spark optimises the whole plan before running it.",related:["lazy-evaluation-dag","catalyst-optimizer","fault-tolerance-lineage"]},{id:"sv-rdd-dataframe-dataset",companies:["TCS","Cognizant","Capgemini"],topic:"spark",round:"technical",difficulty:"easy",q:"What is the difference between RDD, DataFrame and Dataset?",a:"An RDD is a low-level distributed collection of objects, a DataFrame is a distributed table with named columns and a schema, and a Dataset is a typed DataFrame available in Scala and Java.\n\n- **RDD:** full control with functions like `map` and `reduceByKey`, but Spark cannot see inside your functions, so there is no Catalyst optimization.\n- **DataFrame:** has a schema, so Catalyst and Tungsten optimise the plan and use compact binary memory. This is what you use in PySpark and SQL.\n- **Dataset:** adds compile-time type safety on top of DataFrames. In Scala, `DataFrame` is just `Dataset[Row]`.\n\n**Gotcha:** PySpark has no Dataset API, because Python is not statically typed. Saying 'I use Datasets in PySpark' is a common mistake. Also, converting a DataFrame to an RDD (`df.rdd`) loses the optimizer benefits.",checking:"Whether you know why DataFrames are faster and which APIs exist in PySpark.",related:["rdd-dataframe-dataset","catalyst-optimizer","tungsten-codegen"]},{id:"sv-transformations-vs-actions",companies:["Infosys","Wipro"],topic:"spark",round:"technical",difficulty:"easy",q:"What are transformations and actions? Give examples of each.",a:"Transformations create a new DataFrame from an existing one and are lazy, while actions return a result to the driver or write data and trigger execution.\n\n- **Transformations:** `select`, `filter`/`where`, `withColumn`, `groupBy().agg()`, `join`, `union`, `distinct`, `orderBy`.\n- **Actions:** `count`, `show`, `collect`, `take`, `first`, `foreach`, and `df.write...save()`.\n\nEvery action starts at least one **job**. The job is split into **stages** at shuffle boundaries, and each stage runs as many **tasks** as it has partitions.\n\n**Gotcha:** `collect()` brings all rows to the driver and can crash it with an out-of-memory error on large data. Use `show()`, `take(n)` or write to storage instead.",code:{lang:"python",code:`from pyspark.sql import functions as F

orders = spark.read.parquet("/lake/orders")

# Transformations (lazy)
paid = orders.filter(F.col("status") == "PAID")
daily = paid.groupBy("order_date").agg(F.sum("amount").alias("total"))

# Actions (trigger jobs)
print(daily.count())
daily.show(5)
daily.write.mode("overwrite").parquet("/lake/gold/daily_sales")`},checking:"Whether you can connect actions to jobs, stages and tasks.",related:["lazy-evaluation-dag","jobs-stages-tasks","driver-oom-collect"]},{id:"sv-narrow-vs-wide",companies:["Accenture","LTIMindtree"],topic:"spark",round:"technical",difficulty:"easy",q:"What is the difference between narrow and wide transformations?",a:"In a narrow transformation each output partition depends on one input partition, while in a wide transformation an output partition needs data from many input partitions, which causes a shuffle.\n\n- **Narrow:** `filter`, `select`, `withColumn`, `map`, `union`, `coalesce`. Spark chains them inside one stage with no data movement.\n- **Wide:** `groupBy`, `join` (non-broadcast), `distinct`, `orderBy`, `repartition`. Rows with the same key must travel across the network to the same partition.\n\nShuffles are expensive: they write data to disk, send it over the network and start a new stage. Reducing them is the core of most Spark tuning.\n\n**Gotcha:** a join is not always wide. If one side is small and broadcast, the join becomes narrow on the big side, which is why broadcast joins are so fast.",checking:"Whether you understand shuffles and stage boundaries.",related:["narrow-wide-transformations","shuffle-internals","jobs-stages-tasks"]},{id:"sv-repartition-vs-coalesce",companies:["TCS","Accenture","Cognizant"],topic:"spark",round:"technical",difficulty:"easy",q:"What is the difference between repartition and coalesce?",a:"`repartition(n)` does a full shuffle and can increase or decrease partitions, while `coalesce(n)` only merges existing partitions without a shuffle and can only decrease them.\n\nUse `repartition` when you need more parallelism, evenly sized partitions, or partitioning by a column, for example before a big join or a partitioned write. Use `coalesce` to cheaply cut the number of output files at the end of a job.\n\nBecause `coalesce` avoids a shuffle, partitions can end up uneven in size.\n\n**Gotcha:** `coalesce(1)` is not free. Since it is narrow, Spark may push the reduced parallelism back into earlier steps, so the whole final stage runs on one task. If the upstream work is heavy, `repartition(1)` (shuffle, then one writer) can actually be faster.",code:{lang:"python",code:`# Spread data evenly by key before a heavy join or write
df = df.repartition(200, "customer_id")

# Fewer output files at the end, no shuffle
df.coalesce(10).write.mode("overwrite").parquet("/lake/out")

print(df.rdd.getNumPartitions())`},checking:"Whether you know the shuffle cost and the side effect of coalescing too far.",related:["partitioning","small-files-compaction","shuffle-internals"]},{id:"sv-cache-vs-persist",companies:["Infosys","Capgemini"],topic:"spark",round:"technical",difficulty:"easy",q:"What is the difference between cache() and persist()?",a:"`cache()` is just `persist()` with the default storage level, while `persist()` lets you choose the level, such as `MEMORY_ONLY`, `MEMORY_AND_DISK` or `DISK_ONLY`.\n\nBoth keep a computed DataFrame around so later actions reuse it instead of recomputing the full lineage. For DataFrames the default is memory first, spilling to disk; for RDDs `cache()` means `MEMORY_ONLY`.\n\nCache when the same DataFrame is used by several actions or in a loop, for example a cleaned dataset that feeds three different aggregations.\n\n**Gotcha:** caching is lazy too. Nothing is stored until an action runs, and caching something used only once wastes executor memory and can cause spills. Call `unpersist()` when you are done.",code:{lang:"python",code:`from pyspark import StorageLevel

clean = raw.filter("amount IS NOT NULL").dropDuplicates(["order_id"])
clean.persist(StorageLevel.MEMORY_AND_DISK)
clean.count()                      # action fills the cache

by_city = clean.groupBy("city").count()
by_day = clean.groupBy("order_date").sum("amount")
by_city.show(); by_day.show()      # both reuse the cached data

clean.unpersist()`},checking:"Whether you know when caching helps and that it costs memory.",related:["caching-persistence","unified-memory-model"]},{id:"sv-broadcast-accumulator",companies:["Wipro","LTIMindtree"],topic:"spark",round:"technical",difficulty:"medium",q:"What are broadcast variables and accumulators?",a:"A broadcast variable sends a read-only value to every executor once, and an accumulator is a write-only counter that tasks add to and the driver reads.\n\n- **Broadcast variable:** useful for a small lookup dictionary used inside a UDF or `map`. Without it, the value is shipped with every task.\n- **Accumulator:** useful for counting things like bad records across the cluster. Tasks can only add; only the driver can read `.value`.\n\nDo not confuse the broadcast variable with a **broadcast join** (`F.broadcast(small_df)`), which copies a small DataFrame to each executor to avoid a shuffle.\n\n**Gotcha:** accumulator updates inside transformations can be counted twice if a task is retried or the stage is recomputed. Spark guarantees exactly-once updates only inside actions such as `foreach`.",code:{lang:"python",code:`sc = spark.sparkContext
countries = sc.broadcast({"IN": "India", "US": "United States"})
bad_rows = sc.accumulator(0)

def check(row):
    if row.amount is None:
        bad_rows.add(1)

orders.foreach(check)          # action: safe place to update
print("bad rows:", bad_rows.value)

print(countries.value["IN"])   # read on executors inside UDFs/maps`},checking:"Whether you know shared-variable semantics and the retry double-count caveat.",related:["join-strategies","fault-tolerance-lineage","spark-architecture"]},{id:"sv-client-vs-cluster-mode",companies:["TCS","Capgemini"],topic:"spark",round:"technical",difficulty:"medium",q:"What is the difference between client and cluster deploy mode? Which spark-submit options do you commonly set?",a:"In client mode the driver runs on the machine where you ran `spark-submit`; in cluster mode the driver runs inside the cluster on a worker node.\n\nClient mode suits interactive work and debugging, since logs and output appear in your terminal, but the job dies if your laptop or edge node disconnects. Cluster mode is the choice for production jobs scheduled by Airflow or ADF, because the driver lives close to the executors.\n\nCommon `spark-submit` options:\n- `--master yarn` and `--deploy-mode cluster`\n- `--num-executors`, `--executor-cores`, `--executor-memory`, `--driver-memory`\n- `--conf spark.sql.shuffle.partitions=400`\n- `--py-files` for extra Python modules, `--files` for config files\n\n**Gotcha:** on Databricks you do not use `spark-submit` day to day; cluster size and Spark configs are set on the cluster or job. Say that if your project is on Databricks.",checking:"Whether you have actually submitted jobs and know where the driver runs.",related:["cluster-managers-deploy-modes","executor-sizing","spark-architecture"]},{id:"sv-handle-data-skew",companies:["Accenture","LTIMindtree","Cognizant"],topic:"spark",round:"technical",difficulty:"hard",q:"One task in your join takes far longer than the others. How do you handle data skew?",a:`Confirm skew in the Spark UI, then fix it with broadcast joins, AQE skew handling, or salting the hot key.

Skew means a few keys hold most of the rows, so one task gets a giant partition while others finish quickly. In the Spark UI you see one task with much higher duration and shuffle read than the median.

Fixes, from simplest:
- **Broadcast** the smaller table if it fits in memory, so no shuffle happens.
- **Enable AQE** (\`spark.sql.adaptive.skewJoin.enabled\`), which splits oversized partitions automatically in Spark 3.
- **Salt** the key: add a random number 0..N-1 to the big side and replicate the small side N times, so the hot key spreads across N tasks.
- Filter out junk keys like NULL or 'UNKNOWN' before joining.

**Gotcha:** salting multiplies the small side by N, so keep N modest (for example 8-32).`,code:{lang:"python",code:`from pyspark.sql import functions as F

N = 16
big_s = big.withColumn("salt", (F.rand() * N).cast("int"))
small_s = small.crossJoin(
    spark.range(N).withColumnRenamed("id", "salt")
)

joined = big_s.join(small_s, ["customer_id", "salt"]).drop("salt")`},checking:"Whether you can diagnose skew from the UI and know more than one fix.",related:["data-skew","skewed-join-straggler","adaptive-query-execution"]},{id:"sv-csv-schema-bad-records",companies:["Infosys","TCS","Cognizant"],topic:"spark",round:"technical",difficulty:"medium",q:"How do you read a CSV with an explicit schema and handle bad or malformed records?",a:"Pass a `StructType` with `.schema()` and choose a `mode`: `PERMISSIVE` (default, keeps bad rows), `DROPMALFORMED` (drops them) or `FAILFAST` (fails the job).\n\nAn explicit schema avoids an extra pass over the data for `inferSchema` and stops types from changing between runs. In `PERMISSIVE` mode, if you add a string column named in `columnNameOfCorruptRecord`, Spark stores the raw text of bad lines there and sets the other fields to NULL. You can then split good and bad rows and write the bad ones to a quarantine folder.\n\nOn Databricks, `badRecordsPath` is another option that writes bad records to a path automatically.\n\n**Gotcha:** Spark refuses queries that reference only the corrupt-record column on a raw file. Cache the DataFrame (or save it) before filtering on that column.",code:{lang:"python",code:`from pyspark.sql.types import (StructType, StructField,
                               IntegerType, StringType, DoubleType)

schema = StructType([
    StructField("order_id", IntegerType()),
    StructField("customer", StringType()),
    StructField("amount", DoubleType()),
    StructField("_corrupt_record", StringType()),
])

df = (spark.read.option("header", True)
      .option("mode", "PERMISSIVE")
      .option("columnNameOfCorruptRecord", "_corrupt_record")
      .schema(schema)
      .csv("/landing/orders/")).cache()

bad = df.filter(df["_corrupt_record"].isNotNull())
good = df.filter(df["_corrupt_record"].isNull()).drop("_corrupt_record")
bad.write.mode("append").json("/quarantine/orders/")`},checking:"Whether you build robust ingestion that does not silently lose or crash on bad data.",related:["data-quality-tests","design-lakehouse-etl"]},{id:"sv-delta-merge-upsert",companies:["Accenture","LTIMindtree","Capgemini"],topic:"spark",round:"technical",difficulty:"medium",q:"How do you upsert new and changed records into a Delta table?",a:"Use Delta Lake `MERGE`: match source and target on the business key, update when matched and insert when not matched.\n\n`MERGE` runs as a single ACID transaction, so readers never see a half-applied load. It is the standard way to apply a daily incremental extract or CDC feed to a silver table. You can also add `whenMatchedDelete` for rows flagged as deleted in the source, and a condition on the update so unchanged rows are not rewritten.\n\n**Gotcha:** if the source has two rows for the same key, the merge fails with a 'multiple source rows matched' error. Deduplicate the source first, usually keeping the latest row per key with `ROW_NUMBER()`.",code:{lang:"python",code:`from delta.tables import DeltaTable

target = DeltaTable.forPath(spark, "/lake/silver/customers")

(target.alias("t")
   .merge(updates.alias("s"), "t.customer_id = s.customer_id")
   .whenMatchedUpdateAll(condition="s.updated_at > t.updated_at")
   .whenNotMatchedInsertAll()
   .execute())`},checking:"Whether you have done real incremental loads into Delta and know the duplicate-source failure.",related:["delta-lake-iceberg","design-cdc-merge"]},{id:"sv-delta-time-travel",companies:["Capgemini","Accenture"],topic:"spark",round:"technical",difficulty:"easy",q:"What is Delta Lake time travel and when would you use it?",a:"Time travel lets you query or restore an older version of a Delta table by version number or timestamp.\n\nEvery write to a Delta table creates a new version in the transaction log (`_delta_log`), and old data files are kept for a while. So you can:\n- Read yesterday's data to debug a bad load.\n- Compare two versions to see what changed.\n- `RESTORE` the table after a wrong `DELETE` or overwrite.\n- Reproduce a report or ML training set as of a past date.\n\n`DESCRIBE HISTORY` shows the versions, who wrote them and which operation ran.\n\n**Gotcha:** `VACUUM` deletes data files older than the retention period (7 days by default). After vacuuming, time travel to versions older than that fails, so retention is a cost vs recovery trade-off.",code:{lang:"python",code:`path = "/lake/silver/sales"

v5 = spark.read.format("delta").option("versionAsOf", 5).load(path)
old = (spark.read.format("delta")
       .option("timestampAsOf", "2026-11-01")
       .load(path))

spark.sql("DESCRIBE HISTORY silver.sales").show()
spark.sql("RESTORE TABLE silver.sales TO VERSION AS OF 5")`},checking:"Whether you know how the Delta log enables recovery and what VACUUM does to it.",related:["delta-lake-iceberg"]},{id:"sv-optimize-zorder",companies:["Accenture","Cognizant"],topic:"spark",round:"technical",difficulty:"medium",q:"What do OPTIMIZE and ZORDER do in Delta Lake?",a:"`OPTIMIZE` compacts many small files into fewer large ones, and `ZORDER BY` sorts the data inside those files so rows with similar column values sit together.\n\nStreaming and frequent small appends create thousands of tiny files, which slow reads because each file has overhead. `OPTIMIZE` rewrites them into files of around 1 GB.\n\nZ-ordering co-locates data by the chosen columns, so the min/max statistics per file become tight. A query like `WHERE customer_id = 42` can then skip most files (data skipping). Choose columns that are frequently filtered and have high cardinality.\n\n**Gotcha:** do not Z-order by a partition column; partitioning already separates it. `OPTIMIZE` also rewrites data, so it costs compute; schedule it, for example nightly. On newer Databricks runtimes, liquid clustering is the suggested replacement for partitioning plus Z-order.",code:{lang:"python",code:`# Compact and co-locate by a common filter column
spark.sql("OPTIMIZE silver.sales ZORDER BY (customer_id)")

# Only optimize recent partitions to save compute
spark.sql("""
  OPTIMIZE silver.sales
  WHERE sale_date >= current_date() - INTERVAL 7 DAYS
  ZORDER BY (customer_id)
""")`},checking:"Whether you understand the small files problem and data skipping.",related:["small-files-compaction","delta-lake-iceberg","small-files-slow-read"]},{id:"sv-partitionby-on-write",companies:["Wipro","Infosys"],topic:"spark",round:"technical",difficulty:"medium",q:"What does partitionBy do when writing data, and how do you choose the partition column?",a:"`partitionBy(col)` writes data into one folder per value, such as `order_date=2026-11-01/`, so queries filtering on that column read only the matching folders.\n\nThis is **partition pruning**: Spark skips whole directories instead of scanning everything. Pick a column that is used in most filters and has low to moderate cardinality, typically a date or a region.\n\nDo not confuse it with `repartition`, which controls in-memory partitions and the number of tasks, not folders on disk.\n\n**Gotchas:**\n- High-cardinality columns like `customer_id` create millions of tiny files.\n- `mode('overwrite')` replaces the whole table by default. To replace only the partitions present in the new data, set `spark.sql.sources.partitionOverwriteMode=dynamic` (or use Delta `replaceWhere`).",code:{lang:"python",code:`spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")

(daily_orders
   .write
   .mode("overwrite")
   .partitionBy("order_date")
   .parquet("/lake/silver/orders"))

# Reads only one folder thanks to partition pruning
spark.read.parquet("/lake/silver/orders").filter("order_date = '2026-11-01'")`},checking:"Whether you can choose a sensible partition column and avoid accidental full overwrites.",related:["writing-data","partition-pruning-pushdown","small-files-compaction"]},{id:"sv-explode-arrays",companies:["Cognizant","TCS"],topic:"spark",round:"coding",difficulty:"easy",q:"A column holds an array of items per order. How do you turn it into one row per item?",a:"Use `F.explode()`, which creates one output row for each element of the array, copying the other columns.\n\nThis is common when flattening nested JSON from APIs or event data. For arrays of structs, explode first and then select the struct fields with dot notation, like `item.sku`.\n\n`posexplode` also returns the element position, which helps when order matters.\n\n**Gotcha:** `explode` drops rows where the array is NULL or empty, so orders with no items vanish. Use `explode_outer` if you need to keep them with a NULL item.",code:{lang:"python",code:`from pyspark.sql import functions as F

orders = spark.createDataFrame(
    [(1, ["pen", "book"]), (2, ["bag"]), (3, [])],
    "order_id INT, items ARRAY<STRING>",
)

orders.select("order_id", F.explode("items").alias("item")).show()
# order 3 disappears

orders.select("order_id", F.explode_outer("items").alias("item")).show()
# order 3 kept with item = NULL`},checking:"Whether you can flatten nested data without silently losing rows.",related:["semi-structured-json"]},{id:"sv-pyspark-window-latest-record",companies:["Accenture","Infosys"],topic:"spark",round:"coding",difficulty:"medium",q:"In PySpark, keep only the latest record for each customer based on an updated_at column.",a:"Define a `Window` partitioned by `customer_id` and ordered by `updated_at` descending, add `row_number()`, and keep rows where it equals 1.\n\nThis is the PySpark version of the SQL dedup pattern and is used constantly before a MERGE into a Delta table. The window keeps all columns, unlike `groupBy` with `max`, which would return only the key and the max timestamp.\n\nWindow functions cause a shuffle by the partition column, so they are wide transformations.\n\n**Gotcha:** if two rows share the same `updated_at`, `row_number` picks one arbitrarily and results can change between runs. Add a tie-breaker column, such as an ingestion id. `dropDuplicates(['customer_id'])` is not a substitute, because it does not let you choose which row survives.",code:{lang:"python",code:`from pyspark.sql import functions as F
from pyspark.sql.window import Window

w = Window.partitionBy("customer_id").orderBy(
    F.col("updated_at").desc(), F.col("ingest_id").desc()
)

latest = (customers
          .withColumn("rn", F.row_number().over(w))
          .filter("rn = 1")
          .drop("rn"))`},checking:"Whether you can use the Window API and control which duplicate survives.",related:["aggregations-windows","top-n-and-dedup","window-functions"]},{id:"sv-explain-project-architecture",companies:["TCS","Accenture","Infosys"],topic:"pipeline",round:"managerial",difficulty:"medium",q:"Explain the architecture of your current data engineering project.",a:`Describe the flow end to end in one or two minutes: sources, ingestion, storage layers, transformation, serving, orchestration and monitoring, then your own part in it.

A typical Azure answer:
- **Sources:** SQL Server, SAP or REST APIs, plus files on SFTP.
- **Ingestion:** ADF copy activities land raw data in ADLS Gen2 (bronze), often incrementally with a watermark.
- **Transformation:** Databricks notebooks clean and deduplicate into silver Delta tables, then build aggregated gold tables or a star schema.
- **Serving:** Synapse, Databricks SQL or Snowflake for Power BI.
- **Orchestration and ops:** ADF triggers, Key Vault for secrets, alerts on failure.

Give numbers: data volume per day, number of tables, run time, SLA.

**Gotcha:** interviewers drill into whatever you mention. Only name tools you actually used, and be ready to explain one hard problem you solved.`,checking:"Whether you really built the pipeline and understand how the pieces connect.",related:["design-lakehouse-etl","delta-lake-iceberg"]},{id:"sv-incremental-load-watermark",companies:["Cognizant","Wipro","LTIMindtree"],topic:"pipeline",round:"technical",difficulty:"medium",q:"How do you implement an incremental load in Azure Data Factory?",a:`Store the last loaded value of a change column (a high watermark such as \`last_modified\`) in a control table, copy only rows newer than it, then advance it after a successful load.

A typical ADF pattern:
- A **Lookup** activity reads the old watermark for the table.
- A second Lookup reads the current max \`last_modified\` from the source (the new watermark).
- A **Copy** activity pulls rows between the old and new watermark into the lake.
- A **Stored procedure** or script activity updates the control table, only on success.

Often this is metadata-driven: a \`ForEach\` loops over a config table listing many source tables. Databricks then merges the new rows into Delta.

**Gotcha:** watermarks miss hard deletes, and rows updated without changing \`last_modified\`. Use CDC, change tracking or periodic full reconciliation for those.`,code:{lang:"sql",code:`-- 1. Old watermark (ADF Lookup)
SELECT watermark_value FROM etl.watermark WHERE table_name = 'orders';

-- 2. New watermark, captured before copying
SELECT MAX(last_modified) AS new_wm FROM src.orders;

-- 3. Copy only the changed rows
SELECT * FROM src.orders
WHERE last_modified >  :old_wm
  AND last_modified <= :new_wm;

-- 4. Advance only after the copy succeeds
UPDATE etl.watermark SET watermark_value = :new_wm
WHERE table_name = 'orders';`},checking:"Whether you can design a correct, rerunnable incremental pattern rather than just naming it.",related:["design-cdc-merge","design-lakehouse-etl"]},{id:"sv-pipeline-failure-handling",companies:["Accenture","Capgemini"],topic:"pipeline",round:"technical",difficulty:"medium",q:"Your ADF pipeline running a Databricks notebook failed at 3 AM. How do you handle failures and reruns?",a:`Make the pipeline retry transient errors, alert on real failures, and design every step to be idempotent so a rerun gives the same result.

- **Retries:** set retry count and interval on ADF activities for network or cluster start-up issues.
- **Failure paths:** use the 'on failure' dependency to log the error to an audit table and send an email or Teams alert (Logic App or webhook).
- **Diagnose:** check the ADF monitor run output, then the Databricks job run and Spark UI for the real exception: schema change, bad data, out of memory or skew.
- **Idempotent writes:** use Delta \`MERGE\` or overwrite a specific partition with \`replaceWhere\`, never blind appends, so reruns do not duplicate data.
- **Restart point:** advance watermarks only after success.

**Gotcha:** saying 'I just rerun it' is not enough. The interviewer wants to hear why rerunning is safe.`,checking:"Whether you think about idempotency and operations, not just the happy path.",related:["exactly-once-checkpointing","executor-oom-killed","design-lakehouse-etl"]},{id:"sv-scd2-delta",companies:["Infosys","LTIMindtree","Accenture"],topic:"pipeline",round:"technical",difficulty:"hard",q:"How would you implement SCD Type 2 for a customer dimension in Databricks with Delta Lake?",a:"Keep history by closing the current row (set `end_date` and `is_current = false`) when a tracked attribute changes, and inserting a new current row with the new values.\n\nEach customer can have many rows, one per version, with `start_date`, `end_date` and `is_current`. A simple two-step approach:\n- **Step 1:** `MERGE` on the business key and `is_current = true`. Expire changed rows; insert brand-new customers.\n- **Step 2:** insert a new current version for every customer that was just expired.\n\nFacts then join to the dimension on a surrogate key so they keep pointing at the version valid at the time.\n\n**Gotchas:** the two steps are two transactions; the single-`MERGE` alternative unions the changed rows with a NULL merge key so one statement does both. Use null-safe comparison (`NOT (t.city <=> s.city)`) so NULL to value changes are caught, and deduplicate the source first.",code:{lang:"sql",code:`-- Step 1: expire changed rows, insert new customers
MERGE INTO dim_customer t
USING stg_customer s
  ON t.customer_id = s.customer_id AND t.is_current = true
WHEN MATCHED AND NOT (t.city <=> s.city) THEN
  UPDATE SET is_current = false, end_date = current_date()
WHEN NOT MATCHED THEN
  INSERT (customer_id, city, start_date, end_date, is_current)
  VALUES (s.customer_id, s.city, current_date(), NULL, true);

-- Step 2: new current version for rows expired today
INSERT INTO dim_customer (customer_id, city, start_date, end_date, is_current)
SELECT s.customer_id, s.city, current_date(), NULL, true
FROM stg_customer s
JOIN dim_customer t
  ON t.customer_id = s.customer_id
WHERE t.is_current = false
  AND t.end_date = current_date()
  AND NOT EXISTS (SELECT 1 FROM dim_customer c
                  WHERE c.customer_id = s.customer_id AND c.is_current = true);`},checking:"Whether you understand SCD2 mechanics and the atomicity and NULL pitfalls in a real Delta pipeline.",related:["design-scd2-pipeline","slowly-changing-dimensions","delta-lake-iceberg"]},{id:"sv-schema-evolution",companies:["Capgemini","Cognizant"],topic:"pipeline",round:"technical",difficulty:"medium",q:"The source system added a new column and your pipeline failed. How do you handle schema changes?",a:"Decide on a policy per layer: allow additive changes automatically with Delta schema evolution, and fail loudly on breaking changes like type changes or dropped columns.\n\n- Delta rejects writes whose schema does not match the table (**schema enforcement**). That is why the job failed, and it protects the table.\n- For new columns, write with `mergeSchema` (or enable auto-merge for `MERGE`). Old rows get NULL in the new column.\n- With Databricks Auto Loader, `cloudFiles.schemaEvolutionMode` can add new columns or rescue unexpected data into a `_rescued_data` column.\n- Keep bronze flexible and silver/gold strict, with an alert when the schema changes.\n\n**Gotcha:** `mergeSchema` handles new columns, but not a column changing from string to int. That needs `overwriteSchema` and a rewrite of the table, which should be a deliberate change, not automatic.",code:{lang:"python",code:`(new_batch.write
   .format("delta")
   .mode("append")
   .option("mergeSchema", "true")     # add new columns to the table
   .save("/lake/bronze/orders"))

# For MERGE statements
spark.conf.set("spark.databricks.delta.schema.autoMerge.enabled", "true")`},checking:"Whether you balance pipeline robustness against protecting downstream tables.",related:["delta-lake-iceberg","data-quality-tests","design-lakehouse-etl"]},{id:"sv-optimize-slow-job",companies:["TCS","Cognizant","Capgemini"],topic:"pipeline",round:"technical",difficulty:"hard",q:"A Databricks job that used to take 20 minutes now takes 2 hours. How do you troubleshoot and optimize it?",a:`Find which stage got slow in the Spark UI first, then fix the specific cause instead of just adding nodes.

Checklist:
- **Data growth:** did input volume jump? Check input size per stage.
- **Skew:** one task far slower than the median? Use AQE, broadcast or salting.
- **Shuffle and spill:** large spill to disk means too few shuffle partitions or too little memory; tune \`spark.sql.shuffle.partitions\` or enable AQE coalescing.
- **Small files:** thousands of tiny files slow the scan; run \`OPTIMIZE\`.
- **Join strategy:** a broadcast join that became a sort-merge join as a table grew; check \`explain()\`.
- **Missing pruning:** filter on partition columns and select only needed columns.
- **Python UDFs:** replace with built-in functions.

**Gotcha:** always compare against a previous good run. 'It got slower' usually means something changed: data, code, cluster or configs.`,checking:"Whether you have a structured debugging method rather than random tuning.",related:["slow-after-data-growth","reading-explain-plans","spill-and-oom"]},{id:"sv-normalization",companies:["TCS","Wipro","Cognizant"],topic:"modeling",round:"technical",difficulty:"easy",q:"What is normalization? Explain 1NF, 2NF and 3NF.",a:"Normalization organises tables to remove duplicate data and update anomalies, by making every non-key column depend on the key, the whole key, and nothing but the key.\n\n- **1NF:** each column holds one atomic value, no repeating groups. A `phones` column holding '98..., 99...' breaks it.\n- **2NF:** 1NF plus no partial dependency: with a composite key like `(order_id, product_id)`, `product_name` depends only on `product_id`, so it moves to a products table.\n- **3NF:** 2NF plus no transitive dependency: if `employees` stores `dept_id` and `dept_name`, the name depends on `dept_id`, not the employee, so it moves to a departments table.\n\nOLTP systems normalise to keep writes consistent.\n\n**Gotcha:** data warehouses often denormalise on purpose (star schemas) to make reads and joins simpler and faster. Say you know when not to normalise.",checking:"Whether you can explain the normal forms with examples and know the OLTP vs OLAP trade-off.",related:["normalization","dimensional-modeling"]},{id:"sv-star-vs-snowflake",companies:["Accenture","Capgemini","Infosys"],topic:"modeling",round:"technical",difficulty:"easy",q:"What are fact and dimension tables? What is the difference between a star and a snowflake schema?",a:`A fact table stores measurable events (sales amount, quantity) with foreign keys, and dimension tables store descriptive context (customer, product, date); a star schema keeps dimensions flat, while a snowflake schema normalises them into sub-tables.

- **Star:** fact in the middle, each dimension one join away. Simple queries, fewer joins, a bit of duplicated text in dimensions. Usually preferred for BI.
- **Snowflake:** a product dimension splits into product, subcategory and category tables. Less redundancy, but more joins.

Always state the **grain** of the fact table, for example 'one row per order line'.

**Gotcha:** do not confuse the snowflake schema with the Snowflake data warehouse product. Also, mixing grains (order-level and line-level amounts in one fact) causes double counting.`,checking:"Whether you can model data for analytics and define grain.",related:["dimensional-modeling","design-ecommerce-star-schema","normalization"]},{id:"sv-python-word-frequency",companies:["TCS","Wipro","Infosys"],topic:"python",round:"coding",difficulty:"easy",q:"Write Python code to count the frequency of each word in a string.",a:"Split the string into words and count them with a dictionary or `collections.Counter`.\n\nLowercase first so 'Spark' and 'spark' count as one word. `Counter` is the short answer; the manual dictionary loop shows you understand what it does, and interviewers sometimes ask for it without imports.\n\n`dict.get(word, 0) + 1` avoids a `KeyError` for words seen the first time.\n\n**Gotcha:** `split()` with no arguments splits on any whitespace and ignores repeated spaces, but punctuation stays attached ('lazy.' vs 'lazy'). Strip punctuation if the input has it. A follow-up is often 'do the same in PySpark', which is `split`, `explode`, then `groupBy().count()`.",code:{lang:"python",code:`from collections import Counter

text = "Spark is fast and spark is lazy"
words = text.lower().split()

# Short way
print(Counter(words).most_common(2))   # [('spark', 2), ('is', 2)]

# Manual way, no imports
counts = {}
for w in words:
    counts[w] = counts.get(w, 0) + 1
print(counts)`},checking:"Whether you can write basic, clean Python with dictionaries.",related:["python-udfs-arrow"]},{id:"sv-python-list-tuple-set-dict",companies:["Cognizant","Capgemini"],topic:"python",round:"technical",difficulty:"easy",q:"What is the difference between a list, tuple, set and dictionary in Python?",a:"A list is an ordered, mutable sequence; a tuple is an ordered, immutable sequence; a set is an unordered collection of unique items; a dictionary maps unique keys to values.\n\n- **List** `[1, 2, 2]`: allows duplicates, change it with `append` or index assignment.\n- **Tuple** `(1, 2)`: cannot change after creation, slightly lighter, can be a dictionary key.\n- **Set** `{1, 2}`: fast membership checks, removes duplicates, supports union and intersection.\n- **Dict** `{'a': 1}`: fast lookup by key; keys must be hashable. Since Python 3.7, insertion order is preserved.\n\nIn data engineering you use dicts for config and column mappings, sets for checking expected vs actual columns, and lists for column lists passed to `select`.\n\n**Gotcha:** `{}` creates an empty dict, not a set. Use `set()` for an empty set.",code:{lang:"python",code:`expected = {"order_id", "customer_id", "amount"}
actual = set(df.columns)

missing = expected - actual          # set difference
extra = actual - expected
print("missing:", missing, "extra:", extra)

rename_map = {"cust_id": "customer_id"}   # dict for mappings
for old, new in rename_map.items():
    df = df.withColumnRenamed(old, new)`},checking:"Whether you know core Python data structures and can apply them to everyday pipeline tasks.",related:["data-quality-tests"]},{id:"sv-aws-glue-job-bookmarks",companies:["TCS","Cognizant","Infosys"],topic:"aws",round:"technical",difficulty:"medium",q:"What are AWS Glue job bookmarks, and how do you use them for incremental loads from S3?",a:"Job bookmarks let a Glue job remember what it has already processed, so each run reads only new data: for S3 sources Glue tracks which files it has seen, and for JDBC sources it tracks the maximum value of the bookmark key columns.\n\nHow to use them:\n- Enable with the job parameter `--job-bookmark-option job-bookmark-enable`.\n- Give every source and sink a `transformation_ctx`, and call `job.init()` at the start and `job.commit()` at the end; the commit saves the bookmark state.\n- For JDBC sources, set `jobBookmarkKeys` to an increasing column such as an id or `updated_at`.\n- To reprocess, reset the bookmark (`aws glue reset-job-bookmark`) or run once with `job-bookmark-pause`.\n\n**Gotchas:** bookmarks work with DynamicFrame reads (`from_catalog` / `from_options`), not plain `spark.read`. JDBC bookmarks see new key values but not updates to old rows or deletes. If the job fails after writing but before `job.commit()`, the next run reprocesses the same files, so make the write idempotent (overwrite the partition or MERGE) rather than a blind append.",code:{lang:"python",code:`import sys
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext

args = getResolvedOptions(sys.argv, ["JOB_NAME"])
glue = GlueContext(SparkContext.getOrCreate())
job = Job(glue)
job.init(args["JOB_NAME"], args)

orders = glue.create_dynamic_frame.from_catalog(
    database="raw", table_name="orders",
    transformation_ctx="orders_src")            # required for bookmarks

glue.write_dynamic_frame.from_options(
    frame=orders, connection_type="s3", format="parquet",
    connection_options={"path": "s3://lake/silver/orders/", "partitionKeys": ["dt"]},
    transformation_ctx="orders_sink")

job.commit()                                     # saves the bookmark state`},checking:"Whether you have actually used Glue incremental processing and know where bookmarks fall short.",related:["aws-glue-etl-jobs","cdc-and-incremental-loads"]},{id:"sv-aws-dynamicframe-vs-dataframe",companies:["Wipro","Capgemini","Accenture"],topic:"aws",round:"technical",difficulty:"easy",q:"What is the difference between a Glue DynamicFrame and a Spark DataFrame? When do you convert between them?",a:`A DynamicFrame is Glue's wrapper over Spark that does not need a fixed schema up front: each record describes itself, and a column with mixed types becomes a 'choice' type you resolve later. A DataFrame needs one schema and gives you the full Spark SQL API and the Catalyst optimizer.

Use a **DynamicFrame** for:
- reading from the Glue Data Catalog with job bookmarks;
- messy sources: \`resolveChoice\`, \`ApplyMapping\`, \`Relationalize\` for nested JSON;
- Glue connections and writers that update the catalog.

Use a **DataFrame** for joins, window functions, aggregations and anything performance-sensitive.

Typical job: read as DynamicFrame, call \`toDF()\`, transform with the DataFrame API, convert back with \`DynamicFrame.fromDF()\` and write.

**Gotcha:** convert once at the edges of the job, not back and forth between every step, and resolve choice types explicitly instead of letting a string-or-int column reach the target.`,code:{lang:"python",code:`from awsglue.dynamicframe import DynamicFrame

dyf = glue.create_dynamic_frame.from_catalog(
    database="raw", table_name="customers", transformation_ctx="cust_src")
dyf = dyf.resolveChoice(specs=[("phone", "cast:string")])   # phone came as int and string

df = dyf.toDF()                                   # full Spark API from here
df = df.dropDuplicates(["customer_id"]).filter("customer_id IS NOT NULL")

out = DynamicFrame.fromDF(df, glue, "cust_clean")`},checking:"Whether you know Glue-specific abstractions and when to drop down to plain Spark.",related:["aws-glue-etl-jobs","rdd-dataframe-dataset"]},{id:"sv-aws-crawler-vs-ddl",companies:["TCS","Infosys","LTIMindtree"],topic:"aws",round:"technical",difficulty:"medium",q:"Should you use a Glue crawler or define tables yourself? How do new daily partitions get into the Glue Data Catalog?",a:"Use crawlers to discover unknown or changing sources; for production tables with a known schema, define the table explicitly (DDL or infrastructure as code) and register partitions from the pipeline or use partition projection. Crawlers can infer wrong types, split one dataset into many tables and cost money on every run.\n\nWays to add partitions:\n- The Glue job registers them as it writes (`enableUpdateCatalog` with `partitionKeys`).\n- `ALTER TABLE ... ADD PARTITION` from Athena; `MSCK REPAIR TABLE` works but gets slow with many partitions.\n- **Partition projection** in Athena: partitions are computed from table properties, so there are no catalog lookups at all. Ideal for date-partitioned tables.\n- A scheduled crawler that crawls only new folders.\n\n**Gotchas:** crawlers create a table per folder when file schemas differ, and name columns `partition_0` when folders are not in `key=value` form. Partition projection is an Athena feature; Glue jobs and EMR reading the same table still need real catalog partitions.",code:{lang:"sql",code:`CREATE EXTERNAL TABLE raw.orders (
  order_id string, customer_id string, amount decimal(12,2), order_ts timestamp)
PARTITIONED BY (dt string)
STORED AS PARQUET
LOCATION 's3://lake/raw/orders/'
TBLPROPERTIES (
  'projection.enabled'        = 'true',
  'projection.dt.type'        = 'date',
  'projection.dt.format'      = 'yyyy-MM-dd',
  'projection.dt.range'       = '2024-01-01,NOW',
  'storage.location.template' = 's3://lake/raw/orders/dt=\${dt}/'
);`},checking:"Whether you manage the catalog deliberately instead of relying on crawlers for everything.",related:["aws-glue-catalog-crawlers","aws-athena","partition-pruning-pushdown"]},{id:"sv-aws-glue-vs-emr",companies:["Accenture","Capgemini","Cognizant"],topic:"aws",round:"technical",difficulty:"medium",q:"When would you choose AWS Glue over Amazon EMR for Spark jobs, and the other way round?",a:`Choose Glue for serverless, scheduled ETL of small to medium jobs where you want no cluster management; choose EMR when you need control (Spark configs and versions, custom libraries, engines like Hive, Trino or HBase), very large or long-running jobs, or lower cost at sustained scale with Spot.

Compare:
- **Ops:** Glue has no cluster to manage; EMR on EC2 is your cluster; EMR Serverless sits in between.
- **Cost:** Glue bills per DPU-hour (approx. $0.44 per DPU-hour, us-east-1, 2026; 1 DPU = 4 vCPU and 16 GB). EMR is the EC2 price plus an EMR charge, and Spot can cut it a lot. Heavy daily jobs are often cheaper on EMR; small or spiky jobs on Glue.
- **Startup:** recent Glue versions start in seconds to about a minute; an EMR on EC2 cluster takes several minutes unless it is already running.
- **Glue extras:** job bookmarks, catalog integration, Glue Studio, and Flex execution for non-urgent jobs at a lower price.

**Interview tip:** tie it to your project, for example 'about 40 small ingestion jobs on Glue, and the 3 TB nightly aggregation on EMR with Spot task nodes'.`,checking:"Whether you can justify a service choice with cost, control and operations, not just list both.",related:["aws-emr","aws-glue-etl-jobs","executor-sizing"]},{id:"sv-aws-s3-storage-classes",companies:["TCS","Wipro","Infosys"],topic:"aws",round:"technical",difficulty:"easy",q:"Which S3 storage classes and lifecycle rules would you use for a data lake's raw, processed and archive data?",a:`Keep frequently read processed data in S3 Standard, move raw landing data to Standard-IA once it is rarely read, archive to Glacier Deep Archive (or Flexible Retrieval) for compliance, and expire temporary data automatically with lifecycle rules.

- **Standard:** hot data, no retrieval fee.
- **Intelligent-Tiering:** for unknown or changing access; it charges a small monitoring fee per object, and objects under 128 KB are not auto-tiered.
- **Standard-IA / One Zone-IA:** cheaper storage, a per-GB retrieval fee, 30-day minimum storage charge and 128 KB minimum billable size.
- **Glacier Instant Retrieval** (millisecond reads, 90-day minimum), **Flexible Retrieval** (minutes to hours to restore, 90 days) and **Deep Archive** (hours, 180 days).
- **Lifecycle rules** transition or expire by prefix, tag or age; also expire old object versions and abort incomplete multipart uploads.

**Gotchas:** moving millions of small files to IA can cost more than it saves (minimum size and per-object transition charges). Athena cannot read Flexible Retrieval or Deep Archive objects until they are restored.`,code:{lang:"python",code:`import boto3

s3 = boto3.client("s3")
s3.put_bucket_lifecycle_configuration(
    Bucket="company-datalake",
    LifecycleConfiguration={"Rules": [
        {"ID": "raw-tiering", "Status": "Enabled", "Filter": {"Prefix": "raw/"},
         "Transitions": [{"Days": 30, "StorageClass": "STANDARD_IA"},
                         {"Days": 180, "StorageClass": "DEEP_ARCHIVE"}]},
        {"ID": "tmp-expire", "Status": "Enabled", "Filter": {"Prefix": "tmp/"},
         "Expiration": {"Days": 7}},
        {"ID": "abort-mpu", "Status": "Enabled", "Filter": {"Prefix": ""},
         "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}},
    ]},
)`},checking:"Whether you can control S3 cost with storage classes and lifecycle rules and know their minimums.",related:["aws-s3-data-lake","aws-cost-monitoring"]},{id:"sv-aws-iam-glue-access-denied",companies:["Accenture","Cognizant","Capgemini"],topic:"aws",round:"technical",difficulty:"medium",q:"Your Glue job fails with AccessDenied when writing to S3. How do IAM roles work for Glue, and what does a least-privilege policy look like?",a:"The job runs as an IAM role that Glue assumes (its trust policy allows `glue.amazonaws.com`). That role must allow the exact S3 actions on the exact bucket and prefixes, the Glue Catalog actions it uses, CloudWatch Logs, and KMS if the bucket uses a customer-managed key.\n\nDebug AccessDenied in this order:\n- Is the action allowed on the right ARN? `s3:ListBucket` applies to the bucket ARN, `GetObject` / `PutObject` to `bucket/prefix/*`.\n- Does the bucket policy have an explicit Deny (for example requiring encryption headers)? An explicit deny always wins.\n- Is the bucket encrypted with a KMS key whose key policy does not allow the role `kms:GenerateDataKey` / `kms:Decrypt`?\n- Is Lake Formation governing the table?\n- CloudTrail shows the denied call and the principal.\n\n**Least privilege:** separate read and write prefixes, no `s3:*` and no `Resource: *` for data. The AWS managed `AWSGlueServiceRole` policy covers the Glue basics; scope data access in your own policy.",code:{lang:"python",code:`import json
import boto3

policy = {"Version": "2012-10-17", "Statement": [
    {"Effect": "Allow", "Action": ["s3:ListBucket"],
     "Resource": "arn:aws:s3:::company-datalake",
     "Condition": {"StringLike": {"s3:prefix": ["raw/orders/*", "silver/orders/*"]}}},
    {"Effect": "Allow", "Action": ["s3:GetObject"],
     "Resource": "arn:aws:s3:::company-datalake/raw/orders/*"},
    {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
     "Resource": "arn:aws:s3:::company-datalake/silver/orders/*"},
    {"Effect": "Allow", "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
     "Resource": "arn:aws:kms:ap-south-1:111122223333:key/EXAMPLE-KEY-ID"},
]}

boto3.client("iam").put_role_policy(
    RoleName="glue-orders-etl", PolicyName="orders-s3-access",
    PolicyDocument=json.dumps(policy))`},checking:"Whether you can reason through IAM, bucket policies and KMS instead of granting s3:* to make it work.",related:["aws-iam-lake-formation","aws-glue-etl-jobs"]},{id:"sv-aws-redshift-copy-upsert",companies:["TCS","Infosys","LTIMindtree"],topic:"aws",round:"technical",difficulty:"medium",q:"How do you load data from S3 into Redshift efficiently, and how do you upsert changed rows?",a:"Use `COPY` from S3, never row-by-row INSERTs: it loads in parallel across all slices. Split input into multiple files (ideally a multiple of the slice count, each roughly 1 MB to 1 GB after compression) or use Parquet, and authenticate with an IAM role. To upsert, COPY into a staging table and MERGE into the target.\n\nWhy: COPY splits the work across slices, but one huge gzip CSV is read by one slice only, so the load crawls.\n\nChecks:\n- Rejected rows are in `SYS_LOAD_ERROR_DETAIL` (or `STL_LOAD_ERRORS` on provisioned clusters); `MAXERROR` tolerates a few bad rows.\n- Deduplicate the staging table on the key first: MERGE fails or misbehaves when several source rows match one target row.\n- Run the load in one transaction so readers never see half a load.\n- ANALYZE after big loads if automatic analyze has not caught up.\n\n**Gotcha:** a staging table created with `LIKE` copies the target's distribution and sort keys, which keeps the MERGE join local.",code:{lang:"sql",code:`CREATE TEMP TABLE stage_orders (LIKE analytics.orders);

COPY stage_orders
FROM 's3://company-datalake/silver/orders/dt=2026-11-23/'
IAM_ROLE 'arn:aws:iam::111122223333:role/redshift-copy'
FORMAT AS PARQUET;

MERGE INTO analytics.orders
USING stage_orders s
ON analytics.orders.order_id = s.order_id
WHEN MATCHED THEN UPDATE SET status = s.status, amount = s.amount,
                             updated_at = s.updated_at
WHEN NOT MATCHED THEN INSERT VALUES (s.order_id, s.customer_id, s.status,
                                     s.amount, s.updated_at);`},checking:"Whether you know the Redshift loading pattern that real projects use: COPY, staging and MERGE.",related:["aws-redshift","redshift-internals"]},{id:"sv-aws-lambda-s3-trigger",companies:["Wipro","Cognizant","TCS"],topic:"aws",round:"technical",difficulty:"easy",q:"A client drops CSV files into S3 at random times and wants them processed as soon as they arrive. How do you trigger processing, and when is Lambda the wrong choice?",a:`Use an S3 event notification (directly or through EventBridge) to start processing: a Lambda function for small files, or a Lambda or EventBridge rule that starts a Glue job or Step Functions workflow for big ones. Lambda is the wrong tool when work can exceed 15 minutes, needs more than 10 GB of memory, or the data is large enough to need Spark.

Details:
- Lambda limits: 15-minute maximum timeout, up to 10,240 MB of memory, up to 10 GB of \`/tmp\` storage.
- S3 events are delivered at least once, so make processing idempotent (for example record processed keys and ETags in DynamoDB).
- Filter on prefix and suffix (\`.csv\`) so output written back to the same bucket does not trigger the function again in a loop.
- A burst of files means many concurrent invocations; protect downstream systems with reserved concurrency or an SQS queue in between.
- Glue jobs have a max-concurrent-runs setting; starting too many runs fails, so batch small files or queue them.`,code:{lang:"python",code:`import urllib.parse
import boto3

glue = boto3.client("glue")

def handler(event, context):
    for rec in event["Records"]:
        bucket = rec["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(rec["s3"]["object"]["key"])
        if not key.endswith(".csv"):
            continue
        glue.start_job_run(
            JobName="client-csv-load",
            Arguments={"--input_path": f"s3://{bucket}/{key}"})`},checking:"Whether you know event-driven ingestion on AWS and the real limits of Lambda.",related:["aws-lambda-for-data","aws-step-functions-mwaa-eventbridge"]},{id:"sv-aws-glue-job-slow-oom",companies:["Accenture","Capgemini","TCS"],topic:"aws",round:"technical",difficulty:"medium",q:"A Glue Spark job that processes 500 GB has become slow and sometimes fails with out-of-memory errors. How do you troubleshoot it?",a:"Use the Spark UI, job run insights and CloudWatch metrics to find whether the cause is too little capacity, skew, small files or the driver, and then fix that cause: bigger or more workers, grouped input files, handling skewed keys, and no large `collect()` on the driver.\n\nChecks:\n- **Job run insights** and continuous logging point to the failing line and common error causes.\n- **Spark UI** (enable it with an S3 event log path) shows slow stages, straggler tasks and spill.\n- **Small files:** tens of thousands of input files slow listing and create huge task counts. For JSON and CSV on S3 use `groupFiles: inPartition` with a `groupSize`, or compact upstream.\n- **Skew:** one task far slower than the rest. AQE skew-join handling is on by default in recent Glue versions (Spark 3.3+); otherwise salt or split the hot key.\n- **Executor OOM:** move from G.1X (16 GB) to G.2X (32 GB) workers, or reduce partition size.\n- **Driver OOM:** look for `collect()`, `toPandas()` or a huge broadcast.\n- **Auto Scaling** lets Glue add workers up to your maximum only when stages need them.",code:{lang:"python",code:`dyf = glue.create_dynamic_frame.from_options(
    connection_type="s3",
    connection_options={
        "paths": ["s3://landing/clickstream/2026/11/23/"],
        "recurse": True,
        "groupFiles": "inPartition",      # combine small files per task
        "groupSize": "134217728",         # about 128 MB per group
    },
    format="json",
)`},checking:"Whether you can debug Glue with evidence and map Spark symptoms to Glue settings.",related:["aws-glue-etl-jobs","spill-and-oom","small-files-compaction"]},{id:"sv-airflow-architecture",companies:["TCS","Infosys","Wipro"],topic:"airflow",round:"technical",difficulty:"easy",q:"Explain the main components of Apache Airflow and what each one does.",a:`Airflow is an orchestrator, not a processing engine: the scheduler decides what should run, the executor and workers run tasks, the metadata database stores all state, and the web UI shows it.

- **DAG files:** Python files that define tasks and dependencies; the DAG processor parses them regularly.
- **Scheduler:** creates DAG runs from schedules, checks dependencies and queues task instances.
- **Executor:** decides how tasks run: LocalExecutor, CeleryExecutor (workers pull from a Redis or RabbitMQ queue) or KubernetesExecutor (one pod per task).
- **Workers:** run the operator code.
- **Metadata database** (PostgreSQL or MySQL): DAG runs, task states, XComs, connections, variables.
- **Triggerer:** runs deferrable operators and sensors asynchronously.
- **Webserver:** the UI. In Airflow 3 it becomes an API server, the DAG processor is always a separate component, and tasks talk to the API instead of the database directly.

On AWS, MWAA runs these for you. **Gotcha:** heavy processing inside a worker (pandas on 50 GB) is a design smell; let Airflow trigger Glue, EMR or Redshift and monitor them.`,checking:"Whether you understand what Airflow is responsible for and what it is not.",related:["airflow-fundamentals","airflow-vs-alternatives"]},{id:"sv-airflow-s3-glue-redshift-dag",companies:["Accenture","Cognizant","LTIMindtree"],topic:"airflow",round:"coding",difficulty:"medium",q:"Write an Airflow DAG that waits for a daily file in S3, runs a Glue job on it, and then loads the result into Redshift.",a:"Chain three Amazon provider operators: an `S3KeySensor` (deferrable) waits for the file, a `GlueJobOperator` runs the job and waits for it to finish, and a `RedshiftDataOperator` runs the load. Every step is parameterised by the run's date (`{{ ds }}`) so reruns and backfills are safe.\n\nPoints to mention while writing it:\n- `retries` and `retry_delay` in `default_args` for transient failures.\n- `catchup=False` unless you deliberately want past runs.\n- A timezone-aware `start_date`, so 2 AM means 2 AM IST.\n- Credentials in Airflow connections or Secrets Manager, never in the DAG file.\n- The Redshift step loads into staging and MERGEs (here inside a stored procedure), so a rerun does not duplicate rows.\n- An `on_failure_callback` for alerts.",code:{lang:"python",code:`import pendulum
from datetime import timedelta
from airflow import DAG
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor
from airflow.providers.amazon.aws.operators.glue import GlueJobOperator
from airflow.providers.amazon.aws.operators.redshift_data import RedshiftDataOperator

with DAG("orders_daily", schedule="0 2 * * *", catchup=False,
         start_date=pendulum.datetime(2026, 11, 1, tz="Asia/Kolkata"),
         default_args={"retries": 2, "retry_delay": timedelta(minutes=10)}):
    wait = S3KeySensor(task_id="wait_file", bucket_name="client-drop",
                       bucket_key="orders/{{ ds }}/orders.csv",
                       deferrable=True, timeout=4 * 3600)
    transform = GlueJobOperator(task_id="glue_transform", job_name="orders-transform",
                                script_args={"--run_date": "{{ ds }}"},
                                wait_for_completion=True)
    load = RedshiftDataOperator(task_id="load_redshift", workgroup_name="analytics",
                                database="dev", sql="CALL etl.load_orders('{{ ds }}');")
    wait >> transform >> load`},checking:"Whether you can write a realistic, rerunnable DAG with the AWS provider operators.",related:["airflow-operators-sensors-hooks","aws-step-functions-mwaa-eventbridge","aws-redshift"]},{id:"sv-airflow-retries-failures",companies:["TCS","Capgemini","Wipro"],topic:"airflow",round:"technical",difficulty:"medium",q:"How do you handle task failures in Airflow: retries, alerts and rerunning only the failed part?",a:"Set retries with a delay and exponential backoff for transient errors, alert with `on_failure_callback`, use trigger rules for clean-up tasks, and after fixing a real bug clear only the failed task and its downstream tasks so the rest of the run is not repeated.\n\n- **Retries:** `retries`, `retry_delay`, `retry_exponential_backoff`, `max_retry_delay` in `default_args`.\n- **Timeouts:** `execution_timeout` makes a hung task fail instead of running forever.\n- **Alerts:** `on_failure_callback` posts to Slack, email or SNS with the DAG, task, date and log link.\n- **Trigger rules:** the default is `all_success`; use `all_done` for clean-up that must always run, `one_failed` for an alert task.\n- **Rerun:** in the UI, clear the failed task with Downstream selected. This is only safe when tasks are idempotent.\n- **Fail fast:** raise `AirflowFailException` for errors that retries cannot fix, such as a bad schema, so you do not wait through three retries.",code:{lang:"python",code:`from datetime import timedelta
from airflow.operators.bash import BashOperator

def notify_failure(context):
    ti = context["task_instance"]
    send_slack(f"{ti.dag_id}.{ti.task_id} failed for {context['ds']}: {ti.log_url}")

default_args = {
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=30),
    "execution_timeout": timedelta(hours=2),
    "on_failure_callback": notify_failure,
}

cleanup = BashOperator(task_id="cleanup_tmp", trigger_rule="all_done",
                       bash_command="aws s3 rm --recursive s3://etl-tmp/{{ ds }}/")`},checking:"Whether you have run Airflow in production and know how to recover cleanly from failures.",related:["airflow-idempotent-tasks-retries","airflow-sla-monitoring"]},{id:"sv-airflow-xcom",companies:["Infosys","LTIMindtree"],topic:"airflow",round:"technical",difficulty:"easy",q:"What is XCom in Airflow? Can you pass a DataFrame between tasks with it?",a:`XCom (cross-communication) passes small values between tasks, such as a file path, a row count or a Glue job run id. By default XComs are stored in the metadata database, so you should not pass DataFrames or any large data through them.

Pass a reference instead: task A writes data to S3 and returns the path; task B reads from that path. With the TaskFlow API, a task's return value becomes an XCom automatically and passing it to another task creates the dependency.

Why not big data:
- Large XComs bloat the metadata database and slow the scheduler and UI.
- Tasks can run on different workers, so in-memory objects cannot be shared anyway.
- A custom XCom backend (for example object storage) can hold bigger values, but data still belongs in your lake, not in the orchestrator.`,code:{lang:"python",code:`from airflow.decorators import task     # Airflow 3: from airflow.sdk import task

@task
def extract(ds=None) -> str:
    path = f"s3://lake/tmp/orders/{ds}/part.parquet"
    write_orders_to(path, ds)
    return path                          # a small string goes into XCom

@task
def row_count(path: str) -> int:
    return count_rows(path)

row_count(extract())`},checking:"Whether you know what XCom is for and avoid using the orchestrator as a data bus.",related:["airflow-xcom-dynamic-mapping"]},{id:"sv-airflow-catchup-backfill",companies:["Accenture","TCS","Cognizant"],topic:"airflow",round:"technical",difficulty:"medium",q:"What do catchup and backfill mean in Airflow? The client asks you to reload the last 30 days. How do you do it?",a:"Catchup makes the scheduler create runs for every missed interval between the start date (or the last run) and now; a backfill is a deliberate run of a DAG over a chosen past date range. To reload 30 days, run a backfill for that range with limited concurrency, relying on tasks that overwrite their own date partition.\n\nHow:\n- Airflow 2: `airflow dags backfill -s 2026-10-25 -e 2026-11-23 orders_daily` (add `--reset-dagruns` to rerun runs that already exist).\n- Airflow 3: backfills are managed by the scheduler; create one from the UI or with `airflow backfill create --dag-id orders_daily --from-date ... --to-date ...`.\n- Set `max_active_runs` (for example 3) so the cluster and Redshift are not flooded; use `depends_on_past=True` if each day needs the previous one.\n\n**Gotchas:** catchup defaults to True in Airflow 2 and False in Airflow 3, so a new DAG with an old start date in Airflow 2 can fire hundreds of runs at once. Tasks that use `now()` instead of `{{ ds }}` load the wrong data during a backfill.",checking:"Whether you can reprocess history safely and know the difference between catchup and backfill.",related:["airflow-backfills-catchup","airflow-scheduling-data-intervals","idempotency-and-backfills"]},{id:"sv-kafka-basics",companies:["TCS","Infosys","Wipro","Cognizant"],topic:"kafka",round:"technical",difficulty:"easy",q:"Explain Kafka topics, partitions, offsets and consumer groups.",a:`A topic is a named stream of records split into partitions; each partition is an ordered, append-only log where every record has an increasing offset; consumers with the same group id share a topic's partitions so that each partition is read by only one consumer in that group.

- **Ordering** is guaranteed only within a partition; records with the same key go to the same partition.
- **Parallelism:** the useful number of consumers in a group is at most the number of partitions; extras sit idle.
- **Independent groups:** a lake loader and a fraud service each read the full topic in their own group.
- **Offsets:** consumers commit their position (stored in the internal \`__consumer_offsets\` topic) and resume from it after a restart.
- **Retention:** records stay for a configured time or size (7 days by default), whether or not anyone read them.
- **Replication:** each partition has a leader and follower replicas on other brokers.
- **Metadata:** modern Kafka uses KRaft; ZooKeeper is removed in Kafka 4.0.`,code:{lang:"python",code:`from confluent_kafka import Consumer

c = Consumer({"bootstrap.servers": "broker:9092", "group.id": "lake-loader",
              "auto.offset.reset": "earliest", "enable.auto.commit": False})
c.subscribe(["orders"])

while True:
    msg = c.poll(1.0)
    if msg is None or msg.error():
        continue
    write_to_lake(msg.value())
    c.commit(message=msg)        # commit after the write: at-least-once`},checking:"Whether you have the Kafka vocabulary right before deeper questions on ordering and delivery.",related:["kafka-fundamentals","kafka-consumer-groups"]},{id:"sv-design-aws-batch-project",companies:["Accenture","TCS","Cognizant","Infosys"],topic:"design",round:"design",difficulty:"medium",q:"Walk me through an end-to-end AWS batch pipeline you would build (or have built): sources, S3 layers, Glue, Redshift, orchestration and monitoring, with numbers.",a:`Answer it like a small design: one sentence on the business purpose, then requirements and numbers, the flow, and how you handled failures, quality and cost.

- **Requirements:** for example 25 tables from an on-prem Oracle database and 6 daily vendor files; reports ready by 7 AM IST; 3 years of history.
- **Estimates:** about 40 GB of new data a day, about 15 TB in Parquet in total; 30 Glue jobs, the largest about 20 minutes on 10 G.1X workers.
- **Architecture:** DMS (full load plus CDC) and vendor drops into S3 raw, partitioned by load date; Glue jobs to silver (typed, deduplicated, CDC merged into Iceberg); gold marts loaded into Redshift with COPY and MERGE; the Glue Data Catalog for Athena ad-hoc queries; MWAA (or Step Functions) orchestrating with sensors and retries.
- **Quality and ops:** row-count and amount reconciliation per table per day, freshness alarms in CloudWatch to SNS, bad rows quarantined, one IAM role per job, KMS encryption.
- **Trade-offs:** Glue over EMR because jobs are small; Redshift over Athena for BI concurrency; incremental loads over full reloads.

Be ready for 'what was the hardest bug?' and 'what would you change now?'.`,checking:"Whether you can explain a real AWS architecture with numbers and reasons, not a list of services.",related:["design-lakehouse-etl","aws-glue-etl-jobs","aws-redshift","aws-dms-cdc"]},{id:"sv-design-onprem-to-aws-migration",companies:["Accenture","Capgemini","LTIMindtree","Infosys"],topic:"design",round:"design",difficulty:"hard",q:"A client wants to move an on-prem Informatica and Oracle warehouse (20 TB, 800 workflows) to AWS. How would you plan and execute it?",a:`Phase it: assess and inventory, build the landing zone and reusable frameworks, migrate history, then move workflows wave by wave with a parallel run and automated reconciliation before each cutover.

- **Assess:** inventory workflows, sources, schedules and consumers; retire what nobody uses; group the rest into waves by subject area.
- **Target:** S3 lake (raw, silver, gold) with Redshift or Athena for serving, Glue or EMR for transforms, MWAA for orchestration, Glue Catalog and Lake Formation for governance.
- **Data movement:** 20 TB over a 1 Gbps link is about 2 days at full speed, so plan a week; use DMS full load or bulk exports for history, then DMS CDC to stay in sync until cutover.
- **ETL conversion:** rebuild Informatica mappings as PySpark or SQL on a few reusable templates (incremental load, SCD2, file ingest) rather than translating 800 workflows one by one; conversion tools help but need review.
- **Validation:** counts, sums and row hashes per table per day during a 2-4 week parallel run, signed off by the business.
- **Cutover and rollback:** switch reports per wave; keep the old system read-only until sign-off.

**Trade-offs:** lift-and-shift is faster, modernising is cleaner; parallel running costs more but limits risk.`,checking:"Whether you can plan a migration with waves, validation and rollback, which services companies deliver constantly.",related:["case-warehouse-migration","aws-dms-cdc","data-quality-and-slas"]},{id:"sv-beh-project-challenge",companies:["TCS","Infosys","Wipro","Cognizant"],topic:"behavioural",round:"managerial",difficulty:"easy",q:"What was the biggest technical challenge in your last project, and how did you solve it?",a:`Pick one specific problem, explain your own actions with numbers, and end with the measurable result and what you learned. A model STAR answer:

- **Situation:** our daily Glue job loading about 300 million card transactions into Redshift for a banking client took 5 hours and missed the 6 AM SLA twice a week.
- **Task:** I was asked to bring it under 2 hours without increasing cost.
- **Action:** the Spark UI showed most of the time in one stage: a join skewed on a default merchant id ('UNKNOWN'), plus about 40,000 small input files. I grouped the input files, handled the UNKNOWN key separately, broadcast the small merchant table, and replaced row-by-row Redshift inserts with S3 plus COPY into a staging table and a MERGE.
- **Result:** runtime fell from 5 hours to about 70 minutes, DPU-hours dropped about 35%, and there were no SLA misses the next quarter. I documented the pattern and two other jobs adopted it.

**Tips:** say 'I', not 'we'; keep the client generic if you are under NDA; expect follow-ups on every step you mention.`,checking:"Whether you really did the work you describe and can go deep on it.",related:["data-skew","aws-redshift","small-files-compaction"]},{id:"sv-beh-changing-requirements",companies:["Accenture","Capgemini","LTIMindtree"],topic:"behavioural",round:"managerial",difficulty:"medium",q:"The client changes requirements a week before go-live. How do you handle it?",a:`Clarify the change and the business reason, assess the impact on effort, risk and timeline, present options to the client and your manager, get the decision in writing, and protect quality. A model STAR answer:

- **Situation:** a week before go-live of a sales mart, the client asked to report revenue net of returns instead of gross, and to add a new region hierarchy.
- **Task:** as module lead I had to assess the change and protect the go-live date if possible.
- **Action:** I met the business analyst the same day to pin down the definition (returns within 30 days, booked on the return date). I estimated two days for net revenue (one gold model plus test cases) and about six days for the hierarchy, because no source mapping existed. I proposed going live on the planned date with net revenue and delivering the hierarchy in the next sprint, recorded in a change request.
- **Result:** the client agreed, go-live happened on time with reconciled numbers, and the hierarchy shipped two weeks later.

**What they look for:** neither a blind 'yes' with silent overtime nor a flat 'no', but options based on impact and written change control.`,checking:"Whether you can manage client scope changes professionally without hurting delivery quality.",related:["semantic-layer-metrics"]}]},i=Object.freeze(Object.defineProperty({__proto__:null,default:n},Symbol.toStringTag,{value:"Module"})),d=Object.freeze(Object.defineProperty({__proto__:null},Symbol.toStringTag,{value:"Module"}));export{o as a,s as b,r as p,i as s,d as t};
