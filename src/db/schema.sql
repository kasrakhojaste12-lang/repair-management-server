-- ساختار دیتابیس سیستم مدیریت تعمیرات
CREATE DATABASE IF NOT EXISTS `repair_management`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `repair_management`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(60) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `role` ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `email` VARCHAR(120) NULL,
  `address` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_phone` (`phone`),
  KEY `idx_customers_full_name` (`full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `devices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` INT UNSIGNED NOT NULL,
  `device_type` ENUM('mobile', 'laptop', 'desktop', 'tablet') NOT NULL,
  `brand` VARCHAR(60) NOT NULL,
  `model` VARCHAR(60) NOT NULL,
  `serial_number` VARCHAR(80) NULL,
  `issue_description` TEXT NOT NULL,
  `received_date` DATE NOT NULL,
  `expected_delivery_date` DATE NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_devices_customer` (`customer_id`),
  CONSTRAINT `fk_devices_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `repairs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id` INT UNSIGNED NOT NULL,
  `status` ENUM('received', 'inspection', 'waiting_parts', 'in_repair', 'completed', 'delivered')
    NOT NULL DEFAULT 'received',
  `payment_status` ENUM('paid', 'unpaid') NOT NULL DEFAULT 'unpaid',
  `technician_notes` TEXT NULL,
  `parts_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `labor_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `additional_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `paid_at` DATETIME NULL,
  `delivered_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_repairs_device` (`device_id`),
  KEY `idx_repairs_status` (`status`),
  KEY `idx_repairs_paid_at` (`paid_at`),
  CONSTRAINT `fk_repairs_device` FOREIGN KEY (`device_id`)
    REFERENCES `devices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `repair_status_history` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `repair_id` INT UNSIGNED NOT NULL,
  `status` ENUM('received', 'inspection', 'waiting_parts', 'in_repair', 'completed', 'delivered') NOT NULL,
  `notes` TEXT NULL,
  `changed_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_history_repair` (`repair_id`),
  CONSTRAINT `fk_history_repair` FOREIGN KEY (`repair_id`)
    REFERENCES `repairs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_history_user` FOREIGN KEY (`changed_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
