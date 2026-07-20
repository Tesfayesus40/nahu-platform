# Buyer B2 — Localization Review (EN ↔ AM)

**Purpose:** Complete inventory of Buyer UI copy for assessment before a single follow-up localization pass.  
**Scope:** `nahu-buna-buyer` + shared components used by Buyer.  
**Date:** 2026-07-18  
**Status:** Awaiting stakeholder feedback  

**How to use:** Mark feedback next to each row (OK / Change EN / Change AM / Add missing AM / Brand decision).  
Do not implement changes until the full list is reviewed.

## Legend for Notes

| Note | Meaning |
|------|---------|
| Missing AM | English only today |
| Hardcoded EN | English shown even in Amharic mode |
| Hardcoded AM | Amharic-only / shown in both modes |
| Shared | From `shared/` (also affects Farmer if changed) |
| Incomplete AM | Amharic exists but omits content vs English |

---

## 1. Navigation & chrome

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 1 | AppNavigator | Home tab | Home | ቤት | |
| 2 | AppNavigator | Browse tab | Browse | ዝርዝር | |
| 3 | AppNavigator | Orders tab | Orders | ትዕዛዝ | |
| 4 | AppNavigator | Orders header | My Orders | ትዕዛዞቼ | |
| 5 | AppNavigator | Account tab/header | Account | መለያ | |
| 6 | AppNavigator | Buyer badge | Buyer | ገዢ | |
| 7 | AppNavigator | Search header | Search | ፈልግ | |
| 8 | AppNavigator | Listing detail header | Listing Detail | የዝርዝር ዝርዝር | |
| 9 | AppNavigator | Seller profile header | Seller Profile | የሻጭ መገለጫ | |
| 10 | AppNavigator | Checkout header | Checkout | ክፍያ | EN Checkout vs AM “Payment” |
| 11 | AppNavigator | Payment header | Payment | ክፍያ | Same AM as Checkout |
| 12 | AppNavigator | CBE payment header | CBE Birr Payment | ሲቢኢ ብር ክፍያ | |
| 13 | AppNavigator | Order detail header | Order Detail | የትዕዛዝ ዝርዝር | |
| 14 | AppNavigator | Certificate header | Origin Certificate | የምንጭ ምስክር ወረቀት | |
| 15 | AppNavigator | Home brand header | Nahu Farms | *(none)* | Hardcoded EN |

## 2. Shared TEXT constants & process methods

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 16 | constants | Welcome | Welcome | እንኳን ደህና መጡ | |
| 17 | constants | Phone Number | Phone Number | ስልክ ቁጥር | |
| 18 | constants | Enter Code | Enter Code | ኮድ ያስገቡ | |
| 19 | constants | Continue | Continue | ቀጥል | |
| 20 | constants | Verify | Verify | አረጋግጥ | |
| 21 | constants | Search | Search | ፈልግ | |
| 22 | constants | Order | Order | ትዕዛዝ | |
| 23 | constants | My Orders | My Orders | ትዕዛዞቼ | |
| 24 | constants | Pay | Pay | ክፈል | |
| 25 | constants | Certificate | Certificate | የምስክር ወረቀት | Shorter than “Origin Certificate” |
| 26 | constants | Process WASHED | Washed | የታጠበ | |
| 27 | constants | Process NATURAL | Natural | በተፈጥሮ የደረቀ | |
| 28 | constants | Process HONEY | Honey | ሃኒ | |
| 29 | constants | Process SEMI_WASHED | Semi-Washed | ከፊል የታጠበ | |
| 30 | constants | Process HULLED | Hulled | የተፈተገ | |
| 31 | constants | Process ANAEROBIC | Anaerobic | አናኤሮቢክ | Transliteration |
| 32 | constants | Process CARBONIC_MACERATION | Carbonic Maceration | ካርቦኒክ ማሴሬሽን | Transliteration |

## 3. Browse region chips (Amharic-only values today)

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 33 | constants | Region | *(same AM shown)* | ይርጋጨፌ | No EN label in chips |
| 34 | constants | Region | | ሲዳማ | |
| 35 | constants | Region | | ጉጂ | |
| 36 | constants | Region | | ሊሙ | |
| 37 | constants | Region | | ጅማ | |
| 38 | constants | Region | | ሐረር | |
| 39 | constants | Region | | ነቀምቴ | |
| 40 | constants | Region | | ካፋ | |
| 41 | constants | Region | | ቤንች ማጂ | |
| 42 | constants | Region | | ባሌ | |
| 43 | constants | Region | | አርሲ | |
| 44 | constants | Region | | ጌዴኦ | |
| 45 | constants | Region | | ኮቸሬ | |
| 46 | constants | Region | | ገደብ | |
| 47 | constants | Region | | ሻኪሶ | |
| 48 | constants | Region | | ሌላ | |

## 4. Login

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 49 | LoginScreen | Invalid phone alert | Please enter a valid Ethiopian phone number | *(none)* | Missing AM |
| 50 | LoginScreen | Test-code alert title | Test code | የሙከራ ኮድ | |
| 51 | LoginScreen | Test-code alert message | For testing use: {code} | ለሙከራ: {code} | |
| 52 | LoginScreen | Invalid OTP length | Please enter the 6-digit code | *(none)* | Missing AM |
| 53 | LoginScreen | Invalid-code title | Error | ስህተት | |
| 54 | LoginScreen | Invalid-code message | Invalid code. Please try again. | ኮዱ ትክክል አይደለም። እንደገና ይሞክሩ። | |
| 55 | LoginScreen | Generic error title | Error | *(none)* | Hardcoded EN |
| 56 | LoginScreen | Generic error message | Something went wrong. Please try again. | *(none)* | Hardcoded EN |
| 57 | LoginScreen | Language toggle | EN | አማ | |
| 58 | LoginScreen | Buyer badge | Buyer App | ገዢ መተግበሪያ | |
| 59 | LoginScreen | App name | Nahu Farms | ናሁ ፋርምስ | Brand |
| 60 | LoginScreen | Tagline | Buy directly from Ethiopian farmers | ቀጥታ ከኢትዮጵያ ገበሬዎች ይግዙ | |
| 61 | LoginScreen | OTP test notice | 🧪 For testing use code 123456 | 🧪 ለሙከራ ጊዜያዊ ኮድ 123456 ይጠቀሙ | |
| 62 | LoginScreen | Back button | ← Back | *(none)* | Missing AM |

## 5. Home

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 63 | HomeScreen | Named greeting | Hi, {name} 👋 | ሰላም {name} 👋 | |
| 64 | HomeScreen | Anonymous greeting | Hi there 👋 | ሰላም 👋 | |
| 65 | HomeScreen | Listings statistic | Listings available | ያሉ ዝርዝሮች | |
| 66 | HomeScreen | Open orders statistic | Orders in progress | በሂደት ላይ ያሉ ትዕዛዞች | |
| 67 | HomeScreen | Browse shortcut | Browse | ዝርዝር | |
| 68 | HomeScreen | Search shortcut | Search | ፈልግ | |
| 69 | HomeScreen | Orders shortcut | Orders | ትዕዛዝ | |
| 70 | HomeScreen | Browse CTA | Browse Listings | ዝርዝሮችን ይመልከቱ | |
| 71 | HomeScreen | Origin certificate blurb | Every purchase comes with a verified origin certificate, tracing your order back to the exact farmer and farm it came from. | እያንዳንዱ ግዢ ከየትኛው ገበሬ እና እርሻ እንደመጣ የሚያሳይ የተረጋገጠ የምንጭ ምስክር ወረቀት ያካትታል። | |

## 6. Browse

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 72 | BrowseScreen | Title | Browse | ዝርዝር | |
| 73 | BrowseScreen | Buyer badge | Buyer | ገዢ | |
| 74 | BrowseScreen | Search a11y | Search | ፈልግ | |
| 75 | BrowseScreen | Category heading | Category | ምድብ | |
| 76 | BrowseScreen | Product heading | Product | ውጤት | “Product” → ውጤት may mean “result”; consider ምርት |
| 77 | BrowseScreen | Variety heading | Variety | ዝርያ | |
| 78 | BrowseScreen | Clear filters | Clear filters | ማጣሪያ አጽዳ | |
| 79 | BrowseScreen | Origin heading | Origin | መገኛ ቦታ | |
| 80 | BrowseScreen | Grade heading | Grade | ደረጃ | |
| 81 | BrowseScreen | Process heading | Process | ማቀነባበሪያ | |
| 82 | BrowseScreen | Loading | Loading… | በመጫን ላይ… | |
| 83 | BrowseScreen | Count suffix | listings available | ዝርዝሮች አሉ | |
| 84 | BrowseScreen | Empty state | No listings found | ምንም ዝርዝር አልተገኘም | |
| 85 | BrowseScreen | Availability suffix | available | ይገኛል | |
| 86 | BrowseScreen | Altitude suffix | m altitude | *(none)* | Hardcoded EN |

## 7. Search

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 87 | SearchScreen | Placeholder | Search products, regions, sellers… | ውጤት፣ ክልል፣ ሻጭ ይፈልጉ… | Same “ውጤት” issue |
| 88 | SearchScreen | Scope: all | All categories | ሁሉም ምድቦች | |
| 89 | SearchScreen | Scope: current | This category | ይህ ምድብ | |
| 90 | SearchScreen | Empty results | No results found | ምንም ውጤት አልተገኘም | |
| 91 | SearchScreen | Initial hint | Search across products, origins, and sellers. | ውጤቶችን፣ መገኛ ቦታዎችን እና ሻጮችን ይፈልጉ። | |

## 8. Listing Detail

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 92 | ListingDetail | Missing listing | Listing not found | ዝርዝሩ አልተገኘም | |
| 93 | ListingDetail | Available suffix | available | ይገኛል | |
| 94 | ListingDetail | Order button | Order Now | አሁን ይዘዙ | |
| 95 | ListingDetail | Product details heading | Product Details | የውጤት ዝርዝር | |
| 96 | ListingDetail | Category label | Category | ምድብ | |
| 97 | ListingDetail | Product label | Product | ውጤት | |
| 98 | ListingDetail | Region label | Region | ክልል | |
| 99 | ListingDetail | Woreda label | Woreda | ወረዳ | |
| 100 | ListingDetail | Grade label | Grade | ደረጃ | |
| 101 | ListingDetail | Packaging label | Packaging | ማሸግ | |
| 102 | ListingDetail | Harvest label | Harvest | የመከር ጊዜ | |
| 103 | ListingDetail | Seller heading | Seller | ሻጭ | |
| 104 | ListingDetail | Fallback seller name | Nahu Farms Seller | የናሁ ገበያ ሻጭ | Brand wording differs EN/AM |
| 105 | ListingDetail | Traceability heading | Traceability | መገኛውን የማወቅ ብቃት | |
| 106 | ListingDetail | Traceability blurb | Every order generates a verified origin certificate you can share with your customers. | እያንዳንዱ ትዕዛዝ ለደንበኞችዎ ሊያካፍሉት የሚችሉ የተረጋገጠ የምንጭ ምስክር ወረቀት ይፈጥራል። | |

## 9. Seller Profile

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 107 | SellerProfile | Missing seller | Seller not found | ሻጭ አልተገኘም | |
| 108 | SellerProfile | Fallback name | Nahu Farms Seller | የናሁ ገበያ ሻጭ | |
| 109 | SellerProfile | Farms heading | Farms | እርሻዎች | |
| 110 | SellerProfile | Certificates heading | Certificates | ምስክር ወረቀቶች | |
| 111 | SellerProfile | Active listings | Active listings | ንቁ ዝርዝሮች | |
| 112 | SellerProfile | No active listings | No active listings | ንቁ ዝርዝር የለም | |

## 10. Checkout

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 113 | Checkout | Woreda prefix | Woreda {value} | ወረዳ {value} | |
| 114 | Checkout | Landmark prefix | near {landmark} | አቅራቢያ {landmark} | |
| 115 | Checkout | Invalid quantity | Please enter a valid quantity | ትክክለኛ ብዛት ያስገቡ | |
| 116 | Checkout | Max quantity | Maximum available: {quantity} {unit} | ከፍተኛ ብዛት: {quantity} {unit} | |
| 117 | Checkout | Missing city | Please select a city | ከተማ ይምረጡ | |
| 118 | Checkout | Missing landmark | Please enter a nearby landmark | የቅርብ ምልክት ያስገቡ | |
| 119 | Checkout | Unstructured failure | Something went wrong | *(none)* | Missing AM |
| 120 | Checkout | Picker cancel | Cancel | ሰርዝ | |
| 121 | Checkout | Available label | Available | ያለ | |
| 122 | Checkout | Payment deadline | You have 6 hours to complete payment after placing your order. Unpaid orders are automatically cancelled. | ትዕዛዝ ካስቀመጡ በኋላ 6 ሰዓት ውስጥ ክፍያ ማጠናቀቅ አለቦት። ያልተከፈሉ ትዕዛዞች በራስ-ሰር ይሰረዛሉ። | |
| 123 | Checkout | Quantity label | Quantity ({unit}) * | ብዛት ({unit}) * | |
| 124 | Checkout | Quantity placeholder | e.g. 20 | *(none)* | Missing AM |
| 125 | Checkout | Subtotal | Subtotal | ድምር | |
| 126 | Checkout | Platform fee | Platform fee (2%) | የመድረክ ክፍያ (2%) | |
| 127 | Checkout | Total | Total | ጠቅላላ | |
| 128 | Checkout | Farmer receives | Farmer receives: {amount} ETB | ገበሬ ይቀበላሉ: {amount} ETB | Formal/plural AM? |
| 129 | Checkout | Delivery address | Delivery Address | የመላኪያ አድራሻ | |
| 130 | Checkout | City label | City / Region * | ከተማ / ክልል * | |
| 131 | Checkout | City placeholder | Select city... | ከተማ ይምረጡ... | |
| 132 | Checkout | Subcity label | Subcity | ክፍለ ከተማ | |
| 133 | Checkout | Subcity placeholder | Select subcity... | ክፍለ ከተማ ይምረጡ... | |
| 134 | Checkout | Woreda label | Woreda / District | ወረዳ | |
| 135 | Checkout | Woreda placeholder | e.g. 03 | ለምሳሌ: 03 | |
| 136 | Checkout | Landmark label | Nearby Landmark * | የቅርብ ምልክት * | |
| 137 | Checkout | Landmark placeholder | e.g. near Edna Mall, opposite CBE branch | ለምሳሌ: ኤድና ሞል አጠገብ | Incomplete AM |
| 138 | Checkout | Notes label | Additional notes (optional) | ተጨማሪ መረጃ (አማራጭ) | |
| 139 | Checkout | Notes placeholder | e.g. Call upon arrival, blue gate | ለምሳሌ: ሲደርሱ ይደውሉ | Incomplete AM |
| 140 | Checkout | Address preview | 📍 Address preview: | 📍 አድራሻ ቅድመ እይታ: | |
| 141 | Checkout | Payment method | Payment method | የክፍያ ዘዴ | |
| 142 | Checkout | Escrow notice | Your payment is held securely in escrow until delivery is confirmed. | ክፍያዎ እስከ ርክብ ማረጋገጫ ድረስ በኤስክሮ ይጠበቃል። | |
| 143 | Checkout | Continue CTA | Continue to Payment → | ወደ ክፍያ ቀጥል → | |
| 144 | Checkout | City picker title | Select City | ከተማ ይምረጡ | |
| 145 | Checkout | Subcity picker title | Select Subcity | ክፍለ ከተማ ይምረጡ | |

## 11. Orders list

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 146 | OrdersScreen | PENDING_PAYMENT | Pending Payment | ክፍያ በጥበቃ | |
| 147 | OrdersScreen | PAID_ESCROW | Paid — In Escrow | ገንዘቡ ተጠብቋል | |
| 148 | OrdersScreen | CONFIRMED | Confirmed | ተረጋግጧል | |
| 149 | OrdersScreen | SHIPPED | Shipped | ተልኳል | |
| 150 | OrdersScreen | DELIVERED | Delivered | ደርሷል | |
| 151 | OrdersScreen | COMPLETED | Completed | ተጠናቋል | |
| 152 | OrdersScreen | CANCELLED | Cancelled | ተሰርዟል | |
| 153 | OrdersScreen | DISPUTED | Disputed | አለመግባባት | |
| 154 | OrdersScreen | Empty state | No orders yet | እስካሁን ምንም ትዕዛዝ የለም | |
| 155 | OrdersScreen | Fallback title | Order | ትዕዛዝ | |
| 156 | OrdersScreen | View details | View details | ዝርዝር ይመልከቱ | |

## 12. Order Detail

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 157 | OrderDetail | Cancel title | Cancel Order | ትዕዛዝ ሰርዝ | |
| 158 | OrderDetail | Cancel message | Are you sure you want to cancel this order? | ይህን ትዕዛዝ መሰረዝ ይፈልጋሉ? | |
| 159 | OrderDetail | Cancel No | No | አይ | |
| 160 | OrderDetail | Cancel Yes | Yes, cancel | አዎ, ሰርዝ | |
| 161 | OrderDetail | Confirm delivery title | Confirm Delivery | ርክክብን አረጋግጥ | |
| 162 | OrderDetail | Confirm delivery message | Make sure you have received your order and checked the items.\n\nOnce you confirm delivery, this cannot be undone and payment will be released to the seller.\n\nHave you received your order? | ትዕዛዝዎን እና ዕቃዎችን ተቀብለው መገኘታቸውን እርግጠኛ መሆንዎን ያረጋግጡ።\n\nርክክብ ከተረጋገጠ በኋላ መመለስ አይቻልም እና ክፍያው ለሻጭ ይለቀቃል።\n\nትዕዛዝዎን ተቀብለዋል? | |
| 163 | OrderDetail | Confirm No | No | አይ | |
| 164 | OrderDetail | Confirm Yes | Yes, received | አዎ፣ ተቀብያለሁ | |
| 165 | OrderDetail | Missing order | Order not found | ትዕዛዙ አልተገኘም | |
| 166 | OrderDetail | Summary heading | Order Summary | የትዕዛዝ ማጠቃለያ | |
| 167 | OrderDetail | Quantity | Quantity | ብዛት | |
| 168 | OrderDetail | Price per unit | Price per unit | ዋጋ በአንድ | |
| 169 | OrderDetail | Total | Total | ጠቅላላ | |
| 170 | OrderDetail | Grade | Grade | ደረጃ | |
| 171 | OrderDetail | Delivery address | Delivery Address | የመላኪያ አድራሻ | |
| 172 | OrderDetail | No address | No address on file | የተመዘገበ አድራሻ የለም | |
| 173 | OrderDetail | Edit | Edit | አርም | |
| 174 | OrderDetail | Pay countdown | Pay within {time} or order will be cancelled | በ{time} ውስጥ ይክፈሉ አለበለዚያ ትዕዛዙ ይሰረዛል | |
| 175 | OrderDetail | Payment expired | Payment time expired — order may be cancelled | የክፍያ ጊዜ አልፏል | Incomplete AM |
| 176 | OrderDetail | Pay Now | Pay Now | አሁን ክፈል | |
| 177 | OrderDetail | Cancel Order button | Cancel Order | ትዕዛዝ ሰርዝ | |
| 178 | OrderDetail | Escrow notice | Payment secured. Awaiting delivery. | ክፍያ ተጠብቋል። ርክክብ በመጠባበቅ ላይ። | |
| 179 | OrderDetail | Confirm Delivery button | Confirm Delivery | ርክክብን አረጋግጥ | |
| 180 | OrderDetail | Certificate button | View Origin Certificate | የምንጭ ምስክር ወረቀት ይመልከቱ | |
| 181 | OrderDetail | Cancelled notice | This order was cancelled. | ይህ ትዕዛዝ ተሰርዟል። | |
| 182 | OrderDetail | Disputed notice | This order is under dispute review. | ይህ ትዕዛዝ በክርክር ግምገማ ውስጥ ነው። | |
| 183 | OrderDetail | In-transit notice | Your order is on its way. We will update this page as it progresses. | ትዕዛዝዎ በመንገድ ላይ ነው። ይህ ገጽ ሲራመድ ይዘምናል። | |
| 184 | OrderDetail | Edit address title | Edit Delivery Address | አድራሻ አርም | |
| 185 | OrderDetail | Edit address placeholder | Enter new delivery address | አዲስ አድራሻ ያስገቡ | |
| 186 | OrderDetail | Modal Cancel | Cancel | ሰርዝ | |
| 187 | OrderDetail | Modal Save | Save | አስቀምጥ | |

## 13. Certificate

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 188 | Certificate | Share message | Ethiopian Coffee Origin Certificate\nCertificate #{number}\nFarmer: {farmer}\nLocation: {location}\nGrade: {grade}\nProcess: {process}\nVerified by ናሁ ቡና ገበያ | የኢትዮጵያ ቡና የምስክር ወረቀት\nቁጥር: {number}\nገበሬ: {farmer}\nቦታ: {location} | Incomplete AM |
| 189 | Certificate | Missing | Certificate not found | *(none)* | Missing AM |
| 190 | Certificate | Title | Verified Origin Certificate | የምንጭ ምስክር ወረቀት | |
| 191 | Certificate | Issuer | *(none / brand)* | ናሁ ቡና ገበያ | Hardcoded AM brand |
| 192 | Certificate | Farmer | Farmer | ገበሬ | |
| 193 | Certificate | Farm Location | Farm Location | የእርሻ ቦታ | |
| 194 | Certificate | Cooperative | Cooperative | ሕብረት ሥራ | Differs from Coffee panel “ሽርክና” |
| 195 | Certificate | Grade | Grade | ደረጃ | |
| 196 | Certificate | Process | Process | ሂደት | Differs from “ማቀነባበሪያ” |
| 197 | Certificate | Harvest Date | Harvest Date | የተሰበሰበበት ቀን | |
| 198 | Certificate | Altitude | Altitude | ከፍታ | |
| 199 | Certificate | Issued | Issued | የተሰጠበት ቀን | |
| 200 | Certificate | Verification note | Verify at: {URL} | ይህ ምስክር ወረቀት ነፃ ሆኖ ሊረጋገጥ ይችላል። | Different content by language |
| 201 | Certificate | Share button | 📤 Share Certificate | 📤 ምስክር ወረቀት ያካፍሉ | |

## 14. Payment (simulated)

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 202 | Payment | Invalid PIN | Please enter your 4-digit PIN | 4 አሃዝ ፒን ያስገቡ | |
| 203 | Payment | Payment failed | Payment failed. Please try again. | ክፍያ አልተሳካም። እንደገና ይሞክሩ። | |
| 204 | Payment | Processing title | Processing Payment | ክፍያ በሂደት ላይ | |
| 205 | Payment | Processing notice | Please wait while we process your payment... | ክፍያዎን እያሰላን ነው፣ እባክዎ ይጠብቁ... | |
| 206 | Payment | Success title | Payment Successful! | ክፍያ ተሳክቷል! | |
| 207 | Payment | Ref prefix | Ref: | *(none)* | Hardcoded EN |
| 208 | Payment | Escrow success | 🔒 Funds secured in escrow\nFarmer will be notified to ship your order | 🔒 ገንዘቡ በኤስክሮ ውስጥ ተጠብቋል\nገበሬው ቡናውን ለመላክ ይነገራል | Coffee-specific AM |
| 209 | Payment | Merchant label | Merchant | ነጋዴ | |
| 210 | Payment | Merchant value | *(brand)* | ናሁ ቡና ገበያ | AM brand in both modes |
| 211 | Payment | Reference | Reference | ማጣቀሻ | |
| 212 | Payment | Amount | Amount | መጠን | |
| 213 | Payment | PIN prompt | Enter your {method} PIN | {method} ፒን ያስገቡ | |
| 214 | Payment | Confirm Payment | Confirm Payment | ክፍያ አረጋግጥ | |
| 215 | Payment | Cancel | Cancel | ሰርዝ | |
| 216 | Payment | Test mode | 🧪 Test mode — enter any 4-digit PIN to simulate payment | 🧪 ለሙከራ — ማንኛውም 4 አሃዝ ፒን ይጠቀሙ | |

## 15. Account / Settings

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 217 | Settings | Logout title | Logout | ውጣ | |
| 218 | Settings | Logout message | Are you sure you want to logout? | መውጣት ይፈልጋሉ? | |
| 219 | Settings | Logout Cancel | Cancel | ሰርዝ | |
| 220 | Settings | Logout confirm | Logout | ውጣ | |
| 221 | Settings | Missing first name | Please enter your first name | እባክዎ የመጀመሪያ ስም ያስገቡ | |
| 222 | Settings | Success title | Success | ተሳክቷል | |
| 223 | Settings | Name updated | Name updated | ስምዎ ተሻሽሏል | |
| 224 | Settings | App header | Nahu Buna Gebeya | ናሁ ቡና ገበያ | Brand |
| 225 | Settings | Buyer badge | Buyer App | ገዢ መተግበሪያ | |
| 226 | Settings | Language section | Language | ቋንቋ | |
| 227 | Settings | Change Language | Change Language | ቋንቋ ቀይር | |
| 228 | Settings | Account section | Account | መለያ | |
| 229 | Settings | Phone | Phone | ስልክ | |
| 230 | Settings | Name | Name | ስም | |
| 231 | Settings | Add name | Add name | ያስገቡ | |
| 232 | Settings | First Name * | First Name * | የመጀመሪያ ስም * | |
| 233 | Settings | First name placeholder | e.g. Abebe | ለምሳሌ: አበበ | |
| 234 | Settings | Father's Name | Father's Name (optional) | የአባት ስም (አማራጭ) | |
| 235 | Settings | Father placeholder | e.g. Kebede | ለምሳሌ: ከበደ | |
| 236 | Settings | Role | Role | ሚና | |
| 237 | Settings | Role value | Buyer | ገዢ | |
| 238 | Settings | About | About | ስለ መተግበሪያው | |
| 239 | Settings | App label | App | መተግበሪያ | |
| 240 | Settings | App value | Nahu Farms Buyer | ናሁ ፋርምስ ገዢ | |
| 241 | Settings | Version | Version | እትም | |
| 242 | Settings | Website | Website | ድህረ ገፅ | |
| 243 | Settings | Contact | Contact | ስልክ | Same AM as Phone |
| 244 | Settings | Powered by | Powered by | የተሰራው | |
| 245 | Settings | Footer | Nahu AI © 2026 — where curiosity meets craft | ናሁ ኤ አይ © 2026 — where curiosity meets craft | EN tagline kept in AM |

## 16. Shared — Coffee panel, payments, grades, units

| # | Screen | Context | English | Amharic | Notes |
|---|--------|---------|---------|---------|-------|
| 246 | CoffeeExtensionPanel | Title | Coffee details | የቡና ዝርዝር | Shared |
| 247 | CoffeeExtensionPanel | Process | Process | ማቀነባበሪያ | Shared |
| 248 | CoffeeExtensionPanel | Variety | Variety | ዝርያ | Shared |
| 249 | CoffeeExtensionPanel | Cup score | Cup score | የጣዕም ነጥብ | Shared |
| 250 | CoffeeExtensionPanel | Altitude | Altitude | ከፍታ | Shared |
| 251 | CoffeeExtensionPanel | Washing station | Washing station | የማጠቢያ ጣቢያ | Shared |
| 252 | CoffeeExtensionPanel | Cooperative | Cooperative | ሽርክና | Shared; vs Certificate ሕብረት ሥራ |
| 253 | ComingSoonBadge | Soon | Soon | በቅርቡ | Shared |
| 254 | paymentMethods | Telebirr | Telebirr | ቴሌብር | Shared |
| 255 | paymentMethods | Telebirr subtitle | Ethio Telecom Mobile Money | የኢትዮ ቴሌኮም ሞባይል ገንዘብ | Shared |
| 256 | paymentMethods | CBE Birr | CBE Birr | ሲቢኢ ብር | Shared |
| 257 | paymentMethods | CBE subtitle | Commercial Bank of Ethiopia | የኢትዮጵያ ንግድ ባንክ | Shared |
| 258 | paymentMethods | M-Pesa | M-Pesa | ኤም-ፔሳ | Shared |
| 259 | paymentMethods | M-Pesa subtitle | Safaricom mobile money | ሳፋሪኮም ሞባይል ገንዘብ | Shared |
| 260 | paymentMethods | Chapa | Chapa | ቻፓ | Shared |
| 261 | paymentMethods | Chapa subtitle | Online payment gateway | የመስመር ላይ ክፍያ | Shared |
| 262 | paymentMethods | SantimPay | SantimPay | ሳንቲምፔይ | Shared |
| 263 | paymentMethods | SantimPay subtitle | Digital wallet | ዲጂታል ዋሌት | Shared |
| 264 | grades | GRADE_1…9 | Grade 1…9 | ደረጃ 1…9 | Shared |
| 265 | grades | Ungraded | Ungraded | ያልተመደበ | Shared |
| 266 | listingDisplay | Units | kg / g / quintal / bag / dozen / L / pc | ኪ.ግ / ግ / ኩንታል / ከረጢት / ደርዘን / ሊትር / ቁራጭ | Shared |
| 267 | listingDisplay | Money | ETB {amount} | {amount} ብር | Shared |

## 17. Shared — Checkout cities & Addis subcities

| # | English | Amharic |
|---|---------|---------|
| 268 | Addis Ababa | አዲስ አበባ |
| 269 | Dire Dawa | ድሬ ዳዋ |
| 270 | Hawassa | ሐዋሳ |
| 271 | Bahir Dar | ባሕር ዳር |
| 272 | Adama | አዳማ |
| 273 | Jimma | ጅማ |
| 274 | Mekelle | መቀሌ |
| 275 | Dessie | ደሴ |
| 276 | Gondar | ጎንደር |
| 277 | Nekemte | ነቀምት |
| 278 | Harar | ሐረር |
| 279 | Shashamane | ሻሸመኔ |
| 280 | Bishoftu | ቢሾፍቱ |
| 281 | Arba Minch | አርባ ምንጭ |
| 282 | Dilla | ዲላ |
| 283 | Wolkite | ወልቂቴ |
| 284 | Bonga | ቦንጋ |
| 285 | Jijiga | ጅጅጋ |
| 286 | Gambella | ጋምቤላ |
| 287 | Woldia | ወልድያ |
| 288 | Shire | ሺሬ |
| 289 | Asella | አሰላ |
| 290 | Moyale | ሞያሌ |
| 291 | Other | ሌላ |
| 292 | Bole | ቦሌ |
| 293 | Kirkos | ቂርቆስ |
| 294 | Arada | አራዳ |
| 295 | Yeka | የካ |
| 296 | Gulele | ጉለሌ |
| 297 | Lideta | ልደታ |
| 298 | Nifas Silk-Lafto | ንፋስ ስልክ ላፍቶ |
| 299 | Kolfe Keranio | ኮልፌ ቀራኒዮ |
| 300 | Akaky Kaliti | አቃቂ ቃሊቲ |
| 301 | Addis Ketema | አዲስ ከተማ |

## 18. Shared — API / session errors (shown in Buyer)

| # | Context | English | Amharic | Notes |
|---|---------|---------|---------|-------|
| 302 | Session expired | Session expired. Please login again. | የመግቢያ ጊዜው አልፏል። እባክዎ እንደገና ይግቡ። | Shared |
| 303 | Forbidden | You do not have permission for this action. Use the correct app and account. | ይህን ተግባር ለመፈጸም ፈቃድ የለዎትም። ትክክለኛውን መተግበሪያና መለያ ይጠቀሙ። | Shared |
| 304 | Validation fallback | Please check your entries and try again. | እባክዎ ሁሉንም መረጃ ትክክለኛ ሆኖ ያስገቡ። | Shared |
| 305 | Missing item | Item not found. | እቃው አልተገኘም። | Shared |
| 306 | OTP send failure | Could not send verification code. Please try again. | የማረጋገጫ ኮዱን መላክ አልተሳካም። እባክዎ እንደገና ይሞክሩ። | Shared |
| 307 | Invalid/expired code | Invalid or expired code. Please try again. | የተሳሳተ ወይም ጊዜው ያለፈበት ኮድ ነው። እባክዎ እንደገና ይሞክሩ። | Shared |
| 308 | Network error | Network problem. Check your connection and try again. | የአውታረ መረብ ችግር አለ። ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | Shared |
| 309 | Server error | Server error. Please try again later. | የአገልጋይ ስህተት ተፈጥሯል። እባክዎ ቆይተው እንደገና ይሞክሩ። | Shared |
| 310 | Generic fallback | Something went wrong. Please try again. | ስህተት ተፈጥሯል። እንደገና ይሞክሩ። | Shared |

---

## Themes to decide in your review

1. **Brand:** Nahu Farms vs ናሁ ቡና ገበያ vs ናሁ ፋርምስ — align Login, Settings, Payment merchant, Certificate issuer.
2. **Product wording:** ውጤት vs ምርት for “Product”.
3. **Cooperative:** ሽርክና vs ሕብረት ሥራ — pick one.
4. **Process:** ማቀነባበሪያ vs ሂደት — pick one.
5. **Checkout vs Payment headers:** both currently ክፍያ in Amharic.
6. Fill **Missing AM** / **Hardcoded EN** gaps in one implementation pass.

When your feedback is ready (OK / Change EN / Change AM / Add AM per row or by section), we will implement everything together.