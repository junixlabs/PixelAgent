SCREEN 1440 900 theme:light

TOKEN bg #f9fafb
TOKEN surface #ffffff
TOKEN ink #111827
TOKEN ink-soft #374151
TOKEN muted #6b7280
TOKEN primary #6366f1
TOKEN primary-soft #eef2ff
TOKEN success #10b981
TOKEN warning #f59e0b
TOKEN danger #ef4444

FILL 0 0 1440 900 $bg

LAYER topnav 0 0 1440 64 bg:$surface border:1 #e5e7eb
  TEXT brand 24 20 "Vela" size:18 weight:bold color:$ink
  RECT search-bg 200 16 380 32 bg:$bg r:6 border:1 #e5e7eb
  TEXT search-placeholder 220 27 "Search transactions, customers..." size:12 color:$muted
  TEXT navlink-1 620 24 "Overview" size:13 weight:medium color:$primary
  TEXT navlink-2 720 24 "Customers" size:13 color:$muted
  TEXT navlink-3 820 24 "Reports" size:13 color:$muted
  TEXT navlink-4 900 24 "Settings" size:13 color:$muted
  RECT bell 1300 18 28 28 bg:$bg r:14 border:1 #e5e7eb
  RECT avatar 1340 16 32 32 bg:$primary r:16
  TEXT avatar-init 1340 22 "JL" size:12 weight:semibold color:#ffffff align:center max-width:32
END

LAYER sidebar 0 64 220 836 bg:$surface border:1 #e5e7eb
  TEXT side-section-1 24 24 "MAIN" size:11 weight:semibold color:$muted
  RECT side-active 16 48 188 36 bg:$primary-soft r:6
  TEXT side-1 32 58 "Dashboard" size:13 weight:semibold color:$primary
  TEXT side-2 32 100 "Customers" size:13 color:$ink-soft
  TEXT side-3 32 132 "Transactions" size:13 color:$ink-soft
  TEXT side-4 32 164 "Reports" size:13 color:$ink-soft
  TEXT side-5 32 196 "Invoices" size:13 color:$ink-soft
  TEXT side-section-2 24 244 "WORKSPACE" size:11 weight:semibold color:$muted
  TEXT side-6 32 272 "Team" size:13 color:$ink-soft
  TEXT side-7 32 304 "Integrations" size:13 color:$ink-soft
  TEXT side-8 32 336 "API keys" size:13 color:$ink-soft
END

TEXT page-title 252 90 "Good morning, Jordan" size:26 weight:bold color:$ink
TEXT page-sub 252 124 "Here's what's happening with your store today." size:14 color:$muted

LAYER kpi-1 252 168 264 104 bg:$surface r:10 border:1 #e5e7eb
  TEXT k1-label 16 16 "Revenue" size:12 weight:medium color:$muted
  TEXT k1-value 16 36 "$48,210" size:26 weight:bold color:$ink
  RECT k1-trend 16 76 56 20 bg:#dcfce7 r:10
  TEXT k1-trend-text 16 81 "+12.4%" size:11 weight:semibold color:$success align:center max-width:56
  TEXT k1-period 80 81 "vs last week" size:11 color:$muted
END

LAYER kpi-2 528 168 264 104 bg:$surface r:10 border:1 #e5e7eb
  TEXT k2-label 16 16 "Customers" size:12 weight:medium color:$muted
  TEXT k2-value 16 36 "12,840" size:26 weight:bold color:$ink
  RECT k2-trend 16 76 56 20 bg:#dcfce7 r:10
  TEXT k2-trend-text 16 81 "+8.1%" size:11 weight:semibold color:$success align:center max-width:56
  TEXT k2-period 80 81 "vs last week" size:11 color:$muted
END

LAYER kpi-3 804 168 264 104 bg:$surface r:10 border:1 #e5e7eb
  TEXT k3-label 16 16 "Conversion" size:12 weight:medium color:$muted
  TEXT k3-value 16 36 "3.4%" size:26 weight:bold color:$ink
  RECT k3-trend 16 76 56 20 bg:#fee2e2 r:10
  TEXT k3-trend-text 16 81 "-0.6%" size:11 weight:semibold color:$danger align:center max-width:56
  TEXT k3-period 80 81 "vs last week" size:11 color:$muted
END

LAYER kpi-4 1080 168 264 104 bg:$surface r:10 border:1 #e5e7eb
  TEXT k4-label 16 16 "Avg order" size:12 weight:medium color:$muted
  TEXT k4-value 16 36 "$78.20" size:26 weight:bold color:$ink
  RECT k4-trend 16 76 56 20 bg:#fef3c7 r:10
  TEXT k4-trend-text 16 81 "+0.2%" size:11 weight:semibold color:$warning align:center max-width:56
  TEXT k4-period 80 81 "vs last week" size:11 color:$muted
END

LAYER chart 252 296 552 372 bg:$surface r:10 border:1 #e5e7eb
  TEXT chart-title 24 20 "Revenue over time" size:16 weight:semibold color:$ink
  TEXT chart-sub 24 44 "Last 7 days" size:12 color:$muted
  RECT chart-bg 24 80 504 264 bg:$bg r:6
  TEXT chart-y-3 36 96 "$60k" size:10 color:$muted
  TEXT chart-y-2 36 200 "$30k" size:10 color:$muted
  TEXT chart-y-1 36 304 "$0" size:10 color:$muted
  RECT bar-1 100 244 40 88 bg:$primary r:4
  RECT bar-2 160 200 40 132 bg:$primary r:4
  RECT bar-3 220 176 40 156 bg:$primary r:4
  RECT bar-4 280 220 40 112 bg:$primary r:4
  RECT bar-5 340 152 40 180 bg:$primary r:4
  RECT bar-6 400 124 40 208 bg:$primary r:4
  RECT bar-7 460 96 40 236 bg:$primary r:4
END

LAYER activity 820 296 524 372 bg:$surface r:10 border:1 #e5e7eb
  TEXT act-title 24 20 "Recent activity" size:16 weight:semibold color:$ink
  TEXT act-sub 24 44 "Last 24 hours" size:12 color:$muted
  RECT a1-dot 24 88 8 8 bg:$success r:4
  TEXT a1 44 82 "Sarah Chen subscribed to Pro" size:13 color:$ink
  TEXT a1-time 44 100 "2 minutes ago" size:11 color:$muted
  RECT a2-dot 24 144 8 8 bg:$primary r:4
  TEXT a2 44 138 "New customer Marcus Kostov" size:13 color:$ink
  TEXT a2-time 44 156 "12 minutes ago" size:11 color:$muted
  RECT a3-dot 24 200 8 8 bg:$warning r:4
  TEXT a3 44 194 "Refund issued: order #4821" size:13 color:$ink
  TEXT a3-time 44 212 "1 hour ago" size:11 color:$muted
  RECT a4-dot 24 256 8 8 bg:$success r:4
  TEXT a4 44 250 "Plan upgraded: Acme Corp" size:13 color:$ink
  TEXT a4-time 44 268 "3 hours ago" size:11 color:$muted
  RECT a5-dot 24 312 8 8 bg:$primary r:4
  TEXT a5 44 306 "Invoice paid: $1,240" size:13 color:$ink
  TEXT a5-time 44 324 "5 hours ago" size:11 color:$muted
END

LAYER table 252 692 1092 184 bg:$surface r:10 border:1 #e5e7eb
  TEXT tbl-title 24 20 "Recent transactions" size:16 weight:semibold color:$ink
  TEXT col-1 24 54 "CUSTOMER" size:10 weight:semibold color:$muted
  TEXT col-2 320 54 "AMOUNT" size:10 weight:semibold color:$muted
  TEXT col-3 480 54 "STATUS" size:10 weight:semibold color:$muted
  TEXT col-4 700 54 "DATE" size:10 weight:semibold color:$muted

  TEXT r1-name 24 84 "Sarah Chen" size:13 weight:medium color:$ink
  TEXT r1-amt 320 84 "$129.00" size:13 color:$ink-soft
  RECT r1-tag 480 80 56 18 bg:#dcfce7 r:9
  TEXT r1-status 480 84 "Paid" size:11 weight:semibold color:$success align:center max-width:56
  TEXT r1-date 700 84 "Apr 28, 14:22" size:13 color:$muted

  TEXT r2-name 24 116 "Marcus Kostov" size:13 weight:medium color:$ink
  TEXT r2-amt 320 116 "$48.20" size:13 color:$ink-soft
  RECT r2-tag 480 112 56 18 bg:#dcfce7 r:9
  TEXT r2-status 480 116 "Paid" size:11 weight:semibold color:$success align:center max-width:56
  TEXT r2-date 700 116 "Apr 28, 13:55" size:13 color:$muted

  TEXT r3-name 24 148 "Lina Park" size:13 weight:medium color:$ink
  TEXT r3-amt 320 148 "$78.20" size:13 color:$ink-soft
  RECT r3-tag 480 144 76 18 bg:#fef3c7 r:9
  TEXT r3-status 480 148 "Pending" size:11 weight:semibold color:$warning align:center max-width:76
  TEXT r3-date 700 148 "Apr 28, 13:14" size:13 color:$muted
END
