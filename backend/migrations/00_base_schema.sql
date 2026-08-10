CREATE TABLE IF NOT EXISTS public.systems (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.templates (
    id SERIAL PRIMARY KEY,
    system_id INTEGER NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
    code VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    accessory_brand VARCHAR(100),
    glass_type VARCHAR(100),
    percent_aluminum REAL DEFAULT 45,
    percent_glass REAL DEFAULT 10,
    percent_accessories REAL DEFAULT 20,
    percent_labor REAL DEFAULT 25
);

CREATE TABLE IF NOT EXISTS public.profile_formulas (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    dimension_type VARCHAR(50) NOT NULL,
    formula VARCHAR(255) NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    weight_per_m REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.accessory_formulas (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    qty REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.materials (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'pc',
    default_price REAL NOT NULL DEFAULT 0,
    weight_per_m REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.project_doors (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    template_id INTEGER NOT NULL REFERENCES public.templates(id),
    width REAL NOT NULL,
    height REAL NOT NULL,
    width1 REAL,
    height1 REAL,
    width2 REAL,
    height2 REAL,
    qty INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.project_material_prices (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    material_code VARCHAR(255) NOT NULL,
    material_name VARCHAR(255),
    unit VARCHAR(50),
    price REAL NOT NULL DEFAULT 0,
    weight REAL DEFAULT 0,
    UNIQUE(project_id, material_code)
);
