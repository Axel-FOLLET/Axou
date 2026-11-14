-- Q1 number of ads per company
SELECT companies.name AS company, COUNT(ads.id) AS ad_count -- shows the company name, renames the column company in the result + counts the non-NULL ads.id of each group, the result is named ad_count
FROM companies
LEFT JOIN ads ON ads.company_id = companies.id -- Attach the ads to their company. LEFT JOIN keeps all the rows of the left table (companies), even without a matching ad. With a plain JOIN, a company without ads would disappear, but the assignment wants them all to appear.
GROUP BY companies.id
ORDER BY ad_count DESC; -- Sort by number of ads, from largest to smallest (DESC = descending)

-- Q2 the ad with the most applications
SELECT ads.title AS title, COUNT(applications.id) AS application_count
FROM ads
JOIN applications ON applications.ad_id = ads.id
GROUP BY ads.id
ORDER BY application_count DESC -- Sort from the most applications to the fewest: the winning ad ends up on the first row.
LIMIT 1; -- Keep only the first row of the sorted result, so the best ad. If two ads were tied, LIMIT 1 would return only one, arbitrarily.

-- Q3 candidates of ad 1, with their message
SELECT ads.title AS title,
       people.first_name AS first_name,
       people.last_name AS last_name,
       people.email AS email,
       applications.message AS message,
       applications.created_at AS created_at
FROM applications
JOIN ads ON ads.id = applications.ad_id -- For each application, fetch the matching ad (to get title).
JOIN people ON people.id = applications.person_id -- For each application, fetch the person who applied (for first_name, last_name, email)
WHERE ads.id = 1
ORDER BY applications.created_at ASC; -- Sort by application date, from oldest to most recent (ASC = ascending, it is also the default)