# Metric card — exercises STACK auto-layout, GRID, ICON, IMAGE, EFFECT.
# Three KPI cards in a row; each card uses STACK for header + value.

SCREEN 1440 900 theme:light

TOKEN surface #ffffff
TOKEN ink #111827
TOKEN muted #6b7280
TOKEN accent #10B981

FILL 0 0 1440 900 #f9fafb

GRID kpis 32 32 1376 columns:3 gap:24

  LAYER card-revenue 0 0 440 160 bg:$surface r:12
    STACK rev-stack 24 24 direction:column gap:12
      STACK rev-head 0 0 direction:row gap:8 align:left
        ICON rev-icon 0 0 "trending-up" size:18 color:$accent
        TEXT rev-title 0 0 "Revenue" size:13 weight:medium color:$muted
      END
      TEXT rev-value 0 0 "$48,210" size:28 weight:bold color:$ink
      IMAGE rev-spark 0 0 392 32 "sparklines/revenue.svg" fit:contain
    END
  END

  LAYER card-users 0 0 440 160 bg:$surface r:12
    STACK usr-stack 24 24 direction:column gap:12
      STACK usr-head 0 0 direction:row gap:8 align:left
        ICON usr-icon 0 0 "users" size:18 color:$accent
        TEXT usr-title 0 0 "Active users" size:13 weight:medium color:$muted
      END
      TEXT usr-value 0 0 "12,408" size:28 weight:bold color:$ink
      IMAGE usr-spark 0 0 392 32 "sparklines/users.svg" fit:contain
    END
  END

  LAYER card-churn 0 0 440 160 bg:$surface r:12
    STACK ch-stack 24 24 direction:column gap:12
      STACK ch-head 0 0 direction:row gap:8 align:left
        ICON ch-icon 0 0 "alert-circle" size:18 color:$accent
        TEXT ch-title 0 0 "Churn" size:13 weight:medium color:$muted
      END
      TEXT ch-value 0 0 "2.1%" size:28 weight:bold color:$ink
      IMAGE ch-spark 0 0 392 32 "sparklines/churn.svg" fit:contain
    END
  END

END

EFFECT card-revenue shadow blur:24 y:8 color:#0f172a14
EFFECT card-users shadow blur:24 y:8 color:#0f172a14
EFFECT card-churn shadow blur:24 y:8 color:#0f172a14
