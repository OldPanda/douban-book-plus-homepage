WITH daily_totals AS (
  SELECT
    event_day,
    SUM(CASE
      WHEN event_name = 'resources_displayed'
      THEN event_count ELSE 0
    END) AS resource_result_displays,
    SUM(CASE
      WHEN event_name = 'resources_displayed' AND resource_bucket <> '0'
      THEN event_count ELSE 0
    END) AS eligible_resource_displays,
    SUM(CASE WHEN event_name = 'share_opened' THEN event_count ELSE 0 END) AS share_opens,
    SUM(CASE WHEN event_name = 'share_target_clicked' THEN event_count ELSE 0 END) AS target_clicks,
    SUM(CASE WHEN event_name = 'share_referral_opened' THEN event_count ELSE 0 END) AS referral_opens,
    SUM(CASE WHEN event_name = 'share_referral_store_clicked' THEN event_count ELSE 0 END) AS store_clicks
  FROM share_analytics_daily
  GROUP BY event_day
)
SELECT
  event_day,
  resource_result_displays,
  eligible_resource_displays,
  share_opens,
  target_clicks,
  referral_opens,
  store_clicks,
  ROUND(1.0 * share_opens / NULLIF(resource_result_displays, 0), 3) AS share_opens_per_result_display,
  ROUND(1.0 * share_opens / NULLIF(eligible_resource_displays, 0), 3) AS share_opens_per_display_with_ebook,
  ROUND(100.0 * target_clicks / NULLIF(share_opens, 0), 2) AS target_click_rate_percent,
  ROUND(1.0 * referral_opens / NULLIF(target_clicks, 0), 3) AS referral_opens_per_target_click,
  ROUND(100.0 * store_clicks / NULLIF(referral_opens, 0), 2) AS referred_store_click_rate_percent
FROM daily_totals
ORDER BY event_day DESC;

SELECT
  event_target AS target,
  SUM(event_count) AS target_clicks,
  ROUND(
    100.0 * SUM(event_count) /
    NULLIF((SELECT SUM(event_count) FROM share_analytics_daily WHERE event_name = 'share_target_clicked'), 0),
    2
  ) AS target_mix_percent
FROM share_analytics_daily
WHERE event_name = 'share_target_clicked'
GROUP BY event_target
ORDER BY target_clicks DESC;

SELECT
  resource_bucket,
  SUM(event_count) AS displays
FROM share_analytics_daily
WHERE event_name = 'resources_displayed'
GROUP BY resource_bucket
ORDER BY CASE resource_bucket
  WHEN '0' THEN 0
  WHEN '1' THEN 1
  WHEN '2-3' THEN 2
  WHEN '4-7' THEN 3
  WHEN '8+' THEN 4
END;

SELECT
  event_target AS store,
  SUM(event_count) AS clicks,
  ROUND(
    100.0 * SUM(event_count) /
    NULLIF((SELECT SUM(event_count) FROM share_analytics_daily WHERE event_name = 'share_referral_store_clicked'), 0),
    2
  ) AS referred_store_mix_percent
FROM share_analytics_daily
WHERE event_name = 'share_referral_store_clicked'
GROUP BY event_target
ORDER BY clicks DESC;
