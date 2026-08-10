CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.price_books (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.material_price_book_items (
    id SERIAL PRIMARY KEY,
    price_book_id INTEGER NOT NULL REFERENCES public.price_books(id) ON DELETE CASCADE,
    material_code VARCHAR(255) NOT NULL REFERENCES public.materials(code) ON DELETE CASCADE,
    price REAL NOT NULL DEFAULT 0,
    UNIQUE(price_book_id, material_code)
);

CREATE TABLE IF NOT EXISTS public.indirect_cost_configs (
    id SERIAL PRIMARY KEY,
    cost_type VARCHAR(50) NOT NULL,
    option_name VARCHAR(255) NOT NULL,
    value_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
    value REAL NOT NULL DEFAULT 0,
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.project_indirect_cost_selections (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    cost_type VARCHAR(50) NOT NULL,
    indirect_cost_config_id INTEGER REFERENCES public.indirect_cost_configs(id) ON DELETE SET NULL,
    custom_value REAL,
    UNIQUE(project_id, cost_type)
);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS price_book_id INTEGER REFERENCES public.price_books(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS target_profit_margin REAL DEFAULT 10;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS target_total_price REAL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS has_opera_bom BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pct_company REAL DEFAULT 2;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pct_contingency REAL DEFAULT 2;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pct_warranty REAL DEFAULT 1.5;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pct_other REAL DEFAULT 1;

ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS layout_json TEXT;

ALTER TABLE public.project_doors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.project_doors ADD COLUMN IF NOT EXISTS override_transport_cost REAL;
ALTER TABLE public.project_doors ADD COLUMN IF NOT EXISTS override_installation_cost REAL;
ALTER TABLE public.project_doors ADD COLUMN IF NOT EXISTS override_labor_cost REAL;
ALTER TABLE public.project_doors ADD COLUMN IF NOT EXISTS price_per_m2 REAL DEFAULT 0;
ALTER TABLE public.project_doors ADD COLUMN IF NOT EXISTS layout_json TEXT;

CREATE TABLE IF NOT EXISTS public.project_opera_materials (
    id BIGSERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    typology_name VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    description TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    quantity_unit VARCHAR(50) NOT NULL DEFAULT 'pc',
    unit_weight REAL,
    color VARCHAR(100),
    width REAL,
    height REAL,
    unit_price REAL,
    mapped_material_id INTEGER REFERENCES public.materials(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_project_opera_materials_project ON public.project_opera_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_opera_materials_code ON public.project_opera_materials(project_id, code);

CREATE TABLE IF NOT EXISTS public.material_price_history (
    id BIGSERIAL PRIMARY KEY,
    material_id INTEGER,
    material_code VARCHAR(100) NOT NULL,
    scope VARCHAR(30) NOT NULL,
    price_book_id INTEGER,
    project_id INTEGER,
    old_price NUMERIC,
    new_price NUMERIC NOT NULL,
    changed_by INTEGER,
    changed_by_name VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_price_history_material ON public.material_price_history(material_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quote_versions (
    id BIGSERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    note TEXT,
    snapshot_json JSONB NOT NULL,
    total_area NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    report_filename VARCHAR(255),
    report_file BYTEA,
    pdf_filename VARCHAR(255),
    pdf_file BYTEA,
    created_by INTEGER,
    created_by_name VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INTEGER,
    updated_by_name VARCHAR(200),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by INTEGER,
    approved_by_name VARCHAR(200),
    approved_at TIMESTAMPTZ,
    sent_by INTEGER,
    sent_by_name VARCHAR(200),
    sent_at TIMESTAMPTZ,
    accepted_by INTEGER,
    accepted_by_name VARCHAR(200),
    accepted_at TIMESTAMPTZ,
    UNIQUE(project_id, version_number)
);
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255);
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS pdf_file BYTEA;
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS approved_by INTEGER;
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(200);
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS sent_by INTEGER;
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(200);
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS accepted_by INTEGER;
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS accepted_by_name VARCHAR(200);
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_quote_versions_project ON public.quote_versions(project_id, version_number DESC);

INSERT INTO public.indirect_cost_configs (cost_type, option_name, value_type, value, description)
SELECT seed.cost_type, seed.option_name, seed.value_type, seed.value, seed.description
FROM (VALUES
    ('transport', 'Dưới 10km', 'fixed', 500000::REAL, 'Vận chuyển nội thành cự ly ngắn dưới 10km'),
    ('transport', 'Từ 11km đến 50km', 'fixed', 1500000::REAL, 'Vận chuyển cự ly trung bình từ 11km đến 50km'),
    ('transport', 'Trên 50km', 'fixed', 3000000::REAL, 'Vận chuyển liên tỉnh cự ly dài trên 50km'),
    ('installation', 'Lắp đặt Tiêu chuẩn', 'percent', 5::REAL, 'Chi phí lắp đặt tính theo 5% giá trị vật tư'),
    ('installation', 'Lắp đặt Cao tầng', 'percent', 8::REAL, 'Chi phí lắp đặt cao tầng tính theo 8% giá trị vật tư'),
    ('fabrication', 'Gia công Tiêu chuẩn', 'fixed', 150000::REAL, 'Gia công tại xưởng theo m²'),
    ('contingency', 'Dự phòng rủi ro mặc định', 'percent', 2::REAL, 'Dự phòng hao hụt vật tư 2%')
) AS seed(cost_type, option_name, value_type, value, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.indirect_cost_configs existing
    WHERE existing.cost_type = seed.cost_type AND existing.option_name = seed.option_name
);

INSERT INTO public.price_books (name, description)
SELECT 'Hệ đơn giá Tiêu chuẩn', 'Hệ đơn giá mặc định toàn hệ thống'
WHERE NOT EXISTS (SELECT 1 FROM public.price_books WHERE name = 'Hệ đơn giá Tiêu chuẩn');
