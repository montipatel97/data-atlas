const o=[{id:"lab-customers-without-orders",title:"Customers who never ordered",difficulty:"easy",topic:"joins",tags:["anti-join","NOT EXISTS","LEFT JOIN"],tables:["customers","orders"],prompt:"Return every customer who has **no order at all** (any status). Columns: `customer_id`, `name`. Row order does not matter.",starter:`SELECT c.customer_id, c.name
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id`,solution:`SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)`,hints:["An inner join can only return customers that DO have orders. You need an anti-join.","Either `NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)` or `LEFT JOIN orders ... WHERE o.order_id IS NULL`."],explanation:"This is an anti-join: keep the left rows with no match on the right. `NOT EXISTS` and `LEFT JOIN … WHERE right_key IS NULL` both compile to an anti-join in most engines. Avoid `NOT IN (SELECT customer_id FROM orders)` as a habit: it happens to work here because `orders.customer_id` has no NULLs, but a single NULL in the subquery makes `NOT IN` return no rows at all."},{id:"lab-orphan-orders",title:"Orphan orders",difficulty:"easy",topic:"joins",tags:["anti-join","referential integrity","orphans"],tables:["orders","customers"],prompt:"Some orders reference a `customer_id` that does not exist in `customers`. Return those orders: `order_id`, `customer_id`, `total_amount`. Row order does not matter.",starter:`SELECT o.order_id, o.customer_id, o.total_amount
FROM orders o
WHERE o.customer_id IS NULL`,solution:`SELECT o.order_id, o.customer_id, o.total_amount
FROM orders o
LEFT JOIN customers c ON c.customer_id = o.customer_id
WHERE c.customer_id IS NULL`,hints:["The orphan rows have a non-NULL `customer_id`; it just points nowhere.","LEFT JOIN `customers` and keep the rows where the customer side is NULL."],explanation:"Orphan detection is the anti-join pointed the other way: fact rows without a dimension row. Test `c.customer_id IS NULL` (the joined side), not `o.customer_id IS NULL`. Warehouses rarely enforce foreign keys (Snowflake and BigQuery accept them as informational only), so a test like this belongs in every pipeline."},{id:"lab-close-to-manager-salary",title:"Employees paid almost as much as their manager",difficulty:"medium",topic:"joins",tags:["self-join","hierarchy"],tables:["employees"],prompt:"Nobody in this company earns more than their direct manager, so find the next best thing: employees whose salary is **at least 80%** of their direct manager's salary. Columns: `employee_name`, `manager_name`, `employee_salary`, `manager_salary`, `pct_of_manager` (100 * employee / manager, rounded to 2 decimals). Ignore anyone whose salary or whose manager's salary is NULL. Order by `pct_of_manager` descending, then `employee_name` ascending.",starter:`SELECT e.name, m.name, e.salary, m.salary
FROM employees e
JOIN employees m ON m.employee_id = e.employee_id`,solution:`SELECT e.name AS employee_name,
       m.name AS manager_name,
       e.salary AS employee_salary,
       m.salary AS manager_salary,
       round(100.0 * e.salary / m.salary, 2) AS pct_of_manager
FROM employees e
JOIN employees m ON m.employee_id = e.manager_id
WHERE e.salary >= 0.8 * m.salary
ORDER BY pct_of_manager DESC, employee_name`,ordered:!0,hints:["Join `employees` to itself: one alias for the employee, one for the manager.","The join condition is `m.employee_id = e.manager_id`. Comparisons with a NULL salary are never true, so those rows drop out on their own."],explanation:'The classic "earns more than their manager" is a self-join on `e.manager_id = m.employee_id` plus a comparison of the two salary columns; here the threshold is 80% because the data has no outright inversions. Roots (no manager) disappear with the inner join, which is what we want. Multiply by `100.0` (or cast) before dividing so integer arithmetic can never truncate.'},{id:"lab-revenue-and-units-no-fanout",title:"Revenue and units per customer, without fan-out",difficulty:"medium",topic:"joins",tags:["fan-out","pre-aggregation","grain"],tables:["customers","orders","order_items"],prompt:"For each existing customer (ignore orphan orders) with at least one **completed** order, return `customer_id`, `completed_orders` (number of completed orders), `revenue` (sum of `orders.total_amount` over completed orders) and `units` (sum of `order_items.quantity` over those orders). Row order does not matter.",starter:`SELECT o.customer_id,
       count(*) AS completed_orders,
       sum(o.total_amount) AS revenue,
       sum(i.quantity) AS units
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'completed'
GROUP BY o.customer_id`,solution:`WITH items AS (
  SELECT order_id, sum(quantity) AS units
  FROM order_items
  GROUP BY order_id
)
SELECT o.customer_id,
       count(*) AS completed_orders,
       sum(o.total_amount) AS revenue,
       sum(i.units) AS units
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN items i ON i.order_id = o.order_id
WHERE o.status = 'completed'
GROUP BY o.customer_id`,hints:["Run the starter and compare `completed_orders` with a plain `count(*)` of completed orders for one customer. Why is it bigger?","Joining orders to order_items produces one row per line, so header columns are repeated. Aggregate `order_items` to one row per `order_id` first, then join."],explanation:"The starter fans out: every order appears once per line item, so `count(*)` and `sum(total_amount)` are multiplied by the number of lines. Fix the grain before joining by pre-aggregating the child table to the parent key. `count(DISTINCT o.order_id)` would fix the count but not the revenue sum; `sum(DISTINCT total_amount)` is wrong whenever two orders share an amount."},{id:"lab-ordered-but-never-completed",title:"Customers who ordered but never completed",difficulty:"easy",topic:"subqueries-vs-joins",tags:["semi-join","anti-join","EXISTS"],tables:["customers","orders"],prompt:"Return customers (from `customers`) who have placed at least one order but **none** of their orders has status `completed`. Columns: `customer_id`, `name`, `orders_placed` (all their orders). Row order does not matter.",starter:`SELECT c.customer_id, c.name, count(*) AS orders_placed
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status <> 'completed'
GROUP BY c.customer_id, c.name`,solution:`SELECT c.customer_id, c.name, count(*) AS orders_placed
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.name
HAVING count(*) FILTER (WHERE o.status = 'completed') = 0`,hints:["Filtering `WHERE status <> 'completed'` keeps customers who have SOME non-completed order, which is a different question.","Group per customer and test the whole group: `HAVING count(*) FILTER (WHERE o.status = 'completed') = 0`, or use `NOT EXISTS` for a completed order."],explanation:"\"None of their orders\" is a statement about the whole group, so it belongs in `HAVING` (or in a `NOT EXISTS` anti-join), not in a row-level `WHERE`. The portable form of the filter is `sum(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) = 0`."},{id:"lab-department-headcount-unassigned",title:"Headcount and payroll per department, including unassigned",difficulty:"medium",topic:"joins",tags:["FULL OUTER JOIN","COALESCE","NULL"],tables:["departments","employees"],prompt:"Return one row per department plus one row named `Unassigned` for employees whose `department_id` is NULL. Columns: `department` (department name or `Unassigned`), `headcount` (employees, 0 if none) and `payroll` (sum of salaries, treating a NULL salary as 0, and 0 for a department with no employees). Row order does not matter.",starter:`SELECT d.name AS department, count(*) AS headcount, sum(e.salary) AS payroll
FROM departments d
JOIN employees e ON e.department_id = d.department_id
GROUP BY d.name`,solution:`SELECT coalesce(d.name, 'Unassigned') AS department,
       count(e.employee_id) AS headcount,
       coalesce(sum(coalesce(e.salary, 0)), 0) AS payroll
FROM departments d
FULL OUTER JOIN employees e ON e.department_id = d.department_id
GROUP BY coalesce(d.name, 'Unassigned')`,hints:["An inner join drops the contractor with a NULL `department_id`. Which join keeps unmatched rows from both sides?","Use `FULL OUTER JOIN`, label the missing side with `coalesce(d.name, 'Unassigned')`, and remember that `sum()` over only NULLs is NULL, not 0."],explanation:"A `FULL OUTER JOIN` keeps departments without employees and employees without a department. The contractor has both a NULL department and a NULL salary, so a plain `sum(e.salary)` for `Unassigned` returns NULL: aggregates skip NULLs and return NULL when nothing is left. Wrap with `coalesce` and count `e.employee_id` rather than `*`."}],s=Object.freeze(Object.defineProperty({__proto__:null,default:o},Symbol.toStringTag,{value:"Module"})),a=[{id:"lab-monthly-completed-revenue",title:"Completed revenue by month",difficulty:"easy",topic:"aggregation-grouping-sets",tags:["GROUP BY","date_trunc"],tables:["orders"],prompt:"For **completed** orders, return one row per calendar month of `order_date`: `month` (the first day of the month, as a date), `orders` (count) and `revenue` (sum of `total_amount`). Order by `month`.",starter:`SELECT order_date, count(*) AS orders, sum(total_amount) AS revenue
FROM orders
GROUP BY order_date`,solution:`SELECT CAST(date_trunc('month', order_date) AS DATE) AS month,
       count(*) AS orders,
       sum(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1`,ordered:!0,hints:["Bucket each date to its month with `date_trunc('month', order_date)`.","Filter to `status = 'completed'` in `WHERE`, group by the truncated date and order by it."],explanation:"`date_trunc` maps every date to the start of its bucket, so grouping by it gives one row per month. Grouping by `extract(month …)` alone would merge the same month of different years; it is safe here only because the data covers 2024. In SQL Server use `DATETRUNC` (2022+) or `DATEFROMPARTS(YEAR(d), MONTH(d), 1)`."},{id:"lab-pivot-revenue-by-channel",title:"Pivot monthly revenue by channel",difficulty:"medium",topic:"aggregation-grouping-sets",tags:["pivot","FILTER","conditional aggregation"],tables:["orders"],prompt:"For **completed** orders, return one row per month with revenue split by channel: `month` (first day of the month), `web`, `app`, `store` (sum of `total_amount` for that channel, **0** when there is none) and `total`. Order by `month`.",starter:`SELECT CAST(date_trunc('month', order_date) AS DATE) AS month, channel, sum(total_amount)
FROM orders
WHERE status = 'completed'
GROUP BY 1, 2
ORDER BY 1`,solution:`SELECT CAST(date_trunc('month', order_date) AS DATE) AS month,
       coalesce(sum(total_amount) FILTER (WHERE channel = 'web'), 0)   AS web,
       coalesce(sum(total_amount) FILTER (WHERE channel = 'app'), 0)   AS app,
       coalesce(sum(total_amount) FILTER (WHERE channel = 'store'), 0) AS store,
       sum(total_amount) AS total
FROM orders
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1`,ordered:!0,hints:["One output column per channel means one aggregate per channel, each looking at only its own rows.","Use `sum(total_amount) FILTER (WHERE channel = 'web')` or `sum(CASE WHEN channel = 'web' THEN total_amount ELSE 0 END)`. A filtered sum with no rows is NULL, so wrap it in `coalesce`."],explanation:"Conditional aggregation is the portable pivot: group by the row key and compute one filtered aggregate per output column. `FILTER (WHERE …)` is standard SQL (PostgreSQL, DuckDB, SQLite); everywhere else use `CASE` inside the aggregate. Snowflake, Databricks, SQL Server and DuckDB also have a `PIVOT` clause, but it still needs the column list spelled out (or a dynamic SQL step)."},{id:"lab-category-share-of-revenue",title:"Percent of total revenue by category",difficulty:"medium",topic:"aggregation-grouping-sets",tags:["percent of total","window over aggregate","NULL label"],tables:["order_items","orders","products"],prompt:"Line revenue is `quantity * unit_price * (1 - discount)`. Over lines of **completed** orders, return per product category: `category` (use `Uncategorized` for a NULL category), `revenue` (rounded to 2 decimals) and `pct_of_total` (100 * category revenue / revenue of all categories, rounded to 2 decimals, computed from the unrounded sums). Order by `revenue` descending.",starter:`SELECT p.category, sum(i.quantity * i.unit_price) AS revenue
FROM order_items i
JOIN products p ON p.product_id = i.product_id
GROUP BY p.category`,solution:`SELECT coalesce(p.category, 'Uncategorized') AS category,
       round(sum(i.quantity * i.unit_price * (1 - i.discount)), 2) AS revenue,
       round(100.0 * sum(i.quantity * i.unit_price * (1 - i.discount))
             / sum(sum(i.quantity * i.unit_price * (1 - i.discount))) OVER (), 2) AS pct_of_total
FROM order_items i
JOIN orders o   ON o.order_id = i.order_id
JOIN products p ON p.product_id = i.product_id
WHERE o.status = 'completed'
GROUP BY coalesce(p.category, 'Uncategorized')
ORDER BY revenue DESC`,ordered:!0,hints:["Join the lines to `orders` for the status filter and to `products` for the category.","A window function runs after `GROUP BY`, so `sum(sum(x)) OVER ()` is the grand total of the per-group sums."],explanation:"The windowed aggregate `sum(sum(x)) OVER ()` divides each group by the grand total in a single pass; the alternative is a CTE of per-category sums cross-joined with its own total. Two traps: forgetting the discount, and grouping by the raw `category` and labelling afterwards (fine here, but grouping by the label makes the NULL bucket explicit)."},{id:"lab-median-order-value-by-channel",title:"Median vs mean order value by channel",difficulty:"medium",topic:"aggregation-grouping-sets",tags:["median","percentile_cont","ordered-set aggregate"],tables:["orders"],prompt:"For **completed** orders, return per `channel`: `channel`, `orders`, `mean_value` (average `total_amount`) and `median_value` (the continuous median, i.e. the average of the two middle values for an even count), both rounded to 2 decimals. Row order does not matter.",starter:`SELECT channel, count(*) AS orders, round(avg(total_amount), 2) AS mean_value
FROM orders
WHERE status = 'completed'
GROUP BY channel`,solution:`SELECT channel,
       count(*) AS orders,
       round(avg(total_amount), 2) AS mean_value,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount), 2) AS median_value
FROM orders
WHERE status = 'completed'
GROUP BY channel`,hints:["The median is an ordered-set aggregate: `percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount)`.","`percentile_disc` returns an actual row value (no averaging), which differs for even counts. The prompt asks for the continuous version."],explanation:"`percentile_cont(0.5)` interpolates between the two middle rows; `percentile_disc(0.5)` picks the first value whose cumulative share reaches 0.5. DuckDB also has `median()`, BigQuery uses `PERCENTILE_CONT(x, 0.5) OVER (PARTITION BY …)` (analytic only) or `APPROX_QUANTILES`. Without either, the portable fallback is to number rows with `row_number()` and `count(*) OVER` and average the middle one or two."},{id:"lab-bought-every-electronics-product",title:"Customers who bought every Electronics product",difficulty:"medium",topic:"aggregation-grouping-sets",tags:["relational division","HAVING","COUNT DISTINCT"],tables:["orders","order_items","products","customers"],prompt:"Return customers who, across their **completed** orders, have bought **every** product whose category is `Electronics` (do not hard-code the product ids or how many there are). Columns: `customer_id`, `name`. Row order does not matter.",starter:`SELECT c.customer_id, c.name
FROM customers c
JOIN orders o      ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
JOIN products p    ON p.product_id = i.product_id
WHERE p.category = 'Electronics' AND o.status = 'completed'
GROUP BY c.customer_id, c.name
HAVING count(*) >= 4`,solution:`SELECT c.customer_id, c.name
FROM customers c
JOIN orders o      ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
JOIN products p    ON p.product_id = i.product_id
WHERE p.category = 'Electronics' AND o.status = 'completed'
GROUP BY c.customer_id, c.name
HAVING count(DISTINCT p.product_id) = (SELECT count(*) FROM products WHERE category = 'Electronics')`,hints:["Four Electronics order lines is not the same as four different Electronics products.","Compare `count(DISTINCT p.product_id)` per customer with the size of the Electronics catalogue, computed by a scalar subquery."],explanation:'This is relational division ("customers related to ALL products in a set"). Counting distinct matches per group and comparing with the size of the divisor set is the idiomatic SQL form. The textbook alternative is a double `NOT EXISTS`: there is no Electronics product that this customer has not bought.'},{id:"lab-rollup-segment-channel",title:"Subtotals with GROUPING SETS",difficulty:"hard",topic:"aggregation-grouping-sets",tags:["GROUPING SETS","ROLLUP","GROUPING()"],tables:["orders","customers"],prompt:"Join completed orders to `customers` (orphan orders drop out). Return revenue (sum of `total_amount`) and order count at three levels in one result: per (`segment`, `channel`), per `segment` (channel shown as `ALL`), and a grand total (segment and channel both `ALL`). Columns: `segment`, `channel`, `orders`, `revenue`. Row order does not matter.",starter:`SELECT c.segment, o.channel, count(*) AS orders, sum(o.total_amount) AS revenue
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status = 'completed'
GROUP BY c.segment, o.channel`,solution:`SELECT CASE WHEN GROUPING(c.segment) = 1 THEN 'ALL' ELSE c.segment END AS segment,
       CASE WHEN GROUPING(o.channel) = 1 THEN 'ALL' ELSE o.channel END AS channel,
       count(*) AS orders,
       sum(o.total_amount) AS revenue
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status = 'completed'
GROUP BY ROLLUP (c.segment, o.channel)`,hints:["You could UNION ALL three GROUP BY queries, but one `GROUP BY ROLLUP (segment, channel)` or `GROUPING SETS ((segment, channel), (segment), ())` does it in one pass.","Subtotal rows have NULL in the rolled-up column. Use `GROUPING(col) = 1` to tell a subtotal NULL from a real NULL and label it `ALL`."],explanation:"`ROLLUP (a, b)` is shorthand for `GROUPING SETS ((a, b), (a), ())`. `coalesce(segment, 'ALL')` works only when the column itself can never be NULL; `GROUPING()` is the robust way to identify subtotal rows. A `UNION ALL` of three `GROUP BY` queries gives the same rows but scans the input three times."},{id:"lab-order-count-histogram",title:"Histogram of orders per customer",difficulty:"easy",topic:"aggregation-grouping-sets",tags:["two-level aggregation","histogram"],tables:["orders"],prompt:"Count **completed** orders per `customer_id` (orphans included; customers with no completed order are not part of this). Then return the distribution: `completed_orders` (the per-customer count) and `customers` (how many customers have exactly that many). Order by `completed_orders`.",starter:`SELECT customer_id, count(*) AS completed_orders
FROM orders
WHERE status = 'completed'
GROUP BY customer_id`,solution:`WITH per_customer AS (
  SELECT customer_id, count(*) AS n
  FROM orders
  WHERE status = 'completed'
  GROUP BY customer_id
)
SELECT n AS completed_orders, count(*) AS customers
FROM per_customer
GROUP BY n
ORDER BY n`,ordered:!0,hints:["This needs two levels of aggregation: first per customer, then over the per-customer counts.","Put the per-customer `GROUP BY` in a CTE (or derived table), then `GROUP BY` its count column."],explanation:'Aggregates cannot be nested directly (`count(count(*))` is invalid without a window), so materialise the per-customer grain first and aggregate again. The same shape answers "how many users had 1, 2, 3+ sessions", the first step of most engagement analyses.'}],n=Object.freeze(Object.defineProperty({__proto__:null,default:a},Symbol.toStringTag,{value:"Module"})),i=[{id:"lab-individual-contributors-not-in",title:"Employees who manage nobody (the NOT IN trap)",difficulty:"medium",topic:"null-semantics",tags:["NOT IN","NULL","three-valued logic","anti-join"],tables:["employees"],prompt:"Return every employee who is **nobody's manager**, i.e. whose `employee_id` never appears as another employee's `manager_id`. Columns: `employee_id`, `name`. Row order does not matter.",starter:`SELECT employee_id, name
FROM employees
WHERE employee_id NOT IN (SELECT manager_id FROM employees)`,solution:`SELECT e.employee_id, e.name
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.employee_id)`,hints:["Run the starter. Why does it return nothing, even though most employees manage nobody?","The two roots have `manager_id = NULL`. `x NOT IN (1, 2, NULL)` is never TRUE: it is FALSE or UNKNOWN. Use `NOT EXISTS`, or filter `WHERE manager_id IS NOT NULL` inside the subquery."],explanation:"`x NOT IN (a, b, NULL)` expands to `x <> a AND x <> b AND x <> NULL`; the last term is UNKNOWN, so the whole predicate can never be TRUE and the query returns zero rows. `NOT EXISTS` only asks whether a matching row exists, so NULLs in the subquery are harmless, and it plans as a proper anti-join. This is one of the most frequently asked SQL interview traps."},{id:"lab-not-us-customers-with-null-country",title:"Customers outside the US, counting unknowns",difficulty:"easy",topic:"null-semantics",tags:["NULL","inequality","COALESCE"],tables:["customers"],prompt:"Marketing wants every customer who is **not known to be in the US**: any country other than `US`, **including customers whose country is NULL**. Return per `segment`: `segment`, `customers`. Row order does not matter.",starter:`SELECT segment, count(*) AS customers
FROM customers
WHERE country <> 'US'
GROUP BY segment`,solution:`SELECT segment, count(*) AS customers
FROM customers
WHERE country IS DISTINCT FROM 'US'
GROUP BY segment`,hints:["`NULL <> 'US'` is UNKNOWN, and `WHERE` keeps only TRUE rows.","Use `country IS DISTINCT FROM 'US'`, or `country <> 'US' OR country IS NULL`, or `coalesce(country, '?') <> 'US'`."],explanation:"Every comparison with NULL is UNKNOWN, so `country <> 'US'` silently drops the three customers with a missing country. `IS DISTINCT FROM` is the NULL-safe inequality (standard SQL; supported by PostgreSQL, DuckDB, Snowflake, BigQuery, Databricks and SQL Server 2022+). MySQL spells the NULL-safe equality `<=>`."},{id:"lab-changed-country-null-safe",title:"Detect changed rows between two snapshots",difficulty:"medium",topic:"null-semantics",tags:["IS DISTINCT FROM","change detection","CDC"],tables:["customers"],setup:`CREATE TEMP TABLE customers_snapshot AS
SELECT customer_id,
       CASE WHEN customer_id IN (17, 51) THEN 'US'
            WHEN customer_id IN (5, 22)  THEN NULL
            WHEN customer_id = 30        THEN 'MX'
            ELSE country END AS country
FROM customers;`,prompt:"A temp table `customers_snapshot(customer_id, country)` holds tonight's extract. Return the customers whose country **changed** compared with `customers`, where NULL → value and value → NULL count as changes and NULL → NULL does not. Columns: `customer_id`, `old_country`, `new_country`. Row order does not matter.",starter:`SELECT c.customer_id, c.country AS old_country, s.country AS new_country
FROM customers c
JOIN customers_snapshot s ON s.customer_id = c.customer_id
WHERE c.country <> s.country`,solution:`SELECT c.customer_id, c.country AS old_country, s.country AS new_country
FROM customers c
JOIN customers_snapshot s ON s.customer_id = c.customer_id
WHERE c.country IS DISTINCT FROM s.country`,hints:["The starter finds only one change. Which kinds of change can `<>` not see?","Use `IS DISTINCT FROM`, or spell it out: `a <> b OR (a IS NULL) <> (b IS NULL)`."],explanation:"Change detection in incremental loads and SCD pipelines must be NULL-safe, otherwise a value being blanked out (or filled in) is never detected and the dimension silently drifts. `IS DISTINCT FROM` treats two NULLs as equal and NULL vs a value as different. Hashing the attribute list (with a NULL marker) is the multi-column version of the same idea."},{id:"lab-q4-orders-left-join-filter",title:"Every customer's Q4 orders, including zero",difficulty:"medium",topic:"joins",tags:["LEFT JOIN","ON vs WHERE","COUNT"],tables:["customers","orders"],prompt:"Return **all 60 customers** with the number of **completed** orders they placed in Q4 2024 (`order_date` from 2024-10-01 to 2024-12-31 inclusive). Customers with none show 0. Columns: `customer_id`, `q4_orders`. Row order does not matter.",starter:`SELECT c.customer_id, count(*) AS q4_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status = 'completed'
  AND o.order_date >= DATE '2024-10-01' AND o.order_date < DATE '2025-01-01'
GROUP BY c.customer_id`,solution:`SELECT c.customer_id, count(o.order_id) AS q4_orders
FROM customers c
LEFT JOIN orders o
  ON  o.customer_id = c.customer_id
  AND o.status = 'completed'
  AND o.order_date >= DATE '2024-10-01' AND o.order_date < DATE '2025-01-01'
GROUP BY c.customer_id`,hints:["The starter returns fewer than 60 rows. A `WHERE` condition on the right table rejects the NULL-extended rows of the LEFT JOIN.","Move the order filters into the `ON` clause and count `o.order_id` instead of `*`."],explanation:"`WHERE` runs after the join, and `NULL = 'completed'` is UNKNOWN, so customers without a matching order are filtered out: the LEFT JOIN has become an inner join. Conditions that restrict the optional side belong in `ON`. Then `count(o.order_id)` counts only real matches, so unmatched customers get 0 instead of 1."},{id:"lab-cancel-rate-by-channel",title:"Cancellation rate by channel",difficulty:"easy",topic:"null-semantics",tags:["integer division","conditional aggregation","ratio"],tables:["orders"],prompt:"Return per `channel`: `channel`, `orders` (all statuses), `cancelled` (orders with status `cancelled`, 0 if none) and `cancel_rate_pct` (100 * cancelled / orders, rounded to 2 decimals). Row order does not matter.",starter:`SELECT channel, count(*) AS orders,
       count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       round(100 * (count(*) FILTER (WHERE status = 'cancelled') // count(*)), 2) AS cancel_rate_pct
FROM orders
GROUP BY channel`,solution:`SELECT channel,
       count(*) AS orders,
       count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       round(100.0 * count(*) FILTER (WHERE status = 'cancelled') / count(*), 2) AS cancel_rate_pct
FROM orders
GROUP BY channel`,hints:["The starter uses integer division (`//` in DuckDB, plain `/` on integers in PostgreSQL and SQL Server), so every rate becomes 0.","Multiply by `100.0` (or cast to numeric) before dividing."],explanation:"In PostgreSQL and SQL Server `int / int` truncates toward zero, so `60 / 210` is 0. DuckDB's `/` always returns a double (its integer division is `//`), which is why ported queries can change results silently. Making one operand non-integer (`100.0 *`) is portable. If the denominator could be 0, wrap it in `NULLIF(count(*), 0)`."},{id:"lab-average-salary-null-handling",title:"What does AVG do with NULL?",difficulty:"easy",topic:"null-semantics",tags:["AVG","COUNT","NULL","aggregates"],tables:["employees"],prompt:"Return a single row about salaries across all employees: `employees` (all rows), `with_salary` (rows with a non-NULL salary), `avg_ignoring_nulls` (the average of known salaries) and `avg_nulls_as_zero` (the average if a missing salary counted as 0). Round both averages to 2 decimals.",starter:`SELECT count(*) AS employees,
       count(*) AS with_salary,
       round(avg(salary), 2) AS avg_ignoring_nulls,
       round(avg(salary), 2) AS avg_nulls_as_zero
FROM employees`,solution:`SELECT count(*) AS employees,
       count(salary) AS with_salary,
       round(avg(salary), 2) AS avg_ignoring_nulls,
       round(avg(coalesce(salary, 0)), 2) AS avg_nulls_as_zero
FROM employees`,hints:["`count(*)` counts rows; `count(col)` counts non-NULL values.","`avg(col)` is `sum(col) / count(col)`. To treat NULL as 0, average `coalesce(salary, 0)` instead."],explanation:"All standard aggregates except `count(*)` skip NULLs, so `avg(salary)` divides by 29, not 30. Whether that is right is a business question: an unknown salary is not a zero salary. Being explicit with `coalesce` (or with `sum(x) / count(*)`) documents the choice."},{id:"lab-june-orders-timestamp-boundary",title:"June revenue and the BETWEEN boundary",difficulty:"medium",topic:"query-anti-patterns",tags:["BETWEEN","timestamp","half-open interval","sargable"],tables:["orders"],prompt:"Using the **`ordered_at` timestamp** (not `order_date`), return a single row for **completed** orders placed in June 2024 (any time on June 1 through June 30): `orders` and `revenue` (sum of `total_amount`).",starter:`SELECT count(*) AS orders, sum(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
  AND ordered_at BETWEEN TIMESTAMP '2024-06-01' AND TIMESTAMP '2024-06-30'`,solution:`SELECT count(*) AS orders, sum(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
  AND ordered_at >= TIMESTAMP '2024-06-01'
  AND ordered_at <  TIMESTAMP '2024-07-01'`,hints:["`TIMESTAMP '2024-06-30'` means midnight at the START of June 30. What happens to an order at 14:00 that day?","Use a half-open interval: `>= start of June AND < start of July`."],explanation:"`BETWEEN` is inclusive on both ends, and a date literal compared with a timestamp becomes midnight, so the starter drops everything on June 30 after 00:00:00. The half-open form `>= lower AND < next_lower` is exact for dates and timestamps of any precision, and unlike `CAST(ordered_at AS DATE) BETWEEN …` it stays sargable, so an index or partition pruning on `ordered_at` still works."}],d=Object.freeze(Object.defineProperty({__proto__:null,default:i},Symbol.toStringTag,{value:"Module"})),u=[{id:"lab-running-total-daily-revenue",title:"Running total of daily revenue",difficulty:"easy",topic:"window-functions",tags:["running total","SUM OVER"],tables:["daily_metrics"],prompt:"Return every row of `daily_metrics` with a cumulative revenue: `metric_date`, `revenue`, `running_revenue` (sum of `revenue` over all days up to and including this one). Order by `metric_date`.",starter:`SELECT metric_date, revenue, sum(revenue) AS running_revenue
FROM daily_metrics
GROUP BY metric_date, revenue
ORDER BY metric_date`,solution:`SELECT metric_date,
       revenue,
       sum(revenue) OVER (ORDER BY metric_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_revenue
FROM daily_metrics
ORDER BY metric_date`,ordered:!0,hints:["A `GROUP BY` collapses rows; a window function keeps every row and adds a computed column.","`sum(revenue) OVER (ORDER BY metric_date)` is a running sum. Spell out `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` to be explicit."],explanation:"With an `ORDER BY` and no frame, the default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which includes all peers of the current row. Dates are unique here so both frames agree, but writing `ROWS` explicitly avoids the tie trap and is often cheaper (no peer detection)."},{id:"lab-second-highest-salary-per-department",title:"Second-highest salary in each department, with ties",difficulty:"medium",topic:"window-functions",tags:["DENSE_RANK","ties","top-n per group"],tables:["employees","departments"],prompt:"For each department, find the **second-highest distinct salary** and return **every** employee paid exactly that amount. Departments with fewer than two distinct salaries return nothing; ignore NULL salaries and employees without a department. Columns: `department` (name), `employee_name`, `salary`. Row order does not matter.",starter:`SELECT d.name AS department, e.name AS employee_name, e.salary
FROM (
  SELECT *, row_number() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
  FROM employees
) e
JOIN departments d ON d.department_id = e.department_id
WHERE rn = 2`,solution:`SELECT d.name AS department, e.name AS employee_name, e.salary
FROM (
  SELECT *, dense_rank() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE salary IS NOT NULL
) e
JOIN departments d ON d.department_id = e.department_id
WHERE e.rnk = 2`,hints:["`row_number()` returns exactly one row per position, so it cannot keep ties, and two people sharing the top salary push the real second salary to position 3.","`dense_rank()` gives tied salaries the same rank and leaves no gaps, so rank 2 is the second-highest distinct value."],explanation:'`dense_rank() = 2` is the "second-highest distinct value, keep ties" answer. `rank()` would skip to 3 after a tie at the top, and `row_number()` picks an arbitrary single row. The non-window classic is `max(salary) WHERE salary < (SELECT max(salary) …)` per department, which finds the value but needs another join to list the people.'},{id:"lab-rolling-3-day-average-with-gaps",title:"3-day rolling average on a series with missing days",difficulty:"hard",topic:"window-frames",tags:["RANGE frame","INTERVAL","missing dates","moving average"],tables:["daily_metrics"],prompt:"`daily_metrics` is missing a few days. For each row, compute the average `visits` over the **calendar** window from 2 days before through the current day (days that are missing simply do not contribute; do not treat them as 0). Columns: `metric_date`, `visits`, `days_in_window` (rows that contributed), `rolling_avg` (rounded to 2 decimals). Order by `metric_date`.",starter:`SELECT metric_date, visits,
       count(*) OVER (ORDER BY metric_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS days_in_window,
       round(avg(visits) OVER (ORDER BY metric_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS rolling_avg
FROM daily_metrics
ORDER BY metric_date`,solution:`SELECT metric_date,
       visits,
       count(*) OVER w AS days_in_window,
       round(avg(visits) OVER w, 2) AS rolling_avg
FROM daily_metrics
WINDOW w AS (ORDER BY metric_date RANGE BETWEEN INTERVAL 2 DAY PRECEDING AND CURRENT ROW)
ORDER BY metric_date`,ordered:!0,hints:['`ROWS BETWEEN 2 PRECEDING` means "the two previous rows", which reaches back further than 2 days when a day is missing. Look at 2024-01-20.',"A `RANGE` frame is defined on the ORDER BY value: `RANGE BETWEEN INTERVAL 2 DAY PRECEDING AND CURRENT ROW` (PostgreSQL: `INTERVAL '2 days'`)."],explanation:"`ROWS` frames count physical rows, so after a gap the window silently spans 4 or 5 calendar days. A `RANGE` frame with an interval offset uses the date value itself. Where `RANGE` with intervals is unavailable (SQL Server, older engines), generate a calendar, LEFT JOIN the facts, and use `ROWS` with `avg` ignoring the NULLs, or use a self-join:\n\n```sql\nSELECT a.metric_date, a.visits, count(*) AS days_in_window, round(avg(b.visits), 2) AS rolling_avg\nFROM daily_metrics a\nJOIN daily_metrics b ON b.metric_date BETWEEN a.metric_date - 2 AND a.metric_date\nGROUP BY a.metric_date, a.visits\nORDER BY a.metric_date\n```"},{id:"lab-month-over-month-growth",title:"Month-over-month revenue growth",difficulty:"medium",topic:"window-functions",tags:["LAG","growth","date_trunc"],tables:["daily_metrics"],prompt:"From `daily_metrics`, return one row per month: `month` (first day of the month), `revenue` (sum, rounded to 2 decimals), `prev_revenue` (previous month's revenue rounded to 2 decimals, NULL for the first month) and `growth_pct` (100 * (revenue - prev) / prev from the unrounded sums, rounded to 2 decimals; NULL for the first month). Order by `month`.",starter:`SELECT CAST(date_trunc('month', metric_date) AS DATE) AS month,
       round(sum(revenue), 2) AS revenue
FROM daily_metrics
GROUP BY 1
ORDER BY 1`,solution:`WITH m AS (
  SELECT CAST(date_trunc('month', metric_date) AS DATE) AS month, sum(revenue) AS revenue
  FROM daily_metrics
  GROUP BY 1
)
SELECT month,
       round(revenue, 2) AS revenue,
       round(lag(revenue) OVER (ORDER BY month), 2) AS prev_revenue,
       round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month)) / lag(revenue) OVER (ORDER BY month), 2) AS growth_pct
FROM m
ORDER BY month`,ordered:!0,hints:["Aggregate to monthly grain first (a CTE), then apply the window.","`lag(revenue) OVER (ORDER BY month)` is the previous month's value; it is NULL on the first row, so the growth is NULL there automatically."],explanation:"Aggregate first, window second: window functions run after `GROUP BY`, so you can even write `lag(sum(revenue)) OVER (ORDER BY …)` in the same SELECT. `lag` takes the previous **row**, so if a whole month were missing it would compare with two months back; joining a generated month spine first protects against that. Note February and March are each missing days here, which deflates their totals: a per-day average is the fairer comparison."},{id:"lab-running-total-with-ties",title:"A running total that must not jump on ties",difficulty:"hard",topic:"window-frames",tags:["ROWS vs RANGE","peers","default frame","tie-breaker"],tables:["orders"],prompt:"For **completed** orders with `order_date` from 2024-06-01 to 2024-06-07 inclusive, return `order_id`, `order_date`, `total_amount` and `running_total`: the cumulative sum of `total_amount` in the order (`order_date`, `order_id`), so it increases on **every** row, even when several orders share a date. Order by `order_date`, `order_id`.",starter:`SELECT order_id, order_date, total_amount,
       sum(total_amount) OVER (ORDER BY order_date) AS running_total
FROM orders
WHERE status = 'completed'
  AND order_date BETWEEN DATE '2024-06-01' AND DATE '2024-06-07'
ORDER BY order_date, order_id`,solution:`SELECT order_id, order_date, total_amount,
       sum(total_amount) OVER (ORDER BY order_date, order_id
                               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM orders
WHERE status = 'completed'
  AND order_date BETWEEN DATE '2024-06-01' AND DATE '2024-06-07'
ORDER BY order_date, order_id`,ordered:!0,hints:["Run the starter and look at two orders on the same date: they show the same running total. Why?","The default frame is `RANGE … CURRENT ROW`, which includes all **peers** (rows with an equal ORDER BY value). Add `order_id` to the window ORDER BY and/or use a `ROWS` frame."],explanation:"With `ORDER BY order_date` only, all orders of a day are peers, and the default `RANGE` frame adds the whole day at once. Making the ordering unique (`order_date, order_id`) fixes it; using `ROWS` without a unique ordering would still be non-deterministic, as the engine may order peers differently between runs. Unique ordering plus an explicit `ROWS` frame is the professional default."},{id:"lab-salary-vs-department-average",title:"Salary compared with the department average",difficulty:"easy",topic:"window-functions",tags:["AVG OVER","PARTITION BY"],tables:["employees","departments"],prompt:"For every employee with a known department and salary, return `employee_name`, `department` (name), `salary`, `dept_avg` (average salary in that department, rounded to 2 decimals) and `diff_from_avg` (salary minus the unrounded department average, rounded to 2 decimals). Row order does not matter.",starter:`SELECT e.name AS employee_name, d.name AS department, e.salary, avg(e.salary) AS dept_avg
FROM employees e
JOIN departments d ON d.department_id = e.department_id
GROUP BY e.name, d.name, e.salary`,solution:`SELECT e.name AS employee_name,
       d.name AS department,
       e.salary,
       round(avg(e.salary) OVER (PARTITION BY e.department_id), 2) AS dept_avg,
       round(e.salary - avg(e.salary) OVER (PARTITION BY e.department_id), 2) AS diff_from_avg
FROM employees e
JOIN departments d ON d.department_id = e.department_id
WHERE e.salary IS NOT NULL`,hints:[`Grouping by employee makes each group a single row, so the "average" is just the employee's own salary.`,"Use `avg(e.salary) OVER (PARTITION BY e.department_id)`: the aggregate is computed per partition but every row is kept."],explanation:"A partitioned window aggregate is the one-pass alternative to joining each row with a per-department `GROUP BY` subquery. Without `ORDER BY` in the window, the frame is the whole partition, which is exactly what an average per group needs."}],c=Object.freeze(Object.defineProperty({__proto__:null,default:u},Symbol.toStringTag,{value:"Module"})),m=[{id:"lab-customer-revenue-tiers",title:"Bucket customers into revenue tiers",difficulty:"easy",topic:"ctes-recursive",tags:["CTE","CASE","two-step aggregation"],tables:["orders","customers"],prompt:"Compute each existing customer's completed revenue (sum of `total_amount` over **completed** orders; customers with none are not included). Assign a tier: `gold` if revenue >= 5000, `silver` if >= 2000, otherwise `bronze`. Return per tier: `tier`, `customers`, `revenue` (sum). Row order does not matter.",starter:`SELECT CASE WHEN o.total_amount >= 5000 THEN 'gold'
            WHEN o.total_amount >= 2000 THEN 'silver'
            ELSE 'bronze' END AS tier,
       count(*) AS customers,
       sum(o.total_amount) AS revenue
FROM orders o
WHERE o.status = 'completed'
GROUP BY 1`,solution:`WITH per_customer AS (
  SELECT o.customer_id, sum(o.total_amount) AS revenue
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
)
SELECT CASE WHEN revenue >= 5000 THEN 'gold'
            WHEN revenue >= 2000 THEN 'silver'
            ELSE 'bronze' END AS tier,
       count(*) AS customers,
       sum(revenue) AS revenue
FROM per_customer
GROUP BY 1`,hints:["The tier depends on a customer's total, not on one order. Aggregate to the customer grain first.","Put the per-customer sum in a CTE, then `GROUP BY` the `CASE` expression over it."],explanation:"The starter tiers individual orders, a grain mistake. A CTE names the intermediate grain (one row per customer) and keeps the query readable. `CASE` branches are tested top to bottom, so order the thresholds from highest to lowest."},{id:"lab-missing-dates-calendar",title:"Which days are missing?",difficulty:"medium",topic:"ctes-recursive",tags:["date spine","recursive CTE","generate_series","anti-join"],tables:["daily_metrics"],prompt:"Return every calendar date between the first and last `metric_date` (inclusive) that has **no** row in `daily_metrics`. One column: `missing_date`. Order by `missing_date`.",starter:`SELECT metric_date AS missing_date
FROM daily_metrics
WHERE visits IS NULL
ORDER BY 1`,solution:`WITH RECURSIVE spine(d) AS (
  SELECT min(metric_date) FROM daily_metrics
  UNION ALL
  SELECT CAST(d + INTERVAL 1 DAY AS DATE) FROM spine
  WHERE d < (SELECT max(metric_date) FROM daily_metrics)
)
SELECT s.d AS missing_date
FROM spine s
LEFT JOIN daily_metrics m ON m.metric_date = s.d
WHERE m.metric_date IS NULL
ORDER BY 1`,ordered:!0,hints:["A missing day has no row at all, so you cannot find it by filtering the table. Generate the full list of dates first.","Build a date spine (a recursive CTE adding one day at a time, or `generate_series(min, max, INTERVAL 1 DAY)`), then anti-join it to `daily_metrics`."],explanation:"You cannot select rows that do not exist; you generate the expected set and subtract the actual set. A recursive CTE works everywhere (SQL Server caps recursion at 100 by default, so add `OPTION (MAXRECURSION 0)` for long ranges). Shorter engine-specific spines: `generate_series` (PostgreSQL, DuckDB), `GENERATE_DATE_ARRAY` + `UNNEST` (BigQuery), `GENERATOR` (Snowflake), or a permanent calendar table."},{id:"lab-chain-of-command",title:"Chain of command up to the CEO",difficulty:"medium",topic:"ctes-recursive",tags:["recursive CTE","hierarchy","walk up"],tables:["employees"],prompt:"Starting from **Dana Whitfield** (employee 30), walk up the reporting line to the top. Return one row per manager above her: `level` (1 = her direct manager, 2 = that person's manager, …), `employee_id`, `name`, `title`. Order by `level`.",starter:`SELECT 1 AS level, m.employee_id, m.name, m.title
FROM employees e
JOIN employees m ON m.employee_id = e.manager_id
WHERE e.employee_id = 30`,solution:`WITH RECURSIVE chain AS (
  SELECT 1 AS level, m.employee_id, m.name, m.title, m.manager_id
  FROM employees e
  JOIN employees m ON m.employee_id = e.manager_id
  WHERE e.employee_id = 30
  UNION ALL
  SELECT c.level + 1, m.employee_id, m.name, m.title, m.manager_id
  FROM chain c
  JOIN employees m ON m.employee_id = c.manager_id
)
SELECT level, employee_id, name, title
FROM chain
ORDER BY level`,ordered:!0,hints:["The starter finds level 1. The recursive member repeats the same step from the previous level's row.","Carry `manager_id` in the CTE and join `employees m ON m.employee_id = chain.manager_id`. Recursion stops by itself at the root, whose `manager_id` is NULL."],explanation:"A recursive CTE is an anchor query `UNION ALL` a recursive member that references the CTE; the engine iterates until the member returns no rows. Walking up is a chain (one row per level), walking down fans out. Keep a depth counter: it is useful output and a guard (`WHERE level < 50`) against cycles in dirty data."},{id:"lab-org-chart-depth-and-path",title:"Org chart depth and path",difficulty:"hard",topic:"ctes-recursive",tags:["recursive CTE","hierarchy","path","string concatenation"],tables:["employees"],prompt:"For **every** employee, return `employee_id`, `name`, `depth` (0 for someone with no manager, 1 for their direct reports, …) and `path`: the names from the top of their tree down to them, joined with `' > '` (for example `Ada Okafor > Bram de Vries`). Row order does not matter.",starter:`WITH RECURSIVE org AS (
  SELECT employee_id, name, 0 AS depth, name AS path
  FROM employees
  WHERE manager_id IS NULL
)
SELECT * FROM org`,solution:`WITH RECURSIVE org AS (
  SELECT employee_id, name, 0 AS depth, CAST(name AS VARCHAR) AS path
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.employee_id, e.name, o.depth + 1, o.path || ' > ' || e.name
  FROM employees e
  JOIN org o ON e.manager_id = o.employee_id
)
SELECT employee_id, name, depth, path
FROM org`,hints:["The anchor is every root (there are two: the CEO and the General Counsel). The recursive member finds the direct reports of the rows found so far.","In the recursive member, join `employees e ON e.manager_id = org.employee_id` and build `org.path || ' > ' || e.name`. Cast the anchor's path to a text type so the column is wide enough in strict engines."],explanation:"Walking down a hierarchy is the canonical recursive CTE. Anchoring on `manager_id IS NULL` catches every tree, not just the CEO's. In PostgreSQL and SQL Server the anchor fixes the column type, so a `VARCHAR(50)` path would fail or truncate; cast it. Materialized paths like this also give a cheap subtree test: `path LIKE 'Ada Okafor > Bram de Vries%'`."},{id:"lab-total-reports-per-manager",title:"Direct and indirect reports per manager",difficulty:"hard",topic:"ctes-recursive",tags:["recursive CTE","transitive closure","hierarchy"],tables:["employees"],prompt:"For every employee who manages at least one person, return `employee_id`, `name`, `direct_reports` and `total_reports` (everyone below them in the hierarchy, at any depth). Row order does not matter.",starter:`SELECT m.employee_id, m.name, count(*) AS direct_reports, count(*) AS total_reports
FROM employees m
JOIN employees e ON e.manager_id = m.employee_id
GROUP BY m.employee_id, m.name`,solution:`WITH RECURSIVE below(ancestor_id, employee_id, depth) AS (
  SELECT manager_id, employee_id, 1
  FROM employees
  WHERE manager_id IS NOT NULL
  UNION ALL
  SELECT b.ancestor_id, e.employee_id, b.depth + 1
  FROM below b
  JOIN employees e ON e.manager_id = b.employee_id
)
SELECT m.employee_id, m.name,
       count(*) FILTER (WHERE b.depth = 1) AS direct_reports,
       count(*) AS total_reports
FROM below b
JOIN employees m ON m.employee_id = b.ancestor_id
GROUP BY m.employee_id, m.name`,hints:["Build the transitive closure: one row per (ancestor, descendant) pair. The anchor is each direct (manager, employee) edge.","The recursive member extends a pair (A, X) to (A, Y) for every Y whose manager is X. Then group by the ancestor; pairs with depth 1 are the direct reports."],explanation:'The closure table (ancestor, descendant, depth) answers every "under this manager" question with a plain `GROUP BY`, and many teams materialise it for exactly that reason. Each employee appears once per ancestor, so for this 4-level tree the closure has a few dozen rows; on deep or very wide hierarchies its size grows as nodes × depth, which is the trade-off to mention.'}],l=Object.freeze(Object.defineProperty({__proto__:null,default:m},Symbol.toStringTag,{value:"Module"})),p=[{id:"lab-daily-metrics-islands",title:"Find the unbroken stretches of data",difficulty:"easy",topic:"gaps-and-islands",tags:["islands","row_number difference","missing dates"],tables:["daily_metrics"],prompt:"`daily_metrics` has a few missing days. Return each maximal run of consecutive calendar days that are present: `island_start`, `island_end`, `days`. Order by `island_start`.",starter:`SELECT min(metric_date) AS island_start, max(metric_date) AS island_end, count(*) AS days
FROM daily_metrics`,solution:`WITH g AS (
  SELECT metric_date,
         metric_date - CAST(row_number() OVER (ORDER BY metric_date) AS INTEGER) AS grp
  FROM daily_metrics
)
SELECT min(metric_date) AS island_start, max(metric_date) AS island_end, count(*) AS days
FROM g
GROUP BY grp
ORDER BY island_start`,ordered:!0,hints:["Within a run of consecutive dates, the date and its `row_number()` both go up by 1 per row. What does that say about `date - row_number`?","Group by `metric_date - row_number() OVER (ORDER BY metric_date)`: it is constant inside an island and jumps after every gap."],explanation:'The difference between a gap-free sequence and the row number is constant within each island, so it works as a group key. In DuckDB and PostgreSQL `date - integer` is a date; in Snowflake or SQL Server use `DATEADD(day, -rn, d)`. The equivalent "start flag" approach compares each row with `lag(metric_date)` and running-sums the flags.'},{id:"lab-longest-login-streak",title:"Longest login streak per user",difficulty:"medium",topic:"gaps-and-islands",tags:["streaks","islands","tie-breaking"],tables:["logins"],prompt:"A streak is a run of logins on consecutive calendar days. For every user, return their longest streak: `user_id`, `streak_days`, `streak_start`, `streak_end`. If a user has several streaks of the same maximal length, return the **earliest** one. Row order does not matter.",starter:`SELECT user_id, count(*) AS streak_days, min(login_date) AS streak_start, max(login_date) AS streak_end
FROM logins
GROUP BY user_id`,solution:`WITH g AS (
  SELECT user_id, login_date,
         login_date - CAST(row_number() OVER (PARTITION BY user_id ORDER BY login_date) AS INTEGER) AS grp
  FROM logins
), islands AS (
  SELECT user_id, count(*) AS streak_days, min(login_date) AS streak_start, max(login_date) AS streak_end
  FROM g
  GROUP BY user_id, grp
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY user_id ORDER BY streak_days DESC, streak_start) AS rn
  FROM islands
)
SELECT user_id, streak_days, streak_start, streak_end
FROM ranked
WHERE rn = 1`,hints:["First turn the logins into islands (one row per streak), then pick the best island per user.","Island key: `login_date - row_number() OVER (PARTITION BY user_id ORDER BY login_date)`. Then `row_number() OVER (PARTITION BY user_id ORDER BY streak_days DESC, streak_start)` and keep rank 1."],explanation:"Two classic patterns stacked: gaps-and-islands to build the streaks, then top-1-per-group to pick the longest. The explicit tie-breaker (`streak_start`) makes the answer deterministic. The date-minus-row-number trick needs distinct dates per user; with duplicate logins per day, use `dense_rank()` or deduplicate first."},{id:"lab-login-streaks-three-plus",title:"All streaks of three days or more",difficulty:"medium",topic:"gaps-and-islands",tags:["islands","LAG","running sum"],tables:["logins"],prompt:'Return every login streak (consecutive calendar days) of **at least 3 days**: `user_id`, `streak_start`, `streak_end`, `streak_days`. Solve it with the "start flag + running sum" method if you already know the row-number trick. Row order does not matter.',starter:`SELECT user_id, login_date,
       lag(login_date) OVER (PARTITION BY user_id ORDER BY login_date) AS prev_date
FROM logins`,solution:`WITH flagged AS (
  SELECT user_id, login_date,
         CASE WHEN login_date - lag(login_date) OVER (PARTITION BY user_id ORDER BY login_date) = 1
              THEN 0 ELSE 1 END AS is_start
  FROM logins
), numbered AS (
  SELECT *, sum(is_start) OVER (PARTITION BY user_id ORDER BY login_date ROWS UNBOUNDED PRECEDING) AS streak_no
  FROM flagged
)
SELECT user_id, min(login_date) AS streak_start, max(login_date) AS streak_end, count(*) AS streak_days
FROM numbered
GROUP BY user_id, streak_no
HAVING count(*) >= 3`,hints:["A row starts a new streak when the previous login is not exactly one day earlier (or there is no previous login).","Flag starts with `CASE WHEN login_date - lag(login_date) OVER (…) = 1 THEN 0 ELSE 1 END`; a running `sum` of the flags numbers the streaks. Group by it and keep groups with `count(*) >= 3`."],explanation:"The start-flag method generalises better than the row-number trick: change the condition to `<= 2` to allow one missed day, or to a 30-minute timestamp gap and you have sessionization. Note that `lag` returns NULL on the first row; `NULL = 1` is not TRUE, so the `ELSE 1` branch correctly flags it as a start."},{id:"lab-sessionize-events",title:"Sessionize the clickstream",difficulty:"hard",topic:"sessionization",tags:["sessionization","LAG","running sum","inactivity timeout"],tables:["events"],prompt:"A user's session ends after more than **30 minutes** of inactivity: an event starts a new session if it is the user's first event or if it comes **more than 30 minutes** after the user's previous event (exactly 30 minutes stays in the same session). Return per user: `user_id`, `sessions`, `events`, `avg_events_per_session` (rounded to 2 decimals). Row order does not matter.",starter:`SELECT user_id,
       count(DISTINCT CAST(event_time AS DATE)) AS sessions,
       count(*) AS events,
       round(count(*) / count(DISTINCT CAST(event_time AS DATE)), 2) AS avg_events_per_session
FROM events
GROUP BY user_id`,solution:`WITH flagged AS (
  SELECT user_id, event_time,
         CASE WHEN lag(event_time) OVER (PARTITION BY user_id ORDER BY event_time, event_id) IS NULL
                OR event_time - lag(event_time) OVER (PARTITION BY user_id ORDER BY event_time, event_id) > INTERVAL 30 MINUTE
              THEN 1 ELSE 0 END AS new_session
  FROM events
)
SELECT user_id,
       sum(new_session) AS sessions,
       count(*) AS events,
       round(count(*) / sum(new_session), 2) AS avg_events_per_session
FROM flagged
GROUP BY user_id`,hints:["Calendar days are not sessions: one day can hold several sessions and a session can cross midnight.","Compare each event with the previous event of the same user (`lag(event_time) OVER (PARTITION BY user_id ORDER BY event_time)`). Flag a new session when there is no previous event or the gap is `> INTERVAL 30 MINUTE`. The number of sessions is the sum of the flags."],explanation:"Sessionization is gaps-and-islands on timestamps: flag boundaries with `lag`, then (for per-session detail) running-sum the flags to get a session number. For counting sessions you only need the sum of the flags. Order by a unique key (`event_time, event_id`) so ties are deterministic. In PostgreSQL write `INTERVAL '30 minutes'`; BigQuery uses `TIMESTAMP_DIFF(t, prev, MINUTE) > 30` (careful: it truncates to whole minutes, so compare seconds for exactness)."},{id:"lab-merge-overlapping-subscriptions",title:"Merge overlapping subscription periods",difficulty:"hard",topic:"gaps-and-islands",tags:["interval merge","running max","open-ended intervals"],tables:["subscriptions"],prompt:'A customer is "covered" from `start_date` to `end_date` (inclusive) of each subscription; `end_date` NULL means still active (covered indefinitely). Merge each customer\'s subscriptions into maximal covered periods: a subscription joins the current period if its `start_date` is **on or before** the latest end date seen so far for that customer (a start exactly one day after an end does **not** merge). Return `customer_id`, `period_start`, `period_end` (NULL if open-ended) and `subscriptions` (how many were merged). Row order does not matter.',starter:`SELECT customer_id, min(start_date) AS period_start, max(end_date) AS period_end, count(*) AS subscriptions
FROM subscriptions
GROUP BY customer_id`,solution:`WITH s AS (
  SELECT customer_id, subscription_id, start_date,
         coalesce(end_date, DATE '9999-12-31') AS end_d
  FROM subscriptions
), m AS (
  SELECT *, max(end_d) OVER (PARTITION BY customer_id ORDER BY start_date, subscription_id
                             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_end
  FROM s
), b AS (
  SELECT *, sum(CASE WHEN prev_max_end IS NULL OR start_date > prev_max_end THEN 1 ELSE 0 END)
              OVER (PARTITION BY customer_id ORDER BY start_date, subscription_id ROWS UNBOUNDED PRECEDING) AS period_no
  FROM m
)
SELECT customer_id,
       min(start_date) AS period_start,
       nullif(max(end_d), DATE '9999-12-31') AS period_end,
       count(*) AS subscriptions
FROM b
GROUP BY customer_id, period_no`,hints:["Comparing each row with only the previous row's end is not enough: an earlier, longer subscription can still be running. Track the **maximum** end date of all earlier rows.","Replace NULL ends with a far-future sentinel, compute `max(end) OVER (… ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)`, flag a new period when `start_date > that max`, running-sum the flags, group, and turn the sentinel back into NULL with `nullif`."],explanation:'Interval merging is gaps-and-islands where the "gap" test uses a running maximum, because one long interval can swallow several later ones. NULL as "open-ended" must become a sentinel before `max()`, since aggregates ignore NULLs and would make an active subscription look like it ended. The same pattern computes total covered days, concurrent-session peaks, and SCD2 validity repair.'},{id:"lab-longest-rising-visits-run",title:"Longest run of rising traffic",difficulty:"hard",topic:"gaps-and-islands",tags:["islands","LAG","conditional run","missing dates"],tables:["daily_metrics"],prompt:"A **rising run** is a maximal sequence of rows on consecutive calendar days in `daily_metrics` where each day after the first has strictly more `visits` than the calendar day before it. A day whose previous calendar day is missing, or whose visits did not increase, starts a new run (so every row belongs to exactly one run, possibly of length 1). Return the single longest run: `run_start`, `run_end`, `days`. On a tie, the earliest run.",starter:`SELECT metric_date, visits,
       visits > lag(visits) OVER (ORDER BY metric_date) AS rising
FROM daily_metrics`,solution:`WITH flagged AS (
  SELECT metric_date,
         CASE WHEN metric_date - lag(metric_date) OVER (ORDER BY metric_date) = 1
               AND visits > lag(visits) OVER (ORDER BY metric_date)
              THEN 0 ELSE 1 END AS is_start
  FROM daily_metrics
), runs AS (
  SELECT metric_date, sum(is_start) OVER (ORDER BY metric_date ROWS UNBOUNDED PRECEDING) AS run_no
  FROM flagged
)
SELECT min(metric_date) AS run_start, max(metric_date) AS run_end, count(*) AS days
FROM runs
GROUP BY run_no
ORDER BY days DESC, run_start
LIMIT 1`,hints:["The row-number trick only detects date gaps. Here a run also breaks when visits fail to increase, so use start flags.","A row continues the run only if the previous row is exactly one day earlier AND its visits are lower. Running-sum the start flags, group, and pick the longest with `ORDER BY days DESC, run_start LIMIT 1`."],explanation:'Any "consecutive rows satisfying a condition" question reduces to start flags + running sum + group by. Both conditions must be checked: comparing with `lag(visits)` alone would chain across a missing day. The tie-breaker in the final `ORDER BY` makes `LIMIT 1` deterministic; `FETCH FIRST 1 ROW ONLY` is the standard spelling and `TOP 1` is SQL Server\'s.'}],h=Object.freeze(Object.defineProperty({__proto__:null,default:p},Symbol.toStringTag,{value:"Module"})),_=[{id:"lab-dedup-payments-keep-earliest",title:"Deduplicate payments, keeping the earliest",difficulty:"easy",topic:"top-n-and-dedup",tags:["dedup","ROW_NUMBER","QUALIFY"],tables:["payments"],prompt:"The payment webhook sometimes delivered the same payment twice. Keep exactly **one row per `order_id`**: the one with the earliest `paid_at` (if two rows tie on `paid_at`, the lower `payment_id`). Return `payment_id`, `order_id`, `paid_at`, `amount`, `method`. Row order does not matter.",starter:`SELECT DISTINCT payment_id, order_id, paid_at, amount, method
FROM payments`,solution:`SELECT payment_id, order_id, paid_at, amount, method
FROM (
  SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY paid_at, payment_id) AS rn
  FROM payments
) p
WHERE rn = 1`,hints:["`DISTINCT` cannot help: the duplicate rows differ in `payment_id` and `paid_at`.","Number the rows per `order_id` with `row_number() OVER (PARTITION BY order_id ORDER BY paid_at, payment_id)` and keep `rn = 1`."],explanation:"`row_number()` per business key with a deterministic ordering is the standard dedup. DuckDB, Snowflake, BigQuery and Databricks let you write it inline with `QUALIFY row_number() OVER (…) = 1`; PostgreSQL also has `DISTINCT ON (order_id) … ORDER BY order_id, paid_at, payment_id`. Always include a unique tie-breaker, or reruns can keep different rows."},{id:"lab-latest-order-per-customer",title:"Most recent order per customer",difficulty:"easy",topic:"top-n-and-dedup",tags:["latest per group","ROW_NUMBER"],tables:["orders"],prompt:"For every `customer_id` that appears in `orders` (orphans included), return their most recent order by `ordered_at` (on a tie, the higher `order_id`): `customer_id`, `order_id`, `ordered_at`, `status`. Row order does not matter.",starter:`SELECT customer_id, max(order_id) AS order_id, max(ordered_at) AS ordered_at, max(status) AS status
FROM orders
GROUP BY customer_id`,solution:`SELECT customer_id, order_id, ordered_at, status
FROM (
  SELECT *, row_number() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC, order_id DESC) AS rn
  FROM orders
) o
WHERE rn = 1`,hints:["Independent `max()`es come from different rows: the highest `order_id` is not necessarily the latest order, and `max(status)` is just alphabetical.","Rank each customer's orders newest first and keep the first row, so all columns come from the same order."],explanation:'Mixing aggregates to fetch "the row with the max" is a classic bug: each `max()` is computed independently. Use `row_number()` (or a join back on `(customer_id, max(ordered_at))`, which needs its own tie handling). Some engines offer `arg_max(order_id, ordered_at)` / `MAX_BY`, which also returns a value from the winning row.'},{id:"lab-third-highest-salary-per-department",title:"Third-highest distinct salary, or NULL",difficulty:"medium",topic:"top-n-and-dedup",tags:["DENSE_RANK","Nth highest","NULL when missing","LEFT JOIN"],tables:["employees","departments"],prompt:"For **every** department, return `department` (name) and `third_salary`: the third-highest **distinct** salary among its employees (ignore NULL salaries), or NULL if the department has fewer than three distinct salaries. Exactly one row per department. Row order does not matter.",starter:`SELECT d.name AS department, e.salary AS third_salary
FROM departments d
JOIN (
  SELECT department_id, salary,
         row_number() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
  FROM employees
) e ON e.department_id = d.department_id AND e.rn = 3`,solution:`WITH ranked AS (
  SELECT DISTINCT department_id, salary,
         dense_rank() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE salary IS NOT NULL
)
SELECT d.name AS department, r.salary AS third_salary
FROM departments d
LEFT JOIN ranked r ON r.department_id = d.department_id AND r.rnk = 3`,hints:["Support pays 150000, 82000, 82000 and 79000. Its third-highest **distinct** salary is 79000, but the third row is 82000.","Use `dense_rank()` so ties share a rank, then LEFT JOIN from `departments` so departments without a third salary still appear with NULL. `DISTINCT` removes the duplicate tied rows."],explanation:'Three traps in one: `row_number()` ignores ties, an inner join drops departments with too few salaries (the classic "return NULL if there is no Nth highest" requirement), and tied rows at rank 3 would produce duplicates without `DISTINCT`. The scalar-subquery form is `(SELECT DISTINCT salary … ORDER BY salary DESC LIMIT 1 OFFSET 2)`, which returns NULL naturally when there is no such row.'},{id:"lab-top-3-products-per-category",title:"Top 3 products per category",difficulty:"medium",topic:"top-n-and-dedup",tags:["top-n per group","ROW_NUMBER","revenue"],tables:["order_items","orders","products"],prompt:"Line revenue is `quantity * unit_price * (1 - discount)`, over lines of **completed** orders. For each non-NULL product category, return its **top 3** products by revenue (ties broken by lower `product_id`, so at most 3 rows per category). Columns: `category`, `product_name`, `revenue` (rounded to 2 decimals), `rank_in_category` (1–3). Row order does not matter.",starter:`SELECT p.category, p.name AS product_name,
       round(sum(i.quantity * i.unit_price * (1 - i.discount)), 2) AS revenue
FROM order_items i
JOIN orders o   ON o.order_id = i.order_id
JOIN products p ON p.product_id = i.product_id
WHERE o.status = 'completed'
GROUP BY p.category, p.name
ORDER BY revenue DESC
LIMIT 3`,solution:`WITH rev AS (
  SELECT p.category, p.product_id, p.name,
         sum(i.quantity * i.unit_price * (1 - i.discount)) AS revenue
  FROM order_items i
  JOIN orders o   ON o.order_id = i.order_id
  JOIN products p ON p.product_id = i.product_id
  WHERE o.status = 'completed' AND p.category IS NOT NULL
  GROUP BY p.category, p.product_id, p.name
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY category ORDER BY revenue DESC, product_id) AS rnk
  FROM rev
)
SELECT category, name AS product_name, round(revenue, 2) AS revenue, rnk AS rank_in_category
FROM ranked
WHERE rnk <= 3`,hints:["`LIMIT 3` applies to the whole result, not to each category.","Aggregate revenue per product first, then `row_number() OVER (PARTITION BY category ORDER BY revenue DESC, product_id)` and keep `<= 3`."],explanation:"Top-N per group = aggregate, rank within the partition, filter on the rank. The choice of ranking function is the business rule: `row_number()` for exactly N, `rank()` to include ties (possibly more than N), `dense_rank()` for the top N distinct values. A `LATERAL` / `CROSS APPLY` subquery with `ORDER BY … LIMIT 3` per category is the alternative that can use an index on large tables."},{id:"lab-find-duplicate-webhook-pairs",title:"Pair each duplicate payment with its original",difficulty:"hard",topic:"top-n-and-dedup",tags:["self-join","near-duplicates","time tolerance"],tables:["payments"],prompt:"A **duplicate** is a payment for the same `order_id`, `amount` and `method` as an earlier payment, arriving within **10 seconds** after it (strictly later `paid_at`, gap <= 10 s). Return one row per duplicate: `order_id`, `original_payment_id` (the earliest matching earlier payment), `duplicate_payment_id`, `seconds_apart` (whole seconds). Row order does not matter.",starter:`SELECT order_id, min(payment_id) AS original_payment_id, max(payment_id) AS duplicate_payment_id
FROM payments
GROUP BY order_id`,solution:`WITH pairs AS (
  SELECT a.order_id,
         a.payment_id AS original_payment_id,
         b.payment_id AS duplicate_payment_id,
         date_diff('second', a.paid_at, b.paid_at) AS seconds_apart,
         row_number() OVER (PARTITION BY b.payment_id ORDER BY a.paid_at, a.payment_id) AS rn
  FROM payments a
  JOIN payments b
    ON  b.order_id = a.order_id
    AND b.amount = a.amount
    AND b.method = a.method
    AND b.paid_at > a.paid_at
    AND b.paid_at <= a.paid_at + INTERVAL 10 SECOND
)
SELECT order_id, original_payment_id, duplicate_payment_id, seconds_apart
FROM pairs
WHERE rn = 1`,hints:["The starter returns a row for every order, duplicated or not. Duplicates are defined by comparing two rows, so join `payments` to itself.","Join on the same order, amount and method with `b.paid_at > a.paid_at AND b.paid_at <= a.paid_at + INTERVAL 10 SECOND`. If a duplicate could match several earlier rows, keep the earliest with `row_number()` per duplicate."],explanation:"Near-duplicate detection needs a tolerance window, so it is a self-join (a band join on time), not a `GROUP BY`. Keeping the payload equality (amount, method) avoids flagging a legitimate second payment. In production you would also emit the dedup decision into an audit table, so that finance can reconcile what was dropped."}],E=Object.freeze(Object.defineProperty({__proto__:null,default:_},Symbol.toStringTag,{value:"Module"})),g=[{id:"lab-funnel-users-per-step",title:"Users reaching each funnel step",difficulty:"easy",topic:"funnels-and-retention",tags:["funnel","COUNT DISTINCT","conditional aggregation"],tables:["events"],prompt:"The funnel steps are `page_view` (1), `add_to_cart` (2), `checkout` (3), `purchase` (4). For each step return `step_no`, `event_type`, `users` (distinct users with at least one event of that type, in any order) and `pct_of_step_1` (100 * users / users with a page_view, rounded to 2 decimals). Order by `step_no`.",starter:`SELECT event_type, count(*) AS users
FROM events
GROUP BY event_type`,solution:`WITH steps(step_no, event_type) AS (
  VALUES (1, 'page_view'), (2, 'add_to_cart'), (3, 'checkout'), (4, 'purchase')
), counts AS (
  SELECT s.step_no, s.event_type, count(DISTINCT e.user_id) AS users
  FROM steps s
  LEFT JOIN events e ON e.event_type = s.event_type
  GROUP BY s.step_no, s.event_type
)
SELECT step_no, event_type, users,
       round(100.0 * users / max(users) FILTER (WHERE step_no = 1) OVER (), 2) AS pct_of_step_1
FROM counts
ORDER BY step_no`,ordered:!0,hints:["`count(*)` counts events; a funnel counts **distinct users**.","A small `VALUES` list gives each step its number (and guarantees a row even for a step nobody reached). Divide by the step-1 count, e.g. with a window `max(users) FILTER (WHERE step_no = 1) OVER ()` or a scalar subquery."],explanation:'This "unordered" funnel counts anyone who ever did each step, so it can overstate conversion: a user who purchased via a direct link without a page_view would still count at step 4. The ordered version (next problem) requires each step after the previous one. Driving the query from a steps table rather than `GROUP BY event_type` also fixes the display order and keeps empty steps.'},{id:"lab-ordered-funnel",title:"Strictly ordered funnel",difficulty:"hard",topic:"funnels-and-retention",tags:["ordered funnel","conditional MIN","sequential steps"],tables:["events"],prompt:"Per user, step 1 is their **first** `page_view`. Step 2 is their first `add_to_cart` strictly **after** step 1, step 3 their first `checkout` strictly after step 2, step 4 their first `purchase` strictly after step 3 (by `event_time`, across all of the user's events, not per session). Return `step_no`, `step`, `users` reaching that step. Order by `step_no`.",starter:`SELECT 1 AS step_no, 'page_view' AS step, count(DISTINCT user_id) FILTER (WHERE event_type = 'page_view') AS users FROM events
UNION ALL
SELECT 2, 'add_to_cart', count(DISTINCT user_id) FILTER (WHERE event_type = 'add_to_cart') FROM events
UNION ALL
SELECT 3, 'checkout', count(DISTINCT user_id) FILTER (WHERE event_type = 'checkout') FROM events
UNION ALL
SELECT 4, 'purchase', count(DISTINCT user_id) FILTER (WHERE event_type = 'purchase') FROM events
ORDER BY 1`,solution:`WITH s1 AS (
  SELECT user_id, min(event_time) AS t1 FROM events WHERE event_type = 'page_view' GROUP BY user_id
), s2 AS (
  SELECT s1.user_id, s1.t1, min(e.event_time) AS t2
  FROM s1 LEFT JOIN events e ON e.user_id = s1.user_id AND e.event_type = 'add_to_cart' AND e.event_time > s1.t1
  GROUP BY s1.user_id, s1.t1
), s3 AS (
  SELECT s2.user_id, s2.t2, min(e.event_time) AS t3
  FROM s2 LEFT JOIN events e ON e.user_id = s2.user_id AND e.event_type = 'checkout' AND e.event_time > s2.t2
  GROUP BY s2.user_id, s2.t2
), s4 AS (
  SELECT s3.user_id, s3.t3, min(e.event_time) AS t4
  FROM s3 LEFT JOIN events e ON e.user_id = s3.user_id AND e.event_type = 'purchase' AND e.event_time > s3.t3
  GROUP BY s3.user_id, s3.t3
)
SELECT 1 AS step_no, 'page_view' AS step, count(*) AS users FROM s1
UNION ALL SELECT 2, 'add_to_cart', count(t2) FROM s2
UNION ALL SELECT 3, 'checkout', count(t3) FROM s3
UNION ALL SELECT 4, 'purchase', count(t4) FROM s4
ORDER BY step_no`,ordered:!0,hints:["Each step's timestamp depends on the previous step's timestamp, so compute them in sequence: t1, then t2 > t1, then t3 > t2, then t4 > t3.","Chain CTEs: each one LEFT JOINs the user's events of the next type with `event_time > previous_t` and takes `min(event_time)`. A user reaches step k if `t_k` is not NULL; `count(t_k)` counts them."],explanation:'An ordered funnel must anchor each step on the timestamp of the previous step; checking only "did the user ever do X" counts out-of-order journeys. Using the **first** qualifying event at each step maximises the chance of completing the funnel. Real products add a conversion window (e.g. `t4 <= t1 + INTERVAL 7 DAY`) and often reset per session. Snowflake (`MATCH_RECOGNIZE`) and Oracle can also express this as a row pattern.'},{id:"lab-first-order-channel-attribution",title:"First-purchase channel attribution",difficulty:"medium",topic:"funnels-and-retention",tags:["first touch","attribution","ROW_NUMBER"],tables:["orders","customers"],prompt:"Attribute each existing customer (ignore orphans) to the `channel` of their **first completed order** (earliest `ordered_at`, ties broken by lower `order_id`). Per channel, return `channel`, `customers` (attributed to it) and `lifetime_revenue`: the total of **all** completed orders (in any channel) of those customers. Row order does not matter.",starter:`SELECT o.channel, count(DISTINCT o.customer_id) AS customers, sum(o.total_amount) AS lifetime_revenue
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status = 'completed'
GROUP BY o.channel`,solution:`WITH completed AS (
  SELECT o.*
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id
  WHERE o.status = 'completed'
), first_order AS (
  SELECT customer_id, channel
  FROM (SELECT customer_id, channel,
               row_number() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS rn
        FROM completed) x
  WHERE rn = 1
), lifetime AS (
  SELECT customer_id, sum(total_amount) AS revenue FROM completed GROUP BY customer_id
)
SELECT f.channel, count(*) AS customers, sum(l.revenue) AS lifetime_revenue
FROM first_order f
JOIN lifetime l ON l.customer_id = f.customer_id
GROUP BY f.channel`,hints:["The starter credits a customer to every channel they used and splits revenue by order channel. Attribution assigns each customer to exactly one channel.","Find each customer's first completed order with `row_number()`, compute lifetime revenue per customer separately, join the two on `customer_id`, then group by the first channel."],explanation:'First-touch attribution is "top-1 per group" followed by a join to a per-customer metric. Keep the two at the same grain (one row per customer) before joining, otherwise you are back to fan-out. Last-touch is the same query with `ORDER BY ordered_at DESC`; multi-touch models split the credit across touches instead.'},{id:"lab-new-vs-returning-monthly",title:"New vs returning customers per month",difficulty:"medium",topic:"funnels-and-retention",tags:["first purchase","cohort","monthly active"],tables:["orders"],prompt:"Using **completed** orders and all `customer_id`s (orphans included), return per month of `order_date`: `month` (first day), `active_customers` (distinct customers with a completed order that month), `new_customers` (active customers whose first-ever completed order is in that month) and `returning_customers` (the rest). Order by `month`.",starter:`SELECT CAST(date_trunc('month', order_date) AS DATE) AS month,
       count(DISTINCT customer_id) AS active_customers
FROM orders
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1`,solution:`WITH c AS (
  SELECT customer_id, CAST(date_trunc('month', order_date) AS DATE) AS month
  FROM orders
  WHERE status = 'completed'
), firsts AS (
  SELECT customer_id, min(month) AS first_month FROM c GROUP BY customer_id
)
SELECT c.month,
       count(DISTINCT c.customer_id) AS active_customers,
       count(DISTINCT c.customer_id) FILTER (WHERE c.month = f.first_month) AS new_customers,
       count(DISTINCT c.customer_id) FILTER (WHERE c.month > f.first_month) AS returning_customers
FROM c
JOIN firsts f ON f.customer_id = c.customer_id
GROUP BY c.month
ORDER BY c.month`,ordered:!0,hints:["Compute each customer's first completed month once, then compare every activity month with it.","Join activity (customer, month) to (customer, first_month) and count distinct customers with `FILTER (WHERE month = first_month)` and `FILTER (WHERE month > first_month)`."],explanation:'"New" is relative to the customer\'s whole history, so it needs a per-customer first date computed over all time, not within the month. Counting distinct customers (not orders) keeps a customer with several orders in a month from being counted twice. The same skeleton gives resurrected users (active this month, not last month, not new) with one more `lag`.'},{id:"lab-monthly-retention-cohorts",title:"Monthly retention cohorts",difficulty:"hard",topic:"funnels-and-retention",tags:["cohort analysis","retention","date_diff"],tables:["orders"],prompt:"A customer's cohort is the month of their first **completed** order (all `customer_id`s, orphans included). For each cohort and each month offset at which **at least one** cohort member placed a completed order, return `cohort_month` (first day), `month_offset` (0 = the cohort month, 1 = the next calendar month, …), `active_customers`, `cohort_size` and `retention_pct` (100 * active / cohort size, rounded to 2 decimals). Row order does not matter.",starter:`SELECT CAST(date_trunc('month', order_date) AS DATE) AS cohort_month,
       0 AS month_offset,
       count(DISTINCT customer_id) AS active_customers
FROM orders
WHERE status = 'completed'
GROUP BY 1`,solution:`WITH activity AS (
  SELECT DISTINCT customer_id, CAST(date_trunc('month', order_date) AS DATE) AS month
  FROM orders
  WHERE status = 'completed'
), cohorts AS (
  SELECT customer_id, min(month) AS cohort_month FROM activity GROUP BY customer_id
), sizes AS (
  SELECT cohort_month, count(*) AS cohort_size FROM cohorts GROUP BY cohort_month
)
SELECT c.cohort_month,
       date_diff('month', c.cohort_month, a.month) AS month_offset,
       count(*) AS active_customers,
       s.cohort_size,
       round(100.0 * count(*) / s.cohort_size, 2) AS retention_pct
FROM activity a
JOIN cohorts c ON c.customer_id = a.customer_id
JOIN sizes s   ON s.cohort_month = c.cohort_month
GROUP BY c.cohort_month, month_offset, s.cohort_size`,hints:["Three building blocks: distinct (customer, active month) pairs; each customer's cohort month; and each cohort's size.","Month offset: `date_diff('month', cohort_month, month)` in DuckDB (`DATEDIFF(month, …)` in Snowflake / SQL Server; in PostgreSQL `(extract(year FROM age(m, c)) * 12 + extract(month FROM age(m, c)))`). Group by cohort and offset; divide by the cohort size."],explanation:'The cohort size must be computed separately from the active counts; dividing by the offset-0 row only works if every cohort member is active at offset 0 (true by definition here, but not for "signup cohort" variants). Deduplicating to (customer, month) first means several orders in a month count once. Dense output (including zero cells) needs a cross join of cohorts with an offset spine.'},{id:"lab-mrr-by-month-end",title:"Active subscriptions and MRR at each month end",difficulty:"hard",topic:"funnels-and-retention",tags:["point-in-time","range join","MRR","open intervals"],tables:["subscriptions"],prompt:"A subscription is active on day `d` if `start_date <= d` and (`end_date` is NULL or `end_date >= d`). For each **month-end date of 2024** (2024-01-31, 2024-02-29, …, 2024-12-31), return `month_end`, `active_subscriptions`, `active_customers` (distinct) and `mrr` (sum of `monthly_price` of active subscriptions, 0 if none). Order by `month_end`.",starter:`SELECT CAST(date_trunc('month', start_date) AS DATE) AS month_end,
       count(*) AS active_subscriptions,
       count(DISTINCT customer_id) AS active_customers,
       sum(monthly_price) AS mrr
FROM subscriptions
GROUP BY 1
ORDER BY 1`,solution:`WITH RECURSIVE months(m) AS (
  SELECT DATE '2024-01-01'
  UNION ALL
  SELECT CAST(m + INTERVAL 1 MONTH AS DATE) FROM months WHERE m < DATE '2024-12-01'
), month_ends AS (
  SELECT CAST(m + INTERVAL 1 MONTH - INTERVAL 1 DAY AS DATE) AS d FROM months
)
SELECT me.d AS month_end,
       count(s.subscription_id) AS active_subscriptions,
       count(DISTINCT s.customer_id) AS active_customers,
       coalesce(sum(s.monthly_price), 0) AS mrr
FROM month_ends me
LEFT JOIN subscriptions s
  ON s.start_date <= me.d
 AND (s.end_date IS NULL OR s.end_date >= me.d)
GROUP BY me.d
ORDER BY me.d`,ordered:!0,hints:["This is a point-in-time question: generate the 12 month-end dates first, then find what was active on each.",'Month end = first of month + 1 month - 1 day (or `last_day()`). LEFT JOIN subscriptions with a range condition; remember the NULL end date means "still active".'],explanation:"Snapshot metrics (active subscribers, MRR, headcount) are a range join between a date spine and validity intervals. The NULL end date must be handled explicitly: `end_date >= d` is UNKNOWN for active subscriptions and would drop them. On large tables a range join is expensive; warehouses often precompute a daily snapshot fact or use an event table of +1/-1 changes with a running sum."}],y=Object.freeze(Object.defineProperty({__proto__:null,default:g},Symbol.toStringTag,{value:"Module"})),R=`CREATE TEMP TABLE customer_segment_history AS
SELECT customer_id, segment, DATE '2023-01-01' AS valid_from, CAST(NULL AS DATE) AS valid_to
FROM customers
WHERE customer_id NOT IN (1, 2, 14, 20, 38)
UNION ALL
SELECT * FROM (VALUES
  (1,  'smb',        DATE '2023-01-01', DATE '2024-11-15'),
  (1,  'consumer',   DATE '2024-11-15', NULL),
  (2,  'enterprise', DATE '2023-01-01', DATE '2024-12-01'),
  (2,  'consumer',   DATE '2024-12-01', NULL),
  (14, 'consumer',   DATE '2023-01-01', DATE '2024-04-01'),
  (14, 'smb',        DATE '2024-04-01', NULL),
  (20, 'smb',        DATE '2023-01-01', DATE '2024-05-10'),
  (20, 'consumer',   DATE '2024-05-10', NULL),
  (38, 'enterprise', DATE '2023-01-01', DATE '2024-08-16'),
  (38, 'consumer',   DATE '2024-08-16', NULL)
) v(customer_id, segment, valid_from, valid_to);`,S=`CREATE TEMP TABLE plan_snapshots AS
SELECT CAST(DATE '2024-01-01' + CAST(i AS INTEGER) AS DATE) AS snapshot_date,
       c AS customer_id,
       CASE
         WHEN c = 1 THEN CASE WHEN i BETWEEN 5 AND 11 THEN 'plus' ELSE 'basic' END
         WHEN c = 2 THEN 'pro'
         ELSE CASE WHEN i < 9 THEN 'basic' WHEN i < 14 THEN 'plus' ELSE 'pro' END
       END AS plan
FROM range(0, 20) d(i), range(1, 4) k(c);`,O=[{id:"lab-payment-grain-violations",title:"Grain test: one payment per order?",difficulty:"easy",topic:"data-quality-tests",tags:["uniqueness test","grain","HAVING"],tables:["payments"],prompt:"The `payments` table is supposed to hold one row per `order_id`. Return the violations: `order_id`, `payment_rows` (how many rows that order has), `total_paid` (sum of `amount` over those rows), for every order with more than one payment row. Row order does not matter.",starter:`SELECT order_id, count(*) AS payment_rows, sum(amount) AS total_paid
FROM payments
GROUP BY order_id`,solution:`SELECT order_id, count(*) AS payment_rows, sum(amount) AS total_paid
FROM payments
GROUP BY order_id
HAVING count(*) > 1`,hints:["Group by the column that should be unique.","A filter on an aggregate goes in `HAVING`, not `WHERE`."],explanation:"This is the uniqueness test that dbt's `unique` test (and every DQ framework) runs: group by the supposed key and keep groups with more than one row. Note the `total_paid` column: anyone summing `payments.amount` per order without deduplicating double-counts these orders. A test that returns rows should fail the pipeline before the data reaches dashboards."},{id:"lab-items-sold-before-launch",title:"Products sold before they launched",difficulty:"medium",topic:"data-quality-tests",tags:["business rule test","cross-table check"],tables:["order_items","orders","products"],prompt:"An order line for a product is impossible if the order's `order_date` is **before** the product's `launched_at`. Return one row per product with such lines (any order status): `product_id`, `name`, `launched_at`, `bad_lines` (number of offending lines) and `first_bad_order_date`. Row order does not matter.",starter:`SELECT p.product_id, p.name, p.launched_at, count(*) AS bad_lines, min(o.order_date) AS first_bad_order_date
FROM products p
JOIN order_items i ON i.product_id = p.product_id
JOIN orders o      ON o.order_id = i.order_id
GROUP BY p.product_id, p.name, p.launched_at`,solution:`SELECT p.product_id, p.name, p.launched_at,
       count(*) AS bad_lines,
       min(o.order_date) AS first_bad_order_date
FROM order_items i
JOIN orders o   ON o.order_id = i.order_id
JOIN products p ON p.product_id = i.product_id
WHERE o.order_date < p.launched_at
GROUP BY p.product_id, p.name, p.launched_at`,hints:["The rule compares a column of `orders` with a column of `products`, so you need both joined to `order_items`.","Filter the offending rows in `WHERE o.order_date < p.launched_at` before grouping."],explanation:'Not every data-quality test is a NULL or uniqueness check; cross-table business rules ("no sale before launch", "no shipment before order", "refund ≤ payment") catch broken joins, timezone shifts and bad backfills. Return the offending keys with a count and an example, so whoever is paged can start investigating immediately.'},{id:"lab-referential-integrity-report",title:"Referential integrity report",difficulty:"medium",topic:"data-quality-tests",tags:["orphans","foreign keys","UNION ALL","test suite"],tables:["orders","customers","order_items","products","payments","employees","departments"],prompt:"Build a one-query test report with exactly these rows, each counting the child rows whose **non-NULL** foreign key has no matching parent: `orders.customer_id` (→ customers), `order_items.order_id` (→ orders), `order_items.product_id` (→ products), `payments.order_id` (→ orders), `employees.department_id` (→ departments). Columns: `check_name` (exactly the strings above, e.g. `orders.customer_id`), `violations`. Order by `check_name`.",starter:`SELECT 'orders.customer_id' AS check_name, count(*) AS violations
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
ORDER BY 1`,solution:`SELECT 'orders.customer_id' AS check_name, count(*) AS violations
FROM orders o WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.customer_id = o.customer_id)
UNION ALL
SELECT 'order_items.order_id', count(*)
FROM order_items i WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = i.order_id)
UNION ALL
SELECT 'order_items.product_id', count(*)
FROM order_items i WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.product_id = i.product_id)
UNION ALL
SELECT 'payments.order_id', count(*)
FROM payments p WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id)
UNION ALL
SELECT 'employees.department_id', count(*)
FROM employees e
WHERE e.department_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments d WHERE d.department_id = e.department_id)
ORDER BY check_name`,ordered:!0,hints:["One `SELECT … count(*)` per check, glued together with `UNION ALL`. Each check is an anti-join.",'Use `NOT EXISTS` per check. For `employees.department_id`, exclude NULLs first: a NULL foreign key is "not set", not an orphan.'],explanation:"Warehouses mostly do not enforce foreign keys (Snowflake, BigQuery and Databricks treat them as informational), so pipelines test them. Returning a row per check, including zeros, makes the report easy to alert on and to trend over time. The NULL rule matches SQL's own foreign-key semantics: a NULL reference is allowed and is not a violation."},{id:"lab-reconcile-orders-payments",title:"Reconcile orders with payments",difficulty:"hard",topic:"data-quality-tests",tags:["reconciliation","fan-out","dedup","LEFT JOIN"],tables:["orders","payments"],prompt:"Per order `status`, return: `status`, `orders` (count of orders), `order_amount` (sum of `total_amount`, **not** inflated by duplicate payments), `payment_rows` (raw payment rows for those orders), `paid_raw` (sum of all payment amounts, 0 if none) and `paid_dedup` (sum counting at most **one** payment per order, 0 if none; duplicates have the same amount, so any one will do). Row order does not matter.",starter:`SELECT o.status,
       count(*) AS orders,
       sum(o.total_amount) AS order_amount,
       count(p.payment_id) AS payment_rows,
       sum(p.amount) AS paid_raw,
       sum(p.amount) AS paid_dedup
FROM orders o
LEFT JOIN payments p ON p.order_id = o.order_id
GROUP BY o.status`,solution:`WITH pay AS (
  SELECT order_id, count(*) AS payment_rows, sum(amount) AS paid_raw, max(amount) AS paid_once
  FROM payments
  GROUP BY order_id
)
SELECT o.status,
       count(*) AS orders,
       sum(o.total_amount) AS order_amount,
       coalesce(sum(p.payment_rows), 0) AS payment_rows,
       coalesce(sum(p.paid_raw), 0) AS paid_raw,
       coalesce(sum(p.paid_once), 0) AS paid_dedup
FROM orders o
LEFT JOIN pay p ON p.order_id = o.order_id
GROUP BY o.status`,hints:["Joining orders to raw payments repeats an order once per payment row, inflating `count(*)` and `sum(total_amount)` for the 22 duplicated orders.","Aggregate `payments` to one row per `order_id` first (rows, raw sum, one amount), LEFT JOIN that to `orders`, and wrap the sums in `coalesce(…, 0)` for statuses with no payments."],explanation:"Reconciliation compares two systems at a common grain, here the order. Pre-aggregating the child table removes the fan-out, and keeping both `paid_raw` and `paid_dedup` makes the size of the duplicate problem visible instead of hiding it. The expected outcome is also a test: completed and refunded orders should satisfy `order_amount = paid_dedup`; pending and cancelled should have no payments."},{id:"lab-overlapping-subscriptions-pairs",title:"Overlapping subscriptions for the same customer",difficulty:"medium",topic:"data-quality-tests",tags:["interval overlap","self-join","open-ended intervals"],tables:["subscriptions"],prompt:"Business rule: a customer should not hold two subscriptions on the same day. Periods are inclusive `[start_date, end_date]` and a NULL `end_date` means open-ended. Return every overlapping pair once: `customer_id`, `first_subscription_id`, `second_subscription_id` (first < second) and `overlap_start` (the later of the two start dates). Row order does not matter.",starter:`SELECT a.customer_id, a.subscription_id, b.subscription_id, b.start_date AS overlap_start
FROM subscriptions a
JOIN subscriptions b
  ON b.customer_id = a.customer_id
 AND b.subscription_id <> a.subscription_id
 AND b.start_date BETWEEN a.start_date AND a.end_date`,solution:`SELECT a.customer_id,
       a.subscription_id AS first_subscription_id,
       b.subscription_id AS second_subscription_id,
       CASE WHEN a.start_date > b.start_date THEN a.start_date ELSE b.start_date END AS overlap_start
FROM subscriptions a
JOIN subscriptions b
  ON  b.customer_id = a.customer_id
  AND a.subscription_id < b.subscription_id
  AND a.start_date <= coalesce(b.end_date, DATE '9999-12-31')
  AND b.start_date <= coalesce(a.end_date, DATE '9999-12-31')`,hints:["Two intervals overlap exactly when each one starts on or before the other one ends: `a.start <= b.end AND b.start <= a.end`.","Treat a NULL end as far in the future with `coalesce`, and use `a.subscription_id < b.subscription_id` so each pair appears once."],explanation:"The overlap test `a.start <= b.end AND b.start <= a.end` covers every case (partial, containment, identical) in two comparisons; checking whether one start falls inside the other interval misses the case where `b` contains `a`. The starter also loses open-ended subscriptions because `BETWEEN … AND NULL` is UNKNOWN, and returns each pair twice."},{id:"lab-scd2-point-in-time-revenue",title:"Revenue by segment as of the order date (SCD2 join)",difficulty:"hard",topic:"slowly-changing-dimensions",tags:["SCD type 2","point-in-time join","half-open interval"],tables:["orders","customers"],setup:R,prompt:"A temp table `customer_segment_history(customer_id, segment, valid_from, valid_to)` is a type-2 dimension: each version is valid on `[valid_from, valid_to)` (from inclusive, to **exclusive**), and `valid_to` NULL marks the current version. For **completed** orders of customers in the history, return revenue by the segment the customer had **on the order date**: `segment`, `orders`, `revenue` (sum of `total_amount`). Row order does not matter.",starter:`SELECT h.segment, count(*) AS orders, sum(o.total_amount) AS revenue
FROM orders o
JOIN customer_segment_history h ON h.customer_id = o.customer_id
WHERE o.status = 'completed'
GROUP BY h.segment`,solution:`SELECT h.segment, count(*) AS orders, sum(o.total_amount) AS revenue
FROM orders o
JOIN customer_segment_history h
  ON  h.customer_id = o.customer_id
  AND o.order_date >= h.valid_from
  AND (h.valid_to IS NULL OR o.order_date < h.valid_to)
WHERE o.status = 'completed'
GROUP BY h.segment`,hints:["Joining on `customer_id` alone matches every version of the customer, so orders of customers with history are counted twice.",'Add the validity condition to the join: `o.order_date >= h.valid_from AND (h.valid_to IS NULL OR o.order_date < h.valid_to)`. Using only the current version (`valid_to IS NULL`) gives "as of today", which is a different question.'],explanation:"A type-2 dimension is joined with a range predicate so each fact row meets exactly one version: the one valid at the event time. Half-open intervals make adjacent versions tile without overlap: an order on the change date belongs to the new version. In a star schema you would usually resolve this once at load time and store the version's surrogate key on the fact, so queries join on a plain equality."},{id:"lab-scd2-from-daily-snapshots",title:"Build SCD2 history from daily snapshots",difficulty:"hard",topic:"slowly-changing-dimensions",tags:["SCD type 2","gaps and islands","change back","LEAD"],tables:[],setup:S,prompt:"A temp table `plan_snapshots(snapshot_date, customer_id, plan)` holds one row per customer per day (no missing days). Collapse it into type-2 versions: a new version starts on the first day of the table and whenever the plan differs from the previous day's (a customer can return to an earlier plan, which is a **new** version). Return `customer_id`, `plan`, `valid_from` (first day of the version) and `valid_to` (the next version's `valid_from`, exclusive; NULL for the current version). Row order does not matter.",starter:`SELECT customer_id, plan, min(snapshot_date) AS valid_from, max(snapshot_date) AS valid_to
FROM plan_snapshots
GROUP BY customer_id, plan`,solution:`WITH flagged AS (
  SELECT *,
         CASE WHEN plan IS DISTINCT FROM lag(plan) OVER (PARTITION BY customer_id ORDER BY snapshot_date)
              THEN 1 ELSE 0 END AS is_change
  FROM plan_snapshots
), versioned AS (
  SELECT *, sum(is_change) OVER (PARTITION BY customer_id ORDER BY snapshot_date ROWS UNBOUNDED PRECEDING) AS version_no
  FROM flagged
), versions AS (
  SELECT customer_id, version_no, min(plan) AS plan, min(snapshot_date) AS valid_from
  FROM versioned
  GROUP BY customer_id, version_no
)
SELECT customer_id, plan, valid_from,
       lead(valid_from) OVER (PARTITION BY customer_id ORDER BY valid_from) AS valid_to
FROM versions`,hints:['Grouping by (customer, plan) merges basic → plus → basic into one "basic" row spanning the plus period. Each run of unchanged days must be its own group: this is gaps-and-islands.',"Flag a change when `plan IS DISTINCT FROM lag(plan)`, running-sum the flags into a version number, group by it, then set `valid_to = lead(valid_from)` per customer."],explanation:'Snapshot-to-SCD2 is the islands pattern on an attribute value, and the "change back" case is exactly what `GROUP BY plan` gets wrong. Using `lead(valid_from)` as the exclusive end makes versions tile with no gaps or overlaps, and leaves NULL on the current row. With many tracked columns, compare a hash of all of them (NULL-safe) instead of one column; and if snapshots can be missing, decide explicitly whether a gap closes the version.'}],f=Object.freeze(Object.defineProperty({__proto__:null,default:O},Symbol.toStringTag,{value:"Module"})),T=Object.assign({"./lab/01-basics-joins.ts":s,"./lab/02-aggregation.ts":n,"./lab/03-nulls-and-traps.ts":d,"./lab/04-windows.ts":c,"./lab/05-ctes-recursion.ts":l,"./lab/06-gaps-islands-sessions.ts":h,"./lab/07-topn-dedup.ts":E,"./lab/08-funnels-retention.ts":y,"./lab/09-modeling-quality.ts":f}),N={"basics-joins":"Basics & joins",aggregation:"Aggregation","nulls-and-traps":"NULLs & traps",windows:"Window functions","ctes-recursion":"CTEs & recursion","gaps-islands-sessions":"Gaps, islands & sessions","topn-dedup":"Top-N & dedup","funnels-retention":"Funnels & retention","modeling-quality":"Modeling & data quality"},A=e=>N[e]??e.replace(/-/g," ").replace(/^\w/,t=>t.toUpperCase()),v=Object.entries(T).sort(([e],[t])=>e.localeCompare(t)).map(([e,t])=>{const r=e.split("/").pop().replace(/\.ts$/,"").replace(/^\d+-/,"");return{id:r,title:A(r),problems:t.default}}),L=v.flatMap(e=>e.problems.map(t=>({...t,group:e.id}))),w=new Map(L.map(e=>[e.id,e]));export{L as LAB,w as LAB_BY_ID,v as LAB_GROUPS};
