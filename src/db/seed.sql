-- داده‌های نمونه — فقط وقتی اجرا می‌شود که جدول مشتریان خالی باشد
INSERT INTO `customers` (`id`, `full_name`, `phone`, `email`, `address`) VALUES
  (1, 'رضا محمدی', '09121234567', 'reza@example.com', 'تهران، خیابان ولیعصر، پلاک ۱۲'),
  (2, 'مریم کریمی', '09359876543', 'maryam@example.com', 'اصفهان، خیابان چهارباغ'),
  (3, 'علی احمدی', '09301112233', NULL, 'مشهد، بلوار سجاد'),
  (4, 'زهرا رستمی', '09147778899', 'zahra@example.com', 'تبریز، خیابان امام'),
  (5, 'حسین نوری', '09125556677', NULL, 'کرج، میدان ازادگی');

INSERT INTO `devices`
  (`id`, `customer_id`, `device_type`, `brand`, `model`, `serial_number`, `issue_description`, `received_date`, `expected_delivery_date`)
VALUES
  (1, 1, 'mobile', 'Samsung', 'Galaxy S21', 'SN-MOB-1001', 'صفحه نمایش شکسته و لمس کار نمی‌کند', CURDATE() - INTERVAL 12 DAY, CURDATE() - INTERVAL 5 DAY),
  (2, 2, 'laptop', 'Asus', 'VivoBook 15', 'SN-LAP-2001', 'روشن نمی‌شود و بوی سوختگی دارد', CURDATE() - INTERVAL 9 DAY, CURDATE() - INTERVAL 2 DAY),
  (3, 3, 'desktop', 'HP', 'ProDesk 400', 'SN-DSK-3001', 'راه‌اندازی ویندوز و تعویض هارد به SSD', CURDATE() - INTERVAL 6 DAY, CURDATE() + INTERVAL 1 DAY),
  (4, 4, 'tablet', 'Apple', 'iPad Air 4', 'SN-TAB-4001', 'باتری زود خالی می‌شود', CURDATE() - INTERVAL 4 DAY, CURDATE() + INTERVAL 3 DAY),
  (5, 5, 'mobile', 'Xiaomi', 'Redmi Note 12', 'SN-MOB-5001', 'داخل اب افتاده و دوربین کار نمی‌کند', CURDATE() - INTERVAL 2 DAY, CURDATE() + INTERVAL 5 DAY),
  (6, 1, 'laptop', 'Lenovo', 'ThinkPad T480', 'SN-LAP-6001', 'کیبورد چند کلید می‌زند', CURDATE(), CURDATE() + INTERVAL 7 DAY);

INSERT INTO `repairs`
  (`id`, `device_id`, `status`, `payment_status`, `technician_notes`, `parts_cost`, `labor_cost`, `additional_cost`, `total_cost`, `paid_at`, `delivered_at`)
VALUES
  (1, 1, 'delivered', 'paid', 'ال‌سی‌دی اصل تعویض شد و دستگاه تحویل مشتری شد.', 4200000, 800000, 0, 5000000, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY),
  (2, 2, 'completed', 'unpaid', 'مادربورد تعمیر شد؛ منتطر تحویل مشتری.', 1800000, 1200000, 150000, 3150000, NULL, NULL),
  (3, 3, 'in_repair', 'unpaid', 'SSD تهیه شد، در حال نصب ویندوز.', 2500000, 500000, 0, 3000000, NULL, NULL),
  (4, 4, 'waiting_parts', 'unpaid', 'باتری اصل سفارش داده شد.', 0, 0, 0, 0, NULL, NULL),
  (5, 5, 'inspection', 'unpaid', 'در حال بررسی میزان اسیب رطوبت.', 0, 0, 0, 0, NULL, NULL),
  (6, 6, 'received', 'unpaid', NULL, 0, 0, 0, 0, NULL, NULL);

INSERT INTO `repair_status_history` (`repair_id`, `status`, `notes`, `changed_by`, `created_at`) VALUES
  (1, 'received', 'دستگاه در پذیرش ثبت شد.', 1, NOW() - INTERVAL 12 DAY),
  (1, 'inspection', 'عیب‌یابی اولیه انجام شد.', 2, NOW() - INTERVAL 11 DAY),
  (1, 'in_repair', 'تعویض ال‌سی‌دی اغاز شد.', 2, NOW() - INTERVAL 8 DAY),
  (1, 'completed', 'تعمیر تمام شد و تست شد.', 2, NOW() - INTERVAL 6 DAY),
  (1, 'delivered', 'دستگاه به مشتری تحویل داده شد.', 1, NOW() - INTERVAL 5 DAY),
  (2, 'received', 'دستگاه در پذیرش ثبت شد.', 1, NOW() - INTERVAL 9 DAY),
  (2, 'inspection', 'اتصال کوتاه در مادربورد پیدا شد.', 2, NOW() - INTERVAL 8 DAY),
  (2, 'in_repair', 'تعمیر مادربورد اغاز شد.', 2, NOW() - INTERVAL 6 DAY),
  (2, 'completed', 'دستگاه اماده تحویل است.', 2, NOW() - INTERVAL 2 DAY),
  (3, 'received', 'دستگاه در پذیرش ثبت شد.', 1, NOW() - INTERVAL 6 DAY),
  (3, 'in_repair', 'نصب SSD و ویندوز اغاز شد.', 2, NOW() - INTERVAL 3 DAY),
  (4, 'received', 'دستگاه در پذیرش ثبت شد.', 1, NOW() - INTERVAL 4 DAY),
  (4, 'waiting_parts', 'منتطر رسیدن باتری اصل.', 2, NOW() - INTERVAL 3 DAY),
  (5, 'received', 'دستگاه در پذیرش ثبت شد.', 1, NOW() - INTERVAL 2 DAY),
  (5, 'inspection', 'بررسی اسیب رطوبت در جریان است.', 2, NOW() - INTERVAL 1 DAY),
  (6, 'received', 'دستگاه امروز در پذیرش ثبت شد.', 1, NOW());
