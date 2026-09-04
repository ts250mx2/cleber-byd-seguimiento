CREATE TABLE IF NOT EXISTS agencies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agency_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrador','supervisor','agente_bdc','asesor') NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(190) NOT NULL,
  normalized_name VARCHAR(190) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(190),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_normalized_name (normalized_name),
  INDEX idx_customer_phone (phone),
  INDEX idx_customer_email (email)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  vin VARCHAR(255) NOT NULL,
  model VARCHAR(120),
  model_year SMALLINT,
  current_mileage INT UNSIGNED,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  UNIQUE KEY uq_customer_vin (customer_id, vin),
  INDEX idx_vehicle_vin (vin)
);

CREATE TABLE IF NOT EXISTS follow_up_cases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agency_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  vehicle_id BIGINT UNSIGNED NOT NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  advisor_name VARCHAR(190) NULL,
  bdc_agent_name VARCHAR(190) NULL,
  source ENUM('entrega','servicio') NOT NULL,
  import_key VARCHAR(255) NULL,
  source_file VARCHAR(190) NULL,
  source_sheet VARCHAR(190) NULL,
  source_row INT UNSIGNED NULL,
  external_order VARCHAR(60),
  reference_date DATE NOT NULL,
  status ENUM('pendiente','contactado','incidencia','resuelto','no_localizado') NOT NULL DEFAULT 'pendiente',
  priority ENUM('alta','media','normal') NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (assigned_user_id) REFERENCES users(id),
  UNIQUE KEY uq_case_import_key (import_key),
  INDEX idx_cases_queue (status, reference_date, agency_id),
  INDEX idx_cases_assignee (assigned_user_id, status)
);

CREATE TABLE IF NOT EXISTS touchpoints (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  stage ENUM('7','15','28','nps') NOT NULL,
  due_at DATE NOT NULL,
  completed_at DATETIME NULL,
  result TEXT,
  notes TEXT,
  completed_by BIGINT UNSIGNED NULL,
  FOREIGN KEY (case_id) REFERENCES follow_up_cases(id),
  FOREIGN KEY (completed_by) REFERENCES users(id),
  UNIQUE KEY uq_case_stage (case_id, stage),
  INDEX idx_touchpoints_queue (completed_at, due_at)
);

CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  owner_id BIGINT UNSIGNED NULL,
  owner_name VARCHAR(190) NULL,
  category VARCHAR(100),
  description TEXT NOT NULL,
  priority ENUM('alta','media','normal') NOT NULL DEFAULT 'alta',
  solution TEXT,
  status ENUM('abierta','en_proceso','resuelta') NOT NULL DEFAULT 'abierta',
  due_at DATETIME NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES follow_up_cases(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_incidents_status (status, due_at)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(50) NOT NULL,
  payload JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_audit_entity (entity_type, entity_id, created_at)
);
