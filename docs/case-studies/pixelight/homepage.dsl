SCREEN 1440 3760

TOKEN brown #3b2d1f
TOKEN ink #24170d
TOKEN sand #e2c3a4
TOKEN sand-soft #cfae8c
TOKEN cream #f7efe7
TOKEN paper #fffaf5
TOKEN muted #735d49
TOKEN line #e8dccc
TOKEN band #3b2618
TOKEN band-card #4b3422
TOKEN primary #3b2d1f

FILL 0 0 1440 3760 $paper
LAYER site-header 0 0 1440 84 bg:$cream border:1 $line role:header
  TEXT logo 72 28 "Pixelight" size:24 weight:bold color:$ink
  STACK nav-links 480 34 direction:row gap:36
    TEXT nav-home 0 0 "Home" size:15 weight:medium color:$ink href:"index.html"
    TEXT nav-products 0 0 "Products" size:15 color:$muted href:"products.html"
    TEXT nav-design 0 0 "Design" size:15 color:$muted href:"design.html"
    TEXT nav-cs 0 0 "Customer Service" size:15 color:$muted href:"customer-service.html"
    TEXT nav-sourcing 0 0 "Product Sourcing" size:15 color:$muted href:"product-sourcing.html"
  END
  BUTTON get-quote 1252 22 116 40 "Get quote" variant:primary href:"contact.html"
END
RECT eyebrow-pill 72 150 470 34 r:17 border:1 $line
TEXT hero-eyebrow 88 159 "ORDER FULFILLMENT • PRINTING • DESIGN SERVICE • SELLER OPERATIONS" size:11 weight:semibold color:$muted
TEXT hero-title 72 212 "Fulfillment made effortless for sellers." size:60 weight:bold color:$ink max-width:620 level:h1
TEXT hero-lead 72 452 "Pixelight is your behind-the-scenes operations partner. Send us your orders and artwork; we handle print preparation, production, quality checks, packing, fulfillment updates, customer support, and product sourcing." size:17 color:$muted max-width:560
TEXT hero-cta-note 72 548 "" size:1
BUTTON hero-cta 72 576 240 50 "View fulfillment products" variant:primary href:"products.html"
BUTTON hero-alt 328 576 180 50 "Send orders to us" variant:ghost href:"contact.html"
RECT hero-visual 770 140 598 486 bg:#f3e9dd r:28 border:1 #e4d4c0
TEXT hero-visual-label 979 372 "Pixelight workflow diagram" size:14 color:$muted align:left max-width:598
STATE hero-cta hover
  bg: #2e2317
END
FILL 0 700 1440 80 #f3e6d8
STACK marquee 120 728 direction:row gap:56
  TEXT mq-1 0 0 "Order fulfillment" size:22 color:$brown
  TEXT mq-2 0 0 "Design service" size:22 color:$brown
  TEXT mq-3 0 0 "Customer service" size:22 color:$brown
  TEXT mq-4 0 0 "Product sourcing" size:22 color:$brown
  TEXT mq-5 0 0 "Quality control" size:22 color:$brown
END
TEXT svc-title 72 862 "Operations support for growing brands" size:34 weight:semibold color:$ink level:h2
TEXT svc-sub 72 916 "Pixelight is built for sellers who already receive orders and need a reliable team to handle the work behind each order." size:16 color:$muted max-width:680
LAYER card-fulfill 72 980 306 230 bg:$paper r:22 border:1 $line
  RECT card-fulfill-icon 24 24 44 44 bg:$brown r:14
  TEXT card-fulfill-title 82 36 "Product fulfillment" size:18 weight:semibold color:$ink
  TEXT card-fulfill-body 24 92 "Fulfill different product types with printing, packing, quality checks, and shipping coordination." size:14 color:$muted max-width:258
END
LAYER card-design 402 980 306 230 bg:$paper r:22 border:1 $line
  RECT card-design-icon 24 24 44 44 bg:$brown r:14
  TEXT card-design-title 82 36 "Design Service" size:18 weight:semibold color:$ink
  TEXT card-design-body 24 92 "Professional design service for print-ready artwork, product mockups, and customized graphics for your brand." size:14 color:$muted max-width:258
END
LAYER card-support 732 980 306 230 bg:$paper r:22 border:1 $line
  RECT card-support-icon 24 24 44 44 bg:$brown r:14
  TEXT card-support-title 82 36 "Customer service" size:18 weight:semibold color:$ink
  TEXT card-support-body 24 92 "Support for buyer messages, order updates, replacements, refunds, and payment gateway issues." size:14 color:$muted max-width:258
END
LAYER card-sourcing 1062 980 306 230 bg:$paper r:22 border:1 $line
  RECT card-sourcing-icon 24 24 44 44 bg:$brown r:14
  TEXT card-sourcing-title 82 36 "Product sourcing" size:18 weight:semibold color:$ink
  TEXT card-sourcing-body 24 92 "Find, sample, customize, and source new products for your store or private-label operation." size:14 color:$muted max-width:258
END
FILL 0 1290 1440 470 $band
TEXT trust-title 72 1352 "The fulfillment partner 10,000+ sellers trust" size:38 weight:semibold color:$sand level:h2
LAYER stat-products 72 1448 306 200 bg:$band-card r:22 border:1 #6a4c33
  TEXT stat-products-num 24 40 "999+" size:44 weight:bold color:$sand
  TEXT stat-products-label 24 116 "Products available for fulfillment" size:14 color:$sand-soft max-width:258
END
LAYER stat-facilities 402 1448 306 200 bg:$band-card r:22 border:1 #6a4c33
  TEXT stat-facilities-num 24 40 "50+" size:44 weight:bold color:$sand
  TEXT stat-facilities-label 24 116 "Facilities in US, EU, VN and China" size:14 color:$sand-soft max-width:258
END
LAYER stat-countries 732 1448 306 200 bg:$band-card r:22 border:1 #6a4c33
  TEXT stat-countries-num 24 40 "160+" size:44 weight:bold color:$sand
  TEXT stat-countries-label 24 116 "Countries with fast delivery" size:14 color:$sand-soft max-width:258
END
LAYER stat-ontime 1062 1448 306 200 bg:$band-card r:22 border:1 #6a4c33
  TEXT stat-ontime-num 24 40 "98.9%" size:44 weight:bold color:$sand
  TEXT stat-ontime-label 24 116 "On-time fulfillment rate" size:14 color:$sand-soft max-width:258
END
LAYER why-copy 72 1840 380 640 bg:$brown r:28 role:aside
  TEXT why-eyebrow 28 36 "WHY PIXELIGHT" size:11 weight:semibold color:$sand
  TEXT why-title 28 72 "Why growing brands choose Pixelight" size:30 weight:semibold color:$paper max-width:324 level:h2
  TEXT why-body 28 220 "Pixelight gives sellers a reliable backend team for products, fulfillment, support, design, quality control, sourcing, and store operations — so you can scale without building everything in-house." size:15 color:$sand-soft max-width:324
  BUTTON why-btn 28 400 200 48 "Start with Pixelight" variant:secondary href:"contact.html"
END
LAYER why-products 492 1840 276 240 bg:$paper r:22 border:1 $line
  RECT why-products-icon 22 22 44 44 bg:$brown r:14
  TEXT why-products-title 22 84 "999+ high-quality products" size:16 weight:semibold color:$ink max-width:232
  TEXT why-products-body 22 136 "A growing catalog of proven products with reliable production quality." size:13 color:$muted max-width:232
END
LAYER why-support 792 1840 276 240 bg:$paper r:22 border:1 $line
  RECT why-support-icon 22 22 44 44 bg:$brown r:14
  TEXT why-support-title 22 84 "24/7 reliable support" size:16 weight:semibold color:$ink max-width:232
  TEXT why-support-body 22 136 "Responsive assistance that keeps your orders and customers moving." size:13 color:$muted max-width:232
END
LAYER why-qc 1092 1840 276 240 bg:$paper r:22 border:1 $line
  RECT why-qc-icon 22 22 44 44 bg:$brown r:14
  TEXT why-qc-title 22 84 "Photo quality checks" size:16 weight:semibold color:$ink max-width:232
  TEXT why-qc-body 22 136 "Orders inspected with actual product photos before packing." size:13 color:$muted max-width:232
END
LAYER why-minimums 492 2104 276 240 bg:$paper r:22 border:1 $line
  RECT why-minimums-icon 22 22 44 44 bg:$brown r:14
  TEXT why-minimums-title 22 84 "Zero order minimums" size:16 weight:semibold color:$ink max-width:232
  TEXT why-minimums-body 22 136 "Launch, test, and scale without minimum orders or inventory pressure." size:13 color:$muted max-width:232
END
LAYER why-design 792 2104 276 240 bg:$paper r:22 border:1 $line
  RECT why-design-icon 22 22 44 44 bg:$brown r:14
  TEXT why-design-title 22 84 "Free print design service" size:16 weight:semibold color:$ink max-width:232
  TEXT why-design-body 22 136 "Print-ready files, artwork adjustments, mockups, and design prep." size:13 color:$muted max-width:232
END
LAYER why-cs 1092 2104 276 240 bg:$paper r:22 border:1 $line
  RECT why-cs-icon 22 22 44 44 bg:$brown r:14
  TEXT why-cs-title 22 84 "Professional customer service" size:16 weight:semibold color:$ink max-width:232
  TEXT why-cs-body 22 136 "Buyer messages, order updates, replacements, refunds, after-sales." size:13 color:$muted max-width:232
END
LAYER why-helpdesk 492 2368 276 240 bg:$paper r:22 border:1 $line
  RECT why-helpdesk-icon 22 22 44 44 bg:$brown r:14
  TEXT why-helpdesk-title 22 84 "Dedicated helpdesk" size:16 weight:semibold color:$ink max-width:232
  TEXT why-helpdesk-body 22 136 "Centralize requests, follow up faster, resolve issues with a clear flow." size:13 color:$muted max-width:232
END
LAYER why-payments 792 2368 276 240 bg:$paper r:22 border:1 $line
  RECT why-payments-icon 22 22 44 44 bg:$brown r:14
  TEXT why-payments-title 22 84 "Payment gateway consultancy" size:16 weight:semibold color:$ink max-width:232
  TEXT why-payments-body 22 136 "Practical guidance on checkout, payment workflows, and gateways." size:13 color:$muted max-width:232
END
LAYER why-sourcing 1092 2368 276 240 bg:$paper r:22 border:1 $line
  RECT why-sourcing-icon 22 22 44 44 bg:$brown r:14
  TEXT why-sourcing-title 22 84 "Product sourcing" size:16 weight:semibold color:$ink max-width:232
  TEXT why-sourcing-body 22 136 "Source, sample, customize, and expand through trusted suppliers." size:13 color:$muted max-width:232
END
LAYER cta-band 72 2700 1296 340 bg:$brown r:38 role:section
  TEXT cta-title 52 56 "Send orders. We take care of the rest." size:36 weight:semibold color:$sand max-width:560 level:h2
  TEXT cta-body 52 180 "Our workflow covers order intake, design file checking, product printing, quality control, packing, fulfillment updates, and sourcing support." size:15 color:$sand-soft max-width:540
  BUTTON cta-btn 52 262 240 48 "Start operations support" variant:secondary href:"contact.html"
  LAYER mini-orders 668 50 290 116 bg:$band-card r:22
    RECT mini-orders-icon 20 20 36 36 bg:$sand r:10
    TEXT mini-orders-label 20 72 "Orders" size:15 color:$sand
  END
  LAYER mini-print 978 50 290 116 bg:$band-card r:22
    RECT mini-print-icon 20 20 36 36 bg:$sand r:10
    TEXT mini-print-label 20 72 "Print" size:15 color:$sand
  END
  LAYER mini-pack 668 186 290 116 bg:$band-card r:22
    RECT mini-pack-icon 20 20 36 36 bg:$sand r:10
    TEXT mini-pack-label 20 72 "Pack" size:15 color:$sand
  END
  LAYER mini-ship 978 186 290 116 bg:$band-card r:22
    RECT mini-ship-icon 20 20 36 36 bg:$sand r:10
    TEXT mini-ship-label 20 72 "Ship" size:15 color:$sand
  END
END
LAYER site-footer 0 3120 1440 640 bg:#1d1209 role:footer
  TEXT f-brand 72 56 "Pixelight" size:26 weight:bold color:$sand
  TEXT f-about 72 110 "Pixelight is an operations partner for sellers: order fulfillment, printed products, design service, customer service, and product sourcing." size:14 color:#a98e72 max-width:300
  RECT f-soc-1 72 250 28 28 bg:$band r:14
  RECT f-soc-2 110 250 28 28 bg:$band r:14
  RECT f-soc-3 148 250 28 28 bg:$band r:14
  RECT f-soc-4 186 250 28 28 bg:$band r:14
  RECT f-soc-5 224 250 28 28 bg:$band r:14
  STACK f-services 460 56 direction:column gap:14
    TEXT f-services-h 0 0 "SERVICES" size:13 weight:semibold color:$sand
    TEXT f-link-fulfill 0 0 "Product Fulfillment" size:14 color:#a98e72 href:"products.html"
    TEXT f-link-design 0 0 "Design Service" size:14 color:#a98e72 href:"design.html"
    TEXT f-link-cs 0 0 "Customer Service" size:14 color:#a98e72 href:"customer-service.html"
    TEXT f-link-sourcing 0 0 "Product Sourcing" size:14 color:#a98e72 href:"product-sourcing.html"
  END
  STACK f-support 680 56 direction:column gap:14
    TEXT f-support-h 0 0 "SUPPORT" size:13 weight:semibold color:$sand
    TEXT f-link-about 0 0 "About Us" size:14 color:#a98e72 href:"about-us.html"
    TEXT f-link-contact 0 0 "Contact Us" size:14 color:#a98e72 href:"contact.html"
  END
  STACK f-resources 870 56 direction:column gap:14
    TEXT f-resources-h 0 0 "RESOURCES" size:13 weight:semibold color:$sand
    TEXT f-link-help 0 0 "Help Center" size:14 color:#a98e72 href:"help-center.html"
    TEXT f-link-blog 0 0 "Blog" size:14 color:#a98e72 href:"blog.html"
    TEXT f-link-faqs 0 0 "FAQs" size:14 color:#a98e72 href:"faqs.html"
  END
  STACK f-policy 1060 56 direction:column gap:14
    TEXT f-policy-h 0 0 "POLICY" size:13 weight:semibold color:$sand
    TEXT f-link-privacy 0 0 "Privacy Policy" size:14 color:#a98e72 href:"privacy-policy.html"
    TEXT f-link-terms 0 0 "Terms of Service" size:14 color:#a98e72 href:"terms-of-service.html"
    TEXT f-link-fulfillment 0 0 "Fulfillment Policy" size:14 color:#a98e72 href:"fulfillment-policy.html"
  END
  STACK f-address 1250 56 direction:column gap:14
    TEXT f-address-h 0 0 "ADDRESS" size:13 weight:semibold color:$sand
    TEXT f-addr-1 0 0 "55W 14th St STE 101" size:14 color:#a98e72
    TEXT f-addr-2 0 0 "Helena, MT, 59601" size:14 color:#a98e72
    TEXT f-addr-3 0 0 "hello@pixelight.solutions" size:14 color:#a98e72
  END
  TEXT f-copy 72 560 "© 2026 Pixelight - a Brand of Crochetique LLC. All rights reserved." size:13 color:#8a7158
  TEXT f-tags 1090 560 "Fulfillment • Design • Support • Sourcing" size:13 color:#8a7158
END
STATE get-quote hover
  bg: #2e2317
END
STATE hero-alt hover
  bg: #efe3d3
END
STATE why-btn hover
  bg: #d9c5ab
END
STATE cta-btn hover
  bg: #d9c5ab
END
