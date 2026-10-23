-- ==============================================================================
-- SCHEMA DO BANCO DE DADOS SUPABASE - RETÍFICA VISION AI
-- Execute este script no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/wnjevjbzgqiqtootttfo/sql/new
-- ==============================================================================

-- 1. Tabela: pastas_trabalho (As 4 pastas simultâneas de motores em andamento)
CREATE TABLE IF NOT EXISTS public.pastas_trabalho (
    id INT PRIMARY KEY,
    nome TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'livre',
    placa TEXT DEFAULT '',
    motor_num TEXT DEFAULT '',
    fotos_peca JSONB DEFAULT '[]'::jsonb,
    foto_placa TEXT DEFAULT NULL,
    pecas_identificadas JSONB DEFAULT '[]'::jsonb,
    observacoes TEXT DEFAULT '',
    estado_cabecote TEXT DEFAULT '',
    oficina_nome TEXT DEFAULT 'Retífica Especializada',
    procedimentos JSONB DEFAULT '[]'::jsonb,
    procedimentos_texto TEXT DEFAULT '',
    localizacao JSONB DEFAULT '{"texto":"","coords":null,"mapsUrl":""}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir as 4 pastas iniciais (se ainda não existirem)
INSERT INTO public.pastas_trabalho (id, nome, status, oficina_nome)
VALUES 
    (1, 'Pasta 1', 'livre', 'Retífica Especializada'),
    (2, 'Pasta 2', 'livre', 'Retífica Especializada'),
    (3, 'Pasta 3', 'livre', 'Retífica Especializada'),
    (4, 'Pasta 4', 'livre', 'Retífica Especializada')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela: registros (Histórico de motores concluídos e arquivados)
CREATE TABLE IF NOT EXISTS public.registros (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_registro TEXT UNIQUE NOT NULL,
    pasta_id INT,
    nome TEXT,
    status TEXT DEFAULT 'concluido',
    placa TEXT,
    motor_num TEXT,
    oficina_nome TEXT DEFAULT 'Retífica Especializada',
    estado_cabecote TEXT,
    observacoes TEXT,
    procedimentos JSONB DEFAULT '[]'::jsonb,
    procedimentos_texto TEXT,
    pecas_identificadas JSONB DEFAULT '[]'::jsonb,
    localizacao JSONB DEFAULT '{"texto":"","coords":null,"mapsUrl":""}'::jsonb,
    fotos_peca JSONB DEFAULT '[]'::jsonb,
    foto_placa TEXT,
    archived_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para busca rápida por placa ou número do motor no histórico
CREATE INDEX IF NOT EXISTS idx_registros_placa ON public.registros (placa);
CREATE INDEX IF NOT EXISTS idx_registros_motor ON public.registros (motor_num);
CREATE INDEX IF NOT EXISTS idx_registros_archived_at ON public.registros (archived_at DESC);

-- 3. Tabela: configuracoes (Configurações centrais da oficina e chaves)
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id INT PRIMARY KEY DEFAULT 1,
    empresa_nome TEXT DEFAULT 'Retífica Especializada',
    telefone_whatsapp TEXT DEFAULT '',
    email_destino TEXT DEFAULT '',
    gemini_api_key TEXT DEFAULT '',
    som_ativado BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir configuração padrão inicial
INSERT INTO public.configuracoes (id, empresa_nome)
VALUES (1, 'Retífica Especializada')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 4. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- Permite leitura e gravação segura para a chave anon/publishable pública
-- ==============================================================================

ALTER TABLE public.pastas_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas para pastas_trabalho
DROP POLICY IF EXISTS "Permitir tudo em pastas_trabalho para anon" ON public.pastas_trabalho;
CREATE POLICY "Permitir tudo em pastas_trabalho para anon"
ON public.pastas_trabalho FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Políticas para registros
DROP POLICY IF EXISTS "Permitir tudo em registros para anon" ON public.registros;
CREATE POLICY "Permitir tudo em registros para anon"
ON public.registros FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Políticas para configuracoes
DROP POLICY IF EXISTS "Permitir tudo em configuracoes para anon" ON public.configuracoes;
CREATE POLICY "Permitir tudo em configuracoes para anon"
ON public.configuracoes FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Conceder permissões públicas no schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
