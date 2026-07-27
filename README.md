# repair-management-server

بک‌اند **Express + MySQL** برای پروژه [repair-management-client](https://github.com/kasrakhojaste12-lang/repair-management-client).

سرور روی `http://localhost:5000` بالا می‌اید و تمام مسیرها زیر `/api` هستند.

---

## راه‌اندازی سریع (XAMPP)

1. در کنترل‌پنل XAMPP روی **MySQL** دکمه **Start** را بزنید.
2. دستورات زیر را در ریشه پروژه اجرا کنید:

```bash
npm install
cp .env.example .env      # در PowerShell: copy .env.example .env
npm run db:init           # ساخت دیتابیس، جداول و داده‌های نمونه
npm run dev               # اجرای سرور
```

اگر رمز root در MySQL دارید، ان را در فایل `.env` در `DB_PASSWORD` بنویسید.

---

## کاربران پیش‌فرض

| نقش | نام کاربری | رمز |
|---|---|---|
| مدیر | `admin` | `admin123` |
| کارمند | `employee` | `employee123` |

رمزها با bcrypt هش می‌شوند و هرگز به شکل متن ساده ذخیره نمی‌شوند.

---

## دستورات

| دستور | توضیح |
|---|---|
| `npm run dev` | اجرای سرور با ریلود خودکار |
| `npm start` | اجرای سرور در حالت عادی |
| `npm run db:init` | ساخت دیتابیس، جداول، کاربران پیش‌فرض و داده‌های نمونه |

`npm run db:init` امن است: اگر جداول از قبل داده داشته باشند، داده‌های نمونه دوباره وارد نمی‌شوند.

---

## ساختار پروژه

```
src/
├── app.js                  # ساخت اپلیکیشن Express و تنطیم CORS
├── server.js               # نقطه ورود؛ اول اتصال دیتابیس را چک می‌کند
├── config/env.js           # خواندن فایل .env
├── db/
│   ├── pool.js             # Connection pool و تراکنش
│   ├── schema.sql          # ساختار جداول
│   ├── seed.sql            # داده‌های نمونه
│   └── init.js             # اجرای schema و seed
├── middleware/
│   ├── auth.js             # بررسی توکن JWT و نقش مدیر
│   └── errorHandler.js     # تبدیل خطاها به پیام فارسی
├── routes/                 # مسیرهای API
└── utils/http.js           # ابزارهای مشترک (صفحه‌بندی، خطا، اعتبارسنجی)
```

---

## جداول دیتابیس

- **users** — کاربران سیستم با نقش `admin` یا `employee`
- **customers** — مشتریان
- **devices** — دستگاه‌ها (وابسته به مشتری)
- **repairs** — سفارش تعمیر هر دستگاه به همراه وضعیت، هزینه‌ها و وضعیت پرداخت
- **repair_status_history** — خط زمانی تغییر وضعیت با یادداشت تکنسین

با ثبت هر دستگاه، به‌طور خودکار یک سفارش تعمیر با وضعیت `received` و اولین رکورد خط زمانی ساخته می‌شود.

---

## مسیرهای API

| متد | مسیر | دسترسی | توضیح |
|---|---|---|---|
| GET | `/api/health` | ازاد | بررسی سلامت سرور |
| POST | `/api/auth/login` | ازاد | ورود و دریافت توکن |
| GET | `/api/auth/me` | JWT | کاربر جاری |
| GET | `/api/dashboard/summary` | JWT | امار داشبورد |
| GET/POST | `/api/customers` | JWT | فهرست / ایجاد مشتری |
| GET/PUT/DELETE | `/api/customers/:id` | JWT | جزئیات / ویرایش / حذف |
| GET/POST | `/api/devices` | JWT | فهرست / ثبت دستگاه |
| GET/PUT/DELETE | `/api/devices/:id` | JWT | جزئیات / ویرایش / حذف |
| GET | `/api/devices/:id/history` | JWT | دستگاه به همراه خط زمانی |
| GET | `/api/repairs` | JWT | فهرست سفارش‌های تعمیر |
| GET/PUT | `/api/repairs/:id` | JWT | جزئیات / ویرایش |
| PATCH | `/api/repairs/:id/status` | JWT | تغییر وضعیت + یادداشت تکنسین |
| GET/PUT | `/api/repair-costs/:repairId` | JWT | خواندن / ذخیره هزینه‌ها |
| GET | `/api/invoices/:repairId` | JWT | اطلاعات فاکتور |
| GET | `/api/reports/summary` | مدیر | خلاصه درامد |
| GET | `/api/reports/monthly-revenue` | مدیر | درامد ۶ ماه اخیر |
| GET | `/api/reports/device-type-revenue` | مدیر | درامد بر اساس نوع دستگاه |
| GET/POST | `/api/users` | مدیر | فهرست / ایجاد کاربر |
| PUT/DELETE | `/api/users/:id` | مدیر | ویرایش / حذف کاربر |

### قالب پاسخ فهرست‌ها

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 10, "total": 42 }
}
```

پارامترهای قابل ارسال: `page`، `limit` (حداکثر ۱۰۰)، `search` و در تعمیرات `status` و `payment_status`.

---

## نکات فنی

- **تاریخ‌ها** با `dateStrings: true` به شکل `YYYY-MM-DD` برمی‌گردند تا تبدیل به UTC روز را جابجا نکند.
- **توکن منقضی‌شده** کد ۴۰۱ برمی‌گرداند تا کلاینت کاربر را به صفحه ورود بفرستد.
- **کلید یادداشت** در `PATCH /repairs/:id/status` هم `technician_notes` و هم `notes` پذیرفته می‌شود.
- **هزینه کل** در سرور محاسبه می‌شود (قطعات + دستمزد + جانبی) تا قابل دستکاری از سمت کلاینت نباشد.
- **درامد** بر اساس ستون `paid_at` محاسبه می‌شود؛ این ستون بار اولی که وضعیت پرداخت `paid` می‌شود پر می‌شود.
- **حذف حساب خودی** و **حذف اخرین مدیر** در سرور بلاک شده است.

---

## مجوز

MIT
